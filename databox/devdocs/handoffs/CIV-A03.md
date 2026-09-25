# CIV-A03 handoff — Personal hosting plan

## Status

accepted — `src/databox/personal/PersonalHostingConfig.ts` produces a validated
single-hostname plan (DNS record + tunnel ingress + launch command + cloudflared YAML) with
7/7 unit tests green, eslint clean, tsc clean.

## What changed

- **`src/databox/personal/PersonalHostingConfig.ts`** (new dir `personal/` — the home for
  A07's person-facing endpoints too):
  - `planPersonalHosting(input)` — pure, deterministic plan for ONE hostname
    (`pod.<apex>`, label configurable). Emits:
    - one `DnsRecord` (A/AAAA/CNAME by origin shape, `proxied` honoured — a personal pod has
      no mTLS device host, so proxying is permitted),
    - single-hostname `tunnelIngress` ending in the `http_status:404` catch-all,
    - `baseUrl` and a `launchCommand` targeting `config/databox/personal.json`.
  - `generatePersonalCloudflaredConfig(plan)` — YAML for the self-run-`cloudflared` path.
  - Record/ingress interfaces are declared locally, structurally identical to the IPMS
    hosting module's — `CloudflareApi` can apply a personal plan unchanged while the
    personal profile carries no IPMS dependency (documented in-file).
- **`test/unit/databox/personal/PersonalHostingConfig.test.ts`**: 7 tests — host/baseUrl/
  record derivation, single-record invariant, tunnel ingress shape + catch-all, label/proxy
  overrides, AAAA/CNAME selection, input validation, YAML generation.
- **`src/databox/index.ts`**: barrel export of `personal/PersonalHostingConfig` (consistent
  with the other feature modules).

## Decisions

- **One hostname, not three.** A person's pod, WebID and A07 endpoints share a single host —
  the simplest reachable shape. The `devices.`/`www.` hosts are org concerns and absent.
- **Deliberately duplicated record shape** rather than importing the IPMS module's type:
  the personal profile excludes IPMS; structural typing keeps `CloudflareApi` compatibility
  without the dependency.
- **Plan emits a DNS record even though a tunnel doesn't strictly need one** — the same plan
  object then feeds either A04 delivery mode (tunnel or port-forward) honestly.

## Commands run

```powershell
npx jest test/unit/databox/personal --coverage=false   # 7/7 pass
npx eslint src/databox/personal/... test/... src/databox/index.ts   # clean
npm run build:ts   # clean
```

## Residual / notes

- Applying a personal plan (CloudflareApi calls, tunnel provisioning, cert/TLS path,
  NAT-traversal choice) is CIV-A04 — this item is the plan *shape* only.
- The `originTarget` semantics differ subtly from the org plan's mTLS world: for a personal
  tunnel, `originTarget` is the LAN-side listen address the tunnel forwards to (e.g.
  `192.168.1.20`), not a public IP — the plan comments say so.
