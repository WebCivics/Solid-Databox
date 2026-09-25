/**
 * A profile-agnostic Databox module manifest — the packaging/licensing boundary for
 * optional functionality that may ship separately (or under its own license) from the
 * core server. Mirrors `ipms/SolidModuleManifest` in spirit but lives outside IPMS so the
 * personal profile can consume it, and carries explicit licensing/packaging metadata so a
 * distribution can enumerate, exclude, or re-license a module cleanly.
 */

export type ModulePackaging =
  /** Ships inside the core distribution. */
  | 'bundled' |
  /** Optional — present in the tree but excluded from a build on request. */
  'optional' |
  /** Not shipped with the distribution; supplied by a separate module package/license. */
  'external';

export interface DataboxModuleManifest {
  /** Stable module identifier, e.g. `databox-oxigraph`. */
  readonly id: string;
  /** Human-readable module name. */
  readonly name: string;
  /** Semantic version of the module. */
  readonly version: string;
  /** One-line description. */
  readonly description: string;
  /**
   * SPDX-style license of THIS module's code (the wrapper), independent of the runtime
   * dependency's license — recorded separately in `runtimeDependencies`.
   */
  readonly license: string;
  /**
   * Whether the module ships with the distribution. `optional`/`external` modules are the
   * seam for separately-licensed functionality (e.g. an undecided-license component can
   * land as `external` so a build can omit it without touching the core).
   */
  readonly packaging: ModulePackaging;
  /**
   * Runtime dependencies the module needs, with their licenses — the packaging/audit
   * surface for "what does this module pull in". The dependency is NOT imported unless the
   * module is enabled; a build can tree-shake an `external` module wholesale.
   */
  readonly runtimeDependencies: readonly {
    readonly name: string;
    readonly license: string;
    readonly note?: string;
  }[];
  /** Capability identifiers this module provides (e.g. `sparql`, `llm-inference`). */
  readonly capabilities: readonly string[];
  /** Profiles the module is permitted in — `'personal'`, `'household'`, `'organisation'`. */
  readonly profiles: readonly string[];
  /** Control-plane/HTTP sub-routes the module mounts when enabled. */
  readonly routes: readonly string[];
}
