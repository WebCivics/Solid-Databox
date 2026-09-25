# License — QualiaDB integration boundary

**This directory (`src/databox/modules/qualia/`) is NOT covered by the repository's
MIT license.** Two instruments apply here:

## 1. The QualiaDB engine binary — proprietary field-of-use license

The compiled `wasm-webcivics` / QualiaDB WebAssembly artifact
(`qualia_webcivics_bg.wasm` + `qualia.js`) is licensed under
[`QUALIA-WEBCIVICS-LICENSE.txt`](QUALIA-WEBCIVICS-LICENSE.txt) — a proprietary
freeware license that:

- names the specific artifact and pins it by **SHA-256 digest**
  (`68987faa5d53dc3c66f3a82e4adfc2cb9953faeeff027e087648b0a6c57ec2ad`, release
  series 0.0.39);
- restricts use to the **Authorized Ecosystem** — the Web Civics Databox — as the
  optional engine / leave-migrate integration loaded by this module;
- prohibits standalone use, extraction, reverse-engineering, and redistribution
  outside a legitimate Web Civics Databox deployment.

The binary is **loaded at runtime** and digest-verified (see
[`QualiaEngineLoader.ts`](QualiaEngineLoader.ts)) — it is **never vendored into
this tree**. A copy of the binary license must accompany the artifact wherever it
is distributed (alongside the `.wasm` in the Qualia release package).

## 2. The bridge source code in this directory — CC BY-NC-ND 4.0

The TypeScript source in this directory (`QualiaSolidBridge.ts`,
`SolidMigrationImport.ts`, `QualiaEngineLoader.ts`, `index.ts`) — the code that
interfaces with the licensed engine, enforces the sanctuary-choice gate, and pins
the digest — is:

Copyright (c) 2026 Timothy Charles Holborn
<https://www.linkedin.com/in/ubiquitous/> · <timothy.holborn@gmail.com>

licensed under **Creative Commons Attribution-NonCommercial-NoDerivatives 4.0
International (CC BY-NC-ND 4.0)** — NOT the MIT license that governs the rest of
this repository. Full legal text:
<https://creativecommons.org/licenses/by-nc-nd/4.0/legalcode>

## Why two instruments

The *engine* is a closed binary whose license binds the artifact itself — the
field-of-use license names the digest-pinned artifact and the application it may
serve. The *bridge source* is kept non-commercial/no-derivatives so the
integration boundary stays clean end-to-end and neither half can be lifted into a
competing product as if it were free MIT code.

The rest of the repository remains under `LICENSE.md` (MIT). This module is
strictly optional — the Databox builds, runs, and passes its full suite without
it — and no MIT-licensed code in this repository depends on this directory.

## Commercial use

Under CC BY-NC-ND 4.0 the bridge source may be shared **with attribution** but not
used commercially or distributed in modified form. For commercial licensing,
derivatives, or embedding, contact the copyright holder.
