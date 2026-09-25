import { BadRequestHttpError } from '../../util/errors/BadRequestHttpError';
import { canonicalDigest } from '../proof/Canonicalization';
import { GENESIS_PREV_DIGEST } from '../evidence/EvidenceChain';

/**
 * The anonymous audit ledger (CIV-B09, `concession-card.html`): a per-transaction record that a
 * VALID, UNREVOKED credential was presented — WITHOUT recording which credential or which holder.
 *
 * The mechanism is a **nullifier**: a deterministic, unlinkable tag the holder derives per
 * (credential, verifier, epoch) — the same credential produces the same nullifier to the same
 * verifier in the same epoch, so a double-present is detectable, but the nullifier binds to nothing
 * about the holder's identity and is unlinkable across verifiers/epochs. The ledger stores the
 * nullifier + the scheme + the validity assertion + time — NEVER a WebID, never a credential id.
 *
 * So the audit answers "was a genuine, non-revoked entitlement presented, once?" — the property a
 * funder needs to audit program integrity — while carrying nothing that identifies the person.
 * Reused nullifier ⇒ rejected (replay detection). Hash-chained so a tampered audit entry fails.
 */

export interface AuditPresentation {
  /** The one-time nullifier — deterministic per (credential, verifier, epoch); unlinkable. */
  readonly nullifier: string;
  /** The scheme/credential-class asserted (e.g. `concession-pensioner`) — not the credential id. */
  readonly scheme: string;
  /** The verifier's identifier (the relying party, pairwise). */
  readonly verifier: string;
  /** The epoch the nullifier is valid for (e.g. `2026-Q1`). */
  readonly epoch: string;
}

export interface AuditRecord {
  readonly sequence: number;
  readonly nullifier: string;
  readonly scheme: string;
  readonly verifier: string;
  readonly epoch: string;
  readonly recordedAt: string;
  readonly prevDigest: string;
  readonly recordDigest: string;
}

export class AnonymousAuditLedger {
  private readonly entries: AuditRecord[] = [];
  private readonly nullifiers = new Set<string>();
  private readonly now: () => string;

  public constructor(now: () => string = (): string => new Date().toISOString()) {
    this.now = now;
  }

  /**
   * Record a valid presentation. `presentation` carries the nullifier + scheme + verifier + epoch;
   * `credentialValid` is the verifier-side assertion (signature + revocation checked upstream). A
   * reused nullifier or an invalid assertion fails closed — the ledger records only genuine, once
   * presentations.
   */
  public record(presentation: AuditPresentation, credentialValid: boolean): AuditRecord {
    if (!credentialValid) {
      throw new BadRequestHttpError('Cannot record a presentation of an invalid or revoked credential.');
    }
    for (const field of [ 'nullifier', 'scheme', 'verifier', 'epoch' ] as const) {
      if (presentation[field].trim().length === 0) {
        throw new BadRequestHttpError(`An audit record needs a non-empty ${field}.`);
      }
    }
    const key = `${presentation.nullifier}|${presentation.verifier}|${presentation.epoch}`;
    if (this.nullifiers.has(key)) {
      throw new BadRequestHttpError('A presentation with this nullifier was already recorded (replay rejected).');
    }
    const base = {
      sequence: this.entries.length,
      nullifier: presentation.nullifier,
      scheme: presentation.scheme,
      verifier: presentation.verifier,
      epoch: presentation.epoch,
      recordedAt: this.now(),
      prevDigest: this.entries.at(-1)?.recordDigest ?? GENESIS_PREV_DIGEST,
    };
    const record: AuditRecord = Object.freeze({ ...base, recordDigest: canonicalDigest(base) });
    this.entries.push(record);
    this.nullifiers.add(key);
    return record;
  }

  /** The audit record — contains no holder identity, only nullifier-keyed validity assertions. */
  public records(): readonly AuditRecord[] {
    return [ ...this.entries ];
  }

  /** Count of genuine presentations for a scheme+epoch (auditable program volume). */
  public volume(scheme: string, epoch: string): number {
    return this.entries.filter(r => r.scheme === scheme && r.epoch === epoch).length;
  }

  /** Verify the audit chain — a tampered entry fails (T-27). */
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
