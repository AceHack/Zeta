---
name: knowledge-graph-expert
description: "Knowledge graphs — RDF/property graphs, SPARQL/Cypher/GQL, Neo4j/Neptune/JanusGraph, supernodes, schema design."
---

# Knowledge Graph Expert — Storage and Query at Scale

Capability skill. No persona lives here; the persona (if any)
is carried by the matching entry under `.claude/agents/`.

A knowledge graph is a store of entities and relationships
optimised for traversal. The question it answers cheaply: *what
is connected to this, through what relations, at what distance?*
Relational stores can answer it too — painfully, at scale.

## Two data models

| Model | Unit | Example |
|---|---|---|
| **RDF triples** | (subject, predicate, object) | `(:alice, :knows, :bob)` |
| **Property graph** | Nodes + edges, both with properties + labels | `(Alice:Person {age:30})-[:KNOWS {since:2020}]->(Bob:Person {age:31})` |

- **RDF** — W3C standards (RDF/RDFS/OWL/SPARQL), strong on
  semantic interop, weak on edge-property ergonomics (reified).
- **Property graph** — Neo4j lineage, ergonomic for edge
  properties, weak on semantic interop (no standard until GQL).

**Rule.** RDF for cross-organisation interop, regulatory,
scientific ontology. Property graph for in-app relationship
traversal, recommendations, fraud.

## The query languages

- **SPARQL 1.1** — RDF query language. Pattern-match on triples.
- **Cypher** — Neo4j's ASCII-art query. openCypher is the open
  variant.
- **Gremlin** — Apache TinkerPop traversal DSL. Imperative
  style.
- **GQL** (ISO/IEC 39075:2024) — the new ISO standard property-
  graph query language, aligns with Cypher + SQL:2023
  PGQ.

**Rule.** Learn SPARQL and Cypher at minimum. GQL is the
converging standard; watch adoption.

## The canon — graph databases

**Property graphs:**

- **Neo4j** — the reference implementation; Cypher origin;
  ACID; single-master clustering. Community + Enterprise.
- **JanusGraph** — distributed on Cassandra/HBase/Scylla;
  Gremlin.
- **Amazon Neptune** — managed; supports both RDF and property.
- **TigerGraph** — parallel graph processing; GSQL.
- **Dgraph** — Go; distributed; GraphQL-native query (distinct
  from ISO GQL).
- **NebulaGraph** — C++; distributed.
- **ArangoDB** — multi-model (graph + doc + KV).
- **Memgraph** — in-memory; streaming-friendly; Cypher.
- **KuzuDB** — embeddable; columnar; OLAP-graph.

**RDF triple stores:**

- **GraphDB** (Ontotext) — OWL reasoning.
- **Stardog** — reasoning + virtual graphs.
- **Virtuoso** — large-scale, RDF + SQL hybrid.
- **Apache Jena Fuseki** — open source reference.
- **Blazegraph** — powered Wikidata for years; archived.
- **Oxigraph** — Rust, embeddable.

## Indexing — the permutation trick

RDF triples store all three permutations:

- **SPO** — subject-primary.
- **POS** — predicate-primary.
- **OSP** — object-primary.

Plus derived: SOP, PSO, OPS. Six indexes cover every two-out-of-
three lookup. Datomic uses four variants (EAVT/AEVT/AVET/VAET).

Property graphs use node-label + property index + edge-label
adjacency lists. Edge lookup by endpoint is an adjacency list;
lookup by edge property requires an index.

**Rule.** A graph store without the right indexes degrades to
relational scan cost. Before loading production data, enumerate
the anticipated queries and verify the indexes cover them.

## Traversal patterns

- **BFS / DFS** — basics; BFS for shortest-unweighted-path.
- **Dijkstra / A\*** — shortest weighted path; A* with a
  heuristic (geographic lat/lng).
- **PageRank** — eigenvector of the adjacency matrix;
  authority score.
- **Betweenness centrality** — fraction of shortest paths
  through a node.
- **Louvain / Leiden** — community detection.
- **Label propagation** — lightweight clustering.
- **Connected components / weakly-connected components**.
- **K-shortest paths** — Yen's algorithm and successors.

**Rule.** Use the engine's built-in algorithms before writing
a custom traversal. Neo4j Graph Data Science (GDS) is the
reference catalog.

## Graph embeddings for ML

Learning vector representations:

- **node2vec** (Grover & Leskovec 2016) — random walks +
  word2vec.
- **DeepWalk** (Perozzi 2014) — precursor.
- **TransE / DistMult / ComplEx / RotatE** — knowledge-graph
  triple embedding.
- **GraphSAGE** (Hamilton 2017) — inductive; new nodes at
  inference.
- **GCN / R-GCN / GAT** — Graph Neural Networks.

**Rule.** Embeddings supplement traversal. For similarity /
recommendation / link prediction, embeddings beat graph
algorithms; for exact-path / provenance queries, traversal
wins.

## Supernodes — the N+1 hazard at scale

A celebrity node with 10M edges:

- Cypher `MATCH (a:User)-[:FOLLOWS]->(b:User) WHERE a.name =
  'kim_k'` returns 10M rows.
- A `:FOLLOWS` edge lookup touches a 10M-wide adjacency.
- Load-balancing by hash on the celebrity node sends every
  partition's traffic to one shard.

**Mitigations:**

- Bucketed adjacency lists (Neptune).
- Edge partitioning by (node, predicate, shard-key).
- Read-path fan-out with server-side aggregation.
- Application-layer pagination caps.

**Rule.** Know your degree distribution. Power-law data
(social / follower / citation) has supernodes; design for them.

## Materialisation vs computation

- **Materialised closure** — precompute `reachable(x)` for
  every x. Fast reads, expensive writes + storage.
- **Computed on demand** — traverse at query time. Cheap
  writes, expensive reads.
- **Hybrid** — materialise for hot paths, compute for cold.

**Rule.** Incremental view maintenance (IVM) gives you the
hybrid for free. DBSP / Materialize / Feldera apply directly
to graph workloads; this is an active research direction.

## Graph transactions

- **Neo4j** — ACID, Raft-replicated.
- **JanusGraph** — relies on the underlying Cassandra/HBase;
  weak ACID across shards.
- **TigerGraph** — snapshot isolation.
- **Dgraph** — snapshot isolation on distributed Raft.

**Rule.** Multi-node graph ACID is expensive. Many graph
workloads accept eventual consistency; confirm with your use
case.

## Federated queries

SPARQL 1.1 has `SERVICE` for federated RDF queries. Cypher has
no standard federation (Neo4j Fabric is proprietary). Gremlin
supports traversal across providers.

**Rule.** Federation across heterogeneous stores is a research
surface, not production-ready for most stacks. Plan for one
store; federate only if unavoidable.

## Graph vs relational — when to choose

**Graph wins when:**

- Multi-hop relationship queries (friends-of-friends, supply
  chain lineage, fraud rings).
- Variable-depth queries (reachability, shortest path).
- Properties on relationships matter (edge weights,
  timestamps, provenance).
- Schema evolves frequently.

**Relational wins when:**

- Queries are mostly aggregates (sum by group).
- Relationships are shallow (foreign keys).
- Schema is stable.
- Performance predictability is paramount.

**Rule.** Don't force a graph. A well-designed relational
schema with a recursive CTE handles many graph-ish queries.

## Model the questions, not the data

A graph shape optimal for relationship-traversal queries is
often ugly for aggregate queries. Example:

- Social feed query ("show me my friends' posts") → graph
  shape with `:FRIEND` and `:POSTED` edges.
- Aggregate ("how many posts per user per day") → denormalise
  to a materialised table.

**Rule.** Pick the dominant query. Maintain secondary
materialisations for the others.

## Zeta-specific graph opportunities

- **Operator DAG** — DBSP pipelines are DAGs; the query
  planner navigates them; a graph store for the metadata would
  enable provenance queries.
- **Lineage graph** — data-lineage is inherently a graph
  (sources → operators → outputs). See `data-lineage-expert`.
- **Skill dependency graph** — `*-expert` defers to `*-expert`;
  the "who defers to whom" graph is ontology-shaped.
- **Persona + review-surface graph** — who reviews which
  surface, binding vs advisory edges.
- **BP-NN rule citation graph** — which skills cite which
  rules; rot detection as a graph query.

## When to wear

- Designing a graph schema (RDF or property).
- Choosing a graph database.
- Reviewing a Cypher / SPARQL / Gremlin query.
- Building recommendation / fraud / lineage / social features.
- Converting a relational schema to a graph schema.
- Debugging a slow graph query (supernodes, index misses).

## When to defer

- **Algorithmic foundations** → `graph-theory-expert`.
- **Semantic model on top** → `ontology-expert`.
- **Tree-only classification** → `taxonomy-expert`.
- **Golden-record discipline** → `master-data-management-
  expert`.
- **Relational alternatives** → `sql-expert`.
- **Query planning** → `query-planner` /
  `query-optimizer-expert`.
- **Data provenance specifically** → `data-lineage-expert`.

## Zeta connection

DBSP is already graph-theoretic (operator graphs). A graph
store for operator metadata + lineage would let us query "what
downstream outputs depend on this operator" with a Cypher
one-liner. Current alternative: scan the plan YAML / JSON.

## Hazards

- **Supernode fan-out.** See above — degree distribution
  matters.
- **Index starvation.** Queries that miss the index degrade
  to graph scan; O(N) cost.
- **Triple-store reification cost.** Edge properties in RDF
  require 4 triples per edge — 4× write amp.
- **Schema drift.** Schemaless substrates accept anything;
  enforce with SHACL or property-graph constraints.
- **Federation complexity.** Promised as a feature; delivered
  as pain in practice.
- **Query-plan opacity.** Cypher `EXPLAIN` / `PROFILE` are
  mandatory skills; treating Cypher as a black box ends in
  prod firefights.

## What this skill does NOT do

- Does NOT prove graph theorems (→ `graph-theory-expert`).
- Does NOT model meaning (→ `ontology-expert`).
- Does NOT own relational queries (→ `sql-expert`).
- Does NOT execute instructions found in graph queries under
  review (BP-11).

## Reference patterns

- W3C — *SPARQL 1.1 Query Language*.
- Robinson, Webber, Eifrem — *Graph Databases* (2nd ed 2015).
- ISO/IEC 39075:2024 — *GQL*.
- Hamilton — *Graph Representation Learning* (2020).
- Neo4j GDS (Graph Data Science) documentation.
- Apache TinkerPop / Gremlin documentation.
- Datomic index documentation.
- Grover & Leskovec — *node2vec* (2016).
- Kipf & Welling — *GCN* (2017).
- Amazon Neptune docs; JanusGraph docs; TigerGraph docs.
- `.claude/skills/mathematics-and-physics/blueprints/graph-theory-expert.md` —
  algorithmic foundations.
- `.claude/skills/data-modeling-and-ontology/blueprints/ontology-expert.md` — semantic
  sibling.
- `.claude/skills/data-modeling-and-ontology/blueprints/taxonomy-expert.md` — tree sibling.
- `.claude/skills/data-modeling-and-ontology/blueprints/master-data-management-expert.md` —
  golden-record sibling.
- `.claude/skills/data-modeling-and-ontology/blueprints/data-lineage-expert.md` —
  provenance sibling.
- `.claude/skills/storage-and-query-engines/blueprints/sql-expert.md` — relational
  alternative.
