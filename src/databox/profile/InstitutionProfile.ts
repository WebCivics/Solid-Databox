/**
 * Machine-validated institution / program profile schema (DBX-06).
 *
 * Every organisation-hosted Databox deployment needs a machine-validated profile that supplies the
 * program-specific facts the universal protocol invariants are enforced against (architecture.md
 * "Program profile"; DBX-04 profile inputs to C5/C9/C10/C11). The profile **supplies facts, it never
 * weakens an invariant** — the validator ({@link InstitutionProfileValidator}) rejects any combination
 * that would (unsatisfiable assurance, un-program-bound audience, dangling / forged policy reference,
 * destructive retention, a Blocked feature) and **fails closed on unknown security-critical fields**.
 *
 * This module defines the versioned schema's TypeScript loader types plus the closed value sets the
 * validator enforces. It deliberately references — and never resolves — the Blocked sub-questions of
 * ADR-0005 (RFC 8693 wire semantics), ADR-0015 (legal-compliance release gate) and ADR-0021
 * (provider-blind encryption): the schema can *carry* those declarations, but the validator refuses to
 * *admit* them.
 */

/**
 * Versioned identifier of this schema. Bumped when the loader types change incompatibly. A profile
 * MUST declare a `schemaVersion` equal to this value or the validator rejects it (fail closed on an
 * unknown schema version, ADR-0010 crosswalk-version rule).
 */
export const INSTITUTION_PROFILE_SCHEMA_VERSION = 'dbx-institution-profile/1.0.0';

/**
 * Tenancy deployment models (ADR-0002 §3). A distinct origin is preferred; program subdomains are
 * acceptable; path-only tenancy is *discouraged* (validator emits a warning, never an error) because a
 * single origin cannot program-bind token audiences, cookies, CORS or client registrations.
 */
export const DEPLOYMENT_MODELS = [ 'distinct-origin', 'program-subdomain', 'path-only' ] as const;

/**
 * The six normalized assurance dimensions (ADR-0010). Assurance is never a single unqualified LoA
 * integer; a claim that cannot be mapped into one of these fails closed to that dimension's lowest
 * value. An assurance mapping or a record-class minimum that names any *other* dimension is rejected.
 */
export const ASSURANCE_DIMENSIONS = [
  'identityProofing',
  'authenticatorStrength',
  'federationTrust',
  'authenticationFreshness',
  'stepUpState',
  'delegationEvidence',
] as const;

/**
 * ODRL conflict-resolution strategies (ADR-0013). Determines how overlapping permissions / prohibitions
 * compose. An unknown strategy is rejected (the composition must be deterministic and fail closed).
 */
export const CONFLICT_STRATEGIES = [
  'prohibition-overrides',
  'permission-overrides',
  'first-applicable',
  'explicit-priority',
] as const;

/**
 * Policy effective-time behaviour on update (ADR-0014). `prospective` is the safe default; retroactive
 * re-evaluation is permitted only when explicitly authorized (`retroactiveAuthorized: true`), else the
 * validator rejects it (unauthorized retroactivity must not run).
 */
export const EFFECTIVE_TIME_BEHAVIORS = [ 'prospective', 'authorized-retroactive' ] as const;

/**
 * Attestation status of a compiled-policy bundle (ADR-0015). A `proposed` bundle is a machine output
 * that has NOT been human-attested and MUST NOT be admitted to the runtime; only `attested` admits.
 */
export const ATTESTATION_STATUSES = [ 'proposed', 'attested' ] as const;

/**
 * Retention deletion modes. `tombstone` / `supersede` / `crypto-erase` preserve the append-only,
 * hash-chained evidence model (ADR-0018); `hard-delete` of an accepted record is destructive and is
 * rejected by the validator (fail closed — accepted bytes and receipts are immutable).
 */
export const DELETION_MODES = [ 'tombstone', 'supersede', 'crypto-erase', 'hard-delete' ] as const;

/**
 * Application-level payload encryption modes (ADR-0021 §3). Under the custodian model the recommended
 * default is `not-required`. `required-provider-blind` is a **Blocked** high-assurance variant (ADR-0021
 * §residual): the schema may declare it, but the validator refuses to admit it (fail closed, not
 * resolved here).
 */
export const APP_ENCRYPTION_MODES = [ 'not-required', 'optional', 'required-provider-blind' ] as const;

/**
 * Sender-constraint suites for issued access tokens (ADR-0006). High assurance grades SHOULD be
 * sender-constrained; a `bearer` baseline is permitted for low grades only.
 */
export const SENDER_CONSTRAINTS = [ 'bearer', 'dpop', 'mtls' ] as const;

/**
 * Default record-existence visibility (ADR-0023). `suppressed` hides even the existence of a record
 * (indistinguishable 404); `visible` exposes existence while payload access may still require step-up.
 */
export const EXISTENCE_VISIBILITIES = [ 'visible', 'suppressed' ] as const;

// Literal-union types (not `typeof CONST[number]`) — a `typeof`-const type reference is not
// loadable by the Components.js generator; the consts above remain for iteration/validation.
export type DeploymentModel = 'distinct-origin' | 'program-subdomain' | 'path-only';
export type AssuranceDimension =
  'identityProofing' | 'authenticatorStrength' | 'federationTrust' |
  'authenticationFreshness' | 'stepUpState' | 'delegationEvidence';
export type ConflictStrategy =
  'prohibition-overrides' | 'permission-overrides' | 'first-applicable' | 'explicit-priority';
export type EffectiveTimeBehavior = 'prospective' | 'authorized-retroactive';
export type AttestationStatus = 'proposed' | 'attested';
export type DeletionMode = 'tombstone' | 'supersede' | 'crypto-erase' | 'hard-delete';
export type AppEncryptionMode = 'not-required' | 'optional' | 'required-provider-blind';
export type SenderConstraint = 'bearer' | 'dpop' | 'mtls';
export type ExistenceVisibility = 'visible' | 'suppressed';

/**
 * An accountable legal person (program principal, accountable party, processor or subcontractor).
 */
export interface AccountableParty {
  /** Stable opaque identifier of the party within the profile. */
  readonly id: string;
  /** Human-facing legal name of the party. */
  readonly legalName: string;
  /** Jurisdiction the party is accountable in (e.g. an ISO 3166 code or a named regulator scope). */
  readonly jurisdiction: string;
  /** Optional contact URI (mailto:/https:) for accountability correspondence. */
  readonly contact?: string;
}

/**
 * A processor / subcontractor in the program's processing chain (ADR-0021 disclosure; ADR-0016).
 * Whether the processor can read authored payloads is disclosed here (custodian-model transparency).
 */
export interface Processor {
  readonly id: string;
  readonly legalName: string;
  readonly jurisdiction: string;
  /** The purpose ids (see {@link DeclaredPurpose}) this processor is engaged for. */
  readonly purposes: string[];
  /** True where this processor can read authored payloads (must be disclosed, ADR-0021). */
  readonly readsPayload: boolean;
}

/**
 * A trusted external identity provider / issuer and its per-program claim contract (ADR-0005).
 * IdP trust is a per-program profile choice, never a universal allowlist; providers such as
 * myID/Entra are examples, not built-in trust.
 */
export interface TrustedIssuer {
  /** Opaque local id used to reference this issuer from assurance mappings and record classes. */
  readonly id: string;
  /** The `iss` value that MUST match exactly; an https origin. */
  readonly issuer: string;
  /** Authentication protocol (e.g. `solid-oidc`, `oidc`, `lws-controlled-identifier`). */
  readonly protocol: string;
  /** Accreditation reference (framework + level) backing this issuer's assurance claims. */
  readonly accreditation?: string;
  /** The exact set of claim names the broker validates from this issuer (the claim contract). */
  readonly claimContract: string[];
}

/**
 * A single crosswalk entry mapping a *verified* issuer claim into one normalized assurance dimension
 * at a derived level (ADR-0010). Unknown dimensions and unknown issuers are rejected (fail closed).
 */
export interface AssuranceMapping {
  /** The {@link TrustedIssuer.id} this mapping derives from. */
  readonly issuer: string;
  /** The assurance dimension this mapping contributes to (must be an {@link AssuranceDimension}). */
  readonly dimension: AssuranceDimension;
  /** The verified claim name whose presence/value yields the level. */
  readonly claim: string;
  /** The derived level on this dimension's scale (a non-negative integer). */
  readonly level: number;
}

/**
 * The minimum assurance a record or submission class requires on a single dimension. The validator
 * rejects a requirement that no {@link AssuranceMapping} can satisfy (unsatisfiable → fail closed).
 */
export interface AssuranceRequirement {
  readonly dimension: AssuranceDimension;
  readonly minLevel: number;
}

/**
 * A deposited institutional record class and the minimum assurance required to access it.
 */
export interface RecordClass {
  readonly id: string;
  /** Human-facing label. */
  readonly label: string;
  /** Minimum assurance per dimension needed for payload access. */
  readonly minimumAssurance: AssuranceRequirement[];
  /** The {@link PolicyTemplate.id} governing this class (must resolve). */
  readonly policyTemplate: string;
  /** The {@link LegalBasis.id} this class is processed under (must resolve). */
  readonly legalBasis: string;
  /** The declared purposes (ids) this class serves (each must resolve). */
  readonly purposes: string[];
  /** Default existence visibility for this class (ADR-0023). */
  readonly existenceVisibility: ExistenceVisibility;
}

/**
 * A permitted consumer submission class (correction, warranty claim, preference, etc.).
 */
export interface SubmissionClass {
  readonly id: string;
  readonly label: string;
  readonly minimumAssurance: AssuranceRequirement[];
  readonly policyTemplate: string;
  /** The declared purposes (ids) this submission is authorized for (each must resolve). */
  readonly purposes: string[];
}

/**
 * A versioned ODRL policy template. Record and submission classes resolve to one of these; the id is
 * referenced from receipts and audit events (architecture.md "Program profile").
 */
export interface PolicyTemplate {
  readonly id: string;
  /** The ODRL policy version (ADR-0014 first-class version). */
  readonly version: string;
  /** The ODRL profile URI this template conforms to. */
  readonly odrlProfile: string;
}

/**
 * Policy configuration: templates, conflict strategy and effective-time behaviour.
 */
export interface PolicyConfig {
  readonly templates: PolicyTemplate[];
  readonly conflictStrategy: ConflictStrategy;
  readonly effectiveTimeBehavior: EffectiveTimeBehavior;
  /** MUST be true when {@link effectiveTimeBehavior} is `authorized-retroactive` (ADR-0014). */
  readonly retroactiveAuthorized?: boolean;
}

/**
 * References into the compiled-policy input interface (ADR-0015). The runtime consumes a signed,
 * human-attested compiled bundle; a `proposed` bundle, a missing digest, or a legal-compliance claim
 * (Blocked release gate) is rejected.
 */
export interface CompiledPolicyRef {
  readonly compiledPolicyDigest: string;
  readonly corpusManifestDigest: string;
  readonly attestationId: string;
  readonly evaluatorVersion: string;
  readonly profileDigest: string;
  readonly attestationStatus: AttestationStatus;
  /**
   * Whether this deployment asserts a *legal-compliance* release claim. This is the Blocked release
   * gate of ADR-0015 / CR-DEP-06 — the validator rejects `true` (compliance may not be claimed until
   * the corpus + human attestation gate clears; not resolved here).
   */
  readonly legalComplianceClaimed?: boolean;
}

/**
 * A legislative-corpus manifest entry (ADR-0015). ELI may appear as a human-facing locator but never
 * replaces the content digest, which is what pins the retrieved artefact.
 */
export interface CorpusManifestEntry {
  readonly sourceUri: string;
  readonly jurisdiction: string;
  readonly expressionVersion: string;
  readonly retrievedAt: string;
  readonly mediaType: string;
  readonly contentDigest: string;
}

/**
 * The legislative-corpus manifest reference (ADR-0015). The manifest digest MUST match the digest
 * bound in {@link CompiledPolicyRef.corpusManifestDigest}.
 */
export interface LegislativeCorpusRef {
  readonly manifestDigest: string;
  readonly entries: CorpusManifestEntry[];
}

/**
 * A declared legal basis for processing.
 */
export interface LegalBasis {
  readonly id: string;
  readonly description: string;
}

/**
 * A declared purpose of processing.
 */
export interface DeclaredPurpose {
  readonly id: string;
  readonly description: string;
}

/**
 * A retention / deletion / tombstone rule bound to a record class (ADR-0018).
 */
export interface RetentionRule {
  /** The {@link RecordClass.id} this rule governs (must resolve). */
  readonly recordClass: string;
  /** Retention duration in whole days; MUST be a positive integer. */
  readonly retentionDays: number;
  /** How the record is disposed of after retention (a destructive `hard-delete` is rejected). */
  readonly deletionMode: DeletionMode;
  /** Whether an append-only tombstone marks expiry. */
  readonly tombstoneOnExpiry: boolean;
}

/**
 * A system of record the program's records originate from / correct into (ADR-0016).
 */
export interface SystemOfRecord {
  readonly id: string;
  readonly label: string;
  /** The record-class ids sourced from this system. */
  readonly recordClasses: string[];
}

/**
 * Notification and receipt format configuration.
 */
export interface NotificationConfig {
  /** Notification hint format (e.g. a Solid Notifications channel type). */
  readonly notificationFormat: string;
  /** Signed acceptance-receipt format (e.g. a VC-JOSE-COSE profile). */
  readonly receiptFormat: string;
}

/**
 * Signing / encryption configuration for the tenant (ADR-0021).
 */
export interface CryptoConfig {
  /** Signing suite for institutional records / receipts (e.g. `ES256`). */
  readonly signingSuite: string;
  /** KMS key reference for the program signing key (custody separated per B10). */
  readonly signingKeyRef: string;
  /** At-rest encryption declaration; if `required`, `perTenantKeys` MUST be true (ADR-0021 §2). */
  readonly atRestEncryption: { readonly required: boolean; readonly perTenantKeys: boolean };
  /** Application-level payload encryption mode; `required-provider-blind` is Blocked (ADR-0021). */
  readonly applicationLevelEncryption: AppEncryptionMode;
}

/**
 * Tenancy + deployment settings (ADR-0002). Token audience MUST be program-bound to the origin.
 */
export interface TenancyConfig {
  readonly deploymentModel: DeploymentModel;
  /** The program origin, an https URL. */
  readonly origin: string;
  /** The token audience; MUST share the origin's host (program-bound), else rejected. */
  readonly tokenAudience: string;
}

/**
 * Token-broker settings, where a broker is adopted (ADR-0005). The RFC 8693 subject/actor-token wire
 * semantics are Blocked (ADR-0005 §residual) and are referenced, not resolved: `tokenExchange` merely
 * records the pinned mechanism.
 */
export interface TokenBrokerConfig {
  readonly adopted: boolean;
  /** Broker origin (https), required when {@link adopted} is true. */
  readonly brokerOrigin?: string;
  /** Token-exchange mechanism (provisional; the wire binding is Blocked in ADR-0005). */
  readonly tokenExchange?: string;
  /** Sender-constraint suite applied to issued tokens. */
  readonly senderConstraint?: SenderConstraint;
}

/**
 * Offline-grant policy (ADR-0009). Governs whether short-lived grants may be used offline and for how
 * long; an offline grant longer than a sensitive record's tolerance is a profile decision recorded here.
 */
export interface OfflineGrantPolicy {
  readonly allowOffline: boolean;
  /** Maximum offline grant lifetime in whole minutes; MUST be a positive integer when offline allowed. */
  readonly maxOfflineMinutes?: number;
}

/**
 * Appeal / redress routes (ADR-0023). Appeal (contesting a substantive decision) is DISTINCT from
 * step-up (remedying insufficient assurance); both may be offered without leaking protected facts.
 */
export interface RedressConfig {
  /** Whether step-up re-authentication is offered on assurance-gap denials. */
  readonly stepUpSupported: boolean;
  /** Named appeal routes for substantive-decision contests. */
  readonly appealRoutes: AppealRoute[];
  /** Default record-existence visibility policy (ADR-0023). */
  readonly existenceVisibilityDefault: ExistenceVisibility;
  /** Correction response clock in whole business days (CANDIDATE, ADR-0023); positive when present. */
  readonly correctionResponseDays?: number;
}

/**
 * A single appeal / review route (ADR-0023).
 */
export interface AppealRoute {
  readonly id: string;
  /** The responsible body the appeal is filed with. */
  readonly responsibleBody: string;
  /** How to file (an https or mailto URI). */
  readonly filingMethod: string;
}

/**
 * The complete institution / program profile (DBX-06). This is the loader type the validator produces
 * on success. Every field the architecture "Program profile" list requires is present; the validator
 * enforces the cross-field invariants that a plain structural schema cannot.
 */
export interface InstitutionProfile {
  readonly schemaVersion: string;
  readonly profileId: string;
  readonly profileVersion: string;
  /** ADR-0014 effective interval for this profile version. */
  readonly effectiveInterval: { readonly effectiveFrom: string; readonly effectiveUntil?: string };
  /** ADR-0015: synthetic fixtures MUST be machine-labelled so no build asserts a compliance claim. */
  readonly synthetic: boolean;
  readonly program: { readonly principal: AccountableParty; readonly accountableParty: AccountableParty };
  readonly processors: Processor[];
  readonly tenancy: TenancyConfig;
  readonly crypto: CryptoConfig;
  readonly identityProviders: TrustedIssuer[];
  readonly assuranceMappings: AssuranceMapping[];
  readonly tokenBroker: TokenBrokerConfig;
  readonly offlineGrantPolicy: OfflineGrantPolicy;
  readonly recordClasses: RecordClass[];
  readonly submissionClasses: SubmissionClass[];
  readonly policies: PolicyConfig;
  readonly compiledPolicy: CompiledPolicyRef;
  readonly legislativeCorpus: LegislativeCorpusRef;
  readonly legalBases: LegalBasis[];
  readonly declaredPurposes: DeclaredPurpose[];
  readonly retention: RetentionRule[];
  readonly systemsOfRecord: SystemOfRecord[];
  readonly notifications: NotificationConfig;
  readonly redress: RedressConfig;
}
