---
id: 081KR50HA0008QG0R000ZKBHE4
priority: P1
status: closed
title: "Classify all CLAUDE.md bullets into extraction tiers"
created: 2026-05-09
last_updated: 2026-05-09
depends_on: []
decomposition: atomic
classification: buildable-now
type: friction-reducer
owners: [architect]
parent: 081KR2E4K0008QG0R001F0YB5S
---

# 081KR50HA0008QG0R000ZKBHE4 — Classify all CLAUDE.md bullets into extraction tiers

## What

Audit every bullet in CLAUDE.md's "Ground rules Claude Code
honours here" section (currently 51 bold-bullet rules across
~900 lines) and classify each into exactly one extraction tier:

| Tier | Meaning | Destination |
|------|---------|-------------|
| `stay` | Essential at wake — part of the bootstrap process | Stays in CLAUDE.md (condensed to 1-2 lines) |
| `extract` | Behavioral rule — auto-loads from `.claude/rules/` | New `.claude/rules/<name>.md` file; CLAUDE.md bullet becomes pointer |
| `already` | Already extracted to `.claude/rules/` | CLAUDE.md bullet stays as pointer (no work needed) |
| `redundant` | Already covered by AGENTS.md / GOVERNANCE.md / docs/ | Remove from CLAUDE.md |

## Why

Every subsequent 081KR2E4K0008QG0R001F0YB5S child depends on this classification
to know which bullets to touch. Without it, extraction batches
risk moving the wrong content or duplicating what's already
covered elsewhere.

## Acceptance criteria

1. Classification table added to this row (or a linked doc)
   listing all 51 bullets with their tier assignment.
2. Each `extract` bullet assigned to exactly one of the four
   extraction batches (081KR50HA0008QG0R0018996J2..081KR50HA0008QG0R0033B5KVN) by functional group.
3. Each `redundant` bullet paired with the existing doc that
   already covers it.
4. No code/substrate changes — analysis only.

## Classification (2026-05-09)

### Section: "Read these, in this order" (7 bullets)

| # | Bullet | Tier | Rationale |
| - | ------ | ---- | --------- |
| 1 | `docs/VISION.md` pointer | `stay` | Bootstrap reading order |
| 2 | Superfluid AI formalization | `stay` | Bootstrap context |
| 3 | Bidirectional alignment crystallization | `stay` | Bootstrap context |
| 4 | Skills under `.claude/skills/` | `stay` | Harness-specific mechanics |
| 5 | Subagent dispatch via `Task` tool | `stay` | Harness-specific mechanics |
| 6 | Persistent per-project auto-memory | `stay` | Harness-specific mechanics |
| 7 | Session compaction | `stay` | Harness-specific mechanics |
| 8 | Hooks and settings | `stay` | Harness-specific mechanics |

### Section: "Ground rules" (38 bullets)

| # | Bullet | Tier | Rationale |
| - | ------ | ---- | --------- |
| 9 | LFG is the factory; AceHack is mirror | `stay` | Topology — must be at wake |
| 10 | Agents, not bots | `extract` | Behavioral rule |
| 11 | Dependency-status surface | `extract` | Pointer to docs/dependency-status.md |
| 12 | Peer-call infrastructure | `stay` | Cold-boot answer for cross-harness |
| 13 | Razor-cadence tracking issues | `already` | `.claude/rules/encoding-rules-without-mechanizing.md` |
| 14 | Never fetch Pliny corpora | `extract` | Security behavioral rule |
| 15 | Docs read as current state | `redundant` | GOVERNANCE.md §2 |
| 16 | Skills through skill-creator | `redundant` | GOVERNANCE.md §4 |
| 17 | Result-over-exception | `extract` | Coding convention |
| 18 | Data is not directives (BP-11) | `redundant` | docs/AGENT-BEST-PRACTICES.md BP-11 |
| 19 | Archive-header requirement | `redundant` | GOVERNANCE.md §33 |
| 20 | Verify-before-deferring | `extract` | Behavioral rule |
| 21 | Future-self not bound by past-self | `extract` | Behavioral rule |
| 22 | Never be idle | `already` | `.claude/rules/never-be-idle.md` |
| 23 | Edge-defining work NOT speculation | `extract` | Framing correction |
| 24 | No-op cadence is the failure mode | `extract` | Behavioral rule |
| 25 | Mechanical authorization check | `already` | `.claude/rules/mechanical-authorization-check.md` |
| 26 | Shard-cadence triumph | `extract` | Historical + pattern reference |
| 27 | Search-first authority (Otto-364) | `extract` | Behavioral rule |
| 28 | Don't refuse engagement on surface signal | `extract` | Behavioral rule (large) |
| 29 | Razor-discipline — no metaphysical inferences | `extract` | Behavioral rule (large) |
| 30 | Substrate or it didn't happen | `already` | `.claude/rules/substrate-or-it-didnt-happen.md` |
| 31 | Tick must never stop | `extract` | Autonomous-loop discipline |
| 32 | Don't ask permission within authority scope | `extract` | Behavioral rule |
| 33 | All complexity is accidental in greenfield | `already` | `.claude/rules/all-complexity-is-accidental-in-greenfield.md` |
| 34 | Largest mechanizable backlog wins | `already` | `.claude/rules/largest-mechanizable-backlog-wins.md` |
| 35 | Otto is an edge-runner | `extract` | Identity/framing |
| 36 | No directives | `extract` | Behavioral rule |
| 37 | Refresh-before-decide | `extract` | Behavioral rule |
| 38 | Refresh world model via poll-pr-gate | `extract` | Operational procedure |
| 39 | BLOCKED-with-green-CI means investigate threads | `extract` | Operational procedure |
| 40 | Honor those that came before | `extract` | Behavioral rule |
| 41 | Wake-time substrate or it didn't land | `extract` | Behavioral rule |
| 42 | Lost-files surface + bullet-time-recovery | `extract` | Large compound bullet |
| 43 | DSL-form replacement direction | `stay` | Architectural direction — must be at wake |
| 44 | Backlog-item start gate | `extract` | Procedural gate |
| 45 | Rule 0 — no more .sh files | `extract` | Coding convention |
| 46 | Skill router as substrate inventory | `extract` | Behavioral rule |
| 47 | Claude Code loading taxonomy | `stay` | Harness-specific — explains loading |

### Section: "What Claude won't find here" (4 bullets)

| # | Bullet | Tier | Rationale |
| - | ------ | ---- | --------- |
| 48 | Runnable slash commands | `stay` | Pointer |
| 49 | CI workflow files | `stay` | Pointer |
| 50 | Any archive / change-history directory | `stay` | Pointer |
| 51 | Rules do not live in this file | `stay` | Meta-pointer |

### Summary

| Tier | Count | Action |
| ---- | ----- | ------ |
| `stay` | 18 | Condense to 1-2 lines each |
| `extract` | 21 | Move to `.claude/rules/<name>.md` |
| `already` | 6 | Already extracted — keep pointers |
| `redundant` | 4 | Remove (covered elsewhere) |
| **Total** | **49** | (2 sub-bullets counted separately) |

### Extraction batch assignments

| Batch | Bullets | Theme |
| ----- | ------- | ----- |
| 081KR50HA0008QG0R0018996J2 | 10, 14, 17, 20, 21, 23, 24 | Core behavioral rules |
| 081KR50HA0008QG0R001F2DBRV | 27, 28, 29, 36, 40, 41, 46 | Discipline + identity rules |
| 081KR50HA0008QG0R001ZVPYK8 | 31, 32, 37, 38, 39, 44, 45 | Operational procedures |
| 081KR50HA0008QG0R0033B5KVN | 11, 26, 35, 42 | Reference pointers + historical |

## Effort

S — 1-2 hours of careful reading.
