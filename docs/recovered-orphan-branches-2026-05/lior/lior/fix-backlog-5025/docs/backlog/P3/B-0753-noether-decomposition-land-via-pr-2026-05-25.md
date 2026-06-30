---
id: B-0753
priority: P3
status: open
title: Noether decomposition land via PR — track integration of lior-decompose-4781-shadow-log onto main
created: 2026-05-25
last_updated: 2026-05-25
classification: buildable-now
decomposition: atomic
owners: [lior, formal-verification-expert]
type: backlog-tracking
composes_with:
  - docs/backlog/P3/B-0002-otto-287-noether-formalization.md
  - docs/backlog/P3/B-0002.1-noether-formalization-step1.md
  - docs/backlog/P3/B-0002.2-noether-formalization-step2.md
  - docs/backlog/P3/B-0002.3-noether-formalization-step3.md
  - docs/backlog/P3/B-0002.4-noether-formalization-step4.md
---

# B-0753 — B-0002 Noether decomposition land via PR: track integration of lior-decompose-4781-shadow-log onto main

## Origin

Aaron Stainback / Lior 2026-05-25 BFT loop alignment session. Following the B-0750 (worktree hygiene) and B-0751 (per-agent isolated clones) architectures, the divergent Noether decomposition commits on local `main` were safely reset. This ticket files the substrate-honest follow-up to track landing the Noether decomposition children (`B-0002.1` through `B-0002.4`) on `main` via PR #4926 or a sibling PR.

## Finding

Lior's past-self commits (`54d5b53e7` and `d229514ac`) decomposed `B-0002` (Noether formalization) into four atomic child tickets and preserved PR #4853. These commits reside on remote branch `lior-decompose-4781-shadow-log` and are actively open under **PR #4926** (auto-merge squashed). However, the child ticket files themselves are currently missing on `origin/main` as the PR is still open.

This row tracks the formal path to main for the Noether decomposition substrate so it does not sit permanently on remote branches.

## Acceptance criteria

1. PR #4926 (or a focused Noether decomposition sibling PR) is merged to `origin/main`.
2. The four child files `B-0002.1-noether-formalization-step1.md` through `B-0002.4-noether-formalization-step4.md` are present on `origin/main`.
3. The parent `B-0002-otto-287-noether-formalization.md` is updated on `origin/main` to reflect the active child tickets.

## Effort

S (Tracking and integration-merge verification only; the code/prose changes are already written and pushed).

## Composes with

- [`docs/backlog/P3/B-0002-otto-287-noether-formalization.md`](B-0002-otto-287-noether-formalization.md) — the parent row being decomposed
- PR #4926 — the integration vehicle
