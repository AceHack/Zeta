---
title: Document Intelligence — Ingestion, Organization, Retrieval (smarter than RAG)
canonical_name: Agentic Organization
status: design
---

# Document Intelligence — Ingestion, Organization, Retrieval

How the organization ingests an external company's existing documentation
(Confluence, Notion, Google Docs, wikis, READMEs, PDFs, ADRs), **organizes** it
into a canonical knowledge layer, and **retrieves** it in a way that is decisively
smarter than naive RAG — and how the same machinery serves the org's *own* growing
documentation.

This extends [`ADAPTIVE_ORGANIZATION_PLATFORM_DESIGN.md`](ADAPTIVE_ORGANIZATION_PLATFORM_DESIGN.md)
Parts 5–6 and reuses the [memory system](DYNAMIC_MEMORY_SYSTEM_DESIGN.md)
(Hindsight recall engine + the weight/tier/pointer machinery) and the
[knowledge graph](AGENT_NATIVE_KNOWLEDGE_GRAPH.md).

## Why naive RAG is not enough (the bar we must beat)

Naive RAG = split every doc into fixed chunks → embed → top-k cosine → stuff into
the prompt. It fails predictably:

| Naive RAG failure | Root cause |
|-------------------|------------|
| Retrieves a chunk that *looks* relevant but is from the wrong team/project/era | no **scope** — searches the whole corpus |
| Shreds a procedure across chunks; the agent sees step 3 without steps 1–2 | no **structure** — arbitrary chunk boundaries |
| Returns a superseded policy next to the current one with no signal | no **provenance / conflict / freshness** |
| Ranks a never-useful doc high because it's lexically similar | similarity ≠ **usefulness** |
| Dumps 12 chunks (8k tokens) when one summary + a pointer would do | no **resolution control** |
| Misses the doc that uses different words for the same entity | no **entity linking** |
| Agent forgets to retrieve, or retrieves the wrong thing | retrieval is an **agent choice**, not a guarantee |

> **The thesis:** every "smarter than RAG" technique is the same move — *restore the
> structure the embedding threw away.* We treat the corpus as a **typed, scoped,
> graph-linked, provenance-weighted knowledge layer**, not a flat bag of chunks.

---

## Part A — Organization: the document ontology (how docs are organized)

Before retrieval can be smart, organization must be. Every ingested unit is placed
on three axes, so retrieval can pre-filter by them deterministically:

1. **Type** (what kind of doc): `handbook` (how-we-do-X), `policy`, `architecture`,
   `runbook`, `decision/ADR`, `reference/api`, `glossary`, `onboarding`,
   `meeting/decision-record`. Type drives *which stage consults it* and *how it's
   ranked* (a policy outranks a stale meeting note for a compliance question).
2. **Scope** (where it belongs): `org` / `department` / `project` / `service` /
   `process` — the same tier ladder as memory. A doc about the billing service is
   `service:billing`. Scope is the single biggest recall lever RAG lacks.
3. **Binding** (who/when consults it): pointers to the hats + workflow stages that
   should *always* see it (a BRD handbook is bound to the BRD-authoring stage).

### Structural decomposition, not chunking

A doc is parsed to its **structure** (heading tree / markdown AST / table / code
block / list), and ingested at the level of **semantic units** — a section, a
procedure, a definition, a decision — each preserving its position in the doc and
its cross-references. A procedure stays whole; a definition keeps its term. Each
unit is a node:

```ts
type DocUnit = {
  unitId: string;            // stable pointer
  docId: string; tenantId: string;
  type: DocType; scope: { kind: ScopeKind; id: string };
  heading: string; path: readonly string[]; // breadcrumb within the doc
  body: string;              // the unit text (Hindsight-embedded)
  entities: readonly string[];   // canonical entity ids mentioned (Part B)
  references: readonly string[]; // pointers to other units it links to
  provenance: { source: string; author?: string; sourceUrl?: string; lastModified: string };
  freshnessAt: string; supersededBy?: string;
  status: "draft" | "active" | "superseded" | "archived";
};
```

### Canonicalization (one source of truth, not 40 wiki pages)

On ingest we **dedup + reconcile**: near-duplicate units are merged; when two units
on the same topic conflict, a `supersedes` edge (by recency/authority) or a flagged
conflict is recorded — never silently averaged. The output is a **canonical
handbook per topic** (one "System Architecture", one "How We Write BRDs"), with the
scattered sources linked beneath it. Canonical handbooks for load-bearing practices
go through a **human-gated review** (per the tenant's autonomy dial) before they are
trusted as the org's standard.

---

## Part B — The entity + knowledge graph (the structure RAG lacks)

Extract **canonical entities** (services, systems, terms, teams→departments,
people→hats, data stores) and link every mention across docs/code to the entity
node. This is what lets "the billing service", "Billing", and `services/billing`
resolve to **one node** — then traversal finds *everything* about it, regardless of
wording (recall RAG cannot match).

Edges (typed, provenance-bearing, reversible): `part_of` (unit→doc→handbook),
`references`, `supersedes`, `defines` (unit→entity), `about` (doc→entity/service),
`owned_by` (doc/service→hat), `consulted_at` (handbook→workflow stage),
`derived_from` (canonical→source). The doc graph **shares the same graph** as the
codebase intelligence (Part 5) and the work graph — so a retrieved doc unit can
traverse to the *service* it describes, the *decision* that changed it, the *work*
that produced it.

---

## Part C — Ingestion pipeline (how we ensure proper ingestion)

Deterministic where possible, agent-enriched where it adds value, idempotent
throughout:

```text
connector (Confluence / Notion / GDrive / wiki / repo / PDF)
  → fetch + de-dup (content-addressed: uuidv5(source:docId@version))  ← idempotent
  → parse to structural units (heading tree / AST / tables / code)     ← deterministic
  → classify type + scope                                              ← heuristics + agent enrichment
  → entity-extract + link to canonical entities                        ← agent + dictionary
  → dedup / conflict-detect / staleness-check                          ← deterministic over the graph
  → store: body → Hindsight (tags = type+scope+entities); structure +
           metadata + graph edges → Cockroach/git; pointers everywhere
  → canonicalize load-bearing handbooks (human-gated per autonomy)
  → emit doc_ingested / doc_superseded / doc_conflict org_events
```

- **Idempotent + incremental:** re-ingest on a source change updates only the
  affected units + edges (a content-addressed key per unit), never a full re-embed.
- **Provenance preserved:** every unit keeps its source, author, URL, and
  last-modified — load-bearing for ranking + trust + the pointer-index discipline.
- **Two-store split (reuses the memory design):** **Hindsight** holds the unit
  bodies + embeddings + the vector/BM25/graph/temporal recall; **Cockroach/git**
  holds the structure, the ontology axes, the entity graph, the canonicalization,
  and the org_event trace. Joined by `unitId`.

---

## Part D — Retrieval: the smarter-than-RAG pipeline

Retrieval is a **multi-stage pipeline**, each stage adding back structure RAG
discards. Stages 1–2 are cheap deterministic pre-work that shrink the search space
*before* any embedding similarity runs:

### Stage 1 — Scope pre-filter (deterministic; the biggest win)

The active context — the **hat**, the **workflow stage**, the **work item** and the
**services it touches** — defines the *legal document scope*: this department's
handbooks, this project's docs, the touched services' runbooks, the stage's bound
handbooks. The corpus collapses from N to the relevant slice **with zero model
calls**. (RAG searches everything; most of its false positives are out-of-scope.)

### Stage 2 — Entity resolution (graph-anchored, not raw-query-embedded)

Resolve the query's entities to canonical nodes (Part B). A question about billing
anchors on the `service:billing` node; we can now retrieve *via the graph* — its
runbook, its architecture unit, the ADR that changed it — not just lexical matches.

### Stage 3 — Hybrid recall over the scoped slice (Hindsight)

Within the scoped slice, Hindsight runs vector + BM25 + temporal + graph recall
with rerank/RRF. Because the slice is already scoped + entity-anchored, recall is
high-precision, not corpus-wide guessing.

### Stage 4 — Multi-resolution (summary-first, drill on demand)

Return a **map first**: the relevant *docs* + their generated summaries + pointers
— not raw chunks. The agent (or the next deterministic step) **drills into a
specific unit by pointer only when needed**. This is the single biggest token +
precision win over RAG's "dump top-k chunks": the agent gets an index it can
navigate, expanding 1–2 units instead of ingesting 12. (Same pointer-index
discipline as Aaron's `(location → content)` memory.)

### Stage 5 — Graph augmentation (context, not just the hit)

From a retrieved unit, expand along edges: the *procedure* a step belongs to
(`part_of`), the *current* version (`supersedes`), the *decision* that set a policy
(`derived_from`), the *service* a runbook is about (`about`). The agent gets the
unit **in its context**, never orphaned.

### Stage 6 — KPI-weighted rerank (usefulness, not just similarity)

The final rank is the **memory weight** applied to docs, not cosine alone:

```text
score = w_sem·semantic + w_fresh·freshness + w_auth·authority
      + w_util·utility + w_scope·scopeMatch
```

- **freshness** decays superseded/old docs; below the floor they're excluded.
- **authority** = doc type + canonical status (a reviewed handbook ≫ a stray note).
- **utility** = the memory self-tuning signal: *docs that, when consulted,
  correlated with good work-outcomes surface more; consulted-but-never-helpful docs
  sink.* The corpus learns which docs actually help — RAG never does.

### Stage 7 — Conflict + staleness handling

If two in-scope units conflict, **surface both with the conflict flag** (don't
silently pick one); prefer the canonical/current and name the superseded. Archived
units never surface. Stale-but-current units are flagged so the agent weights them.

### Stage 8 — Deterministic consultation (retrieval is a guarantee, not a hope)

Per the memory reliability discipline, the load-bearing case is **not** the agent
remembering to search. A workflow stage **deterministically consults** its bound
handbooks (`consult_handbook(handbookId)` injects them); **structural triggers**
fire scope retrieval (IF the work touches `service:billing`, inject its runbook +
architecture). The agent *additionally* queries when it wants — but it can never
*skip* the bound consult. This is the precision RAG structurally cannot provide.

---

## Naive RAG vs. this pipeline (side by side)

| Dimension | Naive RAG | Document Intelligence |
|-----------|-----------|------------------------|
| Unit | arbitrary fixed chunk | structural semantic unit (section/procedure/decision) |
| Search space | whole corpus | scope-pre-filtered slice (Stage 1) |
| Query | embed raw text | entity-resolved + graph-anchored (Stage 2) |
| Recall | vector top-k | vector+BM25+temporal+graph over the slice (Stage 3) |
| Output | top-k chunks dumped | summary-map + drill-by-pointer (Stage 4) |
| Context | the chunk alone | unit + graph neighborhood (Stage 5) |
| Ranking | cosine | semantic×freshness×authority×**utility**×scope (Stage 6) |
| Conflicts | silently mixed | surfaced + superseded-aware (Stage 7) |
| Trigger | agent searches (forgettable) | deterministic consult + structural triggers (Stage 8) |
| Learning | none | utility self-tunes on outcomes |

---

## Part E — Building handbooks *from* ingested docs, and consulting our own

- **Handbooks are synthesized, not just stored.** Ingestion + canonicalization
  produce the tenant's handbooks (one "How We Write BRDs" distilled from their
  examples + scattered pages), bound to the stages that consult them. This is how
  "inject their business practices" becomes operational: the practice is a
  consulted handbook, not tribal knowledge.
- **The org consults its own docs the same way.** As the org builds a large system,
  its own architecture/decisions/handbooks are ingested into the same layer (over
  Cockroach/git, pointer-addressed). A `consult` step retrieves them with the same
  smarter-than-RAG pipeline. One knowledge layer, three lenses: **memory** (what
  worked), **codebase** (how it's built), **docs/handbooks** (how we do things) —
  all sharing the graph, the pointers, the weight, and Hindsight.

---

## Part F — Where docs live (concrete storage + addressing)

The two-store split (Part C), made concrete:

| Store | Holds | Why |
|-------|-------|-----|
| **CockroachDB** | `agentic_org_doc_sources` (connector config + per-source sync cursor), `agentic_org_doc_units` (structure, ontology axes, status, freshness, provenance), `agentic_org_doc_graph_edges`, `agentic_org_doc_entities`, `agentic_org_doc_consult_ledger` (which unit was consulted at which stage/work → the utility signal) | queryable structure + lifecycle state + the consult/outcome join |
| **git** (the [git-as-DB substrate](GIT_COCKROACH_SYNC_AND_ZETAID_ADDRESSING.md)) | the **canonical handbooks** as markdown-as-row — diffable, versioned, reviewable by PR; the source of truth for prose | a handbook is a document humans + agents edit; git gives history, review, and blame |
| **Hindsight** (per the [memory design](DYNAMIC_MEMORY_SYSTEM_DESIGN.md)) | unit **bodies** + embeddings + the vector/BM25/graph/temporal recall, tagged `type+scope+entities` | the recall engine — never CockroachDB (pgvector) |

**Addressing (pointers).** Every unit and handbook has a stable pointer:

```text
unitId     = uuidv5(`${tenantId}:${source}:${docId}:${unitPath}`)      // content-addressed → idempotent re-ingest
handbookId = uuidv5(`${tenantId}:handbook:${topic}`)                    // STABLE across versions (the binding target)
```

A hat binds to `handbookId` (stable); the handbook's *content* moves through
versions in git; the *recall* moves through Hindsight; the *state* lives on the
Cockroach row. The bind never breaks when the content updates — the same
pointer-index discipline as memory.

---

## Part G — The document lifecycle (state machine + triggers + ownership)

Docs are not write-once. They live a lifecycle — owned by the **Documentation and
Project Skills department** (already in the seed: `documentation_systems_director`
owns `documentation_policy`; `documentation_reviewer` owns the `documentation_gate`;
`design_doc_steward` + `skill_graph_curator` curate) — authored as a House-DU,
the same shape as the memory/work lifecycles:

```text
ingested ─▶ draft ─▶ in_review ─▶ active ─▶ stale ─▶ superseded (terminal-ish)
                                      │           ╲▶ archived (terminal)
                       human-gated ───┘  (re-review) ↺ active
```

| State | Meaning | Entered by (trigger) | Owner of the move |
|-------|---------|----------------------|-------------------|
| `draft` | just ingested or just authored; not yet retrieval-eligible for load-bearing use | an add-trigger (Part H) | system |
| `in_review` | a doc hat (and a human, per the autonomy dial) is reviewing for canonical status | classification flags it load-bearing (handbook/policy/architecture) | `documentation_reviewer` + human gate |
| `active` | approved/canonical; **retrieval-eligible + bindable**; the org's standard | review approved (`documentation_gate`) | `documentation_reviewer` |
| `stale` | freshness below floor, OR source changed without re-review, OR **drift** vs code/reality detected | the maintenance cycle (Part J) | system flags; hat triages |
| `superseded` | a newer canonical replaced it (`supersedes` edge); kept for history, excluded from default retrieval | a newer unit canonicalized on the same topic | `design_doc_steward` |
| `archived` | source deleted/retired; **never surfaces** (but preserved + pointer-resolvable) | source deletion OR explicit retire | system / steward |

Light-weight docs (a meeting note, a reference page) skip `in_review` and go
`draft → active` automatically; only **load-bearing** docs (handbooks, policies,
architecture, ADRs) require the human-gated review before they become the org's
standard — exactly the autonomy dial. Every transition emits a `doc_*` org_event,
so a doc's whole history ("why does the BRD handbook say this, who approved it,
what did it supersede") is one query over the trace.

---

## Part H — When + how docs are added (the add taxonomy)

Four entry points, all funneling into the *same* ingestion pipeline (Part C) and
all landing at `draft`:

| When | How | Lands |
|------|-----|-------|
| **Onboarding (bulk)** | the connector pulls the whole external corpus once (Part C) | `draft` → batch review |
| **Source change (incremental)** | connector webhook/poll detects an edited wiki/Confluence/README page → re-ingest just that doc (content-addressed, so only changed units update) | `draft` (re-review if load-bearing) |
| **Org-produced (the work IS the trigger)** | a work item that *produces a doc* — a BRD authored at the BRD stage, an ADR recorded at architecture approval, an architecture summary written during codebase ingestion, a runbook written at release — emits the doc into the layer automatically | `draft` → review |
| **Synthesis** | canonicalization (Part A) distills scattered sources into one handbook; a reflection step (memory `reflect`) promotes a recurring lesson into a handbook | `in_review` (always human-gated — it's load-bearing) |
| **Manual** | an operator/human uploads or writes a doc directly | `draft` |

The key design point: **the org's own documentation is added by doing work.**
Finishing a BRD *is* adding the BRD doc; recording an ADR *is* adding the ADR;
ingesting a codebase *produces* the architecture handbook. No separate "remember to
document" step — documentation is a by-product of the traced work, emitted
deterministically.

---

## Part I — When docs are retrieved (the trigger taxonomy)

Retrieval fires from four triggers — the first two are **guaranteed** (harness
invariants, per the memory reliability discipline), so consultation never depends on
an agent remembering:

| Trigger | When | Guaranteed? |
|---------|------|-------------|
| **Stage-bound consult** | a workflow stage consults its bound handbooks (`consult_handbook(handbookId)` injects the BRD handbook at the BRD stage) | **yes** — deterministic |
| **Hat-bound injection** | the active hat's bound handbooks are injected at prompt construction (a QA hat always gets the QA handbook) | **yes** — deterministic |
| **Structural trigger** | IF the work touches `service:billing`, inject its runbook + architecture unit (an IF-THEN rule, not judgment) | **yes** — deterministic |
| **Ad-hoc query** | the agent runs `docs.retrieve(query)` mid-turn for something specific | no — agent-driven, *additive* |
| **Maintenance read** | the doc cycle reads docs to detect stale/drift (Part J) | n/a — system |

So the load-bearing context (the handbooks a stage/hat must follow) is **always
present**; the agent additionally pulls more when it wants. The "when" is bound to
the work, not to the agent's memory.

---

## Part J — How docs are maintained (the maintenance cycle + drift)

Maintenance is a standing cycle — same shape as the memory daily maintenance cycle
(good news auto-applies; risky decisions route to a hat) — owned by the
**Documentation and Project Skills department**, NATS-scheduled (daily +
on-source-change), every action a `doc_*` org_event:

**Stage A — automated (no hat decision):**

1. **Re-sync** connectors incrementally (changed docs → re-ingest the changed units).
2. **Recompute freshness**; flag units below the floor as `stale`.
3. **Recompute retrieval weight** (Part D Stage 6) — `utility` updates from the
   consult ledger (a handbook consulted in successful work rises; consulted-but-
   useless sinks).
4. **Archive** units whose source was deleted.

**Stage B — hat/human-decided (routed through the autonomy dial):**

1. **Canonicalization + conflict resolution** — merge duplicates, choose the
   surviving unit on a conflict, supersede the old (`documentation_reviewer` /
   `design_doc_steward`).
2. **Promote** `draft → active` for load-bearing handbooks (the `documentation_gate`,
   human-gated).
3. **Drift remediation** — when a `stale`-by-drift doc is found, **open a
   documentation work item** in the Work OS to fix it.

### Drift detection (docs must track reality)

The most important maintenance function: a doc references the *old* state of the
system. Because the doc graph **shares the codebase + work graph** (Part B), drift
is detectable deterministically — when the codebase structural scan changes a
service/endpoint/owner that a doc's `about` edge points at, the doc is flagged
`stale` and a remediation work item is created. A handbook that describes a
deprecated process, an architecture doc naming a removed service, a runbook for a
retired data store — all surface automatically, because the doc layer is wired to
the same graph the code and work live in.

### Maintenance is just work (the tie-in)

A stale doc, a drift, a conflict — each becomes a **work item** in the Work OS
(W1–W6): typed, owned by a Documentation hat, scheduled, prioritized, traced, and
human-gated per the customer's dial. Documentation maintenance is not a side
system; it is the org doing its own work, observable end-to-end. This is also how
the org keeps its *own* growing documentation healthy as it builds a large system —
the same cycle, the same drift detection, the same pointers.

---

## Part K — Determinism ⇄ autonomy

| Concern | Deterministic | Agent-driven |
|---------|---------------|--------------|
| Parsing to units | structural (AST/heading tree) | — |
| Scope pre-filter | from active hat/stage/work | — |
| Entity resolution | dictionary + graph | enrichment of new entities |
| Recall | Hindsight over the scoped slice | the natural-language query |
| Ranking | the weight formula | — |
| Consultation | bound handbooks + structural triggers injected | additional ad-hoc queries |
| Canonicalization | dedup/supersede detection | the synthesis + human-gated review |

The kernel guarantees the *right scope is searched, the right doc is consulted, and
usefulness (not just similarity) ranks*; the agent supplies the query and the
synthesis. Retrieval quality stops being a hope.

---

## Part L — Build phases (D-track; composes with C-track C5/C6)

| Phase | Deliverable |
|-------|-------------|
| **D1** | Storage (Part F) + ingestion pipeline: connectors + `agentic_org_doc_sources`/`_units`/`_graph_edges`/`_entities`/`_consult_ledger` Cockroach tables + git handbook layout + Hindsight tagging; `DocUnit` domain; content-addressed idempotent ingest. |
| **D2** | Entity extraction + the shared knowledge-graph edges; canonicalization (dedup/supersede/conflict). |
| **D3** | The **document lifecycle** (Part G) DU + transitions + `doc_*` org_events; the add-taxonomy entry points (Part H), incl. org-produced docs emitted from work items. |
| **D4** | The retrieval pipeline (Part D: scope pre-filter → entity resolve → Hindsight recall → multi-resolution → graph augment → KPI-weighted rerank → conflict handling) + the retrieve-trigger taxonomy (Part I); the consult ledger. |
| **D5** | Deterministic consultation wired into workflow stages (bound handbooks + structural triggers) + the utility self-tuning loop (consult → outcome → weight). |
| **D6** | The **maintenance cycle** (Part J): NATS-scheduled, Documentation-dept-owned; re-sync + freshness + weight + archive (auto) and canonicalize + promote + **drift-remediation-as-work-item** (hat/human-gated). Drift detection wired to the codebase graph. |
| **D7** | **Kind proof:** ingest a sample external doc set + a codebase; show (a) a stage consulting the *right* scoped, *active* handbook; (b) an entity-anchored retrieval returning a service's runbook + its *superseding* ADR (not the stale duplicate); (c) summary-first/drill-by-pointer; (d) the maintenance cycle detecting a doc↔code drift and opening a remediation work item; (e) a doc lifecycle moving `draft → in_review → active` through the documentation gate — all observed in `org_events`, contrasted against a naive top-k baseline on the same corpus. |

D-track composes with the platform C-track (C5 codebase intelligence + C6 org
intelligence) and rides the memory system's Hindsight + weight + pointer substrate.
