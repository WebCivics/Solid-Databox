import type { Representation } from '../../../../../../src/http/representation/Representation';
import type { ResourceIdentifier } from '../../../../../../src/http/representation/ResourceIdentifier';
import type { ResourceStore } from '../../../../../../src/storage/ResourceStore';
import { observationTurtle, TelemetryPipeline } from '../../../../../../src/databox/ipms/modules/wot/TelemetryPipeline';

class Capture {
  public writes: { path: string; body: string }[] = [];
  public async setRepresentation(id: ResourceIdentifier, rep: Representation): Promise<void> {
    const chunks: Buffer[] = [];
    for await (const c of rep.data) {
      chunks.push(Buffer.from(c as string));
    }
    this.writes.push({ path: id.path, body: Buffer.concat(chunks).toString('utf8') });
  }
}
const asStore = (s: Capture): ResourceStore => s as unknown as ResourceStore;

const obs = {
  deviceId: 'https://pod.example/devices/meter#thing',
  featureOfInterest: 'premise:meter-1',
  observedProperty: 'kwh-import',
  result: 3.4,
  unit: 'kWh',
};

describe('TelemetryPipeline — SOSA/SSN observations (CIV-B33)', (): void => {
  it('writes a sosa:Observation into the device\'s own telemetry namespace.', async(): Promise<void> => {
    const store = new Capture();
    const pipe = new TelemetryPipeline(asStore(store), 'https://pod.example/');
    const iri = await pipe.observe(obs);
    expect(iri).toContain('/.databox/devices/telemetry/');
    const doc = store.writes[0].body;
    expect(doc).toContain('a <http://www.w3.org/ns/sosa/Observation>');
    expect(doc).toContain('madeBySensor> <https://pod.example/devices/meter#thing>');
    expect(doc).toContain('"3.4"^^<http://www.w3.org/2001/XMLSchema#decimal>');
    expect(doc).toContain('observedProperty> "kwh-import"');
  });

  it('serialises the standard SOSA shape — resultTime + phenomenonTime + unit.', (): void => {
    const turtle = observationTurtle('http://x/obs-1', obs, '2026-01-01T00:00:00.000Z');
    expect(turtle).toContain('resultTime> "2026-01-01T00:00:00.000Z"');
    expect(turtle).toContain('phenomenonTime>');
    expect(turtle).toContain('qudt#unit> "kWh"');
  });

  it('fails closed on a non-URI device, empty field, or non-finite result.', async(): Promise<void> => {
    const pipe = new TelemetryPipeline(asStore(new Capture()), 'https://pod.example/');
    await expect(pipe.observe({ ...obs, deviceId: 'meter' })).rejects.toThrow('absolute WebID');
    await expect(pipe.observe({ ...obs, observedProperty: '  ' })).rejects.toThrow('observedProperty');
    await expect(pipe.observe({ ...obs, result: Number.NaN })).rejects.toThrow('finite');
  });
});
