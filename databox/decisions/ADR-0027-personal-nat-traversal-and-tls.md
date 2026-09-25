<!--
ADR — Databox decision register. Cluster: personal profile (CIV-A).
Follows decisions/ADR-TEMPLATE.md exactly.
-->
# ADR-0027 — Personal Databox NAT traversal and TLS delivery mode

- **Status:** Adopted-with-scope
- **Date:** 2026-09-24
- **Decision owner:** CIV-A04 (personal profile wave)
- **Residual human review required:** privacy — the primary delivery mode places Cloudflare
  in-path for all personal-pod traffic (edge TLS termination). A person choosing this mode
  MUST be told so in the onboarding copy (CIV-A02); a named privacy reviewer should confirm
  that wording before the flow ships.
- **Sources adjudicated:** CIV-A03 (personal hosting plan shape — this ADR selects the
  delivery mode the plan feeds); `databox/devdocs/profile-ladder.md` (personal profile);
  the operator requirement that a personal databox "requires the means to get DNS via
  Cloudflare or similar."
- **Consumed by / blocks prompts:** CIV-A02 (onboarding flow presents the modes), CIV-A05
  (cooperative-subdomain fallback inherits the "no domain / no CF account" cases),
  CIV-A08 (cooperative-hosted fallback for users who cannot run locally at all).
- **Relates to:** ADR-0006 (sender-constraint suites — pod tokens still bind DPoP/CNf
  regardless of the TLS delivery mode), the organisation hosting path
  (`ipms/modules/hosting`) whose `CloudflareApi` is reused as the provider client.

## Context

A personal Databox runs on a person's own machine — typically behind consumer NAT, often
behind CGNAT where no inbound port is possible at all. To be a real Solid pod it still
needs a public `https://` hostname: WebIDs, LDN inboxes and the CIV-A07 person-facing
endpoints must be reachable by arbitrary clients, not just LAN peers.

The options differ on three axes that matter here: **(1)** whether it works behind CGNAT,
**(2)** whether a third party terminates TLS (is in-path for all traffic), and **(3)** how
much the person must own already (a domain, router access, a CF account). No option wins on
all three; the decision must therefore pick a primary path and honest alternatives rather
than pretend one mechanism suits everyone.

## Decision

**1. Primary delivery mode: Cloudflare Tunnel (`cloudflared`).** The default personal-hosting
path is an outbound-only Cloudflare Tunnel. It works behind any NAT including CGNAT,
requires no inbound ports, no router access and no ISP cooperation, and provides DNS +
edge TLS automatically. It MUST be presented in onboarding as exactly what it is:
**TLS terminates at the Cloudflare edge — Cloudflare is in-path infrastructure between
the edge and the origin, and can see the traffic in plaintext inside its network.** This is
a deliberate, opt-in trade of confidentiality-in-transit for reachability; it is NOT to be
marketed as end-to-end encryption. `PersonalHostingConfig`/`PersonalHostingApi` implement
this path: zone → DNS record → tunnel → single-hostname ingress → artifacts
(`cloudflared.yml`, env, launch command, finish-steps).

**2. Honest alternative: port-forward + ACME (origin-terminated TLS).** Where the person has
router access and a publicly routable address, the pod MAY be served directly behind a
port-forward with a Let's Encrypt certificate (certbot/lego, or a Caddy/nginx reverse proxy
terminating TLS). This mode puts **no CDN in-path** — the only third party is the CA at
issuance time. It is documented as the operator-managed alternative; automated in-process
ACME is not built in this wave (see residual gates).

**3. Fallback: cooperative subdomain + hosted relay (CIV-A05).** A person without a domain
or a Cloudflare account is not excluded: a cooperative may issue
`<name>.<members>.<coop-domain>` and either point it at the person's tunnel/origin or relay
through cooperative infrastructure. In the relay case the cooperative becomes in-path —
the same honesty rule applies, and the cooperative's fiduciary duty over that position is
the CIV-B50 surface.

**4. Not adopted: overlay networks (Tailscale, Yggdrasil, Tor).** They traverse NAT reliably
but require every client of the pod to join the overlay or pass a gateway — incompatible
with a public WebID/pod reachable by arbitrary Solid clients. They remain valid for
private administrative access only and are out of scope for pod serving.

**5. Invariant preserved.** Whatever the delivery mode, the pod is still a standards Solid
server and bearer/DPoP sender-constraints (ADR-0006) still apply at the origin — the tunnel
is transport, not authorization. A misassembled deployment MUST NOT silently weaken the
pod's auth surface by the choice of delivery mode.

## Alternatives considered

- **Cloudflare Tunnel only, labelled as encrypted** — rejected: it is not end-to-end;
  claiming otherwise would be a false assurance to people whose threat model may include
  the CDN itself.
- **ACME + port-forward as the primary mode** — rejected as primary: it fails outright on
  CGNAT (a large share of consumer/mobile uplinks) and demands router access most home
  users lack. Kept as the strong alternative where available.
- **Tailscale/overlay as primary** — rejected: requires clients to join the network; a
  public pod cannot assume that.
- **UPnP/NAT-PMP automatic port mapping** — considered and rejected as unreliable and
  dangerous: silently punching holes in a home router without explicit operator intent is
  exactly the fail-open behavior this codebase refuses elsewhere.

## Consequences

- **Positive:** universal reachability (CGNAT-safe), zero inbound ports, free-tier TLS+DNS,
  a single hostname covers pod+WebID+A07 endpoints, guided-manual fallback when the API
  token lacks tunnel scope (mirrors the organisation path's contract).
- **Negative / cost:** the default mode trusts Cloudflare with plaintext-in-transit; the
  tunnel token is a bearer secret that must live in the environment, never in config or
  git; CF account+token is a prerequisite for the automated path.
- **Privacy & threat notes:** edge termination means Cloudflare (and any compelled
  jurisdiction it answers to) can observe personal-pod traffic. Mitigations available to
  the person: choose ACME mode, choose coop relay (trusting the coop instead — still
  in-path, different trustee), or layer application-level encryption on sensitive pod
  content. The threat is disclosed, not eliminated, in mode 1.

## Failure behavior

- A DNS/zone failure aborts the apply with the provider's error — a partial apply never
  claims success (enforced in `applyPersonalHosting`: DNS errors propagate).
- A tunnel-permission failure is **non-fatal and honest**: the DNS record stands, the
  artifacts switch to guided-manual `cloudflared` steps, and no tunnel token is fabricated.
- If no account ID is resolvable, tunnel provisioning is skipped and the same manual path
  is produced. No path silently emits a working-looking but unreachable configuration.

## Open sub-questions / residual gates

- **Automated ACME (origin-terminated) implementation** — deferred; owned by a future
  hardening item if chosen. The mode is specified here but only tunnel mode is code-complete.
- **Onboarding wording for the in-path disclosure** — CIV-A02 must present mode choice with
  the privacy trade-off stated plainly; named privacy reviewer sign-off required there.
- **Cooperative relay infrastructure** — CIV-A05/A08; the relay's fiduciary posture is
  CIV-B50's concern.
- **Live end-to-end verification** — requires an operator's Cloudflare zone+token; the
  apply path is unit-tested against a fake client and the real `CloudflareApi` shape is
  compile-checked, but a real-zone run is an operator action, not a CI fact.
