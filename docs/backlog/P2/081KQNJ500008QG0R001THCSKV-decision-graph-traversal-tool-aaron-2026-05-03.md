---
id: B-0178
zetaid: 081KQNJ500008QG0R001THCSKV
priority: P2
status: open
title: Decision-graph traversal tool — `tools/decision-graph/` TS scripts that emit + query the substrate's implicit provenance graph (Aaron 2026-05-03 architectural observation; fourth B-0177 audit hit)
tier: tooling
effort: L
ask: Aaron 2026-05-03 named the tool in the decision-graph memo (`memory/feedback_decision_graph_emergent_from_archaeologies_and_flywheel_aaron_2026_05_03.md`) — "Mechanization path (proposed, not yet built): `tools/decision-graph/` TS tool that would traverse substrate and emit the graph for queries." The memo specifies 4 sub-scripts (extract / query / check / render) but the tool was never filed as a backlog row. Caught by Otto 2026-05-03 audit pass post-B-0141 + post-B-0142 + post-B-0157 filings.
created: 2026-05-03
last_updated: 2026-05-03
depends_on: []
composes_with: [B-0141, B-0170, B-0175, B-0177]
tags: [decision-graph, provenance, prov-o, datavault, traversal, query, graph-invariant, mechanization, tooling, fourth-audit-hit]
type: friction-reducer
---

# Decision-graph traversal tool — `tools/decision-graph/`

## Origin

Aaron 2026-05-03, in the decision-graph memo (autonomous-loop maintainer channel), described the substrate's implicit provenance graph + named the mechanization path:

> **Mechanization path (proposed, not yet built):** `tools/decision-graph/` TS tool that would traverse substrate and emit the graph for queries.

The memo specified 4 sub-scripts:

1. **`tools/decision-graph/extract.ts`** — scans substrate per node-class regex; emits node + edge JSON
2. **`tools/decision-graph/query.ts`** — parameterised queries (downstream-of-N, upstream-of-N, supersession-chain, citation-traversal, sacred-tier-respecting-walks)
3. **`tools/decision-graph/check.ts`** — graph-invariant checker (orphan nodes, dangling edges, cycles in `depends_on`, broken `composes_with`)
4. **`tools/decision-graph/render.ts`** — emits Cytoscape / DOT / Mermaid for visualization

Per B-0177's audit hypothesis: the tool was named with specific scope but never filed as a backlog row. Otto 2026-05-03 audit pass (post-B-0141 + post-B-0142 + post-B-0157 filings) found B-0178 as the fourth concrete hit.

## What the substrate already encodes

Per the decision-graph memo, the substrate is a typed-edge provenance graph:

| Node class | Source surface |
|---|---|
| Backlog rows | `docs/backlog/P*/B-*.md` |
| ADRs | `docs/DECISIONS/*.md` |
| Memos | `memory/*.md` |
| Skills | `.claude/skills/*/SKILL.md` |
| Personas | `.claude/agents/*.md` |
| Research artifacts | `docs/research/*.md` |
| Tick shards | `docs/hygiene-history/ticks/**/*.md` |
| Commits | git log |

Edge types:

- `depends_on` — frontmatter
- `composes_with` — frontmatter + memo bodies
- `supersedes` / `superseded_by` — ADR blockquotes + SUPERSEDE markers
- `cites` — markdown links between memos; decision-archaeology Layer 7-10 pointers
- `verifies-against` — substrate-claim-checker output; CI log
- `attributes-to` — Layer 9 persona notebooks; git blame; commit signature
- `closes` — backlog row `status: closed` + `closed_by:` field; PR-merge SHA

## What this row builds

`tools/decision-graph/` package with 4 sub-scripts (per the memo's specification):

### `extract.ts`

- Walks node-class globs (`docs/backlog/P*/B-*.md`, `docs/DECISIONS/*.md`, etc.)
- Parses frontmatter + markdown body for edges (`depends_on`, `composes_with`, markdown links, blockquotes)
- Emits JSON: `{ nodes: [...], edges: [{ from, to, type }, ...] }`
- Output: `tools/decision-graph/output/graph.json` (gitignored OR committed for query reuse)

### `query.ts`

Parameterised queries via CLI:

- `--downstream-of B-0170` — what depends on B-0170?
- `--upstream-of B-0175` — what does B-0175 depend on / compose with?
- `--supersession-chain ADR-0042` — full lineage of supersedes/superseded-by
- `--citation-traversal memory/feedback_X.md` — which memos cite this one?
- `--orphans` — nodes with zero incoming edges
- `--sacred-tier-walk <node>` — respects sacred-tier walk-discipline

### `check.ts`

Graph-invariant checker:

- Orphan nodes (nodes referenced but file missing) — overlaps with B-0170/v0.6 existence-drift
- Dangling edges (B-0xxx referenced in `composes_with` but no row file)
- Cycles in `depends_on` (deadlock detection)
- Broken `composes_with` (B-0xxx in frontmatter that doesn't exist)
- Missing back-references (A composes_with B but B doesn't compose_with A)

### `render.ts`

Visualization output:

- Cytoscape JSON (web-based interactive graph)
- DOT (Graphviz)
- Mermaid (in-markdown rendering for embedding in CLAUDE.md / wiki)

## Composes with

- **B-0141 (brittle-pointer auto-rewriter)**: rewriter PRESERVES graph edges across rename; this row's `extract.ts` reads those edges for the graph
- **B-0170 (substrate-claim-checker)**: graph-invariant checker (`check.ts`) overlaps with substrate-claim-checker's existence-drift sub-class — likely composes by sharing the file-resolution layer
- **B-0175 (substrate-retrieval-index)**: layer-4 active retrieval; the decision-graph IS one of the indexed substrates
- **B-0177 (audit memos for misfiled backlog rows)**: this row's existence IS the fourth empirical hit for B-0177's audit hypothesis (B-0141, B-0142, B-0157, B-0178 all reserved/named in memos but never filed until 2026-05-03)
- **memory/decision-graph memo (Aaron 2026-05-03)**: the originating substrate

## Why this is L-effort

- 4 sub-scripts, each non-trivial:
  - `extract.ts` — markdown-AST parsing + frontmatter parsing + regex-based body parsing for edges (~200-300 LOC)
  - `query.ts` — graph-traversal algorithms + CLI surface (~150-250 LOC)
  - `check.ts` — invariant rules + integration with B-0170 (~100-200 LOC)
  - `render.ts` — multiple output formats + integration with viz libraries (~100-200 LOC)
- Test fixtures need authoring across all 4 scripts
- Composition with existing tools (substrate-claim-checker, BACKLOG.md generator)
- CI integration (graph-check as required check?)
- Sacred-tier walk-discipline non-trivial: requires marker detection + permission semantics

## Open design questions (NOT for this row; for the design pass)

1. **Graph storage**: ephemeral (regenerate on each query) vs cached (committed JSON) vs lazy (regenerate on dirty)?
2. **Edge-detection completeness**: every edge type from the memo, or staged subset?
3. **Sacred-tier semantics**: how does `--sacred-tier-walk` enforce permissions? (CLAUDE.md / ALIGNMENT.md walk-discipline)
4. **Visualization scale**: full graph rendering becomes unreadable at substrate-size; per-cluster subgraph render with drill-down?
5. **Composition with B-0175**: should the decision-graph BE the layer-4 retrieval index (graph-traversal-as-retrieval) or a separate substrate?

## Why this matters

Per the decision-graph memo's carved sentence: *"The graph's value compounds with backlog size: each new node + edge costs O(1); each new query benefits from the cumulative graph."* The substrate is already a graph; querying it requires either manual archaeology (slow) or mechanized traversal (this row). Without the tool, the graph stays implicit; with the tool, it becomes operational.

Composes with the alignment-frontier framing: substrate-quality tooling that makes the implicit graph queryable IS alignment-frontier substrate. The graph IS the project's accumulated decision-knowledge; not querying it leaves that knowledge inert.

## Carved sentence

**"`tools/decision-graph/` is the mechanization path for the substrate's implicit provenance graph. 4 sub-scripts: extract.ts (emit graph JSON), query.ts (parameterised queries: downstream/upstream/supersession/citation), check.ts (invariant checker overlapping with B-0170), render.ts (Cytoscape/DOT/Mermaid). Composes with B-0141 (preserves graph edges), B-0170 (substrate-claim-checker), B-0175 (substrate-retrieval-index). Fourth concrete hit for B-0177's audit hypothesis: tool named in memo, never filed until 2026-05-03 audit pass."**
