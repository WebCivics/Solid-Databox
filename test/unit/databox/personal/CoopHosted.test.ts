import type { HttpRequest } from '../../../../src/server/HttpRequest';
import type { HttpHandlerInput } from '../../../../src/server/HttpHandler';
import { CoopMemberHttpHandler } from '../../../../src/databox/personal/CoopMemberHttpHandler';
import type {
  MemberAuthenticator,
  MemberBackupStore,
} from '../../../../src/databox/personal/CoopMemberHttpHandler';
import { CooperativeMemberClient } from '../../../../src/databox/personal/CooperativeMemberClient';
import { generateOwnerKeyPair } from '../../../../src/databox/personal/OwnerKeyBackup';
import type { RemoteFetcher } from '../../../../src/databox/personal/RemoteConsumeClient';

function request(method: string, url: string, token?: string, body?: unknown): HttpRequest {
  const stream = (async function* (): AsyncGenerator<Buffer> {
    if (body !== undefined) {
      yield Buffer.from(JSON.stringify(body));
    }
  })();
  return Object.assign(stream, {
    method,
    url,
    headers: {
      'content-type': 'application/json',
      ...token === undefined ? {} : { authorization: `Bearer ${token}` },
    },
  }) as unknown as HttpRequest;
}

function responseStub(): HttpHandlerInput['response'] & { body: string } {
  const stub = {
    statusCode: 0,
    headers: {} as Record<string, string>,
    body: '',
    setHeader(name: string, value: string): void {
      this.headers[name.toLowerCase()] = value;
    },
    end(payload?: string): void {
      this.body = payload ?? '';
    },
  };
  return stub as unknown as HttpHandlerInput['response'] & { body: string };
}

const authenticator: MemberAuthenticator = {
  authenticate: async(token): Promise<string | undefined> =>
    token === 'member-tok' ? 'member-1' : undefined,
};

const backups = new Map<string, unknown>();
const backupStore: MemberBackupStore = {
  put: async(memberId, blob): Promise<void> => {
    backups.set(memberId, blob);
  },
  get: async(memberId): Promise<unknown> => backups.get(memberId),
};

const podProvisioner = {
  provisionPod: jest.fn().mockResolvedValue({
    podUrl: 'https://coop.example/pods/member-1/',
    webId: 'https://coop.example/pods/member-1/profile/card#me',
  }),
};

describe('CoopMemberHttpHandler', (): void => {
  let handler: CoopMemberHttpHandler;

  beforeEach((): void => {
    backups.clear();
    podProvisioner.provisionPod.mockClear();
    handler = new CoopMemberHttpHandler(authenticator, podProvisioner, backupStore);
  });

  async function run(req: HttpRequest): Promise<{ status: number; json: unknown }> {
    const response = responseStub();
    await handler.handle({ request: req, response });
    return { status: response.statusCode, json: JSON.parse(response.body || '{}') };
  }

  it('rejects unauthenticated requests with 401.', async(): Promise<void> => {
    const out = await run(request('POST', 'https://coop.example/.databox/coop/members/pod'));
    expect(out.status).toBe(401);
  });

  it('provisions a member pod for the authenticated member only.', async(): Promise<void> => {
    const out = await run(request(
      'POST',
      'https://coop.example/.databox/coop/members/pod',
      'member-tok',
      { memberId: 'member-1', podName: 'me', password: 'hunter2-secret' },
    ));
    expect(out.status).toBe(201);
    expect(podProvisioner.provisionPod).toHaveBeenCalledWith({ podName: 'me', password: 'hunter2-secret' });

    const foreign = await run(request(
      'POST',
      'https://coop.example/.databox/coop/members/pod',
      'member-tok',
      { memberId: 'member-2' },
    ));
    expect(foreign.status).toBe(403);
  });

  it('stores and serves only the member’s own opaque backup blob.', async(): Promise<void> => {
    const put = await run(request(
      'PUT',
      'https://coop.example/.databox/coop/members/member-1/backup',
      'member-tok',
      { v: 1, ct: 'ciphertext' },
    ));
    expect(put.status).toBe(200);

    const foreignPut = await run(request(
      'PUT',
      'https://coop.example/.databox/coop/members/member-2/backup',
      'member-tok',
      {},
    ));
    expect(foreignPut.status).toBe(403);

    const get = await run(request(
      'GET',
      'https://coop.example/.databox/coop/members/member-1/backup',
      'member-tok',
    ));
    expect(get.status).toBe(200);
    expect(get.json).toMatchObject({ v: 1, ct: 'ciphertext' });
  });
});

describe('CooperativeMemberClient', (): void => {
  it('provisions a pod and round-trips an owner-key backup the coop never sees in clear.', async(): Promise<void> => {
    const seenBodies: string[] = [];
    const store = new Map<string, unknown>();
    const fetcher: RemoteFetcher = async(url, init) => {
      if (init?.body !== undefined) {
        seenBodies.push(init.body);
      }
      if (url.endsWith('/members/pod')) {
        return { ok: true, status: 200, json: async(): Promise<unknown> =>
          ({ podUrl: 'https://coop.example/pods/m1/', webId: 'https://coop.example/pods/m1/profile/card#me' }) };
      }
      if (url.endsWith('/backup') && init?.method === 'PUT') {
        store.set('m1', JSON.parse(init.body ?? '{}'));
        return { ok: true, status: 200, json: async(): Promise<unknown> => ({ stored: true }) };
      }
      if (url.endsWith('/backup')) {
        return { ok: true, status: 200, json: async(): Promise<unknown> => store.get('m1') };
      }
      return { ok: false, status: 404, json: async(): Promise<unknown> => ({}) };
    };
    const client = new CooperativeMemberClient('https://coop.example/api', 'member-tok', fetcher);

    const pod = await client.provisionPod('m1');
    expect(pod.webId).toBe('https://coop.example/pods/m1/profile/card#me');
    expect(pod.podUrl).toBe('https://coop.example/pods/m1/');

    const owner = generateOwnerKeyPair();
    const secret = 'my pod export — plaintext the coop must never hold';
    await client.uploadEncryptedBackup('m1', secret, owner.publicKey);

    // The wire payload is ciphertext — the plaintext never transits.
    expect(seenBodies.some(body => body.includes('plaintext the coop must never hold'))).toBe(false);
    expect(store.get('m1')).toMatchObject({ ct: expect.any(String) });

    const restored = await client.restoreBackup('m1', owner.privateKey);
    expect(restored.toString('utf8')).toBe(secret);
  });
});
