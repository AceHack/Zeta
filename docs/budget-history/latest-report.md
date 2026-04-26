# Latest cost projection — auto-generated

**Generated:** `2026-04-26T14:37:11Z`
**Factory git SHA:** `a7fb1dbd47b020ffb56e0a63935dc70dd7000aec`
**Source:** `tools/budget/daily-cost-report.sh` (wraps snapshot-burn.sh + project-runway.sh)

This file is **OVERWRITTEN** on each daily run. Historical snapshots live in
`docs/budget-history/snapshots.jsonl` (append-only); historical projections
can be reconstructed from any snapshot subset via `tools/budget/project-runway.sh`.

---

## Projection text

```text
Budget projection — three-repo-split Stages 1-4
================================================

Evidence source:   docs/budget-history/snapshots.jsonl
Samples (N):       1
First snapshot:    2026-04-26T13:57:01Z
Latest snapshot:   2026-04-26T13:57:01Z
Latest factory SHA: 744e268dd6f57ba230deab8d77616ae19e38cf2f

Latest state
------------
  Copilot plan:    business
  Copilot seats:   1
  Actions total_duration_ms (last 20 runs, all repos):  513000
  Actions billable_ms cumulative:  0

Projection parameters
---------------------
  Estimated extra PRs for Stages 1-4:  20
  Copilot Business seat rate (USD/mo): $19
  Actions free-tier allowance (ms):    180000000
  Assumed migration span (days):       30

Projection
----------
  Per-PR Actions ms:         insufficient data (N<2 or no duration delta)
  Projected Actions ms:      unavailable
  Gate status:               cannot project — accumulate more snapshots
  Copilot projected USD (single span):           $19

Human-maintainer-decision surface
----------------------
  N=1; BACKLOG row requires N>=3 across >=2 LFG merges before
  projection is considered decision-ready. Keep accumulating.

Caveats
-------
  * recent_merged is a rolling-window count (last 10 closed PRs),
    not a cumulative counter. Per-PR-ms uses it as a proxy —
    introduces error when the 20-run window doesn't roll forward
    between snapshots. A cumulative PR counter would be a
    substrate improvement (BACKLOG follow-up).
  * last_billable_ms on public repos is typically 0 (included
    minutes). Projection still meaningful for macOS runs and
    any future private-repo work.
  * Copilot projection assumes constant seat count over the span.
    Seat-count changes require rerunning projection.
```

---

## How to read this

- **`Actions billable_ms cumulative`** — cumulative GitHub-Actions billable runtime across captured snapshots. On public repos this is typically 0 (included minutes); meaningful for macOS / private-repo / Enterprise-plan accounts.
- **`Per-PR Actions ms (naive)`** — rolling-window estimate of per-merged-PR Actions cost. Caveats in the projection text below; treat as proxy until `N \geq 3` cumulative snapshots exist.
- **`Actions fit`** — whether projected Stages 1-4 burn fits the configured free-tier allowance. If `EXCEEDS`, the gate-conditions section names escape valves.
- **`Copilot projected USD`** — assumed-30-day span at the current seat count and rate. Re-run with `--copilot-rate` to model rate changes.

---

## Source data

- Snapshots: `docs/budget-history/snapshots.jsonl`
- Methodology: `docs/budget-history/README.md`
- Wrapper: `tools/budget/daily-cost-report.sh` (this run)
- Capture script: `tools/budget/snapshot-burn.sh`
- Projection script: `tools/budget/project-runway.sh`
