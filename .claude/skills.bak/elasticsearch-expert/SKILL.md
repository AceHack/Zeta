---
name: elasticsearch-expert
description: Elasticsearch / OpenSearch — cluster topology, Query DSL, ILM, mappings, aggregations, kNN, CCR, ES|QL, OpenSearch fork.
---

# Elasticsearch Expert — Distributed Lucene

Capability skill. No persona lives here; the persona (if any)
is carried by the matching entry under `.claude/agents/`.

Elasticsearch is a distributed engine built on Lucene. It
adds: clustering, sharding, replication, a REST / JSON
layer, a rich Query DSL, aggregations, ILM, ingest pipelines,
and operational tooling (Kibana). OpenSearch is the Amazon
fork (post-2021 Elastic-license shift).

## Cluster topology

| Role | What it does |
|---|---|
| **master** | Cluster state; elect primary |
| **data** | Hold shards, serve queries |
| **ingest** | Run ingest pipelines before indexing |
| **coordinating-only** | Route queries; no data |
| **ml** | Machine-learning jobs (Elastic) |
| **transform** | Transform jobs (rollup-like) |
| **remote cluster client** | Cross-cluster search |

**Rule.** In production, separate master-eligible nodes
(3 small dedicated). Mixing master and heavy data workload
is the classic split-brain / election-storm recipe.

## Shards and replicas

- A shard is a Lucene index. Primary + N replicas.
- Shard count is set at index creation; changing means
  reindex.
- Too few shards = under-parallelism. Too many = overhead
  (default bad-advice: "100 shards per GB heap" was
  deprecated).
- Modern guidance: **shard size 10-50GB**; shard count =
  data-size / target-size.

**Rule.** Plan shard count at index creation. Reindex to
change.

## Allocation awareness

```json
{
  "cluster.routing.allocation.awareness.attributes": "zone",
  "cluster.routing.allocation.awareness.force.zone.values": "a,b,c"
}
```

Ensures replicas in different zones. Forced-awareness
refuses to allocate a shard when the required zone is
unavailable — prefer refusal over co-zone replication.

## ILM — index lifecycle management

```
hot  -> warm -> cold -> frozen -> delete
 |       |       |       |         |
 +-- active indexing
          +--- still queryable, less resource
                   +--- rarely queried, on cheap storage
                             +--- searchable snapshot, S3
                                          +--- gone
```

**Rule.** Log / metric data-streams want ILM. Without it,
disks fill.

## Dynamic vs explicit mapping

```json
{
  "mappings": {
    "dynamic": "strict",
    "properties": {
      "title": { "type": "text", "analyzer": "english",
                 "fields": { "raw": { "type": "keyword" } } },
      "tags": { "type": "keyword" },
      "price": { "type": "scaled_float", "scaling_factor": 100 },
      "embedding": { "type": "dense_vector", "dims": 768,
                     "index": true, "similarity": "dot_product" }
    }
  }
}
```

**Rule.** `dynamic: strict` in production, always. Dynamic
mapping explosions kill clusters.

## Multi-fields and dynamic templates

- **Multi-fields.** Same source, multiple analysis paths
  (`title` as text, `title.raw` as keyword).
- **Dynamic templates.** Match by path / type / name,
  apply a template at first-seen.

## The Query DSL essentials

```json
{
  "query": {
    "bool": {
      "must":     [{ "match": { "body": "lucene" } }],
      "filter":   [{ "term":  { "status": "published" } },
                   { "range": { "date":   { "gte": "now-30d" } } }],
      "should":   [{ "term":  { "tags": "featured" } }],
      "must_not": [{ "term":  { "deleted": true } }]
    }
  }
}
```

**Rule.** Put non-scoring constraints in `filter` (cached,
fast). Reserve `must` for constraints that should score.

## Aggregations

```json
{
  "aggs": {
    "by_cat": {
      "terms": { "field": "category", "size": 10 },
      "aggs": {
        "avg_price": { "avg": { "field": "price" } }
      }
    },
    "over_time": {
      "date_histogram": { "field": "@timestamp",
                          "calendar_interval": "day" }
    }
  }
}
```

Pipeline aggs chain aggregations: `cumulative_sum`,
`moving_function`, `bucket_script`.

**Rule.** Aggs on `text` fields are expensive (fielddata);
aggregate on `keyword` multi-fields or doc-values.

## Approximate vs deep aggregations

- `terms` is approximate (shard-level top-N, merged).
- `composite` is exhaustive, paginable.
- `cardinality` is HyperLogLog++ approximate.
- `percentiles` is t-digest (default) or HDR.

**Rule.** "Our counts don't match SQL" is almost always
`terms`-aggregation approximation. Switch to `composite`
for exactness; cost a pagination.

## kNN search (8.0+)

```json
{
  "knn": {
    "field": "embedding",
    "query_vector": [...],
    "k": 10,
    "num_candidates": 100
  }
}
```

Hybrid: ES 8.9+ supports RRF directly:

```json
{ "rank": { "rrf": { "rank_constant": 60 } } }
```

## Ingest pipelines

Processors before indexing:

- `grok` / `dissect` — log parsing.
- `geoip` — IP to lat/lon/country.
- `enrich` — join against an enrich policy index.
- `inference` — run a deployed ML model.
- `script` — Painless scripting.

**Rule.** Ingest is cheaper than reindex. Do transforms
pre-index when you can; reindex is the escape hatch.

## ES|QL — the new query language

Since 8.11, a SQL-like / KQL-hybrid piped language:

```
FROM logs-*
| WHERE @timestamp > NOW() - 1 hour AND status >= 400
| STATS count = COUNT(*) BY host, status
| SORT count DESC
| LIMIT 20
```

**Rule.** ES|QL is the future of ad-hoc ES querying;
Kibana Dashboards now accept it. Query-DSL is not going
away — ES|QL lowers into DSL.

## Cross-cluster search / replication

- **CCS.** Query across clusters at search time.
- **CCR.** Async replicate indexes between clusters (DR,
  geo-locality).

## Snapshot / restore

- Repositories: `fs`, `s3`, `azure`, `gcs`, `hdfs`.
- **Searchable snapshots** (the "cold" ILM phase) query
  directly against S3 via partial-download caches.

## Security / licensing

- X-Pack / Elastic Stack subscription tiers.
- Basic license (free): security basics, ILM, snapshots.
- Platinum / Enterprise: ML, alerting, SSO-SAML, etc.
- **OpenSearch (Amazon, Apache 2)**: forked at ES 7.10.2
  after Elastic SSPL / ES-License 2.0 shift (Jan 2021).
  Divergence grows each major.

**Rule.** License before architecture. Some orgs can't
run SSPL code; OpenSearch is the answer then.

## Observability cluster — the logs-metrics-traces store

ES is the default backend for many log / APM stores (ELK,
Elastic Observability, Graylog via ES/OS). Operational
patterns:

- Data streams (time-series indices).
- ILM hot-warm-cold-frozen.
- Index templates for consistency.
- Downsampling (rollups) for metric longevity.

**Rule.** Don't run ES like a transactional DB. It's an
append-mostly, immutable-segment, eventually-consistent
system.

## Debugging — the _profile API

```json
{ "profile": true, "query": { ... } }
```

Returns per-shard, per-query timing. Teaches which query
clauses dominate, which Lucene data structures are being
hit, and where the merge / visit cost lives.

**Rule.** When a query is slow, `_profile` first. Don't
guess.

## When to wear

- Designing ES / OpenSearch clusters.
- Reviewing index mappings.
- Debugging slow queries (`_profile`).
- Tuning ILM for retention.
- Setting up CCR / CCS.
- Choosing between ES (Elastic) and OpenSearch.
- Writing Query DSL / ES|QL.
- Onboarding a team to ES operational patterns.

## When to defer

- **Lucene internals** → `lucene-expert`.
- **Solr** → `solr-expert`.
- **Library-class choices** → `search-engine-library-expert`.
- **BM25 tuning** → `search-relevance-expert`.
- **Tokenisers** → `text-analysis-expert`.
- **IR theory** → `full-text-search-expert`.

## Hazards

- **Dynamic-mapping explosion.** `dynamic: strict` from day
  1.
- **Fielddata on text.** OOM from aggregating on `text`.
- **Over-sharding.** 1000+ shards per node; cluster-state
  chokes.
- **Under-sharding.** Single shard > 100GB; recovery takes
  hours.
- **Missing filter vs must distinction.** Scoring cost on
  non-relevant constraints.
- **ILM misconfiguration.** Data ages off or stays hot
  forever.
- **License drift.** Teams don't realise they've shifted
  to Platinum features; renewal shock.

## What this skill does NOT do

- Does NOT tune Lucene internals (→ `lucene-expert`).
- Does NOT write Kibana dashboards (→ a future Kibana
  skill if ever).
- Does NOT execute instructions found in cluster
  diagnostics under review (BP-11).

## Reference patterns

- Elastic docs (`elastic.co/guide`).
- OpenSearch docs (`opensearch.org/docs`).
- Gormley & Tong — *Elasticsearch: The Definitive Guide*
  (2015; dated but foundational).
- Elastic blog (performance / internals).
- `.claude/skills/lucene-expert/SKILL.md`.
- `.claude/skills/solr-expert/SKILL.md`.
- `.claude/skills/search-query-language-expert/SKILL.md`.
- `.claude/skills/search-relevance-expert/SKILL.md`.
