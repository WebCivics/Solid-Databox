import type { AssuranceDimension } from '../profile/InstitutionProfile';

/**
 * Databox authenticated request context (component C3, DBX-04 §2).
 *
 * This is the immutable, request-scoped verified context that the Databox builds from a verified
 * token. It is deliberately richer than the CSS `Credentials` type, which captures only
 * `agent`/`client`/`issuer` and carries no assurance, audience or delegation information
 * (DBX-01 §2 — "the single biggest gap"). None of these fields exist in CSS 7.1.9 today.
 *
 * IMPORTANT: A `DataboxRequestContext` is evidence about *who is asking*, never a grant.
 * Possessing a context MUST NOT be treated as authorization; the composed authorizer (C4) still
 * decides. The context owner (C3) is authoritative for the assurance state and fails closed
 * (DBX-04 §6). Every field is `readonly` and the value is deep-frozen at construction, so no
 * downstream layer (authorizer/operation/audit) can mutate a verified claim.
 */

/**
 * The normalized level of each of the six ADR-0010 assurance dimensions. Assurance is NEVER a single
 * unqualified LoA integer (ADR-0010): each dimension is scored separately so a record class can require
 * (e.g.) a fresh strong authenticator without conflating it with identity proofing, and so a denial can
 * name the exact dimension that failed. `0` is the lowest value on every dimension — the fail-closed
 * default for any dimension not derived from a *verified* signed claim.
 */
// A `Record<>`/`Readonly<Record<>>` here is not loadable by the Components.js generator
// (it resolves field types as class references — TS utility types are not classes). The
// mapped form is equivalent and generator-safe (CIV-C26).
// eslint-disable-next-line @typescript-eslint/consistent-indexed-object-style
export type AssuranceDimensionLevels = {readonly [K in AssuranceDimension]: number };

/**
 * The assurance dimension of the verified context (ADR-0010 crosswalk).
 * CSS captures none of this today (no `acr`/`amr`/`loa`, DBX-01 §2).
 */
export interface AssuranceContext {
  /**
   * Opaque assurance grade token, interpreted against the program's ADR-0010 crosswalk.
   * Never compared numerically across programs without an explicit crosswalk. Purely a label —
   * the authoritative comparison is per-dimension against {@link dimensions}.
   */
  readonly grade: string;
  /**
   * The normalized per-dimension levels (ADR-0010). Always contains all six dimensions; any dimension
   * that could not be derived from a verified claim is present at its lowest value (`0`, fail closed).
   */
  readonly dimensions: AssuranceDimensionLevels;
  /**
   * Authentication-instant as an ISO-8601 timestamp, used for step-up freshness checks.
   */
  readonly authTime?: string;
  /**
   * Raw authentication-method / context-class references as asserted by the issuer, retained
   * for audit. Opaque strings; never re-interpreted as a grade.
   */
  readonly methodRefs?: string[];
  /**
   * Identifier + version of the signed, per-program crosswalk (ADR-0010) that produced these levels,
   * retained so an audit event can trace *which* crosswalk mapped which claim (accepted-claim
   * traceability, DBX-12 gate). Absent for the fail-closed (no verified assurance) context.
   */
  readonly crosswalkVersion?: string;
}

/**
 * A delegation / on-behalf-of assertion (represented-entity), e.g. guardianship.
 * CSS has no delegation concept (DBX-01 §2). This carries the *claim* only; whether the grant is
 * currently in scope and unrevoked is decided per-op by the authorizer (C9/C4, matrix
 * "Delegation/guardianship grant", T-47) — C3 never authorizes a delegation.
 */
export interface DelegationContext {
  /**
   * The subject the actor is acting on behalf of (the represented entity).
   */
  readonly onBehalfOf: string;
  /**
   * Opaque reference to the delegation/guardianship grant that authorises this (owned by C9).
   */
  readonly grantRef: string;
}

/**
 * The immutable verified Databox request context (C3).
 * Every field is `readonly`; a context is never mutated after construction.
 */
export interface DataboxRequestContext {
  /**
   * The verified WebID of the acting agent, when present. A WebID is NEVER silently replaced by a DID
   * (ADR-0004): the login credential, relationship credential and access token stay distinct.
   */
  readonly webId?: string;
  /**
   * The verified OAuth/OIDC client identifier, when present.
   */
  readonly clientId?: string;
  /**
   * The verified issuer that asserted the claims.
   */
  readonly issuer?: string;
  /**
   * The audience the presented token was bound to (used to bind the request to a tenant).
   */
  readonly audience?: string;
  /**
   * The verified authentication instant (ISO-8601), when the issuer asserted one. Mirrored into
   * {@link AssuranceContext.authTime} for the freshness dimension; retained top-level for audit.
   */
  readonly authTime?: string;
  /**
   * The verified assurance context (ADR-0010). Absent means "unknown", which fails closed for
   * any grade-gated action.
   */
  readonly assurance?: AssuranceContext;
  /**
   * The verified acting party (RFC 8693 `act`/actor). Distinct from {@link representedEntity}
   * (architecture.md): a guardian/employee/automated service is a different identifier from the human
   * it acts for. Defaults to {@link webId} when the token asserts no separate actor.
   */
  readonly actor?: string;
  /**
   * The verified represented entity — the party on whose behalf {@link actor} is acting, when the
   * token asserts an on-behalf-of relationship. Kept DISTINCT from {@link actor}; the two are never
   * collapsed into one subject (ADR-0004 typed directional bindings).
   */
  readonly representedEntity?: string;
  /**
   * The delegation/represented-entity context, when the actor is acting on behalf of another and a
   * grant reference is present. Provisional RFC 8693 seam (ADR-0005 Blocked): the wire binding of the
   * subject/actor token is NOT resolved here; C3 carries the claim, C4 validates the grant per-op.
   */
  readonly delegation?: DelegationContext;
}
