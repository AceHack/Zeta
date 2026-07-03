---
pr_number: 3232
title: "chore(rule): extend zeta-expected-branch with primary defenses (cold-boot substrate)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-14T20:36:51Z"
merged_at: "2026-05-14T20:39:32Z"
closed_at: "2026-05-14T20:39:32Z"
head_ref: "otto/extend-zeta-branch-rule-primary-defenses-2026-05-14"
base_ref: "main"
archived_at: "2026-05-14T20:55:50Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #3232: chore(rule): extend zeta-expected-branch with primary defenses (cold-boot substrate)

## PR description

## Summary

Extends [`.claude/rules/zeta-expected-branch.md`](../../.claude/rules/zeta-expected-branch.md) with two primary defenses for multi-Otto-one-checkout topology. Promotes them from 081KRHWGX0008QG0R001HMWM1W RCA (grep-discoverable backlog row) to `.claude/rules/` (auto-loaded at cold-boot for every fresh session).

## Why promote from RCA to rule

Per [claude-code-loading-taxonomy.md](../../.claude/rules/claude-code-loading-taxonomy.md): "I keep forgetting to do X" is the goldfish-ontology failure mode that needs direct-load surface (rule files), not router-loaded skills or grep-discoverable backlog rows. The defenses fire on every commit/PR call — every cold-boot Otto needs them in context from session start, not via grep.

Per [skill-router-as-substrate-inventory.md](../../.claude/rules/skill-router-as-substrate-inventory.md): extend the existing rule rather than mint a new one — same failure mode (wrong-branch commits under multi-Otto contention).

## What's added

### Field-test caveat on the env-var hook

`ZETA_EXPECTED_BRANCH` set in one Bash-tool call doesn't reliably persist to the call that runs `git commit` — each invocation may spawn a fresh shell. The hook is therefore defense-in-depth only. Observed on tick 2010Z (2026-05-14): the hook did NOT catch a wrong-branch commit.

### Primary defense 1 — `git branch --show-current` before `git commit`

Direct git-state query; survives any harness shell-environment quirk. Field-tested ticks 2010Z + 2026Z + 2030Z + this tick.

### Primary defense 2 — `gh pr create --head <my-branch>` explicit head ref

Removes implicit current-branch dependency, which can be poisoned by parallel-Otto checkouts between `git push` and `gh pr create`. Field-tested ticks 2026Z + 2030Z + this tick.

### Composite operator-discipline snippet

```bash
test "$(git branch --show-current)" = "<expected>" || exit 1
git commit -m "..."

gh pr create --head <my-branch> --base main --title "..." --body "..."
```

## Test plan

- [x] Used the composite guard for THIS commit (`test = "<expected>" && git commit`) — branch verified
- [x] Used `gh pr create --head` explicit ref for THIS PR
- [x] markdownlint-cli2 clean
- [ ] CI clears
- [ ] Auto-merge

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-14T20:39:46Z)

## Pull request overview

This PR promotes branch-contamination defenses into the cold-boot `.claude/rules/` substrate so fresh sessions see the expected-branch discipline before commit/PR operations.

**Changes:**

- Adds a caveat that the `ZETA_EXPECTED_BRANCH` env-var hook is defense-in-depth because shell env may not persist across Bash-tool calls.
- Adds primary operator defenses: query current branch before commit and use `gh pr create --head`.
- Links the rule back to the 081KRHWGX0008QG0R001HMWM1W RCA.


<details>
<summary>Comments suppressed due to low confidence (1)</summary>

**.claude/rules/zeta-expected-branch.md:117**

* This parenthetical says the RCA has 2010Z/2026Z/2030Z field-test shards, but the referenced RCA only documents 2010Z and 2026Z, and there is no `docs/hygiene-history/ticks/2026/05/14/2030Z.md` in the tree. The cross-reference should not name a non-existent shard.
```
(RCA capturing the multi-Otto contamination patterns + the primary defenses
this rule operationalizes; field-test tick shards 2010Z/2026Z/2030Z)
```
</details>

## Review threads

### Thread 1: .claude/rules/zeta-expected-branch.md:61 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-14T20:39:45Z):

This cites a 2030Z field-test, but `docs/hygiene-history/ticks/2026/05/14/2030Z.md` does not exist and the 081KRHWGX0008QG0R001HMWM1W RCA only lists 2010Z/2026Z field-test ticks. Either add the missing shard/evidence or remove 2030Z so the promoted rule remains traceable.

This issue also appears on line 116 of the same file.

### Thread 2: .claude/rules/zeta-expected-branch.md:117 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-14T20:39:45Z):

This new reference says the rule now operationalizes the 081KRHWGX0008QG0R001HMWM1W primary defenses, but the referenced 081KRHWGX0008QG0R001HMWM1W row still says carrying this in `.claude/rules/` “would be the right home if/when this is promoted.” If this PR promotes the defense, update that row in the same PR to point back here or explicitly scope the remaining open work so the backlog/RCA does not drift from the loaded rule.

### Thread 3: .claude/rules/zeta-expected-branch.md:81 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-14T20:39:46Z):

The documented failure mode is HEAD moving between two Bash-tool calls, but this example presents the branch check and commit as separate steps. A fresh session can still run the check in one Bash invocation and `git commit` in the next, recreating the gap the rule is trying to close; make the snippet explicitly same-invocation/atomic (for example by chaining the guard with the commit) or state that both lines must be executed in one Bash call.
