import { BadRequestHttpError } from '../../../util/errors/BadRequestHttpError';
import type { LoadedGraph, SparqlResults } from './SparqlEngineTypes';

// The data/return shapes live in `SparqlEngineTypes` (pure types — no runtime component); they are
// re-exported so existing imports keep working and the seam reads from one place.
export type { LoadedGraph, SparqlResults } from './SparqlEngineTypes';

/**
 * The engine-neutral SPARQL/quad-store port (CIV-B53..56) — the seam that makes the RDF store
 * interchangeable. `OxigraphModule` is the bundled default adapter (a local WASM engine); an
 * alternative engine — QualiaDB, or any remote SPARQL endpoint — implements this same interface and
 * is injected by the deployment. Nothing in the repo depends on QualiaDB: it plugs in through this
 * port (via `RemoteSparqlEngine`, or an external adapter the deployer supplies) and is never
 * packaged, preserving the licensing boundary.
 *
 * The surface covers the durable store (load/query/update/dump/size) plus {@link ephemeral} — a
 * fresh, empty throwaway engine of the same kind for a single query workspace (the LLM scratchpad).
 */

export interface SparqlEngine {
  /** Load RDF text (Turtle/N-Triples/N-Quads/JSON-LD per `format`) into the store. */
  load: (data: string, format?: string, baseIri?: string) => Promise<LoadedGraph>;
  /** Execute SPARQL 1.1 — SELECT/ASK/CONSTRUCT/DESCRIBE. */
  query: (sparql: string) => Promise<SparqlResults>;
  /** Execute a SPARQL 1.1 Update. */
  update: (sparqlUpdate: string) => Promise<void>;
  /** Serialize the store (N-Quads by default). */
  dump: (format?: string) => Promise<string>;
  /** The number of triples/quads in the store. */
  size: () => Promise<number>;
  /**
   * A fresh, empty engine of the same kind — a single-query throwaway workspace. Local engines
   * (Oxigraph) return a new in-memory instance; a remote engine returns a scoped workspace per its
   * isolation model.
   */
  ephemeral: () => SparqlEngine;
}

/**
 * Run `fn` against a throwaway engine loaded with `rdf` — the LLM/validation scratchpad. The
 * engine's {@link SparqlEngine.ephemeral} supplies the workspace; nothing persists.
 */
export async function withEphemeralStore<T>(
  engine: SparqlEngine,
  rdf: string,
  format: string,
  fn: (engine: SparqlEngine) => Promise<T> | T,
): Promise<T> {
  const workspace = engine.ephemeral();
  if (rdf.length > 0) {
    await workspace.load(rdf, format);
  }
  return fn(workspace);
}

/** A {@link BadRequestHttpError} carrying an engine error message — shared by the adapters. */
export function engineError(op: string, error: unknown): BadRequestHttpError {
  return new BadRequestHttpError(`${op} failed: ${error instanceof Error ? error.message : String(error)}`);
}
