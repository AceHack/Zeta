/-
  Unbounded novel evolution requires an infinite (private) state space — the B-1019 rung-3 proof.

  (Routed by Soraya, formal-verification-expert, 2026-06-06; see
  memory/feedback_soraya_b1019_dst_vacuity_review_*. Companion to Privacy/IdentityForcesPrivacy.lean,
  which proved the STATIC necessity — "privacy is the persistent locus of distinction" — and explicitly
  left open "the stronger DYNAMICAL claim that the system HALTS without privacy (the B-1019 DST
  experiment).")

  ## The honest DST↔proof boundary

  B-1019 claims: internal agent-difference drives UNBOUNDED evolution with NO external input — privacy is
  constitutive. The portfolio (Soraya, BP-16) splits the evidence across three rungs because NO single
  tool carries it:

  * **Rung-1 (F# DST, `SocietyUnbounded.fs`)** — the contrast mechanism on a bounded model. It can only
    ever show "didn't cycle within budget"; it can NEVER show "never cycles" (a finite model is eventually
    periodic by pigeonhole — see below). Evidence-FOR, never proof.
  * **Rung-2 (TLC, `NciUnbounded.tla`)** — distinctness MONOTONICITY over the transition relation on a
    small abstracted model. (NOT "no-limit-cycle": that is FALSE on any finite TLC model by the very
    pigeonhole this file proves.)
  * **Rung-3 (Lean, THIS file)** — the structural reason the DST harness can only ever *fail to refute*
    unboundedness, never establish it: a deterministic, no-external-input system on a FINITE state space
    MUST eventually repeat (pigeonhole). Therefore genuinely unbounded novelty (an injective orbit — every
    reached state distinct) is possible ONLY on an INFINITE state space. And since the public commons
    CONVERGES (a finite/bounded consensus, proven in IdentityForcesPrivacy.lean), that infinite
    differentiation capacity must live in the PRIVATE state. Privacy is constitutive of unbounded
    evolution — not as an experiment, but as a theorem.

  Model. `step : S → S` is one deterministic evolution step with NO external input (a pure endofunction —
  the no-coercion / no-external-forcing condition made precise). The orbit from `s0` is
  `orbit n = step^[n] s0` (n-fold iterate). "Genuinely unbounded novelty" = the orbit is INJECTIVE (every
  tick reaches a state never seen before). "Eventually repeats" = the orbit is NOT injective.

  Results (all proven, no `sorry`, no new axioms — Mathlib only):
  * `finite_orbit_recurs` — `[Finite S]` ⟹ the orbit is not injective: ∃ i ≠ j, orbit i = orbit j
    (pigeonhole: an infinite ℕ-indexed sequence into a finite set must collide). This is why rung-1 DST on
    a bounded model can never witness unboundedness.
  * `unbounded_needs_infinite` — orbit INJECTIVE ⟹ `Infinite S`. The headline contrapositive: unbounded
    novelty forces an infinite state space.
  * `unbounded_with_finite_commons_needs_infinite_privacy` — with the public commons FINITE (`[Finite
    Pub]`, the converged consensus), an injective orbit forces `Infinite Priv`. The infinite
    differentiation capacity REQUIRED for unbounded evolution must live in PRIVATE state. Privacy is
    constitutive — the B-1019 thesis, proven.
-/

import Mathlib.Logic.Function.Iterate
import Mathlib.Data.Fintype.Pigeonhole -- Finite.exists_ne_map_eq_of_infinite
import Mathlib.Data.Fintype.EquivFin   -- Infinite.of_injective
import Mathlib.Data.Finite.Defs        -- not_infinite_iff_finite, not_finite
import Mathlib.Data.Finite.Prod        -- Finite (Pub × Priv) from Finite Pub + Finite Priv

namespace Zeta.Privacy

/-- The orbit of a deterministic, no-external-input system from a start state: `orbit n = stepⁿ s₀`.
    `step` is a pure endofunction — "no external input" made precise (the next state is a function of the
    current state alone; nothing is read from outside). -/
def orbit {S : Type*} (step : S → S) (s0 : S) : ℕ → S := fun n => step^[n] s0

/-- **Finite ⟹ recurrence (pigeonhole).** On a FINITE state space, the orbit of a deterministic
    no-input system cannot be injective: two distinct ticks reach the same state, so the system is
    eventually periodic. This is the structural reason a bounded DST harness (rung-1) can only ever show
    "didn't repeat within budget", never "never repeats". -/
theorem finite_orbit_recurs {S : Type*} [Finite S] (step : S → S) (s0 : S) :
    ∃ i j, i ≠ j ∧ orbit step s0 i = orbit step s0 j :=
  Finite.exists_ne_map_eq_of_infinite (orbit step s0)

/-- **Unbounded novelty ⟹ infinite state space.** If the orbit is INJECTIVE — every tick reaches a state
    never seen before, i.e. genuinely unbounded novel evolution — then the state space is INFINITE. The
    contrapositive of `finite_orbit_recurs`: a deterministic no-input system that never repeats can only
    live on an infinite state space. (Lean establishes "unbounded ⟹ infinite"; the DST harness can only
    fail to refute the antecedent, never prove it — the honest tool boundary.) -/
theorem unbounded_needs_infinite {S : Type*} (step : S → S) (s0 : S)
    (hinj : Function.Injective (orbit step s0)) : Infinite S :=
  Infinite.of_injective (orbit step s0) hinj

/-- **Privacy is constitutive of unbounded evolution (the B-1019 thesis).** Split the state into the
    public commons `Pub` and the private state `Priv`. The commons CONVERGES to a bounded consensus
    (`IdentityForcesPrivacy.commons_converges` / `absorb_stable`), so `Pub` is FINITE. If evolution is
    genuinely unbounded (the orbit is injective — no tick ever repeats the full configuration), then the
    PRIVATE state space must be INFINITE: it is the only locus with room for the unbounded differentiation
    that unbounded novelty requires. With no private state (`Priv` finite) and a finite commons, the whole
    space is finite and `finite_orbit_recurs` forces a repeat — collapse. Privacy is not optional for
    open-ended evolution; it is necessary. -/
theorem unbounded_with_finite_commons_needs_infinite_privacy
    {Pub Priv : Type*} [Finite Pub] (step : Pub × Priv → Pub × Priv) (s0 : Pub × Priv)
    (hinj : Function.Injective (orbit step s0)) : Infinite Priv := by
  haveI : Infinite (Pub × Priv) := unbounded_needs_infinite step s0 hinj
  by_contra h
  haveI : Finite Priv := not_infinite_iff_finite.mp h
  exact not_finite (Pub × Priv)

end Zeta.Privacy
