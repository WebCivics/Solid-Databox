import type { Quad } from 'n3';
import { DataFactory, Parser, Store } from 'n3';
import { Validator } from 'shacl-engine';
import { BadRequestHttpError } from '../../../util/errors/BadRequestHttpError';
import { ForbiddenHttpError } from '../../../util/errors/ForbiddenHttpError';
import type { GuardianshipScope } from './Guardianship';
import type { GuardianNetwork } from './GuardianNetwork';
import type { HouseholdConsentStore } from './HouseholdGovernance';
import type { HouseholdMember } from './HouseholdProfile';
import type { SafetyRecipe } from './SafetyRecipes';
import { safetyRecipe } from './SafetyRecipes';

/**
 * The ward-decision flow (CIV-A12): guardians negotiate a recipe under the network's
 * resolution, the ward's voice is recorded, and the resulting decision record must satisfy
 * the recipe's SHACL shape before it stands. This is the "guardians negotiate and decide"
 * surface — the network says WHO must agree, the recipe says WHAT the decision must look
 * like, the consent store runs the approval, and SHACL validates the record.
 */

export interface WardDecisionRequest {
  /** Who is asking (a guardian, or the ward themselves where voice required). */
  readonly requesterId: string;
  readonly wardId: string;
  readonly recipeId: string;
  readonly scope: GuardianshipScope;
  /** Which household the decision is for (multi-household wards; absent = all). */
  readonly householdId?: string;
  /** The ward's own stated preference — captured for CRC Art. 12 / CRPD Art. 12. */
  readonly wardPreference?: string;
  /** The proposed decision record (Turtle) — SHACL-validated when quorum is met. */
  readonly decisionTurtle: string;
}

export interface WardDecision {
  readonly requestId: string;
  readonly recipe: SafetyRecipe;
  readonly approvers: readonly string[];
  readonly quorum: number;
  readonly consulted: readonly string[];
  readonly wardPreference?: string;
  /** The proposed record — validated against the recipe's shape on quorum. */
  readonly decisionTurtle: string;
  /** `pending` until quorum; `approved` = the SHACL-conformant record stands. */
  readonly status: 'pending' | 'approved' | 'denied' | 'rejected-record';
}

export class WardDecisionService {
  private readonly decisions = new Map<string, WardDecision>();

  public constructor(
    private readonly network: GuardianNetwork,
    private readonly consents: HouseholdConsentStore,
    private readonly members: HouseholdMember[],
  ) {}

  /**
   * Open a ward decision: resolve the deciders under the recipe, capture the ward's
   * voice, and raise the consent request. The requester's standing is checked — a
   * non-guardian may *petition* (they can open the request) but only resolved approvers
   * decide.
   */
  public request(input: WardDecisionRequest): WardDecision {
    const recipe = safetyRecipe(input.recipeId);
    const ward = this.member(input.wardId);
    if (!recipe.appliesToCapacity.includes(ward.capacity)) {
      throw new BadRequestHttpError(
        `Recipe "${recipe.id}" does not apply to a ${ward.capacity}-capacity ward.`,
      );
    }
    if (recipe.wardVoice === 'required' && input.wardPreference === undefined) {
      throw new BadRequestHttpError(
        `Recipe "${recipe.id}" requires the ward's voice — record their preference.`,
      );
    }

    const resolution = this.network.resolveDecision(input.wardId, input.scope, recipe, input.householdId);

    // The ward's own assent for `ward-with-support` is recorded directly.
    if (recipe.consentRule === 'ward-with-support' && input.requesterId !== input.wardId) {
      throw new ForbiddenHttpError(
        'A supported person decides for themselves — only the ward may open this decision.',
      );
    }

    const request = this.consents.requestWardDecision(
      input.requesterId,
      input.wardId,
      {
        action: recipe.id,
        target: input.wardId,
        ...input.householdId === undefined ? {} : { household: input.householdId },
      },
      resolution.approvers,
      resolution.quorum,
    );

    const decision: WardDecision = {
      requestId: request.id,
      recipe,
      approvers: resolution.approvers,
      quorum: resolution.quorum,
      consulted: resolution.consulted,
      ...input.wardPreference === undefined ? {} : { wardPreference: input.wardPreference },
      decisionTurtle: input.decisionTurtle,
      status: 'pending',
    };
    this.decisions.set(request.id, decision);
    return decision;
  }

  /**
   * A decider approves/denies the proposal — on quorum the *proposed* record (what the
   * guardians negotiated around) is SHACL-validated before it stands.
   */
  public async decide(requestId: string, guardianId: string, approve: boolean): Promise<WardDecision> {
    const decision = this.requireDecision(requestId);
    if (approve) {
      this.consents.approve(requestId, guardianId);
    } else {
      this.consents.deny(requestId, guardianId);
    }
    const request = this.consents.get(requestId);
    if (request.status === 'denied') {
      return this.finish(requestId, 'denied');
    }
    if (request.status !== 'approved') {
      return decision;
    }
    // Quorum met — the record must satisfy the recipe's SHACL shape.
    const conforms = await this.conforms(decision.recipe, decision.decisionTurtle);
    return this.finish(requestId, conforms ? 'approved' : 'rejected-record');
  }

  public get(requestId: string): WardDecision {
    return this.requireDecision(requestId);
  }

  private finish(requestId: string, status: WardDecision['status']): WardDecision {
    const decision = this.requireDecision(requestId);
    const updated = { ...decision, status };
    this.decisions.set(requestId, updated);
    return updated;
  }

  private requireDecision(requestId: string): WardDecision {
    const decision = this.decisions.get(requestId);
    if (decision === undefined) {
      throw new BadRequestHttpError(`Unknown ward decision "${requestId}".`);
    }
    return decision;
  }

  private member(memberId: string): HouseholdMember {
    const member = this.members.find(item => item.memberId === memberId);
    if (member === undefined) {
      throw new BadRequestHttpError(`No household member "${memberId}".`);
    }
    return member;
  }

  private async conforms(recipe: SafetyRecipe, turtle: string): Promise<boolean> {
    try {
      const shapes = new Store(new Parser().parse(recipe.shaclShape));
      const data = new Store(new Parser().parse(turtle));
      const factory = {
        ...DataFactory,
        dataset: (quads?: Iterable<Quad>): Store => new Store([ ...quads ?? [] ]),
      };
      const report = await new Validator(shapes, { factory }).validate({ dataset: data });
      return report.conforms;
    } catch {
      // A malformed record can never stand — fail closed.
      return false;
    }
  }
}
