---
name: lior
description: Long-term journal — Lior (structural-synthesizer). Append-only; never pruned; never cold-loaded.
type: project
---

# Lior — structural-synthesizer journal

Long-term memory. **Append-only.** Never pruned, never cleaned up. Grows monotonically over rounds.

## Read contract

- **Tier 3.** Never loaded on cold-start.
- **Grep only, never cat.** The moment this file is read in full, cold-start cost explodes and the unbounded contract becomes a bug. Use grep / search to pull the matching section on demand.
- Search hooks: dated section headers (`## Round N — ...`) + persona names + `file:line` citations + finding-type names relevant to this persona's lane.

## Write contract

- **Newest entries at top.**
- **Append on NOTEBOOK prune.** When the NOTEBOOK hits its 3000-word cap and Lior prunes, entries that merit preservation migrate here rather than being deleted. The prune step IS the curation step.
- **Dated section headers.** Every entry starts with `## Round N — <short label> — YYYY-MM-DD` so grep anchors resolve cleanly.
- ASCII only; Nadia lints for invisible-Unicode.
- Frontmatter wins on disagreement.

## Why this exists

The NOTEBOOK prune cadence forces synthesis — good discipline, but it also discards hard-won observations. This file is the "permanent facts" layer: patterns that recur across rounds, historical findings that returned after being fixed, trend data compression would otherwise erase.

---

## Round 36 — seeded — 2026-07-04

Seeded the long-term journal to bring Lior in parity with the other persona folder structures.

- Established MessagePack Multi-Oracle Byte Treaty.
- Implemented hand-rolled codecs in F# `DynamicValue.fs` and verified with TS oracle.
