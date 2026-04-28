---
pr_number: 342
title: "docs: calibration-harness Stage-2 design \u2014 Amara 18th-ferry \u00a7B/\u00a7F + corrections #2/#7/#9"
author: AceHack
state: MERGED
created_at: 2026-04-24T09:07:02Z
merged_at: 2026-04-24T09:08:53Z
closed_at: 2026-04-24T09:08:53Z
head_ref: docs/calibration-harness-stage2-design
base_ref: main
archived_at: 2026-04-24T11:22:14Z
archive_tool: tools/pr-preservation/archive-pr.sh
---

# PR #342: docs: calibration-harness Stage-2 design — Amara 18th-ferry §B/§F + corrections #2/#7/#9

## PR description

## Summary

Research-grade design doc for Stage-2 of Amara's corrected promotion ladder. Specifies the next-rung deliverable (calibration harness) so when implementation starts, conventions are pre-committed.

## Key design decisions

- **Placement**: `src/Experimental/CartelLab/` (not `src/Core/` — that's Stage 4 per Amara ladder).
- **MetricVector**: 7 fields including **PLV magnitude AND offset as separate fields** (correction #6 — addresses PR #340's shipped split).
- **Wilson-interval reporting contract**: every statistical claim carries `{successes, trials, lowerBound, upperBound}` — no more "~95% CI ±5%" handwave (correction #2).
- **Robust z-score Hybrid mode**: percentile-rank fallback when MAD < epsilon (correction #7).
- **Explicit artifact layout**: 5 files + manifest under `artifacts/coordination-risk/` (correction #9).
- **`INullModelGenerator` + `IAttackInjector` interfaces** with `Preserves` / `Avoids` / `ExpectedSignals` machine-readable annotations.

## Scope

- Doc-only. No code, no tests, no workflow.
- **Does NOT touch BACKLOG.md tail** — avoids the positional-append conflict pattern that cost #334 → #341 re-file earlier this session.

## 18th-ferry operationalization status

| # | Correction | Status |
|---|---|---|
| 1,10 | Test classification policy | Shipped (#339) |
| 2 | Wilson intervals | **Design specified (this doc); impl waits Stage 2.a** |
| 4 | Exclusivity primitive | Shipped (#331) |
| 5 | Modularity relational | Shipped (#324) |
| 6 | PLV phase-offset | Shipped (#340) |
| 7 | MAD=0 fallback | **Design specified (this doc); impl waits Stage 2.a** |
| 9 | Artifact layout | **Design specified (this doc)** |
| 3 | CoordinationRiskScore rename | Already canonical in code |
| 8 | Stronger sources | Reporting discipline |

7 of 10 18th-ferry corrections now have either shipped code or committed design.

## Test plan

- [x] Markdownlint clean locally.
- [x] Single new file; no surface impact.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-04-24T09:10:50Z)

## Pull request overview

Adds a research-grade design document specifying the planned Stage-2 “calibration harness” for coordination-risk / cartel detection work, with pre-committed conventions for metrics, confidence-interval reporting, robust z-score fallback, and artifact outputs.

**Changes:**
- Introduces a Stage-2 harness design covering module placement (`src/Experimental/CartelLab/`), core types/interfaces, and invocation contract.
- Specifies statistical reporting discipline (Wilson intervals) and robust z-score modes (including MAD=0 fallback via percentile rank / hybrid).
- Defines a fixed artifact output schema under `artifacts/coordination-risk/` for downstream calibration/ROC/PR tooling.

## Review threads

### Thread 1: docs/research/calibration-harness-stage2-design.md:447 (unresolved)

**@copilot-pull-request-reviewer** (2026-04-24T09:10:48Z):

P1: This cross-reference points to `docs/definitions/KSK.md`, but `docs/definitions/` does not currently exist in the repo (and the file appears to be a planned/backlog item rather than present). Please either link to the current canonical location (if it exists elsewhere), or mark this as a planned doc and reference the BACKLOG entry until the file lands.

### Thread 2: docs/research/calibration-harness-stage2-design.md:493 (unresolved)

**@copilot-pull-request-reviewer** (2026-04-24T09:10:49Z):

P1: The referenced Aurora file path `docs/aurora/2026-04-24-amara-calibration-ci-hardening-deep-research-plus-5-5-corrections-18th-ferry.md` does not exist in `docs/aurora/` in the current tree. Please update this link to an existing source doc, or explicitly label it as pending/not-yet-landed (and avoid presenting it as a resolvable path until it is added).

### Thread 3: docs/research/calibration-harness-stage2-design.md:9 (unresolved)

**@copilot-pull-request-reviewer** (2026-04-24T09:10:49Z):

P1: This file introduces contributor/agent name attribution (e.g., "Origin: Amara", multiple later "Amara" / "Otto" mentions). Repo operational standing rule is to use role references in code/docs/skills, keeping names only under `memory/persona/**` (and optionally `docs/BACKLOG.md`). Please rewrite these attributions to role-based phrasing (e.g., "the research agent", "the cadence tracker") and keep the doc’s meaning intact. (Ref: `docs/AGENT-BEST-PRACTICES.md` Operational standing rules.)

### Thread 4: docs/research/calibration-harness-stage2-design.md:49 (unresolved)

**@copilot-pull-request-reviewer** (2026-04-24T09:10:50Z):

P1: The diagram labels `artifacts/coordination-risk/` as “.gitignored”, but the repo’s `.gitignore` does not currently ignore this path. Either adjust the wording to “should be gitignored” (and note it will land with the Stage-2 implementation) or add the appropriate ignore entry when the artifacts directory is introduced.

### Thread 5: docs/research/calibration-harness-stage2-design.md:375 (unresolved)

**@copilot-pull-request-reviewer** (2026-04-24T09:10:50Z):

P2: Artifact count is inconsistent: §7 defines 6 outputs (`run-manifest.json`, `seed-results.csv`, `calibration-summary.json`, `roc-pr.json`, `metric-distributions.csv`, `failing-seeds.txt`), but this line says “all five artifact files”. Please make the count consistent (either update to six, or adjust the earlier list).

## General comments

### @chatgpt-codex-connector (2026-04-24T09:07:07Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
