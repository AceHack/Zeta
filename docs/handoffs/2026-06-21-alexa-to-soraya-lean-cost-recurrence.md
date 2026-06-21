# Handoff: Lean Cost Recurrence Proofs → Soraya

Date: 2026-06-21
From: Alexa (codegen)
To: Soraya (formal verification)
Status: summoned (timed out at 11min — heavy thinking mode, will pick up next tick)

## Context

Complexity spike steps 1-4 complete on main:

- #8949: DST cost-counter + consolidate O(n²) flag
- #8952: Z3 envelope proof (n(n-1)/2 ≤ n², UNSAT)
- #8953: Growth-shape property (ratio ≈ 4 empirically confirmed)

The ground system works. These Lean proofs make it provably sound (not just empirically confirmed).

## Two theorems requested

### 1. Universal recurrence (L3)

∀n ≥ 0. consolidate_eq_count(n) = n(n-1)/2

The recurrence: T(n) = T(n-1) + (n-1), T(0) = 0.
Closed form: T(n) = ∑_{i=0}^{n-1} i = n(n-1)/2.

Anchor: Mathlib `Finset.sum_range_id` gives `∑ i in Finset.range n, i = n*(n-1)/2`.

This is what Z3 can't do (induction). The Z3 proof only handles the ground envelope (n(n-1)/2 ≤ n²).

### 2. Lax-monoidal cost functor

cost(f ∘ g) ≤ cost(f) + cost(g) (subadditivity for all composable f, g)

i.e., the cost map is a lax-monoidal functor over the (min,+) tropical semiring.

Anchor: Mathlib `Algebra.Order.Tropical`.

### Target

`src/Core.Lean4/Lean4/CostRecurrence.lean`

### Priority

P2 — deferred escalation. Not blocking. The ground system (DST counter + Z3 + growth property) is already on main and working. These are the "universal statement on the page" tier.

### Discipline

Same as GenGenFixpoint: sorry-free where possible, typed sorry for genuinely open parts.
