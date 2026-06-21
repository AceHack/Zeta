---
id: 081KRHWGX0008QG0R0013DSSZZ
priority: P1
status: open
title: "081KRFA460008QG0R000CYBGKW slice 5 — Register autonomous-loop as Cloud Routine + empirical first-fire observation"
type: feature
origin: 081KRFA460008QG0R000CYBGKW decomposition (Otto, 2026-05-14)
created: 2026-05-14
last_updated: 2026-05-14
parent: 081KRFA460008QG0R000CYBGKW
depends_on:
  - 081KRHWGX0008QG0R000E8BHQ9
  - 081KRHWGX0008QG0R002S107P7
  - 081KRHWGX0008QG0R0014D2T5E
  - 081KRHWGX0008QG0R001VR9FNA
composes_with:
  - 081KRFA460008QG0R000CYBGKW
  - 081KRHWGX0008QG0R000E8BHQ9
  - 081KRHWGX0008QG0R002S107P7
  - 081KRHWGX0008QG0R0014D2T5E
  - 081KRHWGX0008QG0R001VR9FNA
  - 081KRHWGX0008QG0R003WEP6E9
  - 081KRHWGX0008QG0R003TCDFZ5
tags: [routines, cloud-routines, registration, empirical, autonomous-loop]
---

# 081KRHWGX0008QG0R0013DSSZZ — Register autonomous-loop as Cloud Routine + empirical first-fire observation

## Purpose

Perform the actual registration of the `autonomous-loop` Cloud Routine using
the registration surface identified in 081KRHWGX0008QG0R000E8BHQ9 (CLI / MCP / Web UI / API),
and observe the first empirical Cloud Routine fire from Anthropic's infrastructure.

This is the "does it actually work" slice — all prior slices are preparation.

**Depends on all prior slices**: 081KRHWGX0008QG0R000E8BHQ9 (auth), 081KRHWGX0008QG0R002S107P7 (schema), 081KRHWGX0008QG0R0014D2T5E (installer),
081KRHWGX0008QG0R001VR9FNA (cloud-schedule.json declared).

## Registration steps (to be executed at implementation time)

Based on 081KRHWGX0008QG0R000E8BHQ9 findings, execute the registration. Unknown at decomposition time
whether this is:

1. A CLI command (`claude code routines register autonomous-loop`)
2. An MCP tool call (`create_cloud_routine(taskId, trigger, ...)`)
3. A Web UI step (URL documented by 081KRHWGX0008QG0R000E8BHQ9)
4. An API HTTP POST (endpoint + bearer token documented by 081KRHWGX0008QG0R000E8BHQ9)

**The implementing agent MUST follow 081KRHWGX0008QG0R000E8BHQ9's documented registration flow.**
Do not guess or invent a registration surface.

## Empirical observation requirement

Per 081KRFA460008QG0R000CYBGKW acceptance criteria, at least ONE Cloud Routine fire must be
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

- [ ] 081KRHWGX0008QG0R000E8BHQ9, 081KRHWGX0008QG0R002S107P7, 081KRHWGX0008QG0R0014D2T5E, 081KRHWGX0008QG0R001VR9FNA all merged on main
- [ ] `bun tools/routines/install.ts` reports the Cloud Routine next-step guidance
- [ ] Bootstream uploaded to the Cloud Routine project (if required by registration surface)
- [ ] Verify the factory is on a plan that supports Cloud Routines (081KRHWGX0008QG0R000E8BHQ9 finding)

## Acceptance criteria

- [ ] Registration executed and confirmed (not just attempted)
- [ ] At least one empirical fire observed (tick shard OR commit OR PR)
- [ ] Tick shard for the empirical fire committed at
  `docs/hygiene-history/ticks/YYYY/MM/DD/HHMMZ.md`
- [ ] Any registration gotchas documented in `notes` field of `cloud-schedule.json`
- [ ] 081KRHWGX0008QG0R0013DSSZZ closed with PR link

## What if registration is impossible at implementation time

Cloud Routines are still in research-preview as of 081KRFA460008QG0R000CYBGKW filing (2026-05-13).
If they're not yet generally available:

1. Document the finding in 081KRHWGX0008QG0R000E8BHQ9's research doc
2. Register the intent (update `cloud-schedule.json` with a `status: "pending-availability"` field)
3. Close 081KRHWGX0008QG0R0013DSSZZ as `status: blocked` with the blocker identified
4. Re-open when Cloud Routines become available

This is NOT a failure — it's the substrate-honest outcome of a research-preview
dependency.
