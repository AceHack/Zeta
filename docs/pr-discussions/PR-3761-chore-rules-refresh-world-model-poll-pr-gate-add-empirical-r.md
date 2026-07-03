---
pr_number: 3761
title: "chore(rules): refresh-world-model-poll-pr-gate \u2014 add empirical rate-limit operational tiers"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-16T06:00:11Z"
merged_at: "2026-05-16T06:01:33Z"
closed_at: "2026-05-16T06:01:33Z"
head_ref: "chore/refresh-pr-gate-rate-limit-tiers-otto-cli-2026-05-16"
base_ref: "main"
archived_at: "2026-05-16T06:03:24Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #3761: chore(rules): refresh-world-model-poll-pr-gate — add empirical rate-limit operational tiers

## PR description

Extends `.claude/rules/refresh-world-model-poll-pr-gate.md` with a 4-tier rate-limit operational mode table empirically derived from the 2026-05-16T04:15Z–05:53Z cascade window (12+ tick autonomous-loop sequence that traversed all four tiers naturally):

| Remaining | Tier | Operational stance |
|---|---|---|
| > 2000 | Normal | Full operations |
| 1000–2000 | Cost-aware | Reduce batch polling |
| 200–1000 | Extreme cost-aware | At most 1 PR per tick; skip thread sweeps |
| 0–200 | Pure-git | Zero gh except `gh api rate_limit` (REST, free) |

Plus:

- Names `gh api rate_limit` as REST (free) — safe to poll without burning GraphQL budget
- Documents the pure-git tick pattern (commit + push without PR; defer to post-reset)
- Composes-with counter-with-escalation: editing rules/memory via pure-git IS decomposition

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-16T06:02:55Z)

## Pull request overview

Updates operational guidance for PR polling under GitHub GraphQL rate-limit pressure, using an empirically observed cascade window to define discrete “modes” and a pure-git fallback pattern so the loop can keep landing substrate without burning GraphQL budget.

**Changes:**

- Adds a 4-tier operational mode table (Normal → Pure-git) to `.claude/rules/refresh-world-model-poll-pr-gate.md`.
- Documents a “pure-git” tick workflow and ties it into the counter-with-escalation/decomposition framing.
- Adds a tick-history shard capturing a real rate-limit stall and the intended next-tick actions.

### Reviewed changes

Copilot reviewed 2 out of 2 changed files in this pull request and generated 2 comments.

| File | Description |
| ---- | ----------- |
| docs/hygiene-history/ticks/2026/05/16/0537Z.md | New tick-history shard documenting a rate-limit stall, bounded-ETA dependency, and deferred PR actions. |
| .claude/rules/refresh-world-model-poll-pr-gate.md | Adds empirical rate-limit tiers + pure-git operational pattern and guidance for monitoring reset. |


<details>
<summary>Comments suppressed due to low confidence (1)</summary>

**.claude/rules/refresh-world-model-poll-pr-gate.md:43**

* This section states `gh api rate_limit` is “REST (free)” and “Safe to invoke every tick”. While it doesn’t consume GraphQL budget, it does consume REST rate-limit quota; please clarify that distinction so readers don’t interpret it as unlimited / zero-cost polling.
```
### `gh api rate_limit` is REST (free)

`gh api rate_limit` consults the REST endpoint, not the GraphQL endpoint. Polling it does not consume the GraphQL budget being monitored. Safe to invoke every tick during cost-aware mode without further depleting the budget.

```
</details>

## Review threads

### Thread 1: .claude/rules/refresh-world-model-poll-pr-gate.md:42 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-16T06:02:54Z):

`gh api rate_limit` hits the REST API, but it is not “free” in the sense of costing nothing—it consumes REST rate-limit quota (core/search), just not the GraphQL budget. The tier table’s “(REST, free)” label is misleading; please reword to something like “REST (doesn’t consume GraphQL budget)” and (optionally) note the REST quota impact.

This issue also appears on line 40 of the same file.

### Thread 2: docs/hygiene-history/ticks/2026/05/16/0537Z.md:53 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-16T06:02:55Z):

`gh api rate_limit | grep graphql` can only confirm the JSON contains a `graphql` section; it doesn’t reliably “show remaining > 0”. Consider switching this to a `--jq` extraction (e.g., read `.resources.graphql.remaining` and compare) so the action condition is mechanically checkable.
