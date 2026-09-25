# Agent brief — Qualia leave/migrate on Solid-Databox

**Audience:** agent working in `C:\Projects\Solid-Databox-webcivics`  
**Upstream Qualia:** `C:\Projects\qualia-27062026`  
**Status (2026-09-25):** Qualia side done and pinned; Databox wiring stubs exist — finish HTTP routes, UI choice, and licensed wasm load.

**Update:** license boundary landed — the engine binary is under a **proprietary field-of-use freeware license** (`src/databox/modules/qualia/QUALIA-WEBCIVICS-LICENSE.txt` — names `qualia_webcivics_bg.wasm`/`qualia.js`, SHA-256 pin `68987faa…2ad`, release 0.0.39, authorized ecosystem = Web Civics Databox); the bridge source is **CC BY-NC-ND 4.0** (module `LICENSE.md`); both carved out of repo MIT (root `LICENSE.md` §License exception). `QualiaEngineLoader.loadQualiaEngine(packageDir)` performs the licensed load — reads the pinned wasm, verifies the SHA-256, checks required exports + `solid-leave-migrate`/`solid-qualia-return` capabilities, fail-closed on any mismatch. Sanctuary-gate + digest-pin tests in `test/unit/databox/modules/QualiaBridge.test.ts`. Remaining: the HTTP routes (`POST /qualia/import`, `GET /qualia/export`) + sanctuary-choice UI.

---

## 1. Purpose

People leaving **Webizen Desktop / QualiaDB** must be able to take their data into this Solid server, and later export from Solid back into Qualia.

| Fact | Implication |
|------|-------------|
| Solid stores **RDF** (Turtle / JSON-LD / N-Quads) | **Not** 48-byte Quins on disk |
| Qualia stores **Quins** (+ Q42) | Leave path **projects** Quins → RDF |
| Sanctuary / restricted / bilateral data | Must **not** silently become open RDF |
| `wasm-webcivics` | Licensed Qualia module — **do not** copy under Databox MIT as if free |

---

## 2. Do not do

1. **Do not** vendor `qualia_webcivics_bg.wasm` into this repo’s MIT tree as first-party MIT code. Load it as a **separately licensed** dependency (path dep, private npm, or runtime path to Qualia’s pin).
2. **Do not** store Quins as the durable Pod representation. Pod = LDP RDF Sources + ACLs.
3. **Do not** auto-grant `foaf:Agent` public Read on import.
4. **Do not** export sanctuary data without an explicit user choice (see §4).
5. **Do not** claim classified data was exported — classified **never** leaves Qualia, period.

---

## 3. Pinned wasm-webcivics (load this)

| Field | Value |
|-------|--------|
| Path | `C:/Projects/qualia-27062026/docs/pkg/webcivics/` |
| WASM | `qualia_webcivics_bg.wasm` |
| JS | `qualia.js` |
| SHA-256 | `68987faa5d53dc3c66f3a82e4adfc2cb9953faeeff027e087648b0a6c57ec2ad` |
| Raw / gzip | 3,072,294 / 1,055,238 |
| Cargo feature | `wasm-webcivics` (no `gpu-runtime`) |
| Digest doc | `C:/Projects/qualia-27062026/docs/releases/0.0.39-wasm-digests.md` |
| Agent API | `C:/Projects/qualia-27062026/docs/manuals/wasm-webcivics-agent-api.md` §4.5 |
| Plan | `C:/Projects/qualia-27062026/docs/plans/qualia-solid-leave-migrate.md` |

**Node load sketch:**

```js
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const PKG = 'C:/Projects/qualia-27062026/docs/pkg/webcivics';
const wasmBytes = readFileSync(`${PKG}/qualia_webcivics_bg.wasm`);
const sha = createHash('sha256').update(wasmBytes).digest('hex');
if (sha !== '68987faa5d53dc3c66f3a82e4adfc2cb9953faeeff027e087648b0a6c57ec2ad') {
  throw new Error(`wasm-webcivics digest mismatch: ${sha}`);
}
const mod = await import(pathToFileURL(`${PKG}/qualia.js`).href);
mod.initSync({ module: wasmBytes });
// mod.plan_sanctuary_migration_wasm / export_solid_migration_wasm / import_solid_to_qualia_backup_wasm
```

Verify exports exist: `plan_sanctuary_migration_wasm`, `export_solid_migration_wasm`, `import_solid_to_qualia_backup_wasm`.  
Capabilities must include `solid-leave-migrate` and `solid-qualia-return` (`list_capabilities_wasm()`).

---

## 4. Sanctuary choice (mandatory UX)

Before any Qualia → Solid write, call:

```js
const notice = wasm.plan_sanctuary_migration_wasm({ quins });
```

If `notice.requires_choice === true`, **block** import until the user picks one of:

| Choice string | Meaning |
|---------------|---------|
| `omit-sanctuary` | Leave sanctuary/restricted/bilateral data behind; export only what Solid can hold without reclassification |
| `reclassify-for-solid` | Owner accepts changing permission structures so that data may leave as RDF under their control |

Use UI copy from the notice object:

- `notice.title`
- `notice.body`
- `notice.choice_omit_label`
- `notice.choice_reclassify_label`
- `notice.classified_note` (always show)

If choice is missing while sanctuary is present, Qualia returns  
`SANCTUARY_CHOICE_REQUIRED` — treat as **400** with the notice body, not a silent omit.

---

## 5. Direction A — Qualia → Solid (import)

### 5.1 Inputs you will receive

1. **Leave bundle directory** (from Desktop/CLI):  
   `data.ttl`, `data.nq`, `data.jsonld`, `data.ttl.acl`, `manifest.jsonld`, `SANCTUARY_NOTICE.txt`
2. **Or** `webcivics.vault-backup.v1` JSON (`application/vnd.web-civics.vault-backup+json`) plus host-parsed **quins** for the wasm export path
3. **Or** raw quin wire from a Qualia client + sanctuary choice

### 5.2 Preferred flow (wasm on Node)

Already stubbed in this repo:

| File | Role |
|------|------|
| `src/databox/modules/qualia/SolidMigrationImport.ts` | LDP PUT of leave bundle |
| `src/databox/modules/qualia/QualiaSolidBridge.ts` | Sanctuary-gated import + return export |
| `src/databox/modules/qualia/index.ts` | Re-exports |

```ts
import {
  importQualiaQuinsToSolid,
  importQualiaBackupFileToSolid,
} from '../../src/databox/modules/qualia';

// 1) Show notice; collect sanctuaryChoice if requires_choice
const result = await importQualiaQuinsToSolid({
  wasm,
  quins,                          // from Qualia client or backup lowering
  sanctuaryChoice: 'omit-sanctuary', // or 'reclassify-for-solid'
  containerUrl: 'https://pod.example/qualia-import/2026-09-25/',
  fetch,
  authorization: `Bearer ${token}`,
  ownerWebid: 'https://me.example/profile/card#me',
});
if (result.blocked) {
  // return notice to UI — do not PUT
}
```

If `result.blocked`, respond with the notice and wait. Do not invent a default choice.

### 5.3 LDP layout after import

Under a dedicated container (example):

```text
/qualia-import/<timestamp>/
  data.ttl
  data.nq
  data.jsonld
  data.ttl.acl
  manifest.jsonld
```

Content-Types: `text/turtle`, `application/n-quads`, `application/ld+json`.  
ACL: owner Read/Write/Control only unless the leave bundle explicitly set public Read (default: no).

### 5.4 Your work remaining

1. HTTP routes (IPMS or CSS custom): e.g. `POST /qualia/import` (multipart backup or JSON leave bundle + choice).
2. Auth: only the Pod owner / Databox connection principal.
3. Call `QualiaSolidBridge` after loading wasm (§3).
4. Persist under an LDP container; return container URL + `outcome_summary`.
5. Unit/integration test: omit vs reclassify; classified never appears; digest pin check.

---

## 6. Direction B — Solid → Qualia (export)

Owner wants data back in Qualia / Webizen Desktop / PWA restore.

```ts
import { exportSolidResourcesToQualiaBackup } from '../../src/databox/modules/qualia';

const turtle = await (await fetch(containerUrl + 'data.ttl', { headers })).text();
const { backup_json } = exportSolidResourcesToQualiaBackup({
  wasm,
  resources: [
    { name: 'data.ttl', content_type: 'text/turtle', body: turtle },
    // optionally data.nq, data.jsonld
  ],
});
// Respond with Content-Type: application/vnd.web-civics.vault-backup+json
// Desktop/PWA: restoreBackup(backup_json)
```

### Your work remaining

1. Route e.g. `GET /qualia/export?container=…` or `POST /qualia/export` with resource list.
2. LDP GET the RDF Sources the owner selected.
3. Run `import_solid_to_qualia_backup_wasm` via the bridge.
4. Return the vault-backup JSON download.

Schema must remain `webcivics.vault-backup.v1` so Qualia restore accepts it.

---

## 7. wasm API cheat sheet

| Export | Role |
|--------|------|
| `plan_sanctuary_migration_wasm({ quins })` | Pre-flight notice + `requires_choice` |
| `export_solid_migration_wasm({ quins, sanctuary_choice, owner_webid? })` | Build leave bundle (turtle/nq/jsonld/acl/manifest) |
| `import_solid_to_qualia_backup_wasm({ resources })` | Solid RDF → Qualia backup JSON |
| `serialize_rdf_wasm` / `parse_rdf_document_wasm` | Ad-hoc RDF ↔ quins |
| `solid_negotiate_accept_wasm` | Solid `Accept` negotiation |

`sanctuary_choice` values: `omit-sanctuary` | `reclassify-for-solid` | `unset` (fails if sanctuary present).

---

## 8. Acceptance checklist

- [ ] wasm loaded from Qualia pin; SHA-256 matches §3  
- [ ] wasm **not** re-licensed as MIT inside this tree  
- [ ] Import UI shows sanctuary notice when `requires_choice`  
- [ ] Import refused without choice when sanctuary present  
- [ ] LDP resources are RDF only (ttl/nq/jsonld + acl + manifest)  
- [ ] No public ACL by default  
- [ ] Export returns `webcivics.vault-backup.v1` downloadable package  
- [ ] Tests for omit, reclassify, and digest mismatch fail-closed  
- [ ] Handoff note in `databox/devdocs/handoffs/` updated when routes land  

---

## 9. Related reading (Qualia)

| Doc | Path |
|-----|------|
| Leave/migrate plan | `C:/Projects/qualia-27062026/docs/plans/qualia-solid-leave-migrate.md` |
| Full wasm-webcivics functionality catalogue | `C:/Projects/qualia-27062026/docs/manuals/wasm-webcivics-functionality.md` |
| Agent API §4.5 | `C:/Projects/qualia-27062026/docs/manuals/wasm-webcivics-agent-api.md` |
| Digests | `C:/Projects/qualia-27062026/docs/releases/0.0.39-wasm-digests.md` |
| Node fixture (behaviour reference) | `C:/Projects/qualia-27062026/docs/tests/webcivics-solid-rdf.test.mjs` |
| Civics profile pin | `C:/Projects/civics.au/data/web-civics-profile/profile.json` |

---

## 10. One-paragraph summary for the ticket

> Wire Solid-Databox to Qualia’s pinned `wasm-webcivics` as a separately licensed module. On Qualia→Solid import, run `plan_sanctuary_migration_wasm`, force the user to choose omit-sanctuary or reclassify-for-solid when required, then LDP-PUT the leave bundle via `QualiaSolidBridge`. On Solid→Qualia export, LDP-GET RDF and return `import_solid_to_qualia_backup_wasm` as a `webcivics.vault-backup.v1` file. Never store Quins as Pod state; never MIT-relicense the WASM; never export classified data.
