import type { ContributionKind, ContributionState } from './ContributionLedger';

/**
 * Anonymised community statistics (CIV-B23, `community-ledger.html`): aggregate, privacy-preserving
 * civic statistics over the contribution ledger — "if you can't measure it, you can't fund it".
 *
 * The contract is the anonymisation boundary: a statistic is an aggregate over a GROUP of
 * contributors, and a cell is only emitted when that group reaches a minimum size `k` — below it the
 * cell is suppressed rather than revealing a single person's contribution. No contributor identity
 * (pairwise WebID) ever appears in the output; the only counts are group totals.
 *
 * This is a pure projection over {@link ContributionState} — it never touches the raw ledger
 * internals, so a caller can run it over the authoritative `contributions()` view and get
 * funding-evidence numbers without exposing who gave what.
 */

export interface CommunityStat {
  readonly projectId: string;
  /** The contribution kind this cell aggregates. */
  readonly kind: ContributionKind;
  /** Number of DISTINCT contributors behind this cell (never their identities). */
  readonly contributorCount: number;
  /** Number of contributions in the cell. */
  readonly contributionCount: number;
  /** Total quantity contributed (sum of `quantity.value`) in the cell's unit. */
  readonly totalQuantity: number;
  /** The unit the totalQuantity is in (e.g. `hours`, `AUD`). */
  readonly unit: string;
}

export interface CommunityStatsOptions {
  /** Minimum distinct contributors a cell needs before it is reported (k-anonymity; default 3). */
  readonly minimumGroupSize?: number;
}

const DEFAULT_K = 3;

/**
 * Aggregate a project's contributions into k-anonymous cells keyed by (kind). Only `recognised`,
 * non-withdrawn contributions count — the community's accepted work, not every logged attempt.
 * A cell with fewer than `k` distinct contributors is suppressed (it would re-identify individuals).
 */
export function anonymisedCommunityStats(
  projectId: string,
  contributions: readonly ContributionState[],
  options: CommunityStatsOptions = {},
): readonly CommunityStat[] {
  const k = options.minimumGroupSize ?? DEFAULT_K;
  interface Cell {
    contributors: Set<string>;
    contributionCount: number;
    totalQuantity: number;
    unit: string;
  }
  const cells = new Map<ContributionKind, Cell>();

  for (const state of contributions) {
    if (!state.recognised || state.withdrawn) {
      continue;
    }
    const c = state.contribution;
    const cell = cells.get(c.kind) ?? {
      contributors: new Set<string>(),
      contributionCount: 0,
      totalQuantity: 0,
      unit: c.quantity.unit,
    };
    cell.contributors.add(c.contributorId);
    cell.contributionCount += 1;
    cell.totalQuantity += c.quantity.value;
    cells.set(c.kind, cell);
  }

  const out: CommunityStat[] = [];
  for (const [ kind, cell ] of cells) {
    // K-anonymity gate: a group too small to hide an individual is suppressed, not reported.
    if (cell.contributors.size < k) {
      continue;
    }
    out.push({
      projectId,
      kind,
      contributorCount: cell.contributors.size,
      contributionCount: cell.contributionCount,
      totalQuantity: cell.totalQuantity,
      unit: cell.unit,
    });
  }
  return out;
}
