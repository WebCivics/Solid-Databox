import { deflateSync, inflateSync } from 'node:zlib';
import type { KeyObject } from 'node:crypto';
import { BadRequestHttpError } from '../../util/errors/BadRequestHttpError';
import { InternalServerError } from '../../util/errors/InternalServerError';
import type { PublicJwk } from './ConnectionCredentialTypes';
import { jwkThumbprint, keyObjectFromPublicJwk, signCompactJws, verifyCompactJws } from './Es256';

/**
 * Offline carried credentials (CIV-B07, `concession-card.html`): a credential a person CARRIES on a
 * card/QR/NFC — verifiable WITHOUT network. The concession card works at a turnstile or a pharmacist
 * with no connectivity because everything needed to verify is IN the carried token: the credential
 * claims, the issuer's signature, and the issuer's public key the verifier already trusts.
 *
 * The carried form is compact (a deflate-compressed canonical payload, base64url — small enough for
 * a QR/NFC payload). `carry` mints the offline token: claims + the issuer's JWK + a signature over
 * the claims bound to that key. `verifyOffline` verifies WITHOUT any network call — the embedded
 * issuer key is checked against the verifier's trusted-issuer map (a key the verifier already has
 * for that issuer), the signature verifies, the expiry holds, and the claims are returned. A token
 * whose embedded issuer key isn't the verifier's trusted key for that issuer is a forgery — fail
 * closed (the offline path can never be fed a substituted key).
 *
 * This is the offline counterpart to `Oidc4VpFlow` — a live exchange uses the request/proof
 * ceremony; a carried token is the offline fallback for a disconnected reader.
 */

/** The claims an offline credential asserts — the carried entitlement. */
export interface OfflineClaims {
  /** The issuer (must be in the verifier's trusted-issuer map). */
  readonly issuer: string;
  /** The credential class — e.g. `concession-pensioner`. */
  readonly credentialClass: string;
  /** The pairwise holder identifier. */
  readonly holderId: string;
  /** The asserted attributes — the claims the card carries. */
  readonly attributes: Record<string, unknown>;
  /** ISO-8601 validity bounds. */
  readonly validFrom: string;
  readonly validUntil: string;
}

/** The carried token — a compressed, signed, self-contained credential for offline verify. */
export interface OfflineToken {
  /** The compact, carryable form — QR/NFC payload. */
  readonly token: string;
  /** The claims it carries (for the issuer's own record). */
  readonly claims: OfflineClaims;
}

/**
 * Mint a carried credential: the claims + the issuer's public JWK bundled, deflate-compressed and
 * signed — a self-contained offline token.
 */
export function carry(
  claims: OfflineClaims,
  issuerPrivateKey: KeyObject,
  issuerPublicJwk: PublicJwk,
): OfflineToken {
  for (const field of [ claims.issuer, claims.credentialClass, claims.holderId ]) {
    if (typeof field !== 'string' || field.trim().length === 0) {
      throw new BadRequestHttpError('An offline credential needs an issuer, a class and a holder id.');
    }
  }
  if (Number.isNaN(Date.parse(claims.validFrom)) || Number.isNaN(Date.parse(claims.validUntil))) {
    throw new BadRequestHttpError('An offline credential needs valid ISO-8601 bounds.');
  }
  const payload = deflateSync(JSON.stringify({ claims, issuerJwk: issuerPublicJwk }), { level: 9 });
  const signature = signCompactJws(
    { alg: 'ES256', typ: 'databox-offline+jwt', kid: jwkThumbprint(issuerPublicJwk) },
    { payload: payload.toString('base64url'), issuerJwk: issuerPublicJwk },
    issuerPrivateKey,
  );
  return { token: signature, claims };
}

/**
 * Verify a carried credential OFFLINE. The verifier supplies its trusted-issuer key map — the
 * issuer key embedded in the token is checked against it, the JWS signature verifies over the
 * deflated claims, the validity window holds, and the decompressed claims are returned. Fail closed:
 * an unknown issuer, a substituted embedded key, a forged signature, or an expired credential all
 * reject — with no network.
 */
export function verifyOffline(
  token: string,
  trustedIssuerKeys: ReadonlyMap<string, PublicJwk>,
  now: number = Date.now(),
): OfflineClaims {
  // Read the (unverified) header/payload to resolve which issuer key to verify against.
  const decoded = verifyCompactJws(token, keyObjectFromPublicJwk(resolveEmbeddedIssuer(token)));
  const { payload: payloadB64, issuerJwk } = decoded.payload as { payload: string; issuerJwk: PublicJwk };
  const inflated = JSON.parse(inflateSync(Buffer.from(payloadB64, 'base64url')).toString('utf8')) as
    { claims: OfflineClaims };
  const claims = inflated.claims;

  // The embedded issuer key must be the verifier's trusted key for that issuer (no substituted key).
  const trusted = trustedIssuerKeys.get(claims.issuer);
  if (trusted === undefined) {
    throw new BadRequestHttpError(`Offline credential issuer is not trusted: ${claims.issuer}.`);
  }
  if (jwkThumbprint(issuerJwk) !== jwkThumbprint(trusted)) {
    throw new BadRequestHttpError('The embedded issuer key is not the trusted key for that issuer (T-20).');
  }
  if (now < Date.parse(claims.validFrom) || now >= Date.parse(claims.validUntil)) {
    throw new BadRequestHttpError('Offline credential is outside its validity window.');
  }
  return claims;
}

/** Pull the issuer's embedded JWK from the token so the signature can be verified. */
function resolveEmbeddedIssuer(token: string): PublicJwk {
  // Decode the payload's issuerJwk WITHOUT trusting it — the caller cross-checks against the
  // trusted-issuer map before trusting the verified claims.
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new BadRequestHttpError('Malformed offline credential token.');
  }
  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as { issuerJwk?: PublicJwk };
  if (payload.issuerJwk === undefined) {
    throw new InternalServerError('Offline credential is missing its embedded issuer key.');
  }
  return payload.issuerJwk;
}
