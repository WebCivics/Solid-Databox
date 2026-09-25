import { BadRequestHttpError } from '../../../util/errors/BadRequestHttpError';
import type { HouseholdMember, MemberCapacity } from './HouseholdProfile';

/**
 * The guardianship model for the personal/household profile (CIV-A11): multi-household
 * wards, guardian kinds with unequal precedence, and a capacity scale anchored in the
 * human-rights instruments the design serves.
 *
 * Capacity scale (deliberately finer than binary):
 *
 *  - `full`      — the person decides; guardianships may still exist as residue but hold
 *                  no active scope.
 *  - `emerging`  — a maturing child: decides with guardian counter-signature on scoped
 *                  matters only (CRC Art. 5 — direction consistent with evolving capacity;
 *                  the scope shrinks as capacity grows, never expands).
 *  - `limited`   — substituted decisions where capacity is absent (a young child, or a
 *                  person whose decision-making is impaired in scope).
 *  - `supported` — CRPD Art. 12: the person RETAINS legal capacity; supporters assist.
 *                  A supporter never substitutes — their role is recorded as advice, and
 *                  the ward's own assent is the operative act.
 *
 * Guardian precedence is numeric — higher outranks; ties are broken explicitly, never
 * silently (conflicts between equal-precedence guardians escalate to the configured
 * resolution path rather than picking a winner arbitrarily).
 */

export type Capacity = MemberCapacity;

/**
 * The kind of guardianship relation. Precedence defaults are a starting point — a court
 * order or agreement can override per-relation; they are NOT meant to encode that one
 * relation kind always wins.
 */
export type GuardianKind =
  /** Mother/father — default precedence 100. */
  | 'parent' |
  // Court/tribunal-appointed guardian — default 90 (below a fit parent by default; an
  //  order can raise it above).
  'appointed' |
  /** Kinship carer (grandparent, sibling, relative) — default 60. */
  'kinship' |
  /** Enduring power-of-attorney / advance-care appointee — default 80. */
  'attorney' |
  // Duty-slice professional (teacher, coach, clinician, social worker) — default 40,
  //  always scope-narrow.
  'professional' |
  // CRPD Art. 12 supporter — precedence is irrelevant to substitution since supporters
  //  never substitute; listed for completeness (default 0).
  'supporter';

const DEFAULT_PRECEDENCE: Record<GuardianKind, number> = {
  parent: 100,
  appointed: 90,
  attorney: 80,
  kinship: 60,
  professional: 40,
  supporter: 0,
};

/**
 * The scopes a guardianship can cover — duty slices, never blanket control:
 * `residence` (where the person lives), `medical`, `financial`, `education`,
 * `online-contact`, `location-sharing`, `data-sharing`, `daily-care`, `legal`.
 */
export type GuardianshipScope =
  | 'residence' |
  'medical' |
  'financial' |
  'education' |
  'online-contact' |
  'location-sharing' |
  'data-sharing' |
  'daily-care' |
  'legal';

/** The legal basis the relation rests on — recorded for auditability and challenge. */
export type GuardianshipBasis = 'statutory' | 'court-order' | 'agreement' | 'delegated';

/**
 * A guardianship relation — scoped, visible, bounded, and spanning households. A guardian
 * acts FOR the ward, never AS the ward: the ward's identity is never subsumed.
 */
export interface GuardianshipRelation {
  readonly wardId: string;
  readonly guardianId: string;
  readonly kind: GuardianKind;
  /**
   * Precedence override — when absent the kind default applies. A court order raising a
   * kinship carer above a parent is expressed here, explicitly.
   */
  readonly precedence?: number;
  /** The duty slices this relation covers — a guardian with no scope holds no power. */
  readonly scopes: readonly GuardianshipScope[];
  /**
   * Fields in which this guardian is a *qualified* voice — a specialist health provider
   * holds `['medical']`. A qualified relation's input carries more weight IN ITS FIELD:
   * the specialist informs the decision more strongly than a lay guardian, while the
   * accountable deciders stay the guardians (responsibility is not delegated to the
   * advisor). Recorded, not implied.
   */
  readonly specialties?: readonly GuardianshipScope[];
  /**
   * Scopes this relation may be *privy to information in* WITHOUT holding a decision —
   * information asymmetry is modelled: a guardian may see the specialist's report without
   * deciding, and a decider sees what advisors do not. Absent → privy only to own scopes.
   */
  readonly informationAccess?: readonly GuardianshipScope[];
  /**
   * The households this relation operates in — a child across two separated households
   * carries both ids; a relation can be confined to one.
   */
  readonly households: readonly string[];
  readonly basis: GuardianshipBasis;
  /** ISO-8601 bounds — an expired relation holds no scope. */
  readonly validFrom?: string;
  readonly validUntil?: string;
}

/** The effective precedence of a relation (override or kind default). */
export function precedenceOf(relation: GuardianshipRelation): number {
  return relation.precedence ?? DEFAULT_PRECEDENCE[relation.kind];
}

/**
 * A qualified relation's *advisory* weight in a scope — used to ORDER consultations and
 * surface the strongest voice, NOT to confer a vote. A qualified specialist outranks a
 * lay guardian as an advisor in their field; deciding authority stays with the guardians.
 */
export function advisoryWeightOf(relation: GuardianshipRelation, scope: GuardianshipScope): number {
  const qualified = relation.specialties?.includes(scope) ?? false;
  return precedenceOf(relation) + (qualified ? 50 : 0);
}

/** The scopes a relation is privy to information in — explicit list, else own scopes. */
export function informationScopesOf(relation: GuardianshipRelation): readonly GuardianshipScope[] {
  return relation.informationAccess ?? relation.scopes;
}

/**
 * Whether a relation is currently in force — bounds-checked, and requires at least one
 * scope, specialty, or information-access slice (a relation covering NOTHING is inert; a
 * pure advisory relation — zero scopes but qualified input — is still live).
 */
export function isInForce(relation: GuardianshipRelation, atIso?: string): boolean {
  const hasReach = relation.scopes.length > 0 ||
    (relation.specialties?.length ?? 0) > 0 ||
    (relation.informationAccess?.length ?? 0) > 0;
  if (!hasReach) {
    return false;
  }
  const at = atIso ?? new Date().toISOString();
  if (relation.validFrom !== undefined && at < relation.validFrom) {
    return false;
  }
  return relation.validUntil === undefined || at <= relation.validUntil;
}

/** The capacity of a member as declared in the household registry. */
export function capacityOf(member: HouseholdMember & { capacity: Capacity }): Capacity {
  return member.capacity;
}

/** Validate a relation — fail closed on malformed input. */
export function validateGuardianship(relation: GuardianshipRelation): void {
  if (relation.wardId.trim().length === 0 || relation.guardianId.trim().length === 0) {
    throw new BadRequestHttpError('A guardianship relation needs a ward and a guardian.');
  }
  if (relation.wardId === relation.guardianId) {
    throw new BadRequestHttpError('A person cannot be their own guardian.');
  }
  if (relation.households.length === 0) {
    throw new BadRequestHttpError('A guardianship relation must name at least one household.');
  }
}
