# CIV-C05 handoff — Rust open items (drawer, warnings, fullscreen, tests, IPC)

## Status

accepted — 36 tests green across the `native/` workspace, zero warnings. One item (P7-09)
superseded by refactor; the fullscreen-display surface belongs to CIV-C16.

## What changed

### P7-07 — direct cash-drawer mode (was a silent `Ok(())`)

`native/pos-edge/src/hardware/drawer.rs` rewritten:

- `"printer"` mode: unchanged (kick bytes through the printer device, fails closed when no
  printer is configured).
- `"direct"` mode: now real. `POS_CASH_DRAWER_DEVICE` env var →
  `HardwareConfig.drawer_device` → ESC/POS kick bytes written to the drawer's own device node.
  Missing device fails closed with `NotFound` naming the required env var. Unknown modes
  rejected `InvalidInput`. No silent `Ok` remains on any path.
- `native/pos-edge/src/hardware/mod.rs`: `HardwareConfig.drawer_device` added; dispatch passes
  both device options.
- `native/pos-edge/src/main.rs`: reads `POS_CASH_DRAWER_DEVICE`.

### P7-08 — unused imports

Already resolved by the hardware refactor (`http.rs`/`ipc.rs`/`jobs.rs`/`hardware/` split);
`cargo build` reports zero warnings on both crates — verified, nothing to fix.

### P7-09 — fullscreen display

Superseded: `display.rs` referenced by the gap-analysis no longer exists in that form. Current
`hardware/display.rs` is a pole-display device driver doing real device I/O — a different
concern. The fullscreen customer-facing display app is the CIV-C16 surface (live display via
Solid notifications); not re-scoped here.

### P9-03/04/05 — tests

New `#[cfg(test)]` coverage:

| File | Tests added |
|---|---|
| `native/pos-edge/src/hardware/drawer.rs` | 4 — fail-closed device checks for both modes, real kick-byte write to a device file, unknown-mode rejection |
| `native/pos-edge/src/hardware/mod.rs` | 4 — unknown command, fail-closed per hardware command without a device, malformed input rejected (not panicked), PCI-scoped terminal commands queue without I/O |
| `native/pos-edge/src/jobs.rs` | 5 — FIFO claim order, no double-claim, cancel-only-queued, terminal states + error, cancelled skipped |
| `native/pos-edge/src/ipc.rs` | 5 — ready/error event parsing, malformed-line rejection, shutdown byte format, **lifecycle-loop smoke test: spawns a real child process emitting JSON lifecycle events and proves the loop reads to clean exit** (the P9-05 IPC integration test; uses Node when present, skips gracefully otherwise) |
| `native/installer/src/shape.rs` | 5 — product→preset/binaries mapping for all 5 types, unknown type fail-closed, config override, derived paths, exe suffix |
| `native/installer/src/node.rs` | 1 — `compatible()` accepts only `v24.*` |
| `native/installer/src/preflight.rs` | 3 — OS/arch detection, occupied port → unavailable, free port → available |
| `native/installer/src/config.rs` | 1 — token is 64 hex chars, unique per call |
| `native/installer/src/deploy.rs` | 5 — platform/arch values, foreign manifest rejected, current manifest accepted, unparseable manifest rejected, SHA-256 known digest |

## Commands run

```powershell
cargo test --manifest-path native/Cargo.toml   # workspace: 16 + 2 + 18 = 36 tests, all pass
cargo build --manifest-path native/pos-edge/Cargo.toml   # zero warnings
cargo build --manifest-path native/installer/Cargo.toml  # zero warnings
```

## Residual / notes

- `rust/` holds a separate newer crate generation (`connector-sidecar`, `pos-edge-proxy`,
  `tray-supervisor`, edition 2024). Found broken during this session and repaired in-flight:
  `odbc_mapper.rs` updated to the `odbc-api` 29 signatures (`ConnectionOptions::default()`,
  three-arg `execute`), a dead `use std::env` removed; `pos-edge-proxy` gained its missing
  `bytes`/`http-body-util` deps and a dead `Arc` import; `rust/tray-supervisor`'s five
  unused-code warnings cleaned (icon handle kept alive as `_tray_icon`). All three now build
  warning-free; test targets compile (they have no tests — the P9-04-style coverage was added
  to `native/`, not these).
- The IPC smoke test exercises the real spawn→stdout→parse→exit path but not the HTTP bridge
  or a long-lived Node; a fuller end-to-end belongs to CIV-C15 (native POS edge package).
