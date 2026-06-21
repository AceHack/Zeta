---
id: 081KRHWGX0008QG0R001VR9FNA
priority: P1
status: closed
title: "081KRFA460008QG0R000CYBGKW slice 4 — Author autonomous-loop/cloud-schedule.json (first Cloud Routine declaration)"
type: feature
origin: 081KRFA460008QG0R000CYBGKW decomposition (Otto, 2026-05-14)
created: 2026-05-14
last_updated: 2026-05-17
parent: 081KRFA460008QG0R000CYBGKW
depends_on:
  - 081KRHWGX0008QG0R000E8BHQ9
  - 081KRHWGX0008QG0R002S107P7
composes_with:
  - 081KRFA460008QG0R000CYBGKW
  - 081KRHWGX0008QG0R000E8BHQ9
  - 081KRHWGX0008QG0R002S107P7
  - 081KRHWGX0008QG0R0014D2T5E
  - 081KRHWGX0008QG0R0013DSSZZ
tags: [routines, cloud-routines, autonomous-loop, configuration]
---

# 081KRHWGX0008QG0R001VR9FNA — Author autonomous-loop/cloud-schedule.json

## Purpose

Author the `cloud-schedule.json` file for the `autonomous-loop` routine —
the factory's first declared Cloud Routine. This makes the routine's Cloud
Routine configuration explicit and git-tracked.

**Does not register the routine** (that's slice 5 / 081KRHWGX0008QG0R0013DSSZZ). This is the
declaration-in-source step.

**Depends on 081KRHWGX0008QG0R000E8BHQ9** (trigger syntax, confirmed quota) and **081KRHWGX0008QG0R002S107P7** (schema).
081KRHWGX0008QG0R0014D2T5E (installer) can land in parallel — the file is usable once 081KRHWGX0008QG0R002S107P7 schema
is known.

## What to author

`tools/routines/autonomous-loop/cloud-schedule.json`:

```json
{
  "taskId": "autonomous-loop",
  "triggers": [
    {
      "type": "scheduled",
      "cronExpression": "<daily cadence confirmed by 081KRHWGX0008QG0R000E8BHQ9 — e.g. 0 9 * * *>",
      "description": "Daily catch-43 defence tick — fires even when Desktop is closed"
    },
    {
      "type": "github_event",
      "event": "pull_request.opened",
      "repos": ["Lucent-Financial-Group/Zeta"],
      "description": "Per-PR review tick — fires on every new PR without local cron"
    }
  ],
  "repos": ["Lucent-Financial-Group/Zeta"],
  "connectors": [],
  "description": "Otto autonomous-loop — Cloud Routine (4th catch-43 defence layer)",
  "notes": "Companion to schedule.json (Desktop routine at 0 */2 * * *). Both can fire in parallel."
}
```

**The exact cron expression and trigger count must be confirmed by 081KRHWGX0008QG0R000E8BHQ9.**
The above is a template; the implementing agent MUST update based on actual
Cloud Routines trigger capabilities and the factory's current plan quota.

## Daily quota planning

081KRFA460008QG0R000CYBGKW research (to be confirmed by 081KRHWGX0008QG0R000E8BHQ9):

- Pro plan: 5 Cloud Routine fires/day
- Max plan: 15/day
- Team/Enterprise: 25/day

With a daily scheduled trigger + GitHub event trigger:

- Scheduled: 1 fire/day (uses 1 of quota)
- GitHub events: fires per PR opened (NOT counted against daily quota —
  event-triggered and quota-counted triggers are separate caps per research)

If event-triggered fires DO count against quota, constrain to scheduled-only
and note the trade-off in the file's `notes` field.

## Pre-start checklist

Per `.claude/rules/backlog-item-start-gate.md`:

- [ ] 081KRHWGX0008QG0R000E8BHQ9 confirmed: trigger types, syntax, quota rules
- [ ] 081KRHWGX0008QG0R002S107P7 schema merged so this file validates against it
- [ ] Confirm the bootstream pointer in `autonomous-loop/SKILL.md` is still
  correct (Cloud Routine fires are fresh sessions; need bootstream loaded as
  project knowledge in the Cloud Routine's project)
- [ ] Verify project-knowledge requirement for Cloud Routines (does the bootstream
  need to be uploaded to a Cloud Routine "project"?)

## Acceptance criteria

- [x] `tools/routines/autonomous-loop/cloud-schedule.json` committed
- [x] File validates against the JSON schema from 081KRHWGX0008QG0R002S107P7 (or equivalent TS type)
- [ ] `bun tools/routines/install.ts` output includes the Cloud Routine next-step block
  for `autonomous-loop` (tracked in open row 081KRHWGX0008QG0R0014D2T5E; not yet implemented)
- [x] `notes` field documents the Desktop-vs-Cloud duality (schedule.json companion)
- [x] 081KRHWGX0008QG0R001VR9FNA closed with PR link
