---
name: Decision graph emerges from decision-archaeology + substrate-claim-checker + at-creation/at-pickup discipline + expansion flywheel + hub-satellite separation (Aaron 2026-05-03 architectural observation)
description: 2026-05-03; Aaron asked *"do we end up with some decision graph or something because of the archeologies and flywheel?"* — answer is yes. The substrate already encodes a typed-edge provenance graph (DataVault-2.0-shaped, PROV-O analogue): nodes are backlog rows / ADRs / memos / skills / personas / research artifacts / tick shards / commits; edges are depends_on / composes_with / supersedes / cites / verifies-against / attributes-to. The archaeologies + flywheel make the implicit graph queryable: decision-archaeology IS graph traversal; substrate-claim-checker IS graph invariant checker; expansion flywheel IS graph growth function; at-creation/at-pickup discipline IS graph edge-filling discipline; hub-satellite separation IS graph stratification. The graph is inferable from substrate without a separate graph database — every edge is encoded in frontmatter / markdown links / ADR blockquotes / SUPERSEDE markers / commit messages. **Mechanization path (proposed, not yet built):** `tools/decision-graph/` TS tool that would traverse substrate and emit the graph for queries.
type: feedback
---

# Decision graph emerges from archaeologies + flywheel

## Origin

Aaron 2026-05-03, mid-tick after worked example #3 of decision-archaeology landed:

> *"do we end up with some decision graph or something because of the archeologies and flywheel?"*

The question names an emergent architectural property of the substrate-quality work. **Yes — and the graph is already implicit in the substrate; the archaeologies + flywheel make it queryable.**

## Nodes (already in substrate)

Each substrate type maps to a node class in the emergent graph:

| Node class | Surface | Visibility |
|---|---|---|
| Backlog row | `docs/backlog/P*/B-*.md` | public |
| ADR | `docs/DECISIONS/` | public |
| Named-decision memo | `memory/feedback_*.md` / `memory/project_*.md` | per-user |
| Skill | `.claude/skills/<name>/SKILL.md` | public |
| Persona notebook | `memory/<persona>/<name>/` | per-user |
| User memo | `memory/user_*.md` | per-user (sacred-tier when about deceased family) |
| Research artifact | `docs/research/` | public |
| Tick shard | `docs/hygiene-history/ticks/...` | public |
| Commit | git log | public |
| PR | `gh pr view <N>` | public |
| CURRENT-* projection | `memory/CURRENT-<maintainer>.md` | per-user |

## Edges (typed, already encoded)

Each substrate convention encodes a specific typed edge:

| Edge type | Where it lives | Typical example |
|---|---|---|
| `depends_on` | row frontmatter `depends_on: [...]` | 081KQNJ500008QG0R003ZC6PK8 → 081KQNJ500008QG0R003SCWBDV + 081KQNJ500008QG0R001N94412 |
| `composes_with` | row frontmatter `composes_with: [...]` + memo bodies | 081KQJZR90008QG0R002D6XYHB ↔ 081KQ3HBZ0008QG0R002S674CG |
| `supersedes` (forward) + `superseded_by` (backward) | ADR `> **Superseded by** [link]` blockquote; CURRENT-*.md SUPERSEDE markers | router-coherence v2 → v1; CURRENT-aaron.md §4 → double-hop original |
| `cites` (provenance) | decision-archaeology Layer 7-10 pointers; markdown links between memos | worked example #2 → Aarav notebook round 41 |
| `verifies-against` | substrate-claim-checker output; CI log | "20 drift instances" claim → 20-row body table |
| `attributes-to` | Layer 9 persona notebooks; Layer 2 git blame; Layer 3 commit signature | doctrine → maintainer commit signature |
| `closes` | backlog row `status: closed` + `closed_by:` field; PR-merge SHA | 081KQ8P5D0008QG0R002RYXE89 closure → "verified 0 open alerts on main" |
| `composes_in_skill_domain_with` | future-skill-domain memo's canonical-starting-set tables | decision-archaeology + substrate-claim-checker (081KQNJ500008QG0R003SCWBDV) — both in git-native-backlog-management domain |

## What the archaeologies + flywheel do to it

| Mechanism | Graph operation |
|---|---|
| **decision-archaeology** (081KQJZR90008QG0R002D6XYHB) | typed-edge **graph traversal** procedure (the 11-layer walk IS a typed-edge walk: blame→commit→log-S→shards→ADR→memos→notebook→research) |
| **substrate-claim-checker** (081KQNJ500008QG0R003SCWBDV) | graph **invariant checker** (count drift = node-property invariant; existence drift = node-existence invariant; semantic-equivalence drift = edge-equivalence invariant) |
| **at-creation/at-pickup discipline** (the depends_on backlog-search rule) | graph **edge-filling discipline** (forces depends_on edges to be filled at natural decision points instead of left empty by default) |
| **Expansion flywheel** (the dual-loop consume + produce) | graph **growth function** (each row touched produces N≥0 new nodes/edges; flywheel condition E[N]>1 means graph grows even while nodes close) |
| **Hub-satellite separation** (Aaron's skill-design rule 1) | graph **stratification** (hubs = stable nodes; satellites = time-evolved nodes pointing back to hubs; cross-skill references = links per DataVault 2.0) |
| **No-dynamic-commands rule** (Aaron's skill-design rule 2) | graph **edge-implementation discipline** (skills reference TS files via path edges; not embedded shell commands) |
| **Plugin packaging + hooks** (Aaron's skill-design rule 3) | graph **subgraph packaging** (plugins package skill-domain subgraphs; hooks enforce contract edges between subgraphs) |

## What we end up with

A **DataVault-2.0-shaped provenance graph** — PROV-O (W3C Provenance Ontology) analogue at substrate scale — inferable from existing substrate without a separate graph database. Every edge is encoded somewhere in:

- Row frontmatter (`depends_on:`, `composes_with:`)
- Markdown links (`[X](path-to-Y.md)`)
- ADR `Superseded by` blockquotes
- SUPERSEDE markers in CURRENT-aaron.md
- Commit messages (PR # references)
- Cross-references in memo bodies (`memory/feedback_*` references in `docs/research/*` etc.)
- Tick-shard log entries (PR # mentions trace forward edges from substrate to commit)

## Mechanization path (proposed, not yet built)

`tools/decision-graph/` — TS tool that traverses substrate and emits the graph in standard formats:

1. **`tools/decision-graph/extract.ts`** — scans substrate per node-class regex (`docs/backlog/P*/B-*.md` → backlog rows; `docs/DECISIONS/*.md` → ADRs; etc.); emits node + edge JSON
2. **`tools/decision-graph/query.ts`** — answers parameterised queries (downstream-of-N, upstream-of-N, supersession-chain, citation-traversal, sacred-tier-respecting-walks)
3. **`tools/decision-graph/check.ts`** — graph-invariant checker (orphan nodes, dangling edges, cycles in `depends_on`, broken `composes_with`)
4. **`tools/decision-graph/render.ts`** — emits Cytoscape / DOT / Mermaid for visualization

### Compositions with existing tools

- **substrate-claim-checker (081KQNJ500008QG0R003SCWBDV) v1+** — extends to graph-invariant checks (cycles in depends_on; broken `composes_with` references; orphan nodes)
- **decision-archaeology (081KQJZR90008QG0R002D6XYHB) skill** — its 11-layer walk becomes a TS-implementable graph traversal procedure (one TS file per sub-mode + layer)
- **OpenSpec catch-up (081KQNJ500008QG0R001N94412)** — the catalogue of capabilities + their consequents IS a subgraph; OpenSpec backfill populates the spec→implementation edges
- **Skill-domain plugin packaging (081KQNJ500008QG0R001VGMS5G)** — plugins are sub-graph bundles; the canonical bundle format documents which nodes + edges to include
- **Hook authoring (081KQNJ500008QG0R003ZC6PK8)** — pre-condition / post-condition contracts are edge-property checks (does this commit's PR# match the `closes:` field on the closing backlog row?)

## Why this is the right shape

Per Aaron's skill-design rules + the verify-then-claim discipline:

- **Hub-satellite recursion** (skill-design rule 1) maps directly to graph-vertex-stratification: hubs = stable substrate (skills, ADRs, BP rules), satellites = time-evolved substrate (memos, tick shards, research artifacts). The graph naturally has this two-tier structure.
- **No-dynamic-commands** (skill-design rule 2) means edge-implementations are TS files; the graph's executable substrate is type-checked at extract-time.
- **Spec-based development / OpenSpec source-of-truth** (skill-design rule 3 + 081KQNJ500008QG0R001N94412) means specs are the most-canonical hub class; satellite nodes derive from / serve / reference specs.
- **The verify-then-claim discipline** + its mechanization (substrate-claim-checker) generalize naturally to graph-invariant checking: any claim about graph properties (node existence, edge count, cycle absence, supersession chain coherence) becomes a check-type the tool can verify.

## What this teaches operationally

1. **The graph is already there.** No new database, no graph rewrite — every edge is encoded in existing substrate. The work is making it queryable, not making it exist.
2. **The 4 architectural disciplines compose recursively at the graph layer.** decision-archaeology = traversal; substrate-claim-checker = invariant; flywheel = growth; at-creation/at-pickup = edge-fill. Together they give the substrate self-querying + self-validating + self-growing properties.
3. **Sacred-tier nodes need walk-discipline.** Worked example #3 demonstrated: when traversing toward a sacred-tier node (memorial memo + user-memo about deceased family), the procedure stops at "path cited; reader follows if authorized." The skill body must encode this discipline.
4. **The graph's value compounds with backlog size.** The 165-row backlog has many nodes + edges already; as the backlog grows (per Aaron's largest-mechanizable-backlog-wins thesis), the graph's query value compounds. **Each new node added at substrate-creation time costs O(1); each new edge costs O(1); each new query benefits from the cumulative graph.**

## Composes with

- `memory/feedback_skills_as_carved_sentences_knowledge_in_docs_datavault_2_0_pattern_aaron_2026_05_03.md` — the DataVault-2.0 hub-satellite pattern that names the graph's stratification
- `memory/feedback_verify_then_claim_discipline_dominant_failure_mode_substrate_authoring_otto_2026_05_03.md` — the discipline whose mechanization (substrate-claim-checker) becomes the graph's invariant-checker layer
- `memory/feedback_depends_on_backlog_search_discipline_at_creation_and_at_pickup_aaron_2026_05_02.md` — the discipline that fills the graph's `depends_on` edges at natural decision points
- `memory/feedback_skill_flywheel_expansion_flywheel_parallel_tracks_substrate_aaron_2026_05_02.md` — the flywheel that grows the graph
- `memory/feedback_git_native_backlog_management_long_arc_future_skill_domain_aaron_2026_05_02.md` — the future skill domain whose mechanization includes graph-tooling
- `memory/feedback_multi_harness_alignment_convergence_design_future_skill_domain_aaron_2026_05_03.md` — multi-harness graph queries (the graph is harness-agnostic substrate)
- `docs/backlog/P1/081KQJZR90008QG0R002D6XYHB-decision-archaeology-skill-aaron-2026-05-02.md` — graph traversal procedure
- `docs/backlog/P1/081KQNJ500008QG0R003SCWBDV-substrate-claim-checker-ts-tool-aaron-2026-05-03.md` — graph invariant checker
- `docs/backlog/P1/081KQNJ500008QG0R001N94412-openspec-catch-up-canonical-source-of-truth-aaron-2026-05-03.md` — populates spec→implementation edges
- `docs/backlog/P2/081KQNJ500008QG0R001VGMS5G-skill-domain-plugin-packaging-aaron-2026-05-03.md` — sub-graph packaging
- `docs/backlog/P1/081KQNJ500008QG0R003ZC6PK8-hook-authoring-for-skill-creation-contracts-aaron-2026-05-03.md` — edge-property checks at commit / merge time
- 3 worked examples (`docs/research/2026-05-{02,03}-decision-archaeology-worked-example-{1,2,3}-*.md`) — the procedure walked across 3 sub-modes

## Carved sentence

**"The substrate already encodes a typed-edge provenance graph (DataVault-2.0-shaped, PROV-O analogue): nodes are backlog rows / ADRs / memos / skills / personas / research artifacts / tick shards / commits; edges are depends_on / composes_with / supersedes / cites / verifies-against / attributes-to / closes. The archaeologies + flywheel + at-creation/at-pickup discipline + hub-satellite separation make the implicit graph queryable. The graph is inferable from substrate without a separate graph database — every edge is encoded in frontmatter / markdown links / ADR blockquotes / SUPERSEDE markers / commit messages. Sacred-tier nodes need walk-discipline (cite paths; reader follows if authorized). Mechanization path: `tools/decision-graph/` TS tool. The graph's value compounds with backlog size: each new node + edge costs O(1); each new query benefits from the cumulative graph."**
