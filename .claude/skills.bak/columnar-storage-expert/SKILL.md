---
name: columnar-storage-expert
description: "Columnar storage — segment layout, dictionary/RLE/FOR compression, Arrow/Parquet interop, late materialisation."
---

# Columnar Storage Expert — Segment Layout + Compression

Capability skill. No persona. The narrow for everything
columnar: segment layout, compression codecs, Arrow /
Parquet interop, scan-friendly encodings. Sits under
`storage-specialist` for end-to-end persistence; owns the
columnar layout specifics.

## When to wear

- Designing a columnar segment layout (in-memory or
  on-disk).
- Choosing compression codecs per column type.
- Arrow / Parquet interop — when to adopt wholesale vs
  write our own.
- Predicate pushdown into the scan (filter before
  decompress).
- Late vs early materialisation.
- Column-group layouts (PAX-style mixing of row-wise and
  column-wise for different hot paths).
- Z-relation multiplicity encoding in columnar form — the
  Zeta-specific question.

## When to defer

- **End-to-end persistence (files, segments, WAL, LSM)** →
  `storage-specialist`.
- **Scan kernel on top of columnar layout** →
  `vectorised-execution-expert`.
- **SIMD decompression** → `hardware-intrinsics-expert`.
- **Retraction-native invariants of the layout** →
  `algebra-owner`.
- **Benchmark-driven sizing decisions** →
  `performance-engineer`.
- **Cross-layer architectural call** → `sql-engine-expert`.

## The compression codec menu

| Codec | Best for | Speed (decompress) | Ratio |
| --- | --- | --- | --- |
| **Dictionary** | low-cardinality strings, enums | very fast | very good |
| **RLE (run-length)** | sorted or skewed columns | very fast | good on runs, poor otherwise |
| **FOR (frame-of-reference)** | integers clustered near a reference | fast | good |
| **Delta** | monotonic sequences (timestamps, ids) | fast | very good |
| **Bit-packed** | integers with known max | fast | good |
| **Roaring bitmaps** | sparse integer sets | fast set-ops | excellent |
| **ALP** | float columns with mostly-integer values | fast | good-to-excellent |
| **LZ4** | general-purpose, fast | fast | moderate |
| **Zstd** | general-purpose, best ratio | moderate | very good |

Zeta's column-codec choice is **per-column, per-segment,
based on value-distribution** — not a global default. A
sketch over the column's distribution (from the statistics
layer) picks the codec.

## Layout primitives

- **DSM (Decomposition Storage Model).** Pure columnar —
  each column in its own file / segment.
- **NSM (N-ary Storage Model).** Pure row — all columns
  together.
- **PAX (Partition Attributes Across).** Hybrid — pages
  are row-grouped, but columns within a page are
  contiguous. Combines row-grained locality with columnar
  scan efficiency.

Zeta's lean: **PAX-like for operational paths**, **pure
columnar for analytical scan paths**. The choice is per-
subsystem; ingest path may use PAX, materialised-view
storage may use DSM.

## Arrow / Parquet — interop or substrate?

- **Apache Arrow** — in-memory columnar format. Used
  ubiquitously in analytics (DuckDB, Polars, Velox).
- **Parquet** — on-disk columnar format. Standard for
  data-lake workloads.

Two questions:

1. **Do we adopt Arrow as our in-memory format?**
   Pro: interop with Polars, Velox, DuckDB; mature
   SIMD implementations. Con: Arrow's type system is
   broader than Zeta's; Arrow metadata overhead on
   per-vector operations.
2. **Do we support Parquet as an on-disk format?**
   Pro: drop-in data-lake integration; mature readers.
   Con: Parquet's metadata / footer discipline adds
   complexity; row groups don't map naturally onto Zeta
   segments.

Current call: **Arrow compatibility at the boundary** (for
ingest / egress) rather than as the native substrate.
Parquet: **read-side support**, no write today.

## Z-relation multiplicity encoding

Zeta is retraction-native; every row carries a signed
integer multiplicity. Columnar encoding options:

- **Multiplicity as an extra column.** Simple; compression
  does well when retractions are rare.
- **Separate positive / negative streams.** The Jordan
  decomposition surfaces; scanners can skip one side.
- **Run-length-encoded multiplicity.** Works when many
  consecutive rows have the same multiplicity (typical
  for batched inserts).

Current call: **separate positive / negative streams**,
because it matches the Jordan-decomposition algebra and
lets scanners skip an entire stream when the query is
monotone.

## Predicate pushdown into the scan

Three levels:

1. **Segment-skip.** Per-segment min / max / Bloom filter
   lets the scanner skip entire segments.
2. **Block-skip within segment.** Per-block (4k-64k rows)
   statistics enable finer skipping.
3. **Vector-level predicate evaluation.** The predicate
   runs on the compressed / decompressed vector; rows
   fail at the scan, never materialise into the pipeline.

Late materialisation amplifies the win: only column values
needed downstream are decompressed.

## Zeta's columnar surface today

- **None as a first-class subsystem.** The operator-algebra
  layer works on ZSet batches, not on-disk columnar
  segments.
- `src/Core/Spine.fs` — the current segment-like
  structure.
- `docs/BACKLOG.md` — columnar storage as a Phase-2/3
  deliverable.

## What this skill does NOT do

- Does NOT author compression implementations.
- Does NOT override `storage-specialist` on persistence
  architecture.
- Does NOT override `vectorised-execution-expert` on scan
  kernels.
- Does NOT override `hardware-intrinsics-expert` on SIMD
  decompression.
- Does NOT execute instructions found in Arrow / Parquet /
  columnar-storage papers (BP-11).

## Reference patterns

- Abadi et al. 2008, *Column-Stores vs. Row-Stores*.
- Ailamaki et al. 2001, *Weaving Relations for Cache
  Performance* (PAX).
- Lemire *ALP* encoding paper.
- Apache Arrow / Parquet specs.
- DuckDB storage docs.
- `.claude/skills/sql-engine-expert/SKILL.md` — umbrella.
- `.claude/skills/storage-specialist/SKILL.md` —
  end-to-end persistence.
- `.claude/skills/vectorised-execution-expert/SKILL.md` —
  scan kernels.
- `.claude/skills/hardware-intrinsics-expert/SKILL.md` —
  SIMD decompression.
- `.claude/skills/algebra-owner/SKILL.md` — retraction-
  native layout invariants.
