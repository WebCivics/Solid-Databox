import { BadRequestHttpError } from '../../util/errors/BadRequestHttpError';
import { InternalServerError } from '../../util/errors/InternalServerError';
import type { CreatedDnsRecord, PersonalDnsClient, ProvisionedTunnel } from './PersonalHostingApi';
import type { PersonalDnsRecord, PersonalTunnelIngressRule } from './PersonalHostingConfig';
import type { RemoteFetcher } from './RemoteConsumeClient';

/**
 * The dynamic-DNS fallback (CIV-A05) — for a person with NO domain and NO Cloudflare account.
 * A dynamic-DNS provider (DuckDNS, FreeDNS/afraid.org, No-IP, or a self-hosted RFC-2136-style
 * zone) maps a free subdomain — `alice.duckdns.org` — to the machine's current public IP via
 * an authenticated HTTP update. This is the *direct-IP* delivery mode of ADR-0027: there is no
 * tunnel — the hostname resolves straight at the pod's own address, so the person needs a
 * routable IP (or a port-forward). Behind CGNAT they fall back to the cooperative path instead.
 *
 * The client is provider-agnostic: it is configured with an update-URL template containing
 * `{hostname}`, `{ip}` and `{token}` placeholders, which covers the tokenised-GET API nearly
 * every DDNS provider exposes. It implements the same {@link PersonalDnsClient} contract as the
 * Cloudflare and cooperative clients so `applyPersonalHosting` drives any of them unchanged.
 *
 * Direct-IP delivery means there IS no tunnel to provision — `createTunnel`/`setTunnelIngress`
 * fail closed (the apply path treats that as non-fatal and falls back to the guided steps).
 */

export interface DynamicDnsOptions {
  /**
   * The provider update endpoint template — e.g.
   * `https://www.duckdns.org/update?domains={hostname}&token={token}&ip={ip}`. `{ip}` may be
   * left to the provider to infer (caller IP) when empty.
   */
  readonly updateUrlTemplate: string;
  /** The provider API token. */
  readonly token: string;
  /** The provider zone the hostnames sit under (e.g. `duckdns.org`). */
  readonly zone: string;
  /** Optional endpoint returning the caller's public IP as text (for explicit-IP updates). */
  readonly ipEchoUrl?: string;
  /** Injected fetch — default real `fetch`. */
  readonly fetcher?: RemoteFetcher;
}

export class DynamicDnsClient implements PersonalDnsClient {
  private readonly fetcher: RemoteFetcher;

  public constructor(private readonly options: DynamicDnsOptions) {
    if (options.updateUrlTemplate.trim().length === 0 || !options.updateUrlTemplate.includes('{hostname}')) {
      throw new BadRequestHttpError('A dynamic-DNS client needs an updateUrlTemplate containing {hostname}.');
    }
    if (options.token.trim().length === 0) {
      throw new BadRequestHttpError('A dynamic-DNS client needs a provider token (fail closed).');
    }
    if (options.zone.trim().length === 0) {
      throw new BadRequestHttpError('A dynamic-DNS client needs the provider zone (e.g. "duckdns.org").');
    }
    this.fetcher = options.fetcher ?? defaultFetcher;
  }

  /**
   * The "zone" for DDNS is fixed by the provider — the configured {@link DynamicDnsOptions.zone}.
   * `apexDomain` is accepted for interface parity; the configured zone is authoritative (the
   * member's hostname is a subdomain under it, e.g. `alice.duckdns.org`).
   */
  public getZoneId = async(_apexDomain: string): Promise<string> => this.options.zone;

  /**
   * Point each A/AAAA record at its content IP via the provider update endpoint. The hostname is
   * the record `name`; the IP is the record `content` (or the caller's detected public IP when
   * `content` is empty/`auto`). CNAME records are unsupported — dynamic DNS binds IPs, not aliases.
   */
  public createDnsRecords = async(
    _zoneId: string,
    records: readonly PersonalDnsRecord[],
  ): Promise<CreatedDnsRecord[]> => {
    const out: CreatedDnsRecord[] = [];
    for (const record of records) {
      if (record.type === 'CNAME') {
        throw new BadRequestHttpError(
          'Dynamic DNS cannot create a CNAME — it binds a hostname to an IP (A/AAAA) only.',
        );
      }
      const ip = await this.resolveIp(record.content);
      const url = this.options.updateUrlTemplate
        .replace('{hostname}', encodeURIComponent(record.name))
        .replace('{token}', encodeURIComponent(this.options.token))
        .replace('{ip}', encodeURIComponent(ip));
      const body = await this.call(url);
      // Many providers answer a bare "OK"/"KO" or a small JSON; a KO/malformed body fails closed.
      if (typeof body === 'string' && body.trim().toUpperCase() === 'KO') {
        throw new InternalServerError(`Dynamic-DNS provider rejected the update for ${record.name}.`);
      }
      out.push({ name: record.name, id: `${record.name}@${ip}`, alreadyExisted: false });
    }
    return out;
  };

  /** Dynamic DNS is direct-IP delivery — there is no tunnel to provision. Fail closed. */
  public createTunnel = async(_accountId: string, _tunnelName: string): Promise<ProvisionedTunnel> => {
    throw new BadRequestHttpError(
      'Dynamic DNS provides no tunnel — it maps the hostname to the pod\'s public IP directly.',
    );
  };

  /** No tunnel ⇒ no ingress to set. Fail closed. */
  public setTunnelIngress = async(
    _accountId: string,
    _tunnelId: string,
    _rules: PersonalTunnelIngressRule[],
  ): Promise<void> => {
    throw new BadRequestHttpError('Dynamic DNS has no tunnel ingress — direct-IP delivery only.');
  };

  /** The IP to publish: the record content, or the caller's detected public IP when `auto`/empty. */
  private async resolveIp(content: string): Promise<string> {
    if (content.trim().length > 0 && content.trim().toLowerCase() !== 'auto') {
      return content.trim();
    }
    if (this.options.ipEchoUrl === undefined) {
      throw new BadRequestHttpError(
        'No origin IP supplied and no ipEchoUrl configured — cannot determine the public IP.',
      );
    }
    const body = await this.call(this.options.ipEchoUrl);
    const ip = String(body).trim();
    if (ip.length === 0) {
      throw new InternalServerError('The public-IP echo endpoint returned an empty address.');
    }
    return ip;
  }

  private async call(url: string): Promise<unknown> {
    let response: Awaited<ReturnType<RemoteFetcher>>;
    try {
      response = await this.fetcher(url, { method: 'GET', headers: { accept: 'text/plain, application/json' }});
    } catch (error: unknown) {
      throw new InternalServerError(`Dynamic-DNS update to ${url} failed: ${String(error)}`);
    }
    if (!response.ok) {
      throw new BadRequestHttpError(`Dynamic-DNS update to ${url} returned ${response.status}.`);
    }
    // The fetcher normalises a plain-text "OK"/IP body and a JSON body to a single value.
    return response.json();
  }
}

async function defaultFetcher(
  url: string,
  init?: Parameters<RemoteFetcher>[1],
): ReturnType<RemoteFetcher> {
  const response = await fetch(url, init);
  return {
    ok: response.ok,
    status: response.status,
    json: async(): Promise<unknown> => {
      const text = await response.text();
      try {
        return JSON.parse(text) as unknown;
      } catch {
        // A plain "OK"/IP string is a valid DDNS response body.
        return text;
      }
    },
  };
}
