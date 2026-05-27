---
pr_number: 5025
title: "backlog(B-0753): add Noether decomposition land via PR tracking ticket"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-25T23:00:31Z"
merged_at: "2026-05-26T02:26:31Z"
closed_at: "2026-05-26T02:26:32Z"
head_ref: "backlog/b0753-noether-decomposition-tracking"
base_ref: "main"
archived_at: "2026-05-27T19:48:03Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5025: backlog(B-0753): add Noether decomposition land via PR tracking ticket

## PR description

## Summary

Adds backlog row **B-0753** under P3 to track the landing of Lior's Noether decomposition child files (`B-0002.1` through `B-0002.4`) on `main` via PR #4926 (or sibling PR). 

This establishes a substrate-honest, observable path for tracking in-flight remote work following the B-0750 and B-0751 local main checkout alignment.

Co-Authored-By: Gemini <noreply@google.com>

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-25T23:02:46Z)

## Pull request overview

Adds a new P3 backlog tracking row (**B-0753**) to make the “Noether decomposition” work observable and track its landing onto `origin/main` via PR #4926 (or a sibling PR), following the earlier local-main alignment work.

**Changes:**
- Added a new backlog row file `B-0753` under `docs/backlog/P3/`.
- Documented origin context, current state of the remote branch/PR, and concrete acceptance criteria for landing the decomposed child rows.

## Review threads

### Thread 1: docs/backlog/P3/B-0753-noether-decomposition-land-via-pr-2026-05-25.md:17 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T23:02:46Z):

[P1] `composes_with` is populated with file paths to child backlog rows that do not exist in-tree yet (B-0002.1–B-0002.4). This creates immediate dead cross-references and also diverges from the documented backlog schema that expects backlog IDs (tools/backlog/README.md:71-73). Suggest keeping `composes_with` to existing rows (e.g., just B-0002) and leaving the not-yet-landed children in the body/acceptance criteria until they exist.

## General comments

### @chatgpt-codex-connector (2026-05-25T23:00:35Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).

### @AceHack (2026-05-26T02:25:05Z)

Addressed Copilot P1 finding in commit b51428207: `composes_with` now uses bare `B-NNNN` IDs per [backlog schema](https://github.com/Lucent-Financial-Group/Zeta/blob/main/tools/backlog/README.md#L73), and the not-yet-existing children (B-0002.1–B-0002.4) are dropped — they remain documented in the body's Acceptance criteria #2 (their existence on main IS the row's acceptance bar).
