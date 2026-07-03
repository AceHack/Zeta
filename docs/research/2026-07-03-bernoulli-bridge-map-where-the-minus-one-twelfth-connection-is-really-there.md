# The Bernoulli bridge map — where the −1/12 connection is really there

*Soraya + math team, exploratory pass, 2026-07-03, on Aaron's ask: "get their insights on the
−1/12 stuff or just casimir/Bernoulli number like possibilities, it's just cool to have the
connection mapped if it's really there." Follow-up to the triage verdict
(`2026-07-03-soraya-verdict-minus-one-twelfth-…`); this pass maps rather than re-litigates. All
constants sympy/mpmath-verified — replayable scripts:
`scripts/2026-07-03-bernoulli-bridges-1.py` / `-2.py`.*

## The bridge map

| # | Bridge | Precise statement | Class | Verified how |
|---|--------|-------------------|-------|--------------|
| 1 | **Trapezoid / Euler–Maclaurin** | For smooth I with I, I′ → 0: Σₙ I(nΔ)·Δ − ∫I(ν)dν = (Δ/2)I(0) − (Δ²/12)I′(0) + (Δ⁴/720)I‴(0) − …; per-panel trapezoid error = h³f″/12. Same B₂ = 1/6 → 1/12 as Casimir, but as a **finite-Δ correction coefficient** — no regularization. | **PROVEN-ELEMENTARY** | sympy: flat regulated spectrum gave `1/2 + a/12 − a³/720`; single-panel error `c₂h³/12` exactly |
| 1b | **The −1/12 itself, honestly** | Linear spectrum x·e^{−ax}: Σ − ∫ = **−1/12** + a²/240 − …, limit a→0 exactly −1/12 = −B₂/2!·f′(0). **Scheme-independence probed:** Gaussian regulator x·e^{−(ax)²} also → −1/12. Two independent regulators, same finite part — requirement (c) of the verdict, met numerically. | **PROVEN-ELEMENTARY** (in the regulator-difference framing) | sympy series + limit; two-regulator numeric check |
| 2 | **Spectral zeta / log-det (Ray–Singer)** | KL between Gaussian measures carries log det of covariance operators; divergent spectra define det A := exp(−ζ_A′(0)). Dirichlet Laplacian on [0,L] ("plates"): det(−Δ) = **2L**, via ζ(0) = −1/2 and ζ′(0) = −½log 2π — real zeta regularization inside information quantities, carrying **different constants** than −1/12. Mutually-absolutely-continuous GPs need no regularization (convergent Fredholm det); ζ-reg enters when comparing across *different windows/boundary conditions* — exactly the tick-window plates situation. | **PROVEN-DEEP** (Ray–Singer 1971; Seeley–DeWitt); the IV-entry point CONDITIONAL | sympy + mpmath: exp(−ζ′(0)) = 6.0 at L=3 (= 2L) |
| 3 | **Casimir-analog conditions** | Needs Iₙ ∝ n (energy-per-mode ∝ frequency — the ½ℏω structure). Searched the natural Zeta quantities: bandlimited windows → Σ1 → ζ(0) = −1/2; GP log-quantities → Σ log n → ζ′(0); Wiener → convergent. **No linear-in-n candidate found.** Verdict stands: (a) unmet; (b), (c) meetable (see 1b). | **NUMEROLOGY** until a candidate exists | exhaustion over the natural spectra |
| 4 | **Constants zoo** | flat → ζ(0) = **−1/2** · linear → ζ(−1) = **−1/12** · cubic (real 3-D Casimir) → ζ(−3) = **+1/120** · log → ζ′(0) = **−½log 2π** · Wiener 1/ν² → **π²/6, convergent** — no regularization needed, hence an honest finite total IV with no scheme-dependence at all. | PROVEN per entry | sympy all five; mpmath cross-check |
| 5 | **Stirling → Bayesian log-evidence** | log Γ(z) = (z−½)log z − z + ½log 2π + Σ B₂ₙ/(2n(2n−1))z^{−(2n−1)} — coefficients **1/12z, −1/360z³, +1/1260z⁵**. Conjugate marginal likelihoods (Dirichlet-multinomial, Gamma-Poisson) are Γ-ratios ⇒ **Bernoulli numbers appear verbatim in the O(1/N) corrections to log-evidence** — the terms BIC truncates. The most concrete Bernoulli-in-our-actual-code crossing found. | **PROVEN-ELEMENTARY** | mpmath: 3-term Stirling matches log Γ(20) to 4.7e−13; residual at N=50 matches 1/(12(N+α)) to 7 digits |
| 5b | **Todd class / BCH** | x/(1−e^{−x}) = 1 + x/2 + **x²/12** − x⁴/720 + … — the Bernoulli generating function; the same series drives BCH coefficients and the Todd class. It IS Euler–Maclaurin's kernel — the same 1/12 as bridge 1, wearing index-theory clothes. | **PROVEN-DEEP** | sympy series |
| 6 | **Montgomery–Odlyzko (ζ zeros ↔ GUE)** | Pair correlation of ζ zeros matches GUE eigenvalues. **Cultural cousin only — mechanically unrelated to −1/12.** Labeled to prevent future pattern-match citation. | — | n/a |

## The best candidate for making Z-1 provable

**Bridge 1.** Restate Z-1 as a finite-Δ theorem: tick-sampling a smooth information flux
overcounts the continuous integral by (Δ/2)I(0) − (Δ²/12)I′(0) + O(Δ⁴) — trapezoid form: error
density −(Δ²/12)I″ per unit. Elementary, verified, needs no ζ(−1) — **the soul of Z-1 survives
as a Bernoulli correction coefficient, not a regularized total.** Two caveats travel with it:
(i) it is an **endpoint/boundary effect** — periodic or Nyquist-sampled bandlimited fluxes have
exponentially small corrections, so the frame-rate cost is paid at *window edges* (which fits
the plates picture rather than breaking it); (ii) the constant multiplies the spectral slope —
it is −1/12 *per unit of slope*, becoming the bare number only in the linear-spectrum limit,
where the two-regulator check supplies the scheme-independence the verdict demanded.

## The answer to Aaron

Yes — really there, in three honest forms, and **bigger than the meme**: (1) the trapezoid
rule's 1/12 is the same B₂ as Casimir's and provably prices tick-sampling today — elementary,
finite, no renormalization; (2) zeta regularization proper genuinely enters Gaussian-process
information via spectral log-dets (plates on an interval: det = 2L), just carrying different
constants; (3) Bernoulli numbers sit verbatim in Bayesian log-evidence via Stirling — 1/12N in
every conjugate normalizer, already in our posteriors. The bare −1/12 as a total IV cap remains
conditional on a linear-in-n spectrum nothing in the architecture supplies. The full zoo — −1/2,
−1/12, +1/120, −½log 2π, π²/6 — each owns a spectrum class, and Zeta's natural setups land on
the *unfamous* ones. The connection isn't the celebrity number; it's the Bernoulli family, and
we're already related.

## Pointers

- `scripts/2026-07-03-bernoulli-bridges-1.py` / `-2.py` — replayable verification (text, per no-binary-in-proof-lineage).
- `2026-07-03-soraya-verdict-minus-one-twelfth-…` — the triage this composes with (falsifier; B-path requirements).
- `2026-07-03-zeta-regularization-cognitive-cost-of-discrete-ticks-amara.md` — Conjecture Z-1 (Lumen); bridge 1 is its provable restatement candidate.
- `2026-07-03-ferry-hard-money-entropy-budgets-cap-iv-…` — the economy's soundness is already decoupled from Z-1 either way.
- Anchors (Beacon): Euler 1738 / Maclaurin 1742; Hardy, *Divergent Series*; Casimir 1948; Ray–Singer 1971; Seeley 1967; de Moivre/Stirling 1730; Hirzebruch (Todd class); Montgomery 1973 / Odlyzko 1987.
