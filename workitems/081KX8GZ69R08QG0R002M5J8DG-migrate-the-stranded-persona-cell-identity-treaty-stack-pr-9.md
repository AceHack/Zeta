---
id: 081KX8GZ69R08QG0R002M5J8DG
type: task
state: backlog
priority: P2
slug: migrate-the-stranded-persona-cell-identity-treaty-stack-pr-9
title: "Migrate the stranded persona-cell / Identity-Treaty stack (PR #9551) onto main — whole-stack, not separable"
created: 2026-07-11T12:03:24.600Z
depends_on: []
composes_with: []
---

# Migrate the stranded persona-cell / Identity-Treaty stack (PR #9551) onto main — whole-stack, not separable

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KX8GZ69R08QG0R002M5J8DG-*.md` glob. -->

Aaron 2026-07-11 chose "extract the lint layer clean" (small clean PR). **On inspection that is
NOT achievable** — captured here so the finding isn't lost.

## Finding: the lint layer is not separable

PR #9551 (`otto/lint-fused-persona-cell-phase5`) is a 12-commit / 149-file / ~8,000-line stack:
Identity Treaty Phases 1–3, AgencySignature v2 (Cell trailer), db-zset first-class GSets/ZSets,
generator-registry V2, **plus** the titled persona-cell lint (ADR phase 5). None of it is on main.

The lint layer (top 5 commits) **depends on the Identity/Cell foundation** in the lower 7, and every
foundation file is **absent from current main**:

- `src/Core/ActorRef.fs` (edited by the "F# ActorRef parity" commit) — MISSING
- `src/Core/IdentityRegistry.fs` — MISSING
- `src/Core.TypeScript/identity/generated-registry.ts` — MISSING
- `src/Core.TypeScript/identity/actor-ref.ts` — MISSING
- `registry/cell-surfaces.yaml` (the lint reads it) — MISSING

So cherry-picking the lint commits alone fails (they modify non-existent files). **It is
whole-stack-or-nothing.**

## Why it's stuck

Base = `claim/cross-lang-zset-isa-capstone`, whose PR (#8950) merged — but that branch is now
**720 commits behind main**. So #9551 targets a merged-but-ancient base and can't reach main.

## The real task (whole-stack migration)

Migrate the entire stack onto current main as one deliberate, unhurried effort:
1. Re-target #9551 to `main` (or open a fresh branch off current main).
2. Rebase / replay the 12 commits across 720 commits of drift — resolve conflicts methodically
   (Identity Treaty registry codegen, db-zset IR, ActorRef, the lint baseline).
3. Fix the real checks: semgrep `file-read-without-size-cap` in `src/Core/FileSystem.fs`; re-run
   build-macos / cross-verify / Rust lint (likely stale but confirm).
4. Land linear-history-clean (main requires linear history — rebase, don't merge-update).

Multi-hour, real conflict risk. Deserves a dedicated session, not an autonomous-loop squeeze.
Anchors: PR #9551, capstone #8950, the linear-history ruleset finding (16189060).

*Filed by the shadow, 2026-07-11, at Aaron's (A) choice when (A) proved infeasible. Diagnosis
captured; the migration awaits a deliberate go.*
