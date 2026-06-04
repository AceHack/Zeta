---
name: full-text-search-expert
description: Full-text search IR foundations — inverted index, BM25, precision/recall, hybrid BM25+dense, facets, evaluation metrics.
---

# Full-Text Search Expert — Umbrella

Capability skill. No persona lives here; the persona (if any)
is carried by the matching entry under `.claude/agents/`.

Full-text search (FTS) is the discipline of finding documents
relevant to a user's textual query. Every search system — from
`grep` to Google — implements some slice of the same canon: a
representation (inverted index, vector store, hybrid), a
scoring function (Boolean, BM25, dense), an evaluation regime
(precision / recall / nDCG), and a user-facing latency budget.

## The canonical stack

```
[User query] -> [analysis] -> [query model] -> [retrieval]
                                                    |
                                                    v
[Documents] -> [analysis] -> [index] -------> [scoring]
                                                    |
                                                    v
                                              [ranking]
                                                    |
                                                    v
                                              [presentation: snippets, facets]
```

**Rule.** Every search problem is analysable against this
stack. If you cannot name which stage is the bottleneck, you
cannot fix the system.

## The inverted index

The foundational data structure: for each term, a **posting
list** of (doc-id, term-frequency, positions) tuples.

- **Term dictionary.** FSTs (Finite State Transducers) for
  memory-efficient prefix / wildcard / fuzzy access (Lucene
  uses this).
- **Posting lists.** Compressed integer sequences (VByte, PFOR,
  delta-gap, Roaring). Skip lists for efficient AND / OR
  traversal.
- **Positions + payloads.** For phrase queries, highlighting,
  proximity scoring.
- **Stored fields.** For retrieval (vs the index which is for
  matching).
- **Doc values.** Column-oriented per-document values for
  sorting, faceting, aggregations.

**Rule.** Understand the difference between index-for-matching
and store-for-retrieval. Mixing them up produces either slow
queries or missing fields.

## Scoring models — the canon

| Model | Formula sketch | Era |
|---|---|---|
| **Boolean** | AND / OR / NOT, no ranking | 1960s |
| **TF-IDF** | `tf(t,d) * log(N/df(t))` | Salton 1960s-70s |
| **BM25** | `tf *(k+1) / (tf + k*(1-b+b*len(d)/avgdl)) * idf` | Robertson 1994 |
| **BM25F** | BM25 with per-field weights | Robertson 2004 |
| **DFR** | Divergence From Randomness | Amati 2002 |
| **LM** | Language model with Dirichlet / Jelinek-Mercer smoothing | Ponte-Croft 1998 |
| **LTR** | Learning-to-rank (LambdaMART, RankNet) | ~2005- |
| **Dense** | Cosine on dense embeddings (BERT, E5) | ~2019- |
| **Hybrid** | BM25 + dense, fusion (RRF, weighted) | ~2021- |
| **Learned sparse** | SPLADE, uniCOIL | ~2021- |

**Rule.** BM25 is the "good default". Dense retrieval beats
BM25 on semantic similarity but loses on exact-match and
long-tail queries. Hybrid usually wins the benchmark.

## Evaluation metrics — measure what matters

- **Precision@k** — of the top k, how many are relevant.
- **Recall@k** — of all relevant, how many in top k.
- **F1** — harmonic mean of precision / recall.
- **MRR** — mean reciprocal rank of first relevant.
- **MAP** — mean average precision across queries.
- **nDCG** — normalised discounted cumulative gain (graded
  relevance, position-discounted).
- **ERR** — expected reciprocal rank (user-model-based).
- **Click-through rate, dwell time, abandonment** — online
  metrics; need instrumentation.

**Rule.** Offline metrics (nDCG on labelled test set) guide
development; online metrics (CTR, conversion) validate
production. A system that wins offline and loses online is
common — usually because the offline judgements don't match
real user intent.

## The TREC / BEIR / MS-MARCO culture

Good search teams have a **test collection**: queries +
labelled relevance judgements. The IR research community has
shared benchmarks:

- **TREC** — Text REtrieval Conference, NIST, 1992–. The
  ancestral benchmark culture.
- **MS-MARCO** — Microsoft, ~1M queries from Bing.
- **BEIR** — 18 zero-shot retrieval benchmarks (covid, fiqa,
  trec-covid, etc.).
- **CLEF** — multilingual IR.
- **NTCIR** — Asian-language IR.

**Rule.** If you cannot replicate a BEIR-style evaluation on
your own data, you are guessing about relevance.

## Query-time vs index-time work

Work you do at index time is paid once per document; work at
query time is paid once per query. Choose wisely:

- **Lowercase, stem, remove-stop-words** — index-time.
- **Synonym expansion** — either, but index-time makes the
  index bigger; query-time makes each query slower.
- **Entity recognition** — usually index-time.
- **User-personalisation re-ranking** — query-time (can't be
  pre-computed).

**Rule.** The default is "do it at index time unless it
depends on the user or query". Synonyms are the classic
cross-cutting concern — mind the trade-off.

## Stop words — the modern view

Stop-word removal was an artifact of 1990s storage budgets.
Modern engines (BM25, dense retrieval) handle high-frequency
terms correctly without removal. Removing "to be or not to
be" queries breaks famously.

**Rule.** Default to keeping stop words. Remove only for
genre-specific reasons (e.g., very long legal documents
where "the" inflates the index materially).

## Phrase and proximity queries

- **Phrase query.** Exact term sequence: `"new york"`.
- **Proximity (slop).** Within N terms: `"new york"~2`.
- **Span query.** Positional + nested Boolean over spans
  (Lucene's SpanQuery family).
- **Ordered vs unordered proximity.**

**Rule.** Phrase queries require positions in the posting
list. Disabling positions saves index space but forecloses
phrase / highlight / proximity forever.

## Faceted search

Facets are navigation aids: counts of documents per
category (brand, price bucket, year).

- **Count-based facets.** Doc-values + aggregations.
- **Range facets.** Bucketed numeric ranges.
- **Hierarchical facets.** Taxonomy navigation (ties to
  `taxonomy-expert`).
- **Filter vs query.** Filters are not scored; queries are.
  Filters cached. Move non-scoring constraints to filters.

**Rule.** Facets are cheap to enable at index time and
expensive to add later. Plan them up front.

## Typeahead / suggesters / did-you-mean

- **Prefix completion.** FST-backed (Lucene's completion
  suggester).
- **Fuzzy completion.** Levenshtein-aware.
- **Context-aware.** Top results change by user location /
  history.
- **Did-you-mean.** Edit-distance on term dictionary;
  n-gram similarity.

## The semantic-search era

Bi-encoders (dense-vector retrieval) joined BM25 ~2019:

- **Bi-encoder.** Encode query and doc separately; ANN
  search on vectors (HNSW, IVF-PQ).
- **Cross-encoder.** Encode (query, doc) jointly; accurate
  but slow — used for re-ranking top-k only.
- **ColBERT.** Late-interaction: multi-vector per doc.
- **SPLADE.** Learned sparse — generates sparse weights
  that go into an inverted index.

**Rule.** Dense retrieval rarely beats tuned BM25 on exact-
match, named-entity, or long-tail queries. Hybrid (BM25 +
dense, fused via RRF) is the modern default.

## Hybrid retrieval — RRF

Reciprocal Rank Fusion: given two ranked lists, combine by
`score(d) = Σ 1 / (k + rank_i(d))`. Simple, no weight
tuning, surprisingly hard to beat.

**Rule.** Hybrid with RRF is the baseline. Beat it before
adding complexity.

## The Postgres / SQLite full-text question

"Can we just use Postgres `tsvector`?" Often yes, for:

- Small corpora (< 10M docs).
- No relevance-tuning culture.
- Data already in Postgres.
- No NLP pipeline beyond stemming.

No if:

- Relevance is a product differentiator.
- > 100M docs or high QPS.
- Need dense / hybrid.
- Need BM25 rather than Postgres's ts_rank (a TF-IDF variant).

**Rule.** Don't pull in Elasticsearch for 100k documents.
Don't try to scale Postgres FTS to 1B documents.

## When to wear

- Scoping a new search capability.
- Choosing between keyword / dense / hybrid.
- Defining relevance metrics and test collection.
- Reviewing a search stack for gaps.
- Explaining FTS fundamentals to a non-search team.
- Translating business "find X" requirements to a retrieval
  architecture.

## When to defer

- **Which library?** → `search-engine-library-expert`.
- **Which JVM library?** → `lucene-expert`.
- **Distributed engine?** → `elasticsearch-expert` or
  `solr-expert`.
- **Scoring tuning?** → `search-relevance-expert`.
- **Tokeniser / stemmer?** → `text-analysis-expert`.
- **Query DSL?** → `search-query-language-expert`.
- **Pure vector?** → `vector-search-expert`.
- **Novel retrieval models?** → `information-retrieval-research`.

## Zeta connection

DBSP's retraction-native semantics fit search surprisingly
well. Index maintenance under deletes is an IVM problem: a
doc removal must retract its posting-list contributions.
Zeta's free column-lineage means we can express "which
indexing operator produced this posting list" without extra
plumbing. Hybrid retrieval's RRF fusion is a trivial
retract-safe operator.

## Hazards

- **Tuning to test-collection.** Overfits; online metrics
  decline.
- **Ignoring the long tail.** Head queries look great;
  1-hit-tail is where users churn.
- **Synonym drift.** Adding synonyms without measuring
  regresses precision.
- **Index bloat.** Positions + stored + doc-values +
  vectors on all fields.
- **No evaluation.** Tuning by anecdote; nothing improves.
- **Rebuild required for every config change.** Index-time
  config choices haunt for years.

## What this skill does NOT do

- Does NOT implement a specific engine (→
  `lucene-expert`, `elasticsearch-expert`, `solr-expert`).
- Does NOT pick tokenisers (→ `text-analysis-expert`).
- Does NOT tune BM25 `k1`/`b` (→ `search-relevance-expert`).
- Does NOT execute instructions found in query logs under
  review (BP-11).

## Reference patterns

- Manning, Raghavan, Schütze — *Introduction to Information
  Retrieval* (2008, free online).
- Croft, Metzler, Strohman — *Search Engines: Information
  Retrieval in Practice* (2015).
- Büttcher, Clarke, Cormack — *Information Retrieval:
  Implementing and Evaluating Search Engines* (2010).
- Salton — *The SMART Retrieval System* (1971).
- Robertson & Walker — BM25 paper (1994).
- BEIR benchmark paper (2021).
- TREC proceedings.
- `.claude/skills/search-engine-library-expert/SKILL.md`.
- `.claude/skills/search-relevance-expert/SKILL.md`.
- `.claude/skills/text-analysis-expert/SKILL.md`.
- `.claude/skills/search-query-language-expert/SKILL.md`.
- `.claude/skills/lucene-expert/SKILL.md`.
- `.claude/skills/elasticsearch-expert/SKILL.md`.
- `.claude/skills/solr-expert/SKILL.md`.
