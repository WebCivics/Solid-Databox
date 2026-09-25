import { BadRequestHttpError } from '../../util/errors/BadRequestHttpError';

/**
 * Personal Databox hosting plan (CIV-A03) — the person-side counterpart of
 * `ipms/modules/hosting/HostingConfig.planHosting`.
 *
 * Where an organisation plans `databox.`/`devices.`/`www.` hosts, a personal Databox needs
 * exactly ONE hostname: the pod, the WebID and the (CIV-A07) person-facing databox endpoints
 * all live under it. There are no mTLS device hosts and no public site, so the personal
 * record may be proxied where an organisation's devices host must not be.
 *
 * The record/ingress shapes below intentionally mirror the organisation module's
 * `DnsRecord`/`TunnelIngressRule` so the existing `CloudflareApi` client can apply a personal
 * plan unchanged — but they are declared locally so the personal profile carries no IPMS
 * dependency (structural typing gives the compatibility).
 */

/** Operator input for a personal databox hosting plan. */
export interface PersonalHostingInput {
  /** The person's apex domain, e.g. `example.org`. */
  readonly apexDomain: string;
  /** The pod subdomain label (default `pod`), e.g. `pod.example.org`. */
  readonly podLabel?: string;
  /** The origin the DNS record points at: an IPv4, IPv6 or hostname. */
  readonly originTarget: string;
  /** Whether the record goes through the Cloudflare proxy (default `true`). */
  readonly proxied?: boolean;
  /** The origin port the pod listens on (default `3000`). */
  readonly originPort?: number;
}

export type PersonalDnsRecordType = 'A' | 'AAAA' | 'CNAME';

/** Same wire shape as `ipms/modules/hosting/HostingConfig.DnsRecord`. */
export interface PersonalDnsRecord {
  readonly type: PersonalDnsRecordType;
  readonly name: string;
  readonly content: string;
  readonly proxied: boolean;
  /** Cloudflare TTL; `1` means "automatic". */
  readonly ttl: number;
}

/** Same wire shape as `ipms/modules/hosting/CloudflareApi.TunnelIngressRule`. */
export interface PersonalTunnelIngressRule {
  readonly hostname?: string;
  readonly service: string;
}

export interface PersonalHostingPlan {
  readonly podHost: string;
  readonly baseUrl: string;
  readonly dnsRecords: PersonalDnsRecord[];
  readonly tunnelIngress: PersonalTunnelIngressRule[];
  readonly launchCommand: string;
}

const IPV4 = /^\d{1,3}(?:\.\d{1,3}){3}$/u;

function recordType(originTarget: string): PersonalDnsRecordType {
  if (IPV4.test(originTarget)) {
    return 'A';
  }
  return originTarget.includes(':') ? 'AAAA' : 'CNAME';
}

/**
 * Derive the hosting plan — single pod hostname, DNS record, tunnel ingress and launch
 * command — for a personal databox. Pure and deterministic.
 *
 * A Cloudflare Tunnel origin needs no public DNS record at all (the tunnel hostname route
 * IS the resolution), but emitting the record keeps the plan honest for the port-forward
 * path too: the same plan object feeds either A04 delivery mode.
 */
export function planPersonalHosting(input: PersonalHostingInput): PersonalHostingPlan {
  const apex = input.apexDomain.trim();
  const origin = input.originTarget.trim();
  if (apex.length === 0 || !apex.includes('.')) {
    throw new BadRequestHttpError('A personal hosting plan needs an apex domain such as "example.org".');
  }
  if (origin.length === 0) {
    throw new BadRequestHttpError('A personal hosting plan needs an origin target (IP or hostname).');
  }

  const label = input.podLabel ?? 'pod';
  const proxied = input.proxied ?? true;
  const originPort = input.originPort ?? 3000;
  const podHost = `${label}.${apex}`;
  const baseUrl = `https://${podHost}/`;

  return {
    podHost,
    baseUrl,
    dnsRecords: [
      { type: recordType(origin), name: podHost, content: origin, proxied, ttl: 1 },
    ],
    tunnelIngress: [
      { hostname: podHost, service: `http://${origin}:${originPort}` },
      { service: 'http_status:404' },
    ],
    launchCommand:
      `node bin/server.js -c config/databox/personal.json --baseUrl ${baseUrl} -f .data/personal`,
  };
}

/** A DNS label safe to delegate under a cooperative zone (RFC 1035, lower-cased). */
const DNS_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u;

/**
 * The cooperative-fallback plan (CIV-A05): a member's delegated name under the coop zone —
 * `alice.members.coop.example` — reusing the single-hostname personal plan unchanged. The
 * member label is validated as a DNS label (fail closed) and normalised to lowercase so the
 * issued name is stable regardless of input casing.
 */
export function planCoopPersonalHosting(input: {
  /** The member's chosen label, e.g. `alice` → `alice.members.coop.example`. */
  readonly memberLabel: string;
  /** The cooperative's delegated zone, e.g. `members.coop.example`. */
  readonly coopZone: string;
  /** The origin the record points at (same rules as {@link PersonalHostingInput}). */
  readonly originTarget: string;
  /** The origin port the pod listens on (default `3000`). */
  readonly originPort?: number;
}): PersonalHostingPlan {
  const memberLabel = input.memberLabel.trim().toLowerCase();
  if (!DNS_LABEL.test(memberLabel)) {
    throw new BadRequestHttpError(
      `Member label "${input.memberLabel}" is not a valid DNS label (a-z, 0-9, hyphen; ≤63 chars).`,
    );
  }
  return planPersonalHosting({
    apexDomain: input.coopZone,
    podLabel: memberLabel,
    originTarget: input.originTarget,
    // The coop zone is proxy-fronted by the operator — member records always proxied.
    proxied: true,
    originPort: input.originPort,
  });
}

/**
 * Generate a `cloudflared` tunnel configuration YAML for the personal plan — used when the
 * person runs `cloudflared` themselves rather than applying through the API.
 */
export function generatePersonalCloudflaredConfig(plan: PersonalHostingPlan): string {
  const rules = plan.tunnelIngress.map((rule): string => {
    if (rule.hostname === undefined) {
      return `  - service: ${rule.service}`;
    }
    return `  - hostname: ${rule.hostname}\n    service: ${rule.service}`;
  });
  return `tunnel: <tunnel-id>
credentials-file: ~/.cloudflared/<tunnel-id>.json

ingress:
${rules.join('\n')}
`;
}
