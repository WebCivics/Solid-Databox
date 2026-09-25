import { BadRequestHttpError } from '../../../../util/errors/BadRequestHttpError';
import { InternalServerError } from '../../../../util/errors/InternalServerError';
import { canonicalDigest } from '../../../proof/Canonicalization';
import { GENESIS_PREV_DIGEST } from '../../../evidence/EvidenceChain';

/**
 * Decision-record logging (CIV-B10, `concession-card.html`): every automated eligibility decision
 * logs the RULE that fired + a digest of the inputs it saw + the outcome — as an append-only,
 * hash-chained record. This is what makes an automated eligibility call *challengeable*: a member
 * (or a reviewer) can ask "which rule decided that, on what inputs?" and get a verifiable answer
 * rather than a shrug — and a coerced/tampered record breaks the chain (`verify`).
 *
 * Privacy: the log stores a canonical DIGEST of the decision inputs, never the raw attribute values
 * (income, diagnosis, status) — a reviewer can confirm "the same inputs → the same decision" without
 * the log itself leaking protected attributes. The subject is a pairwise identifier, so an issuer
 * can't be cross-correlated with a raw institutional identity.
 *
 * Append-only: there is no update/delete — a wrong decision is answered by a *new* decision (an
 * appeal/reassessment record superseding it), keeping the full audit trail intact.
 */

export interface EligibilityDecisionInput {
  /** The subject's pairwise identifier (never a raw institutional ID). */
  readonly subjectId: string;
  /** The eligibility rule that fired (its stable id + version, e.g. `pensioner-aus@v3`). */
  readonly ruleId: string;
  /** The version/policy-scope the decision ran under (e.g. the program or scheme). */
  readonly scope: string;
  /** The canonical inputs the rule consumed — digested for privacy, never stored raw. */
  readonly inputs: Readonly<Record<string, unknown>>;
  /** What the rule decided. */
  readonly outcome: 'eligible' | 'ineligible' | 'conditional';
  /** The groups/entitlements the outcome granted (when eligible). */
  readonly granted?: readonly string[];
  /** A human-reviewable explanation of why (the rule's stated reason). */
  readonly reason: string;
  /** When a prior decision is being superseded (an appeal/reassessment), its digest. */
  readonly supersedesDigest?: string;
}

export interface DecisionRecord {
  readonly sequence: number;
  readonly subjectId: string;
  readonly ruleId: string;
  readonly scope: string;
  /** Canonical digest of the inputs the rule saw — NOT the raw attributes. */
  readonly inputsDigest: string;
  readonly outcome: 'eligible' | 'ineligible' | 'conditional';
  readonly granted?: readonly string[];
  readonly reason: string;
  readonly supersedesDigest?: string;
  readonly decidedAt: string;
  readonly prevDigest: string;
  readonly recordDigest: string;
}

export class EligibilityDecisionLog {
  private readonly records: DecisionRecord[] = [];
  private readonly now: () => string;

  public constructor(now: () => string = (): string => new Date().toISOString()) {
    this.now = now;
  }

  /** Log an eligibility decision — append-only; returns the bound, digest-anchored record. */
  public record(input: EligibilityDecisionInput): DecisionRecord {
    assertDecision(input);
    const base = {
      sequence: this.records.length,
      subjectId: input.subjectId.trim(),
      ruleId: input.ruleId.trim(),
      scope: input.scope.trim(),
      // Digest the inputs — the log holds WHAT the rule saw as a commitment, not the raw values.
      inputsDigest: canonicalDigest(input.inputs),
      outcome: input.outcome,
      granted: input.granted,
      reason: input.reason.trim(),
      supersedesDigest: input.supersedesDigest,
      decidedAt: this.now(),
      prevDigest: this.records.at(-1)?.recordDigest ?? GENESIS_PREV_DIGEST,
    };
    const record: DecisionRecord = Object.freeze({ ...base, recordDigest: canonicalDigest(base) });
    this.records.push(record);
    return record;
  }

  /** The decisions a subject can see — their own challengeable record trail. */
  public forSubject(subjectId: string): readonly DecisionRecord[] {
    return this.records.filter(r => r.subjectId === subjectId);
  }

  /** The current effective decision for a subject+scope: the latest non-superseded record. */
  public current(subjectId: string, scope: string): DecisionRecord | undefined {
    const superseded = new Set(
      this.records.filter(r => r.supersedesDigest !== undefined).map(r => r.supersedesDigest!),
    );
    return [ ...this.records ]
      .reverse()
      .find(r => r.subjectId === subjectId && r.scope === scope && !superseded.has(r.recordDigest));
  }

  /** Verify the whole chain — a tampered or reordered record fails (T-27). */
  public verify(): { readonly valid: boolean } {
    for (const [ index, record ] of this.records.entries()) {
      if (record.sequence !== index) {
        return { valid: false };
      }
      const expected = index === 0 ? GENESIS_PREV_DIGEST : this.records[index - 1].recordDigest;
      const { recordDigest, ...contents } = record;
      if (record.prevDigest !== expected || recordDigest !== canonicalDigest(contents)) {
        return { valid: false };
      }
    }
    return { valid: true };
  }
}

function assertDecision(input: EligibilityDecisionInput): void {
  for (const field of [ 'subjectId', 'ruleId', 'scope', 'reason' ] as const) {
    if (input[field].trim().length === 0) {
      throw new BadRequestHttpError(`An eligibility decision needs a non-empty ${field}.`);
    }
  }
  if (input.outcome === 'eligible' && (input.granted === undefined || input.granted.length === 0)) {
    throw new BadRequestHttpError('An eligible decision must name the entitlements it granted.');
  }
  if (![ 'eligible', 'ineligible', 'conditional' ].includes(input.outcome)) {
    throw new InternalServerError(`Unknown eligibility outcome '${input.outcome}'.`);
  }
}
