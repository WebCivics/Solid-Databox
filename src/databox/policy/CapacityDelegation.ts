import { BadRequestHttpError } from '../../util/errors/BadRequestHttpError';
import type { GuardianshipScope } from '../personal/household/Guardianship';
import type { MemberCapacity } from '../personal/household/HouseholdProfile';

/**
 * Capacity-scaled + duty-slice delegation (CIV-B02, `social-web.html`): a delegation of decision
 * power is bounded TWICE — by the duty SLICE it covers (a guardian delegates only a slice, never
 * blanket authority) AND by the grantee's capacity tier (the slice's effective scope is capped by
 * what the grantee's capacity can hold).
 *
 *  - **Duty slice**: the delegation names the scopes it covers — `['daily-care', 'education']` — a
 *    bounded set, never "everything". A delegated power outside the slice doesn't exist.
 *  - **Capacity scaling**: the effective scope is the slice ∩ the capacity ceiling. A `full`-
 *    capacity adult may be delegated any slice; a `supported` person (CRPD Art. 12 — retains legal
 *    capacity) can be delegated assistance but the delegee never *substitutes*; an `emerging` child
 *    is delegated only the limited slices capacity permits (the ceiling shrinks the delegation);
 *    a `limited`-capacity person's delegation needs a guardian's counter-signature.
 *
 * `effectiveScope(delegation, granteeCapacity)` returns the slice the grantee may actually act in —
 * the delegation is capacity-scaled, so a delegate can't exceed what the grantee's capacity tier
 * holds. Fail closed: a delegation with no scopes, or a grantee capacity the delegation's minimum
 * doesn't meet, yields an empty scope (no power).
 */

export type CapacityTier = MemberCapacity;

export interface DutySliceDelegation {
  /** The grantor (the guardian/member delegating). */
  readonly grantor: string;
  /** The grantee (who the slice is delegated to). */
  readonly grantee: string;
  /** The duty slices this delegation covers — bounded, never blanket. */
  readonly scopes: readonly GuardianshipScope[];
  /** The minimum capacity the grantee must hold to exercise it. */
  readonly requiredCapacity: CapacityTier;
  /** ISO-8601 bounds — an expired delegation carries no power. */
  readonly validFrom?: string;
  readonly validUntil?: string;
}

/**
 * Capacity tiers ordered by the delegation a grantee can hold — `limited` (substituted decisions,
 * holds no delegated power) < `emerging` (a maturing child, holds bounded power with counter-
 * signature) < `supported` (CRPD Art. 12: retains legal capacity, holds assistance-class power) <
 * `full` (holds any slice).
 */
const CAPACITY_ORDER: readonly CapacityTier[] = [ 'limited', 'emerging', 'supported', 'full' ];

/** The slices a `limited`/`supported` capacity can never be delegated — substituted decisions. */
const SUBSTITUTION_SCOPES: ReadonlySet<GuardianshipScope> = new Set([ 'financial', 'legal', 'medical' ]);

/**
 * The scopes a delegation ACTUALLY grants to a grantee of `granteeCapacity` — the slice ∩ capacity
 * ceiling. An `emerging` child granted a delegation covering `daily-care`+`financial` may only act
 * in the slices their capacity tier holds; `limited`/`supported` grantees hold only assistance-class
 * slices (never a substituted financial/legal decision). Returns the effective (bounded) scopes.
 */
export function effectiveScope(
  delegation: DutySliceDelegation,
  granteeCapacity: CapacityTier,
): readonly GuardianshipScope[] {
  // The grantee's capacity must meet the delegation's floor — a lower capacity holds nothing.
  if (CAPACITY_ORDER.indexOf(granteeCapacity) < CAPACITY_ORDER.indexOf(delegation.requiredCapacity)) {
    return [];
  }
  // A `supported`/`limited` grantee can hold assistance-class slices only — substitution-class
  // decisions (financial, legal) are never delegated to a capacity the person can't substitute.
  if (granteeCapacity === 'supported' || granteeCapacity === 'limited') {
    return delegation.scopes.filter(scope => !SUBSTITUTION_SCOPES.has(scope));
  }
  return delegation.scopes;
}

/** Whether a delegation is live (within its validity window). */
export function isDelegationLive(delegation: DutySliceDelegation, at = new Date().toISOString()): boolean {
  if (delegation.validFrom !== undefined && at < delegation.validFrom) {
    return false;
  }
  return delegation.validUntil === undefined || at <= delegation.validUntil;
}

/** Validate a delegation — it must be a bounded slice with a capacity floor and a basis. */
export function validateDelegation(delegation: DutySliceDelegation): void {
  if (delegation.grantor.trim().length === 0 || delegation.grantee.trim().length === 0) {
    throw new BadRequestHttpError('A delegation needs a grantor and a grantee.');
  }
  if (delegation.scopes.length === 0) {
    throw new BadRequestHttpError('A delegation must be a bounded duty slice — ≥1 scope, never blanket.');
  }
  if (!CAPACITY_ORDER.includes(delegation.requiredCapacity)) {
    throw new BadRequestHttpError(`Unknown capacity tier '${delegation.requiredCapacity}'.`);
  }
}
