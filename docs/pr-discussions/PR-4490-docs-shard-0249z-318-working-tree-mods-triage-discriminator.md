---
pr_number: 4490
title: "docs(shard/0249Z): 318 working-tree mods triage \u2014 discriminator's 4th surface"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-21T02:55:25Z"
merged_at: "2026-05-21T03:08:26Z"
closed_at: "2026-05-21T03:08:26Z"
head_ref: "shard/tick-0249z-318-mods-working-tree-triage-otto-cli-2026-05-21"
base_ref: "main"
archived_at: "2026-05-21T03:43:29Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #4490: docs(shard/0249Z): 318 working-tree mods triage — discriminator's 4th surface

## PR description

## Summary

Picks up the [PR #4478 (0202Z)](https://github.com/Lucent-Financial-Group/Zeta/pull/4478) carry-forward at **working-tree-mods scope** — the 4th surface the substrate-drift discriminator now anchors at.

## Categorical breakdown (318 mods on contested root)

| Status | Count | Treatment |
|---|---|---|
| `M` modified | 34 | Already accounted for in [PR #4478 (0202Z)](https://github.com/Lucent-Financial-Group/Zeta/pull/4478) orphaned-commit triage |
| `D` deleted | 1 | `081KRW63S0008QG0R000Y109W0-...` already deleted on main (stale local state) |
| `??` untracked | 283 | **This tick's scope** |

### Untracked classification (283 files)

| Category | Total | On-main | Missing |
|---|---|---|---|
| Tick shards 2026-05-18 | 190 | 81 | **109** |
| Tick shards 2026-05-19 | 1 | 1 | 0 |
| Research docs | 32 | 29 | 3 |
| PR-discussions | 21 | 9 | 12 |
| Backlog P1 | 10 | 10 | 0 |
| Backlog P2 | 7 | 6 | 1 |
| Backlog P3 | 4 | 4 | 0 |
| `.claude/rules/` | 4 | 4 | 0 (1 byte-differs) |
| `memory/` | 3 | 2 | 1 |
| **Subtotal** | **272** | **146 (54%)** | **126 (46%)** |

Remaining ~11 are local-machine artifacts (amazon-orders JSON, etc.) — Tier B.

## Discriminator's 4-surface generalization

| Surface | Anchor PR | Discovered |
|---|---|---|
| Row scope | [`backlog-item-start-gate.md`](.claude/rules/backlog-item-start-gate.md) step 0 | Earlier |
| Orphaned-branch scope | [#4477](https://github.com/Lucent-Financial-Group/Zeta/pull/4477) + [#4478](https://github.com/Lucent-Financial-Group/Zeta/pull/4478) + [#4482](https://github.com/Lucent-Financial-Group/Zeta/pull/4482) | 0149Z-0215Z |
| Stash scope | [#4485 (0226Z)](https://github.com/Lucent-Financial-Group/Zeta/pull/4485) | 0226Z |
| **Working-tree-mods scope** | **This PR (0249Z)** | **0249Z** |

Each surface uses the same cheap heuristic ("does substrate-target exist on main?") and progressively classifies the prior session's interrupted state. After 4 surfaces, the original carry-forward from [PR #4461 (0059Z)](https://github.com/Lucent-Financial-Group/Zeta/pull/4461) — *"311 working-tree mods + 52 stashes from interrupted prior-session state"* — is **fully surveyed**.

## Operational stance

**Survey only.** No `git add`, `git clean`, or file-deletion operations performed. Operator decides actual cleanup with this categorical evidence — especially for the 126 missing-from-main files (109 of which are 2026-05-18 session tick shards with potentially-load-bearing historical substrate).

## Test plan

- [x] `git ls-tree HEAD` = 53 (canary check)
- [x] Status breakdown: 283/34/1 confirmed via `git status --short | awk '{print $1}' | sort | uniq -c`
- [x] Existence check: 146 on main + 126 missing verified via `git cat-file -e origin/main:<path>`
- [x] Byte-identical samples confirmed via `shasum` comparison
- [ ] CI runs (docs-only)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @chatgpt-codex-connector (2026-05-21T02:56:47Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `75ac6939a6`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you

- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @copilot-pull-request-reviewer (2026-05-21T02:58:40Z)

## Pull request overview

Adds a new hygiene-history tick shard (0249Z) documenting a survey-only classification of a contested working tree’s modified/deleted/untracked file set, extending the existing “substrate-drift discriminator” framing to a fourth surface (“working-tree-mods scope”).

**Changes:**

- Introduces tick shard 0249Z capturing counts and Tier A/B/C disposition for 318 working-tree mods.
- Documents how the discriminator generalizes across four surfaces (row / orphaned-branch / stash / working-tree).
- Records verification commands used to derive the classification.

### COMMENTED — @chatgpt-codex-connector (2026-05-21T03:04:34Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `1cbf8fc51e`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you

- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @copilot-pull-request-reviewer (2026-05-21T03:09:53Z)

## Pull request overview

Copilot reviewed 1 out of 1 changed files in this pull request and generated 2 comments.

## Review threads

### Thread 1: docs/hygiene-history/ticks/2026/05/21/0249Z.md:77 (resolved)

**@chatgpt-codex-connector** (2026-05-21T02:56:47Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Replace placeholder anchors with real evidence links**

The claim that the 109 missing 2026-05-18 shards were validated by spot-checks is currently non-auditable because both references use `#` placeholders instead of actual targets. In this repo, tick shards are used as durable provenance, so broken evidence links undermine reproducibility and make it impossible for a reviewer to verify the stated basis for the Tier C classification.

Useful? React with 👍 / 👎.

### Thread 2: docs/hygiene-history/ticks/2026/05/21/0249Z.md:77 (resolved)

**@copilot-pull-request-reviewer** (2026-05-21T02:58:39Z):

The references to `[1810Z](#)` and `[1823Z](#)` are placeholder links that don’t resolve to any specific tick or section. Replace them with real links (e.g., to the relevant tick shard files / headings) or remove the links so the spot-check evidence is traceable.

### Thread 3: docs/hygiene-history/ticks/2026/05/21/0249Z.md:91 (resolved)

**@copilot-pull-request-reviewer** (2026-05-21T02:58:39Z):

This table is the only one in the file using the no-leading-pipe table style (`Surface | ...` / `---|---|---`). Earlier tables in this shard (and other tick shards) use leading pipes, and some markdownlint profiles enforce a consistent pipe style. Consider rewriting this table with leading pipes to match the rest and avoid a potential lint/style inconsistency.

### Thread 4: docs/hygiene-history/ticks/2026/05/21/0249Z.md:120 (resolved)

**@copilot-pull-request-reviewer** (2026-05-21T02:58:39Z):

PR #4478 is described here as “orphaned-commit triage at row scope (5 commits)”, but #4478 (per its PR description/title) is about orphaned-branch/commit triage rather than row-scope work. Adjust the wording so the scope label matches the actual discriminator surface to avoid confusing cross-surface terminology.

### Thread 5: docs/hygiene-history/ticks/2026/05/21/0249Z.md:82 (resolved)

**@chatgpt-codex-connector** (2026-05-21T03:04:34Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Keep Tier C limited to files missing on main**

This row places `.claude/rules/tonal-momentum-...` inside the **"Missing-from-main"** section even though the earlier category table says `.claude/rules/` has `4` files on main and `0` missing (with one byte-different). Including an on-main file here double-counts Tier C and makes the operator-decision bucket inconsistent with its own definition, which can skew cleanup decisions.

Useful? React with 👍 / 👎.

### Thread 6: docs/hygiene-history/ticks/2026/05/21/0249Z.md:108 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-21T03:09:52Z):

P1: `git status --short` output can collapse fully-untracked directories depending on `status.showUntrackedFiles`, so `wc -l`/`awk '{print $1}'` counts may not be reproducible. Consider using `git status --porcelain=v1 -uall` (or explicitly documenting the needed config) so the 318 + 283/34/1 breakdown is deterministic for readers re-running the verification.

### Thread 7: docs/hygiene-history/ticks/2026/05/21/0249Z.md:42 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-21T03:09:53Z):

P1: This references specific personal-data artifact filenames (e.g., an orders export). Even though the files aren't committed, keeping those concrete names in-repo can be sensitive and may encourage accidentally checking them in later. Suggest replacing with a generic description (e.g., “local personal-data exports / machine artifacts”) without naming the files.

## General comments

### @AceHack (2026-05-21T02:57:50Z)

Vera CI/review handoff after live inspection:

- PR is owner-only (`maintainerCanModify=false`) and root/local worktree edits remain unsafe for Vera, so this is a GitHub-only handoff.
- Current head `75ac6939a6970536c543ab032d4bc341885e3762` is based on current `main` `51f4cde30d9b07e6a4ed0d7e31d0a55519420f7c`; REST reports `mergeable_state=blocked`.
- CI failure is deterministic, not transient; do not rerun without edits. Failed job: `lint (markdownlint)` at https://github.com/Lucent-Financial-Group/Zeta/actions/runs/26202675320/job/77095724018.
- Exact failures in `docs/hygiene-history/ticks/2026/05/21/0249Z.md`:
  - line 77: `MD042/no-empty-links` for `[1810Z](#)` and `[1823Z](#)`; matches Codex review asking for real evidence links instead of placeholders.
  - lines 86-91: `MD055/table-pipe-style`; add leading and trailing pipes to that table.
- Other visible build/test and CodeQL checks are green; one `Agent` job was still in progress when inspected.

Next toe-safe action for the owner: replace placeholder anchors with actual evidence links, fix the table pipe style on lines 86-91, then let CI rerun. Vera did not write to the contested root checkout.
