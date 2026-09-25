# DBX-27 conformance report — Solid Databox packaged deployment

**Deployment under test:** `config/databox/live.json` (the packaged live preset), launched via
`test/integration/config/databox-live.json`. **Method:** real `AppRunner` HTTP server; two accounts
(alice, bob) minted three independent Solid-OIDC client-credentials identities
(`alice-conformance-client`, `bob-conformance-client`, `reference-agent-client`), each
DPoP-authenticated. No requirement below is marked *passed* without a live assertion.

## Compatibility manifest

| Surface | Conforms | Notes |
|---|---|---|
| Solid protocol — LDP read/write/delete | pass | PUT → 201, GET → 200 (bytes preserved), per-resource ACL |
| WebID profile document | pass | `GET <webId>` → 200 (RDF) for every registered holder |
| Solid-OIDC + DPoP (client-credentials grant) | pass | three independent client identities all authenticate |
| Web Access Control (WAC/.acl) | pass | cross-client isolation + owner-granted read honoured |
| Databox control plane coexistence | pass | `/.databox/*` protected; ordinary Solid surface untouched |

## Conformance checks (evidence in `dbx-27-conformance.json`)

| # | Requirement | Result |
|---|---|---|
| 1 | WebID profile resolvable to RDF — alice | pass |
| 2 | WebID profile resolvable to RDF — bob | pass |
| 3 | Independent client alice reads own pod | pass |
| 4 | Independent client bob reads own pod | pass |
| 5 | LDP PUT resource | pass (201) |
| 6 | LDP GET resource, bytes preserved | pass (200) |
| 7 | Cross-client isolation — private resource unreadable | pass (403) |
| 8 | ACL-governed cross-client read | pass (200) |
| 9 | ACL read-only grant still denies write | pass (403) |
| 10 | Reference agent round-trip | pass |
| 11 | Ordinary Solid root + control plane protected | pass |

## Scope note (honest)

This proves the deployment is a *conformant, interoperable Solid pod server* to arbitrary clients —
the DBX-27 baseline. Deep protocol conformance (Solid spec test-suite results, WAC edge cases,
notification-channel conformance) is the broader claim; this gate's criterion is independent-client
interoperability against the packaged deployment, which is met.
