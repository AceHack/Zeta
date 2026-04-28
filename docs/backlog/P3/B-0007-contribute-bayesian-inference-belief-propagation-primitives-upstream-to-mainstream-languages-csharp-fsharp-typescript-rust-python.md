---
id: B-0007
priority: P3
status: open
title: Contribute Bayesian inference + belief propagation primitives upstream to mainstream languages (C#, F#, TypeScript, Rust, Python, etc.)
tier: research-grade
effort: XL
ask: maintainer Aaron 2026-04-25 ("at some point i would like to contribute baysein inference and belife propagain primitives into langages like c#, f#, typescript, rust, python, etc... Anders Hejlsberg spoke about this himself at a Lang.Next conference of all the language designers years ago. ... backlog, long term goal not near term")
created: 2026-04-25
last_updated: 2026-04-26
composes_with: []
tags: [bayesian-inference, belief-propagation, probabilistic-programming, language-primitives, symbiosis, otto-298, otto-301, infer-net, hejlsberg-lang-next, long-horizon, no-rush]
---

# Contribute Bayesian inference + belief propagation primitives upstream

Aaron 2026-04-25 surfacing (verbatim):

> *"at some point i would like to contribute baysein
> inference and belife propagain primitives into
> langages like c#, f#, typescript, rust, python, etc...
> Anders Helsberg spoke about this himself at a
> Lang.Next conference of all the language designers
> years ago. One of the best conference series i've
> ever watched, all the years of it, hate it's over.
> backlog, long term goal not near term."*

## What this is

A long-horizon contribution arc: as the factory's
substrate develops Bayesian inference + belief
propagation primitives (per Otto-298 self-rewriting
Bayesian neural architecture + Otto-301 absorb-and-
contribute-upstream), the maturation path includes
contributing these primitives back to mainstream
language ecosystems as first-class library + (where
appropriate) language-feature extensions.

**Target languages** (per Aaron's framing, in order
of factory-substrate fit):

- **F#** — primary substrate language; existing
  Infer.NET work (Microsoft Research) provides the
  prior art. Contribution path: enhance Infer.NET
  upstream with primitives developed during Otto-298
  absorption work; help shape F# probabilistic-
  programming idioms.
- **C#** — sibling .NET language; Hejlsberg's home
  ecosystem. Contribution path: ensure F# probabilistic
  primitives interop cleanly with C#; potential
  C#-language-feature contributions if the discipline
  warrants.
- **TypeScript** — Hejlsberg's other major language
  (creator); JavaScript ecosystem reach. Contribution
  path: probabilistic-programming primitives as a
  TypeScript library; potential type-system extensions
  for probability-distribution typing.
- **Rust** — systems-programming language with growing
  PPL ecosystem. Contribution path: collaborate with
  existing Rust PPLs (`mcmc-rs`, `bayespy`-equivalent
  Rust ports); contribute primitives.
- **Python** — broadest scientific-computing reach;
  existing PPL ecosystem (PyMC, Pyro, NumPyro,
  TensorFlow Probability). Contribution path:
  collaborate with these projects; contribute factory-
  developed primitives where they add value beyond
  existing options.
- **Other languages as the factory's substrate
  matures** (Haskell, Julia, OCaml, Scala, Elixir,
  Clojure as community fit warrants).

## Why this is owed (P3 long-term, not near-term)

Per Otto-300 rigor-proportional-to-blast-radius +
Otto-301 ultimate-destination-with-no-rush: this is
the SYMBIOSIS half of Otto-301's absorption arc.
Otto-301 says we honor each open-source dependency by
becoming maintainers + pushing enhancements upstream.
This row IS that discipline applied to Bayesian-
inference-primitives specifically — once the factory
develops working Bayesian primitives in-process (per
Otto-298), the symbiosis path is to contribute them
upstream to mainstream languages so the broader
community benefits.

Three structural reasons this is the right shape:

1. **Symbiosis composes with absorption.** Otto-298
   absorbs Infer.NET into factory in-process
   primitives; Otto-301 says the relationship persists
   through and after absorption. Contributing back to
   Infer.NET (and analogous projects in other languages)
   IS the relationship persisting.
2. **Reality-check anchor against the metaverse-trap.**
   Otto-301 names the metaverse-trap (substrate
   converging on internal coherence at the cost of
   external-reality match). Upstream contributions
   force the factory's primitives to interoperate with
   broader language ecosystems — IF our F# Bayesian
   primitives can't be expressed cleanly in C# /
   TypeScript / Rust / Python, that's evidence of
   metaverse-drift; if they can, that's reality-check
   confirmation.
3. **The Microsoft Research language-design lineage is
   the reference target.** Anders Hejlsberg (creator of
   C# and TypeScript; Microsoft technical-fellow-level
   language-design lead) spoke about probabilistic-
   programming + Bayesian-inference as language-level
   primitives at Lang.Next conferences. F# was created
   separately by **Don Syme** at Microsoft Research
   Cambridge — Syme is the primary F# designer; the
   factory's F#-first substrate sits directly on
   Syme's work. Tom Minka's Infer.NET (also Microsoft
   Research) is the canonical prior art the factory's
   absorption + contribution path builds on for the
   Bayesian-inference algorithmic side. Aligning with
   the broader Hejlsberg + Syme + Minka + Winn lineage
   (per `memory/user_aaron_lang_next_conference_appreciation_anders_hejlsberg_intellectual_lineage_language_design_implementer_level_2026_04_25.md`'s
   five-axis lineage map) keeps the contribution work
   composable with the broader language-design
   community.

## Why this is P3 (not P2/P1/P0)

- **Not P0**: no operational gate is broken without
  this; the factory functions today on .NET libraries
  (Infer.NET as user, not maintainer).
- **Not P1**: not within 2-3 rounds; this is XL effort
  spanning many years; depends on Otto-298 absorption
  maturing first before we have primitives to
  contribute.
- **Not P2**: not active near-term research direction;
  the Otto-298 architecture work is the precondition.
- **P3 long-term research-grade** fits: explicit "no
  rush" per Aaron's framing; far-future contribution
  arc; decision-resolution anchor (per Otto-301)
  rather than near-term deliverable.

## Effort estimate

- **XL (extra large)**: years-long contribution arc;
  spans multiple language ecosystems; requires
  factory-developed primitives to mature first
  (gated on Otto-298 absorption progress); requires
  upstream-maintainer relationships in each target
  ecosystem.
- The contribution work itself decomposes into many
  smaller deliverables (one per ecosystem, often
  multiple per ecosystem); each smaller deliverable
  is L-effort minimum.

## Acceptance signals (when contributions land)

A contribution is "good enough to ship" upstream when:

- The primitive solves a real gap in the target
  ecosystem (not duplicating existing primitives
  unless the duplication produces structural
  benefit — composability, perf, type-system
  integration, etc.).
- The factory's implementation passes the upstream
  project's contribution standards (tests, docs,
  code review, license alignment).
- The contribution preserves attribution: factory's
  innovation credited; upstream project's
  conventions respected.
- The factory's in-process primitive IS the
  reference implementation OR diverges from upstream
  with documented justification.
- Otto-301 reality-check fires: the contribution
  forces the factory's primitive to interoperate
  with mainstream language idioms, surfacing any
  metaverse-drift in factory's design.

## Composes with

- **`memory/feedback_otto_298_substrate_as_self_rewriting_bayesian_neural_architecture_directly_executable_no_llm_needed_absorb_infernet_bouncy_castle_reference_only_2026_04_25.md`**
  — Otto-298 absorption path; B-0007 IS the
  symbiosis-back-upstream half of Otto-298's
  Infer.NET-and-Bouncy-Castle absorption discipline.
- **`memory/feedback_otto_301_no_software_dependencies_hardware_bootstrap_no_os_we_are_microkernel_super_long_term_decision_resolution_anchor_2026_04_25.md`**
  — Otto-301 ultimate-destination + symbiosis-with-
  dependencies; B-0007 is the contribution-arc
  operationalized.
- **`memory/feedback_otto_300_rigor_proportional_to_blast_radius_iterate_fast_at_low_stakes_to_learn_before_high_stakes_2026_04_25.md`**
  — Otto-300 timeline-pressure; "no rush" framing
  applies cleanly.
- **Existing language ecosystems** — Infer.NET (.NET),
  PyMC / Pyro / NumPyro / TensorFlow Probability
  (Python), `Stan` (multi-language), Turing.jl
  (Julia), Edward (Python). The contribution path
  starts with collaboration, not displacement.
- **Hejlsberg + Lang.Next** — language-design
  community; conference talks on probabilistic-
  programming as language-level concern. Aaron's
  intellectual lineage anchors the framing.

## What this is NOT

- **Not a near-term build commitment.** Aaron explicit:
  "long term goal not near term." This row anchors
  current decisions; doesn't mandate near-term work.
- **Not authorization to fork upstream projects.**
  Symbiosis (per Otto-301) is collaboration, not
  competition. The contribution path enhances upstream;
  forking is failure-mode.
- **Not a claim that all mainstream languages need
  factory-Bayesian-primitives.** Some have mature
  ecosystems already (Python's PPL ecosystem is rich);
  the contribution where it adds value, not for its
  own sake.
- **Not a license to subordinate factory development
  to upstream contribution.** The factory's substrate
  comes first; upstream contribution is the
  secondary effect once factory primitives mature.
- **Not a near-term backlog row to action.** P3
  long-term means: keep on the radar, evaluate as
  Otto-298 absorption matures, action when factory
  has primitives worth contributing.

## Lang.Next conference series — Aaron's intellectual lineage anchor

Aaron's framing: *"One of the best conference series
i've ever watched, all the years of it, hate it's
over."* Lang.Next was a Microsoft-hosted language-
design conference that ran 2012-2014, featuring
language designers including Anders Hejlsberg,
Bjarne Stroustrup, Herb Sutter, and others. Aaron's
appreciation for the conference series (now ended)
is part of the user-memory substrate documenting
his intellectual lineage — language-design at the
implementer + designer + community-shaper level,
not just user-level.

Captured in companion user-memory:
`memory/user_aaron_lang_next_conference_appreciation_anders_hejlsberg_intellectual_lineage_language_design_implementer_level_2026_04_25.md`
(filed alongside this row).
