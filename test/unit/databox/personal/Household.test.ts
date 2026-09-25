import {
  familyPolicy,
  planHousehold,
  shareHousePolicy,
} from '../../../../src/databox/personal/household/HouseholdProfile';
import type { HouseholdMember } from '../../../../src/databox/personal/household/HouseholdProfile';
import { NotFoundHttpError } from '../../../../src/util/errors/NotFoundHttpError';
import {
  adminApprovers,
  adminCanActAlone,
  adminQuorumCount,
  commonsApprovers,
  HouseholdConsentStore,
} from '../../../../src/databox/personal/household/HouseholdGovernance';

const FAMILY: HouseholdMember[] = [
  { memberId: 'mum', role: 'admin', capacity: 'full' },
  { memberId: 'dad', role: 'admin', capacity: 'full' },
  { memberId: 'kid', role: 'member', capacity: 'limited' },
];

const SHAREHOUSE: HouseholdMember[] = [
  { memberId: 'alice', role: 'admin', capacity: 'full' },
  { memberId: 'bob', role: 'admin', capacity: 'full' },
  { memberId: 'cat', role: 'admin', capacity: 'full' },
];

describe('planHousehold', (): void => {
  it('emits one pod per member plus a governed commons pod.', (): void => {
    const plan = planHousehold({
      householdId: 'fam-1',
      zone: 'family.example.org',
      members: FAMILY,
      policy: familyPolicy(2),
      originTarget: '127.0.0.1',
    });
    expect(plan.memberPods).toHaveLength(3);
    expect(plan.commonsPod.podHost).toBe('commons.family.example.org');
    expect(plan.memberPods[0].webId).toBe('https://mum.family.example.org/profile/card#me');
    expect(plan.memberPods.map(pod => pod.podHost)).toEqual([
      'mum.family.example.org',
      'dad.family.example.org',
      'kid.family.example.org',
    ]);
    expect(plan.policy.kind).toBe('family');
  });

  it('fails closed on no members, no admins, bad or duplicate labels.', (): void => {
    const base = {
      householdId: 'h',
      zone: 'z.example.org',
      policy: shareHousePolicy(),
      originTarget: 'x',
    };
    expect((): unknown => planHousehold({ ...base, members: []})).toThrow('at least one member');
    expect((): unknown => planHousehold({
      ...base,
      members: [{ memberId: 'a', role: 'member', capacity: 'full' }],
    })).toThrow('at least one admin');
    expect((): unknown => planHousehold({
      ...base,
      members: [{ memberId: 'a.b', role: 'admin', capacity: 'full' }],
    })).toThrow('not a valid DNS label');
    expect((): unknown => planHousehold({ ...base, members: [
      { memberId: 'a', role: 'admin', capacity: 'full' },
      { memberId: 'a', role: 'member', capacity: 'full' },
    ]})).toThrow('Duplicate member label');
  });
});

describe('Household governance models', (): void => {
  it('family: either parent acts alone (quorum 1); commons authority is the admins.', (): void => {
    const policy = familyPolicy(2);
    expect(adminCanActAlone(policy, FAMILY[0])).toBe(true);
    expect(adminCanActAlone(policy, FAMILY[2])).toBe(false);
    expect(adminApprovers(FAMILY)).toEqual([ 'mum', 'dad' ]);
    expect(commonsApprovers(policy, FAMILY)).toEqual([ 'mum', 'dad' ]);
    expect(adminQuorumCount(policy, FAMILY)).toBe(1);
  });

  it('share-house: consensus — every member approves admin actions and commons changes.', (): void => {
    const policy = shareHousePolicy();
    expect(adminCanActAlone(policy, SHAREHOUSE[0])).toBe(false);
    expect(adminQuorumCount(policy, SHAREHOUSE)).toBe(3);
    expect(commonsApprovers(policy, SHAREHOUSE)).toEqual([ 'alice', 'bob', 'cat' ]);
  });
});

describe('HouseholdConsentStore', (): void => {
  const fixed = (): number => 1_700_000_000_000;

  it('member-scope: a member grants another member scoped access electronically.', (): void => {
    const store = new HouseholdConsentStore(shareHousePolicy(), SHAREHOUSE, fixed);
    const request = store.requestMemberScope('alice', 'bob', { action: 'read', target: 'bills/' });
    expect(request.requiredApprovers).toEqual([ 'bob' ]);
    expect(store.mayExecute('alice', 'member-scope', 'read', request.id)).toBe(false);
    store.approve(request.id, 'bob');
    expect(store.get(request.id).status).toBe('approved');
    expect(store.mayExecute('alice', 'member-scope', 'read', request.id)).toBe(true);
  });

  it('admin quorum: a share-house add-member stalls until every admin approves.', (): void => {
    const store = new HouseholdConsentStore(shareHousePolicy(), SHAREHOUSE, fixed);
    const request = store.requestAdminAction('alice', { action: 'add-member', target: 'dana' });
    expect(request.quorum).toBe(3);
    store.approve(request.id, 'alice');
    expect(store.get(request.id).status).toBe('pending');
    store.approve(request.id, 'bob');
    expect(store.get(request.id).status).toBe('pending');
    store.approve(request.id, 'cat');
    expect(store.get(request.id).status).toBe('approved');
  });

  it('family sole-admin: either parent executes admin actions without a request.', (): void => {
    const store = new HouseholdConsentStore(familyPolicy(2), FAMILY, fixed);
    expect(store.mayExecute('mum', 'admin-action', 'add-member')).toBe(true);
    // A member (kid) still needs to petition the admins.
    expect(store.mayExecute('kid', 'admin-action', 'add-member')).toBe(false);
    const request = store.requestAdminAction('kid', { action: 'access-limited-member' });
    expect(request.requiredApprovers).toEqual([ 'mum', 'dad' ]);
    store.approve(request.id, 'mum');
    expect(store.get(request.id).status).toBe('approved');
    expect(store.mayExecute('kid', 'admin-action', 'access-limited-member', request.id)).toBe(true);
  });

  it('a limited-capacity target requires an admin counter-signature (guardian consent).', (): void => {
    const store = new HouseholdConsentStore(familyPolicy(2), FAMILY, fixed);
    const request = store.requestMemberScope('mum', 'kid', { action: 'read', target: 'kid/calendar' });
    // The kid AND an admin must approve — the child is not petitioned alone.
    expect(request.requiredApprovers).toEqual([ 'kid', 'mum', 'dad' ]);
    store.approve(request.id, 'kid');
    expect(store.get(request.id).status).toBe('pending');
    store.approve(request.id, 'mum');
    store.approve(request.id, 'dad');
    expect(store.get(request.id).status).toBe('approved');
  });

  it('a single denial closes a request (veto); non-approvers cannot vote.', (): void => {
    const store = new HouseholdConsentStore(shareHousePolicy(), SHAREHOUSE, fixed);
    const request = store.requestAdminAction('alice', { action: 'remove-member', target: 'bob' });
    expect((): unknown => store.approve(request.id, 'dana')).toThrow('not an approver');
    store.deny(request.id, 'bob');
    expect(store.get(request.id).status).toBe('denied');
    expect((): unknown => store.approve(request.id, 'cat')).toThrow('already denied');
  });

  it('member-consent disabled: member-scope requests are refused; unknowns 404.', (): void => {
    const noConsent = { ...shareHousePolicy(), memberConsent: false };
    const store = new HouseholdConsentStore(noConsent, SHAREHOUSE, fixed);
    expect((): unknown =>
      store.requestMemberScope('alice', 'bob', { action: 'read' })).toThrow('not enabled');

    const enabled = new HouseholdConsentStore(shareHousePolicy(), SHAREHOUSE, fixed);
    expect((): unknown => enabled.get('nope')).toThrow(NotFoundHttpError);
    expect((): unknown =>
      enabled.requestMemberScope('alice', 'nobody', { action: 'read' })).toThrow(NotFoundHttpError);
  });

  it('keeps an audit trail on every transition.', (): void => {
    const store = new HouseholdConsentStore(shareHousePolicy(), SHAREHOUSE, fixed);
    const request = store.requestMemberScope('alice', 'bob', { action: 'read', target: 'x' });
    store.approve(request.id, 'bob');
    const events = store.get(request.id).audit.map(entry => entry.event);
    expect(events).toEqual([ 'requested', 'approved' ]);
    expect(store.pendingFor('bob')).toHaveLength(0);
  });
});
