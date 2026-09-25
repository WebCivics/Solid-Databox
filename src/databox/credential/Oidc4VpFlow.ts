import { BadRequestHttpError } from '../../util/errors/BadRequestHttpError';
import type { ProofChallenge } from './ConnectionCredentialTypes';
import type {
  ConnectionCredentialValidator,
  CredentialExpectations,
  ValidatedConnectionCredential,
} from './ConnectionCredentialValidator';
import type { HolderKeyProofVerifier } from './HolderKeyProof';

/**
 * The OIDC4VP-style verifiable-presentation exchange (CIV-B06): a verifier requests a presentation
 * — the set of claims it needs, its audience and purpose, and a fresh single-use nonce — and the
 * holder returns a presentation (`vp_token`): their credential JWS + a holder-bound proof signed to
 * the request's nonce and audience. This is the privacy-preserving "show me the concession/
 * membership claim" ceremony: the verifier learns ONLY the requested claims, the holder proves they
 * hold the credential (not that they're a known identity), and the exchange is replay-safe.
 *
 * Composes the existing primitives without new crypto:
 *  - `createRequest` mints a `presentation_definition` — the requested claims + a single-use
 *    `HolderKeyProofVerifier` challenge (nonce + audience + expiry — server-chosen, never attacker).
 *  - `verifyPresentation` runs the full gate in order: the credential validates against the trusted
 *    issuer set (`ConnectionCredentialValidator` — issuer signature + holder binding + revocation);
 *    the holder proof verifies against the credential's bound key AND consumes the nonce (T-19 — a
 *    captured presentation can't be replayed); then ONLY the requested claims are surfaced — the
 *    rest of the credential stays with the holder (selective disclosure by request).
 *
 * Fail closed at every step: an untrusted issuer, a holder-key mismatch, a replayed/mismatched
 * nonce, or a request for a claim the credential doesn't carry all reject.
 */

export interface PresentationDefinition {
  /** A stable request id the holder echoes back. */
  readonly id: string;
  /** The verifier's audience (who this presentation is FOR). */
  readonly audience: string;
  /** The purpose the claims are requested under — surfaced for the holder's consent. */
  readonly purpose: string;
  /** The credential-subject claim names the verifier requests (selective disclosure). */
  readonly requestedClaims: readonly string[];
  /** The single-use challenge the holder proof must satisfy. */
  readonly challenge: ProofChallenge;
}

export interface VerifiablePresentation {
  /** The credential JWS the holder is presenting. */
  readonly credentialJws: string;
  /** The holder proof signed to the request's nonce+audience. */
  readonly proofJws: string;
  /** The request id this answers. */
  readonly presentationId: string;
}

export interface VerifiedPresentation {
  /** The request id answered. */
  readonly presentationId: string;
  /** The holder's key thumbprint — proof they hold the credential (not a global identity). */
  readonly holderThumbprint: string;
  /** ONLY the requested claims — nothing else from the credential is disclosed. */
  readonly claims: Record<string, unknown>;
}

export class Oidc4VpVerifier {
  public constructor(
    private readonly credentialValidator: ConnectionCredentialValidator,
    private readonly proofVerifier: HolderKeyProofVerifier,
    private readonly requestIdFactory: () => string = (): string =>
      `vp-request-${Math.random().toString(36).slice(2, 10)}`,
  ) {}

  /** Issue a presentation request — the claims + purpose + a fresh single-use challenge. */
  public createRequest(
    audience: string,
    requestedClaims: readonly string[],
    purpose: string,
  ): PresentationDefinition {
    if (audience.trim().length === 0 || requestedClaims.length === 0) {
      throw new BadRequestHttpError('A presentation request needs an audience and ≥1 requested claim.');
    }
    return {
      id: this.requestIdFactory(),
      audience,
      purpose,
      requestedClaims,
      challenge: this.proofVerifier.issueChallenge(audience),
    };
  }

  /**
   * Verify a holder's presentation against the request: the credential validates, the holder proof
   * binds it to this request's nonce+audience (consumed — replay-safe), and only the requested
   * claims are surfaced.
   */
  public verifyPresentation(
    request: PresentationDefinition,
    response: VerifiablePresentation,
    expectations: CredentialExpectations = {},
  ): VerifiedPresentation {
    if (response.presentationId !== request.id) {
      throw new BadRequestHttpError('The presentation does not answer this request id.');
    }
    // 1. The credential validates against the trusted issuer set → the bound holder key.
    const validated: ValidatedConnectionCredential =
      this.credentialValidator.validate(response.credentialJws, expectations);
    // 2. The holder proof binds the credential's bound key to THIS request's nonce+audience (T-19).
    this.proofVerifier.verify(response.proofJws, validated.holderPublicJwk, request.audience);
    // 3. Surface ONLY the requested claims — the rest of the credential stays with the holder.
    //    The connection credential nests the realm claims under `credentialSubject.connection`, so a
    //    claim resolves from either the subject root or the connection binding (path-aware).
    const subject = validated.credential.credentialSubject as unknown as Record<string, unknown>;
    const connection = (subject.connection ?? {}) as Record<string, unknown>;
    const claims: Record<string, unknown> = {};
    for (const claim of request.requestedClaims) {
      const scope = claim in subject ? subject : connection;
      if (!(claim in scope)) {
        throw new BadRequestHttpError(`The credential does not carry the requested claim '${claim}'.`);
      }
      claims[claim] = scope[claim];
    }
    return {
      presentationId: request.id,
      holderThumbprint: validated.holderThumbprint,
      claims,
    };
  }
}
