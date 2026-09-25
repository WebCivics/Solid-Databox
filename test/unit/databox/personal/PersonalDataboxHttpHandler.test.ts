import type { CredentialsExtractor } from '../../../../src/authentication/CredentialsExtractor';
import type { Credentials } from '../../../../src/authentication/Credentials';
import type { HttpRequest } from '../../../../src/server/HttpRequest';
import type { HttpHandlerInput } from '../../../../src/server/HttpHandler';
import { PersonalDataboxHttpHandler } from '../../../../src/databox/personal/PersonalDataboxHttpHandler';
import type { PersonalVaultService } from '../../../../src/databox/personal/PersonalVaultService';

const OWNER = 'http://localhost:3100/person/profile/card#me';
const BASE = 'http://localhost:3100/';
const PROGRAM = 'https://org.example/programs/loyalty-a';

function extractor(credentials: Credentials): CredentialsExtractor {
  return { handleSafe: async(): Promise<Credentials> => credentials } as unknown as CredentialsExtractor;
}

function request(method: string, url: string, body?: unknown): HttpRequest {
  const json = body === undefined ? '' : JSON.stringify(body);
  const stream = (async function* (): AsyncGenerator<Buffer> {
    if (json.length > 0) {
      yield Buffer.from(json);
    }
  })();
  return Object.assign(stream, {
    method,
    url,
    headers: { 'content-type': 'application/json' },
  }) as unknown as HttpRequest;
}

function responseStub(): HttpHandlerInput['response'] & { body: string; headers: Record<string, string> } {
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
  return stub as unknown as HttpHandlerInput['response'] & { body: string; headers: Record<string, string> };
}

function serviceStub(): PersonalVaultService {
  return {
    importConnection: jest.fn().mockReturnValue({ connectionId: 'conn-1', holderThumbprint: 'thumb' }),
    listConnections: jest.fn().mockReturnValue([ 'conn-1' ]),
    describeConnection: jest.fn().mockReturnValue({
      connectionId: 'conn-1',
      program: PROGRAM,
      relationship: 'r',
      databox: 'db',
      state: 'active',
      hasToken: false,
    }),
    sync: jest.fn().mockResolvedValue([{}]),
    recover: jest.fn().mockResolvedValue([{}]),
    submit: jest.fn().mockResolvedValue({ submission: {}, receiptVerification: {}}),
    records: jest.fn().mockReturnValue([{ inert: {}}]),
    exportEvidence: jest.fn().mockReturnValue({ connectionId: 'conn-1', records: [], receipts: []}),
    pause: jest.fn(),
    resume: jest.fn(),
    remove: jest.fn(),
    refreshStatusList: jest.fn().mockResolvedValue(undefined),
  } as unknown as PersonalVaultService;
}

class TestHandler extends PersonalDataboxHttpHandler {
  public constructor(stub: PersonalVaultService, creds: Credentials) {
    super(BASE, OWNER, extractor(creds), '{}');
    this.service = stub;
  }
}

async function run(
  handler: PersonalDataboxHttpHandler,
  method: string,
  url: string,
  body?: unknown,
): Promise<{ status: number; json: unknown; headers: Record<string, string> }> {
  const response = responseStub();
  await handler.handle({ request: request(method, url, body), response });
  return { status: response.statusCode, json: JSON.parse(response.body || '{}'), headers: response.headers };
}

describe('PersonalDataboxHttpHandler', (): void => {
  let stub: PersonalVaultService;
  let handler: PersonalDataboxHttpHandler;

  beforeEach((): void => {
    stub = serviceStub();
    handler = new TestHandler(stub, { agent: { webId: OWNER }});
  });

  describe('owner-WebID authentication', (): void => {
    it('rejects unauthenticated requests with 401 and a WebID auth challenge.', async(): Promise<void> => {
      const anon = new TestHandler(stub, {});
      const out = await run(anon, 'GET', `${BASE}.databox/personal/`);
      expect(out.status).toBe(401);
      expect(out.headers['www-authenticate']).toContain('openid webid');
    });

    it('rejects a different WebID with 403.', async(): Promise<void> => {
      const other = new TestHandler(stub, { agent: { webId: 'http://localhost:3100/other/#me' }});
      const out = await run(other, 'GET', `${BASE}.databox/personal/`);
      expect(out.status).toBe(403);
    });

    it('serves the route index to the owner.', async(): Promise<void> => {
      const out = await run(handler, 'GET', `${BASE}.databox/personal/`);
      expect(out.status).toBe(200);
      expect((out.json as { routes: string[] }).routes.length).toBeGreaterThan(0);
    });
  });

  describe('canHandle', (): void => {
    it('accepts only the personal route base.', async(): Promise<void> => {
      await expect(handler.canHandle({
        request: request('GET', `${BASE}.databox/personal/x`),
        response: responseStub(),
      })).resolves.toBeUndefined();
      await expect(handler.canHandle({ request: request('GET', `${BASE}other/`), response: responseStub() }))
        .rejects.toThrow('Not a personal Databox route');
    });
  });

  describe('connection registry endpoints', (): void => {
    it('installs a credential (POST /connections) with a 201 + connectionId.', async(): Promise<void> => {
      const out = await run(handler, 'POST', `${BASE}.databox/personal/connections`, {
        program: PROGRAM,
        credentialJws: 'jws',
        tenantId: 't1',
        verification: {},
      });
      expect(out.status).toBe(201);
      expect((out.json as { connectionId: string }).connectionId).toBe('conn-1');
      expect(stub.importConnection).toHaveBeenCalledWith(
        expect.objectContaining({ program: PROGRAM, tenantId: 't1' }),
      );
    });

    it('lists connections only for the named program — missing program fails closed.', async(): Promise<void> => {
      const out = await run(
        handler,
        'GET',
        `${BASE}.databox/personal/connections?program=${encodeURIComponent(PROGRAM)}`,
      );
      expect(out.status).toBe(200);
      expect((out.json as { connections: string[] }).connections).toEqual([ 'conn-1' ]);

      const noProgram = await run(handler, 'GET', `${BASE}.databox/personal/connections`);
      expect(noProgram.status).toBe(400);
    });

    it('describes, pauses, resumes and removes a connection.', async(): Promise<void> => {
      const p = encodeURIComponent(PROGRAM);
      const describe = await run(handler, 'GET', `${BASE}.databox/personal/connections/conn-1?program=${p}`);
      expect(describe.status).toBe(200);

      const pause = await run(handler, 'POST', `${BASE}.databox/personal/connections/conn-1/pause?program=${p}`);
      expect(pause.status).toBe(200);
      expect(stub.pause).toHaveBeenCalledWith(PROGRAM, 'conn-1');

      const resume = await run(handler, 'POST', `${BASE}.databox/personal/connections/conn-1/resume?program=${p}`);
      expect(resume.status).toBe(200);
      expect(stub.resume).toHaveBeenCalledWith(PROGRAM, 'conn-1');

      const remove = await run(handler, 'DELETE', `${BASE}.databox/personal/connections/conn-1?program=${p}`);
      expect(remove.status).toBe(200);
      expect(stub.remove).toHaveBeenCalledWith(PROGRAM, 'conn-1');
    });
  });

  describe('sync / recover / evidence / submission', (): void => {
    const p = encodeURIComponent(PROGRAM);

    it('POST /connections/{id}/sync returns the stored count.', async(): Promise<void> => {
      const out = await run(handler, 'POST', `${BASE}.databox/personal/connections/conn-1/sync?program=${p}`);
      expect(out.status).toBe(200);
      expect((out.json as { stored: number }).stored).toBe(1);
    });

    it('POST /connections/{id}/recover returns the recovered count.', async(): Promise<void> => {
      const out = await run(handler, 'POST', `${BASE}.databox/personal/connections/conn-1/recover?program=${p}`);
      expect(out.status).toBe(200);
      expect((out.json as { recovered: number }).recovered).toBe(1);
    });

    it('GET records and evidence export.', async(): Promise<void> => {
      const records = await run(handler, 'GET', `${BASE}.databox/personal/connections/conn-1/records?program=${p}`);
      expect(records.status).toBe(200);
      const evidence = await run(handler, 'GET', `${BASE}.databox/personal/connections/conn-1/evidence?program=${p}`);
      expect(evidence.status).toBe(200);
      expect(stub.exportEvidence).toHaveBeenCalledWith(PROGRAM, 'conn-1');
    });

    it('POST submissions composes the scoped submission.', async(): Promise<void> => {
      const out = await run(handler, 'POST', `${BASE}.databox/personal/connections/conn-1/submissions?program=${p}`, {
        candidate: { a: 1 },
        selectedFields: [ 'a' ],
        meta: {},
      });
      expect(out.status).toBe(200);
      expect(stub.submit).toHaveBeenCalledWith(PROGRAM, 'conn-1', { a: 1 }, [ 'a' ], {});
    });

    it('POST /status-lists/refresh refreshes a named list.', async(): Promise<void> => {
      const out = await run(handler, 'POST', `${BASE}.databox/personal/status-lists/refresh`, {
        url: 'https://org.example/status/records',
      });
      expect(out.status).toBe(200);
      expect(stub.refreshStatusList).toHaveBeenCalledWith('https://org.example/status/records');
    });
  });
});
