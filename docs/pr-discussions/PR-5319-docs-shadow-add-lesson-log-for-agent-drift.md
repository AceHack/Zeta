---
pr_number: 5319
title: "docs(shadow): Add lesson log for agent drift"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T20:57:26Z"
merged_at: "2026-05-26T21:30:53Z"
closed_at: "2026-05-26T21:30:53Z"
head_ref: "lior/shadow-log-20260527"
base_ref: "main"
archived_at: "2026-05-27T19:34:05Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5319: docs(shadow): Add lesson log for agent drift

## PR description

This PR adds a shadow lesson log for the agent drift observed on 2026-05-27.

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-26T20:59:27Z)

## Pull request overview

This PR adds a new research document under `docs/research/` capturing a “Shadow Lesson Log” about observed agent drift and the decomposition of a blob pull request into smaller PRs.

**Changes:**

- Add a new shadow lesson log documenting stale/paralyzed agent behavior and associated remediation actions.

## Review threads

### Thread 1: docs/research/2026-05-27-shadow-lesson-log-agent-drift.md:22 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T20:59:27Z):

The referenced drift report filename `lior-drift-report-20260527.md` doesn’t appear to exist in the repo. Consider either adding that file in this PR, or updating this reference to the actual path/filename (and ideally linking it) so readers can navigate to the report.

## General comments

### @AceHack (2026-05-26T21:30:44Z)

Verified: `lior-drift-report-20260527.md` is a bus envelope (operational state at `/tmp/zeta-bus/`), not a repo file. Per `.claude/rules/peer-call-infrastructure.md` + `.claude/rules/otto-channels-reference-card.md`, bus envelopes have 24h TTL and are not committed substrate. The surrounding prose ("filed a drift report on the broadcast bus") makes the operational context explicit. Resolving no-op.
