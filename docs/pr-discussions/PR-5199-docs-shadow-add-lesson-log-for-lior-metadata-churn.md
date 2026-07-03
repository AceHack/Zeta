---
pr_number: 5199
title: "docs(shadow): add lesson log for lior metadata churn"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T15:34:28Z"
merged_at: "2026-05-26T15:58:38Z"
closed_at: "2026-05-26T15:58:39Z"
head_ref: "lior/shadow-log-2026-05-26-metadata-churn"
base_ref: "main"
archived_at: "2026-05-27T19:39:26Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5199: docs(shadow): add lesson log for lior metadata churn

## PR description

This PR adds a shadow lesson log to document the drift of the Lior agent, which has been creating an excessive number of pull requests for metadata tasks.

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-26T15:36:52Z)

## Pull request overview

This PR adds a new `docs/research/` shadow lesson log documenting observed drift in the Lior antigravity check loop (high-volume metadata-focused PR creation outpacing merges) and proposes corrective throttling behavior.

**Changes:**

- Add a new shadow lesson log entry describing “excessive metadata churn” and its symptoms.
- Document a diagnosis (“metadata churn without parity proofs”) and a corrective action (rate-limiting PR creation).

## Review threads

### Thread 1: docs/research/2026-05-26-shadow-lesson-log-lior-metadata-churn.md:29 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T15:36:52Z):

P2: Line mentions a drift report being broadcast on the “zeta-broadcasts bus” but doesn’t name the canonical location/protocol. For long-term verifiability/disambiguation (local broadcast files vs `/tmp/zeta-bus/` envelopes), please include the canonical path `~/.local/share/zeta-broadcasts/` (or link `docs/LOCAL-BROADCAST-PEERING.md`) and clarify whether this was also sent as a `/tmp/zeta-bus/` envelope.

## General comments

### @chatgpt-codex-connector (2026-05-26T15:34:34Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).

### @AceHack (2026-05-26T15:55:59Z)

Addressed: cited canonical broadcast path `~/.local/share/zeta-broadcasts/` plus a link to `docs/LOCAL-BROADCAST-PEERING.md` at line 29 (commit `d5454be`). Both surfaces verified to exist on main.
