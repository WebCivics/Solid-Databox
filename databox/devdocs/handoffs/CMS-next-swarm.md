# IPMS Next Swarm

Recommended swarm name: `ipms-live-runtime-hardware-swarm-3`

## Purpose

Do not spend the next swarm on more pure horizontal builders or duplicate the portable models now in place. The
latest swarm added opt-in Oxigraph sync composition, an optional live migration harness, connector runtime plans,
cash-register/native-edge contracts, waiter/customer ordering descriptors, and customer-display playlists. The
next high-value work is runtime proof: run real endpoints, write real Solid resources, and package native device
execution.

## Preconditions

- Branch: `databox/ipms-plan`
- Exclude local Claude runtime files such as `.claude/`.
- Treat `databox/solid-ipms-plan.md` as canonical.
- Read `databox/handoffs/IPMS-swarm-status.md` first.
- Preserve the four invariants from the plan:
  - opt-in profile only;
  - portable-core vs CSS-enhanced modes;
  - declarative-first RDF state;
  - vanilla Solid fallback, no invented protocol dialect.

## Suggested parallel units

### 1. Provision And Run Live Oxigraph

Status: harnesses exist; the local `cargo install oxigraph-cli` attempt timed out and no `oxigraph` binary was
available on PATH.

Expected shape:

- Configure a local Oxigraph endpoint or launcher for the development environment.
- Run `npm.cmd run test:ipms:oxigraph` in unified mode and split query/update mode.
- Run `node .\scripts\run-ipms-migration-proof.mjs --mode=unified --start-css --start-oxigraph` and split mode.
- Capture exact endpoint URLs, launch command, and failure/recovery notes in `databox/ipms-oxigraph-smoke.md`.
- Keep this optional for normal CI until the endpoint is provisioned.

### 2. Live Network Hydration

Status: `OxigraphIpmsSyncComposition` now owns config/lifecycle/startup hydration; it still needs a real endpoint
run.

Expected shape:

- Start CSS with `config/ipms/ipms-oxigraph.json`.
- Write/update/delete allowlisted IPMS RDF resources through CSS.
- Prove the SPARQL Update endpoint receives replacement/clear graph operations and can be rebuilt from pods.
- Preserve the invariant that Solid pod resources remain canonical and Oxigraph remains rebuildable.

### 3. ResourceStore POS Routes

Status: DONE for the ordering flow. `PosOrderStore` persists cart/order/ticket/onboarding through `ResourceStore`;
`POST /.databox/ipms/pos/orders` builds and persists a waiter or customer-self-order flow and
`GET /.databox/ipms/pos/orders?iri=` reads it back. The `DataboxIpms` integration test creates a waiter order and
reads the canonical order resource back both through the control plane and through a plain unauthenticated LDP GET
(Turtle), proving standard-Solid degradation. Still missing: register/close-session and customer-display state
persistence, and shop Wi-Fi/table-session native-edge handling.

Remaining shape:

- Persist register (open/close/count) and customer-display resources through `ResourceStore` the same way.
- Keep every such resource readable through standard Solid mode (as the ordering resources already are).
- Add integration coverage for customer self-orders and register/display round-trips.

### 4. Native POS Edge Package

Status: cash-register/device/offline queue contracts exist; actual native package/hardware I/O is not complete.

Expected shape:

- Add a Rust/Tauri or WASM deployable shell for POS/native endpoints.
- Implement mTLS/WebID-TLS verifier, cash drawer/printer ports, QR bitmap rendering, and offline replay spool.
- Keep hardware dependencies behind the interfaces defined by `CashRegister` and `NativePosDeviceContract`.

### 5. Live Customer Display - COMPLETE

Status: timed playlist renderer exists; live display publication/notification path remains.

Expected shape:

- Publish playlist resources through Solid.
- Update display clients through CSS/Solid notifications.
- Exercise app-install, vault-connect, transaction, loyalty, receipt/QR, self-order, and ad slides with a running
  display client.

### 6. Public Website Publishing

Status: website/menu preview exists; live public publishing remains.

Expected shape:

- Publish RDF-backed public HTML/JSON-LD, sitemap, OpenGraph, theme CSS, and feed assets.
- Preserve standard-Solid degradation by making source Turtle resources readable without CSS-private routes.

## Required gates

Run at minimum:

```powershell
npx.cmd jest test/unit/databox/ipms --maxWorkers=2 --coverage=false
npx.cmd jest test/unit/storage/accessors/SparqlDataAccessor.test.ts --maxWorkers=2 --coverage=false
npm.cmd run build
npm.cmd run test:ts -- --pretty false
npm.cmd run lint:markdown
npx.cmd jest test/integration/DataboxIpms.test.ts --runInBand --coverage=false
npx.cmd jest test/integration/DataboxIpms.test.ts test/integration/DataboxIpmsOxigraph.test.ts --runInBand --coverage=false
npx.cmd jest test/unit --maxWorkers=2 --coverage=false
```

If the admin app changes:

```powershell
npm.cmd run build
npm.cmd run lint
```

Run those from `smithy-admin`.

## Stop condition

Stop and report honestly if the work cannot demonstrate live composition progress. Passing unit tests without
CSS profile wiring, live Oxigraph execution, or POS/customer-display state flowing through Solid/RDF is not enough
for this swarm.
