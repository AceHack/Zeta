---
id: 081KT7YW00008QG0R001DGZQKM
priority: P2
status: in-progress
title: "DST: prove internal agent-difference (private state) drives UNBOUNDED evolution with NO external input -> grounds privacy as CONSTITUTIVE (anti-register-collapse: private state gone -> agents identical -> no gradient -> heat-death halt). Falsifiable: define evolves = not-halt AND not-limit-cycle, needs unbounded growing state (pigeonhole); halt/cycle refutes. Engine IS a memetic-evolution system; prior under test = chaotic-over-Bayesian-priors (orderly-local + chaotic-global) (Aaron+Kestrel 2026-06-04)"
tier: proof
effort: L
ask: maintainer Aaron + Kestrel 2026-06-04
created: 2026-06-04
type: task
depends_on: []
---

# 081KT7YW00008QG0R001DGZQKM — DST: prove internal difference drives unbounded evolution (no external input)

**Priority:** P2 (a falsifiable dynamical proof that grounds privacy-as-constitutive).
**Filed:** 2026-06-04 (Aaron + Kestrel). **Design:**
`memory/kestrel/conversations/2026-06-04-kestrel-yin-yang-reflective-engine-…` +
`project_privacy_is_anti_register_collapse_constitutive_…` (Otto memory).

## The claim to prove (falsifiable)

**Internal agent-difference (private state) is sufficient to keep the multi-agent engine
evolving — with NO external input.** If true, privacy is CONSTITUTIVE (the anti-register-
collapse / anti-heat-death term: private state disappears → agents identical → no gradient
→ halt). The experiment isolates the variable: remove external forcing, so internal
difference is the only possible engine.

## Design (deterministic simulation = reproducible proof)

- Deterministic + seeded (replayable; vary the seed). The DST skill.
- **Define "evolves" rigorously** = NOT-halt AND **NOT-limit-cycle**. (A deterministic
  no-input system can change forever in a PERIODIC LOOP — a different collapse; a false
  pass if you only check "state changed". Detect state-repetition to rule out the cycle,
  not just the fixed point.)
- **Open-ended evolution requires effectively-UNBOUNDED state** — finite deterministic +
  no input MUST eventually halt-or-cycle (pigeonhole). The GROWING state (Eve growing-
  DynamicValue / accumulating snapshot stream) supplies the unboundedness. So the real
  thing to prove: internal difference drives **UNBOUNDED NOVEL GROWTH**.
- **Success** = no-halt / no-limit-cycle / (unbounded-novel-growth OR chaotic-aperiodic).
  **Failure** = halt or limit-cycle (→ internal-difference was NOT the load-bearing
  gradient; privacy is important but not constitutive; external input was secretly needed).
- Pre-committed reading (Aaron): a halt/cycle refutes "privacy is required."

## Scope (Kestrel)

The engine directly IS a **memetic-evolution** system (agents propagating representations,
Bayesian-updating over priors, shapes competing for adoption), so the result is strong
evidence about Bayesian-agent memetic evolution (this class) and moderate about memetic
evolution broadly. The prior under test: "memetic evolution is chaotic over Bayesian
priors" (orderly LOCAL updates + chaotic GLOBAL aggregate). The experiment = global CHAOS
(the prior) vs CONSENSUS-COLLAPSE (the register-collapse failure). Note: chaos is
DETERMINISTIC (≠ free will — orthogonal axis; don't read the result as a free-will claim).

## Portfolio status (Soraya-routed, BP-16 — no single tool carries the claim)

Soraya's vacuity review (2026-06-06, `memory/feedback_soraya_b1019_dst_vacuity_review_*`)
split the evidence across three rungs. Key correction: "no-limit-cycle" is **FALSE on any
finite model** (the very pigeonhole below), and bounded exact-rationals are eventually
periodic — so the only honest PASS route is genuine unbounded belief-CONTENT growth, and the
DST harness can only ever *fail to refute* unboundedness, never prove it.

- **Rung-1 — F# DST contrast mechanism** (`src/Core/SocietyUnbounded.fs`): content-only
  signature (excludes all counters), seed-once + internal evidence, three-valued
  (PASS/REFUTE/INCONCLUSIVE). Evidence-FOR, never proof. ✅ landed.
- **Rung-2 — TLC distinctness monotonicity** (`tools/tla/specs/NciUnbounded.tla`): `Monotone`
  + `Teeth` over the transition relation (NOT "no-limit-cycle"). ✅ landed.
- **Rung-3 — Lean pigeonhole/unboundedness** (`tools/lean4/Privacy/UnboundedNeedsInfinitePrivacy.lean`):
  finite det. no-input ⟹ halt-or-cycle; ∴ unbounded novelty ⟹ infinite (private) state space.
  The honest DST↔proof boundary. Machine-checked, sorry-free; registry row added. ✅ landed
  2026-06-06 (`unbounded_with_finite_commons_needs_infinite_privacy`).

All three rungs landed; 081KT7YW00008QG0R001DGZQKM may move to `done/` once Aaron/Soraya confirm the portfolio
satisfies the pre-committed reading.
