---
id: 081KRQ1AB0008QG0R001BTK7TD
priority: P1
status: in-progress
title: Docs/research cross-reference audit
created: 2026-05-16
last_updated: 2026-05-16
depends_on: [081KQGDBJ0008QG0R002S9SWH6]
type: friction-reducer
decomposition: atomic
renumbered_from: 081KRMEXM0008QG0R00037RGNY
renumbered_per: "081KRMEXM0008QG0R00037RGNY collision with PR #3694 Riven cursor-terminal renumber"
---

# 081KRQ1AB0008QG0R001BTK7TD - Docs/research cross-reference audit

This is a peeled layer from 081KQGDBJ0008QG0R002S9SWH6 (Pre-substrate Kenji-era inventory).

## Renumber history

This row was originally filed as 081KRMEXM0008QG0R00037RGNY on PR #3674. After PR #3694 landed,
081KRMEXM0008QG0R00037RGNY became the Riven cursor-terminal renumber target. This row now uses
081KRQ1AB0008QG0R001BTK7TD so backlog IDs remain factory-wide unique.

## What

Build `tools/hygiene/audit-research-docs.ts` to audit all files under `docs/research/` and verify each path is referenced in `memory/**/*.md` or carries an explicit unindexed-rationale marker.

## Status

Script created and execution verified.
