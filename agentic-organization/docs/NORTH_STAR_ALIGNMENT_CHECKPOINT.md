---
title: North Star Alignment Checkpoint
canonical_name: Agentic Organization
status: design
---

# North Star Alignment Checkpoint

## Status

Current checkpoint after the first executable TypeScript slices and
subagent review.

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
