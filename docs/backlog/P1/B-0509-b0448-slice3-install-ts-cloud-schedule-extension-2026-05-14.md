---
id: B-0509
zetaid: 081KRHWGX0008QG0R0014D2T5E
priority: P1
status: closed
title: "B-0448 slice 3 — Extend tools/routines/install.ts to detect + surface cloud-schedule.json"
type: feature
origin: B-0448 decomposition (Otto, 2026-05-14)
created: 2026-05-14
last_updated: 2026-05-17
parent: B-0448
depends_on:
  - B-0507
  - B-0508
composes_with:
  - B-0448
  - B-0507
  - B-0508
  - B-0510
tags: [routines, cloud-routines, typescript, installer, tooling]
---

# B-0509 — Extend tools/routines/install.ts to detect + surface cloud-schedule.json

## Purpose

Extend `tools/routines/install.ts` to detect `cloud-schedule.json` files
alongside the existing `schedule.json` handling, and print the corresponding
Cloud Routine registration guidance when one is present.

This slice does NOT perform actual registration (that's slice 5 / B-0511) —
it prints guidance so a human or agent can invoke the registration step.

**Depends on B-0507** (auth/trigger knowledge) and **B-0508** (schema type definitions).

## What to implement

### New exported function `readCloudSchedule`

Mirrors `readSchedule` in structure:

```typescript
export interface CloudScheduleResult {
  trigger?: CloudTrigger;  // typed per B-0508 schema
  missing: boolean;
  parseError?: string;
}

export function readCloudSchedule(srcDir: string): CloudScheduleResult;
```

### Extended `syncRoutine`

Extend `SyncResult` to include `cloudSchedule?: CloudScheduleResult`.
Call `readCloudSchedule` inside `syncRoutine` alongside the existing
`readSchedule` call.

### Extended `main` output

After the existing `create_scheduled_task(...)` next-step block, add a
parallel block for Cloud Routines:

```
Next step — register Cloud Routines (Anthropic-hosted):
  <registration instructions based on B-0507 findings — CLI command / MCP call / URL>
  autonomous-loop: trigger=scheduled cron="0 9 * * *" repos=["Lucent-Financial-Group/Zeta"]
```

### Idempotency

Same discipline as `schedule.json` handling: `cloud-schedule.json` present
but missing required fields → `parseError` surfaced, exit 1.

## Pre-start checklist

Per `.claude/rules/backlog-item-start-gate.md`:

- [ ] B-0507 and B-0508 PRs merged and on main
- [ ] Review existing `readSchedule` + `syncRoutine` tests (shipped in PR #3034)
  to understand the test fixture pattern before adding new test cases
- [ ] Confirm registration instruction format (from B-0507 findings) before
  hardcoding into the `main` output block

## Acceptance criteria

- [x] `readCloudSchedule` exported pure function, mirrors `readSchedule` contract
- [x] `syncRoutine` returns `cloudSchedule` field in `SyncResult`
- [x] `main` prints Cloud Routine next-step guidance when `cloud-schedule.json` present
- [x] Unit tests for `readCloudSchedule` (happy path + missing + parse-error)
- [x] `bun tools/routines/install.ts` runs without error on existing routines
  (no `cloud-schedule.json` present → no cloud block printed; idempotent)
- [x] B-0509 closed with PR link — [PR #4014](https://github.com/Lucent-Financial-Group/Zeta/pull/4014)

## Why not merge slices 2 and 3

Schema definition (B-0508) and installer extension (B-0509) are independently
reviewable changes. Landing schema first lets the installer PR be reviewed
against the schema doc rather than requiring reviewers to infer the schema
from the implementation.
