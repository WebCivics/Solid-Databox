import { billTelemetry } from '../../../../../../src/databox/ipms/modules/wot/TelemetryBilling';

function reading(prop: string, result: number, ref = `obs-${prop}`) {
  return {
    deviceId: 'https://pod.example/devices/meter#thing',
    featureOfInterest: 'premise:meter-1',
    observedProperty: prop,
    result,
    unit: 'kWh',
    sensorRef: ref,
  };
}

const tariff = [
  { observedProperty: 'kwh-import', rate: 0.3, direction: 'charge' as const, unit: 'kWh' },
  { observedProperty: 'kwh-export', rate: 0.08, direction: 'credit' as const, unit: 'kWh' },
];

describe('TelemetryBilling — meter observations → micro-billing (CIV-B34)', (): void => {
  it('prices imports as charges and exports as credits — net settlement.', (): void => {
    const bill = billTelemetry('meter-1', [
      reading('kwh-import', 10, 'i1'),
      reading('kwh-import', 5, 'i2'),
      reading('kwh-export', 4, 'e1'),
    ], tariff, 'AUD');
    const imp = bill.lines.find(l => l.observedProperty === 'kwh-import');
    const exp = bill.lines.find(l => l.observedProperty === 'kwh-export');
    expect(imp?.quantity).toBe(15);
    expect(imp?.amount).toBe(4.5); // 15 kWh × $0.30
    expect(exp?.amount).toBe(-0.32); // 4 kWh × $0.08 credit
    expect(bill.total).toBe(4.18);
    expect(imp?.sourceObservations).toEqual([ 'i1', 'i2' ]); // Auditable to the readings.
  });

  it('ignores untariffed properties and fails closed on a bad rate.', (): void => {
    const bill = billTelemetry('m', [ reading('humidity', 60) ], tariff, 'AUD');
    expect(bill.lines).toHaveLength(0); // Humidity isn't priced.
    expect(bill.total).toBe(0);
    const badTariff = [{ observedProperty: 'kwh-import', rate: -1, direction: 'charge' as const, unit: 'kWh' }];
    expect((): unknown => billTelemetry('m', [ reading('kwh-import', 1) ], badTariff, 'AUD'))
      .toThrow('positive rate');
  });
});
