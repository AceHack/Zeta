---
pr_number: 3812
title: "rule(claim-acquire): operationalize saturation-ceiling \u2014 4 failure sub-cases"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-16T07:36:06Z"
merged_at: "2026-05-16T10:54:23Z"
closed_at: "2026-05-16T10:54:23Z"
head_ref: "rule/claim-acquire-saturation-ceiling-otto-cli-2026-05-16"
base_ref: "main"
archived_at: "2026-05-16T11:19:10Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #3812: rule(claim-acquire): operationalize saturation-ceiling — 4 failure sub-cases

## PR description

## Summary

Operationalizes the 4-failure-sub-case taxonomy of borrow-on-existing's saturation ceiling (empirically discovered in [PR #3808](https://github.com/Lucent-Financial-Group/Zeta/pull/3808)) as rule body — discipline-actionable steps a future cold-boot Otto session reads at session start.

PR #3808 documented EMPIRICAL evidence (what was observed across 4 commit attempts under sustained multi-Otto saturation). This PR translates those observations into MITIGATIONS in the rule body.

## The 4 sub-cases (with mitigation status)

| # | Sub-case | Mitigation |
|---|---|---|
| 1 | Existing-branch-name reuse → peer-WIP commit inheritance | git rev-parse pre-check + uniquified name |
| 2 | Concurrent-WIP-blocked switch | wait for WT-clean window (capacity-limited) |
| 3 | Pack-dir 081KRMEXM0008QG0R000X1PPGC race on git worktree add | NONE (needs 081KRMEXM0008QG0R000X1PPGC mutex) |
| 4 | Pruned-sidetick race | NONE (needs worktree-pool primitive) |

## Composite 7-step operational discipline

Added a step-by-step operational discipline for fresh-cold-boot sessions firing during peer cascade: refresh-tier-check → cascade-intensity-check → name-precheck → WT-clean-window → branch-guard → explicit --head PR ref → abandon-on-sub-case-3-or-4.

## Test plan

- [x] Single-file rule edit; no code changes
- [x] Section integrates with existing borrow-on-existing pattern documentation
- [x] Composes with PR #3808 (empirical anchor), 081KRMEXM0008QG0R000X1PPGC (sub-case 3 backlog), zeta-expected-branch.md (branch-guard)
- [x] Worktree-pool primitive flagged as substrate-engineer candidate (sub-case 4)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @chatgpt-codex-connector (2026-05-16T07:37:34Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `6120d7ab15`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you

- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @copilot-pull-request-reviewer (2026-05-16T07:39:01Z)

## Pull request overview

This PR updates the Claude rulebook to codify operational mitigations for the “borrow-on-existing” saturation ceiling, turning the empirical 4-sub-case taxonomy (from PR #3808) into a step-by-step discipline that a fresh cold-boot session can follow under multi-instance contention.

**Changes:**

- Adds a new “Saturation-ceiling — 4 failure sub-cases” section describing four distinct contention failures and which are mitigated today.
- Documents concrete mitigations for sub-cases 1 and 2, and explicitly marks sub-cases 3 and 4 as currently unmitigated (pending 081KRMEXM0008QG0R000X1PPGC / a future worktree-pool primitive).
- Adds a composite 7-step operational discipline for shipping under saturation.


<details>
<summary>Comments suppressed due to low confidence (1)</summary>

**.claude/rules/claim-acquire-before-worktree-work.md:162**

* P1: This rule file includes a specific person name (“Lior”) in explanatory prose. Outside the project’s history/archives surfaces, the docs convention is to use role references (e.g., “another peer session”) rather than named attribution. Please replace the name with a role-ref.
```
multi-Otto saturation (4+ instances active in parallel: Otto-CLI primary
+ otto-bg-worker + fresh-cold-boot Otto-CLI + Lior), with peer Otto cycling
worktree HEAD every ~3-5 min for 9 transitions in 35 min, a fresh-cold-boot
```
</details>

### COMMENTED — @chatgpt-codex-connector (2026-05-16T08:35:26Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `796409b27d`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you

- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @copilot-pull-request-reviewer (2026-05-16T09:13:20Z)

## Pull request overview

Copilot reviewed 2 out of 2 changed files in this pull request and generated 3 comments.


<details>
<summary>Comments suppressed due to low confidence (1)</summary>

**.claude/rules/claim-acquire-before-worktree-work.md:182**

* The proposed name pre-check `git rev-parse <candidate-name>` can succeed for many “commit-ish” names (tags, abbreviated SHAs, etc.) and isn’t scoped to “local branch exists”. To make the mitigation reliable, verify the branch ref explicitly (e.g., `refs/heads/<candidate-name>` / `git show-ref --verify`) before deciding the name is taken.
```
```bash
# Pre-check via git rev-parse — empty/error = name free; SHA = name taken
git rev-parse <candidate-name> 2>/dev/null && \
  echo "name taken; uniquify (add -coldboot / -N suffix)"
# If taken, uniquify before git switch -c
git switch -c <name>-coldboot origin/main
```
</details>

### COMMENTED — @chatgpt-codex-connector (2026-05-16T10:32:28Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `b695d74e09`
    

<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you

- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.




Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".
            
</details>

### COMMENTED — @copilot-pull-request-reviewer (2026-05-16T10:34:19Z)

## Pull request overview

Copilot reviewed 2 out of 2 changed files in this pull request and generated 1 comment.

### COMMENTED — @AceHack (2026-05-16T10:39:36Z)

_(no body)_

### COMMENTED — @AceHack (2026-05-16T10:39:40Z)

_(no body)_

### COMMENTED — @chatgpt-codex-connector (2026-05-16T10:41:11Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `808d7abbf6`
    

<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you

- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.




Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".
            
</details>

### COMMENTED — @AceHack (2026-05-16T10:52:32Z)

_(no body)_

### COMMENTED — @copilot-pull-request-reviewer (2026-05-16T10:56:46Z)

## Pull request overview

Copilot reviewed 2 out of 2 changed files in this pull request and generated 3 comments.

## Review threads

### Thread 1: .claude/rules/claim-acquire-before-worktree-work.md:171 (resolved)

**@chatgpt-codex-connector** (2026-05-16T07:37:34Z):

**<sub><sub>![P1 Badge](https://img.shields.io/badge/P1-orange?style=flat)</sub></sub>  Remove incorrect `git switch -c` reuse behavior claim**

This text describes `git switch -c <name> origin/main` as silently reusing an existing local branch, but Git CLI semantics are the opposite: `git switch -h` documents `-c` as create-only and `-C` as force-create/reset, and using `-c` with an existing branch name fails with `fatal: a branch named ... already exists`. Because this rule is operational guidance for contention scenarios, this incorrect claim can misdiagnose failures and push agents toward unnecessary/incorrect mitigations during shard work.

Useful? React with 👍 / 👎.

### Thread 2: .claude/rules/claim-acquire-before-worktree-work.md:165 (resolved)

**@copilot-pull-request-reviewer** (2026-05-16T07:39:00Z):

P1: The empirical-anchor xref points to `docs/hygiene-history/ticks/2026/05/16/0715Z.md`, but that file is not present in the repo (ticks for 2026-05-16 jump from 0714Z to later). Please update this to the correct tick filename/path, or reference only PR #3808 if the shard file is not guaranteed to be on main yet.

### Thread 3: .claude/rules/claim-acquire-before-worktree-work.md:165 (resolved)

**@copilot-pull-request-reviewer** (2026-05-16T07:39:00Z):

P0: Line starts with `+` in the middle of a paragraph; CommonMark will parse this as a new unordered-list item, breaking the intended parenthetical sentence (and often tripping Zeta’s markdown hygiene conventions). Rewrap/reword so the continuation line doesn’t begin with `+` (e.g., keep it on the previous line or start with “plus …”).

This issue also appears on line 160 of the same file.

### Thread 4: .claude/rules/claim-acquire-before-worktree-work.md:177 (resolved)

**@copilot-pull-request-reviewer** (2026-05-16T07:39:00Z):

P1: `git switch -c <name> origin/main` does not silently reuse an existing local branch named `<name>`; it fails with an error if the branch already exists. The failure mode described here looks more like switching to an existing branch (without `-c`) or using `-C`. Please correct the explanation so it matches Git behavior; otherwise readers may misdiagnose what happened.

### Thread 5: .claude/rules/claim-acquire-before-worktree-work.md:171 (resolved)

**@chatgpt-codex-connector** (2026-05-16T08:35:26Z):

**<sub><sub>![P1 Badge](https://img.shields.io/badge/P1-orange?style=flat)</sub></sub>  Fix incorrect `git switch -c` branch-reuse guidance**

This section documents a failure mode that cannot occur with the command shown: `git switch -c <name> origin/main` does not silently reuse an existing local branch, it errors (`fatal: a branch named ... already exists`). The `git-switch` manual defines `-c` as create-only and `-C` as the force/reset variant. Because this rule is operational guidance during contention, the incorrect behavior description can mislead responders into diagnosing “inherited peer commits” when the real outcome is a hard command failure.

Useful? React with 👍 / 👎.

### Thread 6: .claude/rules/claim-acquire-before-worktree-work.md:165 (resolved)

**@copilot-pull-request-reviewer** (2026-05-16T09:13:19Z):

`docs/hygiene-history/ticks/2026/05/16/0715Z.md` is referenced as the empirical anchor, but there is no `0715Z.md` shard under `docs/hygiene-history/ticks/2026/05/16/` in this repo checkout (nearest are `0714Z.md` and `0717Z.md`). Please either update this to an existing shard filename (if that’s the intended evidence) or drop the file-path reference and rely on the PR link so the rule doesn’t carry a dead cross-reference.

### Thread 7: .claude/rules/claim-acquire-before-worktree-work.md:163 (resolved)

**@copilot-pull-request-reviewer** (2026-05-16T09:13:19Z):

This new section introduces direct persona/contributor identifiers in a current-state rule (e.g., “Lior”, “peer Otto”). Per `docs/AGENT-BEST-PRACTICES.md` Operational standing rules (around lines 671–739), current-state surfaces should use role-refs instead of persona names. Please rewrite this sentence to be role-based (e.g., “a peer agent on another surface / a parallel CLI instance”) while keeping the operational meaning.

### Thread 8: .claude/rules/claim-acquire-before-worktree-work.md:182 (resolved)

**@copilot-pull-request-reviewer** (2026-05-16T09:13:20Z):

The description of sub-case 1 claims that `git switch -c <name> origin/main` on an existing local branch name “silently reuses the existing branch”. That contradicts how the rest of this repo documents `git switch -c` (it’s used elsewhere as a create-new-branch step), and it’s likely to mislead operators about what command actually causes branch reuse vs an error/reset. Please tighten this to the exact command behavior you observed (and distinguish `-c` vs `-C` vs `git switch <name>`), so the mitigation steps are correct and consistent across rules.

This issue also appears on line 177 of the same file.

### Thread 9: .claude/rules/claim-acquire-before-worktree-work.md:197 (resolved)

**@chatgpt-codex-connector** (2026-05-16T10:32:28Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Replace absolute "no recovery" claim for blocked switches**

This guidance says there is no way to switch branches while preserving peer WIP, but `git switch` explicitly supports `-m/--merge` (`git switch -h`: `perform a 3-way merge with the new branch`) for exactly this case. Under sub-case 2, `git switch -m <target>` can preserve tracked local changes (possibly with conflicts to resolve), so requiring agents to only wait for a clean window or abandon can cause avoidable shard drops and unnecessary contention delays.

Useful? React with 👍 / 👎.

**@AceHack** (2026-05-16T10:39:40Z):

Fixed in 808d7abbf — documented `git switch -m/--merge` as partial recovery (carries tracked local changes onto target via 3-way merge). Three preconditions stated (WIP shape understood, migration semantics match, post-switch worktree reserved) so the AS-MIGRATED-not-AS-OBSERVED semantics aren't conflated with true peer-WIP preservation. Default remains "wait for clean window" because that conflation is the failure mode the section was warning about.

### Thread 10: .claude/rules/claim-acquire-before-worktree-work.md:186 (resolved)

**@copilot-pull-request-reviewer** (2026-05-16T10:34:18Z):

P1: The suggested branch-name pre-check uses `git rev-parse <candidate-name>` and interprets any resolvable rev as “name taken”. `rev-parse` can succeed for non-local-branch revs (e.g., `HEAD`, tags, and in some setups remote-tracking refs), so this can produce false positives and doesn’t precisely answer “does a local branch of this name exist?”. Consider switching the check to a refs/heads-only verification (and also suppress stdout) so the mitigation matches the documented intent.

**@AceHack** (2026-05-16T10:39:36Z):

Fixed in 808d7abbf — replaced `git rev-parse <name>` with `git show-ref --verify --quiet refs/heads/<name>` for precise local-branch detection (avoids HEAD/tag/remote-tracking-ref false positives). Inline note added against rev-parse.

### Thread 11: .claude/rules/claim-acquire-before-worktree-work.md:255 (resolved)

**@chatgpt-codex-connector** (2026-05-16T10:41:11Z):

**<sub><sub>![P1 Badge](https://img.shields.io/badge/P1-orange?style=flat)</sub></sub>  Use `show-ref` in step 3 branch-name precheck**

Step 3 in the composite discipline tells agents to pre-check branch names with `git rev-parse`, but sub-case 1 directly above states that `rev-parse` can return false positives (HEAD/tags/remote refs) and explicitly says to use `git show-ref --verify "refs/heads/<name>"` instead. In saturation handling this contradiction makes the “7-step” path self-invalidating: agents following step 3 can uniquify branch names unnecessarily and diverge from the mitigation that is documented as the working fix.

Useful? React with 👍 / 👎.

**@AceHack** (2026-05-16T10:52:32Z):

Fixed in 663c688 — step 3 now uses `git show-ref --verify --quiet refs/heads/<name>` with an explicit note rejecting `git rev-parse`. Resolves the self-contradiction with sub-case 1.

### Thread 12: docs/hygiene-history/ticks/2026/05/16/0823Z.md:30 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-16T10:56:45Z):

P1: The relative link to `081KRHWGX0008QG0R003WEP6E9` goes to `../../../../../backlog/...`, which resolves to `docs/hygiene-history/backlog/...` from this tick file’s location and appears to be a broken path (the backlog rows live under `docs/backlog/**`). Update the link to go up one more directory so it resolves to `docs/backlog/P1/...` correctly.

### Thread 13: .claude/rules/claim-acquire-before-worktree-work.md:193 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-16T10:56:45Z):

P2: In the sub-case-1 mitigation snippet, the placeholder names are inconsistent (`<candidate-name>` in the `show-ref` check vs `<name>` in the `git switch -c` line). Using a single placeholder (or a shell variable) throughout would make the procedure unambiguous and reduce copy/paste mistakes.

### Thread 14: .claude/rules/claim-acquire-before-worktree-work.md:164 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-16T10:56:46Z):

P1: This newly added section introduces additional persona-name references (e.g., “Otto-CLI”, “peer Otto”) in a current-state rules surface under `.claude/rules/**`. The repo’s operational standing rule is to avoid direct human/persona names outside the allowlisted history surfaces and use role-refs instead (see `docs/AGENT-BEST-PRACTICES.md` “No name attribution in code, docs, or skills”, around lines 671+). Consider rewriting these new mentions to role-based labels (e.g., “the CLI agent”, “a peer agent”, “background worker”) while keeping the technical content intact.

## General comments

### @chatgpt-codex-connector (2026-05-16T09:09:43Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
