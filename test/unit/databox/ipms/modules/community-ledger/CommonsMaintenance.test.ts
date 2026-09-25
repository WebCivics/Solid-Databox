import { CommonsMaintenance } from '../../../../../../src/databox/ipms/modules/community-ledger/CommonsMaintenance';
import type { Representation } from '../../../../../../src/http/representation/Representation';
import type { ResourceIdentifier } from '../../../../../../src/http/representation/ResourceIdentifier';
import type { ResourceStore } from '../../../../../../src/storage/ResourceStore';
import type { RdfShapeConfig } from '../../../../../../src/databox/gateway/RdfShapeValidator';

class Store {
  public writes: { path: string; body: string }[] = [];
  public async setRepresentation(id: ResourceIdentifier, rep: Representation): Promise<void> {
    const chunks: Buffer[] = [];
    for await (const c of rep.data) {
      chunks.push(Buffer.from(c as string));
    }
    this.writes.push({ path: id.path, body: Buffer.concat(chunks).toString('utf8') });
  }
}
const asStore = (s: Store): ResourceStore => s as unknown as ResourceStore;
const shape: RdfShapeConfig = { pinnedContexts: [], limits: { maxNodes: 1000, maxDepth: 16 }};

const turtle = '<> a <http://xmlns.com/foaf/0.1/Document> .';

describe('CommonsMaintenance — propose→validate→review→merge for the evidence commons (CIV-B42)', (): void => {
  it('proposes a validated change, then a reviewer merges it into the graph.', async(): Promise<void> => {
    const store = new Store();
    const commons = new CommonsMaintenance(asStore(store), shape);
    const p = commons.propose('alice', 'https://commons.example/foods/oats', turtle, 'text/turtle');
    expect(p.status).toBe('pending');
    expect(store.writes).toHaveLength(0); // Not merged yet — the graph is gated.
    await commons.merge(p.proposalId, 'reviewer-1');
    expect(commons.status(p.proposalId)).toBe('merged');
    expect(store.writes[0].path).toBe('https://commons.example/foods/oats'); // Now in the graph.
    expect(commons.verify().valid).toBe(true);
    expect(commons.trail().map(e => e.action)).toEqual([ 'proposed', 'validated', 'merged' ]);
  });

  it('a contributor cannot merge their own proposal — separation of duties.', async(): Promise<void> => {
    const commons = new CommonsMaintenance(asStore(new Store()), shape);
    const p = commons.propose('alice', 't', turtle, 'text/turtle');
    await expect(commons.merge(p.proposalId, 'alice')).rejects.toThrow('own proposal');
    expect(commons.status(p.proposalId)).toBe('pending');
  });

  it('a malformed change-set is refused at proposal — the graph never takes unvalidated input.', (): void => {
    const commons = new CommonsMaintenance(asStore(new Store()), shape);
    // An RDF/XML body claiming JSON — shape validation fails the media mismatch.
    expect((): unknown => commons.propose('alice', 't', '<not json', 'application/ld+json'))
      .toThrow('shape validation');
  });

  it('a rejected proposal logs the decision and never merges.', (): void => {
    const store = new Store();
    const commons = new CommonsMaintenance(asStore(store), shape);
    const p = commons.propose('alice', 't', turtle, 'text/turtle');
    commons.reject(p.proposalId, 'reviewer-1', 'unsupported claim');
    expect(commons.status(p.proposalId)).toBe('rejected');
    expect(store.writes).toHaveLength(0);
    expect(commons.trail().map(e => e.action)).toEqual([ 'proposed', 'validated', 'rejected' ]);
  });
});
