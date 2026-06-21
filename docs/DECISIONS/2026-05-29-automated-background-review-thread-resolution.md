# ADR: Automated Background Review Thread Resolution via Dual-Loop Agents

**Status:** accepted
**Date:** 2026-05-29
**Backlog:** 081KSRGFP0008QG0R000J9Y634

## Context & Problem Statement

Zeta's software factory relies on a multi-loop agent architecture where background loops (Vera, Riven, Lior, scheduled crons) continuously monitor the Pull Request queue to verify checks, manage claims, and orchestrate merges.

However, when a Pull Request encounters unresolved review comments (whether from human reviewers, adversarial AI criticism, or static analysis tools like Copilot), the PR state transitions to `BLOCKED`.

Currently, the background loop's recovery path is strictly bounded:

1. It uses `tools/git/batch-resolve-pr-threads.ts` to automatically resolve specific static pattern classes (`dangling-ref`, `name-attribution`).
2. For all other review comments (linter failures, technical suggestions, style critiques), it halts, flags `resolve-threads` as its `nextAction`, and waits for manual foreground intervention.

This status quo introduces a bottleneck: simple review comments that require trivial, deterministic fixes (such as correcting `markdownlint` spacing, fixing minor syntax, or adjusting types) stall the autonomous merge pipeline and require foreground intervention.

The problem is: how do we structure and formalize an automated, secure pipeline that enables background agents to actively ingest review comments, self-correct the codebase, verify the fix via compiler gates, and resolve the threads on GitHub without human-in-the-loop?

## Considered Options

* **Option 1: Status Quo (Conservative Punting)** — Keep the automated resolution limited to static regex pattern matching. All unknown threads remain unresolved and require foreground/human coordination.
* **Option 2: Active Self-Correction & Auto-Resolution (The Resolute Agent)** — Equip background loops with a structured thread-ingestion pipeline. When the agent detects unknown unresolved threads, it launches an isolated self-correction run: it checks out the PR branch in a dedicated worktree, applies code/spec changes to address the feedback, runs `dotnet build / test` or `bun test` locally to verify, commits and pushes the fix, and calls the GitHub GraphQL API to post a reply and mark the thread as resolved.

## Pros & Cons of the Options

### Option 1: Status Quo (Conservative Punting)

* **Pros:** Highly secure; zero risk of agents introducing unreviewed logic changes in response to hallucinated comments; low token cost.
* **Cons:** High operational friction; PR queue drains slowly; requires the human maintainer or foreground sessions to manually fix simple lint and formatting suggestions.

### Option 2: Active Self-Correction & Auto-Resolution (The Resolute Agent)

* **Pros:**
  * **Complete Autonomy:** Simple, deterministic feedback (formatting, lints, type corrections) is resolved in minutes, maintaining continuous PR velocity.
  * **Compiler-Guaranteed Safety:** The local build-and-test gate acts as the physical backstop. The agent cannot push a "resolution fix" unless the code compiles clean with zero warnings and all tests pass.
  * **Traceability:** The agent posts a direct reply to the review thread citing the commit hash that resolved the finding, providing an auditable history.
* **Cons:**
  * **Token Overhead:** Ingesting thread discussions and running iterative code-edits inside background ticks consumes significant context and API capacity.
  * **Complexity:** Requires handling edge cases where review comments are contradictory or require major architectural redesigns (which must be caught and gracefully escalated to human review).

## Decision Outcome

* **Chosen Option:** Option 2: Active Self-Correction & Auto-Resolution (The Resolute Agent), because it aligns with our 6-month goal of foreground-optional, durable persistent operations. The backstop of our strict compiler gate guarantees that auto-resolved branches maintain pre-v1 correctness.

### Consequences & Safety Guardrails

1. **Failure-Closed Escalation:** If the self-correction loop fails to compile or pass tests after three iterations, it must abort, leave the thread unresolved, and escalate by marking the PR state as `BLOCKED (resolution-failed)`.
2. **Context Scope:** The agent must only read review comments on files it has write permission to (respecting the doc/code lane split).
3. **Explicit Attribution:** Every resolution commit must include the canonical `Co-Authored-By:` trailer and sign the resolution with an `AgencySignature`.
