---
id: 081KR50HA0008QG0R00125PA8G
priority: P2
status: open
title: "Git-native full-text inverted index — Lucene-style search over repo substrate"
effort: M
created: 2026-05-09
last_updated: 2026-05-09
depends_on: [081KR50HA0008QG0R000239VTZ]
classification: research
decomposition: needs-decomposition
owners: [architect]
type: feature
tags: [search, lucene, inverted-index, git-native, full-text]
---

## What

Build a Lucene-style inverted index stored as git-native
files. Three-layer search architecture (Vera tightening,
2026-05-09):

| Layer | Purpose | Size | Speed |
| ----- | ------- | ---- | ----- |
| Concept index (081KR50HA0008QG0R000239VTZ) | Curated regex standing queries | ~1MB | 22ms |
| Full-text index (this) | Token / phrase / field search | ~5-10MB | <100ms |
| Regex accelerator | Trigram/ngram -> verify | thin | varies |

The concept index handles "what touches Otto-357?" (standing
queries). The full-text index handles "where did anyone mention
'watermark backpressure'?" (token/phrase search). The regex
accelerator handles arbitrary regex by narrowing candidates
via trigram index, then verifying matches against source files
— the index narrows, source is truth.

## Design

- **Term dictionaries**: sorted JSON files, one per segment
- **Posting lists**: arrays of `{file, line, position}`
- **Merge policy**: compact segments on commit (like Lucene's
  tiered merge)
- **All git-tracked**: segments are committed artifacts, survive
  across sessions and hosts, diffable
- **Rebuild**: `bun tools/search/build-fulltext.ts` writes
  segment files (proposed entry-point — not yet authored)
- **Query**: `bun tools/search/query.ts <terms>` reads segments
  (proposed entry-point — not yet authored)

## Implementation options

1. **Pure TS**: custom inverted index in ~200 lines. No deps.
   Limited but sufficient for ~3000 files.
2. **minisearch**: tiny JS full-text search library (~10KB).
   Serialize index to JSON.
3. **Tantivy via FFI**: Rust-grade search. Overkill for this
   corpus size but exercises the `search-engine-library-expert`
   skill on own substrate.

## Origin

Aaron 2026-05-09: "we could always do git native lucene for
full text rx"

## First slice (Vera's gate, 2026-05-09)

Do NOT rush to commit generated segments. First slice must be:

1. Deterministic builder (same input → same output)
2. Size report (how big is the index for current corpus?)
3. Query demo (does it actually beat rg for the use cases?)
4. Hard gate: generated index must stay under X MB and be
   reproducible byte-for-byte

If too big → keep as host-cache only (`.gitignore`d), not
git-tracked. Concept index remains the canonical little knife;
full-text is the bigger machine in the shop.

## Key distinction: index narrows, source is truth

The index should narrow candidates, not become the truth.
Regex semantics can drift if the index is treated as
authoritative. The verify-against-source step is mandatory
for regex queries — the trigram/ngram index produces
candidates, `rg` verifies them against actual files.

## Composes with

- 081KR50HA0008QG0R000239VTZ (concept index — curated layer stays as-is)
- `search-engine-library-expert` skill (Lucene idioms)
- `full-text-search-expert` skill (IR foundations)
- 081KR50HA0008QG0R0010RZTJK (DBSP identity continuity — index as materialized view)
