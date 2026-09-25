import { BadRequestHttpError } from '../../../../util/errors/BadRequestHttpError';
import type { SensorObservation } from './TelemetryPipeline';

/**
 * Telemetry → billing (CIV-B34, `digital-economy.html`): meter/energy observations from the
 * SOSA/SSN telemetry pipeline are priced into micro-billing line-items — a smart meter's
 * `kwh-import`/`kwh-export` readings become credits/charges on a community P2P-energy scheme.
 *
 * The mapping is explicit: a tariff declares, per observed-property, a rate (currency per unit) and
 * a direction (import = the premise consumed → charge; export = the premise generated → credit).
 * A billing interval groups the observations into per-property totals, applies the rate, and emits
 * signed line-items — the sum is the period's settlement. Readings priced are the device's own
 * (the observation's madeBySensor) — a billing run is scoped to one premise's meter, never a blend.
 *
 * Deterministic + auditable: the same observation set always yields the same settlement (the math is
 * pure), and each line carries the observation ids that produced it — a disputed bill can be traced
 * back to the exact readings.
 */

export interface TariffRule {
  /** The observed property this rule prices (e.g. `kwh-import`, `kwh-export`). */
  readonly observedProperty: string;
  /** Currency per unit (positive). */
  readonly rate: number;
  /** `charge` = premise consumed (owes); `credit` = premise generated (is owed). */
  readonly direction: 'charge' | 'credit';
  /** The unit the rate applies to (e.g. `kWh`). */
  readonly unit: string;
}

export interface BillingLineItem {
  readonly observedProperty: string;
  readonly direction: 'charge' | 'credit';
  readonly quantity: number;
  readonly unit: string;
  readonly rate: number;
  /** Signed amount: charge positive (owes), credit negative (is owed). */
  readonly amount: number;
  /** The observation ids that summed to this line (auditability). */
  readonly sourceObservations: readonly string[];
}

export interface Bill {
  /** The premise/meter billed. */
  readonly deviceId: string;
  readonly currency: string;
  readonly lines: readonly BillingLineItem[];
  /** Net settlement: positive = owes, negative = is owed. */
  readonly total: number;
}

/**
 * Price a set of observations into a bill under the tariff. Only observations carrying a `sensorRef`
 * (the reading's identity — passed in alongside the SensorObservation) are summed; readings for an
 * unknown property are ignored (a meter emits many properties; the tariff prices the ones it covers).
 * Fails closed on a negative quantity/rate.
 */
export function billTelemetry(
  deviceId: string,
  readings: readonly (SensorObservation & { sensorRef?: string })[],
  tariff: readonly TariffRule[],
  currency: string,
): Bill {
  if (deviceId.trim().length === 0) {
    throw new BadRequestHttpError('A bill needs the meter/premise device id.');
  }
  const lines: BillingLineItem[] = [];
  let total = 0;
  for (const rule of tariff) {
    if (!(rule.rate > 0) || !Number.isFinite(rule.rate)) {
      throw new BadRequestHttpError(`Tariff for '${rule.observedProperty}' needs a positive rate.`);
    }
    const matching = readings.filter(r => r.observedProperty === rule.observedProperty && r.unit === rule.unit);
    if (matching.length === 0) {
      continue;
    }
    const quantity = matching.reduce((sum, r) => sum + r.result, 0);
    const amount = round2(quantity * rule.rate) * (rule.direction === 'charge' ? 1 : -1);
    total += amount;
    lines.push({
      observedProperty: rule.observedProperty,
      direction: rule.direction,
      quantity: round2(quantity),
      unit: rule.unit,
      rate: rule.rate,
      amount,
      sourceObservations: matching.map(r => r.sensorRef ?? r.observedProperty),
    });
  }
  return { deviceId, currency, lines, total: round2(total) };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
