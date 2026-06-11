---
id: B-0507
zetaid: 081KRHWGX0008QG0R000E8BHQ9
priority: P1
status: closed
title: "B-0448 slice 1 — Research Cloud Routines auth + registration API surface (resolve unknowns)"
type: research
origin: B-0448 decomposition (Otto, 2026-05-14)
created: 2026-05-14
last_updated: 2026-05-14
parent: B-0448
depends_on: []
composes_with:
  - B-0448
  - B-0508
  - B-0509
  - B-0510
  - B-0511
  - B-0512
  - B-0513
tags: [routines, cloud-routines, research, api, authentication]
---

# B-0507 — Research Cloud Routines auth + registration API surface

## Purpose

B-0448 listed several unknowns in its pre-start checklist that MUST be
resolved before any implementation begins. This slice is a bounded research
task to surface those answers so slices 2–7 can proceed with correct
assumptions.

## Unknowns to resolve

| Unknown | Resolution approach |
|---------|---------------------|
| Is Cloud Routines GA or still research-preview? | Search upstream Anthropic docs + changelog |
| Authentication mechanism (bearer token / OAuth / CLI session) | Docs + `claude code routines --help` output |
| Registration surface — MCP tool? CLI command? Web UI? API endpoint? | Docs + test in interactive session |
| Does `scheduled-tasks` MCP wrap Cloud Routines or are they separate? | MCP tool listing in interactive session |
| Trigger types available (scheduled / API / GitHub events)? | Docs — confirm or correct B-0448's research |
| Daily quota (Pro 5/day / Max 15/day)? | Docs — confirm or note if changed |
| Which plan is the Zeta factory running on? | `claude code account` or similar CLI query |
| Do GitHub event triggers require a GitHub App installation? | Docs — this may require org-level setup |

## Pre-start checklist

Per `.claude/rules/backlog-item-start-gate.md`:

- [ ] Search upstream: `WebSearch "Anthropic Claude Code Cloud Routines API registration auth 2026"`
- [ ] Search upstream: `WebSearch "claude code routines github events trigger setup"`
- [ ] Check if there's a wrapping MCP: in an interactive session, run `list_mcp_resources` or `claude mcp list`
- [ ] Run `claude code routines --help` (or equivalent) to see CLI surface
- [ ] Verify this row is the first Cloud Routines research slice (not a duplicate)

## Output artifact

A short research document at:

```
docs/research/2026-05-14-cloud-routines-api-auth-registration-surface-b0507.md
```

Containing:

- Answers to each unknown above with source citations
- Registration flow (step-by-step, whatever the surface is)
- GitHub event trigger setup requirements (if applicable)
- Daily quota confirmed for current Zeta plan
- Known gaps or TODOs for slices 2–5

## Acceptance criteria

- [x] All 8 unknowns addressed (may be "confirmed unchanged" if B-0448 research was accurate)
- [x] Research doc committed at the path above
- [x] B-0508 pre-start checklist updated to reflect any `cloud-schedule.json` schema changes
  implied by the auth/trigger findings
- [x] B-0507 closed with PR link

## Why this is slice 1

Without resolved unknowns, slices 2–5 might author the wrong schema format,
wrong authentication approach, or wrong trigger syntax. Research first is
the backlog-item-start-gate discipline applied at the parent decomposition
level.

## Why P1

Same priority as parent (B-0448). Gate row for B-0508 and B-0509.
Bounded research task; blocks progress on the whole chain.
