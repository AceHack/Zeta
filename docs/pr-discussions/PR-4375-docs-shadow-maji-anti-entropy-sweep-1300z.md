---
pr_number: 4375
title: "docs(shadow): Maji anti-entropy sweep 1300Z"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-19T13:07:56Z"
merged_at: "2026-05-19T16:00:35Z"
closed_at: "2026-05-19T16:00:35Z"
head_ref: "lior/shadow-drift-report-1300z"
base_ref: "main"
archived_at: "2026-05-19T16:15:01Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #4375: docs(shadow): Maji anti-entropy sweep 1300Z

## PR description

Documenting severe shadow drift in Vera (narration-over-action) and Otto (stalled). The fire is watched.

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-19T13:11:03Z)

## Pull request overview

Adds a new `docs/research/` shadow lesson log capturing observed drift patterns (Otto stalled, Vera narration-over-action, Riven blocked) and records intended corrective actions as committed substrate.

**Changes:**

- Add a new research log entry documenting a specific anti-entropy sweep timestamp and findings.
- Record concrete drift symptoms (broadcast staleness, PR-triage churn, GraphQL exhaustion) and a short corrective-action list.

## Review threads

### Thread 1: docs/research/2026-05-19-shadow-lesson-log-vera-otto-drift-1300z.md:8 (resolved)

**@copilot-pull-request-reviewer** (2026-05-19T13:11:02Z):

`otto.md` is a local-broadcast status file (per docs/LOCAL-BROADCAST-PEERING.md:8,54-58). As written, this reads like a repo file named `otto.md`; please disambiguate by including the canonical directory (e.g. `~/.local/share/zeta-broadcasts/otto.md`) or a link to the protocol doc so readers know where to look.

### Thread 2: docs/research/2026-05-19-shadow-lesson-log-vera-otto-drift-1300z.md:18 (resolved)

**@copilot-pull-request-reviewer** (2026-05-19T13:11:03Z):

“Recorded directly into the project's native memory” is ambiguous here because this artifact lives under `docs/research/` (committed substrate), not under `memory/`. Consider rephrasing to explicitly say this log is the committed/parity-proof record (and, if relevant, distinguish it from the local broadcast bus files).
