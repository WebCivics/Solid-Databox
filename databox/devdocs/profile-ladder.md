# Databox Profile Ladder

The Databox platform is built as a progressive ladder of profiles. Each layer
builds on the previous one, adding capabilities without removing any.

## Layer 1 — Basic Solid Server

The foundation is a standards-compliant Solid server:

- **Pod storage** with WebID-TLS authentication
- **LDP** container and resource CRUD
- **WAC/ACP** access control
- **LDN** notification inbox
- **OIDC** identity provider

This layer is useful for individuals who want a personal data pod with no
business features.

### Personal profile (`config/databox/personal.json`)

The person-side entry point: a file-backed Layer-1 pod on one's own machine —
WebID/OIDC, WAC, LDN inbox — with the organisation control plane and IPMS
deliberately absent. It is a complete pod today and the mount point for the
person-facing Databox surface as it lands:

- **Connection registry + credential install target** (CIV-A07): per-program
  isolated registry recording which organisation Databoxes the person is
  connected to, and the endpoint a connection credential is delivered to.
- **Consumer-vault sync** (CIV-A07): notify-then-pull replication of records
  the person's relationships have issued, with a durable cursor so recovery
  after downtime is replay, not assumed delivery.
- **Private submission composer** (CIV-A07): the person's side of the
  symmetric exchange — what they submit, consent to, and revoke.

Personal boxes authenticate to the owner's WebID; there is no control-plane
bearer token. Two hosting shapes are supported (CIV-A03/A04): reachable on the
open internet via a tunnel or port-forward, or local/LAN-only.

#### Household profile (families, share-houses — CIV-A09/A10)

The personal profile extends to multi-member households: one host runs one pod
per member (`alice.<zone>`) plus a governed `commons.<zone>` pod for shared
resources — the commons is governed, not owned. The governance policy answers
the admin question explicitly:

- **Admin models** (`HouseholdPolicy.adminQuorum`): `1` = any single admin acts
  alone (a family — either parent); `n` = m-of-n admin approvals; `'all'` =
  consensus (a share-house — commons changes need every member).
- **Commons authority** (`commonsAuthority`): `'admins'` (parents set household
  rules) or `'all-members'` (housemates co-govern the commons).
- **Member consent** (`memberConsent`): one member may electronically grant
  another member a scoped permission — the ask/approve/deny/revoke flow with an
  audit trail. A `limited`-capacity member (a child) cannot be petitioned alone:
  an admin counter-signature is required — the household seed of the
  guardianship model (CIV-B01).
- **Presets**: `familyPolicy` (parents admin, children members/limited) and
  `shareHousePolicy` (all members admin, consensus on commons).

Members each own their pod outright — household governance only ever applies
to the commons and to admin actions, never to a member's own pod contents.

#### Guardianship — children, disability, elder care (CIV-A11/A12)

The household layer carries a rights-anchored guardianship model for members
who cannot (or should not yet) decide alone — children across single or
separated households, persons with disability, elders. Anchored to the CRC
(the child's evolving capacity, Art. 5; their voice, Art. 12) and the CRPD
(supported decision-making, Art. 12 — the person retains capacity):

- **Guardian kinds with precedence** — `parent` (100) > `appointed` (90) >
  `attorney` (80) > `kinship` (60) > `professional` (40) > `supporter` (0).
  Defaults only — a court order can raise a kinship carer above a parent via a
  per-relation `precedence` override. Equal-precedence co-guardians who
  disagree deadlock to the recipe's escalation — never "first to click wins".
- **Nine duty scopes** — residence, medical, financial, education,
  online-contact, location-sharing, data-sharing, daily-care, legal. A
  guardianship is a set of scoped authorities; zero scopes = inert.
- **Multi-household** — a relation names the households it operates in; a
  separated child carries guardians on both sides, each effective only in
  their household.
- **Capacity scale** — `full` / `emerging` (child: decides with counter-
  signature, scope shrinking as capacity grows) / `limited` / `supported`
  (retains capacity — supporters advise, never substitute).
- **Safety recipes** (`SAFETY_RECIPES`) — SHACL-grounded decision templates:
  online-contact boundary, third-party data sharing, location sharing,
  residence schedule, major medical, supported decision, emergency break-glass.
  Each declares its consent rule, whether the ward's voice is required, the
  SHACL shape the decision record must satisfy, and the rights anchors.
  **Guardians decide; the shape disposes** — an approved decision whose record
  fails SHACL is `rejected-record`, never stored.


## Layer 2 — +Databox

Adds the Databox orchestration layer:

- **Binary evidence quarantine** with malware scanning (ClamAV, VirusTotal)
- **Device identity** (mTLS) for POS terminals and IoT
- **Native edge** POS device support (cash drawer, printer, customer display)
- **Org app container** (WASM/PWA) with per-install licence VCs
- **Connector sidecar** framework for enterprise data integration

This layer is useful for organisations that need device management and evidence
quarantine but don't yet need the full IPMS.

## Layer 3 — +IPMS

Adds the Content Management System:

- **Module registry** with 30+ built-in modules (bookings, payments, catalogue,
  governance, credentials, events, ticketing, tax, discounts, donations, etc.)
- **Vertical profiles** that bundle modules for specific industries
- **Module configuration** via ui# shapes and UiFormRenderer
- **RDF feeds** and website SEO publishing
- **MCP server** for AI agent integration
- **Enterprise connectors** (ODBC, LDAP) with R2RML/RML mapping engine

This layer is useful for organisations that need structured content and
business workflows on top of their pod storage.

## Layer 4 — +Modules (Vertical Profiles)

Vertical profiles compose horizontal modules into industry-specific bundles:

| Profile | Modules | Use Case |
|---------|---------|----------|
| `food.restaurant` | POS, menu, bookings, delivery, allergy-safety, tax, discounts, barcode, eftpos, backups, accounting | Restaurants |
| `food.take-away` | POS, catalogue, delivery, driver-mgmt, allergy, tax, discounts, barcode, eftpos, backups, accounting | Quick-service, food trucks |
| `food.allergy-safety` | Allergy-profile, ingredient-declaration, allergen-matching | Allergen compliance |
| `auto.portable-records` | Catalogue, bookings, records, jobs, website-seo | Automotive repair |
| `health.privacy-consent` | Consent, access, correction, governance, delegation, break-glass, backups | Healthcare |
| `member.governance` | Governance, events, ticketing, social, payments | Clubs, co-ops |
| `print.shop` | Print services, jobs, B2B inter-org, tax | Print businesses |
| `hr.workforce` | HR, governance, credentials, payments, driver-mgmt, backups, accounting | HR management |
| `sports.venue` | Events, ticketing, access, donations, governance, tax, barcode, eftpos, backups, accounting | Sports venues |
| `trades.service` | Jobs, bookings, quotations, catalogue, inventory, tax, barcode, eftpos, backups, accounting | Trades services |
| `charity.nonprofit` | Donations, governance, credentials, concessions, tax, backups, accounting | Charities |
| `sport.club-base` | Governance, events, ticketing, social | Sporting clubs |
| `sport.league-team` | Events, ticketing, credentials, governance | League sports |
| `sport.facility-court` | Bookings, events, ticketing | Courts and courses |
| `sport.compliance-safety` | Credentials, licensing, governance | Safety compliance |
| `glam.base` | Catalogue, records, governance, profile | GLAM base |
| `glam.gallery-museum` | Catalogue, events, ticketing, website-seo | Galleries, museums |
| `glam.library` | Catalogue, records, profile | Libraries |
| `glam.archive` | Records, provenance, governance | Archives |
| `glam.historical-society` | Governance, events, social, donations | Historical societies |
| `home-services.base` | Bookings, catalogue, payments, profile | Home services |
| `home-services.maintenance` | Jobs, inventory, bookings, tax | Pool & garden care |
| `home-services.domestic` | Bookings, catalogue, payments | House-keeping |
| `wellness.practitioner` | Bookings, catalogue, credentials, payments | Solo practitioners |
| `wellness.venue` | Bookings, events, ticketing, catalogue | Studios, venues |
| `wellness.clinic` | Governance, credentials, consent, bookings | Multi-disciplinary clinics |

## Choosing a Profile

1. **Start basic** — set up a Solid server with pod storage.
2. **Add Databox** if you need device management, evidence quarantine, or
   native edge POS support.
3. **Add IPMS** if you need structured content, business workflows, or
   enterprise connectors.
4. **Select a vertical profile** that matches your industry to get a
   pre-configured bundle of modules with sensible defaults.

Each layer is additive — you can always upgrade from basic to +Databox to
+IPMS without losing data or configuration.
