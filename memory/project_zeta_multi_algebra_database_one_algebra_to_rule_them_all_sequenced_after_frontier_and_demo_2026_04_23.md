---
name: Zeta is the multi-algebra database — "one algebra to rule them all", pluggable DB algebras; lots of lots of work here after Frontier (factory) is stable and there's a good demo surface + UI
description: Aaron 2026-04-23 re-grounding of Zeta's full scope. Not just the DBSP library — the multi-algebra database side where the Zeta operator algebra (D/I/z⁻¹/H) is the stable meta-layer hosting pluggable semirings (tropical / Boolean / probabilistic / lineage / provenance / Bayesian / counting). Composes with the prior semiring-parameterized-zeta memory that landed in-repo via PR #164. Explicit sequencing: factory (Frontier) stable → demo surface + UI solid → THEN the multi-algebra work earns the bulk of the engineering time. Maps cleanly onto Aaron's external priority stack ordering (ServiceTitan + UI #1 → Aurora #2 → multi-algebra DB #3).
type: project
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---

# Zeta = multi-algebra DB (post-frontier + post-demo)

## Verbatim (2026-04-23)

> Zeta is also the multi algebra database side of things
> the one algebra to rule them all kind of thing,
> pluggable db algebras and all that. lots of lots of
> work here after our frontier factory is more stable
> and we have a good demo surfce and ui

## What this re-grounds

**Zeta's full scope is bigger than "DBSP library."** Its
full identity:

1. **Retraction-native operator algebra** (D / I / z⁻¹ /
   H) — the stable meta-layer. This is the
   "one-algebra-to-rule-them-all."
2. **Pluggable DB algebras** — the operator algebra is
   generic over semiring parameter; swapping the semiring
   swaps the DB algebra the Zeta substrate is host-ing.
3. Hosts **tropical** (shortest-path), **Boolean**
   (truth-valued), **probabilistic** (probability),
   **lineage** (bag-union with provenance), **provenance**
   (K-relations), **Bayesian** (conditional probability),
   **counting** (ℤ signed-integer ring — current), more.

Per the semiring-parameterized-zeta memory that now lives
in-repo (via PR #164):

- ZSet is currently one instance of the generic `KSet<K>`
  where `K = ℤ` (signed-integer ring).
- Generalising K makes Zeta host ALL the other DB
  algebras simultaneously by semiring-swap.
- K-relations (Green-Karvounarakis-Tannen PODS 2007)
  identified this framework formally.

## Sequencing — where this fits in the roadmap

Aaron's explicit sequence:

1. **Frontier (factory) stabilisation** — current work.
   The autonomous-loop tick, named-reviewer cadence,
   hygiene-row enforcement, all the 2026-04-23 substrate
   (AutoDream cadence / courier protocol / scheduling-
   authority / branch-protection / plural-host / etc.)
   — this IS what "more stable" means.
2. **Good demo surface + UI** — the Showcase projects
   (FactoryDemo.* renamed from ServiceTitan-shape
   samples) + the Pages-UI (P2 BACKLOG row, PR #172
   merged) + any adopter-facing surfaces.
3. **THEN** multi-algebra work on Zeta earns the bulk of
   engineering time.

This aligns with Aaron's explicit external priority stack
(`CURRENT-aaron.md` §2):

- Priority #1: ServiceTitan + UI (demo target)
- Priority #2: Aurora integration
- Priority #3: Multi-algebra DB (semiring-parameterized
  Zeta)

Multi-algebra DB is priority #3, after ServiceTitan + UI
(#1, demo) and Aurora (#2, Amara collaboration). Both #1
and #2 contribute to "good demo surface + UI"; #3 is the
next major engineering effort.

## How to apply

### During Phase-1 greenfield (current)

- **Do NOT start implementation** of semiring-
  parameterized Zeta as a primary work stream. Aaron's
  sequencing is explicit: factory + demo FIRST.
- **Keep the research substrate alive** — the semiring-
  parameterized-zeta memory is in-repo (PR #164 merged
  when it lands); cite it when adjacent decisions arise.
- **Capture incidental observations** — if implementation
  work on Zeta core surfaces a design opportunity that
  composes with multi-algebra, record it in a forward-
  looking note (research doc or BACKLOG row), don't act
  on it unilaterally.
- **Preserve the ZSet architecture** — don't refactor
  toward `KSet<K>` generic without explicit maintainer
  scope direction.

### When Frontier + demo are stable

- **Research doc first**: `docs/research/semiring-
  parameterized-zeta-design-YYYY-MM-DD.md` with the full
  design surface (public API shape, compile-time vs
  runtime parameterisation, wire-format implications,
  perf envelopes per semiring).
- **ADR for the API-shape decision** once research
  stabilises.
- **Implementation staged** to respect the greenfield →
  learning-mode → non-greenfield trajectory for whatever
  has deployed by then.

### Ripple effects (current work)

- **Memory-migration citations**: the semiring-
  parameterized-zeta memory now in-repo carries the
  K-relations + signed-integer-ring framing. Other
  memories citing it get to reference the in-repo path.
- **Tech-inventory row** (PR #170 merged): "Zeta DBSP
  operator algebra" stays at Adopt; "semiring-
  parameterized Zeta" lives in TECH-RADAR at Assess
  until the Phase-3 work fires.
- **Aurora integration** (priority #2) interacts with
  multi-algebra: Aurora's oracle rules (from Amara's
  deep research absorb PR #161) compose with retraction-
  native algebra; semiring-parameterization is the
  substrate that makes Aurora's oracle rules work
  across multiple DB paradigms.

## What this is NOT

- **Not a new feature request.** Aaron's message is
  re-grounding + sequencing, not a new work item.
- **Not a commitment to multi-algebra shipping by any
  date.** "After Frontier is more stable and we have a
  good demo surface and ui" — open-ended.
- **Not an authorization to start `KSet<K>` refactor.**
  Still priority #3; still research-before-implement.
- **Not a claim Zeta is publicly-marketable as
  multi-algebra DB today.** It's a DBSP library with
  retraction-native operator algebra; multi-algebra is
  the post-stabilisation arc.

## Composes with

- `memory/project_semiring_parameterized_zeta_regime_change_one_algebra_to_map_others_2026_04_22.md`
  (in-repo via PR #164; the specific semiring-
  parameterization research memory this one anchors)
- `CURRENT-aaron.md` §2 (external priority stack —
  multi-algebra DB is #3)
- `project_multiple_projects_under_construction_and_lfg_soulfile_inheritance_2026_04_23.md`
  (Zeta as one project-under-construction; this memory
  clarifies its full scope)
- `project_repo_split_provisional_names_frontier_factory_and_peers_2026_04_23.md`
  (Zeta stays Zeta; the multi-algebra framing doesn't
  change the repo name)
- `docs/aurora/2026-04-23-amara-deep-research-report.md`
  (PR #161 merged; Amara's oracle rules compose with
  retraction-native algebra; semiring-parameterization
  makes them cross-paradigm)
- `docs/research/multi-repo-refactor-shapes-2026-04-23.md`
  (PR #150; the refactor shapes affect how Zeta's
  multi-algebra work eventually lives as its own repo)
- `feedback_greenfield_until_deployed_then_backcompat_learning_mode_DORA_cost_2026_04_23.md`
  (greenfield phases — sequencing of multi-algebra work
  respects the three phases)
