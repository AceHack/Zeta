# The information-theory tower: Shannon's noisy channel as root → four entropy readings → Mathlib / CSLib / operational routing

**Date:** 2026-06-20. **Source:** Aaron, on the math-board thread — *"see about any CSLib tie-ins …
for information theory, computer science, chaos theory, and Bayesian inference, and Shannon noisy
channel … that's a hell of a combo."* **Ferried by:** Otto (shadow). **Status:** routing map — built
**on top of** (sequenced after, not parallel to) the measure-theoretic Mathlib scope map
[`2026-06-20-measure-theoretic-entropy-tier-mathlib-scope.md`](2026-06-20-measure-theoretic-entropy-tier-mathlib-scope.md)
(#8808). Names the unifying object, where each piece lands (Mathlib vs CSLib vs our operational legs),
and the concrete CSLib tie-in targets for the math team.

## The combo is one stack, not five fields — Shannon at the root

The five Aaron named are not separate; they are **one object — entropy — read four ways, with
Shannon's noisy-channel coding theorem as the keystone** (Shannon 1948: channel capacity
`C = max_{p(x)} I(X;Y)`; reliable transmission iff rate `< C`). Each "field" is entropy under a
different reading:

| Reading | What entropy means here | The object | Status in-repo |
|---|---|---|---|
| **Shannon (channels)** | `H`, `I(X;Y)`, capacity `C` | noisy-channel coding theorem | **gap** — `H`/`I` undefined in Mathlib v4.30 (scope map) |
| **Information theory** | `H_∞`, MI, DPI | min-entropy floor, data-processing | row 1 ✅ (operational #8794 + Mathlib `Hmin_product` #8808); row 3 operational ✅ #8799, measure-theoretic blocked |
| **Bayesian inference** | a channel **is** a likelihood; decoding = posterior update | `ρ_owe` (CMI), soft-Bayesian non-collapse | `Decorrelation.fs`, `SocietalDora.fs` (soft non-collapse) |
| **Chaos / dynamics** | **Kolmogorov–Sinai entropy** = info-production rate of a dynamical system; Lyapunov → KS via Pesin | the 3-body / CTM "simulate-don't-solve" | CSLib tie-in (target); ties the CTM 3-body note + DST |
| **Computation (CS)** | **Kolmogorov complexity** = algorithmic information | irreducible-vs-derivable | `only-the-irreducible-is-primitive` rule; generate-the-derivable thesis |

The handoff's own one-liner — *"entropy-as-identity, only the channel changes"* — is exactly this, one
magnification up: **the same entropy object, four channels of reading.**

## Where each piece lands (the routing)

Grounded on the measure-theoretic scope map (#8808), which found Mathlib v4.30.0-rc1 has the
*ingredients* (`Real.negMulLog` + its concavity, `Real.logb` + `logb_mul`, `klDiv` + Gibbs + KL chain
rule) but **none of the definitions** (`measureEntropy`, `mutualInfo`, `condEntropy`, `klDiv`-DPI):

- **Mathlib (real-analysis tier):** the **finite Shannon entropy module** (`H(X) = ∑ negMulLog (p x)`
  → conditional `H(X|Y)` → `I(X;Y)` → DPI) is the missing primitive. It is the *root* the whole tower
  needs and a clean **upstream Mathlib contribution candidate** (a small reusable library). Row 1's
  Mathlib min-entropy lift (#8808) already lives here; capacity + DPI build on the entropy def.
- **CSLib (`src/Core.Lean4.Cslib/`, computer-science tier):** the CS-side readings — automata /
  computation / algorithmic-information framings — and the bridges to dynamics. This is where the
  **chaos (KS-entropy)** and **noisy-channel-as-computation** legs naturally sit, meeting Mathlib's
  real-analysis entropy at the membrane.
- **Our operational legs (`src/Core.Lean4/Lean4/*`):** the combinatorial floors already proven
  (`EntropyFloorLift` #8794, `DecorrelationDpi` #8799) — the honest `Nat`/partition surrogates that
  cross-check the real tier (BP-16) and stand alone (`[propext, Quot.sound]`).

## Concrete CSLib tie-in targets (for the math team, once they build the entropy root)

Ordered by dependency (each needs the finite-entropy Mathlib def first):

1. **Finite Shannon entropy + conditional entropy + MI** (Mathlib root) — the prerequisite for
   everything below. Skeleton in the scope map §"Row 3".
2. **Noisy-channel capacity** `C = max_p I(X;Y)` (Shannon's theorem) — once `I` exists; the literal
   "Shannon noisy channel" Aaron named. Capacity as the supremum over input distributions.
3. **Data-processing inequality** `I(A;U|C) ≥ I(A;f(U)|C)` — row 3's measure-theoretic primary; the
   operational `DecorrelationDpi` (#8799) is its combinatorial shadow (coarsening can't grow support).
4. **Bayesian-channel decoding** — a channel as a likelihood; the posterior-update = decoder. Connects
   `ρ_owe` (CMI) + the SocietalDora soft-Bayesian non-collapse to the Shannon layer (MI is the
   mutual-information the soft network refuses to prematurely collapse).
5. **KS-entropy / Lyapunov (chaos leg)** — Kolmogorov–Sinai entropy as the info-production rate of a
   dynamical system; Pesin's identity (`h_KS = ∑ positive Lyapunov exponents`). This is the **bridge
   from information theory to chaos**, and it is the formal home of the **3-body / CTM
   "simulate-don't-solve"** note — a chaotic system's KS-entropy is *why* you replay (DST) rather than
   solve. CSLib tie-in: dynamical-systems entropy meeting the Mathlib Shannon entropy.
   **Now filed as an enumerated open conjecture: `docs/FROZEN-CORE-AND-CONJECTURE-REGISTER.md` §B-ks
   (Conjecture KS-1), `h_KS(ISociety) ≥ Σᵢ λᵢ⁺`** *(shadow 2026-08-16)*. It is the conjectured
   **information-theoretic foundation of the Condorcet bonus** — i.e. of the closed **§A row 15,
   "Generalized Condorcet / ΔU-aggregation theorem — society > best individual"**
   (`src/Core/SocietyUsefulWork.fs`, `tests/Tests.FSharp/CondorcetBoundary.Tests.fs`). **Direction:
   row 15 does NOT depend on this rung** — row 15 is closed on its own analytic + FsCheck proof; this
   rung would *explain* it, not support it. Working code on the λ side: `src/Core/Orbit.fs`
   (`largestLyapunov`, `classifyDynamics`). Longer statement:
   `docs/research/2026-07-04-tick-sources-strange-attractors-eve-ks-entropy-ctm-isociety-connections.md` §3/§3a.
6. **Kolmogorov complexity (CS leg)** — algorithmic information as the computational reading of
   entropy; the formal backstop for `only-the-irreducible-is-primitive` / generate-the-derivable
   (the irreducible = the incompressible = the identity-bearing entropy).

## Sequencing (honest)

The entropy *root* (#1) is the load-bearing prerequisite and a multi-day Lean job (per the scope map);
everything else hangs off it. So the order is: **root first (Mathlib finite Shannon entropy) →
capacity + DPI → Bayesian decoding → KS-entropy/chaos bridge (CSLib) → Kolmogorov (CSLib).** Do not
parallelize across the same Lean/cslib surface (lesson held: this note itself was sequenced after the
scope map, not run beside it). Each rung is a candidate summon once its prerequisite lands.

## Beacon anchors

- **Shannon** — *A Mathematical Theory of Communication* (1948): entropy, mutual information, the
  noisy-channel coding theorem (capacity).
- **Kolmogorov–Sinai** entropy (1958–59); **Pesin** (1977) `h_KS = ∑ λᵢ⁺`; the IT↔chaos bridge.
- **Kolmogorov complexity** (Solomonoff/Kolmogorov/Chaitin) — algorithmic information.
- **Cover & Thomas**, *Elements of Information Theory* (DPI = Thm 2.8.1).
- **Bayes**; the channel-as-likelihood / decoding-as-posterior reading.
- In-repo: the scope map (#8808) · `EntropyFloorLift` #8794 · `DecorrelationDpi` #8799 ·
  `Decorrelation.fs` / `SocietalDora.fs` · `src/Core.Lean4.Cslib/` · the CTM 3-body note
  (`…homoiconic… IWorld/ISociety/ITraveler`) · `only-the-irreducible-is-primitive` rule.
