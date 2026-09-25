import type { KeyObject } from 'node:crypto';
import { BadRequestHttpError } from '../../util/errors/BadRequestHttpError';
import { keyObjectFromPublicJwk } from '../credential/Es256';
import type { IssuerKeyDescriptor } from './RecordProofTypes';

/**
 * The trusted-issuer + key-history store for record-proof verification (ADR-0020 §6, DBX-16).
 *
 * Verification MUST resolve the signing key from a TRUSTED source keyed by the program's issuer set — never
 * from the JWS header or the payload (a header-supplied key is attacker-controlled). This store is that
 * source. It also enforces **key history**:
 *
 * - a `rotated` key still verifies records **issued within its validity window** (a since-rotated key keeps
 *   historical records verifiable — ADR-0019/0020);
 * - a `revoked` key — the stolen/compromised-key case (T-20) — never verifies, not even a historical record,
 *   because its private half can no longer be trusted;
 * - a key used **outside** its `[validFrom, validUntil)` window (before it existed, or after it was retired)
 *   is rejected — this denies an attacker minting a "historical" record with a retired verification method.
 *
 * Trusted issuers are a **per-program** profile choice (ADR-0020 §Open sub-questions, ADR-0006 DBX-06), so
 * the store is scoped to one program and constructed from that program's key descriptors.
 */
export class IssuerTrustStore {
  private readonly descriptors: readonly IssuerKeyDescriptor[];

  /**
   * @param programId - The program this store is scoped to (isolation; there is no cross-program key set).
   * @param descriptors - The trusted issuer keys (current + retained history). Each is validated fail-closed:
   *   a P-256 public JWK, a parseable `validFrom`, and a `validUntil` after `validFrom` when present.
   */
  public constructor(
    public readonly programId: string,
    descriptors: readonly IssuerKeyDescriptor[],
  ) {
    for (const descriptor of descriptors) {
      const from = Date.parse(descriptor.validFrom);
      if (Number.isNaN(from)) {
        throw new BadRequestHttpError(`Issuer key '${descriptor.verificationMethod}' has an unparseable validFrom.`);
      }
      if (descriptor.validUntil !== undefined) {
        const until = Date.parse(descriptor.validUntil);
        if (Number.isNaN(until) || until <= from) {
          throw new BadRequestHttpError(
            `Issuer key '${descriptor.verificationMethod}' must have validUntil after validFrom.`,
          );
        }
      }
      // Fail closed on a non-P-256 JWK at construction, so an untrustworthy key never enters the store.
      keyObjectFromPublicJwk(descriptor.publicKeyJwk);
    }
    this.descriptors = descriptors;
  }

  /**
   * Resolve the trusted verification key for `(issuer, verificationMethod)` that was valid at `issuanceTime`
   * (epoch ms). Fails closed on: an issuer/verification-method not in the trusted set (T-20 substituted key),
   * a `revoked` (compromised) key, or a key used outside its validity window. The returned key is the
   * store's own key material — never anything taken from the token.
   */
  public resolve(issuer: string, verificationMethod: string, issuanceTime: number): KeyObject {
    const matches = this.descriptors.filter(
      (entry): boolean => entry.issuer === issuer && entry.verificationMethod === verificationMethod,
    );
    if (matches.length === 0) {
      throw new BadRequestHttpError(
        `Record issuer/key is not trusted for this program: ${issuer} / ${verificationMethod} (T-20).`,
      );
    }
    // L1: a revoked descriptor MUST win over any active/rotated duplicate — otherwise a later `revoked`
    // entry is shadowed by an earlier match and a compromised key keeps verifying. Consult ALL matches.
    if (matches.some((entry): boolean => entry.status === 'revoked')) {
      // T-20: a compromised/revoked signing key can smithy records — reject even historical records outright.
      throw new BadRequestHttpError(`Record signing key is revoked/compromised: ${verificationMethod} (T-20).`);
    }
    const descriptor = matches[0];
    const from = Date.parse(descriptor.validFrom);
    if (issuanceTime < from) {
      throw new BadRequestHttpError(`Record was issued before its signing key became valid: ${verificationMethod}.`);
    }
    if (descriptor.validUntil !== undefined && issuanceTime >= Date.parse(descriptor.validUntil)) {
      // The key was already retired when this record claims to have been issued — a rotated key cannot mint
      // NEW records, only verify ones issued while it was live.
      throw new BadRequestHttpError(`Record was issued after its signing key was retired: ${verificationMethod}.`);
    }
    return keyObjectFromPublicJwk(descriptor.publicKeyJwk);
  }
}
