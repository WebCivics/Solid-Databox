# CIV-C03 handoff — Verify P0 installer claims landed in code

## Status

accepted — all seven claims verified against current source. No code changes required.

## What was verified

`databox/devdocs/gap-analysis.md` §4 lists installer items whose completion was claimed in
`swarm-progress.md`. Each was checked against the actual code:

| Claim | Verdict | Evidence |
|---|---|---|
| P0-01 CSPRNG for `CMS_CONTROL_TOKEN` | landed | `native/installer/src/config.rs:47-52` — `rand::rng().fill_bytes()` over a 32-byte buffer, hex-encoded |
| P0-02 real Node.js runtime download (platform tarball, no placeholder) | landed | `native/installer/src/node.rs` — `reqwest::blocking::get` (L56), `SHASUMS256.txt` verification (L38-41, L61-66), zip/tar.xz extraction per platform (L67-82), version compatibility gate `v24.*` (L24) |
| P0-03 real app payload extraction (not scaffold) | landed | `native/installer/src/deploy.rs` — copies `bin/config/dist/templates/patches/smithy-admin` (L22-25), helper binaries with SHA-256 integrity check (L40-42), payload manifest platform/arch validation (L60-82) |
| P0-04 crypto/key bootstrap | landed | `native/installer/src/config.rs:41-43` — RSA-2048 keypair generated via the provisioned Node binary; `keys/` dir gets `0o700` on unix (L11-15) |
| P0-05 Windows admin check | landed | `native/installer/src/preflight.rs:47-61` — `net session` on Windows; warns but does not hard-fail when unelevated |
| P0-06 `chrono` timestamps (no `"now"` placeholders) | landed | `native/installer/src/handoff.rs:6` — `Utc::now()` formatted into `install-state.ttl` |
| P0-07 `ConnectorSidecar` runs without `require.main` (ESM-safe) | landed | `src/databox/ipms/sidecars/ConnectorSidecar.ts:73` — `process.argv[1]?.endsWith('ConnectorSidecar')`, works under both module systems |

## Decisions / notes

- Nothing was missing: the "P0 items claimed complete" entry in `swarm-progress.md` is accurate.
- The progress tracker's own caveat stands: these are source-verified, not yet exercised in a
  packaged-installer end-to-end run (that is CIV-C15 territory for the POS edge, and install-flow
  e2e is not separately tracked — note it when the installer wave opens).
- During CIV-C01 the stale eslint path `src/databox/cms/sidecars/ConnectorSidecar.ts` was corrected
  to the `ipms` path; the file's now-redundant inline `eslint-disable` was removed.

## Commands run

Source inspection only (files listed above). No test run required for a read-verification item;
suite state is covered by the CIV-C01/C02 gate runs.
