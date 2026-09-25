import { BadRequestHttpError } from '../../../../util/errors/BadRequestHttpError';
import type { Contribution, ContributionState } from './ContributionLedger';

/**
 * The obligation-cost payback waterfall (CIV-B2, `cooperative-projects.html`): when a community
 * project earns, the revenue is distributed back to the people who contributed — the "payback" that
 * makes logged labour/materials/funds a real obligation, not a sunk gift.
 *
 * Contributions aren't commensurable (an hour ≠ a dollar ≠ a bag of materials), so settlement is
 * driven by an explicit, declared **weighting** — a per-kind rate the community sets (e.g. $30/hr for
 * `time`, face value for `funds`, an agreed valuation for `materials`). Each recognised,
 * non-withdrawn contribution is worth `quantity.value × rate`; a contributor's share of the revenue
 * is `theirValue / totalValue × revenue`.
 *
 * **Charitable routing** (the civic part): a contributor may elect to route their share to a named
 * beneficiary instead of themselves — recognition still lands in their portfolio (the contribution
 * is theirs), but the dollars go where they directed. The settlement emits the routing so the
 * payment module pays the beneficiary while the portfolio credits the contributor.
 */

export interface SettlementRules {
  /** Per-kind valuation rate — value per unit, in the revenue's currency (missing kind ⇒ 0 weight). */
  readonly ratePerUnit: Readonly<Record<string, number>>;
  /** Optional contributor → beneficiary routing (charitable redirect). contributorId → beneficiaryId. */
  readonly routeTo?: Readonly<Record<string, string>>;
  /** Optional cap: each contributor's share ≤ capFraction of the revenue (e.g. 0.5). */
  readonly capFraction?: number;
}

export interface SettlementPayout {
  /** The contributor whose recognised work earned the share. */
  readonly contributorId: string;
  /** Where the dollars actually go — the contributor, or their elected beneficiary. */
  readonly beneficiaryId: string;
  /** The payout amount (in the revenue's currency). */
  readonly amount: number;
  /** The contributor's weighted contribution value the share was computed from. */
  readonly weightedValue: number;
}

export interface Settlement {
  readonly revenue: number;
  readonly payouts: readonly SettlementPayout[];
  /** The total weighted value across contributors (the denominator used). */
  readonly totalWeightedValue: number;
  /** Any undistributed remainder (rounding) — stays with the project. */
  readonly remainder: number;
}

/**
 * Distribute `revenue` across a project's contributions per the settlement rules. Only
 * `recognised && !withdrawn` contributions count — a logged-but-unrecognised or withdrawn
 * contribution earns nothing (recognition is the community's explicit acceptance).
 */
export function settle(
  revenue: number,
  contributions: readonly ContributionState[],
  rules: SettlementRules,
): Settlement {
  if (!(revenue >= 0) || !Number.isFinite(revenue)) {
    throw new BadRequestHttpError('Settlement revenue must be a finite, non-negative amount.');
  }

  // Weight each recognised, live contribution by its declared per-kind rate.
  const weighted = new Map<string, number>();
  for (const state of contributions) {
    if (!state.recognised || state.withdrawn) {
      continue;
    }
    const contribution: Contribution = state.contribution;
    const rate = rules.ratePerUnit[contribution.kind] ?? 0;
    const value = contribution.quantity.value * rate;
    if (value > 0) {
      weighted.set(contribution.contributorId, (weighted.get(contribution.contributorId) ?? 0) + value);
    }
  }

  const total = [ ...weighted.values() ].reduce((a, b) => a + b, 0);
  if (total === 0) {
    return { revenue, payouts: [], totalWeightedValue: 0, remainder: revenue };
  }

  const cap = rules.capFraction;
  const payouts: SettlementPayout[] = [];
  let distributed = 0;
  for (const [ contributorId, weightedValue ] of weighted) {
    let amount = (weightedValue / total) * revenue;
    if (cap !== undefined) {
      amount = Math.min(amount, cap * revenue);
    }
    // Round to cents — the waterfall is a settlement, not a fractional-cent split.
    amount = Math.floor(amount * 100) / 100;
    distributed += amount;
    payouts.push({
      contributorId,
      beneficiaryId: rules.routeTo?.[contributorId] ?? contributorId,
      amount,
      weightedValue,
    });
  }

  return {
    revenue,
    payouts,
    totalWeightedValue: total,
    remainder: Math.round((revenue - distributed) * 100) / 100,
  };
}
