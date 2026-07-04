---
id: 081KZETA0007040001
priority: P1
status: open
title: Agent-to-agent branch merge via observe loop — no PRs, CI-green claim branches auto-merge
created: 2026-07-04
last_updated: 2026-07-04
depends_on: []
tags: [observe-loop, forge, merge, agent-autonomy, claim-branches]
type: task
---

# Agent-to-agent branch merge via observe loop

When another agent's claim branch passes CI (gate-required green), the current
agent's observe tick should merge it. No human in the loop for green branches.

## Acceptance criteria

- The observe loop's `loadWorld` detects clean claim branches via forge state
- A new `merge_clean_pr` action kind (or reuse `do_item` with `merge-pr-N` synthetic items)
- The executor calls `gh pr merge --auto` or direct git merge + push to main
- Works both for self-merging (agent merges its own green branches) and peer-merging
- Branch protection (`gate-required`) is the safety gate — if CI fails, merge is blocked
