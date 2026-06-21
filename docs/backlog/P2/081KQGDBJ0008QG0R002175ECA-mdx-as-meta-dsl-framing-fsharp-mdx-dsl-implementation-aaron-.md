---
id: 081KQGDBJ0008QG0R002175ECA
priority: P2
status: open
title: MDX as meta-DSL framing for multi-DSL Zset substrate + F# MDX DSL implementation
created: 2026-05-01
last_updated: 2026-05-02
depends_on: []
type: feature
---

# 081KQGDBJ0008QG0R002175ECA — MDX as meta-DSL framing + F# MDX DSL implementation

## What

Evaluate **MDX (Multidimensional Expressions)** — the
Microsoft-published OLAP query language used in SQL Server
Analysis Services and many BI tools — as the **meta-DSL
framing** for the multi-DSL Zset substrate (per Aaron's
multi-algebra-DB vision: graph + hierarchy + filesystem +
timeseries + ... unified through a single meta-DSL).

If MDX fits as the meta-DSL shape, design and implement an
**F# MDX DSL** that natively hosts MDX-style queries against
the Zset algebra, with the existing types (graph, hierarchy,
filesystem, timeseries) appearing as MDX dimensions /
hierarchies / measures.

## Why now

Aaron 2026-05-01 (composing two messages):

> *"plus promethius as a sick MCP and promtool and you'll love
> the query language its like simplifed multidimensonal query
> language MDX, oh shit backlog f# mdx dsl"*
>
> *"that's might be meta dsl framing"*

Aaron's recognition: **PromQL** (Prometheus Query Language) is
**MDX-shaped** — both are multidimensional-first query
languages with dimensions / hierarchies / measures / tuples /
sets. If PromQL composes naturally from MDX primitives, then
**MDX may be the right shape for the meta-DSL** that unifies
graph + hierarchy + filesystem + timeseries + future types
under the Zset substrate.

This composes directly with 081KQGDBJ0008QG0R0004ACHJJ (timeseries-DB
native-in-Zsets) — that row asks *what is the timeseries
algebra?*; this row asks *what is the meta-DSL that hosts the
timeseries algebra alongside the others?*. Both questions
need answers; they may share a candidate.

## MDX background — why it might fit

**MDX core concepts**:

- **Cubes** — multidimensional data containers (≈ Zset of
  tuples)
- **Dimensions** — axes of categorization (graph nodes,
  hierarchy levels, filesystem paths, time)
- **Hierarchies** — ordered nested levels within a dimension
  (filesystem trees, organizational charts, time periods)
- **Members** — elements within a hierarchy level (specific
  nodes, specific paths, specific timestamps)
- **Measures** — numeric quantities computed over the cube
  (counts, sums, ratios)
- **Tuples** — coordinates in multidimensional space
- **Sets** — collections of tuples
- **Calculated members** — derived measures

**MDX strengths for the meta-DSL role**:

- **Microsoft-published spec** (per
  `feedback_dependency_source_priority_open_source_microsoft_cncf_apache_mit_research_microsoft_research_metrics_are_our_eyes_aaron_2026_05_01.md`
  Tier 2 priority); not proprietary
- **First-class hierarchies** — directly maps to Aaron's named
  types
- **Multidimensional from the start** — graph + hierarchy +
  filesystem + timeseries are all dimensions; queries naturally
  span dimensions
- **Mature semantics** — 25+ years of OLAP usage; well-
  understood evaluation
- **Already PromQL-shaped** — per Aaron's recognition,
  observability queries already fit
- **Compositional** — measures can be calculated from other
  measures; queries can be parameterized

**MDX weaknesses to investigate**:

- **OLAP-cube-shaped** — designed for fact-and-dimension data;
  may need adaptation for graph traversal
- **Read-only history** — MDX is query, not update; the
  Zset retraction-native semantics need to compose with
  MDX-as-query rather than be expressed in MDX itself
- **String-heavy syntax** — MDX is very string-y;
  F# host should produce well-typed AST not stringly-typed
  query
- **Possible verbosity** — MDX queries can be long; an F# DSL
  embedding might be more concise than literal MDX

## Acceptance criteria

1. **Fit-analysis design doc** at
   `docs/research/2026-XX-mdx-as-meta-dsl-fit-analysis.md`
   answering:
   - Does MDX's dimension/hierarchy/measure shape match
     Aaron's named types (graph / hierarchy / filesystem /
     timeseries)? Worked example for each.
   - How does MDX compose with the Zset retraction-native
     semantics? (Mathematical analysis; possibly involves
     extending MDX with retraction operators.)
   - How does PromQL specifically map to MDX? (Worked
     example: a real PromQL query translated to MDX form.)
   - Are there alternative meta-DSL candidates that fit
     better? (e.g., Datalog, GraphQL, SPARQL, custom F#
     DSL.) Evaluate at least 3.

2. **Recommendation**:
   - **Adopt MDX as meta-DSL** — proceed to F# DSL design
   - **Adopt MDX-with-extensions** — proceed with documented
     extensions
   - **Reject MDX, pick alternative** — document why; pivot
     to alternative
   - **Defer** — the question is premature; revisit after
     081KQGDBJ0008QG0R0004ACHJJ lands

3. **If adopt or adopt-with-extensions**: F# MDX DSL design
   sketch at
   `docs/research/2026-XX-fsharp-mdx-dsl-design.md` covering:
   - AST shape (well-typed, not stringly-typed)
   - Embedding style — quotation-based vs computation-
     expression-based vs combinator-library-based
   - Query-evaluation strategy — translate to underlying
     algebras vs unified evaluation engine
   - Type-system mapping — how MDX dimensions/measures get
     F# types
   - Worked examples — at least 3 queries spanning multiple
     types (graph + timeseries + filesystem)

4. **Implementation follow-up rows filed** for each major
   step of the F# MDX DSL build (parser, AST, type-checker,
   evaluator, integration tests).

## Research-cadence inputs

Per the dependency-source priority + Microsoft-Research-as-
preferred-research-source memory:

1. **Microsoft Research** (https://www.microsoft.com/en-us/research/) — search
   for MDX evaluation semantics, OLAP query optimization,
   F# DSL design papers (Don Syme + collaborators)
2. **MDX official spec** (Microsoft docs) — the canonical
   reference
3. **PromQL docs** (CNCF Prometheus) — the worked-example
   target
4. **F# DSL design literature** — `Computation Expressions`,
   `Quotations`, FSharp.Charting / Deedle / Math.NET as
   examples of mature F# DSL embedding
5. **Datalog research** — alternative meta-DSL candidate;
   has rich academic literature
6. **GraphQL** — alternative; CNCF-adjacent ecosystem

Per Otto-364 search-first: verify every load-bearing claim
against current docs/papers, not training data.

## Out of scope (defer)

- **Implementation.** This row is research + design.
  Implementation lands in follow-up rows.
- **Performance benchmarks.** Comes after design lands.
- **Backwards-compatibility with existing Zset query API.**
  Whatever exists today; whether the F# MDX DSL replaces it
  or composes with it is a design decision in the analysis.

## Composes with

- `feedback_dependency_source_priority_open_source_microsoft_cncf_apache_mit_research_microsoft_research_metrics_are_our_eyes_aaron_2026_05_01.md`
  — MDX is Microsoft-published (Tier 2); the dependency-priority
  hierarchy applies
- `project_zeta_multi_algebra_database_one_algebra_to_rule_them_all_sequenced_after_frontier_and_demo_2026_04_23.md`
  — the multi-algebra DB vision MDX is being evaluated as
  meta-DSL for
- 081KQGDBJ0008QG0R0004ACHJJ — the timeseries-DB row that motivates this row;
  PromQL/MDX-shape is the bridge
- 081KQGDBJ0008QG0R0035TQVBQ (Prometheus MCP) — sibling research lane; informs
  the PromQL-as-MDX worked example
- 081KQGDBJ0008QG0R003VHD3KZ (formal architecture ladder) — when the design lands,
  declare layer (likely Layer 3: class taxonomy, since
  meta-DSL is a pattern catalog instantiating type-theoretic
  primitives)
- The 4-axis tightness rule (ZSet-backed + first-class event +
  retractable + columnar storage) per the indexed graph-
  substrate-tight memory entry in `memory/MEMORY.md`; MDX must
  compose with retraction-native to satisfy
- F# DSL design lineage — Don Syme's research (Microsoft Research,
  Tier 2 + Microsoft-Research-preferred citation per the
  dependency-priority memory)

## Effort

**L (large, 3+ days, research-grade)** for the fit-analysis
doc + design sketch. F# MDX DSL implementation is open-ended
(multiple follow-up rows).

## Why P2

- **Not P0/P1** because the meta-DSL design isn't blocking
  current factory operation; queries use whatever ad-hoc
  shape exists today.
- **Not P3** because if MDX IS the right meta-DSL framing,
  the cost of operating without it scales — every additional
  type added under the multi-algebra vision will face
  meta-DSL friction until it lands.
- **P2** sits where the research is important-but-not-urgent;
  lands when bandwidth permits.
