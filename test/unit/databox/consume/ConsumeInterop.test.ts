import { generateKeyPairSync } from 'node:crypto';
import { IssuedTokenRegistry } from '../../../../src/databox/consume/ConsumeApi';
import { ConsumeHttpHandler } from '../../../../src/databox/consume/ConsumeHttpHandler';
import type { RemoteFetcher, RemoteResponse } from '../../../../src/databox/personal/RemoteConsumeClient';
import { RemoteConsumeClient } from '../../../../src/databox/personal/RemoteConsumeClient';
import type { VerificationInput } from '../../../../src/databox/personal/PersonalVaultService';
import { PersonalVaultService } from '../../../../src/databox/personal/PersonalVaultService';
import type { HttpRequest } from '../../../../src/server/HttpRequest';
import type { HttpResponse } from '../../../../src/server/HttpResponse';
import { sha256Hex } from '../../../../src/databox/credential/Es256';
import { VC_V2_CONTEXT } from '../../../../src/databox/credential/ConnectionCredentialTypes';
import { DBX_RECORD_CONTEXT } from '../../../../src/databox/proof/RecordProofTypes';
import { AgentHarness, ISSUER, KID, RECORD_STATUS_CRED, T } from '../agent/AgentTestSupport';

const DATABOX = 'https://databox.org.example/';
const TENANT = 'tenant-interop';
const PROGRAM = 'https://org.example/programs/loyalty';
const REL = 'https://org.example/relationships/rel-interop';

/** Bridge: drive the real ConsumeHttpHandler in place of HTTP — the declared contract, served live. */
function fetcherTo(handler: ConsumeHttpHandler): RemoteFetcher {
  return async(url, init): Promise<RemoteResponse> => {
    const stream = (async function* (): AsyncGenerator<Buffer> {
      if (init?.body !== undefined) {
        yield Buffer.from(init.body);
      }
    })();
    const request = Object.assign(stream, {
      method: init?.method ?? 'GET',
      url: new URL(url).pathname + new URL(url).search,
      headers: { 'content-type': 'application/json', ...init?.headers },
    }) as unknown as HttpRequest;
    const response = {
      statusCode: 0,
      body: '',
      setHeader(): void {
        /* Capture not needed */
      },
      end(this: { body: string }, payload?: string): void {
        this.body = payload ?? '';
      },
    } as unknown as HttpResponse & { body: string };
    await handler.handle({ request, response });
    const body = response.body;
    return {
      ok: response.statusCode >= 200 && response.statusCode < 300,
      status: response.statusCode,
      json: async(): Promise<unknown> => body.length > 0 ? JSON.parse(body) : undefined,
    };
  };
}

function verificationInput(harness: AgentHarness): VerificationInput {
  const keys = [
    {
      issuer: ISSUER,
      verificationMethod: KID,
      publicKeyJwk: harness.issuerKeys.publicJwk,
      status: 'active' as const,
      validFrom: '1970-01-01T00:00:00Z',
    },
  ];
  return {
    recordIssuerKeys: keys,
    receiptIssuerKeys: keys,
    pinnedContexts: {
      [VC_V2_CONTEXT]: sha256Hex('{"vc2":"x"}'),
      [DBX_RECORD_CONTEXT]: sha256Hex('{"dbxRecord":"x"}'),
    },
    pinnedStatusLists: { [RECORD_STATUS_CRED]: harness.recordStatusList.encode() },
  };
}

describe('CIV-C27 — personal vault ↔ org consume surface (interop)', (): void => {
  it('a personal vault end-to-ends against a live consume handler — import, sync, recover.', async(): Promise<void> => {
    const harness = new AgentHarness();
    const recordStore = {
      listFor: async(connectionId: string): Promise<readonly never[]> =>
        (harness.recordsByConnection.get(connectionId) ?? []) as never[],
    };
    const submissionProcessor = {
      process: async(_t: unknown, sub: unknown): Promise<{ receiptJws: string; payload: string }> => {
        const payload = JSON.stringify((sub as { fields: unknown }).fields);
        return { receiptJws: harness.signReceipt(payload, 'submission'), payload };
      },
    };
    const handler = new ConsumeHttpHandler({
      challengeSource: harness.proofVerifier,
      tokenExchange: harness.tokenExchange,
      recordStore,
      submissionProcessor,
      cursorFeed: harness.cursorFeed,
      tokenRegistry: new IssuedTokenRegistry(),
      tenantFor: (): string => TENANT,
      statusListEncoded: (): string => harness.recordStatusList.encode(),
      now: (): number => T,
    });

    // The vault's remote client hits the real consume handler through the declared contract.
    const remote = new RemoteConsumeClient(fetcherTo(handler));
    const service = new PersonalVaultService({
      issuerKeys: new Map([[ ISSUER, harness.issuerKeys.publicKey ]]),
      remote,
      now: (): number => T,
    });

    // The person generates a holder key; the org issues a credential bound to its public half.
    const holder = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    const holderPublicJwk = holder.publicKey.export({ format: 'jwk' }) as never;
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
      statusListIndex: 42,
      statusListCredential: 'https://org.example/status/connections',
      now: T,
      validForMs: 100_000_000,
    });

    // Import the credential with the SAME holder key the credential binds.
    const { connectionId } = service.importConnection({
      program: PROGRAM,
      credentialJws: issued.jws,
      holderPrivateKey: holder.privateKey,
      tenantId: TENANT,
      verification: verificationInput(harness),
    });

    // SYNC: real challenge → real token exchange → records pulled + verified.
    harness.recordsByConnection.set(connectionId, [
      harness.recordItem('{"account":"balance-120"}', 5),
    ]);
    const stored = await service.sync(PROGRAM, connectionId);
    expect(stored).toHaveLength(1);

    // RECOVER: token-bound tenant feed pull.
    harness.cursorFeed.record(TENANT, { eventId: 'e-1', resourceRef: 'r/1', activity: 'Create' });
    const events = await service.recover(PROGRAM, connectionId);
    expect(events).toHaveLength(1);
  });

  it('a foreign vault cannot pull this org\'s records — the token is issuance-bound.', async(): Promise<void> => {
    const harness = new AgentHarness();
    const handler = new ConsumeHttpHandler({
      challengeSource: harness.proofVerifier,
      tokenExchange: harness.tokenExchange,
      recordStore: { listFor: async(): Promise<readonly never[]> => []},
      submissionProcessor: { process: async(): Promise<never> => {
        throw new Error('unreachable');
      } },
      cursorFeed: harness.cursorFeed,
      tokenRegistry: new IssuedTokenRegistry(),
      tenantFor: (): string => TENANT,
    });
    const remote = new RemoteConsumeClient(fetcherTo(handler));
    // A token the org never issued is refused.
    const forged = {
      connectionId: 'x',
      audience: DATABOX,
      holderThumbprint: 'x',
      issuedAt: 'x',
      expiresAt: '2999-01-01',
      notWireFormat: true as const,
      note: 'forged',
    };
    await expect(remote.fetchRecords(forged)).rejects.toThrow('400');
  });
});
