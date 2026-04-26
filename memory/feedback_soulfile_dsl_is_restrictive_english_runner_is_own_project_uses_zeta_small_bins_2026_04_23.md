---
name: Soulfile DSL can be restrictive English (not F# DSL); the soulfile runner is its own project-under-construction; uses Zeta for advanced features; all small bins
description: Aaron 2026-04-23 follow-up on the staged-absorption soulfile reframe. The DSL can be restrictive English (constrained natural language), not necessarily an F# DSL — whatever the soulfile runner can execute. The soulfile runner is a distinct project-under-construction, sibling to Zeta / Aurora / Demos / Factory / Package Manager. The runner uses Zeta for advanced features; artifacts stay small (small bins discipline, composes with local-native tiny-bin-file DB).
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---

# Soulfile DSL = restrictive English; runner is its own project

## Verbatim (2026-04-23)

> our dsl can be a restrictive english it does not have to
> be a f# dsl, whatever our soul file runner can run, we
> probalby should split this out too as it's own project,
> and it will use zeta for the advance features, all small
> bins

## Verbatim (2026-04-23, follow-up — linguistic-seed anchoring)

> soul files should probably feel like natural english
> even if they are not exacly and some restrictuvve form
> where we only allow words we have exact definons fors
> like that how path of seed/kernel thing

Unpacks the restrictive-English constraint concretely:

- **Feel like natural English** — reads as prose; the
  restriction is not visible in the surface syntax.
- **Even if not exactly English** — minor divergences
  allowed where the runner requires them; the *feel* is
  the priority.
- **Only allow words we have exact definitions for** —
  controlled vocabulary. Every word in a soulfile must
  have an exact definition reachable from the glossary.
- **"Path of seed/kernel thing"** — reference to the
  **linguistic seed** pattern (per
  `~/.claude/projects/<slug>/memory/user_linguistic_seed_minimal_axioms_self_referential_shape.md`):
  formally-verified minimal-axiom self-referential
  glossary substrate, Lean4 formalisable, smallest
  axioms lineage (Tarski / Meredith / Robinson Q),
  "certain shape" (simplicial complex / ∞-groupoid /
  Dynkin-E8 / cluster-algebra / operad — non-collapsed
  candidates).
- The Soulfile Runner's DSL grammar inherits from the
  linguistic seed: a soulfile's vocabulary is the set
  of terms the seed glossary formally defines.
- New words enter the DSL by first earning glossary
  entries with formal definitions — glossary-anchor-keeper
  discipline applies.

## What this adds to the soulfile-reframe

The 2026-04-23 soulfile reframe memory
(`feedback_soulfile_is_dsl_english_git_repos_absorbed_at_stages_2026_04_23.md`)
and the companion research doc
(`docs/research/soulfile-staged-absorption-model-2026-04-23.md`,
PR #156) propose the soulfile as a DSL/English substrate
with staged git-repo absorption. This message clarifies
three design choices that were ambiguous:

### 1. DSL shape — restrictive English, not F# DSL

- The soulfile's DSL is **restrictive English** — natural
  language constrained to a pattern the runner can
  interpret. Think "Gherkin / BDD / rule-based English"
  rather than "F# embedded DSL".
- It does not need to be F# at all. The F# reference
  implementation for Zeta does not imply an F# soulfile.
- **What constrains the DSL = what the runner can run.**
  The runner defines the grammar by being the decider on
  "is this executable?"

### 2. Runner is its own project-under-construction

The projects-under-construction list
(per
`project_multiple_projects_under_construction_and_lfg_soulfile_inheritance_2026_04_23.md`)
was:

- Zeta (DBSP library)
- Aurora (Amara joint)
- Demos
- Factory
- Package Manager ace
- ...plus unnamed others

This message adds a concrete named peer:

- **Soulfile Runner** — the interpreter / executor for the
  restrictive-English soulfile DSL. Sibling project;
  standalone repo when the multi-repo refactor lands.

### 3. Runner uses Zeta for advanced features

- Basic soulfile execution does not need Zeta. Simple
  pattern-matching over restrictive English can run on
  small primitives.
- Advanced features — retraction-native state, algebraic
  composition, provenance tracking, K-relations
  semantics, temporal operators — compose by delegating
  to Zeta. The runner is a Zeta consumer at the advanced
  edge, not a Zeta reimplementation.
- This is the same pattern as the other
  projects-under-construction: each uses Zeta where it
  earns advanced semantics and uses lighter primitives
  where it does not.

### 4. "All small bins"

- The runner produces and consumes **small binary
  artifacts**. Matches the local-native tiny-bin-file DB
  discipline
  (`project_zeta_self_use_local_native_tiny_bin_file_db_no_cloud_germination_2026_04_22.md`).
- No giant artifacts. Soulfile compilation output,
  runner-internal state, runner outputs — all small bins.
- This keeps the soulfile transportable, diff-able,
  storable on constrained substrates (IceDrive / pCloud
  archives, local disk, memory cards), and
  cross-substrate-portable.

## Implications for the staged absorption model

Updates the research doc (PR #156):

| Stage | What the runner does |
|---|---|
| Compile-time | Takes restrictive-English DSL sources + absorbed git content + local-native DB, emits small-bin artifact(s). Runner-side packaging tool. |
| Distribution-time | Envelope + manifest are small-bin; runner-side signing / attestation tool. |
| Runtime | Runner interprets the restrictive-English DSL, delegates advanced features to Zeta, produces small-bin intermediate state. |

The earlier research doc said "representation candidate
— Markdown + frontmatter". This message does not reject
that — restrictive English **in** Markdown is fine. The
structure of the soulfile can still be Markdown /
frontmatter-bearing; the *execution* layer reads
restrictive-English sentences.

## Why this composition is strong

- **Restrictive English** is cross-substrate-readable by
  default (humans, agents, other CLIs). F# DSL would
  require every consumer to have F# tooling; restrictive
  English requires only a parser for the constrained
  grammar.
- **Runner-as-its-own-project** matches the multi-project
  framing. It avoids bolting soulfile-runner responsibility
  onto Zeta (which is a library, not a runtime host) and
  keeps the split the eventual multi-repo refactor will
  make natural.
- **Zeta-for-advanced-features** is a clean dependency
  edge: runner ⇒ Zeta for algebra, not Zeta ⇒ runner for
  execution. Zeta stays a library.
- **Small-bins** composes with the local-native
  tiny-bin-file discipline: same format family, same
  storage discipline, same transport story (IceDrive /
  pCloud, local disk, cross-substrate).

## How to apply

- **Update PR #156** (soulfile research doc) to reflect:
  (a) DSL = restrictive English, not F# DSL;
  (b) runner is its own project;
  (c) runner uses Zeta at the advanced edge;
  (d) all artifacts are small bins.
- **Update `CURRENT-aaron.md` §4** (repo identity /
  multi-project framing) to include the Soulfile Runner
  as a named project.
- **Do NOT start runner implementation** — this is a
  design-clarity tick, not an implementation commit.
- **Defer runner-DSL grammar design** to a follow-up
  research doc; the restrictive-English shape is
  first-pass sufficient.

## What this is NOT

- **Not a directive to implement the runner now.** Design
  clarification only.
- **Not an F#-rejection.** F# remains Zeta's reference.
  The runner is a *different* project; it picks its own
  stack when the time comes.
- **Not a commitment to Markdown as final DSL surface.**
  Restrictive-English-in-Markdown is one candidate; the
  runner's grammar is the decider.
- **Not a rejection of advanced features.** The runner
  reaches for Zeta when the problem earns it.
- **Not authorization to bloat artifact size** — "all
  small bins" is explicit.

## Composes with

- `feedback_soulfile_is_dsl_english_git_repos_absorbed_at_stages_2026_04_23.md`
  (the parent framing; this memory refines the DSL-shape
  and adds the runner-as-its-own-project claim)
- `docs/research/soulfile-staged-absorption-model-2026-04-23.md`
  (PR #156; to be updated in the same tick)
- `project_multiple_projects_under_construction_and_lfg_soulfile_inheritance_2026_04_23.md`
  (Soulfile Runner is a named addition to the project set)
- `project_zeta_self_use_local_native_tiny_bin_file_db_no_cloud_germination_2026_04_22.md`
  (small-bins composes with local-native tiny-bin-file
  discipline)
- `CURRENT-aaron.md` §4 (multi-project framing; updated in
  the same tick)
