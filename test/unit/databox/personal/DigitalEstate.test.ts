import { DigitalEstate } from '../../../../src/databox/personal/DigitalEstate';

const bequests = [
  { resourceClass: 'records/', beneficiary: 'https://pod/heir#me', mode: 'custody' as const },
  { resourceClass: 'photos/', beneficiary: 'https://pod/heir#me', mode: 'access' as const },
];

describe('DigitalEstate — standing instructions for death/incapacity (CIV-B49)', (): void => {
  it('declares a digest-bound instruction and fires only on quorum attestation.', (): void => {
    const estate = new DigitalEstate();
    const inst = estate.declare('grantor', 'death', [ 'a', 'b' ], bequests);
    expect(estate.evaluate(inst.instructionDigest)).toBeUndefined(); // Unattested — nothing fires.
    estate.attest(inst.instructionDigest, 'a');
    expect(estate.evaluate(inst.instructionDigest)).toBeUndefined(); // Quorum 2 not met.
    estate.attest(inst.instructionDigest, 'b');
    const outcome = estate.evaluate(inst.instructionDigest);
    expect(outcome?.bequests).toHaveLength(2); // Both attestors confirmed → the estate fires.
  });

  it('a non-attestor cannot confirm, and only the grantor can revoke.', (): void => {
    const estate = new DigitalEstate();
    const inst = estate.declare('grantor', 'incapacity', [ 'a' ], bequests);
    expect((): void => estate.attest(inst.instructionDigest, 'mallory')).toThrow('not a named attestor');
    expect((): void => estate.revoke(inst.instructionDigest, 'not-the-grantor')).toThrow('grantor');
    estate.attest(inst.instructionDigest, 'a');
    expect(estate.evaluate(inst.instructionDigest)).toBeDefined();
    estate.revoke(inst.instructionDigest, 'grantor');
    expect(estate.evaluate(inst.instructionDigest)).toBeUndefined(); // Revoked — never fires.
  });

  it('fails closed on a malformed declaration (no attestor / bequest / quorum range).', (): void => {
    const estate = new DigitalEstate();
    expect((): unknown => estate.declare('g', 'death', [], bequests)).toThrow('attestor');
    expect((): unknown => estate.declare('g', 'death', [ 'a' ], [])).toThrow('bequest');
    expect((): unknown => estate.declare('g', 'death', [ 'a' ], bequests, 5)).toThrow('Quorum');
  });
});
