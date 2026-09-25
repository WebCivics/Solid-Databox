import { BadRequestHttpError } from '../../util/errors/BadRequestHttpError';

/**
 * SSRF-protected outbound-endpoint validation (component C14; ADR-0011 §4; T-38). This is a NET-NEW control:
 * CSS's `WebhookEmitter` POSTs a client-supplied `sendTo` URL with NO scheme, private-IP or redirect guard
 * (DBX-01 §6), so an attacker who registers a delivery endpoint pointing at an internal, loopback,
 * link-local or cloud-metadata address could make the server reach into its own network (T-38).
 *
 * The validator FAILS CLOSED: only HTTPS is allowed, and the host — whether an IP literal or a resolved
 * DNS name — MUST NOT fall in a private/loopback/link-local/metadata/reserved range. Resolution is done
 * through an INJECTED {@link HostResolver} so the check is fully unit-testable WITHOUT any network call; the
 * outbound channel re-validates after every redirect hop so a redirect cannot smuggle a blocked target in.
 */

/** Resolve a host name to its candidate IP addresses. Injected so validation never touches the network. */
export type HostResolver = (host: string) => Promise<readonly string[]>;

/** Options for {@link SsrfSafeEndpointValidator}. */
export interface EndpointValidatorOptions {
  /** The (injectable) DNS resolver. */
  readonly resolver: HostResolver;
  /** The permitted URL schemes; defaults to HTTPS only (ADR-0011 §4 scheme allowlist). */
  readonly allowedSchemes?: string[];
}

/** Parse a dotted-quad IPv4 literal into its four octets, or `undefined` if it is not one. */
function parseIpv4(host: string): number[] | undefined {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/u.exec(host);
  if (!match) {
    return undefined;
  }
  const octets = match.slice(1).map(Number);
  return octets.some((octet): boolean => octet > 255) ? undefined : octets;
}

/**
 * Whether an IPv4 address is in a blocked (private/loopback/link-local/metadata/reserved) range:
 * 0/8 "this host"; 10/8, 172.16/12, 192.168/16 (RFC1918); 127/8 (loopback); 100.64/10 (CGNAT);
 * 169.254/16 (link-local — INCLUDES cloud metadata 169.254.169.254); 192.0.0/24 (protocol assignments);
 * 198.18/15 (benchmarking, L2); 224/4 multicast + 240/4 reserved.
 */
function isBlockedIpv4(octets: readonly number[]): boolean {
  const [ a, b ] = octets;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && octets[2] === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && b >= 18 && b <= 19) ||
    a >= 224
  );
}

/** Parse one `::`-half of an IPv6 address into its hextets (empty half -> no hextets). */
function parseIpv6Groups(segment: string): number[] | undefined {
  if (segment === '') {
    return [];
  }
  const groups: number[] = [];
  for (const part of segment.split(':')) {
    if (!/^[0-9a-f]{1,4}$/u.test(part)) {
      return undefined;
    }
    groups.push(Number.parseInt(part, 16));
  }
  return groups;
}

/** Expand an IPv6 literal (with optional brackets / embedded IPv4 tail / zone id) to eight hextets. */
function expandIpv6(raw: string): number[] | undefined {
  let host = raw;
  if (host.startsWith('[') && host.endsWith(']')) {
    host = host.slice(1, -1);
  }
  const percent = host.indexOf('%');
  if (percent !== -1) {
    host = host.slice(0, percent);
  }
  if (!host.includes(':')) {
    return undefined;
  }
  // Fold an embedded IPv4 tail (e.g. ::ffff:169.254.169.254) into two hextets before parsing.
  if (host.includes('.')) {
    const colon = host.lastIndexOf(':');
    const v4 = parseIpv4(host.slice(colon + 1));
    if (!v4) {
      return undefined;
    }
    const hi = ((v4[0] << 8) | v4[1]).toString(16);
    const lo = ((v4[2] << 8) | v4[3]).toString(16);
    host = `${host.slice(0, colon + 1)}${hi}:${lo}`;
  }
  const halves = host.split('::');
  if (halves.length > 2) {
    return undefined;
  }
  const head = parseIpv6Groups(halves[0]);
  const tail = halves.length === 2 ? parseIpv6Groups(halves[1]) : [];
  if (!head || !tail) {
    return undefined;
  }
  if (halves.length === 2) {
    const missing = 8 - head.length - tail.length;
    if (missing < 1) {
      return undefined;
    }
    return [ ...head, ...Array.from<number>({ length: missing }).fill(0), ...tail ];
  }
  return head.length === 8 ? head : undefined;
}

/** Whether an IPv6 address is in a blocked range (loopback/link-local/ULA/unspecified/NAT64/embedded-v4). */
function isBlockedIpv6(groups: readonly number[]): boolean {
  const g0 = groups[0];
  // :: unspecified
  if (groups.every((group): boolean => group === 0)) {
    return true;
  }
  // ::1 loopback
  if (groups.slice(0, 7).every((group): boolean => group === 0) && groups[7] === 1) {
    return true;
  }
  // Link-local fe80::/10
  if ((g0 & 0xFFC0) === 0xFE80) {
    return true;
  }
  // Unique-local fc00::/7
  if ((g0 & 0xFE00) === 0xFC00) {
    return true;
  }
  // NAT64 well-known prefix 64:ff9b::/96 (L2) — it can front ANY address; block the whole prefix.
  if (g0 === 0x0064 && groups[1] === 0xFF9B && groups.slice(2, 6).every((group): boolean => group === 0)) {
    return true;
  }
  // IPv4-MAPPED ::ffff:0:0/96 (groups[5]===0xffff) AND IPv4-COMPATIBLE ::/96 (groups[5]===0, L1). Both carry
  // an embedded IPv4 in the low 32 bits — classify by it (blocks ::ffff:169.254.169.254 AND ::127.0.0.1).
  if (groups.slice(0, 5).every((group): boolean => group === 0) && (groups[5] === 0xFFFF || groups[5] === 0)) {
    const a = groups[6] >> 8;
    const b = groups[6] & 0xFF;
    const c = groups[7] >> 8;
    const d = groups[7] & 0xFF;
    return isBlockedIpv4([ a, b, c, d ]);
  }
  return false;
}

/**
 * Classify a host string that MIGHT be an IP literal.
 * - `true`  — it is an IP literal in a blocked range.
 * - `false` — it is an IP literal in a permitted (public) range.
 * - `undefined` — it is not an IP literal (a DNS name that must be resolved).
 */
function classifyIpLiteral(host: string): boolean | undefined {
  const v4 = parseIpv4(host);
  if (v4) {
    return isBlockedIpv4(v4);
  }
  const v6 = expandIpv6(host);
  if (v6) {
    return isBlockedIpv6(v6);
  }
  return undefined;
}

const BLOCKED_MESSAGE =
  'Outbound endpoint resolves to a blocked (private/loopback/link-local/metadata/reserved) address (SSRF).';

export class SsrfSafeEndpointValidator {
  private readonly resolver: HostResolver;
  private readonly allowedSchemes: string[];

  public constructor(options: EndpointValidatorOptions) {
    this.resolver = options.resolver;
    this.allowedSchemes = options.allowedSchemes ?? [ 'https:' ];
  }

  /**
   * Validate an outbound endpoint, failing closed on anything that is not a plain HTTPS URL whose host is a
   * public address. Returns the resolved/validated IPs (useful evidence for the caller). Throws
   * {@link BadRequestHttpError} otherwise — a malformed URL, a disallowed scheme, a blocked IP literal, a
   * host that does not resolve, or a host that resolves to (or includes) any blocked address.
   */
  public async validate(endpoint: string): Promise<readonly string[]> {
    let url: URL;
    try {
      url = new URL(endpoint);
    } catch {
      throw new BadRequestHttpError('Outbound endpoint is not a valid URL (fail closed).');
    }
    if (!this.allowedSchemes.includes(url.protocol)) {
      throw new BadRequestHttpError(`Outbound endpoint scheme '${url.protocol}' is not allowed (HTTPS only).`);
    }
    const host = url.hostname;
    if (host === '') {
      throw new BadRequestHttpError('Outbound endpoint has no host (fail closed).');
    }
    const literal = classifyIpLiteral(host);
    if (literal === true) {
      throw new BadRequestHttpError(BLOCKED_MESSAGE);
    }
    if (literal === false) {
      return [ host ];
    }
    // A DNS name: resolve and reject if ANY candidate address is blocked (or is unparseable — fail closed),
    // so a name that resolves to a private address cannot be used to reach an internal service (DNS rebind).
    const ips = await this.resolver(host);
    if (ips.length === 0) {
      throw new BadRequestHttpError('Outbound endpoint host did not resolve (fail closed).');
    }
    for (const ip of ips) {
      if (classifyIpLiteral(ip) !== false) {
        throw new BadRequestHttpError(BLOCKED_MESSAGE);
      }
    }
    return ips;
  }
}
