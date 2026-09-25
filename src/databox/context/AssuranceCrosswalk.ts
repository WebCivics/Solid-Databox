import { BadRequestHttpError } from '../../util/errors/BadRequestHttpError';
import { InternalServerError } from '../../util/errors/InternalServerError';
import type { AssuranceDimension } from '../profile/InstitutionProfile';
import { ASSURANCE_DIMENSIONS } from '../profile/InstitutionProfile';
import type { AssuranceDimensionLevels } from './DataboxRequestContext';

/**
 * The opaque grade label used whenever no assurance dimension could be derived from a verified claim.
 * This is the fail-closed default (ADR-0010: an underived dimension is its lowest value); a request that
 * needs more than the lowest grade is denied by the authorizer (C4), never by silently upgrading here.
 */
export const LOWEST_ASSURANCE_GRADE = 'databox-assurance:lowest';

/**
 * The set of cryptographically **verified** claims the Databox is willing to build assurance from.
 *
 * This is deliberately NOT a raw request header and NOT an unverified JWT decode (ADR-0010, T-12): it is
 * the output of a component that already validated the signature, audience, holder-binding and time —
 * CSS's `@solid/access-token-verifier` path (webId/client/issuer) enriched by the broker (C9) with the
 * audience, authentication time and the additional signed claims (acr/amr/loa, `act`, on-behalf-of) that
 * CSS drops (DBX-01 §2). Only claims that appear here are ever mapped; anything else is structurally
 * invisible to assurance derivation.
 */
export interface VerifiedClaimSet {
  /**
   * The verified issuer (`iss`). Required: assurance is always derived *relative to* the issuer that
   * signed it, and the crosswalk gates on the issuer being program-approved (ADR-0005).
   */
  readonly issuer: string;
  /** The verified WebID, when the token carried one. */
  readonly webId?: string;
  /** The verified client identifier, when present. */
  readonly clientId?: string;
  /** The verified audience the token was bound to. */
  readonly audience?: string;
  /** The verified authentication instant (ISO-8601), when asserted. */
  readonly authTime?: string;
  /**
   * Additional verified claims (e.g. `acr`, `amr`, `loa`) keyed by claim name. A value may be a single
   * string or a set of strings (e.g. `amr`). Only these are consulted by the crosswalk.
   */
  readonly claims?: Readonly<Record<string, string | readonly string[]>>;
  /**
   * The verified acting party (RFC 8693 `act.sub`), when the token models an actor distinct from the
   * subject. Provisional seam — the wire binding is Blocked (ADR-0005).
   */
  readonly actor?: string;
  /** The verified represented entity (on-behalf-of subject), when asserted. */
  readonly onBehalfOf?: string;
  /** The verified reference to the delegation/guardianship grant authorising the on-behalf-of. */
  readonly delegationGrantRef?: string;
}

/**
 * A single crosswalk row: a *verified* claim from an *approved* issuer maps into exactly one normalized
 * assurance dimension at a derived level (ADR-0010). `value` optionally pins an exact claim value; when
 * omitted, the mere verified presence of the claim yields the level.
 */
export interface AssuranceCrosswalkEntry {
  /** The approved issuer (`iss`) this row derives from. */
  readonly issuer: string;
  /** The verified claim name. */
  readonly claim: string;
  /** Optional exact value the claim must equal; absent means presence-based. */
  readonly value?: string;
  /** The normalized dimension this row contributes to (must be one of the six ADR-0010 dimensions). */
  readonly dimension: AssuranceDimension;
  /** The derived level on that dimension's scale; a non-negative integer. */
  readonly level: number;
}

/**
 * The raw, signed, versioned per-program crosswalk document (ADR-0010). The crosswalk is a
 * security-critical config artefact: it is the claim→assurance escalation surface, so it carries an
 * explicit version and signature and is admitted only through {@link SignedAssuranceCrosswalk}.
 */
export interface AssuranceCrosswalkDocument {
  /** Stable identifier of this crosswalk (per program). */
  readonly crosswalkId: string;
  /** The crosswalk version. An unexpected version is refused (fail closed, ADR-0010 failure). */
  readonly version: string;
  /**
   * Provisional signature/attestation reference over the crosswalk. Actual signature verification is a
   * residual human/KMS review gate (DBX-12); admission here requires the reference to be present and
   * treats its absence as "not attested → not admitted".
   */
  readonly signature: string;
  /** The program-approved issuers (`iss` values). An issuer not listed here is not trusted (ADR-0005). */
  readonly approvedIssuers: string[];
  /** The mapping rows. */
  readonly entries: AssuranceCrosswalkEntry[];
}

function lowestLevels(): Record<AssuranceDimension, number> {
  const levels = {} as Record<AssuranceDimension, number>;
  for (const dimension of ASSURANCE_DIMENSIONS) {
    levels[dimension] = 0;
  }
  return levels;
}

/**
 * Assert `value` is a non-empty string, or refuse admission (review finding 6). A crosswalk is untyped
 * JSON at runtime, so absent/wrong-typed security-critical fields must raise the intended
 * {@link InternalServerError}, never a raw `TypeError` from `.length`/`for..of`.
 */
function requireString(value: unknown, message: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new InternalServerError(message);
  }
  return value;
}

/**
 * Assert `value` is an array, or refuse admission (review finding 6). Returns it as `readonly unknown[]`
 * so each element is validated explicitly rather than trusted from the declared type.
 */
function requireArray(value: unknown, message: string): readonly unknown[] {
  if (!Array.isArray(value)) {
    throw new InternalServerError(message);
  }
  return value as readonly unknown[];
}

/**
 * An admitted, per-program signed assurance crosswalk (ADR-0010).
 *
 * Construction is the fail-closed admission gate: an unexpected version, a missing signature reference,
 * an unknown dimension or a negative/non-integer level all refuse admission (the crosswalk is never
 * evaluated in a partly-understood state). Once admitted, {@link derive} maps a verified claim set into
 * normalized dimension levels; unmapped claims contribute nothing (they stay at the lowest value), so a
 * novel/forged-but-unmapped claim can never raise a grade.
 */
export class SignedAssuranceCrosswalk {
  public readonly crosswalkId: string;
  public readonly version: string;
  private readonly approvedIssuers: ReadonlySet<string>;
  private readonly entries: readonly AssuranceCrosswalkEntry[];

  /**
   * @param documentJson - The signed crosswalk document as a JSON string. A `string` param keeps the
   *   constructor Components.js-loadable (a deployment binds it to a variable holding the signed
   *   per-program document, CIV-C26); it is parsed then validated identically to a passed object.
   * @param expectedVersion - The version this deployment expects; a mismatch refuses admission.
   */
  public constructor(documentJson: string, expectedVersion: string) {
    // Fail-closed admission, robust against untyped JSON (finding 6): the document is validated as a raw
    // record so absent/wrong-typed fields raise InternalServerError, never a raw TypeError.
    let parsed: unknown;
    try {
      parsed = JSON.parse(documentJson);
    } catch {
      throw new InternalServerError('Assurance crosswalk document is not valid JSON.');
    }
    const raw = parsed as Record<string, unknown>;
    const crosswalkId = requireString(raw.crosswalkId, 'Assurance crosswalk is missing a crosswalkId.');
    const version = requireString(raw.version, 'Assurance crosswalk is missing a version.');
    if (version !== expectedVersion) {
      throw new InternalServerError(
        `Refusing to admit assurance crosswalk: expected version ${expectedVersion}, got ${version}.`,
      );
    }
    // PROVISIONAL SEAM (review finding 1): only the PRESENCE of a signature reference is enforced here —
    // the crosswalk is NOT yet cryptographically verified. A detached-signature verification against a
    // pinned per-program key is a residual human security-review gate that MUST clear before production.
    requireString(raw.signature, 'Refusing to admit an unsigned assurance crosswalk (finding 1: presence only).');
    const approvedIssuers = requireArray(raw.approvedIssuers, 'Assurance crosswalk approvedIssuers must be an array.');
    const rawEntries = requireArray(raw.entries, 'Assurance crosswalk entries must be an array.');
    const valid = new Set<string>(ASSURANCE_DIMENSIONS);
    const entries: AssuranceCrosswalkEntry[] = [];
    for (const item of rawEntries) {
      const entry = item as Record<string, unknown>;
      const issuer = requireString(entry.issuer, 'Assurance crosswalk entry is missing an issuer.');
      const claim = requireString(entry.claim, 'Assurance crosswalk entry is missing a claim.');
      const value = entry.value === undefined ?
        undefined :
          requireString(entry.value, 'Assurance crosswalk entry value must be a non-empty string when present.');
      if (!valid.has(entry.dimension as string)) {
        throw new InternalServerError(`Assurance crosswalk names an unknown dimension: ${String(entry.dimension)}.`);
      }
      if (!Number.isInteger(entry.level) || (entry.level as number) < 0) {
        throw new InternalServerError(
          `Assurance crosswalk level must be a non-negative integer: ${String(entry.level)}.`,
        );
      }
      entries.push({
        issuer,
        claim,
        value,
        dimension: entry.dimension as AssuranceDimension,
        level: entry.level as number,
      });
    }
    this.crosswalkId = crosswalkId;
    this.version = version;
    this.approvedIssuers = new Set<string>(approvedIssuers.map(
      (issuer): string => requireString(issuer, 'Assurance crosswalk approvedIssuers must all be non-empty strings.'),
    ));
    this.entries = entries;
  }

  /**
   * Whether `issuer` is program-approved. An unapproved issuer is rejected before any claim is mapped
   * (ADR-0005: CSS accepts any cryptographically valid issuer, so the Databox MUST gate — T-13).
   */
  public isApprovedIssuer(issuer: string): boolean {
    return this.approvedIssuers.has(issuer);
  }

  /**
   * Assert `issuer` is approved, or reject (fail closed).
   */
  public assertApprovedIssuer(issuer: string): void {
    if (!this.isApprovedIssuer(issuer)) {
      throw new BadRequestHttpError(`Issuer is not approved for this program: ${issuer}.`);
    }
  }

  /**
   * Map the verified claims of `issuer` into normalized dimension levels plus the audit trail of which
   * claims fired (accepted-claim traceability). Every dimension is present; unmapped dimensions stay at
   * their lowest value (fail closed).
   */
  public derive(
    issuer: string,
    claims: Readonly<Record<string, string | readonly string[]>> = {},
  ): { dimensions: AssuranceDimensionLevels; methodRefs: readonly string[] } {
    const levels = lowestLevels();
    const refs = new Set<string>();
    for (const entry of this.entries) {
      if (entry.issuer !== issuer) {
        continue;
      }
      const raw = claims[entry.claim];
      if (raw === undefined) {
        continue;
      }
      // Ignore empty-string values so a claim present as '' cannot satisfy a presence dimension
      // (review finding 5).
      const list = typeof raw === 'string' ? [ raw ] : raw;
      const values = list.filter((value): boolean => value.length > 0);
      const matched = entry.value === undefined ? values.length > 0 : values.includes(entry.value);
      if (!matched) {
        continue;
      }
      if (entry.level > levels[entry.dimension]) {
        levels[entry.dimension] = entry.level;
      }
      refs.add(entry.value === undefined ? entry.claim : `${entry.claim}=${entry.value}`);
    }
    return { dimensions: levels, methodRefs: [ ...refs ].sort() };
  }
}
