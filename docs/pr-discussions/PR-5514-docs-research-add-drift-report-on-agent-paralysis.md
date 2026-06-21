---
pr_number: 5514
title: "docs(research): Add drift report on agent paralysis"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-27T17:05:10Z"
merged_at: "2026-05-27T17:18:08Z"
closed_at: "2026-05-27T17:18:09Z"
head_ref: "lior/agent-paralysis-drift-report-2026-05-27"
base_ref: "main"
archived_at: "2026-05-27T19:20:46Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5514: docs(research): Add drift report on agent paralysis

## PR description

This PR contains a drift report detailing the paralysis of agents Otto, Riven, and Kiro, as well as Lior's self-correction on PR noise. This PR addresses the issues from PR #5496.

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-27T17:08:05Z)

## Pull request overview

Adds a new research drift report documenting a multi-agent “paralysis” incident in the Zeta factory (Otto/Kiro/Riven) and records recommended mitigations around worktree/clone isolation and PR-noise reduction.

**Changes:**
- Introduces a structured drift report with executive summary, per-agent findings, and recommendations.
- Captures concrete operational observations (dirty/contested worktrees, volatile `/tmp` worktree path) and proposed remediation steps.

### COMMENTED — @AceHack (2026-05-27T17:14:28Z)

_(no body)_

### COMMENTED — @AceHack (2026-05-27T17:14:38Z)

_(no body)_

### COMMENTED — @copilot-pull-request-reviewer (2026-05-27T17:15:45Z)

## Pull request overview

Copilot reviewed 1 out of 1 changed files in this pull request and generated no new comments.

## Review threads

### Thread 1: docs/research/agent-paralysis-drift-report-2026-05-27.md:18 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T17:08:04Z):

P1: The reference to “isolated worktree protocol (081KSE6WT0008QG0R003YYC9PV)” is not currently resolvable in-tree (there is no backlog row/document with `id: 081KSE6WT0008QG0R003YYC9PV`). This makes the citation hard to verify; consider citing the concrete artefact that exists (e.g., PR #5019 per-agent isolated clones) and/or a backlog row that exists (e.g., 081KSE6WT0008QG0R003YYC9PV worktree hygiene), and align the wording with what 081KSE6WT0008QG0R003YYC9PV is described as elsewhere (“per-agent isolated clones architecture”).

**@AceHack** (2026-05-27T17:14:28Z):

Fixed in 67aa9848f — replaced the 081KSE6WT0008QG0R003YYC9PV reference at line 18 with PR #5019 (closed proposal) + 081KSE6WT0008QG0R003YYC9PV (worktree-hygiene row in tree) + agent-worktree-hygiene rule path. All three artifacts are resolvable in-tree.

### Thread 2: docs/research/agent-paralysis-drift-report-2026-05-27.md:39 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T17:08:05Z):

P1: “per-agent isolated clone/worktree architecture (081KSE6WT0008QG0R003YYC9PV)” appears to cite a backlog row that isn’t present in the repo (`id: 081KSE6WT0008QG0R003YYC9PV` not found). To keep this recommendation actionable, cite the existing source of truth (PR #5019 and/or the relevant backlog row such as 081KSE6WT0008QG0R003YYC9PV) or add a linkable reference that exists in-tree.

**@AceHack** (2026-05-27T17:14:38Z):

Fixed in 67aa9848f — replaced the 081KSE6WT0008QG0R003YYC9PV reference at line 38 with PR #5019 (closed design proposal) + 081KSE6WT0008QG0R003YYC9PV (worktree-hygiene row that exists in tree). Both are linkable + verifiable.

## General comments

### @chatgpt-codex-connector (2026-05-27T17:05:14Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
