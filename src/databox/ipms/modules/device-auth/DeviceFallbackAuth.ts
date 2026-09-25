import { createHash, randomBytes } from 'node:crypto';
import { BadRequestHttpError } from '../../../../util/errors/BadRequestHttpError';

/**
 * Device fallback authentication (CIV-B36, `databox.html#devices-wot`): not every device can hold a
 * client certificate for mTLS — a lightweight sensor or a shared kiosk can't run the WebID-TLS
 * enrolment ceremony. For those, the databox falls back to a Solid-OIDC-style **client-credentials +
 * DPoP** path: the operator issues the device a scoped client credential (client_id + secret), the
 * device presents it bound to its own DPoP key, and the credential grants ONLY the device's
 * declared operations — never pod-wide access.
 *
 * The fallback is deliberately narrower than mTLS enrolment: the credential is scope-limited
 * (`scopes` — the exact pod subtrees/operations the device may touch), time-bounded (`expiresAt`),
 * and DPoP-bound (a stolen client secret alone doesn't authenticate — the request must carry the
 * device's `cnf.jkt` key). A device that CAN do mTLS must still use the stronger path — the fallback
 * is for devices that demonstrably can't, recorded as such on enrolment.
 */

export interface FallbackCredential {
  /** The device's WebID (its enrolled identity). */
  readonly deviceId: string;
  /** The issued client id. */
  readonly clientId: string;
  /** The client secret — shown ONCE at issue, stored by the device; never logged. */
  readonly clientSecret: string;
  /** The JWK-thumbprint (`cnf.jkt`) the credential is DPoP-bound to — the device's key. */
  readonly dpopJkt: string;
  /** The pod-relative scopes the credential covers (e.g. `devices/meter/telemetry`). */
  readonly scopes: readonly string[];
  /** ISO-8601 expiry — a device credential is always time-bounded. */
  readonly expiresAt: string;
}

export interface IssuedFallbackCredential {
  /** The credential as issued (secret included — given to the device once). */
  readonly credential: FallbackCredential;
  /** The server's stored form — the SECRET HASH, never the plaintext secret. */
  readonly stored: {
    readonly deviceId: string;
    readonly clientId: string;
    readonly secretHash: string;
    readonly dpopJkt: string;
    readonly scopes: readonly string[];
    readonly expiresAt: string;
  };
}

/**
 * Issue a scoped, DPoP-bound client credential for a device that can't do mTLS. The server stores
 * only the secret's hash — the plaintext goes to the device once. Scopes must be declared and
 * non-empty (a fallback credential with no scope grants nothing — fail closed on an empty scope).
 */
export function issueDeviceFallbackCredential(input: {
  readonly deviceId: string;
  readonly dpopJkt: string;
  readonly scopes: readonly string[];
  readonly expiresAt: string;
  readonly now?: () => string;
}): IssuedFallbackCredential {
  if (input.deviceId.trim().length === 0 || input.dpopJkt.trim().length === 0) {
    throw new BadRequestHttpError('A fallback credential needs the device id and the DPoP key thumbprint.');
  }
  if (input.scopes.length === 0 || input.scopes.some(s => s.trim().length === 0)) {
    throw new BadRequestHttpError('A fallback credential needs ≥1 declared scope — it can never be pod-wide.');
  }
  const expiresAt = input.expiresAt;
  if (Number.isNaN(Date.parse(expiresAt))) {
    throw new BadRequestHttpError('A fallback credential needs a valid ISO-8601 expiresAt.');
  }
  const clientId = `device-${randomBytes(8).toString('hex')}`;
  const clientSecret = randomBytes(24).toString('base64url');
  const credential: FallbackCredential = {
    deviceId: input.deviceId,
    clientId,
    clientSecret,
    dpopJkt: input.dpopJkt,
    scopes: input.scopes,
    expiresAt,
  };
  return {
    credential,
    stored: {
      deviceId: input.deviceId,
      clientId,
      secretHash: hashSecret(clientSecret),
      dpopJkt: input.dpopJkt,
      scopes: input.scopes,
      expiresAt,
    },
  };
}

/**
 * Verify a fallback presentation: client_id + secret + the request's DPoP key thumbprint + the
 * requested scope. Fails closed on an unknown client, a wrong secret, an unbound DPoP key, an
 * expired credential, or a scope the credential doesn't cover. Returns the permitted scope.
 */
export function verifyDeviceFallback(
  stored: IssuedFallbackCredential['stored'],
  presentation: {
    readonly clientId: string;
    readonly clientSecret: string;
    readonly dpopJkt: string;
    readonly requestedScope: string;
    readonly at?: string;
  },
): { readonly scope: string } {
  if (presentation.clientId !== stored.clientId) {
    throw new BadRequestHttpError('Unknown device client id.');
  }
  if (hashSecret(presentation.clientSecret) !== stored.secretHash) {
    throw new BadRequestHttpError('Device client secret mismatch.');
  }
  if (presentation.dpopJkt !== stored.dpopJkt) {
    throw new BadRequestHttpError('DPoP key not bound to this credential (stolen-secret replay rejected).');
  }
  const at = presentation.at ?? new Date().toISOString();
  if (Date.parse(at) > Date.parse(stored.expiresAt)) {
    throw new BadRequestHttpError('Device credential expired.');
  }
  if (!stored.scopes.includes(presentation.requestedScope)) {
    throw new BadRequestHttpError(`Scope '${presentation.requestedScope}' is outside this credential's grant.`);
  }
  return { scope: presentation.requestedScope };
}

function hashSecret(secret: string): string {
  return createHash('sha256').update(secret, 'utf8').digest('hex');
}
