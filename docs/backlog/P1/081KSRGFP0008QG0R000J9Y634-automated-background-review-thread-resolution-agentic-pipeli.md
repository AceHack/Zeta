---
id: B-0938
zetaid: 081KSRGFP0008QG0R000J9Y634
priority: P1
status: open
title: Automated Background Review Thread Resolution agentic pipeline — enables background loops to actively ingest unresolved threads, self-correct target code/specs, verify via compiler gates, and resolve threads on GitHub (operator 2026-05-29)
effort: L
ask: aaron 2026-05-29
created: 2026-05-29
last_updated: 2026-05-29
depends_on:
  - B-0750
  - B-0751
composes_with:
  - B-0440
  - B-0442
  - B-0571
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
- B-0750 and B-0751 define worktree isolation and sandbox bypass rules.
- This row uses isolated worktrees to perform the resolution edits and local compilation checks.

## Scope

### Sub-rows planned

- **B-0938.1** — Extend `poll-pr-gate.ts` to return the full array of unresolved thread details (comment bodies, file paths, line numbers, and GraphQL IDs) instead of just the count.
- **B-0938.2** — Implement the `ResoluteAgent` runner loop: checks out the target PR branch in an isolated `/tmp/` worktree, feeds the thread details to the agent's LLM prompt, and requests a focused code/spec edit to address the comments.
- **B-0938.3** — Build the compilation & test verification gate: after each edit, runs the local build pipeline (`dotnet build -c Release && dotnet test` or `bun test`), verifying `0 Warnings, 0 Errors`.
- **B-0938.4** — Implement the push & publish actuator: commits the verified fix using `Co-Authored-By: <agent-persona>` and `AgencySignature` conventions, and pushes to origin.
- **B-0938.5** — Implement the GitHub GraphQL thread-reply-and-resolve mutation actuator: posts a review reply linking the resolution commit, and resolves the thread on GitHub.
- **B-0938.6** — Build the failure-closed escalation gate: if compilation or tests fail after three self-correction attempts, aborts the operation, rolls back the local worktree, and flags the PR as `BLOCKED (resolution-failed)` for manual review.
- **B-0938.7** — Integration: wire the `ResoluteAgent` runner into the background loop tick script so it fires automatically when a PR is `BLOCKED` with unresolved threads.

## Why P1

- Operator-directed explicitly 2026-05-29 ("lets write up and ADR")
- Represents the next major step in multi-loop autonomous engineering (foreground-optional operations)
- Direct driver for DORA metrics (drastically reduces PR lead-time and merge wait times by self-healing simple lint/style comment blocks)
