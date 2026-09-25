# Databox Smithy productization plan

## Purpose

This plan turns the Databox reference components into a polished demonstrator and an extensible organization
tailoring product. It continues after DBX-24 without replacing the independent DBX-25 through DBX-28 conformance and
release gates.

The product has six deliberately separate surfaces:

1. **Smithy control plane** — an organization selects an industry pack, supplies its own facts, configures trust and
   source mappings, validates the result, and publishes an immutable program version.
2. **Databox runtime plane** — CSS hosts organization-controlled, relationship-scoped Solid Pods representing the
   organization’s governed view of each consumer relationship. It accepts institutional records and explicit
   consumer submissions, and emits receipts, evidence, notifications, and recovery feeds.
3. **Consumer Solid application** — a consumer connects a selected independent Solid Pod, imports a holder-bound
   connection, retrieves verified organization information, and explicitly shares selected fields or requests.
4. **Recipient application** — a second organization receives a scoped disclosure, verifies provenance and policy,
   and returns a signed acknowledgement.
5. **Adoption studio** — an optional public-information product that helps an organization maintain website JSON-LD
   and reconcile public business listings. It never receives Databox customer mappings or private records.
6. **Inter-organizational exchange** — a governed address book and bilateral message plane for verified organizations
   to exchange bounded offers, delegations, claims, acknowledgements, referrals, and reconciliation records without
   granting Pod-browsing access.

## Files in this plan

- [Product architecture](product-architecture.md)
- [Two-Pod relationship exchange model](two-pod-exchange-model.md)
- [Namespace migration](namespace-migration.md)
- [Seraphim welfare demonstrator](seraphim-welfare-demo.md)
- [Seraphim privacy-shielded donations](seraphim-donations.md)
- [Seraphim Stripe, budgeting, and service economics](seraphim-stripe-budget-economics.md)
- [Inter-organizational address book and resource exchange](inter-organizational-exchange.md)
- [Charles James Flutter application](charles-james-flutter-app.md)
- [Demonstrator journey and acceptance](demo-acceptance.md)
- [Restaurant menu and ordering demonstration](restaurant-demo.md)
- [Smithy implementation prompt series](implementation-plan.md)
- [Industry capability catalog](industry-capability-catalog.md)
- [Adoption-support plan](adoption-support.md)

## Recommended first vertical

Use two connected synthetic journeys. The first uses MegaMart and a warranty provider: the consumer connects an
independent Solid Pod, receives a signed digital receipt, selects only the product and purchase fields needed for a
warranty claim, and receives an acknowledgement. The second uses a restaurant: the consumer Solid application saves
a verified menu to the selected Pod, creates an order locally, sends an explicit minimized submission, and retains
the acknowledgement, status events, and receipt.

These verticals exercise organization-to-consumer information and consumer-to-organization services without making
health, identity, financial, emergency-access, payment, or zero-knowledge claims.

## Scope rules

- Industry packs are versioned data and templates, not forks of the runtime.
- Databox provisions organization-controlled relationship Pods. It does not provide the consumer’s personal Pod;
  consumers select an independent Solid Pod, vault, or compatible knowledge environment and may change provider.
- Organization-specific facts never weaken universal security invariants.
- A demonstrator may use synthetic keys and in-memory resettable data, but every such seam is visibly labelled.
- A polished UI is not evidence of production security or Solid interoperability.
- “Verifiable” means a specific signature, status, issuer-trust, and payload-binding check passed. It does not mean
  the underlying real-world statement is true.
- Avoid promises such as “absolute,” “irrefutable,” “legally compliant,” or “zero knowledge” unless a named review
  and executable acceptance gate supports the specific claim.
- Public-presence tools operate only on explicitly public organization/location data and remain outside every
  private Databox trust boundary.

## Delivery definition

The polished demonstrator is complete when MFG-01 through MFG-15 pass. The adoption studio can release independently
after MFG-16 through MFG-19. MFG-20 through MFG-22 are the security, interoperability, and pilot-readiness gates; no
implementation agent self-certifies them.
