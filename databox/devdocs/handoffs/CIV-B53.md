# CIV-B53/B54/B55 — Local LLM agent + Oxigraph/SHACL layer (partial — module substrate landed)

**Status:** running (module substrate complete; live-inference wiring remains)
**Driver:** `F:\LLMs\Wllama and Solid Pod Integration (1).md` — the pod-bound local-LLM
blueprint rationalised into the databox.

## What landed (this slice)

A new profile-agnostic module root `src/databox/modules/` — deliberately outside `ipms/`
so the personal/household profiles consume it, and carrying a **licensing-aware manifest**
(`DataboxModuleManifest`: `license` + `packaging: bundled|optional|external` +
`runtimeDependencies` with their licenses) so an undecided-license component can be
excluded or separately packaged without touching the core.

### `modules/oxigraph` (CIV-B54 substrate — `optional` packaging)

- `OxigraphModule` — the WASM `oxigraph` engine as a first-class module: `load` / `query`
  (SELECT→bindings, ASK→boolean, CONSTRUCT→quads) / `update` / `dump` on a persistent
  store, plus `withEphemeralStore` — a per-call WASM graph that is freed when the call
  returns (the LLM/validation path: nothing persists).
- `OxigraphSparqlHttpHandler` — SPARQL-over-HTTP (`POST {base}/query`, `…/update`,
  `GET /dump`) with an injected authorizer — the modularised form of
  `scripts/oxigraph-wasm-server.mjs`, deployable on personal *and* org profiles.

### `modules/llm` (CIV-B53 agent loop + B55 gate — `external` packaging)

- `LlmBackend` contract + `OllamaHttpBackend` — real adapter for local Ollama
  (`POST /api/chat`, tool-calling, `stream:false`); the browser/Wllama path implements the
  same contract inside the WASM worker — the agent code is identical either way.
- `PodRdfTools` — the only three tools the agent gets:
  - `read_pod_resource` — injected reader (ResourceStore adapter or authed fetch).
  - `query_pod_graph` — SPARQL over an ephemeral Oxigraph store.
  - `propose_rdf_assertion` — **SHACL-gated**: parse → `shacl-engine` validate → commit
    only on conformance; violations are returned to the model as text. The tool is not
    advertised at all without shapes+committer.
- `PodBoundLlmAgent` — the loop: bounded steps (default 8, runaway terminates), tool
  errors feed back as text, provenance per turn.
- `ProvActivityLog` — PROV-O per cycle (prompt=Entity, inference=Activity,
  outputs=Entities, `wasAssociatedWith` = actor WebID), serializable to Turtle for the
  pod's log container.

## Decisions taken

- **The model proposes; SHACL disposes.** The LLM never writes directly — the B.6/B30
  deterministic boundary is untouched (the agent is assistive, never enforcement).
- **`external` packaging for the LLM module** — the QualiaDB licensing question is
  unresolved; the manifest boundary lets a build drop it wholesale.
- **`shacl-engine` over `rdf-validate-shacl`** — the latter's `clownface`/`rdf-ext`
  factory chain was brittle under this toolchain; `shacl-engine` (MIT) runs clean on n3
  datasets. `rdf-ext` + `shacl-engine` added to package.json; `shacl-engine`/`grapoi`/
  `rdf-literal`/`rdf-validation`/`rdf-ext`/`oxigraph` added to jest's ESM transform list;
  a local `ShaclEngine.d.ts` declares the untyped surface.
- **Voice (CIV-B56)** is untouched — it lands on this same tool surface (ASR→text→agent
  →TTS), no separate semantic path.

## Verification

- 8 tests: oxigraph load/query/update/dump/ephemeral + fail-closed on malformed input;
  agent turn end-to-end (query → SHACL-valid assertion committed → PROV-O trail), SHACL
  violation rejection, tool-error feedback, runaway-loop termination.
- `tsc` + `eslint` clean; 12 personal+module suites green.

## Remaining for the gates

- **B53**: wire a real inference backend end-to-end (Ollama daemon on the host, or the
  Wllama browser shell serving `wllama.wasm`+`.gguf` from the pod under a strict CSP);
  the `ResourceStore` reader adapter; `read_pod_resource` auth scoping to the actor.
- **B54**: covered functionally by the module; the gate adds the ResourceStore-bound
  reader path in a live preset.
- **B55**: persist `ProvActivityLog.toTurtle()` into a pod log container per cycle.
- **B56**: the WASM voice pipeline (whisper.wasm ASR → this agent → Piper TTS) — entirely
  downstream of the above.
