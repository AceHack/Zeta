---
id: 081M0ZWYF7R087G0R002RXA889
type: task
state: backlog
priority: P1
slug: agent-heartbeat-batch-merge-lane-flush-heartbeat-branches-to
title: "Agent-heartbeat batch-merge lane: flush heartbeat/* branches to main under one squash per cycle"
created: 2026-08-26T20:42:21.304Z
depends_on: []
composes_with: []
---

# Agent-heartbeat batch-merge lane: flush heartbeat/* branches to main under one squash per cycle

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0ZWYF7R087G0R002RXA889-*.md` glob. -->

## What this work-item names

The **agent-heartbeat lane**: the standing, machine-driven mechanism by which
per-agent liveness accumulates off `main` and is periodically flushed onto it.

It has three commit-producing surfaces, and this id is the referent for all
three:

| surface | what it commits |
|---|---|
| `.github/workflows/agent-heartbeat.yml` (tick) | the per-agent accumulated tick onto `heartbeat/<agent>` |
| `.github/workflows/agent-heartbeat.yml` (drift-rate) | `data/ci-runs.jsonl`, the CI-outcome denominator, onto the same staging branch |
| `src/Core.TypeScript/agent-heartbeats/merge-heartbeats-to-main.ts` | the batch merge of `heartbeat/*` into `main`, one squash per cycle |

The lane parks on `heartbeat/*` rather than pushing to `main` because the "CI
Gate" ruleset requires `gate (required)` at push time with no bypass actors, so
liveness reaches `main` only through a PR. That is why the flush exists at all,
and why an unresolvable `Task:` in the flush generator blocks *every* cycle
rather than one PR.

## Why it is a work-item and not only a design row

The lane's design was recorded as a legacy backlog row —
`docs/backlog/P1/081KSKBP80008QG0R001KK9WV6-agent-heartbeat-folder-direct-to-main-zetaid-filenames-no-pr.md`
— and the three surfaces above carried **that** id in their `Task:` trailers.
`docs/backlog/` is not the resolution domain of
`src/Core.TypeScript/hygiene/audit-task-zetaid-resolves.ts` (AH006), which
indexes `workitems/` only, so the trailer named a key the audit could not
resolve and `cross-verify` step 12 went red on every heartbeat flush PR.

That is a **budget/context artifact, not deceit**: the id was a real key in the
older id space, reached for at a moment when the newer scheme's mint command was
the thing that needed running. The rule
`.claude/rules/workitems-mint-with-zetaid.md` names the distinction — a legacy id
may be *mentioned in prose* (and the flush generator still does, as lineage), but
may not be used as a *key*.

This item is the minted key. The prose citation of the legacy row stays.

## Falsifier

`src/Core.TypeScript/agent-heartbeats/merge-heartbeats-to-main.test.ts`
§"the `Task:` trailer names a work-item that exists" asserts the generator's own
trailer id resolves under `indexWorkItems`, in the generator's unit suite —
so the defect goes red at authoring time rather than once per flush PR in CI.
