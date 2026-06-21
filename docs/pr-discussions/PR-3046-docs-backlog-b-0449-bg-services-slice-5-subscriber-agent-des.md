---
pr_number: 3046
title: "docs(backlog): 081KRFA460008QG0R002DG8KPZ \u2014 bg-services slice 5 subscriber-agent design pass"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-13T22:37:22Z"
merged_at: "2026-05-13T22:44:06Z"
closed_at: "2026-05-13T22:44:06Z"
head_ref: "docs-b0449-bg-services-slice-5-subscriber-agent-design-2026-05-13"
base_ref: "main"
archived_at: "2026-05-13T22:58:02Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #3046: docs(backlog): 081KRFA460008QG0R002DG8KPZ — bg-services slice 5 subscriber-agent design pass

## PR description

## Summary

Files the named architectural gap the bg-services README explicitly calls out: *"subscribers don't yet exist"* — the missing layer between nudges-land-on-bus and foreground-loop-optional.

## Design proposal

Three architectures considered:

| Option | Shape | Pro | Con |
|--------|-------|-----|-----|
| A | One subscriber per topic (3 processes) | Simple per-topic logic; failure isolation | 3 processes to monitor; duplicated boilerplate |
| B | Unified subscriber daemon (1 process, dispatches) | One process; reusable polling; cross-topic awareness | Monolith failure mode |
| **C (recommended)** | `subscribeOnce(topic, handler)` library; cron-tick function call | Composes with existing cron; surface-agnostic; failure-isolated; DST-compatible | Subscriber latency = cron tick latency (1min) |

Option C composes with the per-tick discipline shipped in PR #3042: the subscriber call lives in step 1 (refresh), envelopes get queued into step 3 (pick speculative work).

## Why design-pass first

The architectural decision cascades into 3 services × N handlers of implementation. Separating design (this row) from implementation (081KRFA460008QG0R001QFS6EV/081KRFA460008QG0R00308W7FJ/081KRA5AR0008QG0R0029YWXYW follow-ups) lets future-Otto read the rationale rather than re-derive it.

## Substrate-honest

Design-pass only — no code shipped here. Implementation work tracked separately. The row IS the architectural substrate.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-13T22:40:18Z)

## Pull request overview

Adds a new P1 backlog design-pass row (081KRFA460008QG0R002DG8KPZ) that proposes the subscriber-agent architecture for bg-services slice 5, and updates the backlog index to include it (and 081KRFA460008QG0R000CYBGKW).

**Changes:**
- Introduces 081KRFA460008QG0R002DG8KPZ design doc describing three subscriber-layer architecture options and recommending a cron-tick `subscribeOnce` library approach.
- Captures acceptance criteria and follow-up slice breakdown (081KRFA460008QG0R001QFS6EV/081KRFA460008QG0R00308W7FJ/081KRA5AR0008QG0R0029YWXYW) for the subscriber pattern.
- Updates `docs/BACKLOG.md` to list 081KRFA460008QG0R000CYBGKW and 081KRFA460008QG0R002DG8KPZ.

### Reviewed changes

Copilot reviewed 2 out of 2 changed files in this pull request and generated 1 comment.

| File | Description |
| ---- | ----------- |
| docs/backlog/P1/081KRFA460008QG0R002DG8KPZ-bg-services-slice-5-subscriber-agent-design-pass-2026-05-13.md | New backlog row documenting the proposed subscriber-agent architecture and acceptance criteria for slice 5. |
| docs/BACKLOG.md | Adds index entries for 081KRFA460008QG0R000CYBGKW and 081KRFA460008QG0R002DG8KPZ under P1. |

### COMMENTED — @copilot-pull-request-reviewer (2026-05-13T22:45:28Z)

## Pull request overview

Copilot reviewed 2 out of 2 changed files in this pull request and generated 1 comment.

## Review threads

### Thread 1: docs/backlog/P1/081KRFA460008QG0R002DG8KPZ-bg-services-slice-5-subscriber-agent-design-pass-2026-05-13.md:105 (resolved)

**@copilot-pull-request-reviewer** (2026-05-13T22:40:17Z):

P1: The acceptance criteria are internally inconsistent about the bus directory. It says `subscribeOnce` reads `/tmp/zeta-bus/`, but later requires tests using a fake bus dir. Please update the design to specify that the subscriber uses the same configurable bus directory as existing bus tooling (e.g., honor `ZETA_BUS_DIR` / shared `BUS_DIR` constant), so tests and production behavior align.

### Thread 2: docs/backlog/P1/081KRFA460008QG0R002DG8KPZ-bg-services-slice-5-subscriber-agent-design-pass-2026-05-13.md:11 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-13T22:45:28Z):

`composes_with` is documented as a bidirectional cross-reference in backlog tooling docs. This row lists `081KRFA460008QG0R000CYBGKW` (and `081KR7JY10008QG0R0008NGW95`) in `composes_with`, but the corresponding rows don’t currently reference `081KRFA460008QG0R002DG8KPZ`, so the graph is one-way. Either add the reciprocal `composes_with: [..., 081KRFA460008QG0R002DG8KPZ]` to those rows in the same PR, or drop these entries here and rely on the prose cross-references until you’re ready to update both sides.
