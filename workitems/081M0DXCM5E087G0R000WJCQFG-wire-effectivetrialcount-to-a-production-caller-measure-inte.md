---
id: 081M0DXCM5E087G0R000WJCQFG
type: task
state: in-progress
priority: P2
slug: wire-effectivetrialcount-to-a-production-caller-measure-inte
title: "Wire effectiveTrialCount to a production caller: measure inter-agent rho over the mutation-findings corpus and report head vs effective agent count"
created: 2026-08-19T21:03:45.326Z
depends_on: []
composes_with: []
---

# Wire effectiveTrialCount to a production caller: measure inter-agent rho over the mutation-findings corpus and report head vs effective agent count

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0DXCM5E087G0R000WJCQFG-*.md` glob. -->

## Why

`SocietyUsefulWork.effectiveTrialCount` (Kish 1965) shipped 2026-08-16 — proven, endpoints pinned,
mutation-verified — and had **zero call sites**. One comment in `tick-dial.ts` pointed at it; nothing
invoked it. Every witness count and match count in the repo was therefore a **head count**.

## What landed

- `src/Core.TypeScript/society/effective-agent-count.ts` — the first production caller. Enumerates an
  external sampling frame from the committed tree, reads `db/mutation-findings/{alexa,otto,soraya}.jsonl`,
  estimates inter-agent rho by three named estimators, and reports head count vs effective count.
- `src/Core.TypeScript/society/golden-vectors-effective-agent-count.json` — hex-in-JSON byte-lock,
  replayed by BOTH oracles.
- `tests/Tests.FSharp/SocietyUsefulWork.CrossVerify.Tests.fs` — the F# half of the parity.
- `src/Core.TypeScript/society/effective-agent-count.test.ts` — 30 falsifiers; 7 mutants killed.

## The finding

| quantity                                                             | value                                     |
| -------------------------------------------------------------------- | ----------------------------------------- |
| sampling frame (external, git-tracked `.ts` with sibling `.test.ts`) | **703**                                   |
| distinct sources drawn                                               | alexa 131, otto 129, soraya 102           |
| pairwise overlap vs independence                                     | 72/24.0, 53/19.0, 57/18.7 — **2.8x-3.0x** |
| rho, ICC(1,1) one-way ANOVA (primary)                                | **0.4002**                                |
| rho, mean pairwise phi (corroborating)                               | 0.4016                                    |
| rho, inverted union coverage (independent statistic)                 | 0.4729                                    |
| design effect `1 + (n-1)rho`                                         | 1.800                                     |
| **head count**                                                       | **3**                                     |
| **effective count**                                                  | **1.666**                                 |

**Three agents are worth 1.67 independent ones. 44% of the apparent independence is not there.**

## Two corrections to the first pass

1. **The frame was wrong at N = 616.** Restricting it to `src/Core.TypeScript` left 30 of the 362
   observed draws (in `tools/setup`, `tests/cross-verification`) _outside_ the frame. A frame that
   does not contain the draws is not the population that was sampled. Repo-wide, N = 703, contains
   100% of draws — and `assertFrameContainsDraws` now FAILS rather than filtering.
2. **The frame must not come from the agents.** A Lincoln-Petersen estimate off the overlaps gives
   ~230-250 and would be circular: L-P assumes independence, so estimating N from the samples and
   then testing independence against it is a check that cannot fail.

## Register

- **metered** — the rho over this corpus at this commit. Falsifier: the tests go red under estimator
  perturbation (7/7 mutants killed).
- **NOT metered** — any claim that this rho describes the fleet's _future_ behaviour. The measurement
  is entirely backward-looking. Stated in the tool's own output, not only here.
