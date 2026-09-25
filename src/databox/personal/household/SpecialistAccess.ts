import { BadRequestHttpError } from '../../../util/errors/BadRequestHttpError';
import { ForbiddenHttpError } from '../../../util/errors/ForbiddenHttpError';
import { NotFoundHttpError } from '../../../util/errors/NotFoundHttpError';
import type { GuardianshipScope } from './Guardianship';
import type { HouseholdMember } from './HouseholdProfile';

/**
 * Specialist access (CIV-A13): household administrators assert scoped credentials for
 * specialist agents — the justice and emergency-medical paths in particular.
 *
 *  - `justice` — a court/tribunal officer, child-protection officer, or legal agent who
 *    must reach particular ward records under an order or statutory basis.
 *  - `emergency-medical` — a paramedic/ED clinician who needs break-glass access to a
 *    ward's emergency record when the decision-makers are unreachable.
 *
 * A grant is asserted by a household admin, scoped to duty slices, time-bounded, and
 * audited — specialist access is a credentialed capability, never a standing pass. Every
 * grant carries its `basis` (court order number, emergency protocol id) so the access is
 * accountable to the authority it rests on.
 */

export type SpecialistAccessClass = 'justice' | 'emergency-medical';

export interface SpecialistAccessGrant {
  readonly grantId: string;
  /** The specialist agent's identifier (a WebID or service identity). */
  readonly agentId: string;
  readonly accessClass: SpecialistAccessClass;
  /** The duty scopes the grant opens — a paramedic gets `medical`, not `financial`. */
  readonly scopes: readonly GuardianshipScope[];
  /**
   * The authority the grant rests on — e.g. `court-order:FCOA-2025-1234`,
   * `emergency-protocol:ambulance-act-s.17`. Required: access without a named basis is
   * unaccountable.
   */
  readonly basis: string;
  /** The household member (admin) who asserted the credential. */
  readonly assertedBy: string;
  readonly assertedAt: string;
  /** ISO-8601 expiry — a grant without one is refused (no standing passes). */
  readonly expiresAt: string;
  /** When the grant must be reviewed (emergency access → review within 24-72h). */
  readonly reviewBy: string;
  readonly status: 'active' | 'revoked' | 'expired';
  /** Who was notified the grant exists — break-glass access is never silent. */
  readonly notifiedMembers: readonly string[];
}

export class SpecialistAccessStore {
  private readonly grants = new Map<string, SpecialistAccessGrant>();

  public constructor(
    private readonly members: HouseholdMember[],
    private readonly now: () => number = Date.now,
  ) {}

  /**
   * Assert a specialist credential — admin-only, scoped, time-bounded, audited. The
   * notified member set must name at least one guardian/admin beyond the asserter — a
   * credential others don't know about is a backdoor.
   */
  public assert(
    grant: Omit<SpecialistAccessGrant, 'assertedAt' | 'status'>,
  ): SpecialistAccessGrant {
    const asserter = this.requireMember(grant.assertedBy);
    if (asserter.role !== 'admin') {
      throw new ForbiddenHttpError('Only a household admin may assert a specialist credential.');
    }
    if (grant.agentId.trim().length === 0 || grant.basis.trim().length === 0) {
      throw new BadRequestHttpError('A specialist grant needs an agent and a legal basis.');
    }
    if (grant.scopes.length === 0) {
      throw new BadRequestHttpError('A specialist grant must be scoped — no blanket access.');
    }
    if (grant.expiresAt <= new Date(this.now()).toISOString()) {
      throw new BadRequestHttpError('A specialist grant must expire in the future — no standing passes.');
    }
    if (grant.notifiedMembers.length === 0) {
      throw new BadRequestHttpError('A specialist grant must name who was notified — no silent access.');
    }
    for (const notified of grant.notifiedMembers) {
      this.requireMember(notified);
    }
    const asserted: SpecialistAccessGrant = {
      ...grant,
      assertedAt: new Date(this.now()).toISOString(),
      status: 'active',
    };
    this.grants.set(asserted.grantId, asserted);
    return asserted;
  }

  /** Whether the agent may act under the access class + scope right now. */
  public mayAccess(agentId: string, accessClass: SpecialistAccessClass, scope: GuardianshipScope): boolean {
    const grant = [ ...this.grants.values() ].find(item =>
      item.agentId === agentId &&
      item.accessClass === accessClass &&
      item.scopes.includes(scope));
    if (grant?.status !== 'active') {
      return false;
    }
    return new Date(this.now()).toISOString() <= grant.expiresAt;
  }

  /** Revoke a grant — admin-only; the audit is the status flip, not deletion. */
  public revoke(grantId: string, byMemberId: string): SpecialistAccessGrant {
    const grant = this.grants.get(grantId);
    if (grant === undefined) {
      throw new NotFoundHttpError(`No specialist grant "${grantId}".`);
    }
    if (this.requireMember(byMemberId).role !== 'admin') {
      throw new ForbiddenHttpError('Only a household admin may revoke a specialist credential.');
    }
    const revoked = { ...grant, status: 'revoked' as const };
    this.grants.set(grantId, revoked);
    return revoked;
  }

  public get(grantId: string): SpecialistAccessGrant {
    const grant = this.grants.get(grantId);
    if (grant === undefined) {
      throw new NotFoundHttpError(`No specialist grant "${grantId}".`);
    }
    return grant;
  }

  /** Active grants for audit — the household's specialist-access surface. */
  public list(): readonly SpecialistAccessGrant[] {
    const at = new Date(this.now()).toISOString();
    return [ ...this.grants.values() ].map(grant =>
      grant.status === 'active' && at > grant.expiresAt ? { ...grant, status: 'expired' as const } : grant);
  }

  private requireMember(memberId: string): HouseholdMember {
    const member = this.members.find(item => item.memberId === memberId);
    if (member === undefined) {
      throw new NotFoundHttpError(`No household member "${memberId}".`);
    }
    return member;
  }
}
