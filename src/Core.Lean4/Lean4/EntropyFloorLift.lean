/-
  Entropy floor lift (math-team handoff row 1, structural leg) — the NFT forgery-resistance floor.

  Row 1's property: NFT forgery-resistance `H_∞(H_AB | E) ≥ k` — "the entropy floor = G3b / Bell
  lifted from a SINGLE body to a PAIR." This file proves the LIFT combinatorially, in the
  operational (guessing-probability) form of min-entropy, no Mathlib, no `sorry` — matching the
  house style of Safety/{NonRegisterCollapse,ChildFloor,Bifurcation}.lean.

  Operational min-entropy (standard cryptographic definition): H_∞(X) = -log₂ p_guess(X), where
  p_guess is the best single-guess probability. We model it WITHOUT reals via the **guessing space**
  `g` = a lower bound on the number of equiprobable alternatives an adversary must guess among, so
  `p_guess ≤ 1/g` and `H_∞ ≥ log₂ g`. "H_∞ ≥ k" is then exactly `2^k ≤ g`.

  HONEST SCOPE (BP-16, like the Z3 #8748 + FsCheck #8743 legs): this is the structural lift over the
  guessing-space abstraction — distinct independent sources COMPOSE so the pair's floor is the SUM of
  the single-body floors (≥ each). The full measure-theoretic H_∞ over real distributions, and the
  claim that the underlying physical/Bell source actually meets a single-body floor, stay the math
  team's primary (the empirical `ρ_owe` floor + Tariq's inequality cross-check it). Here: the lift
  itself is proven; the single-body premise is named.
-/
namespace Zeta.EntropyFloorLift

/-- A min-entropy source, modelled operationally by its **guessing space** `g`: a lower bound on the
    number of equiprobable alternatives an adversary must guess among (so `p_guess ≤ 1/g`). -/
structure Source where
  g : Nat

/-- `H_∞(s) ≥ k` in the operational form: the guessing space is at least `2^k`
    (equivalently `p_guess ≤ 2^{-k}`). -/
def hasFloor (s : Source) (k : Nat) : Prop := 2 ^ k ≤ s.g

/-- The **pair** of two independent sources (a relational NFT minted from two bodies): the joint
    guessing space is the product — an adversary must guess BOTH independently. -/
def pair (a b : Source) : Source := ⟨a.g * b.g⟩

/-- **The lift (row 1 core):** independent single-body floors `ka`, `kb` compose to a PAIR floor of
    `ka + kb`. The entropy floor lifts from single body to pair, and ADDS — exactly "G3b/Bell
    single-body lifted to a pair." -/
theorem floor_lifts {a b : Source} {ka kb : Nat}
    (ha : hasFloor a ka) (hb : hasFloor b kb) : hasFloor (pair a b) (ka + kb) := by
  unfold hasFloor pair at *
  calc 2 ^ (ka + kb) = 2 ^ ka * 2 ^ kb := Nat.pow_add 2 ka kb
    _ ≤ a.g * b.g := Nat.mul_le_mul ha hb

/-- The pair floor is never WEAKER than either single-body floor: a relational NFT is at least as
    forgery-resistant as each of its two bodies. -/
theorem pair_floor_ge_left {a b : Source} {ka kb : Nat}
    (ha : hasFloor a ka) (hb : hasFloor b kb) : hasFloor (pair a b) ka := by
  have h := floor_lifts ha hb
  unfold hasFloor at *
  exact Nat.le_trans (Nat.pow_le_pow_right (by decide) (Nat.le_add_right ka kb)) h

/-- **Forgery-resistance corollary:** with a pair floor of `k`, an adversary's best single guess of
    the commit succeeds among at least `2^k` equiprobable alternatives — i.e. `p_guess ≤ 1/2^k`,
    stated here as the guessing space lower bound. Monotone: a larger floor is strictly harder. -/
theorem guessing_space_lower_bound {a b : Source} {ka kb : Nat}
    (ha : hasFloor a ka) (hb : hasFloor b kb) : 2 ^ (ka + kb) ≤ (pair a b).g :=
  floor_lifts ha hb

/-- Sanity (non-vacuity): a zero-entropy body (guessing space ≤ 1 — fully determined) only ever
    carries the trivial floor `k = 0`; it cannot manufacture forgery-resistance on its own. -/
theorem zero_entropy_only_trivial_floor {s : Source} {k : Nat}
    (hg : s.g ≤ 1) (hf : hasFloor s k) : k = 0 := by
  unfold hasFloor at hf
  cases k with
  | zero => rfl
  | succ n =>
    exfalso
    -- 2 = 2^1 ≤ 2^(n+1) ≤ g ≤ 1, contradiction
    have h1 : (1 : Nat) ≤ n + 1 := Nat.succ_le_succ (Nat.zero_le n)
    have hpow : (2 : Nat) ^ 1 ≤ 2 ^ (n + 1) := Nat.pow_le_pow_right (by decide) h1
    rw [Nat.pow_one] at hpow
    have hle : (2 : Nat) ≤ 1 := Nat.le_trans hpow (Nat.le_trans hf hg)
    exact absurd hle (by decide)

end Zeta.EntropyFloorLift
