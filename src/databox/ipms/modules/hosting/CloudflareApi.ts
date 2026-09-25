import type { DnsRecord, HostingPlan } from './HostingConfig';

/**
 * Cloudflare API client for applying hosting plans.
 * Uses a scoped API token (Zone:DNS:Edit + Account:Tunnel:Edit).
 *
 * @see https://developers.cloudflare.com/api/
 */
export class CloudflareApi {
  private readonly apiToken: string;
  private readonly baseUrl = 'https://api.cloudflare.com/client/v4';

  public constructor(apiToken: string) {
    if (apiToken.length === 0) {
      throw new Error('A Cloudflare API token is required.');
    }
    this.apiToken = apiToken;
  }

  private async request(path: string, init: RequestInit = {}): Promise<unknown> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
        ...(init.headers as Record<string, string>),
      },
    });

    const body = await response.json() as CloudflareResponse;
    if (!response.ok || !body.success) {
      const errors = body.errors?.map(e => e.message).join('; ') ?? `HTTP ${response.status}`;
      throw new Error(`Cloudflare API error: ${errors}`);
    }
    return body.result;
  }

  /**
   * Find the zone ID for an apex domain.
   */
  public async getZoneId(apexDomain: string): Promise<string> {
    const result = await this.request(`/zones?name=${encodeURIComponent(apexDomain)}`) as CloudflareZone[];
    if (result.length === 0) {
      throw new Error(
        `No Cloudflare zone found for "${apexDomain}". Ensure the domain is added to your Cloudflare account.`,
      );
    }
    return result[0].id;
  }

  /**
   * Resolve the account ID that owns a zone — needed before tunnel provisioning.
   */
  public async getAccountId(zoneId: string): Promise<string> {
    const zone = await this.request(`/zones/${zoneId}`) as CloudflareZone;
    return zone.account.id;
  }

  /**
   * Create DNS records for a hosting plan. Skips records that already exist.
   */
  public async createDnsRecords(zoneId: string, records: DnsRecord[]): Promise<CreatedRecord[]> {
    const existing = await this.listDnsRecords(zoneId);
    const created: CreatedRecord[] = [];

    for (const record of records) {
      const duplicate = existing.find(
        r => r.type === record.type && r.name === record.name,
      );
      if (duplicate) {
        created.push({ name: record.name, id: duplicate.id, alreadyExisted: true });
        continue;
      }

      const result = await this.request(`/zones/${zoneId}/dns_records`, {
        method: 'POST',
        body: JSON.stringify({
          type: record.type,
          name: record.name,
          content: record.content,
          ttl: record.ttl,
          proxied: record.proxied,
        }),
      }) as CloudflareDnsRecord;

      created.push({ name: record.name, id: result.id, alreadyExisted: false });
    }
    return created;
  }

  /**
   * List existing DNS records for a zone.
   */
  public async listDnsRecords(zoneId: string): Promise<CloudflareDnsRecord[]> {
    const result = await this.request(`/zones/${zoneId}/dns_records?per_page=100`) as CloudflareDnsRecord[];
    return result;
  }

  /**
   * Create a Cloudflare Tunnel and return the tunnel ID + token.
   */
  public async createTunnel(accountId: string, tunnelName: string): Promise<TunnelResult> {
    const result = await this.request(`/accounts/${accountId}/cfd_tunnel`, {
      method: 'POST',
      body: JSON.stringify({
        name: tunnelName,
        tunnel_secret: generateTunnelSecret(),
      }),
    }) as CloudflareTunnel;

    return {
      tunnelId: result.id,
      tunnelToken: result.tunnel_token,
    };
  }

  /**
   * Create ingress rules for a tunnel — routes databox, www, and devices to the origin.
   */
  public async createTunnelIngress(
    accountId: string,
    tunnelId: string,
    plan: HostingPlan,
    originTarget: string,
    originPort = 3000,
  ): Promise<void> {
    const ingressRules: TunnelIngressRule[] = [
      { hostname: plan.databoxHost, service: `http://${originTarget}:${originPort}` },
    ];
    if (plan.wwwHost) {
      ingressRules.push({ hostname: plan.wwwHost, service: `http://${originTarget}:${originPort}` });
    }
    ingressRules.push({ hostname: plan.devicesHost, service: `http://${originTarget}:${originPort}` });
    ingressRules.push({ service: 'http_status:404' });

    await this.setTunnelIngress(accountId, tunnelId, ingressRules);
  }

  /**
   * Set a tunnel's ingress rules directly — used by the personal hosting path, which plans its
   * own single-hostname rules rather than the organisation's databox/www/devices shape.
   */
  public async setTunnelIngress(
    accountId: string,
    tunnelId: string,
    ingressRules: TunnelIngressRule[],
  ): Promise<void> {
    await this.request(`/accounts/${accountId}/cfd_tunnel/${tunnelId}/configurations`, {
      method: 'PUT',
      body: JSON.stringify({
        config: { ingress: ingressRules },
      }),
    });
  }

  /**
   * Apply a complete hosting plan: find zone, create DNS records, create tunnel + ingress.
   */
  public async applyPlan(plan: HostingPlan, apexDomain: string, originPort = 3000): Promise<ApplyResult> {
    const zoneId = await this.getZoneId(apexDomain);
    const dnsResults = await this.createDnsRecords(zoneId, plan.dnsRecords);

    // Try to create tunnel (requires account ID from zone)
    const zone = await this.request(`/zones/${zoneId}`) as CloudflareZone;
    let tunnel: TunnelResult | undefined;
    try {
      tunnel = await this.createTunnel(zone.account.id, `databox-${apexDomain.replaceAll('.', '-')}`);
      await this.createTunnelIngress(zone.account.id, tunnel.tunnelId, plan, plan.dnsRecords[0].content, originPort);
    } catch {
      // Tunnel creation may fail if token lacks tunnel permissions — non-fatal
      tunnel = undefined;
    }

    return {
      zoneId,
      dnsRecords: dnsResults,
      tunnel,
    };
  }
}

export interface CreatedRecord {
  readonly name: string;
  readonly id: string;
  readonly alreadyExisted: boolean;
}

export interface TunnelResult {
  readonly tunnelId: string;
  readonly tunnelToken: string;
}

export interface ApplyResult {
  readonly zoneId: string;
  readonly dnsRecords: CreatedRecord[];
  readonly tunnel?: TunnelResult;
}

export interface TunnelIngressRule {
  readonly hostname?: string;
  readonly service: string;
}

interface CloudflareResponse {
  success: boolean;
  errors?: { code: number; message: string }[];
  result: unknown;
}

interface CloudflareZone {
  id: string;
  name: string;
  account: { id: string };
}

interface CloudflareDnsRecord {
  id: string;
  type: string;
  name: string;
  content: string;
}

interface CloudflareTunnel {
  id: string;
  tunnel_token: string;
}

function generateTunnelSecret(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString('base64');
}
