import { CooperativeDnsClient } from '../../../../src/databox/personal/CooperativeDnsClient';
import { planCoopPersonalHosting } from '../../../../src/databox/personal/PersonalHostingConfig';
import { applyPersonalHosting } from '../../../../src/databox/personal/PersonalHostingApi';
import type { RemoteFetcher } from '../../../../src/databox/personal/RemoteConsumeClient';

const COOP_API = 'https://coop.example/api/dns';
const COOP_ZONE = 'members.coop.example';

type FetcherCalls = { url: string; method?: string }[];

function fetcherScript(routes: Record<string, unknown>): { fetcher: RemoteFetcher; calls: FetcherCalls } {
  const calls: FetcherCalls = [];
  const fetcher: RemoteFetcher = async(url, init) => {
    calls.push({ url, method: init?.method });
    const key = Object.keys(routes).find(route => url.includes(route));
    if (key === undefined) {
      return { ok: false, status: 404, json: async(): Promise<unknown> => ({}) };
    }
    return { ok: true, status: 200, json: async(): Promise<unknown> => routes[key] };
  };
  return { fetcher, calls };
}

describe('CooperativeDnsClient', (): void => {
  it('fails closed without a coop API base or member token.', (): void => {
    expect((): unknown => new CooperativeDnsClient('', 'tok')).toThrow('coop API base');
    expect((): unknown => new CooperativeDnsClient(COOP_API, '')).toThrow('member token');
  });

  it('resolves a zone id, creates records, provisions and configures a tunnel.', async(): Promise<void> => {
    const { fetcher, calls } = fetcherScript({
      [`zones/${COOP_ZONE}`]: { zoneId: 'zone-1' },
      records: { id: 'rec-1' },
      tunnels: { tunnelId: 'tun-1', tunnelToken: 'tok-1' },
      ingress: {},
      account: { accountId: 'acct-1' },
    });
    const client = new CooperativeDnsClient(COOP_API, 'member-tok', fetcher);

    const zoneId = await client.getZoneId(COOP_ZONE);
    expect(zoneId).toBe('zone-1');

    const records = await client.createDnsRecords(zoneId, [
      { type: 'CNAME', name: 'alice.members.coop.example', content: 'origin.example', proxied: true, ttl: 1 },
    ]);
    expect(records[0].name).toBe('alice.members.coop.example');

    const tunnel = await client.createTunnel('acct-1', 'alice-pod');
    expect(tunnel.tunnelId).toBe('tun-1');
    await client.setTunnelIngress('acct-1', 'tun-1', [{ service: 'http_status:404' }]);

    expect(calls.some(call => call.url.includes('/tunnels/tun-1/ingress'))).toBe(true);
  });

  it('sends the member token as a Bearer credential — never coop provider credentials.', async(): Promise<void> => {
    let seenAuth = '';
    const fetcher: RemoteFetcher = async(url, init) => {
      seenAuth = init?.headers?.authorization ?? '';
      return { ok: true, status: 200, json: async(): Promise<unknown> => ({ zoneId: 'z' }) };
    };
    const client = new CooperativeDnsClient(COOP_API, 'member-secret', fetcher);
    await client.getZoneId(COOP_ZONE);
    expect(seenAuth).toBe('Bearer member-secret');
  });

  it('fails closed on a non-2xx or malformed response.', async(): Promise<void> => {
    const { fetcher } = fetcherScript({ [`zones/${COOP_ZONE}`]: { noZoneId: true }});
    const client = new CooperativeDnsClient(COOP_API, 'tok', fetcher);
    await expect(client.getZoneId(COOP_ZONE)).rejects.toThrow('no zoneId');

    const dead = new CooperativeDnsClient(COOP_API, 'tok', async(): ReturnType<RemoteFetcher> => {
      throw new Error('refused');
    });
    await expect(dead.getZoneId(COOP_ZONE)).rejects.toThrow('failed');
  });
});

describe('planCoopPersonalHosting', (): void => {
  it('delegates member.label under the coop zone — alice.members.coop.example.', (): void => {
    const plan = planCoopPersonalHosting({
      memberLabel: 'Alice',
      coopZone: COOP_ZONE,
      originTarget: 'tunnel.example',
    });
    expect(plan.podHost).toBe('alice.members.coop.example');
    expect(plan.baseUrl).toBe('https://alice.members.coop.example/');
    expect(plan.dnsRecords[0].name).toBe('alice.members.coop.example');
    expect(plan.dnsRecords[0].proxied).toBe(true);
  });

  it('fails closed on a non-DNS member label.', (): void => {
    expect((): unknown => planCoopPersonalHosting({
      memberLabel: 'alice.pod',
      coopZone: COOP_ZONE,
      originTarget: 'x',
    })).toThrow('not a valid DNS label');
    expect((): unknown => planCoopPersonalHosting({
      memberLabel: '-alice-',
      coopZone: COOP_ZONE,
      originTarget: 'x',
    })).toThrow('not a valid DNS label');
  });
});

describe('applyPersonalHosting via the cooperative client', (): void => {
  it('drives the full apply path with no Cloudflare account on the member side.', async(): Promise<void> => {
    const { fetcher, calls } = fetcherScript({
      [`zones/${COOP_ZONE}`]: { zoneId: 'zone-1' },
      records: { id: 'rec-1' },
      tunnels: { tunnelId: 'tun-1', tunnelToken: 'tok-1' },
      ingress: {},
      account: { accountId: 'acct-1' },
    });
    const client = new CooperativeDnsClient(COOP_API, 'member-tok', fetcher);
    const plan = planCoopPersonalHosting({
      memberLabel: 'alice',
      coopZone: COOP_ZONE,
      originTarget: '127.0.0.1',
    });
    const result = await applyPersonalHosting(client, plan, COOP_ZONE);
    expect(result.zoneId).toBe('zone-1');
    expect(result.tunnel?.tunnelToken).toBe('tok-1');
    expect(result.artifacts.env.CLOUDFLARE_TUNNEL_TOKEN).toBe('tok-1');
    expect(calls.some(call => call.url.includes('/account'))).toBe(true);
  });
});
