---
pr_number: 346
title: "docs: DST compliance criteria \u2014 DST-held + FoundationDB-grade bars (Amara 19th-ferry #6)"
author: AceHack
state: MERGED
created_at: 2026-04-24T09:30:37Z
merged_at: 2026-04-24T09:32:26Z
closed_at: 2026-04-24T09:32:26Z
head_ref: docs/dst-compliance-criteria
base_ref: main
archived_at: 2026-04-24T11:22:15Z
archive_tool: tools/pr-preservation/archive-pr.sh
---

# PR #346: docs: DST compliance criteria — DST-held + FoundationDB-grade bars (Amara 19th-ferry #6)

## PR description

## Summary

Research-grade criteria doc locking two acceptance bars per Amara 19th-ferry Part 2 correction #6.

## DST-held (minimum bar) — 6 items

1. All PR-gating stochastic tests use explicit seeds
2. Every failing stochastic test emits seed + parameters
3. Same seed produces same result locally and in CI
4. Broad sweeps run nightly, not as flaky PR gates
5. Main-path code has zero unreviewed entropy-source hits
6. File/network/time/random/task-scheduling boundaries are simulated or explicitly accepted

## FoundationDB-grade (aspirational) — 8 surfaces

Simulated FS · Simulated network · Deterministic task scheduler · Fault injection/buggify · Swarm runner · Replay artifact storage · Failure minimization/shrinking · End-to-end reproducible-from-one-seed

## Mapping to revised-roadmap

| Revised-roadmap PR | Criteria item |
|---|---|
| PR 1 entropy-scanner + boundary registry | DST-held #5 + #6 enforcement |
| PR 2 seed protocol + CI artifacts | DST-held #1 + #2 |
| PR 3 sharder reproduction | DST-held #3 + #4 |
| PR 4 ISimulationDriver + VTS → core | FDB #3 foundation |
| PR 5 simulated filesystem | FDB #1 |
| PR 6 Cartel-Lab DST calibration | DST-held #1 + #2 + FDB #5 partial |

Also preserves Amara's per-area grade table (overall B-) as *Amara's assessment, not factory-certified.*

## Promotion path

Research-grade today. Promotes to `docs/DST-COMPLIANCE.md` top-level when PR 1 of revised roadmap lands + ADR.

## Test plan

- [x] Markdownlint clean.
- [x] No claims of current DST-held compliance.
- [x] No workflow/code changes.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-04-24T09:34:37Z)

## Pull request overview

Adds a new research doc that defines acceptance criteria for deterministic simulation testing (DST) in Zeta, split into a minimum “DST-held” bar and an aspirational “FoundationDB-grade” bar, and maps those criteria to the revised 19th-ferry roadmap.

**Changes:**
- Introduces a “DST-held” (minimum) checklist intended to gate future DST-compliance claims.
- Defines an aspirational “FoundationDB-grade DST candidate” surface list (filesystem/network/scheduler/buggify/swarm/artifacts/shrinking/replay).
- Adds a mapping section tying the criteria to shipped work and queued roadmap PRs, plus a promotion path to a future top-level compliance doc.

## Review threads

### Thread 1: docs/research/dst-compliance-criteria.md:91 (unresolved)

**@copilot-pull-request-reviewer** (2026-04-24T09:34:36Z):

The doc refers to `ISimulationFs` / `ISimulationNetwork`, but the established naming elsewhere in the repo is `ISimulatedFs` / `ISimulatedNetwork` (e.g. `docs/FOUNDATIONDB-DST.md`). Since these are acceptance-criteria names meant to guide future implementation, using the repo’s existing interface names avoids confusion.
```suggestion
1. **Simulated filesystem.** `ISimulatedFs` implemented
   + wired into every file-I/O call site (notably
   `DiskBackingStore`). Supports seed-driven fault
   injection (read failures, write failures, corruption,
   latency spikes).
2. **Simulated network.** `ISimulatedNetwork`
```

### Thread 2: docs/research/dst-compliance-criteria.md:244 (unresolved)

**@copilot-pull-request-reviewer** (2026-04-24T09:34:36Z):

This reference is a bit ambiguous: “`.claude/skills` DST guide” points at a directory, not a specific doc. Consider linking to the concrete DST rulebook file (e.g. `.claude/skills/deterministic-simulation-theory-expert/SKILL.md`) so readers can jump straight to the authoritative text.

### Thread 3: docs/research/dst-compliance-criteria.md:66 (unresolved)

**@copilot-pull-request-reviewer** (2026-04-24T09:34:36Z):

`ISimulationFs` is referenced here as part of the simulation API surface, but that name doesn’t appear elsewhere in the repo; the existing docs use `ISimulatedFs`. Updating this reference keeps the acceptance criteria aligned with the current DST vocabulary.
```suggestion
   API (ChaosEnv / VirtualTimeScheduler / ISimulatedFs
```

### Thread 4: docs/research/dst-compliance-criteria.md:236 (unresolved)

**@copilot-pull-request-reviewer** (2026-04-24T09:34:37Z):

Inline code spans can’t include a newline. The path to the Amara 19th-ferry source doc is split across two lines inside backticks, which will render incorrectly and breaks copy/paste of the path. Keep the full path on one line (or switch to a normal markdown link).
```suggestion
- Amara 19th ferry — `docs/aurora/2026-04-24-amara-dst-audit-deep-research-plus-5-5-corrections-19th-ferry.md`
```

### Thread 5: docs/research/dst-compliance-criteria.md:249 (unresolved)

**@copilot-pull-request-reviewer** (2026-04-24T09:34:37Z):

`tests/ConcurrencyHarness.fs` is referenced here, but that file doesn’t exist in the repo. The `VirtualTimeScheduler` currently lives in `tests/Tests.FSharp/_Support/ConcurrencyHarness.fs`, so this cross-reference should be updated to the correct path.
```suggestion
- `tests/Tests.FSharp/_Support/ConcurrencyHarness.fs`
  — the test-side VirtualTimeScheduler queued for core
  promotion (PR 4 of revised roadmap).
```

## General comments

### @chatgpt-codex-connector (2026-04-24T09:30:42Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
