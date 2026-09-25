import { OxigraphModule } from '../oxigraph/OxigraphModule';
import { BadRequestHttpError } from '../../../util/errors/BadRequestHttpError';
import type { SparqlEngine } from './SparqlEngine';
import { RemoteSparqlEngine } from './RemoteSparqlEngine';

/**
 * Selects the RDF store engine for a deployment (CIV-B53..56) — the interchangeability seam.
 * `oxigraph` is the bundled default; `remote-sparql` fronts an external endpoint (a QualiaDB
 * SPARQL surface, Fuseki, a hosted store) via configuration, so an alternative engine is wired
 * without being packaged. A store with no SPARQL surface supplies its own `SparqlEngine` adapter
 * through {@link resolveSparqlEngine}'s `external` — the port is the seam, not a dependency.
 */
export type SparqlEngineKind = 'oxigraph' | 'remote-sparql' | 'external';

export interface SparqlEngineConfig {
  /** Which engine backs the store. Defaults to the bundled `oxigraph`. */
  readonly kind?: SparqlEngineKind;
  /** For `remote-sparql`: the SPARQL 1.1 endpoint(s) + optional headers. */
  readonly queryEndpoint?: string;
  readonly updateEndpoint?: string;
  readonly headers?: Record<string, string>;
  /**
   * For `external`: a caller-supplied `SparqlEngine` — e.g. a QualiaDB adapter imported by the
   * deployment's own wiring. Never bundled here; the deployer owns the dependency.
   */
  readonly external?: SparqlEngine;
}

export function resolveSparqlEngine(config: SparqlEngineConfig): SparqlEngine {
  switch (config.kind ?? 'oxigraph') {
    case 'remote-sparql': {
      if (config.queryEndpoint === undefined) {
        throw new BadRequestHttpError('remote-sparql engine requires a `queryEndpoint`.');
      }
      return new RemoteSparqlEngine({
        queryEndpoint: config.queryEndpoint,
        updateEndpoint: config.updateEndpoint,
        headers: config.headers,
      });
    }
    case 'external': {
      if (config.external === undefined) {
        throw new BadRequestHttpError('external engine requires a caller-supplied `SparqlEngine`.');
      }
      return config.external;
    }
    case 'oxigraph':
    default:
      return new OxigraphModule();
  }
}
