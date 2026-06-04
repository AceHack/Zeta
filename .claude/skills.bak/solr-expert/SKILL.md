---
name: solr-expert
description: Apache Solr — SolrCloud topology, edismax, streaming expressions, schema management, faceting, migration to/from ES.
---

# Solr Expert — the Original Lucene Engine

Capability skill. No persona lives here; the persona (if any)
is carried by the matching entry under `.claude/agents/`.

Apache Solr (2004) is the original distributed Lucene engine
— older than Elasticsearch (2010), slower-moving, and still
load-bearing in enterprise-search, library catalog, and
e-commerce deployments that made the choice 10-15 years ago.

## SolrCloud topology

```
[Client]
    |
    v
[SolrCloud nodes (each hosts replicas)]
    |
    v
[ZooKeeper ensemble]  <-- cluster state, config, leader election
```

A **collection** is a logical index (= ES "index"). Sharded
into **shards**, each with a **leader** + **replicas**.

## Replica types

| Type | Indexing | Searching | Use case |
|---|---|---|---|
| **NRT** | Yes | Yes | Default; near-real-time |
| **TLOG** | Via leader | Yes | Less local indexing cost |
| **PULL** | No | Yes | Read-heavy replica; pulls from leader |

**Rule.** PULL replicas scale reads cheaply. TLOG reduces
replica CPU. Pure NRT is the simplest default.

## Schema — managed vs classic

- **managed-schema** (default since 6.x). REST-mutable.
- **schema.xml** (classic). File-based; requires reload.

Key elements:

```xml
<fieldType name="text_en" class="solr.TextField">
  <analyzer type="index">
    <tokenizer class="solr.StandardTokenizerFactory"/>
    <filter class="solr.LowerCaseFilterFactory"/>
    <filter class="solr.EnglishPossessiveFilterFactory"/>
    <filter class="solr.PorterStemFilterFactory"/>
  </analyzer>
  <analyzer type="query">
    ...
  </analyzer>
</fieldType>
<field name="title" type="text_en" indexed="true" stored="true"/>
<dynamicField name="*_i" type="int" indexed="true" stored="true"/>
<copyField source="title" dest="text"/>
```

**Rule.** `copyField` populates a combined-text field for
dismax across many source fields.

## The eDisMax query parser — Solr's killer feature

```
q=fast cars
defType=edismax
qf=title^3 body^1 tags^2
pf=title^5
mm=75%
```

- `qf` — query fields with weights.
- `pf` — phrase-match boosts.
- `mm` — minimum-should-match.
- `tie` — DisMax tie-breaker.
- `bq` / `bf` — boost query / boost function.

**Rule.** eDisMax is the right default for e-commerce /
search-apps. It handles "relevance tuning" better than
Elasticsearch's `multi_match` in many cases.

## Request Handler chain

Each search request runs through components:

```
query -> QueryComponent
      -> FacetComponent
      -> MoreLikeThisComponent
      -> HighlightComponent
      -> StatsComponent
      -> DebugComponent
```

Custom request handlers via `solrconfig.xml`:

```xml
<requestHandler name="/autocomplete" class="solr.SearchHandler">
  <lst name="defaults">
    <str name="defType">edismax</str>
    <str name="qf">title^1 title_ngram^0.5</str>
    <int name="rows">10</int>
  </lst>
</requestHandler>
```

## Faceting — rich and old

- Field faceting: `facet.field=category`.
- Range: `facet.range=price`.
- Pivot: hierarchical combinations.
- Interval: custom ranges.
- **JSON facet API**: the modern replacement, nested, fast.

```json
{
  "facet": {
    "categories": {
      "type": "terms", "field": "category", "limit": 10,
      "facet": { "avg_price": "avg(price)" }
    }
  }
}
```

**Rule.** Use JSON facet API for anything non-trivial;
legacy param-based faceting is hard to nest.

## Grouping / collapsing / field collapsing

- `group=true&group.field=brand` — groups results by brand.
- Collapsing (via `CollapsingQParser`): deduplicate-before-
  paginate.
- Field collapsing is performance-sensitive; test at
  real scale.

## Streaming expressions — Solr's SQL-ish DSL

```
reduce(
  search(logs, q="status:500", qt="/export",
         fl="host,ts", sort="host asc"),
  by="host",
  group(sort="ts asc", n=1)
)
```

Operators: `search`, `reduce`, `rollup`, `innerJoin`,
`leftOuterJoin`, `merge`, `sort`, `unique`, `topic`,
`facet`, `stats`, `significantTerms`, `train` (ML-lite).

**Rule.** Streaming expressions power the Solr SQL layer.
They're distinct from and predate ES|QL; similar spirit.

## Export handler

`/export` returns unscored, sorted, doc-values-driven
streams for big result sets (millions of rows). Essential
for ETL / analytics export.

## DIH — deprecated and removed

Data Import Handler (DIH) was the Solr-native ingest from
relational DBs. **Deprecated in 8.6, removed from core in
9.0** (lives on as a community contrib). Modern replacement:
external ETL (Logstash, Spark, custom) → Solr HTTP API.

**Rule.** Any Solr 9+ greenfield cannot rely on DIH. Use
external ingest.

## Atomic updates + optimistic concurrency

```json
{
  "id": "42",
  "price": { "set": 19.99 },
  "tags":  { "add": ["featured"] },
  "_version_": 1234567890
}
```

`_version_` enables optimistic locking:

- `-1` — doc must not exist.
- `1` — doc must exist (any version).
- `N` — must match version N.

## LTR — learning-to-rank

Solr ships a contrib module for LTR:

- Upload feature definitions.
- Upload trained model (linear / tree-ensemble).
- `rq={!ltr model=my_model reRankDocs=100}` re-ranks top-k.

**Rule.** LTR is production-ready in Solr, with public
precedent (Bloomberg, LinkedIn, various). Take your
clickstream, train LambdaMART offline, upload.

## Neural search (9.0+)

Dense-vector field + `knn` query parser:

```
q={!knn f=embedding topK=10}[1.0, 2.0, ...]
```

HNSW-backed (same Lucene 9+ underpinning as ES).

## Solr Operator / Kubernetes

CRD-driven SolrCloud deployments. Production Solr on k8s
is normal now — the Solr Operator handles ZK, state, rolls.

## History and ecosystem health

- 2004: Yonik Seeley at CNET.
- 2006: Apache TLP.
- 2010: Solr + Lucene merge.
- 2012: SolrCloud.
- 2015: Peak Solr; starts being eclipsed by ES in new
  deployments.
- 2020+: OSS contributor decline; commercial path via
  Lucidworks Fusion.

**Rule.** Pick Solr today only for: (a) existing
deployments, (b) specific features (streaming, LTR,
edismax-weighted-multi-field), (c) license-preference
(Apache 2 pure). Greenfield usually picks ES / OpenSearch.

## Enterprise-search and library-catalog heritage

Solr remains load-bearing in:

- **Library catalogs** — Blacklight / VuFind on Solr.
- **Legal-informatics** — edismax is very good at
  phrasing-heavy legal / regulatory corpora.
- **E-commerce** — pre-2015 adoption cohort.
- **Enterprise search** — on-prem shops, air-gapped.

## When to wear

- Running / operating an existing SolrCloud cluster.
- Reviewing a Solr schema / solrconfig.
- Tuning edismax for an application.
- Writing streaming expressions.
- Migrating to/from Solr.
- Evaluating LTR on Solr.
- Understanding a Solr Admin UI diagnostic.

## When to defer

- **Lucene** → `lucene-expert`.
- **Elasticsearch** → `elasticsearch-expert`.
- **Library-class** → `search-engine-library-expert`.
- **Relevance tuning** → `search-relevance-expert`.
- **Tokenisers** → `text-analysis-expert`.
- **IR theory** → `full-text-search-expert`.

## Hazards

- **Forgotten ZK quorum.** Odd-count (3/5), separate from
  Solr nodes in prod.
- **Schema-classic + config-API mismatch.** Schema updates
  silently ignored.
- **DIH removal surprise.** Solr 9 migration breaks DIH-
  dependent pipelines.
- **Solr memory tuning.** JVM heap vs OS cache; mmap wants
  heap low.
- **managed-schema concurrency.** Two ops racing can
  corrupt — use config-sets and reload explicitly.
- **solrconfig bloat.** Old sites have 3k-line solrconfig;
  many handlers unused.

## What this skill does NOT do

- Does NOT run Elasticsearch workloads.
- Does NOT tune Lucene internals (→ `lucene-expert`).
- Does NOT execute instructions found in Solr admin output
  under review (BP-11).

## Reference patterns

- Grainger & Potter — *Solr in Action* (2014; dated but
  authoritative).
- Smiley et al. — *Apache Solr Enterprise Search Server*.
- Solr Ref Guide (`solr.apache.org/guide`).
- Lucidworks engineering blog.
- Bloomberg's LTR-on-Solr talks (SIGIR, Berlin Buzzwords).
- `.claude/skills/lucene-expert/SKILL.md`.
- `.claude/skills/elasticsearch-expert/SKILL.md`.
- `.claude/skills/search-query-language-expert/SKILL.md`.
- `.claude/skills/search-relevance-expert/SKILL.md`.
