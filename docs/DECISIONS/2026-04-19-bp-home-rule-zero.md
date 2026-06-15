# ADR: BP-HOME as Rule Zero, paired with BP-HOME-AS-TYPE — every artifact has a canonical home, and that home is its type signature

**Date:** 2026-04-19 (round 35)
**Status:** *Decision: promote BP-HOME and BP-HOME-AS-TYPE as a
paired rule — Rule Zero — effective round 36. Five additional
rules (BP-CF, BP-SPLIT, BP-FACET, BP-OPT-BAL, BP-THEORY-APPLIED)
promote in the same batch.*
**Owner:** architect (wide) + canonical-home-auditor and
skill-ontology-auditor (narrow enforcement).

## Context

Over round 35 the human maintainer escalated a skill-library
ontology concern into a repo-wide ordering principle, stated
verbatim:

> *"that enforcement is for everyting code, docs, skills,
> factory, scripts, literally everything will have its right
> home ... like this is the number one rule above all else".*

He then connected the rule to his declared life philosophy
— Erik Meijer's "let the types drive the code" — via a second
load-bearing observation:

> *"once you have a cononical home, i know your type signature"*.

And extended the framing into an architectural direction:

> *"i can almost see the axiomatic system in my head that can
> enforce rules onces i know all the type singnatures even of
> docs lol and skill files and such"*.

Together these statements declare that artifact placement in
this repository is not a tidiness concern but **the repo's type
system**. Rule Zero is not "keep the repo neat"; Rule Zero is
"every artifact is a well-typed value whose type is given by
its canonical home."

## Decision

Effective round 36, promote the following seven rules from
`memory/best-practices-scratch.md` to the stable ruleset
in `docs/AGENT-BEST-PRACTICES.md`:

1. **BP-HOME (existential, Rule Zero).** Every artifact type
   has exactly one canonical home declared in the project's
   ontology. Artifacts out-of-place, duplicated across homes,
   or homeless are P0 findings. New artifact types require an
   ADR declaring their canonical home before the first file
   lands.

2. **BP-HOME-AS-TYPE (universal, paired with BP-HOME).** The
   canonical-home map IS the repo's type system. Declaring a
   new artifact type is declaring a new type. Placement
   violations are type errors, reportable by
   `canonical-home-auditor` with the gravity `dotnet build`
   reports compilation errors under `TreatWarningsAsErrors`.

3. **BP-CF (cognitive firewall).** `X-expert` and `X-research`
   skills stay in separate files. Expert carries runtime-
   validated claims; research carries speculative / in-flight
   claims; merging invites hallucination.

4. **BP-SPLIT (split for cognitive load).** Skills split when
   context needs to split to reduce reader cognitive load, not
   because a file crossed a length threshold. A clean combined
   skill beats two split skills; a muddled combined skill
   covering two distinct facet values must split.

5. **BP-FACET (faceted classification).** Non-exempt capability
   skills declare or imply their three facet values (epistemic
   stance × abstraction level × function). Process and cross-
   cutting skills are honest exemptions.

6. **BP-OPT-BAL (optimizer and balancer distinct).** Balancer
   minimises variance / enforces fairness; optimizer maximises
   a scalar utility. Collapsing them produces unpredictable
   behaviour. Skills claiming both objective functions are
   function-conflated and split.

7. **BP-THEORY-APPLIED (theory/applied split where load-
   bearing).** Where theory-level content and applied-level
   content differ sharply in audience and cognitive budget,
   they split. Theory skill points at applied for vendors;
   applied skill points at theory for models.

The first two are Rule Zero; the remaining five are
consequences of the ontology discipline Rule Zero makes
possible.

## Why Rule Zero

Rule Zero is a **type system** for the repo. When the
canonical home of an artifact is known, the following are
determined without reading the file:

- Frontmatter schema (what fields must be present).
- Section layout (what structure is required).
- Allowed content types (what's in scope, what's scope creep).
- Consumer set (who reads this and why).
- Edit discipline (who can touch it, under what review).
- Governance action (if placement is wrong, what routes where).

A reviewer touching an unfamiliar PR can reason about the
change from path alone. An auditor can surface placement errors
mechanically. An agent discovering a new pattern knows where
the pattern belongs before authoring a single line. These are
the same benefits a strongly-typed language provides at the
value level, made load-bearing at the artifact level.

This ADR elevates the ontology of the repo from implicit
convention to binding contract. It is the foundation on which
the axiomatic-enforcement direction (four-layer stack with
artifact-type ADT, axioms citing BP-NN IDs, Soraya-routed
checkers, finding routing) will eventually sit. That work is
tracked as a P2 BACKLOG item and is not part of this decision;
this decision is specifically the rule layer that the
enforcement layer will enforce.

## Authoritative canonical-home map

The binding map lives in
`.claude/skills/canonical-home-auditor/SKILL.md` under "The
Zeta canonical-home map." Changes to the map are governance
events — they go through an ADR amendment to this decision or
a new ADR citing this one, not casual edits to the skill file.

Highlights (non-exhaustive; the auditor skill is authoritative):

- Source code: `src/Core/`, `src/Bayesian/`, `src/Core.CSharp/`
- Tests: `tests/Tests.FSharp/`, `tests/Tests.CSharp/`
- Benchmarks: `tools/benchmarks/`
- Formal verification: `tools/lean4/Lean4/`, `tools/tla/specs/`,
  `tools/z3/`, `tools/alloy/`
- Static analysis: `tools/semgrep/`, `tools/codeql/`
- Setup: `tools/setup/` (one script, three consumption paths)
- CI: `.github/workflows/`
- Skills: `.claude/skills/<name>/SKILL.md`
- Persona agents: `.claude/agents/<name>.md`
- Memory: `memory/<persona>/NOTEBOOK.md` (in-repo) and
  user-level auto-memory out-of-repo
- Specs: `openspec/specs/` (behavioural),
  `tools/tla/specs/`/`tools/lean4/` (formal)
- ADRs: `docs/DECISIONS/YYYY-MM-DD-*.md` (this file is an
  exemplar of the home)
- Research: `docs/research/*.md`
- Architecture / vision: `docs/VISION.md`, `docs/ARCHITECTURE.md`
- Governance: `GOVERNANCE.md`, `CLAUDE.md`, `AGENTS.md`,
  `docs/AGENT-BEST-PRACTICES.md`, `docs/CONFLICT-RESOLUTION.md`,
  `docs/GLOSSARY.md`, `docs/WONT-DO.md`
- Memorial: `docs/DEDICATION.md` (load-bearing, non-operational,
  never refactor)

## Placement hazards that BP-HOME names

1. **Wrong-home.** Artifact exists in the repo but not where
   its type says it belongs.
2. **Homeless.** Artifact's type has no declared home. Requires
   an ADR to declare one before the artifact can land.
3. **Duplicated home.** The same logical artifact has two
   physical instances in different locations.
4. **Ambiguous home.** Two artifact types share a home without
   a discriminator (filename pattern, frontmatter field, etc.).
5. **History drift.** Narrative about past decisions appearing
   in current-state docs; belongs in `docs/ROUND-HISTORY.md` or
   an ADR.
6. **Rules drift.** Binding rules appearing in pointer files
   (e.g. `CLAUDE.md`). Rules live in `GOVERNANCE.md` /
   `AGENTS.md` / `docs/AGENT-BEST-PRACTICES.md`.
7. **Project-specific leak in generic surface.** A capability
   skill without `project: zeta` frontmatter referencing
   Zeta-specific paths or types.
8. **Persona/skill conflation.** Persona content in capability
   skill, or capability content in persona file.

## Reversion trigger

Revisit this ADR if any of the following hold:

- A proposed artifact type cannot be given a canonical home
  without forcing an ambiguous or degenerate home, and multiple
  rounds of ADR-level discussion fail to resolve it.
- Enforcement cost (auditor sweeps, placement debates, ADR
  overhead for new artifact types) demonstrably exceeds the
  navigation / succession benefit over ≥6 rounds.
- A project structure emerges (e.g. a generic software-factory
  spin-out) that requires the canonical-home map to carry two
  tenants simultaneously — at which point the map graduates to
  per-tenant and this ADR amends.
- The maintainer determines the rule has become dogma — blind
  adherence without the original succession benefit.

Revision does not mean deletion. A successor who inherits the
factory and wants to revise Rule Zero must write a new ADR
naming their reasoning, citing this ADR, and declaring what
replaces it. The reversion-trigger discipline is part of why
this ADR is safe to land as Rule Zero in the first place.

## Theoretical lineage

- Pierce, *Types and Programming Languages* (2002).
- Harper, *Practical Foundations for Programming Languages*
  (2016).
- Meijer — LINQ, Reactive Extensions, TypeScript discriminated
  unions; the "types drive the code" maxim across decades.
- Wlaschin, *Domain Modeling Made Functional* (2018).
- Brady, *Type-Driven Development with Idris* (2017).
- Ranganathan, colon classification (PMEST facets).
- Gruber, ontology-as-specification.
- Evans, *Domain-Driven Design* — bounded contexts.
- Berners-Lee, semantic-web type discipline (applied inward).
- Jackson, *Software Abstractions* (Alloy).
- Lamport, *Specifying Systems* (TLA+).

## Enforcement

- `canonical-home-auditor` skill (repo-wide) and
  `skill-ontology-auditor` skill (narrow, skill-library only)
  flag placement errors and emit findings with BP-NN citations.
- `skill-tune-up` continues to cite BP-NN IDs in its output;
  tune-up queue now includes BP-HOME / BP-HOME-AS-TYPE
  violations as P0.
- The axiomatic-enforcement direction (P2 BACKLOG) graduates
  these rules from human-readable text to mechanical checks
  in a future round.

## What this ADR does NOT do

- Does not introduce new artifact types; each new type lands
  via its own ADR citing this one.
- Does not touch `GOVERNANCE.md` numbering; that is a separate
  governance event, tracked as a BACKLOG follow-up.
- Does not modify `AGENTS.md`; a short pointer from AGENTS.md
  to Rule Zero is a follow-up edit.
- Does not implement axiomatic enforcement; that direction is
  tracked separately in BACKLOG as a P2 design item.
