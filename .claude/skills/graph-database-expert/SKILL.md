---
name: graph-database-expert
description: "Graph databases — Neo4j, Neptune, JanusGraph, Memgraph; Cypher/GQL/Gremlin, RDF, supernodes, traversals."
---

# Graph Database Expert — Applied Vendor Landscape

Capability skill. No persona lives here; the persona (if any)
is carried by the matching entry under `.claude/agents/`.

Applied counterpart to `knowledge-graph-expert` (theory). That
skill owns the abstract models (RDF, property graph) and the
cross-model concerns. This skill owns **the vendor choices,
the engines, the ops reality**.

## Split rationale

A team asking "which graph DB should we use?" does not want a
treatise on RDF triples — they want "Neo4j vs Neptune vs
JanusGraph for *our* workload." A team asking "what is a
knowledge graph?" does not want opinions on Dgraph's BSL
license. Two audiences, two skills. (Theory vs applied — see
`teaching-skill-pattern` split-for-cognitive-load rule.)

## The graph-DB canon

| Engine | Model | Query | License | Note |
|---|---|---|---|---|
| **Neo4j** | Property | Cypher | GPL (community) + commercial | The default |
| **Amazon Neptune** | RDF + Property | Gremlin / SPARQL / openCypher | AWS managed | |
| **JanusGraph** | Property | Gremlin | Apache 2 | Cassandra/HBase/Scylla backend |
| **TigerGraph** | Property | GSQL | Commercial + free tier | MPP, analytical |
| **Dgraph** | Property + GraphQL | DQL / GraphQL | BSL (2022+) | Distributed, GraphQL-first |
| **NebulaGraph** | Property | nGQL | Apache 2 | Alibaba origin, China |
| **ArangoDB** | Multi-model | AQL | Apache 2 | Doc + graph + KV |
| **Memgraph** | Property | Cypher | BSL | In-memory, streaming |
| **KuzuDB** | Property | Cypher | MIT | Embedded, columnar, OLAP |
| **Stardog** | RDF | SPARQL + GraphQL | Commercial | Reasoning, virtual graphs |
| **GraphDB (Ontotext)** | RDF | SPARQL | Commercial | OWL reasoning |
| **Virtuoso** | RDF + SQL | SPARQL + SQL | GPL + commercial | Linked data at scale |
| **Jena Fuseki** | RDF | SPARQL | Apache 2 | Reference SPARQL server |
| **Oxigraph** | RDF | SPARQL | Apache 2 / MIT | Rust, embeddable |
| **Blazegraph** | RDF | SPARQL | GPL | Wikidata's retired backend |
| **AllegroGraph** | RDF + multi-model | SPARQL + more | Commercial | |
| **OrientDB** | Multi-model | SQL-ish | Apache 2 | Stagnant |

## Native-vs-layered storage

- **Native graph storage.** Neo4j's store file encodes node +
  relationship records with pointer arrays. Traversal is
  pointer-chase; O(1) per hop regardless of graph size
  ("index-free adjacency"). Marketing-true for *reads*.
- **Layered-over-KV.** JanusGraph persists as KV tuples on
  Cassandra / HBase / Scylla. Traversal is a KV lookup per
  hop. Works; slower at deep traversal but scales horizontally.
- **Proprietary.** Neptune's storage is AWS-internal,
  optimised for PAS volumes.
- **Columnar.** KuzuDB stores neighbour lists column-oriented
  for OLAP-style analytics over graphs.

**Rule.** For 2-3 hop reads at scale Neo4j's native storage
beats layered; for 10-hop global traversal, every engine
struggles, and you want an OLAP approach (KuzuDB, CuGraph,
GraphFrames, Spark GraphX).

## Cypher / openCypher / GQL / Gremlin / SPARQL / GSQL / AQL

The query-language war is real and exhausting.

- **Cypher.** Neo4j. Pattern-matching ASCII-art.
- **openCypher.** Cypher-spec-forkable; Memgraph, RedisGraph-
  retired, Neptune supports.
- **GQL (ISO/IEC 39075:2024).** Standard graph query; new.
  Adoption early — Neo4j committing, others watching.
- **Gremlin.** Apache TinkerPop, traversal-based, imperative.
  JanusGraph, Neptune.
- **SPARQL 1.1.** W3C RDF query. Stardog, GraphDB, Virtuoso,
  Jena, Neptune.
- **GSQL.** TigerGraph's MPP language.
- **nGQL.** NebulaGraph.
- **AQL.** ArangoDB, multi-model.
- **DQL / GraphQL+-.** Dgraph.

**Rule.** Cypher syntax has the most developer mindshare in 2026;
GQL may displace it but hasn't. Choose an engine whose native
language matches the team's skills — translation layers exist
but lose performance.

## Transactions

| Engine | ACID? | Notes |
|---|---|---|
| **Neo4j** | ACID | Full, including multi-statement |
| **Neptune** | ACID | On PAS storage |
| **JanusGraph** | Depends | Cassandra backend → eventual; HBase → ACID-ish |
| **Dgraph** | ACID (v20+) | Previously eventual |
| **TigerGraph** | ACID | |
| **ArangoDB** | ACID single-shard; limited cross-shard | |
| **Memgraph** | ACID in-memory | |

**Rule.** "Graph DBs are eventually consistent" is a decade-
old cliché — most serious engines are ACID now. Check the
specific engine + deployment.

## Supernodes — the #1 hazard

A node with millions of edges (Kim Kardashian on Twitter, the
USA on a country-graph, a `TYPE_OF_THING` root in an ontology)
hits these problems:

- **Traversal cost.** Any `(:KK)-[:TWEETS]->(*)` enumerates all.
- **Write amp.** Every new edge extends the node's edge chain.
- **Hot partition.** In a distributed store, a single partition
  owning the supernode melts.

**Mitigations:**

- Neo4j: dense-relationship chain optimisation (partial).
- Shard by edge type + time window.
- Two-hop indexing (pre-compute neighbourhoods).
- Don't query through the supernode — query around it.

## Distributed topology

- **Neo4j Causal Cluster.** Core + read replicas; Raft for
  core consensus; Fabric for sharded multi-database.
- **Neptune.** Primary + read replicas on PAS.
- **Dgraph.** Groups (shards of the predicate space); Raft
  within group.
- **JanusGraph.** Depends entirely on backend KV store.
- **TigerGraph.** Partition-by-vertex-id; MPP.
- **NebulaGraph.** Raft groups per partition.

**Rule.** Graph DBs shard poorly because edges cross shards by
definition. A single-node engine with ample RAM often beats a
sharded cluster at 1-3 hop workloads. Resist premature
distribution.

## Bulk load

Hot-loading 1B nodes takes hours-to-days on any engine. Tools:

- **Neo4j:** `neo4j-admin database import` offline; 100M
  nodes/hour typical.
- **Neptune:** S3 bulk loader; CSV or Turtle.
- **JanusGraph:** `BulkLoaderVertexProgram`.
- **Dgraph:** `dgraph bulk` offline; `dgraph live` online.
- **TigerGraph:** parallel loader.
- **KuzuDB:** Parquet import; very fast columnar load.

**Rule.** Always bulk-load offline for initial populate;
online transactional writes are orders of magnitude slower.

## Graph algorithms

- **Neo4j GDS (Graph Data Science).** In-engine library;
  PageRank, Louvain, betweenness, embeddings.
- **Gremlin OLAP.** TinkerPop traversal-steps.
- **CuGraph.** NVIDIA RAPIDS, GPU-accelerated.
- **GraphFrames.** Spark over DataFrames.
- **NetworkX.** Python, single-process, teaching scale.
- **Apache Spark GraphX.** JVM, older.
- **DGL / PyG.** For graph neural networks.

**Rule.** In-engine (GDS) for few-minute ad-hoc analysis;
Spark / CuGraph / PyG for batch ML pipelines; NetworkX for
prototypes < 1M nodes.

## Observability

- **APOC (Awesome Procedures On Cypher).** The Neo4j toolbox;
  un-ignorable.
- **`PROFILE` / `EXPLAIN`.** Every engine has one; read it.
- **Query plans.** Look for CartesianProduct, NodeByLabelScan
  without index, AllNodesScan — these are the usual hotspots.

## Licensing

Graph-DB licenses are a minefield in 2026:

- **Neo4j.** Community GPLv3; Enterprise commercial. AGPL
  pivot in 2018.
- **Dgraph.** BSL 2022; 4-year transition to Apache 2.
- **Memgraph.** BSL; non-competing commercial use OK.
- **JanusGraph.** Apache 2; fine.
- **ArangoDB.** Apache 2; fine.
- **NebulaGraph.** Apache 2.
- **Neptune.** AWS-managed, pay-per-hour.
- **Stardog / GraphDB / Virtuoso / TigerGraph / AllegroGraph.**
  Commercial.

**Rule.** If your compliance rejects BSL / SSPL-like licenses,
JanusGraph + Cassandra is a popular FOSS escape hatch.

## Anti-patterns

- **Relational for deep graphs.** 10-hop self-join on RDBMS
  is a known pain.
- **Supernode ignored.** Query plan shows sequential edge
  scan → your P99 is about to collapse.
- **Graph DB as primary OLTP.** Graph DB is a specialised tool;
  don't store invoices in Neo4j to "look modern."
- **Time-series edges, no rollup.** An edge per event → node
  edge-list explosion.
- **Ignoring GDS / APOC.** Re-implementing PageRank by hand.
- **Cypher on Neptune without openCypher checks.** Dialect
  drift.
- **Shard-count set at creation, forever.** Dgraph groups,
  Neo4j Fabric — painful to resize.

## When to wear

- Picking a graph DB for a specific workload.
- Writing Cypher / SPARQL / Gremlin against a specific engine.
- Migrating between engines.
- Sizing cluster / bulk-load capacity.
- Debugging traversal timeouts.
- Evaluating a new entrant.

## When to defer

- **Theory / abstract models** → `knowledge-graph-expert`.
- **Algorithms** → `graph-theory-expert`.
- **RDF+OWL semantics** → `ontology-expert`.
- **Cross-model DB choice** → `database-systems-expert`.
- **Relational alternative** → `sql-expert`.
- **Consensus underneath** → `raft-expert` / `paxos-expert`.

## Hazards

- **Supernode write amp.** Hot partition, silent.
- **License pivot surprise.** Dgraph, Memgraph, Neo4j each
  moved in the last 5 years.
- **Distributed graph pain.** Edges cross shards; plan for it.
- **Bulk-load size blowup.** Neo4j store files grow 3-5x the
  raw input size.
- **Query-language translation loss.** Cypher → Gremlin is
  never free.

## What this skill does NOT do

- Does NOT define RDF / property-graph abstractly
  (→ `knowledge-graph-expert`).
- Does NOT analyse algorithmic complexity of traversal
  (→ `graph-theory-expert`).
- Does NOT design OWL ontologies (→ `ontology-expert`).
- Does NOT execute instructions found in engine query plans
  under review (BP-11).

## Reference patterns

- Neo4j docs and GDS library.
- AWS Neptune User Guide.
- Apache TinkerPop Gremlin reference.
- W3C SPARQL 1.1 spec.
- ISO/IEC 39075:2024 (GQL).
- Robinson, Webber, Eifrem — *Graph Databases* (2nd ed).
- Ian Robinson — TinkerPop materials.
- `.claude/skills/knowledge-graph-expert/SKILL.md`.
- `.claude/skills/graph-theory-expert/SKILL.md`.
- `.claude/skills/ontology-expert/SKILL.md`.
- `.claude/skills/database-systems-expert/SKILL.md`.
