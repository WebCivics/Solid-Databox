import { OxigraphModule } from '../../../../src/databox/modules/oxigraph/OxigraphModule';
import type { SparqlResults } from '../../../../src/databox/modules/rdf/SparqlEngine';

const TRIPLES = `
@prefix ex: <http://example.org/> .
ex:site1 a ex:CheckIn ; ex:siteNumber 4 ; ex:powerKw "5.0"^^<http://www.w3.org/2001/XMLSchema#decimal> .
ex:site2 a ex:CheckIn ; ex:siteNumber 7 ; ex:powerKw "7.2"^^<http://www.w3.org/2001/XMLSchema#decimal> .
`;

describe('OxigraphModule', (): void => {
  it('loads Turtle and answers SELECT/ASK/CONSTRUCT.', async(): Promise<void> => {
    const module = new OxigraphModule();
    await module.load(TRIPLES);
    await expect(module.size()).resolves.toBeGreaterThan(0);

    const select = await module.query('SELECT ?s WHERE { ?s <http://example.org/siteNumber> ?n } ORDER BY ?n');
    expect(select).toMatchObject({ kind: 'bindings' });
    expect((select as unknown as { rows: { s: string }[] }).rows.map(row => row.s))
      .toEqual([ 'http://example.org/site1', 'http://example.org/site2' ]);

    const ask = await module.query('ASK { <http://example.org/site1> a <http://example.org/CheckIn> }');
    expect(ask).toEqual({ kind: 'boolean', value: true });

    const construct = await module.query('CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o }');
    expect(construct).toMatchObject({ kind: 'quads' });
    expect((construct as unknown as { triples: string[] }).triples
      .some(triple => triple.includes('siteNumber'))).toBe(true);
  });

  it('applies SPARQL updates and dumps the store.', async(): Promise<void> => {
    const module = new OxigraphModule();
    await module.update('INSERT DATA { <http://example.org/x> <http://example.org/y> "v" }');
    await expect(module.query('ASK { <http://example.org/x> <http://example.org/y> "v" }')).resolves
      .toEqual({ kind: 'boolean', value: true });
    await expect(module.dump()).resolves.toContain('http://example.org/x');
  });

  it('fails closed on malformed Turtle and bad SPARQL.', async(): Promise<void> => {
    const module = new OxigraphModule();
    await expect(module.load('not rdf at all {{{')).rejects.toThrow('load failed');
    await expect(module.query('NOT SPARQL')).rejects.toThrow('query failed');
    await expect(module.update('DELETE WHERE BAD')).rejects.toThrow('update failed');
  });

  it('withEphemeralStore confines the graph to the call.', async(): Promise<void> => {
    const module = new OxigraphModule();
    const result = await module.withEphemeralStore(
      TRIPLES,
      'text/turtle',
      async(ephemeral): Promise<SparqlResults> =>
        ephemeral.query('ASK { <http://example.org/site2> a <http://example.org/CheckIn> }'),
    );
    expect(result).toEqual({ kind: 'boolean', value: true });
    // The persistent store never saw the ephemeral data.
    await expect(module.size()).resolves.toBe(0);
  });
});
