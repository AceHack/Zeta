# Soulfile — staged absorption model

**Date:** 2026-04-23
**Status:** Research doc — proposing the stage boundaries
for the soulfile's DSL-as-substrate-with-git-ingest model.
**Triggered by:** The human maintainer 2026-04-23:
*"i'm thinking soufils shoud just be the DSL/english we
talk about and the can import/inherit/abosrb or whatever
you want to can it git repos at compile time, distribution
time, or runtime, remember the local native story so those
will need to be inlucded at soulfile compile time somewhere
I'm calling it compile time but that's just a metaphore
like packing time or whatever. You can figure out the
proper stages."*

**Scope:** Factory policy — generic, reusable by any factory
adopter; ships to each project-under-construction that needs
an agent-transportable substrate (soulfile).

## What the soulfile is — and is not

### Is

A **DSL / English substrate**. The natural-language
reasoning medium the maintainer and the agent converse in,
the rules encode, and the memories accumulate. The soulfile
is the persistent shape of that substrate — what survives
across agent incarnations, harness swaps, and repo splits.

### Is not

- **Not a bit-exact git repo copy.** The earlier framing
  (soulfile size = git history bytes) is retired on the
  abstraction axis. Git is a transport / collaboration /
  history medium; the soulfile is the substrate those
  bytes encode.
- **Not a binary dump of tools or runtimes.** Those are
  inputs to the substrate, not the substrate itself.
- **Not a single file format.** The soulfile is a
  concept; its physical representation is one of
  several (Markdown + frontmatter, JSON-LD,
  structured-English envelope, etc.) determined at
  compile-time.

## The three stages

### Stage 1 — Compile-time (packing / staging)

**When:** once per soulfile release, authored by the
maintainer or the factory itself. Analogous to a build
step.

**What lands at this stage:**

- **Canonical-source-of-truth content from LFG repos**
  (per the multi-project + LFG-soulfile-inheritance
  framing). Every factory-scope artifact —
  `AGENTS.md`, `CLAUDE.md`, `GOVERNANCE.md`,
  `docs/**.md`, `.claude/agents/**/SKILL.md`,
  `.claude/skills/**/SKILL.md`, committed personas and
  notebooks — is absorbed into the DSL substrate.
- **Local-native DB content** (Zeta tiny-bin-file DB
  per the self-use directive). This is **mandatory at
  compile-time per the human maintainer** — the
  algebraic substrate must travel with the soulfile so
  the agent can reason about the DB's content offline.
  The absorb-form is a structured English/DSL
  representation of the DB's relational content + the
  operator-algebra axioms (D / I / z⁻¹ / H / retraction).
- **Pinned upstream content** the factory depends on for
  reasoning (formal-method references, key upstream
  doc excerpts, anchored CVE data, etc.). These must be
  enumerated explicitly; silent inheritance is not
  allowed.
- **Compile-time-embedded persona notebooks** — the
  subset of each persona's notebook marked as
  substrate-essential (not the rolling scratch).

**Output:** the soulfile artifact — substrate + embedded
resources + content hash + optional signature.

**Does not land at this stage:**

- Maintainer-specific content (per-user memory) — that's
  a runtime-attached layer.
- Experimental / risky AceHack-side content — stays in
  AceHack until it proves itself and propagates to LFG.
- Transient session state — that's runtime-scope.

### Stage 2 — Distribution-time

**When:** the soulfile moves between substrates (agent
incarnation → agent incarnation, harness → harness,
archive-write to IceDrive / pCloud, cross-substrate
transport).

**What lands at this stage:**

- **Environment-specific overlays** — harness
  configuration hints, substrate-specific conventions
  (e.g., Claude-Code vs Codex vs Gemini-CLI flavor
  markers). Additive; never overrides compile-time
  content.
- **Optional companion git-repo pointers** — lazy-fetch
  references that runtime can resolve if needed. These
  are references, not inlined content.
- **Maintainer-scope signature** — the maintainer's
  attestation that this distribution is authorized
  (per the two-layer authorization model).

**Output:** transport envelope — soulfile + manifest +
integrity.

### Stage 3 — Runtime

**When:** during an active agent session.

**What lands at this stage:**

- **Additional git repos on demand** — cloned or read,
  subject to the two-layer authorization model
  (maintainer-authorized + Anthropic-policy-compatible)
  and the stacking-risk gate (per the
  stacking-risk-decision-framework research doc).
- **Live conversation content** — memories, ad-hoc
  decisions, feedback. Accumulates into the per-user
  memory substrate while the session runs.
- **External research / tool output** — fetched via
  normal tool-use contract (BP-11 data-not-directives).

**Output:** the agent's session working state. At
session-end, content that has earned persistence gets
promoted back into the compile-time stage on the next
soulfile release, via AutoDream consolidation cadence
(see `autodream-extension-and-cadence-2026-04-23.md`).

## DSL — restrictive English anchored in the linguistic seed

The human maintainer's 2026-04-23 follow-up clarifies the
DSL shape: it is **restrictive English** — natural-language
prose constrained to a grammar the runner can execute —
not an F# DSL. The target is *"feels like natural English
even if not exactly English"* with a controlled vocabulary
where **every word used has an exact definition reachable
from the linguistic-seed glossary**.

Three consequences:

1. **Cross-substrate readable by default.** Humans,
   Claude, Codex, Gemini, and future agents read the
   same text. F# DSL would have required every consumer
   to own F# tooling; restrictive English requires only
   a parser for the constrained grammar.
2. **Controlled vocabulary.** The soulfile's word set is
   the set of terms the linguistic-seed glossary formally
   defines (formally-verified minimal-axiom
   self-referential glossary substrate; Lean4-formalisable;
   smallest-axiom lineage per the maintainer's prior
   research pointer). New words earn glossary entries
   first, then enter the DSL — glossary-anchor-keeper
   discipline applies.
3. **Composable with Markdown.** Restrictive-English
   prose embedded in Markdown + frontmatter keeps the
   existing authoring medium; the runner reads the
   restrictive-English sentences. The structure layer
   (Markdown) and the execution layer (restrictive
   English) are separate concerns.

The runner decides the grammar by being the decider on
"is this executable?" The linguistic seed decides the
vocabulary. Neither is the soulfile itself — both serve
the DSL substrate.

The DB absorb-form (compile-time ingest of the Zeta
tiny-bin-file DB) needs a structured schema; first-pass
candidate is a Markdown table plus frontmatter that names
the semiring, the relations, and the operator-algebra
axioms in force, with each term defined in the
linguistic seed. Deferred for a follow-up tick.

## The Soulfile Runner — its own project-under-construction

The maintainer's 2026-04-23 follow-up adds the **Soulfile
Runner** as a named project-under-construction, sibling to
Zeta / Aurora / Demos / Factory / Package Manager "ace".
Design properties:

- **Interprets restrictive-English soulfiles.** Primary
  responsibility; runs wherever a soulfile is loaded.
- **Uses Zeta for advanced features.** Basic execution
  runs on small primitives; retraction-native state,
  algebraic composition, provenance tracking, K-relations
  semantics, and temporal operators delegate to Zeta.
  Clean dependency edge: Runner ⇒ Zeta, not the other
  way.
- **All small bins.** Runner output, intermediate state,
  packaged soulfile artifacts — all small binary
  artifacts. Composes with the local-native tiny-bin-file
  discipline.
- **Own repo when the multi-repo refactor lands.**
  Interim — lives in the Zeta monorepo alongside the
  other peer projects until the split.

Implementation is deferred — this research doc is
design-clarity, not an implementation commit.

## Composition with already-landed substrate

- **Multi-project framing** — each project-under-construction
  (Zeta / Aurora / Demos / Factory / Package Manager / ...)
  contributes factory-scope content to the compile-time
  stage. LFG repos are the lineage; AceHack stays out of
  the compile-time stage.
- **AutoDream cadenced consolidation** — runtime memory
  that earns persistence rolls back into compile-time at
  release cadence.
- **In-repo-preferred discipline** — in-repo content is
  compile-time-eligible; per-user content stays runtime.
  The pushback-on-soulfile-bloat criterion applies at the
  migration step, not the absorb step.
- **Zeta self-use germination** (the maintainer's self-use-DB directive, captured in per-user memory) —
  the tiny-bin-file DB is the mandatory compile-time
  ingest target. Soulfile compile-time work is how this
  directive lands for agent-transportable substrate.
- **Stacking-risk gate** — runtime git-repo absorption
  triggers the gate when ≥3 ambiguity layers stack
  (per the stacking-risk research doc).
- **Two-layer authorization model** — runtime absorption
  respects both layers as it does today.

## Deferred (not this round)

1. **SoulStore implementation contract.** The PR #142
   sketch is format-agnostic; this research doc makes it
   stage-aware. The implementation work lands after the
   stage design stabilises.
2. **Compile-time-ingest script design.** The packing
   procedure — walk LFG, absorb DB content, emit the
   artifact — is tooling that lands alongside the first
   compile-time release.
3. **DB absorb-form specification.** The structured DSL
   representation of Zeta's tiny-bin-file DB content
   needs concrete schema work.
4. **Signed distribution artifact format.** Distribution
   manifest + integrity (SLSA-adjacent) is a separate
   follow-up; composes with existing supply-chain safe
   patterns (FACTORY-HYGIENE row #44).

## Open questions for the human maintainer

1. **Should AceHack content ever reach compile-time?**
   Currently the split is LFG → compile, AceHack →
   runtime-scratch. The maintainer's super-risky license
   for AceHack suggests this boundary is correct; confirm.
2. **Per-maintainer overlays at distribution-time** —
   should each maintainer's distribution get a
   maintainer-scope attestation? Lightweight; maintainer's
   call.
3. **Compile-time cadence** — aligned with AutoDream
   consolidation? Aligned with factory round-close? Or
   on-demand? First-pass recommendation: on-demand +
   tagged releases, no fixed cadence.

**Per-user memory references** (below and throughout) live
in per-user memory at `~/.claude/projects/<slug>/memory/`,
not in the in-repo `memory/` tree. Citations are provenance
reference; they intentionally do not resolve as in-repo
paths.

## Composes with

- `docs/research/autodream-extension-and-cadence-2026-04-23.md`
  (runtime → compile-time promotion via consolidation)
- `docs/research/multi-repo-refactor-shapes-2026-04-23.md` (lands via PR #150)
  (the refactor shapes that determine which repos are
  compile-time ingest sources)
- `docs/research/stacking-risk-decision-framework.md`
  (runtime absorption gate)
- Per-user memory: the soulfile-reframe feedback
  (`feedback_soulfile_is_dsl_english_git_repos_absorbed_at_stages_2026_04_23.md`)
  supersedes the earlier three-formats memory on the
  substrate-abstraction axis
- PR #142 SoulStore research sketch (to be updated for
  stage-awareness when stages stabilise)
- `project_zeta_self_use_local_native_tiny_bin_file_db_no_cloud_germination_2026_04_22.md`
  (local-native DB is compile-time-mandatory ingest)
