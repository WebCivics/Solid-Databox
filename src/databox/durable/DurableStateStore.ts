import { BasicRepresentation } from '../../http/representation/BasicRepresentation';
import type { ResourceStore } from '../../storage/ResourceStore';
import { APPLICATION_JSON } from '../../util/ContentTypes';
import { NotFoundHttpError } from '../../util/errors/NotFoundHttpError';
import { readableToString } from '../../util/StreamUtil';

/**
 * A durable JSON state document over the pod `ResourceStore` (CIV-C10). The process-local registries
 * (`InMemory*`) keep their indexes in memory but lose them on restart; the durable variants behind
 * this seam snapshot their state to a pod resource so it survives a restart — the ResourceStore is
 * the durable medium (file/system-store backed in a real deployment).
 *
 * The contract is deliberately small — one JSON document per authority — because the durable
 * registries are single-writer (a provisioning/control-plane surface), not a hot data path.
 */
export class DurableStateStore {
  public constructor(
    private readonly store: ResourceStore,
    /** The pod resource IRI the state document lives at. */
    private readonly documentIri: string,
  ) {}

  /** Read + parse the persisted document, or `undefined` when it has never been written. */
  public async load<T>(): Promise<T | undefined> {
    let representation;
    try {
      representation = await this.store.getRepresentation(
        { path: this.documentIri },
        { type: { [APPLICATION_JSON]: 1 }},
      );
    } catch (error: unknown) {
      if (error instanceof NotFoundHttpError) {
        return undefined;
      }
      throw error;
    }
    return JSON.parse(await readableToString(representation.data)) as T;
  }

  /** Persist the whole state document (read-modify-write is the caller's concern). */
  public async save<T>(state: T): Promise<void> {
    await this.store.setRepresentation(
      { path: this.documentIri },
      new BasicRepresentation([ Buffer.from(JSON.stringify(state), 'utf-8') ], APPLICATION_JSON),
    );
  }
}
