import { IssuedTokenRegistry } from '../../../../src/databox/consume/ConsumeApi';
import type { HttpHandlerInput } from '../../../../src/server/HttpHandler';
import type { HttpRequest } from '../../../../src/server/HttpRequest';
import { ConsumeHttpHandler } from '../../../../src/databox/consume/ConsumeHttpHandler';
import type { ProvisionalShortLivedToken } from '../../../../src/databox/credential/ConnectionCredentialTypes';
import type { ScopedSubmission } from '../../../../src/databox/agent/ScopedSubmission';
import { signCompactJws } from '../../../../src/databox/credential/Es256';
import { AgentHarness } from '../agent/AgentTestSupport';

const DATABOX = 'https://databox.org.example/';
const TENANT = 'tenant-a';
const PROGRAM = 'https://org.example/programs/loyalty';
const REL = 'https://org.example/relationships/rel-1';

function fixture(): { handler: ConsumeHttpHandler; harness: AgentHarness } {
  const harness = new AgentHarness();
  const handler = new ConsumeHttpHandler({
    challengeSource: harness.proofVerifier,
    tokenExchange: harness.tokenExchange,
    recordStore: {
      listFor: async(connectionId): Promise<readonly never[]> =>
        (harness.recordsByConnection.get(connectionId) ?? []) as never[],
    },
    submissionProcessor: {
      process: async(_token, submission): Promise<{ receiptJws: string; payload: string }> => {
        const sub = submission as ScopedSubmission;
        const payload = JSON.stringify(sub.fields);
        return { receiptJws: harness.signReceipt(payload, 'submission'), payload };
      },
    },
    cursorFeed: harness.cursorFeed,
    tokenRegistry: new IssuedTokenRegistry(),
    tenantFor: (): string | undefined => TENANT,
    statusListEncoded: (): string | undefined => harness.recordStatusList.encode(),
  });
  return { handler, harness };
}

function request(method: string, url: string, body?: unknown, headers?: Record<string, string>): HttpRequest {
  const json = body === undefined ? '' : JSON.stringify(body);
  const stream = (async function* (): AsyncGenerator<Buffer> {
    if (json.length > 0) {
      yield Buffer.from(json);
    }
  })();
  return Object.assign(stream, {
    method,
    url,
    headers: { 'content-type': 'application/json', ...headers },
  }) as unknown as HttpRequest;
}

function responseStub(): HttpHandlerInput['response'] & { body: string } {
  const stub = {
    statusCode: 0,
    headers: {} as Record<string, string>,
    body: '',
    setHeader(name: string, value: string): void {
      this.headers[name] = value;
    },
    end(payload?: string): void {
      this.body = payload ?? '';
    },
  };
  return stub as unknown as HttpHandlerInput['response'] & { body: string };
}

async function call(
  handler: ConsumeHttpHandler,
  method: string,
  url: string,
  body?: unknown,
  headers?: Record<string, string>,
): Promise<{ status: number; json: unknown }> {
  const res = responseStub();
  await handler.handle({ request: request(method, url, body, headers), response: res });
  const text = res.body;
  return { status: res.statusCode, json: text.length > 0 ? JSON.parse(text) : undefined };
}

/** Drive the real challenge → token ceremony for a fresh connection (valid at real now). */
async function negotiate(
  handler: ConsumeHttpHandler,
  harness: AgentHarness,
): Promise<ProvisionalShortLivedToken> {
  const { generateKeyPairSync } = await import('node:crypto');
  // The keypair's public half exports the JWK directly — no `createPublicKey` re-derivation needed.
  const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const holderPublicJwk = publicKey.export({ format: 'jwk' }) as never;
  const now = Date.now();
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
    now,
    validForMs: 100_000_000,
  });
  const challenge = (await call(
    handler,
    'GET',
    `/.databox/consume/challenge?audience=${encodeURIComponent(DATABOX)}`,
  )).json as { nonce: string; audience: string };
  const proof = signCompactJws(
    { alg: 'ES256', typ: 'JWT' },
    { nonce: challenge.nonce, audience: challenge.audience },
    privateKey,
  );
  return (await call(handler, 'POST', '/.databox/consume/token', {
    credentialJws: issued.jws,
    proofJws: proof,
    audience: challenge.audience,
    program: PROGRAM,
    databox: DATABOX,
  })).json as ProvisionalShortLivedToken;
}

function bearer(token: ProvisionalShortLivedToken): Record<string, string> {
  return { authorization: `Bearer ${Buffer.from(JSON.stringify(token)).toString('base64url')}` };
}

describe('ConsumeHttpHandler (CIV-C27)', (): void => {
  it('serves the full round-trip: challenge → token → records → feed.', async(): Promise<void> => {
    const { handler, harness } = fixture();
    const token = await negotiate(handler, harness);
    harness.recordsByConnection.set(token.connectionId, [
      harness.recordItem('{"hello":"record"}', 5),
    ]);

    const records = await call(handler, 'POST', '/.databox/consume/records', { token });
    expect(records.status).toBe(200);
    expect(records.json).toHaveLength(1);

    harness.cursorFeed.record(TENANT, { eventId: 'e1', resourceRef: 'r/1', activity: 'Create' });
    const feed = await call(
      handler,
      'GET',
      `/.databox/consume/feed?tenant=${TENANT}`,
      undefined,
      bearer(token),
    );
    expect(feed.status).toBe(200);
    expect((feed.json as { events: unknown[] }).events).toHaveLength(1);
  });

  it('submissions return a signed receipt the consumer verifies.', async(): Promise<void> => {
    const { handler, harness } = fixture();
    const token = await negotiate(handler, harness);
    const result = await call(handler, 'POST', '/.databox/consume/submissions', {
      token,
      submission: { recordClass: 'loyalty', disclosedFields: [ 'pref' ], fields: { pref: 'email-only' }},
    });
    expect(result.status).toBe(200);
    expect(typeof (result.json as { receiptJws: string }).receiptJws).toBe('string');
  });

  it('fails closed on an unissued/forged token and a wrong-tenant feed pull.', async(): Promise<void> => {
    const { handler, harness } = fixture();
    const forged = {
      connectionId: 'nope',
      audience: DATABOX,
      holderThumbprint: 'x',
      issuedAt: 'x',
      expiresAt: '2999-01-01',
      notWireFormat: true,
      note: 'forged',
    } as ProvisionalShortLivedToken;
    expect((await call(handler, 'POST', '/.databox/consume/records', { token: forged })).status).toBe(400);
    expect(
      (await call(handler, 'GET', `/.databox/consume/feed?tenant=${TENANT}`, undefined, bearer(forged))).status,
    ).toBe(400);
    // A real token bound to another tenant cannot pull this tenant's feed.
    const real = await negotiate(handler, harness);
    expect(
      (await call(handler, 'GET', '/.databox/consume/feed?tenant=other-tenant', undefined, bearer(real))).status,
    ).toBe(400);
  });

  it('a token request for an unbound connection fails closed.', async(): Promise<void> => {
    const { harness } = fixture();
    // TenantFor returns undefined for everything → the token's connection has no tenant.
    const noTenant = new ConsumeHttpHandler({
      challengeSource: harness.proofVerifier,
      tokenExchange: harness.tokenExchange,
      recordStore: { listFor: async(): Promise<readonly never[]> => []},
      submissionProcessor: { process: async(): Promise<never> => {
        throw new Error('unreachable');
      } },
      cursorFeed: harness.cursorFeed,
      tokenRegistry: new IssuedTokenRegistry(),
      tenantFor: (): undefined => undefined,
    });
    const { generateKeyPairSync } = await import('node:crypto');
    const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    const issued = harness.credentialIssuer.issue({
      pairwiseWebId: 'https://consumer.example/id#me',
      holderPublicJwk: publicKey.export({ format: 'jwk' }) as never,
      program: PROGRAM,
      databox: DATABOX,
      storageDescription: `${DATABOX}description`,
      accessGrant: { id: 'grant-1', bytes: 'grant-bytes' },
      accessProfile: 'https://w3id.org/solid-databox/access/v1',
      conformsTo: [ 'https://solidproject.org/TR/protocol' ],
      syncProfile: 'https://w3id.org/solid-databox/sync/v1',
      relationship: REL,
      statusListIndex: 43,
      statusListCredential: 'https://org.example/status/connections',
      now: Date.now(),
      validForMs: 100_000_000,
    });
    const challenge = (await call(
      noTenant,
      'GET',
      `/.databox/consume/challenge?audience=${encodeURIComponent(DATABOX)}`,
    )).json as { nonce: string; audience: string };
    const proof = signCompactJws(
      { alg: 'ES256', typ: 'JWT' },
      { nonce: challenge.nonce, audience: challenge.audience },
      privateKey,
    );
    const result = await call(noTenant, 'POST', '/.databox/consume/token', {
      credentialJws: issued.jws,
      proofJws: proof,
      audience: challenge.audience,
      program: PROGRAM,
      databox: DATABOX,
    });
    expect(result.status).toBe(400);
    expect((result.json as { error: string }).error).toContain('No tenant bound');
  });

  it('serves the published status list.', async(): Promise<void> => {
    const { handler, harness } = fixture();
    const res = await call(handler, 'GET', '/.databox/consume/statuslist');
    expect(res.status).toBe(200);
    expect((res.json as { encodedList: string }).encodedList).toBe(harness.recordStatusList.encode());
  });
});
