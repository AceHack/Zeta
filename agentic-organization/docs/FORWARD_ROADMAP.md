---
title: Forward Roadmap — ranked phase-by-phase plan (Activate → Live → Doc Intelligence → Graph → Adaptive)
canonical_name: Agentic Organization
status: design
composes_with:
  - PHASED_DEVELOPMENT_PLAN.md
  - NORTH_STAR_ALIGNMENT_CHECKPOINT.md
  - ORG_NATIVE_CHANGE_CONTROL_DESIGN.md
  - DYNAMIC_MEMORY_SYSTEM_DESIGN.md
  - DOCUMENT_INTELLIGENCE_DESIGN.md
  - KNOWLEDGE_GRAPH_CONSTRUCTION_DESIGN.md
  - ADAPTIVE_ORGANIZATION_PLATFORM_DESIGN.md
---

# Forward Roadmap

## Where we are (2026-05-30)

Built + proven in kind: the org cycle, the **Work OS** living loop (W0–W6), the
**dynamic memory system** with Hindsight plugged in (MEM0–MEM8), and **Org-Native
Change Control** with GitHub/Jira ports (CC0–CC6). Each was proven via a standalone
`deploy/run-*.ts` runner against the live cluster.

**The honest gap that ranks the rest:** the always-on **worker**
(`apps/workers/src/main.ts`) drives keep-alive, heartbeat, reaction-plan execution,
and durable Hindsight memory — but it does **not** yet drive `runWorkOsCycle`,
`runMemoryMaintenanceCycle`, or the change-control review on its schedule. Those
capabilities are *demonstrated*, not *continuously running in the deployed org*.

## The ranking (and why)

Ordered by dependency, leverage, and risk — each unlocks the next.

| # | Track | Why here |
|---|-------|----------|
| 1 | **A — Activate** (worker integration) | Highest leverage on what already exists. Turns four proven-but-dormant subsystems into a continuously-running org. Foundational — everything below assumes a live org. Low risk (subsystems are proven); the work is wiring, not new logic. |
| 2 | **L — Live external integration** (real ports) | Small, bounded, validates "complete integration capability" against reality. Best right after A so change control runs live *and* its ports are proven live, de-risking the port abstraction before D/G/C build on it. Credential-gated → a discrete checkpoint. |
| 3 | **D — Document Intelligence** | The next major capability. Rides the proven memory substrate; references the now-live `ChangeSet` for change-provenance. Large but well-scoped. |
| 4 | **G — Knowledge Graph** | Interleaves with D: D's ingestion produces the doc substrate, G builds the graph from it, D's graph-augment retrieval stage consumes it. Sequence D-ingestion → G-construction → D-full-retrieval. |
| 5 | **C — Adaptive Platform** | Broadest, most independent. Generalizes everything beneath it: AutonomyPolicy (already referenced by change control's human gates), everything-as-config, and bidirectional Jira/Linear sync **reusing the now-live port layer**. Naturally caps the sequence. |

```text
A (activate) ──▶ L (live ports) ──▶ D (doc intelligence) ──▶ G (knowledge graph)
     │                                     ▲          │              │
     └── makes the org live ───────────────┘          └── interleave ┘
                                                                      ▼
                                                          C (adaptive platform)
                                                   reuses the port layer + AutonomyPolicy
```

**Quality bar (unchanged):** every sub-phase is pure-where-possible, unit-tested,
typecheck-clean, and **proven in kind** via a `deploy/run-*.ts` + `observe-*.ts`
pair, recorded in the North Star checkpoint. Same bar held for P/W/MEM/CC.

---

## Track A — Activate: make the proven org run continuously

The subsystems exist; the worker must drive them on its cadence (the keep-alive lane
already runs on its own independent loop — these join as additional scheduled lanes).

| Phase | Deliverable | Exit (proven in kind) |
|-------|-------------|------------------------|
| **A0** | A `runOrgCadence` composition the worker drives on its tick: org cycle + Work OS cycle + memory maintenance + change-control advance as scheduled lanes, decoupled cadences (mirrors the keep-alive lane pattern). | the worker boots with the cadence lanes wired; tsc + tests green. |
| **A1** | Drive the **Work OS living loop** from the worker (not just `deploy/run-work-os-cycle.ts`): the work-item pipeline + escalation advance on the work-cycle tick. | a work item advances through the pipeline in kind **without a manual runner**; org_events appear from the worker. |
| **A2** | Drive the **memory maintenance cycle** from the worker on a NATS-scheduled `org.memory.maintenance.tick` (DYNAMIC_MEMORY §7.1): decay/archive/reinforce auto, demote/promote hat-decided, on a configurable cadence (default daily). | the scheduled tick fires in kind; `memory_state` transitions + a `memory_maintenance_cycle` event appear on the worker's schedule. |
| **A3** | Drive **change control** from the worker: a work item reaching the release stage auto-opens a `ChangeSet` and the review pipeline advances each tick; human/external stages surface as HITL/poll. | a work item reaching release auto-opens a ChangeSet that advances in the worker loop in kind. |

---

## Track L — Live external integration: turn the ports live

CC5's GitHub/Jira ports are unit-tested with fakes; this proves them against reality.

| Phase | Deliverable | Exit |
|-------|-------------|------|
| **L0** | Secret + config plumbing: a GitHub token (k8s secret / Vault) + a test repo; the worker selects the `github-gated` pipeline via `ChangeControlPolicy` config. | the config flows to the worker; the port instantiates with a real client. |
| **L1** | **Live GitHub PR round-trip**: a `ChangeSet` projects a *real* PR; a human approves it on github.com; the approval flows back into the gate; the PR merges via the port. | a real PR is opened + approved + merged from the org's ChangeSet. |
| **L2** | *(optional)* **Live Jira card round-trip** against a Jira instance — the card transitions are driven by the ChangeSet. | real card status driven by the ChangeSet. |

---

## Track D — Document Intelligence (rides memory; references ChangeSet provenance)

Per DOCUMENT_INTELLIGENCE_DESIGN. Ingest an external org's docs + retrieve smarter
than RAG.

| Phase | Deliverable |
|-------|-------------|
| **D0** | Design alignment + Cockroach `DocumentIntelligence` schema (documents, chunks, doc-lifecycle DU) + OrgEventKinds + migration/parity. |
| **D1** | Ingestion: connectors + structural decomposition + typed/scoped storage, riding Hindsight retain + the memory weight/pointer substrate; each document linked to the `ChangeSet` that introduced it (provenance). |
| **D2** | Entity resolution + canonicalization (shared with G3). |
| **D3** | The 8-stage retrieval pipeline (scope pre-filter → entity resolve → hybrid recall → summary-first → graph-augment *(stub until G)* → KPI-weighted rerank → conflict → deterministic consult). |
| **D4** | Doc lifecycle + maintenance cycle owned by the Documentation department — the same observe→decide pattern as memory maintenance. |
| **D5** | Integrate + prove in kind: ingest a doc set, retrieve smarter-than-RAG, observe. |

---

## Track G — Knowledge Graph (interleaves with D)

Per KNOWLEDGE_GRAPH_CONSTRUCTION_DESIGN. The construction engine behind codebase/doc/
org intelligence.

| Phase | Deliverable |
|-------|-------------|
| **G0** | Design + Cockroach graph schema (nodes/edges + confidence tiers + provenance) + migration/parity. |
| **G1** | Deterministic extraction pass (node extractors + edge inference per source) — pure, the "machine" pass, never conflated with enrichment. |
| **G2** | Agent enrichment pass (confidence promotion extracted→inferred→verified→canonical; retraction-native). |
| **G3** | Entity resolution (shared with D2). |
| **G4** | Derived intelligence (architecture/ownership/risk/impact) + lighting up D3's graph-augment stage; change-edges reference `ChangeSet`s. |
| **G5** | Integrate + prove in kind: codebase/doc → graph → derived intelligence. |

---

## Track C — Adaptive Platform (generalizes everything beneath)

Per ADAPTIVE_ORGANIZATION_PLATFORM_DESIGN. Make the org a generic configurable runtime.

| Phase | Deliverable |
|-------|-------------|
| **C0** | Everything-as-configuration substrate (workflows/handbooks/skills/autonomy as tenant data) + Cockroach config tables. |
| **C1** | `AutonomyPolicy` — wire it so *which* review stages require humans (change control's `human` authority) is tenant config, not hardcoded. |
| **C2** | Onboarding-as-self-bootstrapping-work. |
| **C3** | Bidirectional Jira/Linear sync — **reuses the change-control port layer**, generalized to work items + cards. |
| **C4** | Deterministic hat guardrails (action-class → tool-bundle preflight — a TPM cannot write code). |
| **C5** | Codebase + org intelligence (consumes D + G). |
| **C6** | Self-healing adaptation. |
| **C7** | Integrate + prove in kind. |

---

## Start here

**Phase A0 → A1.** Wire the proven Work OS / memory-maintenance / change-control
cycles into the always-on worker so the org *runs* them, then prove a work item
advancing through the worker loop in kind without a manual runner. Everything else
ranks behind a continuously-running org.
