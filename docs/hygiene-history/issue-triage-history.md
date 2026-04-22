# Issue-triage history

Durable fire-log for the issue-triage cadence declared in
[`docs/AGENT-GITHUB-SURFACES.md`](../AGENT-GITHUB-SURFACES.md)
(Surface 2) and `docs/FACTORY-HYGIENE.md` row #45.

History note: the cadence was originally authored under the
file name `docs/AGENT-PR-WORKFLOW.md` § "The issue-triage
counterpart", which was folded into the ten-surface umbrella
doc `docs/AGENT-GITHUB-SURFACES.md` on 2026-04-22 (commit
`c57d469`). The historical bootstrap row below preserves the
original file name per the log's append-only discipline.

Append-only. Same discipline as
`docs/hygiene-history/loop-tick-history.md` and
`docs/hygiene-history/pr-triage-history.md`.

## Schema — one row per triage pass OR per on-touch issue action

| date (UTC ISO8601) | agent | issue | shape | action | link | notes |

- **date** — `YYYY-MM-DDTHH:MM:SSZ` at the point the row is
  written.
- **agent** — Claude model + session marker.
- **issue** — issue number (e.g. `#7`) or `round-close sweep`
  for a batch pass.
- **shape** — `triaged-already` / `needs-triage` /
  `stale-claim` / `superseded-closable` / `round-close-sweep`.
- **action** — label / claim / mirror-to-durable / release /
  close / defer.
- **link** — commit SHA, issue comment URL, BACKLOG row, or
  ROUND-HISTORY row.
- **notes** — free-form one-line.

## Why this file exists

FACTORY-HYGIENE row #44 + Aaron 2026-04-22 directive: same as
pr-triage-history.md.

## Log

| date | agent | issue | shape | action | link | notes |
|---|---|---|---|---|---|---|
| 2026-04-22T (round-44 tick, bootstrap) | opus-4-7 / session round-44 | bootstrap | — | File bootstrapped alongside `docs/AGENT-PR-WORKFLOW.md`; first triage pass: `gh issue list --state open` returned empty (Zeta has zero open issues at time of bootstrap) | (this commit) | First entry in the log. Next expected entry: whenever the first issue is opened, or next round-close sweep — whichever comes first. |
