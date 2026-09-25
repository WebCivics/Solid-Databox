import { BadRequestHttpError } from '../../../util/errors/BadRequestHttpError';
import { ForbiddenHttpError } from '../../../util/errors/ForbiddenHttpError';
import type {
  GuardianshipRelation,
  GuardianshipScope,
} from './Guardianship';
import {
  advisoryWeightOf,
  informationScopesOf,
  isInForce,
  precedenceOf,
  validateGuardianship,
} from './Guardianship';
import type { HouseholdMember } from './HouseholdProfile';
import type { SafetyRecipe } from './SafetyRecipes';

/**
 * The resolution of *who must act* on a ward decision (CIV-A11) — the output of
 * {@link GuardianNetwork.resolveDecision}: the approvers (who decides), the consulted
 * (who advises, weight-ordered), and the information-holders (who is privy to the
 * record). A decision is never silently made — equal-precedence disagreement stays a
 * deadlock the caller escalates through the recipe's path.
 */
export interface DecisionResolution {
  /** The member ids who must approve (ordered: highest precedence first). */
  readonly approvers: readonly string[];
  /**
   * Advisors — in-force relations relevant to the scope that do NOT hold the deciding
   * tier: lower-tier scope holders, supporters, and qualified specialists. Ordered by
   * advisory weight so the strongest in-field voice is recorded first.
   */
  readonly consulted: readonly string[];
  /**
   * Who is privy to the decision record — the approvers plus every relation whose
   * declared `informationAccess` covers the scope. Privy ≠ deciding.
   */
  readonly informationHolders: readonly string[];
  /** How many distinct approvers must consent for the decision to stand. */
  readonly quorum: number;
  /** Whether the ward's own voice is required/advisory for this recipe. */
  readonly wardVoice: SafetyRecipe['wardVoice'];
  /**
   * Whether the ward's own assent IS the operative act (CRPD Art. 12 — the supported
   * person retains legal capacity; supporters advise, never substitute).
   */
  readonly wardAssentRequired: boolean;
  /** Where a deadlocked decision escalates (from the recipe). */
  readonly escalation: SafetyRecipe['escalation'];
}

/** An external party brought in to resolve a persisting guardianship dispute. */
export interface DisputeResolver {
  /** The resolver's own agent identity (WebID or equivalent) — they act under it. */
  readonly agentId: string;
  readonly kind: 'mediator' | 'tribunal' | 'court';
  /**
   * The organisation the resolver answers to — a mediator MUST declare one (the
   * independence/structure rule is checkable, not asserted).
   */
  readonly organisation?: string;
}

/** A dispute raised on a decision, and its determination. */
export interface DisputeRecord {
  readonly requestId: string;
  readonly resolver: DisputeResolver;
  readonly status: 'open' | 'resolved';
  readonly determination?: 'uphold' | 'deny' | 'remit';
  readonly rationale?: string;
}

/**
 * The guardianship network (CIV-A11): the relations asserted for a household's wards and
 * the resolution of who must act on a decision under a {@link SafetyRecipe}'s consent
 * rule. Multi-household by construction — a relation names the households it operates
 * in, so a separated child's mum (house-a) and dad (house-b) hold scope only where their
 * relation applies.
 */
export class GuardianNetwork {
  private readonly relations: GuardianshipRelation[] = [];
  private readonly disputes = new Map<string, DisputeRecord>();

  public constructor(private readonly members: HouseholdMember[]) {}

  /**
   * Assert a guardianship relation — both parties must be household members and the
   * relation must be well-formed (a person is never their own guardian; every relation
   * names at least one household).
   */
  public addRelation(relation: GuardianshipRelation): void {
    validateGuardianship(relation);
    this.requireMember(relation.wardId);
    this.requireMember(relation.guardianId);
    this.relations.push(relation);
  }

  /** All relations asserted for a ward — optionally confined to one household. */
  public relationsFor(wardId: string, householdId?: string): readonly GuardianshipRelation[] {
    return this.relations.filter(relation =>
      relation.wardId === wardId &&
      (householdId === undefined || relation.households.includes(householdId)));
  }

  /**
   * The in-force guardians holding a scope for a ward — precedence-ordered (highest
   * first), ties keep assertion order. Optionally confined to one household.
   */
  public guardiansFor(
    wardId: string,
    scope: GuardianshipScope,
    householdId?: string,
  ): GuardianshipRelation[] {
    return this.relations
      .filter(relation =>
        relation.wardId === wardId &&
        relation.scopes.includes(scope) &&
        isInForce(relation) &&
        (householdId === undefined || relation.households.includes(householdId)))
      .sort((a, b): number => precedenceOf(b) - precedenceOf(a));
  }

  /**
   * Whether a guardian may act for a ward in a scope *now* — in-force only (an out-of-
   * scope or lapsed relation holds no power; AT-47). Optionally confined to a household.
   */
  public mayActFor(
    guardianId: string,
    wardId: string,
    scope: GuardianshipScope,
    householdId?: string,
  ): boolean {
    return this.guardiansFor(wardId, scope, householdId)
      .some(relation => relation.guardianId === guardianId);
  }

  /**
   * Resolve who must act on a decision under a recipe's consent rule:
   *
   *  - `top-tier-any`     — the highest-precedence tier alone (any one suffices).
   *  - `top-tier-all`     — every highest-tier guardian (a split deadlocks to escalation).
   *  - `all-scoped`       — every in-force holder of the scope.
   *  - `ward-with-support`— the ward themself (CRPD Art. 12); supporters advise.
   *
   * Everyone relevant who does NOT decide is `consulted` (advice is recorded, weight-
   * ordered); everyone privy to the record is `informationHolders`. A ward with no
   * in-force guardian for the scope is a surfaced gap — never an implicit approval.
   */
  public resolveDecision(
    wardId: string,
    scope: GuardianshipScope,
    recipe: SafetyRecipe,
    householdId?: string,
  ): DecisionResolution {
    const relevant = this.relations.filter(relation =>
      relation.wardId === wardId &&
      isInForce(relation) &&
      (householdId === undefined || relation.households.includes(householdId)));

    let deciding: GuardianshipRelation[];
    if (recipe.consentRule === 'ward-with-support') {
      deciding = [];
    } else {
      const holders = relevant.filter(relation => relation.scopes.includes(scope));
      if (holders.length === 0) {
        throw new BadRequestHttpError(
          `Ward "${wardId}" has no in-force guardian for scope "${scope}".`,
        );
      }
      const top = Math.max(...holders.map(precedenceOf));
      deciding = recipe.consentRule === 'all-scoped' ?
        holders :
          holders.filter(relation => precedenceOf(relation) === top);
    }

    const approvers = recipe.consentRule === 'ward-with-support' ?
        [ wardId ] :
        deciding
          .sort((a, b): number => precedenceOf(b) - precedenceOf(a))
          .map(relation => relation.guardianId);

    const approverSet = new Set(approvers);
    const consulted = relevant
      .filter(relation =>
        !approverSet.has(relation.guardianId) &&
        (relation.scopes.includes(scope) || (relation.specialties?.includes(scope) ?? false)))
      .sort((a, b): number => advisoryWeightOf(b, scope) - advisoryWeightOf(a, scope))
      .map(relation => relation.guardianId);

    const informationHolders = [ ...new Set([
      ...approvers,
      ...relevant
        .filter(relation => informationScopesOf(relation).includes(scope))
        .map(relation => relation.guardianId),
    ]) ];

    return {
      approvers,
      consulted,
      informationHolders,
      quorum: recipe.consentRule === 'top-tier-any' || recipe.consentRule === 'ward-with-support' ?
        1 :
        approvers.length,
      wardVoice: recipe.wardVoice,
      wardAssentRequired: recipe.consentRule === 'ward-with-support',
      escalation: recipe.escalation,
    };
  }

  /**
   * Escalate a persisting dispute to an external resolver. Independence is structural —
   * the resolver can be neither the ward, a guardian, nor any member (a party never
   * resolves their own dispute); a mediator must declare their organisation.
   */
  public openDispute(requestId: string, resolver: DisputeResolver): DisputeRecord {
    const partyIds = new Set([
      ...this.members.map(member => member.memberId),
      ...this.members.map(member => member.webId ?? member.memberId),
      ...this.relations.flatMap(relation => [ relation.wardId, relation.guardianId ]),
    ]);
    if (partyIds.has(resolver.agentId)) {
      throw new ForbiddenHttpError(
        `"${resolver.agentId}" cannot resolve a dispute — the resolver must be an ` +
        `independent resolver (not the ward, a guardian, or the requester).`,
      );
    }
    if (resolver.kind === 'mediator' &&
      (resolver.organisation === undefined || resolver.organisation.trim().length === 0)) {
      throw new BadRequestHttpError('A mediator must declare an organisation.');
    }
    const dispute: DisputeRecord = { requestId, resolver, status: 'open' };
    this.disputes.set(requestId, dispute);
    return dispute;
  }

  /**
   * The resolver's determination — only the declared resolver may determine, under their
   * own identity, and a rationale is mandatory (a decision with no reasons is not a
   * determination a party can review or challenge).
   */
  public resolveDispute(
    requestId: string,
    callerWebId: string,
    determination: 'uphold' | 'deny' | 'remit',
    rationale: string,
  ): DisputeRecord {
    const dispute = this.disputes.get(requestId);
    if (dispute === undefined) {
      throw new BadRequestHttpError(`No dispute open on "${requestId}".`);
    }
    if (callerWebId !== dispute.resolver.agentId) {
      throw new ForbiddenHttpError(
        `Only the declared resolver "${dispute.resolver.agentId}" may determine this dispute.`,
      );
    }
    if (rationale.trim().length === 0) {
      throw new BadRequestHttpError('A dispute determination needs a rationale.');
    }
    const resolved: DisputeRecord = { ...dispute, status: 'resolved', determination, rationale };
    this.disputes.set(requestId, resolved);
    return resolved;
  }

  /** The dispute on a request, if any. */
  public disputeOn(requestId: string): DisputeRecord | undefined {
    return this.disputes.get(requestId);
  }

  private requireMember(memberId: string): void {
    if (!this.members.some(member => member.memberId === memberId)) {
      throw new BadRequestHttpError(`No household member "${memberId}".`);
    }
  }
}
