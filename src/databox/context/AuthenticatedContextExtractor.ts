import type { Credentials } from '../../authentication/Credentials';
import { getLoggerFor } from '../../logging/LogUtil';
import { BadRequestHttpError } from '../../util/errors/BadRequestHttpError';
import { NotImplementedHttpError } from '../../util/errors/NotImplementedHttpError';
import { AsyncHandler } from '../../util/handlers/AsyncHandler';
import type { SignedAssuranceCrosswalk, VerifiedClaimSet } from './AssuranceCrosswalk';
import { LOWEST_ASSURANCE_GRADE } from './AssuranceCrosswalk';
import type {
  AssuranceContext,
  AssuranceDimensionLevels,
  DataboxRequestContext,
  DelegationContext,
} from './DataboxRequestContext';

/**
 * Input to an {@link AuthenticatedContextExtractor}: the already cryptographically-verified CSS
 * {@link Credentials} (webId/client/issuer, produced by the `@solid/access-token-verifier` path — CSS
 * does the DPoP/sender-constraint proof, we never re-implement it) plus, on the broker (C9) path, the
 * enriched {@link VerifiedClaimSet} carrying the audience, authentication time and signed assurance /
 * actor / on-behalf-of claims that CSS drops (DBX-01 §2). `verifiedClaims` is optional: its absence is
 * the plain Solid-OIDC path and yields the fail-closed lowest assurance, never a fabricated one.
 */
export interface AuthenticatedContextInput {
  readonly credentials: Credentials;
  readonly verifiedClaims?: VerifiedClaimSet;
}

/**
 * Recursively freezes the assembled context so no downstream layer (authorizer C4, operation, audit)
 * can mutate a verified claim — the immutability the architecture requires of the C3 context. Only
 * non-null objects are frozen; every falsy value (including `null` and `undefined`) and every
 * primitive short-circuits, so `Object.values` is never called on `null` (review finding 4).
 */
function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>)) {
      deepFreeze(nested);
    }
  }
  return value;
}

/**
 * Whether any dimension was raised above its lowest (fail-closed) value.
 */
function hasAnyLevel(dimensions: AssuranceDimensionLevels): boolean {
  return Object.values(dimensions).some((level): boolean => level > 0);
}

/**
 * Builds the immutable {@link DataboxRequestContext} (component C3, DBX-04 §2) from a verified
 * request. This is the seam that captures the assurance/audience/delegation claims CSS never
 * extracts (DBX-01 §2, seam `CredentialsExtractor`). Concrete construction is DBX-12.
 */
export abstract class AuthenticatedContextExtractor
  extends AsyncHandler<AuthenticatedContextInput, DataboxRequestContext> {}

/**
 * The real {@link AuthenticatedContextExtractor} (DBX-12).
 *
 * It builds the immutable verified context from an already-verified CSS {@link Credentials} plus a
 * per-program signed {@link SignedAssuranceCrosswalk}. It NEVER trusts a request header or an unverified
 * JWT decode for assurance/actor/delegation (ADR-0010, T-12): the only assurance source is the enriched
 * {@link VerifiedClaimSet}, and only claims the crosswalk maps raise a grade. It fails closed —
 *
 * - no enriched claims → lowest assurance, but the conforming Solid-OIDC path is preserved (T-16);
 * - claims from an issuer the program did not approve → rejected (T-13);
 * - an enriched issuer that disagrees with the credential issuer → rejected (confused deputy, T-13/T-15);
 * - claims the crosswalk does not map → ignored, so a forged/novel claim cannot escalate (T-12).
 *
 * HARD PRECONDITION on the enriched path (review findings 2 & 3): a `VerifiedClaimSet` is trusted ONLY
 * when it is bound to CSS-verified credentials. The broker (C9) obligation is that the enriched claims
 * and the CSS access token describe the SAME subject. This extractor enforces that:
 *
 * - a `VerifiedClaimSet` MUST be backed by a CSS-verified `credentials.issuer` and a CSS-verified subject
 *   (WebID or client) — enriched claims are NEVER synthesised into a context on their own (finding 3);
 * - where the enriched claims also carry a `webId`/`clientId`, it MUST equal the CSS-verified one, else
 *   the request is rejected (cross-subject confused deputy, finding 2 / T-14). The context's identity is
 *   always sourced from the CSS-verified credentials, never from the enriched claims.
 *
 * The actor and represented entity are kept DISTINCT (architecture.md, T-14/T-47). The RFC 8693 subject/
 * actor-token wire binding is Blocked (ADR-0005): this extractor carries the delegation *claim* as a
 * provisional seam and never authorizes it — the grant is validated per-op by C4/C9.
 */
export class VerifiedAssuranceContextExtractor extends AuthenticatedContextExtractor {
  protected readonly logger = getLoggerFor(this);
  private readonly crosswalk: SignedAssuranceCrosswalk;

  /**
   * @param crosswalk - The admitted per-program signed assurance crosswalk (ADR-0010).
   */
  public constructor(crosswalk: SignedAssuranceCrosswalk) {
    super();
    this.crosswalk = crosswalk;
  }

  public async handle(input: AuthenticatedContextInput): Promise<DataboxRequestContext> {
    const { credentials, verifiedClaims } = input;
    const webId = credentials.agent?.webId;
    const clientId = credentials.client?.clientId;
    const issuer = credentials.issuer?.url;

    // Plain Solid-OIDC path: no enriched verified claims. Preserve it (independent clients must work,
    // T-16) with the verified identity and the fail-closed lowest assurance (absent → lowest).
    if (!verifiedClaims) {
      return deepFreeze<DataboxRequestContext>({ webId, clientId, issuer, actor: webId });
    }

    // Enriched (broker C9) path. The enriched claims are trusted ONLY when bound to CSS-verified
    // credentials: a CSS-verified issuer AND a CSS-verified subject (WebID or client) MUST back them,
    // else the context would be synthesised from unbacked claims (finding 3).
    if (issuer === undefined) {
      throw new BadRequestHttpError('Enriched verified claims require a CSS-verified credential issuer.');
    }
    if (webId === undefined && clientId === undefined) {
      throw new BadRequestHttpError('Enriched verified claims require a CSS-verified subject (WebID or client).');
    }
    // Validate the external issuer/claim contract (ADR-0005) and the subject binding (finding 2) before
    // mapping: the enriched issuer/subject MUST agree with the CSS-verified ones.
    if (verifiedClaims.issuer !== issuer) {
      throw new BadRequestHttpError('Verified-claim issuer does not match the credential issuer.');
    }
    this.assertSubjectMatch('WebID', verifiedClaims.webId, webId);
    this.assertSubjectMatch('client', verifiedClaims.clientId, clientId);
    this.crosswalk.assertApprovedIssuer(issuer);

    const { dimensions, methodRefs } = this.crosswalk.derive(issuer, verifiedClaims.claims);
    const assurance: AssuranceContext = {
      grade: hasAnyLevel(dimensions) ?
        `${this.crosswalk.crosswalkId}@${this.crosswalk.version}` :
        LOWEST_ASSURANCE_GRADE,
      dimensions,
      authTime: verifiedClaims.authTime,
      methodRefs: [ ...methodRefs ],
      crosswalkVersion: this.crosswalk.version,
    };

    const representedEntity = verifiedClaims.onBehalfOf;
    let delegation: DelegationContext | undefined;
    if (representedEntity !== undefined && verifiedClaims.delegationGrantRef !== undefined) {
      delegation = { onBehalfOf: representedEntity, grantRef: verifiedClaims.delegationGrantRef };
    }

    // Identity is ALWAYS the CSS-verified value (never the enriched claim); the actor may be a distinct
    // party acting for the subject (RFC 8693 provisional seam).
    this.logger.debug(`Built Databox context via crosswalk ${this.crosswalk.version}; grade ${assurance.grade}.`);
    return deepFreeze<DataboxRequestContext>({
      webId,
      clientId,
      issuer,
      audience: verifiedClaims.audience,
      authTime: verifiedClaims.authTime,
      assurance,
      actor: verifiedClaims.actor ?? webId,
      representedEntity,
      delegation,
    });
  }

  /**
   * Reject when an enriched claim identifier is present, a CSS-verified identifier is present, and they
   * disagree (cross-subject confused deputy, finding 2 / T-14). A claim identifier that is absent, or a
   * CSS-verified identifier that is absent, is not a binding conflict.
   */
  private assertSubjectMatch(label: string, claimed: string | undefined, verified: string | undefined): void {
    if (claimed !== undefined && verified !== undefined && claimed !== verified) {
      throw new BadRequestHttpError(`Verified-claim ${label} does not match the credential ${label}.`);
    }
  }
}

/**
 * Fail-closed placeholder for {@link AuthenticatedContextExtractor}.
 *
 * Retained from the DBX-09 scaffold as the default wiring until a program crosswalk is configured. It
 * refuses to fabricate a context: it throws {@link NotImplementedHttpError} rather than returning an
 * empty/optimistic context that a downstream authorizer might misread as "authenticated". It never
 * asserts any claim, so it can never widen access.
 */
export class NotImplementedContextExtractor extends AuthenticatedContextExtractor {
  public async handle(): Promise<DataboxRequestContext> {
    throw new NotImplementedHttpError('Databox authenticated-context extractor (C3) is not implemented (DBX-12).');
  }
}
