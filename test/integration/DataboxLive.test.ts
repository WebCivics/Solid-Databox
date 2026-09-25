import { generateKeyPairSync } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import fetch from 'cross-fetch';
import { buildAuthenticatedFetch, createDpopHeader, generateDpopKeyPair } from '@inrupt/solid-client-authn-core';
import type { App } from '../../src/init/App';
import type { ResourceStore } from '../../src/storage/ResourceStore';
import { readableToString } from '../../src/util/StreamUtil';
import { publicJwkFromKeyObject } from '../../src/databox/credential/Es256';
import { APPLICATION_X_WWW_FORM_URLENCODED } from '../../src/util/ContentTypes';
import { register } from '../util/AccountUtil';
import { getPort } from '../util/Util';
import { getDefaultVariables, getTestConfigPath, instantiateFromConfig } from './Config';

const port = getPort('DataboxLive');
const baseUrl = `http://localhost:${port}/`;
const route = `${baseUrl}.databox/smithy`;
const controlToken = 'synthetic-dbx25-control-token-0000000000000001';
const rawCustomerId = 'RAW-CUSTOMER-ID-DBX25';
const profile = JSON.parse(readFileSync(
  join(__dirname, '../../databox/fixtures/loyalty-institution-profile.json'),
  'utf8',
)) as unknown;

describe('live Databox integration in Community Solid Server', (): void => {
  let app: App;
  let store: ResourceStore;
  let acceptedResource: string;
  let databoxRoot: string;
  let holderWebId: string;
  let holderPod: string;
  let holderFetch: typeof fetch;

  beforeAll(async(): Promise<void> => {
    const instances = await instantiateFromConfig(
      'urn:solid-server:test:Instances',
      getTestConfigPath('databox-live.json'),
      {
        ...getDefaultVariables(port, baseUrl),
        'urn:solid-server:databox:variable:controlToken': controlToken,
        // The composed-authorizer collaborators (CIV-C26) — bound at launch.
        'urn:solid-server:databox:variable:databoxBoxBase': `${baseUrl}databox/relationships/`,
        'urn:solid-server:databox:variable:crosswalkDocument': JSON.stringify({
          crosswalkId: 'dbx-live',
          version: 'dbx-crosswalk/1.0.0',
          signature: 'sig:test',
          approvedIssuers: [],
          entries: [],
        }),
        'urn:solid-server:databox:variable:crosswalkVersion': 'dbx-crosswalk/1.0.0',
        'urn:solid-server:databox:variable:recordClasses': [],
        'urn:solid-server:databox:variable:statusListCredential': `${baseUrl}status/revocation`,
      },
    ) as { app: App; store: ResourceStore };
    ({ app, store } = instances);
    await app.start();

    const account = await register(baseUrl, {
      email: 'charles@example.test',
      password: 'synthetic-password',
      podName: 'charles',
    });
    holderWebId = account.webId;
    holderPod = account.pod;
    const credentials = await fetch(account.controls.account.clientCredentials, {
      method: 'POST',
      headers: { authorization: account.authorization, 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'charles-dbx25-agent', webId: holderWebId }),
    });
    if (credentials.status !== 200) {
      throw new Error(`Could not create holder client credentials: ${await credentials.text()}`);
    }
    const { id, secret } = await credentials.json() as { id: string; secret: string };
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
      throw new Error(`Could not obtain holder access token: ${await token.text()}`);
    }
    const { access_token: accessToken } = await token.json() as { access_token: string };
    holderFetch = buildAuthenticatedFetch(accessToken, { dpopKey });
    const ownPod = await holderFetch(holderPod);
    if (ownPod.status !== 200) {
      throw new Error(`Holder authentication check failed (${ownPod.status}): ${await ownPod.text()}`);
    }
  });

  afterAll(async(): Promise<void> => app?.stop());

  async function control(path: string, body?: unknown): Promise<ReturnType<typeof fetch>> {
    return fetch(`${route}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        authorization: `Bearer ${controlToken}`,
        ...body === undefined ? {} : { 'content-type': 'application/json' },
      },
      ...body === undefined ? {} : { body: JSON.stringify(body) },
    });
  }

  it('mounts the control plane without intercepting ordinary Solid routes.', async(): Promise<void> => {
    expect((await fetch(baseUrl)).status).toBe(200);
    const unauthorized = await fetch(`${route}/programs`);
    expect(unauthorized.status).toBe(401);
    expect(unauthorized.headers.get('www-authenticate')).toContain('databox-control');
  });

  it('registers a program and provisions a private relationship Databox in CSS storage.', async(): Promise<void> => {
    const registered = await control('/programs', {
      profile,
      programUri: 'https://rewards.megamart.example/program',
      databoxBaseUrl: `${baseUrl}databox/relationships/`,
    });
    expect(registered.status).toBe(201);

    const holder = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    const mapping = await control('/mappings', {
      profileId: 'prog-megamart-rewards-loyalty',
      sourceSystem: 'sor-pos',
      customerIdNamespace: 'loyalty',
      customerId: rawCustomerId,
      pairwiseWebId: holderWebId,
      holderPublicJwk: publicJwkFromKeyObject(holder.publicKey),
    });
    if (mapping.status !== 201) {
      throw new Error(`Mapping failed (${mapping.status}): ${await mapping.text()}`);
    }
    const result = await mapping.json();
    databoxRoot = result.provisioning.databox.root;
    expect(databoxRoot).toMatch(new RegExp(
      `^${baseUrl.replaceAll('.', '\\.')}databox/relationships/[a-f0-9]{32}/$`,
      'u',
    ));
    expect(JSON.stringify(result)).not.toContain(rawCustomerId);

    // The specific box ACL overrides the intentionally-public demo root.
    expect((await fetch(databoxRoot)).status).toBe(401);
    const acl = await store.getRepresentation({ path: `${databoxRoot}.acl` }, { type: { 'text/turtle': 1 }});
    await expect(readableToString(acl.data)).resolves.toContain(holderWebId);
  });

  it('commits exact accepted bytes into CSS before returning a signed receipt.', async(): Promise<void> => {
    const deposited = await control('/source-events', {
      profileId: 'prog-megamart-rewards-loyalty',
      sourceSystem: 'sor-pos',
      eventType: 'receipt',
      sourceEventId: 'dbx25-event-1',
      customerIdNamespace: 'loyalty',
      customerId: rawCustomerId,
      recordClass: 'rc-receipt',
      legalBasis: 'lb-contract',
      purpose: 'p-account',
      payload: { receiptNumber: 'SYNTHETIC-001', total: '42.00', currency: 'AUD' },
    });
    expect(deposited.status).toBe(202);
    const report = await deposited.json();
    expect(report.status).toBe('reconciled');
    expect(report.receipt.jws).toBeDefined();
    acceptedResource = report.reconciliation.acceptedResource;
    expect(acceptedResource.startsWith(databoxRoot)).toBe(true);
    expect(JSON.stringify(report)).not.toContain(rawCustomerId);

    // The normal Solid HTTP route enforces the provisioned WAC boundary.
    expect((await fetch(acceptedResource)).status).toBe(401);
    const authorized = await holderFetch(acceptedResource);
    if (authorized.status !== 200) {
      throw new Error(`Pairwise holder retrieval failed (${authorized.status}): ${await authorized.text()}`);
    }
    await expect(authorized.text()).resolves.toContain('SYNTHETIC-001');

    // The resource is physically present in CSS and retains the exact institutional JSON bytes.
    const stored = await store.getRepresentation({ path: acceptedResource }, { type: { 'application/ld+json': 1 }});
    const body = await readableToString(stored.data);
    expect(JSON.parse(body)).toEqual(expect.objectContaining({
      recordClass: 'rc-receipt',
      resource: acceptedResource,
      payload: { receiptNumber: 'SYNTHETIC-001', total: '42.00', currency: 'AUD' },
    }));
    expect(body).not.toContain(rawCustomerId);
  });

  it('keeps program discovery on the protected control route.', async(): Promise<void> => {
    const response = await control('/programs');
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([
      expect.objectContaining({ profileId: 'prog-megamart-rewards-loyalty' }),
    ]);
  });
});
