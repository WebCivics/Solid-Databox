import { BadRequestHttpError } from '../../util/errors/BadRequestHttpError';
import type { RetrievedRecordItem } from '../agent/AgentTypes';
import type { ProvisionalShortLivedToken } from '../credential/ConnectionCredentialTypes';

/**
 * The org-side serving contract for `/.databox/consume/*` (CIV-C27) — the pieces the
 * consumer agent's remote client pulls. Deliberately narrow, injected interfaces: the
 * handler composes them; deployments bind them to the CSS store / feed / ledger.
 */

/**
 * The org's per-connection servable records — the secured artefacts a token-holder pulls.
 * Production binds this to the committed CSS surface ({@link CssDataboxStore} commits the
 * exact bytes under a pairwise-holder ACL); the contract is per-connection, never global.
 */
export interface TenantRecordStore {
  /** The records servable to the holder of this connection — its own records only. */
  listFor: (connectionId: string) => Promise<readonly RetrievedRecordItem[]>;
}

/**
 * The submission path: validate the scoped submission, durably commit it, sign the
 * acceptance receipt, return the artefacts the consumer verifies. Injected so the durable
 * commit + `AcceptanceReceiptSigner` stay the single issuance path (§7.0, ADR-0019).
 */
export interface SubmissionProcessor {
  process: (
    token: ProvisionalShortLivedToken,
    submission: unknown,
  ) => Promise<{ receiptJws: string; payload: Buffer | string }>;
}

/**
 * The issued-token registry — the org recognises the provisional tokens it minted. The
 * provisional token is deliberately `notWireFormat` (ADR-0005/0006 — the real bearer
 * format is a blocked decision); the serving side therefore authenticates a presented
 * token against its own issuance record (connection + holder thumbprint + audience +
 * expiry), never trusting the structure alone. Records the tenant binding at exchange.
 */
export class IssuedTokenRegistry {
  private readonly issued = new Map<string, { tenantId: string; expiresAtMs: number }>();

  /** Record a token the exchange minted, bound to its connection's tenant. */
  public record(token: ProvisionalShortLivedToken, tenantId: string): void {
    this.issued.set(tokenKey(token), { tenantId, expiresAtMs: Date.parse(token.expiresAt) });
  }

  /**
   * Validate a presented token — returns the bound tenant. Fails closed on an unknown
   * token, a forged shape, or an expired one.
   */
  public validate(token: ProvisionalShortLivedToken, now: number = Date.now()): string {
    if (!token?.notWireFormat) {
      throw new BadRequestHttpError('A consume token must be an issued provisional token.');
    }
    const stored = this.issued.get(tokenKey(token));
    if (stored === undefined) {
      throw new BadRequestHttpError('Unrecognised consume token — not issued by this databox.');
    }
    if (now > stored.expiresAtMs) {
      throw new BadRequestHttpError('Consume token has expired.');
    }
    return stored.tenantId;
  }
}

/** A token is identified by the facts the exchange bound — no secret, so no leakage. */
function tokenKey(token: ProvisionalShortLivedToken): string {
  return `${token.connectionId}|${token.audience}|${token.holderThumbprint}|${token.issuedAt}`;
}
