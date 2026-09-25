import { HttpPodProvisioner } from '../../../../src/databox/personal/HttpPodProvisioner';
import type { RemoteFetcher } from '../../../../src/databox/personal/RemoteConsumeClient';

const BASE = 'http://localhost:3100';
const ACCOUNT = `${BASE}/.account/`;

/** A scripted account API: index → bootstrap → controls → pod create, with a session cookie. */
function accountApi(): { fetcher: RemoteFetcher; calls: { url: string; method?: string; body?: string }[] } {
  const calls: { url: string; method?: string; body?: string }[] = [];
  const ok = async(body: unknown, cookie?: string): ReturnType<RemoteFetcher> => ({
    ok: true,
    status: 200,
    ...cookie === undefined ? {} : { headers: { get: (n): string | null => n === 'set-cookie' ? cookie : null }},
    json: async(): Promise<unknown> => body,
  });
  const fetcher: RemoteFetcher = async(url, init) => {
    calls.push({ url, method: init?.method, body: init?.body });
    if (url === ACCOUNT && init?.method === 'GET') {
      return ok({ controls: { account: { bootstrap: `${ACCOUNT}bootstrap` }}});
    }
    if (url.endsWith('/bootstrap')) {
      return ok(
        { controls: { account: { account: `${ACCOUNT}account`, pod: `${ACCOUNT}pod` }}},
        'session=abc',
      );
    }
    if (url.endsWith('/account')) {
      return ok({ resource: `${ACCOUNT}id/acc-1` });
    }
    if (url.endsWith('/pod')) {
      return ok({ resource: `${BASE}/person/` });
    }
    return { ok: false, status: 404, json: async(): Promise<unknown> => ({}) };
  };
  return { fetcher, calls };
}

describe('HttpPodProvisioner', (): void => {
  it('follows the account-API controls to create the pod and derive the WebID.', async(): Promise<void> => {
    const { fetcher, calls } = accountApi();
    const provisioner = new HttpPodProvisioner(BASE, fetcher);
    const result = await provisioner.provisionPod({ podName: 'person', password: 'hunter2-secret' });

    expect(result.podUrl).toBe(`${BASE}/person/`);
    expect(result.webId).toBe(`${BASE}/person/profile/card#me`);
    expect(calls[0].url).toBe(ACCOUNT);
    expect(calls.some(call => call.url.endsWith('/bootstrap'))).toBe(true);
    expect(calls.some(call => call.url.endsWith('/pod'))).toBe(true);
  });

  it('fails closed when the account API omits the pod control.', async(): Promise<void> => {
    const fetcher: RemoteFetcher = async(url, init) => {
      if (init?.method === 'GET') {
        return { ok: true, status: 200, json: async(): Promise<unknown> =>
          ({ controls: { account: { bootstrap: `${ACCOUNT}bootstrap` }}}) };
      }
      return { ok: true, status: 200, json: async(): Promise<unknown> => ({ controls: { account: {}}}) };
    };
    const provisioner = new HttpPodProvisioner(BASE, fetcher);
    await expect(provisioner.provisionPod({ podName: 'person', password: 'hunter2-secret' }))
      .rejects.toThrow('pod-creation control');
  });

  it('rejects a short password and empty pod name before any network call.', async(): Promise<void> => {
    const fetcher: RemoteFetcher = jest.fn();
    const provisioner = new HttpPodProvisioner(BASE, fetcher);
    await expect(provisioner.provisionPod({ podName: 'person', password: 'short' }))
      .rejects.toThrow('≥6 chars');
    await expect(provisioner.provisionPod({ podName: ' ', password: 'hunter2-secret' }))
      .rejects.toThrow('pod name');
    expect(fetcher).not.toHaveBeenCalled();
  });
});
