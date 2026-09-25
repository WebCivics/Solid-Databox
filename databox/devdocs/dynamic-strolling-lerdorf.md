# Plan: A Solid-native IPMS for CSS — modules, config, setup, admin, users
### First concrete module: Hosting / Cloudflare domain setup

> Status: **draft for Timothy to extend** ("I have a lot to add"). This is a plain markdown working
> document — edit directly or drop notes in chat and I'll integrate them coherently. Open questions and
> the places most wanting your input are marked **⟵ your call** / **TBC**.

---

## 1. Context & intent

**North star — any organisation, self-hosted, on-premises.** Scope is **any organisation** (business, club,
association, co-op, enterprise) running this on its own box — the **small business in its shop is the
archetype** (non-expert operator, modest hardware, low-ops), not the limit. That drives easy domain/hosting
setup and a growth path into the tools such an org needs — a **POS system**, **IoT / Web-of-Things**
(devices: scanners, sensors, displays → **device identity**), **real-time** (**WebSockets**), and
**payments** (§10.5). The IPMS is the frame; these arrive as **modules** (roadmap §10). **Design for a
non-expert operator on modest hardware, not a data-centre.**

**The core model is two-part (§5.0)** — the *legal entity* (the organisation as a legal person, the anchor)
and the *relationship directory* (every related agent — people, orgs, devices — in typed roles, some
carrying Verifiable Credentials). Everything else manages relations for that entity.

The presenting request: an admin page to point a Solid server at a domain via Cloudflare, with two routes —
`databox.<org-domain>.tld` (the databox / Solid pod interfaces) and `www.<org-domain>.tld` (the org
website, optional; **reserve route + DNS only** this pass, "served using databox capabilities" later).

The real intent (your direction): **don't build a one-off page — build the IPMS.** A content-management
system carries a *range* of subsystems — **configuration, setup/onboarding, admin, user management, and
module management** — WordPress-like but **Solid-native**: every subsystem's state is stored using Solid
methods (LDP/RDF resources, WAC/ACP access control, Type-Index discovery), not side files. Modules can be
enabled/disabled and contribute their own admin UI. **Hosting/Cloudflare is the first module** on that IPMS.

Hard constraint that shapes honesty everywhere: a running server's `baseUrl` and subdomain routing are
**startup config** (CLI `--baseUrl` + `config/util/identifiers/subdomain.json`), **not runtime-mutable**.
The IPMS therefore *generates correct DNS + launch/config artifacts and persists intended config as Solid
data* — it never pretends to re-point a live server; it tells the operator what to (re)launch with.

---

### 1.1 Packaging — the IPMS is an opt-in installation profile (not baked into core)

**Requirement:** a user must be able to **install the basic version** — a plain CSS / Solid server — with
none of this. The whole IPMS is **additive and opt-in**, layered the idiomatic CSS way: **Components.js config
presets** (`-c config/…json`), exactly as `config/databox/live.json` already layers today. This keeps the
fork honest (presets are upstream practice, per the community-work standard) and mergeable.

**Two levels of opt-in:**
- **Install-time profile** — a layered stack the operator chooses: **basic CSS → +databox → +IPMS →
  +modules**. Choosing *basic* gets a vanilla Solid server; the base presets (`config/default.json`,
  storage/memory/file, identity, etc.) are **left untouched and must keep passing on their own**.
- **Runtime** — within the IPMS profile, individual modules enable/disable (§5.1).

**Hard rule:** no IPMS behaviour may leak into the default/base server. New behaviour ships as *new* presets +
new code guarded behind the IPMS profile. A future step can extract the IPMS layer into a **separately
installable package** (config bundle depending on `@solid/community-server`) so even upstream-CSS operators
can add it — noted as a path, not required now (**⟵** decision #12).

### 1.2 Install harness — desktop supervisor (native-thin, browser-for-UI)

The box needs a **harness** for a non-expert operator: install/start/stop/restart, health, logs, updates, and
a **system-tray** presence. Split by job:
- **Native (thin):** server lifecycle + tray. **Recommendation: a small Rust tray supervisor. Avoid Electron**
  (it bundles Chromium+Node ~150 MB to supervise a server and open a browser you already have — wrong for a
  24/7 low-resource shop box). Tray menu: Status · Start/Stop · **Open Admin** (launches default browser to
  the local admin URL) · Open Logs · Check for Updates · Quit. Reuses the **Rust** toolchain already chosen
  for the device app (§10.2).
- **UI → the local browser.** The admin panel (smithy-admin) is already a web app — don't re-render it in a
  desktop shell. Data-mapping / data-migration UIs are **admin pages calling a local server endpoint**;
  reserve native only for what the browser sandbox truly can't do.
- **Escape hatch:** if a *native* window with direct FS access is later needed (heavy local migration), use
  **Tauri** (Rust + OS WebView, a few MB — not Electron). A Rust tray is the on-ramp to Tauri (same
  `tao`/`wry` ecosystem), so starting thin keeps Tauri open without committing.

**Honest caveats (bite in any toolkit):**
- **Node reality:** CSS *is* Node → the harness must **bundle/manage a Node runtime + the CSS/IPMS server as a
  sidecar** (Tauri sidecar model / Rust child-process supervisor). This packaging is the real work,
  independent of UI choice.
- **Linux tray** (StatusNotifierItem/AppIndicator; GNOME needs an extension) is fiddly *everywhere* — a Linux
  cost, not a reason for Electron.
- **Lifecycle model (decision #17):** tray-owned process (simplest, dies on logout) vs **OS service**
  (Windows Service/launchd/systemd) with the tray as *controller/monitor* (robust for always-on; needs
  elevation once). Multiplatform target: **win64 / macOS / linux**.

### 1.3 Deployment targets — on-prem box vs Docker/container (one profile, two supervisors)

Two supported targets, **both running the same opt-in install profile (§1.1)**:
- **(A) On-prem box** (mac-mini / mini-PC in the shop) → the **Rust tray harness (§1.2)** supervises.
- **(B) Docker / container** (VPS/cloud, for operators who won't run a physical box) → **headless; the
  container *is* the supervisor** (compose / systemd / orchestrator), managed entirely via the web admin.

**Good news — Docker largely exists.** The repo ships a multi-stage `Dockerfile` (`node:24-alpine`;
`/config`+`/data` volumes; env-driven **`CSS_CONFIG`** defaulting to `config/file.json`; `EXPOSE 3000`;
entrypoint `node bin/server.js`), already Databox-branded and build-your-own (no registry publish). Running
the IPMS = point **`CSS_CONFIG` at the IPMS preset** (`config/ipms/…json`) + mount `/data` (**file storage, not
memory**) + env for baseUrl / control-token. The base image stays basic-install-capable (§1.1).

**To add:**
- ✎ a `docker-compose.yml` for the small operator (IPMS container + volumes + env/secrets; optional reverse
  proxy), wired to the Hosting module's baseUrl/Cloudflare (§6).
- **Multi-arch** build (amd64 + arm64) → runs on ARM VPS / Pi / Apple Silicon.
- **Secrets via env / Docker secrets** (control token, gateway keys) — never baked into the image.

**Caveat — device mTLS in the cloud (decision #18):** a container behind a reverse proxy / Cloudflare
terminates TLS → breaks client-cert passthrough for the devices host (§10.2). The `devices.<apex>` endpoint
needs a **direct-TLS path** (dedicated listener/port, non-proxied) even in container deployments, or
edge-mTLS with cert forwarding.

**(C) Kubernetes** (scale / multi-tenant / cloud) — a **Helm chart + manifests** wrapping the existing image:
Deployment, Service, Ingress, **PVC/shared backend**, Secrets, ConfigMap (the IPMS preset). **Hard caveat
(decision #27):** CSS's **memory defaults don't do multi-replica** — HA needs a **shared DB/object backend +
a distributed locker (e.g. Redis)**, not the in-memory locker. Real deployment engineering, not a flag.

### 1.4 Portability & no-lock-in — you can leave, including off CSS itself (reflexive anti-lock-in)

The project is anti-lock-in; the system must not trap users on CSS. Honest **layering** (not "runs anywhere"
hand-waving):
- **Data — portable by construction.** All IPMS state is standard Solid **LDP/RDF resources with open vocabs
  (§3)** — never a proprietary store. *This is why the vocabulary discipline matters:* it **is** the
  portability guarantee. Migrates to any Solid server.
- **Client apps — portable via back-end *modes* (capability abstraction).** The apps run against a
  **capability interface** in two modes: **(i) standard-Solid mode** — plain Solid surfaces only
  (LDP / WAC-ACP / Solid-OIDC / Notifications / Type-Index) → works against **any** compliant back-end (NSS,
  Pivot, ESS, …); **(ii) CSS-enhanced mode** — additionally uses the CSS-side IPMS control plane for features
  that need server-side compute. The app **detects** back-end capabilities and **degrades gracefully**
  (enhanced features hide/downgrade off-CSS). **Fits the existing seam:** smithy-admin already swaps Refine
  `dataProvider`s (`demoDataProvider` vs live `dataProvider` via `VITE_DEMO`) → a **standard-Solid provider** is
  a *third variant*, not a rewrite. **Feature split (the contract):** *portable-core* (CRUD, access control,
  auth, notifications, discovery) always available; *enhanced* (module registry, control-token ops, server-side
  validation) only in CSS-enhanced mode — a module needing the server to *do* something is enhanced-tier and
  **owes a standard-mode degradation**. *Honest limit:* enhanced work that can't move client-side is simply
  unavailable off-CSS. **Build the abstraction from pass-1** so portability isn't retrofitted.
- **Logic mostly as RDF ("the works"); the engine is thin & per-runtime — declarative-first.** The deeper aim:
  the IPMS's *operational definition* — governance rules (ODRL/DPV), **module definitions/manifests**, workflows,
  access policies (WAC/ACP), RDF-driven views, vocab (OWL/SHACL) — is **declarative RDF**; CSS/Node is *one thin
  interpreter* over it. So the portable unit is the **RDF "works"** (the org's whole operational definition +
  data), which **import into a different Solid server** — OpenLink Virtuoso, or any other Solid-protocol-conformant
  server — that supplies its **own interpreter + adapters** (the "bit of additional code" per environment). **Honest
  spectrum:** *declarable* (data, vocab, ODRL/DPV rules, SHACL, manifests, access policy, RDF views/workflows)
  migrates **as data**; *irreducibly imperative* — (a) **the interpreter engine itself** (something must read
  the ODRL / run the workflow / dispatch modules), (b) **external integrations** (payments / Cloudflare / device
  mTLS / crypto / transport) — is **re-implemented per runtime**. **Not zero-code migration:** the *works* move,
  the *engine* is adapted. On CSS the engine is Components.js/TS; on another Solid server, its own. This designs
  Timothy's **own** CSS off-ramp, not a hypothetical.
- **Interface = Solid-protocol conformance ("vanilla") — NOT a new contract.** The interoperability requirement
  is **conformance to the Solid protocols** (LDP / Solid Protocol / WAC-ACP / Solid-OIDC / Notifications /
  Type-Index) — the **vanilla** substrate the app targets; any conformant server hosts the works. The works
  carry meaning via **RDF content using *any* semantic-web ontology** — Solid stores RDF and RDF is
  vocab-agnostic, so **any** ontology (OWL/SHACL/RDFS; DPV, ODRL, schema.org, org, FOAF, GS1, WoT, or a domain's
  own) is **natively compatible — an *open* set, not restricted** (the named ones are *recommendations at common
  interop points*, not a closed list). **No new protocol, no bespoke "interpretation contract" to invent**
  (that would violate the community-work standard, [[feedback-community-work-standard]]). So the guarantee is
  simply **"runs on vanilla Solid; content is RDF in any ontology."** *Honest seam:* Solid Protocol covers storage/access/auth/notifications, **not** app-level
  semantics — those ride on standard vocabs as content; where a genuine interop gap appears (e.g. module
  discovery) reach **first** for an existing Solid mechanism (Type Index, `.well-known`), contribute upstream
  only if truly missing, **never a parallel dialect**. **Deliverable = define-by-demonstration:** a working
  reference proving an org-management IPMS runs on **vanilla Solid** — the demonstration *is* the definition.
- **Migration tool (decision #28)** — pod **export/import** (resources + containers + ACLs-as-RDF → a portable
  bundle), straightforward *because* the data is standard Solid. **Honest limits — does NOT migrate cleanly,
  must be re-established:** OIDC client registrations, server-specific config, live notification subscriptions.
  Reuses the repo's existing **data-portability** work.

**Principle:** the anti-extractive stance applies **reflexively** — even *this* system lets you walk with your
data, apps **and operating logic** intact. It shapes *how* modules are built: **favour standard Solid surfaces;
keep all data standard-Solid; and express logic as declarative RDF ("the works"), keeping runtime code thin**
so the whole IPMS decouples from the CSS/Node foundation onto another Solid server.

### 1.5 Enterprise connectivity — ODBC + LDAP/AD via the mapper (the *on-ramp*)

Mirrors §1.4's off-ramp: orgs have existing **relational DBs** and **Active Directory/LDAP**; adopting the IPMS
needs to bring that in. "You can arrive" as cleanly as "you can leave."
- **Rust connector layer (§1.2).** Native **ODBC** (relational) + **LDAP/AD** (directory) — a good Rust fit
  (`odbc-api`, `ldap3`); runs as a **connector sidecar** (harness on desktop / container in K8s), talking the
  source on one side and writing **standard Solid/RDF** into the pod on the other.
- **Employed *via the mapper*, declaratively.** Legacy→RDF mapping is expressed with the **W3C standard
  mapping languages R2RML / RML** — themselves RDF. So the **mapping definitions are declarative RDF "works"**
  (portable, §1.4; ontology-driven §3) and the **Rust connector is just the *engine*** that executes them (the
  per-runtime imperative bit §1.4 always allowed). Bridges into the existing **Ontology Mapping Registry** (§3).
  Textbook *declarative mapping + thin engine*.
- **Modes (honest spectrum):** (a) **one-time import/ETL** (pull→map→write once — start here); (b) **live
  bridge/sync** (harder: direction/conflict/provenance; default one-way source→pod); (c) **virtual/federated**
  (query the source live, present as RDF, Ontop-style — no copy, live dependency). Don't promise bidirectional
  live sync casually.
- **AD/LDAP is two distinct things — don't conflate:** a **data source** (staff/org directory → the directory
  §5.5, *via the mapper* — what was asked for) vs an **auth IdP** (federated login — a *separate* OIDC/SAML
  bridge, not the mapper).
- **Relevance:** mostly the **enterprise / powerful-server** end (real AD/SQL estates — same end that wants K8s
  and OpenLink Virtuoso), less the corner shop. Decision #30.

### 1.6 Data layer — internal Solid pods over a swappable engine (Oxigraph, native + WASM)

Settled across the SPARQL / Oxigraph / WASM / internal-pods discussion. **The model is fixed; the engine is a
choice** — which is the no-lock-in principle (§1.4) applied to storage.
- **Model (fixed, portable):** all IPMS/org operational data = **internal Solid pods** on `databox.[org].[tld]`
  — WAC-scoped to org/admin agents, **not** publicly discoverable/federated (excluded from public Type Index),
  distinct from external/interop pods (people's pods, public profiles). Reuses CSS multi-pod + the databox's
  existing private-provisioning. Source of truth is **Solid pods** → vanilla-Solid + portable by construction
  (migration = standard pod export/import, §1.4). It was never "SPARQL DB *vs* pods" — it's **pods, always,
  over a chosen engine**.
- **Engine (swappable, *under* the pods):** file (holds RDF + binary; simple shop-box default) → **Oxigraph**
  (SPARQL 1.1, Rust; MIT/Apache) → Virtuoso (enterprise). **Oxigraph is a Rust crate → compiled
  *into* the Rust native-edge loader (§1.2)** — no new runtime: the loader becomes supervise + devices +
  connectors + **the durable triplestore** (RocksDB), exposing a **localhost SPARQL endpoint** that CSS's
  *existing* `SparqlDataAccessor` uses as backend (`--sparqlEndpoint`). The loader also supervises CSS as a
  managed child.
- **Both targets, one engine:** **native** Oxigraph in the loader (server/box — durable, fast; solves WASM's
  persistence gap) + **WASM** Oxigraph in the browser (client-side read cache/query). Same SPARQL surface
  top-to-bottom. **Do not build an engine** — package Oxigraph (building SPARQL 1.1 is a multi-year detour).
- **Flow — pods canonical, Oxigraph derived (hydrate / write-back).** Solid pods are the **canonical,
  backed-up** store (the one thing you back up). Oxigraph is a **working query env hydrated *from* the pods**;
  **writes go back through LDP/Solid** (so **CSS owns writes** — WAC, containment, consistency — natively);
  pod→Oxigraph **sync on write** (cheap when co-located; driven by CSS change notifications). **Oxigraph is
  rebuildable:** lose it → re-hydrate from the pods, so **backup = pods only**. This **sidesteps** the hard
  WAC-respecting-*write*-SPARQL problem — that "Oxigraph owns writes + Solid-persistence + WAC extension" model
  (see prior-art review) becomes a **maybe-later frontier, not a dependency**.
- **Query:** **SPARQL over the hydrated env** for the IPMS's function; **Comunica-over-LDP** = the vanilla
  fallback on a plain Solid server (§1.4). The raw SPARQL endpoint is **internal/admin only** (public bypasses
  WAC). **Authority-on-read** within the org is **governance-scoped** (§5.7) at the query layer (+ sensitive
  data in separate named graphs) — *not* raw per-triple WAC-SPARQL; external sharing still goes via CSS/LDP/WAC.
  A **SPARQL admin/query UI** (YASGUI / Oxigraph) = the phpMyAdmin equivalent.
- **Verifiable Credentials (major, and they *require* pods-canonical).** A VC is **signed RDF** — its proof is
  over a canonical serialization (RDFC-1.0/URDNA2015), so the **canonical signed bytes must live in the pod**
  and **verification runs against that resource, not Oxigraph's re-materialized triples** (Oxigraph queries VC
  *metadata* only, never the source of cryptographic truth). VCs are **write-once/immutable** (editing breaks
  the signature) — the read-only/append part of the data; the hydrate/write-back cycle is for *mutable* data.
- **Binaries:** RDF in Oxigraph, **binaries as referenced blobs** in a file/object store (a pure triplestore
  can't hold STL / images / PDFs). File-backend holds both (shop-box); hybrid (Oxigraph + blob store) for the
  query-powered path.
- **Deployment:** shop-box = **one loader binary** (supervise + Oxigraph + connectors) + managed CSS child =
  near-zero ops. K8s = Oxigraph as a native container/sidecar (RocksDB volume) or swap to Virtuoso.
  Browser = WASM cache. The loader is deliberately substantial for the box (fewer moving parts), **decomposable
  at scale**.
- **Phase-0 implication (§13):** the engine/backend is **foundational** — the install profile picks it, settled
  before modules build. Decision #31.

## 2. Prior art reviewed — SolidOS (and what we reuse)

SolidOS is, in effect, an existing "OS/IPMS for Solid" (a pod data-browser + app shell). Reviewed the repos
you flagged plus the wider org. Honest reuse decisions below — the key friction is that the SolidOS stack
is **rdflib.js + plain-DOM widgets**, while `smithy-admin` is **React/Refine + fetch**; so we adopt SolidOS
*patterns and ontologies*, and take its code only where it doesn't drag the whole DOM/rdflib runtime in.

| SolidOS repo | What it is | Decision |
|---|---|---|
| [pane-registry](https://github.com/SolidOS/pane-registry) | Index of "panes" (UI views) loaded statically/dynamically, selected per resource RDF type — a plugin registry. | **Adopt the pattern** (type/role → view plugin) for our module & admin-UI registry; reimplement React-native. Don't take the dep (DOM-oriented). |
| [solid-ui](https://github.com/SolidOS/solid-ui) | UI widgets + **RDF-driven forms** interpreting the W3C `ui#` ontology (TBL's declarative forms; auto-save per field). [forms intro](https://solidos.github.io/solid-ui/Documentation/forms-intro.html) | **Adopt the `ui#` ontology** as our module/config *shape* language (see §3). Optionally embed solid-ui form rendering later; not core now. |
| [solid-logic](https://github.com/SolidOS/solid-logic) | Core business logic: authn/session, `store`, ACL, `createTypeIndexLogic`, issuer discovery. Node-usable, **rdflib peer dep**. | **Borrow the conventions** (Type Index, ACL patterns) — implement server-side with CSS's own primitives. Consider it as an *optional* browser dep for the admin app only if we need pod RW there. |
| solid-panes / mashlib | The core panes + the assembled data-browser shell. | Reference only — this is the "whole SolidOS app"; we're building an admin IPMS on CSS, not embedding mashlib. |
| rdflib.js / solid-namespace | RDF store + namespace helpers. | CSS already uses `n3` + `@rdfjs/types` + its own `Vocabularies.ts`. Stay on CSS's stack server-side. |

**Net:** SolidOS validates the whole shape (plugin registry + RDF forms + Type Index + ACL = a Solid IPMS).
We take its **ontologies and conventions**, keep our runtime (CSS server-side; React admin client-side).

### 2.1 The Solid Project ([github.com/solid](https://github.com/solid)) — normative specs we conform to

Distinct from SolidOS (implementation): this org holds the **specs** the IPMS must conform to, not code we
embed. Relevant: [`specification`](https://github.com/solid/specification) (Solid Protocol),
[`solid-oidc`](https://github.com/solid/solid-oidc) (auth), `web-access-control-spec` (WAC),
[`webid-profile`](https://github.com/solid/webid-profile) (agent/WebID discovery),
[`notifications`](https://github.com/solid/notifications) (WebSocket/streaming channels — see §10),
and `vocab`. **Honesty note on device auth:** the legacy **WebID-TLS** mechanism is *deprecated* across the
ecosystem (dropped in node-solid-server; CSS documents **only Solid-OIDC** + client-credentials). So
"WebID-TLS for devices" is a real gap — addressed pragmatically in §10.2.

### 2.2 solid-contrib ([org](https://github.com/orgs/solid-contrib/repositories)) — building blocks & app exemplars

Reviewed for core value and as module/app material. Take these as **building blocks/deps or reference**, not
a rebuild.

| Repo | What | Use to us |
|---|---|---|
| [`data-modules`](https://github.com/solid-contrib/data-modules) | Reusable read/write for one data type each (bookmarks, chats, contacts, tasks, profile); vanilla/soukai/rdflib/LDO flavours (NLnet-funded). | **Strong dep candidate** for IPMS *content* modules — don't hand-roll RDF for common types. |
| [`LibreChat`](https://github.com/solid-contrib/LibreChat) | Full AI chat app. | **Exemplar** of a third-party Solid app installed as a module that **consumes IPMS config/setup** (API keys, model config) — your example. Validates the "apps depend on settings" flow. |
| `solid-node-client`, `solid-auth-fetcher` | Node Solid client + auth. | Server-side module→pod calls; app auth. |
| `access-control-policy`, `web-access-control-tests` | ACP impl + WAC conformance tests. | User-management/ACL correctness (§5.5). |
| `solid-crud-tests` (incl. **WebSocket**), `conformance-test-harness` | Surface + conformance tests. | Validate the real-time module (§10.3) + overall spec conformance. |
| `pivot` (CSS remix), `css-azure-app-service` | Sibling CSS-based server + a deploy config. | Reference for hosting (§6) beyond self-host/Cloudflare. |
| `solid-file-manager`, `webid-search`, `reactive-authentication` | File manager app, WebID index, React auth wrapper. | Candidate admin modules / helpers. |

Note: **soukai-solid** (ODM) lives outside this org but is one of `data-modules`' supported flavours — a
reasonable way to model richer module data (POS orders, receipts) without raw triples. **⟵ your call** on ODM.

---

## 3. Ontology (not merely vocabulary) — reuse, don't fabricate

- **Ontology, not merely vocabulary (foundational).** A *vocabulary* is a set of named terms; an **ontology** is
  a formal conceptualization — terms **plus** their logical structure (class/property hierarchies, domain/range,
  disjointness, cardinality, rules), machine-interpretable with **entailment** (OWL) and **validation** (SHACL).
  Meaning with logical *consequences*, not labels. **This is where the declarative logic lives (§1.4):** the
  org's operating logic is encoded in the **ontology** — OWL axioms (what entails what), SHACL shapes (what's
  valid), ODRL policies (what's permitted/obliged) — so "the works are mostly RDF" is precisely "**mostly
  ontology + instance data**". *Honest gradient:* lightweight vocab (RDFS terms) → full ontology (OWL axioms/
  inference) → shapes (SHACL) — use the right formality per need; the **aim** is ontological.
- **Open, not a prescribed set.** Solid stores RDF and RDF is model-agnostic → **any** ontology (DPV, ODRL,
  schema.org, org, FOAF, GS1, WoT, custom) is natively compatible and composes in the graph. **Model-level
  interop is free; semantic interop** (parties acting on the *same meaning*) needs shared/well-known ontologies
  at interop points **or mappings** — bridged by the existing **Ontology Mapping Registry** (smithy-admin
  SHACL/RDF mappings, [[smithy-admin-info-taxonomy-direction]]). So: **open by default; recommend at interop
  points; map what differs.** Everything below is a *recommendation*, not a restriction. The contract is the
  **model (RDF) + protocol (Solid)**, never the ontology chosen.
- **Local vocab utility already exists:** `src/util/Vocabularies.ts` with `createVocabulary()` /
  `extendVocabulary()` and namespaces ACL, ACP, AS, DC, FOAF, LDP, **PIM**, **SOLID**, VCARD, NOTIFY, etc.
  → **Add our IPMS/module vocab as a new `createVocabulary()` entry here.** Proposed namespace
  `urn:solid-server:databox:ipms#` (URN, consistent with existing `urn:solid-server:…` ids; a resolvable
  `w3id.org/databox` vocab is a **TBC** follow-up, not fabricated now). **⟵ your call** on namespace, since
  you drive the standards spine (DPV/ODRL already in the taxonomy work).
- **Adopt W3C `ui#`** (`http://www.w3.org/ns/ui#`) for **config form shapes** — module settings described in
  RDF, SolidOS-interoperable, renderable by solid-ui elsewhere. (SHACL remains an option for validation;
  `ui#` for presentation. Could carry both.)
- **Adopt `solid:` Type Index** (public/private type registrations, already in the `SOLID` vocab) so module
  data locations are **discoverable in the pod** the Solid-standard way, rather than hard-coded paths.
- **Reuse `PIM`** (`pim:storage`, workspace/preferences) for where IPMS/site settings live.
- **Directory + legal entity (§5.0):** adopt the **W3C Org Ontology** (`org:` — `org:Organization`,
  `org:Membership`, `org:Role`, `org:memberOf`/`org:hasMember`, `org:Post`) for org structure and roles; the
  **Registered Organization Vocabulary** (`rov:`/regorg) + schema.org `Organization` (already in setup) for
  legal-entity attributes/identifiers; **vCard/FOAF** (already in `Vocabularies.ts`) for agent details; the
  **W3C Verifiable Credentials Data Model** for issued credentials (e.g. Membership cards). Exact term
  bindings **TBC** at implementation (verify against current vocab versions; don't fabricate URIs).
- **Governance rules (§5.7):** **ODRL** (permissions/prohibitions/duties/constraints — machine-actionable
  authority: role→action, spending limits, approval chains) + **DPV** (purpose/legal basis). Both already in
  the info-categories spine. No widely-adopted decision/resolution vocab exists → model resolutions as records
  anchored on Org + ODRL + schema.org, governance-term details **TBC** (your call, standards-lead).

**Modelling boundary — ownable *things* vs non-ownable *beings* (deliberate; the real axis is ownership).**
- **The axis is ownership, not "human vs thing".** A 'thing' in the property/OWL sense is something that can
  be **owned** (artefacts: products, receipts, stock, shares). **Human beings** and **"world of god" stuff**
  (the natural / given / living world, the commons — anything not authored by humans) **cannot be owned and
  are never modelled as owned things.** Where the organisation connects to a non-ownable being, it holds a
  **legal and/or contractual relation** (usually both), and *that relation* — not the being — is the reified,
  reason-over-able artefact.
- **A relation has two layers, usually at once:** the **contractual** layer = the agreement between parties →
  an **ODRL Agreement** (parties, permissions, duties, constraints); the **legal** layer = the
  statutory/common-law frame that governs/mandates it → **DPV legal basis**. Employment is the archetype (a
  contract *and* labour-law duties that hold regardless). A directory relation = reified `org:Membership`/role
  (§3 above) + ODRL Agreement + DPV basis. *Honest limit:* this is a machine-readable representation of
  parties/duties/basis — not the contract itself, not legal advice; citations indicative (per the taxonomy
  stance).
- **Ownership predicates range only over property.** A *shareholder* owns **shares** (things), not any part of
  the company's people; a *director* holds a fiduciary/legal relation (§5.7); a supplier's *representative* is
  a natural person acting under a relation, not an asset. So `owns` applies to shares/stock/receipts; persons
  and world-of-god entities are only ever **parties to relations**.
- **World-of-god commitment:** the model must also refuse to reify the natural/living world as ownable
  property (bites later, when touching produce, animals, land, environmental records) — a principle held from
  the start so it isn't violated by default.
- **Things → OWL / OWL-DL:** organisations-as-described-entities, products, catalogue/menu items,
  receipts/orders, device-as-thing. Buys classification, disjointness, entailment, taxonomy reasoning and
  validation (product taxonomies, catalogue/receipt validation); schema.org's class structure is the
  pragmatic anchor, SHACL for shapes. This is where reasoning belongs.
- **The human being is NOT a 'thing':** the *person* is described with **RDFS + SHACL + FOAF** (the Solid
  model), by **WebID**, self-asserted and controlled by them — never reified as an OWL individual reasoned
  over. SHACL validates the shape of their data; it does not entail new facts *about* them.
- **But role attributions CAN carry OWL logic:** customer / representative / employee / member are **reified
  relationships** — `org:Membership` / `org:Role` (n-ary), exactly as the W3C Org Ontology models it: an
  `org:Agent` (the person, a `foaf:Agent` by WebID) ↔ `org:Organization`, bearing a role. **The
  relationship/role is a thing** and may be classified/reasoned over in OWL; **the person is the referenced
  bearer, not decomposed into it.** So OWL reasons over the *relationship*, never over the human. In the
  directory (§5.0(2)) a directory entry *is* that reified relationship, linking out to the person's FOAF/WebID
  profile which stays in the agent register.
- **Straddle:** the organisation and devices have two facets — *descriptive/legal facts* sit in the OWL thing
  layer; *agency* (org WebID + governance action; device auth identity) stays in the agent layer. Same
  entity, two registers.

---

## 4. What CSS already provides (so we don't reinvent)

- **Accounts / identity / login / pod provisioning** — `config/identity/**`, the account API, Solid-OIDC.
  → User management **surfaces and extends** this; it does not re-implement auth.
- **Access control** — WAC (`webacl`) and ACP presets already wired. → IPMS roles/grants ride ACL/ACP.
- **Storage + LDP + content negotiation** — the `ResourceStore`; `CssDataboxStore`
  (`src/databox/integration/CssDataboxStore.ts`) already commits **config/state as `ldp:BasicContainer`
  turtle with `.acl` boundaries**. → the exact pattern for all IPMS "state as Solid resource".
- **Composition / "static modules"** — **Components.js** (`config/**/*.json`). This is CSS's existing module
  layer (install-time). Our IPMS adds the *runtime-enableable, self-describing, Solid-config-backed* layer on
  top. Stated plainly: a **new fork convention, not an upstream standard** (per `feedback-community-work-standard`).
- **Control-plane auth** — `LiveDataboxHttpHandler` (`timingSafeEqual`, ≥32-byte token) already protects
  `/.databox/smithy/*`. → the IPMS control routes reuse this boundary (proper operator IAM is the later hardening).
- **Tenant binding** — `TenantBindingRegistry` binds origins/audiences to a program (T-31, no platform-wide
  credential). → the hosting module registers the new `databox.<apex>` origin here.
- **Real-time / notifications** — CSS already ships the Solid **Notifications Protocol**: a
  `WebSocketServerConfigurator` + channel types under `config/http/notifications/` (`WebSocketChannel2023`,
  `StreamingHttpChannel2023`, legacy websockets, webhooks; `src/server/notifications/**`). → **WebSockets is
  config-on + surface it**, not a from-scratch build (see §10.3).
- **Machine/device auth** — Solid-OIDC **client-credentials** tokens (DPoP-bound) exist today for
  non-interactive agents. → the device-identity story for IoT (§10.2) builds on this, **not** WebID-TLS.

---

## 5. Architecture — the Solid IPMS layer

A IPMS shell on CSS. Seven subsystems; each stores state as WAC/ACP-protected LDP/RDF, discoverable via Type
Index. Server components mirror `InMemoryTenantBindingRegistry`'s shape; persistence mirrors `CssDataboxStore`.

**5.0 Core model — legal entity + relationship directory (the spine everything hangs off).**
Two parts, both Solid-native:
- **(1) Legal entity / organisational personality** — the org as a *legal person*: its own identity
  (WebID/profile), legal attributes (registered name, jurisdiction, legal identifiers), branding. The
  **anchor** that owns all resources. Vocab: `org:Organization` + `rov:` + schema.org `Organization` (partly
  built already: `InstitutionProfile`, the Set-up page). Bound via `TenantBinding` (the entity's
  program/origin). **The entity is not autonomous — it acts only through its governance structure (3).**
- **(2) Relationship directory** — every agent related to the entity: **natural persons and other
  organisations** (and **devices**, §10.2), each a directory entry with one or more **typed roles**
  (customer, employee, director, member, supplier, device…). Roles expressed with `org:Membership`/`org:Role`;
  agent details with vCard/FOAF. Some roles carry an **issued Verifiable Credential** (e.g. a **Membership
  card VC** — the entity is issuer, the agent holder). Privacy-preserving pairwise mapping already exists in
  the databox (the opaque program-person relationship) and is the mechanism for directory entries that must
  not leak a raw identifier. **Each entry is a legal/contractual *relation* (ODRL Agreement + DPV basis, §3),
  not ownership** — the person/being is a *party*, never an owned asset.
- **(3) Governance & authority** — the entity acts only through a **governance structure** the operator
  *defines in the system*: offices/roles (board, directors, secretary, treasurer, members-in-general-meeting)
  — a specialisation of directory roles (2) — plus the **rules** (delegation of authority, decision
  procedures, quorum/voting, spending limits, approval chains). **Governance is the source of authorisation:**
  every action *for the entity* (issue a VC, provision a device, approve a payment, change config, grant
  access) is **gated** against these rules, and WAC/ACP policy is **derived from** them rather than set
  ad hoc. Rules as **ODRL** (permissions/duties/constraints — machine-actionable) + DPV (purpose/basis);
  **decisions/resolutions recorded as auditable RDF resources**. Builds on the databox policy/duty machinery
  (`src/databox/policy/DutyHandlers.ts`) + program-bound authorisation. **Honest limit:** the system enforces
  the *machine-checkable* subset and records the rest — it gates on a resolution's *outcome*, it does not
  replace human deliberation ("it doesn't run the board"). Governance-vocab exact terms **TBC** (Org + ODRL +
  DPV are the anchors; no widely-adopted decision/resolution vocab — don't fabricate).
- **"Users"/accounts are a projection of (2)** — the authenticating subset. Login is one facet of a directory
  entry, not the entity itself. This is why user-management (§5.5) is really **directory management**, and why
  *authority* to act is governance (3), not mere authentication.

**5.1 Module management** (the WordPress-plugin core)
- `SolidModuleManifest` (TS interface + JSON-LD descriptor): `id, name, version, description, capabilities[],
  routes[], configShape(ui#/SHACL), adminUi{ navLabel, path }`.
- `DataboxModuleRegistry` (interface + in-memory ref impl): list installed, enabled-state, config link.
- Enabled-state + config persisted as RDF at `/.databox/ipms/modules/<id>` (+ `/config`), WAC-locked to admin.
- Generalise the hardcoded route ladder in `src/databox/smithy/MappingForgeHttpApi.ts` into a **module route
  dispatch** `(method, subpath) → handler`, mounted under `/.databox/ipms` (sibling to `/.databox/smithy`),
  behind the existing control token.

**5.2 Configuration** — site-wide settings (name, branding, locale, storage/baseUrl *intent*) as an RDF
settings resource under the pim workspace; per-module config via the `ui#`/SHACL shape from the manifest.

**5.3 Setup / onboarding** — first-run wizard: detect unconfigured state → admin creation → storage → enable
first module (hosting). The existing **Organization Set-up** page (`smithy-admin/src/pages/setup/`) folds in
here as the "org identity + information-obligations" step (already built; taxonomy work per
`smithy-admin-info-taxonomy-direction`).

**5.4 Admin shell** — `smithy-admin` becomes the IPMS admin: sidebar rendered **dynamically from enabled
modules** (replaces today's hardcoded `NavLink` list in `smithy-admin/src/components/layout/index.tsx`),
a dashboard, and the module/config/user screens. A module appears only when enabled — this is the
"**page that can be enabled**" mechanism, backed by real server state (not just a `VITE_` flag, though a
flag can still gate the whole thing for the static demo, matching `VITE_DEMO` in `App.tsx`).

**5.5 Directory & relationships (was "user management")** — manage the relationship directory (§5.0 part 2):
directory entries (people, orgs, devices), their **typed roles**, and **credential issuance** (mint a
Membership card VC to a member; the entity is issuer). Accounts/login are one facet — surfaces CSS's
account/identity API for the authenticating subset; roles→capabilities enforced via ACL/ACP grants +
`TenantBinding`; reuses Type Index + WAC. Devices enrol via §10.2. (Deep IAM/VC-issuance is later hardening;
first pass = directory CRUD + roles + admin account + a stub VC issue.)

**5.6 Content / domains** — routing + site content. **The Hosting/Cloudflare module (§6) is the first
occupant**; serving the `www` site "using databox capabilities" is the **Website maker (§10.7)** — the engine
that turns back-end things into the public site.

**5.7 Governance & authority** (core-model pillar (3) as a subsystem) — define the governance **structure**
(offices/roles) and **rules** (delegation, decision procedures, quorum/voting, spending limits, approval
chains) as ODRL policies + DPV; record **decisions/resolutions** as auditable RDF resources; **gate** every
action-for-the-entity against them and **derive** WAC/ACP grants from roles+rules. Builds on
`src/databox/policy/DutyHandlers.ts` + `TenantBinding`. Cross-cuts payments (approvals/limits, §10.5), VC
issuance (§5.5), device provisioning (§10.2), and config. First pass: role→authority bindings + a simple
approval gate + resolution records; full voting/quorum later.
**Must be pluralistic (validated by the membership/co-op use-case §11):** support **corporate** (board/
directors/shares, weighted votes), **democratic/mutual** (members elect a committee, **one-member-one-vote**,
AGM, dues), and **unincorporated** structures — authority is *derived differently* in each, so the model
parameterises the derivation (who holds authority, how it's mandated) rather than hard-coding a company shape.
And **nestable** (multi-tenant §11/#21): a platform entity's governance over a marketplace + each member
entity's own governance, isolated by `TenantBinding`.

**Scope discipline for pass 1:** build §5.1 (registry + manifest + config-as-resource + route dispatch) and
§5.4 (dynamic sidebar) as the *real* framework, plus the hosting module end-to-end. §5.2/5.3/5.5 get their
**seams and vocab defined now**, thin implementations, and grow in later passes. **⟵ your call** on how much
of 5.5 (user management) to pull into pass 1.

---

## 6. First module — Hosting / Cloudflare

**Does:** a wizard that (1) collects apex domain, databox subdomain label (default `databox`), optional
`www`, public origin target, Cloudflare proxy/TLS mode; (2) computes the two routes and their implications —
`databox.acme.org` → run with `--baseUrl https://databox.acme.org/`; per-pod subdomains
(`alice.databox.acme.org`) need the **existing** `subdomain.json` strategy **and** a `*.databox.acme.org`
wildcard record (offered explicitly); `www.acme.org` → **reserved** route, DNS only; (3) generates copy/
download artifacts — a **Cloudflare DNS records table** (Type/Name/Content/Proxy/TTL) and a **server launch/
config snippet**; (4) persists the chosen hosting config as the module's RDF config resource; (5) offers to
register the `databox.acme.org` origin as a `TenantBinding` (program-bound, upholds T-31).

**Cloudflare Tunnel — the primary exposure path (solves on-prem NAT / dynamic IP).**
A shop box sits behind NAT on a changing IP with no port-forward. **`cloudflared` makes an *outbound*
connection to Cloudflare**, which routes hostnames to it — **no port-forward, no static IP, and it largely
obviates dynamic-DNS** (the tunnel re-establishes on IP change). So Tunnel is the *default* on-prem path;
Cloudflare-API **dynamic-DNS** (update an A record on IP change) is the **fallback** for static-IP/VPS or
port-forward setups.

**Setup flow (with the honest registrar boundary):**
1. User **defines the domain**; **logs into their registrar** and points **nameservers/DNS at Cloudflare**
   — this step is theirs (registrar credentials; the app must **not** touch them), the app just guides it.
2. User hands the system a **scoped Cloudflare API token** (Tunnel + DNS edit). Stored **server-side**,
   redacted, never committed; the token is the user's own, for their own account.
3. The module then **automates the Cloudflare side**: create the **tunnel**, configure **ingress rules**
   (hostname → local service), and the DNS/CNAME-to-tunnel records.

**Ingress rules realise the private/public split (three route profiles):**
- `databox.<org>.tld` → local CSS **databox** — **private** data plane (WAC-protected).
- **website hosting** (`www.<org>.tld` + the public RDF feeds §10.8) → **public**, cacheable.
- `devices.<org>.tld` → device mTLS (§10.2). **Sharp caveat:** client-cert mTLS **cannot ride a standard
  tunnel** (Cloudflare terminates TLS at the edge; behind NAT you can't bypass it). → **edge-enforced mTLS is
  effectively mandatory here**: Cloudflare validates the client cert at the edge (API Shield/mTLS) and
  **forwards it to origin via header** (trust-the-edge). Resolves decisions #7/#18 for the tunnel case.

**Fallback — guided artifacts (no keys):** if the user won't hand over a token, still generate the copy/
download **DNS records + `cloudflared` config** for them to apply manually. Both paths persist the same RDF
hosting config (bullet (4) above).

---

## 7. Files (create ✎ / modify ✏)

**Server — IPMS framework:**
- ✎ `src/databox/ipms/SolidModuleManifest.ts`, `DataboxModuleRegistry.ts`, `ModuleConfigStore.ts`
  (mirror `TenantBindingRegistry` / reuse `CssDataboxStore` primitives).
- ✏ `src/util/Vocabularies.ts` — add the IPMS/module vocabulary via `createVocabulary()`.
- ✏ `src/databox/smithy/MappingForgeHttpApi.ts` — extract reusable route dispatch (or sibling `IpmsHttpApi`);
  keep smithy routes working.
- ✏ `config/databox/live-handler.json` (+ new `config/databox/ipms.json`) — wire registry + `/.databox/ipms`.

**Config / packaging — the opt-in install profile (§1.1):**
- ✎ `config/ipms/*.json` — the layered IPMS preset(s) that import the base + databox presets and add the IPMS
  graph. Basic/base presets (`config/default.json`, storage, identity, …) are **not modified**.
- ✏ `package.json` — a `start:ipms` script (parallel to `start:databox-live`); no change to default `start`.
- Documented profile ladder: **basic → +databox → +ipms → +modules**.
- ✎ `docker-compose.yml` (§1.3) — IPMS container + `/data` volume + env/secrets; the existing `Dockerfile`
  runs the IPMS by pointing `CSS_CONFIG` at the IPMS preset. Multi-arch (amd64+arm64).

**Server — hosting module:**
- ✎ `src/databox/ipms/modules/hosting/HostingModule.ts` (manifest + route handlers),
  `HostingConfig.ts` (pure DNS-record/artifact derivation — unit-testable).

**Admin panel (`smithy-admin`):**
- ✎ `src/pages/hosting/index.tsx` (wizard), `src/modules/` (module-contribution convention).
- ✏ `src/components/layout/index.tsx` (dynamic sidebar), `src/App.tsx` (routes/resources),
  `src/providers/dataProvider.ts` (`modules`/`hosting`/`config` resources → `/.databox/ipms`).

**Tests (src/ is under a 100% coverage gate):**
- ✎ Unit: registry (register/enable/disable, fail-closed), config store (LDP commit + WAC), hosting artifact
  derivation (both routes, wildcard, www reserve, DNS correctness), vocab.
- ✎ Integration: extend the `test/integration/DataboxLive.test.ts` pattern — `/.databox/ipms` token-protected,
  enable/disable persists as a retrievable Solid resource, hosting config round-trips.

---

## 8. Verification (end-to-end)

Prefix every node/npm cmd with `export PATH="/c/nvm4w/nodejs:$PATH"`; Jest scoped, `--maxWorkers=2`;
`rm -f .eslintcache` before lint (per `project-node24-and-deps-upgrade-state`).
1. **Unit:** `npx jest test/unit/databox/ipms --maxWorkers=2` — green, 100% coverage on new `src/` branches.
2. **Integration:** new `DataboxIpms.test.ts` (or extend `DataboxLive.test.ts`, `--runInBand`) — real CSS
   process, random ≥32-byte token; `/.databox/ipms` rejects without token; enable/disable writes a Solid
   resource retrievable via normal LDP; hosting config round-trips → expected DNS for both routes.
3. **Admin UI:** run `smithy-admin` dev; enable the hosting module → nav entry appears; wizard computes
   `databox.acme.org` + `www.acme.org`, renders the correct Cloudflare DNS table, config persists.
4. **Gate:** build + lint + tsc(src+test) green on Node 24.18.0.
5. **Basic profile untouched (§1.1):** launch the vanilla base config (e.g. `config/default.json`) with **no**
   IPMS preset and confirm a plain Solid server boots and the existing base test suites still pass — the IPMS
   layer must add nothing to, and remove nothing from, the basic install.

---

## 9. Phasing & open decisions

- **Pass 1:** IPMS core (module registry/manifest/config-as-resource/route dispatch) + dynamic admin sidebar +
  hosting module (guided v1) + vocab. Seams for config/setup/users defined.
- **Pass 2+:** user management depth, config/setup UIs via `ui#` forms, Cloudflare API apply (v2), the `www`
  site served via databox capabilities, resolvable `w3id.org/databox` vocab.

**Open / your input wanted:**
1. **Where does this plan live?** Move into the repo (`databox/*.md`, alongside the ADRs) for version control? **⟵**
2. **IPMS vocab namespace** (`urn:solid-server:databox:ipms#` vs a `w3id.org/databox` scheme). **⟵**
3. **How WordPress-like** — do you want hooks/filters (event interception), a module marketplace/registry, and
   capability negotiation between modules, or is enable/disable + config + admin-UI enough for now? **⟵**
4. **User-management depth in pass 1** (list/create + admin role only, vs. full role/capability model). **⟵**
5. **Cloudflare live-API apply now or as pass-2.** **⟵**
6. **`ui#` vs SHACL (vs both)** for config shapes. **⟵**
7. **Device auth (§10.2)** — cert-provisioning is the chosen direction; remaining call is
   **dedicated non-proxied `devices.` host** vs **Cloudflare edge-mTLS (cert forwarded to origin)**, and
   whether the device-auth module lands in an early pass. **⟵**
10. **Directory/VC depth (§5.0/§5.5)** — how much of roles + **VC membership-card issuance** in pass 1
    (directory CRUD + roles only, vs. also a working VC issuer)? Confirm `org:`/`rov:`/VC as the vocab. **⟵**
11. **Governance (§5.7)** — how much is machine-enforced vs recorded in pass 1 (role→authority + a simple
    approval gate + resolution records, vs. full quorum/voting)? Any governance/decision vocab you want to
    anchor on beyond Org + ODRL + DPV? **⟵ (standards-lead)**
12. **Packaging (§1.1)** — keep the IPMS as in-repo presets now, or plan to extract it into a **separately
    installable package** (depending on `@solid/community-server`) for upstream-CSS operators? **⟵**
13. **Discovery protocol (§10.6)** — LDN for the notification leg + Type Index/`.well-known` for endpoint
    discovery: confirm this split, or a different mechanism? **⟵**
14. **Website maker (§10.7)** — static-generation (publish artifacts, cache-friendly) vs dynamic render from
    the pod? And how far in scope (SEO + catalogue pages first, theming later)? **⟵**
15. **OWL reasoning scope (§3)** — how much OWL-DL entailment do we actually run (validation/classification of
    products/receipts), vs OWL as vocabulary structure only? **⟵ (standards-lead)**
16. **Install harness (§1.2)** — confirm **Rust tray supervisor + browser UI** (Tauri as escape hatch), over
    Electron / browser-only? **⟵**
17. **Server lifecycle (§1.2)** — tray-owned process vs **OS service + tray-controller** (robust always-on)?
    And Node-bundling approach (sidecar runtime vs host-installed Node). **⟵**
18. **Docker device-TLS (§1.3)** — how to give the `devices.<apex>` mTLS endpoint a direct-TLS path in a
    containerised/cloud deploy (dedicated non-proxied listener/port vs edge-mTLS cert-forwarding)? With
    Cloudflare Tunnel (§6) the answer is edge-mTLS; confirm for the non-tunnel case. **⟵**
19. **RDF feeds / aggregators (§10.8)** — open schema.org feeds only for now, or also build a specific
    per-marketplace adapter (which one first — Uber-Eats-style ordering, product marketplace)? **⟵**
20. **Cloudflare Tunnel scope (§6)** — confirm Tunnel as the *default* on-prem exposure (API-token automation),
    with guided-artifacts + DDNS as fallbacks? Which token scope / how stored (env vs module config)? **⟵**
8. **Payments (§10.5):** Stripe-first confirmed? Which further gateways? Include the **Open Payments/Interledger**
   standards-pure rail, or gateways only for now? **⟵**
9. **solid-contrib deps (§2.2):** adopt `data-modules` (+ soukai-solid ODM?) as the content-module foundation,
   or keep module data hand-modelled on CSS's `n3` stack? **⟵**

---

## 10. Module roadmap & device identity (the small-business growth path)

The IPMS exists so these ship as **modules**, not forks. Ordered by the north star (§1). Each is a *seam*
now; only Hosting is built in pass 1.

**10.1 Hosting / Cloudflare** — §6. First module. In scope now.

**10.2 IoT / Web-of-Things — device identity via cert provisioning (the chosen direction).**
Devices (displays, POS terminals, scanners, sensors) are **directory entries** (§5.0) — each an agent WebID,
governed by least-privilege WAC/ACP. Provisioning follows Timothy's cinema-rollout model (a small client app
given a URI, provisioned a cert that governs the device):

1. **Enrol:** operator creates a device in the directory → IPMS issues a one-time **claim URI** (enrolment
   token) + the intended device WebID (e.g. `https://devices.databox.<apex>/screen-01#id`) with role(s).
2. **Client app (Rust static binary — good fit: cheap hardware, holds its own cert):** given the claim URI,
   it generates a keypair locally and enrols (claim token + public key / CSR).
3. **Bind:** IPMS issues a **client certificate** for that key and writes the public key into the device WebID
   profile as **`cert:key`** — the WebID-TLS binding.
4. **Authenticate:** thereafter the device uses **mutual TLS**; the server verifies the presented cert's key
   matches `cert:key` in its WebID profile (the WebID-TLS algorithm). Governance = WAC/ACP + `TenantBinding`.
5. **Rotate/revoke** from the directory (short-lived certs optional).

**Why cert-based (revising the earlier "avoid WebID-TLS"):** WebID-TLS was deprecated for *browser login UX*
(cert-selection popups, no discovery) — none of which applies to a **headless appliance with a dedicated
agent holding its own cert**. For fixed devices this is arguably *better* than OIDC (long-lived, no
interactive flow). So it's the chosen direction. Honest caveats (engineering, not concept):
- **CSS doesn't implement WebID-TLS** → build a **device-auth module**: a TLS listener requesting client
  certs + a WebID-TLS verifier (fetch profile, match `cert:key`). The org acts as a small CA (or records
  self-signed keys).
- **TLS termination / CDN:** mTLS needs the **origin to see the client cert**. A Cloudflare-**proxied** host
  terminates TLS at the edge and breaks this → use a **dedicated non-proxied device host**
  (`devices.databox.<apex>`, DNS-only/grey-cloud, direct to origin) — the **Hosting module (§6) must generate
  that record and warn on proxy status**. Alternative: Cloudflare **edge mTLS / API Shield** forwarding the
  cert to origin via header (trust-the-edge model).
- **Fallback:** devices that can't do mTLS (or must sit behind the proxy) use Solid-OIDC **client-credentials**
  (DPoP) tokens instead. The databox already models an `mtls` **token sender-constraint**
  (`src/databox/profile/InstitutionProfile.ts`) for binding a token to a client cert.
- **WoT layer (later):** map devices/readings to **W3C WoT Thing Descriptions** as RDF in the pod (DPV/ODRL
  spine), telemetry via notifications (§10.3).

**10.3 Real-time / WebSockets.** CSS already implements the Solid Notifications Protocol (§4). Module work is
to **enable + surface**: a IPMS module manages notification channels and exposes live resource-change streams
to the admin UI and to POS/IoT. General app-level pub/sub *beyond* resource notifications (e.g. a POS order
bus) is a further extension — decide whether to model it as Solid resources + notifications (standards-pure)
or a dedicated socket channel.

**10.4 POS (point of sale).** The headline small-business app. Products, orders, payments, receipts — modelled
as RDF resources (receipts already exist as a record type in the info-categories taxonomy,
`smithy-admin-info-taxonomy-direction`), real-time via §10.3, device peripherals via §10.2. Large; its own
design pass. Seam + data-model sketch now, build later. **Depends on the Payments module (§10.5).**

**10.5 Payments (comprehensive) — the money layer POS depends on.** You want full payments: web-payments
standards, receipts, and real gateways (Stripe + others). Design as a **`PaymentGateway` adapter pattern**
(one interface, swappable adapters), so the IPMS is gateway-agnostic:

- **PCI-safe boundary (non-negotiable, and a safety line):** the self-hosted shop box **never handles raw
  card data (PAN/CVV)**. Use the gateway's **hosted fields / hosted checkout** (e.g. Stripe Checkout /
  Elements), tokenization, and **webhooks** for confirmation. The box stores only tokens + payment status +
  receipts — never card numbers. Keeps PCI scope minimal (≈SAQ-A) and matches the standing rule that card
  credentials are never entered into arbitrary fields. Gateway **API keys are module config**, stored
  server-side, redacted in logs, never committed (reuses §5.1 config-as-Solid-resource + the LibreChat
  "app depends on settings" flow).
- **Gateway adapters:** **Stripe first** (widest small-business fit), then PayPal / Square / etc. Each adapter
  is a sub-module. Payment confirmation arrives via **webhooks → CSS notifications/WebSockets (§10.3)** →
  live POS order status.
- **Authority-gated (§5.7):** payments above a governance-defined limit require the approval chain the
  entity's rules specify (e.g. treasurer/board); the module checks governance authority before capture and
  records the authorising resolution alongside the receipt.
- **Web-payments standards layer (in front of gateways, honest framing):**
  [W3C Payment Request API](https://www.w3.org/TR/payment-request/) for browser checkout UX where supported
  (it fronts a gateway, isn't money movement); **[Open Payments](https://github.com/interledger/open-payments)
  / Interledger** (GNAP) as an **optional standards-pure adapter** aligned with your standards spine — offered,
  not the default, because wallet adoption is thin for card-taking shops.
- **Receipts as linked data (the "generate receipts" requirement, standards-native):** on payment success,
  mint a receipt as an **RDF resource** — [schema.org `Order`/`Invoice`](https://schema.org/Invoice) (receipt =
  Invoice at `PaymentComplete`) + DPV/ODRL — committed to the pod (reuse `CssDataboxStore`), WAC-scoped to the
  customer/holder. Dovetails with the existing **"receipt" record type** in the info-categories taxonomy
  (`smithy-admin-info-taxonomy-direction`) and the corrections/consumer-ledger features. Portable, verifiable,
  customer-owned.
- **Scope:** its own design pass; seam + gateway interface + receipt shape sketched now, Stripe adapter built
  with POS.

**10.6 Delivery provider + discovery.** A delivery/logistics provider participates as a **directory
relationship** (§5.0(2)) — a partner org with its own WebID, authorised (via governance §5.7) to a
delivery-job scope only. A separate **provider-side app** connects in (same pattern as the device app /
LibreChat: identity + scoped grants).
- **Job/notification leg → LDN** ([Linked Data Notifications](https://www.w3.org/TR/ldn/), W3C Rec; CSS
  already has `LDNChannel2023`): the business posts a delivery job to the provider's **`ldp:inbox`**; the
  provider accepts/updates status by writing back to the order's inbox. Async, decoupled.
- **Discovery (honest framing):** LDN is the *inbox/notification* leg, **not** a whole discovery layer.
  Endpoint/catalogue/service discovery uses **WebID/org-profile links + `solid:` Type Index + `.well-known`
  service description**. "Whatever works" → LDN for the exchange, Type-Index/well-known for finding things.
- **Payload:** orders/receipts as OWL things (§3). Live status via notifications/WebSockets (§10.3) → POS.

**10.7 Website maker (fulfils the `www` route).** The engine for the reserved `www.<apex>` route: pulls
back-end **things** (catalogue/products, menu items, business + legal-entity info §5.0(1)) into public pages.
- **SEO as first-class output:** schema.org **JSON-LD** (Product/Offer/Menu/LocalBusiness/Organization — the
  OWL things *become* the structured data), plus meta/Open-Graph/Twitter tags, `sitemap.xml`, `robots.txt`.
  **Generalises the existing landing-page SEO work** (recent commits already do OG/Twitter/Schema.org).
- **Hosting contrast:** the www site is **public + proxied/cached** at the Cloudflare edge (opposite of the
  non-proxied devices host, §10.2) — the Hosting module (§6) sets that up.
- **Scope:** large (templating/theming/publish pipeline; static-gen vs dynamic render is a decision, #14).
  Seam + data-binding-to-things sketch now, build later.

**10.8 RDF feeds / syndication (outbound, for aggregators).** Publish the business's **things** (catalogue,
menu, offers, availability, business info — §3) as **public machine-readable feeds** so aggregators can list
the business (the Uber-Eats / eBay / Amazon shape). Same source data as the website maker (§10.7); this is the
*machine* face, that the *human* one.
- **Standards-native core:** **schema.org JSON-LD** (`Product`/`Offer`/`Menu`/`Restaurant`/`LocalBusiness`) +
  Turtle/RDF via **content negotiation** — gets you Google structured-data and *open/semantic* aggregators.
  **Public** (WAC-public), served on the **website/public plane** (§6), cacheable at the Cloudflare edge.
- **Discovery + freshness:** advertise feeds via **`solid:` Type Index + `.well-known`** and push updates via
  **LDN / notifications (§10.3/§10.6)** when the catalogue changes.
- **Honest limit:** open RDF feeds do **not** auto-list you on **closed marketplaces** (Uber Eats, Amazon,
  eBay run proprietary APIs). Matching each needs a **per-aggregator adapter** (same pattern as payment
  gateways §10.5 / delivery §10.6) — open feeds are the principled core; proprietary connectors are opt-in
  add-ons. Marketplaces themselves are **directory relationships** (§5.0(2)).

---

## 11. Use-cases → horizontals & verticals (validation)

Eight use-cases (food+delivery; bar/pub/nightclub; second-hand/op-shop; charity; auto-repair; camping/
caravan/motel/hotel; festival w/ many acts; content channel) confirm the architecture generalises: every org
decomposes into **horizontal capabilities** composed by a thin **vertical profile** (industry bundle) —
WordPress + industry themes/plugins, **ANZSIC-aligned** (the Setup page already recommends by ANZSIC).
Verticals are **preconfigured module bundles + thing-vocabularies** (menu vs vehicle vs content), not bespoke
apps.

**Horizontal capabilities** — already in plan: Directory (§5.0/5.5), Governance (§5.7), Payments (§10.5),
Feeds (§10.8), Website (§10.7), Hosting (§6), Real-time (§10.3), Delivery (§10.6). **Surfaced by the use-cases
(add to roadmap):**
- **Bookings / availability** — bookable resources over time: tables, rooms, pitches, appointments, tickets
  (uc 1,2,6,7). A core horizontal, not a per-vertical feature.
- **Jobs / work-orders / production workflow** — intake → queue → produce → finish → ready (auto-repair uc5,
  food kitchen uc1, **print/3D uc10**). Three independent use-cases → a core operational horizontal; live
  status via §10.3.
- **Usage licensing on assets (ODRL)** — purpose-limited terms on **customer-owned / digital** assets (print
  file, 3D model, content uc8): no-reuse, delete-after, print-count / pay-per-use. Validates §3 ownership in
  the *customer→business* direction (IP, not just personal data).
- **Events & scheduling + Ticketing** (uc 2,7) — tickets can be **VCs**.
- **Catalogue framework (typed)** — SKU (1,8), **unique-item + provenance** (3), menu (1,2), media (8),
  **variants / SKU matrix** (clothing/footwear: size×colour×fit, stock per variant; schema.org
  `ProductModel`/`hasVariant`), **wholesale/B2B pricing tiers + MOQ** (manufacturers/suppliers).
- **Product provenance / traceability (verifiable)** (manufacturers/suppliers) — origin, materials,
  certifications as **VCs / linked-data attached to goods**, flowing producer→supplier→retailer→consumer into
  the **receipt**. Farm-to-table transparency as real verifiable claims (anti-greenwashing). Builds on VC
  issuance + feeds §10.8 + the OWL things §3.
- **Credential issuance (VC) as a horizontal** — generalises far past membership: **age/ID proof** (2),
  **warranty** (5), **ticket** (7), **qualification/Open Badges** (education). Big payoff.
- **Longitudinal / portable records about owned things** — vehicle service log, owner-controlled + portable
  (uc 5); generalises (equipment, property, pets). **Strongest Solid-sovereignty story in the set.**
- **Social / interactions** (uc 7,8) — reuse solid-contrib `data-modules` (chats/social).
- **Subscriptions / recurring** (uc 8) — recurring relation+payment; **Web Monetization / Open Payments** find
  their killer use here.
- **Donations + tax receipts** (uc 3,4, DGR), **volunteer / grant / acquittal** (uc 4).
- **Federation with external Solid pods** (uc 7, and *fully* in the marketplace) — a relationship pointing at
  another party's pod; providers/acts bring their own data. Pure Solid interop.
- **Federated / hierarchical org networks** (community orgs) — a **chapter under a parent body** (club→district
  →Rotary International; parish→diocese→denomination) via `org:subOrganizationOf`/`org:hasUnit`. Distinct from
  multi-tenancy (**affiliated** parent-child, not isolated); extends **nested governance** (§5.7) and gives
  **membership that federates** (member of the local = member of the parent). Local autonomy + upward reporting.
- **Marketplace / brokerage & matching** (job-marketplace) — a **federated capability registry** (providers
  advertise services as RDF from *their own* pods) + **job/RFQ + bids/quotes + matching** (offers↔wants); a
  **curator/broker** actor orchestrates the multi-party workflow. The platform **connects, it does not own**
  the parties' data (anti-extractive — the point).
- **Escrow / marketplace split payments** — hold-until-complete + fee/split (Stripe-Connect-style, or Open
  Payments); a payment pattern beyond §10.5 direct sale.
- **Portable reputation + credential verification** — reviews/ratings the **provider owns** (portable across
  platforms, not locked in) + verifying their **VCs** (licence / insurance / qualification). Trust **without a
  central data lake** — leans on VCs + consented/federated queries (partly a research frontier).
- **Minimal-disclosure verification (headline capability — replaces surveillance-screening).** The person
  **holds** their credentials; only a **narrow verified fact** crosses to a hirer/landlord ("holds valid WWCC,
  exp 2026-03" / "income sufficient"), never the raw document/record. Directly attacks HR background-checks,
  **tenant screening**, credit checks. **Principles:** (a) **verify-don't-store** — prefer **government (or
  authorised body) as issuer** straight to the person's pod, so the curator holds *nothing sensitive* and only
  verifies the issuer signature; a curator holding raw police/WWCC data is a **strictly-authorised fallback**
  (heavy legal duty), never the default. (b) **Two tiers:** narrow-claim **attestation VCs** (boolean/expiry —
  robust, available now) → cryptographic **selective disclosure** (SD-JWT / BBS+, per-attribute, unlinkable —
  advanced frontier, don't overstate maturity). Data-minimisation by design (DPV); the scope shared is *small*.
- **Person-owned portable profiles** (clothing/footwear, food) — body/fit, **allergies/dietary**, accessibility
  needs, preferences held in the **person's** pod; consumed by *multiple* verticals (food allergens + clothing
  materials), entered once, **reused not re-collected/hoarded**, shared **minimally** (allergy = special-category
  health data → filtered results, not the record).
- **Delegation / acting-on-behalf-of (assisted agency)** — one person **authorises another** (scoped,
  revocable, audited) to use their data / act for them: **partner-proxy, parent→child, carer→elderly/disabled,
  power-of-attorney, executor**. The person **retains ownership** — **assisted autonomy, not account-takeover**
  (the dignity distinction). The **personal analogue of governance §5.7**: a reified authority-grant (ACP/ODRL)
  between two WebIDs. *Delicate:* who may delegate what / for how long, revocation + audit; minors' guardianship
  (parent→child) is the benign edge of the **parked** education minors'-data problem — reuse that care, don't
  fork it.
- **Household / domestic collective (entity at personal scale)** — family, sharehouse, or care arrangement =
  an **informal mini-entity**: members sharing stewardship of common **things** (pets, home, devices, bills),
  light governance, delegation among members, shared payments. Confirms the **§5.0 entity model generalises
  from business/org to the DOMESTIC unit** — the "entity" is scale/context-independent (same primitives run a
  Rotary club, an auto shop, or a household).
- **Emergency / break-glass access** — data normally private but **conditionally accessible under a defined
  emergency** (emergency contacts, medical, allergies), **audited every time**. The trigger is a *condition*,
  not a standing grant — distinct from ordinary WAC/ACP. Safety×privacy balance; recurs in sharehouses, elderly/
  disabled care, lone workers, medical.
- **Aggregator / OTA / channel adapters** (uc 1,6,8) — the recurring **adapter pattern** (one framework for
  gateways §10.5 / delivery §10.6 / aggregators §10.8 / OTAs).

**Decisions surfaced:**
- **#21 Tenancy** — single-entity vs **multi-tenant** deploy (co-op / market / festival-of-acts = many legal
  entities, one install). `TenantBinding` already gives program-bound isolation → feasible; brings **nested
  governance** (platform + per-member, §5.7). Confirm pass-1 scope. **⟵**
- **#22 Verticals as bundles** — model industry profiles as declarative **module-bundle + vocab** manifests
  (composing horizontals), ANZSIC-keyed? **⟵**
- **#23 Connector/broker deployment shape** (job-marketplace) — a **third deployment shape** beyond single-org
  and multi-tenant: the IPMS as a broker over *external* pods it doesn't own. Confirm it as a **flagship later
  vertical** (not pass-1), and that matching/trust-across-pods is scoped as a research track. **⟵**
- **#24 Minimal-disclosure verification** — confirm **verify-don't-store + government-as-issuer** as the
  default (curator holds nothing sensitive; raw police/WWCC holding is a strictly-authorised fallback), and
  **attestation-VC now / cryptographic selective-disclosure later** as the two tiers? This is a **headline
  capability** (HR + tenant-screening disruption) — how early to prototype? **⟵**
- **#25 Delegation / assisted agency** — model person-to-person authority grants via **ACP vs ODRL** (scoped,
  revocable, audited); how to handle **minors' guardianship** (align with the parked education minors' work);
  and the **person-owned profile** schema (body/fit/allergies) reused cross-vertical. How early? **⟵**
- **#26 Household-as-entity + break-glass** — treat the **household/domestic collective** (family/sharehouse/
  care) as a first-class entity type (§5.0 generalised to personal scale)? And model **emergency/break-glass
  access** (conditional, audited) — how, and how early? **⟵**
- **#27 Kubernetes / HA (§1.3)** — Helm chart + which **shared backend** (DB/object store) and **distributed
  locker** (Redis) for multi-replica; scope K8s to multi-tenant/cloud operators. **⟵**
- **#28 Portability & migration (§1.4)** — confirm the **standard-Solid-data + replaceable-capability** layering
  as the no-lock-in guarantee; build a **pod export/import** migration tool (reusing the repo's data-portability
  work); accept the honest limits (OIDC regs / server config / subscriptions re-established, not migrated). **⟵**
- **#29 Declarative-first, on vanilla Solid (§1.4)** — how far to push logic into **declarative RDF** (the
  "works") vs runtime code, expressed on **Solid-protocol conformance + standard W3C vocabs** (no new contract).
  Deliverable = **define-by-demonstration** (a vanilla-Solid reference), not a new spec; upstream only for a
  genuine gap. **⟵**
- **#30 Enterprise connectivity (§1.5)** — Rust ODBC + LDAP/AD connector sidecar, mapping via **R2RML/RML** into
  the pod; which integration mode first (import vs live-bridge vs virtual); AD as *data source* now, auth-IdP
  later. Enterprise-end scope. **⟵**
- **#31 Data-layer engine (§1.6)** — confirm **internal Solid pods** as the fixed model + **Oxigraph** (native
  in the Rust loader / WASM in browser) as the default engine, file-backend as the simplest fallback, CSS owns
  writes, binaries as blobs. Foundational (Phase 0). Which engine ships first (file vs Oxigraph)? **⟵**

**Adopted validators (in scope — each sharpens a different pillar):**
- **Professional services / appointments** (hairdresser, clinic, tradesperson) → **bookings** + **client
  records** + **regulated profession** (licensing, professional duties → governance + DPV).
- **Membership association / club / union / co-op** → forces **pluralistic governance (§5.7)**: authority
  derived *democratically* (members elect a committee, **one-member-one-vote**, AGM, dues) — a different model
  than corporate (board/shares). Governance-heaviest validator.
- **Multi-tenant marketplace / co-op** → **tenancy (#21)** + **nested governance** (the platform/co-op governs
  the marketplace *and* each member entity governs itself; isolated by `TenantBinding`).
- **Allied-health practice** → the **privacy/consent spine** — and validates apparatus **already built**
  (smithy-admin access-requests / corrections / consumer-ledger; `sensitive` special-category in the taxonomy):
  patient records in the *patient's* pod, granular revocable consent (DPV), regulated confidentiality.
- **Print shop / 3D printing** → **inverts the ownership flow** (first case where the *customer* owns the
  thing): the customer's submitted asset (print file / 3D model, their **IP**) is licensed to the shop for a
  **bounded, purpose-limited job** (ODRL: no-reuse, print-count, delete-after) — validates §3 for
  *customer-owned digital assets under licence*, rights-spine pointed at IP not just personal data. Also the
  crispest **devices (§10.2)** instance (printers = governed IoT receiving jobs + telemetry), the
  **jobs/work-order** horizontal, and — for 3D — **digital-rights licensing** (print-count/CC, pay-per-print
  via Open Payments) + a possible **design marketplace** (creators license models, bring own pods = federation).
- **Job/task marketplace / modern Yellow Pages** (Airtasker / Taskify shape) → the **fullest anti-extractive
  Solid case** and a distinct **deployment shape: IPMS-as-connector/broker** whose "inventory" is *other
  people's pods*, not owned data. Connects **independent personal pod owners** across three roles: a
  **professional** (provider, advertises services from *their own* pod), a **contractor** (requester/hirer),
  and a **curator** (a *new actor* — broker orchestrating the multi-party workflow for a service fee). Surfaces
  federated matching, escrow/split payments, and portable reputation + VC verification (below). **Honest
  tension:** value = *curate / connect / vouch for trust*, **not** *own the data* (aligned with the mission; a
  harder business model); matching + trust across sovereign pods is the partly-**research** frontier — a
  **flagship *later* vertical**, not pass-1, but the one that best proves why the whole project matters.
  **HR-industry disruption:** replaces background-check/recruitment **data-hoarding** with worker-owned,
  portable credentials + **minimal-disclosure verification** (below) + curator services (**insurance**,
  **complaints/dispute support**). The curator holds *nothing sensitive* when possible — see the
  verify-don't-store principle in the minimal-disclosure horizontal.
- **Real estate — sales &, most importantly, rentals** → the **same anti-surveillance fight as HR, second
  domain**: tenant screening today forces renters to splatter ID/income/bank/rental-history to every landlord;
  invert it → renter presents **minimal attestations** ("ID verified", "income sufficient", "rental history
  clear"), not raw docs. Also a **rich integrator** exercising nearly every horizontal: the **agent = a
  curator/broker**; **lease** = agreement (ODRL+legal §3); **bond** = escrow; **rent** = recurring payments;
  **maintenance** = jobs/work-orders routing into the **trades marketplace**; **inspections** = bookings;
  **condition reports** = longitudinal records (property = thing w/ history); **listings** = feeds/aggregators.
  Sales adds conveyancing (multi-party) + title records.
- **Community organisations** (Rotary / Lions / churches — **lots of them**, adoption-relevant) → mostly a
  **non-commercial recomposition** of existing horizontals (membership + events + governance + donations/
  fundraising + social/engagement) — *reinforces* the horizontal/vertical thesis. **New dimension:
  federated/hierarchical org networks** (below). Faith-community membership = **special-category** religious
  data (already `sensitive` in taxonomy) → minimal disclosure applies here too.
- **Clothing & footwear** → **not "just retail"** (under-weighted first pass): the real value is a
  **person-owned profile** — body/foot measurements, **allergies** (material), fit preferences — in the
  *customer's* pod, reused across all retailers (not re-entered, not hoarded), shared **minimally** (allergy →
  filtered results, not the medical detail). **Cross-vertical reuse:** the *same* allergy profile serves
  **restaurant menu allergen-filtering (uc1)** *and* clothing materials — "your data, reused across services",
  concretely. Enables **shopping-on-behalf-of** (partner; parent→child) → the **delegation** capability (below).
  Shop-side sharpening remains: catalogue **variants / SKU matrix**.
- **Pet shop + pet/family management env** — the *shop* is light retail; the value is a **pet-management
  environment**: a pet is an **owned living thing** with a **longitudinal health/vet record** (vaccinations,
  treatments) **owner/family-controlled and portable across vets** (the vehicle-log pattern, uc5), a **dietary/
  allergy profile** the pet-food shop consumes (cross-vertical), and **family shared stewardship** (household,
  below). Vet = a provider relationship (appointments/records). **Benign world-of-god edge:** a pet is a
  *living being*, not a manufactured thing — the **parked** ag/aquaculture §3 principle surfaces in domestic
  form (reinforces holding it). **Pet care** (grooming / boarding / walking / sitting / daycare / training)
  completes the ecosystem (shop → records → vet → care): provider services that consume the pet's **care
  profile minimally**, are **bookings**-shaped (boarding = accommodation-over-time; grooming = appointment),
  use the **marketplace/broker** pattern for walkers/sitters (Rover/Wag shape), and — the keeper — **fuse
  delegation + break-glass**: a carer gets **temporary scoped revocable authority** (feed/meds per plan) +
  **emergency vet access while the owner is away**. The pet-analogue of carer→elderly assisted care; shows
  delegation + break-glass **compose** into "handing over care safely".
- **Sporting venue** — an **integrator + composite entity**: composes **events/ticketing** (uc7, matches as
  the "acts"), **facility bookings** (courts/lanes/fields/venue-hire), **membership / season-tickets**
  (recurring + VC), **concessions** (the food vertical *embedded*), and community-**club** overlap (teams =
  sub-groups, fixtures/leagues = scheduling). **New composition — credential-gated physical access:** a
  membership/ticket VC at a **turnstile (IoT device §10.2)** grants entry by verifying "valid member/ticket"
  **without learning identity** — minimal-disclosure + VC + device + membership **fused in the physical world**.
  Also the first **single-entity-runs-many-verticals** case (events + food + retail + membership, one entity —
  distinct from multi-tenancy's *many* entities; reinforces vertical = bundle).
- **Food/goods manufacturers & suppliers** (boutique products, farm gates) — the first **upstream / B2B /
  producer** cases. Adds **B2B/wholesale** (trade relations org↔org, wholesale pricing tiers, MOQs, trade
  accounts, net-terms invoicing) and the big one: **verifiable product provenance / traceability** (origin,
  materials, certifications — organic/fair-trade — as **VCs/linked-data attached to the goods**, real claims
  not marketing). **Connects the whole ecosystem:** producer → supplier → retailer → consumer, each sovereign,
  **provenance flowing through into the consumer's receipt** — makes the retail cases a *chain*, not islands.
  **"Farm gate" = the commercial edge of parked agriculture** (direct *sale* in scope; *production* modelling —
  animals/land/growing, world-of-god §3 — stays parked). Same benign-edge separation as pets.
- **Sharehouse** — a **household / domestic collective** (non-family): several people co-managing a shared
  dwelling + obligations. Surfaces **shared/split payments** (rent + bills split among housemates; recurring +
  bond escrow), **household IoT with shared/delegated control** (smart lock/thermostat — who may operate,
  §10.2 + delegation), **emergency / break-glass access** (below), and light **house governance** (chores/
  quiet-hours — pluralistic §5.7 at tiny scale). Connects to **rentals** (co-tenants under a lease).

**Parked (need more testing before design — principle still held):** **agriculture / aquaculture** (where the
*world-of-god* stance §3 stops being abstract — living systems, animals, land, provenance chains; ethics *and*
model need real work) and **education / training** (minors' data + credentialing-at-scale, both of which shift
the privacy/VC design). Deferring the *use-cases*, **not** the world-of-god commitment (§3), which stays held.

---

## 12. Module & sub-module inventory (mapped to use-cases)

Modules = **horizontal capabilities** (reusable) composed by **vertical profiles** (bundles). Use-case codes:
`FOOD BAR OPSHOP CHARITY AUTO ACCOM FEST CONTENT PROF MEMBER MKT(multi-tenant) HEALTH PRINT JOBMKT REALEST
COMMUNITY CLOTHING PET SHARE VENUE MFG`. "All" = every deployment.

### 12.1 Group A — IPMS framework (all deployments)
| Module | Sub-modules | Use-cases |
|---|---|---|
| Module system | registry, manifest, config-as-Solid-resource, route dispatch, enable/disable, capability-modes (portable-core/enhanced) | All |
| Configuration | site settings (RDF), per-module config (SHACL/`ui#` forms) | All |
| Setup / onboarding | first-run wizard, admin bootstrap, vertical-profile picker (ANZSIC) | All |
| Admin shell | dynamic nav (from enabled modules), dashboard | All |
| **Theming** (§12.4) | design-token engine, theme packages, theme-agent | All |

### 12.2 Group B — Entity & people (core model §5.0)
| Module | Sub-modules | Use-cases |
|---|---|---|
| Legal entity | identity/WebID, legal attrs (`org`/`rov`/schema.org), branding | All |
| Directory & relationships | agent/person (FOAF/WebID), org, role/`org:Membership`, pairwise/opaque map | All |
| Governance & authority | role→authority, ODRL policy eval, approval gate/chain, resolution records, **voting/quorum** (democratic), **nesting** | All (deep: MEMBER, MKT, COMMUNITY, CHARITY) |
| Credential issuance/verification (VC) | issuer, holder, verifier, revocation; types: membership/age/warranty/ticket/qualification | MEMBER COMMUNITY BAR AUTO FEST VENUE JOBMKT REALEST HEALTH MFG |
| **Minimal-disclosure verification** | attestation-VC, selective-disclosure (SD-JWT/BBS+), verify-don't-store, gov-as-issuer | JOBMKT REALEST HEALTH VENUE BAR (+ any screening) |
| Person-owned profiles | body/fit, allergies/dietary, accessibility, prefs (cross-vertical) | CLOTHING FOOD PET HEALTH |
| Delegation / assisted agency | scoped/revocable/audited grants (partner/parent/carer/PoA/executor) | CLOTHING PET SHARE HEALTH COMMUNITY (any care) |
| Emergency / break-glass access | conditional trigger, audit | SHARE HEALTH PET (care) |
| Household / domestic collective | members, shared stewardship, light governance, shared payments | SHARE PET (family) + personal-scale |
| Federated / hierarchical org networks | `org:subOrganizationOf`, federating membership, nested governance | COMMUNITY (Rotary/church) MKT |
| Multi-tenancy | program-bound isolation (`TenantBinding`) | MKT (+ co-op/market) |
| Connector / broker | federated capability registry, matching (RFQ/bids), curator role | JOBMKT (flagship) |

### 12.3 Group C — Operational horizontals
| Module | Sub-modules | Use-cases |
|---|---|---|
| Catalogue (typed) | product/item, **variants/SKU-matrix**, unique-item+provenance, menu, media, **wholesale/B2B tiers+MOQ**, inventory/stock, categories | FOOD BAR OPSHOP CONTENT CLOTHING PET MFG AUTO VENUE |
| Bookings / availability | bookable-resource, calendar, reservation, slots/appointments, capacity, deposits, cancel/reschedule | FOOD BAR ACCOM FEST PROF VENUE PET(care) HEALTH |
| Jobs / work-orders / production | intake→queue→produce→finish→ready, status | AUTO PRINT FOOD(kitchen) REALEST(maintenance) |
| Payments | gateway-adapter iface, **Stripe** (+PayPal/Square), **escrow/hold**, **split/marketplace**, **subscriptions/recurring**, **Web-Monetization/Open-Payments**, PCI-safe hosted-fields, webhooks, refunds | All commerce |
| Receipts | RDF schema.org `Order`/`Invoice`, DPV/ODRL, pod-committed | All commerce |
| Events & scheduling | event, schedule, venue, fixtures/leagues | BAR FEST VENUE COMMUNITY |
| Ticketing | issue (VC tickets), transfer, validate | FEST VENUE BAR |
| Delivery | LDN inbox exchange, provider relationship, status | FOOD REALEST(trades) + logistics |
| Real-time / notifications | WebSocketChannel2023, streaming, webhooks, LDN | FOOD AUTO PRINT VENUE + live status |
| Feeds / syndication | schema.org JSON-LD + Turtle, content-neg, discovery (TypeIndex/well-known), **aggregator/OTA adapters** | FOOD ACCOM CONTENT MFG OPSHOP + listings |
| Website maker | data-binding to things, templates, **SEO** (JSON-LD/OG/sitemap), publish | All public-facing |
| Social / interactions | comments, follows, subscriptions (reuse `data-modules`) | FEST CONTENT COMMUNITY |
| Longitudinal / portable records | append-only, owner-controlled, portable bundle, provenance | AUTO PET REALEST(condition) |
| Provenance / traceability (verifiable) | origin/materials/cert VCs, supply-chain flow | MFG (+ into receipts everywhere) |
| B2B / wholesale | trade accounts, tiered pricing, MOQ, net-terms invoicing | MFG |
| Usage licensing (ODRL on assets) | purpose-limited terms, print-count/pay-per-use, CC | PRINT CONTENT |
| Portable reputation | provider-owned reviews/ratings, cross-platform | JOBMKT (+ marketplaces) |
| Credential-gated physical access | membership/ticket VC → device/turnstile, minimal-disclosure | VENUE (+ gyms/access) |

### 12.4 Group D — Infrastructure (cross-cutting)
Hosting (Cloudflare Tunnel + 3 route profiles §6) · Deployment (box/Docker/K8s §1.3) · Install harness / Rust
native-edge (§1.2) · Device identity (mTLS/Rust §10.2) · Enterprise connectivity (ODBC+LDAP via R2RML mapper
§1.5) · Portability/migration export-import (§1.4) · Ontology + Mapping Registry (§3) · Theming (§12.5).

### 12.5 Theming solution (drop-in + LLM-agent-editable)
Two surfaces: **admin shell** + **public website**. Design:
- **Design tokens** (colour/type/spacing/radius/shadow/motion) in the **W3C DTCG token JSON** standard
  (standards-native, portable) → compiled to **CSS custom properties** (+ Tailwind config; smithy-admin already
  uses Tailwind). Optionally also expressible as RDF (a theme is a declarative "work", portable §1.4).
- **Drop-in:** a *theme package* = tokens + optional template overrides + assets, dropped into a themes dir /
  referenced by config; **switchable at runtime** (admin picks). Ships a neutral default (matches the
  landing-page aesthetic).
- **LLM-agent editable (two tiers):** *token-tier* (easy) — an agent reads the DTCG schema + brand inputs
  (logo/colours/vibe) and emits/adjusts tokens with a live preview; *template-tier* (deeper) — layout/component
  changes, more than a token swap (agent can, but it's real work). Keep **semantic HTML + tokens** so restyle =
  swap tokens. Ties to the artifact/design skills for generation.

---

## 13. Phased implementation plan (agent-swarm executable)

### 13.1 Execution model
- **Task granularity:** one module/sub-module or one vertical per agent — well-scoped, independently testable.
- **Parallelism:** within a phase, tasks with no shared files/deps run **concurrently (swarm)**; across phases,
  **dependency-gated barriers**. Pipeline where a task's stages (build → verify) can flow without a full barrier.
- **Model/effort tiering (cost optimisation).** Route each agent by *actual* difficulty (Workflow/Agent support
  per-agent `model` + `effort`): **Opus/high–max** for correctness-critical (the 4 invariants, guardrail harness,
  module framework, governance/ODRL eval, minimal-disclosure & selective-disclosure crypto, portability/vanilla-
  conformance, broker matching, adversarial verifiers on critical modules, synthesis) — Phases 0/1 mostly Opus;
  **Sonnet/medium** for standard modules (most operational horizontals, infra wiring, straightforward verticals);
  **Haiku/low** for mechanical (config/Components.js wiring, declarative vertical-bundle manifests, test
  scaffolds, coverage fill, routine build/lint checks). **Savings concentrate in the high-parallel swarms
  (Phase 3, Phase 5)**: cheap implementers fanned wide + **selective Opus adversarial verifiers**. *Rule:*
  downgrade by genuine difficulty, never merely to save tokens — a cheap wrong answer costs more; so the
  **verifier stays strong (Opus) on anything load-bearing**, and the default is to inherit the session model
  unless a lower tier is clearly right.
- **Four invariants checked on EVERY task** (the born-in constraints — non-negotiable): (1) **opt-in profile**
  (basic install untouched, §1.1); (2) **capability modes** (portable-core vs enhanced + a standard-mode
  degradation, §1.4); (3) **declarative-first** (logic as ontology/RDF; engine thin, §1.4/§3); (4)
  **vanilla-Solid** (protocol conformance; standard vocabs; no invented dialect, §1.4). A task that can't meet
  (3)/(4) for a feature must move it to the **enhanced tier with a degradation**, not invent a mechanism.
- **Per-task verification:** build + lint + tsc(src+test) + tests + **100% coverage** (repo gate) +
  **vanilla-Solid conformance test** + an **adversarial checker agent** that tries to falsify the invariants.
  Repo env (from [[project-node24-and-deps-upgrade-state]]): Node 24.18.0 via nvm; `--maxWorkers=2`;
  `rm -f .eslintcache`; commit gates run individually.
- **Per-phase gate ("then checked"):** all tasks green + **cross-module integration test** + **adversarial
  review panel** + a **Timothy checkpoint** before the next phase opens.

### 13.2 Phases (dependency-ordered)
- **Phase 0 — Foundations & guardrails** (sequential, first, heavily checked). Install-profile skeleton (§1.1);
  module framework (registry/manifest/config-as-resource/route-dispatch §5.1); capability-abstraction +
  **standard-Solid provider** (two modes §1.4); ontology scaffolding + `Vocabularies.ts` entry (§3); **theming
  token engine** skeleton; and the **invariant test harness** (basic-install-untouched, vanilla-Solid
  conformance, mode-degradation) that every later agent runs against. **Deliverable:** an empty vanilla-Solid
  IPMS shell that boots with the four invariants CI-enforced. *This phase is the guardrail; do not parallelise
  carelessly.*
- **Phase 1 — Core entity model** (mostly sequential). Legal entity (§5.0.1); directory & relationships (§5.5);
  **pluralistic governance primitive** (role→authority + approval gate + resolution records §5.7); VC issue/
  verify basics. **Deliverable:** a governed entity with a directory that can issue/verify a credential — the
  three-register model live.
- **Phase 2 — Person/household distinctive layer** (parallel). Person-owned profiles; **minimal-disclosure
  verification** (attestation tier); **delegation/assisted-agency**; **break-glass**; household/collective;
  federated-org-networks; multi-tenancy. **Deliverable:** the sovereignty-defining set (the "why it matters").
- **Phase 3 — Operational horizontals** (**high-parallel swarm** — mostly independent). Catalogue, bookings,
  jobs/work-orders, payments (adapter+Stripe+escrow/split+subscriptions), receipts, real-time, events+ticketing,
  feeds+adapters, social, longitudinal-records, provenance, B2B/wholesale, usage-licensing, reputation,
  delivery, credential-gated-access. One agent per module; verify each. **Deliverable:** the capability library.
- **Phase 4 — Infrastructure & integration** (parallel). Hosting (Cloudflare Tunnel + 3 routes §6); device
  identity (Rust+mTLS §10.2); deployment (Docker/compose + K8s/Helm §1.3); enterprise connectors (ODBC/LDAP +
  R2RML mapper §1.5); portability/migration tool (§1.4); website maker; theming (full). **Deliverable:**
  deployable end-to-end, on-ramp + off-ramp.
- **Phase 5 — Verticals** (**high-parallel swarm** — one agent per vertical). Assemble the ~21 bundles from
  horizontals (declarative bundle manifest + vertical vocab + config + thin glue). **Lighthouses first:** AUTO
  (portable-records sovereignty demo), a simple retail CLOTHING/FOOD (POS + person-profile), MEMBER (governance),
  HEALTH (privacy/consent). **Deliverable:** demonstrable verticals.
- **Phase 6 — Flagship & frontier** (later; some research). Job/task marketplace + connector/broker deploy;
  selective-disclosure crypto (SD-JWT/BBS+); full supply-chain provenance federation; advanced website maker;
  **migrate-to-another-Solid-server demonstration** (OpenLink Virtuoso — proves §1.4 by demonstration).
  **Deliverable:** the thesis-proving flagships.

**Cross-cutting non-code workstreams (parallel, standards/advocacy):** government-as-issuer engagement (§10.2/
minimal-disclosure); vanilla-Solid define-by-demonstration (§1.4 #29); ontology curation + Mapping Registry (§3).

### 13.3 Verification & checking strategy (the swarm harness)
- **Shape:** *implementer* agents build a module; *verifier/adversarial* agents try to break it + confirm the
  four invariants; a *synthesis/integration* agent merges and runs the cross-module test. (This maps to a real
  multi-agent Workflow at execution time — an **explicit, separate opt-in** when you're ready to run it.)
- **Gates:** per-task (build/lint/tsc/test/100%-cov/vanilla-conformance/adversarial) → per-phase (integration +
  review panel + Timothy checkpoint) → release.
- **Traceability:** every module cites the use-cases it serves (§12) and the decisions (§9) it resolves, so
  coverage and scope are auditable.

---

## 14. Note on this document
This plan has outgrown a single working file (~1000+ lines). **Recommended (decision #1):** move it into the
repo as `databox/solid-ipms-plan.md` (beside the ADRs), and consider splitting: `…-vision.md` (§1–§5),
`…-usecases.md` (§11–§12), `…-implementation.md` (§13). Version-controlled, so it evolves with the code.
