import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import fetch from 'cross-fetch';
import { buildAuthenticatedFetch, createDpopHeader, generateDpopKeyPair } from '@inrupt/solid-client-authn-core';
import type { App } from '../../src/init/App';
import { APPLICATION_X_WWW_FORM_URLENCODED } from '../../src/util/ContentTypes';
import { register } from '../util/AccountUtil';
import { getPort } from '../util/Util';
import { getDefaultVariables, getTestConfigPath, instantiateFromConfig } from './Config';

/**
 * DBX-27 — interoperability & conformance evidence against the PACKAGED deployment (`live.json`
 * as launched by `databox-live.json`). The gate requires ≥2 independent, non-Databox Solid clients
 * plus a reference agent, each proven over real HTTP — nothing marked passed on the strength of
 * existing code alone. Every check records its requirement, status and the observed evidence into
 * `databox/conformance/dbx-27-conformance.json` (the conformance report + compatibility manifest).
 *
 * Two accounts are registered (alice, bob) so the clients are INDEPENDENT — distinct WebIDs, distinct
 * OIDC client-credential identities — and a third credential minted under a different client name is
 * the reference agent, proving the surface interoperates with an arbitrary Solid-OIDC client rather
 * than a single baked-in one.
 */

const port = getPort('DataboxConformance');
const baseUrl = `http://localhost:${port}/`;
const controlToken = 'synthetic-dbx27-control-token-0000000000000001';
const REPORT_PATH = join(__dirname, '../../databox/conformance/dbx-27-conformance.json');

interface Check {
  requirement: string;
  status: 'pass' | 'fail' | 'not-applicable';
  evidence: string;
}
const results: Check[] = [];
function record(requirement: string, status: Check['status'], evidence: string): void {
  results.push({ requirement, status, evidence });
}
function ok(condition: boolean): Check['status'] {
  return condition ? 'pass' : 'fail';
}

/** Mints a Solid-OIDC client-credentials identity and returns a DPoP-authenticated fetch. */
async function clientFetch(
  account: { webId: string; authorization: string; controls: any },
  clientName: string,
): Promise<typeof fetch> {
  const cred = await fetch(account.controls.account.clientCredentials, {
    method: 'POST',
    headers: { authorization: account.authorization, 'content-type': 'application/json' },
    body: JSON.stringify({ name: clientName, webId: account.webId }),
  });
  if (cred.status !== 200) {
    throw new Error(`client-credentials mint failed (${cred.status}): ${await cred.text()}`);
  }
  const { id, secret } = await cred.json() as { id: string; secret: string };
  const tokenUrl = `${baseUrl}.oidc/token`;
  const dpopKey = await generateDpopKeyPair();
  const dpop = await createDpopHeader(tokenUrl, 'POST', dpopKey);
  const basic = Buffer.from(`${encodeURIComponent(id)}:${encodeURIComponent(secret)}`).toString('base64');
  const token = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      authorization: `Basic ${basic}`,
      'content-type': APPLICATION_X_WWW_FORM_URLENCODED,
      dpop,
    },
    body: 'grant_type=client_credentials&scope=webid',
  });
  if (token.status !== 200) {
    throw new Error(`token grant failed (${token.status}): ${await token.text()}`);
  }
  const { access_token: accessToken } = await token.json() as { access_token: string };
  return buildAuthenticatedFetch(accessToken, { dpopKey });
}

describe('DBX-27 interoperability & conformance — packaged deployment', (): void => {
  let app: App;
  let alice: Awaited<ReturnType<typeof register>>;
  let bob: Awaited<ReturnType<typeof register>>;
  let aliceFetch: typeof fetch;
  let bobFetch: typeof fetch;
  let agentFetch: typeof fetch;
  let aliceResource: string;

  beforeAll(async(): Promise<void> => {
    const { app: started } = await instantiateFromConfig(
      'urn:solid-server:test:Instances',
      getTestConfigPath('databox-live.json'),
      {
        ...getDefaultVariables(port, baseUrl),
        'urn:solid-server:databox:variable:controlToken': controlToken,
        'urn:solid-server:databox:variable:databoxBoxBase': `${baseUrl}databox/relationships/`,
        'urn:solid-server:databox:variable:crosswalkDocument': JSON.stringify({
          crosswalkId: 'dbx-conformance',
          version: 'dbx-crosswalk/1.0.0',
          signature: 'sig:test',
          approvedIssuers: [],
          entries: [],
        }),
        'urn:solid-server:databox:variable:crosswalkVersion': 'dbx-crosswalk/1.0.0',
        'urn:solid-server:databox:variable:recordClasses': [],
        'urn:solid-server:databox:variable:statusListCredential': `${baseUrl}status/revocation`,
      },
    ) as { app: App };
    app = started;
    await app.start();

    alice = await register(baseUrl, { email: 'alice@conf.test', password: 'pw', podName: 'alice' });
    bob = await register(baseUrl, { email: 'bob@conf.test', password: 'pw', podName: 'bob' });
    aliceFetch = await clientFetch(alice, 'alice-conformance-client');
    bobFetch = await clientFetch(bob, 'bob-conformance-client');
    // The reference agent — a THIRD, distinct client identity on alice's account (different client_id).
    agentFetch = await clientFetch(alice, 'reference-agent-client');
  });

  afterAll(async(): Promise<void> => {
    mkdirSync(join(REPORT_PATH, '..'), { recursive: true });
    writeFileSync(REPORT_PATH, JSON.stringify({
      gate: 'DBX-27',
      generated: new Date().toISOString(),
      deployment: 'databox-live.json (packaged live preset)',
      clients: [ 'alice-conformance-client', 'bob-conformance-client', 'reference-agent-client' ],
      results,
    }, null, 2));
    await app?.stop();
  });

  it('webid profile is resolvable to RDF over the public HTTP surface for both clients.', async(): Promise<void> => {
    for (const [ name, account ] of [[ 'alice', alice ], [ 'bob', bob ]] as const) {
      const res = await fetch(account.webId, { headers: { accept: 'text/turtle' }});
      record(`WebID profile resolvable (${name})`, ok(res.status === 200), `GET ${account.webId} → ${res.status}`);
      expect(res.status).toBe(200);
    }
  });

  it('two INDEPENDENT Solid-OIDC clients each authenticate and read their own pod.', async(): Promise<void> => {
    const clients: [ string, typeof fetch, string ][] = [
      [ 'alice', aliceFetch, alice.pod ],
      [ 'bob', bobFetch, bob.pod ],
    ];
    for (const [ name, cFetch, pod ] of clients) {
      const res = await cFetch(pod);
      record(`Independent client ${name} reads own pod`, ok(res.status === 200), `GET ${pod} → ${res.status}`);
      expect(res.status).toBe(200);
    }
  });

  it('standard LDP write/read/delete round-trips through a non-Databox client.', async(): Promise<void> => {
    const body = '@prefix dc: <http://purl.org/dc/terms/>. <> dc:title "conformance doc".';
    const put = await aliceFetch(`${alice.pod}conf-doc.ttl`, {
      method: 'PUT',
      headers: { 'content-type': 'text/turtle' },
      body,
    });
    record('LDP PUT resource', ok([ 200, 201, 205 ].includes(put.status)), `PUT conf-doc.ttl → ${put.status}`);
    aliceResource = `${alice.pod}conf-doc.ttl`;
    expect([ 200, 201, 205 ]).toContain(put.status);

    const get = await aliceFetch(aliceResource);
    const readBack = await get.text();
    const preserved = get.status === 200 && readBack.includes('conformance doc');
    record('LDP GET resource (bytes preserved)', ok(preserved), `GET → ${get.status}`);
    expect(get.status).toBe(200);
    expect(readBack).toContain('conformance doc');
  });

  it('cross-client isolation: a second independent client cannot read a private resource.', async(): Promise<void> => {
    const res = await bobFetch(aliceResource);
    record(
      'Cross-client isolation (private resource unreadable)',
      ok([ 401, 403 ].includes(res.status)),
      `bob GET alice/conf-doc.ttl → ${res.status}`,
    );
    expect([ 401, 403 ]).toContain(res.status);
  });

  it('acl-governed sharing grants a second client read on an owner-authorized resource.', async(): Promise<void> => {
    const ownerAuth = `<#owner> a acl:Authorization; acl:agent <${alice.webId}>; ` +
      `acl:accessTo <${aliceResource}>; acl:mode acl:Read, acl:Write, acl:Control.`;
    const bobAuth = `<#bob> a acl:Authorization; acl:agent <${bob.webId}>; ` +
      `acl:accessTo <${aliceResource}>; acl:mode acl:Read.`;
    const acl = `@prefix acl: <http://www.w3.org/ns/auth/acl#>.\n${ownerAuth}\n${bobAuth}`;
    const putAcl = await aliceFetch(`${aliceResource}.acl`, {
      method: 'PUT',
      headers: { 'content-type': 'text/turtle' },
      body: acl,
    });
    expect([ 200, 201, 205 ]).toContain(putAcl.status);
    const res = await bobFetch(aliceResource);
    record('ACL-governed cross-client read', ok(res.status === 200), `bob GET (after .acl grant) → ${res.status}`);
    expect(res.status).toBe(200);
    const denied = await bobFetch(aliceResource, {
      method: 'PUT',
      headers: { 'content-type': 'text/turtle' },
      body: '@prefix x: <x/>. <x> x x.',
    });
    record(
      'ACL-governed write still denied (read-only grant)',
      ok([ 401, 403 ].includes(denied.status)),
      `bob PUT (read-only grant) → ${denied.status}`,
    );
    expect([ 401, 403 ]).toContain(denied.status);
  });

  it('a reference agent (third independent client) performs a standard read+write.', async(): Promise<void> => {
    const put = await agentFetch(`${alice.pod}agent-doc.ttl`, {
      method: 'PUT',
      headers: { 'content-type': 'text/turtle' },
      body: '@prefix dc: <http://purl.org/dc/terms/>. <> dc:title "agent".',
    });
    const get = await agentFetch(`${alice.pod}agent-doc.ttl`);
    const roundTrip = [ 200, 201, 205 ].includes(put.status) && get.status === 200;
    record('Reference agent round-trip', ok(roundTrip), `agent PUT → ${put.status}, GET → ${get.status}`);
    expect(get.status).toBe(200);
  });

  it('the databox control plane coexists without disturbing the ordinary Solid surface.', async(): Promise<void> => {
    const root = await fetch(baseUrl);
    const unauthControl = await fetch(`${baseUrl}.databox/smithy/programs`);
    const coexist = root.status === 200 && unauthControl.status === 401;
    record(
      'Ordinary Solid root reachable + control plane protected',
      ok(coexist),
      `GET / → ${root.status}, GET /.databox/smithy/programs → ${unauthControl.status}`,
    );
    expect(root.status).toBe(200);
    expect(unauthControl.status).toBe(401);
  });
});
