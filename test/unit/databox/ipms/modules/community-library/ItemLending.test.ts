import { ItemLending } from '../../../../../../src/databox/ipms/modules/community-library/ItemLending';

let clock = '2026-01-01T00:00:00Z';
function library(): ItemLending {
  const l = new ItemLending(() => clock);
  l.enrol('alice');
  l.stock('tool-drill-1', 'cordless drill', 'tool-library');
  return l;
}

describe('ItemLending — the physical site lends its things (CIV-B47)', (): void => {
  it('a member checks out and returns a physical item — custody hash-chained.', (): void => {
    const l = library();
    l.checkout('tool-drill-1', 'alice', '2026-01-08');
    expect(l.history('tool-drill-1')).toHaveLength(1);
    l.checkin('tool-drill-1', 'alice', 'good');
    const history = l.history('tool-drill-1');
    expect(history[1].action).toBe('return');
    expect(history[1].condition).toBe('good');
    expect(l.verify().valid).toBe(true);
  });

  it('member-only, single-custody — a non-member and a double-checkout fail closed.', (): void => {
    const l = library();
    expect((): unknown => l.checkout('tool-drill-1', 'stranger', '2026-01-08')).toThrow('not a member');
    l.checkout('tool-drill-1', 'alice', '2026-01-08');
    expect((): unknown => l.checkout('tool-drill-1', 'alice', '2026-01-09')).toThrow('already checked out');
    expect((): unknown => l.checkin('tool-drill-1', 'bob', 'good')).toThrow('not checked out');
  });

  it('a past-due item surfaces in the overdue view — bring-it-back is accountable.', (): void => {
    const l = library();
    l.checkout('tool-drill-1', 'alice', '2026-01-05');
    clock = '2026-01-06';
    expect(l.overdue().map(i => i.itemId)).toContain('tool-drill-1');
  });
});
