import { SafeExit } from '../../../../src/databox/personal/SafeExit';

function policy(over = {}) {
  return {
    holderId: 'https://pod/alice#me',
    checkInMs: 60_000,
    actions: [ 'decoy' as const, 'alert' as const ],
    alertContacts: [ 'https://pod/friend#me' ],
    duressPhrase: 'the-weather-is-fine',
    ...over,
  };
}

let clock = 0;
const now = (): number => clock;

describe('SafeExit — coercion resistance / deadman switch (CIV-B11)', (): void => {
  it('the duress phrase engages the safe posture — a coercer sees the decoy, not the alert.', (): void => {
    clock = 0;
    const box = new SafeExit(policy(), now);
    box.signal('the-weather-is-fine');
    expect(box.isEngaged()).toBe(true);
    expect(box.posture()).toBe('duress-signal');
    // A requester sees the decoy + the alert fires silently to contacts.
    const view = box.presentation();
    expect(view.decoy).toBe(true);
    expect(view.alertContacts).toContain('https://pod/friend#me');
  });

  it('a missed check-in self-engages the deadman posture; a check-in resets it.', (): void => {
    clock = 0;
    const box = new SafeExit(policy(), now);
    box.checkIn();
    clock = 30_000;
    box.poll();
    expect(box.isEngaged()).toBe(false); // Within the window.
    clock = 61_000;
    box.poll();
    expect(box.isEngaged()).toBe(true);
    expect(box.posture()).toBe('deadman-lapsed');
  });

  it('a wrong phrase does nothing — a guess never reveals the switch.', (): void => {
    clock = 0;
    const box = new SafeExit(policy(), now);
    box.signal('open-sesame');
    expect(box.isEngaged()).toBe(false);
    expect(box.presentation().decoy).toBe(false);
  });

  it('engagement is recorded to the audit trail (the switch itself is evidence).', (): void => {
    clock = 0;
    const box = new SafeExit(policy(), now);
    box.signal('the-weather-is-fine');
    box.signal('the-weather-is-fine'); // Idempotent — no second engagement.
    const trail = box.auditTrail();
    expect(trail).toHaveLength(1);
    expect(trail[0].reason).toBe('duress-signal');
    expect(trail[0].recordDigest).toMatch(/^urn:sha256/u);
  });

  it('fails closed on a policy with no actions / no duress phrase / no contacts for alert.', (): void => {
    expect((): SafeExit => new SafeExit(policy({ actions: []}), now)).toThrow('safety action');
    expect((): SafeExit => new SafeExit(policy({ duressPhrase: ' ' }), now)).toThrow('duress');
    expect((): SafeExit => new SafeExit(policy({ alertContacts: []}), now)).toThrow('alert contact');
  });
});
