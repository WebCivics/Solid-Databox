import { BadRequestHttpError } from '../../util/errors/BadRequestHttpError';
import type { GuardianshipRelation, GuardianshipScope } from '../personal/household/Guardianship';
import { isInForce } from '../personal/household/Guardianship';

/**
 * Deterministic boundary enforcement (CIV-B31 — the social-web promise): a declared guardianship
 * bound is enforced by a *deterministic* gate, and NO probabilistic/policy/LLM output can widen it.
 *
 * The promise: a guardian may act in a duty scope for a ward **only** when a declared relation says
 * so — named guardian + ward, the scope held, the household covered, the relation live. The verdict
 * derives ONLY from the declared relations; it is a pure function of the boundary, not of any
 * model's suggestion. A caller CANNOT pass a "policy override" or a confidence score to relax it —
 * the enforcer takes no such input, so an agent, an inference, or a convenience flag can never turn
 * a `denied` into an `allowed`. That is the boundary the guardian/ward relationship rests on.
 *
 * `decide` is the decision gate; `privy` is the read-only-information gate (a specialist sees the
 * report they advise on without holding the decision). Both are deterministic and fail closed.
 */

export type BoundaryVerdict = 'allowed' | 'denied';

export interface BoundaryDecision {
  readonly verdict: BoundaryVerdict;
  /** The relations that granted the scope (for audit — the declared basis, not a guess). */
  readonly grounding: readonly GuardianshipRelation[];
  /** Why denied, when denied — for the audit trail and the ward's challenge. */
  readonly reason?: string;
}

/**
 * Decide whether `guardianId` may act in `scope` for `wardId` in `household` — pure over the
 * declared relations. A relation grounds the act iff it names the guardian+ward, holds the scope,
 * covers the household, and is live (within its validity window, not revoked). Denied by default —
 * an undeclared boundary is never inferred.
 */
export function enforceBoundary(
  relations: readonly GuardianshipRelation[],
  wardId: string,
  guardianId: string,
  scope: GuardianshipScope,
  household: string,
  at = new Date().toISOString(),
): BoundaryDecision {
  if (wardId.trim().length === 0 || guardianId.trim().length === 0 || household.trim().length === 0) {
    throw new BadRequestHttpError('A boundary decision needs a ward, a guardian and a household.');
  }
  const grounding = relations.filter(relation =>
    relation.wardId === wardId &&
    relation.guardianId === guardianId &&
    relation.scopes.includes(scope) &&
    (relation.households.length === 0 || relation.households.includes(household)) &&
    isInForce(relation, at));
  if (grounding.length === 0) {
    return { verdict: 'denied', grounding: [], reason: 'No live declared relation grants this scope.' };
  }
  return { verdict: 'allowed', grounding };
}

/**
 * Decide whether `guardianId` may see information in `scope` for `wardId` — the *privy-to-info*
 * gate. A guardian sees a scope they hold a decision in, OR one declared in `informationAccess`
 * (a specialist advisor sees the report they inform without deciding it). Still deterministic —
 * still fail closed on no declared access.
 */
export function privyBoundary(
  relations: readonly GuardianshipRelation[],
  wardId: string,
  guardianId: string,
  scope: GuardianshipScope,
  household: string,
  at = new Date().toISOString(),
): BoundaryDecision {
  const deciding = enforceBoundary(relations, wardId, guardianId, scope, household, at);
  if (deciding.verdict === 'allowed') {
    return deciding;
  }
  // Information-access: privy, not deciding — a declared `informationAccess` entry grants the view.
  const grounding = relations.filter(relation =>
    relation.wardId === wardId &&
    relation.guardianId === guardianId &&
    relation.informationAccess?.includes(scope) === true &&
    (relation.households.length === 0 || relation.households.includes(household)) &&
    isInForce(relation, at));
  if (grounding.length === 0) {
    return { verdict: 'denied', grounding: [], reason: 'No live declared information access for this scope.' };
  }
  return { verdict: 'allowed', grounding };
}
