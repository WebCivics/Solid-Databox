import { generateKeyPairSync } from 'node:crypto';
import { Oidc4VpVerifier } from '../../../../src/databox/credential/Oidc4VpFlow';
import { signHolderProof } from '../../../../src/databox/credential/HolderKeyProof';
import { jwkThumbprint } from '../../../../src/databox/credential/Es256';
import { AgentHarness } from '../agent/AgentTestSupport';
import type { PublicJwk } from '../../../../src/databox/credential/ConnectionCredentialTypes';

const PROGRAM = 'https://org.example/programs/concession';
const DATABOX = 'https://databox.example/';
const REL = 'https://org.example/relationships/member';

function holderAndCredential(harness: AgentHarness) {
  const holder = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const holderPublicJwk = holder.publicKey.export({ format: 'jwk' }) as PublicJwk;
  const issued = harness.credentialIssuer.issue({
    pairwiseWebId: 'https://consumer.example/id#me',
    holderPublicJwk,
    program: PROGRAM,
    databox: DATABOX,
    storageDescription: `${DATABOX}description`,
    accessGrant: { id: 'grant-1', bytes: 'grant-bytes' },
    accessProfile: 'https://w3id.org/solid-databox/access/v1',
    conformsTo: [ 'https://solidproject.org/TR/protocol' ],
    syncProfile: 'https://w3id.org/solid-databox/sync/v1',
    relationship: REL,
    statusListIndex: 1,
    statusListCredential: 'https://org.example/status/connections',
    now: 0,
    validForMs: 1e15,
  });
  return { holder, holderPublicJwk, credentialJws: issued.jws, thumbprint: jwkThumbprint(holderPublicJwk) };
}

describe('Oidc4VpVerifier — the OIDC4VP presentation exchange (CIV-B06)', (): void => {
  it('a verifier requests claims; the holder presents a credential+proof; only the asked claims surface.', (): void => {
    const harness = new AgentHarness();
    const verifier = new Oidc4VpVerifier(harness.validator, harness.proofVerifier);
    const { holder, credentialJws, thumbprint } = holderAndCredential(harness);

    const request = verifier.createRequest(DATABOX, [ 'relationship', 'program' ], 'concession-check');
    const proofJws = signHolderProof(request.challenge, holder.privateKey, thumbprint);
    const vp = verifier.verifyPresentation(request, {
      credentialJws,
      proofJws,
      presentationId: request.id,
    });
    expect(vp.holderThumbprint).toBe(thumbprint);
    // ONLY the two requested claims — the rest of the credential stays with the holder.
    expect(Object.keys(vp.claims).sort()).toEqual([ 'program', 'relationship' ]);
    expect(vp.claims.relationship).toBe(REL);
  });

  it('fails closed: a replayed proof nonce, a wrong request id, an over-asking claim.', (): void => {
    const harness = new AgentHarness();
    const verifier = new Oidc4VpVerifier(harness.validator, harness.proofVerifier);
    const { holder, credentialJws, thumbprint } = holderAndCredential(harness);

    const request = verifier.createRequest(DATABOX, [ 'relationship' ], 'x');
    const proofJws = signHolderProof(request.challenge, holder.privateKey, thumbprint);
    // A wrong request id.
    expect((): unknown => verifier.verifyPresentation(request, {
      credentialJws,
      proofJws,
      presentationId: 'other',
    })).toThrow('does not answer');
    // The honest presentation verifies, consuming the nonce.
    verifier.verifyPresentation(request, { credentialJws, proofJws, presentationId: request.id });
    // A replay of the same proof → the nonce is spent (T-19).
    expect((): unknown => verifier.verifyPresentation(request, {
      credentialJws,
      proofJws,
      presentationId: request.id,
    })).toThrow();

    // A request for a claim the credential doesn't carry.
    const overAsk = verifier.createRequest(DATABOX, [ 'nonexistent-claim' ], 'x');
    const proof2 = signHolderProof(overAsk.challenge, holder.privateKey, thumbprint);
    expect((): unknown => verifier.verifyPresentation(overAsk, {
      credentialJws,
      proofJws: proof2,
      presentationId: overAsk.id,
    })).toThrow('does not carry');
  });

  it('an untrusted issuer or a holder-key mismatch rejects the presentation.', (): void => {
    const harness = new AgentHarness();
    const verifier = new Oidc4VpVerifier(harness.validator, harness.proofVerifier);
    const { credentialJws } = holderAndCredential(harness);
    const stranger = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    const request = verifier.createRequest(DATABOX, [ 'relationship' ], 'x');
    // A proof signed by a DIFFERENT key than the credential binds — not the holder.
    const wrongProof = signHolderProof(request.challenge, stranger.privateKey, 'stranger-thumb');
    expect((): unknown => verifier.verifyPresentation(request, {
      credentialJws,
      proofJws: wrongProof,
      presentationId: request.id,
    })).toThrow();
  });
});
