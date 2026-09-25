import oxigraph from 'oxigraph';
import { BadRequestHttpError } from '../../../util/errors/BadRequestHttpError';
import type { LoadedGraph, SparqlEngine, SparqlResults } from '../rdf/SparqlEngine';
import type { DataboxModuleManifest } from '../DataboxModuleManifest';

// The engine-neutral result/loaded shapes live in the `SparqlEngine` port (CIV-B53..56) so a
// different store (QualiaDB, a remote endpoint) plugs in through the same contract. Re-exported
// here so existing imports of `OxigraphModule`'s types keep working.
export type { LoadedGraph, SparqlResults } from '../rdf/SparqlEngine';

/**
 * The Oxigraph module (CIV-B54 substrate): a WASM-backed RDF quad store + SPARQL 1.1
 * engine running inside the Databox process — query, update, load, dump — with no external
 * endpoint. Two store lifetimes are supported:
 *
 *  - **persistent** — a long-lived store the module owns (the pod's local SPARQL surface).
 *  - **ephemeral** — `withEphemeralStore` creates a store for one operation and drops it:
 *    the LLM-tool / validation path where the graph exists only for the call.
 *
 * The `oxigraph` npm package is a WASM build of the Rust engine — it runs identically on
 * the server (Node) and in a browser bundle, so the same module serves the organisation
 * databox, a personal pod, and the in-browser agent path.
 */

interface OxigraphTerm {
  termType?: string;
  value: string;
  language?: string;
  datatype?: { value: string };
}

/** Term → compact N-Triples fragment for the quad path. */
function termToString(term: OxigraphTerm): string {
  if (term.termType === 'NamedNode') {
    return `<${term.value}>`;
  }
  if (term.termType === 'BlankNode') {
    return `_:${term.value}`;
  }
  const literal = JSON.stringify(term.value);
  if (term.language !== undefined && term.language.length > 0) {
    return `${literal}@${term.language}`;
  }
  if (term.datatype !== undefined && term.datatype.value !== 'http://www.w3.org/2001/XMLSchema#string') {
    return `${literal}^^<${term.datatype.value}>`;
  }
  return literal;
}

export class OxigraphModule implements SparqlEngine {
  private readonly store = new oxigraph.Store();

  /** Load RDF text (Turtle/N-Triples/N-Quads/JSON-LD per `format`) into the persistent store. */
  public async load(data: string, format = 'text/turtle', baseIri?: string): Promise<LoadedGraph> {
    try {
      this.store.load(data, { format, ...baseIri === undefined ? {} : { base_iri: baseIri }});
    } catch (error: unknown) {
      throw new BadRequestHttpError(`Oxigraph load failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    return { loaded: await this.size() };
  }

  /** Execute SPARQL 1.1 — SELECT/ASK/CONSTRUCT/DESCRIBE — over the persistent store. */
  public async query(sparql: string): Promise<SparqlResults> {
    let result: unknown;
    try {
      result = this.store.query(sparql);
    } catch (error: unknown) {
      throw new BadRequestHttpError(`SPARQL query failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    return normalizeResults(result);
  }

  /** Execute a SPARQL 1.1 Update over the persistent store. */
  public async update(sparqlUpdate: string): Promise<void> {
    try {
      this.store.update(sparqlUpdate);
    } catch (error: unknown) {
      throw new BadRequestHttpError(`SPARQL update failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /** Serialize the store (N-Quads by default). */
  public async dump(format = 'application/n-quads'): Promise<string> {
    return this.store.dump({ format });
  }

  public async size(): Promise<number> {
    return this.store.size;
  }

  /** A fresh, empty WASM store — the throwaway query workspace for the LLM/validation path. */
  public ephemeral(): SparqlEngine {
    return new OxigraphModule();
  }

  /**
   * Run an operation against a throwaway store — the LLM/validation path. The WASM graph
   * is reclaimed when `fn` returns; nothing persists.
   */
  public async withEphemeralStore<T>(
    rdf: string,
    format: string,
    fn: (engine: SparqlEngine) => Promise<T> | T,
  ): Promise<T> {
    const workspace = this.ephemeral();
    if (rdf.length > 0) {
      await workspace.load(rdf, format);
    }
    return fn(workspace);
  }
}

/** Normalize the WASM result union (boolean | bindings[] | quads[]) into one shape. */
export function normalizeResults(result: unknown): SparqlResults {
  if (typeof result === 'boolean') {
    return { kind: 'boolean', value: result };
  }
  if (Array.isArray(result)) {
    if (result.length === 0) {
      return { kind: 'bindings', variables: [], rows: []};
    }
    const first = result[0] as Record<string, unknown>;
    if (typeof (first as { entries?: unknown }).entries === 'function') {
      const rows: Record<string, string>[] = [];
      const variables = new Set<string>();
      for (const binding of result as Iterable<Map<string, { value: string }>>) {
        const row: Record<string, string> = {};
        for (const [ key, term ] of binding.entries()) {
          variables.add(key);
          row[key] = term.value;
        }
        rows.push(row);
      }
      return { kind: 'bindings', variables: [ ...variables ], rows };
    }
    if ('subject' in first) {
      const quads = result as { subject: OxigraphTerm; predicate: OxigraphTerm; object: OxigraphTerm }[];
      const triples = quads.map(quad =>
        `${termToString(quad.subject)} ${termToString(quad.predicate)} ${termToString(quad.object)} .`);
      return { kind: 'quads', triples };
    }
  }
  return { kind: 'bindings', variables: [], rows: []};
}

/** The module manifest — `optional` packaging: excluded from a build on request. */
export const OXIGRAPH_MODULE: DataboxModuleManifest = {
  id: 'databox-oxigraph',
  name: 'Oxigraph RDF/SPARQL engine',
  version: '0.1.0',
  description: 'WASM-backed in-process RDF quad store + SPARQL 1.1 — persistent or ephemeral, no external endpoint.',
  license: 'MIT',
  packaging: 'optional',
  runtimeDependencies: [
    { name: 'oxigraph', license: 'MIT OR Apache-2.0', note: 'WASM build of the Oxigraph engine' },
  ],
  capabilities: [ 'sparql', 'rdf-store', 'ephemeral-graph' ],
  profiles: [ 'personal', 'household', 'organisation' ],
  routes: [ '/.databox/sparql/query', '/.databox/sparql/update' ],
};
