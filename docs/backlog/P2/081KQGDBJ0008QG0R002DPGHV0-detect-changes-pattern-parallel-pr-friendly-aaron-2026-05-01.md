---
id: 081KQGDBJ0008QG0R002DPGHV0
priority: P2
status: open
title: detect-changes pattern — per-change-class workflow gating so PRs only run relevant checks (Aaron 2026-05-01; sibling-repo parallel-optimization external anchor)
tier: tooling
effort: M
ask: Aaron 2026-05-01 named the row in the prefer-mechanical-external-anchors memo (`memory/feedback_prefer_mechanical_external_anchors_over_aaron_as_anchor_aaron_2026_05_01.md`) — "081KQGDBJ0008QG0R002DPGHV0, detect-changes pattern" — composing with 081KQGDBJ0008QG0R000E10AAM (lint suite) and 081KQGDBJ0008QG0R000A4EZS5 (TS port). ID was reserved 2026-05-01; per-row file filed 2026-05-03 by Otto audit pass post-081KQGDBJ0008QG0R0015RNK3P + post-081KQGDBJ0008QG0R002WY918J filings. Detailed pattern source at `memory/feedback_detect_changes_pattern_sibling_repo_parallel_optimized_external_anchor_aaron_2026_05_01.md`.
created: 2026-05-01
last_updated: 2026-05-03
depends_on: []
composes_with: [081KQGDBJ0008QG0R001MK4YPC, 081KQGDBJ0008QG0R000E10AAM, 081KQGDBJ0008QG0R000A4EZS5, 081KQNJ500008QG0R0035QCEX9]
tags: [ci, workflows, detect-changes, parallel-pr, gating, fine-grained-workflows, sibling-repo, external-anchor, tooling]
type: friction-reducer
---

# detect-changes pattern — per-change-class workflow gating

## Origin

Aaron 2026-05-01, in two related memos:

- `memory/feedback_prefer_mechanical_external_anchors_over_aaron_as_anchor_aaron_2026_05_01.md` — names 081KQGDBJ0008QG0R002DPGHV0 in the investment-direction section: *"when building substrate-discipline mechanizations (per 081KQGDBJ0008QG0R000E10AAM lint suite, 081KQGDBJ0008QG0R000A4EZS5 TS port, 081KQGDBJ0008QG0R002DPGHV0 detect-changes pattern), spend the effort on PRECISION not on coverage-breadth"*
- `memory/feedback_detect_changes_pattern_sibling_repo_parallel_optimized_external_anchor_aaron_2026_05_01.md` — full pattern source from sibling-repo direct inspection: *"`../no-copy-only-learning-agents-insight` is the best repo in github i've seen setup to be parallel"*

ID was reserved 2026-05-01; per-row file was never filed. Otto 2026-05-03 audit pass (post-081KQGDBJ0008QG0R0015RNK3P + post-081KQGDBJ0008QG0R002WY918J filings) found 081KQGDBJ0008QG0R002DPGHV0 still missing — third concrete hit for 081KQNJ500008QG0R0035QCEX9's audit hypothesis.

## The problem

Current Zeta CI runs ALL workflows on every PR regardless of whether the PR's changes are relevant to each workflow. Examples:

- A docs-only PR triggers `dotnet build`, F# analyzer runs, .NET tests — none of which can be affected by docs changes
- A backlog-row-only PR triggers markdown lint, semgrep, CodeQL — only markdown lint is relevant
- A workflow-config PR triggers everything in the relevant matrix even though the change might be limited to one workflow file

**Effect**: CI churn proportional to (open PRs) × (number of workflows), independent of (changes per PR). Parallel-PR friendliness is bounded by total CI capacity, not by relevance.

**Partial pre-existence** (post-merge review correction): some gating already exists — `gate.yml` skips build/test on docs-only PRs; `codeql.yml` short-circuits pure docs changes via `path-gate`; backlog-only changes have a `backlog-index-integrity` check. This row generalizes the partial pattern into a uniform mechanism, NOT introduces gating from zero.

## What this row builds

The sibling-repo's detect-changes pattern (`../no-copy-only-learning-agents-insight`) — adapted for Zeta. **Note (post-merge review correction)**: GitHub Actions `needs:` works only within a single workflow file (`jobs.<job_id>.needs`), NOT across workflow files. The cross-workflow gating must use one of three architectures:

**Architecture A — Reusable workflow** (`workflow_call`):

A `detect-changes.yml` reusable workflow declares outputs; each downstream workflow calls it via `uses: ./.github/workflows/detect-changes.yml` and gates jobs on the called workflow's outputs. Cleanest separation; matches sibling-repo pattern.

**Architecture B — Per-workflow detect-job**:

Each downstream workflow includes a small `detect-changes` job at the top that emits the change-class outputs; subsequent jobs in the same workflow gate on `needs: detect-changes`. Duplicated per workflow but no cross-workflow coordination needed.

**Architecture C — Single consolidated workflow**:

Collapse all gated workflows into one mega-workflow with a top-level `detect-changes` job + per-class job. Simplest semantics but loses workflow-file separation.

**Recommended**: Architecture A (reusable workflow) — matches sibling-repo pattern, preserves separation, and gate-on-outputs semantics are well-supported in GitHub Actions.

Per-class outputs:

- `dotnet-src-changed: true|false`
- `fsharp-src-changed: true|false`
- `tools-ts-changed: true|false`
- `docs-changed: true|false`
- `workflows-changed: true|false`
- etc. (one output per change class)

**Required-checks list** still includes all gated workflows; gate reports SUCCESS-skipped if not relevant. Per GitHub's required-checks semantics, a skipped-but-required check still counts as passing.

## Composes with

- **081KQGDBJ0008QG0R001MK4YPC (skip-fsharp-analyze on docs-only PRs)**: **sibling-instance** of the parallel-forever-workflow pattern this row generalizes — NOT subsumed by 081KQGDBJ0008QG0R002DPGHV0. Per Aaron 2026-05-03 correction: "redesign for parallel gates for parallel workflows that are going to be parallel forever basically there are probably others that fit this category or will in the future." Both rows stay as sibling artifacts; 081KQGDBJ0008QG0R002DPGHV0 supplies the cross-cutting infrastructure (reusable detect-changes workflow + gating semantics); 081KQGDBJ0008QG0R001MK4YPC + future-similar rows continue to express their per-workflow gating in their own rows. Composition is "shared infrastructure, distinct gates," not "general subsumes specific."
- **081KQGDBJ0008QG0R000E10AAM (pre-commit lint suite)**: detect-changes-gated lint runs reduce per-PR CI burden
- **081KQGDBJ0008QG0R000A4EZS5 (TypeScript standardization for non-install scripts)**: TS port composes with detect-changes — TS-only changes don't trigger F# workflows
- **081KQNJ500008QG0R0035QCEX9 (audit memos for misfiled backlog)**: this row's existence IS the third empirical hit for 081KQNJ500008QG0R0035QCEX9's audit hypothesis (sibling to 081KQGDBJ0008QG0R0015RNK3P + 081KQGDBJ0008QG0R002WY918J)
- **Future parallel-forever-workflow rows** (placeholder for later filings): each new parallel-forever workflow gets its own row + composes with 081KQGDBJ0008QG0R002DPGHV0's infrastructure. The cluster grows by addition of siblings, NOT by subsumption into a single mega-row.

## Why this is M-effort

- `detect-changes.yml` reusable workflow: ~50-100 lines of YAML (`.yml` matches the repo's existing convention; all `.github/workflows/` files use `.yml` not `.yaml`)
- Per-workflow gating: each existing workflow needs a `needs: detect-changes` + `if: needs.detect-changes.outputs.<class> == 'true'` condition (small per workflow; cumulative ~15-42 workflows)
- Test fixtures: docs-only PR / fsharp-only PR / mixed PR each verify gating works
- Required-checks list audit: ensure required-but-skipped checks still produce passing status
- Edge cases: workflow-config-changes-but-no-source-changes; merge-queue interaction; force-push edge cases

## Open design questions (NOT for this row; for the design pass)

1. **Granularity**: how fine-grained should change classes be? (Sibling repo has ~10-15; too granular = brittle; too coarse = ineffective)
2. **Workflow-config-changes**: when `.github/workflows/X.yml` itself changes, should X run regardless of source-class?
3. **Path-filter vs detect-changes**: GitHub's native `paths:` filter is simpler but doesn't compose well with required-checks; detect-changes is more code but composes cleanly
4. **Migration sequence**: phase-1 (detect-changes only, no gating yet) vs phase-2 (gating enabled); how to validate empirically before flip
5. **Rollback discipline**: if detect-changes mis-classifies, what's the fallback? (Manual override label? Force-all-workflows mode?)

## Why this matters

The sibling-repo's detect-changes pattern enables parallel-PR-friendly CI: PRs only run workflows their changes need. Effect: CI throughput scales with (changes per PR) × (workflows for those changes), not (open PRs) × (all workflows). For a multi-PR autonomous-loop session like the current one, the difference is substantial.

Composes with the alignment-frontier framing: substrate-quality CI is alignment-frontier substrate. The CI pipeline IS part of the substrate's connective tissue; reducing CI churn reduces friction in the friction → substrate → less-future-friction superfluid amortized-speed loop (per CLAUDE.md).

## Carved sentence

**"detect-changes pattern: reusable detect-changes workflow emits per-change-class outputs; downstream workflows gate on those outputs via `workflow_call`. Result: PRs only run workflows their changes need. CI throughput scales with relevance, not with PR count. **081KQGDBJ0008QG0R002DPGHV0 supplies the cross-cutting infrastructure; 081KQGDBJ0008QG0R001MK4YPC + future-similar are sibling-instances of parallel-forever-workflows, NOT subsumed by 081KQGDBJ0008QG0R002DPGHV0 — composition is "shared infrastructure, distinct gates."** Sibling-repo pattern source preserved at `memory/feedback_detect_changes_pattern_sibling_repo_parallel_optimized_external_anchor_aaron_2026_05_01.md`. Third concrete hit for 081KQNJ500008QG0R0035QCEX9 audit hypothesis."**
