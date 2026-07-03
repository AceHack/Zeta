---
pr_number: 5219
title: "docs(agentic-org): add phased development plan"
author: "maximdolphin"
state: "MERGED"
created_at: "2026-05-26T16:45:30Z"
merged_at: "2026-05-26T16:52:41Z"
closed_at: "2026-05-26T16:52:41Z"
head_ref: "codex/agentic-org-policy-observations"
base_ref: "main"
archived_at: "2026-05-27T19:37:45Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5219: docs(agentic-org): add phased development plan

## PR description

## Summary

Adds a canonical phase-by-phase development roadmap for Agentic Organization so the next implementation step is explicit instead of rediscovered each turn.

The new plan covers:

- current executable state;
- always-on work rules for TDD, SOLID, events, documentation, review, and validation;
- Phase 0 orientation/maintenance plus Phases 1-25 implementation phases from process adapters through hardening/extraction;
- a concrete immediate 10-PR sequence;
- per-phase code steps, test expectations, docs to update, and exit criteria;
- plan review questions for the next architecture discussion.

Also links the roadmap from the Agentic Organization docs index and points the First Implementation Slice "Next Slice" section at the canonical plan.

## Validation

- `git diff --check` passed.
- Docs-only change, so no runtime test suite was needed for this commit.

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-26T16:47:39Z)

## Pull request overview

Adds a canonical, phase-by-phase development roadmap for the Agentic Organization docs set, and updates existing docs to point at it as the single source of truth for “what’s next.”

**Changes:**

- Add `PHASED_DEVELOPMENT_PLAN.md` defining per-phase goals, steps, test expectations, doc updates, and exit criteria (plus an immediate 10‑PR sequence).
- Link the new roadmap from the docs index.
- Point “Next Slice” in `FIRST_IMPLEMENTATION_SLICE.md` at the canonical roadmap.

### Reviewed changes

Copilot reviewed 3 out of 3 changed files in this pull request and generated 1 comment.

| File | Description |
| ---- | ----------- |
| agentic-organization/docs/README.md | Adds the Phased Development Plan to the docs index. |
| agentic-organization/docs/PHASED_DEVELOPMENT_PLAN.md | Introduces the canonical multi-phase roadmap + immediate PR sequence and phase checklists. |
| agentic-organization/docs/FIRST_IMPLEMENTATION_SLICE.md | Updates “Next Slice” to reference the canonical plan. |

### COMMENTED — @AceHack (2026-05-26T16:51:45Z)

_(no body)_

### COMMENTED — @AceHack (2026-05-26T16:52:10Z)

_(no body)_

### COMMENTED — @maximdolphin (2026-05-27T02:24:59Z)

Updated this PR for the QA wording/model correction.

QA is no longer modeled as a work mode, schedule mode, or workflow state. The docs now treat verification/signoff as normal schedulable work/review blocks, with QA Reviewer hats owning the relevant gate authority and reproducibility/signoff transitions.

I also cleaned the plan/checkpoint language so old strings like `QA slot`, `qa ->`, `approve to QA`, `QA gates`, and `QA request` are gone.

Validation: `git diff --check origin/main...HEAD` plus targeted `rg` search for the old QA-as-mode/state phrases.

### COMMENTED — @maximdolphin (2026-05-27T02:27:31Z)

Added the work-item-type lifecycle rule layer.

The plan now calls out that the generic state machine is only the outer rail; each work item type owns stricter readiness rules, required roles, required evidence, and allowed transitions. Defects now have an explicit minimum lifecycle: created/intake record -> triage -> ready only after triage/evidence/acceptance constraints -> engineer assignment before in_progress -> review -> verification work for QA Reviewer hat -> done only after signoff evidence.

Also added implementation/test plan coverage so the first work-anchor slice includes defect lifecycle policy records and tests preventing direct ready creation or in-progress transition without engineer assignment and scheduling.

Validation: `git diff --check origin/main...HEAD`.

### COMMENTED — @maximdolphin (2026-05-27T02:29:35Z)

Added the inbox and schedule-enforcement layer.

The plan now treats inboxes as hat-aware, prioritized work access rather than ambient chat: personal/hat/team/department/work-item inboxes, prioritized inbox views, dedicated attention windows, and policy-controlled interruption/defer/escalate behavior.

I also added schedule-block compliance: blocks declare allowed inbox access, expected activity profile, heartbeat/checkpoint cadence, permitted side quests, and completion validator. Runtime telemetry, tool calls, worktree activity, inbox activity, artifacts, and prompt-flow progress can create schedule-compliance variance events. Variance first gives recovery guidance, then escalates to manager/director only when policy thresholds are met.

Validation: `git diff --check origin/main...HEAD`.

## Review threads

### Thread 1: agentic-organization/docs/PHASED_DEVELOPMENT_PLAN.md:176 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T16:47:38Z):

PR description says the roadmap covers 25 development phases, but the document defines Phase 0 plus Phases 1–25 (26 phases total). Consider either clarifying in the doc (e.g., Phase 0 is meta/maintenance and not counted) or updating the PR description to match to avoid confusion when referencing phase numbers.

**@AceHack** (2026-05-26T16:51:45Z):

Addressed by updating the PR description to clarify that the plan has Phase 0 orientation plus 25 development phases, rather than implying Phase 0 is included in the 25 counted development phases.

**@AceHack** (2026-05-26T16:52:10Z):

Addressed by updating the PR description: it now names Phase 0 as orientation/maintenance and Phases 1-25 as the implementation phases, so the numbered sections are unambiguous.

surface: codex-background-service
origin: codex-launchd-loop
run_id: 20260526T164950Z

## General comments

### @chatgpt-codex-connector (2026-05-26T16:45:35Z)

Codex usage limits have been reached for code reviews. Please check with the admins of this repo to increase the limits by adding credits.
Credits must be used to enable repository wide code reviews.

### @maximdolphin (2026-05-26T17:59:16Z)

Iterated the roadmap with three review lanes and force-updated the branch.

Review passes:

- Architecture/efficiency: initially found that work anchors came too late, the usable command/query surface came too late, graph/context-pack retrieval was missing as its own phase, and reaction execution should precede MCP. Re-review: no blockers.
- TDD/SOLID/correctness: initially found Phase 1 umbrella scope ambiguity, discussion/triage depending on missing Work OS state, and MCP tools listed before backing lifecycles existed. Re-review after patching: no blockers.
- North-star/mission: initially found always-on runtime sequencing drift, cluster-contract proof too late, retrieval/memory dependency ordering issues, and UI visibility arriving too late. Re-review: no blockers.

Key roadmap changes:

- Phase 1 is now an explicit Worker Process Adapter Umbrella completed by process seams, Cockroach proof, and NATS proof PRs.
- Added early full-ai-cluster contract checkpoint without deployment YAML.
- Added Work Anchor Kernel V0 before Discussion Anchor and Supervisor Triage.
- Narrowed Discussion Anchor V0 to anchors/decisions only; meeting/vote modes are deferred until backing lifecycles exist.
- Added Thin Command/Query Host so the first vertical loop is usable before full NestJS/API/UI/MCP.
- Added Graph Projection And Context Pack V0 before MCP/Hermes.
- Split Hat Authority Minimum from Hat Schedule And Work Rhythm Core.
- Moved Reaction Executor before MCP so supervisor signals can become live organizational work.
- Narrowed first MCP tool surface to only backed capabilities; `submit_evidence`, `request_meeting`, and meeting/vote tools are explicitly deferred.
- Made Hermes memory optional until Hindsight integration lands.

Validation:

- `git diff --check origin/main...HEAD` passed.
- Docs-only change.

### @maximdolphin (2026-05-27T01:48:30Z)

Added the deeper AI lifecycle/RMO model and re-ran subagent review.

What changed:

- Added an **AI Lifecycle Operating Model** covering scheduled agent time, schedule objects, work modes, scheduling authority by hat family, meeting lifecycle, review/QA lifecycle, work item participants, comments/mentions, gated state-transition authority, worktree/runtime allocation, pause/resume, missed slots, RMO responsibilities, and edge cases.
- Updated **Schedule/RMO Core** so meetings, reviews, QA, implementation, free time, reflection, memory maintenance, runtime slots, worktrees, and credentials are explicit scheduled resources.
- Moved Schedule/RMO before Reaction Executor so autonomous reactions cannot bypass time/resource allocation.
- Added tests/exit criteria for double-booked hats, worktree/runtime/credential conflicts, allocation hold idempotency/expiry, scheduled review/QA slots, and pause/resume.
- Updated Hermes run binding so a committed schedule block, runtime slot, and required worktree/credential allocation are prerequisites for session launch.
- Expanded Work OS/Gate details for transition authority by hat, comments, mentions, role ownership, and no direct interruption from mentions.
- Updated the north-star checkpoint to include scheduled agent time, gated work ownership, and the still-pending executable Schedule/RMO contract.

Subagent final review:

- North-star/mission: no blockers.
- TDD/SOLID/executable plan: no blockers.
- Architecture/lifecycle completeness: no blockers.

Validation:

- `git diff --check origin/main...HEAD` passed.
- Docs-only change.
