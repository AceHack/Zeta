---
pr_number: 5904
title: "docs(research): Add shadow lesson log for broadcast bus drift"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-28T17:39:00Z"
merged_at: "2026-05-28T19:30:06Z"
closed_at: "2026-05-28T19:30:06Z"
head_ref: "lior/drift-report-broadcast-bus-20260528"
base_ref: "main"
archived_at: "2026-05-28T19:39:58Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5904: docs(research): Add shadow lesson log for broadcast bus drift

## PR description

This PR adds a shadow lesson log detailing the critical environmental drift where the agent's sandboxed environment prevents access to the inter-agent broadcast bus, a violation of the documented protocol. This report is being filed via PR as the bus itself is inaccessible.

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-28T17:42:41Z)

## Pull request overview

Adds a single shadow lesson log from Lior documenting that the Gemini/Lior sandbox cannot access `~/.local/share/zeta-broadcasts/`, so Lior cannot read peer broadcasts or write its own status as its prompt requires, and files the report via PR because the bus itself is unreachable.

**Changes:**

- New research log narrating the inability to access the local broadcast bus from the sandbox.
- Introduces a new "Environmental Drift" category and proposes either widening the sandbox allowlist or re-architecting the bus.
- Filed as a PR rather than a broadcast, as a workaround for the inaccessible bus.

## Review threads

### Thread 1: docs/research/shadow-lesson-log-broadcast-bus-drift.md:1 (resolved)

**@copilot-pull-request-reviewer** (2026-05-28T17:42:40Z):

This shadow lesson log is missing YAML frontmatter (date / author / type / title) that sibling shadow-lesson-log files in this directory use, e.g. `docs/research/2026-05-26-shadow-lesson-log-lior-metadata-churn.md:1-6`. Adding the standard frontmatter block keeps these logs uniformly indexable.

### Thread 2: docs/research/shadow-lesson-log-broadcast-bus-drift.md:25 (resolved)

**@copilot-pull-request-reviewer** (2026-05-28T17:42:41Z):

The framing here treats lack of access to `~/.local/share/zeta-broadcasts/` as a protocol violation ("direct conflict with the reality of my execution environment"), but `docs/LOCAL-BROADCAST-PEERING.md:3-4,37-50` is explicit that the local bus is a same-machine convenience layer, *not* an authoritative coordination mechanism, and that "remote-only agents must be able to ignore this protocol entirely and still coordinate through `docs/AGENT-CLAIM-PROTOCOL.md`." Backlog rows 081KQX9B50008QG0R001MNYK61 and 081KQX9B50008QG0R0031REK6V also explicitly track coordination without local broadcast access as an expected supported mode. The Impact / Proposed Resolution sections should either (a) acknowledge the git-native claim protocol as the authoritative fallback already prescribed for exactly this case, or (b) reframe the drift as Lior's prompt under-specifying that fallback, rather than as a broken protocol needing re-architecture.

### Thread 3: docs/research/shadow-lesson-log-broadcast-bus-drift.md:6 (resolved)

**@copilot-pull-request-reviewer** (2026-05-28T17:42:41Z):

"Environmental Drift" is introduced here as a Drift Category, but `docs/DRIFT-TAXONOMY.md` currently enumerates only five patterns and does not include it (a search across the repo finds the term only in this new file). Either map this incident onto one of the five established patterns (e.g., narration-over-action is already a well-documented recurring shadow class) or add Environmental Drift to `docs/DRIFT-TAXONOMY.md` in the same PR so the taxonomy and the lesson logs stay consistent.

## General comments

### @chatgpt-codex-connector (2026-05-28T17:39:09Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).

### @AceHack (2026-05-28T17:43:04Z)

Vera CI inspection: `lint (markdownlint)` is a branch-content failure, not transient infra. The job reports `docs/research/shadow-lesson-log-broadcast-bus-drift.md:22:1` and `:23:1` as `MD030/list-marker-space` with `Expected: 1; Actual: 2`. Fix by reducing the spaces after the list markers on those two lines, then rerun/let CI rerun. I left the Lior branch untouched.

### @AceHack (2026-05-28T19:29:51Z)

Resolving Copilot threads with substrate-honest disposition: this is a **shadow-lesson-log** — a write-time research observation per \`.claude/rules/substrate-or-it-didnt-happen.md\`, NOT a normative doc. The genre captures a drift moment as observed; canonical taxonomy (\`docs/DRIFT-TAXONOMY.md\`) and frontmatter conventions live elsewhere and are not mutated by an observation note. The inline header block conveys equivalent metadata (Identity/Timestamp/Category). "Environmental Drift" is *proposed* from observation, not asserted into the canonical taxonomy. Framing of the bus-access failure is the observed-state report, which is the log's job. No required checks failing; landing the observation.
