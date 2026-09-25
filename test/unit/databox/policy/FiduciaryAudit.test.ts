import { FiduciaryAuditLog } from '../../../../src/databox/policy/FiduciaryAudit';

describe('FiduciaryAuditLog — the informatics-fiduciary duty made checkable (CIV-B50)', (): void => {
  it('records a justified admin access, hash-chained, queryable by target.', (): void => {
    const log = new FiduciaryAuditLog();
    const r = log.recordAccess('op-1', 'pod/alice/records', 'read', 'support-ticket', 'T-123');
    expect(r.justification).toBe('support-ticket');
    expect(log.forTarget('pod/alice/records')).toHaveLength(1);
    expect(log.verify().valid).toBe(true);
  });

  it('fails closed — an access with no justification reference is a breach, rejected.', (): void => {
    const log = new FiduciaryAuditLog();
    expect((): unknown => log.recordAccess('op-1', 'pod/x', 'admin', 'member-request', ' '))
      .toThrow('justification reference');
    expect(log.records()).toHaveLength(0);
    expect((): unknown => log.recordAccess(' ', 'pod/x', 'read', 'legal-order', 'O-1')).toThrow('operator');
  });

  it('a tampered audit record fails verification (T-27).', (): void => {
    const log = new FiduciaryAuditLog();
    log.recordAccess('op-1', 'pod/alice/records', 'read', 'support-ticket', 'T-1');
    interface Mutable { entries: { justification: string }[] }
    const internals = log as unknown as Mutable;
    internals.entries[0] = { ...internals.entries[0], justification: 'none' };
    expect(log.verify().valid).toBe(false);
  });
});
