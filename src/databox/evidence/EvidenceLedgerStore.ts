import { BadRequestHttpError } from '../../util/errors/BadRequestHttpError';
import { digestOfBytes } from '../proof/Canonicalization';
import type { DataboxRequestContext } from '../context/DataboxRequestContext';
import type { AppendOnlyEvidence, AppendOnlyEvidenceSink } from '../storage/AppendOnlyEvidence';
import type { AuditEvidenceRecord, OutboxRecord, PolicyEvaluation } from './AuditEvidence';
import { assertNonEmpty, buildAuditRecord } from './AuditEvidence';
import type { ChainVerification, LedgerEntry } from './EvidenceChain';
import { computeEntryDigest, GENESIS_PREV_DIGEST, verifyChain } from './EvidenceChain';

/**
 * The append-only, external-to-Pod, hash-chained evidence ledger (component C13; ADR-0019). This is the
 * REAL C13 ledger the DBX-09 {@link NotImplementedEvidenceLedger} stub stood in for, and the §7.0 commit
 * anchor: {@link HashChainedEvidenceLedger.append} commits the evidence event AND the outbox record together
 * as one atomic entry (the single-store transaction is the commit point — nothing accepted, no receipt and
 * no event emitted if it does not commit).
 *
 * It is EXTERNAL to ordinary Pod mutation: it is its own store, reachable only through {@link append}, with
 * NO update or delete surface. Ordinary Solid PUT/PATCH/DELETE never reach it, so an owner/admin cannot
 * rewrite it through the Pod (T-27/T-32). Integrity is the hash chain (each entry binds the prior digest),
 * so tamper and reorder are detectable via {@link verify}. The in-memory chains are the reference substrate
 * a durable WORM store replaces behind the same append-only surface (ADR-0019 §Open sub-questions).
 */

/** The input to an atomic §7.0 append: the bound evidence record and (optionally) the outbox record. */
export interface LedgerAppendInput {
  /** Opaque tenant identifier the entry belongs to (program-local). */
  readonly tenantId: string;
  /** The fully bound evidence record (from {@link buildAuditRecord}). */
  readonly record: AuditEvidenceRecord;
  /** The outbox record appended atomically in the same commit (IF-05/IF-07), when the op emits an event. */
  readonly outbox?: OutboxRecord;
}

function assertOutbox(outbox: OutboxRecord, tenantId: string): void {
  assertNonEmpty(outbox.eventId, 'outbox.eventId');
  assertNonEmpty(outbox.resourceRef, 'outbox.resourceRef');
  assertNonEmpty(outbox.activity, 'outbox.activity');
  if (outbox.tenantId !== tenantId) {
    throw new BadRequestHttpError('Outbox record tenant must equal the appending tenant (no cross-tenant outbox).');
  }
}

export class HashChainedEvidenceLedger {
  /**
   * `protected` so {@link DurableEvidenceLedger} can restore the exact persisted chain verbatim on
   * rehydration — integrity lives in the entries' own digests, and `verify` re-checks the restored
   * chain, so a subclass exposing this cannot weaken the WORM guarantee.
   */
  protected readonly chains = new Map<string, LedgerEntry[]>();
  protected readonly now: () => string;

  public constructor(now: () => string = (): string => new Date().toISOString()) {
    this.now = now;
  }

  /**
   * Durably append one entry — the §7.0 commit point. The evidence record and the outbox record are bound
   * into a single hash-chained entry (atomic: either the entry is committed whole or nothing is, since a
   * validation failure throws BEFORE the single `push`). The entry binds the prior entry's digest, so it
   * cannot be reordered undetectably. Fails closed on a blank tenant, a non-object record or a cross-tenant
   * outbox. The committed, frozen entry is returned.
   */
  public async append(input: LedgerAppendInput): Promise<LedgerEntry> {
    assertNonEmpty(input.tenantId, 'tenantId');
    if (typeof input.record !== 'object' || input.record === null) {
      throw new BadRequestHttpError('Evidence append requires a bound record object.');
    }
    if (input.outbox !== undefined) {
      assertOutbox(input.outbox, input.tenantId);
    }
    const chain = this.chains.get(input.tenantId) ?? [];
    const sequence = chain.length;
    const prevDigest = sequence === 0 ? GENESIS_PREV_DIGEST : chain[sequence - 1].entryDigest;
    const base = {
      sequence,
      tenantId: input.tenantId,
      recordedAt: this.now(),
      prevDigest,
      record: input.record,
      outbox: input.outbox,
    };
    const entry: LedgerEntry = Object.freeze({ ...base, entryDigest: computeEntryDigest(base) });
    // Single mutation, after all validation: the append is the atomic commit. There is deliberately no
    // path that rewrites an existing entry — the ledger is append-only.
    chain.push(entry);
    this.chains.set(input.tenantId, chain);
    return entry;
  }

  /** The committed entries for a tenant, as a defensive copy (each entry is itself frozen). */
  public entries(tenantId: string): readonly LedgerEntry[] {
    return [ ...this.chains.get(tenantId) ?? [] ];
  }

  /** Verify the tenant chain's integrity: detects any tampered entry or any reorder (T-27). */
  public verify(tenantId: string): ChainVerification {
    return verifyChain(this.entries(tenantId));
  }

  /** The tenants that have at least one committed entry. */
  public tenants(): readonly string[] {
    return [ ...this.chains.keys() ];
  }
}

/** Configuration for {@link LedgerEvidenceSink}: the tenant, verified context and policy to bind. */
export interface LedgerSinkOptions {
  /** The tenant the storage events belong to. */
  readonly tenantId: string;
  /** The verified request context whose actor is bound into each recorded event (never headers). */
  readonly context: DataboxRequestContext;
  /** The policy evaluation bound to the supersession/tombstone decision. */
  readonly policy: PolicyEvaluation;
}

/**
 * The {@link AppendOnlyEvidenceSink} (DBX-17) implemented against the C13 ledger: when the append-only store
 * emits a supersession/tombstone event, this commits it to the hash-chained ledger. The event's `target`
 * path is DIGESTED (never stored raw), so the ledger keeps no identifying path (isolation-and-privacy.md;
 * no-leak). This is the seam DBX-17 documented — inject it as the store's evidence sink.
 */
export class LedgerEvidenceSink implements AppendOnlyEvidenceSink {
  private readonly ledger: HashChainedEvidenceLedger;
  private readonly options: LedgerSinkOptions;

  public constructor(ledger: HashChainedEvidenceLedger, options: LedgerSinkOptions) {
    this.ledger = ledger;
    this.options = options;
  }

  public async record(evidence: AppendOnlyEvidence): Promise<void> {
    const record = buildAuditRecord({
      kind: evidence.kind,
      decision: 'allow',
      reasonCode: `append-only:${evidence.kind}`,
      operation: evidence.kind,
      // Digest the path — the ledger never stores the raw resource path (no identifying data in evidence).
      targetDigest: digestOfBytes(evidence.target),
      recordState: evidence.kind === 'supersession' ? 'superseded' : 'current',
      policy: this.options.policy,
    }, this.options.context);
    await this.ledger.append({ tenantId: this.options.tenantId, record });
  }
}
