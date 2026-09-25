import { ProgrammableGrant } from '../../../../../../src/databox/ipms/modules/concessions/ProgrammableGrant';

function grant(over = {}) {
  return new ProgrammableGrant({
    grantId: 'gv-1',
    beneficiaryId: 'https://pod/alice#me',
    scheme: 'emergency-food',
    currency: 'AUD',
    balance: 200,
    rules: {
      permittedCategories: [ 'grocery', 'transport' ],
      maxPerTransaction: 50,
      expiresAt: '2027-01-01T00:00:00Z',
    },
    ...over,
  });
}

describe('ProgrammableGrant — bounded rule-scoped concession balance (CIV-B08)', (): void => {
  it('spends only at a permitted category, within cap and balance — hash-chained.', (): void => {
    const g = grant();
    const s1 = g.spend(30, 'grocery', 'coles#t1');
    const s2 = g.spend(20, 'transport', 'bus#t2');
    expect(g.balance()).toBe(150);
    expect(s2.prevDigest).toBe(s1.recordDigest);
    expect(g.verify().valid).toBe(true);
    expect(g.ledger()).toHaveLength(2);
  });

  it('rejects a disallowed category, an over-cap spend, and an overspend of the balance.', (): void => {
    const g = grant();
    expect((): unknown => g.spend(10, 'alcohol', 'bottle-shop')).toThrow('not permitted');
    expect((): unknown => g.spend(60, 'grocery', 'x')).toThrow('cap');
    // Drain the balance to below the next spend — then the spend fails on balance, not cap.
    g.spend(50, 'grocery', 'a');
    g.spend(50, 'grocery', 'b');
    g.spend(50, 'grocery', 'c');
    g.spend(50, 'grocery', 'd'); // Balance now 0.
    expect((): unknown => g.spend(10, 'grocery', 'e')).toThrow('Insufficient');
  });

  it('an expired grant is dormant — spend fails closed.', (): void => {
    const past = new ProgrammableGrant({
      grantId: 'gv-x',
      beneficiaryId: 'b',
      scheme: 's',
      currency: 'AUD',
      balance: 10,
      rules: { permittedCategories: [ 'grocery' ], maxPerTransaction: 5, expiresAt: '2020-01-01T00:00:00Z' },
    });
    expect((): unknown => past.spend(5, 'grocery', 'x')).toThrow('expired');
  });

  it('a tampered spend record fails verification (T-27).', (): void => {
    const g = grant();
    g.spend(30, 'grocery', 'coles');
    interface Mutable { records: { amount: number }[] }
    const internals = g as unknown as Mutable;
    internals.records[0] = { ...internals.records[0], amount: 0.01 };
    expect(g.verify().valid).toBe(false);
  });
});
