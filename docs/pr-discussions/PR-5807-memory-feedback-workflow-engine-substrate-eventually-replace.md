---
pr_number: 5807
title: "memory(feedback): workflow-engine substrate eventually REPLACES GitHub PR process \u2014 Aaron 2026-05-28 three-phase trajectory carving"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-28T13:06:07Z"
merged_at: "2026-05-28T13:46:12Z"
closed_at: "2026-05-28T13:46:12Z"
head_ref: "otto-cli/workflow-engine-eventually-replaces-github-pr-process-currently-dogfooding-target-state-github-becomes-backup-fork-protection-aaron-2026-05-28"
base_ref: "main"
archived_at: "2026-05-28T14:13:00Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5807: memory(feedback): workflow-engine substrate eventually REPLACES GitHub PR process — Aaron 2026-05-28 three-phase trajectory carving

## PR description

Aaron 2026-05-28: *'once we get these workflows working good we can turn off prs and github branch protection roll our own and just use theirs as backup / fork protection or something if we need it.'*

Three-phase substrate-engineering trajectory:

| Phase | State | Primary substrate | GitHub role |
|---|---|---|---|
| **Phase 1 (current)** | Dogfooding | GitHub PR + branch protection + auto-merge | PRIMARY |
| **Phase 2 (target)** | workflow-engine matures | workflow-engine DUs + dispatch + state-machine | Parallel-run + verification |
| **Phase 3 (deepest)** | workflow-engine IS primary | OUR workflow-engine substrate | BACKUP / fork-protection |

## Substitution mapping

GitHub primitive → Workflow-engine replacement:
- PR → WorkflowLifetime DU (081KSKBP80008QG0R000B3Y19A.5)
- Branch protection → StandardVerdict DUs + lifetime-pair matrices
- Required checks → dispatchInWorld Result<T, TFeedback>
- Auto-merge → ShipAction state in AutoLoopLifetime
- Review threads → ReviewLifetime DU
- CI integration → closed-loop CI-result dispatch
- Fork-protection → Safety-net BACKUP only

## 6 Phase 3 readiness conditions

1. workflow-engine covers all GitHub PR primitives
2. Per-host adapter coverage (multi-forge)
3. AutoLoopLifetime drives the workflow
4. Structured observability + audit trail
5. Cross-AI-instance compatibility
6. Backup fallback (GitHub branch-protection armed)

Composes with PR #5806 (DUs-as-muscle-memory) + PR #5805 (AutoLoopLifetime) + PR #5775/#5801/#5804 (per-host adapters) + PR #5728 (workflow-engine PoC) + PR #5786 (Common Sense 2.0) + Prism ferry (white-hole emission).

NO new backlog rows per 'common sense 2.0' signal — substrate sufficient.

μένω. The workflow-engine substrate compounds toward Phase 3.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-28T13:10:54Z)

## Pull request overview

Adds a feedback memory capturing a three-phase trajectory where the workflow-engine substrate moves from GitHub PR dogfooding toward becoming the primary workflow substrate, with GitHub retained as backup/fork protection.

**Changes:**
- Adds a new `memory/feedback_*.md` file documenting the trajectory, substitution mapping, and readiness criteria.
- Regenerates `memory/MEMORY.md` to include the new memory entry and update the truncated heap count.

### Reviewed changes

Copilot reviewed 2 out of 2 changed files in this pull request and generated 3 comments.

| File | Description |
| ---- | ----------- |
| `memory/MEMORY.md` | Adds the new memory entry to the auto-index and updates truncation metadata. |
| `memory/feedback_workflow_engine_eventually_replaces_github_pr_process_currently_dogfooding_target_state_github_becomes_backup_fork_protection_aaron_2026_05_28.md` | New feedback memory describing the workflow-engine replacement trajectory and related substrate references. |

## Review threads

### Thread 1: memory/feedback_workflow_engine_eventually_replaces_github_pr_process_currently_dogfooding_target_state_github_becomes_backup_fork_protection_aaron_2026_05_28.md:30 (resolved)

**@copilot-pull-request-reviewer** (2026-05-28T13:10:53Z):

This frontmatter block introduces non-standard keys (`authors`, `composes_with`, `related_prs`, `related_backlog`, and `tags`). The memory format standard only allows `originSessionId`, `created`, `last_updated`, and `superseded_by` as optional fields and says extra fields require governance discussion (`memory/project_memory_format_standard.md:29-42`). Move these relationships into body sections such as `## Composes with`, or update the schema in the same change.

### Thread 2: memory/feedback_workflow_engine_eventually_replaces_github_pr_process_currently_dogfooding_target_state_github_becomes_backup_fork_protection_aaron_2026_05_28.md:13 (resolved)

**@copilot-pull-request-reviewer** (2026-05-28T13:10:53Z):

This composes-with reference is broken: the cited memory file does not exist in the repository. The memory format standard requires cited memory files to exist and also says memory-folder cross-references should use filenames rather than `memory/`-prefixed paths (`memory/project_memory_format_standard.md:182-196`). Either add the referenced memory file in this PR or change the reference to an existing filename.

### Thread 3: memory/feedback_workflow_engine_eventually_replaces_github_pr_process_currently_dogfooding_target_state_github_becomes_backup_fork_protection_aaron_2026_05_28.md:138 (resolved)

**@copilot-pull-request-reviewer** (2026-05-28T13:10:53Z):

This heading ends with punctuation, which conflicts with the memory header-format rule: `memory/project_memory_format_standard.md:169-174` requires no trailing punctuation in headers. Drop the final period so the memory file stays consistent with the documented format.

## General comments

### @chatgpt-codex-connector (2026-05-28T13:06:14Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).

### @AceHack (2026-05-28T13:17:11Z)

Hello! I noticed that there are a number of failing lint checks on this PR. You can see the details of the failing checks here: https://github.com/Lucent-Financial-Group/Zeta/pull/5807/checks.

To prevent this in the future, you may want to run the linter locally before pushing your changes.

Thank you for your contribution!
