import { BadRequestHttpError } from '../../../../util/errors/BadRequestHttpError';
import { InternalServerError } from '../../../../util/errors/InternalServerError';
import { canonicalDigest } from '../../../proof/Canonicalization';
import { GENESIS_PREV_DIGEST } from '../../../evidence/EvidenceChain';
import type { DurableStateStore } from '../../../durable/DurableStateStore';

/**
 * The community contribution ledger (CIV-B2, `community-ledger.html`) — "version control for
 * real-world projects". An auditable, append-only, hash-chained record of who contributed which
 * time, skill, materials, facility-usage or dollars to a community/cooperative project.
 *
 * Nothing is ever mutated or deleted: a recognition, a withdrawal, a correction is a NEW entry
 * superseding the original — so the full history is auditable and a tampered/rewritten entry breaks
 * the hash chain (`verify`). Each project's contributions chain on `prevDigest`, binding the
 * per-project history into an ordered, tamper-evident log (the same digest primitive the C13
 * evidence ledger uses, but on a contribution record — not a storage-op audit record).
 *
 * Privacy: `contributorId` is the contributor's pairwise WebID — the ledger never stores a raw
 * institutional/customer identity. A contribution's *recognition* (that a community accepted it) is
 * a separate entry, so recognition is an explicit, auditable act — not implicit.
 */

export type ContributionKind = 'time' | 'skill' | 'materials' | 'facility' | 'funds' | 'other';

export interface Contribution {
  /** Opaque contribution identifier (CSPRNG-assigned by the caller/registry). */
  readonly contributionId: string;
  /** The community/cooperative project this contributes to. */
  readonly projectId: string;
  /** The contributor's pairwise WebID — never a raw institutional identity. */
  readonly contributorId: string;
  /** What was contributed. */
  readonly kind: ContributionKind;
  /** The amount — value + unit (`hours`, `AUD`, `kg`, `sessions`, …). */
  readonly quantity: { readonly value: number; readonly unit: string };
  /** A short human description (the recognisable work). */
  readonly description: string;
}

export type ContributionEventKind = 'log' | 'recognise' | 'withdraw';

export interface ContributionEvent {
  /** Zero-based position in this project's chain. */
  readonly sequence: number;
  readonly projectId: string;
  readonly contributionId: string;
  readonly kind: ContributionEventKind;
  /** The contribution for a `log` event; omitted for recognise/withdraw (they reference it). */
  readonly contribution?: Contribution;
  /** Who acted (recogniser / withdrawer WebID) for recognise/withdraw. */
  readonly actor?: string;
  readonly recordedAt: string;
  readonly prevDigest: string;
  readonly entryDigest: string;
}

/** The folded current state of a contribution: its log plus whether it was recognised/withdrawn. */
export interface ContributionState {
  readonly contribution: Contribution;
  readonly recognised: boolean;
  readonly withdrawn: boolean;
}

interface LedgerState {
  /** ProjectId → its committed contribution-event chain (verbatim). */
  readonly chains: Readonly<Record<string, readonly ContributionEvent[]>>;
}

export class ContributionLedger {
  private readonly chains = new Map<string, ContributionEvent[]>();
  private readonly now: () => string;
  private initialized = false;

  public constructor(
    now: () => string = (): string => new Date().toISOString(),
    /** Optional durable store — when present the chains persist (CIV-C10) and rehydrate on initialize(). */
    private readonly durable?: DurableStateStore,
  ) {
    this.now = now;
  }

  /**
   * Rehydrate the chains from the durable store — only when a store was injected. Each restored
   * project chain is re-verified before it's trusted (a tampered persisted doc fails closed, T-27).
   */
  public async initialize(): Promise<void> {
    if (this.durable === undefined) {
      this.initialized = true;
      return;
    }
    const saved = await this.durable.load<LedgerState>();
    for (const [ projectId, entries ] of Object.entries(saved?.chains ?? {})) {
      this.chains.set(projectId, [ ...entries ]);
      if (!this.verify(projectId).valid) {
        throw new InternalServerError(`Persisted contribution chain for '${projectId}' failed integrity on load.`);
      }
    }
    this.initialized = true;
  }

  /** Log a contribution — an append-only `log` entry. A re-log of the same contributionId is idempotent. */
  public async log(contribution: Contribution): Promise<ContributionEvent> {
    assertContribution(contribution);
    const existing = this.state(contribution.projectId).get(contribution.contributionId);
    if (existing !== undefined) {
      // Idempotent re-log: the contribution is already committed; never mint a second entry (T-24).
      return this.lastEntry(contribution.projectId);
    }
    return this.append(contribution.projectId, contribution.contributionId, 'log', contribution);
  }

  /** Record that the community recognised a contribution — an auditable act, not implicit. */
  public async recognise(projectId: string, contributionId: string, recogniser: string): Promise<ContributionEvent> {
    const state = this.state(projectId).get(contributionId);
    if (state === undefined) {
      throw new BadRequestHttpError(`No logged contribution '${contributionId}' — cannot recognise it.`);
    }
    if (state.withdrawn) {
      throw new BadRequestHttpError('A withdrawn contribution cannot be recognised.');
    }
    return this.append(projectId, contributionId, 'recognise', undefined, recogniser);
  }

  /** Record a contribution withdrawn (superseded by the chain, never erased). */
  public async withdraw(projectId: string, contributionId: string, actor: string): Promise<ContributionEvent> {
    const state = this.state(projectId).get(contributionId);
    if (state === undefined) {
      throw new BadRequestHttpError(`No logged contribution '${contributionId}' — cannot withdraw it.`);
    }
    return this.append(projectId, contributionId, 'withdraw', undefined, actor);
  }

  /** The folded current state of every contribution in a project (recognised/withdrawn flags set). */
  public contributions(projectId: string): readonly ContributionState[] {
    return [ ...this.state(projectId).values() ];
  }

  /** The raw append-only event chain for a project (auditable history). */
  public events(projectId: string): readonly ContributionEvent[] {
    return [ ...this.chains.get(projectId) ?? [] ];
  }

  /** Verify a project's chain: any tampered entry or reorder fails (T-27). */
  public verify(projectId: string): { readonly valid: boolean } {
    const chain = this.events(projectId);
    for (const [ index, entry ] of chain.entries()) {
      if (entry.sequence !== index) {
        return { valid: false };
      }
      const expected = index === 0 ? GENESIS_PREV_DIGEST : chain[index - 1].entryDigest;
      // Re-digest over the entry WITHOUT its own entryDigest field (the digest is of the contents).
      const { entryDigest, ...contents } = entry;
      if (entry.prevDigest !== expected || entryDigest !== this.digest(contents)) {
        return { valid: false };
      }
    }
    return { valid: true };
  }

  private async append(
    projectId: string,
    contributionId: string,
    kind: ContributionEventKind,
    contribution?: Contribution,
    actor?: string,
  ): Promise<ContributionEvent> {
    if (this.durable !== undefined && !this.initialized) {
      throw new InternalServerError('A durable ContributionLedger must be initialized() before use.');
    }
    const chain = this.chains.get(projectId) ?? [];
    const base = {
      sequence: chain.length,
      projectId,
      contributionId,
      kind,
      contribution,
      actor,
      recordedAt: this.now(),
      prevDigest: chain.at(-1)?.entryDigest ?? GENESIS_PREV_DIGEST,
    };
    const entry: ContributionEvent = Object.freeze({ ...base, entryDigest: this.digest(base) });
    chain.push(entry);
    this.chains.set(projectId, chain);
    // Write-through to the durable store when present — the append is the commit point.
    await this.persist();
    return entry;
  }

  private async persist(): Promise<void> {
    if (this.durable === undefined) {
      return;
    }
    const chains: Record<string, readonly ContributionEvent[]> = {};
    for (const [ projectId, entries ] of this.chains) {
      chains[projectId] = entries;
    }
    await this.durable.save<LedgerState>({ chains });
  }

  private digest(entry: Omit<ContributionEvent, 'entryDigest'>): string {
    return canonicalDigest(entry);
  }

  private lastEntry(projectId: string): ContributionEvent {
    const chain = this.chains.get(projectId) ?? [];
    const last = chain.at(-1);
    if (last === undefined) {
      throw new InternalServerError('No committed contribution entry to return.');
    }
    return last;
  }

  /** Fold the event chain into the current state per contribution. */
  private state(projectId: string): Map<string, ContributionState> {
    const out = new Map<string, ContributionState>();
    for (const event of this.events(projectId)) {
      if (event.kind === 'log' && event.contribution !== undefined) {
        out.set(event.contributionId, { contribution: event.contribution, recognised: false, withdrawn: false });
      } else {
        const current = out.get(event.contributionId);
        if (current !== undefined) {
          out.set(event.contributionId, {
            ...current,
            recognised: current.recognised || event.kind === 'recognise',
            withdrawn: current.withdrawn || event.kind === 'withdraw',
          });
        }
      }
    }
    return out;
  }
}

function assertContribution(c: Contribution): void {
  if (c.contributionId.trim().length === 0 || c.projectId.trim().length === 0) {
    throw new BadRequestHttpError('A contribution needs a contributionId and a projectId.');
  }
  if (c.contributorId.trim().length === 0) {
    throw new BadRequestHttpError('A contribution needs the contributor\'s pairwise WebID.');
  }
  if (!(c.quantity.value > 0) || c.quantity.unit.trim().length === 0) {
    throw new BadRequestHttpError('A contribution needs a positive quantity and a unit.');
  }
  if (!Number.isFinite(c.quantity.value)) {
    throw new InternalServerError('A contribution quantity must be a finite number.');
  }
}
