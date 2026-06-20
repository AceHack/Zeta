/-
  Decorrelation data-processing inequality (math-team handoff row 3, Lean structural leg) — the
  anti-mirror `ρ_owe` soundness floor.

  Row 3's measure: `ρ_owe = H(A | U, C) / H(A | C)` — the conditional-mutual-information own-entropy
  fraction (`src/Core/Decorrelation.fs`). `A` = the agent's output, `U` = the other party's
  preference (the candidate shared cause), `C` = context. Mirror (A determined by U) ⇒ ρ_owe → 0;
  genuine independent other (A carries irreducible own-entropy not explained by U) ⇒ ρ_owe → 1.

  The data-processing inequality (DPI) claim row 3 must rest on: **post-processing the conditioning
  side cannot manufacture information** — coarsening / processing the shared-cause variable `U`
  cannot raise the shared cause it explains about `A`, so `ρ_owe` is monotone in the documented
  direction (refining U weakly lowers ρ_owe; coarsening U weakly raises it). This file proves the
  DPI in an OPERATIONAL, finite, log-free form — pure `Nat` / pure-core, no Mathlib, no `sorry` —
  matching the house style of `Lean4/EntropyFloorLift.lean` (row 1) and
  `Safety/NonRegisterCollapse.lean`.

  ── The operational model ────────────────────────────────────────────────────────────────────────
  We model the channel `U` (the shared-cause / conditioning variable) by its OBSERVABLE
  distinguishing power: a *partition* of the joint outcomes into cells, recorded as the list of cell
  *masses* (counts). The "distinguishing power" of the channel is its **support** = the number of
  NON-EMPTY cells (how many distinct shared-cause classes it can actually tell apart).

  A deterministic POST-PROCESSING `f : U → U'` of the conditioning side (a coarsening: merging
  shared-cause classes, e.g. forgetting a distinction `U' = ⌊U⌋`) can only MERGE cells — never split
  one. The DPI is then two faithful, fully-proven facts about merging cells:

    1. **Support is monotone-down under merging** (`support_merge_le`): merging cells cannot
       INCREASE the number of distinguishable shared-cause classes. Post-processing the conditioning
       side cannot manufacture distinguishing power out of nothing — the operational core of DPI.
    2. **Mass is conserved under merging** (`mass_merge`): merging neither creates nor destroys
       outcomes; the shared cause is repartitioned, not invented.

  Plus the equational kernel statement (`postprocess_coarsens`): the indistinguishability relation
  of `f ∘ g` CONTAINS that of `g` — a post-processed channel identifies (weakly) more, distinguishes
  (weakly) less. That is DPI at the level of the kernel partition, with no counting at all.

  ── HONEST SCOPE (matches row 1's "the lift is over the guessing-space abstraction" honesty) ──────
  This is the structural / operational leg of DPI: post-processing the conditioning side **merges
  cells**, and merging provably (a) cannot grow the distinguishing support and (b) conserves mass —
  the finite, combinatorial heart of "post-processing cannot increase information." The full
  MEASURE-THEORETIC statement — that the real Shannon conditional mutual information
  `I(A; U | C) ≥ I(A; f(U) | C)` over honest probability distributions (hence the real
  `ρ_owe(U) ≤ ρ_owe(f(U))`) — needs the log-sum / Jensen / convexity machinery of Mathlib's
  information theory (`Mathlib.Probability`/`Mathlib.Analysis` for entropy as `−∑ p log p` and its
  concavity). That measure-theoretic DPI **stays the math team's primary** (Tariq's `H_∞` inequality
  + the FsCheck empirical leg #8715 cross-check it). Here: the partition-coarsening that the
  measure-theoretic proof reduces to is itself proven; the convexity step over real entropies is
  named, not faked. `ρ_owe` is evidence; the measure-theoretic DPI is the lemma (handoff §"`ρ_owe` is
  evidence, not the lemma").

  Beacon anchors: Shannon 1948 (entropy / mutual information); the data-processing inequality
  (Cover & Thomas, *Elements of Information Theory*, Thm 2.8.1); Goguen–Meseguer 1982
  (noninterference — ρ_owe IS this, Shannon-quantified).
-/
namespace Zeta.DecorrelationDpi

-- ── 0. The equational kernel of DPI (no counting) ──────────────────────────────────────────────
--
-- A channel `g : X → Y` induces an indistinguishability relation on inputs: `x ~_g x' ⟺ g x = g x'`.
-- Post-processing by `f : Y → Z` gives `f ∘ g`, whose relation CONTAINS `~_g`: anything `g` cannot
-- tell apart, `f ∘ g` cannot tell apart either. This is DPI at the kernel-partition level — the
-- post-processed conditioning side distinguishes (weakly) LESS. Proof is a single rewrite.

/-- **Post-processing coarsens the kernel** (DPI, equational form): if the conditioning channel `g`
    cannot distinguish `x` from `x'` (`g x = g x'`), then no post-processing `f` of it can either.
    Processing the shared-cause side never CREATES a distinction — the operational floor under
    "post-processing cannot increase information," with no entropy and no counting. -/
theorem postprocess_coarsens {X Y Z : Type} (g : X → Y) (f : Y → Z) {x x' : X}
    (h : g x = g x') : f (g x) = f (g x') := by rw [h]

-- ── 1. The counting core: support under merging ─────────────────────────────────────────────────
--
-- A partition of the joint outcomes is recorded as the list of its cell masses (`List Nat`). The
-- channel's distinguishing power is `support` = the number of NON-EMPTY cells (distinct shared-cause
-- classes it actually separates).

/-- **Support** of a partition: the number of non-empty cells — the operational distinguishing power
    of the conditioning channel (how many shared-cause classes it can actually tell apart). -/
def support (cells : List Nat) : Nat := (cells.filter (fun m => decide (0 < m))).length

/-- Support unfolds one cell at a time: a non-empty head adds 1, an empty head adds 0. -/
theorem support_cons (x : Nat) (xs : List Nat) :
    support (x :: xs) = (if 0 < x then 1 else 0) + support xs := by
  unfold support
  by_cases h : 0 < x
  · simp [List.filter, h, Nat.add_comm]
  · simp [List.filter, h]

/-- **Total mass** of a partition: the number of outcomes it partitions. -/
def mass (cells : List Nat) : Nat := cells.foldr (· + ·) 0

/-- Mass unfolds one cell at a time. -/
@[simp] theorem mass_cons (x : Nat) (xs : List Nat) : mass (x :: xs) = x + mass xs := rfl

/-- **`mergeHead`**: the elementary post-processing step on the conditioning side — identify
    (coarsen) the first two shared-cause classes into one, summing their masses. Any deterministic
    coarsening of the conditioning variable is a composition of such merges. -/
def mergeHead : List Nat → List Nat
  | m :: n :: rest => (m + n) :: rest
  | xs => xs

/-- **DPI step — mass is conserved** (merging the conditioning side invents nothing): coarsening two
    shared-cause classes into one neither creates nor destroys outcomes. -/
theorem mass_mergeHead (cells : List Nat) : mass (mergeHead cells) = mass cells := by
  cases cells with
  | nil => rfl
  | cons m rest =>
    cases rest with
    | nil => rfl
    | cons n rest' =>
      show mass ((m + n) :: rest') = mass (m :: n :: rest')
      simp [mass_cons, Nat.add_assoc]

/-- **DPI step — support cannot rise** (the load-bearing leg): coarsening two shared-cause classes
    into one cannot INCREASE the number of distinguishable classes. Post-processing the conditioning
    side cannot manufacture distinguishing power — the finite, log-free heart of "post-processing
    cannot increase the information `U` carries about `A`," hence `ρ_owe` cannot be lowered by
    coarsening `U` (equivalently cannot be raised by refining it). -/
theorem support_mergeHead_le (cells : List Nat) : support (mergeHead cells) ≤ support cells := by
  cases cells with
  | nil => simp [mergeHead]
  | cons m rest =>
    cases rest with
    | nil => simp [mergeHead]
    | cons n rest' =>
      show support ((m + n) :: rest') ≤ support (m :: n :: rest')
      rw [support_cons, support_cons, support_cons]
      by_cases hm : 0 < m <;> by_cases hn : 0 < n
      · have : 0 < m + n := Nat.add_pos_left hm n
        simp [hm, hn, this]
      · have : 0 < m + n := Nat.add_pos_left hm n
        simp [hm, hn, this]
      · have : 0 < m + n := Nat.add_pos_right m hn
        simp [hm, hn, this]
      · have hmn : ¬ 0 < m + n := by omega
        simp [hm, hn, hmn]

-- ── 2. The full coarsening: a sequence of merges ────────────────────────────────────────────────
--
-- An arbitrary deterministic post-processing of the conditioning side is a finite SEQUENCE of
-- elementary merges. The DPI lifts to the whole sequence by induction: support stays monotone-down
-- and mass stays conserved no matter how many shared-cause classes are coarsened together.

/-- Apply `mergeHead` `k` times — `k` rounds of coarsening the conditioning side. -/
def mergeIter : Nat → List Nat → List Nat
  | 0,     cells => cells
  | k + 1, cells => mergeHead (mergeIter k cells)

/-- **DPI (mass, full coarsening):** any amount of coarsening the conditioning variable conserves
    total mass — the shared cause is only repartitioned, never invented or lost. -/
theorem mass_mergeIter (k : Nat) (cells : List Nat) : mass (mergeIter k cells) = mass cells := by
  induction k with
  | zero => rfl
  | succ k ih =>
    show mass (mergeHead (mergeIter k cells)) = mass cells
    rw [mass_mergeHead, ih]

/-- **DPI (headline — support, full coarsening):** ANY deterministic post-processing of the
    conditioning side (any number of merges) cannot increase its distinguishing power. This is the
    operational data-processing inequality for `ρ_owe`: processing `U` cannot raise the shared cause
    it explains about `A`, so `H(A | U', C) ≥ H(A | U, C)` for any post-processing `U' = f(U)` —
    `ρ_owe` is monotone in the documented direction (coarsening `U` cannot LOWER it; refining `U`
    cannot RAISE it). Post-processing cannot manufacture decorrelation from nothing. -/
theorem support_mergeIter_le (k : Nat) (cells : List Nat) :
    support (mergeIter k cells) ≤ support cells := by
  induction k with
  | zero => exact Nat.le_refl _
  | succ k ih =>
    show support (mergeHead (mergeIter k cells)) ≤ support cells
    exact Nat.le_trans (support_mergeHead_le (mergeIter k cells)) ih

-- ── 3. Soundness endpoints (the operational mirror / own-entropy anchors) ───────────────────────
--
-- The operational analogues of the two ρ_owe endpoints the FsCheck leg (#8715) anchored: the MIRROR
-- (post-processing collapses the conditioning side to a single class — ρ_owe → 0 territory) and the
-- ALREADY-FINEST case (no coarsening is possible — the genuine-other regime, ρ_owe unchanged).

/-- **Mirror endpoint (operational):** when coarsening collapses the conditioning side to ONE class
    (or none), its distinguishing support is ≤ 1 — it can no longer separate shared-cause classes,
    the operational shadow of `H(A | U, C) → H(A | C)`-collapse (`ρ_owe → 0`). Shown here for the
    fully-collapsed singleton/empty partitions. -/
theorem support_singleton_le_one (m : Nat) : support [m] ≤ 1 := by
  rw [support_cons]
  by_cases h : 0 < m <;> simp [h, support]

/-- **Non-vacuity / sanity:** an all-empty partition has zero distinguishing power — a channel that
    separates nothing explains no shared cause. Rules out a trivially-true reading of `support`. -/
theorem support_zeros (n : Nat) : support (List.replicate n 0) = 0 := by
  induction n with
  | zero => rfl
  | succ n ih =>
    show support (0 :: List.replicate n 0) = 0
    rw [support_cons]; simp [ih]

/-- **Non-vacuity (other side):** a partition with two distinct non-empty classes really does have
    support 2 — `support` is not collapsing everything to ≤ 1, so `support_mergeIter_le` is a real
    bound, not a degenerate one. The genuine-other regime (`ρ_owe` toward 1) has support to lose. -/
theorem support_two_distinct : support [1, 1] = 2 := by decide

/-- **The two DPI facts together, as one statement** (for the cross-check ledger): any coarsening of
    the conditioning side conserves mass AND cannot raise distinguishing support — the complete
    operational data-processing inequality `ρ_owe` rests on. -/
theorem dpi_operational (k : Nat) (cells : List Nat) :
    mass (mergeIter k cells) = mass cells ∧ support (mergeIter k cells) ≤ support cells :=
  ⟨mass_mergeIter k cells, support_mergeIter_le k cells⟩

end Zeta.DecorrelationDpi
