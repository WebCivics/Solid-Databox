import { BadRequestHttpError } from '../../../util/errors/BadRequestHttpError';
import type { PersonalHostingPlan } from '../PersonalHostingConfig';
import { planPersonalHosting } from '../PersonalHostingConfig';

/**
 * Household pod topology (CIV-A09): the family/share-house profile layered on the personal
 * databox. One host runs one pod per member plus a shared commons pod — the commons is
 * GOVERNED, never owned by a single member (a share-house's bills pod shouldn't die with
 * the tenant who happened to set it up).
 *
 * Topology:  `alice.<zone>/`, `bob.<zone>/`, `commons.<zone>/`
 * each an independent CSS pod on the one server — members get WebIDs of their own; the
 * commons pod's account is bound to the household governance policy, not a person.
 */

export type HouseholdKind = 'family' | 'share-house' | 'collective';

/**
 * The governance policy deciding who can act alone on admin actions and who must consent.
 *
 * - `adminQuorum`: `1` = any single admin acts alone (typical family: either parent);
 *   `n` = m-of-n admin approvals; `'all'` = every admin (share-house consensus).
 * - `commonsAuthority`: who authorizes changes to the shared commons pod —
 *   `'admins'` (family: parents set household rules) or `'all-members'` (share-house:
 *   commons changes need member consent).
 * - `memberConsent`: whether one member may electronically grant another member scoped
 *   access (e.g. sibling reads the family calendar) — the ask/grant/revoke flow.
 */
export interface HouseholdPolicy {
  readonly kind: HouseholdKind;
  readonly adminQuorum: number | 'all';
  readonly commonsAuthority: 'admins' | 'all-members';
  readonly memberConsent: boolean;
}

/**
 * The member's capacity (see `Guardianship.ts` — anchored to CRC Art. 5 / CRPD Art. 12):
 * `full` decides; `emerging` decides with guardian counter-signature on scoped matters;
 * `limited` needs substituted decisions; `supported` RETAINS capacity — supporters advise,
 * never substitute.
 */
export type MemberCapacity = 'full' | 'emerging' | 'limited' | 'supported';

export interface HouseholdMember {
  /** Short handle used as the pod label, e.g. `alice`. */
  readonly memberId: string;
  /**
   * The member's WebID — binds an authenticated caller to this member so the household
   * surface knows WHO is acting (a guardian in another household authenticates as their
   * own WebID, resolved to their memberId here).
   */
  readonly webId?: string;
  /**
   * `admin` members can perform household admin actions subject to `adminQuorum`;
   * `member` members hold their own pod but cannot administer the household.
   */
  readonly role: 'admin' | 'member';
  /** Decision-making capacity — see {@link MemberCapacity}. */
  readonly capacity: MemberCapacity;
}

export interface HouseholdPod {
  /** The member's label, or the literal `'commons'` for the governed shared pod. */
  readonly memberId: string;
  readonly podName: string;
  readonly podHost: string;
  readonly webId?: string;
  readonly plan: PersonalHostingPlan;
}

export interface HouseholdPlan {
  readonly householdId: string;
  readonly kind: HouseholdKind;
  readonly policy: HouseholdPolicy;
  readonly memberPods: readonly HouseholdPod[];
  readonly commonsPod: HouseholdPod;
  /** Ordered human steps — provision pods, wire governance, invite members. */
  readonly steps: readonly string[];
}

const DNS_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u;

/**
 * A conventional family policy: adults are admins (either may act alone), children are
 * members — `limited` capacity until they come of age; commons administered by admins.
 */
export function familyPolicy(adminCount: number): HouseholdPolicy {
  return {
    kind: 'family',
    adminQuorum: Math.min(1, Math.max(1, adminCount)),
    commonsAuthority: 'admins',
    memberConsent: true,
  };
}

/**
 * A conventional share-house policy: every member is an admin by default; commons changes
 * need all-members consent; member-to-member scoped grants on.
 */
export function shareHousePolicy(): HouseholdPolicy {
  return { kind: 'share-house', adminQuorum: 'all', commonsAuthority: 'all-members', memberConsent: true };
}

/**
 * Plan a household: one pod per member (label = memberId) + a `commons` pod, each with its
 * own personal hosting plan under the household zone. Pure and deterministic — the plan is
 * the artifact the installer/onboarding flow executes.
 */
export function planHousehold(input: {
  readonly householdId: string;
  /** The zone the household's pods live under, e.g. `family.example.org` or `members.coop.example`. */
  readonly zone: string;
  readonly members: HouseholdMember[];
  readonly policy: HouseholdPolicy;
  /** Origin target for all pods (the household host). */
  readonly originTarget: string;
  readonly originPort?: number;
}): HouseholdPlan {
  const zone = input.zone.trim().toLowerCase();
  if (zone.length === 0 || !zone.includes('.')) {
    throw new BadRequestHttpError('A household plan needs a zone such as "family.example.org".');
  }
  if (input.members.length === 0) {
    throw new BadRequestHttpError('A household needs at least one member.');
  }
  if (!input.members.some(member => member.role === 'admin')) {
    throw new BadRequestHttpError('A household needs at least one admin (someone must be able to govern).');
  }
  if (input.policy.kind === 'family' && input.policy.adminQuorum === 'all' &&
    input.members.filter(member => member.role === 'admin').length === 0) {
    throw new BadRequestHttpError('A family policy needs at least one admin to satisfy quorum.');
  }

  const seen = new Set<string>();
  const memberPods: HouseholdPod[] = input.members.map((member): HouseholdPod => {
    const label = member.memberId.trim().toLowerCase();
    if (!DNS_LABEL.test(label)) {
      throw new BadRequestHttpError(`Member "${member.memberId}" is not a valid DNS label.`);
    }
    if (seen.has(label)) {
      throw new BadRequestHttpError(`Duplicate member label "${label}".`);
    }
    seen.add(label);
    const plan = planPersonalHosting({
      apexDomain: zone,
      podLabel: label,
      originTarget: input.originTarget,
      proxied: true,
      originPort: input.originPort,
    });
    return {
      memberId: label,
      podName: label,
      podHost: plan.podHost,
      webId: `${plan.baseUrl}profile/card#me`,
      plan,
    };
  });

  const commonsPlan = planPersonalHosting({
    apexDomain: zone,
    podLabel: 'commons',
    originTarget: input.originTarget,
    proxied: true,
    originPort: input.originPort,
  });
  const commonsPod: HouseholdPod = {
    memberId: 'commons',
    podName: 'commons',
    podHost: commonsPlan.podHost,
    plan: commonsPlan,
  };

  return {
    householdId: input.householdId,
    kind: input.policy.kind,
    policy: input.policy,
    memberPods,
    commonsPod,
    steps: [
      `Provision ${memberPods.length + 1} pods on the household host (one per member + commons).`,
      'Bind each member pod account to its member WebID; bind commons to the household policy.',
      `Apply the ${input.policy.kind} governance policy` +
      ` (adminQuorum=${String(input.policy.adminQuorum)}, commonsAuthority=${input.policy.commonsAuthority}).`,
      'Issue member tokens so each member can reach their own pod and the commons rules.',
    ],
  };
}
