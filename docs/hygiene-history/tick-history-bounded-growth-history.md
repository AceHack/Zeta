# Tick-history bounded-growth — fire-history

Fire-log for FACTORY-HYGIENE row #49 (tick-history bounded-growth
audit). Each run of
`tools/hygiene/audit-tick-history-bounded-growth.sh` appends one
row here with the line-count / threshold / status at that moment.

Why this file exists: row #44 (cadence-history tracking) demands
that every cadenced factory surface have a fire-history surface.
Row #49 is such a surface, and this file is its fire-history. The
self-referential knot: row #49 exists to audit the tick-history
file (itself a row-#44 fire-history); and row #49 has its own
fire-history (this file) so row #44 stays honest.

## Per-fire schema

| date (UTC) | agent | line-count | threshold | pct | status | notes |
|---|---|---|---|---|---|---|

- **date** — `YYYY-MM-DDTHH:MM:SSZ` when the audit ran.
- **agent** — who or what invoked the audit (tick-close,
  round-close, manual).
- **line-count** — `wc -l` output of
  `docs/hygiene-history/loop-tick-history.md` at audit time.
- **threshold** — threshold used for the check (default 500).
- **pct** — percentage of threshold consumed.
- **status** — `within bounds` / `approaching threshold` /
  `OVER threshold`.
- **notes** — free-form — threshold changes, archive actions
  triggered, anomalies.

## Append discipline

Append-only. Never rewrite, never reorder. On archive action
(when the target file is archived), append one row noting the
archive-action-taken and the new line count after the move.

## Log

| date | agent | line-count | threshold | pct | status | notes |
|---|---|---|---|---|---|---|
| 2026-04-22T (round-44 tick, first-fire bootstrap) | opus-4-7 / session round-44 | 96 | 500 | 19% | within bounds | First-fire bootstrap. Row #49 landed this tick; audit script `tools/hygiene/audit-tick-history-bounded-growth.sh` landed this tick; file header threshold lowered from 5000 to 500 per the script's mini-ADR. Current file (96 lines) has ~400 lines of remaining headroom. |
| 2026-04-22T (round-44 tick, post-dbt-research append) | opus-4-7 / session round-44 (post-compaction) | 110 | 500 | 22% | within bounds | Post-commit-`d25bc66` + tick-history-append audit. Two bounded-growth-history rows inside the first round of the row's existence = the cadence works. 390 lines of remaining headroom. |
