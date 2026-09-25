# Plan: Installer, POS edge binary, and ui# ontology adoption

> Status: **canonical implementation plan, in progress**. Covers three workstreams that are
> missing from the current IPMS implementation despite the plan in `solid-ipms-plan.md`:
> (A) an ontology-driven installer for multiple package types, (B) a POS edge binary that
> runs Node from Rust and bridges hardware I/O, and (C) adoption of the W3C `ui#` ontology
> plus solid-ui integration for RDF-driven config forms.

---

## 0. Current state — what exists, what's missing

### Exists

- **`native/tray-supervisor/`** — working Rust tray app (`tao`/`tray-icon`/`wry`) that spawns
  `node ./bin/server.js -c config/ipms/ipms.json`. Menu: Start/Stop/Open Admin/Open Customer
  Display/Quit. This is a supervisor, not an installer.
- **`native/pos-edge/`** — Rust **library** (no binary target) with:
  - `printer.rs` — ESC/POS thermal printer I/O, cash drawer kick bytes (`ESC p 0`), raster
    image generation (`GS v 0`).
  - `qr.rs` — QR code bitmap generation via `fast_qr` + `image`.
  - `lib.rs` — exposes `qr` and `printer` modules. No `main.rs`, no IPC, no Node spawn.
- **`src/databox/ipms/modules/pos/NativePosDeviceContract.ts`** — comprehensive RDF
  descriptor/job model for cash-drawer, receipt-printer, customer-display, pos-terminal.
  Includes mTLS endpoint descriptors, role constraints, operator sessions, job queuing,
  Turtle serialization. A **data contract**, not a running POS application.
- **`IPMS` vocabulary** in `src/util/Vocabularies.ts` — minimal: `Module`, `enabled`,
  `config` only.
- **`start:ipms` / `start:ipms-demo`** npm scripts. No install/packaging scripts.
- **`solid-ipms-plan.md` §1.2** — describes the tray supervisor + Rust toolchain direction.
  **§3** says "Adopt W3C `ui#` for config form shapes" and "Adopt the `ui#` ontology…
  renderable by solid-ui elsewhere." **§2** says "Optionally embed solid-ui form rendering
  later; not core now."

### Missing (the gaps this plan closes)

1. **No installer** — nothing does pre-flight assessment, Node 24 provisioning, dependency
   resolution, service registration, or admin provisioning.
2. **POS doesn't run as "Node launched via Rust"** — the tray supervisor spawns the CSS
   server; the `pos-edge` crate is a library. No binary spawns a Node POS app and bridges
   hardware I/O.
3. **No `ui#` vocabulary** in `Vocabularies.ts` — the plan says adopt it; it hasn't been
   adopted.
4. **No solid-ui integration** — no code references solid-ui; the `ui#` ontology is not
   wired into module config shapes.
5. **No install-type ontology** — no RDF/SHACL model classifying "server install" vs "POS
   install" vs "connector install" and their requirements.
6. **No service registration** — no systemd/Windows Service generation or health polling.

---

## 1. Workstream A — Installer (ontology-driven, Rust)

### 1.1 Language choice: Rust

Consistent with `tray-supervisor` and `pos-edge`. Can detect/provision Node without
already having Node installed. Cross-platform single-binary distribution. The installer
is the first thing an operator runs — it must not depend on the runtime it installs.

### 1.2 Package types (install categories)

The installer is **package-type aware**. Each package type is defined ontologically (see
§3) and drives a different install sequence:

| Package type | What it installs | Target |
|---|---|---|
| `ipms:ServerInstall` | CSS + IPMS presets + Node 24 + service registration | VPS, cloud, on-prem box |
| `ipms:PosInstall` | POS edge binary + Node POS app (CSS with POS modules) + hardware I/O config | Shop box, POS terminal |
| `ipms:ConnectorInstall` | Connector sidecar binary (ODBC/LDAP) + Node runtime | Enterprise edge |
| `ipms:TraySupervisorInstall` | Tray supervisor only (manages an existing server) | Desktop alongside server |
| `ipms:CombinedInstall` | Server + POS + tray supervisor (the typical shop box) | On-prem mini-PC |

The installer accepts a `--package-type` flag or auto-detects from the bundled manifest.
Each type maps to a SHACL shape (§3) that defines: required binaries, Node version range,
ports, service registration kind, config preset path, and post-install admin flow.

### 1.3 Install sequence (the 8 steps, ontology-driven)

Each step reads from the install-type SHACL shape to determine what to do.

**Step 1 — Pre-flight environment assessment**
- Detect OS (win/mac/linux) and architecture (x86_64/aarch64).
- Verify privileges (Administrator on Windows, `sudo`/root on Linux, admin on macOS).
- Check port availability from the shape's `ipms:requiredPort` list (default: 3000 for
  CSS, 443/80 if reverse-proxy, dedicated port for device mTLS).
- Report blocking vs warning conditions; never proceed silently on a blocking condition.

**Step 2 — Node.js 24 detection & provisioning**
- Execute `node -v` and parse. Accept `>=24.0.0 <25.0.0`.
- **If missing/outdated:** fetch official pre-compiled Node 24 binaries for the host
  OS+arch from `nodejs.org/dist/`. Verify SHA-256 checksum. Unpack into
  `<install-dir>/runtime/node/` (local isolation, not global).
- Set `NODE_PATH` environment for subsequent steps to point at the provisioned binary.
- Record the Node version in the install manifest for later verification.

**Step 3 — App & Rust helper deployment**
- Extract the CSS fork into `<install-dir>/app/`.
- **Rust helper placement:** for `ipms:PosInstall` and `ipms:CombinedInstall`, place the
  pre-compiled `pos-edge` binary at `<install-dir>/bin/pos-edge`. Verify SHA-256
  checksum. On Linux/macOS, `chmod +x`. For `ipms:TraySupervisorInstall`, place
  `tray-supervisor` binary.
- If distributing from source (dev path), verify `cargo` + `rustc` are present, then
  `cargo build --release` the relevant workspace member.

**Step 4 — Dependency resolution**
- Run `<install-dir>/runtime/node/bin/npm ci` in `<install-dir>/app/`.
- `ci` over `install` — deterministic from `package-lock.json`.
- If `smithy-admin` is bundled as a pre-built static asset, skip its build; otherwise
  `npm ci` + `npm run build` in `smithy-admin/` too.

**Step 5 — Configuration & cryptography bootstrap**
- Generate `<install-dir>/app/.env` from the install-type shape's `ipms:envTemplate`:
  - `BASE_URL` (from operator input or default `http://localhost:3000/`)
  - `CMS_CONTROL_TOKEN` — generate a cryptographically random ≥32-byte token
  - `CMS_CONFIG` — point at the shape's `ipms:configPreset` (e.g. `config/ipms/ipms.json`)
  - Storage path (`<install-dir>/data/`)
- Generate signing keys for Solid-OIDC (CSS's existing keygen, invoked via the Node
  binary).
- Initialize filesystem storage paths and set directory permissions.

**Step 6 — Rust helper integration & handshake**
- Inject the absolute path of the Rust helper into the Node app's config (via env or
  the IPMS config preset's `ipms:nativeEdgeBinary` field).
- Run a silent dry-run: the Node app spawns or communicates with the Rust helper.
  - For POS edge: Node POSTs a test job to the Rust binary's local IPC channel; the
    binary responds with a health check (no hardware I/O, just confirms IPC works).
  - For tray supervisor: the tray binary spawns the Node server and confirms it
    receives a 200 from the health endpoint.
- Fail closed if the handshake doesn't succeed — don't leave the operator with a
  broken IPC bridge.

**Step 7 — Service registration & persistence**
- **Linux:** generate a systemd unit file at
  `/etc/systemd/system/databox-ipms.service` (or `databox-pos.service` for POS). The
  unit `ExecStart` points at the Node binary + config preset. Enable and start.
- **Windows:** register via `sc create` or `node-windows` wrapper. Set `Start=auto`
  and `Restart=on-failure`.
- **macOS:** generate a `launchd` plist at
  `~/Library/LaunchAgents/org.databox.ipms.plist`.
- Poll the health-check endpoint (`GET /health` or the CSS root) until `200 OK` or
  timeout (30s default). Report success or dump the service logs on failure.

**Step 8 — Administrative provisioning & handoff**
- Launch the admin browser to the smithy-admin URL.
- Guide through: root WebID creation → primary pod provisioning → ACL establishment.
- Output final dashboard URLs, the generated control token (shown once, stored in
  `.env`), and the service status.
- Write an install manifest RDF resource (Turtle) to `<install-dir>/data/install-state.ttl`
  recording: install type, Node version, binary checksums, ports, service name, timestamp.
  This is the installer's own state — readable by the admin panel later.

### 1.4 Installer as a Rust workspace member

```
native/
  Cargo.toml          # workspace (add "installer")
  installer/
    Cargo.toml
    src/
      main.rs         # CLI entry, --package-type flag, orchestrates steps
      preflight.rs    # Step 1: OS/arch/privilege/port checks
      node.rs         # Step 2: Node 24 detection + provisioning
      deploy.rs       # Step 3: file extraction + Rust helper placement
      deps.rs         # Step 4: npm ci
      config.rs       # Step 5: .env + crypto + storage bootstrap
      handshake.rs    # Step 6: IPC dry-run
      service.rs      # Step 7: systemd/launchd/Windows Service
      handoff.rs      # Step 8: admin provisioning + install manifest
      shape.rs        # Reads install-type SHACL shapes to drive steps
  pos-edge/
  tray-supervisor/
```

### 1.5 Cross-platform binaries

The installer itself is distributed as a pre-compiled Rust binary:
- `installer-x86_64-pc-windows-msvc.exe`
- `installer-aarch64-apple-darwin`
- `installer-x86_64-unknown-linux-gnu`
- `installer-aarch64-unknown-linux-gnu`

Multi-arch build via `cargo build --release --target <triple>` in CI.

---

## 2. Workstream B — POS edge binary (Node launched from Rust, hardware I/O bridge)

### 2.1 Architecture

The POS edge binary is the **hardware I/O bridge** and the **process supervisor** for the
Node POS application. The Node app (CSS with IPMS + POS modules) handles the data plane
(carts, orders, receipts as RDF resources); the Rust binary handles the physical plane
(cash drawer, thermal printer, customer display).

```
┌─────────────────────────────────────────────────────┐
│  pos-edge binary (Rust)                              │
│                                                      │
│  ┌─────────────┐    ┌──────────────────────────┐    │
│  │  IPC server  │◄──┤  Hardware I/O            │    │
│  │  (JSON lines │    │  - ESC/POS printer       │    │
│  │   over stdin │    │  - Cash drawer kick      │    │
│  │   /stdout +  │    │  - QR rendering          │    │
│  │   HTTP :9100)│    │  - Customer display      │    │
│  └──────┬───────┘    └──────────────────────────┘    │
│         │                                            │
│         │ spawn + supervise                          │
│         ▼                                            │
│  ┌─────────────────────────────────────────┐        │
│  │  node ./bin/server.js                   │        │
│  │  -c config/ipms/pos.json                 │        │
│  │  (CSS + IPMS + POS modules)              │        │
│  │  data plane: RDF resources, LDP, WAC    │        │
│  └─────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────┘
```

### 2.2 IPC protocol

Two channels:

**Channel 1 — stdin/stdout JSON lines (lifecycle):**
- The Rust binary spawns Node and reads stdout for structured events:
  `{"type":"ready","port":3000}` — Node is up.
  `{"type":"error","message":"..."}` — Node failed to start.
  `{"type":"log","level":"info","message":"..."}` — forwarded logs.
- The Rust binary writes to Node's stdin for control:
  `{"cmd":"shutdown"}` — graceful shutdown.

**Channel 2 — HTTP on localhost:9100 (job bridge):**
- The Node IPMS posts POS device jobs (using the `NativePosDeviceContract` RDF shape) to
  the Rust binary's local HTTP endpoint.
- `POST /jobs` — enqueue a hardware job (cash drawer open, print receipt, display text).
  Body: the `NativePosDeviceJob` as JSON-LD.
- `GET /jobs/:id` — poll job status (`queued` → `claimed` → `completed` / `failed`).
- `GET /health` — hardware health check (printer connected, drawer present, display on).
- The Rust binary claims jobs, executes hardware I/O, and reports status back.

This mirrors the `NativePosDeviceContract.ts` job model exactly — the Rust binary is the
"native edge" runtime that the contract's `execution.tier: 'native-edge'` refers to.

### 2.3 POS edge binary structure

```
native/pos-edge/
  Cargo.toml          # add binary target, deps: serde, serde_json, tiny_http, n3
  src/
    lib.rs            # existing: pub mod qr; pub mod printer;
    main.rs           # NEW: binary entry — spawn Node, run IPC server
    ipc.rs            # stdin/stdout JSON lines protocol
    http.rs           # localhost:9100 job bridge HTTP server
    jobs.rs           # job queue: claim, execute, report status
    hardware/
      mod.rs          # hardware dispatcher: command → I/O driver
      drawer.rs       # cash drawer open (reuses printer.rs ESC p 0)
      printer_io.rs   # thermal printer: print text + QR raster (reuses printer.rs, qr.rs)
      display.rs      # customer display: text/total output (serial/USB display)
```

### 2.4 Config

The POS edge binary reads its config from env vars (set by the installer or the tray
supervisor):

- `POS_NODE_BINARY` — path to the Node binary (default: `node` on PATH, or the
  installer-provisioned path).
- `POS_NODE_CONFIG` — CSS config preset (default: `config/ipms/pos.json`).
- `POS_NODE_ARGS` — extra args for `node ./bin/server.js`.
- `POS_HTTP_PORT` — IPC HTTP port (default: 9100).
- `POS_PRINTER_DEVICE` — thermal printer device path (e.g. `/dev/usb/lp0`, `COM3:`).
- `POS_DISPLAY_DEVICE` — customer display device path (optional).
- `POS_CASH_DRAWER_VIA` — `printer` (kick via printer's ESC/POS) or `direct` (own device).

### 2.5 POS config preset

A new `config/ipms/pos.json` that layers on top of `config/ipms/ipms.json` and enables the
POS-specific modules:

```json
{
  "@import": "./ipms.json",
  "components": {
    "@graph": [
      {
        "@id": "urn:solid-server:default:PosEdgeConfig",
        "@type": "PosEdgeConfig",
        "posEdgeBinary": "${POS_EDGE_BINARY}",
        "posEdgeHttpPort": "${POS_HTTP_PORT:9100}",
        "posEdgePrinterDevice": "${POS_PRINTER_DEVICE}"
      }
    ]
  }
}
```

### 2.6 Relationship to the tray supervisor

The tray supervisor and the POS edge binary are **complementary, not overlapping**:

- **Tray supervisor** — manages the *CSS server* lifecycle (start/stop/restart), opens
  the admin browser, shows the customer display webview. No hardware I/O. For any
  install type that includes a server.
- **POS edge binary** — manages the *POS hardware* lifecycle + spawns the Node POS app.
  Does hardware I/O. Only for `ipms:PosInstall` and `ipms:CombinedInstall`.

For `ipms:CombinedInstall`, the POS edge binary spawns Node, and the tray supervisor
connects to the same Node process (or the tray supervisor spawns the POS edge binary,
which in turn spawns Node). The recommended chain:

```
tray-supervisor → pos-edge binary → node (CSS + IPMS + POS)
```

The tray supervisor is the user-facing process (tray icon, menu); the POS edge binary is
the hardware bridge. The tray supervisor can start/stop the POS edge binary, which
handles the Node lifecycle internally.

---

## 3. Workstream C — Install-type ontology + `ui#` adoption + solid-ui

### 3.1 Install-type ontology (SHACL shapes)

A new ontology file at `databox/ontologies/install-types.ttl` defining SHACL shapes for
each package type. These shapes are read by the installer (compiled in or loaded at
runtime) and are also published as Solid resources for admin-panel introspection.

**Vocabulary additions** to `IPMS` in `src/util/Vocabularies.ts`:

```typescript
export const IPMS = createVocabulary(
  'urn:solid-server:databox:ipms#',
  // Existing
  'Module', 'enabled', 'config',
  // Install types
  'InstallProfile', 'ServerInstall', 'PosInstall', 'ConnectorInstall',
  'TraySupervisorInstall', 'CombinedInstall',
  // Install profile properties
  'installType', 'requiredBinary', 'requiredNodeVersion', 'requiredPort',
  'configPreset', 'envTemplate', 'serviceName', 'nativeEdgeBinary',
  'nativeEdgeHttpPort', 'printerDevice', 'displayDevice',
  // Native edge (already used in NativePosDeviceContract but not in vocab)
  'NativePosDeviceDescriptor', 'NativePosDeviceJob', 'deviceKind', 'deviceWebId',
  'endpoint', 'endpointUrl', 'transport', 'tlsMode', 'mtlsDeviceWebId',
  'capability', 'roleConstraint', 'allowedRole', 'allowedAgent',
  'sessionMode', 'requireActiveSession', 'maxSessionAgeSeconds',
  'deviceId', 'command', 'status', 'createdAt', 'requestedBy',
  'operatorSession', 'sessionId', 'sessionWebId', 'roleIri',
  'startedAt', 'expiresAt', 'executionTier', 'noBrowserHardwareIo',
  'parameter', 'reason', 'registerId', 'pulseMs',
);
```

**SHACL shapes** (sketch — `install-types.ttl`):

```turtle
@prefix ipms: <urn:solid-server:databox:ipms#> .
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

ipms:ServerInstallShape a sh:NodeShape ;
  sh:targetClass ipms:ServerInstall ;
  sh:property [
    sh:path ipms:requiredNodeVersion ;
    sh:datatype xsd:string ;
    sh:hasValue ">=24.0.0 <25.0.0" ;
  ] ;
  sh:property [
    sh:path ipms:requiredPort ;
    sh:datatype xsd:integer ;
    sh:hasValue 3000 ;
  ] ;
  sh:property [
    sh:path ipms:configPreset ;
    sh:datatype xsd:string ;
    sh:hasValue "config/ipms/ipms.json" ;
  ] ;
  sh:property [
    sh:path ipms:serviceName ;
    sh:datatype xsd:string ;
    sh:hasValue "databox-ipms" ;
  ] .

ipms:PosInstallShape a sh:NodeShape ;
  sh:targetClass ipms:PosInstall ;
  sh:property [
    sh:path ipms:requiredBinary ;
    sh:hasValue "pos-edge" ;
  ] ;
  sh:property [
    sh:path ipms:configPreset ;
    sh:hasValue "config/ipms/pos.json" ;
  ] ;
  sh:property [
    sh:path ipms:nativeEdgeBinary ;
    sh:datatype xsd:string ;
  ] ;
  sh:property [
    sh:path ipms:nativeEdgeHttpPort ;
    sh:datatype xsd:integer ;
    sh:hasValue 9100 ;
  ] ;
  sh:property [
    sh:path ipms:printerDevice ;
    sh:datatype xsd:string ;
  ] .
```

### 3.2 W3C `ui#` vocabulary adoption

Add `UI` to `src/util/Vocabularies.ts`:

```typescript
export const UI = createVocabulary(
  'http://www.w3.org/ns/ui#',
  // Form parts
  'Form', 'Group', 'Single', 'Multiple', 'Choice', 'Options',
  'Boolean', 'TriState', 'Text', 'TextInput', 'TextArea',
  'Number', 'Integer', 'Decimal', 'Float', 'Date', 'DateTime', 'Time',
  'Color', 'Telephone', 'Email', 'Url',
  // Form properties
  'parts', 'part', 'label', 'comment', 'property',
  'subject', 'required', 'readOnly', 'hidden',
  'min', 'max', 'minLength', 'maxLength', 'pattern',
  'default', 'value', 'values', 'from',
  'autocomplete', 'placeholder',
  // Layout
  'heading', 'sequence', 'ordered', 'unordered',
);
```

### 3.3 Wiring `ui#` into module config shapes

The `SolidModuleManifest` interface already has `configShape?: string`. The plan is to:

1. **Define `ui#` shapes for each module's config** as Turtle resources in
   `databox/ontologies/module-config-shapes.ttl`.
2. **Point `configShape` at the shape IRI** in each module manifest.
3. **Build a React-native `ui#` form renderer** in smithy-admin that reads the shape and
   renders the appropriate form fields.

Example shape for the hosting module's config:

```turtle
@prefix ui: <http://www.w3.org/ns/ui#> .
@prefix ipms: <urn:solid-server:databox:ipms#> .
@prefix schema: <https://schema.org/> .

ipms:HostingConfigShape a ui:Form ;
  ui:parts (
    [ a ui:TextInput ;
      ui:label "Apex domain" ;
      ui:property schema:domainName ;
      ui:placeholder "acme.org" ;
      ui:required true ;
    ]
    [ a ui:TextInput ;
      ui:label "Databox subdomain" ;
      ui:property ipms:databoxSubdomain ;
      ui:default "databox" ;
    ]
    [ a ui:Boolean ;
      ui:label "Reserve www route" ;
      ui:property ipms:reserveWww ;
      ui:default true ;
    ]
    [ a ui:Choice ;
      ui:label "TLS mode" ;
      ui:property ipms:tlsMode ;
      ui:from ( "cloudflare-proxy" "direct" "tunnel" ) ;
      ui:required true ;
    ]
  ) .
```

### 3.4 React-native `ui#` form renderer (smithy-admin)

**Not embedding solid-ui.** The plan §2 already decided: "Adopt the `ui#` ontology…
reimplement React-native. Don't take the dep (DOM-oriented)." solid-ui is
`rdflib.js + plain-DOM widgets`; smithy-admin is `React/Refine + fetch`. Embedding
solid-ui would drag the entire DOM/rdflib runtime into the React app.

Instead, build a React component that reads a `ui#` shape (as Turtle or JSON-LD) and
renders the form using the existing smithy-admin UI primitives (Tailwind + Refine).

```
smithy-admin/src/components/
  ui-form/
    UiFormRenderer.tsx    # reads ui# shape, dispatches to field components
    fields/
      TextInput.tsx       # ui:TextInput
      TextArea.tsx        # ui:TextArea
      Boolean.tsx         # ui:Boolean
      Choice.tsx          # ui:Choice
      Number.tsx          # ui:Number / ui:Integer
      Date.tsx            # ui:Date / ui:DateTime
      Group.tsx           # ui:Group (nested form section)
    parseUiShape.ts       # parses Turtle/JSON-LD ui# shape into a form spec
    types.ts              # TypeScript types for the parsed form spec
```

The renderer:
1. Fetches the `configShape` IRI from the module manifest (via the IPMS control plane or
   direct Solid resource fetch).
2. Parses the `ui#` shape into a form spec (ordered parts, field types, properties,
   constraints).
3. Renders the form with Refine's `useForm` hook, binding each field to the
   corresponding RDF property.
4. On submit, serializes the form values back to Turtle and PUTs them to the module's
   config endpoint (`PUT /.databox/ipms/modules/:id`).

### 3.5 solid-ui integration (optional, later)

The plan §2 says "Optionally embed solid-ui form rendering later; not core now." This
plan keeps that stance: **the `ui#` ontology is adopted now; solid-ui embedding is
deferred.** The React-native renderer (§3.4) is the core path.

If solid-ui embedding is later wanted (e.g. for pod browsing in the admin panel), it
would be loaded in an **iframe** to isolate its DOM/rdflib runtime from the React app.
This is a separate decision, not part of this plan.

### 3.6 Ontological methods for categories

Each install category, module type, and hardware device kind is defined ontologically —
not just in TypeScript interfaces but as RDF classes with SHACL shapes. This means:

- **Install types** are `ipms:ServerInstall`, `ipms:PosInstall`, etc. — SHACL shapes
  define their requirements. The installer reads these shapes.
- **Module types** are `ipms:Module` with `configShape` pointing to `ui#` forms. The
  admin panel reads these shapes to render config UIs.
- **Device kinds** are `ipms:NativePosDeviceDescriptor` with `ipms:deviceKind` ranging
  over `cash-drawer`, `receipt-printer`, `customer-display`, `pos-terminal` (already
  defined in `NativePosDeviceContract.ts`).
- **Capability types** are `ipms:capability` values like `cash-drawer.open`,
  `receipt-printer.print-receipt` — already defined in `NATIVE_EDGE_POS_CAPABILITIES`.

The ontological chain: **install type → required modules → module config shapes (`ui#`)
→ device descriptors → capabilities → hardware I/O (Rust)**. Each link is RDF; the
runtime code (installer, IPMS, POS edge) interprets the RDF.

---

## 4. Files (create ✎ / modify ✏)

### Workstream A — Installer

- ✎ `native/installer/Cargo.toml` — new workspace member
- ✎ `native/installer/src/main.rs` — CLI entry, `--package-type` flag
- ✎ `native/installer/src/preflight.rs` — Step 1
- ✎ `native/installer/src/node.rs` — Step 2
- ✎ `native/installer/src/deploy.rs` — Step 3
- ✎ `native/installer/src/deps.rs` — Step 4
- ✎ `native/installer/src/config.rs` — Step 5
- ✎ `native/installer/src/handshake.rs` — Step 6
- ✎ `native/installer/src/service.rs` — Step 7
- ✎ `native/installer/src/handoff.rs` — Step 8
- ✎ `native/installer/src/shape.rs` — reads install-type SHACL shapes
- ✏ `native/Cargo.toml` — add `installer` to workspace members
- ✎ `databox/ontologies/install-types.ttl` — SHACL shapes for install categories

### Workstream B — POS edge binary

- ✎ `native/pos-edge/src/main.rs` — binary entry, spawns Node, runs IPC + HTTP
- ✎ `native/pos-edge/src/ipc.rs` — stdin/stdout JSON lines protocol
- ✎ `native/pos-edge/src/http.rs` — localhost:9100 job bridge
- ✎ `native/pos-edge/src/jobs.rs` — job queue: claim, execute, report
- ✎ `native/pos-edge/src/hardware/mod.rs` — hardware dispatcher
- ✎ `native/pos-edge/src/hardware/drawer.rs` — cash drawer I/O
- ✎ `native/pos-edge/src/hardware/printer_io.rs` — printer I/O (reuses printer.rs + qr.rs)
- ✎ `native/pos-edge/src/hardware/display.rs` — customer display I/O
- ✏ `native/pos-edge/Cargo.toml` — add binary target, deps: `serde`, `serde_json`,
  `tiny_http` (or `axum`), `n3` (or parse JSON-LD from Node instead)
- ✎ `config/ipms/pos.json` — POS config preset (layers on `ipms.json`)
- ✏ `native/tray-supervisor/src/main.rs` — option to spawn `pos-edge` instead of
  `node` directly (for `ipms:CombinedInstall` chain)

### Workstream C — Ontology + ui# + solid-ui

- ✏ `src/util/Vocabularies.ts` — extend `IPMS` with install-type + native-edge terms;
  add `UI` vocabulary
- ✎ `databox/ontologies/module-config-shapes.ttl` — `ui#` shapes for module configs
- ✎ `smithy-admin/src/components/ui-form/UiFormRenderer.tsx` — React `ui#` renderer
- ✎ `smithy-admin/src/components/ui-form/parseUiShape.ts` — shape parser
- ✎ `smithy-admin/src/components/ui-form/types.ts` — form spec types
- ✎ `smithy-admin/src/components/ui-form/fields/*.tsx` — field components
- ✏ `smithy-admin/src/pages/modules/index.tsx` — render config form via `UiFormRenderer`
  when `configShape` is present

---

## 5. Phasing (dependency-ordered)

### Phase 1 — Ontology foundations (sequential, first)

Extends the existing `IPMS` vocabulary. Defines install-type SHACL shapes. Adds `UI`
vocabulary. No runtime code yet — just the ontological layer.

- ✏ `src/util/Vocabularies.ts` — extend `IPMS`, add `UI`
- ✎ `databox/ontologies/install-types.ttl`
- ✎ `databox/ontologies/module-config-shapes.ttl` (hosting module first)
- ✎ Unit tests: vocabulary terms resolve, SHACL shapes validate against sample data

**Deliverable:** the ontological layer that the installer and form renderer will read.

### Phase 2 — POS edge binary (parallel with Phase 3)

Turns `pos-edge` from a library into a binary. Adds IPC, HTTP job bridge, hardware
dispatcher. Creates the POS config preset.

- ✎ `native/pos-edge/src/main.rs` + IPC + HTTP + jobs + hardware modules
- ✏ `native/pos-edge/Cargo.toml`
- ✎ `config/ipms/pos.json`
- ✏ `native/tray-supervisor/src/main.rs` — option to spawn `pos-edge`
- ✎ Rust tests: IPC protocol, job queue, hardware dispatch (mocked devices)
- ✎ Integration test: Node posts a job → Rust binary executes → status reported

**Deliverable:** a running POS edge binary that spawns Node and bridges hardware I/O.

### Phase 3 — ui# form renderer (parallel with Phase 2)

Builds the React-native `ui#` renderer in smithy-admin. Reads shapes, renders forms,
serializes back to Turtle.

- ✎ `smithy-admin/src/components/ui-form/` — renderer + fields + parser
- ✏ `smithy-admin/src/pages/modules/index.tsx` — wire in renderer
- ✎ smithy-admin tests: shape parsing, field rendering, form submission

**Deliverable:** module config forms rendered from `ui#` shapes in the admin panel.

### Phase 4 — Installer (sequential, after Phases 2-3)

Builds the installer binary. Reads install-type shapes. Implements the 8-step sequence.

- ✎ `native/installer/` — all modules
- ✏ `native/Cargo.toml`
- ✎ Rust tests: each step with mocked environment
- ✎ Integration test: full install on a clean VM/container

**Deliverable:** a single-binary installer that provisions Node, deploys the app +
Rust helpers, registers services, and hands off to the admin panel.

### Phase 5 — Polish & cross-cutting

- CI: multi-arch builds for installer + pos-edge + tray-supervisor
- Documentation: operator install guide
- The tray supervisor gets a "Check for Updates" menu item that calls the installer in
  update mode
- End-to-end test: `ipms:CombinedInstall` on win64 + linux → server + POS + tray running

---

## 6. Verification

Prefix every node/npm cmd with `export PATH="/c/nvm4w/nodejs:$PATH"`; Jest scoped,
`--maxWorkers=2`; `rm -f .eslintcache` before lint.

1. **Vocabulary + ontology (Phase 1):**
   `npx jest test/unit/util/Vocabularies --maxWorkers=2` — IPMS and UI terms resolve.
   SHACL shapes validate against sample install profiles and module configs.

2. **POS edge binary (Phase 2):**
   `cargo test -p pos-edge` — IPC, job queue, hardware dispatch (mocked).
   Manual: run `pos-edge` binary → it spawns Node → POST a cash-drawer job to
   `localhost:9100/jobs` → drawer kicks (or mocked confirmation).

3. **ui# form renderer (Phase 3):**
   `cd smithy-admin && npm run build && npm run lint` — green.
   Manual: open modules page → hosting module config → `ui#` form renders → submit →
   config persists as Turtle.

4. **Installer (Phase 4):**
   `cargo test -p installer` — each step with mocked environment.
   Manual: run installer with `--package-type ipms:CombinedInstall` on a clean
   environment → server + POS + tray running, health check 200 OK.

5. **Gate:** `npm run build` + `npm run lint` + `npx tsc --noEmit` + `cargo build
   --release` + `cargo test` all green on Node 24.18.0.

6. **Basic profile untouched:** `config/default.json` still boots a vanilla Solid server
   with no IPMS, no POS, no installer artifacts.

---

## 7. Open decisions

1. **IPC protocol for POS edge:** stdin/stdout JSON lines + HTTP on localhost:9100, or
   a single Unix domain socket / named pipe? The split (lifecycle via stdio, jobs via
   HTTP) is simpler but two channels. **⟵ your call**
2. **Installer language:** Rust (this plan's recommendation, consistent with the native
   stack) vs a Node script that bootstraps itself? Rust is better for the "install Node
   without having Node" problem. **⟵ confirm**
3. **`ui#` vs SHACL vs both:** the plan §3 says `ui#` for presentation, SHACL for
   validation. This plan adopts both — `ui#` for form shapes, SHACL for install-type
   validation. **⟵ confirm**
4. **solid-ui embedding:** this plan defers it (React-native renderer instead). If you
   want solid-ui in an iframe for pod browsing, that's a separate decision. **⟵**
5. **POS edge HTTP server crate:** `tiny_http` (minimal, no async) vs `axum` (async,
   tokio). `tiny_http` is lighter for a localhost-only bridge; `axum` is more
   future-proof if the POS edge grows. **⟵**
6. **Tray supervisor → POS edge chain:** tray spawns pos-edge which spawns Node, or
   tray spawns Node directly and pos-edge runs separately? The chain
   (tray → pos-edge → node) is cleaner for lifecycle but adds a process layer. **⟵**
7. **Install manifest format:** Turtle (`install-state.ttl`) vs JSON-LD. Turtle is
   consistent with the IPMS's RDF-everywhere stance; JSON-LD is easier for the admin
   panel to consume. **⟵**
8. **Node provisioning source:** official `nodejs.org/dist/` binaries (this plan) vs
   a bundled Node runtime in the installer package. Bundling is larger but offline-capable. **⟵**

---

## 8. Relationship to `solid-ipms-plan.md`

This plan implements three sections of `solid-ipms-plan.md` that are currently unimplemented
or only partially implemented:

- **§1.2** (Install harness — desktop supervisor): the tray supervisor exists; the
  installer does not. This plan builds it.
- **§3** (Ontology — adopt `ui#`): not adopted. This plan adopts it.
- **§10.2** (Device identity — Rust/native POS edge): the data contract exists
  (`NativePosDeviceContract.ts`); the runtime does not. This plan builds the POS edge
  binary.
- **§10.4** (POS): the IPMS modules exist; the native hardware bridge does not. This plan
  builds it.

The "Still required" list in `solid-ipms-plan.md` §0 includes:
> "Build the Rust/native or WASM POS edge package for actual mTLS/WebID-TLS device
> verification, thermal printer and cash drawer I/O, QR bitmap rendering, offline
> replay, and audit receipt transport."

This plan addresses the **thermal printer, cash drawer I/O, and QR bitmap rendering**
parts. mTLS/WebID-TLS device verification, offline replay, and audit receipt transport
are separate follow-on workstreams that build on the POS edge binary created here.
