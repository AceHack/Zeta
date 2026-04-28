---
name: Glossary needs splitting — factory-layer vs system-under-test layer; same portability cleave as hygiene / BP-NN / resume
description: 2026-04-20 — Aaron: "gonna need to split the glossary too into system under test and factory". The factory ships a glossary of its own terms (round, skill, persona, BP-NN, architect-bottleneck, spec, absorption, alignment contract, consent-first, retraction — in the factory-metaphor sense); any system-under-test (currently Zeta DB) ships its own glossary of domain terms (Z-set, D/I/z⁻¹/H, DBSP, circuit, operator, delta, IVM, retraction — in the DB-domain sense). Same bifurcation running through hygiene (project/factory/both), BP-NN (generic vs `project: zeta`), resume (FACTORY-RESUME vs SHIPPED-VERIFICATION-CAPABILITIES).
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---

# Rule

The glossary bifurcates along the same cleave as the rest of
the factory-reuse work:

- **`docs/GLOSSARY.md` (factory-layer)** — terms that belong
  to the factory substrate itself. Defined once; portable
  across any project that adopts the factory. Examples:
  `round`, `skill`, `persona` / `expert`, `BP-NN`,
  `architect-bottleneck`, `absorption`, `alignment contract`,
  `consent-first`, `tiebreaker`, `axiom`, `alive` (factory
  sense), `symmetric talk`, `meta-win`, `scope tag`.
- **`docs/SYSTEM-UNDER-TEST-GLOSSARY.md` (SUT-layer,
  currently Zeta DB)** — terms that belong to the project
  the factory is helping build. For the Zeta DB, that is
  the DBSP operator algebra and the DB-side retraction
  vocabulary. Examples: `Z-set`, `D` (differentiate), `I`
  (integrate), `z⁻¹` (delay), `H` (higher-dim lift),
  `DBSP`, `IVM`, `circuit`, `operator`, `delta`,
  `retraction` (in the DB sense of a negative-weight
  delta), `spine`, `tick`, `ZSet`, `Pipeline`.

The file *name* for the SUT glossary is generic
(`SYSTEM-UNDER-TEST-GLOSSARY.md`) so a second adopter could
also publish one under the same filename in their repo; the
file *content* is project-specific and carries the
`project: zeta` frontmatter tag.

Some terms overload. `spec`, `retraction`, `spine`, `delta`,
`round` all have distinct factory and DB meanings. These are
**bridge terms**: each glossary defines its own sense; the
cross-reference is explicit on both sides ("see the other
glossary for the DB sense of this term"). The overload itself
is documented, not elided.

# Why:

Verbatim (2026-04-20):

> *"gonna need to split the glossary too into system under
> test and factory"*

This is the same portability cleave that has been running
through the round in every other artefact surface:

| Surface | Factory side | System-under-test side |
|---|---|---|
| Hygiene (`docs/FACTORY-HYGIENE.md`) | `factory` scope rows | `project` scope rows |
| BP-NN rules (`docs/AGENT-BEST-PRACTICES.md`) | generic BP-NN | `project: zeta` frontmatter |
| Resume (this round) | `docs/FACTORY-RESUME.md` (me) | `docs/SHIPPED-VERIFICATION-CAPABILITIES.md` (what I ship) |
| Skills (`.claude/skills/`) | generic skills | `project: zeta` tagged skills |
| Glossary | `docs/GLOSSARY.md` (terms I use) | `docs/SYSTEM-UNDER-TEST-GLOSSARY.md` (terms Zeta defines) |

The missing glossary split was the gap. Two failure modes it
removes:

1. **Adopter confusion.** A greenfield adopter reads
   `docs/GLOSSARY.md` today and has to reverse-engineer which
   terms are about *the factory itself* vs which terms are
   about *Zeta DB*. When the SUT changes (or a second adopter
   shows up), all the DBSP entries are junk to them. The split
   makes the factory glossary copy-paste-useful to adopter #2.
2. **Bridge-term ambiguity.** The factory uses `retraction` to
   mean "reversing an earlier conclusion / rolling back a
   commit / undoing an absorption." The DB uses `retraction`
   to mean "a negative-weight Z-set delta." Without the split,
   the glossary entry has to hedge both senses inside one
   definition, which is the exact problem the glossary is
   supposed to fix. Split = each entry stays precise.

This is also consistent with the **glossary-as-tiebreaker**
rule (`feedback_glossary_as_tiebreaker_axioms_decide.md`).
If the glossary is the tiebreaker, it must be unambiguous
about *which layer* the disputed term belongs to. Splitting
is part of making the tiebreaker usable.

# How to apply:

- **Create `docs/SYSTEM-UNDER-TEST-GLOSSARY.md`** with a
  `project: zeta` frontmatter marker and move the DB-domain
  entries from `docs/GLOSSARY.md` into it. This is a
  mechanical migration of about 30-40 entries
  (Z-set, D/I/z⁻¹/H, DBSP, circuit, spine, operator,
  delta, tick, pipeline, retraction-as-delta, …).
- **`docs/GLOSSARY.md` keeps factory terms** plus bridge-
  term-entries that point to the SUT glossary for the
  domain sense. Example: the factory `retraction` entry
  stays; it ends with *"For the DB / DBSP sense
  (negative-weight Z-set delta), see
  `docs/SYSTEM-UNDER-TEST-GLOSSARY.md`."*
- **Frontmatter declares layer.** Both glossaries get YAML
  frontmatter (`layer: factory` vs `layer: sut, project: zeta`)
  matching the scope-column pattern elsewhere.
- **Plain-English-first stays the rule.** The grandparent
  test in the current GLOSSARY.md header applies to both
  files. Splitting doesn't license either glossary to
  drift into jargon-only mode.
- **Tiebreaker protocol names both.** When the tiebreaker
  rule fires, the agent says which glossary it's
  consulting. "Per the factory glossary's `round`" vs
  "per the Zeta SUT glossary's `tick`" is the expected
  precision.
- **Cross-reference section.** A dedicated "bridge terms"
  section in both files lists the overloaded terms
  (`spec`, `retraction`, `spine`, `delta`, `round`) with
  pointers to each side's definition. Saves an adopter
  the hunt.
- **Adopter #2 copy path.** When a hypothetical second
  adopter shows up, `docs/GLOSSARY.md` copies as-is;
  `docs/SYSTEM-UNDER-TEST-GLOSSARY.md` is replaced
  entirely with that project's domain terms. This is the
  whole point of the split.

# Relation to `feedback_glossary_as_tiebreaker_axioms_decide.md`

The tiebreaker rule already references the glossary as
tier-1. The split makes the tier-1 reference specific:

- disputes about factory-layer terms (`round`, `axiom`,
  `alive`, `skill`, `persona`) → `docs/GLOSSARY.md`
- disputes about SUT-layer terms (`Z-set`, `circuit`,
  `retraction-as-delta`) → `docs/SYSTEM-UNDER-TEST-GLOSSARY.md`
- disputes about bridge terms → both glossaries
  consulted; often the disambiguation is *which layer the
  speaker meant* and the bridge-term cross-reference
  settles it immediately.

# What this rule does NOT do

- It does NOT merge all project-scoped content into the
  SUT glossary. Project-scoped *hygiene* still lives in
  FACTORY-HYGIENE.md with a `project` scope tag, not in
  the glossary. Scope cleaves are per-artefact.
- It does NOT require symmetric term counts. Factory
  glossary will likely be smaller than the SUT glossary
  for a technical project like Zeta; that's expected.
- It does NOT license silent term drift. Any term that
  exists in both files must cross-reference the other.
- It does NOT happen this turn. This memory encodes the
  rule; the mechanical migration (`GLOSSARY.md` split)
  is a BACKLOG item that wants Architect review because
  it's a large edit to a reference-grade doc.

# Connection to other artefacts

- `project_factory_reuse_beyond_zeta_constraint.md` — the
  portability constraint this split serves.
- `feedback_glossary_as_tiebreaker_axioms_decide.md` —
  the tiebreaker rule that now resolves to a specific
  layer.
- `feedback_shipped_hygiene_visible_to_project_under_construction.md`
  — the hygiene-layer manifestation of the same cleave.
- `feedback_factory_resume_job_interview_honesty_only_direct_experience.md`
  — the resume-layer manifestation of the same cleave
  (FACTORY-RESUME vs SHIPPED-VERIFICATION-CAPABILITIES).
- `docs/GLOSSARY.md` — the current combined artefact to
  be bifurcated.
- `docs/SYSTEM-UNDER-TEST-GLOSSARY.md` — the
  new-to-create sibling file.
- `feedback_persona_term_disambiguation.md` — the
  "persona" overload already called out; factory-side
  lives in `docs/GLOSSARY.md` after the split.
