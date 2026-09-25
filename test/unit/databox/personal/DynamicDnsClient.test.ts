import { DynamicDnsClient } from '../../../../src/databox/personal/DynamicDnsClient';
import type { RemoteFetcher } from '../../../../src/databox/personal/RemoteConsumeClient';

function fetcher(bodies: Record<string, { status?: number; body: unknown }>): {
  fn: RemoteFetcher;
  urls: string[];
} {
  const urls: string[] = [];
  return {
    urls,
    fn: async(url): ReturnType<RemoteFetcher> => {
      urls.push(url);
      const hit = bodies[url];
      return {
        ok: (hit?.status ?? 200) < 400,
        status: hit?.status ?? 200,
        json: async(): Promise<unknown> => hit?.body ?? 'OK',
      };
    },
  };
}

function opts(fetch: RemoteFetcher, extra = {}): ConstructorParameters<typeof DynamicDnsClient>[0] {
  return {
    updateUrlTemplate: 'https://ddns.example/update?domains={hostname}&token={token}&ip={ip}',
    token: 'tok-1',
    zone: 'ddns.example',
    fetcher: fetch,
    ...extra,
  };
}

const aRecord = { type: 'A' as const, name: 'alice.ddns.example', content: '203.0.113.7', proxied: false, ttl: 1 };

describe('DynamicDnsClient — DDNS fallback for the no-domain path (CIV-A05)', (): void => {
  it('updates the provider endpoint with the hostname, token and IP.', async(): Promise<void> => {
    const { fn, urls } = fetcher({});
    const client = new DynamicDnsClient(opts(fn));
    const created = await client.createDnsRecords('ddns.example', [ aRecord ]);
    expect(urls).toEqual([
      'https://ddns.example/update?domains=alice.ddns.example&token=tok-1&ip=203.0.113.7',
    ]);
    expect(created[0].name).toBe('alice.ddns.example');
  });

  it('detects the public IP via the echo endpoint when the record content is "auto".', async(): Promise<void> => {
    const { fn, urls } = fetcher({ 'https://ip.example/': { body: '198.51.100.4' }});
    const client = new DynamicDnsClient(opts(fn, { ipEchoUrl: 'https://ip.example/' }));
    await client.createDnsRecords('z', [{ ...aRecord, content: 'auto' }]);
    expect(urls[0]).toBe('https://ip.example/');
    expect(urls[1]).toContain('ip=198.51.100.4');
  });

  it('rejects a CNAME — dynamic DNS binds IPs, not aliases.', async(): Promise<void> => {
    const client = new DynamicDnsClient(opts(fetcher({}).fn));
    await expect(client.createDnsRecords('z', [{ ...aRecord, type: 'CNAME' }])).rejects.toThrow('CNAME');
  });

  it('fails closed on a provider "KO" body and on a non-2xx update.', async(): Promise<void> => {
    const koUrl = 'https://ddns.example/update?domains=alice.ddns.example&token=tok-1&ip=203.0.113.7';
    await expect(
      new DynamicDnsClient(opts(fetcher({ [koUrl]: { body: 'KO' }}).fn)).createDnsRecords('z', [ aRecord ]),
    ).rejects.toThrow('rejected');
    await expect(
      new DynamicDnsClient(opts(fetcher({ [koUrl]: { status: 500, body: 'x' }}).fn))
        .createDnsRecords('z', [ aRecord ]),
    ).rejects.toThrow('returned 500');
  });

  it('provides no tunnel — direct-IP delivery fails closed.', async(): Promise<void> => {
    const client = new DynamicDnsClient(opts(fetcher({}).fn));
    await expect(client.createTunnel('acct', 't')).rejects.toThrow('no tunnel');
    await expect(client.setTunnelIngress('a', 't', [])).rejects.toThrow('no tunnel ingress');
  });

  it('fails closed on missing config.', (): void => {
    expect((): DynamicDnsClient => new DynamicDnsClient(opts(fetcher({}).fn, { token: '  ' })))
      .toThrow('token');
    expect((): DynamicDnsClient => new DynamicDnsClient(opts(fetcher({}).fn, { updateUrlTemplate: 'x' })))
      .toThrow('updateUrlTemplate');
  });
});
