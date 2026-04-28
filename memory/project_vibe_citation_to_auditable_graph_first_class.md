---
name: Citations are the first-class concept; inheritance-graph + drift-checker + "remember" primitive are implementations — Aaron 2026-04-20 "concepts are the feature, then we have the implementation"
description: Aaron 2026-04-20 architectural elevation with concept/implementation split. The first-class **concept** is citations-as-data — every cross-reference in the factory (repos, docs, specs, skills, commits, BACKLOG entries, research reports, memory, notebooks, ADRs, GOVERNANCE sections, BP-NN rules). Implementations the concept enables: (1) auditable inheritance graph, (2) drift-checker generalising `verification-drift-auditor` to all citations, (3) "remember" primitive for clean memory + easy audit, (4) lineage tracer. Home is either Zeta Seed kernel or `ace` (self-bootstrapping package manager). Same concept-vs-implementation split as DORA (concept=measurement-starting-point, implementation=ten outcome columns) and 4GS+RED+USE (concept=runtime-observability-starting-point, implementation=specific metric frames).
type: project
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---

Aaron 2026-04-20 (in order):
1. *"also ../scratch parity"*
2. *"first class feature of source or ace our package
   manager ../scratch parity converts the vibe-citation
   into an auditable inheritance graph"*
3. *"citations is really the feature"*

## The concept (first-class) and its implementations

**Concept (first-class, load-bearing):** Citations are
data. Every cross-reference in the factory — between
repos, docs, specs, skills, commits, BACKLOG entries,
research reports, memory files, notebooks, ADRs,
GOVERNANCE sections, BP-NN rules — is a **citation**
with structure. Making the factory's citations
queryable instead of prose is the feature.

**Implementations the concept enables (all valid, all
awesome, none is the concept itself — Aaron: "concepts
are the feature, then we have the implementation"):**

- **Auditable inheritance graph** — the original
  consequence that prompted this elevation.
  Nodes = patterns / artefacts; edges = relation
  (inherits-from / mirrored / diverged / should-flow-
  other-way / supersedes / implements / tests /
  reviews / reviewed-by / derived-from / see-also).
- **Drift-checker** — generalises
  `verification-drift-auditor` (currently catches
  drift between papers and Zeta formal artefacts) to
  every citation: when the target moves / vanishes /
  renames, the graph names the break.
- **"Remember" primitive** — Aaron 2026-04-20: *"i
  think that will help us 'remember' to keep things
  clean and audit more easy"*. Memory stops being a
  prose soup of "see also X somewhere" and becomes a
  queryable graph. Finding every citation of a
  retired doc is a query, not a grep.
- **Lineage tracer** — for any artefact, produce the
  citation-ancestor set. Same shape as DBSP
  retraction-native: every artefact is a function of
  its cited inputs + transformations.

## Citation shape

A citation has shape:

- **Subject** — where the citation lives (file path +
  line, or commit hash + line).
- **Object** — what is cited (path / URL / commit /
  paper DOI / repo@commit / symbol name).
- **Relation** — what kind of citation
  (inherits-from / follows-convention-of /
  borrowed-pattern / contradicts / supersedes /
  implements / tests / reviews / reviewed-by /
  derived-from / see-also).
- **Provenance** — timestamp + author + round.

## Where the concept lives (home for the implementations)

The citations-as-data concept needs a home. Candidates:

- **Zeta Seed kernel (`src/Core/`)** — graph-computation
  ships as BCL-level primitive, reusable for any pair of
  repos a consumer wants to check for parity. Composes
  with repos-as-data.
- **`ace`** (self-bootstrapping package manager from the
  Seed+Plugins architecture) — inheritance computed as
  part of the dependency graph; declarative parity is a
  specialisation of dependency parity. Ships as CLI +
  library.

Research phase picks the home. Implementation phase
ships the primitive.

## Why this matters

This is the same pattern-elevation Aaron applied twice
earlier in the same session:

- **DORA** — external anchor → starting point for
  measurement columns (build/delivery).
- **Four Golden Signals + RED + USE** — external
  anchors → canonical runtime columns.
- **`../scratch` inheritance graph** — vibe-citation →
  first-class feature of source or `ace`.

Pattern: **external / loose / cited → internal /
structured / computed**. Every such elevation buys
provability (drift becomes SAT, not sleuthing),
lineage traceability (every inheritance edge has a
commit hash), and pattern coherence (the factory
applies the same declarative-retractable-auditable
shape everywhere).

## How to apply

- **When any docs entry cites another repo / subsystem /
  environment as "same ethos"**, flag it. Either the
  citation becomes a graph entry, or it's a vibe-citation
  that belongs in prose not in architecture.
- **When writing the research output for the `../scratch`
  parity BACKLOG P1**, the output shape is *the graph
  format itself* — not a markdown inheritance list, but
  a data structure that can plug into the Seed kernel
  or `ace` primitive.
- **When `ace` gets designed** (future round), its
  dependency-graph primitive should accept inheritance-
  edge classifications natively, not treat dependency
  parity as a separate concept from pattern parity.
- **When the Zeta Seed public API lands** (post-v1 via
  Ilyana), consider whether the graph-computation
  primitive belongs in the kernel surface or in a
  named plugin.

## Composition with earlier directives

- `project_zeta_as_database_bcl_microkernel_plus_plugins.md`
  — the kernel+plugin architecture `ace` lives inside.
- `feedback_dora_is_measurement_starting_point.md` —
  sibling external→internal elevation (DORA columns).
- `feedback_runtime_observability_starting_points.md` —
  sibling external→internal elevation (4GS+RED+USE).
- `feedback_preserve_original_and_every_transformation.md`
  — same data-value rule applied to inheritance
  (preserve source, preserve every derivation).
- `user_rbac_taxonomy_chain.md` — another example of
  graph-as-first-class (Role→Persona→Skill→BP-NN chain).
- `docs/BACKLOG.md` P1 "`../scratch` ↔ `Zeta` declarative-
  bootstrap parity" — the BACKLOG entry this memory
  elevates.

## Why this beats a one-off research doc

A research doc is a snapshot. It goes stale the moment
either repo changes. An auditable graph is a function:
parity(`../scratch`@commit_A, `Zeta`@commit_B) = graph.
Every change to either repo re-computes the graph.
Drift surfaces on the next CI run, not on the next
audit-cadence invocation. This is gitops for patterns.

## What this does NOT mean

- Does not mean blocking the `../scratch` parity
  research entry on the Seed / `ace` implementation.
  Research phase runs first; the *output shape* is
  designed to feed the primitive, that's all.
- Does not mean every cross-repo citation becomes a
  graph. Citations that are genuinely one-off references
  stay prose. Citations that claim *inheritance* are
  what this rule targets.
- Does not mean the Seed kernel grows a new
  responsibility. The primitive may end up in `ace`,
  in a named plugin, or dropped as over-reach after
  phase-1 research. The elevation is a question, not a
  commitment.
