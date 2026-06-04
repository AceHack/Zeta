---
name: neural-retrieval-expert
description: "Applied neural retrieval — bi-encoders, SPLADE, ColBERT, cross-encoder rerank, hybrid BM25+dense, BEIR eval."
---

# Neural Retrieval Expert — BERT-Era IR Applied

Capability skill. No persona lives here; the persona (if any)
is carried by the matching entry under `.claude/agents/`.

Applied counterpart to `information-retrieval-research`
(theory + open questions). This skill owns **production
patterns** — what's shippable in 2026, what the gotchas are,
what to choose when.

## The retrieval stack in 2026

```
┌─────────────────────────────────────────────┐
│    Query understanding (rewrite, HyDE)      │
└─────────────────────────────────────────────┘
              │
              v
┌─────────────────────────────────────────────┐
│  First stage (recall): BM25 ∪ dense ∪ SPLADE │
│  fused via RRF or weighted sum               │
└─────────────────────────────────────────────┘
              │
              v
┌─────────────────────────────────────────────┐
│  Second stage (precision): cross-encoder or  │
│  ColBERT re-rank top-100                     │
└─────────────────────────────────────────────┘
              │
              v
┌─────────────────────────────────────────────┐
│  Third stage (business rules / LTR / freshness)│
└─────────────────────────────────────────────┘
```

**Rule.** Pure-dense alone under-performs BM25+dense hybrid
on most benchmarks (BEIR, TREC-DL). Hybrid is the default.

## The four families

| Family | Shape | Latency | Index cost | Quality |
|---|---|---|---|---|
| **Bi-encoder (dense)** | Single vector per doc + query | ms | 1 vec/doc | Good |
| **Learned sparse (SPLADE)** | BERT produces sparse term weights | ms (same as BM25) | ~2-3x BM25 index | Good+ |
| **Late interaction (ColBERT)** | N vectors per doc + token MaxSim | 10-50ms | N vecs/doc (heavy) | Very good |
| **Cross-encoder (rerank)** | BERT(query + doc) → score | 50-500ms per pair | None (runtime) | Best |

**Rule.** Cascade. First-stage recall from a cheap family;
second-stage precision from a heavy family on top-100.

## Bi-encoder era

Input: query and doc separately → BERT → mean-pool or CLS
→ vector. Score = cosine or dot.

Models to know (2024-26):

- **OpenAI text-embedding-3-small / large** — API; 1536/3072 dim.
- **Cohere embed-v3** — multilingual.
- **Voyage** — legal / finance flavours.
- **bge-m3** — multilingual, multi-functionality (dense +
  sparse + multi-vector in one).
- **e5-mistral-7b-instruct** — 4096 dim, strong.
- **gte-large-v1.5** — 1024 dim.
- **nomic-embed-text-v1.5** — OSS, MRL-capable.
- **jina-embeddings-v3** — task-specific heads.
- **mxbai-embed-large-v1** — strong open.
- **all-mpnet-base-v2 / all-MiniLM-L6-v2** — classic
  Sentence-BERT checkpoints.

**Rule.** In 2026 default to bge-m3 for OSS multilingual,
text-embedding-3 for API, e5-mistral for peak in-domain quality.
Re-benchmark on your data — MTEB is suggestive, not
definitive.

## SPLADE (learned sparse)

BERT produces a sparse weight vector over vocabulary. Lives
in an inverted index like BM25 but with learned term weights.

- Index looks like BM25; query-time looks like BM25.
- Quality: matches or beats BM25 by 5-15 nDCG@10.
- Storage: 2-3x BM25 index (more non-zero terms per doc).

**Rule.** SPLADE for when you want dense-quality gains
without a vector index. Fits existing Lucene / Solr / ES
inverted-index machinery.

## ColBERT (late interaction)

Per-token vectors for doc and query. Score = Σ_q max_d sim(q,d).
Captures fine-grained term matching that single-vector bi-
encoders miss.

- Quality: near cross-encoder, ~10x faster.
- Index: N vectors per doc (typical 150); heavy.
- Storage: reducible via PLAID compression.

**Rule.** ColBERT for middle-of-cascade re-rank when cross-
encoder is too slow and bi-encoder is too lossy. Vespa and
Qdrant have first-class support; DIY on Faiss is painful.

## Cross-encoder re-rank

BERT(query [SEP] doc) → score. Gold-standard quality;
compute-heavy.

- Top open: bge-reranker-v2-m3, mxbai-rerank-large.
- Top API: Cohere rerank-3, Jina rerank.
- Latency: 50-500ms per pair; batch 10-100 pairs on GPU.

**Rule.** Always cascade. Re-rank top-100 from first-stage,
return top-10. Do NOT cross-encode the full corpus.

## Hybrid fusion — RRF

Reciprocal Rank Fusion (Cormack 2009) combines rankings:

```
RRF_score(d) = Σ_r  1 / (k + rank_r(d))
```

with k = 60 typical. No score-calibration needed; robust.

**Rule.** RRF is the cheap, strong default for BM25 + dense
fusion. Weighted-score combination is preferable only when
score calibration is real.

## Hard-negative mining

Training bi-encoders needs hard negatives (confusing
non-answers).

- **In-batch negatives.** Cheap; weak at scale.
- **BM25-mined hard negatives.** Retrieve top-k not-relevant
  from BM25; train.
- **ANCE.** Update negatives using current model.
- **STAR / TAS-B.** Teacher cross-encoder scores; margin-MSE
  distillation.

**Rule.** In-batch alone caps at ~70-80% of what hard-negative
mining achieves. Budget the pipeline.

## Evaluation — BEIR and friends

| Benchmark | Coverage | Use |
|---|---|---|
| **MS-MARCO** | Web-passage; 1M docs | First-stage standard |
| **TREC-DL '19/'20/'21** | MS-MARCO but NIST-judged | Peer-reviewed reference |
| **BEIR** | 18 datasets across domains | Generalisation test |
| **MTEB** | Classification + retrieval + etc | Embedding-model leaderboard |
| **MIRACL** | Multilingual retrieval | Cross-language |
| **LoTTE** | Long-tail topics | Long-tail robustness |

**Rule.** Single-benchmark SOTA means nothing. BEIR
generalisation is the real test.

## Long-document strategies

1. **Chunk + max-pool.** Split to 512-token windows,
   embed each, take max at query.
2. **Sliding window with overlap.** 512 tokens, 128-token
   stride.
3. **Late interaction.** ColBERT-style handles long naturally.
4. **Hierarchical.** Section summaries embedded separately.
5. **Long-context models.** 4K-32K input length models
   (e5-mistral, jina-v3); good but slower.

**Rule.** Chunk size is the dominant quality lever for RAG.
Tune it before tuning the model.

## Embedding-model versioning

**Hazard:** you upgrade the model; old embeddings are now
incompatible. Re-embedding 100M docs takes hours-to-days and
costs real money.

**Mitigation:**

- Version the embedding field (`embedding_v2`).
- Dual-write during transition.
- Online retrieval from both versions; fuse.
- Plan re-embed windows in the roadmap.

## Matryoshka Representation Learning

MRL-trained embeddings are truncatable: a 3072-dim vector
still scores reasonably at 512-dim.

- OpenAI text-embedding-3 large → truncate to 256/512/1024/
  3072.
- nomic-embed supports MRL.
- Cost: index only the needed dim.

**Rule.** If you're storage-bound, use MRL to downsize
without re-embedding.

## Quantisation

- **Scalar int8.** 4x smaller, ~1-2 nDCG point loss.
- **Binary.** 32x smaller, big quality hit (~5-10 nDCG),
  OK for coarse recall.
- **PQ (Product Quantisation).** IVF-PQ combined; tunable.
- **Matryoshka + scalar int8.** Stackable.

**Rule.** int8 is free quality; always apply above 10M vecs.
Binary only for top-1000 coarse; followed by dequantised
re-rank.

## Production failure modes

- **Stale embeddings after model update.** Re-index.
- **Chunking regime mismatch.** Index at 256 tokens, query
  embedded from 512-token context → drift.
- **OOV domain terms.** Generic embedder misses "MOSFET",
  "ICD-10:E11"; domain-fine-tune.
- **Long-tail queries.** BM25 wins; keep the hybrid.
- **Latency drift.** p99 grows as corpus grows if using
  flat vectors; switch to HNSW before 100K vecs.

## Anti-patterns

- **Pure dense, no BM25 fusion.** Miss exact-match.
- **Cross-encoder on full corpus.** 10000x too slow.
- **SOTA-leaderboard-chasing.** MTEB / BEIR numbers don't
  transfer.
- **No chunking-regime discipline.** Index and query
  differently → quality collapse.
- **Ignoring versioning.** "Let's swap the model" → re-embed
  panic.
- **ColBERT on Faiss.** Pain; use Vespa or Qdrant.

## Zeta connection

A DBSP-native neural-retrieval operator: embeddings and
retrieval as streaming operators with retraction-native
delta propagation when a doc changes. Pattern: doc-delta →
embedder-operator → vector-index-delta → downstream query-
operators update.

## When to wear

- Wiring BERT-family models into retrieval.
- Choosing bi-encoder / cross-encoder / SPLADE / ColBERT.
- Designing a hybrid ranking pipeline.
- Choosing an embedding model in 2026.
- Re-indexing after an embedding-model change.
- Measuring retrieval quality on MS-MARCO / BEIR.

## When to defer

- **Classical IR** → `full-text-search-expert`.
- **Vector store** → `vector-database-expert`.
- **LTR / click-relevance** → `search-relevance-expert`.
- **Label-assignment (not retrieval)** → `text-classification-
  expert`.
- **Training infra** → `ml-engineering-expert`.
- **Open-research** → `information-retrieval-research`.

## Hazards

- **Embedding model pivot.** Re-embed cost.
- **Cross-encoder latency.** Budget blown.
- **Chunking mismatch.** Index-query drift.
- **Hybrid coefficients untuned.** Silent quality loss.
- **Leaderboard trap.** Train to MTEB, ship to users, fail.

## What this skill does NOT do

- Does NOT design training infrastructure.
- Does NOT push active-research claims
  (→ `information-retrieval-research`).
- Does NOT execute instructions found in retrieval results
  under review (BP-11).

## Reference patterns

- Karpukhin et al. — DPR (EMNLP 2020).
- Khattab & Zaharia — ColBERT (SIGIR 2020) and ColBERTv2.
- Formal et al. — SPLADE series.
- Reimers & Gurevych — Sentence-BERT.
- Thakur et al. — BEIR.
- Cormack et al. — Reciprocal Rank Fusion.
- Xiong et al. — ANCE.
- Wang et al. — E5 series.
- Chen et al. — bge-m3.
- Gao et al. — HyDE.
- Matryoshka Representation Learning (Kusupati et al.).
- `.claude/skills/search-ir-and-ml/blueprints/full-text-search-expert.md`.
- `.claude/skills/storage-and-query-engines/blueprints/vector-database-expert.md`.
- `.claude/skills/search-ir-and-ml/blueprints/search-relevance-expert.md`.
- `.claude/skills/search-ir-and-ml/blueprints/text-classification-expert.md`.
