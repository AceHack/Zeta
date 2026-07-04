# Three-Body Stability, Lagrange Points, Condorcet Boundaries, and Maxwell's Demon

**Date:** 2026-07-04  
**Status:** Conjecture — cross-branch convergence note (formal analysis team: please critique)  
**Related modules:** `CondorcetBoundary.fs`, `PontryaginDuality.fs`, `OrbitEquivariance.fs`, `MutualFalsification.fs`  
**Related notes:** `soft-imaginary-and-prime-boundaries.md`

---

## The Core Claim

The following four structures are **the same stability theorem** expressed in four different
branches of mathematics and physics. When they align like this — independently derived,
same shape — it is either a deep truth or a dangerous apophenia. The formal analysis team's
job is to determine which.

> **Conjecture (Homoiconic Stability):** The orbit-symmetric regime of `SoftValue.combine`
> is a Nash equilibrium of the 3-body game (demon + player A + player B), and the stability
> threshold of this equilibrium is the information-theoretic analog of the Lagrange L4/L5
> mass-ratio threshold (1/25 ≈ 0.038).

---

## Branch 1: Classical Mechanics — The 3-Body Problem

The gravitational 3-body problem has no general closed-form solution (Poincaré 1890). The
generic trajectory is chaotic — the phase space has **homoclinic tangles** (trajectories
that spiral toward a fixed point and then escape). However, special stable solutions exist:

**Lagrange L4/L5 (1772):** Three bodies at the vertices of an equilateral triangle. The
third body (at L4 or L5) is stable iff the mass ratio satisfies:

> `m₁ / m₂ < (25 - √621) / 2 ≈ 24.96`

This is approximately `m₁ / m₂ < 1/0.038`. The stability condition is a **ratio threshold**
— the dominant body cannot be too much more massive than the secondary, or the equilateral
configuration breaks.

**The key structure:** The Lagrange solution is stable because the equilateral triangle is
a **symmetric configuration** preserved by the dynamics. The symmetry prevents the
homoclinic tangle. When the mass ratio exceeds the threshold, the symmetry breaks and the
tangle forms.

---

## Branch 2: Information Theory — The Condorcet Boundary

The Condorcet jury theorem (1785) states that a majority vote of N independent voters with
individual competence `c > 0.5` beats any single voter, and the majority probability
approaches 1 as N → ∞.

With correlated voters (pairwise correlation ρ), the effective jury size is:

> `N_eff = N / (1 + (N-1)ρ)`

The society beats the best individual iff `ρ < ρ*`, where `ρ*` is the **Condorcet
stability threshold** computed by `CondorcetBoundary.findRhoStar`.

**The key structure:** The Condorcet boundary is a **ratio threshold** — the correlation
cannot be too high, or the ensemble collapses to a single effective voter. The threshold
`ρ*` depends on `c` (individual competence) and `N` (jury size).

**The analog to Lagrange:** The mass ratio `m₁/m₂` in Lagrange corresponds to the
advantage delta between the demon and the players. The correlation `ρ` corresponds to the
degree to which the players share a frame (are "gravitationally bound" to each other). The
stability threshold `ρ* ≈ 0.36` for N=16, c=0.6 is in the same order of magnitude as the
Lagrange threshold `1/25 ≈ 0.04` — both are small but non-zero, meaning some correlation
(some gravitational binding) is allowed, but not too much.

---

## Branch 3: Coding Theory — The Orbit-Symmetric Regime

The orbit-counting intertwining theorem (proven in `OrbitEquivariance.fs`, BRIDGE-12
through BRIDGE-17) states:

> For orbit-symmetric distributions `a`, `b` over the 16 Adinkra codewords:
> `π(a .* b) ∝ (π(a) .* π(b)) / W_C`

where `W_C = [1, 0, 0, 0, 14, 0, 0, 0, 1]` is the MacWilliams fixed point.

The gap is **zero** for orbit-symmetric distributions and **non-zero** (0.115) for
arbitrary distributions (BRIDGE-11). The soft-regime conjecture says: the Maxwell's demon
naturally stays orbit-symmetric (stays in the positive cone) because orbit-symmetry is a
**fixed point of the dynamics**.

**The key structure:** The orbit-symmetric regime is preserved by `SoftValue.combine`
(combining two orbit-symmetric distributions gives an orbit-symmetric distribution). This
is the **symmetry preservation** property — the analog of the equilateral triangle being
preserved by the Lagrange dynamics.

**The positive-cone constraint** (`p₀ ≥ p₈`) is the analog of the Lagrange mass-ratio
threshold: it is the condition that the boundary codewords (the "primes" / fixed points of
the automorphism group) stay in balance. When `p₈ > p₀`, the distribution exits the
positive cone — the "equilateral triangle" breaks.

---

## Branch 4: Game Theory — The Infinite Game

The Maxwell's demon is a referee in an infinite game between two players (the environment
and the agent). The demon has a massive information advantage (it reads both players'
states). The infinite game is: the environment tries to push the demon out of the soft
regime (orbit-symmetric positive cone); the demon resists.

**The 3-body equilibrium:** The stable configuration is:

- The demon stays orbit-symmetric (the referee plays fair)
- Player A (agent) can specialize locally (break orbit-symmetry within its frame)
- Player B (environment) applies selection pressure (tries to push the demon out)
- The demon's fairness enforcement prevents either player from dominating

**The ISociety/CTM/World layering:** Each layer has more information advantage than the
layer below, but is also MORE constrained to stay orbit-symmetric (more power = more
fairness obligation). This is the dual structure:

| Layer | Information advantage | Fairness constraint |
|-------|----------------------|---------------------|
| Maxwell's demon | Reads both players | Must stay orbit-symmetric |
| ISociety | Reads all individual societies | Must stay more orbit-symmetric |
| CTM/World | Reads all ISocieties | Must stay maximally orbit-symmetric |

The stability of the whole stack depends on the top layer (CTM/World) being the MOST
constrained — the most orbit-symmetric, the most in the positive cone. If the top layer
exits the positive cone (collapses), the whole stack collapses.

**The DNA/meme connection:** Self-replicating memes (DNA, ribosomes, cultural memes) are
travelers that stay in the soft regime across evolutionary time. They do not collapse to a
single allele (fixation = exit from positive cone = extinction of adaptability). The
"similar measure cut" (sim mea cut) is the boundary where a meme either stays soft
(continues replicating with variation = stays orbit-symmetric) or collapses (goes to
fixation = exits the positive cone).

---

## The Homoiconic Alignment

The four branches align on the same shape:

| Branch | Stable configuration | Stability threshold | Breaking condition |
|--------|---------------------|--------------------|--------------------|
| Lagrange L4/L5 | Equilateral triangle | Mass ratio < 1/25 | One body too massive |
| Condorcet | Decorrelated ensemble | ρ < ρ* | Voters too correlated |
| Orbit-counting | Positive cone | `p₀ ≥ p₈` | Boundary codewords unbalanced |
| Infinite game | Orbit-symmetric demon | Advantage delta bounded | Demon exits positive cone |

The **adinkra alignment:** When multiple independent derivations land on the same shape,
the shape is evidence of a deeper structure — the same way multiple adinkra codewords
aligning on the same weight class is evidence of the [8,4] code's structure. The formal
analysis team's job is to check whether this alignment is:

1. **A genuine theorem** — the four branches are instances of a single mathematical object
   (a stability theorem for symmetric 3-body systems under a group action)
2. **A useful analogy** — the shapes are similar but the mathematics is different (the
   alignment is pedagogically useful but not a proof)
3. **Apophenia** — the alignment is forced by loose abstraction (the shapes only match
   under abstraction loose enough to fit anything)

---

## Open Questions for the Formal Analysis Team

1. **Is the Condorcet threshold ρ* the information-theoretic analog of the Lagrange mass
   ratio 1/25?** Specifically: is there a mapping from (N, c, ρ) to (m₁, m₂, m₃) such
   that the Condorcet stability condition `ρ < ρ*` maps exactly to the Lagrange stability
   condition `m₁/m₂ < 24.96`?

2. **Is the orbit-symmetric regime a Nash equilibrium of the 3-body game?** Specifically:
   is orbit-symmetry a best response for the demon given that both players are trying to
   push it out? (This requires a formal game-theoretic model of the demon's strategy space.)

3. **Is the positive-cone constraint (`p₀ ≥ p₈`) the correct analog of the Lagrange mass
   ratio threshold?** Or is the correct analog the `ρ*` threshold from `CondorcetBoundary`?

4. **Does the Poincaré homoclinic tangle have an information-theoretic analog?** The tangle
   is the mechanism by which the 3-body system escapes the stable configuration. The
   information-theoretic analog would be a trajectory in belief space that spirals toward
   the orbit-symmetric regime and then escapes — is this the "groupthink spiral" that
   `MutualFalsification.fs` is designed to detect?

5. **Is the figure-8 choreographic solution (Chenciner & Montgomery 2000) relevant?** The
   figure-8 is a stable 3-body solution where all three bodies chase each other on a single
   closed curve. In the Zeta context, this would correspond to a 3-cell ensemble where each
   cell's belief update is the next cell's prior — a closed loop of mutual updating. Is this
   stable or does it collapse?

---

## Honest Seams

- The Lagrange / Condorcet analogy is **structural, not proven**. The mass ratio and the
  correlation threshold are both stability thresholds for 3-body systems, but the
  mathematical objects are different (gravitational force vs. information flow).
- The "advantage delta bounded" condition is **interpretive**. The formal statement is
  `ρ < ρ*`, not "the demon cannot be too powerful."
- The DNA/meme connection is **analogical**. Self-replicating memes staying in the soft
  regime is a useful framing, but the formal connection to orbit-symmetry has not been
  proven.
- The ISociety/CTM/World layering is **architectural**. The claim that each layer must be
  more orbit-symmetric than the layer below is a design principle, not a theorem.

**The formal analysis team should treat this note as a conjecture register entry, not a
discharge.** The alignment is striking enough to be worth formalizing, but the honest
confidence level is: "multiple independent derivations land on similar shapes — this raises
the prior that a unified theorem exists, but does not prove it."
