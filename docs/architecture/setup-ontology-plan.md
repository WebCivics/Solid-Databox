# Databox Organization Setup Ontology Plan

## Goal

Revamp the Smithy Admin "Setup Wizard" to generate a strict, semantically-correct, multi-tiered RDF graph topology when establishing a new organization on a Solid Pod, properly defining stewardship, software agents, and human operators.

## The Problem

Currently, the setup process generates a flat `schema:Organization` node. It lacks the legal and operational structure required for a robust, decentralized trust system where tech consultants deploy systems on behalf of less-technical business owners.

## Proposed Semantic Topology

When the Setup Wizard is executed, it will generate a linked graph:

1. **The Human Stewards (`foaf:Person`)**:
   - `consultant`: The Technical Consultant who is performing the setup.
   - `owner`: The less-technical Business Owner taking ultimate legal ownership.
2. **The Organization (`foaf:Organization`)**:
   - The central entity representing the business.
   - Links to the humans using `org:hasMember` or `schema:member`, with explicit roles (e.g., `org:role "Technical Administrator"`, `org:role "Legal Owner"`).
3. **The Software Agent (`schema:SoftwareApplication` / `as:Application`)**:
   - The Databox CMS and Website itself.
   - Linked via `schema:creator` to the Organization.
   - Granted authority to act on behalf of the org using `as:actor` or `dpv:DataProcessor`.

## Implementation Steps

### 1. Update UI (`smithy-admin/src/pages/setup/index.tsx`)

Add a new "Stewards & Operators" section to the form:

- **Business Owner WebID**: Input for the legal owner's WebID.
- **Consultant / Administrator WebID**: Input for the tech consultant executing the setup.

### 2. Update RDF Graph Generation

Rewrite the JSON-LD generation payload in the `handleSubmit` function of `setup/index.tsx`:

```json
{
  "@context": {
    "schema": "https://schema.org/",
    "foaf": "http://xmlns.com/foaf/0.1/",
    "org": "http://www.w3.org/ns/org#",
    "as": "https://www.w3.org/ns/activitystreams#"
  },
  "@graph": [
    {
      "@id": "#owner",
      "@type": "foaf:Person",
      "foaf:account": "<Owner_WebID_Input>"
    },
    {
      "@id": "#consultant",
      "@type": "foaf:Person",
      "foaf:account": "<Consultant_WebID_Input>"
    },
    {
      "@id": "#organization",
      "@type": ["foaf:Organization", "schema:Organization"],
      "schema:name": "<OrgName>",
      "schema:member": [
        { "@id": "#owner", "org:role": "Legal Owner" },
        { "@id": "#consultant", "org:role": "Technical Steward" }
      ]
    },
    {
      "@id": "#cmsSoftware",
      "@type": ["schema:SoftwareApplication", "as:Application"],
      "schema:name": "Solid Databox CMS",
      "schema:creator": { "@id": "#organization" },
      "as:actor": { "@id": "#organization" }
    }
  ]
}
```

### 3. Commit to Repo

This plan document will be stored permanently in `docs/architecture/setup-ontology-plan.md` to ensure architectural alignment moving forward.
