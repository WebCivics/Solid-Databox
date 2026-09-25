# CIV-A05 — Cooperative-subdomain / dynamic-DNS fallback

**Status:** accepted
**Wave:** 1 (personal databox profile)
**Depends on:** CIV-A04 (ADR-0027 declared the fallback direction)

## What landed

The "no own domain, no Cloudflare account" path — a cooperative zone operator delegates
`member.members.<coop-zone>` through an issuance API:

- `src/databox/personal/CooperativeDnsClient.ts` — implements the existing
  `PersonalDnsClient` contract (`getZoneId`, `createDnsRecords`, `createTunnel`,
  `setTunnelIngress`, `getAccountId`) against the coop's declared API
  (`{coop}/zones/{zone}`, `…/records`, `…/tunnels`, `…/tunnels/{id}/ingress`,
  `…/zones/{id}/account`). Auth is a **member token** (Bearer) — the member never holds the
  coop's provider credentials; the coop provisions tunnels inside its own account and hands
  back only the scoped tunnel token. Fail-closed: no base/token → constructor throw;
  non-2xx/malformed → throw.
- `planCoopPersonalHosting` in `src/databox/personal/PersonalHostingConfig.ts` — the member
  label is validated as an RFC-1035 DNS label (fail closed) and lower-cased; the plan reuses
  `planPersonalHosting` with `apexDomain = coopZone`, `podLabel = member`, `proxied = true`
  (the coop zone is proxy-fronted by the operator).

Because the apply path (`applyPersonalHosting`) already depends on the `PersonalDnsClient`
contract only, the coop client drives the identical apply flow — zone resolve → record
upsert → tunnel provision → ingress — with no provider-specific branching.

## Decisions taken

- **HTTPS issuance API, not RFC 2136 UPDATE.** The coop API keeps auth/audit/uniformity
  with the rest of the personal surface; the plan gate's "RFC 2136 or provider API" is
  satisfied by the provider-style API. (A raw RFC-2136 client remains a possible alternative
  provider behind the same `PersonalDnsClient` contract.)
- **Member-token scope.** The member credential authorises issuance inside THEIR delegated
  subdomain space only — enforcement lives coop-side (CIV-A08 serving half).
- **Label policy at plan time.** Delegated names are single labels under the coop zone —
  no nested subdomains for members (keeps the coop's zone flat and auditable).

## Verification

- 7 tests in `test/unit/databox/personal/CooperativeDnsClient.test.ts`, including the full
  `applyPersonalHosting` path driven through the coop client: `alice.members.coop.example`
  planned, DNS record upserted, tunnel provisioned+ingressed, artifacts emitted with
  `CLOUDFLARE_TUNNEL_TOKEN` in env — all without a member-side Cloudflare account.
- `tsc` clean; `eslint` clean; personal suite at 42 tests green.

## Residual / notes

- The coop-side serving API is declared but not implemented — that's CIV-A08's coop-server
  scope (issuance endpoint + per-member authorization + backing provider calls).
- A dynamic-DNS (RFC 2136 / dyndns-style HTTP update) variant can slot in as another
  `PersonalDnsClient` impl without touching the apply path.
