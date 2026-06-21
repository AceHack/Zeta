---
id: 081KSRGFP0008QG0R000J9Y634
priority: P1
status: open
title: Automated Background Review Thread Resolution agentic pipeline — enables background loops to actively ingest unresolved threads, self-correct target code/specs, verify via compiler gates, and resolve threads on GitHub (operator 2026-05-29)
effort: L
ask: aaron 2026-05-29
created: 2026-05-29
last_updated: 2026-05-29
depends_on:
  - 081KSE6WT0008QG0R003YYC9PV
  - 081KSE6WT0008QG0R003YYC9PV
composes_with:
  - 081KRFA460008QG0R001KC0VBH
  - 081KRFA460008QG0R00061SXRW
  - 081KRQ1AB0008QG0R0038VQJZ0
tags: [agent-autonomy, pr-reviews, thread-resolution, self-correction, worktree-isolation, github-api, graphql-mutation]
---

## Operator framing 2026-05-29

> *"Hey this is great progress Lior please keep a check thanks and see that comments are resolved are your background agets setup to do that if not lets write up and ADR"*

## Existing substrate this composes with

### 1. PR Gate Poller & Classifier (`tools/github/poll-pr-gate.ts`)

- Returns `resolve-threads` when `unresolvedThreads > 0`.
- Currently paginates review threads using raw GitHub GraphQL API.
- This row extends the classifier's output to include thread bodies and line context.

### 2. Static Thread Resolver (`tools/git/batch-resolve-pr-threads.ts`)

- Resolves `dangling-ref` and `name-attribution` static categories via regex.
- Leaves all other threads unresolved as `unknown`.
- This row generalizes this tool into a dynamic, agentic self-correction runner.

### 3. Isolated Worktree Execution

- `AGENTS.md` and `GOVERNANCE.md` mandate dedicated worktrees for autonomous edits.
- 081KSE6WT0008QG0R003YYC9PV and 081KSE6WT0008QG0R003YYC9PV define worktree isolation and sandbox bypass rules.
- This row uses isolated worktrees to perform the resolution edits and local compilation checks.

## Scope

### Sub-rows planned

- **081KSRGFP0008QG0R000J9Y634.1** — Extend `poll-pr-gate.ts` to return the full array of unresolved thread details (comment bodies, file paths, line numbers, and GraphQL IDs) instead of just the count.
- **081KSRGFP0008QG0R000J9Y634.2** — Implement the `ResoluteAgent` runner loop: checks out the target PR branch in an isolated `/tmp/` worktree, feeds the thread details to the agent's LLM prompt, and requests a focused code/spec edit to address the comments.
- **081KSRGFP0008QG0R000J9Y634.3** — Build the compilation & test verification gate: after each edit, runs the local build pipeline (`dotnet build -c Release && dotnet test` or `bun test`), verifying `0 Warnings, 0 Errors`.
- **081KSRGFP0008QG0R000J9Y634.4** — Implement the push & publish actuator: commits the verified fix using `Co-Authored-By: <agent-persona>` and `AgencySignature` conventions, and pushes to origin.
- **081KSRGFP0008QG0R000J9Y634.5** — Implement the GitHub GraphQL thread-reply-and-resolve mutation actuator: posts a review reply linking the resolution commit, and resolves the thread on GitHub.
- **081KSRGFP0008QG0R000J9Y634.6** — Build the failure-closed escalation gate: if compilation or tests fail after three self-correction attempts, aborts the operation, rolls back the local worktree, and flags the PR as `BLOCKED (resolution-failed)` for manual review.
- **081KSRGFP0008QG0R000J9Y634.7** — Integration: wire the `ResoluteAgent` runner into the background loop tick script so it fires automatically when a PR is `BLOCKED` with unresolved threads.

## Why P1

- Operator-directed explicitly 2026-05-29 ("lets write up and ADR")
- Represents the next major step in multi-loop autonomous engineering (foreground-optional operations)
- Direct driver for DORA metrics (drastically reduces PR lead-time and merge wait times by self-healing simple lint/style comment blocks)
