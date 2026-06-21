---
id: 081KR2E4K0008QG0R001J0536V
priority: P1
status: closed
title: "MEMORY.md marker-vs-index - harness contract verification and evidence"
created: 2026-05-08
last_updated: 2026-05-14
parent: 081KQ8P5D0008QG0R003KFRGJ0
depends_on: []
classification: buildable-now
decomposition: atomic
closed_by: feat/b0257-harness-contract-verification-2026-05-14
---

# 081KR2E4K0008QG0R001J0536V - MEMORY.md harness contract verification

Verify how the harness and Q1 AutoDream/AutoMemory actually
consume `memory/MEMORY.md` before any cutover.

## Pre-start checklist (2026-05-14)

**Prior-art search:**

- `docs/research/memory-md-harness-contract-2026-04-28.md` — comprehensive Phase 0 report written 2026-04-28 covering hard caps, format contract, AutoDream compat, Option A/B/C analysis. Found via `find docs/research -name "*memory*"`.
- `memory/reference_automemory_anthropic_feature.md` — AutoMemory feature reference with AutoDream cadence details.
- `memory/project_memory_format_standard.md` — MEMORY.md index entry format standard (§5, §6.4 heap-state model).
- `tools/memory/reindex-memory-md.ts` — 081KRCQQF0008QG0R0037YYP1A reindexer; encodes the harness format contract in code.
- `.claude/rules/claude-code-loading-taxonomy.md` — documents the first-200-lines/25KB cap empirically.

**Dependency check:** no `depends_on:` entries; parent 081KQ8P5D0008QG0R003KFRGJ0 is open; no blocking children.

**Implementation decision:** The research note existed but lacked the "reproducible verification procedure" AC. The smallest safe slice is to add that section (five steps with concrete commands) to the existing note and close the row. No changes to `memory/MEMORY.md`.

## Work scope

- Inspect harness behavior against short marker-only versus
  pre-rendered index content.
- Validate whether write-back behaviors assume specific
  formatting.
- Produce a research note documenting observed behavior,
  assumptions, and explicit constraints for later rows.

## Acceptance criteria

- A research note exists under `docs/research/` with a
  reproducible verification procedure.
- The note states whether marker-only is contract-safe.
- The note states compatibility constraints for Q1 AutoDream/
  AutoMemory.
- No changes to `memory/MEMORY.md` in this row.
