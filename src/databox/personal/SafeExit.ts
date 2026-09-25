import { BadRequestHttpError } from '../../util/errors/BadRequestHttpError';
import { canonicalDigest } from '../proof/Canonicalization';
import { GENESIS_PREV_DIGEST } from '../evidence/EvidenceChain';

/**
 * Coercion resistance — the safe-exit / deadman-switch (CIV-B11, `social-web.html` for people under
 * coercion or controlling-partner risk). Two mechanisms, both fail-SAFE for the person:
 *
 *  - **Deadman switch**: the holder sets a check-in interval; if no check-in arrives before it
 *    lapses, the configured safety posture engages automatically (the box assumes the holder may be
 *    incapacitated or under duress). Each check-in resets the timer.
 *  - **Duress / safe-exit signal**: a separately-held duress trigger (a distinct "I'm being forced"
 *    credential or phrase) — when presented, the box engages the safety posture INSTEAD of behaving
 *    normally, so a coercer sees a benign state, not the real one.
 *
 * The safety posture is a declared action set: `lock` (sensitive resources locked), `decoy`
 * (a benign/empty view is served — the real content is hidden, not deleted), and `alert` (a silent
 * alert fires to the declared trusted contacts). Nothing here exposes that the switch engaged —
 * `posture()` returns the ACTIVE posture (for the holder's own tooling), while `presentation()`
 * returns what a requester sees (the decoy view under duress, the real view otherwise).
 *
 * Every engagement is appended to a hash-chained audit record — the switch's own activation is
 * evidence, never silently visible to a coercer (the audit lives control-plane-side).
 */

export type SafetyAction = 'lock' | 'decoy' | 'alert';

export interface SafeExitPolicy {
  /** The holder's pairwise identifier. */
  readonly holderId: string;
  /** Check-in period in ms — lapse engages the posture (the deadman timer). */
  readonly checkInMs: number;
  /** The actions the posture engages. */
  readonly actions: readonly SafetyAction[];
  /** The trusted contacts to alert (pairwise ids), when `alert` is an action. */
  readonly alertContacts?: readonly string[];
  /** The duress phrase/trigger — presenting it engages the posture. */
  readonly duressPhrase: string;
}

export type EngagementReason = 'deadman-lapsed' | 'duress-signal';

export interface EngagementRecord {
  readonly sequence: number;
  readonly holderId: string;
  readonly reason: EngagementReason;
  readonly engagedAt: string;
  readonly prevDigest: string;
  readonly recordDigest: string;
}

export class SafeExit {
  private readonly policy: SafeExitPolicy;
  private lastCheckIn: number;
  private engaged: EngagementReason | undefined;
  private readonly records: EngagementRecord[] = [];
  private readonly nowMs: () => number;

  public constructor(
    policy: SafeExitPolicy,
    nowMs: () => number = (): number => Date.now(),
  ) {
    if (policy.holderId.trim().length === 0 || !(policy.checkInMs > 0)) {
      throw new BadRequestHttpError('A safe-exit policy needs a holder id and a positive check-in interval.');
    }
    if (policy.duressPhrase.trim().length === 0) {
      throw new BadRequestHttpError('A safe-exit policy needs a duress phrase.');
    }
    if (policy.actions.length === 0) {
      throw new BadRequestHttpError('A safe-exit policy must declare ≥1 safety action.');
    }
    if (policy.actions.includes('alert') && (policy.alertContacts === undefined || policy.alertContacts.length === 0)) {
      throw new BadRequestHttpError('An `alert` action needs ≥1 alert contact.');
    }
    this.policy = policy;
    this.lastCheckIn = nowMs();
    this.nowMs = nowMs;
  }

  /** The holder's routine check-in — resets the deadman timer. A genuine check-in also clears duress. */
  public checkIn(): void {
    this.lastCheckIn = this.nowMs();
  }

  /**
   * Present a signal — the duress phrase engages the posture (records `duress-signal`); any other
   * signal is ignored (a guess at the phrase does nothing).
   */
  public signal(candidate: string): void {
    if (candidate === this.policy.duressPhrase) {
      this.engage('duress-signal');
    }
  }

  /**
   * Evaluate whether the deadman timer has lapsed — engages `deadman-lapsed` if it has. Call on
   * each access path (or a timer) so a missed check-in self-engages.
   */
  public poll(): void {
    if (this.engaged === undefined && this.nowMs() - this.lastCheckIn > this.policy.checkInMs) {
      this.engage('deadman-lapsed');
    }
  }

  /** The ACTIVE posture for the holder's own tooling — `undefined` when no posture is engaged. */
  public posture(): EngagementReason | undefined {
    return this.engaged;
  }

  /** Whether the box is currently in a coerced/safe posture. */
  public isEngaged(): boolean {
    return this.engaged !== undefined;
  }

  /**
   * What a REQUESTER sees: under an engaged posture with `decoy`, the benign view (`{ decoy: true }`)
   * — the real content is hidden. Otherwise the real view. The engagement itself is never revealed.
   */
  public presentation(): { decoy: boolean; alertContacts: readonly string[] } {
    let alertContacts: readonly string[] = [];
    if (this.engaged !== undefined && this.policy.actions.includes('alert')) {
      alertContacts = this.policy.alertContacts ?? [];
    }
    return {
      decoy: this.engaged !== undefined && this.policy.actions.includes('decoy'),
      alertContacts,
    };
  }

  /** The engagement audit record — append-only, hash-chained (the switch's own trail is evidence). */
  public auditTrail(): readonly EngagementRecord[] {
    return [ ...this.records ];
  }

  private engage(reason: EngagementReason): void {
    if (this.engaged !== undefined) {
      // Already engaged — idempotent.
      return;
    }
    this.engaged = reason;
    const base = {
      sequence: this.records.length,
      holderId: this.policy.holderId,
      reason,
      engagedAt: new Date(this.nowMs()).toISOString(),
      prevDigest: this.records.at(-1)?.recordDigest ?? GENESIS_PREV_DIGEST,
    };
    this.records.push(Object.freeze({ ...base, recordDigest: canonicalDigest(base) }));
  }
}
