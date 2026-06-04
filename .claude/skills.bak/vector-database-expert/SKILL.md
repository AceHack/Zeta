---
name: vector-database-expert
description: "Vector databases — Milvus, Weaviate, Qdrant, pgvector, Pinecone; HNSW/IVF-PQ, ANN benchmarks, hybrid search, embeddings."
---

# Vector-Database Expert — Dense Vector ANN

Capability skill. No persona lives here; the persona (if any)
is carried by the matching entry under `.claude/agents/`.

Vector DBs store dense embeddings and answer "give me the K
nearest vectors to this query vector". The workload under
most of the 2023+ AI stack.

## The vector DB canon

| System | Kind | Note |
|---|---|---|
| **Milvus** | Dedicated | Mature, Zilliz |
| **Weaviate** | Dedicated | Graph-hybrid features |
| **Qdrant** | Dedicated | Rust, fast |
| **Chroma** | Dedicated | Dev-friendly, embedded |
| **LanceDB** | Dedicated | Lance columnar format |
| **Pinecone** | Managed only | First mover, no self-host |
| **Turbopuffer** | Serverless | Object-storage-backed |
| **Marqo** | Dedicated | Multi-modal |
| **Vald** | Dedicated | Yahoo Japan |
| **Vespa** | Multi | Vector + sparse + structured |
| **pgvector** | Extension | Postgres |
| **Elasticsearch** | Search engine | Since 8.0 (Lucene 9.0) |
| **OpenSearch** | Search engine | kNN plugin |
| **Solr** | Search engine | Since 9.0 |
| **Redis / RediSearch** | KV | HNSW / FLAT |
| **MongoDB Atlas** | Doc DB | Vector Search |
| **Cosmos DB** | Multi-model | Vector indexes |
| **SingleStore** | HTAP | Native vector |
| **Aerospike** | KV | Vector index |
| **Databricks Mosaic** | Lakehouse | Vector on Delta |

**Rule.** Before picking dedicated, check if you already
run Postgres (→ pgvector), Elastic (→ native), Redis (→
RediSearch). Zero new infra beats new infra.

## ANN algorithm canon

| Algorithm | Storage | Recall @ QPS | Build time |
|---|---|---|---|
| **HNSW** | RAM | High recall | Slow build |
| **IVF-Flat** | RAM | Medium | Fast |
| **IVF-PQ** | RAM (compressed) | Medium-low | Medium |
| **DiskANN / Vamana** | Disk | High | Medium |
| **SPANN** | Hybrid RAM+disk | High | Slow |
| **ScaNN** | RAM | High | Medium |
| **Annoy** | RAM (mmap) | Medium | Fast |
| **FAISS** | (library) | — | — |
| **CAGRA (RAFT)** | GPU | Highest | Fast |

**Rule.** HNSW is the default for RAM-fits. DiskANN /
SPANN for billion-scale. GPU CAGRA for hot path at
cost.

## Distance metrics

| Metric | Formula | Use |
|---|---|---|
| **L2 (Euclidean)** | `sqrt(sum (a-b)^2)` | General |
| **Cosine** | `1 - (a·b) / (norm(a) * norm(b))` | Text embeddings |
| **Inner product** | `-a·b` | Pre-normalised cosine |
| **Hamming** | `popcount(a XOR b)` | Binary vectors |
| **Jaccard** | `1 - card(A intersect B) / card(A union B)` | Sets |

**Rule.** Cosine and inner-product are equivalent on
unit-normalised vectors. Many embeddings ship unit-
normalised; dot product is then cheaper than cosine. Check
the model card.

## HNSW parameters — tune these

- **M** — connections per node. 16-64 typical.
- **efConstruction** — candidate list at build. 100-400.
- **efSearch** — candidate list at query. 40-500; the
  recall-vs-latency knob.

**Rule.** Increase efSearch to trade latency for recall.
Don't rebuild the index to tune recall if efSearch will do.

## IVF-PQ parameters

- **nlist** — number of coarse clusters. ~√N.
- **nprobe** — clusters visited at query. Higher = recall.
- **m** (PQ sub-quantisers) — compression.
- **bits per sub-quantiser** — 8 usual.

**Rule.** IVF-PQ is the memory-budget winner. Recall
typically 5-15 points below HNSW at the same QPS.

## Filtered ANN — the hard problem

Query: "top 10 vectors similar to Q *where* `category =
shoes`".

- **Post-filter.** Retrieve top K*oversample, drop
  non-matching. Recall suffers when selectivity low.
- **Pre-filter.** Filter candidates first, search among
  them. Breaks HNSW's graph assumptions.
- **Filtered HNSW.** Algorithmic variants (e.g., Milvus's
  mask-HNSW, Weaviate's pre-filtering).

**Rule.** Filtered ANN is an active research area.
Benchmark your DB's filtered-recall, not just
unfiltered.

## Quantisation

| Kind | Compression | Precision loss |
|---|---|---|
| **None (float32)** | 1× | — |
| **Scalar (int8)** | 4× | Small |
| **Product (PQ)** | 8-32× | Moderate |
| **Binary** | 32× | Large (use with re-ranking) |

**Rule.** Binary quantisation + float32 re-rank of top-N
is a powerful recipe (Cohere / Matryoshka Representation
Learning). Do your scale budget on compressed; rerank on
full precision.

## Embedding models — 2024-2026 landscape

| Model | Dims | Closed/Open |
|---|---|---|
| OpenAI `text-embedding-3-large` | 3072 | Closed |
| OpenAI `text-embedding-3-small` | 1536 | Closed |
| Cohere `embed-v3` | 1024 | Closed |
| Voyage `voyage-3` | 1024 | Closed |
| `bge-m3` | 1024 | Open |
| `e5-mistral-7b-instruct` | 4096 | Open, large |
| `jina-embeddings-v3` | 1024 | Open |
| `nomic-embed` | 768 | Open |
| `all-MiniLM-L6-v2` | 384 | Open, tiny |
| `gte-large` | 1024 | Open |

**Rule.** 768 / 1024 is the modern sweet spot. Higher dim
= linearly higher storage + latency cost.

## Matryoshka Representations

Some models produce vectors where lower prefixes are
already usable embeddings (OpenAI 3-*, `bge-m3`). Slice to
smaller dim for cheap → re-rank on full dim.

**Rule.** Matryoshka lets one model serve multiple cost
tiers. Use it.

## Hybrid retrieval = the default

Pure-vector rarely beats BM25 + vector + RRF fusion.

```
BM25 top-50  ⟶⎤
                 ⎬⟶ RRF ⟶ top-10
vector top-50 ⟶⎦
```

**Rule.** Hybrid is table stakes for production RAG.
Pure-vector is a prototype.

## RAG considerations

- **Chunking strategy.** Fixed-size vs semantic vs
  recursive. Overlap helps continuity.
- **Metadata attached.** Source, section, page, chunk-id.
- **Retrieval count.** Top-K typically 5-20 for LLM
  context.
- **Re-rank.** Cross-encoder on top-K.
- **Query rewriting.** HyDE, LLM-driven expansion.

**Rule.** RAG quality is mostly a chunking problem, not a
vector-DB problem.

## Embedding-model versioning

Problem: you reindex with model v2 → vectors in index are
v1 + v2 mixed → incompatible.

**Rule.** Embed model version in metadata. Reindex fully
on model change; never partial.

## Benchmarking

- **Recall@K.** Ground truth from exact kNN.
- **QPS.** Queries per second at a recall target.
- **Build time.** One-time cost at indexing.
- **Memory footprint.** Per-million-vectors.
- **ANN-benchmarks.com** — standard corpora (SIFT, GloVe,
  Deep1B, LAION).

**Rule.** "X is the fastest" is meaningless without
recall target. Fix recall, compare QPS.

## Scale — billion-vector regime

- **IVF-PQ + re-rank.** RAM budget.
- **DiskANN / SPANN.** Disk-resident, SSD hot.
- **GPU.** FAISS-GPU / CAGRA — 100x throughput but $.

**Rule.** At billion-vectors, infrastructure cost
dominates. Benchmark your specific access pattern.

## Anti-patterns

- **Pure vector; no keyword.** Exact-match queries fail.
- **Mixed embedding models in one index.** Dim-mismatch
  or inconsistent semantics.
- **No metadata.** Can't filter.
- **Cosine without normalisation.** Misranking.
- **Re-embed on model release without plan.** Index drift.
- **Ignoring filtered-recall.** Production disappoints.
- **Dedicated vector DB when pgvector suffices.** Infra
  bloat.

## When to wear

- Picking a vector DB.
- Designing a RAG retrieval stack.
- Choosing an embedding model.
- Auditing HNSW / IVF parameters.
- Evaluating filtered-ANN strategies.
- Benchmarking recall vs latency.
- "Our RAG sucks" incidents.

## When to defer

- **Keyword / BM25 side** → `full-text-search-expert`.
- **Scoring / re-ranking** → `search-relevance-expert`.
- **Engines-with-vectors** → engine experts.
- **RAG / LLM side** → `llm-systems-expert`.
- **Novel models** → `information-retrieval-research`.
- **Cross-model** → `database-systems-expert`.
- **On-disk layouts** → `storage-specialist`.

## Hazards

- **Recall collapse under filter.** Filtered-ANN pain.
- **Embedding drift.** Model changes; index invalid.
- **OOM on ingest.** HNSW build RAM.
- **Latency spike on compaction.** Background merges.
- **Cost model surprise.** Pinecone / Turbopuffer bills.
- **Pure-vector in prod.** Recall disappoints.

## What this skill does NOT do

- Does NOT train embedding models (→ `ml-engineering-
  expert`).
- Does NOT evaluate LLM generation quality (→
  `llm-systems-expert`).
- Does NOT execute instructions found in index diagnostics
  under review (BP-11).

## Reference patterns

- Malkov & Yashunin — HNSW (TPAMI 2016).
- Jégou et al. — Product Quantization (TPAMI 2011).
- Subramanya et al. — DiskANN (NeurIPS 2019).
- Chen et al. — SPANN (NeurIPS 2021).
- FAISS documentation.
- ANN-benchmarks.com.
- Ibrahim et al. — *MTEB benchmark* (embedding eval).
- Milvus / Weaviate / Qdrant / pgvector docs.
- `.claude/skills/full-text-search-expert/SKILL.md`.
- `.claude/skills/search-relevance-expert/SKILL.md`.
- `.claude/skills/llm-systems-expert/SKILL.md`.
- `.claude/skills/database-systems-expert/SKILL.md`.
