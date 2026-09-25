import { BasicRepresentation } from '../../../../src/http/representation/BasicRepresentation';
import type { Representation } from '../../../../src/http/representation/Representation';
import type { ResourceIdentifier } from '../../../../src/http/representation/ResourceIdentifier';
import type { RepresentationPreferences } from '../../../../src/http/representation/RepresentationPreferences';
import type { Conditions } from '../../../../src/storage/conditions/Conditions';
import type { ChangeMap, ResourceStore } from '../../../../src/storage/ResourceStore';
import type { Patch } from '../../../../src/http/representation/Patch';
import { IdentifierMap } from '../../../../src/util/map/IdentifierMap';
import { NotFoundHttpError } from '../../../../src/util/errors/NotFoundHttpError';
import { InternalServerError } from '../../../../src/util/errors/InternalServerError';
import {
  ContainerAssertionCommitter,
  ResourceStorePodReader,
} from '../../../../src/databox/modules/llm/PodStoreAdapters';

/** A minimal in-memory ResourceStore — enough of the surface for the read/commit adapters. */
class InMemoryStore {
  public readonly resources = new Map<string, Representation>();
  public readonly added: { container: string; body: string }[] = [];

  public async getRepresentation(id: ResourceIdentifier, _p: RepresentationPreferences): Promise<Representation> {
    const rep = this.resources.get(id.path);
    if (rep === undefined) {
      throw new NotFoundHttpError();
    }
    return rep;
  }

  public async addResource(container: ResourceIdentifier, representation: Representation): Promise<ChangeMap> {
    const chunks: Buffer[] = [];
    for await (const chunk of representation.data) {
      chunks.push(Buffer.from(chunk as string));
    }
    this.added.push({ container: container.path, body: Buffer.concat(chunks).toString('utf8') });
    return new IdentifierMap();
  }

  public async setRepresentation(_id: ResourceIdentifier, _r: Representation, _c?: Conditions): Promise<ChangeMap> {
    throw new InternalServerError('not used');
  }

  public async deleteResource(_id: ResourceIdentifier, _c?: Conditions): Promise<ChangeMap> {
    throw new InternalServerError('not used');
  }

  public async modifyResource(_id: ResourceIdentifier, _p: Patch, _c?: Conditions): Promise<ChangeMap> {
    throw new InternalServerError('not used');
  }

  public async hasResource(_id: ResourceIdentifier): Promise<boolean> {
    throw new InternalServerError('not used');
  }
}

const asStore = (store: InMemoryStore): ResourceStore => store;

describe('PodStoreAdapters — live wiring of the LLM tool surface', (): void => {
  it(
    'ResourceStorePodReader reads a pod resource through the internal store (no HTTP hop).',
    async(): Promise<void> => {
      const store = new InMemoryStore();
      store.resources.set(
        'http://pod/alice/profile',
        new BasicRepresentation([ Buffer.from('<a> <b> <c>.', 'utf-8') ], 'text/turtle'),
      );
      const result = await new ResourceStorePodReader(asStore(store)).read('http://pod/alice/profile');
      expect(result.body).toBe('<a> <b> <c>.');
      expect(result.contentType).toBe('text/turtle');
    },
  );

  it(
    'ContainerAssertionCommitter stages a conformant Turtle write under the assertions container.',
    async(): Promise<void> => {
      const store = new InMemoryStore();
      const committer = new ContainerAssertionCommitter(asStore(store), 'http://pod/alice/assertions/');
      await committer.commit('<s> <p> <o>.');
      expect(store.added).toHaveLength(1);
      expect(store.added[0].container).toBe('http://pod/alice/assertions/');
      expect(store.added[0].body).toBe('<s> <p> <o>.');
    },
  );
});
