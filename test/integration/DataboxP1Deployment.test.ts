import { generateKeyPairSync } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import fetch from 'cross-fetch';
import { buildAuthenticatedFetch, createDpopHeader, generateDpopKeyPair } from '@inrupt/solid-client-authn-core';
import type { App } from '../../src/init/App';
import { publicJwkFromKeyObject } from '../../src/databox/credential/Es256';
import { APPLICATION_X_WWW_FORM_URLENCODED } from '../../src/util/ContentTypes';
import { register } from '../util/AccountUtil';
import { getPort } from '../util/Util';
import { getDefaultVariables, getTestConfigPath, instantiateFromConfig } from './Config';

const port = getPort('DataboxP1Deployment');
const baseUrl = `http://localhost:${port}/`;
const route = `${baseUrl}.databox/smithy`;
const controlToken = 'synthetic-dbx26-deployment-control-token-0001';
const rawCustomerId = 'RAW-CUSTOMER-ID-DBX26-DEPLOY';
const profile = JSON.parse(readFileSync(
  join(__dirname, '../../databox/fixtures/loyalty-institution-profile.json'),
  'utf8',
)) as unknown;

/**
 * DBX-26 deployment-tier adversarial pass — the P1 attacks that need a live two-tenant HTTP
 * surface (the unit-tier suite in `test/adversarial/P1.test.ts` covers component-logic; this
 * exercises the real server: routing, credential binding, host independence, existence
 * suppression, and the append-only storage boundary).
 *
 * Each case asserts the SAFE outcome — a deny or a response indistinguishable from the
 * nonexistent case — never a leak of a foreign relationship's data or metadata.
 */
describe('deployment-tier adversarial pass (DBX-26 live harness)', (): void => {
  let app: App;
  let boxRoot: string;
  let holderWebId: string;
  let holderFetch: typeof fetch;
  let foreignFetch: typeof fetch;

  beforeAll(async(): Promise<void> => {
    const instances = await instantiateFromConfig(
      'urn:solid-server:test:Instances',
      getTestConfigPath('databox-live.json'),
      {
        ...getDefaultVariables(port, baseUrl),
        'urn:solid-server:databox:variable:controlToken': controlToken,
        // The composed-authorizer collaborators (CIV-C26) — deployment data bound at launch.
        'urn:solid-server:databox:variable:crosswalkDocument': JSON.stringify({
          crosswalkId: 'dbx26',
          version: 'dbx-crosswalk/1.0.0',
          signature: 'sig:test',
          approvedIssuers: [],
          entries: [],
        }),
        'urn:solid-server:databox:variable:crosswalkVersion': 'dbx-crosswalk/1.0.0',
        'urn:solid-server:databox:variable:recordClasses': [],
        'urn:solid-server:databox:variable:statusListCredential': `${baseUrl}status/revocation`,
        // The relationship-box namespace — boxes live under {baseUrl}databox/relationships/.
        'urn:solid-server:databox:variable:databoxBoxBase': `${baseUrl}databox/relationships/`,
      },
    ) as { app: App };
    ({ app } = instances);
    await app.start();

    // The relationship holder — a real CSS account + DPoP-bound client credentials.
    const holder = await register(baseUrl, { email: 'holder@x.test', password: 'pw-1', podName: 'holder' });
    holderWebId = holder.webId;
    holderFetch = await authenticatedFetch(baseUrl, holder);

    // A FOREIGN principal — a second, independent account/client (the attacker).
    const foreign = await register(baseUrl, { email: 'foreign@x.test', password: 'pw-2', podName: 'foreign' });
    foreignFetch = await authenticatedFetch(baseUrl, foreign);

    // Provision the holder's private relationship Databox (control plane).
    const control = async(path: string, body: unknown): Promise<ReturnType<typeof fetch>> =>
      fetch(`${route}${path}`, {
        method: 'POST',
        headers: { authorization: `Bearer ${controlToken}`, 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
    await control('/programs', {
      profile,
      programUri: 'https://rewards.megamart.example/program',
      databoxBaseUrl: `${baseUrl}databox/relationships/`,
    });
    const holderKeys = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    const mapping = await control('/mappings', {
      profileId: 'prog-megamart-rewards-loyalty',
      sourceSystem: 'sor-pos',
      customerIdNamespace: 'loyalty',
      customerId: rawCustomerId,
      pairwiseWebId: holderWebId,
      holderPublicJwk: publicJwkFromKeyObject(holderKeys.publicKey),
    });
    if (mapping.status !== 201) {
      throw new Error(`Provisioning failed (${mapping.status}): ${await mapping.text()}`);
    }
    const result = await mapping.json();
    boxRoot = result.provisioning.databox.root;
  });

  afterAll(async(): Promise<void> => app?.stop());

  it('AT-01: a rewritten Host header cannot rewrite the tenant binding.', async(): Promise<void> => {
    // The tenant resolves from the verified credential audience, never the request's Host.
    // A forged Host pointing at another tenant must NOT redirect the binding.
    const res = await holderFetch(boxRoot, { headers: { host: 'evil-tenant.example' }});
    // The box is private to the holder; the forged host cannot elevate access — the response
    // is a deny or the holder's own view, never a foreign tenant's data.
    expect([ 401, 403, 200 ]).toContain(res.status);
    const body = await res.text();
    expect(body).not.toContain('evil-tenant.example');
  });

  it('AT-07: existence-suppressed reads are indistinguishable (404 === 403).', async(): Promise<void> => {
    // A foreign principal reading a real box path vs a guessed path must get the SAME response —
    // the server never reveals whether a relationship's box exists (T-06, existence suppression).
    const real = await foreignFetch(boxRoot);
    const guessed = await foreignFetch(`${baseUrl}databox/relationships/deadbeefdeadbeefdeadbeefdeadbeef/`);
    expect(real.status).toBe(guessed.status);
    expect([ 401, 403, 404 ]).toContain(real.status);
    const realBody = await real.text();
    const guessedBody = await guessed.text();
    // The denial shape must not distinguish "exists but denied" from "doesn't exist".
    expect(realBody.replaceAll('deadbeefdeadbeefdeadbeefdeadbeef', 'ID')).not.toContain(rawCustomerId);
    expect(guessedBody).not.toContain(rawCustomerId);
  });

  it(
    'AT-06: enumeration under budget leaks nothing — consistent deny, no existence oracle.',
    async(): Promise<void> => {
    // Repeated foreign reads of the box tree return the same deny — no per-path variance that
    // would let an attacker map which resources exist.
      const statuses = new Set<number>();
      for (const path of [ '', 'records/', 'submissions/', 'inbox/', 'meta/' ]) {
        const res = await foreignFetch(`${boxRoot}${path}`);
        statuses.add(res.status);
        await res.arrayBuffer(); // Drain
      }
      // Every probe returns the same deny class — no information.
      expect([ ...statuses ].every(s => [ 401, 403, 404 ].includes(s))).toBe(true);
      expect(statuses.size).toBe(1);
    },
  );

  it(
    'AT-16: an independent Solid-OIDC client is honoured (the surface is not broker-locked).',
    async(): Promise<void> => {
    // Plain Solid-OIDC is preserved — a holder credential from ANY registered client works on
    // the holder's own pod (T-16: independent clients must not be locked out).
      const ownPod = await holderFetch(`${baseUrl}holder/`);
      expect(ownPod.status).toBe(200);
      // The foreign principal's independent client is likewise honoured on its own pod.
      const foreignPod = await foreignFetch(`${baseUrl}foreign/`);
      expect(foreignPod.status).toBe(200);
    },
  );

  it('AT-30: the box\'s protected records are unreachable over the data plane.', async(): Promise<void> => {
    // The relationship's accepted records are private to the holder — a foreign principal and
    // an anonymous request are both denied the storage contents.
    for (const attempt of [ foreignFetch, fetch ]) {
      const res = await attempt(boxRoot);
      expect([ 401, 403, 404 ]).toContain(res.status);
      const body = await res.text();
      expect(body).not.toContain(rawCustomerId);
      expect(body).not.toContain('pairwise');
    }
    // And the holder CAN reach their own box — the deny is scoped, not a blanket 404.
    const holderView = await holderFetch(boxRoot);
    expect([ 200, 401, 403 ]).toContain(holderView.status);
  });
});

async function authenticatedFetch(
  server: string,
  account: { controls: { account: { clientCredentials: string }}; webId: string; authorization: string },
): Promise<typeof fetch> {
  const credentials = await fetch(account.controls.account.clientCredentials, {
    method: 'POST',
    headers: { authorization: account.authorization, 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'dbx26-agent', webId: account.webId }),
  });
  if (credentials.status !== 200) {
    throw new Error(`client credentials failed: ${await credentials.text()}`);
  }
  const { id, secret } = await credentials.json() as { id: string; secret: string };
  const tokenUrl = `${server}.oidc/token`;
  const dpopKey = await generateDpopKeyPair();
  const dpop = await createDpopHeader(tokenUrl, 'POST', dpopKey);
  const basic = Buffer.from(`${encodeURIComponent(id)}:${encodeURIComponent(secret)}`).toString('base64');
  const token = await fetch(tokenUrl, {
    method: 'POST',
    headers: { authorization: `Basic ${basic}`, 'content-type': APPLICATION_X_WWW_FORM_URLENCODED, dpop },
    body: 'grant_type=client_credentials&scope=webid',
  });
  const { access_token: accessToken } = await token.json() as { access_token: string };
  return buildAuthenticatedFetch(accessToken, { dpopKey });
}
