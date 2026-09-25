import { DutyWeb } from '../../../../src/databox/policy/DutyWeb';

function careWeb(): DutyWeb {
  return new DutyWeb('child-1-care-plan', [
    { partId: 'housing', obligation: 'stable housing arrangement', holder: 'parent-a' },
    { partId: 'schooling', obligation: 'enrolment + transport', holder: 'parent-b' },
    { partId: 'health', obligation: 'specialist review signed', holder: 'specialist-1' },
  ]);
}

describe('DutyWeb — a shared duty discharges only when every party carries their part (CIV-B03)', (): void => {
  it('a web is open until each part is signed — then discharges.', (): void => {
    const web = careWeb();
    expect(web.state()).toBe('open');
    expect(web.outstanding()).toHaveLength(3);
    web.sign('housing', 'parent-a');
    web.sign('schooling', 'parent-b');
    expect(web.state()).toBe('open'); // Still open — the specialist hasn't signed.
    web.sign('health', 'specialist-1');
    expect(web.state()).toBe('discharged');
    expect(web.verify().valid).toBe(true);
  });

  it('a part can only be signed by its named holder — a stranger\'s sign-off fails closed.', (): void => {
    const web = careWeb();
    expect((): unknown => web.sign('housing', 'stranger')).toThrow('parent-a');
    expect(web.state()).toBe('open');
  });

  it('a discharged web closes — no late sign-off; a forged audit event breaks the chain.', (): void => {
    const web = careWeb();
    web.sign('housing', 'parent-a');
    web.sign('schooling', 'parent-b');
    web.sign('health', 'specialist-1');
    expect((): unknown => web.sign('housing', 'parent-a')).toThrow('already discharged');
    interface Mutable { events: { action: string }[] }
    const internals = web as unknown as Mutable;
    internals.events[1] = { ...internals.events[1], action: 'sign-forged' };
    expect(web.verify().valid).toBe(false);
  });

  it('a web with no parts or an unheld part fails closed.', (): void => {
    expect((): DutyWeb => new DutyWeb('x', [])).toThrow('≥1 part');
    expect((): DutyWeb => new DutyWeb('x', [{ partId: 'p', obligation: ' ', holder: 'h' }]))
      .toThrow('obligation');
  });
});
