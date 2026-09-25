# Project Update Brief: Transitioning from 'CMS' to Intellectual Property Management System (IPMS)

**Subject**: Strategic and Architectural Pivot for the Solid-based CMS Project
**Status**: Pre-release (No legacy backwards compatibility required)

## 1. The Core Objective

We are fundamentally reframing the current 'CMS' project, to better align with the governance, rights and IP structures that exist but are traditionally less considered via the Traditional 'Content Management Systems' conceptual framing, previously designed for publishing websites; as we are building an organisations digital semantics infrastructure, for governance support of an organization. Moving forward, the project will be architected and framed as an **Intellectual Property Management System (IPMS)** built on Solid.

## 2. The Rationale

In a decentralized, graph-based ecosystem, "content" is an inadequate term. Every piece of media, text, and data — as well as the defined relationships between entities and agents — constitutes Intellectual Property (IP).

When an organization and its community interact, they are from a legal sense, generating and assigning IP. This system must explicitly manage these assets and their associated rights frameworks, rather than just serving HTML to a front-end. By leveraging Solid, we can ensure that IP assignments, provenance, and relational datasets map directly to the agency and human rights of the actors involved, which should be built into the core structures defined by the works previously framed merely as a 'cms'.

## 3. Business Systems as Functional Employment

Furthermore, business systems (e.g. transactional modules, operational data layers) are reframed. They are no longer isolated features but rather the **functional employment of the IP structures**. Operational logic simply enacts, modifies, or transacts upon the underlying semantic intellectual property graph in accordance with the declared Open Digital Rights Language (ODRL) policies.

---

## Action Plan for Refactoring

### Phase 1: Codebase & Taxonomy Overhaul

- **Nomenclature Replacement**: Systematically replace "CMS" with "IPMS" throughout the codebase.
- **Module Renaming**: Rename core directories (e.g. `src/databox/cms/` to `src/databox/ipms/`), classes, and configuration files.

### Phase 2: ODRL Integration

- **Rights Assignments**: Ensure that every piece of data written by the system is explicitly bound to an ODRL policy declaring ownership, usage rights, and restrictions.
- **Agency Mapping**: Deeply integrate the previously built Agency Structure ontology into the IP creation pipeline, ensuring all IP natively references its human or organizational creator.

### Phase 3: Setup Wizard & UI Alignment

- Update the Smithy Admin interface and Semantic Setup Wizard to reflect the new IPMS terminology.
- The `schema:SoftwareApplication` deployed by the organization will now be explicitly typed and identified as an **IPMS** rather than a CMS.
