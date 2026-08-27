# Pre-registration — agreement-gating: does clause-swap PAY?

**Committed BEFORE generation.** This settles whether the clause-swap axis (proven to
decorrelate, +6.3pp flip over floor, CI [3.2, 9.3] at N=400) improves a REAL selector's
accuracy over the best single configuration — the "pays" question, distinct from the
"decorrelates" question already answered.

Standing headline discipline (Otto): the result stays **"decorrelates, not yet shown to
pay"** unless this experiment resolves a lift whose CI excludes zero. A larger N does not
promote the claim; only a measured, CI-clean lift does.

## Hypothesis

**H2:** agreement-gating over {canonical, clause-swap} on gemma2:2b — take the agreed
answer when they agree, fall back to the pre-measured stronger config on disagreement —
achieves accuracy ABOVE max(accuracy_canonical, accuracy_clause-swap), by more than its
95% CI, at the pre-registered N.

## Endpoint, effect size, α, variance basis

- **Endpoint:** paired difference, agreement-gating accuracy − best-single accuracy, over
  the SAME items. Analysed with **McNemar** on discordant pairs (the paired design removes
  between-item variance; the earlier unpaired CI on the flip-rate arm was conservative).
- **Effect size:** the honest target is a **1.5pp lift** — roughly half the N=400 union
  gap (union 94.5% vs best-single 91.5% = 3.0pp). The union is an ORACLE; a real
  agreement-gating selector reaches only part of it, so half the gap is the optimistic-
  but-not-oracle target. The full 3.0pp is recorded as the ceiling, not the target.
- **α = 0.05 two-sided, power = 0.80.**
- **Variance basis and derived N (unpaired, conservative — the real McNemar N is smaller):**
  - 1.5pp lift (0.915→0.930): N ≈ 4,985 per the two-proportion calc.
  - 3.0pp lift (full union, 0.915→0.945): N ≈ 1,132.
  - 2.0pp lift: N ≈ 2,719.

  **Chosen N = 1,200.** This resolves a ~3pp lift at 80% power (unpaired), and rather more
  under the paired McNemar analysis actually used. It CANNOT resolve a 1.5pp lift — so if
  the measured lift is small, the pre-registered verdict is **underpowered**, not
  "no effect." Stated up front so a null is not over-read.

## Pre-declared FALSIFIER (what abandons clause-swap as a PAYING axis)

clause-swap is abandoned as a paying axis (kept as a decorrelating axis on the record) if
EITHER holds at N=1,200:

1. **agreement-gating accuracy ≤ best-single** with the McNemar CI on the difference
   including or below zero — i.e. the selector does not clear the best single config. A
   selector at or below max(A,B) means the second call bought nothing but energy.
2. **The discordant-pair split is symmetric** (canonical-right/clause-wrong ≈
   clause-right/canonical-wrong): the two configs trade equal numbers of correct answers,
   so the fallback cannot net a gain regardless of N. This is the McNemar b≈c condition and
   it kills the axis at any N.

Confirmation requires: agreement-gating accuracy > best-single, McNemar CI excludes zero,
AND the discordant split favours the fallback (b>c in the direction gating exploits).

## NULL ARM (interleaved by seed parity — Otto's contemporaneity fix)

The noise floor is measured CONTEMPORANEOUSLY with the candidate, not before it. Items are
split by seed parity: even-seeded items run the identity (null) comparison, odd-seeded run
the canonical-vs-clause-swap comparison, interleaved, so sampler drift with GPU/memory
state affects both equally. The null arm must show flip rate ≈ the within-run floor; if it
drifts above the candidate's discordant rate, the run is void.

## Leak falsifier (W12) — reported PER-ARM, not pooled

Both prompts in every arm are PRODUCER prompts (no verifier, no answer key), so
`detectAnswerLeak` must be green on canonical AND clause-swap AND the null identity —
reported per-arm. Any red voids that arm.

## Register

`unmetered`. No joule measured; agreement-gating is 2× calls. Even a CI-clean accuracy lift
does not become an intelligence-per-watt claim until the energy denominator is measured.

## Pointers

- `src/Core.TypeScript/observe/decorrelation-selectors.ts` — `agreementGating`,
  `scoreSelector` (accuracy vs max(A,B) and union, with CIs).
- `src/Core.TypeScript/observe/decorrelation-stats.ts` — McNemar to be added; `detectAnswerLeak`.
- `docs/research/2026-08-26-clause-swap-is-a-real-prompt-frame-axis-that-decorrelates-but-not-yet-shown-to-pay.md`
  — the decorrelation result this tests for payoff.
