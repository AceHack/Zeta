/-
  `VonNeumannTraceWitness` — the ANTI-VACUITY witness for the ported
  `RHLinalg.vonNeumann_trace_ineq` (`src/Core.Lean4/Zeta23/LinAlg/VonNeumann.lean`,
  an adapted port from `anthropics/zeta-23-lean`, Apache-2.0, Copyright 2026
  Anthropic PBC — see `Zeta23/README.md` for the register).

  THIS FILE IS OURS. It is not derived from the upstream repository; it is written
  against the ported theorem's PUBLIC STATEMENT, and it is the check that upstream's
  own bar (`#print axioms` clean, no `sorry`) cannot perform.

  WHY IT EXISTS. Sorry-freeness answers "is the proof of this statement sound".
  It cannot answer "is this the statement anyone meant". A port whose hypotheses
  drifted stronger, or whose conclusion drifted weaker, is sorry-free and worthless;
  the repo has a receipt for exactly that failure class (an axiom audit over 13
  unqualified names that all silently resolved to nothing, printed no axiom line,
  grepped clean, and passed having checked nothing —
  `.github/workflows/lean-proof.yml`, the anti-vacuity guard). A check that cannot
  fail is not a check.

  WHAT IS WITNESSED, on explicit `2×2` real symmetric matrices:

    W1  STRICT under NON-COMMUTATION — `Pproj * Qmix ≠ Qmix * Pproj`, and the bound
        is strictly slack there: `Re tr(PQ) = 1 < 2`. Commuting matrices would make
        this vacuous: the whole content of von Neumann's inequality is the
        non-commuting case, where `tr(AB)` is NOT `∑ λᵢ(A)λᵢ(B)`.
    W2  ATTAINED — with `Salign` (same spectrum as `Qmix`, eigenvectors aligned with
        `Pproj`'s in sorted order) the bound is an EQUALITY, `2 = 2`. So the
        conclusion cannot be silently strengthened to `<`: a "tighter" statement
        would be FALSE, and this witness is what fails if someone writes one.
    W3  THE SORTED PAIRING IS LOAD-BEARING — with `Ranti` (same spectrum,
        anti-aligned) the trace drops to `0`, strictly under the same bound `2`.
    W4  THE MUTANT IS REFUTED, machine-checked: pairing the eigenvalues in the
        OPPOSITE order gives a statement that is FALSE at `(Pproj, Salign)`
        (`2 ≤ 0`). This is the rearrangement content of the theorem, and it is the
        one direction a weaker-conclusion drift would break.
    W5  THE PORTED THEOREM IS ACTUALLY APPLIED (`vonNeumann_at_witness`), so the
        audit is not merely measuring this file's own helper lemmas.

  METHOD NOTE (why the eigenvalues are computable at all). `eigenvalues₀` is
  noncomputable — it is a choice of sorted spectral decomposition, not something
  `decide` can evaluate. `eigenvalues₀_fin_two` pins it for `2×2` real symmetric
  matrices from two quantities that ARE elementary: the trace and the squared
  Frobenius norm. For two reals, `a+b` and `a²+b²` determine `ab`, hence the pair
  as a multiset; `Antitone` fixes the order. Both quantities are read through the
  PORTED `RHLinalg.rtrace` / `RHLinalg.frobSq` and their eigenvalue identities, so
  the witness exercises the ported code rather than working around it.

  Anchors: J. von Neumann, *Some matrix-inequalities and metrization of matric-space*
  (Tomsk Univ. Rev. 1, 1937) — the inequality itself; G. Birkhoff, *Tres observaciones
  sobre el algebra lineal* (1946) and von Neumann (1953) — the doubly-stochastic
  decomposition; Hardy–Littlewood–Pólya, *Inequalities* (1934) §10.2 — rearrangement.
  Work-item 081M0N9SSJ1087G0R001WVSN9V.
-/
import Zeta23.LinAlg.VonNeumann

namespace Zeta.VonNeumannTraceWitness

open Matrix Finset RHLinalg

noncomputable section

/-! ## The arithmetic core: two symmetric functions pin a sorted pair. -/

/-- For two reals, `a + b` and `a² + b²` determine `a·b`, hence `{a, b}` as a multiset;
antitone order then fixes which is which. Pure algebra, no matrices. -/
theorem pair_of_sum_and_sumSq {a b p q : ℝ} (hba : b ≤ a) (hqp : q ≤ p)
    (hsum : a + b = p + q) (hsq : a ^ 2 + b ^ 2 = p ^ 2 + q ^ 2) :
    a = p ∧ b = q := by
  have hab : p * q = a * b := by
    linear_combination (1 / 2) * hsq - ((a + b + p + q) / 2) * hsum
  have hkey : (a - p) * (a - q) = 0 := by linear_combination a * hsum + hab
  rcases mul_eq_zero.1 hkey with h | h
  · exact ⟨by linarith, by linarith⟩
  · have hpq : p = q := le_antisymm (by linarith) hqp
    exact ⟨by linarith, by linarith⟩

/-- **Sorted eigenvalues of a `2×2` real symmetric matrix, from trace and Frobenius norm.**
`eigenvalues₀` is noncomputable, so this is the bridge that makes a CONCRETE witness
possible at all. Both inputs are read through the ported `rtrace` / `frobSq`. -/
theorem eigenvalues₀_fin_two {A : Matrix (Fin 2) (Fin 2) ℝ} (hA : A.IsHermitian)
    {p q : ℝ} (hqp : q ≤ p) (htr : rtrace A = p + q) (hfr : frobSq A = p ^ 2 + q ^ 2) :
    hA.eigenvalues₀ 0 = p ∧ hA.eigenvalues₀ 1 = q := by
  have hba : hA.eigenvalues₀ 1 ≤ hA.eigenvalues₀ 0 := hA.eigenvalues₀_antitone (by decide)
  have htr' : rtrace A = ∑ k, hA.eigenvalues₀ k := by
    rw [rtrace_eq_sum_eigenvalues hA]; exact sum_eigenvalues_reindex hA id
  have hfr' : frobSq A = ∑ k, hA.eigenvalues₀ k ^ 2 := by
    rw [frobSq_hermitian_eq_sum_sq_eigenvalues hA]
    exact sum_eigenvalues_reindex hA (fun x => x ^ 2)
  have h2 : ∑ k, hA.eigenvalues₀ k = hA.eigenvalues₀ 0 + hA.eigenvalues₀ 1 :=
    Fin.sum_univ_two _
  have h2sq : ∑ k, hA.eigenvalues₀ k ^ 2 = hA.eigenvalues₀ 0 ^ 2 + hA.eigenvalues₀ 1 ^ 2 :=
    Fin.sum_univ_two _
  exact pair_of_sum_and_sumSq hba hqp (by linarith) (by linarith)

/-! ## The four matrices. All real symmetric; `Pproj` and `Qmix` do NOT commute. -/

/-- `Pproj = diag(1, 0)` — the orthogonal projection onto `e₀`. Spectrum `(1, 0)`. -/
def Pproj : Matrix (Fin 2) (Fin 2) ℝ := !![1, 0; 0, 0]

/-- `Qmix = 2·Π`, with `Π` the rank-one projection onto `(1,1)/√2`. Spectrum `(2, 0)`.
Its eigenvectors are at 45° to `Pproj`'s, so `Pproj * Qmix ≠ Qmix * Pproj`. -/
def Qmix : Matrix (Fin 2) (Fin 2) ℝ := !![1, 1; 1, 1]

/-- `Salign = diag(2, 0)` — the SAME spectrum as `Qmix`, eigenvectors aligned with
`Pproj`'s in sorted order. This is where the bound is attained. -/
def Salign : Matrix (Fin 2) (Fin 2) ℝ := !![2, 0; 0, 0]

/-- `Ranti = diag(0, 2)` — the same spectrum again, anti-aligned. -/
def Ranti : Matrix (Fin 2) (Fin 2) ℝ := !![0, 0; 0, 2]

theorem hP : Pproj.IsHermitian := by ext i j; fin_cases i <;> fin_cases j <;> simp [Pproj]
theorem hQ : Qmix.IsHermitian := by ext i j; fin_cases i <;> fin_cases j <;> simp [Qmix]
theorem hS : Salign.IsHermitian := by ext i j; fin_cases i <;> fin_cases j <;> simp [Salign]
theorem hR : Ranti.IsHermitian := by ext i j; fin_cases i <;> fin_cases j <;> simp [Ranti]

theorem evP : hP.eigenvalues₀ 0 = 1 ∧ hP.eigenvalues₀ 1 = 0 :=
  eigenvalues₀_fin_two hP (by norm_num)
    (by norm_num [rtrace, Pproj, Matrix.trace_fin_two])
    (by norm_num [frobSq, Pproj, Matrix.trace_fin_two, Matrix.mul_apply, Fin.sum_univ_two,
      Matrix.conjTranspose_apply])

theorem evQ : hQ.eigenvalues₀ 0 = 2 ∧ hQ.eigenvalues₀ 1 = 0 :=
  eigenvalues₀_fin_two hQ (by norm_num)
    (by norm_num [rtrace, Qmix, Matrix.trace_fin_two])
    (by norm_num [frobSq, Qmix, Matrix.trace_fin_two, Matrix.mul_apply, Fin.sum_univ_two,
      Matrix.conjTranspose_apply])

theorem evS : hS.eigenvalues₀ 0 = 2 ∧ hS.eigenvalues₀ 1 = 0 :=
  eigenvalues₀_fin_two hS (by norm_num)
    (by norm_num [rtrace, Salign, Matrix.trace_fin_two])
    (by norm_num [frobSq, Salign, Matrix.trace_fin_two, Matrix.mul_apply, Fin.sum_univ_two,
      Matrix.conjTranspose_apply])

theorem evR : hR.eigenvalues₀ 0 = 2 ∧ hR.eigenvalues₀ 1 = 0 :=
  eigenvalues₀_fin_two hR (by norm_num)
    (by norm_num [rtrace, Ranti, Matrix.trace_fin_two])
    (by norm_num [frobSq, Ranti, Matrix.trace_fin_two, Matrix.mul_apply, Fin.sum_univ_two,
      Matrix.conjTranspose_apply])

/-! ## W1 — non-commuting, and strictly slack there. -/

/-- **The witness is not vacuous: the pair does not commute.** Two Hermitian matrices that
COMMUTE are simultaneously diagonalisable and von Neumann's inequality degenerates to the
rearrangement inequality on a shared basis. All of the theorem's content is here. -/
theorem Pproj_Qmix_not_commute : Pproj * Qmix ≠ Qmix * Pproj := by
  intro h
  have hentry := congrFun (congrFun h 0) 1
  norm_num [Pproj, Qmix, Matrix.mul_apply, Fin.sum_univ_two] at hentry

/-- **W1.** For the non-commuting pair the bound is STRICT: `Re tr(PQ) = 1 < 2`. -/
theorem trace_lt_bound_noncommuting :
    RCLike.re (Pproj * Qmix).trace < ∑ i, hP.eigenvalues₀ i * hQ.eigenvalues₀ i := by
  obtain ⟨hp0, hp1⟩ := evP
  obtain ⟨hq0, hq1⟩ := evQ
  have hsum : ∑ i, hP.eigenvalues₀ i * hQ.eigenvalues₀ i
      = hP.eigenvalues₀ 0 * hQ.eigenvalues₀ 0 + hP.eigenvalues₀ 1 * hQ.eigenvalues₀ 1 :=
    Fin.sum_univ_two _
  have hlhs : RCLike.re (Pproj * Qmix).trace = 1 := by
    norm_num [Pproj, Qmix, Matrix.trace_fin_two, Matrix.mul_apply, Fin.sum_univ_two]
  rw [hsum, hlhs, hp0, hp1, hq0, hq1]
  norm_num

/-! ## W2 — the bound is ATTAINED, so it cannot be strengthened to `<`. -/

/-- **W2.** With eigenvectors aligned in sorted order the inequality is an EQUALITY.
Any drift that strengthened the conclusion to a strict `<` would make the ported theorem
FALSE, and this is the check that catches it. -/
theorem trace_eq_bound_aligned :
    RCLike.re (Pproj * Salign).trace = ∑ i, hP.eigenvalues₀ i * hS.eigenvalues₀ i := by
  obtain ⟨hp0, hp1⟩ := evP
  obtain ⟨hs0, hs1⟩ := evS
  have hsum : ∑ i, hP.eigenvalues₀ i * hS.eigenvalues₀ i
      = hP.eigenvalues₀ 0 * hS.eigenvalues₀ 0 + hP.eigenvalues₀ 1 * hS.eigenvalues₀ 1 :=
    Fin.sum_univ_two _
  have hlhs : RCLike.re (Pproj * Salign).trace = 2 := by
    norm_num [Pproj, Salign, Matrix.trace_fin_two, Matrix.mul_apply, Fin.sum_univ_two]
  rw [hsum, hlhs, hp0, hp1, hs0, hs1]
  norm_num

/-! ## W3 — the anti-aligned pairing is strictly below the sorted one. -/

/-- **W3.** Same spectrum as W2, eigenvectors anti-aligned: the trace falls to `0`, strictly
under the same bound `2`. Together with W2 this shows the bound is a genuine MAXIMUM over
the orbit, not a coincidence of these numbers. -/
theorem trace_lt_bound_antialigned :
    RCLike.re (Pproj * Ranti).trace < ∑ i, hP.eigenvalues₀ i * hR.eigenvalues₀ i := by
  obtain ⟨hp0, hp1⟩ := evP
  obtain ⟨hr0, hr1⟩ := evR
  have hsum : ∑ i, hP.eigenvalues₀ i * hR.eigenvalues₀ i
      = hP.eigenvalues₀ 0 * hR.eigenvalues₀ 0 + hP.eigenvalues₀ 1 * hR.eigenvalues₀ 1 :=
    Fin.sum_univ_two _
  have hlhs : RCLike.re (Pproj * Ranti).trace = 0 := by
    norm_num [Pproj, Ranti, Matrix.trace_fin_two, Matrix.mul_apply, Fin.sum_univ_two]
  rw [hsum, hlhs, hp0, hp1, hr0, hr1]
  norm_num

/-! ## W4 — the mutant with the eigenvalues paired the other way is FALSE. -/

/-- **W4 (refutation, with a witness).** The same inequality with the two spectra paired in
the OPPOSITE order is false at `(Pproj, Salign)`: it would assert `2 ≤ 0`. This is the
rearrangement content of von Neumann's theorem, and it is the mutation that a
"sorry-free" port could have carried undetected. A refutation requires a witness; this is
one. -/
theorem mutant_swapped_pairing_false :
    ¬ RCLike.re (Pproj * Salign).trace
        ≤ hP.eigenvalues₀ 0 * hS.eigenvalues₀ 1 + hP.eigenvalues₀ 1 * hS.eigenvalues₀ 0 := by
  obtain ⟨hp0, hp1⟩ := evP
  obtain ⟨hs0, hs1⟩ := evS
  have hlhs : RCLike.re (Pproj * Salign).trace = 2 := by
    norm_num [Pproj, Salign, Matrix.trace_fin_two, Matrix.mul_apply, Fin.sum_univ_two]
  rw [hlhs, hp0, hp1, hs0, hs1]
  norm_num

/-! ## W5 — the ported theorem itself, applied. -/

/-- **W5.** `RHLinalg.vonNeumann_trace_ineq` INSTANTIATED at the non-commuting witness, so
the audit below measures the ported theorem and not only this file's helper lemmas. -/
theorem vonNeumann_at_witness : RCLike.re (Pproj * Qmix).trace ≤ 2 := by
  have hvn := RHLinalg.vonNeumann_trace_ineq hP hQ
  obtain ⟨hp0, hp1⟩ := evP
  obtain ⟨hq0, hq1⟩ := evQ
  have hsum : ∑ i, hP.eigenvalues₀ i * hQ.eigenvalues₀ i
      = hP.eigenvalues₀ 0 * hQ.eigenvalues₀ 0 + hP.eigenvalues₀ 1 * hQ.eigenvalues₀ 1 :=
    Fin.sum_univ_two _
  rw [hsum, hp0, hp1, hq0, hq1] at hvn
  linarith

end

end Zeta.VonNeumannTraceWitness
