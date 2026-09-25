# CIV-C01 handoff — Repo-root cleanup

## Status

accepted — 23 stray tracked files removed, tooling references repaired, all gates green.

## What changed

**Deleted** (all git-tracked; recoverable from history if ever needed):

- Demo/mockup HTML: `civics.html`, `cybertech.html`, `gourmet.html` (unreferenced static mockups)
- One-off scripts: `extract_payments.js`, `extract_pos.js`, `extract_pos2.js`, `extract_rest.js`,
  `extract_website2.js`, `extract_website3.js`, `extract_website4.js`, `rewrite_handler.js`,
  `rewrite_handler_safely.js`, `fix_api_types.js`, `check-deps.cjs`, `check-deps2.cjs`,
  `check-shacl.cjs`
- Editor backup: `CmsHttpHandler.orig.ts` (pre-IPMS-rename copy)
- Scratch files: `scratch-pos-routes.ts`, `scratch-utils.ts`
- Log artifacts: `test_output.log`, `test_output.txt`, `unit_test_output.log`
- Shell-accident file: `x.trim().replace('` (0-byte)

**`eslint.config.mjs`**: removed the deleted script files from the relaxed-rules `files` block;
fixed the stale path `src/databox/cms/sidecars/ConnectorSidecar.ts` →
`src/databox/ipms/sidecars/ConnectorSidecar.ts` (missed by the CMS→IPMS rename — the rule block
was silently matching nothing). Consequent fix: `ConnectorSidecar.ts`'s inline
`eslint-disable` became redundant under the activated block and was removed.

**`.gitignore`**: the file's tail was corrupt — three entries had been appended as UTF-16LE
(PowerShell `>>` artifact), rendering as spaced characters that match nothing. Rewrote as clean
ASCII, preserving intent (`coverage_check.txt`, `coverage_output.txt`, `tsconfig.tsbuildinfo`)
and adding `*.log` + `test_output.txt` so stale logs can't be re-committed.

## Commands run

```powershell
npm run build          # tsc + componentsjs-generator — green
npm run lint           # eslint 0 warnings, markdownlint clean
npx jest test/unit --maxWorkers=2 --coverage=false   # 536 suites / 4146 tests — all pass
```

All under Node v24.18.0 (see CIV-C04 handoff for the PATH requirement).

## Residual / notes

- Nothing referenced the deleted files (verified by grep across ts/js/json/mjs/cjs/md before
  removal — only the eslint config and my own docs matched).
- `npm warn allow-scripts` flags `unrs-resolver@1.12.2`'s postinstall as pending approval under
  npm 11's script-consent feature — left pending deliberately; nothing needed it for build/test.
