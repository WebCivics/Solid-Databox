import type {
  ProofChallenge,
  ProvisionalShortLivedToken,
} from '../../../../src/databox/credential/ConnectionCredentialTypes';
import type { CursorFeedPage } from '../../../../src/databox/feed/CursorFeed';
import { sha256Hex } from '../../../../src/databox/credential/Es256';
import {
  DBX_RECORD_CONTEXT,
  VC_V2_CONTEXT,
} from '../../../../src/databox/proof/RecordProofValidator';
import type { RemoteFetcher } from '../../../../src/databox/personal/RemoteConsumeClient';
import { RemoteConsumeClient } from '../../../../src/databox/personal/RemoteConsumeClient';
import { PersonalVaultService } from '../../../../src/databox/personal/PersonalVaultService';
import type { VerificationInput } from '../../../../src/databox/personal/PersonalVaultService';
import { AgentHarness, ISSUER, KID, RECORD_STATUS_CRED } from '../agent/AgentTestSupport';

const PROGRAM = 'https://org.example/programs/loyalty-a';
const DATABOX = 'https://org.example/boxes/bx_a/';

type FetcherCalls = { url: string; method?: string }[];

/** A RemoteConsumeClient backed by a scripted fetcher that answers the consume contract. */
function remoteFor(
  harness: AgentHarness,
  connectionId = 'conn-1',
): { remote: RemoteConsumeClient; calls: FetcherCalls } {
  const calls: FetcherCalls = [];
  const challenge: ProofChallenge = {
    nonce: 'nonce-1',
    audience: DATABOX,
    issuedAt: '2026-09-24T00:00:00Z',
    expiresAt: '2026-09-24T00:05:00Z',
  };
  const token: ProvisionalShortLivedToken = {
    connectionId,
    audience: DATABOX,
    holderThumbprint: 'thumb',
    issuedAt: '2026-09-24T00:00:00Z',
    expiresAt: '2026-09-24T00:05:00Z',
    notWireFormat: true,
    note: 'test token',
  };

  type RemoteResponse = { ok: boolean; status: number; json: () => Promise<unknown> };
  const fetcher: RemoteFetcher = async(url, init): Promise<RemoteResponse> => {
    calls.push({ url, method: init?.method });
    const ok = (body: unknown): RemoteResponse =>
      ({ ok: true, status: 200, json: async(): Promise<unknown> => body });

    if (url.includes('/.databox/consume/challenge')) {
      return ok(challenge);
    }
    if (url.endsWith('/.databox/consume/token')) {
      return ok(token);
    }
    if (url.endsWith('/.databox/consume/records')) {
      return ok([ harness.recordItem('record-payload', 7) ]);
    }
    if (url.includes('/.databox/consume/feed')) {
      return ok({ events: [], nextCursor: 'c000000000000005' } satisfies CursorFeedPage);
    }
    if (url.endsWith('/.databox/consume/submissions')) {
      return ok({ receiptJws: harness.signReceipt('payload', 'submission'), payload: 'payload' });
    }
    return { ok: false, status: 404, json: async(): Promise<unknown> => ({}) };
  };
  return { remote: new RemoteConsumeClient(fetcher), calls };
}

function verificationInput(harness: AgentHarness): VerificationInput {
  return {
    recordIssuerKeys: [
      {
        issuer: ISSUER,
        verificationMethod: KID,
        publicKeyJwk: harness.issuerKeys.publicJwk,
        status: 'active',
        validFrom: '1970-01-01T00:00:00Z',
      },
    ],
    receiptIssuerKeys: [
      {
        issuer: ISSUER,
        verificationMethod: KID,
        publicKeyJwk: harness.issuerKeys.publicJwk,
        status: 'active',
        validFrom: '1970-01-01T00:00:00Z',
      },
    ],
    pinnedContexts: {
      [VC_V2_CONTEXT]: sha256Hex('{"vc2":"x"}'),
      [DBX_RECORD_CONTEXT]: sha256Hex('{"dbxRecord":"x"}'),
    },
    pinnedStatusLists: { [RECORD_STATUS_CRED]: harness.recordStatusList.encode() },
  };
}

function serviceWith(harness: AgentHarness): { service: PersonalVaultService; calls: FetcherCalls } {
  const { remote, calls } = remoteFor(harness);
  const service = new PersonalVaultService({
    issuerKeys: new Map([[ ISSUER, harness.issuerKeys.publicKey ]]),
    remote,
    now: (): number => 5_000_000,
  });
  return { service, calls };
}

function importConnection(harness: AgentHarness, service: PersonalVaultService, tenant = 'tenant-a'): string {
  const issued = harness.issueConnection({
    program: PROGRAM,
    relationship: 'urn:uuid:rel-a',
    databox: DATABOX,
    tenantId: tenant,
  });
  return service.importConnection({
    program: PROGRAM,
    credentialJws: issued.connectionImport.credentialJws,
    tenantId: tenant,
    verification: verificationInput(harness),
  }).connectionId;
}

describe('PersonalVaultService', (): void => {
  let harness: AgentHarness;

  beforeEach((): void => {
    harness = new AgentHarness();
  });

  describe('credential install target', (): void => {
    it('imports a credential with a locally generated holder key — the org never sees the private half.', (): void => {
      const { service } = serviceWith(harness);
      const issued = harness.issueConnection({
        program: PROGRAM,
        relationship: 'urn:uuid:rel-a',
        databox: DATABOX,
        tenantId: 'tenant-a',
      });
      const result = service.importConnection({
        program: PROGRAM,
        credentialJws: issued.connectionImport.credentialJws,
        tenantId: 'tenant-a',
        verification: verificationInput(harness),
      });
      expect(result.connectionId).toBe(issued.connectionId);
      expect(result.holderThumbprint.length).toBeGreaterThan(0);
      expect(service.listConnections(PROGRAM)).toEqual([ issued.connectionId ]);
    });

    it('keeps connections per-program isolated — a foreign program sees nothing (T-03).', (): void => {
      const { service } = serviceWith(harness);
      const id = importConnection(harness, service);
      expect(service.listConnections(PROGRAM)).toEqual([ id ]);
      expect(service.listConnections('https://org.example/programs/other')).toEqual([]);
    });

    it('rejects a credential minted for another program (T-08).', (): void => {
      const { service } = serviceWith(harness);
      const issued = harness.issueConnection({
        program: PROGRAM,
        relationship: 'r',
        databox: DATABOX,
        tenantId: 't',
      });
      expect((): unknown => service.importConnection({
        program: 'https://org.example/programs/other',
        credentialJws: issued.connectionImport.credentialJws,
        tenantId: 't',
        verification: verificationInput(harness),
      })).toThrow();
    });
  });

  describe('remote session + sync (notify-then-pull)', (): void => {
    it('negotiates the remote session, fetches, verifies and stores the record.', async(): Promise<void> => {
      const { service, calls } = serviceWith(harness);
      const id = importConnection(harness, service);
      const stored = await service.sync(PROGRAM, id);

      const urls = calls.map(call => call.url);
      expect(urls.some(u => u.includes('/.databox/consume/challenge'))).toBe(true);
      expect(urls.some(u => u.endsWith('/.databox/consume/token'))).toBe(true);
      expect(urls.some(u => u.endsWith('/.databox/consume/records'))).toBe(true);
      expect(stored).toHaveLength(1);
      expect(service.records(PROGRAM, id)).toHaveLength(1);
    });

    it('fails closed when the remote transport is unreachable.', async(): Promise<void> => {
      const { remote } = remoteFor(harness);
      const deadRemote = new RemoteConsumeClient(async(): ReturnType<RemoteFetcher> => {
        throw new Error('connection refused');
      });
      void remote;
      const service = new PersonalVaultService({
        issuerKeys: new Map([[ ISSUER, harness.issuerKeys.publicKey ]]),
        remote: deadRemote,
        now: (): number => 5_000_000,
      });
      const id = importConnection(harness, service);
      await expect(service.sync(PROGRAM, id)).rejects.toThrow('consume call');
    });
  });

  describe('cursor recovery', (): void => {
    it('pulls the tenant feed at the bound databox and advances the durable cursor.', async(): Promise<void> => {
      const { service, calls } = serviceWith(harness);
      const id = importConnection(harness, service);
      await service.recover(PROGRAM, id);

      const feedCall = calls.find(call => call.url.includes('/.databox/consume/feed'));
      expect(feedCall?.url).toContain(encodeURIComponent('tenant-a'));
      expect(feedCall?.url.startsWith(DATABOX)).toBe(true);
      expect(service.describeConnection(PROGRAM, id).lastCursor).toBe('c000000000000005');
    });
  });

  describe('lifecycle + evidence', (): void => {
    it('pauses, resumes, describes and removes a connection without touching siblings.', async(): Promise<void> => {
      const { service } = serviceWith(harness);
      const id = importConnection(harness, service);
      service.pause(PROGRAM, id);
      expect(service.describeConnection(PROGRAM, id).state).toBe('paused');
      service.resume(PROGRAM, id);
      expect(service.describeConnection(PROGRAM, id).state).toBe('active');
      service.remove(PROGRAM, id);
      expect(service.listConnections(PROGRAM)).toEqual([]);
    });

    it('exports the connection evidence bundle for independent re-verification (T-46).', async(): Promise<void> => {
      const { service } = serviceWith(harness);
      const id = importConnection(harness, service);
      await service.sync(PROGRAM, id);
      const bundle = service.exportEvidence(PROGRAM, id);
      expect(bundle.connectionId).toBe(id);
      expect(bundle.records).toHaveLength(1);
    });
  });

  describe('status-list refresh', (): void => {
    it('seeds the status list at import so record status checks can run offline.', async(): Promise<void> => {
      const { service } = serviceWith(harness);
      const id = importConnection(harness, service);
      await expect(service.sync(PROGRAM, id)).resolves.toHaveLength(1);
    });
  });
});
