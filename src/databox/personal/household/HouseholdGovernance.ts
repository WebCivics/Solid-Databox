import { BadRequestHttpError } from '../../../util/errors/BadRequestHttpError';
import { NotFoundHttpError } from '../../../util/errors/NotFoundHttpError';
import { ForbiddenHttpError } from '../../../util/errors/ForbiddenHttpError';
import type { HouseholdMember, HouseholdPolicy } from './HouseholdProfile';

/**
 * Household governance (CIV-A10): who may act alone on an admin action, who must consent,
 * and the electronic-permission flow where one member grants another member scoped access.
 *
 * Two distinct paths, per the design question:
 *
 *  - **Admin actions** (add/remove member, change policy, commons administration): governed
 *    by `adminQuorum`. Quorum `1` = any single admin executes alone. Quorum `n`/`'all'` =
 *    the action must gather that many distinct admin approvals via consent requests before
 *    it may execute. A non-admin can never perform an admin action — they may *request* it,
 *    and the request lands with the admins.
 *  - **Member consent** (`memberConsent: true`): a member electronically asks another
 *    member for a scoped grant (e.g. "read the family calendar", "see this bill"). The
 *    target member approves or denies. When the target is `limited` capacity (a child),
 *    an admin counter-signature is required — guardian consent, not unilateral.
 *
 * All evaluation is pure/deterministic; persistence is the same follow-up as the vault
 * stores. The store keeps an audit trail on every request.
 */

/** The household's admin-action taxonomy — everything not listed is member-scope. */
export type HouseholdAdminAction =
  | 'add-member' |
  'remove-member' |
  'change-policy' |
  'commons-admin' |
  'access-limited-member';

export type ConsentKind = 'admin-action' | 'member-scope' | 'ward-decision';

export interface ConsentScope {
  /** What is being asked for, e.g. `read`, `write`, `add-member`. */
  readonly action: string;
  /** The object of the grant — a resource URI, container, or member id. */
  readonly target?: string;
  /** Which household the request applies to — multi-household wards/guardians. */
  readonly household?: string;
  /** Optional human-readable note shown to approvers. */
  readonly note?: string;
}

export interface ConsentAuditEntry {
  readonly at: string;
  readonly memberId: string;
  readonly event: 'requested' | 'approved' | 'denied' | 'executed' | 'expired';
}

export type ConsentStatus = 'pending' | 'approved' | 'denied';

export interface ConsentRequest {
  readonly id: string;
  readonly kind: ConsentKind;
  readonly requesterId: string;
  /** For member-scope requests: the member whose consent is sought. */
  readonly targetId?: string;
  readonly scope: ConsentScope;
  /** Member ids whose approval counts toward the decision. */
  readonly requiredApprovers: readonly string[];
  /** How many distinct approvers are needed. */
  readonly quorum: number;
  readonly approvals: readonly string[];
  readonly denials: readonly string[];
  readonly status: ConsentStatus;
  readonly createdAt: string;
  readonly decidedAt?: string;
  readonly audit: readonly ConsentAuditEntry[];
}

/** Does this member satisfy the admin quorum alone? Sole-admin = quorum 1 + admin role. */
export function adminCanActAlone(policy: HouseholdPolicy, member: HouseholdMember): boolean {
  return member.role === 'admin' && policy.adminQuorum === 1;
}

/**
 * The approver set for an admin action — the household's admins. A member (or limited
 * member) requesting an admin action does not appear in the approver set; they petition it.
 */
export function adminApprovers(members: readonly HouseholdMember[]): string[] {
  return members.filter(member => member.role === 'admin').map(member => member.memberId);
}

/** The quorum count for an admin action under the policy. */
export function adminQuorumCount(policy: HouseholdPolicy, members: readonly HouseholdMember[]): number {
  const admins = adminApprovers(members).length;
  if (admins === 0) {
    throw new BadRequestHttpError('The household has no admins — nothing can be approved.');
  }
  if (policy.adminQuorum === 'all') {
    return admins;
  }
  return Math.min(Math.max(1, policy.adminQuorum), admins);
}

/**
 * Who decides a commons change: the admins (family default) or every member
 * (share-house default — commons changes need household consent).
 */
export function commonsApprovers(policy: HouseholdPolicy, members: readonly HouseholdMember[]): string[] {
  if (policy.commonsAuthority === 'all-members') {
    return members.map(member => member.memberId);
  }
  return adminApprovers(members);
}

/**
 * The consent-request store + evaluator. In-memory per the vault-store convention; every
 * state transition appends an audit entry.
 */
export class HouseholdConsentStore {
  private readonly requests = new Map<string, ConsentRequest>();

  public constructor(
    private readonly policy: HouseholdPolicy,
    private readonly members: HouseholdMember[],
    private readonly now: () => number = Date.now,
  ) {}

  /**
   * Open an admin-action request — e.g. a member petitions the admins to add a member, or
   * an admin under quorum>1 opens an action needing co-approval. Under quorum 1 an admin
   * may act without a request at all (this path is for the asker side).
   */
  public requestAdminAction(requesterId: string, scope: ConsentScope): ConsentRequest {
    this.requireMember(requesterId);
    const approvers = adminApprovers(this.members);
    const quorum = adminQuorumCount(this.policy, this.members);
    return this.create('admin-action', requesterId, undefined, scope, approvers, quorum);
  }

  /**
   * Open a member-scope request — member asks another member for a scoped grant.
   * Requires `memberConsent` in policy; a `limited`-capacity target adds an admin
   * counter-signer (guardian consent).
   */
  public requestMemberScope(requesterId: string, targetId: string, scope: ConsentScope): ConsentRequest {
    if (!this.policy.memberConsent) {
      throw new ForbiddenHttpError('Member-to-member consent is not enabled for this household.');
    }
    this.requireMember(requesterId);
    const target = this.requireMember(targetId);
    if (requesterId === targetId) {
      throw new BadRequestHttpError('A member cannot petition themselves.');
    }
    const approvers = [ targetId ];
    // `limited`/`emerging` capacity targets need a guardian/admin counter-signature;
    // `supported` retains capacity — their own consent suffices (supporters advise, never
    // substitute); `full` is self-governing.
    if (target.capacity === 'limited' || target.capacity === 'emerging') {
      approvers.push(...adminApprovers(this.members).filter(id => id !== targetId));
      if (approvers.length === 1) {
        throw new BadRequestHttpError('A limited-capacity target has no admin counter-signer.');
      }
    }
    return this.create('member-scope', requesterId, targetId, scope, approvers, approvers.length);
  }

  /**
   * Open a ward-decision request — the guardian-network path (CIV-A11/A12). Unlike the
   * other kinds the approver set is supplied by the caller (resolved by
   * `GuardianNetwork.resolveDecision` under a safety recipe): the deciders are the
   * guardians who hold the scope, not the household's admins. Every approver must be a
   * known member; a request with no approvers is refused (a ward with no guardian is a
   * gap, not an approval).
   */
  public requestWardDecision(
    requesterId: string,
    wardId: string,
    scope: ConsentScope,
    approvers: readonly string[],
    quorum: number,
  ): ConsentRequest {
    this.requireMember(requesterId);
    this.requireMember(wardId);
    if (approvers.length === 0 || quorum < 1 || quorum > approvers.length) {
      throw new BadRequestHttpError('A ward decision needs at least one approver and a sane quorum.');
    }
    for (const approver of approvers) {
      this.requireMember(approver);
    }
    return this.create('ward-decision', requesterId, wardId, scope, approvers, quorum);
  }

  /** An approver records approval. Only listed approvers count; duplicates ignored. */
  public approve(requestId: string, memberId: string): ConsentRequest {
    const request = this.requireRequest(requestId);
    if (request.status !== 'pending') {
      throw new BadRequestHttpError(`Request ${requestId} is already ${request.status}.`);
    }
    if (!request.requiredApprovers.includes(memberId)) {
      throw new ForbiddenHttpError(`${memberId} is not an approver for ${requestId}.`);
    }
    if (request.approvals.includes(memberId)) {
      return request;
    }
    const approvals = [ ...request.approvals, memberId ];
    const decided = approvals.length >= request.quorum;
    const updated: ConsentRequest = {
      ...request,
      approvals,
      status: decided ? 'approved' : 'pending',
      ...decided ? { decidedAt: this.stamp() } : {},
      audit: [ ...request.audit, { at: this.stamp(), memberId, event: 'approved' }],
    };
    this.requests.set(requestId, updated);
    return updated;
  }

  /** An approver denies — a single denial closes the request (veto semantics). */
  public deny(requestId: string, memberId: string): ConsentRequest {
    const request = this.requireRequest(requestId);
    if (request.status !== 'pending') {
      throw new BadRequestHttpError(`Request ${requestId} is already ${request.status}.`);
    }
    if (!request.requiredApprovers.includes(memberId)) {
      throw new ForbiddenHttpError(`${memberId} is not an approver for ${requestId}.`);
    }
    const updated: ConsentRequest = {
      ...request,
      denials: [ ...request.denials, memberId ],
      status: 'denied',
      decidedAt: this.stamp(),
      audit: [ ...request.audit, { at: this.stamp(), memberId, event: 'denied' }],
    };
    this.requests.set(requestId, updated);
    return updated;
  }

  /**
   * Whether a member may execute right now: an admin action needs the member to be an
   * admin under quorum 1, or an approved request; member-scope needs an approved request.
   */
  public mayExecute(memberId: string, kind: ConsentKind, action: string, requestId?: string): boolean {
    const member = this.requireMember(memberId);
    if (kind === 'admin-action' && member.role === 'admin' && this.policy.adminQuorum === 1) {
      return true;
    }
    if (requestId === undefined) {
      return false;
    }
    const request = this.requests.get(requestId);
    return request?.status === 'approved' &&
      request.kind === kind &&
      request.scope.action === action;
  }

  public get(requestId: string): ConsentRequest {
    return this.requireRequest(requestId);
  }

  public pendingFor(memberId: string): readonly ConsentRequest[] {
    return [ ...this.requests.values() ].filter(
      request => request.status === 'pending' && request.requiredApprovers.includes(memberId),
    );
  }

  private create(
    kind: ConsentKind,
    requesterId: string,
    targetId: string | undefined,
    scope: ConsentScope,
    approvers: readonly string[],
    quorum: number,
  ): ConsentRequest {
    const request: ConsentRequest = {
      id: `consent-${this.requests.size + 1}-${this.now()}`,
      kind,
      requesterId,
      ...targetId === undefined ? {} : { targetId },
      scope,
      requiredApprovers: approvers,
      quorum,
      approvals: [],
      denials: [],
      status: 'pending',
      createdAt: this.stamp(),
      audit: [{ at: this.stamp(), memberId: requesterId, event: 'requested' }],
    };
    this.requests.set(request.id, request);
    return request;
  }

  private requireMember(memberId: string): HouseholdMember {
    const member = this.members.find(item => item.memberId === memberId);
    if (member === undefined) {
      throw new NotFoundHttpError(`No household member "${memberId}".`);
    }
    return member;
  }

  private requireRequest(requestId: string): ConsentRequest {
    const request = this.requests.get(requestId);
    if (request === undefined) {
      throw new NotFoundHttpError(`No consent request "${requestId}".`);
    }
    return request;
  }

  private stamp(): string {
    return new Date(this.now()).toISOString();
  }
}
