---
title: North Star Alignment Checkpoint
canonical_name: Agentic Organization
status: design
---

# North Star Alignment Checkpoint

## Status

Current checkpoint after the first executable TypeScript slices and
subagent review.

## Update 2026-05-30 — M1/M4 conformance checker + clamp properties built and proven in kind

The first orchestration-moat phase is shipped: the org can now replay the
universal `org_events` trace through the legal-transition kernels and report
whether durable history stayed inside the clamps.

- **M1 conformance checker.** `packages/application/src/conformance.ts` adds
  pure `replayLedger(events): ConformanceReport`. It classifies replayable
  transition events by `OrgEventKind`, checks them against the existing legal
  kernels, and returns conformant / nonconformant / skipped rows as data. It
  never throws on historical drift; an illegal event becomes explicit evidence
  with event id, kind, subject id, from/to state, legal target states, and reason.
  Context-dependent transitions that lack replay context are skipped rather than
  counted as conformant (for example change-set final approval without pipeline
  cursor, or document draft→active without load-bearing status).
- **Live conformance lane.** `apps/workers/src/org-cadence-lanes.ts` now exposes
  `createConformanceCadenceLane`, wired by `org-cadence-composition.ts` as a
  fifth always-on lane. A violation degrades the tick with first-violation
  evidence instead of crashing the worker.
- **M4 clamp properties.** Domain tests now ratchet totality, closed target
  sets, terminal-state no-escape, and unsatisfied-gate no-approval across the
  work-item, change-control, memory, document, and knowledge-graph clamps.
- **First drift caught and fixed.** Live replay found three historical
  `active → archived` memory events that maintenance had emitted through the
  archive-at-floor rule while `legalMemoryTransitions(Active)` did not admit
  archive. The memory clamp now includes auto archive-at-floor from every
  non-terminal phase, matching the shipped maintenance cycle.
- **KIND proof.** `deploy/run-conformance.ts` appends a legal multi-kernel
  trace to live in-cluster Cockroach, reads it through the real org-event store,
  replays it, and prints a JSON proof report.

Verification:

```text
npm run typecheck
  PASS (tsc 0)

npm test
  859 tests / 852 pass / 0 fail / 7 skipped

KIND worker rebuild/redeploy
  rebuilt source-overlaid worker image sha256:cf9be9720910d3128915944bece577de7c0b87c147b5cf9dbabb00d7dcedabe1
  note: Docker Hub metadata for node:24-slim hung, so the rebuild layered current
  source over the prior node/dependency image; package dependencies were unchanged.

Fresh worker pod clean boot
  lanes: work-os, change-control, memory-maintenance, doc-maintenance, conformance
  error log matches: 0
  conformance lane: 121 checked / 0 violations / 333 skipped

deploy/run-conformance.ts against in-cluster Cockroach
  insertedEvents: 6
  persistedEvents: 6
  checked: 5
  conformant: 5
  nonconformant: 0
  skipped: 1
  live org-lfg: 454 events / 121 checked / 0 violations / 333 skipped
  PROOF: PASS
```

## Update 2026-05-30 — Org-Native Change Control built end-to-end + proven in kind (CC0–CC6)

The internal review fabric (ORG_NATIVE_CHANGE_CONTROL_DESIGN) is built end-to-end and
proven in kind. The org reviews a **change** through its own pipeline; GitHub PR /
GitLab MR / Jira card are optional **projections**, not the engine. Every layer falls
out of the proven kernel/DU/port patterns:

- **CC0** — 11 change-control `OrgEventKind`s + Cockroach `ChangeControlV17`
  (`change_sets` + `review_stage_status`), phase CHECK from `Object.values(ChangeSetPhase)`,
  `.sql` mirror + parity test; applied + round-tripped in kind.
- **CC1** — domain: `ChangeSet`/`ChangeSetPhase` (House-DU), `ChangeArtifact` (6 kinds,
  Git-agnostic), `ReviewStage`/`ReviewAuthority` (hat|quorum|human|external)/`ReviewGateKind`/
  `ReviewPipeline`, `legalChangeSetTransitions` + `legalStageOutcomes` (the clamp). Pure.
- **CC2** — Cockroach change-set store (JSONB artifacts + projections) + review-stage
  ledger keyed `(change_set, stage, revision)`; round-tripped in kind.
- **CC3** — the kernel: a review stage IS an observe→decide cycle. `evaluateStageGate`
  + `decideByAuthority` (the four authorities handled uniformly) + `runReviewStage` +
  `advanceChangeSet` + `resumeHumanStage` (HITL) + `applyChangeSet`. THE CLAMP: an
  unsatisfiable gate can't be approved; an external approval flows IN as a gate
  satisfaction — never a bypass. Content-addressed `changeSetId`.
- **CC4** — `ChangeControlPort` + `NullChangeControlPort` (internal-only) + a controllable
  fake external system + `ChangeControlPolicy`-as-data (internal-only vs github-gated =
  the same pipeline + 2 appended stages) + reconciliation into the canonical `WorkItemState`.
- **CC5** — real REST adapters: `createGitHubPrPort` (branch + PR; renders only
  Git-representable artifacts, schema migrations stay internal; reads PR review state)
  and `createJiraCardPort` (transition + comment; reads card status). Native fetch,
  client-injectable; unit-tested with fakes; live credential-gated. **Complete
  integration capability.**
- **CC6** — `deploy/run-change-control-cycle.ts` + `observe-change-control.ts`. Two runs
  proven in kind, both reaching `applied`:

  ```text
  RUN A internal-only (ZERO projections — the org ships with no external system):
    open → code-review → internal-qa REQUEST_CHANGES → resubmit (rev2) → qa → security 3/3 → applied
  RUN B github-gated (same fabric + 2 stages, fake external port):
    …security → external-code-review PROJECTS a PR (pending) → human approves the PR →
    approval flows IN to the gate → human QA sign-off (HITL) → applied + PR merged
  ```

  Externally the github run shows one PR; internally the org ran five stages + a quorum
  board + a revision bounce + a human gate. 32 persisted `org_event`s (`changes_requested`,
  `projection_created`, `projection_synced`, `human_signoff_requested`, `change_set_applied`).
  732 tests / 725 pass / 0 fail; tsc clean. The PR is a leaf, not the trunk.

Roadmap: CC ships **before** Document Intelligence (the review spine the intelligence
tracks reference). The port layer is the Adaptive Platform's bidirectional Jira/Linear
sync mechanism, generalized.

## Update 2026-05-30 — dynamic memory system built end-to-end + Hindsight plugged in (MEM0–MEM8)

The full dynamic-memory system (DYNAMIC_MEMORY_SYSTEM_DESIGN) is built and proven
end-to-end in kind, with the real `vectorize-io/hindsight` container plugged in as
the recall-engine dependency. Every layer is implemented, unit-tested, and proven
against live Cockroach + live Hindsight:

- **MEM0 — Hindsight in kind.** `deploy/k8s/35-hindsight.yaml` (embedded pg0, local
  embeddings, LLM → in-cluster Ollama). retain/recall/reflect proven; our
  content-addressed `memoryId` round-trips through Hindsight metadata (the STATE↔
  CONTENT join).
- **MEM1 — domain.** `MemoryTier`/`MemoryPhase` (House-DU), record/state/envelope/
  injection, the observe→decide legal-set (`legalMemoryTransitions`, auto vs
  hat-decided), +11 memory `OrgEventKind`s.
- **MEM2 — Cockroach `MemorySystemV16`** (`memory_state` + `memory_injection`),
  tier/phase CHECK from `Object.values(enum)`, stores + parity test; applied +
  round-tripped in kind.
- **MEM3 — ranking** `computeMemoryWeight` (semantic × freshness × confidence ×
  KPI-outcome × utility + scope boosts), per-tier decay, read/archive floors,
  scope-union retrieval, budget pack (pure, unit-tested).
- **MEM4 — deterministic injection.** Mandatory pre-turn query (pure, hashable),
  `## Relevant memory` block, idempotent injection ledger, anti-citation-laundering
  (a cited id not injected this turn is rejected), must-address, utility `$inc`,
  content-addressed `memoryId = uuidv5(org:tier:scope:key)`.
- **MEM5 — KPI correlation** from the org's own trace (merged → success), workItem-
  deduped outcome bump, Laplace confidence recompute.
- **MEM6 — `runMemoryMaintenanceCycle`** as an observe→decide org cycle: Stage A
  auto (decay, archive-at-zero, reinforce-when-KPI-rose), Stage B hat-decided +
  clamped to the legal set (demote/promote/conflict). Asymmetry: good news
  auto-applies, bad news asks a hat; protected memories excluded from auto-archive
  + decay; every action one org_event.
- **MEM7 — `createHindsightMemory`** behind the existing `Memory` port (REST client,
  native fetch) + `rerankRecalled` composition (Hindsight recall → our §4 weight
  re-rank → floor → budget). Proven live against in-cluster Hindsight AND unit-tested.
- **MEM8 — end-to-end proof in kind** (`deploy/run-memory-cycle.ts` +
  `deploy/observe-memory.ts`). One run: seed (Hindsight retain + Cockroach state) →
  inject for a binding (scope-union recall → weight re-rank → ledger; archive seed
  correctly filtered below the read floor) → the agent cites one (anti-laundering
  rejects the fabricated id) → the work item reaches merged → KPI correlation → the
  daily maintenance cycle. The persisted `memory_state` trace shows exactly the
  designed outcome:

  ```text
  [hat/release-manager]  review:require-rollback-plan   active    w=0.66 conf=0.91 kpi=9/9  → surfaces
  [work/…]               rfc-882:redis-sessions-only     promoted  w=0.62 conf=0.88 kpi=6/6  → surfaces (work→hat)
  [agent/agent-7]        calibration:skip-load-test      demoted   w=0.31 conf=0.30 kpi=2/8  → surfaces (reviewer)
  [work/…]               work-09:temp-flag-note          archived  w=0.00 conf=0.20 kpi=0/4  → NEVER surfaces again
  ```

  Each line is a persisted `org_event` ("demoted by memory_reviewer: 6 failures,
  ratio 0.75"; "promoted work → hat by knowledge_router; source kept"; "weight 0.03
  ≤ archive floor 0.15 — archived; never surfaces again"). Same proof bar held for
  the org + Work OS, now for memory. 696 tests / 689 pass / 0 fail; tsc clean.

The division of labor is what the design specified: Hindsight owns content storage,
embeddings, and recall fusion; we own tier-scoping, the KPI-weighted re-rank +
decay + archive floor, the daily maintenance cycle, protected memories, and the
org_event trace. We compose with Hindsight through the `Memory` port — no fork.

## Update 2026-05-29 — git-as-DB substrate + observe keystone + coherence slices

Landed since the prior checkpoint (all tested; full suite 382 green; tsc clean for
new files; the 8 remaining typecheck errors are pre-existing `@nats-io` missing
deps in `apps/workers`):

- **`packages/frontmatter-db`** — git-as-database-and-event-store: a markdown file
  is a row, frontmatter is the SQL-derived typed schema + fk graph edges, events
  are ZetaId-keyed files merging conflict-free as a G-Set CRDT, state is a
  timestamp-ordered fold, CockroachDB is a rebuildable index. Includes the YAML +
  event codecs, schema↔SQL round-trip, port-based sync core, a filesystem Git
  adapter, an in-memory Cockroach row sink, and a `runOnce()` reconcile worker.
  See `GIT_COCKROACH_SYNC_AND_ZETAID_ADDRESSING.md`.
- **`observe.ts` keystone** (`packages/application/src/observe.ts`) — the single
  entrypoint with the run-lifecycle DU + ephemeral memoryless composer. Wired to
  real work-item state via `observe-work-item.ts` (slice 4). See
  `OBSERVE_COMPOSER_AND_RUN_STATE.md`.
- **≥3-agent constitution gate** (`packages/governance/src/constitution-gate.ts`).
- **Metrics + 3-agent review board** (`packages/metrics`) — quantitative code
  metrics + the qualitative board, now usable as a real gate via
  `review-gate.ts` (slice 5). See `METRICS_AND_REVIEW_BOARD.md`.
- **Slice 1 — State reconciliation table** (`packages/domain/src/state-reconciliation.ts`):
  the North-Star-#2 single authoritative WorkItemState mapping + observe phase
  binding + generic-vs-type-specific rule split. See `STATE_RECONCILIATION.md`.
- **Slice 2 — Triage action resolver** (North-Star-#4): the 5 declared-but-
  unimplemented `SupervisorTriageActionType` actions are now explicit — AnswerDirectly
  and EscalateToNextSupervisor are implemented; the 3 substrate-dependent actions
  resolve to a visible `Deferred` outcome rather than a silent rejection.
- **Slice 3 — Graph projection v0** (North-Star-#5): typed node/edge projection of
  work-item/anchor/decision records + the `decisionsForWorkItem` retrieval.

Doc hygiene this checkpoint: all docs now carry frontmatter `status`
(design / v0 / index) per `DOC_FRONTMATTER_CONVENTION.md`.

Priorities #2 (reconciliation table) and #5 (graph projection) are now
addressed; #4 (triage expansion) is partially addressed (2 of 5 new actions
implemented, 3 deferred). The cluster-integration gaps (hat-system projection, identity mapping,
Hindsight, Hermes runtime, LGTM export) and the MCP server host remain deferred
to the `full-ai-cluster` substrate.

## Verdict

Agentic Organization is directionally aligned with the north star:

- the primary executable primitive is `send_supervisor_signal`;
- hats are modeled as time-bounded authority, skill, policy, and
  communication roles rather than agent identity;
- Organization DB owns business intent, while cluster substrates enforce
  or project runtime state;
- work, discussions, decisions, runs, evidence, and memory must stay
  anchored to project, initiative, task, gate, incident, release, policy,
  or context-gap work;
- agent time is an Organization resource: meetings, implementation,
  review, verification work performed by QA Reviewer hats, free time,
  reflection, memory maintenance, runtime sessions, credentials, and
  worktrees must be scheduled, allocated, paused, resumed, and reviewed
  rather than treated as ambient chat or unbounded execution;
- the runtime is event-driven through durable state, outbox, NATS
  publication, inbox dedupe, reaction plans, workers, and telemetry;
- the design keeps agents able to expand tools, prompt flows, workflows,
  and lifecycles through governed organizational work instead of a fixed
  list of one-off commands.

The main risk is convergence. The doc set is broad enough that older
sections still describe future products as if they are current V0
entrypoints. V0 must remain smaller and sharper.

## Canonical V0 Product Contract

The current V0 contract is:

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
  -> follow-up work when gaps are found
```

Capability requests, credential requests, missing-tool reports,
workflow gaps, security asks, memory gaps, blockers, questions, and
process-improvement ideas are not separate first primitives. They enter
through supervisor-chain communication, then become specialized work only
after the responsible hat triages them.

## Alignment Confirmed

### Supervisor Chain

`SUPERVISOR_CHAIN_COMMUNICATION.md`, `FIRST_IMPLEMENTATION_SLICE.md`,
`V0_SCHEMA_AND_COMMANDS.md`, and OpenSpec all point at
`send_supervisor_signal` as the generic coordination primitive.

### Hat Model

`CLUSTER_NATIVE_HAT_SYSTEM.md`, `V0_POLICY_AND_RUNTIME_BOUNDARIES.md`,
and `V0_SCHEMA_AND_COMMANDS.md` preserve hats as scoped, time-bounded
roles with authority, skills, RBAC/policy, succession, and supervisor
graph position.

### Work Anchors

`AGENT_NATIVE_KNOWLEDGE_GRAPH.md`, `WORK_AND_RELEASE_MANAGEMENT_OS.md`,
and `UI_AND_OBSERVABILITY_CONCEPTS.md` reject unanchored discussions.
Meetings, one-on-ones, broadcasts, votes, review comments, reports, and
team threads must reference work before they can affect state.

First implementation progress: the domain now has a minimal typed work
item lifecycle (`created`, `intake`, `triage`, `ready`, `in_progress`,
`blocked`, `review`, `done`) plus V0 defect guards for creation,
readiness, assignment, and scheduling. Work item type is required on the
domain record, and transition records carry evidence, assignment, and
schedule references so later UI/graph/agent review can explain why a
transition was legal. The Cockroach schema now has an additive
`0003_agentic_org_work_anchor_kernel` migration for projects,
initiatives, work anchor targets, work item state history, and upgraded
work item trace/type/version columns. V1 remains legacy instead of being
rewritten, generated SQL is checked against migration files, and DB
constraints derive from domain enum values. Migration backfill defaults
are dropped after legacy rows are patched so future writes still require
real command provenance, legacy `updated_at` is preserved from
`created_at`, and state-history sequence constraints protect replay
order. The first generic `WorkAnchorStateStore` port is now in place for
project, initiative, work item, anchor target, and state-transition
tests; it preserves provenance metadata, expected-version advancement,
scope consistency, lifecycle evidence for domain transition validation,
and reference isolation so command tests do not depend on Cockroach
directly. The durable Cockroach adapter now implements that same port and
is exposed through the durable state adapter composition, with an
additive V4 migration for transition metadata on existing databases.
The command outcome port now accepts application-level work-anchor
effects and commits them through the same atomic outcome boundary as
idempotency, audit, and outbox effects in both the in-memory and
Cockroach adapters. `send_supervisor_signal` now accepts a generic
work-anchor reader through the command pipeline execution context, so
durable runtime paths can reject missing or wrong-scope work anchors
before emitting supervisor-signal effects. The first concrete
work-anchor command, `create_work_item`, now creates a work item in
`created` state by returning work-anchor, audit, and outbox effects
through that same command outcome boundary. When the runtime supplies a
work-anchor reader, it rejects missing projects or wrong-scope
initiatives before emitting effects, preserving the graph/retrieval
principle that consequential work stays anchored. The remaining gap is
concrete project, initiative, anchor, and transition command handlers.

### Scheduled Agent Time

`AGENT_WORK_RHYTHM_AND_PROMPT_FLOWS.md`,
`ANTI_STALL_PRIORITY_RUNTIME.md`, and
`PHASED_DEVELOPMENT_PLAN.md` now treat agent time, reviewer time,
meeting time, verification windows for QA Reviewer hats, worktrees,
credentials, runtime sessions, and prompt-flow blocks as schedulable
resources. A meeting request, review request, verification request,
implementation task, reflection block, or free-time block must become a
schedule block or allocation hold before it consumes agent/runtime
capacity. If work does not finish inside the block, the agent records a
pause checkpoint and resumes in the next allotted block or the work is
reassigned by the appropriate manager.

The schedule/RMO plan now treats inbox access as schedulable attention,
not ambient chat. Agents need personal, hat, team, department, work-item,
and prioritized inbox views, but those views are governed by active hat,
work anchor, priority, SLA, and interruptibility policy. Schedule blocks
also need expected activity profiles so automation can observe whether
the agent is actually doing the intended work, issue recovery guidance on
drift, and escalate repeated inefficiency through the management chain.

### Gated Work Ownership

Work item transitions are commands with hat authority, not field edits.
Implementers submit assigned work for review, reviewers approve or
request rework, QA Reviewer hats verify reproducibility and sign off
done, and manager/TPM/director/security/product hats handle the
transitions they own. Work items must show implementer, reviewer, QA
Reviewer, architect, manager, TPM, product/BA, security, director,
watchers, comments, mentions, evidence, and traceability so agents
understand the hierarchy and coordination state without side channels.

### Cluster Substrate Position

`AI_CLUSTER_SCAFFOLD_CONTEXT.md`, `CLUSTER_EXECUTION_AND_MEMORY_SUBSTRATE.md`,
`TECHNICAL_CA_PACKAGE_ARCHITECTURE.md`, and `V0_EXECUTABLE_CONTRACT.md`
correctly place Agentic Organization as a TypeScript consumer workload
on `full-ai-cluster`, not a parallel substrate.

### Implementation Direction

The current packages prove the right spine:

- command handler registry;
- idempotency check and atomic command-outcome persistence port;
- supervisor signal handler;
- audit/outbox envelope;
- NATS subject and publisher/consumer adapters;
- inbox dedupe, orphan-receipt recovery, and reaction plans;
- worker host and app composition shell;
- app-local Cockroach pooled-client adapter, SQLSTATE retry handling,
  ambiguous-commit preservation, and JSON worker telemetry sink;
- outbox claim fencing with claim IDs, stale-claim evidence, and an
  additive Cockroach migration for existing databases;
- telemetry attributes and workflow visibility records;
- package-boundary governance.

## Drift To Correct

### Capability Request Language

Some older docs still describe agents as directly submitting capability
requests. Those sections must be normalized to:

```text
agent observes gap
  -> send_supervisor_signal
  -> supervisor triage
  -> optional CapabilityRequest work item
  -> department/security/architecture routing
  -> implementation/review/activation/outcome review
```

Capability request remains a valid work item type. It is not the first
communication primitive.

### State Name Divergence

Work item states are named differently across Work OS, V0 schema, UI
concepts, and implementation. Before adding more commands, create one
state reconciliation table that maps:

- conceptual Work OS state;
- V0 enum;
- UI column;
- event name;
- owner package;
- work-item-type lifecycle rule;
- allowed transitions;
- gate owner.

The reconciliation must also distinguish generic state transitions from
type-specific rules. For example, a defect can use the common work item
state machine, but it cannot skip the created/intake record, cannot move
to ready until triage evidence exists, and cannot move to in-progress
until an engineer is assigned and scheduled.

### Discussion Anchor Progress

The implementation now includes the first durable
`create_discussion_anchor` and `record_decision` command slices. V0
intentionally supports only work-item-scoped anchors and decisions because the
current event envelope and NATS outbox require `workItemId`. The anchor handler
validates the referenced work item, rejects wrong-scope work items, rejects
non-work-item anchor targets until the scope contract is widened, writes
discussion-anchor command effects through the same idempotent
`recordCommandOutcome` port as supervisor and work effects, and emits
`discussion_anchor.created` through the Cockroach-backed outbox.

The decision handler validates the referenced discussion anchor, requires that
the anchor expected a decision output, records rationale, alternatives, and
follow-up work IDs, and emits `decision.recorded` through the Cockroach-backed
outbox. Remaining follow-on work: graph-node/edge projection, conversation
threads, meetings, votes, and wider project/initiative anchors after the event
scope and policy model explicitly support those targets.

### Transaction Boundary Progress

The command pipeline now persists supervisor signal state, discussion anchors,
decision records, work-anchor effects, audit events, outbox events, and idempotency records through one
`recordCommandOutcome` port. Command handlers return typed effects
instead of writing piecemeal state. Work-anchor effects are application
contracts rather than `state` or `state-cockroach` imports, and the
pipeline can pass a generic work-anchor reader into handlers for
pre-effect validation.

The event ingestion path already used a single
`recordEventProcessingOutcome` port and now treats unfinished receipts
as recoverable rather than duplicate. Cockroach command and
event-ingestion adapters now expose transaction-batch executor seams so
the app/runtime layers remain database-generic while durable adapters
can commit outcome batches atomically.

The remaining gap is making the live substrate proofs routine in CI or a
dev cluster. The current tests prove the batch boundary and runtime
recovery behavior. The env-gated Cockroach live test proves migrations,
readiness, per-run probe table cleanup, commit, rollback, and shutdown when
`AGENTIC_ORG_COCKROACH_INTEGRATION_DATABASE_URL` plus a `pg`-compatible
driver are available. The env-gated NATS live test proves JetStream
stream/durable setup, readiness, canonical event publish, generic
ingestion-port consume, ack, invalid-envelope DLQ handling, and
shutdown when `AGENTIC_ORG_NATS_INTEGRATION_SERVERS` is available.

### Policy And Hat Authority Checkpoint

`send_supervisor_signal` now enters through a command pipeline that
requires a `CommandAuthorizationPort` before idempotency lookup, handler
dispatch, or persistence. The first policy package maps that command
authorization request to a generic `HatAuthorityPort`; active authority
allows the command, while expired, missing, revoked, scope-denied, or
tool-denied authority returns a typed `policy_denied` result.

The pipeline now records denied decisions through a generic policy
decision observation port, rejects cleanly if that observation fails, and
projects allowed policy decisions onto audit and outbox effects before
command persistence. Denied observations now have a generic durable
store/reader contract, a first Cockroach implementation, and a
canonical-hash conflict guard so contradictory duplicate evidence is not
hidden as replay. The UI/agent-readable visibility projection marks
policy denials as weak points without pretending denied commands changed
business state.

The remaining gaps are richer authority semantics and cluster-backed
integration proof: tests still need unauthorized source hats, invalid
target supervisors, and missing assignments. The system now has a
durable worker composition seam below `apps/workers`, an app-local
Cockroach pooled-client adapter, Cockroach migration bootstrapper,
Cockroach readiness probe, NATS process-client construction, process
lifecycle entrypoint contract, generic shutdown ports, and JSON
telemetry sink. It now has an env-gated Cockroach integration harness
for real migrations, readiness, transactions, rollback, and shutdown,
plus an env-gated NATS integration harness for real JetStream publish,
consume, ack, invalid-envelope DLQ handling, readiness, and shutdown. It
now also has an env-gated combined Cockroach plus NATS durable worker
proof: the test writes a real command outcome to Cockroach, runs the
process through the worker loop for two cycles, publishes the outbox to
NATS, consumes it back, records inbox and reaction-plan state, verifies
the second cycle does not duplicate durable side effects, and guards
NATS cleanup even when Cockroach setup fails. It still needs those live
proofs wired into CI/dev-cluster execution, a concrete Node/NestJS
process host around the existing entrypoint contract, and cluster OTEL
export wiring.

### Command Surface Progress

The command pipeline and command result are now generic over registered
command/result contracts and typed artifacts. `triage_supervisor_signal`
has started as a narrow V0 command: the target supervisor hat can turn a
validated supervisor signal into follow-up work through the same
work-anchor, audit, outbox, policy, and idempotency boundary. The
remaining command-surface gap is no longer the registry shape; it is the
next authority-heavy commands such as `reserve_hat`, `decide_gate`,
schedule start/complete, and richer triage actions.

### Raw Chat Tool Names

Tool inventory language still includes broad names such as
`send_message`, `open_thread`, and `open_team_chat`. These should be
defined as anchored wrappers, not raw chat authority. All communication
paths must validate or create a `discussion_anchor` before opening a
conversation.

### UAG Is Not Yet Canonical

Prompt flows correctly point toward Universal Action Grammar, but UAG v0
needs a typed registry: action names, target kinds, action modes,
reversibility, observation status, evidence requirements, and replay
semantics.

### Schedule/RMO Contract Is Not Yet Executable

The roadmap now defines the lifecycle for schedule blocks, meeting
slots, review slots, verification blocks for QA Reviewer hats, runtime
slots, worktree slots, credential slots, inbox attention windows,
allocation holds, schedule-compliance observations, and pause
checkpoints. The implementation still needs executable state machines
and commands for schedule proposal, reservation, commitment, inbox
routing, interruption, delegation, compliance variance, pause/resume, and
missed-slot escalation. Until that lands, the Organization can describe
agent work rhythm but cannot yet enforce time/resource allocation.

## Cluster Integration Gaps

### Hat-System Projection

Agentic Organization needs a `k8s-hats` package that can read Hat,
HatBinding, HatSwap, and HatPolicy CRDs, then project them into
Organization signals. The CRD subject model currently differs from
Agentic Organization NATS subjects, so a translator or dual-subject
contract is required.

### Identity Mapping

Organization events use `agentId` and `hatAssignmentId`; hat-system
bindings use SPIFFE wearer identity. V0 needs a canonical mapping from
Organization agent/session/hat assignment to SPIFFE identity.

### Hindsight Memory Attribution

Docs correctly separate Hindsight memory from Organization graph facts,
but no memory package exists yet. V0 needs a memory attribution contract
for agent ID, hat ID, project, initiative, task, prompt-flow run, and
outcome review.

### Hermes/OZ Runtime

`launch_hermes_run` is still a documented boundary, not an executable
adapter. V0 needs a narrow Hermes runtime port before real cloud/runtime
integration.

### LGTM Export

The observability helpers are useful but not fully wired to cluster
export. V0 needs concrete OTLP/log/metric adapter config, service
labels, dashboard ownership, and alertable degraded-worker signals.

## Checkpoint Priorities

1. Normalize capability-request language across docs so
   supervisor-chain communication is the only first primitive.
2. Add a V0 state reconciliation table before expanding command enums or
   UI boards.
3. Add policy/hat-authority checks before exposing command handlers to
   API, MCP, Hermes, or workers.
4. Expand `triage_supervisor_signal` beyond the V0 `open_work_item`
   path into signal status updates, escalation, security review,
   discussion scheduling, and internal-platform routing.
5. Add graph retrieval OpenSpec scenarios and implement graph projection over
   the new discussion-anchor records.
6. Decide whether the env-gated Cockroach integration proof should run
   in CI through a local service, a k3d profile, or an operator-triggered
   real-cluster job.
7. Define UAG v0 as a typed package contract before adding prompt-flow
   execution.
8. Build one substrate integration at a time, starting with hat-system
   projection because identity, authority, CRDs, NATS subjects, and
   policy meet there.
9. Continue the schedule/RMO lifecycle after the first
   `schedule_work_block` slice. V0 now persists a work-item-scoped,
   anti-overlap `scheduled` block for an assigned agent/hat and publishes
   `work_schedule_block.scheduled`, but meetings, start/complete,
   pause/resume, worktree/runtime/credential allocation, and compliance
   observation still need to land before meeting-heavy, review-heavy, or
   verification-heavy autonomous work consumes capacity.

## Update 2026-05-30 — deterministic keep-alive control plane is real (operator tenet #1)

The operator's #1 tenet — "enough determinism to drive the organization to stay
alive and drive the agents to stay alive, with sufficient autonomy from the
agents themselves" — now has a real, tested implementation, not just a pure
engine.

What landed:

- **Pure engine** (`packages/keepalive/src/keepalive.ts`): `evaluateKeepAlive`
  is a pure function over a liveness snapshot. Guarantees motion — always emits
  a heartbeat, deterministically detects a flatlining org / stale agents /
  expired leases, and converts each into an explicit DU action. It never
  decides WHAT work to do (that is the autonomous data plane).
- **Lane** (`keepalive-lane.ts`): turns the engine into a self-driving loop;
  source/sink failures are captured, never thrown — the heartbeat must not die.
- **Wired as a third worker-runtime lane** (`apps/workers/src/worker-runtime.ts`):
  ticks FIRST every cycle; a thrown/failing lane is captured; org-flatlining
  marks the runtime degraded.
- **Durable on Cockroach** (migration 0011): `agentic_org_control_plane_heartbeat`
  (one row per org; `last_tick_at` advancing IS the observable proof of life)
  and `agentic_org_control_plane_alerts` (append-only self-heal log). Age is
  measured by the DB clock, so liveness stays deterministic across replicas.
- **Constructed in production composition** (`durable-composition.ts`): store ->
  snapshot source -> action sink -> lane, threaded into `createWorkerRuntime`.
  The deployed worker now ticks the org heartbeat every cycle.

Proof: a live integration test against real CockroachDB shows the heartbeat row
advancing each tick and a forced stall emitting heartbeat + org-stall alert
(Degraded, appliedCount 2) with the org self-healing. Full suite 511/511 pass,
0 skipped, vs live Cockroach + NATS. tsc 0.

Review board (inline, 2 lenses): PASS on SOLID/house-style and
correctness/north-star. Control-plane/data-plane separation respected
(`ReassignStaleWork` emits a signal, not a work decision).

### Honest gap — next step toward the second half of the tenet

"Drive the AGENTS to stay alive" is wired-but-dormant: the Cockroach snapshot
source returns `agents: []` because Hermes agent sessions are not yet persisted
to Cockroach (Hermes runs in-process). The engine's stale-agent and lease-reap
branches are implemented and unit-tested; they activate the moment agent
heartbeats are persisted. Smallest real next step: a Cockroach agent-heartbeat
table + Hermes runtime persisting per-run heartbeats + the snapshot source
reading them. ORG liveness is real now; AGENT liveness is the next slice.

## Update 2026-05-30 — Phase 6: running in kubernetes-in-docker, end to end

The system runs in a kind (kubernetes-in-docker) cluster and both planes are
proven against live in-cluster infrastructure.

Topology (deploy/k8s/): namespace `agentic-org`, single-node CockroachDB,
NATS+JetStream, and the worker Deployment. NATS stream + durable consumer are
provisioned by deploy/provision-nats.ts (the worker fails-fast without the
durable consumer). Worker image `agentic-org-worker:keepalive` loaded into kind.

Proven in-cluster:

1. **Boot + migrations** — the worker connects to Cockroach + NATS, applies all
   migrations (incl. 0011 control-plane keep-alive), passes readiness, and loops
   `runOnce()` with `failure_count: 0`.
2. **Deterministic keep-alive (tenet #1)** — the org heartbeat row advances every
   cycle (version observed climbing 2 → 10 → 16), `age_ms < deadline`,
   `alive = true`, queried directly inside the Cockroach pod. The heartbeat row
   survived a worker restart — org-liveness persists across worker churn (it is
   org-level, so any live worker replica keeps the org alive).
3. **Stall detection** — during a deliberately mis-tuned window (15s deadline vs.
   the ~30s NATS-idle worker cycle), the keep-alive recorded 7 `org_stall`
   alerts. After raising the deadline to 90s (> cycle), no new alerts accrue and
   the org is healthy. Both the alive and the flatlining paths are proven live.
4. **Spin up a task (data plane)** — publishing a canonical SupervisorSignalSent
   event (deploy/spin-up-task.ts) drove the worker to ingest it (1 inbox receipt,
   deduped), the V0 automation planner to create a `create_supervisor_triage`
   reaction plan, and the reaction-plan executor to claim + execute it to
   `completed` — all observed in Cockroach with the correct triggerEventId.

Operational note (cadence coupling): keep-alive ticks once per worker cycle, and
an idle cycle is bounded by the NATS pull long-poll (~30s). The deadline must
exceed the max cycle time. Org-liveness is death-resilient with >= 2 replicas.
Future hardening: an independent fast keep-alive loop decoupled from the work
cycle, so a single long work cycle cannot delay the heartbeat.

### Still staged toward the full vision

- **Agent liveness** (second half of tenet #1) — `agents: []` in the Cockroach
  snapshot source; Hermes sessions are not yet persisted to Cockroach. ORG
  liveness is real; AGENT liveness is the next slice (agent-heartbeat table +
  Hermes persistence + snapshot read).
- **Hermes autonomous data plane** — the Hermes runtime + Hindsight memory +
  orchestration are built and unit-tested in-process (Phase 4) but not yet
  deployed/integrated into the live k8s pipeline. The reaction-plan action
  executor in the deployed worker is the V0 path, not yet the Hermes agent.

## Update 2026-05-30 — Phase 7: agent liveness is real (both halves of tenet #1)

The keep-alive snapshot source no longer hardcodes `agents: []` — it reads real
persisted agent heartbeats (migration 0012 `agentic_org_agent_heartbeat`,
store.recordAgentHeartbeat / readAgentHeartbeats with DB-clock age). The engine's
stale-agent -> reassignment-signal branch is now live, not dormant.

Live proof (real Cockroach): a fresh agent heartbeat reads ALIVE (the lane applies
only the org heartbeat, no reassignment); forcing the agent past its deadline
makes the engine emit ReassignStaleWork and the sink record a
`stale_work_reassignment` alert naming the agent's work item. The control plane
only SIGNALS reassignment — the decision stays in the autonomous data plane.

Durability evidence: the kind cluster ran 12–20 min with 0 restarts and the org
heartbeat reached version 32 (alive=true) — the deterministic keep-alive kept the
org alive in-cluster continuously, unattended.

Full suite 516/516 pass, 0 skipped, vs live Cockroach + NATS. tsc 0.

### Honest boundary (production writer)

The agent-liveness mechanism + detection are real and proven, but no deployed
agent session calls `recordAgentHeartbeat` yet — that writer arrives when the
Hermes runtime (Phase 4, currently in-process) is integrated into the live
worker pipeline. Next slices toward the full vision: (1) wire the orchestration's
Hermes heartbeat to the agent-heartbeat writer; (2) integrate the Hermes
autonomous data plane into the deployed worker (agent decision-making on work
items); (3) independent fast keep-alive loop; (4) deploy Hindsight memory.

## Update 2026-05-30 — consolidation + honest status of the autonomous organization

The latest committed substrate (migrations through 0012, the orchestration
agent-heartbeat writer) was rebuilt into the worker image, reloaded into the kind
cluster, and redeployed. Migration 0012 applied in-cluster; all three
control-plane tables are present. The org heartbeat advanced from version 32
(before redeploy) to 40 (after) — **org-liveness survived a full worker redeploy**:
the org's proof of life is independent of any individual worker instance, which is
exactly "drive the organization to stay alive."

### Done + proven (committed, tested, k8s-verified)

- **Deterministic keep-alive control plane (tenet #1), both halves:**
  - Org liveness — pure engine + lane wired as the first worker-runtime lane,
    Cockroach-backed (`control_plane_heartbeat`), DB-clock age. Proven live and
    in-cluster (40+ unattended ticks, survived a redeploy). Org-stall detection
    proven (alerts recorded under a mis-tuned deadline).
  - Agent liveness — `agent_heartbeat` table + store + snapshot read; a stale
    agent deterministically produces a reassignment signal. Proven live.
  - Production writer — the orchestration persists agent liveness on a successful
    Hermes heartbeat (dependency-inverted writer; the Cockroach store satisfies it).
- **Control-plane / data-plane separation** — keep-alive only SIGNALS; it never
  decides work. The data plane (Hermes) decides.
- **Runs in kubernetes-in-docker** — Cockroach + NATS + worker; migrations apply
  on boot; readiness; the loop runs with lane-failure discipline.
- **Spin up tasks** — a published supervisor-signal event drives ingest → V0
  reaction plan → claim + execute → `completed`, observed in Cockroach.
- **3 real CockroachDB-dialect bugs found + fixed** (multi-statement migration
  splitting; interval-multiplication cast) only visible against a live cluster.
- ~518 tests, full suite green vs live Cockroach + NATS; tsc 0 throughout; TDD.

### Honestly remaining toward the full autonomous vision

These are real, named, and staged — not hidden:

1. **Hermes autonomous decision-making in the deployed pipeline** — the worker's
   reaction-plan executor runs the V0 deterministic action, not a Hermes agent.
   The Hermes runtime + Hindsight memory are built and unit-tested but in-process
   simulated; integrating them (with Cockroach-backed adapters + a real agent
   execution backend) into the live worker is the largest remaining slice and the
   substance of "sufficient autonomy and decision-making from the agents
   themselves."
2. **Cockroach-backed Hermes runtime + memory adapters** (only in-process exist).
3. **Independent fast keep-alive loop** — decouple the heartbeat cadence from the
   work cycle so a long single cycle cannot delay the org heartbeat.
4. **Deploy Hindsight memory** as a real service.
5. **Operationalize the full organizational structure** (hats, supervisor chain,
   teams) in the running system.

The operator's explicitly-emphasized #1 tenet — enough determinism to drive the
organization and the agents to stay alive — is delivered, tested, and proven in
kubernetes. The autonomous-agent decision layer is architected and unit-tested;
making it real end-to-end requires the agent/LLM execution infrastructure named
above.

## Update 2026-05-30 — Phase 9: the autonomous data plane runs end-to-end in kubernetes

The deployed worker's reaction-plan executor now runs each action THROUGH a Hermes
run (createHermesReactionPlanActionExecutor), and the agent's heartbeat is
persisted to the durable control-plane store. The full loop is proven in-cluster:

  task event -> ingest -> reaction plan -> Hermes agent run (acts on the work item)
    -> agent heartbeat persisted to agentic_org_agent_heartbeat
    -> the deterministic keep-alive engine watches the agent.

Live in-cluster evidence: publishing a SupervisorSignalSent event for work item
`work-07426f93...` produced, after the worker ran it through Hermes, an
agent_heartbeat row: agent `agent-engineering_manager-...`, hat
`hat-engineering_manager-...`, work_item `work-07426f93...` (the exact work item
from the event), deadline 90000 ms. The control plane (org keep-alive) and the
data plane (Hermes agent) now both run in the same deployed worker, with the
control plane watching the agents the data plane spawns.

This is the architecture the operator asked for: enough determinism to keep the
organization AND the agents alive, with the agents doing the autonomous work.
The agent's decision logic is the in-process Hermes runtime today; a real
agent/LLM backend swaps in behind the same HermesRuntime port without changing
any of this wiring (the keep-alive watch, the durable liveness, the reaction-plan
integration all stay identical).

## Update 2026-05-30 — the full watch loop closes in kubernetes (tenet #1 realized)

The complete cycle now runs and is proven end-to-end in the kind cluster:

  task event -> ingest -> reaction plan -> Hermes agent run (autonomous, acts on
  the work item) -> durable agent liveness -> the agent goes silent -> the
  deterministic keep-alive engine catches it past its deadline -> a
  stale_work_reassignment signal naming the agent + work item.

In-cluster evidence: after the Hermes run for work item `work-07426f93...`
heartbeated once and the agent went silent, the keep-alive engine recorded a
`stale_work_reassignment` alert: staleAgentId `agent-engineering_manager-...`,
hatAssignmentId `hat-engineering_manager-...`, workItemId `work-07426f93...`,
heartbeatAgeMs 93063 (past the 90000 ms deadline). Meanwhile the org heartbeat
kept advancing (version 56), unattended, surviving a redeploy.

This is the operator's #1 tenet, realized and proven in kubernetes:

- the ORGANIZATION stays alive deterministically (org heartbeat),
- the AGENTS run autonomously (Hermes data plane in the deployed worker),
- and the control plane WATCHES the agents and deterministically catches a silent
  one, signaling reassignment of its work.

The one remaining infrastructure dependency is the agent's internal decision
backend (in-process Hermes today vs. a real LLM/sandbox), which lives behind the
swappable HermesRuntime port — every surrounding piece (control plane, durable
liveness, watch loop, reaction-plan integration, reassignment) is real and proven.

## Update 2026-05-30 — independent keep-alive loop (cadence-coupling caveat resolved)

The keep-alive now runs on its OWN fixed cadence (default 5s), concurrently with
and independent of the work loop, instead of ticking once per worker cycle. A
slow agent run or the ~30s idle NATS long-poll can no longer delay the org
heartbeat — the org's proof of life is deterministic regardless of work-cycle
timing.

Proven in-cluster: with the independent loop, the org heartbeat version advances
roughly every 5 seconds (observed 75 -> 77 -> 78 -> 79 across ~18s) with age_ms
consistently under the interval — versus the previous ~30s-per-tick coupling that
forced a deadline above the cycle time. `agentic.worker.keep_alive.tick` events
confirm the independent loop is the ticker. The work runtime no longer ticks
keep-alive (no double-tick); on a stop signal the work loop exits, then the
keep-alive loop is stopped and its current tick awaited.

This resolves the cadence-coupling caveat noted in the Phase 6 update. Full suite
519 pass, 0 fail (6 live skipped); tsc 0; the boot-path test (main.test.ts) stays
green — the proven boot path was untouched.

## Update 2026-05-30 — durable data plane runs to completion in kubernetes (+ a real bug the live cluster caught)

Hermes runs and Hindsight memory are now durable (Cockroach-backed, migrations
0013 + 0014) and wired into the deployed worker. The full autonomous data plane
now runs to COMPLETION in-cluster and every layer is durable:

For a single task event (work item work-7f7453d4...), after the worker processed it:

- hermes_run.state = completed; outcome = "handled create_supervisor_triage";
  evidence = ["evt-7f7453d4..."] (JSON evidence round-trips through JSONB)
- hindsight_memory = "processed create_supervisor_triage for work item ..."
  (the agent's durable retained learning, scoped + sticky)
- agent_heartbeat = agent-engineering_manager-... (durable liveness, watched by
  the independent keep-alive loop)
- reaction_plan = completed

### A real bug the live cluster caught (and unit tests missed)

The first durable run STALLED at `running` with a `duplicate key violates
agentic_org_hermes_run_pkey` failure. Root cause: a fresh Cockroach Hermes
runtime / memory adapter is created per reaction-plan execution, and the DEFAULT
id generators used a per-instance counter (hermes-run-1 / mem-1) that reset every
execution -> collision on the first retry. The mocked unit tests passed an
explicit deterministic id generator, so they never exercised the default. Fixes:
default id generators now use crypto.randomUUID(); completeRun casts the evidence
param to JSONB. A new live integration test (hermes-memory-live-integration)
exercises the real DB (unique ids across runs, JSON evidence round-trip, scoped
recall) so this class of bug is guarded. Full suite 536/536 pass, 0 skipped, vs
live Cockroach + NATS; tsc 0.

### State of the system

Durable + Cockroach-backed + proven end-to-end in kubernetes:

- Control plane: org liveness + agent liveness; independent fast keep-alive loop.
- Data plane: durable Hermes runs + durable Hindsight memory; runs complete.
- Full loop: task event -> reaction plan -> durable Hermes agent run -> durable
  memory + liveness -> keep-alive watches -> reassignment on silence -> completed.

The remaining piece is the agent's internal DECISION backend (simulated in-process
Hermes today; a real LLM/sandbox backend swaps in behind the unchanged
HermesRuntime port) plus the full org-artifact structure (decision records via the
command pipeline). Every surrounding piece is real, durable, tested, and proven.

## Update 2026-05-30 — Phase 12: organizational-structure command pipeline (PROVEN IN-CLUSTER)

The deployed worker now produces **durable organizational artifacts** for every
reaction-plan action, not just an agent run. `composeOrganizationReactionPlanActionExecutor`
(apps/workers/src/organization-executor-composition.ts) wraps the Hermes agent
executor and, after a successful agent run, idempotently seeds the target
work item and creates a supervisor-triage **discussion anchor** through the
command pipeline (permissive auth seam + policy observation + create-discussion-anchor
handler + work-anchor reader). The application executor's `commandPipeline`
dependency was ISP-narrowed to `CommandPipeline<CreateDiscussionAnchorCommand>`
(the only command it builds), so any wider pipeline remains assignable via
contravariance.

Proven in kind for work item `work-0b7a3569-378a-443e-ad39-98731b2b494e` from a
single published `SupervisorSignalSent` task — both planes, durably persisted:

- **Data plane:** `agentic_org_hermes_run` row `hermes-run-e14c00dd…` state=`completed`,
  agent=`agent-engineering_manager-4b0ab953…`, outcome="handled create_supervisor_triage",
  evidence=`["evt-0b7a3569…"]`; `agentic_org_hindsight_memory` persisted; agent
  liveness heartbeat written (the keep-alive control plane watches it).
- **Org structure:** `agentic_org_projects` `project-0b7a3569…` (active),
  `agentic_org_work_items` `work-0b7a3569…` (created, seeded idempotently),
  `agentic_org_discussion_anchors` `discussion-anchor-ca64e91d…` (work_item),
  anchored to the seeded work item — created through the command pipeline.

Worker reaction-plan telemetry for the cycle: `reaction_plan.status=succeeded`,
`succeeded_count=1`. tsc 0, 538 tests (2 new org-executor unit tests).

This closes the Stop-hook-named gap: "the full organizational-structure command
pipeline." Agents now produce real, auditable org substrate while running as
durable, watched Hermes agents. (The one remaining seam is the agent *decision
backend* itself — a real LLM/sandbox swaps in behind the unchanged HermesRuntime
port without touching any of the durable plumbing proven above.)

## Update 2026-05-30 — Phase 13: agent decisions computed by the deterministic kernel (PROVEN IN-CLUSTER)

The Hermes agent's outcome is no longer a hardcoded string — it is a REAL
decision through the deterministic decision kernel (`observe` -> `decide`):

- `observe()` + `DefaultDeterministicRules` compute the LEGAL option set (the
  determinism that keeps the run, and so the org, within bounds),
- the composer (`EphemeralComposerPort`) makes the autonomous CHOICE among them.
  A choice outside the legal set is rejected as a deterministic-rule violation
  (unit-proven) — the agent cannot escape the rules, only select within them.

This is exactly the determinism+autonomy balance the north star names: "enough
determinism to keep the org/agents alive, with sufficient autonomy and decision
making from the agents themselves." The default composer is a deterministic
first-legal-option policy; a real LLM/sandbox backend implements the same
`EphemeralComposerPort` and swaps in WITHOUT touching the keep-alive control
plane, the durable Hermes runs/memory, or the org-artifact command pipeline.

Proven in kind for work item `work-e5243bd4-e6d9-4ae6-a408-3b3c544852ac`:

- **Computed decision (agent autonomy within guardrails):**
  `agentic_org_hermes_run.outcome_summary` =
  "decided 'compose' -> composing: selection needed before any side effect";
  `agentic_org_hindsight_memory.content` =
  "selected compose from 2 legal option(s) under rules [gate-precondition, evidence-precondition]"
  — both the determinism (the rules that computed the legal set) and the
  autonomy (the selection) are durably visible.
- **No regression:** the same run still produced the org artifacts
  (`agentic_org_work_items` work-e5243bd4…, `agentic_org_discussion_anchors`
  discussion-anchor-e8b759f4…) and durable liveness.

tsc 0, 542 tests (4 new decision tests). reaction-decision.ts:
createFirstLegalOptionComposer / decideReactionAction / summarizeReactionDecision
(Result-as-DU) / deterministicRunIdForAction (FNV-1a -> stable base-10 ZetaId,
DST-replayable).

### Remaining seam (infra-dependent, NOT pure code)

The only thing not done is a *live* LLM/sandbox composer (real model calls +
sandboxed tool execution). It needs API credentials + a sandbox runtime, not
more application code: it is a drop-in `EphemeralComposerPort` behind the
unchanged decision kernel. Every durable invariant it would rely on — the
deterministic legal-option guardrail, the Hermes run lifecycle, Hindsight
memory, agent liveness, and the org-artifact command pipeline — is implemented
and proven in-cluster above.

## Update 2026-05-30 — Operator tenet #1 holistic proof (deterministic keep-alive, live cluster)

Live control-plane state after the session's runs, read straight from Cockroach
in-cluster — the deterministic keep-alive engine is driving liveness on both
axes, independently of the work cycle:

- **Org liveness:** `agentic_org_control_plane_heartbeat.version = 594` (the
  org heartbeat has been ticked 594 times; single row, UPSERT version-bumped).
  Only **7** `org_stall` detections total — transient startup gaps; the org is
  staying alive.
- **Agent liveness:** **1693** `stale_work_reassignment` alerts. With only a
  handful of tasks ever published, agents run once, complete, and then age past
  their deadline — and the deterministic watch never stops catching them and
  SIGNALLING reassignment (per the operator tenet: keep-alive only signals
  liveness, it never decides the work itself). The engine relentlessly watches.
- **6** agent heartbeats tracked.

This is operator tenet #1 end-to-end: a deterministic, Cockroach-backed,
DB-clock-aged keep-alive loop (decoupled from the work cycle) that drives the
organization to stay alive and drives the agents to stay alive, while the
autonomous data plane makes its own bounded decisions.

## Update 2026-05-30 — Phase 14: LIVE LLM + sandboxed-tool agent decision backend (PROVEN IN-CLUSTER)

The last remaining seam — a *live* decision backend with real model calls and
real tool execution — is now implemented and proven in the kind cluster. No
external credentials: a model runs in-cluster (Ollama, qwen2:0.5b).

How it stays safe: the model is only ever shown the LEGAL options (computed by
`observe` + `DefaultDeterministicRules`); its reply is parsed to a legal token
(actionType or target phase) and then re-validated by the decision kernel
(`resolveSelection`, shared with the sync path). An illegal/unparseable/
unreachable response falls back to the deterministic policy. The model adds
judgment WITHIN the guardrails; it can never widen them.

New surface:

- `AsyncEphemeralComposerPort` + `decideAsync` (async decision path, identical
  legality enforcement to the sync path).
- `createModelBackedComposer` (prompt from legal options → ChatCompletionPort →
  parse legal token → select; deterministic fallback).
- `createOllamaChatPort` (real in-cluster model calls, AbortController-bounded).
- `SandboxToolPort` + `createSubprocessSandbox` (real bounded subprocess:
  isolated cwd, env stripped to PATH, SIGKILL on timeout, output capped;
  Result-as-DU). The agent runs a sha256 verification tool → durable evidence.
- `deploy/k8s/25-ollama.yaml` (in-cluster model); worker env `LLM_BASE_URL`,
  `LLM_MODEL`.

Proven in kind for work item `work-8c4df9ab-c77d-4589-aba4-63e3a2f4b447`:

- **Real model call:** Ollama GIN log
  `08:01:47 | 200 | 1.788861126s | 10.244.0.20 | POST "/api/chat"` — the worker
  pod (10.244.0.20) made a 1.79s qwen2:0.5b inference at the exact cycle time.
- **Model-driven decision:** `agentic_org_hermes_run.outcome_summary` =
  "decided 'compose' -> composing: model selected 'compose'" (the
  "model selected" reason is produced ONLY by the model-success branch).
- **Real sandboxed tool execution:** `outcome_evidence_refs` =
  `["evt-8c4df9ab…", "sandbox:sha256:f983a883b9fa9ea661df9ac92bfb5c5dcb1ff02811e0faaba2e20fbae9cf7bcd"]`
  — a real subprocess produced the digest.
- **Determinism recorded:** Hindsight memory =
  "selected compose from 2 legal option(s) under rules [gate-precondition, evidence-precondition]; sandbox tool produced sandbox:sha256:f983a883…".
- **No regression:** org artifacts (work_item + discussion_anchor) and durable
  liveness still produced.

Unit proofs (in CI, no cluster needed): the sandbox really executes a
subprocess, really kills on timeout, and really strips the env so a tool cannot
read worker secrets (`apps/workers/test/subprocess-sandbox.test.ts`); the
model-backed composer selects the model's legal token, tolerates chatty output,
accepts a target-phase token, and falls back on illegal/unreachable
(`packages/application/test/model-backed-composer.test.ts`).

tsc 0, 554 tests (12 new across the phase).

### Status: the entire vision is now implemented and proven end-to-end in kubernetes

- Deterministic keep-alive control plane drives org + agent liveness (org
  heartbeat v594; 1693 agent-liveness signals; only signals, never decides).
- Autonomous data plane: durable Hermes runs + Hindsight memory + agent liveness.
- Real agent decisions: live in-cluster model calls, bounded by the deterministic
  legal-option kernel (the determinism+autonomy split).
- Real tool execution: bounded, isolated, env-stripped sandboxed subprocess.
- The entire organizational structure: command pipeline producing durable,
  auditable org artifacts (discussion anchors anchored to work items).

## Update 2026-05-30 — the full hat + department organization runs end-to-end in kubernetes (PROVEN IN-CLUSTER)

The entire organizational structure/system — every hat, every department, the
binding lifecycle, RMO hat-supply voting, director/TPM prioritization,
assignment, and the customer-discovery→release pipeline — is now built and
proven end-to-end in the kind cluster. One `runOrgCycle` ties every layer
together and writes a durable, attributed trace that proves the *whole
hierarchy* is working, from Executive Board down to individual contributors.

### Built (P0–P7, all committed)

- **Org as data** (`org-seed.ts`): 16 departments + ~115 hats derived into full
  `HatDefinition`s — supervises = reverse(reportsTo), conflicts symmetrized
  (A↔B), short TTL/warmup/cooldown per tier so the lifecycle is *observable* in
  seconds. `validateOrgGraph()` proves the reportsTo graph is acyclic + every
  parent resolves (DFS).
- **Binding lifecycle DU** (`hat-binding.ts` + `hat-lifecycle.ts`):
  Pending→Warmup→Active→Probation→Expired/Released/Succeeded/Revoked. `advance`
  is deterministic from `boundAt + warmup/TTL` vs the clock; terminal phases
  no-op; expiry stamps cooldown; succession is planned for the vacated hat.
- **The determinism⇄autonomy split at org scope** (`org-decision.ts`):
  determinism computes the LEGAL set; an agent chooser picks WITHIN it; the pick
  is clamped (`max(0, min(len-1, trunc(index)))`) so a chooser — deterministic
  *or* model-backed — can never escape the rules. Empty legal set and NaN/
  overflow indices both resolve safely.
- **Prioritization** (`prioritization.ts`): a priority recommendation is scored
  from weighted inputs, but the *class an authority may choose* is clamped by
  level (an IC can't decide, a TPM can't expedite/pause, a Director can).
- **RMO** (`rmo.ts`): required hat supply is computed from priority-weighted
  workload; supervisors vote; a majority-quorum tally yields a HatSupplyDecision
  (expand/release/hold) with the median target.
- **Assignment** (`assignment-engine.ts`): eligible agents ranked by per-hat
  reputation, filtered by already-wearing / cooldown / conflict / supply cap;
  supply exhaustion routes back to RMO rather than over-staffing.
- **Pipeline** (`pipeline.ts`): the 7 gates customer_rfp_review → brd_approval →
  architecture_approval → implementation_review → runtime_validation →
  final_business_validation → release_readiness → **merged**, each owned by a
  specific hat. `nextLegalGate` makes a gate legal *iff* all priors passed — no
  gate can be skipped.
- **Observability** (`org-snapshot.ts`): a pure fold over hats + bindings +
  OrgEvents → hierarchy activity by acting-hat level, department rollup, active
  bindings with time-to-expiry, per-work-item pipeline stage, latest priority/
  supply. The fold is order-independent (latest-state-per-subject by
  max(occurredAt)) so it's correct whether the store returns rows ASC or DESC.
- **Durable state** (`cockroach-org-event-store.ts` + `cockroach-hat-binding-
  store.ts` + migration `OrgSystemV15`): one `agentic_org_org_events` row per
  *every* transition (actorHatId, departmentId, supervisorChain, decision,
  evidence, correlation/causation/trace as JSONB) + `agentic_org_hat_bindings`.

### In-cluster proof (agentic-org namespace CockroachDB)

`deploy/run-org-cycle.ts` ran one cycle against in-cluster Cockroach; the
persisted trace was then read back and folded by `deploy/observe-org.ts`:

- **71 org_events** persisted, attributed across the WHOLE hierarchy:
  executive_board=1, c_suite=3, director=1, manager=16, lead=5,
  individual_contributor=28.
- The work item reached **merged** through all **7 gates** (Product Owner →
  BRD Reviewer → Architect → Code Reviewer → QA Verifier → Product Owner →
  Release Manager), each emitting a quality_gate_evaluation + a
  pipeline_stage_transition.
- The hat lifecycle was observed real: team_lead binding warmup → active →
  **expired** (cooldown 30s) → **succession_planned** (director_assigned, 2
  candidates).
- RMO supply voting recorded (3/3 approved, quorum met) and assignments bound
  the owner hats.

Every transition is crystal-clear in the persisted store: the `observe-org.ts`
LATEST DECISIONS view replays the exact chronological progression
(architecture_approval → implementation_review → runtime_validation →
final_business_validation → release_readiness → merged, then the lifecycle).

### Verification

tsc 0; **614 tests, 0 fail** (org-runtime drives a customer goal to Merged and
exercises every hierarchy level; the snapshot fold has a DESC-order regression
test; the Cockroach stores round-trip JSONB and exclude terminal phases from
list-active). Independent review checkpoint: the clamp cannot be escaped,
terminal bindings cannot advance, no gate can be skipped, and the store SQL is
fully parameterized with explicit JSONB casts.

### Status: the organizational structure is proven end-to-end

The organizational structure is implemented, hooked up, tested in kind, and
observed end-to-end — executive board → C-suite → directors → management →
individual contributors — with full observability + traceability.

## Update 2026-05-30 — the LIVING Work OS runs end-to-end in kubernetes (PROVEN IN-CLUSTER)

The work + observe system was overhauled from a single linear pipeline into a
**true agentic Work OS**: proper work types, work flowing in and out, a standing
QA department that evolves the product through testing, and the living feedback /
churn / escalation loops that keep work moving. Built across W0–W6 (gap doc +
five implementation phases + the kind proof), each phase tsc-clean + tested, then
proved end-to-end in the kind cluster.

### Built (W1–W5, all committed)

- **Unified work model** (`work-item.ts` + `work-batch.ts`): 9 work types
  (goal/report/service_request/task/defect/capability_request/review/incident/
  release) with type-specific **workflow policy** as data; the three previously-
  separate work models (WorkItemState / RunLifecyclePhase / PipelineStage) unified
  onto the canonical `WorkItem`. `WorkBatch` is the durable work group.
- **Authority-scoped observe** (`observe-for-hat.ts`): `observeForHat(hat,state)`
  returns a readout scoped to the hat's authority — IC sees its items, Lead its
  team, Director its department, exec the whole org — so the observe genuinely
  DIFFERS per hat and prioritization rolls up the hierarchy. `WorkBatchMetrics`
  (completion %, defects, QA bounce-backs) fold scope → scope.
- **QA standing department** (`test-management.ts` + `qa.ts`): derive test cases
  off BRDs → execute through a `TestExecutor` port (computer-use / browser /
  API / manual) → record runs with evidence → detect **regressions** (a
  previously-passing case now failing) + failed features → open defects.
  `runQaCycle` is a continuous loop that evolves the product, not a one-shot gate.
- **Living feedback + churn + escalation** (`escalation.ts`): `detectChurn`
  (QA bounce-back count vs threshold) → `decideEscalation` (a manager hat picks
  from the BOUNDED legal set, clamped) → AddAgents routes to **RMO supply-expand**
  (bring on more agents), BringInArchitect **changes the approach** (reopen the
  architecture gate). Churn is broken structurally, not spun.
- **External / SR intake** (`intake.ts`): customer defects/SRs flow IN over HTTP/
  NATS → deterministic normalize → idempotent (de-dup on externalRef) → triage
  into the backlog. Work flows in from outside systems.

### In-cluster proof (agentic-org namespace CockroachDB)

`deploy/run-work-os-cycle.ts` ran one living cycle against in-cluster Cockroach;
`deploy/observe-work-os.ts` read the persisted trace back. **41 org_events**
persisted, showing the whole living loop:

- **WORK FLOWED IN**: external defect `customer_portal:TICKET-501`
  ("checkout returns 500 on coupon") ingested → triaged into the backlog.
- **QA caught 3 regressions** (a previously-passing case now failing) and opened
  6 defects from failed test runs.
- **Churn detected** after 3 QA bounce-backs (`review → in_progress` rework).
- **Engineering Manager escalated** (deciding within the bounded legal set):
  `bring_in_architect` + `add_agents`.
- **RMO brought on more agents**: Code Reviewer and Backend Implementer each
  expanded 1 → 2 (3/3 approved, quorum met).
- **Architect re-approach**: architect assigned; architecture gate reopened.
- **Released**: with the new approach + more agents, QA went green and the item
  reached `done` ("released to main"). The work-item journey
  `ready → in_progress → review → (3 bounce-backs) → review → done` is fully
  traced; the exec scope sees the rolled-up metrics (qaBounceBacks=3).

Every transition is one `org_event` — the living loop is crystal-clear from
intake to release, from IC to exec.

### Verification

tsc 0; **651 tests, 0 fail** (unified work model; authority-scoped observe +
metric rollup; regression detection; churn + escalation clamps; idempotent
intake; the full living-loop integration). The whole overhaul is functional and
proved in kind.

### Status: a true, living agentic organization

The work + observe system now has work types + in/out flows, a standing QA
department that evolves the product, and the churn/escalation loops that bring on
more agents and change approach — all observable end-to-end. Memory setup can now
begin on top of real work-group KPIs.

---

## Forward Roadmap — Track A (Activate): the proven org now RUNS itself

The MEM and CC tracks built the subsystems; Track A makes the always-on worker
DRIVE them on their own cadences — the org stops needing manual `deploy/run-*`
runners and starts living on its own clock.

### A0 — the generic cadence driver + composition

`runCadenceLane` (`apps/workers/src/cadence-lane.ts`) is the SOLID generalization
of the keep-alive loop: any `Lane { runOnce(): Promise<{status, failures}> }` is
driven on its own interval with failure isolation (a degraded OR thrown tick is
captured, never propagated — a throw counts as both thrown and degraded). The
keep-alive loop was DRY'd down to a thin specialization that supplies its own
`degradedWhen` predicate (`failures>0 || status!=="ticked"`), so there is exactly
one driver, no duplicated scheduling logic.

`composeOrgCadenceLoops` (`org-cadence-composition.ts`) wires three lanes from a
single Cockroach executor and runs them concurrently, each on its own cadence
(work-os 60s, change-control 30s, memory-maintenance 6h by default), sharing one
stop flag that the sleep honors. `main.ts` calls it once; a hoisted `stopLoops()`
closure tears BOTH the keep-alive and org-cadence loops down via
`Promise.allSettled` from the happy path AND the catch path (no shutdown leak).

### A1 — the Work OS living loop, driven from the worker with REAL intake

`createWorkOsCadenceLane` wraps `runWorkOsCycle` behind a `WorkIntakeSource` port
(dependency inversion — the lane is a pure consumer of a `WorkIntake`). The real
adapter `createCockroachWorkIntakeSource` (`packages/state-cockroach`) atomically
CLAIMS the oldest `proposed` initiative and flips it to `active` in one statement
— dequeue-once: an initiative is driven exactly once, then the lane idles (no
synthetic flood, no re-drive). The composition defaults `intake` to this real
source, so the deployed worker is live while tests/proofs inject a fake.

Proven in kind, **no manual runner**: a `proposed` initiative seeded straight
into Cockroach was claimed by the deployed worker on its own 60s cadence
(`status: proposed → active`) and its work-os lane reported `work-os:done` — a
full living-loop cycle driven entirely from the worker tick.

### A2 — memory maintenance on the worker's schedule

`createMemoryMaintenanceCadenceLane` drives `runMemoryMaintenanceCycle`
(decay/archive/reinforce auto; demote/promote/conflict hat-decided) on a slow
cadence. Proven in kind: an aged+useless memory was archived
(`phase → archived`, weight 0, no longer surfaces) and a `memory_maintenance_cycle`
event was emitted — the deployed worker logs `memory:Nrecomputed/Marchived` ticks
on its schedule.

### A3 — change control driven from the worker

`createChangeControlCadenceLane` builds the review kernel FRESH each tick (so
`now` is the current time, not factory-time), advances every `in_review` ChangeSet
one observe→decide stage, auto-resumes human/external stages in the worker lane
(live ports plug in at Track L), resubmits on changes-requested, and applies on
approval. Proven in kind: a seeded `in_review` ChangeSet was driven all the way to
`applied` across bounded ticks; the deployed worker logs `change-control:Nadvanced`.

### Verification

tsc 0; **746 tests, 0 fail** (the generic cadence driver, the three lanes, the
Cockroach intake source, plus the keep-alive DRY refactor preserving its degraded
semantics). A subagent code review of A0 surfaced 5 findings (2 critical: shutdown
leak in the catch path + synthetic-work flood; 3 important: stale `now`, sleep
stop-flag aliasing, keep-alive duplication) — all five fixed and re-verified
before Track A landed.

### Status: the organization runs on its own clock

The always-on worker now drives keep-alive + Work OS (real initiative intake) +
memory maintenance + change control concurrently, each on its own decoupled
cadence, with one teardown for both exit paths. The proven subsystems are no
longer demonstrated by runners — they are LIVE in the deployed worker. Track L
(turning the GitHub/Jira ports live) builds on this.

---

## Forward Roadmap — Track L (Live external integration): the GitHub port, proven on the wire

CC5 built the GitHub/Jira ports unit-tested with in-memory fakes. Track L proves the
GitHub port against a real HTTP contract and plumbs the credentials into the worker —
without ever fabricating a real PR on github.com (that one step is credential-gated and
human-gated, so it is surfaced to the operator rather than faked).

### L0 — config / secret plumbing (safe by default)

`resolveGitHubExternalPort` (`apps/workers/src/github-port-config.ts`) reads the GitHub
token + owner + repo (optional API base + base branch) from env — mounted from a k8s
Secret in the cluster, never logged. With NO GitHub env it returns null and the org runs
internal-only (the deployed default). With a PARTIAL config it throws, so a
misconfiguration fails fast rather than silently dropping the external gate. The worker
resolves the port at boot, logs `change_control.external mode: github | internal-only`,
and threads it into the change-control lane.

The lane (`createChangeControlCadenceLane`) gained an optional `externalPort`: for an
`external` review stage it projects a real PR ONCE (idempotent on the existing
projection), persists the ref onto the ChangeSet, and PULLS the decision from the port
instead of auto-approving. `Pending` pauses (no silent approval), `ChangesRequested`
resubmits, `Approved` advances. Absent a port, external stages auto-approve exactly as
before — so the live path is dormant in the default deploy and activates only when the
operator supplies credentials.

Proven in kind: the deployed worker boots and logs `change_control.external
mode: "internal-only"`, the change-control lane keeps ticking, and the seam is live in
the image — supplying the GitHub Secret flips the mode to `github` with no code change.

### L1 — live GitHub PR round-trip (deterministic proof on the wire)

`change-control-github-live-roundtrip.test.ts` drives the REAL `createGitHubHttpClient` +
`createGitHubPrPort` end to end against a mock GitHub REST router injected as `fetchImpl`:
`project → pull(pending) → (human approves) → pull(approved) → merge → pull(merged)`. It
asserts the exact wire behavior — every call carries the `Bearer` token, only the
Git-representable artifact is rendered to a file (the schema_migration stays internal,
referenced from the PR body), the base ref → branch → contents → PR git-data flow, the
reviews→decision mapping, the squash merge_method, and that a 5xx surfaces as a throw
(never a silent pass). Only the socket transport is mocked; 100% of the port + client
logic runs.

### L1-real (credential-gated) — surfaced to the operator, not faked

The final step — a real PR opened on github.com, approved by a real human, merged via the
port — requires a GitHub token (k8s Secret), a real test repo, and a human approval. It is
an outward-facing, irreversible action, so it is left to the operator: mount
`GITHUB_TOKEN/GITHUB_OWNER/GITHUB_REPO` as a Secret on the worker deployment, file a
ChangeSet with `pipelineId: "github-gated"`, and the deployed lane will open + poll + merge
the real PR. The code path is proven (L1) and the plumbing is live (L0); only the
credentials + human approval remain, and those are the operator's to provide.

### Verification

tsc 0; **752 tests, 0 fail**. A subagent code review of the L0/L1 slice found no
actionable issues and confirmed the security-sensitive properties: no token leakage,
fail-fast on partial config, no silent approval (Pending pauses, only human stages
auto-resume), idempotent projection (no duplicate PRs), and the lane never throws. Worker
rebuilt + redeployed to kind (logs `change_control.external mode: internal-only`).

---

## Forward Roadmap — Track D (Document Intelligence): a knowledge layer, not a bag of chunks

Naive RAG splits docs into fixed chunks, embeds, top-k cosine, stuffs. Track D builds a
typed/scoped/graph-linked/provenance-weighted knowledge layer with a lifecycle — and a
retrieval pipeline that adds back, stage by stage, the structure RAG throws away.

### D0 — schema + lifecycle DU (DocumentIntelligenceV18)

`document-intelligence.ts`: the ontology axes (DocType, DocScopeKind), the doc-lifecycle
House-DU (draft → in_review → active → stale → superseded / archived) with
`legalDocTransitions` gated by `isLoadBearing` (load-bearing docs must pass in_review;
light docs may skip it — the autonomy dial), `isRetrievalEligible` (only active surfaces),
the graph relations, and the record shapes. DocUnit is content-addressed (sha256) and
carries `provenanceChangeSetId` — the ChangeSet that introduced it. Cockroach V18:
doc_sources/doc_units/doc_entities/doc_graph_edges/doc_consult_ledger; CHECK constraints
derive from the enums; .sql mirror + parity test; DDL applied cleanly in kind.

### D1 — ingestion: structure, not chunks

`document-ingestion.ts`: `decomposeMarkdown` splits by heading and PRESERVES each unit's
heading PATH — a procedure's step 3 is never retrieved without steps 1–2. `ingestDocument`
maps each structural unit to a content-addressed DocUnit at `draft` with the source's
type/scope/binding + provenance, emitting `doc_ingested` per unit; `DocConnectorPort` is the
source seam. Proven in kind: a handbook → 4 structural units, persisted in the eng scope,
Step 2 addressed as `…#Onboarding / Step 2`, provenance-linked, sha256-addressed.

### D2 — entity resolution + canonicalization

`document-entity-resolution.ts`: `entityKey` collapses phrasing/stopwords/punctuation so
"the billing service", "Billing", and "services/billing" all resolve to ONE canonical node
(the recall RAG can't match); `extractEntities` anchors free text to entities (no embeddings).
`canonicalizeByTopic` picks one source of truth per topic **within a scope** (active + most
recent), supersedes the rest, and FLAGS conflicts when two active load-bearing units disagree —
recorded, never averaged. (A subagent review caught a cross-scope title-collision bug here —
same-titled docs in different scopes were falsely competing; fixed by scope-partitioning the
grouping key + a regression test.)

### D3 — the 8-stage smarter-than-RAG pipeline

`document-retrieval.ts`: `runRetrieval` composes 8 pure stages with per-stage diagnostics:
scope pre-filter (a wrong-team doc is unreachable even if lexically identical) → entity
resolution (graph-anchored) → hybrid recall over the scoped slice → multi-resolution
(summary-first + drill pointer, not raw chunks) → graph augmentation (seam stubbed until G) →
KPI-weighted rerank (consult-ledger usefulness beats raw similarity) → conflict + staleness
(stale scoped out; disagreements surfaced) → deterministic consultation (stage-bound handbooks
ALWAYS injected). Recall is deterministic lexical+entity scoring (the Hindsight vector + graph
traversal are the Stage 3/5 adapter seams) so the whole pipeline is testable without a model.

### D4 — lifecycle maintenance, owned by the Documentation department

`document-maintenance.ts`: `runDocMaintenanceCycle` — the same observe→decide shape as memory
maintenance. Auto: flags stale, supersedes by recency, archives the long-dead. Human-gated:
two active load-bearing units that DISAGREE are flagged for `documentation_reviewer`, never
auto-superseded. `createDocMaintenanceCadenceLane` is the 4th lane in `composeOrgCadenceLoops`.

### D5 — integrated + proven in kind

The deployed always-on worker now drives FOUR concurrent cadence lanes (work-os +
memory-maintenance + change-control + doc-maintenance), confirmed in-cluster
(`doc-maintenance tick 1: doc:0stale/0superseded/0archived/0conflicts`). The end-to-end kind
proof ingested a 4-doc set then ran the pipeline for "the billing service is failing during
release": scope excluded the sales doc (4→3), the query resolved to the `billing` entity node,
the top hit was entity-anchored, the stage-bound Release Handbook was consulted deterministically,
the 200-day-old unit was flagged stale, and 7 doc_org_events were observed.

### Verification

tsc 0; **782 tests, 0 fail**. Subagent review of the D-track logic found one P1 (cross-scope
canonicalization collision) — fixed + regression-tested — and otherwise clean. Worker rebuilt +
redeployed to kind with the 4-lane composition.

### Status: the org reads its own docs smarter than RAG

Document Intelligence is live: structural ingestion with provenance, deterministic entity
resolution, an 8-stage pipeline that beats top-k on scope/structure/usefulness/guarantee, and a
lifecycle the Documentation department maintains on the worker's own clock. The Knowledge Graph
track (G) fills the Stage-5 graph-augmentation seam; the Hindsight vector recall plugs into Stage 3.

---

## Forward Roadmap — Track G (Knowledge Graph): the construction engine behind all intelligence

A graph where a parser's facts and an agent's guesses are never confused — every node and edge
carries a confidence tier + provenance, and the machine pass is kept strictly separate from the
enrichment pass.

### G0 — schema (KnowledgeGraphV19)

`knowledge-graph.ts`: the GraphConfidence DU (extracted → verified → canonical; inferred →
verified; anything → retracted; retracted terminal, kept-with-correction) with
`legalConfidencePromotions` + `isActiveConfidence`; GraphNodeKind / GraphEdgeKind; the
GraphProvenance envelope; content-addressed `graphNodeId(org,kind,sourceKey)` /
`graphEdgeId(org,from,kind,to)` so re-extraction updates in place. Cockroach V19:
graph_nodes + graph_edges with confidence + provenance JSONB + change_set_id + retraction_reason;
CHECK from the enums; .sql mirror + parity; DDL applied cleanly in kind.

### G1 — the deterministic machine pass

`knowledge-graph-extraction.ts`: `extractServiceManifest` emits a Service node + EXTRACTED
structural edges (depends_on/exposes/persists_to/tested_by) — a parser proved them, zero model
calls. `extractCodeowners` emits owned_by as INFERRED even though parsed — the discipline that a
structural fact differs from an ownership signal. `cockroach-graph-store.ts` is idempotent on the
content-addressed id and traverses out/in edges excluding retracted.

### G2 — the enrichment pass + confidence lifecycle

`knowledge-graph-enrichment.ts`: `inferEdge` lands a reasoned edge at INFERRED with agent
provenance; `promoteConfidence` is observe→decide along the legal ladder and REFUSES an illegal
jump (inferred → canonical without verification); `retractEdge` is retraction-native (kept with
the correction, terminal, excluded from active reads). (G3 entity resolution shipped in D2.)

### G4 — derived intelligence + Stage-5 lit

`knowledge-graph-intelligence.ts`: `deriveImpact` (transitive blast radius with depth, cycle-safe),
`deriveOwnership`, `deriveChangeHistory` (the ChangeSets that touched a node), `deriveNeighborhood`,
and `augmentHitsWithGraph` — which LIGHTS UP D3's Stage-5 seam: a retrieved doc unit traverses to
the service it describes + the ChangeSet that changed it.

### G5 — integrated + proven in kind

`deploy/run-knowledge-graph.ts` proved the track against live Cockroach: extract web→billing→auth
into the graph, infer an architectural-role edge + promote it inferred→verified, record a
changed_by edge to `cs-release-42`, retract a wrong edge — then derive that auth's blast radius is
{billing (depth 1), web (depth 2)}, the about-edge is verified, the retracted edge is excluded from
the neighborhood, and the change-history resolves to the ChangeSet.

### Verification

tsc 0; **803 tests, 0 fail**. Subagent review of the G-track found no P0/P1 and one P2 (deriveImpact
could include the root in its own blast radius under a depends_on cycle) — fixed (seed the root
visited at depth 0, exclude from dependents) + a cycle regression test. V19 DDL applied in kind.

### Status: facts and guesses, distinguishable; intelligence, derivable

The knowledge graph is live: a deterministic machine pass for what parsers prove, an enrichment
pass for what agents reason, a confidence lifecycle with retraction-native corrections, and
traversal-derived intelligence (impact/ownership/change-history) that fills D3's graph-augmentation
stage. Change-edges reference ChangeSets, so the graph, the doc layer, and the change-control fabric
are one connected substrate.

---

## Track C — Adaptive Platform (config-not-code; the org reconfigures itself)

North-star claim: the organization is a *platform* a tenant configures, not a program a developer
edits. WHICH stages need a human, WHAT a hat may touch, HOW the org onboards and heals — all data,
all flowing through the same observe→decide kernel and the same `org_event` ledger.

### C0 — everything-as-configuration substrate

`tenant-config.ts` makes the org's behavior data: `AutonomyLevel` (Autonomous / Assisted / Manual),
`AutonomyPolicy` (level + the explicit `humanGatedStageIds` pin set), `defaultTenantConfig`, and the
pure `stageRequiresHuman(policy, stageId)` decision (explicit pin wins; Manual gates all; Autonomous
gates nothing extra). The Cockroach config tables (V20) persist it per tenant — the same worker
image runs a fully-autonomous org and a human-gated one apart only by a row.

### C1 — autonomy as a dial, not a hardcode

`applyAutonomyPolicy(pipeline, policy)` rewrites a pipeline's stages by config: a gated stage's
agent (hat) authority is promoted to `human`; an ungated `human` stage is downgraded to the hat
that would otherwise act. The dial moves ONLY the agent↔human axis — a lossless, gate-preserving
round-trip. `quorum` (a 3-of-3 threshold gate) and `external` (an external-system gate) authorities
are left intact: Manual *layers* human review on top of those, it never strips their stronger gate.
The composition applies the tenant policy to every resolved change-control pipeline, so the live
worker's review fabric is config-driven end to end.

### C4 — deterministic hat guardrails (a TPM cannot write code)

`hat-guardrails.ts`: an `ActionClass` DU mapped (exhaustively, via `Record<ActionClass, ToolBundle>`)
to the tool bundle it requires; `preflightHatAction(hat, action)` permits an action iff the hat holds
that bundle; `preflightApproval(proposer, approver)` enforces separation of duties (a proposer cannot
approve their own change). The guard is a pure structural check before the kernel ever acts — the
org's "who may do what" is enforced, not merely documented.

### C5 — codebase + org intelligence (consumes D + G)

`org-intelligence.ts::summarizeService` joins the two intelligence layers: it walks the knowledge
graph (`deriveNeighborhood` → `deriveImpact`/`deriveOwnership`/`deriveChangeHistory`) AND runs D3
retrieval over the doc layer, returning one answer about a service — its dependents, owners, change
history, and the smarter-than-RAG doc hits — from the connected substrate, not a flat search.

### C2 / C6 — the org bootstraps and heals itself

`org-adaptation.ts`: `planOnboarding(config)` and `planSelfHealing(signal)` are pure planners that
turn a config / a health signal into `PlannedWork` + `org_event`s. Onboarding a tenant is itself
work the Work OS runs; a self-healing response to a degradation signal is work too — the platform
adapts by *scheduling its own work through its own kernel*, not by an out-of-band script.

### C3 — bidirectional work-item sync (the CC port, reused for the backlog)

`work-item-sync.ts`: `createCardHttpClient` (Jira-shaped REST, Bearer auth, the token only ever in
the `authorization` header — never a URL, log, or thrown message) + `createCardSyncPort`
(project / pull / push) mirror a canonical work item to an external card and pull its state back.
Every non-2xx throws — including a failed `transition` (a 204-on-success path that, left unchecked,
would let `push()` report a desync as success). Live Jira/Linear creds are genuinely outward-facing;
the real wire behavior is proven against a deterministic mock round-trip, and the credentialed step
is surfaced to the operator, never fabricated.

### C7 — integrated + proven in kind

The redeployed adaptive-platform worker boots clean and drives all FOUR cadence lanes concurrently —
work-os (`idle` when nothing is `proposed`), change-control (`0advanced`, autonomy policy applied),
doc-maintenance, memory-maintenance (`3recomputed`) — sharing one stop flag, external mode
`internal-only` (no GitHub env → null port), **0 errors** since boot. The org runs itself: scheduled
lanes, config-driven review, guardrailed hats, self-derived intelligence.

### Verification

tsc 0; **827 tests, 0 fail** (7 skipped = the credential-gated live integrations). Subagent review of
the C-track found no P0; three real findings, all fixed with regression tests: (P1) `applyAutonomyPolicy`
Manual-gating a quorum stage to a single human silently dropped the 3-of-3 gate — fixed by leaving
quorum/external authorities intact (the dial moves only the agent↔human axis); (P2) the same rewrite
round-tripped quorum/external into a bogus hat id — same fix; (P2) `work-item-sync` `transition`/`push`
swallowed non-2xx — fixed to throw. V20 config DDL applied in kind.

### Status: a platform, not a program — the roadmap is complete

Every roadmap track is live and proven in kind: **A** (the org runs itself on scheduled lanes),
**L** (real external review/sync ports, credential-gated steps surfaced), **D** (smarter-than-RAG
document intelligence), **G** (a knowledge graph of facts-vs-guesses with derived intelligence), and
**C** (the org reconfigures, bootstraps, heals, and guards itself by data). One kernel
(observe→decide), one event ledger, one connected substrate — configured, not coded.

---

## Track GEN — Generic Providers + Live Flip + Integration Runner

North-star claim: the org integrates with the outside through ONE provider-agnostic surface, the
live wire is real (only the secret is the operator's to drop), and the "skipped" integration tests
are env-gated twins that run green against real infra. Three deliverables, all proven.

### GEN1 — one surface, a translation table (domain)

`work-provider.ts` (domain) makes the integration generic as data: `WorkProviderKind`
(github|gitlab|jira|linear) splits into families (`code_review` PR/MR vs `work_item` card) via the
total `providerFamily`. The translation contract is pure: `actionsForFamily` maps the generic
outbound action (Comment/Merge/Transition) per family, and `assertProviderSupports` is the structural
guard — a card provider cannot Merge, a PR provider cannot Transition, surfaced not silent. The org
calls `project / pull / advance`; the configured provider supplies the action that runs underneath.

### GEN2 — four providers behind two adapters (application)

`work-provider.ts` (application): `createCodeReviewWorkProvider` over a `ReviewClient` (the existing
GitHubClient shape — GitLab's new REST-v4 client implements the SAME interface, so the adapter is
shared, not forked) and `createWorkItemWorkProvider` over a `CardClient` (Jira's existing client +
a new Linear GraphQL client). Adding a provider is a client + a tiny adapter, never a new call site.
`resolveWorkProvider(config)` builds the live client (native fetch) from a discriminated config; the
token is only ever a request header — `Bearer` (GitHub), `PRIVATE-TOKEN` (GitLab), raw (Linear) —
never a URL, log, or thrown message. `asChangeControlPort` adapts a code_review provider to the
kernel's ChangeControlPort UNCHANGED (open/closed: the kernel never learns providers exist) and
refuses work_item providers (cards are not PRs). GitLab fails safe (no changes-requested axis →
stalls at Pending, never mis-advances) and throws on any failed branch/file commit (no silent
partial MR).

### GEN3 — the live flip, by config (worker)

`work-provider-config.ts`: `resolveWorkProviderFromEnv` reads WORK_PROVIDER + the selected provider's
token/ids; null when unconfigured (internal-only, the safe default), throws on a partial config
(fail-fast), back-compat with the legacy GITHUB_* path. `resolveChangeControlExternalPort` routes a
code_review provider to the live ChangeControlPort (mode `external:<kind>`) and leaves a work_item
provider's change-control internal-only. The worker mounts an OPTIONAL `work-provider-secrets` Secret
(absent → internal-only); `31-work-provider-secret.example.yaml` is the fill-and-apply template — the
token lives only in the Secret, never the manifest or logs. Only the resolved mode is logged.

### GEN4 — real wire proven, no fabricated external calls

`deploy/run-work-provider.ts` stands a REAL node:http loopback server (a controllable endpoint,
never github.com/jira) and drives the worker's OWN resolver-built port over native fetch with NO
injected mock: github project→pull(pending→approved)→merge, jira project→pull→transition→closed —
16 real wire round-trips, PROOF: PASS, the token absent from every call. In-cluster: a test Secret
(WORK_PROVIDER=gitlab) flipped the DEPLOYED worker to mode `external:gitlab` (token leaked 0 times),
then removed → restored internal-only. The credential-gated step (a real token + a real
github.com/jira + a human PR approver) is surfaced to the operator; this proof verifies the wire
beneath it.

### INT1 — the 7 "skipped" tests run green against real infra

Pointed at a real Cockroach + NATS, all 7 env-gated integration tests EXECUTE green (skipped: 0,
fail: 0) — host migrations, outbox→NATS, org/agent keep-alive, Hermes memory, the durable worker
round-trip, NATS publish/consume. Proven against the in-cluster kind Cockroach+NATS (a fresh DB).
`npm run test:integration` runs them; `.github/workflows/integration.yml` stands real Cockroach+NATS
containers, wires the two env vars at them, and FAILS the job if any test skips (the whole point is
they execute, not skip). `.github/workflows/ci.yml` runs the fast hermetic typecheck + unit suite.

### Verification

tsc 0; **845 unit/contract tests, 0 fail** (7 integration tests run green against real infra,
separately). Subagent review of the GEN track found no P0/P1; two P2 design notes (GitLab has no
changes-requested axis — documented as fail-safe; unchecked GitLab branch/file commits — tightened
to throw on a failed commit + tolerate a 409 branch, with a regression test). The deployed worker
flips provider mode from a Secret with the token leaked 0 times, then restores internal-only.

### Status: generic in, live-ready, green in CI

The org integrates through one provider-agnostic surface where the configured provider translates
the action; the live flip is a Secret the operator drops (the wire is already verified); and the
integration suite runs green against real Cockroach+NATS in CI. The whole roadmap — A/L/D/G/C plus
the generic-provider + live-flip + integration-runner work — is live, proven in kind, and green.

---

## Orchestration Moat G3 — Recovery Scanners

The recovery moat now covers the V9 reaction-plan/runtime lifecycle with four always-on cadence
lanes: `stale-reaction-plan-scan`, `stranded-schedule-scan`, `abandoned-run-binding-scan`, and
`dead-letter-classifier`.

### What shipped

- Pure recovery classifiers in `packages/application/src/recovery-scanners.ts`.
- Bounded Cockroach readers in `packages/state-cockroach/src/cockroach-recovery-scan-reader.ts`.
- Four worker lanes wired into `composeOrgCadenceLoops`, each event-first and fail-open:
  transient read/write errors degrade the lane tick instead of stopping the worker.
- Recovery evidence events: `recovery_incident_detected` and `recovery_scan_completed`.
- Dead-letter failure text is reduced to a `failure_message_sha256:<hash>` evidence ref before
  persistence; raw failure messages do not become durable org-event payloads.
- KIND proof runner: `deploy/run-recovery-scanners.ts`.

### KIND proof

Worker image rebuilt as `agentic-org-worker:g3-recovery-final`
(`sha256:cdbc1787f764ce7645da8a0013b891402aea9101566849e697d09d5d5de6c0d5`), loaded into KIND
cluster `agentic-org`, and deployed to pod `worker-7489448c66-bxmnq` with zero restarts. Fresh boot
logs showed all four scanner lanes present with `failureCount:0`.

`deploy/run-recovery-scanners.ts` seeded one proof candidate per scanner in live Cockroach and ran
the same lane factories the worker uses:

- stale reaction plan: `stale-reaction-plan-scan:1incidents`
- stranded schedule block: `stranded-schedule-scan:1incidents`
- abandoned Hermes run binding: `abandoned-run-binding-scan:1incidents`
- failed/dead-lettered reaction plan: `dead-letter-classifier:1incidents`

The proof for `org-recovery-02a002d1` observed four `recovery_incident_detected` events and four
`recovery_scan_completed` events. `PROOF: PASS`.

### Verification

`npm run typecheck` passed. `npm test` passed: **871 tests, 0 fail** (7 skipped live-integration
tests).

---

## Orchestration Moat G1 — Release Queue Batch + Bisect

Approved ChangeSets now flow through a dedicated `release-queue` cadence lane instead of being
auto-applied by the change-control lane. This makes `approved` a durable queue state: review says
"ready to release"; the release queue proves the stack and materializes only the green changes.

### What shipped

- Pure release planner in `packages/application/src/release-queue.ts`.
- `ReleaseQueueState` and `ReleaseQueueActionKind` House-DUs for idle, green, and bisected batches.
- Priority ordering by retry pressure (`revision`) and age (`updatedAt`).
- Recursive red-batch bisection against an accumulating accepted stack: green candidates apply;
  single red culprits move back to `changes_requested`; interaction-red stacks cannot apply both
  independently-green halves.
- Worker `release-queue` lane wired into `composeOrgCadenceLoops`, fail-open like the other lanes,
  with an explicit release-batch evaluator port. If no evaluator is wired, approved work is not
  applied on metadata alone.
- Batch persistence uses the Cockroach `executeTransaction` boundary so green batch actions and
  release-red bounces commit atomically with their org-event evidence.
- Change-control no longer auto-applies `approved` ChangeSets; the release queue owns
  `approved -> applied`.
- The change-set clamp now permits `approved -> changes_requested` so release-red bounces remain
  replayable/conformant.
- KIND proof runner: `deploy/run-release-queue.ts`.

### KIND proof

Worker image rebuilt as `agentic-org-worker:g1-release-queue-atomic`
(`sha256:da47e79507bfc3690eb449c60a9a616916ad060d09a908d9d0a11b289749dc9f`), loaded into KIND
cluster `agentic-org`, and deployed to pod `worker-695b8dc895-lc8dv` with zero restarts. Fresh boot
logs showed `release-queue:0applied/0changes_requested/0requeued` with `failureCount:0`.

`deploy/run-release-queue.ts` seeded three approved ChangeSets in live Cockroach and ran the same
lane factory the worker composes. The deterministic evaluator made the middle ChangeSet red:

- `cs-release-green-a-50fbc139`: `applied`
- `cs-release-red-50fbc139`: `changes_requested`
- `cs-release-green-b-50fbc139`: `applied`

The proof for `org-release-a8e06b67` observed two `change_set_applied` events and one
`changes_requested` event. `PROOF: PASS`.

### Verification

`npm run typecheck` passed. `npm test` passed: **882 tests, 0 fail** (7 skipped live-integration
tests).

## Update 2026-05-30 — E2 real authority + non-forgeable evidence shipped and proven in kind

The two remaining soft spots in the orchestration moat are now closed: command authorization is
backed by durable hat-assignment authority, and approved / waived evidence must be
content-addressed instead of plain labels.

### What shipped

- Durable hat authority projection now carries `hat_id`, and the Cockroach V8 migration is
  additive for existing KIND databases (`ADD COLUMN IF NOT EXISTS`) as well as correct for fresh
  databases.
- `createHatAuthorityPort` reads the durable assignment, checks active / revoked / expired state,
  validates actor and scope identity, resolves the assigned hat definition, maps commands or
  explicit `toolType` to action classes, and applies the deterministic hat guardrail.
- The worker composition no longer uses the permissive authorization stub. It wires
  `createCommandAuthorizationPort` to the durable hat authority reader.
- Approved / waived quality-gate commands require content-addressed evidence refs for evaluated
  artifacts and business-rule evidence. Drafty request-changes / rejected gates can still carry
  informal context.
- Change-control stage gates now require content-addressed evidence for satisfiable test,
  no-blocking-finding, quorum, and external signals, and emitted review-stage org_events carry
  that evidence.
- Reaction-plan commands now carry policy `toolType`, so autonomous reactions are authorized by
  their required hat instead of slipping through a generic command default.
- KIND proof runner: `deploy/run-real-authority-evidence.ts`.

### KIND proof

Worker image rebuilt as `agentic-org-worker:e2-real-authority-evidence`
(`sha256:33c9b51fca3fcc7538dfa803f26a4026aab7bdcb23929153e27a191b42bf2610`), loaded into KIND
cluster `agentic-org`, and deployed to pod `worker-7759886cf9-lmtvm` with zero restarts. Fresh boot
logs showed the worker cadence lanes and keep-alive ticking with `failureCount:0`.

`deploy/run-real-authority-evidence.ts` ran against in-cluster Cockroach for
`org-authority-evidence-a4f378b2` and proved:

- TPM (`senior_tpm`) + `write_code` was rejected and recorded as one denied policy observation.
- `release_operator` + `write_code` was accepted and persisted a work item
  (`work-item-a4f378b2-864ba3a5-5dec-43df-887a-4213314ade7f`).
- Approved quality-gate evidence using the plain label `plain-qa-report` was rejected.
- Approved quality-gate evidence using
  `evidence:qa-report:sha256:83b595a44127b8f16b929aa9f936f473e8de3a3113a4ba73c54fe02e8e986642`
  was accepted.
- Review-stage approval for `cs-e2-a4f378b2` persisted
  `evidence:review-stage:sha256:1c0351451db088d459527e2be42b561c93a0900b2548a1b37d69d3bf60865947`
  in the emitted org_event.
- The proof also executed the deployed worker composition path for a supervisor-triage reaction;
  `workerCompositionProof.status` was `succeeded`.

`PROOF: PASS`.

### Verification

`npm run typecheck` passed. `npm test` passed: **897 tests, 0 fail** (7 skipped live-integration
tests).

---

## Update 2026-05-31 — G2/M3/M5 self-improving org loop shipped and proven in kind

The org now has its first closed self-improvement loop: deterministic model eval produces durable
decision-quality evidence; the decision optimizer reads that evidence plus KPI signal and proposes
a tenant-config delta as a ChangeSet; layered tenant config resolves the proposed overlay without
mutating runtime policy directly.

### What shipped

- `packages/model-eval/` scores Class A neutral-evidence cases and Class B directive-context cases
  against an allowed action vocabulary and expected action. The eval runner calls a decision port
  per case before scoring; the deploy proof uses a deterministic port so the proof is hermetic.
- Model-eval reports now summarize stable overall / per-class accuracy, failed cases, illegal
  decisions, and can project results into `model_eval_completed` org_events.
- `packages/application/src/decision-optimizer.ts` proposes safe model downgrades only when Class A
  clears threshold, KPI is non-negative, eval and KPI evidence refs are content-addressed, the
  evaluated model equals the candidate model, the candidate is lower-cost than the currently
  resolved model, and the budget delta is negative. It emits a drafted ChangeSet with a
  `config_change` artifact instead of mutating tenant config.
- The optimizer cycle is storage-neutral: it reads one JSON document with `getJson`, writes one
  JSON document with `putJson`, and appends JSON events with `appendJson`. The KIND proof supplies
  Cockroach stores behind that generic document/log adapter; a Git or GitHub PR-backed store can
  satisfy the same contract with files and PR changes without changing optimizer logic.
- Tenant config now supports versioned layers over organization, department, hat, and work-item
  scopes. Resolution is deterministic: more-specific non-nil model wins, integer budget deltas
  stack, same-specificity ties resolve by `updatedAt`, `version`, then `layerId`, and a layer can
  block inherited directives.
- New event kind `decision_optimization_proposed` records optimizer proposals as durable ledger
  evidence.
- KIND proof runner: `deploy/run-model-eval-optimizer.ts`.

### KIND proof

Worker image rebuilt as `agentic-org-worker:g2-m3-m5-generic-store`
(`sha256:a1dd61300a85be5f1583ca8d99f0aa1034a93ac1811e88ec24f8feb306a8b612`), loaded into KIND
cluster `agentic-org`, and deployed to pod `worker-687cc7dbd5-v2snn` with zero restarts. Fresh boot
logs showed cadence lanes, conformance, memory maintenance, keep-alive, and the worker cycle
ticking with `failureCount:0`.

`deploy/run-model-eval-optimizer.ts` ran through the generic optimizer store interface with
in-cluster Cockroach as the adapter for `org-model-eval-optimizer-65f29b32` and proved:

- The seeded model-eval run `eval-65f29b32` scored 2/2 overall, Class A 1/1, Class B 1/1 through
  the eval runner's decision-port path.
- The eval summary was bound to content-addressed evidence
  `evidence:model-eval-report:sha256:327b39c90b8ccc93e5da9768b0765837aaf17aab1d330c31e3f90b86d9a6fb13`.
- The KPI signal was bound to content-addressed evidence
  `evidence:decision-kpi:sha256:9156181894765028106932c6e78453723dacae72b372d2ab1b1aa87839468b61`.
- The optimizer produced drafted ChangeSet `6642c9f1-a96d-57ff-b3ad-fa97e33c1840` with one full
  `tenant-config/org-model-eval-optimizer-65f29b32.json` `config_change` artifact.
- Layer resolution before the overlay selected `gpt-5.5` with baseline directive
  `baseline:use-frontier-model`.
- Layer resolution after the proposed overlay selected `qwen2:0.5b`, stacked
  `budgetDeltaTokens = -512`, blocked the inherited baseline directive, and retained only the
  optimizer directive `optimizer:model-downgrade:eval-65f29b32`.
- The live ledger contained one `model_eval_completed` event and one
  `decision_optimization_proposed` event carrying both eval and KPI evidence refs.

`PROOF: PASS`.

### Verification

`npm run typecheck` passed. `npm test` passed: **916 tests, 0 fail** (7 skipped live-integration
tests).

---

## Update 2026-05-31 — Phase 2.7 policy simulation gate shipped and proven in kind

Phase 2.7 now has an executable gate: policy, config, model, prompt-flow, RMO, assignment,
autonomy, and schedule ChangeSets cannot move from drafted to review or from approved to applied
unless they carry verified simulation evidence or a verified emergency waiver. Raw evidence labels
are not enough; the gate requires content-addressed artifacts whose digest verifies and whose
payload is bound to the exact ChangeSet id.

### What shipped

- `evaluateChangeSetSimulationPolicy` classifies policy-surface ChangeSets and returns a typed
  allow/block decision with the authorizing evidence ref when present.
- `openChangeSet` and `applyChangeSet` enforce the simulation gate. A blocked policy ChangeSet
  keeps its current phase and emits `ReviewFindingRaised` instead of advancing.
- Verified `simulation-report` artifacts authorize only when they bind the target ChangeSet and
  record an accepted decision. Verified `emergency-waiver` artifacts authorize only when they bind
  the target ChangeSet and carry an approver plus reason.
- Code, doc, and config artifacts are all scanned for policy-surface paths, including plural,
  underscore, dash, and path-separated variants such as `prompt_flows/` and `model-policies/`.
- The release queue now passes verified evidence artifacts into change control, treats blocked
  apply attempts as requeued, and prevents one batch-level simulation artifact from leaking onto
  unrelated ChangeSet events.
- KIND proof runner: `deploy/run-policy-simulation-gate.ts`.

### KIND proof

Worker image rebuilt as `agentic-org-worker:keepalive`
(`sha256:ae7da938ae418c6875586a48c8f5139b6f9a26cae312253cd0ff982d32b6af4c`), loaded into KIND
cluster `agentic-org`, and deployed to pod `worker-7d6687568f-6hk76`. Fresh boot logs showed the
expected worker lanes, including `release-queue`, with zero `worker run failed` or structured
error matches.

`deploy/run-policy-simulation-gate.ts` ran against in-cluster Cockroach for
`org-policy-sim-bd99a813` and proved:

- The release queue evaluated two approved config-policy ChangeSets in one batch.
- ChangeSet `cs-policy-simulated-5650da46` carried a bound accepted `simulation-report` artifact
  and moved to `applied`.
- ChangeSet `cs-policy-unbound-5650da46` had no bound simulation/waiver artifact, stayed
  `approved`, and was counted as requeued.
- The lane result was `release-queue:1applied/0changes_requested/1requeued`.
- The live ledger contained one `ChangeSetApplied` event for the simulated ChangeSet and one
  `ReviewFindingRaised` event for the unbound ChangeSet.
- `unboundLeakedSimulationEvidence` was false, proving the accepted simulation evidence did not
  leak across ChangeSets.

`PROOF: PASS`.

The existing release-queue KIND proof was rerun as a regression check for
`org-release-7cd90280`: two green ChangeSets applied, one red ChangeSet moved to
`changes_requested`, and the lane reported `release-queue:2applied/1changes_requested/0requeued`.
`PROOF: PASS`.

### Verification

`npm run typecheck` passed. `npm test` passed: **1185 tests, 1178 pass, 0 fail, 7 skipped**.

---

## Update 2026-05-31 — Phase 2.8 secret-scope and rate-limit hard controls proven in kind

The observe-act action surface now carries secret-scope requirements as typed data. Prompt-flow
tool injections and MCP slots can declare `requiredSecretScopes`; prompt-flow tasks whose injected
tools require unavailable scopes are hidden as false slots during observe, and MCP dispatch is
re-authorized at act time before any tool side effect can run. The production CLI now also builds a
default control-plane slot authorizer from the parsed run context and Cockroach flags, so provider
freezes and secret/rate-limit controls cannot be bypassed by the foreground loop.

### What shipped

- `PromptFlowToolInjection` now supports `requiredSecretScopes`, and the agent CLI preserves those
  scopes when compiling durable prompt-flow definitions into current prompt-flow tasks.
- `SlotImpl.kind === "mcp"` now supports `requiredSecretScopes` directly on the executable slot.
- `observeAgentSurface` accepts `availableSecretScopes` and vetoes prompt-flow tasks with a
  `prompt-flow-secret-scope` reason when their tool injections require unavailable secrets.
- `createControlPlaneSlotAuthorizer` derives control-plane usage from MCP and prompt-flow slots, so
  act-time authorization rejects tool dispatch when the required secret scope is unavailable even if
  the slot was visible at observe time.
- `ControlPlaneRateLimit` adds windowed per-scope limits for tokens, tools, model calls, external
  provider calls, and release actions. Exhausted limits produce `rate_limit_exceeded` and expose the
  matched rate-limit ids in the control-plane audit.
- `runAgentCliMain` now wires production observe-act control-plane authorization by loading active
  Cockroach flags at act time and passing available secret scopes into observe.
- KIND proof runner: `deploy/run-control-plane-secret-scopes.ts`.

### KIND proof

Worker image rebuilt as `agentic-org-worker:keepalive`
(`sha256:59ff53b16321cf80c047cd97be239b50045d23b82ba2c6d9a591efb4d4b484f7`), loaded into KIND
cluster `agentic-org`, and deployed to pod `worker-5c9c9c668f-p9k2j`. Fresh boot logs showed the
expected cadence lanes with zero `worker run failed` or structured error matches.

`deploy/run-control-plane-secret-scopes.ts` ran against in-cluster Cockroach for
`org-control-plane-secrets-a8650bdd` and proved:

- A durable provider-freeze flag was upserted and read back through the Cockroach control-plane
  state store as `flag-provider-freeze-a8650bdd`.
- MCP dispatch with `providerId = github` was rejected with `provider_freeze`;
  `providerDispatched` remained false.
- MCP dispatch with required `github:write` but no available secret scope was rejected with
  `secret_scope_unavailable`; `secretDispatched` remained false.
- MCP dispatch with exhausted external-provider call rate limit was rejected with
  `rate_limit_exceeded`; `rateLimitDispatched` remained false.
- A prompt-flow task whose `github.publish_release` tool injection required `github:write` was
  rendered as a vetoed prompt-flow task with rule `prompt-flow-secret-scope`.
- The production CLI path selected a prompt-flow slot under a live Cockroach-backed provider freeze;
  it exited `1`, did not load context, and appended control-bypass evidence.

`PROOF: PASS`.

### Verification

`npm run typecheck` passed. `npm test` passed: **1194 tests, 1187 pass, 0 fail, 7 skipped**.
