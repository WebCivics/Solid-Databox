import { scopeDisclosure } from '../../../../src/databox/disclosure/ScopedDisclosure';

const holderAttrs = {
  'allergen-gluten': true,
  'diet-vegan': true,
  'health-income': 12_000,
  'health-diagnosis': 'coeliac',
};

const policy = [
  { attribute: 'allergen-gluten', scope: 'always' as const },
  { attribute: 'diet-vegan', scope: 'purpose-scoped' as const, purposes: [ 'menu-match' ]},
  { attribute: 'health-income', scope: 'consent-required' as const },
  { attribute: 'health-diagnosis', scope: 'never' as const },
];

function request(over = {}) {
  return {
    recipient: 'https://cafe.example#pos',
    purpose: 'menu-match',
    attributes: [ 'allergen-gluten', 'diet-vegan', 'health-income', 'health-diagnosis', 'undeclared' ],
    ...over,
  };
}

describe('ScopedDisclosure — minimal permitted attributes (CIV-B41)', (): void => {
  it('discloses only the requested+permitted attributes — never the rest.', (): void => {
    const p = scopeDisclosure(request(), holderAttrs, policy);
    expect(p.disclosed['allergen-gluten']).toBe(true);
    expect(p.disclosed['diet-vegan']).toBe(true); // Purpose matches.
    expect(p.disclosed).not.toHaveProperty('health-income'); // Consent-required, not consented.
    expect(p.disclosed).not.toHaveProperty('health-diagnosis'); // Never.
    expect(p.disclosed).not.toHaveProperty('undeclared'); // Not carried.
    expect(p.denied).toEqual(expect.arrayContaining([ 'health-income', 'health-diagnosis' ]));
    expect(p.presentationDigest).toMatch(/^urn:sha256/u);
  });

  it('an undeclared attribute defaults to never — fail closed.', (): void => {
    const p = scopeDisclosure(request({ attributes: [ 'allergen-gluten' ]}), holderAttrs, []);
    expect(p.disclosed).toEqual({}); // No policy ⇒ nothing is permitted.
    expect(p.denied).toContain('allergen-gluten');
  });

  it('a consent-required attribute discloses only on active consent.', (): void => {
    expect(scopeDisclosure(request(), holderAttrs, policy).disclosed).not.toHaveProperty('health-income');
    const consented = scopeDisclosure(request(), holderAttrs, policy, { consented: true });
    expect(consented.disclosed['health-income']).toBe(12_000);
  });

  it('the presentation is bound to its recipient+purpose — a re-scope digest differs.', (): void => {
    const forCafe = scopeDisclosure(request(), holderAttrs, policy, { now: (): string => '2026-01-01T00:00:00Z' });
    const forOther = scopeDisclosure(request({ recipient: 'https://other.example#x' }), holderAttrs, policy, { now: (): string => '2026-01-01T00:00:00Z' });
    expect(forCafe.presentationDigest).not.toBe(forOther.presentationDigest); // Not re-scopable.
  });

  it('fails closed on a request with no recipient/purpose.', (): void => {
    expect((): unknown => scopeDisclosure(request({ recipient: ' ' }), holderAttrs, policy))
      .toThrow('recipient');
  });
});
