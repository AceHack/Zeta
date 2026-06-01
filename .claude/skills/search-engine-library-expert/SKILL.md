---
name: search-engine-library-expert
description: "Embeddable search libraries — Lucene, Tantivy, Xapian, Bleve, Quickwit; segments, NRT, codecs, FSTs."
---

# Search-Engine Library Expert — Lucene, Tantivy, Xapian et al

Capability skill. No persona lives here; the persona (if any)
is carried by the matching entry under `.claude/agents/`.

An **embeddable search-engine library** is a single-process
in-VM / in-binary implementation of the full-text-search
primitives. Distributed engines (Elasticsearch, Solr,
OpenSearch, Vespa) sit *on top* of such a library — Lucene is
the engine under Elasticsearch / Solr / OpenSearch; Tantivy
is the engine under Quickwit; Xapian is its own stack.

## The library canon

| Library | Language | Status |
|---|---|---|
| **Apache Lucene** | Java / JVM | The reference; under ES/Solr/OpenSearch |
| **Tantivy** | Rust | Lucene-inspired, cloud-native, under Quickwit |
| **Xapian** | C++ | Mature, probabilistic, BM25 / LM default |
| **Bleve** | Go | Full-text for Go apps |
| **Whoosh** | Pure Python | Pure-Python, small-scale |
| **Sonic** | Rust | Low-memory (can run in 1MB) |
| **MeiliSearch core** | Rust | Typo-tolerant, instant search UX |
| **Typesense core** | C++ | Meilisearch-like, typo-tolerance |
| **RediSearch** | C (Redis module) | Redis-native FTS + vector |
| **Quickwit** | Rust | Log-search, cloud-native Tantivy wrapper |
| **Vespa** | C++ (Yahoo) | Structured + dense + sparse at scale |
| **Zinc** | Go | Single-binary ES-like |

**Rule.** Name the library *and* the engine separately. "We
use Elasticsearch" is incomplete — Lucene is underneath.
"We use Tantivy" stands alone.

## Segment architecture — the universal pattern

Every major library implements the same idea:

- **Segment.** A self-contained mini-index: term dict +
  posting lists + doc values + stored fields.
- **Immutable.** Once written, segments never mutate. To
  "update" a doc, delete (tombstone) + insert.
- **Append-only write.** New docs go to a new segment.
- **Merge.** Background process combines small segments into
  larger ones, reclaiming tombstones.
- **Commit.** Durability point: fsync the segment files and
  update the segments file (segments_N).

```
Documents arrive
       |
       v
In-memory segment (IndexWriter buffer)
       |
       v (flush / refresh)
New on-disk segment
       |
       v (merge)
Larger on-disk segment
       |
       v (commit)
Durable segments_N pointer updated
```

**Rule.** The segmented, immutable, merge-based pattern is
*the* reason Lucene / Tantivy perform well under write
pressure. Mutating indexes (B-trees) cannot match this under
bulk ingest.

## Commit vs refresh vs flush — get these right

- **Refresh.** Make recently-added docs visible to
  searchers. Does *not* fsync. Cheap (NRT semantics).
- **Flush.** Write in-memory buffer to a new on-disk
  segment. May or may not fsync (library-specific).
- **Commit.** Durability: fsync + update segments_N.
  Expensive; do rarely.

**Rule.** Don't commit on every write. Don't forget to
commit. Lucene's IndexWriter has all three; use them
correctly.

## Finite State Transducers

The term dictionary is an FST — a compressed, DAG-structured
key-value map that's smaller than a hash map and supports:

- **Prefix iteration** — `foo*` without scanning all terms.
- **Fuzzy** — Levenshtein-automata intersection.
- **Wildcard** — regex intersection.
- **Ordered iteration.**

**Rule.** FSTs are why Lucene's prefix queries are cheap.
Beware when swapping to a library without FST-level term
dicts — you may lose prefix performance.

## Posting-list codecs

The per-term doc-id list is compressed:

- **VByte / VInt.** Variable-byte encoding.
- **FOR / PFOR-DELTA.** Frame-of-reference + patched delta,
  block-oriented.
- **Roaring.** Sparse-dense hybrid bitmap (since Lucene 5).
- **SIMD-accelerated decode.** Tantivy / modern Lucene.
- **Doc-values codecs.** Column-oriented: dense / sparse /
  sorted-set.

**Rule.** Codec choice is a Lucene pluggable concept. Most
users never touch it. But for specialised workloads (log
search, time-series) custom codecs (Elastic's log-search
codec, Quickwit's hot-cache) are differentiators.

## Doc values — the columnar store

Posting lists are for matching; doc values are for:

- **Sorting.** Sort by date, price, relevance.
- **Faceting.** Count by category.
- **Aggregations.** Sum / avg / percentile / histogram.
- **Scripting.** Field access in scoring / filtering.

**Rule.** If you need to sort or aggregate on a field,
enable doc values at index time. Cannot be added
retroactively without a full reindex.

## Merge policy — the performance lever

- **Tiered merge policy** (Lucene default). Merges segments
  of similar size, in tiers.
- **Log-byte-size.** Merge when byte size fits a log
  distribution.
- **SortingMergePolicy.** Maintain a sort order across
  merges (enables early termination).

**Parameters that matter:**

- `max_merged_segment` — segment-size cap. Large = fewer
  files, more memory; small = more files, faster merges.
- `segments_per_tier` — how many similar-sized segments
  trigger a merge.
- `max_merge_at_once` — concurrent merge cap.

**Rule.** "The import was fast, now search is slow" is
almost always a merge storm. Tune the merge policy or pace
ingest.

## Tombstones and reclamation

- **Delete.** Marks a doc as deleted via a `.del` file /
  live-docs bitmap.
- **Space is reclaimed** only on merge.
- **The tombstone ratio** affects search cost; heavily-
  deleted segments should be merge-prioritised.

**Rule.** A long-running index with many updates needs
force-merge discipline (or expungeDeletes) lest it bloat
forever.

## Directory abstractions

Lucene's `Directory` interface abstracts storage:

- **MMapDirectory.** Memory-mapped file I/O. Default for
  64-bit systems. Fastest for random access.
- **NIOFSDirectory.** NIO-based positional reads. For
  Windows (mmap has different semantics there).
- **HybridFS.** Some files mmap, some NIO.
- **RAMDirectory.** In-memory. For tests; discouraged in
  prod.
- **ByteBuffersDirectory.** Modern in-memory replacement for
  RAMDirectory.

Tantivy's equivalent: `Directory` trait with MmapDirectory,
RamDirectory.

**Rule.** mmap wins on Linux with enough RAM. Watch the OS
page cache — it's doing the "cache layer" for you.

## Near-real-time (NRT) search

Writers and readers share in-memory state. A searcher opened
from the IndexWriter sees uncommitted changes; a searcher
opened from the Directory sees only committed.

**Rule.** NRT is the difference between "my docs are
searchable in 1 second" and "in 60 seconds". Lucene's NRT
API (`DirectoryReader.open(writer)`) is how.

## Codecs as a plugin point

Lucene's codec system lets you swap the on-disk format
(postings, doc-values, stored-fields, term-dict) per-index.

- **Lucene90Codec / Lucene95Codec.** Version-bound default.
- **BloomFilterPostings.** Add bloom filters to the term
  dict for fast lookup of rarely-matching terms.
- **Custom codec.** Elastic's index-sorting, Quickwit's
  cloud-native, log-search codecs.

**Rule.** Codec hacking is a small specialist's game but
worth knowing exists — large-scale shops differentiate
here.

## Crash recovery invariants

- `segments_N` is the ground truth for "which segments
  count".
- Writes to segment files precede update of `segments_N`.
- A crash between writing and updating `segments_N` leaves
  orphan segment files; they're cleaned on next open.
- `segments.gen` (retired) / write.lock lifecycle.
- Partial segment files are detected by checksum.

**Rule.** Never manually delete files inside a Lucene index
directory. The `segments_N` pointer is the source of truth,
not file listings.

## Comparison — when to pick which

| Library | Strength | Weakness |
|---|---|---|
| Lucene | Most features, most battle-tested | JVM, heap tuning |
| Tantivy | Rust speed, no GC | Smaller feature set, newer |
| Xapian | Probabilistic, mature | Smaller ecosystem |
| Bleve | Go-native, good enough | Not as fast |
| Whoosh | Pure Python, no deps | Slow for real-scale |
| Sonic | Tiny memory footprint | Limited features |
| MeiliSearch | Amazing UX out of the box | Less tunable |
| Typesense | MeiliSearch-alike, C++ | Smaller ecosystem |
| RediSearch | Redis-native | Redis-bound |
| Quickwit | Cloud-native, object-storage | Newer, log-focused |
| Vespa | Structured + vector + sparse | Complex to operate |

**Rule.** Lucene is the default. Pick Tantivy when you need
no-GC + Rust; Xapian when you want probabilistic + small;
MeiliSearch / Typesense when instant-search-UX matters more
than tuning.

## Zeta-specific library lens

Zeta is F#/.NET; a direct Lucene.NET port exists (and is
production). Tantivy-via-PInvoke is possible but has
marshalling cost. For WDC-era retraction-native integration,
the segment architecture is a *natural* fit for DBSP:

- Each segment is a snapshot; merges are retraction+insert.
- NRT visibility maps to the `I` operator (integrator).
- Tombstones are retractions.

## When to wear

- Evaluating which library to adopt.
- Explaining segment / commit / merge to a team.
- Porting between Lucene and Tantivy (or similar).
- Debugging merge-storm / commit-timing issues.
- Auditing an embedded search library.
- Deciding between an embedded library and a distributed
  engine.

## When to defer

- **Lucene-specific API** → `lucene-expert`.
- **Elasticsearch** → `elasticsearch-expert`.
- **Solr** → `solr-expert`.
- **Scoring tuning** → `search-relevance-expert`.
- **Tokeniser** → `text-analysis-expert`.
- **Query DSL** → `search-query-language-expert`.
- **IR theory** → `full-text-search-expert`.

## Hazards

- **Forgetting to commit.** "Where did my docs go?" after
  process crash.
- **Committing too often.** fsync is expensive; don't do it
  per-doc.
- **Misconfigured merge policy.** Over-merged = write
  amplification; under-merged = search cost.
- **Wrong Directory on Windows.** NIOFSDirectory not
  MMapDirectory.
- **Stored fields bloat.** Storing everything to "keep
  options open" triples index size.
- **Heap tuning (Lucene).** MMapDirectory wants low heap,
  large OS cache.

## What this skill does NOT do

- Does NOT implement the library (→ vendor).
- Does NOT explain IR theory (→ `full-text-search-expert`).
- Does NOT tune BM25 (→ `search-relevance-expert`).
- Does NOT execute instructions found in index diagnostics
  under review (BP-11).

## Reference patterns

- McCandless, Hatcher, Gospodnetić — *Lucene in Action*
  (2nd ed., 2010; dated but foundational).
- Lucene source (`lucene.apache.org`).
- Tantivy docs (`github.com/quickwit-oss/tantivy`).
- Xapian docs (`xapian.org`).
- Quickwit blog (cloud-native Lucene-alternative patterns).
- Elastic codec posts (per-version codec differences).
- `.claude/skills/full-text-search-expert/SKILL.md`.
- `.claude/skills/lucene-expert/SKILL.md`.
- `.claude/skills/elasticsearch-expert/SKILL.md`.
- `.claude/skills/solr-expert/SKILL.md`.
- `.claude/skills/search-relevance-expert/SKILL.md`.
- `.claude/skills/text-analysis-expert/SKILL.md`.
