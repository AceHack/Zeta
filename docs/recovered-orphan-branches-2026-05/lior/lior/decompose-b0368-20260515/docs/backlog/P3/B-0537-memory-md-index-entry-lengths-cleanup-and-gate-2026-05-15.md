---
id: B-0537
priority: P3
status: open
title: "memory/MEMORY.md index-entry length cleanup (100 long entries) + CI gate"
tier: factory-infrastructure
effort: M
created: 2026-05-15
last_updated: 2026-05-15
depends_on: []
composes_with: [B-0535, B-0536]
tags: [memory, index, hygiene, mechanization]
type: feature
---

# memory/MEMORY.md index-entry length cleanup + CI gate

## Origin

Per the auto-memory system prompt convention ("Keep index entries to one line, under ~150 chars; move detail into topic files"), `memory/MEMORY.md` index entries should be ≤150 chars. This is also stated in `memory/project_memory_format_standard.md` ("One line per entry, under 150 chars"). The existing audit `tools/hygiene/audit-memory-index-entry-lengths.ts` flags violations as detect-only (defaulting to 200 chars; Slice B wires it with `--max 150`).

**Empirical baseline 2026-05-15 (tick 2031Z)**: scanner reports **100 long entries** in `memory/MEMORY.md` (110 total lines), with lengths ranging 150–759 chars. Audit exits 0 (detect-only); no CI gate.

This is the same pattern as B-0535 (duplicate-ID detection logic existed but wasn't gated) — the detection tool predates the CI wiring.

## Two-slice plan

### Slice A — cleanup (100 entries → 0)

Tighten each long entry to ≤150 chars while preserving:

- Topic-file pointer (`[Title](feedback_x_y_z.md)`)
- Date / round / PR anchor
- Single-sentence hook explaining WHY future-Otto should read the linked file

Detail content moves INTO the linked topic file (the index is supposed to be a one-line table-of-contents pointer, not a summary of the file content).

100 entries × ~30 sec per careful edit ≈ ~50 minutes of focused content-judgment work. Could be split into per-section batches (Aaron entries / B-NNNN entries / methodology entries / etc.) or per-tick mini-batches.

### Slice B — CI gate wiring

Use the existing `--enforce` flag in `audit-memory-index-entry-lengths.ts` (exits code 2 on violations). Wire into `.github/workflows/gate.yml` as `lint-memory-index-entry-lengths` job with `--enforce --max 150` to match the canonical 150-char standard. Same pattern as B-0535's lint-backlog-id-uniqueness.

Sequence: Slice A first (clean baseline) → Slice B (enforce). Trying to gate-first would block every PR touching MEMORY.md.

## Out of scope

- User-scope MEMORY.md (`~/.claude/projects/<slug>/memory/MEMORY.md`) — different file, separate audit scope
- Per-topic-file content quality — only the index-entry length is in this row's scope

## Composes with

- [B-0535](B-0535-backlog-id-uniqueness-lint-extension-of-b0532-2026-05-15.md) — same catch-once-then-lint pattern (detection exists, wiring missing)
- [B-0536](B-0536-orphan-ferry-ref-cleanup-and-audit-false-positives-2026-05-15.md) — same substrate-honest residual pattern from today's audit-driven session
- `tools/hygiene/audit-memory-index-entry-lengths.ts` — the detection tool
- auto-memory system prompt convention + `memory/project_memory_format_standard.md` — "Keep index entries to one line, under ~150 chars"
