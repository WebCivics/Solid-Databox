/**
 * The data shapes returned by the {@link import('./SparqlEngine').SparqlEngine} port — kept in a
 * pure-types module (no runtime component) so the seam types don't emit as Components.js
 * components. `SparqlResults` is a union alias; `LoadedGraph` a small record.
 */
export type SparqlResults =
  | { readonly kind: 'boolean'; readonly value: boolean } |
  {
    readonly kind: 'bindings';
    readonly variables: readonly string[];
    readonly rows: readonly Record<string, string>[];
  } |
  { readonly kind: 'quads'; readonly triples: readonly string[] };

export interface LoadedGraph {
  /** The triple/quad count loaded, when determinable. */
  readonly loaded: number;
}
