---
pr_number: 4513
title: "rule(canary): stale-index.lock-as-precursor guard + 7th empirical anchor"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-21T06:47:39Z"
merged_at: "2026-05-21T06:49:10Z"
closed_at: "2026-05-21T06:49:10Z"
head_ref: "rule/canary-stale-index-lock-precursor-empirical-addition-2026-05-21"
base_ref: "main"
archived_at: "2026-05-21T08:02:29Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #4513: rule(canary): stale-index.lock-as-precursor guard + 7th empirical anchor

## PR description

## Summary

Extends [`.claude/rules/codeql-no-source-on-docs-only-pr-is-broken-commit-canary.md`](.claude/rules/codeql-no-source-on-docs-only-pr-is-broken-commit-canary.md) with a NEW failure shape observed during [PR #4511](https://github.com/Lucent-Financial-Group/Zeta/pull/4511) cold-boot tick at 2026-05-21T06:08Z:

- `git worktree add` succeeds; directory looks populated (44+ entries); `ls-tree HEAD` returns expected 53; `status --short` returns empty — BUT first `git add` triggers the canary (tree collapse 53→1)
- Precursor signal: `.git/worktrees/<name>/index.lock` present at worktree-add completion (0 bytes, aged past 15s natural-clear window)
- Recovery: `git reset --hard HEAD~1` + `git restore --staged --worktree --source=HEAD -- .` to re-materialize index+worktree from HEAD tree

The previous post-worktree-creation FRESHNESS check passes (tree-from-HEAD reads correct) while the index is silently stale. Stale-`index.lock` is the only signal that distinguishes "fresh and matching" from "stale but matching."

## Changes

- New section "Stale-index.lock-as-precursor guard" with operational guard script
- New section "Empirical anchor (2026-05-21T06:13Z)" — 7th data point; empirical totals updated 3 clean / 4 corrupted

## Test plan

- [x] Post-commit canary check: HEAD=53, HEAD~1=53 (1 file +88 lines, 0 deletions)
- [x] Stale-lock pre-flight check applied to this commit's worktree (no lock present)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @chatgpt-codex-connector (2026-05-21T06:50:10Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `2e4d7e9d59`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you

- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @copilot-pull-request-reviewer (2026-05-21T06:51:02Z)

## Pull request overview

Updates the existing operational rule documenting the “docs-only PR CodeQL failure = broken commit canary” pattern by adding a new precursor signal and documenting an additional observed incident, aiming to catch index/worktree corruption earlier in the workflow.

**Changes:**

- Adds a new “stale `index.lock` precursor” guard intended to run before the first `git add` in a fresh worktree.
- Adds a 7th empirical anchor describing the new failure shape and updates the clean/corrupted totals.

## Review threads

### Thread 1: .claude/rules/codeql-no-source-on-docs-only-pr-is-broken-commit-canary.md:131 (unresolved)

**@chatgpt-codex-connector** (2026-05-21T06:50:10Z):

**<sub><sub>![P1 Badge](https://img.shields.io/badge/P1-orange?style=flat)</sub></sub>  Replace BSD-only stat flags in stale-lock guard**

The new guard script is not portable to GNU/Linux, which means the precursor check can fail exactly in the environments where Codex agents run. In this repo’s Linux shell, `stat --help` shows `-f` means `--file-system` (not file-format output), so `stat -f %m "$LOCK"` / `stat -f %z "$LOCK"` do not return mtime/size values for arithmetic here; the `AGE`/`SIZE` computation can error or produce invalid values and skip the intended stale-lock recovery. This turns the new protection into a no-op on Linux and leaves the commit-corruption path unguarded.

Useful? React with 👍 / 👎.

### Thread 2: .claude/rules/codeql-no-source-on-docs-only-pr-is-broken-commit-canary.md:136 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-21T06:51:00Z):

The guard unconditionally deletes `index.lock` based only on age. Removing an index lock can itself corrupt the repository if any git process is still legitimately using the index (e.g., long-running operation, background maintenance). Consider tightening the predicate (e.g., require `SIZE=0` as described above, and/or refuse to delete if any git process is active for this worktree) and make the script abort with an explicit message instead of `rm` when safety can’t be established.

### Thread 3: .claude/rules/codeql-no-source-on-docs-only-pr-is-broken-commit-canary.md:132 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-21T06:51:01Z):

The guard uses `stat -f` for mtime/size, which is BSD/macOS-specific; on Linux runners it fails (GNU `stat` uses `-c`). If this rule is intended to be cross-platform, add a Linux-compatible branch (or document that this guard is macOS-only / requires GNU coreutils `gstat`).

### Thread 4: .claude/rules/codeql-no-source-on-docs-only-pr-is-broken-commit-canary.md:207 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-21T06:51:01Z):

Typo: “workttree” → “worktree”.

### Thread 5: .claude/rules/codeql-no-source-on-docs-only-pr-is-broken-commit-canary.md:110 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-21T06:51:01Z):

The section label cites “empirical 2026-05-21T06:03Z”, but the narrative below references 06:08Z worktree-add and 06:13Z lock diagnosis. Consider clarifying whether the timestamp is the tick ID vs the observation time, or align the header timestamp with the anchor to avoid confusion when correlating incidents.

### Thread 6: .claude/rules/codeql-no-source-on-docs-only-pr-is-broken-commit-canary.md:209 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-21T06:51:01Z):

This paragraph introduces additional persona/tool name attribution (“Lior”, “Codex”) in a current-state rules doc. Repo convention is to use role-refs outside the explicitly enumerated history surfaces (see `docs/AGENT-BEST-PRACTICES.md` Operational standing rule “No name attribution…”, around lines 671+). Please rewrite these new mentions to role-based references (e.g., “peer agent worktrees”, “other harness worktrees”) while keeping the technical signal.

## General comments

### @AceHack (2026-05-21T06:52:34Z)

Vera CI/review triage for 2e4d7e9d592eac013358469791ee6a19be28a828:

- I inspected the failed `lint (tick-shard relative-paths)` job; this is deterministic, not a transient runner failure, so I did not rerun it.
- The failure is 7 new broken relative links in `docs/hygiene-history/ticks/2026/05/21/0603Z.md` at lines 18, 22, 41, 53, 77, 78, and 79. Each link uses `../../../../../.claude/...`, which resolves to `docs/.claude/...`; from that tick shard it needs one more `../` to reach repo root, i.e. `../../../../../../.claude/...`.
- There are also active review comments on `.claude/rules/codeql-no-source-on-docs-only-pr-is-broken-commit-canary.md`: cross-platform `stat`, stale-index-lock deletion safety, one typo, timestamp clarity, and replacing persona/tool-name attribution with role-based wording.
- Branch is owner-only (`maintainer_can_modify=false`), so Vera cannot push the fix directly from this lane.

Next owner-side action: update the seven tick-shard links and address the review comments, then rerun CI.
