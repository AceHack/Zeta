---
id: B-0508
zetaid: 081KRHWGX0008QG0R002S107P7
priority: P1
status: closed
title: "B-0448 slice 2 — Define cloud-schedule.json schema for tools/routines/<id>/"
type: feature
origin: B-0448 decomposition (Otto, 2026-05-14)
created: 2026-05-14
last_updated: 2026-05-14
parent: B-0448
depends_on:
  - B-0507
composes_with:
  - B-0448
  - B-0507
  - B-0509
  - B-0510
tags: [routines, cloud-routines, schema, json, canonical]
---

# B-0508 — Define cloud-schedule.json schema for tools/routines/<id>/

## Purpose

Extend the canonical `tools/routines/<id>/` directory schema to support a
second optional file — `cloud-schedule.json` — that declares how a routine
should be registered as a Cloud Routine on Anthropic's infrastructure.

This slice is SCHEMA ONLY: no installer changes, no registration, no
empirical fire. The schema defines the on-disk contract; later slices consume it.

**Depends on B-0507** — the schema shape may need to be corrected based on
auth/trigger findings from that research slice.

## Schema design

Based on B-0448's research (subject to B-0507 corrections):

```json
{
  "$schema": "...",
  "taskId": "<same id as SKILL.md name field>",
  "trigger": {
    "type": "scheduled",
    "cronExpression": "0 9 * * *"
  },
  "repos": ["Lucent-Financial-Group/Zeta"],
  "connectors": [],
  "description": "<one-line description>",
  "notes": "<free-text; not parsed by installer>"
}
```

OR for GitHub event trigger:

```json
{
  "taskId": "...",
  "trigger": {
    "type": "github_event",
    "event": "pull_request.opened",
    "repos": ["Lucent-Financial-Group/Zeta"]
  },
  "description": "..."
}
```

A routine may have both a `schedule.json` (Desktop) and a
`cloud-schedule.json` (Cloud) — they are independent files, each optional.

## Pre-start checklist

Per `.claude/rules/backlog-item-start-gate.md`:

- [ ] B-0507 research doc is committed and findings reviewed
- [ ] Correct schema shape based on B-0507 auth/trigger findings
- [ ] Verify `tools/routines/` README doesn't already document a cloud-schedule.json format
- [ ] Check if a JSON Schema file ($schema pointer) should be authored alongside

## What to deliver

1. `tools/routines/cloud-schedule.schema.json` — JSON Schema definition
   (or equivalent TypeScript type definition if JSON Schema is overkill)
2. Updated `tools/routines/README.md` schema section (add `cloud-schedule.json`
   alongside the existing `schedule.json` table row)
3. TypeScript type definition in `tools/routines/install.ts` (exported, per
   the existing `ScheduleResult` / `SyncResult` pattern)

## Acceptance criteria

- [x] `tools/routines/cloud-schedule.schema.json` authored (or TS type exported)
- [x] README updated to document `cloud-schedule.json` alongside `schedule.json`
- [x] TypeScript exported type for `CloudScheduleResult` in `install.ts` (or a
  separate `cloud-install.ts` if the installer logic warrants splitting)
- [x] `dotnet build -c Release` still passes (no F# changes in this slice)
- [x] B-0508 closed with PR link

## Why schema-first

DV2.0 principle: the schema (hub) is the stable key; the installer logic and
the registered configuration (satellites) can change without redefining the
schema. Landing schema-first lets slices 3 and 4 proceed independently.
