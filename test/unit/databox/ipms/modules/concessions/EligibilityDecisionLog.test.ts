import { EligibilityDecisionLog } from '../../../../../../src/databox/ipms/modules/concessions/EligibilityDecisionLog';

function decision(over = {}) {
  return {
    subjectId: 'https://pod/alice#me',
    ruleId: 'pensioner-aus@v3',
    scope: 'cafeteria-concessions',
    inputs: { age: 70, cardPresented: true },
    outcome: 'eligible' as const,
    granted: [ 'pensioner' ],
    reason: 'seniors-card verified',
    ...over,
  };
}

describe('EligibilityDecisionLog — challengeable automated decisions (CIV-B10)', (): void => {
  it('logs each decision hash-chained — inputs digested, never stored raw.', (): void => {
    const log = new EligibilityDecisionLog();
    const r1 = log.record(decision());
    const r2 = log.record(decision({ outcome: 'ineligible', granted: undefined }));
    expect(r1.inputsDigest).toMatch(/^urn:sha256/u);
    expect(JSON.stringify(log.forSubject('https://pod/alice#me'))).not.toContain('"age":70'); // No raw attributes.
    expect(r2.prevDigest).toBe(r1.recordDigest);
    expect(log.verify().valid).toBe(true);
  });

  it('a superseding decision (appeal) answers a wrong call without erasing history.', (): void => {
    const log = new EligibilityDecisionLog();
    const wrong = log.record(decision({ outcome: 'ineligible', granted: undefined, reason: 'card unverified' }));
    log.record(decision({ supersedesDigest: wrong.recordDigest, reason: 'appeal upheld' }));
    // The effective decision is the upheld appeal; the original wrong call stays on record.
    expect(log.current('https://pod/alice#me', 'cafeteria-concessions')?.outcome).toBe('eligible');
    expect(log.forSubject('https://pod/alice#me')).toHaveLength(2);
  });

  it('a tampered record fails verification (T-27).', (): void => {
    const log = new EligibilityDecisionLog();
    log.record(decision());
    interface Mutable { records: { outcome: string }[] }
    const internals = log as unknown as Mutable;
    internals.records[0] = { ...internals.records[0], outcome: 'ineligible' };
    expect(log.verify().valid).toBe(false);
  });

  it('fails closed — an eligible decision must name what it granted; empty rule rejected.', (): void => {
    const log = new EligibilityDecisionLog();
    expect((): unknown => log.record(decision({ granted: []}))).toThrow('granted');
    expect((): unknown => log.record(decision({ ruleId: ' ' }))).toThrow('ruleId');
  });
});
