---
pr_number: 3901
title: "fix(rules): add forced-escalation-finds-hidden-work empirical anchor"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-16T16:00:26Z"
merged_at: "2026-05-16T16:02:29Z"
closed_at: "2026-05-16T16:02:29Z"
head_ref: "otto-cli-rule-counter-evidence-2026-05-16-1553z"
base_ref: "main"
archived_at: "2026-05-16T16:20:07Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #3901: fix(rules): add forced-escalation-finds-hidden-work empirical anchor

## PR description

Carves today's session evidence into [\`.claude/rules/holding-without-named-dependency-is-standing-by-failure.md\`](.claude/rules/holding-without-named-dependency-is-standing-by-failure.md): the counter-with-escalation discipline at brief-ack #6 (and pre-emptive at #5) repeatedly surfaced substantive work that brief-ack-only ticks had missed.

## Three instances this session

| Tick | Trigger | Hidden work surfaced |
|---|---|---|
| 14:56Z | Forced escalation #6 | PR [#3894](https://github.com/Lucent-Financial-Group/Zeta/pull/3894) BLOCKED-armed 22 min hid 6 Copilot findings (last_updated, type, 0715Z, git syntax, 081KRHWGX0008QG0R002DPG02X link, BACKLOG.md regen). All 6 fixed in one tick |
| 15:29Z | Pre-emptive at #5 | Own PR [#3883](https://github.com/Lucent-Financial-Group/Zeta/pull/3883) (the 13:31Z stale-armed-triage shard) was itself stale-armed 108 min with MD032 failure — recursively ironic; fixed same tick |
| 15:45Z | Forced escalation #6 | PR [#3545](https://github.com/Lucent-Financial-Group/Zeta/pull/3545) DIRTY-armed 19+ hours (61-file conflict); forward-signal comment named two viable resolution paths + flagged possible supersession by [#3886](https://github.com/Lucent-Financial-Group/Zeta/pull/3886) |

## Pattern

Each forced escalation found work the visibility-only ticks (refresh-fetch-log-rate) had missed. The brief-ack discipline correctly identifies "no new substantive observation," but stale-armed-PR investigation IS substantive work; it just doesn't surface in standard refresh queries. The escalation forces the agent into the investigation discipline that finds it.

Composes with [\`blocked-green-ci-investigate-threads.md\`](.claude/rules/blocked-green-ci-investigate-threads.md): the investigation discipline IS what produces the hidden-work surface. The counter forces invocation of that discipline on regular cadence.

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-16T16:01:53Z)

## Pull request overview

Adds an empirical “forced-escalation-finds-hidden-work” anchor to the standing-by-failure rule, documenting that brief-ack escalation (#6, and pre-emptive at #5) consistently surfaced substantive missed work during a single session window.

**Changes:**
- Adds a new empirical anchor subsection covering three concrete instances from 2026-05-16.
- Documents the observed pattern and links the finding to the investigation discipline rule it composes with.
