import { HashChainedEvidenceLedger } from '../evidence/EvidenceLedgerStore';
import { verifyChain } from '../evidence/EvidenceChain';
import type { LedgerEntry } from '../evidence/EvidenceChain';
import { InternalServerError } from '../../util/errors/InternalServerError';
import type { DurableStateStore } from './DurableStateStore';

interface EvidenceLedgerState {
  /** TenantId → its committed entries (the whole hash chain, verbatim). */
  readonly chains: Readonly<Record<string, readonly LedgerEntry[]>>;
}

/**
 * A durable, restart-surviving WORM evidence ledger (CIV-C10) — {@link HashChainedEvidenceLedger}
 * whose append-only chains persist to the pod store. Every `append` write-throughs the full chain set
 * to a durable document; `initialize()` restores the exact entries (digests and all) so the hash
 * chain is intact across a restart, and `verify` re-validates the restored chain fail-closed.
 *
 * This is WORM-equivalent persistence: entries are never mutated in place, only appended, and a
 * tampered persisted document is caught by `verify` (a restored chain that fails integrity throws on
 * initialize rather than serve a corrupt audit trail).
 */
export class DurableEvidenceLedger extends HashChainedEvidenceLedger {
  private initialized = false;

  public constructor(private readonly state: DurableStateStore, now?: () => string) {
    super(now);
  }

  /** Rehydrate the chains from the durable document — fail closed if a restored chain is corrupt. */
  public async initialize(): Promise<void> {
    const saved = await this.state.load<EvidenceLedgerState>();
    for (const [ tenantId, entries ] of Object.entries(saved?.chains ?? {})) {
      const chain = [ ...entries ];
      // The restored chain is verified BEFORE it is trusted — a tampered/corrupt persisted document
      // throws rather than serving a broken audit trail (T-27).
      const check = verifyChain(chain);
      if (!check.valid) {
        throw new InternalServerError(`Durable evidence ledger for '${tenantId}' failed integrity on load.`);
      }
      this.chains.set(tenantId, chain);
    }
    this.initialized = true;
  }

  public override async append(input: Parameters<HashChainedEvidenceLedger['append']>[0]): Promise<LedgerEntry> {
    if (!this.initialized) {
      throw new InternalServerError('DurableEvidenceLedger must be initialized() before use.');
    }
    const entry = await super.append(input);
    await this.persist();
    return entry;
  }

  private async persist(): Promise<void> {
    const chains: Record<string, readonly LedgerEntry[]> = {};
    for (const tenantId of this.tenants()) {
      chains[tenantId] = this.entries(tenantId);
    }
    await this.state.save<EvidenceLedgerState>({ chains });
  }
}
