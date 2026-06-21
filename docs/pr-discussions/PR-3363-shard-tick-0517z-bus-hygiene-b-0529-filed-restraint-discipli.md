---
pr_number: 3363
title: "shard(tick): 0517Z \u2014 bus hygiene + 081KRMEXM0008QG0R002HBY56V filed + restraint discipline on 081KRHWGX0008QG0R0015EE8VE advisory"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-15T05:23:10Z"
merged_at: "2026-05-15T05:24:23Z"
closed_at: "2026-05-15T05:24:23Z"
head_ref: "shard/tick-0517z-otto-cli-2026-05-15"
base_ref: "main"
archived_at: "2026-05-22T23:15:11Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #3363: shard(tick): 0517Z — bus hygiene + 081KRMEXM0008QG0R002HBY56V filed + restraint discipline on 081KRHWGX0008QG0R0015EE8VE advisory

## PR description

## Summary

- Bus hygiene: cleaned expired `d2b7fc2f` (081KRHWGX0008QG0R0015EE8VE republish #2)
- Filed 081KRMEXM0008QG0R002HBY56V P2 row for tick-shard schema validator-vs-practice drift ([PR #3362](https://github.com/Lucent-Financial-Group/Zeta/pull/3362))
- **Restraint discipline**: chose NOT to publish a third 081KRHWGX0008QG0R0015EE8VE advisory (two prior advisories went unactioned by Lior; third republish would be Holding-pattern failure mode). Auto-merge race will surface the conflict at merge-time anyway; backlog (081KRMEXM0008QG0R002HBY56V) is now the durable substrate.
- Recovery-worktree-borrowing now 5 borrows on same `0027z-sidetick` worktree across 4 ticks; peer-Otto WIP preserved throughout.

## Test plan

- [x] `bun tools/hygiene/check-tick-history-shard-schema.ts` → 0 violations
- [x] `bun x markdownlint-cli2` → 0 violations
- [x] Pipe-row first line + H1-rich body (hybrid pattern per 081KRMEXM0008QG0R002HBY56V recommendation)
- [x] Linked rule refs (`.claude/rules/holding-without-named-dependency-is-standing-by-failure.md`, etc.)
- [ ] CI required checks pass on PR
- [ ] Auto-merge fires after CI green

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @chatgpt-codex-connector (2026-05-15T05:24:32Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `16fe76f2bf`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you
- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @copilot-pull-request-reviewer (2026-05-15T05:26:39Z)

## Pull request overview

Adds the 0517Z tick-history shard, recording bus cleanup, filing 081KRMEXM0008QG0R002HBY56V for tick-shard schema validator drift, and the decision to stop republishing the 081KRHWGX0008QG0R0015EE8VE advisory (restraint discipline). This continues the hygiene-history “tick shard” event stream under `docs/hygiene-history/ticks/`.

**Changes:**
- Adds a new tick shard file for 2026-05-15 05:17Z with a pipe-row header plus an H1-rich body.
- Documents bus-envelope cleanup and current 081KRHWGX0008QG0R0015EE8VE collision status.
- Records the 081KRMEXM0008QG0R002HBY56V backlog filing and links to relevant rule references.


<details>
<summary>Comments suppressed due to low confidence (2)</summary>

**docs/hygiene-history/ticks/2026/05/15/0517Z.md:39**
* The relative link to `.claude/rules/additive-not-zero-sum.md` is broken for this shard location (it points under `docs/.claude/...`, which doesn’t exist). It should go up to repo root first (add one more `../`, consistent with other tick shards).
```
This composes with [`.claude/rules/additive-not-zero-sum.md`](../../../../../.claude/rules/additive-not-zero-sum.md): the substrate already preserves the finding (in 0043Z shard, in 0414Z shard, in 081KRMEXM0008QG0R002HBY56V row referenced PR refs, in this shard). Constant republishing is zero-sum noise; substrate preservation is additive.
```
**docs/hygiene-history/ticks/2026/05/15/0517Z.md:49**
* The relative link to `.claude/rules/otto-channels-reference-card.md` is off by one directory level: `../../../../../.claude/...` resolves to `docs/.claude/...` from this file, but `.claude/` is at the repo root. Add one more `../` so the link resolves correctly.
```
Per [`.claude/rules/otto-channels-reference-card.md`](../../../../../.claude/rules/otto-channels-reference-card.md) ID-allocation discipline:
```
</details>

## Review threads

### Thread 1: docs/hygiene-history/ticks/2026/05/15/0517Z.md:9 (unresolved)

**@chatgpt-codex-connector** (2026-05-15T05:24:32Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Fix relative paths to `.claude` rule links**

The rule references in this tick entry use `../../../../../.claude/...`, which from `docs/hygiene-history/ticks/2026/05/15/` resolves to `docs/.claude/...` (non-existent), so the cited governance links are broken for readers. This undermines the traceability this shard relies on, because reviewers cannot open the referenced rule documents directly from the report; the links need one more `..` segment to reach repo root.

Useful? React with 👍 / 👎.

### Thread 2: docs/hygiene-history/ticks/2026/05/15/0517Z.md:9 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-15T05:26:38Z):

The relative link to `.claude/rules/holding-without-named-dependency-is-standing-by-failure.md` is broken: from this shard path (`docs/hygiene-history/ticks/2026/05/15/0517Z.md`) `../../../../../` resolves to `docs/`, but `.claude/` lives at repo root. Use one more `../` (match other shards in this directory that link via `../../../../../../.claude/...`).

This issue also appears in the following locations of the same file:
- line 39
- line 49
