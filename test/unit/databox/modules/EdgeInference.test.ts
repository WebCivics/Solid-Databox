import { runEdgeInference } from '../../../../src/databox/modules/llm/EdgeInference';
import { OxigraphModule } from '../../../../src/databox/modules/oxigraph/OxigraphModule';

const POD_DATA = `
@prefix ex: <http://example.org/> .
@prefix cl: <urn:databox:community-ledger#> .
ex:contrib1 a cl:Contribution ; cl:recognised true ; cl:project ex:project-a .
`;

const PATTERN = {
  patternId: 'derive-portfolio-entry',
  description: 'Recognised contributions derive a portfolio entry.',
  construct: `
    PREFIX ex: <http://example.org/>
    PREFIX cl: <urn:databox:community-ledger#>
    CONSTRUCT { ?c cl:inPortfolio ex:project-a . }
    WHERE { ?c a cl:Contribution ; cl:recognised true ; cl:project ex:project-a . }
  `,
};

describe('EdgeInference — deterministic read-time derivation over pod RDF (CIV-B37)', (): void => {
  it('a CONSTRUCT pattern derives triples from pod data, with provenance.', async(): Promise<void> => {
    const engine = new OxigraphModule();
    const result = await runEdgeInference(engine, POD_DATA, [ PATTERN ]);
    expect(result.derived.length).toBeGreaterThan(0);
    // The derived triple names the recognised contribution in the project portfolio.
    expect(result.derived.some(t => t.includes('inPortfolio') || t.includes('project-a'))).toBe(true);
    // Provenance: which pattern derived it, over which input digest.
    expect(result.provenance[0].patternId).toBe('derive-portfolio-entry');
    expect(result.provenance[0].inputDigest).toMatch(/^[a-f0-9]{64}$/u);
  });

  it('is deterministic — same pod data + pattern derive the same overlay.', async(): Promise<void> => {
    const engine = new OxigraphModule();
    const a = await runEdgeInference(engine, POD_DATA, [ PATTERN ]);
    const b = await runEdgeInference(engine, POD_DATA, [ PATTERN ]);
    expect(a.derived).toEqual(b.derived); // Deterministic — a rule, not a probabilistic model.
  });

  it('fails closed on a pattern with no CONSTRUCT or no pod data.', async(): Promise<void> => {
    const engine = new OxigraphModule();
    await expect(runEdgeInference(engine, POD_DATA, [{ ...PATTERN, construct: '  ' }]))
      .rejects.toThrow('CONSTRUCT');
    await expect(runEdgeInference(engine, '  ', [ PATTERN ])).rejects.toThrow('pod data');
  });
});
