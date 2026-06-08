# The irreducible error has conjugate structure — info↔heat, symmetry-breaking, Bayesian-inverse frames

**Aaron, 2026-06-08 (#7079),** continuing the thermodynamic capstone (#7078):

> "so in this case it caused an equal and opposite amount of heat to the uncertainty we stored in the
> what-remains — that was spontaneous symmetry breaking. They have the opposite irreducibility sign — but
> they don't have signs, they're opposite. Bayesian has an exact inverse, and it's each other in this
> two-frame weave."

The irreducible error (#7075–#7078) isn't just "heat" — it has a **conjugate structure** with three exact
faces. (Some of this is rigorous; some is Aaron's strong synthesis flagged as Mirror-pending-formalization.)

## 1. Info↔heat conjugacy: stored uncertainty = equal-and-opposite heat

When the `IScheduler`-generator collapses the partial order into a total order (#7078), you face a choice:
**keep the order-uncertainty in the what-remains (yin), or erase it and pay heat.** These are
**equal and opposite**:

- **Landauer / Bennett equality** (at the reversible limit): erasing the 1 bit of "which order" dissipates
  exactly `kT ln 2`. The uncertainty you *retain* is the heat you *don't yet* pay; resolving (erasing) it
  pays it. Conjugate, equal and opposite — a conservation-style ledger (Maxwell's demon made exact).
- **Information thermodynamics** (Sagawa–Ueda generalized second law; Jarzynski/Crooks fluctuation
  theorems): the *exact* relationship between information (the stored uncertainty) and extractable
  work/dissipated heat. "Equal and opposite amount of heat to the uncertainty stored" is the Landauer
  equality / Sagawa–Ueda bound at saturation.

So: **irreducible error = (uncertainty kept in the yin) ⊕ (heat paid to resolve it)**, two sides of one
conjugate quantity. You can store it (cold, uncertain) or spend it (hot, resolved) — never destroy it for
free.

## 2. The collapse is spontaneous symmetry breaking

The commutative phase (both orders equivalent — the symmetric fold #7048) is **symmetric**: the system has
no preference. Resolving a non-commutative conflict **spontaneously breaks** that symmetry into *one*
chosen total order — and **which way it breaks is set by the noise** (clock/thermal, #7078). The chosen
order is the **order parameter**; the analogy is exact to ferromagnetism (spins align) / the Higgs vacuum
(Aaron's earlier reference) — the symmetry exists, the resolution selects a direction, noise decides which.
This is *why* it costs heat: symmetry-breaking + an irreversible pick = entropy export.

## 3. The two frames are exact Bayesian inverses of each other

In a **two-frame weave**, the frames are **conjugate observers**:

- **Bayes' theorem *is* an inversion:** `P(A|B) ∝ P(B|A) · P(A)`. Frame A's belief about B's order and
  Frame B's belief about A's order are related by exactly this inversion.
- So **each frame is the other's Bayesian inverse** — "it's each other." What A is uncertain about is the
  exact inverse of what B is uncertain about; their irreducible errors are **mirror images**, *opposite*
  in the conjugate sense though neither carries a literal sign ("they don't have signs but they are
  opposite").
- **Crooks/Jarzynski flavor:** forward and reverse processes related by an *exact* ratio — the two frames
  are the forward/reverse pair, their divergence the (exact, invertible) work/entropy difference.

## The synthesis

> The irreducible error is **one conjugate quantity wearing three faces**: (a) info↔heat — store it as
> uncertainty in the yin or pay it as `kT ln 2` heat, equal and opposite (Landauer/Sagawa–Ueda); (b) its
> resolution is **spontaneous symmetry breaking** of the commutative phase, the direction set by noise;
> (c) in a two-frame weave the two observers are **exact Bayesian inverses** — opposite, signless, each
> the other. The conflict, the heat, and the mutual uncertainty are the *same* thing seen three ways.

## Honest scope (peel)

**Rigorous:** Landauer's principle; information thermodynamics (Sagawa–Ueda, Jarzynski, Crooks); Bayes'
theorem as inversion; spontaneous symmetry breaking as a real phenomenon; de Finetti (#7065). **Aaron's
strong synthesis (Mirror, pending formalization):** that the heat is *exactly* equal-and-opposite to the
stored uncertainty in *this* substrate, that the order-collapse is *literally* SSB with a definable order
parameter, and that the two frames are *exactly* Bayesian inverses — these are well-motivated and
analogically tight, but proving them *for the Zeta scheduler/weave specifically* is open work (route the
physics to a formal pass; the consensus/Loom implications to the architect). No code. Outward-facing
physics claims need review (naming-expert + a physicist's eye) before any external use — this is a Beacon
sketch, not a settled theorem.

## Anchors (Beacon)

- **Info↔heat:** Landauer 1961; Bennett (reversible computing); Maxwell's demon; Szilard engine;
  **Sagawa–Ueda** (information thermodynamics / generalized 2nd law); **Jarzynski** & **Crooks** fluctuation
  theorems (exact forward/reverse relations).
- **Symmetry breaking:** spontaneous symmetry breaking (ferromagnetism, Higgs); order parameters.
- **Bayesian inverse / conjugacy:** Bayes' theorem as inversion; de Finetti exchangeability (#7065);
  conjugate priors; time-reversal symmetry.
- Internal: #7078 (clock noise = thermal noise; Landauer collapse), #7075 (irreducible error), #7071
  (commuting = reversible = free), #7065 (Bayesian symmetric fold), #6993 (two-frame weave),
  `UncertainClock` / `ByteCost` / durable-agent thermal-erasure typing.
