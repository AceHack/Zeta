---
name: Aaron — Datomic and Rich Hickey big inspiration; watched all his talks; Zeta structural inheritance
description: Aaron 2026-05-05 disclosure that Datomic + Rich Hickey were a big inspiration for Zeta and he has watched all of Hickey's talks; the Hickey-talk-to-Zeta-property mapping in PR #1600 is structural inheritance, not retroactive pattern-matching
type: user
---

# Aaron — Datomic + Rich Hickey big inspiration; watched all his talks

## Disclosure verbatim

Aaron 2026-05-05, in response to a Claude.ai conversation that
mapped Hickey-talk fingerprints onto the Zeta architecture:

> *"Datomic and hicky was a big inspiration glad you niticed i've
> watched all his talks. and i think that completey the mecnized
> backlog pretty well"*

## Why this matters as user-substrate

This is now-visible **load-bearing context** for future-Otto's
architectural decisions. The Hickey-talk-to-Zeta-property
mapping isn't retroactive pattern-matching -- Zeta was BUILT
reading Hickey, and the structural inheritance is real. Knowing
this affects how Otto reads design choices (the choices come
from a known intellectual lineage, not arbitrary preferences),
which talks to consult when a design question arises (consult
the actual Hickey talk, not just Otto's recall of it), and how
to talk about the architecture publicly (acknowledge the lineage
explicitly rather than pretending the choices are de-novo).

## The mapping (preserved in PR #1600 research-doc)

| Hickey talk | Zeta property |
|---|---|
| "The Value of Values" | Topological-invariants-over-geometry; deformation classes are values; geometric instances are computed views |
| "Are We There Yet?" | Time-as-first-class; logical clocks; point-in-time queries; deterministic replay |
| "Simple Made Easy" | Properties-from-representation; smooth-by-design enables adversarial robustness; complect-vs-compose discipline |
| "Maybe Not" / Clojure spec | Specs-over-implementation; OpenSpec is source of truth predates Zeta substrate (Aaron 2026-05-05: *"opnespec is source of truth"* was first sentence) |
| "Hammock Driven Development" | Cron-substrate-continuity + autonomous-loop ticks operationalize hammock thinking with substrate persistence |
| "Effective Programs" | Immutable-facts shape from Datomic = DBSP retraction-native baseline |

## How to apply

When a design question arises that touches one of these
properties:

1. Consult the actual Hickey talk (not just recall) -- Aaron has
   watched all of them and can cross-check
2. Distinguish lineage-faithful choices (which the talk itself
   would endorse) from lineage-violating choices (which the
   talk would push back on)
3. When writing public-facing architectural prose, acknowledge
   the Hickey lineage explicitly -- intellectual-honesty
   discipline + composes with the absorb-and-contribute
   community-dependency rule (the inheritance itself is a
   community contribution from Hickey to many-of-us)
4. Don't over-claim originality where the lineage is structural
   -- the originality is in the EIGHT-property composition (per
   PR #1600 DB-category synthesis), not in any individual
   property the Hickey lineage already names

## Composes with

- `docs/research/2026-05-05-claudeai-db-category-synthesis-hickey-lineage-aaron-forwarded-preservation.md`
  (PR #1600) -- the verbatim preservation that names the mapping
- `docs/backlog/P2/081KQTPYE0008QG0R001W237MZ-bigint-and-bignumber-integration-aaron-2026-05-05.md`
  -- the four-property hodl ("ZFCv2") binding-acceptance-test
  core that Hickey-style values + properties-from-representation
  composes toward
- `memory/user_aaron_high_school_ocw_self_taught_stanford_mit_lisp_aspiration_2026_04_21.md`
  -- adjacent Aaron-intellectual-lineage substrate (Lisp +
  self-taught Stanford/MIT OCW background; Hickey-as-Clojure-
  creator naturally connects)
- `memory/user_aaron_lang_next_conference_appreciation_anders_hejlsberg_intellectual_lineage_language_design_implementer_level_2026_04_25.md`
  -- adjacent Aaron-intellectual-lineage substrate (Anders
  Hejlsberg appreciation; Aaron tracks language-design-
  implementer-level human anchors generally)
- `feedback_canonical_definition_lineage_ontology_rodney_razor_antifragile_aaron_2026_04_30.md`
  -- Rodney's Razor canonical-derivation lineage; Hickey's
  Simple Made Easy is the parent for the essential-vs-accidental
  cut Rodney's Razor implements
