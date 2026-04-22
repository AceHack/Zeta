# PR-triage history

Durable fire-log for the PR-triage cadence declared in
[`docs/AGENT-GITHUB-SURFACES.md`](../AGENT-GITHUB-SURFACES.md)
(Surface 1) and `docs/FACTORY-HYGIENE.md` row #45.

History note: the cadence was originally authored under the
file name `docs/AGENT-PR-WORKFLOW.md`, which was folded into the
ten-surface umbrella doc `docs/AGENT-GITHUB-SURFACES.md` on
2026-04-22 (commit `c57d469`). The historical rows below
preserve the original file name per the log's append-only
discipline.

Append-only. Same discipline as
`docs/hygiene-history/loop-tick-history.md`: no rewrites, no
reorders, corrections appear as later rows citing the earlier
row's timestamp.

## Schema — one row per triage pass OR per on-touch PR action

| date (UTC ISO8601) | agent | pr | shape | action | link | notes |

- **date** — `YYYY-MM-DDTHH:MM:SSZ` at the point the row is
  written.
- **agent** — Claude model + session marker (e.g.
  `opus-4-7 / session round-44`).
- **pr** — PR number (e.g. `#32`) or `round-close sweep` for a
  batch pass.
- **shape** — one of the seven shapes from
  `docs/AGENT-GITHUB-SURFACES.md` § Surface 1: `merge-ready` /
  `has-review-findings` / `behind-main` / `awaiting-human` /
  `experimental` / `large-surface` / `stale-abandoned`, or
  `round-close-sweep` for the batch row.
- **action** — what the agent actually did (merge / comment /
  label / split / close / defer / update-from-main / etc.).
- **link** — commit SHA, PR comment URL, HUMAN-BACKLOG row, or
  ROUND-HISTORY row.
- **notes** — free-form one-line: why this shape, any anomaly,
  next-expected touch.

## Why this file exists

Two reasons:

1. **FACTORY-HYGIENE row #44** — every cadenced factory
   surface MUST have a fire-history surface. PR-triage is a
   round-cadence surface now (row #45); this file is its
   obligation.
2. **Aaron 2026-04-22** — *"i'll see how you handled it, we
   can beef up our stuff over time"*. The audit trail is the
   substrate for the beef-up. Without a log, there is nothing
   to review.

## Log

| date | agent | pr | shape | action | link | notes |
|---|---|---|---|---|---|---|
| 2026-04-22T (round-44 tick, bootstrap) | opus-4-7 / session round-44 | bootstrap | — | File bootstrapped alongside `docs/AGENT-PR-WORKFLOW.md`; first triage pass on open PRs #31 and #32 recorded in the following two rows | (this commit) | First entry in the log. The `(this commit)` placeholder will be replaced with the SHA after landing. |
| 2026-04-22T (round-44 tick) | opus-4-7 / session round-44 | #31 | `behind-main` + `has-review-findings` + `awaiting-human` | Comment posted classifying PR against the new taxonomy; proposed action is merge-or-supersede decision (PR #31 is round-41 work, PR #32 is round-42-speculative which is descended from round-41 — merging #32 would subsume #31). Copilot review has 8 actionable findings; 3 are simple fixes (ADR v1→v2 link, line-count mismatch, jq quoting), 4 are author-edits in research docs, 1 is a cross-repo xref to a file that doesn't exist. | (PR #31 comment link) | Aaron-scoped decision: does #31 merge as a smaller slice, or get closed in favour of #32? Deferred to HUMAN-BACKLOG row. |
| 2026-04-22T (round-44 tick) | opus-4-7 / session round-44 | #32 | `experimental` + `behind-main` + `has-review-findings` + `large-surface` | Comment posted classifying PR against the new taxonomy. Copilot review result captured — finding 1/2/3/4 of the experiment test-plan graded; 7 actionable line-level suggestions triaged. | (PR #32 comment link) | Primary shape is `experimental` (PR is testing Copilot behaviour). `large-surface` (100 commits / +19756 LoC) recorded for future-split-discipline calibration; #32 cannot reasonably be split after the fact. |
