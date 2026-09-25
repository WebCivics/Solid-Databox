import { AccessMode } from '../../authorization/permissions/Permissions';
import { ASSURANCE_DIMENSIONS } from '../profile/InstitutionProfile';
import type {
  DataboxAuthorizationDecision,
  DataboxConjunct,
  DataboxDenialCode,
  StepUpChallenge,
} from './AuthorizationReasonCodes';
import { DATABOX_DENIAL_CODES } from './AuthorizationReasonCodes';
import type { DataboxAuthorizationInput } from './DataboxAuthorizationInput';

/**
 * The pure, deterministic core of the composed Databox authorizer (component C4, DBX-14).
 *
 * It evaluates the authorization CONJUNCTION as a fixed-order sequence of conjuncts and returns the
 * first denial, or an allow if every conjunct passes:
 *
 *   `tenant ∧ token-audience ∧ relationship ∧ credential ∧ assurance ∧ delegation ∧ ODRL ∧ immutability`
 *
 * Two structural guarantees make this the authorization chokepoint (ADR-0003, ADR-0013):
 *  1. **Narrow-never-broaden.** The engine only ever produces `deniedModes` — modes to force to `false`.
 *     It NEVER emits an allow for a mode; the caller ({@link ./ComposedDataboxPermissionReader}) starts
 *     from the WAC result and can only subtract. A broad WAC/ACP grant therefore cannot bypass any
 *     conjunct here (assurance, tenant, immutability, ODRL prohibition).
 *  2. **Fail closed on ANY missing policy input** (ADR-0003 §Failure). An absent tenant, context,
 *     relationship, immutability classification, ODRL decision, or an unbacked delegation claim denies
 *     every requested mode with {@link DATABOX_DENIAL_CODES.missingInput}.
 *
 * Deterministic precedence: the whole-request gates (stages 1–7) short-circuit to a total deny of every
 * requested mode; the append-only gate (stage 8) is evaluated last and denies only the mutating subset
 * (`write`/`delete`), so a legitimate reader of an accepted resource can still read it while NO actor —
 * including the owner/admin — may replace or delete it (ADR-0018 §4).
 */

/** The access modes append-only forbids on an accepted resource (ADR-0018): replace (write) and delete. */
const MUTATING_MODES: ReadonlySet<AccessMode> = new Set([ AccessMode.write, AccessMode.delete ]);

/**
 * A {@link DataboxAuthorizationInput} whose conjunct wrappers have all been shape-validated by
 * {@link isWellFormedInput}, so every gated field is present and of the expected type.
 */
type WellFormedInput = DataboxAuthorizationInput &
  Required<Pick<DataboxAuthorizationInput, 'tenant' | 'context' | 'relationship' | 'immutable' | 'odrl'>>;

/** Build a denial decision for a set of modes. */
function deny(
  conjunct: DataboxConjunct,
  code: DataboxDenialCode,
  reason: string,
  deniedModes: readonly AccessMode[],
  stepUp?: StepUpChallenge,
): DataboxAuthorizationDecision {
  return { allowed: false, conjunct, code, reason, deniedModes, stepUp };
}

/** Build the allow decision (the Databox layer subtracts nothing). */
function allow(): DataboxAuthorizationDecision {
  return { allowed: true, reason: 'databox conjunction satisfied', deniedModes: []};
}

/**
 * Validate that every conjunct wrapper is present AND well-shaped (round-2 hardening H1/M1/L1). A mere
 * presence check trusts the CONTENTS of a half-populated object: `{}` for `immutable` leaves
 * `mutatesAcceptedResource` undefined (falsy) so append-only is silently skipped, and `{}` for
 * `relationship` leaves `credentialRevoked` undefined so a revoked credential is silently allowed — both
 * fail OPEN, violating ADR-0003 "fail closed on any missing policy input". This checks the security-
 * critical field of each wrapper is the expected primitive, so any malformed conjunct fails closed
 * uniformly at Stage 1. (`audience` is deliberately NOT required here — an absent audience is a distinct,
 * meaningful token-audience denial at Stage 3, not a generic malformed-input.)
 */
function isWellFormedInput(input: DataboxAuthorizationInput): input is WellFormedInput {
  return typeof input.tenant?.boxRoot === 'string' &&
    Boolean(input.context) &&
    typeof input.relationship?.active === 'boolean' &&
    typeof input.relationship.credentialRevoked === 'boolean' &&
    typeof input.immutable?.mutatesAcceptedResource === 'boolean' &&
    typeof input.odrl?.outcome === 'string' &&
    Array.isArray(input.requiredAssurance);
}

/**
 * Evaluate the composed Databox authorization conjunction for a single resolved input. Pure and total:
 * it always returns a decision and never throws. See the module doc for the precedence contract.
 */
export function evaluateDataboxAuthorization(input: DataboxAuthorizationInput): DataboxAuthorizationDecision {
  const requested = [ ...input.requestedModes ];

  // Stage 1 — fail closed on any missing OR MALFORMED policy input (ADR-0003 §Failure; no default-permit
  // path). Shape-validating (not merely presence-checking) each conjunct wrapper closes the round-2
  // fail-open-on-malformed-contents weakness: a `{}` odrl/immutable/relationship object can no longer slip
  // through and be trusted downstream (H1/M1/L1).
  if (!isWellFormedInput(input)) {
    return deny(
      'tenant',
      DATABOX_DENIAL_CODES.missingInput,
      'a required authorization input was missing or malformed',
      requested,
    );
  }
  const { tenant, context, relationship, immutable, odrl } = input;

  // Stage 2 — tenant binding: the target MUST live under the resolved tenant's box root. This binds the
  // flat WAC map to the tenant so a WAC grant on another program's resource cannot leak (DBX-11 §7).
  if (!input.resourcePath.startsWith(tenant.boxRoot)) {
    return deny(
      'tenant',
      DATABOX_DENIAL_CODES.tenantMismatch,
      'target resource is outside the resolved tenant box',
      requested,
    );
  }

  // Stage 3 — request-to-tenant binding (DBX-11 hard conjunct). Two binding modes, both re-asserted
  // here because the resolver's inputs are attacker-controllable:
  //  - PAIRWISE: the holder bound by `webId === pairwiseWebId` (the vault-controlled per-relationship
  //    credential, ADR-0004) — the WebID match IS the binding; there is no program audience to check.
  //  - PROGRAM: a system principal bound by `audience === tenant.audience` (DBX-11); a program-bound
  //    token's audience must match the tenant's configured audience.
  if (tenant.pairwiseWebId !== undefined) {
    if (context.webId === undefined || context.webId !== tenant.pairwiseWebId) {
      return deny(
        'token-audience',
        DATABOX_DENIAL_CODES.tokenAudienceMismatch,
        'the acting WebID is not the relationship pairwise WebID',
        requested,
      );
    }
  } else if (
    context.audience === undefined ||
    tenant.audience === undefined ||
    context.audience !== tenant.audience
  ) {
    return deny(
      'token-audience',
      DATABOX_DENIAL_CODES.tokenAudienceMismatch,
      'token audience is not bound to the resolved tenant',
      requested,
    );
  }

  // Stage 4 — active relationship (DBX-13 per-request status).
  if (!relationship.active) {
    return deny(
      'relationship',
      DATABOX_DENIAL_CODES.relationshipInactive,
      'the connection relationship is not active',
      requested,
    );
  }

  // Stage 5 — credential not revoked (DBX-13 per-request status; ADR-0009 prompt revocation).
  if (relationship.credentialRevoked) {
    return deny(
      'credential',
      DATABOX_DENIAL_CODES.credentialRevoked,
      'the connection credential is revoked',
      requested,
    );
  }

  // Stage 6 — assurance >= record/submission-class minimum, per dimension (ADR-0010). Iterated in the
  // fixed ADR-0010 dimension order so the FIRST failing dimension is deterministic; a dimension not
  // derived from a verified claim is level `0` (fail closed) and yields a SAFE step-up challenge.
  for (const dimension of ASSURANCE_DIMENSIONS) {
    const requirement = input.requiredAssurance.find((req): boolean => req.dimension === dimension);
    if (!requirement) {
      continue;
    }
    const currentLevel = context.assurance?.dimensions[dimension] ?? 0;
    if (currentLevel < requirement.minLevel) {
      const stepUp: StepUpChallenge = { dimension, requiredLevel: requirement.minLevel, currentLevel };
      return deny(
        'assurance',
        DATABOX_DENIAL_CODES.assuranceInsufficient,
        `assurance dimension '${dimension}' is below the record-class minimum`,
        requested,
        stepUp,
      );
    }
  }

  // Stage 7 — delegation validity (T-47). A delegation *claim* (DBX-12) demands a validated grant; the
  // claim alone never authorizes. Missing grant fails closed; an invalid grant denies.
  if (context.delegation) {
    if (!input.delegation) {
      return deny(
        'delegation',
        DATABOX_DENIAL_CODES.missingInput,
        'a delegation claim was presented without a validated grant',
        requested,
      );
    }
    if (!input.delegation.valid) {
      return deny(
        'delegation',
        DATABOX_DENIAL_CODES.delegationInvalid,
        'the presented delegation grant is not valid for this operation',
        requested,
      );
    }
  }

  // Stage 8 — ODRL precondition (ADR-0013), evaluated as an ALLOW-LIST (round-2 fix H1). ONLY an explicit
  // `permitted` outcome passes; `prohibited`, `fail-closed`, AND any unrecognised/typo/future/missing
  // outcome deny. An ODRL permission can never add reachability (two-plane separation) and an ambiguous
  // outcome fails closed (T-25) — the previous deny-list silently ALLOWED an unknown outcome.
  if (odrl.outcome !== 'permitted') {
    if (odrl.outcome === 'prohibited') {
      return deny('odrl', DATABOX_DENIAL_CODES.odrlProhibited, 'an ODRL prohibition applies to this action', requested);
    }
    return deny(
      'odrl',
      DATABOX_DENIAL_CODES.odrlUnsupported,
      'the ODRL outcome is unsupported, ambiguous, or unrecognised (fail closed)',
      requested,
    );
  }

  // Stage 9 — append-only / immutable operation (ADR-0018). Evaluated LAST and PARTIAL: it denies only
  // the mutating modes (write/delete) of a replace/delete on an accepted resource — for every actor,
  // including the owner/admin — while leaving read/append/create to the gates above.
  if (immutable.mutatesAcceptedResource) {
    const deniedModes = requested.filter((mode): boolean => MUTATING_MODES.has(mode));
    if (deniedModes.length > 0) {
      return deny(
        'immutability',
        DATABOX_DENIAL_CODES.immutableOperation,
        'the target is an accepted resource and cannot be replaced or deleted',
        deniedModes,
      );
    }
  }

  return allow();
}
