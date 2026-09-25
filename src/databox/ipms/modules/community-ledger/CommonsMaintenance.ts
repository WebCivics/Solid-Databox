import { BadRequestHttpError } from '../../../../util/errors/BadRequestHttpError';
import { InternalServerError } from '../../../../util/errors/InternalServerError';
import { BasicRepresentation } from '../../../../http/representation/BasicRepresentation';
import type { ResourceStore } from '../../../../storage/ResourceStore';
import { canonicalDigest } from '../../../proof/Canonicalization';
import { GENESIS_PREV_DIGEST } from '../../../evidence/EvidenceChain';
import type { RdfShapeConfig } from '../../../gateway/RdfShapeValidator';
import { validateRdfShape } from '../../../gateway/RdfShapeValidator';

/**
 * Commons-maintenance workflow (CIV-B42, `food-health.html`): the shared evidence graph is a
 * COMMONS — anyone may propose a contribution or a correction, but a change only enters the graph
 * after it has been shape-validated AND reviewed. Propose → validate → review → merge, with every
 * step logged to a hash-chained trail, so the commons' integrity is maintained by process, not by
 * trusting contributors.
 *
 * The separation-of-duties boundary: a contributor cannot approve their own proposal — a proposed
 * change needs a reviewer's sign-off before it merges. A malformed/oversized change-set is refused
 * at proposal time (the shared graph is never polluted by unvalidated input). A rejected proposal is
 * logged, not silently dropped — the commons' maintenance is auditable end to end.
 */

export type ProposalStatus = 'pending' | 'merged' | 'rejected';

export interface CommonsProposal {
  readonly proposalId: string;
  readonly contributorId: string;
  /** The graph resource the change targets. */
  readonly target: string;
  /** The change-set body (Turtle/JSON-LD). */
  readonly body: string;
  readonly mediaType: string;
  readonly status: ProposalStatus;
}

export interface MaintenanceEvent {
  readonly sequence: number;
  readonly proposalId: string;
  readonly action: 'proposed' | 'validated' | 'merged' | 'rejected';
  readonly actor: string;
  /** The stated reason — for a `rejected` event (the auditable basis). */
  readonly reason?: string;
  readonly at: string;
  readonly prevDigest: string;
  readonly eventDigest: string;
}

export class CommonsMaintenance {
  private readonly proposals = new Map<string, { proposal: CommonsProposal; merged: boolean }>();
  private readonly events: MaintenanceEvent[] = [];
  private readonly now: () => string;

  public constructor(
    private readonly store: ResourceStore,
    private readonly shapeConfig: RdfShapeConfig,
    now: () => string = (): string => new Date().toISOString(),
  ) {
    this.now = now;
  }

  /**
   * Propose a change-set to the commons graph. The body is shape-validated FIRST — a malformed or
   * over-limit change is refused before it can sit in the queue. Returns the pending proposal.
   */
  public propose(contributorId: string, target: string, body: string, mediaType: string): CommonsProposal {
    if (contributorId.trim().length === 0 || target.trim().length === 0 || body.trim().length === 0) {
      throw new BadRequestHttpError('A proposal needs a contributor, a target resource and a body.');
    }
    // Validate the change-set's shape — the shared graph only takes well-formed, bounded input.
    const rejection = validateRdfShape(Buffer.from(body, 'utf8'), mediaType, this.shapeConfig);
    if (rejection !== undefined) {
      throw new BadRequestHttpError(`Change-set failed shape validation: ${rejection.reason}.`);
    }
    const proposalId = `proposal-${canonicalDigest({ target, body, contributorId }).slice(-16)}`;
    const proposal: CommonsProposal = Object.freeze({
      proposalId,
      contributorId,
      target,
      body,
      mediaType,
      status: 'pending',
    });
    this.proposals.set(proposalId, { proposal, merged: false });
    this.record(proposalId, 'proposed', contributorId);
    this.record(proposalId, 'validated', 'shape-validator');
    return proposal;
  }

  /**
   * Merge a proposal into the graph — a REVIEWER's act, never the contributor's own. Fails closed:
   * an unknown proposal, a self-approval, or a re-merge all reject.
   */
  public async merge(proposalId: string, reviewer: string): Promise<void> {
    const entry = this.require(proposalId);
    if (entry.proposal.contributorId === reviewer) {
      throw new BadRequestHttpError('Separation of duties — a contributor cannot merge their own proposal.');
    }
    if (entry.proposal.status !== 'pending') {
      throw new BadRequestHttpError(`Proposal '${proposalId}' is '${entry.proposal.status}', not pending.`);
    }
    await this.store.setRepresentation(
      { path: entry.proposal.target },
      new BasicRepresentation([ Buffer.from(entry.proposal.body, 'utf-8') ], entry.proposal.mediaType),
    );
    this.proposals.set(proposalId, {
      proposal: { ...entry.proposal, status: 'merged' },
      merged: true,
    });
    this.record(proposalId, 'merged', reviewer);
  }

  /** Reject a proposal — logged with the reason, the change never merges. */
  public reject(proposalId: string, reviewer: string, reason: string): void {
    const entry = this.require(proposalId);
    if (entry.proposal.status !== 'pending') {
      throw new BadRequestHttpError(`Proposal '${proposalId}' is '${entry.proposal.status}', not pending.`);
    }
    this.proposals.set(proposalId, {
      proposal: { ...entry.proposal, status: 'rejected' },
      merged: false,
    });
    this.record(proposalId, 'rejected', reviewer, reason);
  }

  /** The proposal's current status. */
  public status(proposalId: string): ProposalStatus {
    return this.require(proposalId).proposal.status;
  }

  /** The append-only maintenance trail — every step logged, hash-chained. */
  public trail(): readonly MaintenanceEvent[] {
    return [ ...this.events ];
  }

  /** Verify the maintenance trail — a tampered event fails (T-27). */
  public verify(): { readonly valid: boolean } {
    for (const [ index, event ] of this.events.entries()) {
      const { eventDigest, ...contents } = event;
      const expected = index === 0 ? GENESIS_PREV_DIGEST : this.events[index - 1].eventDigest;
      if (event.sequence !== index || event.prevDigest !== expected ||
        eventDigest !== canonicalDigest(contents)) {
        return { valid: false };
      }
    }
    return { valid: true };
  }

  private require(proposalId: string): { proposal: CommonsProposal; merged: boolean } {
    const entry = this.proposals.get(proposalId);
    if (entry === undefined) {
      throw new InternalServerError(`No commons proposal '${proposalId}'.`);
    }
    return entry;
  }

  private record(
    proposalId: string,
    action: MaintenanceEvent['action'],
    actor: string,
    reason?: string,
  ): void {
    const base = {
      sequence: this.events.length,
      proposalId,
      action,
      actor,
      reason,
      at: this.now(),
      prevDigest: this.events.at(-1)?.eventDigest ?? GENESIS_PREV_DIGEST,
    };
    this.events.push(Object.freeze({ ...base, eventDigest: canonicalDigest(base) }));
  }
}
