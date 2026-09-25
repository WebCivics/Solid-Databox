import fetch from 'cross-fetch';
import type { LoadedGraph, SparqlEngine, SparqlResults } from './SparqlEngine';
import { engineError } from './SparqlEngine';

/**
 * A {@link SparqlEngine} over a remote SPARQL 1.1 endpoint — the bundled adapter that lets an
 * alternative store (QualiaDB behind a SPARQL front-end, Fuseki, a hosted triplestore) plug in
 * through the same port WITHOUT being packaged. The deployment supplies `queryEndpoint` (and
 * `updateEndpoint`, defaulting to the query endpoint); authentication/headers are the deployer's.
 *
 * `ephemeral()` returns a fresh engine that clears the endpoint's default graph on `load` — a
 * logical scratch workspace. A deployer needing hard isolation supplies a dedicated adapter scoped
 * to its store's isolation model; this adapter is the interoperable default.
 */
export interface RemoteSparqlEngineOptions {
  /** The SPARQL 1.1 query endpoint (SELECT/ASK/CONSTRUCT/DESCRIBE). */
  readonly queryEndpoint: string;
  /** The SPARQL 1.1 update endpoint; defaults to `queryEndpoint`. */
  readonly updateEndpoint?: string;
  /** Extra headers for both endpoints (auth is the deployer's concern). */
  readonly headers?: Record<string, string>;
}

export class RemoteSparqlEngine implements SparqlEngine {
  private readonly updateEndpoint: string;
  /** Ephemeral workspaces clear before loading so a scratch query sees only its own data. */
  private readonly scratch: boolean;

  public constructor(private readonly options: RemoteSparqlEngineOptions, scratch = false) {
    this.updateEndpoint = options.updateEndpoint ?? options.queryEndpoint;
    this.scratch = scratch;
  }

  public async load(data: string, _format = 'text/turtle', _baseIri?: string): Promise<LoadedGraph> {
    if (this.scratch) {
      await this.update('CLEAR DEFAULT');
    }
    // INSERT DATA accepts Turtle directly — the portable load path for a remote store.
    await this.update(`INSERT DATA { ${data} }`);
    return { loaded: await this.size() };
  }

  public async query(sparql: string): Promise<SparqlResults> {
    const res = await fetch(this.options.queryEndpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/sparql-query',
        accept: 'application/sparql-results+json, text/turtle, application/n-quads',
        ...this.options.headers,
      },
      body: sparql,
    });
    if (!res.ok) {
      throw engineError('remote SPARQL query', new Error(`HTTP ${res.status}: ${await res.text()}`));
    }
    const ct = res.headers.get('content-type') ?? '';
    if (ct.includes('boolean') || ct.includes('json')) {
      const body = await res.json() as {
        boolean?: boolean;
        head?: { vars?: string[] };
        results?: { bindings?: Record<string, { value: string }>[] };
      };
      if (typeof body.boolean === 'boolean') {
        return { kind: 'boolean', value: body.boolean };
      }
      const rows = (body.results?.bindings ?? []).map((b): Record<string, string> => {
        const row: Record<string, string> = {};
        for (const [ k, term ] of Object.entries(b)) {
          row[k] = term.value;
        }
        return row;
      });
      return { kind: 'bindings', variables: body.head?.vars ?? [], rows };
    }
    // A graph result (CONSTRUCT/DESCRIBE) serializes to RDF text — return as quad lines.
    const text = await res.text();
    const triples = text.split('\n').map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('#'));
    return { kind: 'quads', triples };
  }

  public async update(sparqlUpdate: string): Promise<void> {
    const res = await fetch(this.updateEndpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/sparql-update',
        ...this.options.headers,
      },
      body: sparqlUpdate,
    });
    if (!res.ok) {
      throw engineError('remote SPARQL update', new Error(`HTTP ${res.status}: ${await res.text()}`));
    }
  }

  public async dump(_format = 'application/n-quads'): Promise<string> {
    const res = await this.query('CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o }');
    return res.kind === 'quads' ? `${res.triples.join('\n')}\n` : '';
  }

  public async size(): Promise<number> {
    const res = await this.query('SELECT (COUNT(*) AS ?c) WHERE { ?s ?p ?o }');
    const count = res.kind === 'bindings' ? Number(res.rows[0]?.c ?? 0) : 0;
    return Number.isNaN(count) ? 0 : count;
  }

  public ephemeral(): SparqlEngine {
    return new RemoteSparqlEngine(this.options, true);
  }
}
