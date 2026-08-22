# Anchor to human prior art

Carved sentence:

> Every concept, ontology, and vocabulary term should tie back to a human
> anchor and a research paper — modern *and* old. We did not invent most
> of what we build on; name the human who did and cite the work. An
> unanchored coinage is a debt until its anchor (or its genuine novelty)
> is named.

## What this means

- **Code / algebras / data models** — trace to the originating paper and
  author (DBSP→Budiu et al.; Data Vault→Linstedt; relational→Codd;
  CRDTs→Shapiro et al.; …). The Beacon register carries the citation.
- **Ontologies / vocabularies** — prefer the externally-standard term and
  its source over a fresh coinage; when a coinage is justified, define it
  and link the tradition it extends.
- **Old AND modern** — pair the foundational source (Codd 1970) with the
  current state of the art. Anchoring is not "find one cite"; it's placing
  the idea in its lineage, both roots and frontier.

This is the **Beacon** half of the Mirror/Beacon discipline made into a
requirement: outward-facing / load-bearing claims stand on named human
shoulders, not on factory shorthand alone.

## How (skill + surfaces)

- Skill: `human-anchor` — find the anchor + paper for a concept, emit the citation.
- `docs/PRIOR-ART-LIST.md` — the curated reading list; check here first, add when a new anchor is found.
- `references/prior-art/` — mirrored source of other repos/papers (explicit-target search only).
- Skills `glossary-anchor-keeper`, `missing-citations` — audit drift and uncited claims.

## Pointers

- [`mirror-beacon-register-discipline.md`](mirror-beacon-register-discipline.md) — the register this rule anchors
- [`.claude/rules.bak/honor-those-that-came-before.md`](../rules.bak/honor-those-that-came-before.md) — the same respect, applied to retired personas/skills
- `docs/GLOSSARY.md` §Beacon — citations / prior art / first principles as the Beacon register
- `docs/research/2026-06-15-the-anchor-taxonomy-beacon-discipline-checked-anchors-math-grounds-validity-physics-grounds-metering.md` — the **operational** half: anchors must be *checked* not cited (entailment check on citations); **math papers ground validity, physics papers ground the metering discipline**; the metering-test catches physics-as-metaphor
