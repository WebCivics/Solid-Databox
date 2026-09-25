# Industry capability catalog

## Source inventory

The early drafts under `C:\Projects\webcivics\solid-databox\industry-applications` cover commercial, education,
government, NGO, housing, and sporting contexts. Several directories currently contain headings only. The populated
drafts are discovery inputs, not accepted requirements or legal/technical claims.

## Reusable capability families

| Capability | Example sectors | Current foundation | Product treatment |
|---|---|---|---|
| Organization-issued records | Retail, utilities, education, sport | Deposit bridge, proof, receipt | First release |
| Consumer corrections and claims | Retail, utilities, housing | Scoped submission, review disposition | First release |
| Consumer preference sharing | Restaurants, take-away, hospitality | Submission classes and ODRL | Second demo |
| Menu publication and ordering | Restaurants, take-away, hospitality | Deposit/submission primitives | Second demo |
| Portable qualifications | Education, recruitment, sport | VC validation primitives | Add third-party issuer pack |
| Time-bound access and expiry | Housing, education, sport | Credential status and policy constraints | First release, then richer UI |
| Delegated authority | Child care, social work, financial counselling | Actor/delegation context only | New reviewed capability |
| Emergency or break-glass access | Health, child care, education | Not implemented | High-risk separate track |
| Binary evidence | Legal, courts, housing, insurance | Quarantine primitive | Add malware scanning and evidence pack |
| Multi-party workflow | Housing, education, justice | Review queue is single-program reference | New case/orchestration model |
| Notifications and recovery | Utilities, recalls, education | Outbox, SSRF checks, cursor feed | First release |
| Aggregation and public statistics | Sport, government, education | No privacy-preserving aggregator | Separate analytics track |
| Payments or financial execution | Utilities, retail, government | Not implemented | Excluded pending payments/security design |
| Encrypted privileged messaging | Legal, social work, health | Not implemented | Excluded pending messaging and legal review |
| Zero-knowledge statements | Government, legal, social work | Not implemented | Research track with concrete proof statements |
| Public linked data | Local government, retail, hospitality | RDF stack available | Adoption studio, public facts only |

## Industry-pack structure

Each pack should contain:

- metadata, semantic version, publisher, signature, maturity, compatible smithy/runtime versions;
- business outcomes and explicitly excluded claims;
- capability dependencies and risk classification;
- record and submission class templates;
- RDF/JSON schemas, shapes, contexts, and worked examples;
- policy-question templates rather than invented legal conclusions;
- assurance, issuer, status, retention, redress, and notification questions;
- connector and mapping recipes;
- consumer and operator UI vocabulary;
- synthetic fixtures, negative cases, migration rules, and executable tests;
- named human reviews needed before publication.

## Maturity levels

| Level | Meaning |
|---|---|
| Idea | Draft use case; may contain unsupported claims. |
| Modelled | Capability and data model reviewed; no runtime claim. |
| Demonstrable | Synthetic end-to-end fixture passes the demo gate. |
| Pilot | Durable deployment and named domain/security reviews pass. |
| Conformant | Applicable independent interoperability and conformance evidence exists. |

## First pack sequence

1. **Retail and loyalty** — digital receipt, warranty, recall, rewards statement, correction, and warranty claim.
2. **Restaurant and take-away** — versioned menu, order submission/status, dietary preference, allergen warning,
   receipt, and explicit temporary sharing. Payment authority is excluded from the first pack.
3. **Education credentials** — enrolment/achievement records and third-party qualification verification, excluding
   emergency health and guardianship until separately reviewed.
4. **Utilities** — usage statement, invoice, service notification, and correction; payment execution excluded.
5. **Sport** — membership, qualification, results, and time-bound status; concussion/medical access is a separate
   high-risk pack.

## High-risk review tracks

- Health and emergency data needs clinical safety, emergency-access, consent, guardianship, availability, and audit
  review. An audit trail does not make unsafe disclosure acceptable.
- Child and education data needs guardian authority, changing capacity, family-violence safety, mandatory reporting,
  and multi-party access design.
- Legal and justice data needs privilege, evidence admissibility, protective-order, court-secrecy, and conflict rules.
- Financial and government identity claims need regulated issuer, fraud, revocation, recovery, and jurisdiction review.
- A ZKP feature must name the exact statement, witness, circuit/proof system, setup assumptions, verifier, revocation
  semantics, correlation risk, and fallback. “Run a ZKP against a Pod” is not an implementable requirement.
