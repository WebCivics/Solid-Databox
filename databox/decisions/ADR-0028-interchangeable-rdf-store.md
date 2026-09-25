# ADR-0028 — Interchangeable RDF/SPARQL store (Oxigraph ↔ QualiaDB, unbundled)

**Status:** accepted. **Relates to:** CIV-B53..56, ADR-0024 (track separation / licensing boundary).

## Decision

The Databox's RDF/SPARQL store sits behind a single engine-neutral port —
`SparqlEngine` (`src/databox/modules/rdf/SparqlEngine.ts`) — so the engine is interchangeable.
**Oxigraph stays the bundled default; QualiaDB (or any alternative) plugs in through the port and is
never packaged in this software.**

- `SparqlEngine` is an async interface (`load`/`query`/`update`/`dump`/`size`/`ephemeral`) — async so a
  remote/networked store is a true drop-in, not a sync-only local assumption.
- `OxigraphModule implements SparqlEngine` — the bundled local WASM adapter (unchanged behaviour).
- `RemoteSparqlEngine implements SparqlEngine` — a SPARQL-1.1-over-HTTP adapter: any compliant
  endpoint (a QualiaDB SPARQL front-end, Fuseki, a hosted store) wires in via configuration.
- `resolveSparqlEngine` (`SparqlEngineFactory`) selects `oxigraph` (default), `remote-sparql`
  (endpoint), or `external` (a caller-supplied `SparqlEngine` — e.g. a native QualiaDB adapter the
  deployer imports and injects).

## Why a port, not a fork

Consumers depend on `SparqlEngine`, never on `OxigraphModule`: `PodRdfTools` (the LLM tool surface)
and `OxigraphSparqlHttpHandler` (the `/.databox/sparql` route) take the interface. The IPMS sync
path (`OxigraphIpmsSyncComposition`) already targets a remote `fetch-sparql-endpoint` update URL —
engine-agnostic by construction.

## QualiaDB / licensing boundary

QualiaDB is **not a dependency, not imported, not packaged**. It participates only as:

- a `remote-sparql` endpoint (deployer supplies the URL), or
- an `external` `SparqlEngine` adapter implemented and imported in the deployer's own wiring.

Either way the Databox repo carries zero QualiaDB code — the licensing track stays clean
(ADR-0024) and the swap is a deployment choice, not a code change.

## Ephemeral scratchpad

`ephemeral()` returns a fresh empty workspace of the same kind — the per-query in-memory store the
LLM/SHACL path uses (`withEphemeralStore`). Oxigraph returns a new WASM store; the remote adapter
returns a scratch workspace (clears the default graph on load); an external adapter supplies its own
isolation model.

## Verified

`test/unit/databox/modules/SparqlEngine.test.ts` runs the SAME port assertions against Oxigraph and
a stub external engine (a QualiaDB-shaped stand-in) — both satisfy the contract — plus the factory
resolving each `kind`. The swap is proven structural, not aspirational.
