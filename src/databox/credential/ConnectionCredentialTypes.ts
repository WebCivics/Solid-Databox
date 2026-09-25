/**
 * Pure value types + pinned constants for the Databox Connection Credential (component C7/C9,
 * DBX-04 §; ADR-0007). No runtime logic lives here so the credential shape, the "not-a-bearer-token"
 * forbidden-key list and the media type are stated exactly once and cannot drift between the issuer
 * (C7), the validator, the status service (C16) and the per-program registry (DBX-24 consumer).
 *
 * The core invariant of ADR-0007 is expressed structurally: a {@link DataboxConnectionCredential} binds
 * a holder **public** key ({@link HolderBinding}) but carries **no** access token, refresh token or global
 * customer identifier — possession of the bytes alone never authorises. {@link FORBIDDEN_CREDENTIAL_KEYS}
 * makes that a checkable property (T-18).
 */

/** The pinned W3C Verifiable Credentials Data Model 2.0 context (ADR-0001/0007). */
export const VC_V2_CONTEXT = 'https://www.w3.org/ns/credentials/v2';

/** The pinned Databox JSON-LD context (ADR-0025/S-14: pinned, never a live mutable URL alone). */
export const DBX_CREDENTIAL_CONTEXT = 'https://w3id.org/solid-databox/context/v1';

/** The base VC type. */
export const VERIFIABLE_CREDENTIAL_TYPE = 'VerifiableCredential';

/** The Databox connection-credential type (ADR-0007). */
export const DATABOX_CONNECTION_CREDENTIAL_TYPE = 'DataboxConnectionCredential';

/** The VC-JOSE-COSE media type the credential is secured as (`application/vc+jwt`, ADR-0007). */
export const CONNECTION_CREDENTIAL_MEDIA_TYPE = 'application/vc+jwt';

/** The JOSE `typ` header value for the secured credential (VC-JOSE-COSE). */
export const CONNECTION_CREDENTIAL_JWS_TYP = 'vc+jwt';

/** The pinned JSON-Schema identifier for the connection-credential shape. */
export const CONNECTION_CREDENTIAL_SCHEMA = 'https://w3id.org/solid-databox/schema/connection-v1';

/** The BitstringStatusList entry type (ADR-0007: status MUST use BitstringStatusList). */
export const BITSTRING_STATUS_LIST_ENTRY_TYPE = 'BitstringStatusListEntry';

/** The only JOSE algorithm this profile signs/verifies with (ES256 = ECDSA P-256 + SHA-256, ADR-0007). */
export const CONNECTION_CREDENTIAL_ALG = 'ES256';

/**
 * Keys that MUST NEVER appear anywhere in a connection credential (ADR-0007 §Decision, R-04,
 * consumer-vault-interoperability.md "It must not contain..."). Their presence turns the holder-bound
 * credential back into a bearer secret / global identifier — the exact anti-pattern (T-18). The validator
 * scans recursively for any of these and fails closed. Compared case-insensitively.
 */
export const FORBIDDEN_CREDENTIAL_KEYS: readonly string[] = [
  'access_token',
  'accesstoken',
  'refresh_token',
  'refreshtoken',
  'id_token',
  'idtoken',
  'client_secret',
  'clientsecret',
  'apikey',
  'api_key',
  'bearer',
  'password',
  'customerid',
  'customernumber',
  'loyaltynumber',
  'email',
  'privatekey',
  'private_key',
  'd',
];

/** A public EC (P-256) JSON Web Key — the holder-key binding material. Never carries the private `d`. */
export interface PublicJwk {
  readonly kty: 'EC';
  readonly crv: 'P-256';
  readonly x: string;
  readonly y: string;
  readonly kid?: string;
  readonly alg?: string;
  readonly use?: string;
}

/**
 * The holder-key binding (ADR-0007/0008): the pairwise consumer subject and the **public** key the vault
 * must prove control of at every unattended exchange. `thumbprint` is the RFC 7638 JWK thumbprint of
 * {@link publicKeyJwk} and is what the proof ceremony and token cache key on.
 */
export interface HolderBinding {
  /** The vault-controlled pairwise HTTPS WebID (ADR-0004). */
  readonly id: string;
  /** The bound holder public key. */
  readonly publicKeyJwk: PublicJwk;
  /** RFC 7638 thumbprint of {@link publicKeyJwk}. */
  readonly thumbprint: string;
}

/**
 * The connection binding (ADR-0007 §Decision): program + opaque box + standards-conforming discovery +
 * immutable access-grant reference and digest + compatibility profiles + opaque relationship. No PII.
 */
export interface ConnectionBinding {
  /** The bounded program identifier. */
  readonly program: string;
  /** The opaque Databox/storage identifier (box root, ADR-0002). */
  readonly databox: string;
  /** Standards-conforming storage-description / discovery entry point (Solid/LWS). */
  readonly storageDescription: string;
  /** The authorization-discovery entry point, when distinct from the storage description. */
  readonly authorizationDiscovery?: string;
  /** The immutable access-grant / policy identifier (ADR-0014 versioned). */
  readonly accessGrant: string;
  /** The immutable digest of the access grant (`urn:sha256:<hex>`) — binds the exact grant (T-08). */
  readonly accessGrantDigest: string;
  /** The access-profile identifier + version. */
  readonly accessProfile: string;
  /** The Solid/LWS/Databox compatibility profiles the connection conforms to. */
  readonly conformsTo: readonly string[];
  /** The synchronisation-profile identifier. */
  readonly syncProfile: string;
  /** The opaque relationship identifier (opaque outside the program). */
  readonly relationship: string;
}

/** The BitstringStatusList status reference embedded in the credential (ADR-0007). */
export interface CredentialStatusReference {
  readonly id: string;
  /** The literal status-entry type IRI — a `typeof`-const here is not Components.js-loadable. */
  readonly type: 'BitstringStatusListEntry';
  readonly statusPurpose: string;
  readonly statusListIndex: number;
  readonly statusListCredential: string;
}

/** The credential-schema reference (ADR-0007). */
export interface CredentialSchemaReference {
  readonly id: string;
  readonly type: 'JsonSchema';
}

/** The credential subject: pairwise holder + holder-key binding + connection binding. */
export interface ConnectionCredentialSubject {
  readonly id: string;
  readonly holder: HolderBinding;
  readonly connection: ConnectionBinding;
}

/**
 * A W3C VC 2.0 `DataboxConnectionCredential` (ADR-0007). This is the JWS payload of the
 * `application/vc+jwt` credential; the securing JWS is produced by {@link ConnectionCredentialIssuer}.
 */
export interface DataboxConnectionCredential {

  readonly '@context': readonly string[];
  readonly id: string;
  readonly type: readonly string[];
  readonly issuer: string;
  readonly validFrom: string;
  readonly validUntil: string;
  readonly credentialSubject: ConnectionCredentialSubject;
  readonly credentialStatus: CredentialStatusReference;
  readonly credentialSchema: CredentialSchemaReference;
}

/**
 * A fresh proof challenge (ADR-0008): a server-issued single-use nonce bound to exactly one audience and a
 * short expiry. The vault signs this with the bound holder private key to prove control (T-52).
 */
export interface ProofChallenge {
  readonly nonce: string;
  readonly audience: string;
  readonly issuedAt: string;
  readonly expiresAt: string;
}

/**
 * The lifecycle state of a stored connection in the per-program registry (ADR-0009 events).
 * `superseded` is a rotated/renewed/migrated predecessor: retained for provenance but no longer usable.
 */
export type ConnectionLifecycleState = 'active' | 'suspended' | 'revoked' | 'expired' | 'superseded';

/** A retired holder key kept for provenance (T-33): historical records stay verifiable, access does not. */
export interface KeyHistoryEntry {
  readonly thumbprint: string;
  readonly publicKeyJwk: PublicJwk;
  readonly retiredAt: string;
  readonly reason: 'rotation' | 'renewal' | 'migration' | 'revocation';
  /** The credential id this key was bound to (provenance of superseded credentials, T-48). */
  readonly credentialId: string;
}

/**
 * The PROVISIONAL short-lived token produced by the exchange seam (ADR-0005/0006 Blocked). It models the
 * *result* of exchanging the credential + fresh holder proof for a short-lived, audience-bound token
 * (ADR-0009) **conceptually only**. It is deliberately NOT the LWS/RFC 8693 wire format: `notWireFormat`
 * marks it so no caller mistakes it for a transmissible access token, and it embeds no reusable secret.
 */
export interface ProvisionalShortLivedToken {
  readonly connectionId: string;
  readonly audience: string;
  readonly holderThumbprint: string;
  readonly issuedAt: string;
  readonly expiresAt: string;
  /** Always `true`: this structure is a provisional seam, never a real access token on the wire. */
  readonly notWireFormat: true;
  /** Human-readable marker of the blocked binding (ADR-0005/0006). */
  readonly note: string;
}
