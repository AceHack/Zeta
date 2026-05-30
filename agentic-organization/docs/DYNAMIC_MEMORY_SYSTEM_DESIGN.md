---
title: Dynamic Memory System Design
canonical_name: Agentic Organization
status: design
---

# Dynamic Memory System Design

How the organization gives **hats and agents durable, weighted, self-maintaining
memory** — and how the **Memory & Knowledge department** (the "IT department for
memory") maintains it on a daily cadence: scoring every memory by *how likely it
should be to surface*, decaying old ones, correlating each against the KPIs it
actually produced, promoting the winners, demoting the losers, and archiving the
ones whose weight has fallen to zero so they never surface again.

This document expands two existing docs with a concrete mechanism:

- [`AGENT_WORK_RHYTHM_AND_PROMPT_FLOWS.md`](AGENT_WORK_RHYTHM_AND_PROMPT_FLOWS.md)
  already says hats have a "memory maintenance" obligation — "stabilize useful
  memories, deprecate stale memories, correct invalid memories, scope memories
  by hat/project/task." This doc makes that obligation *executable*.
- [`CLUSTER_EXECUTION_AND_MEMORY_SUBSTRATE.md`](CLUSTER_EXECUTION_AND_MEMORY_SUBSTRATE.md)
  says an "Organization memory adapter injects active context and policy scope."
  This doc defines *what* gets injected, *how it is ranked*, and *who keeps it healthy*.

## Provenance — what we are taking, and what we are not

The mechanism below is adapted from the memory subsystem of an unrelated design
("TPM-REFACTOR"). **We take the memory *idea* and the *maintenance idea*. We do
not take its architecture.**

| Taken (the idea) | Rejected (their stack / architecture) |
|------------------|----------------------------------------|
| Memory = content + **mutable weight-state**, joined by a stable id | Their RaaS / Weaviate / Elasticsearch / FalkorDB / Mongo five-store split |
| **Tiered scoping** of memory | Their `turn/thread/engagement/persona` tier names |
| A composite **retrieval weight** (freshness × confidence × outcome × utility …) | Their specific weights, schema files, MCP tool surface |
| **Freshness decay** with an archive floor | Their RaaS chunk soft-delete + reconciliation jobs |
| **Outcome (KPI) correlation** and **utility self-tuning** | Their TPM persona/reviewer/gate architecture |
| A **daily analyst** that proposes promote/demote/conflict candidates | Their `observer-analyst` / `observer-promoter` persona files and replay harness |
| **Protected** memories that cannot be auto-overwritten | Their GitLab-MR promotion path |

Everything below is re-expressed in **our** primitives: CockroachDB + NATS +
in-cluster Ollama, native TypeScript (`--experimental-strip-types`), the
`observe → decide` kernel, the universal `org_event` trace, and the hat +
department org we already built and proved in kind.

---

## 1. Thesis

> Memory is a **weighted, decaying, KPI-correlated substrate**. Determinism
> computes each memory's *weight* (how likely it should surface) and the *legal
> set* of maintenance actions; agents drive the *outcomes* (which memories to
> actually cite, and — for risky lifecycle moves — which candidate to approve).
> The **Memory & Knowledge department** runs a daily maintenance cycle that is
> itself an org cycle: every recompute, promotion, demotion, and archive emits
> one durable `org_event`, so the whole memory economy is crystal-clear.

This is the same "**enough determinism, agents drive outcomes**" tenet that
governs the rest of the org — applied to memory.

---

## 2. Tier ladder — memory scoped to the org, and the hat ⊕ agent combination

Memory is scoped to **where in the organization it belongs**. The ladder mirrors
our actual hierarchy (`org → department → hat → agent`) plus one cross-cutting
**work/workflow** tier for memory that belongs to a unit of work rather than to a
role.

| Tier | `scope` value | Belongs to | Lifetime | Example |
|------|---------------|------------|----------|---------|
| `org` | `org-lfg` | The whole company | indefinite (decays) | "All public-facing copy goes through Legal review." |
| `department` | a `DepartmentId` | A department | indefinite (decays) | "Engineering never merges on a red runtime gate." |
| `hat` | a `HatDefinition.id` | **A hat** — inherited by *whoever currently wears it* | indefinite (decays) | `code_reviewer` → "Require a rollback plan before approving DB migrations." |
| `agent` | an `agentId` | **A specific actor/agent** | indefinite (decays) | `agent-7` → "I tend to under-estimate test effort; pad QA by 20%." |
| `work` | a `workItemId` | A unit of work / workflow run | decays fast (default 30d) | `work-…` → "This epic reserves Redis for sessions only (RFC-882)." |

### 2.1 The hat ⊕ agent ⊕ work combination (the requested behavior)

> *"certain hats should have memories assigned to them but also specific memories
> assigned to each actor/agent that can combine with the hat memory."*

When **agent `A` wears hat `H` on work item `W`**, retrieval pulls the **union**
of everything in scope and ranks it by weight:

```
retrieval scope for binding (A wears H on W) =
      org(org-lfg)
    ⊕ department(H.departmentId)
    ⊕ hat(H.id)              ← the role's accumulated wisdom
    ⊕ agent(A)               ← this specific actor's personal memory
    ⊕ work(W)               ← this workflow's local memory
```

- **Hat memory** is the role's institutional knowledge: it persists across
  *wearers*, so a freshly-bound agent inherits the hat's hard-won lessons the
  moment the binding activates. This is the natural fit for our hat lifecycle —
  the binding is the carrier, the hat-tier memory is the cargo.
- **Agent memory** is the actor's personal layer: calibration, tendencies,
  preferences. It travels with the agent across *every hat they wear*.
- **Combination at write time:** when agent-tier and hat-tier carry the *same
  key* with different values, the agent layer is treated as a **personal
  override/augmentation** of the hat layer for that agent only (a small
  `personalScope` boost at retrieval), without mutating the hat memory other
  wearers see.

This combination is computed *deterministically* (it's a pure scope union +
weight sort); the agent only chooses which of the surfaced memories to actually
use.

---

## 3. The memory record — content vs. weight-state

A single logical **MemoryRecord** is split into two parts, because they change at
different rates (a Data-Vault-style hub/satellite split — the same
change-rate-partition discipline used elsewhere in the repo):

```ts
// CONTENT — written rarely, embedded for semantic search (the "hub")
type MemoryContent = {
  memoryId: string;          // UUID v5 from `org:tier:scope:key` — stable join key
  tier: MemoryTier;          // org | department | hat | agent | work  (House DU)
  scope: string;             // org-lfg | DepartmentId | hatId | agentId | workItemId
  key: string;               // stable slug, e.g. "review:require-rollback-plan"
  value: string;             // the memory text itself
  contextHint?: string;      // why this exists; enriches the embedding
  protected: boolean;        // cannot be auto-overwritten / auto-demoted
  writtenBy: string;         // hatId | agentId | "memory_curator" | "human"
  writtenAt: string;         // ISO
  // NOTE: embeddings + semantic search live in HINDSIGHT (§13), NOT in Cockroach.
  // Cockroach holds content/state only; the Cockroach-only adapter is weight-only
  // (no semantic term). Hindsight owns vector/BM25/graph/temporal recall.
};

// STATE — updated continuously (the "satellite"); drives the weight
type MemoryState = {
  memoryId: string;
  confidence: number;        // 0..1   — write-time guess, refined by outcomes
  freshnessAt: string;       // last-confirmed; freshness decays from here
  reinforcementCount: number;

  outcome: {                 // KPI correlation
    successCount: number;    // times this memory was in scope during a SUCCESS
    failureCount: number;    // …during a FAILURE
    inconclusiveCount: number;
    lastOutcomeAt: string | null;
    workItemsObserved: readonly string[]; // FIFO-capped, for dedup
  };

  utility: {                 // self-tuning: was it actually used?
    injectedCount: number;   // times retrieved/injected into a prompt flow
    citedCount: number;      // times the agent actually cited it
    lastInjectedAt: string | null;
  };

  crossScopeObservations: {  // promotion signal (work→hat, hat→department, …)
    distinctScopes: readonly string[]; // FIFO-capped
    firstObservedAt: string;
    lastObservedAt: string;
  };

  phase: MemoryPhase;        // lifecycle DU (§5)
  weight: number;            // 0..1 — last computed retrieval weight (cached)
  archivedAt?: string;
};
```

Content lives in one Cockroach table; state in another, joined by `memoryId`
(§8). The split exists so the daily maintenance cycle can do cheap, atomic
`UPDATE … SET success_count = success_count + 1` on state without touching the
embedded content.

---

## 4. Retrieval weight — "how likely it is to surface; zero means never again"

This is the heart of the request. The **weight** is a deterministic, pure
function of a memory's state — *how likely it should be to surface*. It is
computed at retrieval time and also recomputed nightly (cached on the state row).

```ts
function computeMemoryWeight(s: MemoryState, ctx: RetrievalCtx): number {
  const freshness  = computeFreshness(s, ctx.now);   // 1 → 0 as it ages (§4.1)
  const confidence = s.confidence;                   // 0..1
  const outcome    = outcomeRatio(s);                // success/(success+failure), 0.5 until ≥3 samples
  const utility    = utilityRatio(s);                // cited/injected, 0.5 until ≥5 injections
  const semantic   = ctx.semanticScore ?? 0.5;       // optional Ollama cosine; 0.5 if disabled

  const base =
      0.30 * semantic
    + 0.20 * freshness
    + 0.15 * confidence
    + 0.20 * outcome      // KPI is weighted heavily — this is the point
    + 0.15 * utility;

  // additive scope boosts (capped)
  const hatScope      = (s.tier === "hat"   && s.scope === ctx.hatId)   ? 0.05 : 0;
  const personalScope = (s.tier === "agent" && s.scope === ctx.agentId) ? 0.05 : 0;
  const workLocal     = (s.tier === "work"  && s.scope === ctx.workItemId) ? 0.05 : 0;

  return clamp01(base + hatScope + personalScope + workLocal);
}
```

### 4.1 Decay and the zero floor

Freshness decays linearly from `freshnessAt` per a per-tier half-life; below an
**archive floor** the memory is moved to `phase: Archived` and **excluded from
every future retrieval** — it has dropped to zero and will never surface again
(exactly the requested behavior).

```ts
function computeFreshness(s: MemoryState, now: number): number {
  const halfLifeDays = HALF_LIFE[tierOf(s)];          // work:30, hat/agent:120, dept:180, org:365
  const elapsedDays = (now - Date.parse(s.freshnessAt)) / 86_400_000;
  return Math.max(0, 1 - elapsedDays / (2 * halfLifeDays));
}
```

| Tier | half-life | default-read floor | archive floor (→ never surfaces) |
|------|-----------|--------------------|----------------------------------|
| `work` | 30d | 0.35 | 0.15 |
| `hat` / `agent` | 120d | 0.30 | 0.15 |
| `department` | 180d | 0.30 | 0.15 |
| `org` | 365d | 0.25 | 0.10 |

A memory **also** drops toward zero — independent of age — when its **KPI
correlation goes bad** (outcome ratio collapses) or its **utility goes to zero**
(injected many times, never cited). Both feed the weight; a memory that is
fresh but useless still sinks. Reinforcement (being confirmed again) resets
`freshnessAt` and lifts it back up.

### 4.2 Self-tuning (utility)

```ts
const outcomeRatio = (s) => { const t = s.outcome.successCount + s.outcome.failureCount;
  return t < 3 ? 0.5 : s.outcome.successCount / t; };           // neutral until enough KPI signal
const utilityRatio = (s) => s.utility.injectedCount < 5 ? 0.5
  : Math.min(1, s.utility.citedCount / s.utility.injectedCount); // injected-but-never-cited → sinks
```

A memory retrieved 20 times and cited 0 times has `utilityRatio → 0`; its weight
falls; it surfaces less; eventually it falls out of the budget entirely and then
under the archive floor. **This is the continuous-learning dimension** — memories
compete for inclusion on *empirical usefulness*, not their initial confidence guess.

### 4.3 Determinism ⇄ autonomy at retrieval (and prompt-flow injection)

- **Deterministic** computes the candidate set (scope union, not archived, above
  the read floor) and the **weight-ranked order**, then greedily packs the top-N
  into the prompt-flow's memory budget. The agent **cannot widen** this — it only
  sees what the rules surfaced.
- **The agent chooses within it**: which surfaced memories to actually rely on
  and cite. Citations are recorded (drives `utility`), and an
  anti-citation-laundering check rejects a cited `memoryId` that was not actually
  injected this turn (the same clamp discipline as the rest of the kernel — an
  agent can't fabricate a grounding).

This plugs straight into the **prompt flows**
([`AGENT_WORK_RHYTHM_AND_PROMPT_FLOWS.md`](AGENT_WORK_RHYTHM_AND_PROMPT_FLOWS.md)):
a `## Relevant memory` block is composed at prompt-construction time for the
active binding, rendered as `hat-tier` then `agent-tier` then `work-tier`, each
line annotated with its live weight + KPI record so it is auditable.

---

## 5. Memory lifecycle (House-DU, mirrors `HatBinding`)

A memory's `phase` is a discriminated union with explicit terminal states —
authored in the same style as our `HatBindingPhase` so the maintenance cycle can
fold over it deterministically.

```
Draft ─▶ Active ─▶ Reinforced ─▶ Active ─▶ Stale ─▶ Archived(terminal)
                              ╲           ╲▶ Demoted ─▶ Archived
                               ╲▶ Promoted (new record at higher tier; source kept)
   any Active/Stale ─▶ Conflicted ─▶ (resolution decision) ─▶ Active | Archived
```

| Phase | Meaning | Reached by |
|-------|---------|-----------|
| `Draft` | written, not yet weight-eligible | a write |
| `Active` | in the retrieval pool | first weight computation |
| `Reinforced` | confirmed again (resets freshness, lifts confidence) | conflict-resolution `reinforce` |
| `Stale` | weight under the read floor (still recoverable) | nightly decay |
| `Demoted` | KPI/outcome judged bad by a hat decision | `memory_demotion` decision |
| `Promoted` | a higher-tier copy was created from it (source preserved) | `memory_promotion` decision |
| `Conflicted` | same key, divergent value, similar confidence | write conflict |
| `Archived` | **terminal** — weight ≤ archive floor; never surfaces again | nightly archive OR demotion |

`TerminalMemoryPhases = { Archived }`. Conflict resolution is the same
reinforce / overwrite / flag-as-alternative / reject decision the TPM idea uses,
re-expressed against our store.

---

## 6. KPI / outcome correlation — wired to *our* trace, not theirs

The TPM idea correlates memory to "manifest outcomes." We already emit a richer
signal: the universal `org_event` stream + the pipeline. **A work item that
reaches `merged` is a success; one that stalls or takes a recovery path is a
failure.** So the correlation reads our own events — no new outcome system.

```ts
// when a work item's pipeline finalizes (we already emit pipeline_stage_transition):
async function correlateOutcome(workItemId: string, verdict: "success"|"failure"|"inconclusive") {
  // every memory injected during any binding that touched this work item
  const memoryIds = await listMemoriesInjectedFor(workItemId);   // from injection ledger
  for (const memoryId of memoryIds) {
    await memoryState.bumpOutcome(memoryId, verdict, workItemId); // dedup on workItemId
  }
}
```

- **`merged`** (all 7 gates passed) → `success` for every memory that was in
  scope during that work item.
- **gate `Rejected` / recovery path / stall** → `failure`.
- Confidence is then recomputed from the success/failure ratio (asymmetric:
  *reinforcement auto-applies, demotion routes to a hat*, §7).

This is the answer to *"identify which memories are producing best KPIs and which
are not."* The KPI is the org's own outcome signal, already in `org_events`.

---

## 7. The Memory & Knowledge department — the daily maintenance cycle

> *"said IT department will run daily … automated and also some manual (from IT
> dept) heuristic on each memory."*

The "IT department" is the **`memory_and_knowledge`** department — **it already
exists in the seed**, reporting to the COO, with these hats:

| Hat | Level | Owns (in the memory economy) |
|-----|-------|------------------------------|
| `memory_director` | Director | **memory policy**; final authority on risky lifecycle decisions; votes on memory hat-supply |
| `memory_manager` | Manager | **memory adaptation** — tunes weights/decay/floors; routes candidates to reviewers |
| `memory_curator` | IC | authors + corrects memory content; applies approved promotions |
| `memory_reviewer` | IC | the **manual heuristic** — reviews demotion / promotion / conflict candidates |
| `knowledge_router` | IC | decides which memory is scoped to which hat/agent/work |
| `project_context_librarian` | IC | owns **work-tier** (workflow) memory |

### 7.1 The cycle is an org cycle (observe → decide, fully traced)

`runMemoryMaintenanceCycle` is structured exactly like `runOrgCycle` —
determinism computes the legal action set per memory; the appropriate hat chooses
within it; every action emits one `org_event`.

**What fires it (the trigger).** The cycle is **NATS-scheduled on a durable
subject** (`org.memory.maintenance.tick`), drained by the worker that already runs
the org cycles — the same always-on lane that drives the keep-alive/heartbeat loop
(`apps/workers/src/main.ts`). A daily tick is published deterministically (a
scheduled publisher; cadence is config, default 24h). "Daily" is the default
cadence, **not** a hard requirement — because every action is idempotent
(content-addressed writes §12.3) and deterministic, the cycle is **safe to run
more often or to re-run after a crash**: re-processing the same memories produces
the same decisions. The trigger therefore needs no exactly-once guarantee — at-
least-once on the NATS subject is sufficient. This mirrors how the org cycle and
heartbeat already run; no new scheduling primitive is introduced.

**Stage A — automated (no hat decision; safe, reversible):**

1. **Decay pass** — recompute `freshness` and `weight` for every active memory.
   Emit `memory_weight_recomputed` per memory whose weight band changed.
2. **Archive-at-zero** — any memory whose weight ≤ archive floor →
   `phase: Archived`. Emit `memory_lifecycle_transition` (`Stale|Active → Archived`).
   *It will never surface again.*
3. **Confidence reinforcement** — recompute confidence from KPI ratio; if it
   *rose*, auto-apply (low risk) and emit `memory_weight_recomputed`.

**Stage B — manual heuristic (routed through a hat's `chooseWithinLegal`):**

1. **Demotion candidates** — memories with `failureCount ≥ 3` and failure ratio
   ≥ 0.6 are *flagged*, not auto-demoted (a true memory present during unrelated
   failures must not be punished blindly). The legal set is
   `{demote, keep, request-evidence}`; `memory_reviewer` chooses; if it picks
   `demote`, `memory_manager`/`memory_director` confirms per risk. Emits
   `memory_demotion_decision`.
2. **Promotion candidates** — memories reinforced across **≥3 distinct scopes**
   (e.g. the same lesson surfaced under three different work items) are promotion
   candidates from `work → hat`, or `hat → department`. `knowledge_router`
   proposes the target scope; `memory_director` approves; `memory_curator` writes
   the higher-tier copy and **keeps the source** (a `derived_from` link). Emits
   `memory_promotion_decision`.
3. **Conflict resolution** — `Conflicted` memories surface to `memory_reviewer`
   with legal set `{keep-A, keep-B, keep-both-as-alternatives}`. Emits
   `memory_conflict_decision`.

**Asymmetry (the safety property):** *good news auto-applies, bad news asks a
hat.* Reinforcement, decay, and archive-at-zero are automatic; demotion,
promotion, and conflict resolution route through a hat decision — because they
are harder to reverse and benefit from judgment. That judgment is the agent
"manual heuristic," and it is still **clamped to the legal set** by the kernel.

### 7.2 Protected memories

`protected: true` memories (org identity, RFC-binding conventions, operator-
curated rules) are excluded from auto-overwrite, auto-demotion, and confidence
decay. They can only change via an explicit human/`memory_director` action — the
same protected-fact discipline as the source idea, enforced at the write layer.

### 7.3 `reflect` — insight generation that produces higher-tier memory

The `Memory` port's third operation, `reflect`, is **not deferred** — it has a
concrete home, and Hindsight implements it directly (`POST /banks/{id}/reflect` →
disposition-aware insights / "mental models"). In our system `reflect` is *the
operation that turns many low-tier memories into one durable higher-tier memory*:

- **Where it runs (the agent side):** at the **reflection step of the work rhythm**
  ([`AGENT_WORK_RHYTHM_AND_PROMPT_FLOWS.md`](AGENT_WORK_RHYTHM_AND_PROMPT_FLOWS.md)
  already schedules "memory reflection" time per hat). At reflection, the kernel
  calls `reflect(scope)` for the binding; the returned insight is offered as a
  `memoryCandidate` (subject to the same write policy + protected rules).
- **Where it runs (the maintenance side):** `reflect` is how **promotion** (§7.1
  Stage B) materializes — when `knowledge_router` proposes promoting a lesson
  reinforced across ≥3 scopes, the higher-tier memory it writes is a *reflected
  insight* (an explicit summary with `derived_from` links to its sources), not a
  raw copy. A reflected `work`-tier cluster becomes a `hat`-tier "mental model."
- **Determinism boundary:** `reflect`'s *output is model-generated* (it summarizes),
  so it is never auto-applied — it always enters as a candidate routed through a
  hat's `chooseWithinLegal` (a `memory_reviewer`/`memory_director` decision),
  emitting `memory_promotion_decision`. Reflection produces *proposals*; hats
  decide; the kernel clamps; the trace records.

So the three port operations partition cleanly: **`retain`** writes a fact,
**`recall`** surfaces facts (weight-ranked), **`reflect`** distills facts into a
higher-tier memory through a hat decision.

---

## 8. Storage — CockroachDB, mirroring `OrgSystemV15`

Two new tables, same conventions as `agentic_org_org_events` / `…hat_bindings`
(JSONB for nested state, parameterized SQL with explicit `::JSONB` casts, an
on-disk migration mirror with a TS↔disk parity test):

```sql
-- content (the hub)
CREATE TABLE IF NOT EXISTS agentic_org_memory_records (
  memory_id     UUID PRIMARY KEY,
  organization_id STRING NOT NULL,
  tier          STRING NOT NULL,            -- org|department|hat|agent|work
  scope         STRING NOT NULL,
  key           STRING NOT NULL,
  value         STRING NOT NULL,
  context_hint  STRING,
  protected     BOOL NOT NULL DEFAULT false,
  written_by    STRING NOT NULL,
  written_at    TIMESTAMPTZ NOT NULL,
  embedding     JSONB,                       -- optional float[]; nomic-embed-text
  UNIQUE (organization_id, tier, scope, key) -- conflict detection
);
CREATE INDEX IF NOT EXISTS idx_mem_scope ON agentic_org_memory_records (organization_id, tier, scope);

-- state (the satellite) — atomically updatable weight signals
CREATE TABLE IF NOT EXISTS agentic_org_memory_state (
  memory_id        UUID PRIMARY KEY REFERENCES agentic_org_memory_records (memory_id),
  organization_id  STRING NOT NULL,
  phase            STRING NOT NULL,          -- MemoryPhase DU
  confidence       FLOAT8 NOT NULL,
  freshness_at     TIMESTAMPTZ NOT NULL,
  weight           FLOAT8 NOT NULL,
  reinforcement_count INT8 NOT NULL DEFAULT 0,
  outcome          JSONB NOT NULL,           -- success/failure/… counts
  utility          JSONB NOT NULL,           -- injected/cited counts
  cross_scope      JSONB NOT NULL,
  archived_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_mem_state_demote ON agentic_org_memory_state (organization_id, phase);
CREATE INDEX IF NOT EXISTS idx_mem_state_weight ON agentic_org_memory_state (organization_id, weight DESC);
```

### 8.1 Injection ledger (load-bearing for KPI §6, utility §4.2, must-address §12.5)

Every time a memory is injected into a turn we record one ledger row. This is the
join that lets the maintenance cycle answer "which memories were in scope during
this work item's success/failure" (§6) and "injected vs. cited" (§4.2), and lets
the must-address gate (§12.5) know what the agent was shown.

```sql
CREATE TABLE IF NOT EXISTS agentic_org_memory_injection (
  injection_id     UUID PRIMARY KEY,
  organization_id  STRING NOT NULL,
  memory_id        UUID NOT NULL,              -- the memory that was injected
  work_item_id     STRING NOT NULL,            -- KPI correlation key (§6)
  hat_id           STRING NOT NULL,            -- the wearing hat at injection
  agent_id         STRING NOT NULL,            -- the actor
  prompt_flow_run_id STRING NOT NULL,          -- the turn
  weight_at_injection FLOAT8 NOT NULL,         -- weight when surfaced (for must-address §12.5)
  cited            BOOL NOT NULL DEFAULT false, -- set true when the agent cites it (§4.2 utility)
  injected_at      TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_mem_inj_work ON agentic_org_memory_injection (organization_id, work_item_id);
CREATE INDEX IF NOT EXISTS idx_mem_inj_memory ON agentic_org_memory_injection (organization_id, memory_id);
CREATE INDEX IF NOT EXISTS idx_mem_inj_run ON agentic_org_memory_injection (prompt_flow_run_id);
```

`citedCount`/`injectedCount` in `MemoryState.utility` (§3) are derivable from this
table (`COUNT(*)` and `COUNT(*) FILTER (WHERE cited)` per `memory_id`); we keep
the cached counters on the state row for ranking speed and treat the ledger as the
source of truth. Every maintenance action is *also* an `org_event`, so the
existing org-snapshot fold gains a memory view for free.

### 8.2 Semantic search is Hindsight's job — Cockroach is weight-only

There is **no embedding column and no cosine in Cockroach.** Semantic / vector /
BM25 / graph / temporal recall is **entirely Hindsight's** (§13); Hindsight stores
the embeddings in its own `pgvector` Postgres. Our CockroachDB holds only content
metadata (optional, §8.3), **state** (weight signals), the injection ledger, and
the `org_event` trace.

This resolves cleanly into two adapters behind the one `Memory` port:

| Adapter | Recall ranking | When |
|---------|----------------|------|
| **Hindsight adapter** (`createHindsightMemory`, §13) | Hindsight semantic recall → **re-ranked by our §4 weight** | normal operation |
| **Cockroach/in-process adapter** (degraded) | **weight-only** (`semantic = 0.5`); no embeddings | Hindsight unavailable, or tests |

So `semantic` in the §4 weight formula is supplied by Hindsight when present and is
the neutral `0.5` constant otherwise — the graceful-degradation posture, with the
heavy lifting delegated to a system built for it. No embedding model, no vector
index, and no `pgvector`-on-Cockroach problem to solve on our side.

### 8.3 Reconciliation with the existing `agentic_org_hindsight_memory` (V13) table

The repo already ships `agentic_org_hindsight_memory` (migration V13) — a simple
content store with exactly our attribution columns (`agent_id, hat_assignment_id,
project_id, work_item_id, prompt_flow_run_id, content, retained_at`) behind the
in-cluster Cockroach `Memory` adapter. Under this design:

- **Content moves to Hindsight** (the real recall engine, §13). The `memoryId`
  returned by Hindsight's `retain` becomes our canonical id.
- **V13 is retained as the degraded-mode / test content store**, not deleted — it
  *is* the Cockroach weight-only adapter's content table (§8.2). When Hindsight is
  unavailable, recall falls back to V13 content + our weight ranking.
- **The new `agentic_org_memory_records` table (§8) is optional**: if Hindsight
  holds content, our Cockroach can hold *only* `MemoryState` + the injection ledger
  + `org_events`, with `MemoryState.memoryId` referencing the Hindsight id (or the
  V13 `memory_id` in fallback). We do **not** duplicate content across both.

Net: no schema is thrown away; V13 becomes the fallback content store; the new
tables are the **state + ledger + trace** satellite; Hindsight is the content +
recall hub.

### 8.4 New `OrgEventKind`s

`MemoryLifecycleTransition`, `MemoryWeightRecomputed`, `MemoryPromotionDecision`,
`MemoryDemotionDecision`, `MemoryConflictDecision`, `MemoryInjection`,
`MemoryCitation` — added to the existing `OrgEvent` union so memory is traced on
the same substrate as everything else.

---

## 9. Determinism ⇄ autonomy split (the memory column)

| Concern | Deterministic (the legal set / the math) | Agent drives (within the legal set) |
|---------|------------------------------------------|-------------------------------------|
| Retrieval | scope union, decay, archive floor, **weight rank**, budget packing | which surfaced memories to use / cite |
| Reinforcement / decay / archive-at-zero | the whole computation; auto-applied | — (no decision needed) |
| Demotion | candidate detection + legal `{demote,keep,request-evidence}` | `memory_reviewer` picks; clamped |
| Promotion | candidate detection + legal target scopes | `knowledge_router`/`memory_director` pick; clamped |
| Conflict | detection + legal `{keep-A,keep-B,both}` | `memory_reviewer` picks; clamped |
| Weight/decay tuning | bounds on the policy knobs | `memory_manager` adapts within bounds |

The agent can never make a memory surface that the rules archived, never
fabricate a citation, never widen a promotion beyond a legal target scope. It
only chooses inside the lines — and every choice is one `org_event`.

---

## 10. Phased build plan (mirrors P0–P7; each phase proved in kind)

| Phase | Deliverable |
|-------|-------------|
| **M0** | This doc + the `OrgEventKind` additions + the two Cockroach tables (migration `MemorySystemV16` + on-disk mirror + parity test). |
| **M1** | `MemoryRecord`/`MemoryState`/`MemoryPhase` domain types (House-DU) + `memory_and_knowledge` hats wired with `B.Memory` scopes (already seeded — assert coverage). |
| **M2** | Write path + conflict resolution + protected-memory enforcement; Cockroach stores with parity tests. |
| **M3** | `computeMemoryWeight` + decay + retrieval (scope union, rank, budget pack) — pure, unit-tested; the hat ⊕ agent ⊕ work combination. |
| **M4** | Injection ledger + prompt-flow `## Relevant memory` block + anti-citation-laundering check + utility update. |
| **M5** | Outcome correlation from `pipeline_stage_transition` (merged=success) → confidence recompute. |
| **M6** | `runMemoryMaintenanceCycle` as an org cycle: Stage A automated, Stage B hat-decided; every action an `org_event`. |
| **M7** | **Deploy + observe in kind**: seed memories at hat/agent/work scope, run a work item to `merged`, run the daily cycle, and observe — via the org snapshot — memories reinforced (good KPI), demoted (bad KPI by a `memory_reviewer` decision), promoted (work→hat), and one archived at zero that no longer surfaces. The same end-to-end proof bar we held for the org system. |
| **M8** | **Reliability harness (§12):** mandatory pre-turn injection + required `memoryCandidates` output field + deterministic system extraction from `org_events` + content-addressed idempotent writes + the bidirectional gates + the per-hat `MemoryContract`. Retrieval/storage become kernel invariants, not agent tools. |
| **H1–H4** | **Hindsight seam (§13.6):** stand up Hindsight in kind, the `createHindsightMemory()` adapter behind the port, the §13.3 recall→re-rank composition, and an observed end-to-end run. Can be adopted any time after M2 (the port already exists); the M-track and H-track are independent. |

---

## 11. Worked example (what the trace will show)

```
seed:  hat(code_reviewer) "review:require-rollback-plan"  conf 0.7
       agent(agent-7)     "calibration:pad-qa-20pct"      conf 0.7
       work(work-42)      "rfc-882:redis-sessions-only"   conf 0.9 protected

run work-42 → merged (success)
   → memory_injection events: both review + rfc-882 injected for the reviewer binding
   → memory_citation: reviewer cited "review:require-rollback-plan"
   → correlateOutcome(work-42, success): success++ on injected memories

daily memory cycle:
   [memory_weight_recomputed]  review:require-rollback-plan  0.71 → 0.78  (KPI up, cited)
   [memory_weight_recomputed]  calibration:pad-qa-20pct      decayed, never cited → 0.41
   [memory_promotion_decision] knowledge_router proposes work→hat for rfc-882-pattern;
                               memory_director approves; memory_curator writes hat copy
   [memory_lifecycle_transition] an old work(work-09) note  0.12 → Archived (never surfaces again)
```

Every line above is an `org_event` with `actorHatId`, `supervisorChain`,
`decision`, and `correlation/causation/trace` — readable in the same snapshot
view as the rest of the org.

---

## 12. Retrieval & storage reliability — remembering is **structural, not behavioral**

The thing that kills agent-memory systems is never the ranking math. It is that
agents **forget to call retrieve** and **forget to call store**. The repo already
names this exact failure class — the **goldfish-ontology principle**
(`.claude/rules/claude-code-loading-taxonomy.md`): *a discipline with a
recognition-failure component is forgotten exactly when it is needed.* A tool the
agent invokes "when it remembers it needs memory" is useless precisely once the
agent has already lost the thread.

**The fix is one reframe:** retrieval and storage are **not agent actions** — they
are **invariants of the prompt flow, computed by the `observe → decide` kernel.**
The agent never decides *whether* they run; it only influences their *content*,
inside a wrapper the harness guarantees. This is the same move the org system
makes for gates: the agent cannot pick an illegal gate, and here it cannot skip a
retrieve or a store — by construction, not by discipline.

### 12.1 Never forget to *retrieve* — retrieval is a mandatory pre-turn step

At `beforePromptConstruction` for the active binding, the kernel **always** runs
retrieval (Mode 1, passive injection). There is no "agent decides to retrieve."
The agent *may additionally* run mid-turn active retrieval (Mode 2), but it can
never *skip* Mode 1. The query text is a **pure function** of
`(taskMeta, last-K turns, role sentence)` — no model call decides what to search
for — so it is reproducible and cacheable by hash. Result: *forgetting to
retrieve is structurally impossible* — the memory is in the prompt before the
agent reasons.

### 12.2 Never forget to *store* — three independent sources, so no lesson is lost

Storage runs at turn-close (`afterEmit`), **always**, from three sources:

1. **Required output field (agent-driven, schema-enforced).** The prompt flow's
   output schema carries a mandatory `memoryCandidates: MemoryCandidate[]` field.
   "Remember to call `memory.write`" becomes "fill a required field," and the gate
   flags a turn that produced a substantive claim but emitted `[]` with no
   justification. A forgettable behavior becomes a non-optional schema obligation.
2. **Deterministic system extraction (no agent — the backstop).** Many lessons are
   *structurally evident from the turn's own `org_events`* and need no agent
   judgment: a tool-result contradicting a cited memory, a gate `Rejected`, a HITL
   correction, a work item reaching `merged`/stalling. The kernel extracts these
   deterministically and writes them `writtenBy: "system"`. **Even if the agent
   emits `[]`, the system still captures what is structurally obvious.**
3. **Reinforcement-by-citation (free).** Citing a memory in a turn that succeeds is
   a deterministic `$inc` reinforce — not a new write.

### 12.3 The algorithmic key: content-addressed memory makes "store every turn" safe

Running extraction every turn only works if it is idempotent. The enabler is the
stable key already defined in §3:

```
memoryId = uuidv5(`${org}:${tier}:${scope}:${key}`)
```

Writing the same `(tier, scope, key)` is **not a duplicate** — it is the
deterministic conflict resolution of §5 (`reinforce | overwrite | flag-alternative
| reject`). So we store **aggressively, every turn**, and the content-addressed key
collapses repeats into reinforcement in O(1). The agent never has to *decide* "is
this new?" — the key decides.

> This inverts the usual design. Most systems do *store-selectively + dedup-later*
> and lose things because "selectively" is a judgment the agent flubs.
> Content-addressing lets us do *store-everything + idempotent-merge*: cheap,
> lossless, and the "is it worth keeping?" question is answered **later,
> deterministically, by the weight/decay engine** (§4) — not in the hot path by a
> forgetful agent.

### 12.4 Retrieving *well* and cheaply — two-stage, two-modality, dedup-aware

- **Stage 1 — deterministic pre-filter (~5ms, zero model calls):** scope union
  (`hat ⊕ agent ⊕ work`) `AND phase != Archived AND weight ≥ floor` + a cheap
  trigram/keyword prefilter. 10k → ~200 candidates. Pure, reproducible.
- **Stage 2 — score the ~200 only:** the §4 weight, plus an *optional* semantic
  cosine computed **only over the candidate set**. `O(candidates)`, never
  `O(all)`.
- **Two modalities, union'd:** semantic similarity gives *recall*; **deterministic
  structural triggers** give the *precision* similarity misses — a hat's contract
  declares IF-THEN rules (*"if a tool-result touches `services/billing/*`, pull
  that path's risk memories"*). These are rules, not judgment, so they fire
  reliably.
- **Cross-turn dedup set:** track the per-session injected `memoryId` set; do not
  re-inject the same memory every turn unless its weight materially changed —
  saves budget, kills repetition.
- **Caches:** query-embedding LRU keyed on query-hash; `weight` cached on the state
  row (recomputed nightly + lazily on read) to avoid recompute storms.

### 12.5 Make *using* memory correctly deterministic — bidirectional gates

Two gate checks make both failure directions costly, so retrieval quality is
*enforced*, not hoped:

- **Anti-laundering** — a cited `memoryId` not injected this turn → fabrication →
  block (already in §4.3).
- **Must-address** — a *high-weight* memory was surfaced and the output
  contradicts it with no explanation → negligence → flag. The reviewer/gate sees
  the full ranked list including `relevant-but-unused`, so *ignoring* memory is as
  costly as fabricating it.

### 12.6 Crash-safe storage — decouple the write path via NATS

The turn emits its storage candidates to a **durable NATS subject** and returns
immediately; the `memory_and_knowledge` department's deterministic writer drains
the queue. Storing never blocks the agent turn and survives a crash mid-write (the
candidate is already durable in the stream). Hot path (agent) and write path (IT
dept) are decoupled — the same automated-maintenance lane as §7.

### 12.7 The `MemoryContract` — where the determinism lives, per hat / per flow

Each hat's prompt flow declares a machine-checkable contract; the agent fills
content *inside* it, never around it:

```ts
type MemoryContract = {
  retrieve: {
    tiers: readonly MemoryTier[];          // which scopes to pull (default: all in §2)
    budgetTokens: number; maxItems: number; // packing bounds
    readFloor: number;                      // weight floor for surfacing
    structuralTriggers: readonly Trigger[]; // deterministic IF-THEN retrieval rules
  };
  store: {
    expectedKeyNamespaces: readonly string[]; // e.g. code_reviewer → ["review:*"]
    requireCandidatesField: true;              // schema obligation
  };
  requiredProvenance: readonly ("memory-fact" | "tool-result")[];
};
```

The gate can now check role-appropriate discipline deterministically — e.g. *"a
`code_reviewer` produced a review decision but never touched its `review:*` store"*
— turning "did the agent maintain its memory?" into a contract assertion.

### 12.8 Reliability summary — what makes each guarantee deterministic

| Guarantee | Mechanism (why it's deterministic) |
|-----------|------------------------------------|
| Never forget to retrieve | a harness step in `observe`, not an agent tool call |
| Query is reproducible | pure function of `(task, last-K turns, role)` |
| Candidate set + rank | pure SQL pre-filter + pure weight function |
| Never forget to store | required output field **+** system extraction over `org_events` |
| Idempotent storage | content-addressed `uuidv5` key → merge, not duplicate |
| Precision retrieval | IF-THEN structural triggers in the contract, not judgment |
| Used correctly | bidirectional gate (injected ↔ cited ↔ contradicted) |
| Crash-safe | candidates durable on NATS before the turn returns |

The agent's only freedom is **content** — the query phrasing and what is worth
remembering. **Occurrence, idempotency, ranking, decay, and gating are all the
kernel's, computed the same way every time.**

---

## 13. Working with Hindsight (`vectorize-io/hindsight`)

Hindsight ([github.com/vectorize-io/hindsight](https://github.com/vectorize-io/hindsight),
**MIT**) is an external, open-source **agent memory engine**: biomimetic memory
(world facts, experiences, mental models), LLM-powered extraction, and **parallel
recall** across vector + keyword (BM25) + graph + temporal strategies, with
cross-encoder reranking and reciprocal-rank fusion. Its core API is
**`Retain / Recall / Reflect`**, exposed as an **HTTP REST API + generated SDKs**
(Python, Node/TS, Go, CLI) and an **MCP server**. It runs as a **single Docker
container** (with an embedded Postgres by default) over **PostgreSQL + pgvector**,
and uses any OpenAI-compatible LLM — including **Ollama** — for extraction.

We do **not** adopt Hindsight wholesale and we do **not** fork it. We **compose**
with it. The reasons are structural (all verified against the repo — see §13.0):

| Fact about Hindsight | Consequence for us |
|----------------------|--------------------|
| Core API is `Retain / Recall / Reflect`, bank-scoped | **Our `Memory` port already mirrors it exactly** (`packages/memory/src/memory.ts`, with sticky attribution). The seam exists today. |
| MIT-licensed | Forking, vendoring, and upstream PRs are all legally open — so the choice is purely engineering. |
| Postgres + Ollama + REST/SDK; an MCP server exists | It already speaks our stack. It *does* ship an MCP server, but **we deliberately do not use it** — §12 makes memory a harness invariant, not an agent-facing tool, so we drive Hindsight through our port. |
| Strong recall, **no decay / weighting / maintenance** | That gap is **exactly** our governance layer (§4–§7). Composition is additive, not duplicative. |

### 13.0 Verified API surface (investigated against the repo, 2026-05-30)

Confirmed from Hindsight's OpenAPI contract
(`hindsight-clients/go/api/openapi.yaml`) and `.env.example`, so the adapter below
is grounded in the real API, not a summary:

| Concern | Verified fact |
|---------|---------------|
| Scope primitives | **`bank_id`** (URL path) + arbitrary **`metadata`** (string→string map on each retained item) + **`tags`** (string array). |
| Retain | `POST /v1/default/banks/{bank_id}/memories` — **batch** `items[]`, each `{ content, context?, timestamp?, metadata?, tags?, document_id?, entities? }`; `async` flag. Returns created memory **ids**. |
| Recall | `POST /v1/default/banks/{bank_id}/memories/recall` — `{ query, types?, tags?, tags_match: any\|all, budget, max_tokens, query_timestamp? }`. **Filters by tags**; semantic + spreading-activation. |
| Recall response | `RecallResponse.results[]` each carry **`id`** (the memory id), `chunk_id`, `context`, `entities`, `occurred_start/end`; plus `chunks{}` (text) and `entities{}`. **`results[].id` is our join key.** |
| Reflect | `POST /v1/default/banks/{bank_id}/reflect` → insights; **mental-models** are reflect-derived (§7.3). |
| Conflict/versioning | `GET /memories/{id}/history` + a documented conflict-resolution mechanism — **Hindsight handles content-level conflict itself** (so our §5 conflict logic is the degraded/Cockroach-only path; with Hindsight, content conflict is its job, our job is weight/lifecycle). |
| LLM | `HINDSIGHT_API_LLM_PROVIDER=ollama` + `HINDSIGHT_API_LLM_BASE_URL` + `_MODEL` — OpenAI-compatible; **fully local on our in-cluster Ollama**. |
| DB | embedded `pg0` by default; `HINDSIGHT_API_DATABASE_URL` to point external; uses **`pgvector`** → **do not use CockroachDB for it** (run its own Postgres / embedded pg0). |
| Deploy | single container `ghcr.io/vectorize-io/hindsight:latest` (API `:8888`, UI `:9999`) **or the repo's `helm/` chart** — clean kind deploy. |

**Scope mapping (the `hat ⊕ agent ⊕ work` union, §2.1, onto Hindsight):**

| Our concept | Hindsight |
|-------------|-----------|
| `projectId` (recall is project-scoped, never global) | **`bank_id`** = `projectId` (one bank per project) |
| attribution (`agentId, hatAssignmentId, workItemId, promptFlowRunId`) + `tier/scope` | retained-item **`metadata`** (string map) |
| the scope-union retrieval key | **`tags`** = `["tier:"+tier, "scope:"+scope, "agent:"+agentId, "work:"+workItemId]` |
| recall the hat ⊕ agent ⊕ work union | `recall({ tags:["scope:"+hatId,"agent:"+agentId,"work:"+workItemId], tags_match:"any" })` |
| our `MemoryState.memoryId` | the **`results[].id`** Hindsight returns from `retain`/`recall` |

**The one item left for the live spike (H1), now small:** whether
`results[]` exposes a numeric **relevance score** to *blend* with our weight, or
only an ordered list (rank-position). Either way the re-rank works — we re-rank by
our §4 weight over the returned ids; a Hindsight score would only let us additionally
blend. Plus the usual runtime confirmations (Ollama-as-extractor latency/quality,
recall p99). The integration's *possibility* is no longer in question.

### 13.1 The division of labor (Hindsight is the engine; we are the economy)

```
            ┌──────────────────────────────────────── our system ───────────────────────────────────┐
            │  org_event trace · tier-scoping (hat⊕agent⊕work) · weight/decay/KPI · IT-dept daily     │
            │  maintenance · reliability harness (§12) · the Memory port + MemoryContract             │
            └───────────────────────────────────┬─────────────────────────────────────────────────────┘
                                                 │ Retain / Recall / Reflect  (our port)
                                ┌────────────────▼────────────────┐
                                │   createHindsightMemory()        │  ← adapter implements the port
                                │   (REST/Node-SDK → Hindsight)    │
                                └────────────────┬────────────────┘
                                                 │ HTTP
                          ┌──────────────────────▼──────────────────────┐
                          │  Hindsight service (Docker, MIT)             │
                          │  extraction · vector+BM25+graph+temporal     │
                          │  recall · rerank · RRF                       │
                          │  Postgres (its own) · Ollama (ours)          │
                          └──────────────────────────────────────────────┘
```

- **Hindsight owns** content storage, embeddings, and the *recall fusion* (the part
  that is genuinely hard and that it already does well).
- **We own** everything Hindsight deliberately omits: tier-scoping via its custom
  metadata, the **KPI-weighted re-rank + decay + archive floor**, the daily
  maintenance cycle, protected memories, the `org_event` trace, and the §12
  reliability harness.

### 13.2 The seam is our existing `Memory` port — write an adapter, not a fork

`packages/memory/src/memory.ts` already defines `Memory { retain; recall; reflect }`
with sticky `MemoryAttribution`. The note in that file — *"a real Hindsight adapter
implements the same port"* — is the plan. We add one adapter:

```ts
export function createHindsightMemory(deps: {
  client: HindsightClient;        // the Node SDK or a thin REST wrapper
  organizationId: string;
}): Memory {
  // bank_id = attr.projectId  (recall is project-scoped, never global)
  // retain  → POST /banks/{projectId}/memories  { items:[{ content,
  //            metadata: attributionToMetadata(attr),
  //            tags: ["tier:"+tier,"scope:"+scope,"agent:"+attr.agentId,"work:"+attr.workItemId] }] }
  //            → returns ids; we create the MemoryState row keyed on the returned id
  // recall  → POST /banks/{projectId}/memories/recall  { query, tags:[scope/agent/work], tags_match:"any" }
  //            → results[].id  → join MemoryState → OUR §4 weight re-rank (§13.3)
  // reflect → POST /banks/{projectId}/reflect  { query }  → insight candidate (§7.3), hat-decided
}
```

Our attribution (`agentId, hatAssignmentId, projectId, workItemId, promptFlowRunId`)
maps onto Hindsight's **custom metadata**; scoped recall (never global) maps onto
its **metadata filter**. The in-process fake and the Cockroach adapter remain for
tests and degraded mode (Hindsight unavailable → fall back to our own
weight-only ranking, exactly the §4 degradation posture).

### 13.3 Extending Hindsight *by composition*, not by patching its internals

Our weight/decay/KPI engine lives **outside** Hindsight and **post-processes** its
recall:

1. Hindsight returns candidates ranked by its semantic/BM25/graph/temporal fusion
   (Stage 2 recall).
2. We join each to our `MemoryState` (Cockroach) and **re-rank by the §4 weight**
   (`freshness × confidence × KPI-outcome × utility`), apply the **archive floor**,
   and pack into the budget.

We never touch Hindsight's code; we wrap its output. This is precisely the
two-stage retrieval of §12.4 with **Hindsight as the recall engine and our weight
as the final re-rank.**

### 13.4 Storage split — Hindsight's Postgres vs. our CockroachDB (honest nuance)

Hindsight manages **its own PostgreSQL** schema and **requires `pgvector`**
(confirmed in `.env.example`: *"Vector Extension — uses pgvector by default"*).
**Do not point Hindsight at CockroachDB** — run it on its **embedded `pg0`** (zero
extra infra) or a dedicated Postgres pod / Hindsight Cloud. This
yields the clean hub/satellite split §3 already anticipated:

| Store | Holds | Owner |
|-------|-------|-------|
| **Hindsight Postgres** | memory **content** + embeddings + recall indices (vector/BM25/graph/temporal) | Hindsight |
| **Our CockroachDB** | memory **state**: weight, confidence, freshness, outcome/utility, phase; the injection ledger; **all `org_events`** | us |

Joined by `memoryId` (Hindsight's id ↔ our state row). Our Cockroach stays the
system-of-record for governance and trace; Hindsight is the content + recall
engine. (This makes the §8 `agentic_org_memory_records` content table optional — if
Hindsight holds content, our Cockroach can hold *only* state + ledger + trace.)

### 13.5 The decision: integrate, don't fork — with named escalation paths

| Option | Use when | Cost |
|--------|----------|------|
| **Integrate behind the port** *(recommended default)* | We need Hindsight's recall + our governance on top — the present case | One adapter; track upstream for free |
| **Contribute upstream (MIT PR)** | We want a capability *inside* Hindsight that is generally useful (e.g. a metadata-scoped recall filter it lacks) | A PR + review latency; no fork to maintain |
| **Thin wrapper service** | We need to shape Hindsight's I/O (auth, our metadata conventions, rate-limits) without changing its logic | A small service we own; Hindsight unchanged |
| **Hard fork** *(last resort)* | We must change Hindsight's *core ranking internals* in a way upstream will not take | Permanent tax: tracking a Python+Rust+TS codebase ourselves |

A hard fork is reserved for a *proven, specific* need to alter Hindsight's
internals that upstream rejects — none exists today, because **everything we want
to add lives cleanly on top of `Retain/Recall/Reflect`.** Start integrated; escalate
only on evidence.

### 13.6 Build phases for the Hindsight seam

| Phase | Deliverable |
|-------|-------------|
| **H1** | **Spike (now a confirmation, not a discovery — §13.0):** deploy `ghcr.io/vectorize-io/hindsight:latest` (or the repo `helm/` chart) in the `agentic-org` ns with embedded `pg0`, `HINDSIGHT_API_LLM_PROVIDER=ollama` + `_BASE_URL` at our in-cluster Ollama. Smoke-test: `retain` a tagged item → `recall` by tag returns it with an `id` → `reflect` returns an insight. Confirm the three runtime questions: (a) does `results[]` carry a blendable **score** or rank-only; (b) Ollama-as-extractor latency/quality; (c) recall p99. |
| **H2** | `createHindsightMemory()` adapter behind the existing `Memory` port per §13.2 (bank_id=projectId, tags/metadata mapping, `results[].id`→`MemoryState`); scoped (non-global) recall; degraded fallback to the V13/in-process adapter (§8.2–§8.3). |
| **H3** | Compose §13.3: Hindsight recall → join `MemoryState` → §4 weight re-rank + archive floor + budget pack; the §12 reliability harness drives `retain`/`recall` as kernel invariants. |
| **H4** | **Observe in kind:** an agent retains via Hindsight, recalls scoped + KPI-re-ranked context, the daily maintenance cycle decays/promotes/archives against our Cockroach state, and the whole flow is traced in `org_events` — same proof bar as the org system. |

---

## 14. What this is NOT

- **Not** a new datastore — it reuses our CockroachDB and in-cluster Ollama.
- **Not** the TPM architecture — only its memory + maintenance *idea* is taken.
- **Not** a vector database — embeddings are an optional, degradable weight term.
- **Not** auto-deletion of knowledge — archive is reversible (the row remains;
  only retrieval excludes it); hard deletion is a separate, human-gated action.
- **Not** an agent free-for-all — the kernel clamps every memory action to a
  legal set; the agent's "manual heuristic" is a *choice within the rules*,
  traced as an `org_event`.

---

## Appendix — concept mapping (source idea → our system)

| Source idea concept | Our adaptation |
|---------------------|----------------|
| `MemoryFact` (RaaS + Mongo split) | `MemoryRecord` (Cockroach content) + `MemoryState` (Cockroach state) |
| `turn / thread / engagement / persona` tiers | `org / department / hat / agent / work` tiers (mirror our hierarchy) |
| persona-tier (cross-session role) | **hat-tier** (cross-wearer role memory) |
| (no per-actor tier) | **agent-tier** (per-actor) + the **hat ⊕ agent** combination |
| engagement-tier | **work-tier** (per workflow run) |
| composite relevance score | `computeMemoryWeight` (KPI-weighted) |
| freshness half-life + archive floor | same; archive floor = "drops to zero, never surfaces" |
| outcome correlation (manifest verdict) | correlation from `pipeline_stage_transition` (merged=success) |
| utility self-tuning (injected vs cited) | same; via the injection ledger + citations |
| `observer-analyst` daily templates | `runMemoryMaintenanceCycle` (an org cycle) |
| `observer-promoter` + admin approval | hat decisions (`memory_reviewer`/`director`) via `chooseWithinLegal` |
| protected facts | protected memories |
| GitLab-MR promotion path | `org_event`-traced promotion decision |
| agent calls a `memory.retrieve` tool | mandatory pre-turn injection — a kernel invariant, never an agent tool (§12) |
| agent calls `memory.write` | required `memoryCandidates` output field + deterministic system extraction (§12) |
| (their RaaS vector/keyword/graph stack) | **Hindsight** (`vectorize-io/hindsight`) as the recall engine, behind our `Memory` port (§13) |
| RaaS+Mongo content/state split | Hindsight Postgres (content+recall) / our CockroachDB (state+weight+trace) (§13.4) |
