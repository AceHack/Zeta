---
name: soraya-b1019-dst-vacuity-review-portfolio-routing
description: "Soraya's vacuity+routing review of the 081KT7YW00008QG0R001DGZQKM DST harness (2026-06-06): the honest design is a PORTFOLIO (F# DST rung-1 + TLC no-cycle + Lean pigeonhole); the F# harness must use a CONTENT-ONLY signature (exclude all counters), seed ONCE + derive evidence internally, be THREE-valued (PASS/REFUTE/INCONCLUSIVE), and teeth=detected-stable-fixed-point not budget. Bounded exact-rationals are eventually periodic, so the only honest pass route is genuine unbounded belief-CONTENT growth."
type: project
created: 2026-06-06
---

Soraya (formal-verification-expert) reviewed the planned 081KT7YW00008QG0R001DGZQKM DST harness for vacuity/soundness
(2026-06-06, routed by Otto). Verdict + the binding design constraints:

## Vacuity fix (the crux)
The full-state signature checked for repetition MUST be computed **only over semantically-load-bearing
content** = the multiset of agent beliefs (`Rational[]`). **Exclude ALL monotonic bookkeeping** (tick, id
counter, history length, parent pointers) from the signature — else "no signature repeats" is true BY
CONSTRUCTION (the odometer guarantees a fresh hash) and the no-limit-cycle check is vacuous (the
"state changed" false-pass 081KT7YW00008QG0R001DGZQKM forbids). Novelty must come from belief DIFFERENCE, not the counter.

## Risk #3 (the model-killer, now fixed)
Bounded exact-rationals over a fixed candidate set with bounded denominator = a FINITE state space →
pigeonhole forces eventual halt-or-cycle. Bayesian `observe` is monotone-converging (proven
BeliefConvergence) → a fixed population PROVABLY halts. So "chaotic-aperiodic over bounded rationals" is
IMPOSSIBLE (bounded ℚ is eventually periodic). The ONLY honest success route = **genuine unbounded novel
growth in the belief-CONTENT space** (forks deriving evidence whose support/denominators genuinely grow
from accumulated internal history). Seed ONCE; derive all post-init evidence INTERNALLY — never redraw from
a per-tick external seed. (`SocietyEmergence.privateEvidence (seed,id,tick,cands)` redraws per tick =
external forcing = the bug 081KT7YW00008QG0R001DGZQKM forbids.)

## Three-valued outcome (no false teeth)
PASS / REFUTE(teeth) / **INCONCLUSIVE**. Budget exhaustion is INCONCLUSIVE, never a teeth-refute and never
a pass. Teeth (REFUTE) = a DETECTED stable fixed-point (distinctBeliefs→1 ∧ no new identity for K ticks ∧
re-stepping reproduces it) or a detected content-cycle, with collapsed private state as the cause — never
"ran out of budget."

## Cycle detection
Brent's tortoise-and-hare (weight-free, O(1) extra state) — or a `seen: Set<contentSignature>` — over the
CONTENT-ONLY signature. Set-hit = limit cycle (fail); stable single signature = halt (fail); signature set
strictly growing across the whole budget = EVIDENCE of novel growth (not proof). Brent preferred so the
index's own memory growth isn't confused with state growth.

## Tool routing (BP-16 portfolio — no single tool carries the P2-proof evidence)
- **Rung-1 contrast mechanism** (NCI-persists vs coercion-collapses; bounded N; replayable): **F# DST**,
  this harness. Correct tool. It can only ever show "didn't cycle within budget," never "never cycles."
- **No-limit-cycle as a property** over the transition relation: **TLA+/TLC** on a small abstracted model
  (TLC's state-fingerprint cycle detection IS this; don't hand-roll in F# and call it proof).
- **Pigeonhole/unboundedness** (finite det. no-input ⇒ halt-or-cycle; ∴ open-ended ⇒ unbounded state):
  **Lean4** (a finite-induction theorem; DST cannot establish "unbounded", only fail to refute it). This
  is the honest DST↔proof boundary.

## Honest predicate
- PASS (DST evidence-FOR): no halt ∧ no content-signature repeat within budget ∧ distinct
  belief-configuration count strictly increasing — reported as *evidence consistent with* unbounded novel
  growth, NEVER "proven."
- REFUTE (teeth): detected stable fixed-point ∨ detected content-cycle, caused by collapsed private state.
- INCONCLUSIVE: budget exhausted, no cycle, no clear growth trend.

Implementation order: F# DST rung-1 first (this spec) → TLC no-cycle → Lean pigeonhole. Full review:
Soraya agent output 2026-06-06.
