# The spectrum, measured: Parnas HOLDS in this repo; the founding cohort is gapped — REPORT #4's empirical leg, landed

**Date:** 2026-06-12 · **Tool:** `tools/hygiene/change-rate-spectrum.ts` (new; advisory) ·
REPORT #4 §2/§5 named two facts as "decisive and unmeasured": the change-rate spectrum's
gappedness (hub uniqueness is conditional on it) and the Parnas inequality
ρ(interface) < ρ(implementation) (ferry 9's premise). Both are now measured from git history.

## Headline numbers

- **PARNAS HOLDS (code):** mean ρ(`src/Core.Abstractions`, 49 files) = **0.398 commits/wk** vs
  mean ρ(`src/Core/*.fs` implementations, 310 files) = **0.480/wk** — implementations churn
  **1.21×** faster than the interface surface (1.58× under the unfloored v1 metric; the floored
  metric is the conservative one). Ferry 9's "interfaces are the hubs" is now a *measured fact
  about this repo*, not DV2.0-composed-with-an-assumption — P1-5 of REPORT #4 is discharged.
- **The founding cohort's spectrum is GAPPED:** over the 1,996 files first touched ≥ 6 weeks
  ago, gappedness (largest log₁₀ gap / median positive gap) ≈ **2.7 × 10³**, with the largest
  gap (0.424 in log₁₀ — a 2.7× rate jump) separating the mega-hot coordination satellites
  (`docs/BACKLOG.md` 99/wk, `memory/MEMORY.md` 74/wk, the two fsprojs 42/wk and 30/wk) from
  everything else. Per REPORT #4's corollary: **canonical hub cuts exist in this region** — the
  hub/satellite boundary among the founding files is forced, not authored.
- **The whole repo is 7.9 weeks old.** Measured, not narrated: first commit 2026-04-18, today
  2026-06-12 — the entire big-bang-to-self-budgeting arc (ferry 10) fits inside one maturity
  window. (This is why the v1 draft's spectrum was garbage: at 7.9 weeks of total history, an
  8-week maturity bar excludes every file. The honest pipeline floors rates at 4 weeks and runs
  the gap analysis at ≥ 6.)

## Honest-metric notes (what changed from the v1 draft, and what the numbers can't say)

1. **Young-file bias, damped:** commits / weeks-since-first-touch explodes for burst-authored
   young files (a 1.1-week-old registry with 48 commits read as a 145/wk satellite in v1). v2
   floors the denominator at 4 weeks; the Parnas ratio survives the correction (1.58× → 1.21×),
   which is what surviving a conservative correction looks like.
2. **The hot-end "gaps" separate individual outliers,** not clusters: BACKLOG, MEMORY, and the
   two project files are each their own one-file rate class (coordination ledgers — every PR
   touches them). The structurally interesting gap is at the cold end (0.167/wk → 0.253/wk),
   where the bulk's hub/satellite boundary sits. Both readings are visible in the tool output.
3. **Rules-vs-research is NOT a Parnas pair** (v1 mislabeled it): `.claude/rules/` runs 0.80/wk
   (living, re-carved hubs) vs `docs/research/` at 0.32/wk (append-once archive — written once,
   then frozen). The low archive rate is the *archive contract holding*, not a hub/satellite
   inversion; rules' satellite axis is `rules.bak/` + the docs each rule points to.
4. **One repo, one author-cohort, 7.9 weeks:** REPORT #4's leak #1 (ρ is endogenous — "same ρ"
   is partly "same Aaron") applies to every number here. The measurement makes the spectrum a
   fact; it cannot make it author-independent. Re-measuring at 16 and 32 weeks (and after other
   writers' share grows) is the longitudinal test; the tool is now in-tree to make that a
   one-command habit.

## What this discharges and what remains

- Discharged: REPORT #4 P1-5 (the Parnas premise — measured, holds); the spectrum-existence
  half of P0-2 (the gap condition is now checkable and, for the founding cohort, satisfied).
- Remaining from REPORT #4's plan: the FsCheck model of the DV2.0 operator (monotone /
  termination / θ=0 confluence / the gapless-counterexample witness) — the laws half of the
  empirical+laws pair. Separately queued: REPORT #5's DashedWalk slice.

## Pointers

- `tools/hygiene/change-rate-spectrum.ts` (run: `bun tools/hygiene/change-rate-spectrum.ts`)
- REPORT #4 (`2026-06-12-dv2-hub-stability-and-the-forced-shape-math-team-REPORT-4.md`) §2
  (the gap corollary), §5 P0-2/P1-5 · ferry 9 (the premise, now measured) · ferry 10 (the
  7.9-week arc, now a number)
- Anchors: Parnas 1972 (the criterion, measured here) · Lehman 1980 (empirical change-rate
  laws — the longitudinal frame for the re-measure)
