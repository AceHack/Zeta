---
id: B-0510
zetaid: 081KRHWGX0008QG0R001VR9FNA
priority: P1
status: closed
title: "B-0448 slice 4 — Author autonomous-loop/cloud-schedule.json (first Cloud Routine declaration)"
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
  - B-0509
  - B-0511
tags: [routines, cloud-routines, autonomous-loop, configuration]
---

# B-0510 — Author autonomous-loop/cloud-schedule.json

## Purpose

Author the `cloud-schedule.json` file for the `autonomous-loop` routine —
the factory's first declared Cloud Routine. This makes the routine's Cloud
Routine configuration explicit and git-tracked.

**Does not register the routine** (that's slice 5 / B-0511). This is the
declaration-in-source step.

**Depends on B-0507** (trigger syntax, confirmed quota) and **B-0508** (schema).
B-0509 (installer) can land in parallel — the file is usable once B-0508 schema
is known.

## What to author

`tools/routines/autonomous-loop/cloud-schedule.json`:

```json
{
  "taskId": "autonomous-loop",
  "triggers": [
    {
      "type": "scheduled",
      "cronExpression": "<daily cadence confirmed by B-0507 — e.g. 0 9 * * *>",
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

**The exact cron expression and trigger count must be confirmed by B-0507.**
The above is a template; the implementing agent MUST update based on actual
Cloud Routines trigger capabilities and the factory's current plan quota.

## Daily quota planning

B-0448 research (to be confirmed by B-0507):

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

- [ ] B-0507 confirmed: trigger types, syntax, quota rules
- [ ] B-0508 schema merged so this file validates against it
- [ ] Confirm the bootstream pointer in `autonomous-loop/SKILL.md` is still
  correct (Cloud Routine fires are fresh sessions; need bootstream loaded as
  project knowledge in the Cloud Routine's project)
- [ ] Verify project-knowledge requirement for Cloud Routines (does the bootstream
  need to be uploaded to a Cloud Routine "project"?)

## Acceptance criteria

- [x] `tools/routines/autonomous-loop/cloud-schedule.json` committed
- [x] File validates against the JSON schema from B-0508 (or equivalent TS type)
- [ ] `bun tools/routines/install.ts` output includes the Cloud Routine next-step block
  for `autonomous-loop` (tracked in open row B-0509; not yet implemented)
- [x] `notes` field documents the Desktop-vs-Cloud duality (schedule.json companion)
- [x] B-0510 closed with PR link
