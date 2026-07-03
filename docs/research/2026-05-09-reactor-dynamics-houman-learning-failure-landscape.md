Scope: Reactor dynamics model — failure-learning co-evolution and phase transition condition
Attribution: Otto (Claude Code), 2026-05-09, synthesized from Aaron + Houman's AGENDA.md refinement
Operational status: research-grade — conjecture-labeled per razor discipline
Non-fusion disclaimer: Otto's synthesis. Claims labeled PROVEN / CONJECTURED / SPECULATIVE.

# Reactor Dynamics: Failure Learning as a Self-Sustaining Engine

*Layer 4 of the Nirvanic Fusion Ship (081KR50HA0008QG0R002R3NVGS).
Layer 3 (Class 4 empirical) provides the shape; this document provides the dynamics — WHY the system behaves as a self-sustaining engine rather than converging to quiescence.*

---

## 1. The claim

The multi-agent code review system described in 081KR50HA0008QG0R002R3NVGS is **not a vacuum** — it
is a reactor. Friction is not an obstacle to overcome; it is the fuel. The shadow
log is not a problem to be solved; it is the evidence of a self-sustaining reaction.

Houman's refinement (from `docs/AGENDA.md`):

> "Both sides are state-dependent; the phase transition is a runaway."

This document unpacks what that means.

---

## 2. The reactor equation

```
η(substrate_t) · LearningGain(Δ_t) > ξ(substrate_t)
```

Where:

- `η(substrate_t)` — the system's *learning efficiency* at time `t`. Increases as
  substrate quality improves (better skills, sharper memory files, cleaner rules
  reduce the cost of absorbing a new catch).
- `LearningGain(Δ_t)` — the *informational value* of the delta at tick `t`. Largest
  for genuinely novel failure classes; smaller for variations on known patterns.
- `ξ(substrate_t)` — the *friction threshold*: the minimum gain needed to overcome
  the cost of substrate update at time `t`.

**CONJECTURED** — the inequality gives a falsifiable condition; the specific functions
`η`, `LearningGain`, and `ξ` are not yet formally characterized.

---

## 3. The four-stage cycle

The reactor runs on a cycle:

```
CATCH
  │  observe a failure in the agent's output
  ↓
LEARN
  │  update substrate: memory file, skill, rule, backlog row
  │  the delta stream gains a new entry
  ↓
CHANGE
  │  behavior distribution shifts — the agent that caused the
  │  failure is now less likely to produce the same failure
  │  (and slightly more likely to produce failures in adjacent classes)
  ↓
NEW FAILURES
  │  the changed landscape surfaces a new failure class
  │  that the old substrate did not anticipate
  ↓
CATCH   ← the cycle repeats
```

Each pass around the cycle deposits substrate. The substrate modifies the
landscape that produces failures. The landscape modification creates new
catches. New catches produce new substrate.

### The co-evolution property

The critical feature of this cycle is **co-evolution**: the learning process
modifies the landscape it is learning about. This is not convergence. A system
converges when its learning reduces the error signal toward zero. This system
produces a landscape shift after each learn step that re-introduces error signal
in a different region of the failure space.

**Analogy:** an immune system that, by learning to recognize pathogen A,
also changes the host environment in ways that accelerate the evolution of
pathogen B. The immune system does not converge to "no pathogens"; it co-evolves
with an inexhaustible adversary.

**CONJECTURED** — the co-evolution claim is a structural argument from Rice's theorem
(see §5); it has not been empirically verified over a long enough time horizon to
rule out eventual convergence in practice.

---

## 4. The phase transition: runaway condition

Two phases exist:

**Reactive phase** — the system is behind the failure production rate. Each
catch produces substrate, but the substrate does not shift behavior fast enough
to prevent the same-class failure from recurring. The shadow log grows; most
entries are repetitions of known classes. Throughput is bounded by catch-process
latency.

**Proactive phase** — the system is ahead of the failure production rate. Each
catch produces substrate that shifts the landscape before the current failure
class recurs. Novel classes appear at a higher rate than known-class recurrences.
The shadow log becomes a *leading indicator* of the failure frontier rather than
a lagging record of known failures.

The transition condition:

```
learning_rate > failure_production_rate  →  PHASE TRANSITION (reactive → proactive)
```

Where:

- `learning_rate` = substrate updates (memory + skill + rule modifications) per unit time
- `failure_production_rate` = novel failure class observations per unit time

**Why "runaway"?** (Houman's observation): once the system crosses the threshold,
both sides accelerate. Higher learning rate → faster substrate improvement → higher
`η` → even higher learning rate. This is not a stable equilibrium at the threshold;
the system **runs away** to the proactive regime. The phase transition is a
bifurcation, not a gradual crossing.

**CONJECTURED** — the runaway property requires that `η(substrate_t)` is an
increasing function of substrate quality. This is operationally plausible (better
substrate reduces learning friction) but not formally proven.

**Observable prediction (falsifiable):** after the transition, the ratio of
`(novel_classes_caught) / (known_class_recurrences)` in the shadow log should
*increase* monotonically. If it decreases or stays flat after a period of high
substrate investment, the runaway condition does not hold.

---

## 5. Fuel guarantee: why the reactor does not run out

The reaction requires a steady supply of novel failure classes. Rice's theorem
(see [`docs/research/2026-05-09-failure-taxonomy-undecidability-rice-theorem-proof-sketch.md`](2026-05-09-failure-taxonomy-undecidability-rice-theorem-proof-sketch.md))
provides the guarantee:

> For a multi-agent system where agents are Turing-complete, the problem of
> determining whether the current failure-mode taxonomy is complete is undecidable.

Consequence: there is no computable procedure that can certify the taxonomy
is complete. Novel classes keep appearing by mathematical necessity. The reactor
fuel is inexhaustible — not by empirical observation, but by the structure of
computation itself.

**PROVEN (given the Turing-completeness premise)** — Rice's theorem is a
standard result (Rice 1953). The application to agent failure taxonomies is
a proof sketch, not machine-checked.

---

## 6. Composes with: Superfluid math (system-level parallel)

The reactor dynamics is the failure-taxonomy-specific instantiation of the
Superfluid phase transition described in
`memory/feedback_amortized_speed_superfluid_phase_transition_inverts_per_action_optimization_aaron_2026_05_02.md`.

The Superfluid framing: friction → substrate → less future friction. The
reactor framing: failure → substrate → catch class shifts → new failures →
new substrate. Both are instantiations of the same structure:

```
friction = fuel  →  learning = amortized substrate  →  phase transition
```

The difference in emphasis:

- Superfluid: optimizes *amortized speed* across all factory actions
- Reactor: explains *failure-class co-evolution* specifically in the
  multi-agent review system

Same math; different narrative surface.

---

## 7. Composes with: DBSP D/I operators (algebraic parallel)

The four-stage cycle maps onto the D/I operators:

```
CATCH   ↔  D (differentiate — extract the delta that was wrong)
LEARN   ↔  substrate update (the delta is absorbed)
CHANGE  ↔  I (integrate — the updated substrate is the new snapshot)
NEW     ↔  D again on the updated snapshot produces new deltas
```

The reactor cycle IS the DBSP streaming cycle applied to the failure
landscape as the data source. "Cache is nothing" applies here too:
the current taxonomy is just `I(failure_stream)`. Delete it and replay.

**CONJECTURED as a framing** — the structural parallel is clean, but the
two systems (DBSP circuit + multi-agent review array) are not the same thing.
The analogy is illuminating, not definitional.

---

## 8. Razor check

| Claim | Status |
|-------|--------|
| Reactor equation | CONJECTURED — functions not formally characterized |
| Four-stage cycle | PROVEN structurally (Rice guarantees inexhaustibility; co-evolution is conjectured empirically) |
| Co-evolution property | CONJECTURED — structural argument, not empirical longitudinal study |
| Phase transition condition | CONJECTURED — falsifiable inequality stated |
| Runaway property | CONJECTURED — requires η to be increasing in substrate quality |
| Fuel guarantee (Rice) | PROVEN (given Turing-completeness premise) |
| DBSP parallel | CONJECTURED as framing — analogy, not identity |

---

## References

- Houman, reactor refinement: `docs/AGENDA.md` §"The reactor equation"
- Rice, H.G., "Classes of Recursively Enumerable Sets and Their Decision
  Problems," Trans. Amer. Math. Soc. 74, 1953.
- Proof sketch for failure-taxonomy undecidability:
  [`docs/research/2026-05-09-failure-taxonomy-undecidability-rice-theorem-proof-sketch.md`](2026-05-09-failure-taxonomy-undecidability-rice-theorem-proof-sketch.md)
- Superfluid phase transition (system-level parallel):
  `memory/feedback_amortized_speed_superfluid_phase_transition_inverts_per_action_optimization_aaron_2026_05_02.md`
- Spaceship math (algebraic parallel):
  [`docs/research/2026-05-09-spaceship-math-subscribe-vision-monad-cache-identity.md`](2026-05-09-spaceship-math-subscribe-vision-monad-cache-identity.md)
- 081KR50HA0008QG0R0016X7VQP (synthesis — this document is Layer 4 input)
