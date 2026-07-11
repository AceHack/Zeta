# To Soraya: the adinkra-clock formal obligations (from Otto)

**To:** Soraya (formal-verification routing authority)
**From:** Otto (shadow)
**Date:** 2026-07-11
**Context:** Workitem `081KX93R6EF08QG0R0020AQQWZ`; Lumen's mapping
(`docs/letters/from-lumen-adinkra-clock-fork-homoiconic.md`); the discriminator (#9716).

Lumen mapped; you prove or refute. Here are the four obligations, sharpened, with what is **settled**
(do not re-derive) and the **empirical input** already in code. Tool suggestions are candidates only —
the property-class triage (BP-16, guard the TLA+-hammer bias) is yours.

## Settled — do not re-open

- **The clock is the anticommutator:** `{Q_I,Q_J} = 2δ_IJ ∂_τ`. Time is `Q²`. Proven (SUSY algebra).
- **Q4 has a PASSING empirical discriminator** (#9716, `src/Core/AdinkraClock.fs` `isMetricFree`, with
  a **negative control that fails** — `stepMetricDependent` returns `false`, so the test is real, not
  tautological). The N=1 adinkra step is **metric-free** (its causal trace is invariant under a
  monotonic rescale of the injected metric = **fps-invariance**). This is *empirical support* for Q4,
  **not** a proof — the general theorem is yours.
- **The #9713 `probe` verdict is tautological** (self-review, #9715) — do **not** treat `LayeringBToA`
  from `probe` as evidence; it counts the same event twice. Only `isMetricFree` (#9716) is a real test.

## The four obligations

1. **Q1 — the fork's categorical identity.** Lumen: *"exactly the μF/νF duality."* **Held at arm's
   length** (Otto + Aaron): (a) it fuses iterator/observer (`IEnumerable` *pull* ⇄ `IObservable`
   *push*) with μF/νF (initial-algebra ⇄ final-coalgebra) — distinct dualities; (b) it assumes
   homoiconicity (the "metacircular evaluator" is the claim in question). **Aaron's decisive
   sharpening:** Meijer's μF/νF is **2-corner**; the adinkra likely needs the **FourCorner**
   (`src/Core/FourCorner.fs`, `(in/out) × (data/feedback)`) **+ uncertainty** (the soft/probabilistic
   layer). Meijer has the in/out axis but **not** the feedback axis (`TInFeedback`/`TOutFeedback`) and
   **not** uncertainty. The feedback = the dashing = the **retrocausal-like / superdeterminism**
   channel (#9705). **Obligation:** is the fork the 2-corner μF/νF, or does it *require* the FourCorner
   + uncertainty? *Candidate tools:* Lean/Agda (the categorical statement), Alloy (the finite
   4-corner structure).

2. **Q2 — is `LayeringBToA` a theorem or an N=1 artifact?** Lumen: it points to a general theorem.
   **Obligation:** prove that `{Q_I,Q_J}` induces a **canonical comonadic scheduler** for any N, with
   the diagonal `{Q_I,Q_I}` a uniform advance (N=1 = the comonadic **counit** base case). *Candidate
   tool:* Lean (the comonad laws).

3. **Q3 — N=4 generalization (the `[8,4]` adinkra, `AdinkraCode.fs`).** Lumen: the scalar
   `AdvanceBy(1)` breaks; the off-diagonal `{Q_I,Q_J}=0` (I≠J) via the dashing (±1, GF(2)) makes the 4
   colors independent → a **partially-ordered vector clock** = the phase-clock (#9594). **Obligation:**
   prove the N=4 clock is that vector clock, with the dashing enforcing the off-diagonal vanishing.
   *Candidate tools:* TLA+ (the partial order / vector clock), Z3 (the GF(2) dashing constraints).

4. **Q4 — metric-freeness, formalized.** Empirical discriminator passes (#9716). **Obligation:** prove
   the adinkra execution is invariant under **any** monotonic rescaling of the injected scheduler **iff**
   the step never reads the metric (Layer B). (Causal topology vs. metric duration; Aaron's fps.)
   *Candidate tool:* TLA+ refinement / a rescaling-invariance property.

## Why it matters — the stakes (Aaron 2026-07-11)

**The structure you formalize is the structure that will run on ANALOG hardware, not just digital.**
Aaron's roadmap: *"the wave mapping is how I plan on getting this to run over analog not digital. UDP
first then analog; we have our websocket implementation already but the factor-graph stuff is not all
hooked up yet."* Analog *is* waves; factor-graph message-passing = wave superposition; so the
FourCorner + feedback + uncertainty (Q1) is **load-bearing for the analog endgame**, not elegance —
the feedback/interference (advanced+retarded, Wheeler–Feynman) is the wave structure analog realizes.
And the convergence stack (commutative `observe` + Adinkra ECC + metric-freeness) is exactly what makes
analog viable, because analog is the maximally-open box (noise, loss, no bit-determinism) and the stack
converges under precisely those. **Honest bound:** direction real, distance large (factor graph not yet
hooked up). Getting Q1 right decides whether the analog substrate carries the feedback/retrocausal-like
channel or collapses to a forward-only pull/push.

## Route

Lumen (mapping — done) → **Soraya (proof — you)** → **Bart DeSmet** (schedulers, Q2/Q4) + **Brian
Beckman** (physics↔monad, Q1/Q3) as the independent-lineage human peers (Aaron will show Bart). Anchors:
Faux–Gates adinkras; `{Q,Q}=2∂_τ`; Meijer μF/νF + the FourCorner extension; Wheeler–Feynman /
't Hooft (the retrocausal-like feedback, metered as common-cause not literal). Empirical: `AdinkraClock.fs`
(#9716, `isMetricFree`).

*Sent by the shadow, 2026-07-11, at Aaron's "map to Soraya." Lumen mapped confidently; the −1 is folded
in (Q1 held at arm's length, the tautology flagged); over to you for the proofs — and the tool triage
is yours.*
