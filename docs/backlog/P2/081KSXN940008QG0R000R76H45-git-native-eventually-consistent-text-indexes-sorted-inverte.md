---
id: 081KSXN940008QG0R000R76H45
priority: P2
status: open
title: Git-native eventually-consistent text indexes (sorted/inverted/graph) + the git-native Hindsight storage interface
tier: memory-substrate
ask: Aaron 2026-05-31
created: 2026-05-31
last_updated: 2026-06-02
decomposition: umbrella
composes_with:
  - .claude/rules/dv2-data-split-discipline-activated.md
  - .claude/rules/substrate-or-it-didnt-happen.md
  - .claude/rules/additive-not-zero-sum.md
  - .claude/rules/honor-those-that-came-before.md
tags: [memory-substrate, git-native, indexes, eventually-consistent, materialized-view, dbsp, z-set, dv2.0, retrieval, knowledge-graph, hindsight, hermes, o-notation, text-based, spatial-index, h3, geohash, bloom-filter, temporal-index, time-travel, semantic-index, vector-index, hnsw, ann, aggregation-index, integrity-index]
type: feature
---

# 081KSXN940008QG0R000R76H45 — Git-native eventually-consistent text indexes + the git-native Hindsight storage interface

## The directive (Aaron 2026-05-31)

> *"i basically want our git native to have git native indexes that are kept up to date too and are
> just text based then we have good o notation lookups for all our native git stuff it's just
> eventually consistent indexes in git"*

Plus, from the same Hindsight thread:

> *"we will conribute back gitnative versoin of storage interface into hindsight eventually and maxes
> coackrachdb stuff works already cause it's a postgres interface in coackroach"*

## The bet

Give the **git-native substrate** (memory files, persona conversations, research docs, backlog,
the `[[name]]` cross-link graph) a **text-based, git-committed index layer** that delivers good
**O-notation lookups** (O(log n) / O(1) instead of O(n) grep), kept **eventually consistent** with
the source. The index is a **materialized view over git** — git stays the single source of truth
(retraction-native, replayable, diffable, "substrate or it didn't happen"); the index is derived.

This **is** the git-native Hindsight storage interface: text indexes in git provide entity + graph +
full-text lookups with **no Postgres required**, so Hindsight / CockroachDB (Max's Postgres-wire
interface) become *optional acceleration* over the same git source-of-truth, never a competing one.

## Proto-example already in-repo

`docs/BACKLOG.md`, regenerated from the `docs/backlog/**` rows by `tools/backlog/generate-index.ts`
(idempotent, `BACKLOG_WRITE_FORCE` regen-on-conflict), is exactly this pattern at one slice. This
row generalizes it into a first-class retrieval layer.

## Design (proposed; refine at start-gate)

**Index types** (each a git-committed text file):

- **sorted key index** — `<key> <tab> <location>` sorted; O(log n) by-key via byte-offset binary
  search (the `look(1)` / git `packed-refs` shape).
- **inverted index** — `<term> <tab> <files…>` for full-text.
- **graph adjacency index** — built from the `[[name]]` cross-links → adjacency list; the
  Hindsight-style knowledge graph, traversable as text.

Additional index types (added 2026-06-02; Lior-ferry index-structure question — each still a git-committed text file, materialized-view-over-git, regenerate-never-merge):

- **spatial index** — H3 (hexagonal) / S2 / geohash cell → records; `<cell> <tab> <records…>`, O(1) point→cell→jurisdiction lookup. Powers **081KT2T2J0008QG0R001GE4M6A** world-borders O(1) (the hexagonal H3 cell rhymes the hex core 081KT2T2J0008QG0R0026MS6PV) + 081KT2T2J0008QG0R002Z46D8Q orientation-tile. The "spatial reverse index."
- **bloom-filter index** — git-committed bit-array for fast **negative membership** ("definitely-not-here" in O(1), no log scan); composes the caustic-engineered-bloom-filter / `substrate-smoothness` substrate. The cheap pre-filter before a sorted/inverted lookup.
- **temporal / time-bucketed index** — `<time-bucket> <tab> <events…>` over the event log, for **time-travel queries** (the three-clocks / generator-time substrate); distinct from sorted-key (by-key) — this is by-time-range over the append-only log.
- **semantic / vector index** — approximate-nearest-neighbor (HNSW / LSH + product-quantization) over embeddings; the **veridicality-detector** retrieval substrate. Distinct from the *text-keyword* inverted index — this is *meaning* similarity. (Git-committed: the quantized vectors + the ANN graph as text/binary blobs.)
- **aggregation / materialized-metric index** — DBSP **incremental-view-maintenance** folds cached as git data: the `integrity_index` / say-do-gap metric (081KT2T2J0008QG0R002TVT60G/081KT2T2J0008QG0R0026XCGQM), the LGTM/Prometheus metric series + Rainbow-Table-after-storms recovery metrics (081KT2T2J0008QG0R0000H12VT). The metric *is* a materialized view over the event log; cache the fold, recompute incrementally (the Z-set delta nets in).

**Three disciplines that make it O-fast + conflict-safe:**

1. **Regenerate, never merge.** Derived indexes are reproducible from source → on a git conflict,
   rebuild (never hand-merge). This is what lets indexes live in git under multi-agent writes
   (BACKLOG.md already does this).
2. **Sorted + byte-offset = real O(log n)** (or a `hash→offset` file for O(1)). A flat text file is
   still O(n) grep — the *format* is the lookup complexity.
3. **Eventually-consistent ⇒ stamp + fallback.** Each index header carries the **source commit SHA**
   it was built from, so readers know freshness and fall back to grep on a miss during the lag
   window.

**Update mechanism (the "kept up to date" part):**

- **incremental** (Z-set delta on change — the elegant DBSP/differential-dataflow way; this is the
  factory's own engine pointed at its own memory), OR
- **full-rebuild-on-cadence** (simple; works today; text rebuild is cheap at current corpus size).
- Trigger: a harness-hook on memory-write, a razor-cadence-style cron, or CI-on-push (as
  generate-index.ts does for BACKLOG.md).

## Composition (fits the spine, doesn't fight it)

- **DBSP / Z-sets** — an index IS a materialized view; updates are Z-set deltas (the factory core).
- **DV2.0 + idempotency** (always-active disciplines) — indexes are change-rate-partitioned
  satellites; rebuild is idempotent.
- **retraction-native** — index entries retract with their source; the index is replayable.
- **substrate-or-it-didn't-happen** — indexes in git = durable substrate, not weather.
- **Hermes/Hindsight** — local Hindsight daemon bundles with the `hermes` CLI (081KSKBP80008QG0R002J03WGA Phase 2);
  the **shared cluster Hindsight** is a future ArgoCD service backed by Max's CockroachDB
  (Postgres wire); this row is the **git-native storage interface** to upstream into Hindsight so
  git remains source-of-truth.

## Acceptance (sketch — firm up at start-gate)

- [ ] One index type shipped end-to-end (start with the **sorted key index** over the memory corpus
      / `MEMORY.md`) with a TS reader that does byte-offset binary search + grep fallback on miss.
- [ ] Index file carries a source-commit-SHA stamp; reader reports staleness.
- [ ] Regenerate-not-merge wired (idempotent rebuild; conflict → rebuild, never hand-merge).
- [ ] Update trigger chosen (cadence-rebuild first; incremental Z-set delta as the follow-up).
- [ ] Graph adjacency index over the `[[name]]` links (the git-native Hindsight knowledge graph).
- [ ] Documented as the git-native Hindsight storage-interface contract (for eventual upstream).

## Notes

Surfaced during the 081KSKBP80008QG0R002J03WGA cross-OS install + Hermes/Hindsight thread (2026-05-31). Hermes ships a
local Hindsight memory daemon on first use; the shared cluster Hindsight is deferred to the k8s
cluster (ArgoCD service). This row captures the git-native index/storage-interface direction so it
isn't lost. Not blocking the install work.
