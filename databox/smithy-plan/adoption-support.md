# Organization adoption studio

## Rationale

Helping an organization keep its public information accurate is a credible adoption feature: it produces value
before private Databox integrations are complete and teaches the same disciplines of canonical data, provenance,
validation, review, and controlled publication.

It is a separate module. Public business facts must never be joined to customer mappings, private records, consumer
WebIDs, access grants, or Databox audit data.

## Canonical public-presence graph

The studio maintains explicitly public facts such as organization and location names, legal name, URL, logo,
telephone, public email, postal address, geographic coordinates, opening and special hours, service area, categories,
accessibility attributes, menus/services, and stable public identifiers. Every value records source, last checked,
reviewer, and channel publication state.

Use the most specific applicable Schema.org `Organization` or `LocalBusiness` subtype. Channel projections are
derived from the canonical graph; they are not competing sources of truth.

## Website structured-data support

- Import existing JSON-LD, RDFa, Microdata, sitemap, and visible page facts.
- Compare visible facts with structured data and flag contradictions.
- Generate previewable JSON-LD for organization and location pages.
- Validate syntax, vocabulary ranges, required/recommended channel fields, canonical URLs, and crawlability inputs.
- Export a snippet, IPMS adapter payload, pull request, or signed webhook; never silently rewrite a site.
- Record approval and deployed digest, then re-crawl and detect drift.
- Link to Google Rich Results Test and Search Console validation where the organization has authorized access.

Correct structured data can help search systems understand a site, but it does not guarantee ranking, a rich result,
or a knowledge-panel change. The product must describe findings as correctness and consistency work, not “SEO wins.”

## Google Business Profile support

The Business Profile adapter is OAuth-authorized by an organization owner or manager and uses a separate connector
identity. Initial behavior is read-only:

1. list authorized accounts and locations;
2. retrieve selected fields and Google-updated values;
3. compare them with the canonical public-presence graph;
4. propose field-level changes with source and impact;
5. require approval before a patch using an explicit update mask;
6. retain request, response, actor, and reconciliation evidence.

Location creation and verification are later capabilities because they have business-ownership and platform-policy
implications. Tokens live in a secret provider, scopes are minimized, revocation is visible, and a failed update never
changes the canonical graph silently.

Official references:

- [Google Organization structured data](https://developers.google.com/search/docs/appearance/structured-data/organization)
- [Google structured-data guidelines](https://developers.google.com/search/docs/appearance/structured-data/sd-policies)
- [Google Business Profile APIs](https://developers.google.com/my-business)
- [Google location-data guide](https://developers.google.com/my-business/content/location-data)
- [Google Business Profile OAuth](https://developers.google.com/my-business/content/implement-oauth)
- [Schema.org Organization](https://schema.org/Organization)
- [Schema.org LocalBusiness](https://schema.org/LocalBusiness)

## Adoption dashboard

The dashboard should show fact completeness, contradictions, stale values, structured-data validation, channel drift,
pending approvals, last successful publication, and connector health. It should not combine these scores with private
Databox activity or imply that an organization’s trustworthiness is reducible to a search/listing score.

## Future adapters

Additional directories, search engines, CMSs, merchant feeds, and open-data catalogs use the same projection and
approval contracts. Each adapter requires a current API/policy review before implementation; scraping or automated
account creation is not a fallback.

