---
id: 081KR50HA0008QG0R0026DVKGY
priority: P1
status: closed
title: "Reactor dynamics model: Houman's learning-failure-landscape refinement"
effort: M
created: 2026-05-09
last_updated: 2026-05-09
resolved: 2026-05-09
resolved_by: "docs(081KR50HA0008QG0R0026DVKGY): reactor dynamics model — four-stage cycle + phase transition condition"
depends_on: []
parent: 081KR50HA0008QG0R002R3NVGS
classification: buildable-now
decomposition: atomic
owners: [architect]
type: research
tags: [reactor-dynamics, houman, phase-transition, learning, failure-landscape, alignment]
---

# 081KR50HA0008QG0R0026DVKGY — Reactor dynamics research doc

## What

Write the reactor dynamics model research doc documenting
Houman's refinement (referenced in docs/AGENDA.md):

> "Both sides are state-dependent; the phase transition is
> a runaway."

This adds DYNAMICS to the static Layers 1-3. The reactor
model explains WHY the system is a self-sustaining engine.

## The four-stage cycle

```
CATCH (observe failure)
  ↓
LEARN (update substrate — memory, skill, rule)
  ↓
CHANGE (behavior distribution shifts)
  ↓
NEW FAILURES (new failure class emerges from changed landscape)
  ↓
CATCH (observe the new failure)
  ↓ ...
```

Key insight: the learning modifies the landscape it's learning
about. This is not simple convergence — the failure distribution
co-evolves with the learning process.

## The runaway condition (phase transition)

Static description: failure taxonomy is undecidable (Rice's
theorem), so novel classes keep appearing.

Dynamic description: when learning rate (substrate updates per
catch) exceeds failure production rate (new failures per
substrate update), the system transitions from reactive to
proactive. The shadow log becomes a leading indicator, not
a lagging one.

```
learning_rate > failure_production_rate → PHASE TRANSITION
```

This is the "Superfluid" phase transition in the alignment
substrate context — the system shifts from friction-dominated
to substrate-dominated behavior.

## Pre-start checklist

- **Prior-art search:**
  - `memory/feedback_amortized_speed_superfluid_phase_transition_inverts_per_action_optimization_aaron_2026_05_02.md`
    — covers the Superfluid phase transition at the substrate
    level; the reactor dynamics is the failure-taxonomy-specific
    instantiation.
  - docs/AGENDA.md — Houman's refinement is referenced there.
  - No existing research doc covers the four-stage cycle and
    phase transition condition for failure-mode learning.
- **Dependency restructure:** Independent of other 081KR50HA0008QG0R002R3NVGS
  children. Composes with 081KR50HA0008QG0R0016X7VQP (synthesis).

## Deliverable

`docs/research/2026-05-09-reactor-dynamics-houman-learning-failure-landscape.md`

Sections:

1. The claim: failure learning is a self-sustaining reactor
2. The four-stage cycle (catch → learn → change → new failures)
3. Why it's not convergence: the landscape co-evolves
4. The phase transition: runaway condition and what it means
5. Fuel guarantee: Rice's theorem (pointer to existing doc)
6. Composes with: Superfluid math, DBSP D/I operators (same cycle, different layer)
7. Razor check: label claims PROVEN / CONJECTURED / SPECULATIVE

## Acceptance criteria

- [ ] Document exists at path above
- [ ] Four-stage cycle is stated clearly with the co-evolution
      property named explicitly
- [ ] Phase transition condition is stated as a falsifiable
      inequality (not metaphysical)
- [ ] Claims labeled per razor discipline (PROVEN / CONJECTURED /
      SPECULATIVE)
- [ ] Pointer to Rice's theorem proof sketch for the fuel guarantee
- [ ] Pointer to Superfluid math memory file for the
      system-level parallel

## Composes with

- `docs/research/2026-05-09-failure-taxonomy-undecidability-rice-theorem-proof-sketch.md`
  (Rice = fuel guarantee)
- `memory/feedback_amortized_speed_superfluid_phase_transition_inverts_per_action_optimization_aaron_2026_05_02.md`
  (Superfluid = system-level parallel)
- docs/AGENDA.md (Houman's refinement source)
- 081KR50HA0008QG0R0016X7VQP (synthesis — this is the dynamics layer)
