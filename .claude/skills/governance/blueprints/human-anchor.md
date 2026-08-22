---
name: human-anchor
description: Tie a concept, ontology, or vocabulary term back to the human who originated it and the research paper(s) — old and modern — that anchor it. Use when introducing or reviewing a coinage, algebra, data model, or vocabulary term that should stand on named prior art.
---

# Human Anchor

Capability skill. No persona. Owns the discipline that every concept we
build on traces to a **human anchor** + a **research paper** — both
foundational (old) and state-of-the-art (modern). This is the *how* behind
`.claude/rules/anchor-to-human-prior-art.md` and the Beacon half of
`.claude/rules/mirror-beacon-register-discipline.md`.

## When to wear

- Introducing a new term, algebra, operator, data model, or ontology.
- Reviewing a doc/spec/PR that asserts a concept in factory (Mirror)
  shorthand and needs a Beacon-grade anchor before it goes outward.
- A glossary or vocabulary entry lacks a cited lineage.
- A "we invented X" claim needs the prior-art check (usually we didn't).

## The procedure

1. **Name the concept in first principles.** Strip the Mirror coinage to
   what it actually is (e.g. "retraction-native IVM" → incremental view
   maintenance over a group/abelian structure).
2. **Find the human anchor.** Who originated it? Trace to the named
   author(s). Old root *and* modern frontier — e.g. relational (Codd
   1970) + current engine practice; DBSP (Budiu et al. 2023) over the
   IVM tradition.
3. **Check our curated surfaces first** before web search:
   - `docs/PRIOR-ART-LIST.md` — the reading list (papers + repos)
   - `references/prior-art/<project>/` — mirrored source (explicit-target search only; never a naive `grep -r .`)
   - `references/notes/` — existing notes
4. **Cite.** Author, title, venue, year, and a stable id (DOI/arXiv) when
   it exists. Pair old + modern where the lineage matters.
5. **Land the anchor.** Add/confirm the entry in `docs/PRIOR-ART-LIST.md`;
   put the citation in the Beacon-facing surface (glossary entry, doc,
   spec, public API doc). Mirror surfaces may keep the shorthand.
6. **If genuinely novel** — say so explicitly and name the closest prior
   art it departs from. "Novel" is a claim that itself needs the lineage
   it breaks from.

## Output shape

```
Concept:        <first-principles name>
Mirror term:    <our shorthand, if any>
Human anchor:   <author(s)>
Foundational:   <old paper — author, title, venue, year, id>
Modern:         <state-of-the-art — author, title, venue, year, id>
Prior-art-list: <added ✓ / already present ✓ / n/a>
Novelty:        <none | departs from <X> in <way>>
```

## Composes with

- `.claude/rules/anchor-to-human-prior-art.md` — the requirement this skill executes
- `.claude/rules/mirror-beacon-register-discipline.md` — Mirror (fast) vs Beacon (anchored)
- `.claude/rules.bak/honor-those-that-came-before.md` — same respect for prior contributors
- skills `glossary-anchor-keeper`, `missing-citations`, `paper-peer-reviewer`, `etymology-expert`
- `docs/PRIOR-ART-LIST.md`, `docs/TECH-RADAR.md`

> Taxonomy note: on the skills → blueprint-pack migration, this becomes a
> blueprint under the `governance` category (anchoring / citation discipline).
