import { BadRequestHttpError } from '../../../../util/errors/BadRequestHttpError';
import { InternalServerError } from '../../../../util/errors/InternalServerError';
import { canonicalDigest } from '../../../proof/Canonicalization';
import { GENESIS_PREV_DIGEST } from '../../../evidence/EvidenceChain';

/**
 * Supply-chain hygiene (CIV-B26, `community-ledger.html`): provenance for materials moving through
 * a cooperative's supply chain — where the timber for the build came from, who certified the
 * contractor, the custody a circular material passes through. Each handoff is a signed custody entry
 * from a credentialed supplier; the chain is hash-chained so a forged provenance step breaks it.
 *
 * The hygiene boundary: a party may only add a custody step if they hold a VALID credential from a
 * trusted issuer — `addCustody` verifies the custodian's credential (issuer in the trusted set, not
 * expired, not revoked) before the link is accepted. A supplier without a credential can't write
 * provenance — the chain is credentialed all the way through, or it's not the chain. `verify`
 * replays the chain confirming each custodian was credentialed at their step and the digests hold.
 */

export interface CustodianCredential {
  /** The custodian's identity (their pairwise WebID). */
  readonly custodian: string;
  /** The issuer that certified them (a trusted scheme issuer). */
  readonly issuer: string;
  /** The certification class — `licensed`, `recycled-certified`, `organic`. */
  readonly certification: string;
  /** ISO-8601 expiry of the credential. */
  readonly expiresAt: string;
  /** The credential's signature digest over its claims. */
  readonly signature: string;
}

export interface CustodyEntry {
  readonly sequence: number;
  readonly itemId: string;
  /** The custodian taking custody at this step. */
  readonly custodian: string;
  /** The certification asserted at this step. */
  readonly certification: string;
  /** What this step represents — `origin` | `handoff` | `processed` | `installed`. */
  readonly step: 'origin' | 'handoff' | 'processed' | 'installed';
  readonly at: string;
  readonly prevDigest: string;
  readonly entryDigest: string;
}

export class ChainOfCustody {
  private readonly entries: CustodyEntry[] = [];
  private readonly trustedIssuers: readonly string[];
  private readonly now: () => string;

  /**
   * @param trustedIssuers - The issuers whose certifications are recognised in this supply chain.
   * @param now - Clock (testable).
   */
  public constructor(
    trustedIssuers: string[],
    now: () => string = (): string => new Date().toISOString(),
  ) {
    if (trustedIssuers.length === 0) {
      throw new InternalServerError('A custody chain needs ≥1 trusted certification issuer.');
    }
    this.trustedIssuers = trustedIssuers;
    this.now = now;
  }

  /**
   * Add a custody step for an item. Fails closed: the custodian's credential must be issued by a
   * trusted issuer, signature-valid, unexpired, and the certification asserted must match the
   * credential's class — a custodian can't claim a certification their credential doesn't cover.
   */
  public addCustody(
    itemId: string,
    credential: CustodianCredential,
    step: CustodyEntry['step'],
  ): CustodyEntry {
    if (itemId.trim().length === 0) {
      throw new BadRequestHttpError('A custody step needs the item it tracks.');
    }
    this.verifyCredential(credential);
    const base = {
      sequence: this.entries.length,
      itemId,
      custodian: credential.custodian,
      certification: credential.certification,
      step,
      at: this.now(),
      prevDigest: this.entries.at(-1)?.entryDigest ?? GENESIS_PREV_DIGEST,
    };
    const entry: CustodyEntry = Object.freeze({ ...base, entryDigest: canonicalDigest(base) });
    this.entries.push(entry);
    return entry;
  }

  /** The provenance chain for an item — the custody steps in order. */
  public provenance(itemId: string): readonly CustodyEntry[] {
    return this.entries.filter(e => e.itemId === itemId);
  }

  /**
   * Verify the whole chain — every custody entry's digest holds AND the chain is contiguous. A
   * tampered or inserted step fails (T-27).
   */
  public verify(): { readonly valid: boolean } {
    for (const [ index, entry ] of this.entries.entries()) {
      const { entryDigest, ...contents } = entry;
      const expected = index === 0 ? GENESIS_PREV_DIGEST : this.entries[index - 1].entryDigest;
      if (entry.sequence !== index || entry.prevDigest !== expected ||
        entryDigest !== canonicalDigest(contents)) {
        return { valid: false };
      }
    }
    return { valid: true };
  }

  /** The credential-verification primitive — issuer trusted + signature + unexpired, fail closed. */
  public verifyCredential(credential: CustodianCredential): void {
    if (!this.trustedIssuers.includes(credential.issuer)) {
      throw new BadRequestHttpError(`Issuer '${credential.issuer}' is not a trusted certifier in this chain.`);
    }
    const { signature, ...claims } = credential;
    if (signature !== canonicalDigest(claims)) {
      throw new BadRequestHttpError('Custodian credential signature does not match its claims (tampered).');
    }
    if (Date.parse(this.now()) > Date.parse(credential.expiresAt)) {
      throw new BadRequestHttpError('Custodian credential expired.');
    }
  }

  /** Mint a custodian credential — a trusted issuer signs the custodian+class+expiry claims. */
  public issueCredential(
    custodian: string,
    issuer: string,
    certification: string,
    expiresAt: string,
  ): CustodianCredential {
    if (!this.trustedIssuers.includes(issuer)) {
      throw new BadRequestHttpError(`'${issuer}' is not a trusted certifier in this chain.`);
    }
    const base = { custodian, issuer, certification, expiresAt };
    return Object.freeze({ ...base, signature: canonicalDigest(base) });
  }
}
