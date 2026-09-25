import { BadRequestHttpError } from '../../util/errors/BadRequestHttpError';
import { InternalServerError } from '../../util/errors/InternalServerError';
import type { CreatedDnsRecord, PersonalDnsClient, ProvisionedTunnel } from './PersonalHostingApi';
import type { PersonalDnsRecord, PersonalTunnelIngressRule } from './PersonalHostingConfig';
import type { RemoteFetcher } from './RemoteConsumeClient';

/**
 * The cooperative-fallback DNS/tunnel client (CIV-A05; ADR-0027 fallback path): for a person
 * without their own domain or Cloudflare account, a cooperative zone operator issues a
 * delegated name — `member.members.<coop-zone>` — through the coop's issuance API.
 *
 * The client implements the same {@link PersonalDnsClient} contract the Cloudflare-backed
 * apply path uses, so `applyPersonalHosting` drives either provider unchanged. The member
 * authenticates with a coop-issued member token (Bearer) — never the coop's Cloudflare
 * credentials; tunnel provisioning is done by the coop inside ITS account and the member
 * receives only the scoped tunnel token.
 *
 * The coop-side serving of this contract is the coop-server half of CIV-A08; this client is
 * the member-side contract, fail-closed on missing tokens and non-2xx/malformed responses.
 */
export class CooperativeDnsClient implements PersonalDnsClient {
  private readonly apiBase: string;
  private readonly memberToken: string;

  public constructor(
    coopApiBase: string,
    memberToken: string,
    private readonly fetcher: RemoteFetcher = defaultFetcher,
  ) {
    if (typeof coopApiBase !== 'string' || coopApiBase.trim().length === 0) {
      throw new BadRequestHttpError('A cooperative DNS client needs the coop API base URL.');
    }
    if (typeof memberToken !== 'string' || memberToken.trim().length === 0) {
      throw new BadRequestHttpError('A cooperative DNS client needs a member token (fail closed).');
    }
    this.apiBase = trimSlash(coopApiBase.trim());
    this.memberToken = memberToken;
  }

  /** Resolve a coop zone (e.g. `members.coop.example`) to its opaque zone id. */
  public getZoneId = async(zone: string): Promise<string> => {
    const body = await this.call(`${this.apiBase}/zones/${encodeURIComponent(zone)}`, 'GET');
    const zoneId = (body as { zoneId?: unknown }).zoneId;
    if (typeof zoneId !== 'string' || zoneId.length === 0) {
      throw new InternalServerError(`Cooperative API returned no zoneId for ${zone}.`);
    }
    return zoneId;
  };

  /** Create (idempotently) the member's delegated records inside the coop zone. */
  public createDnsRecords = async(
    zoneId: string,
    records: readonly PersonalDnsRecord[],
  ): Promise<CreatedDnsRecord[]> => {
    const out: CreatedDnsRecord[] = [];
    for (const record of records) {
      const body = await this.call(
        `${this.apiBase}/zones/${encodeURIComponent(zoneId)}/records`,
        'POST',
        record,
      );
      const created = body as { id?: unknown; alreadyExisted?: unknown };
      out.push({
        name: record.name,
        id: typeof created.id === 'string' ? created.id : record.name,
        alreadyExisted: created.alreadyExisted === true,
      });
    }
    return out;
  };

  /**
   * Provision a tunnel in the COOP's account on the member's behalf. `accountId` is the
   * coop's opaque account reference resolved by {@link getAccountId}; `tunnelName` is the
   * member's requested name (the coop may prefix/scope it).
   */
  public createTunnel = async(accountId: string, tunnelName: string): Promise<ProvisionedTunnel> => {
    const body = await this.call(`${this.apiBase}/tunnels`, 'POST', { accountId, name: tunnelName });
    const tunnel = body as { tunnelId?: unknown; tunnelToken?: unknown };
    if (typeof tunnel.tunnelId !== 'string' || typeof tunnel.tunnelToken !== 'string') {
      throw new InternalServerError('Cooperative API returned a malformed tunnel provisioning result.');
    }
    return { tunnelId: tunnel.tunnelId, tunnelToken: tunnel.tunnelToken };
  };

  /** Set the member tunnel's ingress (the single-hostname personal rule set). */
  public setTunnelIngress = async(
    accountId: string,
    tunnelId: string,
    rules: PersonalTunnelIngressRule[],
  ): Promise<void> => {
    await this.call(
      `${this.apiBase}/tunnels/${encodeURIComponent(tunnelId)}/ingress`,
      'PUT',
      { accountId, ingress: rules },
    );
  };

  /** The coop zone's opaque account reference — the member never sees coop credentials. */
  public getAccountId = async(zoneId: string): Promise<string> => {
    const body = await this.call(
      `${this.apiBase}/zones/${encodeURIComponent(zoneId)}/account`,
      'GET',
    );
    const accountId = (body as { accountId?: unknown }).accountId;
    if (typeof accountId !== 'string' || accountId.length === 0) {
      throw new InternalServerError(`Cooperative API returned no accountId for ${zoneId}.`);
    }
    return accountId;
  };

  private async call(url: string, method: string, body?: unknown): Promise<unknown> {
    let response: Awaited<ReturnType<RemoteFetcher>>;
    try {
      response = await this.fetcher(url, {
        method,
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
          authorization: `Bearer ${this.memberToken}`,
        },
        ...body === undefined ? {} : { body: JSON.stringify(body) },
      });
    } catch (error: unknown) {
      throw new InternalServerError(`Cooperative API call to ${url} failed: ${String(error)}`);
    }
    if (!response.ok) {
      throw new BadRequestHttpError(`Cooperative API call to ${url} returned ${response.status}.`);
    }
    return response.json();
  }
}

async function defaultFetcher(
  url: string,
  init?: Parameters<RemoteFetcher>[1],
): ReturnType<RemoteFetcher> {
  const response = await fetch(url, init);
  return { ok: response.ok, status: response.status, json: async(): Promise<unknown> => response.json() };
}

function trimSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}
