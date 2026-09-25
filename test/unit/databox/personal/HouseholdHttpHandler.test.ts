import type { CredentialsExtractor } from '../../../../src/authentication/CredentialsExtractor';
import type { Credentials } from '../../../../src/authentication/Credentials';
import type { HttpHandlerInput } from '../../../../src/server/HttpHandler';
import type { HttpRequest } from '../../../../src/server/HttpRequest';
import { HouseholdHttpHandler } from '../../../../src/databox/personal/household/HouseholdHttpHandler';
import { HouseholdService } from '../../../../src/databox/personal/household/HouseholdService';
import type { HouseholdMember } from '../../../../src/databox/personal/household/HouseholdProfile';
import { familyPolicy } from '../../../../src/databox/personal/household/HouseholdProfile';

const MEMBERS: HouseholdMember[] = [
  { memberId: 'mum', role: 'admin', capacity: 'full', webId: 'https://pod.example/mum#me' },
  { memberId: 'dad', role: 'admin', capacity: 'full', webId: 'https://pod.example/dad#me' },
  { memberId: 'kid', role: 'member', capacity: 'limited', webId: 'https://pod.example/kid#me' },
];
const RESOLVER = 'https://fdr.example/mediator#me';

const MEDICAL_OK = `
@prefix fam: <https://databox.example.org/ns/family#> .
<urn:decision:1> a fam:MajorMedicalConsent ;
  fam:treatment "tonsillectomy" ;
  fam:urgency "elective" ;
  fam:wardAssentRecorded true ;
  fam:alternativesConsidered "watchful waiting" .
`;

function relation(guardianId: string): Record<string, unknown> {
  return {
    wardId: 'kid',
    guardianId,
    kind: 'parent',
    basis: 'statutory',
    scopes: [ 'medical' ],
    households: [ 'house-a' ],
  };
}

/** A CredentialsExtractor stub — returns the caller's WebID from a request header. */
function extractor(): CredentialsExtractor {
  return {
    handleSafe: async(request: HttpRequest): Promise<Credentials> => {
      const webId = request.headers['x-webid'];
      return typeof webId === 'string' ?
          { agent: { webId }} :
          {};
    },
  } as unknown as CredentialsExtractor;
}

function request(method: string, url: string, webId?: string, body?: unknown): HttpRequest {
  const json = body === undefined ? '' : JSON.stringify(body);
  const stream = (async function* (): AsyncGenerator<Buffer> {
    if (json.length > 0) {
      yield Buffer.from(json);
    }
  })();
  return Object.assign(stream, {
    method,
    url,
    headers: { 'content-type': 'application/json', ...webId === undefined ? {} : { 'x-webid': webId }},
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
  handler: HouseholdHttpHandler,
  method: string,
  url: string,
  webId?: string,
  body?: unknown,
): Promise<{ status: number; json: Record<string, unknown> }> {
  const res = responseStub();
  await handler.handle({ request: request(method, url, webId, body), response: res });
  return { status: res.statusCode, json: res.body.length > 0 ? JSON.parse(res.body) : {}};
}

function fixture(): HouseholdHttpHandler {
  return new HouseholdHttpHandler(
    new HouseholdService({ members: MEMBERS, policy: familyPolicy(2) }),
    extractor(),
  );
}

async function withGuardians(handler: HouseholdHttpHandler): Promise<void> {
  await call(handler, 'POST', '/.databox/household/relations', 'https://pod.example/mum#me', relation('mum'));
  await call(handler, 'POST', '/.databox/household/relations', 'https://pod.example/dad#me', relation('dad'));
}

describe('HouseholdHttpHandler (CIV-A14)', (): void => {
  it('401 without credentials, 403 for an unbound WebID.', async(): Promise<void> => {
    const handler = fixture();
    expect((await call(handler, 'GET', '/.databox/household/')).status).toBe(401);
    expect((await call(handler, 'GET', '/.databox/household/', 'https://stranger.example#me')).status).toBe(403);
    expect((await call(handler, 'GET', '/.databox/household/', 'https://pod.example/mum#me')).status).toBe(200);
  });

  it('only an admin may assert a guardian relation.', async(): Promise<void> => {
    const handler = fixture();
    const denied = await call(
      handler,
      'POST',
      '/.databox/household/relations',
      'https://pod.example/kid#me',
      relation('nan'),
    );
    expect(denied.status).toBe(403);
    const added = await call(
      handler,
      'POST',
      '/.databox/household/relations',
      'https://pod.example/mum#me',
      relation('mum'),
    );
    expect(added.status).toBe(201);
    const listed = await call(
      handler,
      'GET',
      '/.databox/household/relations?ward=kid',
      'https://pod.example/mum#me',
    );
    expect((listed.json.relations as unknown[])).toHaveLength(1);
  });

  it('serves the recipe catalog and a recipe\'s SHACL detail.', async(): Promise<void> => {
    const handler = fixture();
    const list = await call(handler, 'GET', '/.databox/household/recipes', 'https://pod.example/mum#me');
    expect((list.json.recipes as unknown[]).length).toBeGreaterThanOrEqual(7);
    const detail = await call(
      handler,
      'GET',
      '/.databox/household/recipes/medical-major',
      'https://pod.example/mum#me',
    );
    expect(detail.json.id).toBe('medical-major');
    expect(typeof detail.json.shaclShape).toBe('string');
    expect((await call(
      handler,
      'GET',
      '/.databox/household/recipes/nope',
      'https://pod.example/mum#me',
    )).status).toBe(404);
  });

  it('runs a ward decision end-to-end — both parents approve, SHACL-valid record stands.', async(): Promise<void> => {
    const handler = fixture();
    await withGuardians(handler);
    const opened = await call(handler, 'POST', '/.databox/household/decisions', 'https://pod.example/mum#me', {
      wardId: 'kid',
      recipeId: 'medical-major',
      scope: 'medical',
      householdId: 'house-a',
      wardPreference: 'kid agrees',
      decisionTurtle: MEDICAL_OK,
    });
    expect(opened.status).toBe(201);
    const requestId = (opened.json as { requestId: string }).requestId;
    // Medical-major is top-tier-all → mum alone leaves it pending; dad completes quorum.
    const afterMum = await call(
      handler,
      'POST',
      `/.databox/household/decisions/${requestId}/decide`,
      'https://pod.example/mum#me',
      { approve: true },
    );
    expect((afterMum.json as { status: string }).status).toBe('pending');
    const afterDad = await call(
      handler,
      'POST',
      `/.databox/household/decisions/${requestId}/decide`,
      'https://pod.example/dad#me',
      { approve: true },
    );
    expect((afterDad.json as { status: string }).status).toBe('approved');
  });

  it('the requester/approver is always the caller — a member cannot act as another.', async(): Promise<void> => {
    const handler = fixture();
    await withGuardians(handler);
    // `kid` opens a decision — they're a member but not a guardian; still, a member may petition.
    // The decider side: a non-approver's vote is refused.
    const opened = await call(handler, 'POST', '/.databox/household/decisions', 'https://pod.example/mum#me', {
      wardId: 'kid',
      recipeId: 'medical-major',
      scope: 'medical',
      householdId: 'house-a',
      wardPreference: 'ok',
      decisionTurtle: MEDICAL_OK,
    });
    const requestId = (opened.json as { requestId: string }).requestId;
    const notApprover = await call(
      handler,
      'POST',
      `/.databox/household/decisions/${requestId}/decide`,
      'https://pod.example/kid#me',
      { approve: true },
    );
    expect(notApprover.status).toBe(403);
  });

  it('disputes: a member opens, the declared resolver (external WebID) determines.', async(): Promise<void> => {
    const handler = fixture();
    await withGuardians(handler);
    const opened = await call(handler, 'POST', '/.databox/household/decisions', 'https://pod.example/mum#me', {
      wardId: 'kid',
      recipeId: 'medical-major',
      scope: 'medical',
      householdId: 'house-a',
      wardPreference: 'ok',
      decisionTurtle: MEDICAL_OK,
    });
    const requestId = (opened.json as { requestId: string }).requestId;
    // A member opens a dispute to an external mediator.
    const dispute = await call(handler, 'POST', `/.databox/household/decisions/${requestId}/dispute`, 'https://pod.example/mum#me', { agentId: RESOLVER, kind: 'mediator', organisation: 'fdr' });
    expect(dispute.status).toBe(201);
    // A party cannot resolve; the declared resolver can.
    const resolveRoute = `/.databox/household/disputes/${requestId}/resolve`;
    const partyDenied = await call(
      handler,
      'POST',
      resolveRoute,
      'https://pod.example/dad#me',
      { determination: 'uphold', rationale: 'x' },
    );
    expect(partyDenied.status).toBe(403);
    const resolved = await call(handler, 'POST', resolveRoute, RESOLVER, {
      determination: 'remit',
      rationale: 'Re-decide with the child present.',
    });
    expect(resolved.status).toBe(200);
    expect((resolved.json as { determination: string }).determination).toBe('remit');
  });

  it('specialist access: an admin asserts a bounded grant; a member may audit.', async(): Promise<void> => {
    const handler = fixture();
    const grant = {
      grantId: 'g1',
      agentId: 'paramedic-77',
      accessClass: 'emergency-medical',
      scopes: [ 'medical' ],
      basis: 'emergency-protocol:ambulance-act-s.17',
      expiresAt: '2099-01-01',
      reviewBy: '2026-06-01',
      notifiedMembers: [ 'dad' ],
    };
    expect((await call(handler, 'POST', '/.databox/household/specialist-access', 'https://pod.example/kid#me', grant)).status).toBe(403); // Non-admin
    const asserted = await call(handler, 'POST', '/.databox/household/specialist-access', 'https://pod.example/mum#me', grant);
    expect(asserted.status).toBe(201);
    expect((asserted.json as { assertedBy: string }).assertedBy).toBe('mum'); // Caller-bound
    const listed = await call(
      handler,
      'GET',
      '/.databox/household/specialist-access',
      'https://pod.example/dad#me',
    );
    expect((listed.json.grants as unknown[])).toHaveLength(1);
    expect((await call(handler, 'POST', '/.databox/household/specialist-access/g1/revoke', 'https://pod.example/dad#me')).status).toBe(200);
  });
});
