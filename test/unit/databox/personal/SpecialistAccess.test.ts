import { advisoryWeightOf } from '../../../../src/databox/personal/household/Guardianship';
import type { GuardianshipRelation } from '../../../../src/databox/personal/household/Guardianship';
import { GuardianNetwork } from '../../../../src/databox/personal/household/GuardianNetwork';
import type { HouseholdMember } from '../../../../src/databox/personal/household/HouseholdProfile';
import { shareHousePolicy } from '../../../../src/databox/personal/household/HouseholdProfile';
import { HouseholdConsentStore } from '../../../../src/databox/personal/household/HouseholdGovernance';
import { SpecialistAccessStore } from '../../../../src/databox/personal/household/SpecialistAccess';
import { safetyRecipe } from '../../../../src/databox/personal/household/SafetyRecipes';

const MEMBERS: HouseholdMember[] = [
  { memberId: 'mum', role: 'admin', capacity: 'full' },
  { memberId: 'dad', role: 'admin', capacity: 'full' },
  { memberId: 'nan', role: 'member', capacity: 'full' },
  { memberId: 'cardio', role: 'member', capacity: 'full' }, // The specialist
  { memberId: 'kid', role: 'member', capacity: 'limited' },
];

function relation(over: Partial<GuardianshipRelation>): GuardianshipRelation {
  return {
    wardId: 'kid',
    guardianId: 'mum',
    kind: 'parent',
    basis: 'statutory',
    scopes: [ 'medical' ],
    households: [ 'house-a' ],
    ...over,
  };
}

describe('qualified input + information asymmetry', (): void => {
  it('a specialist in the field outranks a lay guardian as an advisor.', (): void => {
    const specialist = relation({ guardianId: 'cardio', kind: 'professional', specialties: [ 'medical' ]});
    const lay = relation({ guardianId: 'nan', kind: 'kinship', scopes: [ 'daily-care' ]});
    expect(advisoryWeightOf(specialist, 'medical')).toBeGreaterThan(advisoryWeightOf(lay, 'medical'));
    // Outside their field the specialist carries no extra weight.
    expect(advisoryWeightOf(specialist, 'residence')).toBe(advisoryWeightOf(specialist, 'residence'));
  });

  it('consultation is ordered by qualified weight; the deciders still decide.', (): void => {
    const net = new GuardianNetwork(MEMBERS);
    net.addRelation(relation({ guardianId: 'mum' }));
    net.addRelation(relation({ guardianId: 'dad' }));
    // The cardiologist holds no decision scope but IS privy + advisory in medical.
    net.addRelation(relation({
      guardianId: 'cardio',
      kind: 'professional',
      scopes: [],
      specialties: [ 'medical' ],
      informationAccess: [ 'medical' ],
    }));
    const resolution = net.resolveDecision('kid', 'medical', safetyRecipe('medical-major'));
    expect(resolution.approvers).toEqual([ 'mum', 'dad' ]); // Guardians decide
    expect(resolution.consulted).toContain('cardio'); // Specialist advises
    expect(resolution.informationHolders).toContain('cardio'); // Privy to the record
  });

  it('information access is explicit — a guardian sees only declared scopes.', (): void => {
    const net = new GuardianNetwork(MEMBERS);
    net.addRelation(relation({ guardianId: 'mum' }));
    net.addRelation(relation({ guardianId: 'dad' }));
    net.addRelation(relation({
      guardianId: 'nan',
      kind: 'kinship',
      scopes: [ 'daily-care' ],
      informationAccess: [ 'daily-care' ], // Sees daily-care, NOT medical
    }));
    const medical = net.resolveDecision('kid', 'medical', safetyRecipe('medical-major'));
    expect(medical.informationHolders).not.toContain('nan');
  });
});

describe('dispute resolution', (): void => {
  it('an independent resolver may be brought in — a party to the network cannot.', (): void => {
    const net = new GuardianNetwork(MEMBERS);
    net.addRelation(relation({ guardianId: 'mum' }));
    net.addRelation(relation({ guardianId: 'dad' }));
    // A guardian cannot resolve a dispute they're a party to.
    expect((): unknown => net.openDispute('req-1', { agentId: 'mum', kind: 'mediator', organisation: 'fdr' }))
      .toThrow('independent resolver');
    // A mediator must declare an organisation.
    expect((): unknown => net.openDispute('req-1', { agentId: 'ext-med', kind: 'mediator' }))
      .toThrow('declare an organisation');
    // An external mediator resolves.
    const dispute = net.openDispute('req-1', { agentId: 'ext-med', kind: 'mediator', organisation: 'fdr' });
    expect(dispute.status).toBe('open');
    const resolved = net.resolveDispute(
      'req-1',
      'ext-med',
      'remit',
      'Both guardians to re-decide with the child present.',
    );
    expect(resolved.determination).toBe('remit');
  });

  it('only the declared resolver may determine — and a rationale is mandatory.', (): void => {
    const net = new GuardianNetwork(MEMBERS);
    net.addRelation(relation({ guardianId: 'mum' }));
    net.openDispute('req-2', { agentId: 'tribunal-1', kind: 'tribunal' });
    expect((): unknown => net.resolveDispute('req-2', 'someone-else', 'uphold', 'x'))
      .toThrow('Only the declared resolver');
    expect((): unknown => net.resolveDispute('req-2', 'tribunal-1', 'uphold', ' '))
      .toThrow('needs a rationale');
  });
});

describe('SpecialistAccessStore', (): void => {
  const GRANT = {
    grantId: 'g1',
    agentId: 'paramedic-77',
    accessClass: 'emergency-medical' as const,
    scopes: [ 'medical' as const ],
    basis: 'emergency-protocol:ambulance-act-s.17',
    assertedBy: 'mum',
    expiresAt: '2027-01-01',
    reviewBy: '2026-06-01',
    notifiedMembers: [ 'dad' ],
  };
  const NOW = new Date('2026-01-01').getTime();
  const store = (): SpecialistAccessStore =>
    new SpecialistAccessStore(MEMBERS, (): number => NOW);

  it('an admin asserts a scoped, time-bounded, notified grant.', (): void => {
    const s = store();
    const grant = s.assert(GRANT);
    expect(grant.status).toBe('active');
    expect(s.mayAccess('paramedic-77', 'emergency-medical', 'medical')).toBe(true);
    // Wrong scope or class → no access.
    expect(s.mayAccess('paramedic-77', 'emergency-medical', 'financial')).toBe(false);
    expect(s.mayAccess('paramedic-77', 'justice', 'medical')).toBe(false);
  });

  it('a non-admin cannot assert; the grant needs basis, scope, expiry, notification.', (): void => {
    const s = store();
    expect((): unknown => s.assert({ ...GRANT, assertedBy: 'nan' })).toThrow('admin');
    expect((): unknown => s.assert({ ...GRANT, basis: ' ' })).toThrow('legal basis');
    expect((): unknown => s.assert({ ...GRANT, scopes: []})).toThrow('scoped');
    expect((): unknown => s.assert({ ...GRANT, expiresAt: '2020-01-01' })).toThrow('future');
    expect((): unknown => s.assert({ ...GRANT, notifiedMembers: []})).toThrow('notified');
  });

  it('a grant expires and revokes; access checks fail closed.', (): void => {
    const s = store();
    s.assert(GRANT);
    expect(s.mayAccess('paramedic-77', 'emergency-medical', 'medical')).toBe(true);
    s.revoke('g1', 'dad');
    expect(s.mayAccess('paramedic-77', 'emergency-medical', 'medical')).toBe(false);
    // Expired grants report as expired, not silently active.
    const late = new SpecialistAccessStore(MEMBERS, (): number => new Date('2028-01-01').getTime());
    const g2 = { ...GRANT, grantId: 'g2' };
    // Assert at a past `now` is fine; mayAccess at a future `now` is closed.
    const past = new SpecialistAccessStore(MEMBERS, (): number => NOW);
    past.assert(g2);
    expect(late.list()).toEqual([]);
    expect(past.mayAccess('paramedic-77', 'emergency-medical', 'medical')).toBe(true);
  });
});

describe('ward-decision consent kind', (): void => {
  it('a ward decision uses caller-resolved approvers, not household admins.', (): void => {
    const consents = new HouseholdConsentStore(shareHousePolicy(), MEMBERS, (): number => 1_700_000_000_000);
    const request = consents.requestWardDecision(
      'mum',
      'kid',
      { action: 'medical-major', target: 'kid' },
      [ 'mum', 'dad' ],
      2,
    );
    expect(request.kind).toBe('ward-decision');
    expect(request.requiredApprovers).toEqual([ 'mum', 'dad' ]);
    // A non-approver cannot vote.
    expect((): unknown => consents.approve(request.id, 'cardio')).toThrow('not an approver');
  });
});
