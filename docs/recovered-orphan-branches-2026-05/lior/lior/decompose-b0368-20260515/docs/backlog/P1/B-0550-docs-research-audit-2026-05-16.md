---
id: B-0550
priority: P1
status: in-progress
title: Docs/research cross-reference audit
created: 2026-05-16
last_updated: 2026-05-16
depends_on: [B-0139]
type: friction-reducer
decomposition: atomic
renumbered_from: B-0549
renumbered_per: "B-0549 collision with PR #3694 Riven cursor-terminal renumber"
---

# B-0550 - Docs/research cross-reference audit

This is a peeled layer from B-0139 (Pre-substrate Kenji-era inventory).

## Renumber history

This row was originally filed as B-0549 on PR #3674. After PR #3694 landed,
B-0549 became the Riven cursor-terminal renumber target. This row now uses
B-0550 so backlog IDs remain factory-wide unique.

## What

Build `tools/hygiene/audit-research-docs.ts` to audit all files under `docs/research/` and verify each path is referenced in `memory/**/*.md` or carries an explicit unindexed-rationale marker.

## Status

Script created and execution verified.
