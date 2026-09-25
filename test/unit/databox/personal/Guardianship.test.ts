import { GuardianNetwork } from '../../../../src/databox/personal/household/GuardianNetwork';
import { isInForce, precedenceOf } from '../../../../src/databox/personal/household/Guardianship';
import { HouseholdConsentStore } from '../../../../src/databox/personal/household/HouseholdGovernance';
import type { HouseholdMember } from '../../../../src/databox/personal/household/HouseholdProfile';
import { shareHousePolicy } from '../../../../src/databox/personal/household/HouseholdProfile';
import { SAFETY_RECIPES, safetyRecipe } from '../../../../src/databox/personal/household/SafetyRecipes';
import { WardDecisionService } from '../../../../src/databox/personal/household/WardDecisions';

// A separated two-household family: child `kid` splits between `house-a` (mum + nan) and
// `house-b` (dad). Grandma `nan` is kinship (precedence 60) — parents trump her.
const MEMBERS: HouseholdMember[] = [
  { memberId: 'mum', role: 'admin', capacity: 'full' },
  { memberId: 'dad', role: 'admin', capacity: 'full' },
  { memberId: 'nan', role: 'member', capacity: 'full' },
  { memberId: 'kid', role: 'member', capacity: 'limited' },
  { memberId: 'aunt', role: 'member', capacity: 'full' },
  { memberId: 'elder', role: 'member', capacity: 'supported' },
];

function network(): GuardianNetwork {
  const net = new GuardianNetwork(MEMBERS);
  net.addRelation({
    wardId: 'kid',
    guardianId: 'mum',
    kind: 'parent',
    basis: 'statutory',
    scopes: [ 'residence', 'medical', 'online-contact', 'location-sharing', 'data-sharing', 'daily-care' ],
    households: [ 'house-a' ],
  });
  net.addRelation({
    wardId: 'kid',
    guardianId: 'dad',
    kind: 'parent',
    basis: 'statutory',
    scopes: [ 'residence', 'medical', 'online-contact', 'data-sharing' ],
    households: [ 'house-b' ],
  });
  net.addRelation({
    wardId: 'kid',
    guardianId: 'nan',
    kind: 'kinship',
    basis: 'agreement',
    scopes: [ 'daily-care', 'online-contact' ],
    households: [ 'house-a' ],
  });
  // Elder's supporters — they advise, never substitute.
  net.addRelation({
    wardId: 'elder',
    guardianId: 'aunt',
    kind: 'supporter',
    basis: 'agreement',
    scopes: [ 'daily-care', 'financial' ],
    households: [ 'house-a' ],
  });
  return net;
}

describe('GuardianNetwork', (): void => {
  it('parents outrank kinship — precedence ordering, not silence.', (): void => {
    const net = network();
    const guardians = net.guardiansFor('kid', 'online-contact');
    expect(guardians.map(relation => relation.guardianId)).toEqual([ 'mum', 'dad', 'nan' ]);
    expect(precedenceOf(guardians[0])).toBe(100);
    expect(precedenceOf(guardians[2])).toBe(60);
  });

  it('scopes are honoured per household — dad holds no online-contact in house-a.', (): void => {
    const net = network();
    // Dad's relation is house-b only; in house-a the top tier is mum alone.
    const guardians = net.guardiansFor('kid', 'online-contact', 'house-a');
    expect(guardians.map(relation => relation.guardianId)).toEqual([ 'mum', 'nan' ]);
  });

  it('expired relations hold no scope.', (): void => {
    const net = network();
    net.addRelation({
      wardId: 'kid',
      guardianId: 'aunt',
      kind: 'appointed',
      basis: 'court-order',
      scopes: [ 'medical' ],
      households: [ 'house-a' ],
      validUntil: '2020-01-01',
    });
    // Expired aunt absent; the parents still hold medical.
    expect(net.guardiansFor('kid', 'medical').map(relation => relation.guardianId))
      .toEqual([ 'mum', 'dad' ]);
  });

  it('resolveDecision: top-tier-all means BOTH parents must agree — a deadlock on split.', (): void => {
    const resolution = network().resolveDecision('kid', 'residence', safetyRecipe('residence-schedule'));
    expect(resolution.approvers).toEqual([ 'mum', 'dad' ]);
    expect(resolution.quorum).toBe(2);
    expect(resolution.wardVoice).toBe('required');
  });

  it('resolveDecision: emergency is top-tier-any — any guardian acts alone.', (): void => {
    const resolution = network().resolveDecision('kid', 'daily-care', safetyRecipe('emergency-safety'), 'house-a');
    expect(resolution.quorum).toBe(1);
    expect(resolution.approvers).toEqual([ 'mum' ]); // Top tier in house-a is mum
    expect(resolution.consulted).toEqual([ 'nan' ]); // Kinship consulted, not binding
  });

  it('ward-with-support: the supported person decides — supporters advise.', (): void => {
    const resolution = network().resolveDecision('elder', 'daily-care', safetyRecipe('supported-decision'));
    expect(resolution.approvers).toEqual([ 'elder' ]);
    expect(resolution.wardAssentRequired).toBe(true);
    expect(resolution.consulted).toEqual([ 'aunt' ]);
  });

  it('a ward with no scoped guardian is a surfaced gap, not an approval.', (): void => {
    expect((): unknown => network().resolveDecision('kid', 'legal', safetyRecipe('medical-major')))
      .toThrow('no in-force guardian');
  });

  it('fails closed on a self-guardian or unknown members.', (): void => {
    const net = new GuardianNetwork(MEMBERS);
    expect((): unknown => net.addRelation({
      wardId: 'kid',
      guardianId: 'kid',
      kind: 'parent',
      basis: 'statutory',
      scopes: [ 'medical' ],
      households: [ 'house-a' ],
    })).toThrow('own guardian');
    expect((): unknown => net.addRelation({
      wardId: 'ghost',
      guardianId: 'mum',
      kind: 'parent',
      basis: 'statutory',
      scopes: [ 'medical' ],
      households: [ 'house-a' ],
    })).toThrow('No household member');
  });

  it('isInForce: bounds + zero-scope inertness.', (): void => {
    expect(isInForce({
      wardId: 'w',
      guardianId: 'g',
      kind: 'parent',
      basis: 'statutory',
      scopes: [ 'medical' ],
      households: [ 'h' ],
      validFrom: '2030-01-01',
    })).toBe(false);
    expect(isInForce({
      wardId: 'w',
      guardianId: 'g',
      kind: 'parent',
      basis: 'statutory',
      scopes: [],
      households: [ 'h' ],
    })).toBe(false);
  });
});

describe('WardDecisionService', (): void => {
  const MEDICAL_OK = `
@prefix fam: <https://databox.example.org/ns/family#> .
<urn:decision:1> a fam:MajorMedicalConsent ;
  fam:treatment "tonsillectomy" ;
  fam:urgency "elective" ;
  fam:wardAssentRecorded true ;
  fam:alternativesConsidered "watchful waiting" .
`;
  const MEDICAL_BAD = `
@prefix fam: <https://databox.example.org/ns/family#> .
<urn:decision:2> a fam:MajorMedicalConsent ; fam:treatment "surgery" .
`;

  function service(): { svc: WardDecisionService; net: GuardianNetwork; consents: HouseholdConsentStore } {
    const net = network();
    const consents = new HouseholdConsentStore(shareHousePolicy(), MEMBERS, (): number => 1_700_000_000_000);
    return { svc: new WardDecisionService(net, consents, MEMBERS), net, consents };
  }

  it('a major-medical decision needs all scoped guardians and a SHACL-valid record.', async(): Promise<void> => {
    const { svc } = service();
    const decision = svc.request({
      requesterId: 'mum',
      wardId: 'kid',
      recipeId: 'medical-major',
      scope: 'medical',
      wardPreference: 'kid is scared but okay',
      decisionTurtle: MEDICAL_OK,
    });
    expect(decision.approvers).toEqual([ 'mum', 'dad' ]);
    expect(decision.status).toBe('pending');

    // One approval leaves it pending.
    let result = await svc.decide(decision.requestId, 'mum', true);
    expect(result.status).toBe('pending');
    // Both parents + conformant record → stands.
    result = await svc.decide(decision.requestId, 'dad', true);
    expect(result.status).toBe('approved');
  });

  it('a SHACL-violating record is rejected even when the guardians approve.', async(): Promise<void> => {
    const { svc } = service();
    const decision = svc.request({
      requesterId: 'mum',
      wardId: 'kid',
      recipeId: 'medical-major',
      scope: 'medical',
      wardPreference: 'unsure',
      decisionTurtle: MEDICAL_BAD,
    });
    await svc.decide(decision.requestId, 'mum', true);
    const result = await svc.decide(decision.requestId, 'dad', true);
    expect(result.status).toBe('rejected-record'); // Approval ≠ conformance — the shape disposes
  });

  it('a veto denies the decision outright.', async(): Promise<void> => {
    const { svc } = service();
    const decision = svc.request({
      requesterId: 'mum',
      wardId: 'kid',
      recipeId: 'residence-schedule',
      scope: 'residence',
      wardPreference: 'kid wants both houses',
      decisionTurtle: '<urn:d> a <https://databox.example.org/ns/family#ResidenceSchedule> .',
    });
    const result = await svc.decide(decision.requestId, 'dad', false);
    expect(result.status).toBe('denied'); // Dad's no is final — deadlock escalates, not steamrolls
  });

  it('the ward voice is required where the recipe demands it.', (): void => {
    const { svc } = service();
    expect((): unknown => svc.request({
      requesterId: 'mum',
      wardId: 'kid',
      recipeId: 'medical-major',
      scope: 'medical',
      decisionTurtle: MEDICAL_OK,
    })).toThrow('requires the ward\'s voice');
  });

  it('supported decisions belong to the ward alone — a supporter cannot open one.', (): void => {
    const { svc } = service();
    expect((): unknown => svc.request({
      requesterId: 'aunt',
      wardId: 'elder',
      recipeId: 'supported-decision',
      scope: 'daily-care',
      wardPreference: 'elder prefers home care',
      decisionTurtle: '<urn:d> a <https://databox.example.org/ns/family#SupportedDecisionRecord> .',
    })).toThrow('only the ward may open');
    // The elder themself may open it.
    const own = svc.request({
      requesterId: 'elder',
      wardId: 'elder',
      recipeId: 'supported-decision',
      scope: 'daily-care',
      wardPreference: 'I choose home care',
      decisionTurtle: '<urn:d> a <https://databox.example.org/ns/family#SupportedDecisionRecord> .',
    });
    expect(own.approvers).toEqual([ 'elder' ]);
  });
});

describe('SAFETY_RECIPES', (): void => {
  it('ships the rights-anchored catalog.', (): void => {
    expect(SAFETY_RECIPES.map(recipe => recipe.id)).toEqual([
      'online-contact-boundary',
      'data-sharing-third-party',
      'location-sharing',
      'residence-schedule',
      'medical-major',
      'supported-decision',
      'emergency-safety',
    ]);
    for (const recipe of SAFETY_RECIPES) {
      expect(recipe.rightsAnchors.length).toBeGreaterThan(0);
      expect(recipe.shaclShape).toContain('sh:NodeShape');
    }
  });
});
