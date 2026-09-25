# CIV-A04 handoff — NAT-traversal decision + TLS

## Status

accepted — ADR-0027 records the trade-off honestly; the Cloudflare Tunnel delivery path is
implemented end-to-end (plan → apply → artifacts) with 14/14 unit tests green, eslint clean,
tsc clean.

## What changed

- **`databox/decisions/ADR-0027-personal-nat-traversal-and-tls.md`** (new, Adopted-with-scope):
  - Primary: Cloudflare Tunnel — CGNAT-safe, no inbound ports, no router access — with the
    honest label mandated in onboarding: **TLS terminates at the Cloudflare edge; CF is
    in-path and sees plaintext inside its network.**
  - Alternative: port-forward + ACME for origin-terminated TLS (documented; automated ACME
    deferred, not part of the chosen path).
  - Fallback: cooperative subdomain/relay (CIV-A05); relay case is in-path with the same
    honesty rule, fiduciary duty → CIV-B50.
  - Rejected: overlay networks (clients must join), UPnP/NAT-PMP auto-punch (fail-open).
  - Invariant: the tunnel is transport, not authorization — sender-constraints (ADR-0006)
    apply at the origin regardless of delivery mode.
- **`src/databox/personal/PersonalHostingApi.ts`** (new): `applyPersonalHosting(client, plan,
  apex, accountId?)` — zone → DNS upsert → tunnel + personal ingress → artifact set.
  Depends on a `PersonalDnsClient` contract that `CloudflareApi` satisfies structurally —
  the personal profile never imports the IPMS module; a compile-time assertion in the test
  proves the compatibility. `personalArtifacts()` emits `cloudflared.yml`, env (BASE_URL,
  and the tunnel token only when one exists — never fabricated), launch command, ordered
  finish-steps for whichever delivery mode actually applied.
- **`src/databox/ipms/modules/hosting/CloudflareApi.ts`**: two additive methods —
  `getAccountId(zoneId)` (public zone→account lookup) and `setTunnelIngress(accountId,
  tunnelId, rules)` (raw ingress setter; the org `createTunnelIngress` now delegates to it —
  no org behaviour change).
- **`test/unit/databox/personal/PersonalHostingApi.test.ts`**: 7 tests — full apply path,
  explicit-account short-circuit, tunnel-denied → guided-manual fallback (DNS stands, no
  fabricated token), unresolvable account → manual path, DNS failure propagates (a partial
  apply never claims success), artifact shapes for both modes, plus the `CloudflareApi`
  structural-compat assertion.
- **`src/databox/index.ts`**, **`databox/decisions/README.md`**: barrel export; ADR-0027
  indexed.

## Failure behaviour (per ADR)

DNS/zone failure aborts loudly; tunnel-permission failure is non-fatal and honest (manual
`cloudflared` artifacts); unresolvable account skips provisioning — no path emits a
working-looking-but-unreachable configuration.

## Commands run

```powershell
npx jest test/unit/databox/personal --coverage=false   # 14/14 pass (incl. A03 suite)
npx eslint src/databox/personal src/databox/ipms/modules/hosting test/unit/databox/personal src/databox/index.ts   # clean
npm run build:ts   # clean — the structural-compat assertion compiled
```

## Residual / notes

- Live end-to-end verification needs an operator's Cloudflare zone+token — unit evidence
  only, flagged in the ADR's residual gates.
- Onboarding wording for the in-path disclosure is CIV-A02's job, with the named privacy
  reviewer sign-off ADR-0027 requires.
- Automated ACME (origin-terminated mode) is specified but not code-complete — a future
  hardening item if wanted.
