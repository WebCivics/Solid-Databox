import { BadRequestHttpError } from '../../../../util/errors/BadRequestHttpError';
import { InternalServerError } from '../../../../util/errors/InternalServerError';
import { canonicalDigest } from '../../../proof/Canonicalization';
import { GENESIS_PREV_DIGEST } from '../../../evidence/EvidenceChain';
import type { GuardianshipRelation } from '../../../personal/household/Guardianship';
import { enforceBoundary } from '../../../policy/BoundaryEnforcer';
import type { BoundaryDecision } from '../../../policy/BoundaryEnforcer';

/**
 * Bounded community social spaces (CIV-B51/B52, `social-web.html`): a cooperative's shared space —
 * a community group's space, a club's space, a family space — is a BOUNDED space: membership is by
 * admission (a member joins the bounded space), posts are attributed and logged, and the space's
 * bounds are enforced — not a free-for-all.
 *
 * For a MINOR (B52 — the child-safe bounded space): a child's participation is governed by their
 * guardian's declared `online-contact` scope. The child's `join`/`post` is gated through the
 * deterministic `BoundaryEnforcer` — a guardian with `online-contact` for the ward in that
 * household must have the scope declared (the enforcer takes no override — a social feature can't
 * grant a child access the guardianship doesn't declare). So the child's digital social space is
 * bounded by the SAME declared guardianship boundary that governs the rest of their digital life —
 * never bypassed by a convenience flag.
 *
 * A space's posts are append-only and hash-chained — the space's record of what was said is
 * tamper-evident (a deleted/edited post breaks the chain), supporting moderation and safeguarding
 * review.
 */

export type MemberKind = 'adult' | 'child';

export interface SpaceMember {
  /** The member's pairwise id. */
  readonly memberId: string;
  readonly kind: MemberKind;
  /** For a child member: the household the bounds are checked in. */
  readonly household?: string;
  readonly joinedAt: string;
}

export interface SpacePost {
  readonly sequence: number;
  readonly memberId: string;
  readonly body: string;
  readonly postedAt: string;
  readonly prevDigest: string;
  readonly postDigest: string;
}

export class BoundedSpace {
  private readonly members = new Map<string, SpaceMember>();
  private readonly posts: SpacePost[] = [];
  private readonly guardianships: readonly GuardianshipRelation[];
  private readonly now: () => string;

  /**
   * @param spaceId - The space's id.
   * @param guardianships - The ward's declared guardianship relations (child-member gating).
   */
  public constructor(
    public readonly spaceId: string,
    guardianships: GuardianshipRelation[] = [],
    now: () => string = (): string => new Date().toISOString(),
  ) {
    if (spaceId.trim().length === 0) {
      throw new InternalServerError('A bounded space needs an id.');
    }
    this.guardianships = [ ...guardianships ];
    this.now = now;
  }

  /**
   * Admit a member. An `adult` joins directly. A `child` requires a guardian's live
   * `online-contact` scope for their household — enforced through `BoundaryEnforcer` (deterministic:
   * the bounds are declared, never inferred). Fails closed on a child with no declared scope.
   */
  public admit(memberId: string, kind: MemberKind, guardianId?: string, household?: string): SpaceMember {
    if (memberId.trim().length === 0) {
      throw new BadRequestHttpError('A member needs a pairwise id.');
    }
    if (this.members.has(memberId)) {
      throw new BadRequestHttpError(`'${memberId}' is already a member of '${this.spaceId}'.`);
    }
    if (kind === 'child') {
      if (guardianId === undefined || household === undefined) {
        throw new BadRequestHttpError('A child member needs a guardian + household for the bound check.');
      }
      const decision: BoundaryDecision = enforceBoundary(
        this.guardianships,
        memberId,
        guardianId,
        'online-contact',
        household,
        this.now(),
      );
      if (decision.verdict !== 'allowed') {
        throw new BadRequestHttpError(
          `No declared online-contact scope covers this child — admission fails closed (${decision.reason}).`,
        );
      }
    }
    const member: SpaceMember = Object.freeze({ memberId, kind, household, joinedAt: this.now() });
    this.members.set(memberId, member);
    return member;
  }

  /**
   * Post to the space — members only. A child's post re-checks their bound (a lapsed/revoked
   * guardianship scope closes the space to them immediately). Every post is hash-chained — the
   * space's record is tamper-evident for moderation.
   */
  public post(memberId: string, body: string): SpacePost {
    const member = this.members.get(memberId);
    if (member === undefined) {
      throw new BadRequestHttpError(`'${memberId}' is not a member of '${this.spaceId}'.`);
    }
    if (body.trim().length === 0) {
      throw new BadRequestHttpError('A post needs a body.');
    }
    if (member.kind === 'child') {
      // Re-check the child's bound — a guardian revocation closes the space between join and post.
      const stillBounded = [ ...this.guardianships ].some(relation =>
        relation.wardId === memberId &&
        enforceBoundary(
          this.guardianships,
          memberId,
          relation.guardianId,
          'online-contact',
          member.household ?? '',
          this.now(),
        ).verdict === 'allowed');
      if (!stillBounded) {
        throw new BadRequestHttpError('The child\'s online-contact bound is no longer active.');
      }
    }
    const base = {
      sequence: this.posts.length,
      memberId,
      body,
      postedAt: this.now(),
      prevDigest: this.posts.at(-1)?.postDigest ?? GENESIS_PREV_DIGEST,
    };
    const post: SpacePost = Object.freeze({ ...base, postDigest: canonicalDigest(base) });
    this.posts.push(post);
    return post;
  }

  /** The space's members. */
  public memberList(): readonly SpaceMember[] {
    return [ ...this.members.values() ];
  }

  /** The space's posts — append-only, hash-chained. */
  public feed(): readonly SpacePost[] {
    return [ ...this.posts ];
  }

  /** Verify the post chain — a tampered/edited post fails (T-27). */
  public verify(): { readonly valid: boolean } {
    for (const [ index, post ] of this.posts.entries()) {
      const { postDigest, ...contents } = post;
      const expected = index === 0 ? GENESIS_PREV_DIGEST : this.posts[index - 1].postDigest;
      if (post.sequence !== index || post.prevDigest !== expected ||
        postDigest !== canonicalDigest(contents)) {
        return { valid: false };
      }
    }
    return { valid: true };
  }
}
