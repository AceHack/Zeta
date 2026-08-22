# `db/effective-agent-count/` — the ρ time series over `db/mutation-findings/`

Two checked-in series, and the script that produced them. They exist so the next person can
**re-run the measurement rather than trust a plot**.

| file                         | what it is                                                                                                                                                                                               |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rho-series-cumulative.tsv`  | one row per commit touching `db/mutation-findings/`, computing the **cumulative** statistic — the one `effective-agent-count.ts:measure()` reports and `effective-agent-count.test.ts` asserts a band on |
| `rho-series-windowed-60.tsv` | the same commits, restricted to each agent's **last 60 findings** — the _live_ meter                                                                                                                     |

## Regenerate

```bash
bun src/Core.TypeScript/society/rho-series.ts               > db/effective-agent-count/rho-series-cumulative.tsv
bun src/Core.TypeScript/society/rho-series.ts --windowed 60 > db/effective-agent-count/rho-series-windowed-60.tsv
bun src/Core.TypeScript/society/rho-series.ts --verify-head   # series == measure(), bit for bit
bun src/Core.TypeScript/society/rho-series.ts --null-model    # why the cumulative column is a ratchet
bun src/Core.TypeScript/society/rho-series.ts --bootstrap 4000 --seed 4
```

Generated at `08eeeaf1866631f1ffa590f80b2d8d4cefd07680` (2026-08-22T15:12:46Z); 751 rows spanning
2026-08-12T03:31:43Z → 2026-08-22T14:42:23Z, which is the whole life of the corpus.

**These files are append-mostly, not stable.** Every row is keyed by commit sha, so a regeneration
adds rows at the end and leaves earlier rows byte-identical — _unless_ history is rewritten or the
frame predicate changes, either of which will show up as a diff on old rows. That is a feature: an
unexplained diff above the last line means something moved that should not have.

## Columns

`authoredAt`, `sha`, `frameSize` (the declared universe: git-tracked `.ts` with a sibling
`.test.ts` **at that commit**), per-agent distinct draw counts, `unionSize`, `meanCompetence`
(`c`), `observedUnionCoverage`, `rhoFromUnion`, `rhoIcc`, `effectiveCount` (Kish), `saturation`
and `poolFraction` (the restricted-pool reparametrisation), `strayDraws`.

`strayDraws` is **carried, not enforced**. `measure()` throws when the frame does not contain a
draw, which is right for a live reading and wrong for a retrospective series — one renamed file
would abort the whole history. A non-zero value at the last row means the live assertion would
fire, and `rho-series.test.ts` re-makes that assertion for the tip.

## What these two files show (2026-08-22)

- **Cumulative** ρ rose smoothly from 0.2532 (08-17T09) to 0.6075 (tip) and crossed the test's
  `0.6` bound at **2026-08-22T11:23:49Z** — _after_ the overnight window it was hypothesised to
  have been caused by closed.
- **Windowed** ρ — the meter that is not a ratchet — peaked at **0.8545 on 2026-08-21T00:11:11Z**,
  about twenty hours _before_ that window opened, and was flat across it (mean 0.6987 inside vs
  0.6819 in the preceding twelve hours; bootstrap sd 0.0423, so ~0.4σ).

Full argument, including why the cumulative column cannot carry a fixed upper bound:
`docs/research/2026-08-22-the-decorrelation-meter-left-its-band-and-i-may-be-the-reason.md`.

## Register

**metered** — the values, against `--verify-head`. **NOT metered** — any causal attribution of a
movement to a fleet event. This is an observational record with no control arm: it can refute a
step-change hypothesis by showing no step, and cannot confirm one by showing a step.
