---
title: Agentic Organization Docs
canonical_name: Agentic Organization
status: index
---

# Agentic Organization Docs

This folder is the working design set for the Agentic Organization platform.

Canonical name: **Agentic Organization**.

Use **Hermes** only for the agent runtime/component. Use **Organization Work OS** for the work-management subsystem inside Agentic Organization.

Current documents:

- [Foundational Context and Language](./FOUNDATIONAL_CONTEXT_AND_LANGUAGE.md) - working vocabulary, values, Zeta project context, declarative cluster mental model, and active clarifications.
- [Implementation Concepts](./IMPLEMENTATION_CONCEPTS.md) - how to build the architecture as services, data models, MCP tools, workflows, and runtime infrastructure.
- [Always-On Orchestration Runtime](./ALWAYS_ON_ORCHESTRATION_RUNTIME.md) - the workers, triggers, rules, leases, schedulers, watchers, reconcilers, SLOs, incidents, runbooks, and self-healing loops that keep the Organization continuously operating.
- [Runtime Technology and Package Strategy](./RUNTIME_TECH_AND_PACKAGE_STRATEGY.md) - how Temporal TS, Dapr Actors, Orleans, NATS, Oz/Warp run orchestration, OpenZiti transport, Hermes, Hindsight, and reusable `agentic-services` primitives fit into a new Agentic Organization platform.
- [UI and Observability Concepts](./UI_AND_OBSERVABILITY_CONCEPTS.md) - how humans visualize and operate the Organization across work, agents, hats, runs, pods, clusters, meetings, reports, and evidence.
- [Department, Hat, and Tool Inventory](./DEPARTMENT_HAT_TOOL_INVENTORY.md) - the starter department map, hat catalog, tool bundles, approval gates, lifecycle ownership, and high-risk guardrails for the Organization.
- [Organization Layer Build Plan](./ORGANIZATION_LAYER_BUILD_PLAN.md) - the service layer, role workspaces, automation loops, state model, UI surfaces, and MVP sequence needed to make each department and hat operational.
- [Technical CA: Package-First Agentic Organization Architecture](./TECHNICAL_CA_PACKAGE_ARCHITECTURE.md) - the proposed TypeScript/NestJS modular-monolith package architecture, event envelope, traceability contract, NATS model, and cluster deployment boundary.
- [Observability and Self-Healing](./OBSERVABILITY_AND_SELF_HEALING.md) - the workflow visibility contract that lets humans and agents plug into Organization activity, find weak points, and route harness fixes through normal work.
- [Gastown Reference Analysis](./GASTOWN_REFERENCE_ANALYSIS.md) - external reference review of Gastown's multi-agent workspace model, what to reuse conceptually, what not to copy, and how to build the stronger Agentic Organization version.
- [Work and Release Management OS](./WORK_AND_RELEASE_MANAGEMENT_OS.md) - the custom backlog, project, task, assignment, signal, board, and release workflow product that keeps agent work reliable and visible.
- [Agent-Native Knowledge Graph and Retrieval](./AGENT_NATIVE_KNOWLEDGE_GRAPH.md) - the graph and retrieval layer linking tasks, discussions, decisions, meetings, docs, artifacts, runs, memories, and evidence into agent-readable context.
- [Agent Work Rhythm and Prompt Flows](./AGENT_WORK_RHYTHM_AND_PROMPT_FLOWS.md) - the hat-bound schedule, free-time, review/red-team, reflection, memory maintenance, and deterministic prompt-flow model for agents.
- [Supervisor-Chain Communication](./SUPERVISOR_CHAIN_COMMUNICATION.md) - the typed upward communication line from each hat to its supervisor chain, including tool families, evidence, and triage semantics.
- [Ambiguous Requirement Lifecycle](./AMBIGUOUS_REQUIREMENT_LIFECYCLE.md) - the discovery, customer interview, BRD, workflow modeling, architecture, decomposition, readiness, and learning path from vague request to curated feature.
- [Business Quality Gate System](./BUSINESS_QUALITY_GATE_SYSTEM.md) - the RFP/customer review, BRD, architecture, runtime validation, final business validation, release-readiness gate chain, and V0 quality-gate command model.
- [Anti-Stall Prioritization Runtime](./ANTI_STALL_PRIORITY_RUNTIME.md) - the hat-owned schedules, blocker triage, queue SLO, reassignment, alternate-work, dependency reconciliation, and priority routines that keep the Organization moving.
- [Implementation Readiness Checklist](./IMPLEMENTATION_READINESS_CHECKLIST.md) - the decisions and contracts that should be defined before scaffolding the first implementation slice.
- [Implementation Governance](./IMPLEMENTATION_GOVERNANCE.md) - the current-state, OpenSpec, authority, idempotency, telemetry, security, and quality rules for implementation work.
- [Phased Development Plan](./PHASED_DEVELOPMENT_PLAN.md) - the canonical phase-by-phase roadmap, immediate PR sequence, tests, docs, review gates, and exit criteria for building Agentic Organization.
- [Forward Roadmap](./FORWARD_ROADMAP.md) - the current ranked, phase-by-phase plan after Work OS + Memory + Change Control shipped: **A Activate** (wire the proven Work OS / memory-maintenance / change-control cycles into the always-on worker so the org *runs* them) → **L Live external integration** (real GitHub/Jira port round-trips) → **D Document Intelligence** → **G Knowledge Graph** → **C Adaptive Platform**, ranked by dependency/leverage/risk, each sub-phase proven in kind.
- [First Implementation Slice](./FIRST_IMPLEMENTATION_SLICE.md) - the NodeNext TypeScript package slice proving command, state, audit, outbox, NATS subject, telemetry, and reaction-plan contracts.
- [North Star Alignment Checkpoint](./NORTH_STAR_ALIGNMENT_CHECKPOINT.md) - current alignment verdict, drift list, and next priorities against the Agentic Organization north star.
- [V0 Executable Contract](./V0_EXECUTABLE_CONTRACT.md) - the smallest end-to-end runtime slice, grounded against the current `full-ai-cluster` substrate.
- [V0 Schema and Commands](./V0_SCHEMA_AND_COMMANDS.md) - the CockroachDB-backed state groups, enums, command contract, outbox model, and TypeScript-facing runtime events for the first implementation.
- [V0 Policy and Runtime Boundaries](./V0_POLICY_AND_RUNTIME_BOUNDARIES.md) - the hat policy matrix, MCP preflight checks, cluster runtime boundaries, failure rules, and ArgoCD integration shape.
- [Cluster-Native Hat System](./CLUSTER_NATIVE_HAT_SYSTEM.md) - the CRD, OPA, hat binding, succession, reputation, graph rendering, polyglot operator, and event model for enforcing hats on Kubernetes.
- [Cluster Execution and Memory Substrate](./CLUSTER_EXECUTION_AND_MEMORY_SUBSTRATE.md) - the k3s, sandboxed Hermes container, Cilium Service Mesh, SPIRE identity, Vault-backed secrets, Credential Proxy, NATS, Hindsight, and runtime observability contract.
- [Dynamic Memory System Design](./DYNAMIC_MEMORY_SYSTEM_DESIGN.md) - hat ⊕ agent ⊕ work memory tiers, the retrieval weight (how likely to surface; zero = never again), KPI/outcome correlation, and the Memory & Knowledge department's daily maintenance cycle as an observe→decide org cycle.
- [Work OS Overhaul — Gaps and Design](./WORK_OS_OVERHAUL_GAPS_AND_DESIGN.md) - the gap map + overhaul that turns the linear pipeline into a living Work OS: work types + in/out flows, authority-scoped observe, work-batch metrics rollup, a standing QA department with test-case mgmt + regressions, and the feedback/churn/escalation loops (built + proven in kind, W0–W6).
- [Org-Native Change Control — Design](./ORG_NATIVE_CHANGE_CONTROL_DESIGN.md) - the internal review/change fabric that replaces Git PRs/MRs with an org-owned process: a Git-agnostic `ChangeSet` (the canonical reviewable unit) running a `ReviewPipeline` of stages-as-data, where a review stage is an observe→decide cycle and the stage authority is a DU (internal hat / ≥3-agent quorum board / human sign-off / external system). PRs/MRs/Jira cards become an optional bidirectional **port/projection**, not the engine — internal is canonical, external is lazy + synced. Roadmap track CC0–CC6, sequenced **before** Document Intelligence (**built + proven in kind, CC0–CC6**; the review spine the intelligence tracks reference). Real GitHub PR + Jira card port adapters ship (live credential-gated); the in-kind proof runs internal-only (zero projections) and github-gated (fake external port) — both reach `applied`.
- [Adaptive Organization Platform — Design](./ADAPTIVE_ORGANIZATION_PLATFORM_DESIGN.md) - making the org a generic configurable runtime any company adapts to their practices: everything-as-configuration (workflows/handbooks/skills/autonomy as tenant data), onboarding-as-self-bootstrapping-work, bidirectional Jira/Linear sync, configurable human gating, codebase + organization intelligence, self-healing adaptation, and the deterministic hat guardrails (a hat acts only within its role — a TPM cannot write code).
- [Document Intelligence — Ingestion, Organization, Retrieval](./DOCUMENT_INTELLIGENCE_DESIGN.md) - ingesting an external org's existing docs and retrieving them smarter than naive RAG: a typed/scoped/graph-linked/provenance-weighted knowledge layer (not a chunk bag), structural decomposition, entity+knowledge graph, canonicalization, the doc lifecycle + storage + add/retrieve triggers + maintenance cycle, and the 8-stage retrieval pipeline (scope pre-filter → entity resolve → hybrid recall → summary-first multi-resolution → graph augment → KPI-weighted rerank → conflict handling → deterministic consult).
- [Knowledge Graph Construction — Building Nodes, Edges, and Intelligence](./KNOWLEDGE_GRAPH_CONSTRUCTION_DESIGN.md) - the construction process behind codebase/doc/org intelligence: two passes (deterministic extraction → agent enrichment) never conflated, confidence tiers (extracted/inferred/verified/canonical) + provenance on every node/edge, node extractors + edge inference per source, entity resolution, the bootstrap + incremental-diff pipeline, validation/graph-health/drift, derived intelligence (architecture/ownership/risk/impact), and construction-as-owned-work (Architecture + Documentation depts).
- [AI Cluster Scaffold Context](./AI_CLUSTER_SCAFFOLD_CONTEXT.md) - the two-directory NixOS/k3s/ArgoCD scaffold assumptions, component clarifications, bootstrap constraints, and deferred/local-model gating.
- [Architecture Source](./ORGANIZATION_RUNTIME_ARCHITECTURE.md) - the current conceptual architecture and operating model.
- [Rooms as Deterministic Simulations](./ROOMS_AS_DETERMINISTIC_SIMULATIONS.md) - the ephemeral deterministic-simulation container that hosts hats and injects real-or-mock IO at every seam: the action plane (an action is a dotnet test / simulation, not an observe.ts menu pick), the universal-interface bundle (`room.ts`), RMO per-task room planning (# rooms + # hats per room), Reticulum cross-room/cross-origin addressing (roomId = ZetaId = RNS destination), the chip-8/English/artifact communication strategies, and the RISC-micro-op-before-execution framing.
- [Observe, Compose, and Run-State](./OBSERVE_COMPOSER_AND_RUN_STATE.md) - the keystone `observe.ts` entrypoint: the run-lifecycle discriminated union, the readout of current state + legal options at varying scopes, the ephemeral memoryless composer, deterministic-rule visibility, and the >=3-agent constitution ratification gate.
- [Observe-Act Promotion Gate](./OBSERVE_ACT_PROMOTION_GATE.md) - the deterministic Phase 2.2 rule for promoting a lane from observe-act shadow to primary and demoting unsafe primary windows back to shadow.
- [Git as Database and Event Store (Frontmatter + ZetaId CRDT)](./GIT_COCKROACH_SYNC_AND_ZETAID_ADDRESSING.md) - the persistence/addressing layer: a markdown file is a row, frontmatter is the SQL-derived typed schema + columns + fk graph edges, events are ZetaId-keyed files that merge conflict-free as a G-Set CRDT, state is a timestamp-ordered fold, and CockroachDB is a rebuildable query index.
- [Metrics and the 3-Agent Review Board](./METRICS_AND_REVIEW_BOARD.md) - the two metric layers: quantitative code metrics gathered like coverage (longest function/class god-object detection, file length, nesting) and the qualitative >=3-agent review board that must agree on a finding before it is published, plus the MCP tool interface (hosting stubbed).
- [State Reconciliation Table](./STATE_RECONCILIATION.md) - North Star priority #2: the single authoritative mapping of WorkItemState across Work OS / V0 enum / UI column / event name / gate owner, plus the observe.ts RunLifecyclePhase binding and the generic-vs-type-specific rule split. The gate on adding more commands.
- [Doc Frontmatter Convention](./DOC_FRONTMATTER_CONVENTION.md) - the YAML frontmatter schema (title/canonical_name/status/ideas/extends/composes_with/code_anchors/supersedes) that turns this doc set into a navigable, derivable graph.

The intent is to keep the architecture document focused on what the Organization is, while implementation documents describe how to build it incrementally.

## Scope Discipline

These documents are reference substrate, not a mandate to implement every concept at once. The first implementation should choose the smallest end-to-end slice from [Implementation Readiness Checklist](./IMPLEMENTATION_READINESS_CHECKLIST.md), ship it, and prune or revise the reference docs as the concrete system teaches us.

The current V0 product contract is:

```text
hat communication brief
  -> send_supervisor_signal
  -> supervisor triage plan
  -> anchored work item and context
  -> gate decision
  -> hat assignment and scoped runtime authority
  -> scheduled prompt-flow run
  -> Hermes run binding
  -> evidence submission
  -> reviewer decision
  -> outcome review
```

Capability requests, credential requests, workflow gaps, memory gaps,
questions, and blockers enter through supervisor-chain communication
first. They become specialized work only after the responsible hat
triages them.

## Placement

These docs live at `agentic-organization/docs/` as the documentation root for the Agentic Organization subsystem. Runtime code can live under the Agentic Organization product tree, but cluster deployment should land as a `full-ai-cluster/k8s/applications/agentic-organization/` ArgoCD workload. Agentic Organization runs on the `full-ai-cluster` substrate; it is not a second cluster substrate.
