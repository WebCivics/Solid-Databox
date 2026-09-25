import { ChainOfCustody } from '../../../../../../src/databox/ipms/modules/supply-chain/ChainOfCustody';

let clock = '2026-01-01T00:00:00Z';
const chain = (): ChainOfCustody => new ChainOfCustody([ 'epa-certifier', 'trade-licence-board' ], () => clock);

describe('ChainOfCustody — credentialed supply-chain provenance (CIV-B26)', (): void => {
  beforeEach((): void => {
    clock = '2026-01-01T00:00:00Z';
  });

  it('a trusted-issuer credential lets a supplier add custody — hash-chained provenance.', (): void => {
    const c = chain();
    const cred = c.issueCredential('supplier-timber', 'epa-certifier', 'recycled-certified', '2027-01-01');
    const e1 = c.addCustody('timber-bean-42', cred, 'origin');
    const e2 = c.addCustody('timber-bean-42', cred, 'handoff');
    expect(c.provenance('timber-bean-42')).toHaveLength(2);
    expect(e2.prevDigest).toBe(e1.entryDigest);
    expect(c.verify().valid).toBe(true);
  });

  it('an untrusted issuer, a tampered credential or an expired one cannot write custody.', (): void => {
    const c = chain();
    // Untrusted issuer — can't mint in this chain.
    expect((): unknown => c.issueCredential('x', 'rogue-issuer', 'licensed', '2027-01-01'))
      .toThrow('not a trusted certifier');
    // A credential minted but tampered (custodian swapped).
    const cred = c.issueCredential('supplier', 'epa-certifier', 'licensed', '2027-01-01');
    const forged = { ...cred, custodian: 'impostor' };
    expect((): unknown => c.addCustody('item', forged, 'handoff')).toThrow('signature');
    // Expired.
    clock = '2028-01-01T00:00:00Z';
    const stale = c.issueCredential('supplier', 'epa-certifier', 'licensed', '2027-01-01');
    expect((): unknown => c.addCustody('item', stale, 'handoff')).toThrow('expired');
  });

  it('a forged provenance step breaks the chain verification (T-27).', (): void => {
    const c = chain();
    const cred = c.issueCredential('supplier', 'epa-certifier', 'licensed', '2027-01-01');
    c.addCustody('item', cred, 'origin');
    interface Mutable { entries: { custodian: string }[] }
    const internals = c as unknown as Mutable;
    internals.entries[0] = { ...internals.entries[0], custodian: 'forged' };
    expect(c.verify().valid).toBe(false);
  });
});
