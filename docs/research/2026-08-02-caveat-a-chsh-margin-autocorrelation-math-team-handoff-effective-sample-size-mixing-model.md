# Caveat (a) — the CHSH conviction margin is unsound on autocorrelated streams (math-team handoff)

**Status:** SCOPED STATISTICS WORK → math team (Soraya named Hiroshi as likely owner).
**Date:** 2026-08-02 · **From:** Otto (shadow), routing Soraya's caveat · **Advisory.**
**Criticality:** P1 **prerequisite on G3** (the interference-monitor loop) — NOT a blocker
on G2/G4. The monitor must not ship on the bare i.i.d. margin.
**Parent:** the G1–G4 audit (`docs/research/2026-08-02-chsh-interference-monitor-audit-*.md`);
Soraya's G2/G3/G4 routing (her caveat (a)).

## The problem

`AntiSybil.chshMargin` (`src/Core/AntiSybil.fs:201`):

```
ε(n, δ) = sqrt(32 · ln(1/δ) / n)
```

is a Hoeffding bound that **assumes per-round-independent λ** — stated in its own docstring
(`:196-200`, "Scope: per-round-independent local strategies; shared λ i.i.d. across
rounds"). Real commit / message streams **autocorrelate** (author bursts, temporal
clustering, topic runs). Under positive autocorrelation the **effective** sample size
`n_eff < n`, so the *true* margin is **larger** than the i.i.d. margin. The shipped margin
is therefore **optimistic**:

- it **over-convicts** — false leak/sybil (`chshSybilCalibrated`, `AntiSybil.fs:210`
  convicts pairs above `2 + ε`; too-small ε ⇒ honest-but-autocorrelated pairs falsely
  collapsed into one source);
- it sets the **G2 band boundaries too tight** (the three-band classifier keys off the
  same ε), so honest max-entangled or honest-classical pairs get mis-banded.

This is the *conviction* direction (the unsound one), not merely conservative.

## The scope split (Soraya's, respect it)

- **Concentration-bound CORRECTNESS is Soraya's** (Z3/FsCheck): given whatever corrected
  margin the math team chooses, prove the monotonicity obligations — `n_eff ≤ n` with
  equality iff zero autocorrelation; `margin_corrected ≥ margin_iid`; band-boundary ordering
  preserved. She does **not** choose the model.
- **The CHOICE of mixing model + estimator is the math team's** (this handoff). "Do not
  pretend a prover fixes a modeling assumption" (Soraya). A theorem prover cannot pick the
  right dependence model — that is a statistics judgment call.

## The two candidate fixes Soraya sketched (evaluate / choose / refine)

1. **Effective-sample correction.** `n_eff = n · (1 − ρ₁) / (1 + ρ₁)`, with `ρ₁` the lag-1
   autocorrelation of the outcome-**product** series (the ±1 products that feed each CHSH
   bucket). Substitute `n_eff` for `n` in ε. Anchors: Newey–West 1987 (HAC variance);
   concentration under dependence: Kontorovich–Ramanan 2008 (φ-mixing McDiarmid).
2. **Stationarity precondition.** Gate readings on approximate stationarity (a two-halves
   mean-stability check is enough to start); a non-stationary window **downgrades to
   non-convicting** — treat like `BusRegime.Unmeasured` (never upgrades to evidence).

## The decisions the math team owns

- **Which dependence model** fits real commit/message streams: AR(1)-effective-n (the
  simple ρ₁ correction), φ-mixing, β-mixing, or block-bootstrap? The outcome-product series'
  actual dependence structure should be measured on real `origin/main` history, not assumed.
- **Which autocorrelation / long-run-variance estimator** (lag-1 only? Newey–West with a
  bandwidth rule? a spectral estimator?), and its own finite-sample behavior.
- **Which stationarity test** and what the downgrade threshold is.
- The **resulting corrected margin formula** — handed back to Soraya, who proves its
  correctness properties and wires the Z3/FsCheck lemmas.

## Boundaries (honest)

- This does not touch the *algebraic* bounds (2, 2√2, 4) — those are exact (CHSH/Tsirelson).
  It only corrects the *finite-sample* margin around them.
- The i.i.d. margin is not "wrong," it is **an assumption** whose precondition real streams
  violate; the fix is to either correct for the dependence or refuse to convict when the
  precondition fails.
- Caveat (b) — `BusRegime.min(RTT)/2` symmetric-path unsoundness for asymmetric planetary
  orbits — is a *measurement-model* fix routed separately to **Lumen** (physics), not here.

## Anchors (Beacon)

Hoeffding 1963 (the i.i.d. bound in place); Pironio et al. 2010 (device-independent finite
statistics); Newey–West 1987 (HAC / long-run variance); Kontorovich–Ramanan 2008
(concentration for dependent sequences). In-repo: `src/Core/AntiSybil.fs:201`
(`chshMargin`), `:210` (`chshSybilCalibrated`), `:121` (`chshS`); the geo-superdeterminism
doc; Soraya's G2/G3/G4 routing.
