import type {
  CreatedDnsRecord,
  PersonalDnsClient,
  ProvisionedTunnel,
} from '../../../../src/databox/personal/PersonalHostingApi';
import { applyPersonalHosting, personalArtifacts } from '../../../../src/databox/personal/PersonalHostingApi';
import { planPersonalHosting } from '../../../../src/databox/personal/PersonalHostingConfig';
import type { CloudflareApi } from '../../../../src/databox/ipms/modules/hosting/CloudflareApi';
import type { DnsRecord } from '../../../../src/databox/ipms/modules/hosting/HostingConfig';

const plan = planPersonalHosting({ apexDomain: 'example.org', originTarget: '192.168.1.20' });

// The personal client contract is satisfied by CloudflareApi via a thin adapter — the record/tunnel
// shapes are wire-identical, but the personal surface takes readonly arrays + its own named types, so a
// mapping (not bare identity) is the honest seam.
const _cloudflareSatisfiesPersonal: (api: CloudflareApi) => PersonalDnsClient =
  api => ({
    getZoneId: api.getZoneId.bind(api),
    getAccountId: api.getAccountId.bind(api),
    createDnsRecords: async(zoneId, records): Promise<CreatedDnsRecord[]> =>
      api.createDnsRecords(zoneId, [ ...records ] as DnsRecord[]),
    createTunnel: async(accountId, tunnelName): Promise<ProvisionedTunnel> =>
      api.createTunnel(accountId, tunnelName),
    setTunnelIngress: async(accountId, tunnelId, rules): Promise<void> =>
      api.setTunnelIngress(accountId, tunnelId, rules),
  });

function fakeClient(overrides: Partial<PersonalDnsClient> = {}): PersonalDnsClient {
  return {
    getZoneId: jest.fn().mockResolvedValue('zone-1'),
    createDnsRecords: jest.fn().mockResolvedValue([
      { name: 'pod.example.org', id: 'rec-1', alreadyExisted: false },
    ]),
    createTunnel: jest.fn().mockResolvedValue({ tunnelId: 'tun-1', tunnelToken: 'tok-abc' }),
    setTunnelIngress: jest.fn().mockResolvedValue(undefined),
    getAccountId: jest.fn().mockResolvedValue('acct-9'),
    ...overrides,
  };
}

describe('applyPersonalHosting', (): void => {
  it('resolves zone, upserts the DNS record, provisions tunnel + ingress.', async(): Promise<void> => {
    const client = fakeClient();
    const result = await applyPersonalHosting(client, plan, 'example.org');

    expect(client.getZoneId).toHaveBeenCalledWith('example.org');
    expect(client.createDnsRecords).toHaveBeenCalledWith('zone-1', plan.dnsRecords);
    expect(client.createTunnel).toHaveBeenCalledWith('acct-9', 'personal-example-org');
    expect(client.setTunnelIngress).toHaveBeenCalledWith('acct-9', 'tun-1', plan.tunnelIngress);
    expect(result.tunnel?.tunnelToken).toBe('tok-abc');
    expect(result.artifacts.env.CLOUDFLARE_TUNNEL_TOKEN).toBe('tok-abc');
    expect(result.artifacts.env.BASE_URL).toBe('https://pod.example.org/');
  });

  it('accepts an explicit account id without a getAccountId call.', async(): Promise<void> => {
    const client = fakeClient();
    await applyPersonalHosting(client, plan, 'example.org', 'acct-direct');
    expect(client.getAccountId).not.toHaveBeenCalled();
    expect(client.createTunnel).toHaveBeenCalledWith('acct-direct', 'personal-example-org');
  });

  it('falls back to guided-manual mode when the tunnel API is denied.', async(): Promise<void> => {
    const client = fakeClient({
      createTunnel: jest.fn().mockRejectedValue(new Error('token lacks Tunnel:Edit')),
    });
    const result = await applyPersonalHosting(client, plan, 'example.org');

    expect(result.tunnel).toBeUndefined();
    expect(result.dnsRecords).toHaveLength(1);
    expect(Object.keys(result.artifacts.env)).not.toContain('CLOUDFLARE_TUNNEL_TOKEN');
    expect(result.artifacts.steps.join(' ')).toContain('cloudflared tunnel login');
  });

  it('falls back to guided-manual mode when no account id can be resolved.', async(): Promise<void> => {
    const client = fakeClient({ getAccountId: undefined });
    const result = await applyPersonalHosting(client, plan, 'example.org');
    expect(result.tunnel).toBeUndefined();
    expect(client.createTunnel).not.toHaveBeenCalled();
  });

  it('propagates a DNS failure — a partial apply never claims success.', async(): Promise<void> => {
    const client = fakeClient({
      createDnsRecords: jest.fn().mockRejectedValue(new Error('zone read-only')),
    });
    await expect(applyPersonalHosting(client, plan, 'example.org'))
      .rejects.toThrow('zone read-only');
  });
});

describe('personalArtifacts', (): void => {
  it('emits the tunnel-token path when a tunnel was provisioned.', (): void => {
    const artifacts = personalArtifacts(plan, { tunnelId: 'tun-1', tunnelToken: 'tok' });
    expect(artifacts.env.CLOUDFLARE_TUNNEL_TOKEN).toBe('tok');
    expect(artifacts.cloudflaredConfig).toContain('hostname: pod.example.org');
    expect(artifacts.steps.some(s => s.includes('tunnel run --token'))).toBe(true);
    expect(artifacts.steps.at(-1)).toContain('https://pod.example.org/');
  });

  it('emits the manual cloudflared.yml path without a tunnel.', (): void => {
    const artifacts = personalArtifacts(plan);
    expect(Object.keys(artifacts.env)).not.toContain('CLOUDFLARE_TUNNEL_TOKEN');
    expect(artifacts.steps.some(s => s.includes('cloudflared tunnel login'))).toBe(true);
    expect(artifacts.steps.at(-1)).toContain('https://pod.example.org/');
  });
});
