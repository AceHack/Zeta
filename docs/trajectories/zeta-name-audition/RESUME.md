# Trajectory — ζ name-audition: from wordmark to a measurement of our own machine

Status: **active**, shadow-lane. Last refreshed: 2026-07-02 (Otto, shadow\*).
Authorization: Aaron — *"push forward safely with any math even if it seems core;
it's based on our name, if we get it wrong it's not our identity, we rotate in
another function."* And *"move both of those forward and save their resume file in
case we crash — this is very cool."*

Crash-safety note: this file exists BECAUSE Aaron asked to persist the work-front and
the framings he was streaming, so a session crash loses nothing. Preserve the ferries
below verbatim in spirit.

## Why this exists (the thesis)

The name "Zeta" was conferred before it had meaning (Kenji proposed ~4 names off the
early DBSP F# + proofs; Aaron chose Zeta). This trajectory is the name **auditioning
into a construction**: conferred label → captured entropy → earned identity. Each
slice makes a real zeta function executable + self-verified, escalating from outside
objects to **our own machine**.

## Landed slices (all self-verified: two independent computations must agree)

1. **Commutative slice** — #9146 (fleet-Otto, main-lane). Euler product over knots
   under connected sum (Schubert unique factorization); `Σ N(K)⁻ˢ = Π(1−N(p)⁻ˢ)⁻¹`
   exact to degree 40; converse locked. `tests/…/ZetaOverPrimeShapes.Tests.fs`.
2. **Noncommutative slice (Ihara)** — #9148. Ihara zeta of a graph; primes =
   primitive closed geodesics (compose noncommutatively). Geodesic side
   `exp(Σ tr(Wᵏ)uᵏ/k)` = Bass side `(1−u²)^{r−1}det(I−Au+Qu²)` to degree 24 over K₄.
   `tests/…/IharaZeta.Tests.fs` + doc `…ihara-zeta-the-noncommutative-upgrade…md`.
3. **Dynamical slice (Artin–Mazur) — ζ OF THE SCHEDULER** — #9151. The cell scheduler
   IS a deterministic dynamical system; `ζ = exp(Σ Fix(fᵏ)uᵏ/k)` = `Π_periodic-orbit
   1/(1−u^|O|)`. Round-map `M=I+S` over `GF(2)^N` (ring of bits, each cell integrates
   its left neighbour mod 2 = the synchronous DoP-invariant round). Unique fixed
   point = the quiescent all-zeros society = ζ's leading 1. Self-verified to degree
   |S|. `tests/…/SchedulerDynamicalZeta.Tests.fs` + doc `…artin-mazur-zeta-of-the-
   cell-scheduler-round-map.md`.

## Move-forward #2 — LANDED

- **Ihara over the braided catalog** — the 3 catalog generators (crossing/plait/braid)
  as the 3 parallel edges of a 2-vertex multigraph; non-backtracking geodesics = braided
  words. Self-verified geodesic = Bass = closed form `1/((1−u²)²(1−4u²))` to degree 24.
  `tests/…/BraidCatalogIhara.Tests.fs` + doc `…ihara-zeta-over-the-braided-catalog…md`.
  Weighted (crossing=1/plait=3/braid=6 edge-LENGTHS, per #9146) — LANDED: the
  weighted-edge determinant `1/det(I−M(u))` = the subdivided-graph Ihara, degree 24;
  shortest geodesic = crossing+plait = length 4 (the weights surface as the first
  geodesic length). `tests/…/BraidCatalogWeightedZeta.Tests.fs`. Unifies #9146's
  commutative weights with #9153's noncommutative geodesics.

## Ferries from Aaron (2026-07-02 — PRESERVE; these are the vision, not built yet)

- **Periodic orbits = memory-space orbits made visible.** They are exactly what a
  **cheat engine** finds by pattern-matching **ISR / interrupt-handler cycles**
  (Arrow-category captured state) — "usually character loops" (a sprite's walk-cycle
  IS a period-k orbit in memory). The Artin–Mazur zeta is the **formal, math-grounded
  version of the cheat-engine's orbit detection**: the zeta *enumerates* what the
  ad-hoc scanner *finds*.
- **We already do this ad-hoc.** CHIP-8 + `IScheduler` already predict themselves —
  but ad-hoc, not this formal-math-based. This trajectory is the **rigorous basis for
  existing capability**, not a new feature. Existing surfaces:
  `src/Core/Chip8PredictionRoom.fs`, `Chip8Observer.fs`, `PredictionScheduler.fs`,
  `DarkHallScheduler.fs`.
- **mod-2 society = James Gates' adinkras.** `GF(2)^N` + mod-2 addition is exactly
  where Gates' **doubly-even self-dual ECC** (adinkra codes) live. Cell configs can be
  **secret / generator code words for society members, by purpose** — the codeword IS
  the member's identity/generator. Ties to rule
  `only-the-irreducible-is-primitive-generate-the-rest` (the generator IS the ECC;
  adinkra→Clifford→E8) and `src/Core.Lean4/Lean4/CayleyDicksonDoublyEven.lean`.

## Routed next steps (priority order)

1. **Ihara over the braided catalog** (move-forward #2, committed).
2. **Formalize the ad-hoc CHIP-8/IScheduler self-prediction**: Artin–Mazur zeta over
   the actual CHIP-8 VM step-map / a scheduler configuration, making memory-space
   character-loop orbits formally enumerable — the math-grounded cheat-engine.
   Connect to `Chip8PredictionRoom` / `PredictionScheduler`.
3. **Adinkra codewords as member identity** — LANDED (built on the EXISTING
   `Zeta.Core.AdinkraCode` [8,4,4] module, not reinvented). Added: WHY N=8 (minimal
   doubly-even self-dual length — none below 8, the E8/Clifford floor); member
   identity SELF-CORRECTS a 1-bit corruption (nearest-codeword); the weight
   enumerator `1 + 14y⁴ + y⁸` as a partition function over member identities (ζ
   shape); identities live on the same `GF(2)^8` as the scheduler round-map (#9151).
   `tests/…/AdinkraIdentity.Tests.fs`. AND (next-rung #3, LANDED): the dynamical
   zeta's orbits classify members — a code-preserving round-map (a code automorphism
   π, π(C)=C) keeps every identity valid; its Artin–Mazur zeta self-verifies
   (Fix(π^k) = orbit-product) and its orbits PARTITION the 16 members into purpose
   classes (quiescent identity = its own fixed class). `tests/…/AdinkraOrbits.Tests.fs`.
   Ties adinkra identity (#9157) to the scheduler dynamical zeta (#9151).
4. **Wire the zeta into the soft `IScheduler`** so the loop can predict its own
   recurrence spectrum (transient vs. recurrent, orbit periods) before running.
5. Further math rungs (routed, not rushed): Bartholdi / Ihara–Selberg (2-variable),
   Ruelle dynamical zeta with weights, Milnor (Alexander = Lefschetz zeta), Kurokawa
   zeta-of-categories (the braided-monoidal-category seat).

## Discipline

Every slice is **self-verified**: compute the zeta two independent ways (that share
no code) and require coefficient-by-coefficient agreement — so a wrong construction
SHOWS (a wrong operator / determinant / map diverges). This is the safety net that
makes "push into core math" safe: getting it wrong is visible, not silent.

## Anchors

Euler 1737; Riemann 1859; Schubert 1949 (knots); Ihara 1966, Bass 1992, Hashimoto
1989, Terras 2010 (graph zeta); Artin–Mazur 1965, Bowen–Lanford 1970, Ruelle, Smale
(dynamical zeta); S. James Gates Jr. (adinkras / doubly-even self-dual ECC);
Mazur/Morishita (arithmetic topology, knots↔primes).
