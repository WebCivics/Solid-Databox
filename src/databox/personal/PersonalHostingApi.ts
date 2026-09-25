import type { PersonalDnsRecord, PersonalHostingPlan, PersonalTunnelIngressRule } from './PersonalHostingConfig';
import { generatePersonalCloudflaredConfig } from './PersonalHostingConfig';

/**
 * Personal Databox hosting apply-path (CIV-A04) — turns a {@link PersonalHostingPlan} into a
 * working `https://` hostname on the Cloudflare Tunnel delivery mode (ADR-0027).
 *
 * The personal layer depends on the {@link PersonalDnsClient} contract only: the existing
 * `ipms/modules/hosting/CloudflareApi` satisfies it structurally (its `DnsRecord`/
 * `TunnelIngressRule`/`CreatedRecord`/`TunnelResult` shapes are wire-identical), so an
 * operator deployment wires that client here — but the personal profile never imports the
 * IPMS module and could equally be driven by any other DNS/tunnel provider implementing
 * the same contract (the A05 fallback direction).
 */

export interface CreatedDnsRecord {
  readonly name: string;
  readonly id: string;
  readonly alreadyExisted: boolean;
}

export interface ProvisionedTunnel {
  readonly tunnelId: string;
  readonly tunnelToken: string;
}

/** The provider operations the personal apply-path needs — satisfied by `CloudflareApi`. */
export interface PersonalDnsClient {
  getZoneId: (apexDomain: string) => Promise<string>;
  createDnsRecords: (zoneId: string, records: readonly PersonalDnsRecord[]) => Promise<CreatedDnsRecord[]>;
  createTunnel: (accountId: string, tunnelName: string) => Promise<ProvisionedTunnel>;
  setTunnelIngress: (
    accountId: string,
    tunnelId: string,
    rules: PersonalTunnelIngressRule[],
  ) => Promise<void>;
  /** Zone→account lookup; `CloudflareApi` does not expose it publicly, so callers may omit. */
  getAccountId?: (zoneId: string) => Promise<string>;
}

export interface PersonalHostingArtifacts {
  /** Rendered `cloudflared.yml` for the self-run path. */
  readonly cloudflaredConfig: string;
  /** Environment additions the pod process needs (BASE_URL for the public hostname). */
  readonly env: Record<string, string>;
  /** The pod launch command from the plan. */
  readonly launchCommand: string;
  /** Ordered human steps to finish the install on the operator's machine. */
  readonly steps: string[];
}

export interface PersonalApplyResult {
  readonly zoneId: string;
  readonly dnsRecords: CreatedDnsRecord[];
  /** Present when the provider's tunnel API succeeded; absent means guided-manual mode. */
  readonly tunnel?: ProvisionedTunnel;
  readonly artifacts: PersonalHostingArtifacts;
}

/**
 * Apply a personal hosting plan: resolve the zone, upsert the DNS record, then provision a
 * tunnel + single-hostname ingress. Tunnel provisioning is non-fatal — when the token lacks
 * tunnel scope the DNS record still stands and the caller falls back to guided-manual
 * `cloudflared` setup (same contract as the organisation `applyPlan`).
 *
 * `accountId` may be supplied directly; when absent it is resolved through
 * `client.getAccountId` if available, else tunnel provisioning is skipped.
 */
export async function applyPersonalHosting(
  client: PersonalDnsClient,
  plan: PersonalHostingPlan,
  apexDomain: string,
  accountId?: string,
): Promise<PersonalApplyResult> {
  const zoneId = await client.getZoneId(apexDomain);
  const dnsRecords = await client.createDnsRecords(zoneId, plan.dnsRecords);

  const account = accountId ?? await client.getAccountId?.(zoneId);
  let tunnel: ProvisionedTunnel | undefined;
  if (account !== undefined) {
    try {
      tunnel = await client.createTunnel(account, `personal-${apexDomain.replaceAll('.', '-')}`);
      await client.setTunnelIngress(account, tunnel.tunnelId, plan.tunnelIngress);
    } catch {
      tunnel = undefined;
    }
  }

  return {
    zoneId,
    dnsRecords,
    tunnel,
    artifacts: personalArtifacts(plan, tunnel),
  };
}

/**
 * The artifact set the installer/onboarding flow (CIV-A02) hands to the operator: config
 * file, environment, launch command and the ordered finish-steps for whichever delivery
 * mode actually applied.
 */
export function personalArtifacts(plan: PersonalHostingPlan, tunnel?: ProvisionedTunnel): PersonalHostingArtifacts {
  const env: Record<string, string> = { BASE_URL: plan.baseUrl };
  const steps: string[] = [];
  if (tunnel === undefined) {
    steps.push(
      'Install cloudflared on this machine (`winget install cloudflare.cloudflared` or your package manager).',
      'Run `cloudflared tunnel login` and create a tunnel, then place the credentials JSON' +
      ' at ~/.cloudflared/<tunnel-id>.json.',
      'Save the generated cloudflared.yml next to the credentials file and fill in <tunnel-id>.',
      'Register cloudflared as a service so it survives reboot (`cloudflared service install`).',
    );
  } else {
    env.CLOUDFLARE_TUNNEL_TOKEN = tunnel.tunnelToken;
    steps.push(
      'Install cloudflared on this machine (`winget install cloudflare.cloudflared` or your package manager).',
      'Run the tunnel with the issued token: `cloudflared tunnel run --token <token>`' +
      ' — the token is in the environment, never committed.',
      'Register cloudflared as a service so it survives reboot.',
    );
  }
  steps.push(`Start the pod: \`${plan.launchCommand}\`.`);
  steps.push(`Verify https://${plan.podHost}/ answers with your pod.`);

  return {
    cloudflaredConfig: generatePersonalCloudflaredConfig(plan),
    env,
    launchCommand: plan.launchCommand,
    steps,
  };
}
