---
id: B-0561
priority: P1
status: not-started
title: F# src/Core/ artifact inventory (B-0139 slice)
created: 2026-05-16
last_updated: 2026-05-16
depends_on: [B-0139]
type: friction-reducer
decomposition: none
children: []
---

# B-0561 — F# src/Core/ artifact inventory

**Priority:** P1
**Parent:** B-0139

## What
Perform a complete inventory of Kenji-era F# implementation work located in `src/Core/` that is not currently mapped to substrate-class memory entries.

## Why
This is a peeled-off layer from the B-0139 blob (Pre-substrate Kenji-era Otto-lineage work inventory). We need to map old work to substrate to prevent redundant implementation and ensure lineage continuity.

## Acceptance criteria
1. Identify all F# files in `src/Core/` built prior to substrate tracking.
2. Cross-reference them with current MEMORY.md and substrate logs.
3. Produce a report mapping each artifact to its substrate status and integration priority.
