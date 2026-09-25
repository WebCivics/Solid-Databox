# DBX-26 — Adversarial security suite (P1 tier, unit-level)

**Status:** P1 unit-tier + live deployment-tier pass complete (5/5 deployment P1s green). The live
harness caught and fixed three real integration defects (existence oracle, non-databox denial,
holder-binding) — see [DBX-26-deploy](DBX-26-deploy.md).
**Wave:** 2

## What landed

`test/adversarial/P1.test.ts` — the first threat-model-keyed adversarial suite, wired into
`jest.config.js` (`testRegex` now includes `test/adversarial`). Each test is one P1 attack
from `dbx-03-adversarial-test-backlog.md`, exercised against the REAL component — not a
mock of the defence — asserting the expected safe outcome:

| AT | Attack | Result |
|---|---|---|
| AT-08 | Program-A credential exchanged into program B | Denied — program binding mismatch |
| AT-13 | Cryptographically-valid credential, untrusted issuer | Refused — issuer not in trust list |
| AT-17 | The connection credential presented AS a bearer token | Refused — `notWireFormat` |
| AT-19 | Nonce replay; wrong-audience proof; expired token | All denied (consume-once, audience-bound, expiry) |
| AT-38 | Webhook/endpoint at 169.254/127.0.0.1/private/DNS-rebind | Refused (SSRF-safe validator) |
| AT-47 | Guardian acts out-of-scope; after relation expiry | Both denied (`mayActFor` fails closed) |
| AT-50 | Duty handler no-ops/fails | `queued`/`failed` — never silently fulfilled |
| AT-51 | Record with links/directives auto-exfiltrate | Zero submissions — records are inert |
| AT-03/35 | Two connections share a correlator | None — pairwise ids + urn:uuid credential ids differ |

## Findings surfaced (real)

- **`PersonalVaultService.importConnection` generated the holder key internally** — an
  org-issued credential could never bind it. Fixed: `holderPrivateKey` is now an optional
  input (person generates the key → org issues against its public half → imports).
- **`RemoteConsumeClient.pullFeed` was unauthenticated** — the feed route accepted any
  tenant. Now token-bound; `recover` authenticates first.
- A guardian relation with zero scopes but qualified input (`specialties`/`informationAccess`)
  was wrongly inert — `isInForce` now counts advisory reach.

## Coverage honesty

These are the **unit-level** P1s — the ones exercisable against a component's logic. The
**deployment-tier** P1s (AT-01 host-rewrite tenant escape, AT-06 enumeration-under-budget,
AT-07 404-not-403 indistinguishability, AT-16 independent Solid-OIDC client, AT-30 storage-
backend reads) need a live HTTP surface + a second tenant — they're the integration-tier
half of this gate and are marked here as the remaining DBX-26 scope, not silently absent.

**Verification:** `test/adversarial/P1.test.ts` — 9 P1 attacks green; full databox suite
1882 tests green; lint + tsc clean.
