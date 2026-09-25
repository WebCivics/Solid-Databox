# CIV-C06 handoff — Service registration (Windows/systemd/launchd)

## Status

accepted — gap-analysis's "launchd-only" claim was stale: desktop (tray) installs already
registered per-user startup on all three OSes. The real gap was headless/server installs —
now implemented.

## What changed

`native/installer/src/service.rs` restructured into two paths:

- `register_tray_startup` (existing behaviour, unchanged): per-user startup for tray installs —
  Windows `HKCU\...\Run` registry entry, Linux `~/.config/autostart` desktop entry, macOS via the
  signed bundle.
- `register_server_service` (**new**, for `!includes_tray()` installs — previously a no-op):
  - **Windows:** `schtasks /create /tn Databox /sc ONLOGON /tr "<node> <server.js> -c <preset>"`
    — per-user task, survives reboot, no elevation required.
  - **Linux:** `~/.config/systemd/user/databox.service` unit (`WorkingDirectory=app`,
    `ExecStart=node bin/server.js -c <preset>`, `Restart=on-failure`,
    `WantedBy=default.target`) + `systemctl --user daemon-reload`/`enable`; degrades to a clear
    message when no user systemd session exists.
  - **macOS:** `~/Library/LaunchAgents/ai.databox.server.plist` (`RunAtLoad`, `KeepAlive`) +
    `launchctl load -w`.
  - Both preconditions fail closed with repair guidance: missing private Node runtime, missing
    `bin/server.js`.

Test: `server_service_requires_the_node_runtime` asserts fail-closed when the runtime is absent.

## Decisions

- **Per-user, not system services.** `sc create`/system-level units need elevation and are the
  wrong fit for a person's own databox; the existing comment already records this reasoning for
  desktop editions and it applies equally to a personal server. The Linux path prints an honest
  note that `loginctl enable-linger` (start without login) needs root — recorded, not silently
  attempted.
- Server installs run `node bin/server.js -c <preset>` — the same entry the pos-edge supervisor
  uses (`native/pos-edge/src/main.rs:76-78`).

## Commands run

```powershell
cargo test --manifest-path native/Cargo.toml   # all pass (incl. new service test)
```

## Residual / notes

- Registration correctness is verified in code and by the fail-closed test; an actual
  reboot-survival check is inherently manual (marked in the plan gate as a runtime exercise).
- Personal-profile installs (CIV-A01+) use this same path — a local personal databox is a
  headless server install.
