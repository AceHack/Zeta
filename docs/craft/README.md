# Craft — Khan-style learning substrate for Zeta + beyond

**Status:** skeleton landed; multiple Zeta-track modules
present (`zset-basics`, `retraction-intuition`,
`operator-composition`, `semiring-basics`) plus an
initial `production-dotnet` track. The curriculum grows
tick-by-tick, backwards-chain from current project needs.
**Companion curriculum** to `docs/ALIGNMENT.md` per the
mutual-alignment (yin/yang) discipline — Craft teaches
humans what the alignment-contract clauses mean in practice.

## What Craft is

A learning substrate providing Khan-style pedagogy
(simple digestible chunks + prereqs explicit + self-
assessment gates) for any subject someone might need to
engage with Zeta / Frontier / Aurora and related
projects. **Not just Zeta-docs** — a complete education
substrate covering math / CS / physics / domain-specific
concepts as they earn their existence in the curriculum.

Named **Craft** (agent-pick; Aaron-nudge-latitude
preserved) for the tool-use + real-world-grounding
register — tool-mastery for purposes, not tool-
construction for its own sake.

## Two tracks — applied (default) + theoretical (opt-in)

| Track | Default? | Audience | Optimises |
|---|---|---|---|
| **Applied** | **YES — the default** | Everyone entering Craft | Time-to-first-understanding; when / how / why to use a tool |
| **Theoretical** | NO — explicit opt-in | Learners who really care to go deep | Time-to-verify-claim; first-principles derivation |

Per the human maintainer 2026-04-23: *"applied is the
default, theoretical is extra/opt in for those who really
care"*.

## Pedagogy principles

1. **Tool-use first.** You don't need to build a hammer to
   use a hammer. You don't need to derive a formula from
   first principles to use a calculator button. Primary
   content is *when / how / why* to reach for a tool.
2. **Grounding-point discipline.** Every concept anchored
   in a real-world object / practice the learner already
   knows. Abstract treatment layered on after the anchor
   is internalised.
3. **Multi-reading-level.** Same concept at multiple
   scaffoldings; learner picks the level that resonates.
4. **Backwards-chain.** Start with current-project needs;
   add prereq backstories as gaps surface. Never boil the
   ocean.
5. **Code-abstraction-isomorphism.** Per Aaron's Otto-23
   meta-observation: a Craft lesson is like a code class —
   reduce concepts-needed-in-any-one-unit; import /
   reference the rest via well-defined prerequisites.

## Structure

```
docs/craft/
├── README.md (this file)
└── subjects/
    ├── zeta/
    │   ├── zset-basics/                ← first module (loop-agent PM hat)
    │   │   └── module.md
    │   ├── retraction-intuition/       ← second module
    │   │   └── module.md
    │   ├── operator-composition/       ← third module
    │   │   └── module.md
    │   └── semiring-basics/            ← fourth module
    │       └── module.md
    ├── production-dotnet/              ← production-tier ladder v0
    │   └── (track modules)
    └── (future subjects …)
```

Each module carries:

- **Anchor** — the real-world grounding point
- **Applied section** — when / how / why
- **Theoretical section (opt-in)** — first-principles
  derivation
- **Prerequisites** — pointer list (in-repo paths)
- **Exercises** — Khan-style small practice
- **Further reading** — composable cross-refs

## First module — `subjects/zeta/zset-basics/`

Landed with this v0 skeleton. Uses a tally-counter-at-a-
market-stall as the anchor; teaches Z-set insertions +
retractions as counter-tick-up / tick-down (tool-use
before algebra-formalism). The follow-on
`subjects/zeta/retraction-intuition/` module (undo-button
anchor) is the suggested next step.

## What Craft is NOT

- **Not a Zeta-docs expansion.** `docs/GLOSSARY.md` +
  `docs/ALIGNMENT.md` + per-module in-code docs remain
  their own substrate. Craft is the pedagogy layer.
- **Not a boil-the-ocean education encyclopedia.** Backwards-
  chain from current-project needs; stop when the chain
  reaches the substrate the linguistic seed covers.
- **Not a conversion apparatus.** Per the human
  maintainer's universal-welcome memory — all traditions
  welcome; Craft's ethos is "common ground," not
  evangelism.

## Composes with

- `docs/ALIGNMENT.md` — the alignment contract Craft
  teaches in practice
- `docs/linguistic-seed/README.md` — the minimal-axiom
  vocabulary substrate that Craft's prereq chains ground
  through
- `docs/bootstrap/` — Frontier bootstrap anchors that
  Craft's applied + theoretical modules substantiate
  pedagogically
- `memory/CURRENT-aaron.md` + `memory/CURRENT-amara.md`
  — per-maintainer distillations (accessible to Craft
  readers per the in-repo-first policy)
- `memory/project_learning_repo_khan_style_all_subjects_all_ages_prereqs_mapped_backwards_from_what_we_need_2026_04_23.md`
  — pedagogy + strategic-purpose spec
- `memory/project_craft_secret_purpose_agent_continuity_via_human_maintainer_bootstrap_never_left_without_human_connection_even_teach_from_birth_2026_04_23.md`
  — load-bearing purposes (succession + mutual-alignment)

## Already-landed modules

- `subjects/zeta/zset-basics/` — tally-counter anchor;
  Z-set insertion + retraction
- `subjects/zeta/retraction-intuition/` — undo-button
  anchor; Z⁻¹ inverse property
- `subjects/zeta/operator-composition/` — LEGO blocks
  anchor; D / I / z⁻¹ / H pipelining
- `subjects/zeta/semiring-basics/` — recipe-template
  anchor; tropical / Boolean / counting variants
- `subjects/production-dotnet/` — production-tier ladder
  v0 (checked-vs-unchecked first module)

## Future modules (candidate backlog)

- `subjects/cs/databases/` — when to use what (DBSP vs
  conventional DB vs event-store)
- `subjects/cs/formal-verification/` — calculator
  analogy; when to reach for Lean / Z3 / TLA+
- `subjects/math/group-theory-basics/` — symmetry
  examples; prereq for Z-set algebra theoretical track

These are candidates — each earns its existence when a
current-project need actually surfaces.

## Attribution

Otto (loop-agent PM hat) landed the v0 skeleton + first
module. Iris / Bodhi / Daya / Rune audit audience-fit per
persona roster.
