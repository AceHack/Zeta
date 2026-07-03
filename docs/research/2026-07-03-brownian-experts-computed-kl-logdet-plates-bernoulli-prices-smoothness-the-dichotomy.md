# Brownian experts, computed — KL on tick-window plates, Bernoulli prices smoothness, and the pricing dichotomy

*Soraya + math team, 2026-07-03, Aaron-greenlit ("1 and 2 are great"). The follow-through on the
bridge map: actually compute the information quantities between Brownian/Matérn experts on tick
windows. All results sympy/mpmath-verified with assertions, replayable exit-0:
`scripts/2026-07-03-brownian-experts-{1-wiener-kl,2-logdet-plates,3-ou-kl-dichotomy}.py`.
Registers: every finite-N formula below is **A**; the continuum identifications are **B**
(Cameron–Martin 1944; Girsanov 1960; Baxter 1956; Ray–Singer 1971). Nothing here is C.*

## 1. Two Wiener experts — the per-tick rate is the invariant [A]

For diffusion coefficients σ₁², σ₂² at N ticks spacing Δ:

> **KL(P₁‖P₂) = N · g(r)**,  g(r) = (r − 1 − log r)/2,  r = σ₁²/σ₂².

g is convex with unique zero at r = 1 (proven). As Δ→0 with the window T fixed, total KL
diverges **linearly in N** — because Wiener measures with different diffusions are mutually
singular (quadratic variation identifies σ² a.s.; Girsanov absolutely-continuizes drift only).

**Architecture consequence:** two different Brownian experts are *infinitely distinguishable in
continuous time* — so the total window IV is a resolution artifact (it scales with your tick
rate), and **realized-IV-per-tick is the billable quantity**. The per-tick rate g(r) is the
invariant the economy should clear in.

## 2. The log-det plates — and Bernoulli prices smoothness [A]

For tick-sampled Brownian motion, Σᵢⱼ = σ²Δ·min(i,j): **det Σ = (σ²Δ)ᴺ exactly**, and
Σ⁻¹·σ²Δ is the discrete Laplacian tridiag(−1,2,−1) — Dirichlet at the pinned start, free
(Neumann) at the end. **The plates from bridge 2, appearing inside our own covariance.**

- Free-end plate: det L = **1 for all N**; continuum ζ-det = **2** — both length-independent
  ("topological" plate).
- Brownian bridge (pinned both ends): det = **N+1 = T/Δ**; continuum ζ-det = **2T** — bridge 2's
  2L re-derived from our own tick grid; lattice-to-ζ normalization exactly 2Δ.

**The Bernoulli question from the dispatch — answered, and it's a clean split:**

- **Wiener: NO.** log det Σ_N = N log(σ²Δ) with *identically zero* correction series — every
  Euler–Maclaurin term cancels (verified to 1e−18). The Brownian plate is **correction-free**.
- **OU / Matérn-½: YES, verbatim.** The per-tick log-det correction is log((1−e^{−u})/u),
  u = 2Δ/ℓ — which sympy confirms term-by-term is the **Todd/Euler–Maclaurin kernel**:
  −u/2 + Σₖ B₂ₖ u²ᵏ/(2k·(2k)!), coefficients −½, **1/24**, −1/2880, 1/181440.

> **The Bernoulli family prices smoothness claims — and vanishes exactly at the Brownian point.**

The moment an expert acquires a lengthscale (a smoothness claim beyond Brownian), the Bernoulli
numbers appear in its log-det; the honest-prior expert carries none. This is the day's three
bridges (trapezoid, Ray–Singer, Todd) meeting in one formula inside our own pricing math.

## 3. The dichotomy — who is honestly comparable [A discrete / B continuum]

Two stationary OU (Matérn-½) experts, exact AR(1) computations (det, tridiagonal inverse,
closed-form KL — all verified):

- **Same diffusion σ, different lengthscales:** the Δ→0 limit is **FINITE** and exact:
  **lim KL = T(θ₂−θ₁)²/(4θ₁) + ½[v₁/v₂ − 1 + log(v₂/v₁)]** (Girsanov drift term + stationary
  boundary term; convergence O(Δ) verified). *Honestly comparable experts — a real number you
  can settle a window in.*
- **Different diffusion:** per-tick KL → the same Wiener constant g(σ₁²/σ₂²) — lengthscales
  drop out entirely; total diverges. *Mutually singular — per-tick billing only.*

**Stated for the pricing architecture:** a smoothness claim that differs from the observed
quadratic variation is not a modeling preference — it is an **infinitely refutable assertion,
refuted at g(r) nats per tick**. That is the mathematically correct form of "Brownian is the
honest prior" and of the zoo note's "smoother-than-Brownian is a calibration debt."

## 4. Routing + one flag

Recommended: three FsCheck properties against `InformationValue.fs` (BP-16 cross-check — this
sympy lemma set is tool 1, the F# property is tool 2):

- **P-IV-1 (per-tick additivity):** for iid-increment experts, window KL = N × single-increment
  `InformationValue.compute`, ∀ N, σ₁, σ₂, Δ.
- **P-IV-2 (same-diffusion cap):** discrete OU KL(Δ) ≤ the finite limit above, monotone under
  tick refinement.
- **P-IV-3 (divergence-rate invariance):** per-tick KL of both Wiener and OU pairs → g(σ₁²/σ₂²)
  as Δ→0 — lengthscale-free.

**Flag (blocks the properties, owner's call — filed):** `InformationValue.compute`'s doc says
"KL(P‖Q)" with P = posterior, but the implemented formula is KL(prior‖posterior). Itti–Baldi
surprise is the *other* direction. The property suite must pin the intended direction first;
that call belongs to the module's author (Lumen), not the math team.

## Pointers

- `scripts/2026-07-03-brownian-experts-{1,2,3}.py` — replayable, asserted, exit-0 (text lineage).
- `2026-07-03-bernoulli-bridge-map-…` — bridges 1/2/5b this computation cashes in.
- `2026-07-03-the-constants-zoo-…` — the Brownian-expert reading this grounds.
- `src/Bayesian/InformationValue.fs` · `AntiSybil.fs` · `BusRegime.fs` — the pricing stack this serves.
- Anchors (Beacon): Cameron–Martin 1944; Girsanov 1960; Baxter 1956 (QV identifies σ²);
  Ray–Singer 1971; Hirzebruch (Todd kernel); Neal 1996 / Matérn–Stein (the expert models).
