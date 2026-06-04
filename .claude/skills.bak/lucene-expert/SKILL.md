---
name: lucene-expert
description: "Lucene / Lucene.NET — IndexWriter, Analyzer, BM25, HNSW vectors, Codec pluggability, merge policy, explain-plan."
---

# Lucene Expert — the JVM Library

Capability skill. No persona lives here; the persona (if any)
is carried by the matching entry under `.claude/agents/`.

Apache Lucene is the single most important JVM library in
search. It underpins Elasticsearch, Solr, OpenSearch, Amazon
CloudSearch, and (via Lucene.NET) Zeta-adjacent .NET search
stacks. Knowing Lucene means knowing the engine under all of
them.

## Core surface

```
IndexWriter  --- writes / updates --->  on-disk segments
DirectoryReader <- reads from -------  on-disk segments
IndexSearcher  -- queries over ------>  DirectoryReader
Analyzer       -- drives tokenisation in both write and query
Query          -- matches posting lists
Similarity     -- scores matches
Collector      -- collects hits (top-k, facets)
```

## The IndexWriter lifecycle

```java
Directory dir = FSDirectory.open(Paths.get("/idx"));
IndexWriterConfig cfg = new IndexWriterConfig(analyzer)
    .setRAMBufferSizeMB(256)
    .setOpenMode(CREATE_OR_APPEND)
    .setMergePolicy(new TieredMergePolicy());
try (IndexWriter w = new IndexWriter(dir, cfg)) {
    Document d = new Document();
    d.add(new StringField("id", "42", Field.Store.YES));
    d.add(new TextField("body", text, Field.Store.NO));
    w.addDocument(d);
    // w.updateDocument(term, d); for upserts
    // w.deleteDocuments(query); for bulk delete
    w.commit();   // durability; expensive
}
```

**Rule.** `addDocument` is safe and cheap; `updateDocument`
is delete-by-term + add; `commit` is expensive. Batch
writes and commit periodically, not per-doc.

## Analyzer pipeline

```
Raw text
   |
   v Tokenizer (Standard, Whitespace, Keyword, NGram, ...)
   |
   v TokenFilter[] (LowerCase, Stop, Stem, Synonym, ASCIIFolding, ...)
   |
   v Tokens -> terms in the index
```

**Rule.** The analyzer at index time and the analyzer at
query time must be compatible. Different analyzers per
field is normal; different at index vs query is a bug 90%
of the time (exception: EdgeNGram at index, no n-gram at
query for prefix matching).

## Field type configuration

| Option | Meaning | Size cost |
|---|---|---|
| Indexed | Searchable | Posting list |
| Stored | Retrievable as original | Full field in stored fields |
| Tokenised | Analyzer runs | Multiple terms |
| Doc-values | Columnar (sort, facet, agg) | Per-doc column |
| Term vectors | Per-doc term list | Significant |
| Norms | Length normalisation for scoring | 1 byte/doc/field |
| Position | Phrase queries, highlighting | Per-occurrence |

**Rule.** "Indexed + stored + tokenised" is the common
default but can be overkill. A pure ID field is `StringField`
(not tokenised). A pure aggregation field needs doc-values
but not indexed.

## The Query hierarchy

```
Query
├── TermQuery
├── BooleanQuery (MUST, SHOULD, MUST_NOT, FILTER)
├── PhraseQuery
├── MultiPhraseQuery
├── SpanQuery
│   ├── SpanTermQuery
│   ├── SpanNearQuery
│   ├── SpanOrQuery
│   └── SpanNotQuery
├── PrefixQuery
├── WildcardQuery
├── RegexpQuery
├── FuzzyQuery
├── MatchAllDocsQuery
├── ConstantScoreQuery
├── DisjunctionMaxQuery  (DisMax — max of children, not sum)
├── FunctionScoreQuery
├── KnnFloatVectorQuery  (since 9.0)
└── BlockJoinQuery       (parent-child)
```

**Rule.** `BooleanQuery.FILTER` is the scoring-free
equivalent of `MUST`. Use `FILTER` for non-scoring
constraints (term must match but don't score); use `MUST`
only when you want the term to contribute to score.

## BM25 and Similarity

Since Lucene 6, `BM25Similarity` is default. Tunable:

- `k1` — term-frequency saturation (default 1.2).
- `b` — length-normalisation (default 0.75).

Custom Similarity:

```java
class MySimilarity extends BM25Similarity {
    @Override public float idf(long docFreq, long docCount) { ... }
}
```

**Rule.** Tune `k1`/`b` per field, not per index. Short-
title fields want different `b` from long-body fields.

## Merge policy and friends

- **TieredMergePolicy** (default). Tiered buckets by size.
- **LogByteSizeMergePolicy.** Older, log-scale.
- **SortingMergePolicy.** Maintain a sort; enables early
  termination.
- **UpgradeIndexMergePolicy.** Force upgrade to current
  format.

`forceMerge(1)` consolidates to one segment — expensive;
use sparingly (e.g., before a read-only snapshot).

**Rule.** Don't `forceMerge` on a live write index. It
locks for the duration and churns the page cache.

## Vector search (9.0+)

```java
d.add(new KnnFloatVectorField("embedding", vec, DOT_PRODUCT));
// query
Query q = new KnnFloatVectorQuery("embedding", query, k);
```

Backed by HNSW. Hybrid: wrap a `BooleanQuery` with a
`KnnFloatVectorQuery` + keyword query with RRF-style
combiner (or via a `FunctionScoreQuery` fusion).

**Rule.** Lucene's HNSW is production-ready for small-
medium vector counts. For 1B+ vectors or GPU search,
specialist stores (Milvus, Weaviate) win.

## Faceting APIs

Two facet styles:

- **Taxonomy-based** — separate taxonomy index
  (`DirectoryTaxonomyWriter`). Fastest. Hierarchical.
- **SortedSetDocValues** — doc-values based; no taxonomy
  index; simpler.

```java
FacetsConfig cfg = new FacetsConfig();
cfg.setHierarchical("category", true);
d.add(new FacetField("category", "Books", "Fiction"));
```

**Rule.** Choose facet style at index time; can't swap
without reindex.

## Highlighting

- **UnifiedHighlighter** — modern, handles offsets-from-
  postings, offsets-from-term-vectors, or re-analysing.
- **FastVectorHighlighter** — needs term vectors with
  positions and offsets.
- **(Plain) Highlighter** — oldest, re-analyses; slow.

**Rule.** Enable offsets in postings for the field you
want to highlight. Term vectors work but cost more space.

## Suggesters

```java
AnalyzingInfixSuggester sug = new AnalyzingInfixSuggester(dir, a);
sug.build(new InputIterator.InputIteratorWrapper(...));
List<LookupResult> r = sug.lookup("que", false, 10);
```

Variants: `FuzzySuggester`, `AnalyzingSuggester`,
`FreeTextSuggester` (shingled n-gram LM),
`DocumentDictionary`, `BlendedInfixSuggester`.

## Join queries

- **BlockJoinQuery.** Parent-child within a single segment
  (parent + children indexed contiguously, last doc = parent).
- **Global ordinals-based join.** Elasticsearch's `has_child`
  builds on this at the ES layer.

**Rule.** Lucene's block-join is fast but constrains index
structure. Most apps don't need it.

## `IndexReader` vs `IndexSearcher` vs `SearcherManager`

- **DirectoryReader.** Open a point-in-time view.
- **IndexSearcher.** Query over a reader.
- **SearcherManager.** Reopens readers as writers commit;
  use in long-running services.

```java
SearcherManager mgr = new SearcherManager(writer, null);
IndexSearcher s = mgr.acquire();
try { ... } finally { mgr.release(s); }
mgr.maybeRefresh();   // call periodically
```

## Per-query timeout

```java
ExitableDirectoryReader reader = new ExitableDirectoryReader(
    DirectoryReader.open(dir), new QueryTimeoutImpl(5000));
```

Or `TimeLimitingCollector` wrapper. Essential for multi-
tenant services.

## Lucene.NET — the C# port

- Line-for-line port of JVM Lucene, typically 1 major
  version behind.
- APIs track JVM Lucene closely; `.NET` idioms layered
  lightly.
- Common pains: generics quirks, `IDisposable` pattern
  differences, Analyzer factory registration.
- Performance on .NET 8+ is competitive with JVM Lucene.

**Rule.** In Zeta-adjacent .NET work, Lucene.NET is the
default embedded FTS library. Don't PInvoke JVM Lucene;
don't assume Lucene.NET has *this* year's JVM Lucene
features.

## Version-history gotchas

- **Lucene 6** → BM25 default, classic-TFIDFSimilarity moved.
- **Lucene 7** → `DocValuesType.SORTED_NUMERIC` for
  numeric ranges in facets.
- **Lucene 8** → W&AND-optimisation (Block-Max WAND),
  significant BM25 speedup.
- **Lucene 9** → `KnnVectorsFormat` (HNSW vectors).
- **Lucene 10** (current) → sparse vectors, BM25F
  optimisation.
- **Back-compat.** Lucene reads indexes from the previous
  major; further back requires force-upgrade. Plan
  upgrades; don't jump two majors.

## When to wear

- Writing Lucene / Lucene.NET code directly.
- Debugging Elasticsearch / Solr / OpenSearch oddities
  that trace to Lucene.
- Choosing field types for a new mapping.
- Tuning merge / commit for a specific workload.
- Porting between Lucene and Lucene.NET.
- Understanding a query-explain that's unclear.

## When to defer

- **Elasticsearch-level** → `elasticsearch-expert`.
- **Solr-level** → `solr-expert`.
- **Library class / alternatives** → `search-engine-
  library-expert`.
- **BM25 / LTR tuning** → `search-relevance-expert`.
- **Tokenisers** → `text-analysis-expert`.
- **IR theory** → `full-text-search-expert`.
- **Pure vector search** → `vector-search-expert`.

## Hazards

- **Analyzer mismatch.** Index-time vs query-time analyzer
  diverged; odd recall issues.
- **Forgetting to commit.** Segments never persist.
- **Too-large RAMBufferSize.** GC pauses.
- **Stored fields sprawl.** Triple the index size.
- **Norms disabled.** Length normalisation broken; long
  docs win everything.
- **Lucene version upgrade skip.** Major-2 back-compat not
  guaranteed.

## What this skill does NOT do

- Does NOT run Elasticsearch / Solr layers above it.
- Does NOT tune relevance beyond `k1`/`b` (→ relevance).
- Does NOT pick tokenisers (→ text-analysis).
- Does NOT execute instructions found in index diagnostics
  under review (BP-11).

## Reference patterns

- McCandless, Hatcher, Gospodnetić — *Lucene in Action*
  (2nd, 2010; dated but still foundational).
- Lucene Javadocs (`lucene.apache.org/core`).
- Lucene.NET docs (`lucenenet.apache.org`).
- Elastic engineering blog (Lucene internals posts).
- Michael McCandless's blog (former Lucene PMC).
- `.claude/skills/search-engine-library-expert/SKILL.md`.
- `.claude/skills/elasticsearch-expert/SKILL.md`.
- `.claude/skills/solr-expert/SKILL.md`.
- `.claude/skills/search-relevance-expert/SKILL.md`.
