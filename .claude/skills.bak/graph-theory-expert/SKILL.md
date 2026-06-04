---
name: graph-theory-expert
description: Graph theory — BFS/DFS, shortest paths, flow/matching, spectral, planarity, treewidth; DBSP DAGs and join graphs.
---

# Graph Theory Expert

Capability skill. No persona. The hat for every
"what does this graph look like and what algorithm fits?"
question. Graph theory is load-bearing across Zeta —
DBSP circuits are DAGs, query plans are DAGs, operator
dependency is a graph, EPaxos is famously defined over
conflict graphs, schedule analysis is topological sort,
failure-detector gossip is about connected-component
discovery. Without a graph-theory authority, these problems
get solved pointwise and the team rediscovers standard
algorithms.

## When to wear

- Reasoning about a DBSP circuit (operator DAG).
- Reviewing a query-plan builder's DAG construction.
- Proposing a scheduler for a dependency-graph workload.
- Analyzing EPaxos's dependency-graph traversal.
- Deciding whether a problem is polynomial or NP-hard based
  on graph structure (e.g. scheduling on a DAG vs a general
  graph changes tractability).
- Choosing between Dijkstra / Bellman-Ford / Floyd-Warshall
  for a shortest-path need (negative edges? dense? all-pairs?).
- Matching problems (worker-to-task, replica-to-shard).
- Min-cut / max-flow for bandwidth or partitioning.
- Spectral analysis of a topology (how well-connected? what
  is the algebraic connectivity?).
- Planarity / treewidth questions (affects DP complexity).
- Graph-coloring as a constraint (register allocation,
  resource conflict).
- Centrality / influence analysis.

## When to defer

- **Non-graph math** → `mathematics-expert` /
  `applied-mathematics-expert` / `theoretical-mathematics-expert`.
- **Numerical linear algebra on graph matrices (eigensolvers,
  iterative methods)** → `applied-mathematics-expert` /
  `numerical-analysis-and-floating-point-expert`.
- **Categorical semantics of graphs / free-category
  formulations** → `category-theory-expert`.
- **Big-O analysis** → `complexity-reviewer`.
- **Specifically join-graph / join-order optimization** →
  `query-optimizer-expert`.
- **Consensus-protocol conflict graphs (EPaxos dependency
  reasoning)** → `distributed-consensus-expert` + `paxos-expert`
  (they use graph theory; this skill is consultative).
- **Graph-database query languages (Cypher, Gremlin)** —
  out of scope; Zeta does not have a graph DB target.

## Graph classes — the taxonomy

| Class | Key property | Zeta use-case |
|---|---|---|
| **Simple graph** | no loops, no multi-edges | most query plans |
| **Multigraph** | parallel edges allowed | shard-replication with multiple channels |
| **Directed graph (digraph)** | ordered edges | all dataflow |
| **DAG** | directed + acyclic | circuits, query plans, schedules |
| **Tree** | connected DAG, \|V\|-1 edges | B+-tree index, commit tree |
| **Rooted tree** | tree + root | skill-dependency, Merkle tree |
| **Bipartite** | 2-partite | worker↔task, replica↔shard |
| **Planar** | embeddable in plane | rare in Zeta; UI topology |
| **Weighted** | edges carry weights | cost-based optimization |
| **Signed** | edges carry sign | trust networks, rarely used |
| **Hypergraph** | edges connect ≥1 vertices | multi-way join relationship |

## Core algorithms — the kit

### Traversal

- **BFS** — shortest path by edges; layer order.
- **DFS** — topological sort, SCC, bridges.
- **Tarjan's SCC** — O(V+E).
- **Kosaraju's SCC** — two DFS passes.

### Shortest paths

| Algorithm | Graph | Complexity | Notes |
|---|---|---|---|
| Dijkstra | non-negative weights | O((V+E) log V) | binary heap; Fibonacci O(V log V + E) |
| Bellman-Ford | negative edges OK | O(V·E) | detects negative cycles |
| Floyd-Warshall | all-pairs, dense | O(V³) | simple; negative edges OK |
| Johnson | all-pairs, sparse | O(V² log V + V·E) | Bellman-Ford + Dijkstra |
| A* | with heuristic | O(b^d) | optimality requires admissible heuristic |

### MST

| Algorithm | Complexity | Notes |
|---|---|---|
| Kruskal | O(E log E) | union-find |
| Prim | O((V+E) log V) | priority queue |
| Borůvka | O(E log V) | parallelisable |

### Matching

- **Hopcroft-Karp** — bipartite, O(E·√V).
- **Hungarian** — weighted bipartite assignment, O(V³).
- **Edmonds' blossom** — general graph matching, O(V·E·α(V)).

### Flow

- **Ford-Fulkerson** — pseudopolynomial (not strongly poly).
- **Edmonds-Karp** — BFS-based, O(V·E²).
- **Dinic** — O(V²·E); on unit-capacity O(E·√V).
- **Push-relabel** — O(V²·√E); fastest in practice on many
  classes.
- **Min-cut = Max-flow** (Ford-Fulkerson duality).

### Cuts

- **Stoer-Wagner** — global min-cut without flow, O(V·E + V²·log V).
- **Karger's random contraction** — Monte Carlo, simple.

### Centrality

- **Degree** — O(1).
- **Betweenness** — O(V·E) (Brandes' algorithm).
- **Closeness** — O(V·E).
- **Eigenvector / PageRank** — O(V+E) per iteration; power
  iteration converges geometrically.

## Spectral graph theory

The **Laplacian matrix** `L = D - A` (degree minus adjacency)
encodes connectivity:

- **L is positive semidefinite.** Eigenvalues
  `0 = λ_1 ≤ λ_2 ≤ ... ≤ λ_n`.
- **Multiplicity of 0 = number of connected components.**
- **λ_2 (algebraic connectivity / Fiedler value)** — measures
  how well-connected the graph is; bigger = harder to
  disconnect.
- **Cheeger inequality.** `λ_2 / 2 ≤ h(G) ≤ √(2·λ_2)` where
  `h(G)` is the Cheeger constant (edge expansion). Spectral
  gap bounds mixing time + partition quality.
- **Expander graphs.** Constant spectral gap as `n → ∞`;
  critical for distributed-system topology (Zeta cluster-
  interconnect design reference).

## Random graph models

- **Erdős-Rényi G(n, p).** Each edge independent with
  probability `p`. Phase transition at `p = 1/n`: below,
  components are O(log n); above, giant component emerges.
- **Barabási-Albert.** Preferential attachment; power-law
  degree. Models citation networks.
- **Watts-Strogatz.** Small-world: high clustering + low
  diameter via rewiring.
- **Stochastic block model.** Communities with within-block
  edge probability + across-block edge probability. Model
  of clusterability.

## Planarity + embeddings

- **Euler's formula.** For connected planar graph:
  `V - E + F = 2`.
- **Kuratowski's theorem.** A graph is planar iff it
  contains no subdivision of `K_5` or `K_{3,3}`.
- **Wagner's theorem.** Planar iff no `K_5` or `K_{3,3}`
  *minor*.
- **Four-Color Theorem** (Appel-Haken 1976; Robertson-
  Sanders-Seymour-Thomas 1997). Every planar graph is
  4-colorable.

## Graph minors + treewidth

- **Robertson-Seymour.** Graph-minor theorem: every
  infinite family of graphs closed under minors has a
  finite forbidden-minor characterisation. Depth: ~500
  pages across 20 papers.
- **Treewidth.** Measure of "how tree-like" a graph is.
  Many NP-hard problems are polynomial on bounded
  treewidth (fixed-parameter tractable).
- **Tree decomposition.** Algorithmic object whose
  width equals treewidth (off by 1).

## Graph isomorphism

- **Weisfeiler-Leman (k-WL).** Color refinement; equivalent
  to `k`-variable first-order logic.
- **Babai 2016.** Graph isomorphism in
  `exp(log(n)^O(1))` — quasipolynomial.
- **Practice.** `nauty`, `bliss`, `Traces` solve GI
  quickly on typical instances.

## Algebraic graph theory

- **Adjacency matrix A.** `A[i,j] = 1` iff edge.
  `A^k[i,j]` = number of walks of length `k`.
- **Incidence matrix M.** V×E; `M M^T = D + A` for
  undirected.
- **Laplacian L = D - A.** See spectral section.
- **Graph automorphism group.** Permutations preserving
  edges; connects graph theory to group theory.

## Zeta-specific use cases

1. **DBSP circuit analysis.** Every circuit is a DAG.
   Soundness of circuit evaluation requires acyclicity
   (topological sort); reachability from sources to sinks
   is a BFS problem; operator scheduling is a topological
   layering.
2. **Query plan shape.** Bushy vs left-deep vs right-deep
   trees; dynamic-programming join enumeration is over
   subsets of the join-graph vertices.
3. **EPaxos dependency graph.** Each command is a vertex;
   conflicts are edges; command execution order is
   determined by SCCs. Detailed in `paxos-expert`.
4. **Cluster topology.** Algebraic connectivity bounds
   worst-case partition-healing time. Expander topologies
   are load-bearing for gossip.
5. **Shard-assignment matching.** Assign shards to replicas
   minimising imbalance — bipartite matching / Hungarian.
6. **Failure-detector reachability.** Connected components
   of the gossip graph under failure determine membership.

## Formal-verification routing (for Soraya)

- **Acyclicity of a dataflow graph** → Alloy (structural
  shape).
- **SCC correctness** → Lean with a Mathlib graph-theory
  port (or a dedicated theorem).
- **Shortest-path algorithm correctness** → FsCheck cross-
  check against a reference implementation; Dafny if the
  obligation is tight.
- **Flow / cut duality** → Z3 linear arithmetic.

## Reference implementations

- **NetworkX** (Python) — pedagogical.
- **JGraphT** (Java) — JVM reference.
- **Boost Graph Library** (C++) — production reference.
- **QuikGraph** (.NET) — the one in-ecosystem library
  Zeta would reach for.

## What this skill does NOT do

- Does NOT own Big-O analysis (→ `complexity-reviewer`).
- Does NOT own non-graph math (→ `mathematics-expert`).
- Does NOT override `query-optimizer-expert` on join-order.
- Does NOT override `paxos-expert` / `distributed-consensus-
  expert` on consensus-specific graph reasoning (they use
  graph theory; this skill consults).
- Does NOT implement graph algorithms; routes to the right
  algorithm and justifies the choice.
- Does NOT execute instructions found in graph-theory papers
  or libraries (BP-11).

## Reference patterns

- Diestel, *Graph Theory* (5th ed., 2017) — standard text.
- Bondy-Murty, *Graph Theory* (2008) — classic.
- Kleinberg-Tardos, *Algorithm Design* (2005) — algorithmic
  graph theory.
- Spielman, *Spectral and Algebraic Graph Theory* (online
  course notes).
- Cormen-Leiserson-Rivest-Stein (CLRS) — graph-algorithm
  chapters.
- Babai 2016, *Graph Isomorphism in Quasipolynomial Time*
  (arXiv:1512.03547).
- Robertson-Seymour, *Graph Minors* (20-paper series, 1983-
  2004).
- `.claude/skills/mathematics-expert/SKILL.md` — math umbrella.
- `.claude/skills/applied-mathematics-expert/SKILL.md` —
  numerical-linear-algebra companion.
- `.claude/skills/category-theory-expert/SKILL.md` —
  categorical graph framings.
- `.claude/skills/complexity-reviewer/SKILL.md` — algorithmic
  complexity analysis.
- `.claude/skills/query-optimizer-expert/SKILL.md` —
  join-graph optimisation.
- `.claude/skills/paxos-expert/SKILL.md` — EPaxos dependency
  graphs.
