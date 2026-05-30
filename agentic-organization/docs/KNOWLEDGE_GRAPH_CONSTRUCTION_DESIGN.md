---
title: Knowledge Graph Construction — Building Nodes, Edges, and Intelligence
canonical_name: Agentic Organization
status: design
---

# Knowledge Graph Construction — Building Nodes, Edges, and Intelligence

How the organization actually *builds* the knowledge graph that powers codebase
intelligence, document intelligence, and self-consultation: how nodes are
extracted, how edges are inferred (and with what confidence + provenance), how the
graph is validated and incrementally rebuilt, how the "intelligence" (architecture
summaries, ownership, risk, impact) is layered on top, and **who builds it**.

This is the construction process behind:
[`AGENT_NATIVE_KNOWLEDGE_GRAPH.md`](AGENT_NATIVE_KNOWLEDGE_GRAPH.md) (the node/edge
schema, provenance envelope, versioned/reversible edges, storage),
[`ADAPTIVE_ORGANIZATION_PLATFORM_DESIGN.md`](ADAPTIVE_ORGANIZATION_PLATFORM_DESIGN.md)
Part 5 (codebase intelligence), and
[`DOCUMENT_INTELLIGENCE_DESIGN.md`](DOCUMENT_INTELLIGENCE_DESIGN.md) Part B (the doc
entity graph). The graph is **one graph** — code, docs, work, decisions, and memory
all emit nodes/edges into it.

## Thesis

> **Two passes, never conflated.** A *deterministic* pass extracts everything a
> parser can prove (manifests, imports, AST, API specs, config) as high-confidence
> nodes + structural edges with zero model calls. An *enrichment* pass has agents
> add the semantic layer (ownership, risk, architectural role) as lower-confidence,
> provenance-tagged, reversible edges that can be human-verified. Every node and
> edge carries a **confidence tier** and **provenance**, so "the parser found this
> import" is never confused with "an agent guessed this team owns it." Construction
> is **incremental, idempotent, validated, and itself work** — owned by the
> Architecture department (code) and the Documentation department (docs), traced as
> `org_event`s, human-gated for load-bearing edges.

## The confidence tiers (every node + edge carries one)

Reusing the labeling-confidence discipline, applied to the graph:

| Tier | Meaning | Source | Retrieval trust |
|------|---------|--------|-----------------|
| `extracted` | a parser proved it (an import exists, a manifest declares a dep) | deterministic pass | high; reproducible |
| `inferred` | an agent reasoned it (this service is the payments boundary; this path is risky) | enrichment pass | medium; may need verify |
| `verified` | a hat/human confirmed an inferred node/edge | review | high |
| `canonical` | reviewed + bound as a standard (the System Architecture handbook's claims) | documentation gate | highest |
| `retracted` | proven wrong; kept with the correction (retraction-native) | drift / review | excluded |

Confidence feeds retrieval ranking (Part D of doc-intelligence) and tells an agent
how much to trust an edge. An `inferred` ownership edge is a hypothesis the org can
act on but should confirm; an `extracted` dependency edge is fact.

---

## Part 1 — Node extraction (where nodes come from)

Per source, the **deterministic** extractors (zero model calls, reproducible) and
what they emit:

### Codebase (the first-entry problem)

| Source artifact | Extractor (deterministic) | Nodes emitted |
|-----------------|---------------------------|---------------|
| `package.json` / `go.mod` / `pom.xml` / `Cargo.toml` / `pyproject.toml` | manifest parse | `Package`, declared deps |
| directory + manifest + service boundary heuristics (one deployable per manifest/Dockerfile/chart) | boundary detection | `Service`, `Module` |
| OpenAPI / protobuf / route definitions / GraphQL schema | spec parse | `Endpoint` |
| IaC, DB connection config, `docker-compose`, helm values | config parse | `DataStore`, `Queue`, `Cache` |
| source files | path index | `CodePath` |
| CI/CD config (`.github/workflows`, pipelines) | pipeline parse | `Deployment`, `Environment` |
| `CODEOWNERS`, commit history | ownership parse | candidate `owned_by` edges (still `inferred` until confirmed) |

### Documents

Structural decomposition → `DocUnit` nodes (per [doc-intelligence](DOCUMENT_INTELLIGENCE_DESIGN.md)
Part A); entity extraction → `Entity` nodes (services, terms, systems).

### Work + decisions (the org's own activity)

Already emitted by the Work OS as it runs: `WorkItem`, `WorkBatch`, `Gate`,
`Decision/ADR`, `Run`, `TestRun`, `Release` are nodes the moment the work happens —
no separate ingestion. The org's *own* graph builds itself by doing work.

**Idempotent identity:** every node id is content-addressed
(`uuidv5(tenant:kind:sourceKey)`), so re-extraction updates a node in place rather
than duplicating — the same discipline as docs + memory.

---

## Part 2 — Edge inference (the heart of "how")

Edges are where the intelligence lives. Three classes, by how they're produced:

### Deterministic edges (`extracted` — a parser proved it)

| Edge | Inferred from | Confidence |
|------|---------------|------------|
| `depends_on` | manifest deps + import statements | `extracted` |
| `calls` | static call graph / route references / client SDK usage | `extracted` |
| `exposes` | service → its endpoints (from the spec) | `extracted` |
| `persists_to` | service → datastore (from config/connection strings) | `extracted` |
| `deploys_to` | service → environment (from CI/CD) | `extracted` |
| `tested_by` | test file → target (from test→source mapping) | `extracted` |
| `part_of` | module → service → repo | `extracted` |

These re-derive identically on every run; a structural diff updates only the
changed edges.

### Inferred edges (`inferred` — an agent reasoned it)

The enrichment pass: an architecture hat reads the skeleton + key files and adds the
semantic edges a parser cannot — `owned_by` (which hat/team owns a service, where
CODEOWNERS is absent), `architectural_role` (this is the payments boundary / the
read model), `risk` (this path reverts often / handles money / lacks tests),
`impacts` (changing X likely breaks Y, beyond the static graph). Each carries
provenance (which agent, which evidence, a confidence number) and is **reversible**.

### Verified edges (`verified` — a hat/human confirmed it)

`inferred` edges on load-bearing topics (ownership, security boundaries, risk) route
through review (a hat decides; human-gated per the autonomy dial). Confirmation
promotes the tier `inferred → verified`; rejection retracts it (kept with the
correction). Determinism computes the *candidate* edge; a hat confirms; the kernel
records — the same observe→decide shape as everywhere.

---

## Part 3 — Entity resolution + canonicalization

Multiple mentions → one canonical node. "the billing service", "Billing", and
`services/billing` resolve to one `Service` node (a dictionary + embedding-assisted
match, deterministic-first with agent tie-breaks). Duplicate nodes merge; conflicts
(two sources claim different owners) surface as a flagged conflict + a `supersedes`
edge by recency/authority — **never silently merged**. This is the same
canonicalization the doc layer uses (one source of truth per entity).

---

## Part 4 — The construction pipeline (bootstrap + incremental)

```text
BOOTSTRAP (first entry into a large codebase / doc corpus):
  connect source
   → deterministic scan: extract all nodes + structural edges   ← zero model calls, reproducible
   → entity-resolve + dedup + canonicalize
   → persist the SKELETON graph (all `extracted`)               ← usable immediately
   → enrichment pass (agents, in priority order — busiest/riskiest services first):
        infer owned_by / architectural_role / risk / impacts    ← `inferred`, provenance-tagged
   → validate (Part 5)
   → route load-bearing inferred edges to review                ← `verified` on confirm
   → write the derived intelligence (Part 6) as handbooks/nodes
   → emit graph_node_added / edge_inferred / edge_verified org_events

INCREMENTAL (steady state, on every commit / doc edit):
  source change webhook
   → re-extract ONLY the affected subgraph (content-addressed diff)
   → supersede changed edges (versioned, reversible)
   → re-run enrichment for the touched nodes only
   → DRIFT check: a doc/handbook whose `about` node changed → flag stale (→ work item)
   → validate the delta
```

The skeleton is **usable the moment the deterministic pass finishes** — the org can
route and reason about services from facts before any enrichment. Enrichment +
verification raise the fidelity over time. Incremental rebuild is diff-based +
idempotent, never a full re-scan.

---

## Part 4b — The construction job: the concrete technology and the doc → graph path

The prior parts are the *shape*. This is the *engineering reality* — what actually
runs, which libraries, and the literal path from a raw document to nodes/edges.

### What runs it (the job is a Work OS work item)

There is no separate "graph service." **Construction is a work item** (type
`capability_request`/`task`, owned by a Documentation/Architecture hat) executed by
the **deployed worker** (`apps/workers` — the same process host that runs the org
cycle, proved in kind). It is triggered three ways:

- **Onboarding** → a batch of construction work items (one per source).
- **Source change** → a NATS message on `org.intake.doc` / `org.intake.repo`
  (a Confluence webhook, a git post-receive hook) → one incremental work item.
- **Schedule** → the maintenance cycle (Part J of doc-intelligence) enqueues re-scans.

The worker runs the **deterministic stages in-process (native TS)** and calls the
**model backend** (the Phase-14 in-cluster Ollama composer, legal-set-clamped +
hat-guardrailed) only for the two stages that need judgment. No new runtime.

### The technology, stage by stage

| Stage | Concrete technology | Det / agent |
|-------|---------------------|-------------|
| **Fetch** | connector SDKs (Confluence/Notion/Jira REST), `git` clone for repos, `pdf-parse`/`pdfjs` for PDFs, `node:fs` for local | det |
| **Normalize** | HTML → markdown via `turndown`; PDFs → text + heading heuristics | det |
| **Parse to structure** | **`unified` + `remark-parse` → mdast** (markdown AST); walk the heading tree to split into `DocUnit`s preserving the breadcrumb path | det |
| **Classify type/scope** | path/title heuristics first (`ADR-*`→decision, `/runbooks/`→runbook, folder→scope); **one clamped Ollama classification call** only when ambiguous (returns a legal `DocType` enum, same clamp as the composer) | det + agent-fallback |
| **Extract entities** | **gazetteer match** against known nodes (service names from the codebase graph, glossary) via trigram/fuzzy (`fast-fuzzy`); **Ollama NER call** only for misses | det + agent-fallback |
| **Resolve entities** | embedding cosine via **Hindsight** over same-scope candidates + a dedup threshold → one canonical node | det |
| **Embed** | **Hindsight `retain`** (it embeds via its Ollama model, e.g. `nomic-embed-text`) — we never run a vector store ourselves | det (Hindsight) |
| **Infer edges** | `part_of`/`references` straight from the **mdast** (the doc's own headings + links); `defines`/`about` from extracted entities; semantic edges via a **bounded Ollama call** | det + agent |
| **Dedup/conflict** | `uuidv5(tenant:source:unitPath)` idempotency + Hindsight cosine near-dup + same-(topic,scope) conflict flag | det |
| **Persist** | **CockroachDB** (the existing `createCockroachSqlExecutor` + parameterized INSERT/UPSERT) for unit rows + `graph_edges`; **git** (the `frontmatter-db` package) for canonical handbooks; **Hindsight** for body+embedding | det |
| **Trace** | `appendEvent` → `doc_ingested` / `graph_node_added` / `edge_inferred` org_events | det |

(Exact library pins confirmed at build per the search-first dep discipline; the
*categories* — markdown-AST, fuzzy-match, Hindsight-recall, the existing Cockroach
executor — are fixed.)

### The literal pipeline (the construction work item's body)

```ts
async function runDocConstruction(job: DocConstructionJob, deps: ConstructionDeps) {
  const raw   = await deps.connector.fetch(job.sourceRef);          // SDK / git / pdf-parse
  const md    = normalizeToMarkdown(raw);                           // turndown / pdf heuristics
  const ast   = unified().use(remarkParse).parse(md);              // → mdast (deterministic)
  const units = splitByHeadings(ast, job);                          // DocUnit[] with breadcrumb paths
  for (const u of units) {
    u.type    = classifyByHeuristics(u) ?? await deps.model.classify(u, LEGAL_DOCTYPES); // clamped
    u.entities = resolveEntities(extractEntities(u, deps.gazetteer), deps.hindsight);     // match→cosine
    const edges = edgesFromAst(u, ast)                              // part_of / references (deterministic)
                  .concat(await deps.model.inferEdges(u, ENTITY_NODES)); // semantic (inferred, tagged)
    if (await deps.existsByKey(u.unitId)) await deps.cockroach.upsertUnit(u);  // idempotent
    else                                  await deps.cockroach.insertUnit(u);
    await deps.cockroach.upsertEdges(edges);
    await deps.hindsight.retain(u.body, { metadata: tagsFor(u) });  // embed + recall
    await deps.appendEvent(graphNodeAdded(u)); for (const e of edges) await deps.appendEvent(edgeEvent(e));
  }
  if (job.canonicalize) await deps.git.writeHandbook(canonicalize(units)); // markdown-as-row, PR-reviewable
}
```

Deterministic stages are pure TS over the AST; the only awaited *model* calls are
`classify` (fallback) and `inferEdges` (semantic) — both clamped + guardrailed.

### Worked path: a Confluence "How We Write BRDs" page → the graph

```text
Confluence page (HTML)
  → turndown → markdown → remark → mdast (H1 "How We Write BRDs", H2 "Sections", H2 "Acceptance Criteria", a table)
  → splitByHeadings → 3 DocUnits (intro, sections-procedure, acceptance-criteria) with paths
  → classify: title matches handbook heuristic → type=handbook, scope=process:brd  (no model call)
  → extract entities: "BRD", "acceptance criteria" → glossary nodes; "Billing" → service:billing (gazetteer hit)
  → edges: part_of(units→doc→handbook:how-we-write-brds), about(doc→process:brd), references(→service:billing)
  → Hindsight.retain each unit body (embedded via Ollama)
  → Cockroach: 3 doc_unit rows + 5 graph_edge rows; git: handbook markdown (→ in_review, human-gated)
  → org_events: doc_ingested, 3× graph_node_added, 5× edge_inferred
  → bound to the BRD workflow stage → consulted deterministically whenever a BRD is authored
```

### Codebase → graph (the same job, different parsers)

```text
repo (git clone)
  → manifest parse (package.json/go.mod/…) → Package nodes + depends_on edges        [extracted]
  → dep/import graph: dependency-cruiser / madge (JS/TS), or tree-sitter per language → calls/depends_on
  → service boundaries (Dockerfile/chart/manifest dirs) → Service/Module nodes
  → OpenAPI/proto parse (swagger-parser/protobufjs) → Endpoint nodes + exposes edges
  → config/IaC parse → DataStore nodes + persists_to edges
  → CODEOWNERS/commit history → candidate owned_by edges (inferred until confirmed)
  → persist skeleton (Cockroach + Hindsight on key files) → USABLE NOW
  → enrichment work item: an architect hat reads the skeleton + key files →
       owned_by / architectural_role / risk / impacts  (Ollama, inferred, provenance-tagged)
  → architecture-summary handbook written to git (canonical, human-gated)
```

Polyglot caveat: the **structural** extractors are per-language (tree-sitter
grammars, or the language's own dep tool); the **graph schema, the enrichment, the
storage, and the job harness are language-agnostic**. Adding a language = adding a
parser adapter behind the same `extractNodes`/`extractEdges` port, not new
architecture.

### Why this is tractable, not hand-wavy

- The hard, novel parts (embeddings, hybrid recall, reranking) are **delegated to
  Hindsight** — we do not build a vector store or an ML pipeline.
- The extraction is **standard parsing** (mdast, dependency graphs, OpenAPI) —
  mature libraries, deterministic, testable.
- The orchestration is **the Work OS + the worker we already proved in kind** — the
  construction job is just another typed, traced, guardrailed work item.
- The only model usage is two bounded, clamped calls — classification-fallback and
  semantic enrichment — on the in-cluster Ollama backend we already run.

So `doc → graph` is: **parse (libraries) → match (gazetteer + Hindsight) → emit
edges (from the AST) → persist (Cockroach + git + Hindsight) → trace** — run as a
work item by the existing worker, with two small clamped model calls for judgment.

---

## Part 5 — Validation + graph health

A validation pass (deterministic) after every build/delta, surfaced as a graph-
health metric and `graph_validation` events:

- **Dangling edges** (edge to a non-existent node) → repair or drop.
- **Orphan nodes** (a service no edge connects to) → flag for enrichment.
- **Conflicts** (two `owned_by` edges, divergent values) → surface, don't merge.
- **Illegal cycles** (a `depends_on` cycle where the architecture forbids it) → flag
  as an architecture finding (becomes a work item).
- **Stale-by-drift** (an `inferred`/`canonical` edge whose underlying `extracted`
  facts changed) → demote + re-enrich.
- **Confidence audit** (too many unverified load-bearing edges) → schedule review.

Graph health is a first-class metric a Director/architect observes (the W2 scoped
readout), so the graph's *trustworthiness* is visible, not assumed.

---

## Part 6 — Building "intelligence" on top of the graph

Nodes + edges are the substrate; **intelligence** is the derived layer agents build
over it, stored as derived nodes + handbooks with the same provenance/confidence:

- **Architecture summary** — per service: role, dependencies, data, risks → a
  `System Architecture` handbook (canonical, human-gated), bound to the architecture
  stage so it's always consulted there.
- **Ownership map** — service → owning hat/department (the `owned_by` edges rolled
  up); drives assignment + routing.
- **Impact analysis** — a *query*, not stored: "what breaks if I change this
  endpoint" = traverse `calls`/`depends_on` from the node. Computed on demand from
  the graph, always current.
- **Risk map** — `risk`-tagged paths/services → drives QA prioritization + review
  rigor (a risky path requires a stability review, per the business-gate routing).

These derived artifacts are **re-derivable** from the graph, so when the graph
updates, the intelligence updates — and they carry confidence, so an agent knows
which conclusions are facts vs hypotheses.

---

## Part 7 — Who builds it (construction as owned work)

Graph construction is **work**, owned by real hats, traced and gated — not a hidden
batch job:

| Layer | Owner (seed hats) | Gate |
|-------|-------------------|------|
| Codebase skeleton (extracted) | `architecture` / `chief_architect` + a structural-scan process | none (deterministic) |
| Codebase enrichment (inferred) | `architect`, `architecture_reviewer` | `architecture_approval` for load-bearing edges |
| Doc graph + entities | `skill_graph_curator`, `design_doc_steward` (Documentation dept — already in the seed; `skill_graph_curator` literally owns "skill graph quality") | `documentation_gate` |
| Validation + drift remediation | the owning department | becomes a work item |

Construction respects the **hat guardrails**: the structural scan is a tool a
codebase-intelligence process runs; *inferring* architecture is an architecture-hat
action (an IC implementer cannot author canonical architecture edges). Building the
graph is the same observe→decide + trace + guardrail discipline as all org work, and
every load-bearing edge is human-gated per the customer's autonomy dial.

---

## Part 8 — Storage, versioning, and the one-graph composition

- **Cockroach**: nodes + edges + `graph_node_versions` (the existing storage shape)
  + provenance + confidence + the validation/health state — queryable, versioned.
- **git**: the canonical derived artifacts (architecture handbooks, ADRs) as
  markdown-as-row — diffable, PR-reviewable.
- **Hindsight**: node/unit bodies + embeddings for the recall lens.
- **One graph:** code, docs, work, decisions, and memory share the same node/edge
  space joined by ids — so a retrieved doc unit traverses to the service it
  describes to the work that changed it to the decision that approved it. The three
  intelligences (codebase / docs / org-memory) are three *lenses* on one graph.

Every construction action is a versioned, reversible, provenance-bearing edit (the
edge contract) emitting an `org_event` — so "why does the graph say service X
depends on Y, who inferred it, when, with what confidence, what verified it" is one
trace query.

---

## Part 9 — Determinism ⇄ autonomy

| Concern | Deterministic | Agent-driven |
|---------|---------------|--------------|
| Node extraction | parsers (manifests/AST/specs/config) | — |
| Structural edges | parsed (`extracted`) | — |
| Entity resolution | dictionary + content-addressed ids | tie-breaks for new entities |
| Semantic edges | candidate generation bounded by the graph | the inference (`inferred`) |
| Verification | the tier-promotion rules | a hat confirms (`verified`) |
| Validation | the health checks | remediation decisions |
| Intelligence | re-derivable queries (impact) | the summaries/risk (handbooks) |
| Incremental rebuild | diff-based, idempotent | re-enrichment of touched nodes |

The kernel guarantees the graph is *built from facts, validated, versioned, and
trust-tiered*; agents supply the semantic judgment, bounded by the facts and
confirmed before it becomes canonical. **Facts are extracted; meaning is inferred;
canonical is earned.**

---

## Part 10 — Build phases (composes with C5 codebase + D2 doc-graph)

| Phase | Deliverable |
|-------|-------------|
| **G1** | Node/edge domain with confidence tiers + provenance; Cockroach `graph_nodes`/`graph_edges`/`graph_node_versions`; content-addressed ids. |
| **G2** | Deterministic codebase extractors (manifests, imports, specs, config, CI) → skeleton graph; idempotent + incremental diff. |
| **G3** | Entity resolution + canonicalization + conflict handling (shared with doc-graph). |
| **G4** | Enrichment pass (inferred edges: owned_by/role/risk/impacts) with provenance + the verify→tier-promote flow (human-gated). |
| **G5** | Validation + graph-health metric + drift → work item. |
| **G6** | Derived intelligence (architecture summary handbook, ownership/risk maps, on-demand impact query). |
| **G7** | **Kind proof:** point at a sample multi-service codebase + docs → build the skeleton graph (extracted), enrich a service (inferred owner/risk), verify one edge (→ verified), run an impact query (what breaks if endpoint X changes), make a code change → incremental rebuild supersedes the right edges + flags a drifted doc as a work item — all observed in `org_events` with confidence tiers visible. |
