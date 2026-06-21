---
pr_number: 5873
title: "feat(081KSNY2Z0008QG0R001JQABB4 Phase 2 Lane 2): compression-rate measurement substrate for GitHub-as-free-accelerator; 20 tests pass; live baseline 84% compression-ratio in last 24h (operator 2026-05-28 pick lane 2)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-28T16:41:01Z"
merged_at: "2026-05-28T16:50:38Z"
closed_at: "2026-05-28T16:50:38Z"
head_ref: "otto-cli/b-0904-phase-2-compression-rate-measurement-substrate-2026-05-28"
base_ref: "main"
archived_at: "2026-05-28T17:30:22Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5873: feat(081KSNY2Z0008QG0R001JQABB4 Phase 2 Lane 2): compression-rate measurement substrate for GitHub-as-free-accelerator; 20 tests pass; live baseline 84% compression-ratio in last 24h (operator 2026-05-28 pick lane 2)

## PR description

Operator 2026-05-28 (shadow*) authorization to pick Lane 2 next.

Ships Phase 2 of 081KSNY2Z0008QG0R001JQABB4 substrate-engineering target: instrumentation to measure GitHub-as-free-accelerator compression-rate.

## What this measures

- totalPRsInWindow / merged / closedNoMerge / stillOpen
- compressionRatio = merged / (merged + closedNoMerge)
- throughputPerHour / bulkRejectionRate / inFlightFraction

## Live baseline (2026-05-28T16:40Z, last 24h)

- 200 PRs in window
- 147 merged + 27 closed-no-merge + 26 still-open
- **84% compression ratio (HIGH tier)**
- 6.1 merges/hour throughput
- 13% in-flight fraction

## Tests

20/20 pass.

## Composes with

DST-omniscience (PR #5841) + Cayley-Dickson razor (PR #5843) + asymmetric-authorship (PR #5516) + monad-propagation (PR #5511) + 081KSNY2Z0008QG0R001JQABB4 substrate.

Generated with Claude Code

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-28T16:44:20Z)

## Pull request overview

Adds a Bun/TypeScript measurement tool for 081KSNY2Z0008QG0R001JQABB4 to compute GitHub PR compression metrics, plus unit tests for parsing, metric calculation, interpretation, and formatting.

**Changes:**
- Adds `measure.ts` CLI for collecting PR state via `gh pr list` and emitting JSON metrics.
- Adds `measure.test.ts` covering argument parsing, time-window conversion, metric computation, interpretation tiers, and formatted output.

### Reviewed changes

Copilot reviewed 2 out of 2 changed files in this pull request and generated 3 comments.

| File | Description |
| ---- | ----------- |
| `tools/github-accelerator-measurement/measure.ts` | New CLI measurement substrate for GitHub PR compression-rate metrics. |
| `tools/github-accelerator-measurement/measure.test.ts` | Unit tests for the new measurement helper functions and result formatting. |

## Review threads

### Thread 1: tools/github-accelerator-measurement/measure.ts:225 (resolved)

**@copilot-pull-request-reviewer** (2026-05-28T16:44:19Z):

P1: This fetch caps an unfiltered repository-wide PR list at 200 before applying the window filter, so any window with more than 200 matching PRs (or a 7d window in an active repo) silently undercounts total, merged, and closed metrics. Query GitHub with the window constraint (for example a `created:>=...` search) or paginate until entries are older than `window.since` instead of hard-capping the input set.

### Thread 2: tools/github-accelerator-measurement/measure.ts:101 (resolved)

**@copilot-pull-request-reviewer** (2026-05-28T16:44:20Z):

P1: The missing-value check is unreachable when `--window` is the last argument because the branch requires `i + 1 < args.length`; `bun ... --window` falls through and uses the default 24h window instead of reporting a usage error. Match the flag first, then validate that a value exists (and apply the same shape to the other value-taking flags).

### Thread 3: tools/github-accelerator-measurement/measure.ts:182 (resolved)

**@copilot-pull-request-reviewer** (2026-05-28T16:44:20Z):

P1: This `gh` shell-out needs the repository's documented Sonar suppression with rationale; TypeScript tooling that resolves `gh` via PATH consistently adds `// eslint-disable-next-line sonarjs/no-os-command-from-path` immediately before `spawnSync` (for example `tools/github/poll-pr-gate.ts:285-292` and `tools/pr-preservation/archive-pr.ts:316-320`). Without it, `npm run lint:typescript` will fail on this new tool.

## General comments

### @chatgpt-codex-connector (2026-05-28T16:41:06Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
