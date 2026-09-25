import { BasicRepresentation } from '../../../../../../src/http/representation/BasicRepresentation';
import type { Representation } from '../../../../../../src/http/representation/Representation';
import type { ResourceIdentifier } from '../../../../../../src/http/representation/ResourceIdentifier';
import type { RepresentationPreferences } from '../../../../../../src/http/representation/RepresentationPreferences';
import type { ResourceStore } from '../../../../../../src/storage/ResourceStore';
import { NotFoundHttpError } from '../../../../../../src/util/errors/NotFoundHttpError';
import { buildThingDescription, WOT_TD_CONTEXT } from '../../../../../../src/databox/ipms/modules/wot/ThingDescription';
import { ThingRegistry } from '../../../../../../src/databox/ipms/modules/wot/ThingRegistry';

/** In-memory store — a TD persists as a JSON-LD doc; a deleted doc reads 404. */
class Store {
  private readonly docs = new Map<string, string>();
  public async setRepresentation(id: ResourceIdentifier, rep: Representation): Promise<void> {
    const chunks: Buffer[] = [];
    for await (const c of rep.data) {
      chunks.push(Buffer.from(c as string));
    }
    this.docs.set(id.path, Buffer.concat(chunks).toString('utf8'));
  }

  public async getRepresentation(id: ResourceIdentifier, _p: RepresentationPreferences): Promise<Representation> {
    const doc = this.docs.get(id.path);
    if (doc === undefined) {
      throw new NotFoundHttpError();
    }
    return new BasicRepresentation([ Buffer.from(doc, 'utf-8') ], 'application/json');
  }

  public async deleteResource(id: ResourceIdentifier): Promise<void> {
    if (!this.docs.delete(id.path)) {
      throw new NotFoundHttpError();
    }
  }
}
const asStore = (s: Store): ResourceStore => s as unknown as ResourceStore;

const input = {
  deviceId: 'https://pod.example/devices/thermostat#thing',
  title: 'Living-room thermostat',
  deviceType: 'sensor',
  base: 'https://pod.example/devices/thermostat/',
  events: [{ name: 'readings', href: 'telemetry/readings', appendOnly: true }],
  properties: [{ name: 'temperature', href: 'state/temp', contentType: 'application/json' }],
};

describe('ThingDescription / ThingRegistry — devices as discoverable pod TDs (CIV-B7)', (): void => {
  it('builds a W3C TD with the databox DPoP scheme + append-only telemetry affordance.', (): void => {
    const td = buildThingDescription(input);
    expect(td['@context']).toBe(WOT_TD_CONTEXT);
    expect(td['@type']).toBe('Thing');
    expect(td.security).toContain('databox_dpop');
    const events = td.events as Record<string, { 'acl:access': string }>;
    expect(events.readings['acl:access']).toBe('append'); // Least-privilege: contribute, never read.
  });

  it('registers → describes → deregisters a device over the pod store.', async(): Promise<void> => {
    const registry = new ThingRegistry(asStore(new Store()), 'https://pod.example/');
    const { td, resource } = await registry.register(input);
    expect(resource).toContain('/.databox/devices/');
    expect(resource).not.toContain('thermostat#thing'); // No raw device URI in the path.

    const fetched = await registry.describe(input.deviceId);
    expect(fetched?.id).toBe(td.id);
    expect(fetched?.title).toBe('Living-room thermostat');

    await registry.deregister(input.deviceId);
    await expect(registry.describe(input.deviceId)).resolves.toBeUndefined(); // No leak on revoke.
  });

  it('fails closed on a non-URI device id / empty title / relative base.', (): void => {
    expect((): unknown => buildThingDescription({ ...input, deviceId: 'thermostat' })).toThrow('absolute URI');
    expect((): unknown => buildThingDescription({ ...input, title: '  ' })).toThrow('title');
    expect((): unknown => buildThingDescription({ ...input, base: 'rel/base' })).toThrow('base');
  });
});
