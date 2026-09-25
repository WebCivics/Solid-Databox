# Two-Pod relationship exchange model

## Core model

Both sides of the relationship are Solid-compatible data spaces:

1. **Organization relationship Pod (the Databox)** — an organization-controlled, relationship-scoped Pod containing
   the organization’s governed view of its dealings with one consumer. It resembles the relationship slice of a CRM,
   but uses Solid resources, portable records, explicit policies, append-only evidence, and opaque identifiers.
2. **Consumer personal Pod or vault** — a separately selected and controlled Solid Pod, vault, compatible personal
   operating system, or knowledge environment representing the consumer’s information and intentions.

Databox provisions the first kind. It does not provision or control the consumer’s personal Pod.

```text
Organization systems                    Consumer environment

CRM / POS / case system                 Personal Solid app / agent
          |                                      |
          v                                      v
Organization relationship Pod  <----->  Consumer personal Pod / vault
          |       explicit governed exchange     |
          v                                      v
Organization evidence                    Personal knowledge graph
```

## Separate authority

There is no single master copy of the relationship.

- The organization is authoritative for records it issues: menus, ingredients it declares, prices, transactions,
  receipts, order acceptance, service status, recalls, and organizational decisions.
- The consumer is authoritative for their intentions and self-asserted context: orders, selected dietary preferences,
  corrections, delivery choices, annotations, and consent to disclose particular fields.
- An external issuer can be authoritative for a credential, but neither Pod should reinterpret it beyond the
  credential’s stated scope and status.
- Each side retains the exact envelope, provenance, policy, acknowledgement, and receipt needed to reconstruct an
  exchange.

## Exchange patterns

### Organization to consumer

The organization can provide signed menus, ingredients, allergens, nutrition information, product details, receipts,
order status, warranty information, recalls, and correction outcomes. The consumer application verifies these and
decides whether to retain or integrate them into the consumer’s health, finance, food, or knowledge environment.

The organization does not write arbitrary resources into the personal Pod. A consumer-controlled app or agent pulls,
verifies, and stores selected information, or grants a narrowly scoped destination for one exchange.

### Consumer to organization

The consumer can provide orders, dietary requirements, allergy warnings, preferences, warranty claims, corrections,
and other purpose-relevant context. The consumer application constructs an explicit, minimized submission for the
named organization, relationship, purpose, and validity interval.

The organization receives it into the relationship Pod and applies its own validation, policy, review, and
source-system workflow. One submission never grants browsing access to the personal Pod.

### Reconciliation

An exchange is not complete merely because bytes moved. The sender retains a signed acknowledgement or rejection;
the receiver records the exact accepted envelope; both sides bind the exchange to stable idempotency coordinates and
can recover missed status events from an authoritative feed.

## Restaurant example

The restaurant relationship Pod can hold the menu version used for a transaction, submitted order, acceptance,
preparation status, item and ingredient facts, and final receipt. The consumer Pod can hold a verified menu snapshot,
local basket, selected dietary context, submitted-order copy, status history, receipt, and derived food diary entry.

The restaurant supplies evidence about what it offered and fulfilled. The consumer decides how that evidence is used
in their health or knowledge environment. A dietary preference in the personal Pod is not disclosed until the
consumer selects it for the restaurant’s ordering purpose.

## Design consequences

- Provisioning must distinguish a Databox relationship Pod from a consumer personal Pod.
- Connection credentials identify one relationship between two independently governed data spaces.
- The consumer agent is an exchange and knowledge-integration client, not a wallet supplied by the organization.
- Public organization information and relationship records can share vocabulary but have different authorization and
  correlation rules.
- Synchronization exchanges immutable or versioned envelopes; it does not mirror either complete Pod.
- Correction and revocation operate within each authority’s obligations and do not imply remote erasure of
  independently retained evidence.
