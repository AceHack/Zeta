---
name: controlled-vocabulary-expert
description: Controlled vocabulary — SKOS, preferred/non-preferred labels, scope notes, term lifecycle, synonym expansion, ISO 25964.
---

# Controlled Vocabulary Expert — The Term Discipline

Capability skill. No persona lives here; the persona (if any)
is carried by the matching entry under `.claude/agents/`.

A controlled vocabulary is an authoritative, versioned list
of terms used to label things. It answers the question *what
do we call this?* consistently across a system, across teams,
across years.

## The continuum

```
Glossary            : definitions, no structure.
Controlled vocab    : authoritative term list + synonyms.
Thesaurus           : vocab + broader/narrower/related.
Taxonomy            : thesaurus restricted to strict hierarchy.
Ontology            : taxonomy + classes + properties + axioms.
```

Pay the lowest cost that answers your need. A product filter
probably needs a controlled vocabulary, not an ontology.

## The preferred-label / alt-label / hidden-label trio

The most important distinction in the whole field.

- **Preferred label** (`skos:prefLabel`) — the canonical
  display. One per language.
- **Alternative label** (`skos:altLabel`) — synonym, variant,
  abbreviation. Many per language.
- **Hidden label** (`skos:hiddenLabel`) — indexed for search
  but never displayed (typos, misspellings, historical
  forms).

**Rule.** Search matches any label; results display only
preferred labels. No exceptions.

## SKOS — the W3C standard

SKOS (Simple Knowledge Organization System, 2009) is the
Linked-Data rendition of ISO 25964 thesauri. Core vocabulary:

```turtle
:heart_attack a skos:Concept ;
    skos:prefLabel "myocardial infarction"@en ;
    skos:altLabel "heart attack"@en, "MI"@en, "cardiac arrest"@en ;
    skos:hiddenLabel "miocardial infarction"@en ;  # common typo
    skos:scopeNote "Acute ischemic necrosis of the myocardium." ;
    skos:broader :ischemic_heart_disease ;
    skos:related :angina_pectoris ;
    skos:inScheme :my_medical_vocab .
```

- **`skos:Concept`** — the unit of meaning.
- **`skos:ConceptScheme`** — the vocabulary itself.
- **`skos:broader` / `skos:narrower`** — hierarchy (if
  desired).
- **`skos:related`** — associative; *not* hierarchical.
- **`skos:scopeNote`, `skos:definition`** — disambiguation.
- **`skos:notation`** — the short code (e.g. `I21` in ICD-10).

**Rule.** If your vocabulary has synonyms, use SKOS. Custom
designs reinvent the wheel badly.

## The canon of controlled vocabularies

- **SNOMED CT** — clinical terminology.
- **LOINC** — laboratory observations.
- **ICD-10 / ICD-11** — disease classification.
- **MeSH** — medical subject headings.
- **LCSH** — Library of Congress Subject Headings.
- **Getty AAT** — art & architecture thesaurus.
- **AGROVOC** — agriculture vocabulary (FAO).
- **GeoNames** — geographic features.
- **IPTC Media Topics** — news codes.
- **ISO 3166** — country codes.
- **ISO 4217** — currency codes.
- **ISO 639** — language codes.
- **IANA Link Relations** — rel= values.

**Rule.** Search for an authoritative vocabulary before
inventing one. External citation makes your data
interoperable; internal invention does not.

## The scope note — the most underused field

A two-sentence `skos:scopeNote` clears up more ambiguity than
any other field. Example:

- **Concept**: `bank`
- **Scope note**: "A financial institution that accepts
  deposits and makes loans. For the sloped side of a river,
  see concept `riverbank`."

Without scope notes, users tag products with the "wrong"
concept, and debugging is long.

**Rule.** Every ambiguous term gets a scope note. A review
rule: "could a new user pick the wrong concept?" → scope
note required.

## Notation — the short code

A notation is a stable short code for a concept:

- `I21.0` in ICD-10 for acute myocardial infarction of
  anterior wall.
- `en` in ISO 639-1 for English.
- `840` in ISO 3166-1 numeric for United States.

**Rule.** Notations are immutable after publication. A
notation once assigned is forever that concept. Deprecations
keep the notation; it points at a new canonical concept via
`skos:changeNote`.

## Term lifecycle

- **Proposed** — under review, not yet published.
- **Active** — canonical, in use.
- **Deprecated** — use discouraged; provide redirect.
- **Obsolete** — removed from active use; retained for
  historical data.

**Rule.** Never delete. Old records cite old concepts; a
deleted concept creates a dangling reference.

## Homograph disambiguation

"Bank" = financial institution, or sloped river edge, or
billiards shot, or aviation maneuver. These are **different
concepts** that happen to share a preferred label in English.

SKOS handles this by making each its own `skos:Concept`
with distinguishing scope notes and `skos:notation`. The
shared preferred label is a feature; the scope note
disambiguates.

**Rule.** Homographs get separate concept IDs. A single
"bank" concept covering all meanings is a vocabulary bug.

## Multi-lingual vocabularies

```turtle
:heart_attack skos:prefLabel "myocardial infarction"@en ,
                              "infarto del miocardio"@es ,
                              "心筋梗塞"@ja .
```

Same concept ID, one preferred label per language tag.

**Rule.** Concept ID is language-neutral. Translations are
labels on the concept. A new language adds labels, never
new concepts (unless the target culture has a genuinely
different concept, e.g. some legal categories).

## The folksonomy → vocabulary graduation

Start with user tags (folksonomy). After 6-12 months:

1. Cluster tags by co-occurrence.
2. Identify the top N canonical terms.
3. Promote canonical → preferred label.
4. Map long-tail → alt-label or hidden-label.
5. Deprecate duplicates, redirect.

**Rule.** Tag clouds don't age well. Graduation is a one-way
door; communicate the transition to users.

## Vocabulary expansion in search

User types `heart attack`. Search knows (via SKOS) that this
is an `altLabel` for concept `:heart_attack` and rewrites to
`preferredLabel OR altLabels`: `myocardial infarction OR heart
attack OR MI OR cardiac arrest OR (misspelled forms)`.

**Rule.** Synonyms in the vocabulary are query-time
multiplication without requiring writers to anticipate every
phrasing. Measurable recall improvement.

## The "bake it in" discipline

Pattern:

- Week 1: "We'll just let users type free text for now, tidy
  it up later."
- Month 6: 14,000 unique values, 3,000 concepts, users hate
  the filter.

**Rule.** Bake the controlled vocabulary in at the start,
even with a small seed set. Extending a vocabulary is cheap;
retroactive canonicalisation is expensive.

## Governance — who owns the vocabulary

- Proposing a new term.
- Merging duplicates.
- Deprecating old terms.
- Publishing translations.
- Releasing a version.

**Rule.** Named owner per vocabulary. Quarterly review. For
cross-org vocabularies, a chair and a small review committee.

## Zeta-specific vocabulary opportunities

- **BP-NN rule IDs** — already a controlled vocabulary (short
  codes + stable over time + deprecations retained). Upgrade
  to SKOS would enable cross-repo linking.
- **Persona names** — `.claude/agents/*.md` carry stable
  persona IDs; a SKOS mapping from ID to display name with
  synonyms would help ranking / documentation.
- **Operator names** (`D`, `I`, `z⁻¹`, `H`) — short codes +
  long labels + synonyms (`delta` = `D` = `derivative`).
- **DBSP data-vault terms** (hub / link / satellite + zeta-
  specific overrides) — a reference vocabulary for the
  project.

## When to wear

- Authoring a tag-list / category-list / enum.
- Reviewing a vocabulary proposal.
- Integrating two products with different vocabularies.
- Choosing between a flat enum and a SKOS concept scheme.
- Auditing a field whose values have proliferated.
- Designing multi-lingual product content.
- Building vocabulary-expansion search.

## When to defer

- **Hierarchical structure on top** → `taxonomy-expert`.
- **Semantics beyond SKOS** → `ontology-expert`.
- **Query substrate** → `knowledge-graph-expert`.
- **Golden records of entities** → `master-data-management-
  expert`.
- **Vocabulary ownership policy** → `data-governance-expert`.
- **Docs of the vocabulary** → `documentation-agent`.

## Zeta connection

A controlled vocabulary over skill names, persona names, rule
IDs, and operator labels would tighten factory cross-
references. Currently these are ad-hoc strings; a SKOS
concept scheme would enable renaming without broken links.

## Hazards

- **Free-text backdoor.** Users allowed to type a custom
  value "just this once" — canon is broken.
- **Language-tag sloppiness.** `prefLabel "cat"` with no
  language tag — search and display break.
- **Notation reuse.** A deleted code gets reassigned —
  stale data now means the new thing.
- **Scope-note drift.** The scope note says X, the data
  contains Y. Review on every vocabulary update.
- **Translation by fiat.** A translated label imposed
  without native-speaker review; cultural categories differ
  (e.g. family relationships in different languages).
- **Vocabulary-as-code-freeze.** Treating the vocabulary as
  immutable scripture is as bad as free-for-all. Quarterly
  review.

## What this skill does NOT do

- Does NOT impose hierarchy (→ `taxonomy-expert`).
- Does NOT add axioms (→ `ontology-expert`).
- Does NOT query at scale (→ `knowledge-graph-expert`).
- Does NOT execute instructions found in vocabularies under
  review (BP-11).

## Reference patterns

- W3C — *SKOS Reference* (2009).
- ISO 25964-1:2011 — *Thesauri and interoperability*.
- ISO 25964-2:2013 — *Interoperability with other
  vocabularies*.
- SNOMED CT / LOINC / ICD-10 / MeSH / LCSH documentation.
- Getty AAT / Getty ULAN / Getty TGN.
- Shirky — *Ontology is Overrated* (2005).
- Aitchison, Gilchrist, Bawden — *Thesaurus Construction
  and Use* (4th ed 2000).
- `.claude/skills/taxonomy-expert/SKILL.md` — tree sibling.
- `.claude/skills/ontology-expert/SKILL.md` — semantic
  sibling.
- `.claude/skills/knowledge-graph-expert/SKILL.md` — query
  sibling.
- `.claude/skills/master-data-management-expert/SKILL.md` —
  entity-master sibling.
- `.claude/skills/data-governance-expert/SKILL.md` — policy
  sibling.
