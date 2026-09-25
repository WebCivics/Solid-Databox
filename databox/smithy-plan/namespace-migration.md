# Namespace migration to dev.linkeddata.au

## Canonical namespaces

- Solid-Databox core: `https://dev.linkeddata.au/def/solid-databox#`
- Welfare coordination: `https://dev.linkeddata.au/def/welfare#`
- Vocabulary documents: `https://dev.linkeddata.au/def/solid-databox` and
  `https://dev.linkeddata.au/def/welfare`

These IRIs replace the provisional `https://w3id.org/solid-databox/ns#` and the previously proposed
`https://ns.webcivics.net/` root for new work. Existing records retain their original IRIs. A migration context or
explicit OWL/SKOS mapping can bridge stable equivalent terms after term-by-term review; bulk `owl:sameAs` is
prohibited.

The `dev.linkeddata.au` host must provide persistent HTTPS dereferencing and content negotiation for HTML, Turtle,
and JSON-LD before the vocabulary is described as published. Repository files alone do not make the namespace
resolvable.

## Upstream alignment

The `mediaprophet/solid-databox` README and ReSpec vocabulary currently name the `w3id.org` provisional namespace and
the older WebCivics corpus. An upstream change must update the README, ReSpec prefix tables, examples, contexts,
resource vocabulary, CSS implementation documents, and generated artifacts together. This repository records the
new direction but does not silently rewrite that separate checkout.

