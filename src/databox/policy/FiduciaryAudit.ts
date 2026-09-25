import { BadRequestHttpError } from '../../util/errors/BadRequestHttpError';
import { canonicalDigest } from '../proof/Canonicalization';
import { GENESIS_PREV_DIGEST } from '../evidence/EvidenceChain';

/**
 * Fiduciary-duty auditability (CIV-B50, `data-safe.html` — "informatics fiduciary"): a cooperative
 * that holds members' data owes them a technical *duty of care*, and a duty you can't audit isn't a
 * duty at all. This log makes privileged access accountable: EVERY administrative/operator access to
 * a member's pod records WHO accessed WHAT, under WHICH justification — hash-chained and
 * tamper-evident, so an admin can't silently read a member's records.
 *
 * The fiduciary boundary: an administrative access with NO declared justification (a support ticket,
 * a legal order, a member's explicit grant) is a *breach* — `recordAccess` refuses it. The duty is
 * enforced, not advisory: access without a lawful basis is rejected, and the refusal is itself
 * logged. The audit answers "did the cooperative only touch member data when it had a duty/right
 * to?" — the informatics-fiduciary claim made checkable.
 */

export type AccessJustification =
  // The member asked the operator to act.
  | 'member-request' |
  // A logged support case.
  'support-ticket' |
  // A court/statutory instrument.
  'legal-order' |
  // An emergency affecting the member or another.
  'safety-emergency' |
  // A scheduled, declared maintenance op.
  'system-maintenance';

export interface AccessRecord {
  readonly sequence: number;
  /** The operator's identity (the fiduciary actor). */
  readonly operatorId: string;
  /** The member pod / resource accessed (pairwise-scoped, not a raw identity). */
  readonly target: string;
  /** The justification the access rested on — required, never blank. */
  readonly justification: AccessJustification;
  /** The supporting reference — the ticket/order/grant id. */
  readonly justificationRef: string;
  /** What the operator did — `read` | `write` | `admin`. */
  readonly operation: 'read' | 'write' | 'admin';
  readonly accessedAt: string;
  readonly prevDigest: string;
  readonly recordDigest: string;
}

export class FiduciaryAuditLog {
  private readonly entries: AccessRecord[] = [];
  private readonly now: () => string;

  public constructor(now: () => string = (): string => new Date().toISOString()) {
    this.now = now;
  }

  /**
   * Record a privileged access. FAILS CLOSED: no justification, no supporting reference, or a blank
   * operator/target rejects — the fiduciary duty demands a declared lawful basis before the access
   * is even logged. Returns the bound record.
   */
  public recordAccess(
    operatorId: string,
    target: string,
    operation: 'read' | 'write' | 'admin',
    justification: AccessJustification,
    justificationRef: string,
  ): AccessRecord {
    if (operatorId.trim().length === 0 || target.trim().length === 0) {
      throw new BadRequestHttpError('A fiduciary access needs the operator id and the target resource.');
    }
    if (justificationRef.trim().length === 0) {
      throw new BadRequestHttpError(
        'Privileged access needs a justification reference (ticket/order/grant) — a bare claim is a breach.',
      );
    }
    const base = {
      sequence: this.entries.length,
      operatorId: operatorId.trim(),
      target,
      operation,
      justification,
      justificationRef: justificationRef.trim(),
      accessedAt: this.now(),
      prevDigest: this.entries.at(-1)?.recordDigest ?? GENESIS_PREV_DIGEST,
    };
    const record: AccessRecord = Object.freeze({ ...base, recordDigest: canonicalDigest(base) });
    this.entries.push(record);
    return record;
  }

  /** The full audit trail — every privileged access, hash-chained. */
  public records(): readonly AccessRecord[] {
    return [ ...this.entries ];
  }

  /** The accesses to a member's resource — the member's right to see who touched their data. */
  public forTarget(target: string): readonly AccessRecord[] {
    return this.entries.filter(r => r.target === target);
  }

  /** Verify the chain — a tampered audit entry fails (T-27). */
  public verify(): { readonly valid: boolean } {
    for (const [ index, record ] of this.entries.entries()) {
      const { recordDigest, ...contents } = record;
      const expected = index === 0 ? GENESIS_PREV_DIGEST : this.entries[index - 1].recordDigest;
      if (record.sequence !== index || record.prevDigest !== expected ||
        recordDigest !== canonicalDigest(contents)) {
        return { valid: false };
      }
    }
    return { valid: true };
  }
}
