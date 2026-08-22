/-
  LightTimeAsymmetry.lean — the endpoint-speed envelope for one-way light-time
  asymmetry, machine-checked.

  ## Why this file exists

  `src/Bayesian/OrbitalAsymmetryBudget.fs` produces `δ_max`, which
  `BusRegime.regimeOf` adds to the deadline before declaring `OutOfCone`, and
  `BusRegime.judge` promotes an `OutOfCone` verdict to *evidence* against a peer.
  The error is therefore one-directional in consequence: too LARGE is a missed
  detection, too SMALL is a false conviction of an honest message. A
  provably-conservative bound beats a usually-accurate one.

  Work-item `081KZYK0Q8Z087G0R0010Z2Z2Q` proposed the endpoint-speed envelope and
  filed it PROPOSED, supported only by "never exceeded across a coarse two-body
  scan over one 29-month window". That is a count, not a proof — and it is the
  same failure shape as the `v_B · û` bound it replaces, which was also asserted
  conservative without derivation. This file supplies the missing proof and,
  more usefully, shows the bound is SHARP, which settles the inherited `* 1.2`.

  ## BP-16 cross-check

  Tool 1: `tools/Z3Verify/light-time-endpoint-speed-envelope.smt2` (z3 nlsat,
  QF_NRA — decidable, but emits no replayable certificate).
  Tool 2: this file (Lean 4 + Mathlib — kernel-checked, no solver trust).
  The two agree, and this file additionally discharges the 3D to scalar reduction
  that the SMT encoding takes as given (`lightTime_le_of_vec`).

  ## The model, stated (a theorem is only as strong as its hypotheses)

  One fixed inertial frame. Common transmit epoch. Both endpoints move
  RECTILINEARLY at constant velocity over the light-time interval. Implicit
  one-way light-time equations, with the range taken at the transmit epoch.

  NOT covered here, and deliberately so — these are additive residuals that
  belong in an explicit delta_model term, never in a multiplicative fudge:
    * orbital CURVATURE over the light-time arc (bounded analytically at
      0.0277 ms for Earth-Mars; measured at most 0.0078 ms);
    * ephemeris position error (2*sigma/c, source-dependent, and the DOMINANT
      term for a mean-element model);
    * the Shapiro/relativistic delay difference near solar conjunction.

  Author: Soraya (formal-verification routing), 2026-08-13.
  Anchors: Tarski (1951) / Collins (1975) — why the scalar form is decidable, and
  hence why z3 was routed the algebraic core. Murray and Dermott (1999) ch. 2 —
  the two-body state model the residual bounds are taken against. NOTE: cited
  from standing knowledge; neither volume was re-opened for this file.
-/
import Mathlib.Analysis.InnerProductSpace.Basic
import Mathlib.Analysis.InnerProductSpace.PiL2

namespace Zeta.LightTimeAsymmetry

open scoped RealInnerProductSpace

/-! ### 1. The scalar core

After the exact reduction of the squared norm, a light time is the positive root
of a quadratic whose only geometric inputs are the projected speed `s` and the
speed norm `w`, with `|s| <= w` (Cauchy-Schwarz). -/

/-- The light-time equation, in reduced scalar form.
`t` is the one-way light time, `R` the range at the transmit epoch, `s` the
receiver's velocity projected onto the transmitter-to-receiver unit vector, and
`w` the receiver's speed. -/
def LightTimeEq (c R s w t : ℝ) : Prop :=
  (c * t) ^ 2 = R ^ 2 + 2 * R * t * s + t ^ 2 * w ^ 2

/-- **Upper bound.** A one-way light time never exceeds `R / (c - V)`, where `V`
bounds the *receiver's* speed. Note it is the receiver, not the transmitter,
that governs — the asymmetry lives entirely in which endpoint moved. -/
theorem lightTime_le
    {c R V s w t : ℝ}
    (hc : 0 < c) (hR : 0 < R) (ht : 0 < t)
    (hw : 0 ≤ w) (hwV : w ≤ V) (_hVc : V < c)
    (hs : |s| ≤ w)
    (heq : LightTimeEq c R s w t) :
    t * (c - V) ≤ R := by
  unfold LightTimeEq at heq
  have hsw : s ≤ w := le_trans (le_abs_self s) hs
  have hV : 0 ≤ V := le_trans hw hwV
  have hsV : s ≤ V := le_trans hsw hwV
  have htV : t * w ≤ t * V := mul_le_mul_of_nonneg_left hwV (le_of_lt ht)
  have hsq : (c * t) ^ 2 ≤ (R + t * V) ^ 2 := by
    nlinarith [mul_pos hR ht, sq_nonneg t, mul_nonneg (le_of_lt ht) hV, htV,
               mul_nonneg (le_of_lt ht) hw]
  have hpos : 0 < R + t * V := by nlinarith
  have hct : 0 < c * t := mul_pos hc ht
  nlinarith [hsq, hpos, hct]

/-- **Lower bound.** A one-way light time is never below `R / (c + V)`. -/
theorem le_lightTime
    {c R V s w t : ℝ}
    (hc : 0 < c) (hR : 0 < R) (ht : 0 < t)
    (hw : 0 ≤ w) (hwV : w ≤ V) (_hVc : V < c)
    (hs : |s| ≤ w)
    (heq : LightTimeEq c R s w t) :
    R ≤ t * (c + V) := by
  unfold LightTimeEq at heq
  have hws : -w ≤ s := neg_le_of_abs_le hs
  have hV : 0 ≤ V := le_trans hw hwV
  have hsq : (R - t * w) ^ 2 ≤ (c * t) ^ 2 := by
    nlinarith [mul_pos hR ht]
  have hct : 0 < c * t := mul_pos hc ht
  have h1 : R - t * w ≤ c * t := by nlinarith [hsq, hct]
  have htV : t * w ≤ t * V := mul_le_mul_of_nonneg_left hwV (le_of_lt ht)
  linarith

/-! ### 2. The envelope

`tAB` is governed by B's speed bound (B is the receiver); `tBA` by A's. The
B-to-A equation carries `-2*R*t*sA` because, seen from B, the separation unit
vector is negated; substituting `s := -sA` reuses the same lemmas. -/

/-- **Main theorem (branch 1).** Division-free form of
`tAB - tBA <= R/(c - VB) - R/(c + VA)`. -/
theorem envelope_branch_one
    {c R VA VB sA sB wA wB tAB tBA : ℝ}
    (hc : 0 < c) (hR : 0 < R)
    (hwA : 0 ≤ wA) (hwAV : wA ≤ VA) (hVAc : VA < c)
    (hwB : 0 ≤ wB) (hwBV : wB ≤ VB) (hVBc : VB < c)
    (hsA : |sA| ≤ wA) (hsB : |sB| ≤ wB)
    (htAB : 0 < tAB) (htBA : 0 < tBA)
    (heqAB : LightTimeEq c R sB wB tAB)
    (heqBA : LightTimeEq c R (-sA) wA tBA) :
    (tAB - tBA) * ((c - VB) * (c + VA)) ≤ R * (VA + VB) := by
  have hUp : tAB * (c - VB) ≤ R :=
    lightTime_le hc hR htAB hwB hwBV hVBc hsB heqAB
  have hLo : R ≤ tBA * (c + VA) := by
    refine le_lightTime hc hR htBA hwA hwAV hVAc ?_ heqBA
    simpa [abs_neg] using hsA
  have hVA0 : (0:ℝ) ≤ VA := le_trans hwA hwAV
  have hcVA : (0:ℝ) < c + VA := by linarith
  have hcVB : (0:ℝ) < c - VB := by linarith
  nlinarith [mul_le_mul_of_nonneg_right hUp (le_of_lt hcVA),
             mul_le_mul_of_nonneg_right hLo (le_of_lt hcVB)]

/-- **Main theorem (branch 2).** The mirror bound, by swapping the roles of the
two endpoints. Both branches are needed: which one binds depends on the sign of
the asymmetry, and the envelope takes their max. -/
theorem envelope_branch_two
    {c R VA VB sA sB wA wB tAB tBA : ℝ}
    (hc : 0 < c) (hR : 0 < R)
    (hwA : 0 ≤ wA) (hwAV : wA ≤ VA) (hVAc : VA < c)
    (hwB : 0 ≤ wB) (hwBV : wB ≤ VB) (hVBc : VB < c)
    (hsA : |sA| ≤ wA) (hsB : |sB| ≤ wB)
    (htAB : 0 < tAB) (htBA : 0 < tBA)
    (heqAB : LightTimeEq c R sB wB tAB)
    (heqBA : LightTimeEq c R (-sA) wA tBA) :
    (tBA - tAB) * ((c - VA) * (c + VB)) ≤ R * (VA + VB) := by
  have hUp : tBA * (c - VA) ≤ R := by
    refine lightTime_le hc hR htBA hwA hwAV hVAc ?_ heqBA
    simpa [abs_neg] using hsA
  have hLo : R ≤ tAB * (c + VB) :=
    le_lightTime hc hR htAB hwB hwBV hVBc hsB heqAB
  have hVB0 : (0:ℝ) ≤ VB := le_trans hwB hwBV
  have hcVB : (0:ℝ) < c + VB := by linarith
  have hcVA : (0:ℝ) < c - VA := by linarith
  nlinarith [mul_le_mul_of_nonneg_right hUp (le_of_lt hcVB),
             mul_le_mul_of_nonneg_right hLo (le_of_lt hcVA)]

/-! ### 3. Sharpness — this is what settles the `* 1.2`

Equality is ATTAINED, with both endpoints moving along the separation direction
at exactly their declared speed bounds (A chasing B). So the un-multiplied
envelope is the LEAST upper bound over this model family: no multiplicative
margin `k > 1` is justified by anything the rectilinear light-time solve can do,
and no `k < 1` is safe. Whatever the `1.2` was for, it was not for this. -/

/-- Exact rational witness (the same one z3 returned): `c = 10`, `R = 1`,
`VA = 2`, `VB = 3` gives `tAB = 1/7`, `tBA = 1/12`, and both sides of branch 1
equal `5`. Exact arithmetic — no floating point anywhere. -/
theorem envelope_sharp :
    LightTimeEq 10 1 3 3 (1/7) ∧
    LightTimeEq 10 1 (-2) 2 (1/12) ∧
    ((1/7 : ℝ) - 1/12) * ((10 - 3) * (10 + 2)) = 1 * (2 + 3) := by
  refine ⟨?_, ?_, ?_⟩
  · unfold LightTimeEq; norm_num
  · unfold LightTimeEq; norm_num
  · norm_num

/-! ### 4. The 3D to scalar reduction

The SMT encoding takes this for granted. Discharging it here is the reason the
Lean artifact is not redundant with the z3 one: it turns "the scalar form is the
right reduction" from an assumption into a theorem. -/

variable {E : Type*} [NormedAddCommGroup E] [InnerProductSpace ℝ E]

/-- Cauchy-Schwarz against a unit vector: the projected speed never exceeds the
speed norm. This is exactly the hypothesis z3 showed to be load-bearing —
dropping it makes the envelope satisfiably false. -/
theorem abs_inner_le_of_unit (u v : E) (hu : ‖u‖ = 1) : |⟪u, v⟫| ≤ ‖v‖ := by
  have h := abs_real_inner_le_norm u v
  rwa [hu, one_mul] at h

/-- The reduction. So a vector light-time equation IS a scalar one, with
`s := inner u v` and `w := norm v`. -/
theorem norm_smul_add_smul_sq (R t : ℝ) (u v : E) (hu : ‖u‖ = 1) :
    ‖R • u + t • v‖ ^ 2 = R ^ 2 + 2 * R * t * ⟪u, v⟫ + t ^ 2 * ‖v‖ ^ 2 := by
  have huu : ⟪u, u⟫ = (1:ℝ) := by
    rw [real_inner_self_eq_norm_sq, hu]; norm_num
  rw [← real_inner_self_eq_norm_sq, ← real_inner_self_eq_norm_sq]
  simp only [inner_add_add_self, real_inner_smul_left, real_inner_smul_right, huu,
    real_inner_comm v u]
  ring

/-- The vector-level upper bound, obtained from the scalar one through the
reduction. This is the statement the F# actually needs: nothing about it
mentions a projection, an orbital element, or an epoch. -/
theorem lightTime_le_of_vec
    {c R V t : ℝ} {u v : E}
    (hc : 0 < c) (hR : 0 < R) (ht : 0 < t) (hu : ‖u‖ = 1)
    (hV : ‖v‖ ≤ V) (hVc : V < c)
    (heq : (c * t) ^ 2 = ‖R • u + t • v‖ ^ 2) :
    t * (c - V) ≤ R := by
  refine lightTime_le hc hR ht (norm_nonneg v) hV hVc (abs_inner_le_of_unit u v hu) ?_
  unfold LightTimeEq
  rw [heq, norm_smul_add_smul_sq R t u v hu]

end Zeta.LightTimeAsymmetry
