import { BoundedSpace } from '../../../../../../src/databox/ipms/modules/social/BoundedSpace';
import type { GuardianshipRelation } from '../../../../../../src/databox/personal/household/Guardianship';

const childBound: GuardianshipRelation = {
  wardId: 'child-1',
  guardianId: 'guardian-a',
  kind: 'parent',
  scopes: [ 'online-contact' ],
  households: [ 'house-1' ],
  basis: 'statutory',
};

describe('BoundedSpace — community + child-safe social space (CIV-B51/B52)', (): void => {
  it('adults join and post; posts are hash-chained and tamper-evident.', (): void => {
    const space = new BoundedSpace('community-garden-group');
    space.admit('alice', 'adult');
    space.admit('bob', 'adult');
    const p1 = space.post('alice', 'seed swap saturday');
    const p2 = space.post('bob', 'i will bring tools');
    expect(space.memberList()).toHaveLength(2);
    expect(p2.prevDigest).toBe(p1.postDigest);
    expect(space.verify().valid).toBe(true);
  });

  it('a child member is admitted only under a declared online-contact bound — and re-checked on post.', (): void => {
    const space = new BoundedSpace('family-space', [ childBound ]);
    // With the bound declared — the child joins.
    space.admit('child-1', 'child', 'guardian-a', 'house-1');
    expect(space.post('child-1', 'hello nan').memberId).toBe('child-1');
    // Without a bound — a child can't join a space the guardianship doesn't cover.
    const unbound = new BoundedSpace('public-space');
    expect((): unknown => unbound.admit('child-2', 'child', 'guardian-x', 'house-1'))
      .toThrow('online-contact');
  });

  it('a non-member cannot post — the space is bounded.', (): void => {
    const space = new BoundedSpace('closed');
    space.admit('alice', 'adult');
    expect((): unknown => space.post('stranger', 'x')).toThrow('not a member');
  });

  it('a tampered post breaks the chain (safeguarding review integrity).', (): void => {
    const space = new BoundedSpace('mod');
    space.admit('alice', 'adult');
    space.post('alice', 'original');
    interface Mutable { posts: { body: string }[] }
    const internals = space as unknown as Mutable;
    internals.posts[0] = { ...internals.posts[0], body: 'edited' };
    expect(space.verify().valid).toBe(false);
  });
});
