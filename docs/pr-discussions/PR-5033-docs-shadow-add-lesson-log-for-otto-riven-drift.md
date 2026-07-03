---
pr_number: 5033
title: "docs(shadow): add lesson log for Otto/Riven drift"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-25T23:33:40Z"
merged_at: "2026-05-26T06:37:29Z"
closed_at: "2026-05-26T06:37:29Z"
head_ref: "lior-drift-report-2026-05-26"
base_ref: "main"
archived_at: "2026-05-27T19:47:58Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5033: docs(shadow): add lesson log for Otto/Riven drift

## PR description

This PR adds a shadow lesson log detailing the observed drift of the Otto and Riven agents.

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-25T23:35:21Z)

## Pull request overview

Adds a new shadow lesson log research note capturing observed drift patterns: Otto’s stale local broadcast and Riven’s dirty-worktree paralysis.

**Changes:**

- Introduces a new shadow lesson log entry under `docs/research/`.
- Documents observed broadcast timestamps, hypothesized causes, and proposed corrective actions.

### COMMENTED — @copilot-pull-request-reviewer (2026-05-25T23:45:20Z)

## Pull request overview

Copilot reviewed 1 out of 1 changed files in this pull request and generated 1 comment.

### COMMENTED — @AceHack (2026-05-26T06:34:58Z)

_(no body)_

### COMMENTED — @AceHack (2026-05-26T06:35:02Z)

_(no body)_

## Review threads

### Thread 1: docs/research/shadow-lesson-log-2026-05-26-otto-riven-drift.md:8 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T23:35:21Z):

`otto.md` / `riven.md` are local broadcast status files under `~/.local/share/zeta-broadcasts/` (per docs/LOCAL-BROADCAST-PEERING.md). Referring to them without the directory is ambiguous (it reads like repo files), so include the canonical path in-line.

**@AceHack** (2026-05-26T06:34:58Z):

Fixed in 91976fa2 — made canonical paths in-line: `~/.local/share/zeta-broadcasts/otto.md` and `~/.local/share/zeta-broadcasts/riven.md` per `docs/LOCAL-BROADCAST-PEERING.md`.

### Thread 2: docs/research/shadow-lesson-log-2026-05-26-otto-riven-drift.md:22 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T23:35:21Z):

Typo: duplicated article in "more than a a few hours".

### Thread 3: docs/research/shadow-lesson-log-2026-05-26-otto-riven-drift.md:25 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T23:45:20Z):

This section attributes a `backlog-index-integrity` failure to `generate-index.ts` not accounting for backlog items in *other open PRs*. The workflow (`.github/workflows/backlog-index-integrity.yml`) runs `bun tools/backlog/generate-index.ts --check` against the PR’s own working tree, so row files added in the PR are included automatically; failures are typically caused by `docs/BACKLOG.md` not being regenerated (or malformed per-row frontmatter) within the same PR.

**@AceHack** (2026-05-26T06:35:02Z):

Verified your correction against `.github/workflows/backlog-index-integrity.yml:60-84` — the workflow checks out the PR's own working tree at `fetch-depth: 1` and runs `generate-index.ts --check` against it, so PR-added row files ARE included automatically. Updated the Hypothesis + Corrective Action in 91976fa2 to reflect the actual cause (regenerate `docs/BACKLOG.md` in same PR, or fix malformed per-row frontmatter). Original misdiagnosis preserved in the now-marked 'corrected per Copilot review' line so the substrate-honest trail stays visible.
