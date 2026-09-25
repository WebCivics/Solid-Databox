import { BasicRepresentation } from '../../../../http/representation/BasicRepresentation';
import type { ResourceIdentifier } from '../../../../http/representation/ResourceIdentifier';
import type { ResourceStore } from '../../../../storage/ResourceStore';
import { APPLICATION_JSON } from '../../../../util/ContentTypes';
import { NotFoundHttpError } from '../../../../util/errors/NotFoundHttpError';
import { BadRequestHttpError } from '../../../../util/errors/BadRequestHttpError';
import { ensureTrailingSlash } from '../../../../util/PathUtil';
import { readableToString } from '../../../../util/StreamUtil';
import type { ThingDescription, ThingDescriptionInput } from './ThingDescription';
import { buildThingDescription } from './ThingDescription';

/**
 * The WoT Thing registry (CIV-B7) — persists each device as a JSON-LD Thing Description resource
 * under `/.databox/devices/` so devices are *discoverable pod resources*, not a side registry.
 * A TD is an ordinary Solid resource: WAC-governed, backed up with the pod, portable. Discovery is
 * enumerating the container; enrolment writes the TD; a device that is revoked loses its document.
 *
 * TDs are stored as `application/json` (the TD serialisation is JSON-LD) so a WoT consumer can fetch
 * them directly. The path segment is the device id's URL-safe form, never the raw device URI (no
 * PII-ish device URI in the path).
 */
export class ThingRegistry {
  private readonly container: string;

  public constructor(
    private readonly store: ResourceStore,
    baseUrl: string,
  ) {
    this.container = `${ensureTrailingSlash(new URL(baseUrl).href)}.databox/devices/`;
  }

  /** Register a device — builds + persists its Thing Description. Returns the TD + its resource IRI. */
  public async register(input: ThingDescriptionInput): Promise<{ td: ThingDescription; resource: string }> {
    const td = buildThingDescription(input);
    const resource = this.identifier(input.deviceId).path;
    await this.store.setRepresentation(
      { path: resource },
      new BasicRepresentation([ Buffer.from(JSON.stringify(td, undefined, 2), 'utf-8') ], APPLICATION_JSON),
    );
    return { td, resource };
  }

  /** Fetch a device's Thing Description, or `undefined` when it isn't registered (T-06: no leak). */
  public async describe(deviceId: string): Promise<ThingDescription | undefined> {
    const identifier = this.identifier(deviceId);
    try {
      const representation = await this.store.getRepresentation(
        identifier,
        { type: { [APPLICATION_JSON]: 1 }},
      );
      return JSON.parse(await readableToString(representation.data)) as ThingDescription;
    } catch (error: unknown) {
      if (error instanceof NotFoundHttpError) {
        return undefined;
      }
      throw error;
    }
  }

  /** Remove a device's Thing Description (device revoked — its discoverable doc goes). */
  public async deregister(deviceId: string): Promise<void> {
    await this.store.deleteResource(this.identifier(deviceId));
  }

  private identifier(deviceId: string): ResourceIdentifier {
    const safe = encodeURIComponent(deviceId).replaceAll('%', '-');
    if (safe.length === 0) {
      throw new BadRequestHttpError('A Thing registry needs a non-empty device id.');
    }
    return { path: `${this.container}${safe}` };
  }
}
