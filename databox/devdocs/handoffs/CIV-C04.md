# CIV-C04 handoff — Re-run 5 previously-failing integration suites

## Status

accepted — all five suites pass. The July failures were an environment artifact (Node 22
shadowing the required Node 24 toolchain), not a code regression.

## Result

```powershell
npx jest test/integration/Identity.test.ts test/integration/WebSocketChannel2023.test.ts \
  test/integration/WebhookChannel2023.test.ts test/integration/LdpHandlerWithoutAuth.test.ts \
  test/integration/V6Migration.test.ts --runInBand --coverage=false
```

| Suite | Result | Time |
|---|---|---|
| Identity | PASS | 78.6 s |
| WebSocketChannel2023 | PASS | 41.1 s |
| WebhookChannel2023 | PASS | 37.1 s |
| LdpHandlerWithoutAuth | PASS | 95.7 s |
| V6Migration | PASS | 20.7 s |

140 tests, 0 failures, `--runInBand`.

## Environment note (recorded for all future runs)

This machine has **two Node toolchains**: a bundled `hermes` Node v22.23.2 at
`AppData\Local\hermes\node` that shadows nvm in PATH, and the nvm-managed Node **v24.18.0**
at `C:\nvm4w\nodejs` matching `package.json` engines (`>=24.0`). Anything run under v22 gets
spurious engine warnings and behavioural drift — the July integration failures are consistent
with that. Before any verification run:

```powershell
export PATH="/c/nvm4w/nodejs:$PATH"   # Git Bash
# or prepend C:\nvm4w\nodejs to PATH in PowerShell
```

Shell `export` does not persist between tool invocations on this setup — the PATH prefix must
be applied per command. A permanent machine-level fix (removing the shadowing shim or reordering
user PATH) is the owner's call, same as the stale `C:\Program Files\nodejs` v26 noted in
`dependency-upgrade-plan.md`.

## Notes

- Also verified this session under Node 24: `npm ci` (1603 pkgs, patches applied),
  `npm run build`, `npm run lint`, full `test/unit` — **536 suites / 4146 tests, all pass**.
