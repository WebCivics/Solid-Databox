import { generateKeyPairSync } from 'node:crypto';
import type { KeyObject } from 'node:crypto';
import { IssuedTokenRegistry } from '../../src/databox/consume/ConsumeApi';
import { ConnectionCredentialIssuer } from '../../src/databox/credential/ConnectionCredentialIssuer';
import { jwkThumbprint } from '../../src/databox/credential/Es256';
import type { PublicJwk } from '../../src/databox/credential/ConnectionCredentialTypes';
import type { DurableCommit } from '../../src/databox/receipt/DurableCommit';
import { signHolderProof } from '../../src/databox/credential/HolderKeyProof';
import { GuardianNetwork } from '../../src/databox/personal/household/GuardianNetwork';
import type { GuardianshipRelation } from '../../src/databox/personal/household/Guardianship';
import type { HouseholdMember } from '../../src/databox/personal/household/HouseholdProfile';
import { SsrfSafeEndpointValidator } from '../../src/databox/notification/EndpointValidator';
import { issueReceiptHandler, signalHolderHandler } from '../../src/databox/policy/DutyHandlers';
import type { DutyInstance } from '../../src/databox/policy/DutyEngine';
import { ReferenceConsumerAgent } from '../../src/databox/agent/ReferenceConsumerAgent';
import { AgentHarness, T } from '../unit/databox/agent/AgentTestSupport';

/**
 * DBX-26 — the adversarial suite. Each test is one P1 attack from the threat model
 * (`databox/devdocs/dbx-03-adversarial-test-backlog.md`), exercised against the REAL
 * component — asserting the expected safe outcome. A test fails if the attack succeeds
 * OR the denial leaks protected facts.
 */

const PROGRAM_A = 'https://org.example/programs/loyalty-a';
const PROGRAM_B = 'https://other.example/programs/other';
const DATABOX = 'https://org.example/boxes/bx_a/';
const DATABOX_B = 'https://databox-b.org.example/';
const REL = 'urn:uuid:rel-a';
const TENANT = 'tenant-a';

function holder(): { privateKey: KeyObject; publicJwk: PublicJwk } {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  return { privateKey, publicJwk: publicKey.export({ format: 'jwk' }) as PublicJwk };
}

function issueCredential(
  harness: AgentHarness,
  publicJwk: JsonWebKey,
  program = PROGRAM_A,
  index = 42,
  pairwiseWebId = 'https://consumer.example/id#me',
): string {
  return harness.credentialIssuer.issue({
    pairwiseWebId,
    holderPublicJwk: publicJwk as never,
    program,
    databox: DATABOX,
    storageDescription: `${DATABOX}description`,
    accessGrant: { id: 'grant-1', bytes: 'grant-bytes' },
    accessProfile: 'https://w3id.org/solid-databox/access/v1',
    conformsTo: [ 'https://solidproject.org/TR/protocol' ],
    syncProfile: 'https://w3id.org/solid-databox/sync/v1',
    relationship: REL,
    statusListIndex: index,
    statusListCredential: 'https://org.example/status/connections',
    now: T,
    validForMs: 100_000_000,
  }).jws;
}

const DUMMY_INSTANCE = { id: 'duty-1' } as unknown as DutyInstance;

describe('DBX-26 — P1 adversarial suite', (): void => {
  let harness: AgentHarness;

  beforeEach((): void => {
    harness = new AgentHarness();
  });

  it('AT-08 — a credential minted for program A cannot exchange into program B.', (): void => {
    const h = holder();
    const credentialJws = issueCredential(harness, h.publicJwk, PROGRAM_A);
    const challenge = harness.proofVerifier.issueChallenge(DATABOX);
    const proof = signHolderProof(challenge, h.privateKey, jwkThumbprint(h.publicJwk));
    expect((): unknown => harness.tokenExchange.exchange({
      credentialJws,
      proofJws: proof,
      audience: DATABOX,
      program: PROGRAM_B,
      databox: DATABOX,
      now: T,
    })).toThrow();
  });

  it('AT-13 — a cryptographically-valid credential from an untrusted issuer is refused.', (): void => {
    const foreign = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    const foreignIssuer = new ConnectionCredentialIssuer(
      'https://evil.example/id#issuer',
      foreign.privateKey,
      'https://evil.example/id#key',
    );
    const h = holder();
    const forged = foreignIssuer.issue({
      pairwiseWebId: 'https://consumer.example/id#me',
      holderPublicJwk: h.publicJwk,
      program: PROGRAM_A,
      databox: DATABOX,
      storageDescription: `${DATABOX}description`,
      accessGrant: { id: 'grant-1', bytes: 'grant-bytes' },
      accessProfile: 'https://w3id.org/solid-databox/access/v1',
      conformsTo: [ 'https://solidproject.org/TR/protocol' ],
      syncProfile: 'https://w3id.org/solid-databox/sync/v1',
      relationship: REL,
      statusListIndex: 1,
      statusListCredential: 'https://org.example/status/connections',
      now: T,
      validForMs: 100_000_000,
    });
    expect((): unknown => harness.validator.validate(forged.jws, { program: PROGRAM_A })).toThrow();
  });

  it('AT-17 — the connection credential itself is refused as an access token.', (): void => {
    const registry = new IssuedTokenRegistry();
    const credentialJws = issueCredential(harness, holder().publicJwk, PROGRAM_A);
    // The credential document presented where a provisional token belongs → not a token.
    expect((): unknown => registry.validate(credentialJws as never)).toThrow();
  });

  it('AT-19 — a proof nonce is single-use; an expired/wrong-audience proof is denied.', (): void => {
    const h = holder();
    const credentialJws = issueCredential(harness, h.publicJwk, PROGRAM_A);
    const challenge = harness.proofVerifier.issueChallenge(DATABOX);
    const proof = signHolderProof(challenge, h.privateKey, jwkThumbprint(h.publicJwk));

    // First exchange succeeds.
    const token = harness.tokenExchange.exchange({
      credentialJws,
      proofJws: proof,
      audience: DATABOX,
      program: PROGRAM_A,
      databox: DATABOX,
      now: T,
    });
    expect(token.notWireFormat).toBe(true);

    // Replay the SAME proof → the nonce is consumed → denied.
    expect((): unknown => harness.tokenExchange.exchange({
      credentialJws,
      proofJws: proof,
      audience: DATABOX,
      program: PROGRAM_A,
      databox: DATABOX,
      now: T,
    })).toThrow();

    // A proof minted for a different audience is refused.
    const challengeB = harness.proofVerifier.issueChallenge(DATABOX_B);
    const proofB = signHolderProof(challengeB, h.privateKey, jwkThumbprint(h.publicJwk));
    expect((): unknown => harness.tokenExchange.exchange({
      credentialJws,
      proofJws: proofB,
      audience: DATABOX,
      program: PROGRAM_A,
      databox: DATABOX,
      now: T,
    })).toThrow();

    // An expired token is refused by the registry.
    const registry = new IssuedTokenRegistry();
    registry.record(token, TENANT);
    expect((): unknown => registry.validate(token, T + 10_000_000_000)).toThrow(/expired/iu);
  });

  it('AT-38 — outbound endpoints at private/link-local/metadata IPs are refused (SSRF).', async(): Promise<void> => {
    const validator = new SsrfSafeEndpointValidator({ resolver: async(): Promise<string[]> => [ '169.254.169.254' ]});
    await expect(validator.validate('http://169.254.169.254/latest/meta-data')).rejects.toThrow();
    await expect(validator.validate('http://127.0.0.1:8080/admin')).rejects.toThrow();
    await expect(validator.validate('file:///etc/passwd')).rejects.toThrow();
    await expect(validator.validate('https://internal.local')).rejects.toThrow(); // Resolves to private
  });

  it('AT-47 — a guardian cannot act outside their scope or after the relation lapses.', (): void => {
    const members: HouseholdMember[] = [
      { memberId: 'mum', role: 'admin', capacity: 'full' },
      { memberId: 'nan', role: 'member', capacity: 'full' },
      { memberId: 'kid', role: 'member', capacity: 'limited' },
    ];
    const net = new GuardianNetwork(members);
    const rel: GuardianshipRelation = {
      wardId: 'kid',
      guardianId: 'nan',
      kind: 'kinship',
      basis: 'agreement',
      scopes: [ 'daily-care' ],
      households: [ 'house-a' ],
      validFrom: '2020-01-01',
      validUntil: '2020-12-31',
    };
    net.addRelation(rel);
    // Scope escape: nan holds daily-care, not medical.
    expect(net.mayActFor('nan', 'kid', 'medical')).toBe(false);
    // Expired: the relation lapsed in 2020.
    expect(net.mayActFor('nan', 'kid', 'daily-care')).toBe(false);
  });

  it('AT-50 — a duty handler that cannot complete reports failed/queued, never fulfilled.', async(): Promise<void> => {
    // SignalHolder is a QUEUED signal only — never fulfilled.
    const signal = await signalHolderHandler()(DUMMY_INSTANCE);
    expect(signal.resultState).toBe('queued');
    expect(signal.resultState).not.toBe('accepted');
    // IssueReceipt without a durable commit → failed (retryable), not silently fulfilled.
    const receipt = await issueReceiptHandler(harness.receiptSigner, {
      transaction: 't',
      acceptedResource: 'r',
      payloadDigest: 'urn:sha256:x',
      sender: 'https://org.example/id#issuer',
      addressedRelationship: REL,
      operation: 'deposit',
      profileVersion: '1',
      profileDigest: 'd',
      policyDigest: 'p',
      odrlPolicy: 'o',
      activatedDuties: [],
      // Deliberately an UNCONFIRMED commit — assertDurableCommit must fail closed on it.
      durableCommit: {
        eventId: 'e',
        committedAt: '',
        payloadDigest: 'x',
        confirmed: false,
      } as unknown as DurableCommit,
    })(DUMMY_INSTANCE);
    expect(receipt.resultState).toBe('failed');
  });

  it('AT-51 — a record carrying links/directives triggers no auto-submission.', async(): Promise<void> => {
    const agent = new ReferenceConsumerAgent(harness.deps());
    const inertPayload = JSON.stringify({
      '@context': { see: 'https://evil.example/exfil' },
      link: 'https://evil.example/track.png',
      directive: 'auto-submit-all-fields',
    });
    const issued = harness.issueConnection({
      program: PROGRAM_A,
      relationship: REL,
      databox: DATABOX,
      tenantId: TENANT,
    });
    const id = agent.forProgram(PROGRAM_A).importConnection(issued.connectionImport);
    harness.recordsByConnection.set(id, [ harness.recordItem(inertPayload, 9) ]);
    const submissionsBefore = harness.submitCount;
    await agent.forProgram(PROGRAM_A).retrieveAndStore(id);
    // The record's links/directives drove ZERO submissions — records are inert data.
    expect(harness.submitCount).toBe(submissionsBefore);
  });

  it('AT-03/35 — two connections yield no shared correlator across credentials.', (): void => {
    const credA = issueCredential(
      harness,
      holder().publicJwk,
      PROGRAM_A,
      42,
      'https://pairwise.example/a#conn',
    );
    const credB = issueCredential(
      harness,
      holder().publicJwk,
      PROGRAM_A,
      43,
      'https://pairwise.example/b#conn',
    );
    const decode = (jws: string): Record<string, unknown> =>
      JSON.parse(Buffer.from(jws.split('.')[1], 'base64url').toString()) as Record<string, unknown>;
    const subjectA = decode(credA).credentialSubject as Record<string, unknown>;
    const subjectB = decode(credB).credentialSubject as Record<string, unknown>;
    // The pairwise WebID is the subject's `id` (and holder.id) — pairwise per connection.
    const idA = subjectA.id;
    const idB = subjectB.id;
    expect(idA).not.toBe(idB);
    expect(decode(credA).id).not.toBe(decode(credB).id);
    // No field in either names the other's pairwise id — no correlator leaks across them.
    expect(JSON.stringify(decode(credA))).not.toContain(String(idB));
    expect(JSON.stringify(decode(credB))).not.toContain(String(idA));
  });
});
