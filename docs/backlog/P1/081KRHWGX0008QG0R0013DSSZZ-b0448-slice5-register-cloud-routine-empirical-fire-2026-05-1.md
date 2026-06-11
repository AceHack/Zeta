---
id: B-0511
zetaid: 081KRHWGX0008QG0R0013DSSZZ
priority: P1
status: open
title: "B-0448 slice 5 — Register autonomous-loop as Cloud Routine + empirical first-fire observation"
type: feature
origin: B-0448 decomposition (Otto, 2026-05-14)
created: 2026-05-14
last_updated: 2026-05-14
parent: B-0448
depends_on:
  - B-0507
  - B-0508
  - B-0509
  - B-0510
composes_with:
  - B-0448
  - B-0507
  - B-0508
  - B-0509
  - B-0510
  - B-0512
  - B-0513
tags: [routines, cloud-routines, registration, empirical, autonomous-loop]
---

# B-0511 — Register autonomous-loop as Cloud Routine + empirical first-fire observation

## Purpose

Perform the actual registration of the `autonomous-loop` Cloud Routine using
the registration surface identified in B-0507 (CLI / MCP / Web UI / API),
and observe the first empirical Cloud Routine fire from Anthropic's infrastructure.

This is the "does it actually work" slice — all prior slices are preparation.

**Depends on all prior slices**: B-0507 (auth), B-0508 (schema), B-0509 (installer),
B-0510 (cloud-schedule.json declared).

## Registration steps (to be executed at implementation time)

Based on B-0507 findings, execute the registration. Unknown at decomposition time
whether this is:

1. A CLI command (`claude code routines register autonomous-loop`)
2. An MCP tool call (`create_cloud_routine(taskId, trigger, ...)`)
3. A Web UI step (URL documented by B-0507)
4. An API HTTP POST (endpoint + bearer token documented by B-0507)

**The implementing agent MUST follow B-0507's documented registration flow.**
Do not guess or invent a registration surface.

## Empirical observation requirement

Per B-0448 acceptance criteria, at least ONE Cloud Routine fire must be
empirically observed before this slice closes:

- The routine fires on Anthropic's infrastructure
- The fresh session cold-boots from the bootstream (or equivalent)
- The session executes a tick (commits substantively OR no-ops substrate-honestly)
- The session reports back (via tick shard, PR, or log observable from the repo)

If the routine fires but produces no observable output in the repo,
that outcome must be documented in the tick shard for this slice.

## Project-knowledge bootstrapping

Cloud Routine sessions are fresh cold-boots with no local file access.
The `autonomous-loop/SKILL.md` prompt body must be self-contained OR must
reference a project-knowledge bootstream that's been uploaded to the
Cloud Routine's associated project.

Per `tools/routines/README.md`:

> Routines that reference the canonical bootstream require the bootstream
> to be uploaded as project knowledge in the Desktop project that runs
> the routine.

The same requirement applies to Cloud Routine projects. The implementing
agent must verify the bootstream is accessible before triggering the first fire.

## Pre-start checklist

Per `.claude/rules/backlog-item-start-gate.md`:

- [ ] B-0507, B-0508, B-0509, B-0510 all merged on main
- [ ] `bun tools/routines/install.ts` reports the Cloud Routine next-step guidance
- [ ] Bootstream uploaded to the Cloud Routine project (if required by registration surface)
- [ ] Verify the factory is on a plan that supports Cloud Routines (B-0507 finding)

## Acceptance criteria

- [ ] Registration executed and confirmed (not just attempted)
- [ ] At least one empirical fire observed (tick shard OR commit OR PR)
- [ ] Tick shard for the empirical fire committed at
  `docs/hygiene-history/ticks/YYYY/MM/DD/HHMMZ.md`
- [ ] Any registration gotchas documented in `notes` field of `cloud-schedule.json`
- [ ] B-0511 closed with PR link

## What if registration is impossible at implementation time

Cloud Routines are still in research-preview as of B-0448 filing (2026-05-13).
If they're not yet generally available:

1. Document the finding in B-0507's research doc
2. Register the intent (update `cloud-schedule.json` with a `status: "pending-availability"` field)
3. Close B-0511 as `status: blocked` with the blocker identified
4. Re-open when Cloud Routines become available

This is NOT a failure — it's the substrate-honest outcome of a research-preview
dependency.
