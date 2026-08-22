---
title: Implementation Readiness Checklist
canonical_name: Agentic Organization
status: design
---

# Implementation Readiness Checklist

This checklist defines what still needs to be decided before implementation begins. The goal is to avoid designing forever while still defining the contracts that would be painful to change after code exists.

## Start Condition

Implementation can begin once we define:

- the first MVP slice;
- the initial source-of-truth database choice;
- the first state machines;
- the first hat graph seed;
- the first MCP tool contracts;
- the first UI surfaces;
- the first runtime integration boundary for Hermes/Oz.

Everything else can evolve through the Organization itself.

The first narrowed contracts are now captured in:

- [V0 Executable Contract](./V0_EXECUTABLE_CONTRACT.md);
- [V0 Schema and Commands](./V0_SCHEMA_AND_COMMANDS.md);
- [V0 Policy and Runtime Boundaries](./V0_POLICY_AND_RUNTIME_BOUNDARIES.md).

## 1. MVP Slice

Define the first end-to-end workflow we will build.

Recommended first slice:

```text
ambiguous internal supervisor signal
  -> requirement maturity / discovery
  -> BRD/product signoff
  -> CA/design review
  -> initiative/task creation
  -> hat assignment
  -> Hermes/Oz run
  -> implementation evidence
  -> code review gate
  -> QA/evidence gate
  -> release/activation
  -> outcome review
```

For v0, reduce this to the smallest useful three-step vertical:

```text
supervisor-chain signal
  -> one readiness/gate decision
  -> one hat-assigned Hermes run with evidence
```

After that works, add BRD/CA, QA, release, outcome review, and self-improvement loops incrementally. The full lifecycle is reference material until a slice proves it.

Need to decide:

- exact example feature;
- which departments participate;
- which hats are active;
- which gates are required;
- which steps are simulated versus real in v0.

## 2. Application Boundary

Define what the first app is.

Need to decide:

- app name;
- repo/package location;
- whether this is a new app under `agentic-team/packages` or a separate top-level workspace;
- whether frontend and backend live together at first;
- whether initial deployment target is local Docker Compose, k3s, or both.

Placement decision:

- documentation lives under `agentic-organization/docs/`;
- product/runtime code may live under the Agentic Organization app tree;
- cluster deployment belongs under `full-ai-cluster/k8s/applications/agentic-organization/` as an ArgoCD-managed workload;
- Agentic Organization consumes the `full-ai-cluster` substrate and must not create a parallel cluster substrate.

Recommendation:

- start as a new Agentic Organization app, separate from dev-portal;
- use dev-portal/TPM only as reference and selective extraction source;
- build modular monolith first, with clear boundaries for later service extraction.
- use a TypeScript monorepo with `apps/api`, `apps/web`, `apps/workers`, `apps/temporal-worker`, `apps/dapr-actors`, and shared `packages/*` as defined in the build plan.
- treat deployment as a `full-ai-cluster` consumer workload from the first cluster integration.

## 3. Source of Truth

Pick the first database and transaction model.

Need to decide:

- CockroachDB deployment topology and local development shape;
- migration tool;
- event/outbox strategy;
- read-model/projection strategy;
- audit retention model.

Recommendation:

- CockroachDB first for Organization-owned state;
- Drizzle ORM for typed schema and migrations against CockroachDB's PostgreSQL-compatible interface;
- transactional outbox for signals;
- append-only audit events;
- read models for boards and UI projections.

## 4. Core Domain Model V0

Define the first tables/collections.

Must include:

- departments;
- hat definitions;
- hat assignments;
- hat supply policies;
- agents;
- agent sessions;
- projects;
- initiatives;
- work items;
- requirement maturity records;
- gates;
- gate decisions;
- assignments;
- hat schedule templates;
- work schedules;
- work schedule blocks;
- prompt-flow definitions;
- prompt-flow phases;
- prompt-flow runs;
- prompt-flow gate decisions;
- universal action definitions;
- universal action records;
- action observations;
- releases;
- discussion anchors;
- artifacts;
- signals;
- audit events;
- outbox events.

Can defer:

- full performance reviews;
- full department reviews;
- complex voting;
- full workflow registry;
- full actor registry;
- advanced prompt-flow effectiveness analytics;
- advanced memory analytics.

## 5. State Machines

Define v0 states and legal transitions.

Need to lock down:

- requirement maturity state machine;
- work item state machine;
- assignment state machine;
- gate state machine;
- release state machine;
- hat token state machine.

Important rule:

- state transitions must be service-owned and policy-checked, not arbitrary field updates.

## 6. Hat Graph Seed

Define the first hats that can exist in v0.

Recommended v0 hats:

- Executive Board Member;
- Product Owner;
- Customer Interviewer;
- Business Analyst;
- Business Approver;
- Architect;
- Architecture Reviewer;
- TPM;
- Engineering Manager;
- Implementer;
- Code Reviewer;
- QA Reviewer;
- Release Manager;
- Security Reviewer;
- Memory Curator;
- Platform Operator;
- Hat Designer.

Need to define for each:

- allowed MCP tools;
- approval scopes;
- memory scopes;
- default schedule template;
- available prompt flows;
- review/reflection requirements;
- credential scopes;
- assignable-by rules;
- token TTL;
- max concurrent assignments;
- lifecycle transitions allowed.

## 7. Policy Model

Define how authorization works before MCP tools exist.

Need to decide:

- hard-coded policy first or OPA from day one;
- policy file format;
- policy test strategy;
- how policy explains denials;
- how emergency override works;
- which actions require two-person or human approval.

Recommendation:

- start with typed policy checks in code plus structured policy metadata;
- design so OPA can be added without rewriting domain services.

## 8. MCP Tool Surface V0

Define first tool contracts.

Minimum tool families:

- goal/intake tools;
- requirement discovery tools;
- BRD tools;
- architecture tools;
- task/work tools;
- hat assignment tools;
- work schedule tools;
- prompt-flow tools;
- review/gate tools;
- artifact/evidence tools;
- messaging/inbox tools;
- status/read tools;
- Hermes/Oz run tools.

Need to define:

- request/response schemas;
- actor context requirements;
- policy checks;
- state transition effects;
- emitted signals;
- audit fields.

Knowledge Graph/Retrieval V0 decisions:

- first node and edge schema;
- context pack contract;
- indexing provider and reindex triggers;
- access-control envelope;
- provenance envelope;
- deterministic traversal versus semantic retrieval behavior;
- contradiction lifecycle;
- discussion anchor contract;
- schedule block contract;
- prompt-flow registry contract;
- universal action grammar contract;
- handoff brief requirements;
- attention queue contract.

Minimum preflight tools:

- `validate_start_work`;
- `validate_discussion_anchor`;
- `validate_schedule_block`;
- `validate_prompt_flow_start`;
- `validate_prompt_flow_phase_gate`;
- `validate_universal_action`;
- `validate_action_reversibility`;
- `validate_context_pack_current`;
- `validate_handoff_complete`;
- `validate_decision_memory_current`;
- `validate_no_blocking_contradictions`;
- `validate_required_docs_acknowledged`;
- `validate_lifecycle_transition`.

## 9. Hermes/Oz Boundary

Define exactly how the Organization launches and tracks Hermes work.

Need to decide:

- how Organization requests an Oz run;
- how run ID maps to work item, team, agent, hat assignment, and session;
- how logs/artifacts return;
- how heartbeat works;
- how child runs are requested;
- how cancellation/reassignment works;
- what happens when Oz run succeeds but Organization update fails, or vice versa.

Important naming decision:

- in cluster context, OZ has been clarified as OpenZiti;
- in Organization runtime docs, Oz has also been used as the macro agent-run orchestrator;
- before coding adapters, decide whether these are the same component, two components, or a naming collision.

Implementation should not blur OpenZiti transport with Organization run orchestration.

## 10. Actor Boundary

Define what is actor-backed in v0 versus plain DB service.

Recommended v0 actor candidates:

- `AgentSessionActor`;
- `HatSupplyActor`;
- `AgentMailboxActor`;
- `TeamRoomActor`;
- `OzRunActor`.

Can start with in-process interfaces and fake actor implementations if Dapr is deferred.

Need to define:

- actor method contracts;
- persistence ownership;
- idempotency rules;
- timeout behavior;
- reconciliation behavior.

## 10A. Cluster-Native Hat Boundary

Define whether the first implementation treats Kubernetes CRDs as:

- deferred future enforcement;
- generated read-only projections from Organization DB;
- live enforcement for active hat bindings;
- or a bidirectional proposal surface where cluster changes can request Organization approval.

Need to decide:

- whether `Hat`, `HatBinding`, `HatPolicy`, and `HatSwap` are part of v0 or v1;
- which hat fields are source-authored in Organization DB versus CRDs;
- where the TypeScript CRD contract package lives and how it is generated or checked against the YAML schema;
- which OPA constraints are required before live cluster assignment;
- whether hat graph rendering is built early for debugging/policy authors;
- how `HatSwap` maps to Organization signals and audit events;
- how warmup, cooldown, sticky attribution, succession, and reputation map into the assignment state machine;
- whether the hat operator is enforcement-only or can create Organization work requests.
- whether a future `operator-ts` shares the Go operator's leader-election Lease or uses an explicit disjoint ownership partition.

Recommendation:

- model the boundary now;
- implement Organization DB assignment first;
- add read-only TypeScript CRD consumption next: list hats, watch bindings, decode HatSwap, and project status into Organization signals;
- project to CRD/OPA enforcement once the first assignment state machine is stable;
- treat TypeScript operator reconciliation as a later parity milestone, not as the first blocking requirement.

Readiness tests before any TypeScript operator writes lifecycle status:

- CRD schema parity: TypeScript interfaces are generated from, or mechanically checked against, the CRD YAML;
- HatSwap parity: TypeScript and Go use the same event enum, payload fields, durable identity, and NATS/log/Event projection rules;
- controller ownership: Go and TypeScript share one leader-election Lease or have an ADR-backed disjoint ownership partition;
- projection idempotency: read-only TypeScript consumers can replay HatSwap CRs and NATS messages without double-counting a transition.

## 11. Scheduling and Hat-Owned Cadences

Define the first schedules that create work for role hats.

V0 schedules:

- TPM initiative movement review;
- Engineering Manager execution/readiness review;
- review queue review;
- QA flow review;
- release readiness review;
- hat supply and budget review;
- blocker triage routine.

Need to define:

- cadence;
- owner hat;
- generated report;
- generated queue item;
- escalation path;
- which parts are automatic versus hat-decided.

## 12. UI V0

Define the first screens before backend shape hardens.

Recommended v0:

- Organization map;
- Work board;
- Requirement maturity board;
- Hat assignment/supply view;
- Role workspace;
- Review center;
- Release board;
- Evidence timeline;
- Run/session view;
- Signal/event feed.

Need to decide:

- human user roles;
- whether agents also consume the same UI projections through MCP;
- live update mechanism;
- first dashboard read models.

## 13. Observability Contract

Define what every action emits.

Need to standardize:

- correlation ID;
- causation ID;
- trace ID;
- agent ID;
- hat assignment ID;
- work item ID;
- project/initiative scope;
- tool call ID;
- run ID;
- policy decision;
- artifact links.

No implementation should enter v0 without these fields being easy to attach.

## 14. Memory/Hindsight Contract

Define the minimum memory integration.

Need to decide:

- whether to fork Hindsight now or wrap it first;
- memory event schema;
- hat-attributed writes;
- scoped recall;
- memory visibility rules;
- how memories are linked to work items, projects, hats, and outcome reviews.

Recommendation:

- wrap first unless Hindsight cannot support attribution cleanly;
- fork only when the wrapper cannot enforce scope or metadata.

Cluster context to preserve:

- Hindsight is the real Hermes memory provider, not a placeholder;
- Hindsight is available as the `vectorize-io/hindsight` OCI Helm chart at `ghcr.io/vectorize-io/charts/hindsight`;
- the current target chart version is `0.3.0`;
- Hermes can point at the in-cluster service through `HINDSIGHT_URL=http://hindsight-api.hindsight.svc.cluster.local`;
- Hindsight automatically recalls relevant context before LLM calls, retains conversations, and exposes retain/recall/reflect tools;
- memory storage is precious and should not be pruned by default;
- secrets should be Vault-backed or equivalent, with no plaintext API keys in Git;
- bundled Postgres is acceptable for Hindsight bootstrap, but Organization-owned state uses CockroachDB and the long-term memory store should move to external CockroachDB if supported.

Need to decide before implementation:

- whether Hermes calls Hindsight directly, through an Organization memory adapter, or through a scoped sidecar/proxy;
- how hat assignment metadata is attached to every recall, retain, and reflect operation;
- how Hindsight health, recall latency, and memory write failures become Organization signals;
- what migration path exists from bundled Hindsight Postgres to external CockroachDB.

## 14A. Cluster Execution Contract

Define the first cluster session contract.

Need to decide:

- how Oz requests a k3s-backed Hermes session container;
- whether bubblewrap-style sandboxing is included in v0 or modeled as a required boundary for v1;
- which endpoints the session receives: MCP Gateway, Hindsight, NATS, Credential Proxy;
- how service account, mesh identity, Organization session ID, agent ID, hat assignment ID, and work item ID are correlated;
- how Cilium policy, SPIRE workload identity, Trust Manager CA bundles, and External Secrets synced secrets are represented in runtime context;
- how hat expiry or revocation terminates tool/credential authority in a running container;
- which runtime events are mandatory: pod ready, sandbox started, Hermes heartbeat, tool call, memory recall, credential proxy use, artifact upload;
- how logs, traces, screenshots, and artifacts link back to work items.

Cluster scaffold context to preserve:

- cluster scaffold is split into `usb-nixos-installer/` and `full-ai-cluster/`;
- k3s disables default networking so Cilium must be installed before ArgoCD;
- Cilium, cert-manager, Vault, SPIRE, Trust Manager, External Secrets, then ArgoCD is the security/bootstrap order;
- GitLab is default-on; Forgejo is a manual-sync alternative;
- local model serving through Ollama/vLLM and local coder models is deferred/manual;
- Warp is removed from the current stack;
- Hermes is custom and cloud-oriented for the current phase;
- Hindsight is the persistent memory system for Hermes;
- OpenZiti is the clarified OZ component in the cluster context.

## 15. Package Boundaries

Define initial modules.

Recommended backend modules:

- `organization-kernel`;
- `hat-graph`;
- `work-os`;
- `requirements`;
- `gates`;
- `assignment`;
- `messaging`;
- `documents`;
- `release-management`;
- `mcp-gateway`;
- `oz-runtime`;
- `memory-adapter`;
- `observability`;
- `ui-projections`.

Recommended frontend areas:

- organization map;
- boards;
- role workspace;
- reviews;
- releases;
- runtime;
- evidence;
- admin/policy.

## 16. Test Strategy

Define test expectations before coding.

Minimum tests:

- state transition unit tests;
- policy denial/approval tests;
- MCP tool contract tests;
- assignment race tests;
- hat token refresh/revocation tests;
- outbox/signal tests;
- requirement maturity gate tests;
- review self-approval block tests;
- release readiness tests;
- Oz run binding reconciliation tests.

## 17. Definition of Done for MVP

MVP is done when:

- a vague request can become a structured requirement;
- a BRD and CA can gate readiness;
- work can be created, assigned, reviewed, QA checked, and released;
- hats are issued and revoked reliably;
- Hermes/Oz runs are bound to work and visible;
- every state change emits signals and audit events;
- humans can see work, hats, reviews, releases, and evidence in the UI;
- one outcome review creates follow-up work or explicitly decides none is needed.

## Things We Should Not Define Too Early

Defer:

- full corporate hierarchy perfection;
- every possible hat;
- every possible MCP tool;
- full Temporal workflow catalog;
- full Dapr actor implementation;
- complete Hindsight fork;
- advanced performance review system;
- complex executive voting rules;
- multi-cluster production topology.

These should be built by the Organization once v0 can safely create governed internal work.
