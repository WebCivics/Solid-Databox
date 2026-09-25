import { AnonymousAuditLedger } from '../../../../src/databox/credential/AnonymousAuditLedger';

function presentation(over = {}) {
  return {
    nullifier: 'nul-abc',
    scheme: 'concession-pensioner',
    verifier: 'https://cafe.example#pos',
    epoch: '2026-Q1',
    ...over,
  };
}

describe('AnonymousAuditLedger — valid-presentation proof without the holder (CIV-B09)', (): void => {
  it('records a valid presentation keyed by nullifier — no holder identity.', (): void => {
    const ledger = new AnonymousAuditLedger();
    const record = ledger.record(presentation(), true);
    expect(record.scheme).toBe('concession-pensioner');
    expect(JSON.stringify(ledger.records())).not.toContain('alice'); // No holder id anywhere.
    expect(ledger.verify().valid).toBe(true);
  });

  it('rejects a replayed nullifier (double-present) but allows a new epoch/verifier.', (): void => {
    const ledger = new AnonymousAuditLedger();
    ledger.record(presentation(), true);
    expect((): unknown => ledger.record(presentation(), true)).toThrow('replay');
    // Same credential, different verifier → different nullifier semantics allowed.
    ledger.record(presentation({ nullifier: 'nul-xyz', verifier: 'https://other.example' }), true);
    ledger.record(presentation({ nullifier: 'nul-newepoch', epoch: '2026-Q2' }), true);
    expect(ledger.records()).toHaveLength(3);
  });

  it('rejects an invalid/revoked credential assertion — fail closed.', (): void => {
    const ledger = new AnonymousAuditLedger();
    expect((): unknown => ledger.record(presentation(), false)).toThrow('invalid or revoked');
    expect(ledger.records()).toHaveLength(0);
  });

  it('counts program volume per scheme+epoch without identifying holders.', (): void => {
    const ledger = new AnonymousAuditLedger();
    ledger.record(presentation(), true);
    ledger.record(presentation({ nullifier: 'nul-2' }), true);
    expect(ledger.volume('concession-pensioner', '2026-Q1')).toBe(2);
    expect(ledger.volume('concession-pensioner', '2026-Q2')).toBe(0);
  });
});
