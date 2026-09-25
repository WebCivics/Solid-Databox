import { BadRequestHttpError } from '../../../../util/errors/BadRequestHttpError';
import { canonicalDigest } from '../../../proof/Canonicalization';
import { GENESIS_PREV_DIGEST } from '../../../evidence/EvidenceChain';

/**
 * Programmable-grant settlement (CIV-B08, `concession-card.html`): a grant is a bounded, rule-scoped
 * balance a beneficiary spends — not cash. The grant's rules are programmable: which merchant
 * categories it may be spent at (a food grant can't buy alcohol), a per-transaction cap, an expiry,
 * and a total balance. `spend` debits ONLY when every rule holds — category permitted, amount within
 * the cap, grant unexpired, balance sufficient — fail closed on any violation.
 *
 * Every debit is appended to a hash-chained spend record (the same digest primitive as the evidence
 * ledger) so the grant's use is auditable and tamper-evident — a funder can verify "the concession
 * money went to food", and a beneficiary's ledger of their own grant is theirs. The beneficiary is a
 * pairwise identifier; the grant is the entitlement, not a payment account.
 */

export interface GrantRules {
  /** The merchant categories the grant may be spent at (e.g. `grocery`, `transport`). */
  readonly permittedCategories: readonly string[];
  /** Max amount per single spend (a per-transaction cap). */
  readonly maxPerTransaction: number;
  /** ISO-8601 expiry — after this the grant is dormant (funds return per policy). */
  readonly expiresAt: string;
}

export interface Grant {
  /** Opaque grant id (issuer-assigned). */
  readonly grantId: string;
  /** The beneficiary's pairwise identifier. */
  readonly beneficiaryId: string;
  /** The scheme/program the grant belongs to (e.g. `emergency-food-voucher`). */
  readonly scheme: string;
  /** The currency the amounts are in. */
  readonly currency: string;
  readonly rules: GrantRules;
  /** The opening balance. */
  readonly balance: number;
}

export interface SpendRecord {
  readonly sequence: number;
  readonly grantId: string;
  readonly amount: number;
  readonly merchantCategory: string;
  readonly merchantRef: string;
  readonly spentAt: string;
  readonly prevDigest: string;
  readonly recordDigest: string;
}

export class ProgrammableGrant {
  private readonly grant: Grant;
  private remaining: number;
  private readonly records: SpendRecord[] = [];
  private readonly now: () => string;

  public constructor(grant: Grant, now: () => string = (): string => new Date().toISOString()) {
    if (grant.grantId.trim().length === 0 || grant.beneficiaryId.trim().length === 0) {
      throw new BadRequestHttpError('A grant needs a grantId and a beneficiary pairwise id.');
    }
    if (!(grant.balance > 0) || !Number.isFinite(grant.balance)) {
      throw new BadRequestHttpError('A grant needs a positive opening balance.');
    }
    if (grant.rules.permittedCategories.length === 0) {
      throw new BadRequestHttpError('A programmable grant must declare ≥1 permitted merchant category.');
    }
    this.grant = grant;
    this.remaining = grant.balance;
    this.now = now;
  }

  /**
   * Spend from the grant. Fails closed: a disallowed category, an over-cap amount, an expired grant
   * or insufficient balance all reject — the grant's rules are the entitlement's boundary.
   */
  public spend(amount: number, merchantCategory: string, merchantRef: string): SpendRecord {
    const at = this.now();
    if (Date.parse(at) > Date.parse(this.grant.rules.expiresAt)) {
      throw new BadRequestHttpError('The grant has expired — its balance is no longer spendable.');
    }
    if (!this.grant.rules.permittedCategories.includes(merchantCategory)) {
      throw new BadRequestHttpError(
        `Merchant category '${merchantCategory}' is not permitted by this grant's rules.`,
      );
    }
    if (!(amount > 0) || !Number.isFinite(amount)) {
      throw new BadRequestHttpError('A spend needs a positive, finite amount.');
    }
    if (amount > this.grant.rules.maxPerTransaction) {
      throw new BadRequestHttpError(
        `Spend exceeds the grant's per-transaction cap of ${this.grant.rules.maxPerTransaction}.`,
      );
    }
    if (amount > this.remaining) {
      throw new BadRequestHttpError('Insufficient grant balance.');
    }
    const base = {
      sequence: this.records.length,
      grantId: this.grant.grantId,
      amount: round2(amount),
      merchantCategory,
      merchantRef,
      spentAt: at,
      prevDigest: this.records.at(-1)?.recordDigest ?? GENESIS_PREV_DIGEST,
    };
    const record: SpendRecord = Object.freeze({ ...base, recordDigest: canonicalDigest(base) });
    this.records.push(record);
    this.remaining = round2(this.remaining - amount);
    return record;
  }

  /** The unspent balance. */
  public balance(): number {
    return this.remaining;
  }

  /** The append-only, hash-chained spend record — the beneficiary's auditable grant history. */
  public ledger(): readonly SpendRecord[] {
    return [ ...this.records ];
  }

  /** Verify the spend chain — a tampered debit fails (T-27). */
  public verify(): { readonly valid: boolean } {
    for (const [ index, record ] of this.records.entries()) {
      const { recordDigest, ...contents } = record;
      const expected = index === 0 ? GENESIS_PREV_DIGEST : this.records[index - 1].recordDigest;
      if (record.sequence !== index || record.prevDigest !== expected ||
        recordDigest !== canonicalDigest(contents)) {
        return { valid: false };
      }
    }
    return { valid: true };
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
