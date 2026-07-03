---
pr_number: 3710
title: "docs(hygiene): land tools/hygiene/AUDIT-LIFECYCLE.md \u2014 reusable template"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-16T03:34:15Z"
merged_at: "2026-05-16T03:42:15Z"
closed_at: "2026-05-16T03:42:15Z"
head_ref: "docs/audit-lifecycle-pattern-otto-cli-2026-05-16"
base_ref: "main"
archived_at: "2026-05-16T03:51:36Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #3710: docs(hygiene): land tools/hygiene/AUDIT-LIFECYCLE.md — reusable template

## PR description

## What

New doc at `tools/hygiene/AUDIT-LIFECYCLE.md` capturing the 7-step pattern shared by both repo-hygiene audits that have completed it:

1. Discovery — bug class named, instance observed
2. Narrow fix — per-instance fix, no audit yet
3. Scanner — detect-only audit
4. Quality iterations — false positives, edge cases, cross-platform
5. Baseline — grandfather mechanism for immutable surfaces
6. CI enforce gate — non-required `lint (xxx)` job
7. Maintenance — shrink baseline; eventually delete

## Worked examples in the doc

- **§33 migration xrefs** audit: PR #3513 → #3552 → enforce (~4 weeks)
- **Tick-shard relative-path** audit: PR #3676 → #3708 (~80 min single session)

## Includes

Step-ordering rationale, mutable-vs-immutable surface distinction for baseline strategy, pre-emptive scanner-author findings worth implementing in step 3 to shorten the quality loop.

Co-Authored-By: Claude <noreply@anthropic.com>

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-16T03:36:25Z)

## Pull request overview

Adds a reusable hygiene-audit lifecycle template for turning recurring repository hygiene defects into scanner-backed CI gates.

**Changes:**

- Documents the 7-step audit pattern from discovery through maintenance.
- Adds worked examples for §33 migration xrefs and tick-shard relative-path audits.
- Captures guidance on baseline strategy, scanner-quality pitfalls, and schema validation.

## Review threads

### Thread 1: tools/hygiene/AUDIT-LIFECYCLE.md:37 (resolved)

**@copilot-pull-request-reviewer** (2026-05-16T03:36:25Z):

P2: This current-state tools doc introduces direct name attribution outside the repository's allowed history/roster surfaces. Replace the named reviewer/persona references with role references (for example, reviewer/factory-agent/archive-migration subject) while keeping the PR numbers as provenance.

### Thread 2: tools/hygiene/AUDIT-LIFECYCLE.md:44 (resolved)

**@copilot-pull-request-reviewer** (2026-05-16T03:36:25Z):

This lifecycle row conflicts with the existing gate documentation: `.github/workflows/gate.yml` records the §33 scanner gate as 081KRMEXM0008QG0R000K25MXS Slice B.3/B.4, and the tick history says PR #3555 added `--enforce` plus the CI job. PR #3552 was the cleanup-to-zero PR, so this row should separate cleanup/baseline from the later CI-enforce PR instead of saying #3552 wired the gate.
