import type { Quad } from 'n3';
import { DataFactory, Parser, Store } from 'n3';
import { Validator } from 'shacl-engine';
import type { ShaclValidationResult } from 'shacl-engine';
import { BadRequestHttpError } from '../../../util/errors/BadRequestHttpError';
import type { SparqlEngine } from '../rdf/SparqlEngine';
import { withEphemeralStore } from '../rdf/SparqlEngine';
import type { LlmToolSpec } from './LlmBackend';

/**
 * The RDF tool surface the pod-bound LLM agent is allowed to call (CIV-B54/B55):
 *
 *  - `read_pod_resource` — fetch a pod resource as text for the context window (through an
 *    injected reader: the internal `ResourceStore` adapter on the server, or an
 *    authenticated pod fetch in the browser).
 *  - `query_pod_graph` — SPARQL over an ephemeral Oxigraph store loaded with supplied RDF.
 *    The graph lives only for the call.
 *  - `propose_rdf_assertion` — the SHACL-gated write path: the candidate Turtle is parsed,
 *    validated against the pod's SHACL shapes, and committed only on conformance. A
 *    hallucinated or rule-breaking assertion is rejected with its violations — the model
 *    proposes; the shape disposes.
 */

/** Reads a pod resource for tool context — injected (ResourceStore adapter or fetch). */
export interface PodResourceReader {
  read: (iri: string) => Promise<{ contentType?: string; body: string }>;
}

/** Commits a SHACL-conformant Turtle assertion — injected (staged pod write). */
export interface AssertionCommitter {
  commit: (turtle: string) => Promise<void>;
}

export interface PodRdfToolsOptions {
  /** SHACL shapes (Turtle) gating `propose_rdf_assertion`. Omit → all assertions rejected. */
  readonly shapesTurtle?: string;
  /** Where conformant assertions are written. Omit → assertion tool absent entirely. */
  readonly committer?: AssertionCommitter;
}

export class PodRdfTools {
  private readonly shapes: Store | undefined;

  public constructor(
    private readonly reader: PodResourceReader,
    private readonly engine: SparqlEngine,
    private readonly options: PodRdfToolsOptions,
  ) {
    this.shapes = options.shapesTurtle === undefined ?
      undefined :
        new Store(new Parser().parse(options.shapesTurtle));
  }

  /** The tool specs handed to the backend — the assertion tool exists only when gated+committable. */
  public specs(): LlmToolSpec[] {
    const specs: LlmToolSpec[] = [
      {
        name: 'read_pod_resource',
        description: 'Read a resource from the pod (Turtle/JSON-LD) into context.',
        parameters: {
          type: 'object',
          properties: { iri: { type: 'string', description: 'The pod resource IRI to read.' }},
          required: [ 'iri' ],
        },
      },
      {
        name: 'query_pod_graph',
        description: 'Run a SPARQL 1.1 query over supplied RDF data (ephemeral graph).',
        parameters: {
          type: 'object',
          properties: {
            rdf: { type: 'string', description: 'Turtle data to load into the ephemeral store.' },
            sparql: { type: 'string', description: 'The SPARQL query to execute.' },
          },
          required: [ 'sparql' ],
        },
      },
    ];
    if (this.shapes !== undefined && this.options.committer !== undefined) {
      specs.push({
        name: 'propose_rdf_assertion',
        description: 'Propose a Turtle assertion to the pod — committed only if it conforms to the pod SHACL shapes.',
        parameters: {
          type: 'object',
          properties: {
            turtle: { type: 'string', description: 'The candidate RDF (Turtle) to assert.' },
          },
          required: [ 'turtle' ],
        },
      });
    }
    return specs;
  }

  /** Execute a tool call — returns the text fed back into the model's context. */
  public async execute(name: string, args: Record<string, unknown>): Promise<string> {
    switch (name) {
      case 'read_pod_resource':
        return this.readPodResource(args);
      case 'query_pod_graph':
        return this.queryPodGraph(args);
      case 'propose_rdf_assertion':
        return this.proposeAssertion(args);
      default:
        return `Unknown tool "${name}".`;
    }
  }

  private async readPodResource(args: Record<string, unknown>): Promise<string> {
    const iri = args.iri;
    if (typeof iri !== 'string' || iri.length === 0) {
      throw new BadRequestHttpError('read_pod_resource needs an `iri`.');
    }
    const resource = await this.reader.read(iri);
    return resource.body;
  }

  private async queryPodGraph(args: Record<string, unknown>): Promise<string> {
    const sparql = args.sparql;
    if (typeof sparql !== 'string' || sparql.trim().length === 0) {
      throw new BadRequestHttpError('query_pod_graph needs a `sparql` string.');
    }
    const rdf = typeof args.rdf === 'string' ? args.rdf : '';
    const results = await withEphemeralStore(
      this.engine,
      rdf,
      'text/turtle',
      async store => store.query(sparql),
    );
    if (results.kind === 'boolean') {
      return `Query result: ${results.value}`;
    }
    if (results.kind === 'quads') {
      return results.triples.join('\n');
    }
    return JSON.stringify(results.rows, undefined, 2);
  }

  /**
   * The SHACL gate: parse → validate → commit-on-conform. Without shapes or a committer
   * the tool is not even advertised; a call anyway is refused.
   */
  private async proposeAssertion(args: Record<string, unknown>): Promise<string> {
    if (this.shapes === undefined || this.options.committer === undefined) {
      throw new BadRequestHttpError('RDF assertion is not enabled — no shapes/committer configured.');
    }
    const turtle = args.turtle;
    if (typeof turtle !== 'string' || turtle.trim().length === 0) {
      throw new BadRequestHttpError('propose_rdf_assertion needs `turtle` content.');
    }
    let data: Store;
    try {
      data = new Store(new Parser().parse(turtle));
    } catch (error: unknown) {
      return `Rejected: the proposal is not valid Turtle (${error instanceof Error ? error.message : String(error)}).`;
    }
    const report = await validateShacl(this.shapes, data);
    if (!report.conforms) {
      return `Rejected: SHACL validation failed (${report.violations.join('; ')}).`;
    }
    await this.options.committer.commit(turtle);
    return 'Committed: the assertion conforms to the pod shapes.';
  }
}

/** Shacl-engine over n3 datasets — async validation, fail-closed on engine error. */
async function validateShacl(shapes: Store, data: Store): Promise<{ conforms: boolean; violations: string[] }> {
  const factory = { ...DataFactory, dataset: (quads?: Iterable<Quad>): Store => new Store([ ...quads ?? [] ]) };
  // N3's Store satisfies the RDF/JS DatasetCore the validator consumes.
  const report = await new Validator(shapes, { factory }).validate({ dataset: data });
  const violations = report.results.map((result: ShaclValidationResult): string =>
    result.message?.[0]?.value ?? result.focusNode?.value ?? 'violation');
  return { conforms: report.conforms, violations };
}
