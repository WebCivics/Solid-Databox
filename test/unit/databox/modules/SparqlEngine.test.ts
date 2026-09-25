import { OxigraphModule } from '../../../../src/databox/modules/oxigraph/OxigraphModule';
import type { LoadedGraph, SparqlEngine, SparqlResults } from '../../../../src/databox/modules/rdf/SparqlEngine';
import { withEphemeralStore } from '../../../../src/databox/modules/rdf/SparqlEngine';
import { resolveSparqlEngine } from '../../../../src/databox/modules/rdf/SparqlEngineFactory';

const TRIPLES = `
@prefix ex: <http://example.org/> .
ex:a a ex:Thing ; ex:n 1 .
ex:b a ex:Thing ; ex:n 2 .
`;

/**
 * The interchangeability contract (CIV-B53..56): any `SparqlEngine` — the bundled Oxigraph, a remote
 * endpoint, or a deployer-supplied external store such as a QualiaDB adapter — satisfies the same
 * surface. This suite runs the SAME assertions against the bundled adapter and a stub external
 * engine to prove the seam is real and that a non-packaged engine drops in without edits.
 */
describe('SparqlEngine port — interchangeability', (): void => {
  /** A stub external store — stands in for a QualiaDB/external adapter (the port, not the impl). */
  class ExternalEngineStub implements SparqlEngine {
    private readonly quads: string[] = [];

    public async load(data: string): Promise<LoadedGraph> {
      this.quads.push(...data.split('\n').map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('@prefix')));
      return { loaded: this.quads.length };
    }

    public async query(sparql: string): Promise<SparqlResults> {
      if (sparql.trim().startsWith('ASK')) {
        return { kind: 'boolean', value: this.quads.length > 0 };
      }
      return { kind: 'quads', triples: this.quads };
    }

    public async update(sparql: string): Promise<void> {
      const m = /INSERT DATA \{(.*)\}/su.exec(sparql);
      if (m?.[1] !== undefined) {
        this.quads.push(m[1]);
      }
    }

    public async dump(): Promise<string> {
      return this.quads.join('\n');
    }

    public async size(): Promise<number> {
      return this.quads.length;
    }

    public ephemeral(): SparqlEngine {
      return new ExternalEngineStub();
    }
  }

  const engines: [ string, () => SparqlEngine ][] = [
    [ 'oxigraph', (): SparqlEngine => new OxigraphModule() ],
    [ 'external-stub', (): SparqlEngine => new ExternalEngineStub() ],
  ];

  it.each(engines)('satisfies the port surface (%s)', async(_label, make): Promise<void> => {
    const engine = make();
    await engine.load(TRIPLES, 'text/turtle');
    await expect(engine.size()).resolves.toBeGreaterThan(0);
    const ask = await engine.query('ASK { ?s ?p ?o }');
    expect(ask).toEqual({ kind: 'boolean', value: true });
    // The ephemeral workspace is engine-supplied and isolated from the persistent store.
    const isolated = await withEphemeralStore(
      engine,
      TRIPLES,
      'text/turtle',
      async store => store.size(),
    );
    expect(isolated).toBeGreaterThan(0);
  });

  it('resolveSparqlEngine selects the bundled oxigraph adapter by default.', (): void => {
    expect(resolveSparqlEngine({})).toBeInstanceOf(OxigraphModule);
    expect(resolveSparqlEngine({ kind: 'oxigraph' })).toBeInstanceOf(OxigraphModule);
  });

  it('resolveSparqlEngine wires a remote endpoint or an external engine — QualiaDB unbundled.', (): void => {
    const remote = resolveSparqlEngine({ kind: 'remote-sparql', queryEndpoint: 'http://qdb.local/sparql' });
    expect(remote.constructor.name).toBe('RemoteSparqlEngine');
    const external = new ExternalEngineStub();
    expect(resolveSparqlEngine({ kind: 'external', external })).toBe(external);
  });

  it('resolveSparqlEngine fails closed without the required config.', (): void => {
    expect((): SparqlEngine => resolveSparqlEngine({ kind: 'remote-sparql' })).toThrow('queryEndpoint');
    expect((): SparqlEngine => resolveSparqlEngine({ kind: 'external' })).toThrow('external');
  });
});
