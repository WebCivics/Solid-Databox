import { BasicRepresentation } from '../../../http/representation/BasicRepresentation';
import type { ResourceStore } from '../../../storage/ResourceStore';
import { readableToString } from '../../../util/StreamUtil';
import { TEXT_TURTLE } from '../../../util/ContentTypes';
import type { AssertionCommitter, PodResourceReader } from './PodRdfTools';

/**
 * Live adapters wiring the pod-bound LLM tool surface (CIV-B54/B55) to the real CSS
 * `ResourceStore` — the difference between the substrate being tested and the substrate actually
 * reading/writing a pod.
 *
 *  - {@link ResourceStorePodReader} backs `read_pod_resource` — a pod read through the internal
 *    store (no HTTP hop), honouring the store's own access rules at its boundary.
 *  - {@link ContainerAssertionCommitter} backs `propose_rdf_assertion` — a SHACL-conformant Turtle
 *    proposal is committed as a new resource under an assertions container. The gate in
 *    `PodRdfTools` decides; this only ever writes what already conformed — the model proposes, the
 *    shape disposes, and nothing probabilistic touches the store unvalidated.
 */
export class ResourceStorePodReader implements PodResourceReader {
  public constructor(private readonly store: ResourceStore) {}

  public async read(iri: string): Promise<{ contentType?: string; body: string }> {
    const representation = await this.store.getRepresentation(
      { path: iri },
      { type: { [TEXT_TURTLE]: 1, 'application/ld+json': 0.8, '*/*': 0.1 }},
    );
    return {
      contentType: representation.metadata.contentType,
      body: await readableToString(representation.data),
    };
  }
}

/**
 * Commits a SHACL-conformant Turtle assertion as a new resource under `assertionsContainer` — the
 * staged pod write. The server assigns the resource IRI; the proposal is already validated before
 * this runs.
 */
export class ContainerAssertionCommitter implements AssertionCommitter {
  public constructor(
    private readonly store: ResourceStore,
    /** The container new assertions are created under (e.g. `${pod}assertions/`). */
    private readonly assertionsContainer: string,
  ) {}

  public async commit(turtle: string): Promise<void> {
    await this.store.addResource(
      { path: this.assertionsContainer },
      new BasicRepresentation([ Buffer.from(turtle, 'utf-8') ], TEXT_TURTLE),
    );
  }
}
