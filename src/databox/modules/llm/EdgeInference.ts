import { createHash } from 'node:crypto';
import { BadRequestHttpError } from '../../../util/errors/BadRequestHttpError';
import type { SparqlEngine } from '../rdf/SparqlEngine';
import { withEphemeralStore } from '../rdf/SparqlEngine';

/**
 * Edge inference patterns (CIV-B37, `concession-card.html` reasoning): local, *deterministic*
 * inference over pod RDF — small CONSTRUCT rules that derive assertions at read-time rather than
 * storing them. "If a device emitted telemetry, derive the summary"; "if a contribution was
 * recognised, derive the portfolio entry" — inference as a *pattern that fires on pod data*, not a
 * probabilistic model and never a persisted write.
 *
 * The boundary this preserves: an inference is DERIVED — it lives in the result overlay, tagged with
 * PROV-O provenance (which pattern produced it, over which input digest), and is NEVER written back
 * to the pod store. Read-time derivation, deterministic (same pod data + same pattern ⇒ same derived
 * triples), and attributable — a consumer can ask "where did this assertion come from" and get the
 * pattern + input digest. The pod's durable data stays ground-truth; inferences are a lens over it.
 */

export interface EdgeInferencePattern {
  /** The pattern's id (its PROV-O activity label). */
  readonly patternId: string;
  /** A SPARQL CONSTRUCT (or update→describe) producing the derived triples. */
  readonly construct: string;
  /** A human-facing description of what it derives. */
  readonly description: string;
}

export interface InferenceProvenance {
  /** The pattern that produced the derivation. */
  readonly patternId: string;
  /** How many triples it derived. */
  readonly derivedCount: number;
  /** A digest of the input pod data it ran over — the derivation's provenance anchor. */
  readonly inputDigest: string;
  readonly derivedAt: string;
}

export interface InferenceResult {
  /** All derived triples across the patterns (the overlay — never written to the pod). */
  readonly derived: readonly string[];
  /** Per-pattern provenance — which pattern produced what, over which input. */
  readonly provenance: readonly InferenceProvenance[];
}

/**
 * Run a set of edge-inference patterns over pod RDF — each CONSTRUCT applied to a fresh ephemeral
 * copy of the pod graph, its derived triples tagged with the pattern + input digest. The overlay is
 * returned, never persisted — derivation is read-time.
 */
export async function runEdgeInference(
  engine: SparqlEngine,
  podDataTurtle: string,
  patterns: readonly EdgeInferencePattern[],
  derivedAt = new Date().toISOString(),
): Promise<InferenceResult> {
  if (podDataTurtle.trim().length === 0 || patterns.length === 0) {
    throw new BadRequestHttpError('Edge inference needs pod data and ≥1 pattern.');
  }
  const inputDigest = createHash('sha256').update(podDataTurtle, 'utf8').digest('hex');
  const derived: string[] = [];
  const provenance: InferenceProvenance[] = [];
  for (const pattern of patterns) {
    if (pattern.construct.trim().length === 0) {
      throw new BadRequestHttpError(`Edge-inference pattern '${pattern.patternId}' has no CONSTRUCT.`);
    }
    const triples = await withEphemeralStore(
      engine,
      podDataTurtle,
      'text/turtle',
      async(ephemeral): Promise<readonly string[]> => {
        const result = await ephemeral.query(pattern.construct);
        return result.kind === 'quads' ? result.triples : [];
      },
    );
    derived.push(...triples);
    provenance.push({ patternId: pattern.patternId, derivedCount: triples.length, inputDigest, derivedAt });
  }
  return { derived, provenance };
}
