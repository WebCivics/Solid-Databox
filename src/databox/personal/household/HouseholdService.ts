import { ForbiddenHttpError } from '../../../util/errors/ForbiddenHttpError';
import { NotFoundHttpError } from '../../../util/errors/NotFoundHttpError';
import type { GuardianshipRelation } from './Guardianship';
import type { DisputeRecord, DisputeResolver } from './GuardianNetwork';
import { GuardianNetwork } from './GuardianNetwork';
import { HouseholdConsentStore } from './HouseholdGovernance';
import type { HouseholdMember, HouseholdPolicy } from './HouseholdProfile';
import type { SafetyRecipe } from './SafetyRecipes';
import { SAFETY_RECIPES } from './SafetyRecipes';
import type { SpecialistAccessGrant } from './SpecialistAccess';
import { SpecialistAccessStore } from './SpecialistAccess';
import type { WardDecision, WardDecisionRequest } from './WardDecisions';
import { WardDecisionService } from './WardDecisions';

/**
 * The household service facade (CIV-A14) — composes the guardianship/governance layer
 * behind the `/.databox/household` HTTP surface. Callers are *members*, resolved from
 * their WebID — a guardian in a second household acts under their own identity, not the
 * box owner's.
 */

export interface HouseholdServiceDeps {
  readonly members: HouseholdMember[];
  readonly policy: HouseholdPolicy;
  readonly now?: () => number;
}

export class HouseholdService {
  private readonly members: readonly HouseholdMember[];
  private readonly network: GuardianNetwork;
  private readonly consents: HouseholdConsentStore;
  private readonly decisions: WardDecisionService;
  private readonly specialist: SpecialistAccessStore;

  public constructor(deps: HouseholdServiceDeps) {
    this.members = deps.members;
    this.network = new GuardianNetwork(deps.members);
    this.consents = new HouseholdConsentStore(deps.policy, deps.members, deps.now);
    this.decisions = new WardDecisionService(this.network, this.consents, deps.members);
    this.specialist = new SpecialistAccessStore(deps.members, deps.now);
  }

  /** Resolve an authenticated caller WebID to a household member — fail closed. */
  public memberForWebId(webId: string): HouseholdMember {
    const member = this.members.find(item => item.webId === webId);
    if (member === undefined) {
      throw new ForbiddenHttpError(`No household member bound to WebID ${webId}.`);
    }
    return member;
  }

  // ---- Guardian relations -------------------------------------------------

  /** Assert a guardian relation — admin only (the household admits guardians). */
  public addRelation(caller: HouseholdMember, relation: GuardianshipRelation): void {
    this.requireAdmin(caller);
    this.network.addRelation(relation);
  }

  public relationsFor(wardId: string, householdId?: string): readonly GuardianshipRelation[] {
    return this.network.relationsFor(wardId, householdId);
  }

  // ---- Recipes ------------------------------------------------------------

  public listRecipes(): readonly SafetyRecipe[] {
    return SAFETY_RECIPES;
  }

  public recipe(id: string): SafetyRecipe {
    const recipe = SAFETY_RECIPES.find(item => item.id === id);
    if (recipe === undefined) {
      throw new NotFoundHttpError(`No safety recipe "${id}".`);
    }
    return recipe;
  }

  // ---- Ward decisions ------------------------------------------------------

  /**
   * Open a ward-decision request — the requester is the CALLER (derived from their WebID,
   * never asserted in the body). A supporter cannot open the ward's own supported
   * decision — the service enforces that.
   */
  public requestDecision(
    caller: HouseholdMember,
    input: Omit<WardDecisionRequest, 'requesterId'>,
  ): WardDecision {
    return this.decisions.request({ ...input, requesterId: caller.memberId });
  }

  /** A decider approves/denies — the caller must be a resolved approver. */
  public async decideDecision(
    requestId: string,
    caller: HouseholdMember,
    approve: boolean,
  ): Promise<WardDecision> {
    return this.decisions.decide(requestId, caller.memberId, approve);
  }

  public getDecision(requestId: string): WardDecision {
    return this.decisions.get(requestId);
  }

  // ---- Disputes ------------------------------------------------------------

  /**
   * Open a dispute on a decision — a member escalates to an external resolver (mediator/
   * tribunal/court). The resolver is declared (agentId + kind + organisation); the
   * network checks the resolver's independence. The caller need not be an approver —
   * any member may flag a deadlock — but the resolver's independence is enforced.
   */
  public openDispute(requestId: string, resolver: DisputeResolver): DisputeRecord {
    return this.network.openDispute(requestId, resolver);
  }

  /**
   * The resolver's determination — authenticated as the resolver's own WebID, which must
   * equal the declared resolver's agentId. Resolvers are external, not members.
   */
  public resolveDispute(
    requestId: string,
    callerWebId: string,
    determination: 'uphold' | 'deny' | 'remit',
    rationale: string,
  ): DisputeRecord {
    return this.network.resolveDispute(requestId, callerWebId, determination, rationale);
  }

  public disputeOn(requestId: string): DisputeRecord | undefined {
    return this.network.disputeOn(requestId);
  }

  // ---- Specialist access ----------------------------------------------------

  /** Assert a specialist credential — admin only; scoped, time-bounded, notified. */
  public assertSpecialistAccess(
    caller: HouseholdMember,
    grant: Omit<SpecialistAccessGrant, 'assertedBy' | 'assertedAt' | 'status'>,
  ): SpecialistAccessGrant {
    this.requireAdmin(caller);
    return this.specialist.assert({ ...grant, assertedBy: caller.memberId });
  }

  public revokeSpecialistAccess(
    caller: HouseholdMember,
    grantId: string,
  ): SpecialistAccessGrant {
    this.requireAdmin(caller);
    return this.specialist.revoke(grantId, caller.memberId);
  }

  public listSpecialistAccess(): readonly SpecialistAccessGrant[] {
    return this.specialist.list();
  }

  // ----

  private requireAdmin(member: HouseholdMember): void {
    if (member.role !== 'admin') {
      throw new ForbiddenHttpError(`"${member.memberId}" is not a household admin.`);
    }
  }
}
