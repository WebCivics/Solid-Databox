import type { PublicJwk } from '../credential/ConnectionCredentialTypes';
import type { GatewayRejection } from './GatewayReasonCodes';

/**
 * Value types for the deposit/submission gateway (component C7, DBX-04 §7.1/§7.2; ADR-0016/0017/0022;
 * DBX-15). Pure types — no runtime code — so the intake contract is stated once and cannot drift between
 * the validators, the quarantine handler and the orchestrator.
 *
 * The gateway consumes an *already-authorized* request (C4/DBX-14 admitted it) and validates its
 * **content, shape and policy binding** before the append-only accept + durable C13 commit. It never
 * rewrites the payload: `body` carries the exact bytes as presented (invariant "accepted bytes are not
 * silently transformed"); the gateway validates and digests them, never re-encodes them.
 */

/**
 * The namespaced source-event idempotency tuple (ADR-0016 HD-12 / DBX-04 §7.1). The idempotency key is a
 * function of `organisation/program/source-system/event-type/source-event-id` — **stable across
 * retries**, NOT minted per attempt. A duplicate of this tuple MUST return the original outcome, never a
 * second record (T-24).
 */
export interface NamespacedEventKey {
  readonly organisation: string;
  readonly program: string;
  readonly sourceSystem: string;
  readonly eventType: string;
  readonly sourceEventId: string;
}

/**
 * The institutional signature a deposit presents (ADR-0016 "institutional records are signed"). The
 * gateway verifies the compact ES256 JWS with the trusted issuer key and checks it binds the payload
 * digest — reusing the credential/{@link ../credential/Es256} verify concepts.
 */
export interface InstitutionalSignatureClaim {
  /** The claimed issuer (`iss`) — must be a trusted signer for the program. */
  readonly issuer: string;
  /** The detached compact ES256 JWS over the canonical payload digest. */
  readonly jws: string;
}

/**
 * A trusted institutional signer for a program: the issuer identifier and its ES256 public key. Supplied
 * to the gateway from the program's key registry (control plane); never derived from the request.
 */
export interface TrustedIssuerKey {
  readonly issuer: string;
  readonly publicKey: PublicJwk;
}

/**
 * The class's versioned ODRL policy reference a deposit/submission claims. It MUST resolve to the class's
 * template id + version in the validated profile (ADR-0014; substitution caught here and at C4/T-25).
 */
export interface PolicyRefClaim {
  readonly policyTemplate: string;
  readonly policyVersion: string;
}

/** Fields shared by a deposit and a submission request presented to the gateway. */
export interface GatewayRequestBase {
  /** The container path the request POSTed to (the addressed target). */
  readonly target: string;
  /** The declared media type of the payload (declared, then checked against the class contract). */
  readonly mediaType: string;
  /** The EXACT payload bytes as presented — never transformed by the gateway. */
  readonly body: Buffer;
  /** The declared purpose of processing (must be permitted for the class). */
  readonly purpose: string;
  /** The claimed versioned policy reference (must resolve to the class template). */
  readonly policyRef: PolicyRefClaim;
  /** The opaque relationship the request addresses (must equal the resolved tenant's relationship). */
  readonly addressedRelationshipId: string;
}

/**
 * An institutional deposit (org → consumer, ADR-0016/0017 §Deposits). Validated against a
 * {@link ../profile/InstitutionProfile#RecordClass}: class, legal basis, purpose, policy ref, media
 * type, size, shape, issuer signature and the namespaced idempotency key.
 */
export interface DepositRequest extends GatewayRequestBase {
  readonly operation: 'deposit';
  readonly recordClass: string;
  readonly legalBasis: string;
  readonly signature: InstitutionalSignatureClaim;
  readonly idempotency: NamespacedEventKey;
}

/**
 * A consumer submission (consumer → org, ADR-0017 §Submissions). Validated against a
 * {@link ../profile/InstitutionProfile#SubmissionClass}: relationship, class, purpose, policy ref, media
 * type, size and shape. A submission has no institutional legal basis or issuer signature; its
 * idempotency key is optional (a consumer submission is not a source-outbox event).
 */
export interface SubmissionRequest extends GatewayRequestBase {
  readonly operation: 'submission';
  readonly submissionClass: string;
  readonly idempotency?: NamespacedEventKey;
}

/** Either kind of gateway request. */
export type GatewayRequest = DepositRequest | SubmissionRequest;

/**
 * The successful acceptance facts the gateway emits for a validated request. This is what the §7.0
 * commit protocol (C13) records and what the signed acceptance receipt (IF-06) binds — the gateway does
 * NOT itself commit or sign (that is DBX-16/DBX-17/DBX-18); it produces the validated, digested facts.
 */
export interface GatewayAcceptance {
  /** `records` for a deposit, `submissions` for a consumer submission. */
  readonly container: 'records' | 'submissions';
  /** The declared class id (already validated as declared in the profile). */
  readonly classId: string;
  /** The opaque relationship the accepted resource belongs to. */
  readonly relationshipId: string;
  /** The SHA-256 digest (hex) of the exact payload bytes — the value a receipt binds to. */
  readonly payloadDigest: string;
  /** The resolved policy template + version that governs the class. */
  readonly policyRef: PolicyRefClaim;
  /** The protected idempotency key (a keyed HMAC), when the request carried an event tuple. */
  readonly idempotencyKey?: string;
  /**
   * For a binary-evidence deposit: the identifier of its quarantine record. Present ONLY when the
   * payload is binary evidence that entered quarantine — its bytes are NOT yet servable (ADR-0022).
   */
  readonly quarantineId?: string;
}

/**
 * The deterministic outcome of gateway validation. Exactly one of:
 * - `accepted` — validated; ready for the append-only accept + C13 commit (RDF/JSON payload, servable).
 * - `quarantined` — binary evidence accepted into quarantine; bytes NOT servable until released (T-22).
 * - `duplicate` — the idempotency key was already accepted; the ORIGINAL outcome is returned (T-24).
 * - `rejected` — a validator failed; a non-leaking {@link GatewayRejection} (T-21/T-22/T-23).
 */
export type GatewayOutcome =
  { readonly status: 'accepted'; readonly acceptance: GatewayAcceptance } |
  { readonly status: 'quarantined'; readonly acceptance: GatewayAcceptance } |
  { readonly status: 'duplicate'; readonly acceptance: GatewayAcceptance } |
  { readonly status: 'rejected'; readonly rejection: GatewayRejection };
