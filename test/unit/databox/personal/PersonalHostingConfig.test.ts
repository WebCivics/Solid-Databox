import {
  generatePersonalCloudflaredConfig,
  planPersonalHosting,
} from '../../../../src/databox/personal/PersonalHostingConfig';

describe('planPersonalHosting', (): void => {
  it('derives a single pod host, baseUrl and an A record from an IPv4 origin.', (): void => {
    const plan = planPersonalHosting({ apexDomain: 'example.org', originTarget: '203.0.113.7' });
    expect(plan.podHost).toBe('pod.example.org');
    expect(plan.baseUrl).toBe('https://pod.example.org/');
    expect(plan.launchCommand).toContain('config/databox/personal.json');
    expect(plan.launchCommand).toContain('--baseUrl https://pod.example.org/');
    expect(plan.dnsRecords).toEqual([
      { type: 'A', name: 'pod.example.org', content: '203.0.113.7', proxied: true, ttl: 1 },
    ]);
  });

  it('emits exactly one DNS record — no devices or www hosts.', (): void => {
    const plan = planPersonalHosting({ apexDomain: 'example.org', originTarget: '203.0.113.7' });
    expect(plan.dnsRecords).toHaveLength(1);
    expect(plan.dnsRecords[0].name).not.toContain('devices');
    expect(plan.dnsRecords[0].name).not.toContain('www');
  });

  it('builds single-hostname tunnel ingress ending in the 404 catch-all.', (): void => {
    const plan = planPersonalHosting({
      apexDomain: 'example.org',
      originTarget: '192.168.1.20',
      originPort: 3100,
    });
    expect(plan.tunnelIngress).toEqual([
      { hostname: 'pod.example.org', service: 'http://192.168.1.20:3100' },
      { service: 'http_status:404' },
    ]);
  });

  it('honours a custom pod label and a disabled proxy.', (): void => {
    const plan = planPersonalHosting({
      apexDomain: 'example.org',
      podLabel: 'me',
      originTarget: '203.0.113.7',
      proxied: false,
    });
    expect(plan.podHost).toBe('me.example.org');
    expect(plan.dnsRecords[0].proxied).toBe(false);
  });

  it('uses an AAAA record for an IPv6 origin and a CNAME for a hostname.', (): void => {
    expect(planPersonalHosting({ apexDomain: 'example.org', originTarget: '2001:db8::1' })
      .dnsRecords[0].type).toBe('AAAA');
    expect(planPersonalHosting({ apexDomain: 'example.org', originTarget: 'host.example.net' })
      .dnsRecords[0].type).toBe('CNAME');
  });

  it('rejects an invalid apex domain or an empty origin.', (): void => {
    expect((): unknown => planPersonalHosting({ apexDomain: 'example', originTarget: '203.0.113.7' }))
      .toThrow('apex domain');
    expect((): unknown => planPersonalHosting({ apexDomain: '  ', originTarget: '203.0.113.7' }))
      .toThrow('apex domain');
    expect((): unknown => planPersonalHosting({ apexDomain: 'example.org', originTarget: '   ' }))
      .toThrow('origin target');
  });

  it('produces cloudflared YAML with the single pod hostname and catch-all.', (): void => {
    const plan = planPersonalHosting({ apexDomain: 'example.org', originTarget: '192.168.1.20' });
    const yaml = generatePersonalCloudflaredConfig(plan);
    expect(yaml).toContain('hostname: pod.example.org');
    expect(yaml).toContain('service: http://192.168.1.20:3000');
    expect(yaml).toContain('service: http_status:404');
  });
});
