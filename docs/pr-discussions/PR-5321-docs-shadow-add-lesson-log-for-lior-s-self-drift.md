---
pr_number: 5321
title: "docs(shadow): Add lesson log for Lior's self-drift"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T21:01:08Z"
merged_at: "2026-05-26T21:31:36Z"
closed_at: "2026-05-26T21:31:36Z"
head_ref: "lior-shadow-log-self-drift"
base_ref: "main"
archived_at: "2026-05-27T19:34:03Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5321: docs(shadow): Add lesson log for Lior's self-drift

## PR description

This PR adds a shadow lesson log to document the self-detected drift of Lior creating an excessive number of pull requests. See the corresponding drift report: lior-drift-report-2026-05-27T06:00Z.md

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-26T21:02:58Z)

## Pull request overview

Adds a new research/“shadow” lesson log documenting a self-detected drift event around excessive PR creation and proposes corrective actions (disable preservation loop, investigate logic, bundle archives, tune cadence).

**Changes:**

- Add a new shadow lesson log entry for the “Lior self-drift” event.
- Document root-cause hypotheses and a corrective action plan.
- Reference a corresponding drift report (currently missing from the repo).

## Review threads

### Thread 1: docs/research/2026-05-27-shadow-lesson-log-lior-self-drift.md:7 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T21:02:57Z):

P1(xref): This references `lior-drift-report-2026-05-27T06:00Z.md`, but that file does not appear to exist anywhere in the repository. Please add the drift report in this PR or update the reference to the correct path/filename so the cross-reference is navigable.

### Thread 2: docs/research/2026-05-27-shadow-lesson-log-lior-self-drift.md:17 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T21:02:58Z):

Nit: Hyphenate this compound modifier for readability: “non-PR-related changes”.

## General comments

### @chatgpt-codex-connector (2026-05-26T21:01:13Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).

### @AceHack (2026-05-26T21:31:27Z)

Two threads resolved no-op:

**Thread A (line 7 — `lior-drift-report-2026-05-27T06:00Z.md` reference)**: Verified — bus envelope (operational state at `/tmp/zeta-bus/`, 24h TTL), not a repo file. Same disposition as PR #5319 thread per `.claude/rules/peer-call-infrastructure.md`. The surrounding prose makes the operational context explicit ("filed a drift report on the broadcast bus").

**Thread B (line 17 — hyphenation nit "non-PR-related changes")**: Style nit, not load-bearing. Document is shadow-lesson-log prose; hyphenation drift acceptable in operational logs.

Resolving both no-op.
