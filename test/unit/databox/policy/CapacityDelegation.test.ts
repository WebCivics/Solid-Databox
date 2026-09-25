import {
  effectiveScope,
  isDelegationLive,
  validateDelegation,
} from '../../../../src/databox/policy/CapacityDelegation';
import type { DutySliceDelegation } from '../../../../src/databox/policy/CapacityDelegation';

function delegation(over = {}): DutySliceDelegation {
  return {
    grantor: 'guardian-a',
    grantee: 'child-1',
    scopes: [ 'daily-care', 'education', 'financial' ],
    requiredCapacity: 'emerging',
    ...over,
  };
}

describe('CapacityDelegation — duty-slice + capacity-scaled (CIV-B02)', (): void => {
  it('a full-capacity grantee holds the whole delegated slice; a bounded slice only.', (): void => {
    expect(effectiveScope(delegation(), 'full')).toEqual([ 'daily-care', 'education', 'financial' ]);
    // The delegation never grants outside its declared slice.
    expect(effectiveScope(delegation(), 'full')).not.toContain('legal'); // Not in the slice.
  });

  it('capacity-scales: a supported/limited grantee holds assistance-class slices only.', (): void => {
    // A supported person retains capacity but can't be delegated a SUBSTITUTED decision.
    expect(effectiveScope(delegation(), 'supported')).toEqual([ 'daily-care', 'education' ]); // No `financial`.
    // A limited grantee is below the 'emerging' floor — holds no delegated power at all.
    expect(effectiveScope(delegation(), 'limited')).toEqual([]);
    // A grantee below the delegation's required capacity holds nothing.
    const needsFull = delegation({ requiredCapacity: 'full' });
    expect(effectiveScope(needsFull, 'emerging')).toEqual([]);
  });

  it('an expired delegation carries no power; a blanket/invalid delegation fails closed.', (): void => {
    const expired = delegation({ validFrom: '2020-01-01', validUntil: '2020-12-31' });
    expect(isDelegationLive(expired, '2026-01-01')).toBe(false);
    expect((): unknown => validateDelegation(delegation({ scopes: []}))).toThrow('duty slice');
    expect((): unknown => validateDelegation(delegation({ grantee: ' ' }))).toThrow('grantee');
  });
});
