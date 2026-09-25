import { enforceBoundary, privyBoundary } from '../../../../src/databox/policy/BoundaryEnforcer';
import type { GuardianshipRelation } from '../../../../src/databox/personal/household/Guardianship';

function relation(over = {}): GuardianshipRelation {
  return {
    wardId: 'ward-1',
    guardianId: 'guardian-a',
    kind: 'parent',
    scopes: [ 'medical' ],
    households: [ 'house-1' ],
    basis: 'statutory',
    ...over,
  };
}

describe('BoundaryEnforcer — declared bounds, deterministically enforced (CIV-B31)', (): void => {
  it('allows only a live relation that holds the scope in the household.', (): void => {
    const relations = [ relation() ];
    const ok = enforceBoundary(relations, 'ward-1', 'guardian-a', 'medical', 'house-1');
    expect(ok.verdict).toBe('allowed');
    expect(ok.grounding).toHaveLength(1);
    // Different scope — the guardian holds medical only.
    expect(enforceBoundary(relations, 'ward-1', 'guardian-a', 'financial', 'house-1').verdict).toBe('denied');
    // Different household — the relation is confined to house-1.
    expect(enforceBoundary(relations, 'ward-1', 'guardian-a', 'medical', 'house-2').verdict).toBe('denied');
    // A non-guardian — nothing.
    expect(enforceBoundary(relations, 'ward-1', 'stranger', 'medical', 'house-1').verdict).toBe('denied');
  });

  it('an expired relation holds no scope — the boundary closes.', (): void => {
    const expired = relation({ validFrom: '2020-01-01', validUntil: '2020-12-31' });
    const verdict = enforceBoundary([ expired ], 'ward-1', 'guardian-a', 'medical', 'house-1', '2026-01-01');
    expect(verdict.verdict).toBe('denied');
    expect(verdict.reason).toContain('No live');
  });

  it('privy access — a specialist sees a scope they advise on without holding the decision.', (): void => {
    const specialist = relation({
      guardianId: 'dr-b',
      kind: 'specialist',
      scopes: [],
      informationAccess: [ 'medical' ],
    });
    expect(privyBoundary([ specialist ], 'ward-1', 'dr-b', 'medical', 'house-1').verdict).toBe('allowed');
    // But the advisor cannot DECIDE — the decision boundary stays denied.
    expect(enforceBoundary([ specialist ], 'ward-1', 'dr-b', 'medical', 'house-1').verdict).toBe('denied');
  });

  it('the verdict is a pure function of the declarations — deterministic + un-overridable.', (): void => {
    const relations = [ relation() ];
    const a = enforceBoundary(relations, 'ward-1', 'guardian-a', 'medical', 'house-1');
    const b = enforceBoundary(relations, 'ward-1', 'guardian-a', 'medical', 'house-1');
    expect(a).toEqual(b); // Same inputs ⇒ same verdict — no probabilistic drift.
    // The enforcer takes no override/confidence input — an out-of-scope ask is denied regardless.
    expect(enforceBoundary(relations, 'ward-1', 'guardian-a', 'legal', 'house-1').verdict).toBe('denied');
  });
});
