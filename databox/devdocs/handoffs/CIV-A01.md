# CIV-A01 handoff — Personal databox preset

## Status

accepted — `config/databox/personal.json` boots, provisions a pod + WebID end-to-end, and
exposes no organisation control-plane surface. The profile-ladder doc is updated.

## What changed

- **`config/databox/personal.json`** (new): the person-side profile — a file-backed Layer-1
  Solid pod: `storage/backend/file.json` + `storage/location/pod.json`, `identity/oidc`,
  `ldp/authentication/dpop-bearer`, `ldp/authorization/webacl`, `notifications/all` (LDN inbox),
  `resource-locker/file`. Deliberately absent vs `live.json`: `LiveDataboxHttpHandler`, the
  `databoxControlToken` variable, and all IPMS/Smithy organisation surface. The preset comments
  record that the person-facing databox endpoints (credential install target, vault sync,
  cursor consumer) mount under `/.databox/personal` via CIV-A07 and authenticate to the owner's
  WebID — never a shared bearer token.
- **`databox/devdocs/profile-ladder.md`**: added the personal-profile section under Layer 1 —
  what the preset is today, what A07 adds, the two hosting shapes (reachable via
  tunnel/port-forward or local/LAN-only).

## Design decision

Layer 1 *for a person* is intentionally a vanilla Solid pod — the degradation principle made
concrete: a personal databox is a real Solid server any standard client can use, not a
reduced fork. The preset's value is correct person-side defaults (persistent file storage,
pod-per-person, OIDC+WebID, LDN), the named mount point for A07's person-facing endpoints,
and honest documentation of what's present vs pending.

## Gate evidence — exercised live

```powershell
node bin/server.js -c config/databox/personal.json -p 3100 -f .data-test-personal
```

- Server listened on `:3100`; root returns 200.
- Account → password → pod flow completed via the `.account` JSON API:
  `POST .account/account/` → account; `POST …/login/password/` → 200;
  `POST …/pod/` → `{"pod":"http://localhost:3100/person/","webId":"…/person/profile/card#me"}`;
  `GET /person/` → 200.
- `GET /.databox/smithy` → `401` with `WWW-Authenticate: Bearer scope="openid webid"` — the
  standard LDP/WAC challenge for an unauthenticated protected resource, **not**
  `Bearer realm="databox-control"`. No control plane exists on this preset.
- Test storage `.data-test-personal/` removed after the run.

## Residual / notes

- Nothing person-specific exists server-side yet beyond the pod itself — that is CIV-A07's
  scope (registry, sync worker, cursor consumer, submission composer).
- The preset uses HTTP (`server-factory/http.json`); TLS is a deployment concern handled by
  A04 (tunnel-terminated or ACME), matching how `live.json` handles it.
