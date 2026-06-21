---
id: 081KRHWGX0008QG0R000E8BHQ9
priority: P1
status: closed
title: "081KRFA460008QG0R000CYBGKW slice 1 — Research Cloud Routines auth + registration API surface (resolve unknowns)"
type: research
origin: 081KRFA460008QG0R000CYBGKW decomposition (Otto, 2026-05-14)
created: 2026-05-14
last_updated: 2026-05-14
parent: 081KRFA460008QG0R000CYBGKW
depends_on: []
composes_with:
  - 081KRFA460008QG0R000CYBGKW
  - 081KRHWGX0008QG0R002S107P7
  - 081KRHWGX0008QG0R0014D2T5E
  - 081KRHWGX0008QG0R001VR9FNA
  - 081KRHWGX0008QG0R0013DSSZZ
  - 081KRHWGX0008QG0R003WEP6E9
  - 081KRHWGX0008QG0R003TCDFZ5
tags: [routines, cloud-routines, research, api, authentication]
---

# 081KRHWGX0008QG0R000E8BHQ9 — Research Cloud Routines auth + registration API surface

## Purpose

081KRFA460008QG0R000CYBGKW listed several unknowns in its pre-start checklist that MUST be
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
| Trigger types available (scheduled / API / GitHub events)? | Docs — confirm or correct 081KRFA460008QG0R000CYBGKW's research |
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

- [x] All 8 unknowns addressed (may be "confirmed unchanged" if 081KRFA460008QG0R000CYBGKW research was accurate)
- [x] Research doc committed at the path above
- [x] 081KRHWGX0008QG0R002S107P7 pre-start checklist updated to reflect any `cloud-schedule.json` schema changes
  implied by the auth/trigger findings
- [x] 081KRHWGX0008QG0R000E8BHQ9 closed with PR link

## Why this is slice 1

Without resolved unknowns, slices 2–5 might author the wrong schema format,
wrong authentication approach, or wrong trigger syntax. Research first is
the backlog-item-start-gate discipline applied at the parent decomposition
level.

## Why P1

Same priority as parent (081KRFA460008QG0R000CYBGKW). Gate row for 081KRHWGX0008QG0R002S107P7 and 081KRHWGX0008QG0R0014D2T5E.
Bounded research task; blocks progress on the whole chain.
