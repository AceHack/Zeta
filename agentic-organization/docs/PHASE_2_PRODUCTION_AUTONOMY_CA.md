---
title: Phase 2 CA: Production Autonomy for Agentic Organization
canonical_name: Agentic Organization
status: design
date: 2026-05-31
depends_on:
  - ./NORTH_STAR_ALIGNMENT_CHECKPOINT.md
  - ./ORCHESTRATION_MOAT_ROADMAP.md
  - ./OBSERVABILITY_LGTM_STACK_DESIGN.md
  - ./AGENT_WORK_RHYTHM_AND_PROMPT_FLOWS.md
  - ./REFACTOR_OBSERVE_AS_UNIVERSAL_AGENT_CLI_AND_DASHBOARD.md
  - ../../docs/DECISIONS/2026-05-31-observe-act-16-direction-universal-action-grammar-local-no-cloud-llm.md
---

# Phase 2 CA: Production Autonomy for Agentic Organization

## 1. Executive Summary

Phase 1 proved that Agentic Organization can run a deterministic, observable, and
enforced organization kernel: work enters, hats act, RMO supplies capacity,
change-control gates apply, recovery lanes detect stuck work, telemetry is
exported, and the observe-act surface now exposes a 16-slot legal action menu,
prompt-flow context, scoped metrics, and hierarchy readouts.

Phase 2 makes that substrate production-autonomous. The goal is not to add a
larger pile of agent features. The goal is to make the organization behave like a
real operating company whose agents:

- choose only from legal, scoped, observable actions;
- improve assignment quality through measured reputation rather than static
  ranking;
- share hat queues without duplicate work;
- reassign capacity when schedules, queues, or outcomes say the current plan is
  failing;
- simulate policy changes before shipping them;
- turn telemetry regressions into reviewed ChangeSets;
- stop safely when production controls trip.

The implementation principle remains unchanged:

```text
determinism computes the legal set
  -> agentic choice selects within that legal set
  -> durable action records evidence
  -> telemetry and conformance verify what happened
  -> optimizer proposes reviewed changes
```

Phase 2 is the second development stage: the shift from "the architecture is
proved" to "the autonomous organization can be trusted to run continuously."

## 2. Current Substrate: What Phase 2 Builds On

The current branch already contains more than the original Phase 2 gap list
assumed. This CA treats these as foundations, not future work:

- `packages/application/src/observe.ts` exposes `observe`, `observeAgentSurface`,
  `renderMenu16`, `Menu16`, `TriAvailability`, prompt-flow readouts, vetoed
  options with reasons, hierarchy readouts, and `act()`.
- `apps/agent-cli/` renders the action menu, scoped metrics, prompt flows,
  hierarchy, management missions, and local model slot selection.
- `packages/application/src/rmo.ts` ranks candidates from explicit reputation
  components and records RMO assignment decisions.
- `packages/application/src/assignment-engine.ts` filters already-wearing,
  cooldown, conflict, and active-hat-cap cases before selection.
- `packages/observability/src/telemetry-port.ts` and
  `telemetry-query-port.ts` provide telemetry write/read ports, recording fakes,
  and LGTM query adapters.
- `packages/observability/src/dora-metrics.ts` provides internal DORA rollups and
  telemetry emission.
- `packages/application/src/decision-optimizer.ts` can propose model/config
  ChangeSets from model-eval, KPI evidence, and telemetry observations.
- Worker lanes exist for conformance, release queue, recovery scanners, and
  observe-act work-item execution.

The production gap is therefore in continuous closed-loop operation:

- the CLI `act()` path is not production-wired yet: the executable entrypoint
  still needs real command-pipeline append, MCP dispatch, durable snapshot load,
  and package/bin readiness;
- the current 16-slot menu is a usable projection, but not yet the ADR's full
  controller grammar with navigation, overflow paging, scope controls,
  retract/redo, and meta/escalation semantics;
- zero-survivor observe cases now render all-vetoed work slots with reasons and
  keep safe meta controls visible; remaining work is broader primary-lane rollout;
- local model selection now requests structured JSON-schema output for the
  selectable slot set, then still clamps the returned slot against the rendered
  `TriAvailability.True` menu;
- CLI and parsing failures still throw in several user-visible paths and must be
  converted to typed feedback for production loops;
- telemetry primitives exist, but every live cadence lane must be proven to emit
  spans/metrics, and LGTM query failures must return degraded evidence rather
  than empty successful data;
- conformance replay is a ratchet, not yet a complete theorem, because some
  transition contexts are still skipped or ambiguous;
- durable posterior reputation instead of static score components;
- work markets and lease-sharded same-hat queues instead of one-off assignment;
- schedule optimization instead of static schedules;
- simulator/DST policy proofs before policy/config changes;
- telemetry-driven optimizer triggers instead of manually invoked optimizer
  examples;
- production controls: ESTOP, tenant isolation, quotas, secrets, replay,
  backup/restore, and incident drills.

This CA therefore classifies the current state as **Phase 1.5 / early Phase 2
substrate**: credible primitives are present, but production autonomy is blocked
until the hardening gates below are complete.

## 3. Production Readiness Definition

Phase 2 is complete when the organization can run unattended for a bounded
production pilot and prove all of these properties:

1. **Legal action surface:** every active agent loop runs through observe-act or
   an equivalent observed command seam; illegal choices are rejected at render
   time and act time. An equivalent seam must provide the same minimum contract:
   deterministic legal set, veto evidence, scoped authority, typed feedback,
   org_event append, telemetry, conformance replay context, and control-plane
   enforcement.
2. **Learning assignment:** every meaningful work outcome updates durable
   per-agent/per-hat reputation distributions; RMO uses those distributions with
   exploration control.
3. **No duplicate same-hat work:** multiple agents under one hat claim distinct
   shards with leases and fencing; review quorum prevents one agent from
   self-ratifying shared work.
4. **Pressure-aware hierarchy:** projects, initiatives, departments, hats, and
   agents all expose pressure signals; supervisors can see when missions are
   behind and can take legal corrective actions.
5. **Simulation before policy mutation:** model, staffing, autonomy, scheduling,
   and policy changes must pass simulator comparison or carry an explicit
   emergency waiver.
6. **Self-improvement with evidence:** telemetry regressions create optimizer
   ChangeSets with content-addressed evidence; changes ship through the same
   review fabric as code.
7. **Operational kill switches:** ESTOP, budgets, rate limits, secret boundaries,
   tenant isolation, and replay/restore drills are tested and visible.
8. **Continuous proof:** conformance, recovery, observability completeness, and
   audit checks run as cadence lanes and CI gates.

## 4. Design Invariants

### 4.1 Deterministic Legal Set, Agentic Choice

The agent is never the source of legal authority. The agent can choose the most
interesting, useful, or contextually rich option only after deterministic logic
has produced the legal set.

This applies to:

- selecting an action slot;
- assigning an agent to a hat;
- changing schedule capacity;
- changing model or policy configuration;
- applying a release batch;
- promoting memory or graph knowledge;
- stopping or resuming production work.

### 4.2 Reputation Is Evidence, Not Vibes

Reputation must be computed from durable observations and represented as an
uncertain distribution. A single scalar is allowed as a presentation, but the
decision surface must preserve:

- sample count;
- recency;
- variance or confidence;
- outcome class;
- hat scope;
- work type scope;
- negative evidence;
- reviewer disagreement;
- cost and latency.

### 4.3 Every Autonomous Improvement Is a ChangeSet

The organization may propose changes to itself, but it does not silently mutate
itself. Optimizer output is a drafted ChangeSet with evidence, reviewers, and a
rollback path.

### 4.4 The Work Market Owns Concurrency

Many agents can wear the same hat only if the work surface supports sharding,
leases, dependency edges, and review. Adding agents without a market creates
duplicate effort and hidden coordination failures.

### 4.5 Boring Controls Are Part of Autonomy

Autonomy without ESTOP, budgets, tenant isolation, secrets hygiene, and restore
drills is not production autonomy. It is an unbounded demo.

## 5. Target Architecture

```text
                       Executive / C-suite missions
                                  |
                         portfolio pressure
                                  |
Directors ------------ project / initiative pressure ------------ RMO office
   |                              |                                  |
   |                         work market                             |
   |                              |                                  |
TPMs / Managers ---- schedule optimizer ---- hat supply ---- reputation engine
   |                              |                                  |
   |                          same-hat lanes                         |
   |                              |                                  |
Agents -> observe-act Menu16 -> prompt-flow compiler -> command / MCP / context
   |                              |                                  |
   +-------------------- org_event ledger ---------------------------+
                                  |
               conformance / LGTM / DORA / recovery / simulator
                                  |
                     self-improvement ChangeSets
```

The key change from Phase 1 is that the organization no longer only performs
work. It measures whether its operating model is working, simulates changes, and
proposes reviewed adjustments.

## 6. Phase Plan

### Phase 2.0: Production Baseline and Gate Closure

**Goal:** make the current branch a stable baseline for Phase 2 work.

**Implementation:**

- close all PR review threads and required checks;
- update the north-star checkpoint with the exact Phase 1 shipped surface;
- classify each current proof runner as `unit`, `contract`, `kind proof`, or
  `production drill`;
- add a Phase 2 readiness dashboard section to the docs index.

**Tests and proofs:**

- `npm run typecheck` in `agentic-organization`;
- `npm test` in `agentic-organization`;
- configured markdownlint at repo root;
- PR checks green;
- no unresolved PR threads.

**Exit criteria:**

- Phase 2 starts from a green branch;
- the current observe-act/LGTM/RMO state is documented as baseline, not as a
  future aspiration.

### Phase 2.1: Observability and Conformance Hardening

**Goal:** make the telemetry and conformance surfaces trustworthy enough to
drive production decisions.

**Existing foundation:**

- `TelemetryPort`, `RecordingTelemetry`, `TelemetryQueryPort`, LGTM HTTP query
  adapters, DORA metrics, org-event telemetry, and a worker OTLP adapter exist.
- Conformance replay exists and is wired as a lane.
- Grafana/LGTM manifests and smoke runners exist for kind-scale proof.

**Implementation:**

- pass telemetry through every composed cadence lane and prove `org.lane.tick`
  spans/metrics are emitted for every lane, not only specific lanes;
- replace silent LGTM query failure-to-empty behavior with typed degraded
  evidence: unavailable backend, bad response, parse failure, timeout;
- make optimizer telemetry evidence non-optional for telemetry-driven proposals;
- separate the kind smoke OTLP adapter from the production adapter contract, and
  record which metric kinds map to counters, gauges, and histograms;
- add transition-context envelopes for ambiguous state-changing org_events so
  conformance can replay more than the already-self-contained subset;
- add a conformance skip-count ratchet: new transition event kinds must be
  replayable or explicitly marked non-transition.

**Algorithms:**

- **observability completeness check:** compare lane registry, command registry,
  and reaction executors against emitted telemetry samples in tests;
- **degraded evidence propagation:** a telemetry read failure becomes a typed
  observation that can block optimizer proposals or surface in observe;
- **conformance coverage ratio:** `checked / (checked + skipped_ambiguous)` is a
  production SLI distinct from pass ratio.

**Tests and proofs:**

- unit test that `composeOrgCadenceLoops({ telemetry })` produces lane telemetry
  for every lane;
- OTLP contract tests against collector-compatible payloads for metric kind,
  traceparent continuity, and log attributes;
- failure-mode tests proving LGTM outages do not become empty successful reads;
- conformance tests proving ambiguous transition additions fail the ratchet;
- kind proof for conformance + telemetry on a full worker tick.

**Exit criteria:**

- telemetry completeness tests cover 100% of registered cadence lanes, command
  handlers, reaction executors, and release actions before optimizer decisions
  may consume telemetry;
- telemetry failures are visible and typed;
- conformance has a measured coverage ratio, no unclassified skipped transition
  kinds, and cannot silently lose new transition kinds.

### Phase 2.2: Observe-Act Production Foreground Loop

**Goal:** make observe-act the normal agent foreground loop for at least one real
worker path.

**Existing foundation:**

- `observe.ts` already returns legal and vetoed options;
- `renderMenu16` and `TriAvailability` already exist;
- `act()` already routes command, MCP, observe, and prompt-flow context actions;
- `apps/agent-cli` renders the menu, metrics, prompt flows, and hierarchy.

**Current production blockers:**

- the current slot layout is not yet the full ADR controller grammar;
- all-vetoed work menus now render disabled commit slots with reasons and keep
  safe meta controls reachable for refresh/status/rest/escalation;
- local model selection now uses a constrained JSON-schema `{ slot, reason }`
  contract, but broader primary-lane rollout still needs proof windows;
- several CLI/env/parser paths throw instead of returning typed feedback.

**Implementation:**

- wire CLI `act()` to the real command pipeline, real MCP/tool dispatcher, and
  durable org_event append path;
- add CLI package/bin metadata and a production invocation contract;
- align `renderMenu16` with the ADR controller grammar: navigation, commit,
  scope, retract/redo, escalation/meta, and overflow paging;
- change zero-survivor observe behavior to return a readout with vetoed `False`
  slots and reasons when a menu can still be rendered;
- convert CLI-visible throws to typed `Result`/feedback paths;
- define `AgentLoopMode = legacy | observe_act_shadow | observe_act_primary`;
- run one lane in `observe_act_shadow` first: render menu, record the slot the
  deterministic legacy path would have taken, but execute legacy behavior;
- promote one lane to `observe_act_primary` only after shadow output matches the
  expected legal action for a proof window;
- persist each observe-act tick as an org_event carrying menu hash, selected
  slot, veto count, prompt-flow ids, and scoped metric block ids;
- replace prompt-and-regex local selection with a constrained selection contract
  that returns only an integer slot index and a reason string;
- make illegal model output a normal feedback path, not a thrown worker crash.

**Checkpoint 2026-06-01: all-work-vetoed menu liveness**

`renderMenu16` now treats the work/commit bank and the controller/meta bank as
separate safety domains. When every work option is vetoed, commit slots remain
`False` with their veto reasons, prompt-flow work stays hidden, and
`meta.refresh` / `meta.status` stay selectable so the agent can reobserve or
emit glass-halo status instead of being stranded in a dead menu. Disabled
controller actions such as pause or escalation without supervisor context remain
`False`. CLI evidence now records this as `slot_not_selectable` when an agent
chooses a vetoed work slot, while retaining visible meta recovery slots.

**Checkpoint 2026-06-01: constrained local-model selector**

The agent CLI selector now requests structured model output with a JSON schema:
`{ "slot": <selectable integer>, "reason": <non-empty string> }`. The schema
enumerates only the currently rendered `TriAvailability.True` slots and is sent
through the Ollama chat adapter as the request `format` field. The post-model
clamp still validates the returned `slot` against the full rendered menu, so
schema failure, bracketed/free-form text, out-of-range slots, and non-selectable
slots remain typed selector rejections with fallback evidence instead of worker
crashes.

**Checkpoint 2026-06-01: observe lifecycle command authority**

Production observe-act command dispatch now reaches the same durable hat
authority policy as every other command without being rejected as an unknown
command class. `observe.lifecycle_transition` is classified as a delivery
`write_code` authority action, so delivery hats can advance selected lifecycle
commit slots through the real command pipeline while management hats that lack
delivery authority remain denied. This closes a production wiring gap where the
CLI could render and dispatch a command slot but the durable policy layer still
treated the observe-act foreground command as unsupported.

**Checkpoint 2026-06-01: slot 14 free-time/rest**

Slot 14 is now wired as the ADR's always-reachable `free-time / rest` control
instead of a disabled pause placeholder. `renderMenu16` exposes it as
`TriAvailability.True` even when every work option is vetoed, and `act(14)`
returns a typed `rested` result without invoking command dispatch or MCP/tool
side effects. The agent CLI includes the selected slot and menu hash in durable
tick evidence and prints an explicit rested action result, which gives the
foreground loop a bounded no-op action that is visible, auditable, and legal.

**Checkpoint 2026-06-01: slot 7 edit-grammar/branch**

Slot 7 is now reserved for the ADR's always-reachable `edit-grammar / branch`
generative exit instead of being reused as prompt-flow overflow capacity.
`renderMenu16` exposes it as `TriAvailability.True` in normal and all-work-vetoed
menus, and `act(7)` returns a typed `grammar_branch_requested` result without
invoking command dispatch or MCP/tool side effects. Prompt-flow context loading
now pages through slot 6 (`inspect.more`) only, preserving the fixed 16-slot
controller grammar while still giving agents access to all scoped prompt-flow
tasks through navigation.

**Checkpoint 2026-06-01: slots 10/11 history request controls**

Slots 10 and 11 are now selectable ADR grammar controls instead of disabled
placeholders. `history.retract` and `history.redo` return typed
`history_retract_requested` and `history_redo_requested` outcomes from `act()`
without command dispatch, MCP/tool dispatch, or ledger mutation. This makes
agent intent visible in tick evidence while keeping the stronger retraction
ledger, replay proof, and compensating-transaction machinery as the next
implementation layer rather than implying undo/redo side effects already exist.

**Checkpoint 2026-06-01: selected implementation and outcome evidence**

Observe-act tick events now record both the stable selected slot and the semantic
result of executing that selection. CLI and worker-lane events include
`observe-act:selected_impl:<kind>` and `observe-act:action_outcome:<outcome>`
evidence refs, so no-op/request choices such as rest, grammar-branch, history
retract, and history redo are auditable from durable org events without scraping
stdout.

**Checkpoint 2026-06-01: production CLI entrypoint readiness**

The observe-act foreground loop now has a tested executable surface. The root
`agentic-organization/package.json` exposes `npm run agent:observe` and the
`agentic-org-observe` bin entry, while `apps/agent-cli/src/main.ts` has the
`node --experimental-strip-types` shebang expected by that bin. The package
metadata test also anchors the Node engine floor used by the executable path.
This moves package/bin readiness out of the blocker list; remaining production
work is primary-lane rollout, controller-grammar completion, and deeper typed
feedback coverage.

**Algorithms:**

- **menu stability hash:** hash slot directions, labels, availability, reasons,
  and impl kinds to detect unexpected action-surface drift;
- **selector legality clamp:** accept only `TriAvailability.True` slots; illegal,
  neutral, or out-of-range picks become `selector_rejected` evidence;
- **shadow divergence score:** compare legacy action kind with selected observe-act
  slot over a rolling window before primary promotion.
- **promotion gate:** require at least 100 shadow ticks or a 24-hour kind soak,
  whichever is smaller for the test environment; zero illegal selected slots;
  no more than 5% divergence from the expected equivalence class; and automatic
  demotion to shadow if primary mode emits two selector rejections or one control
  bypass rejection in a 30-minute window.

**Tests and proofs:**

- unit tests for menu hash stability;
- contract tests for constrained selector output and illegal output rejection;
- CLI tests proving command, MCP, observe, and prompt-flow slots call real
  injected ports rather than stubs;
- lane test proving shadow mode emits observation but executes legacy path;
- kind proof showing one worker lane completes through observe-act primary and
  emits menu/slot evidence.

**Exit criteria:**

- at least one real lane no longer uses hardcoded action selection;
- all action choices are visible in telemetry and org_events;
- illegal model choices are rejected with evidence.
- primary mode has a documented rollback/demotion rule and passes the shadow
  promotion gate.

### Phase 2.3: Prompt-Flow Compiler and Hat Context Injection

**Goal:** let agents execute typed, hat-scoped prompt flows without needing to
know the hat's whole operating manual.

**Implementation:**

- define `PromptFlowDefinition` as the durable registry object:
  id, version, owning department, allowed hats, required scope, phases,
  permitted universal actions, tool injections, context artifacts, gates,
  reviewer hats, timeouts, retries, and rollback policy;
- compile prompt-flow definitions into executable `PromptFlowTask` values for
  `observeAgentSurface`;
- add `PromptFlowRun` lifecycle states:
  `created`, `context_loaded`, `running_phase`, `awaiting_gate`,
  `paused`, `completed`, `failed`, `cancelled`;
- route phase execution through `act()` so MCP tools stay behind slots;
- produce content-addressed phase evidence before a gate can pass;
- add prompt-flow registry lint: every flow must have owner, allowed hats, gates,
  evidence contract, timeout, and rollback class.

**Algorithms:**

- **context budget compiler:** select artifacts by scope, recency, authority,
  and phase need; emit the smallest sufficient context bundle;
- **phase-gate automaton:** each prompt-flow phase has legal next states and
  required evidence, replayable by conformance;
- **tool-injection minimizer:** inject only tools declared by the current phase,
  not the whole hat tool bundle.

**Tests and proofs:**

- unit tests for compiling a flow definition into a visible prompt-flow task;
- test that a hat outside `allowedHats` sees a vetoed flow with reason;
- test that missing phase evidence blocks gate transition;
- kind proof: backend implementer runs a code-change prompt flow through at least
  two phases and produces gate evidence.

**Exit criteria:**

- an agent can load a task-specific context bundle from observe;
- the flow controls tool access, evidence, and gates;
- prompt flows become reusable production assets, not ad hoc prompt text.

### Phase 2.4: Bayesian Reputation and Anti-Lock-In Assignment

**Goal:** replace static reputation scoring with durable posterior reputation
that learns from outcomes while preserving exploration.

**Implementation:**

- add a reputation event projection keyed by
  `(organizationId, agentId, hatId, workType, outcomeClass)`;
- record outcome events for completion quality, review reversals, QA bounce-backs,
  escaped defects, latency, schedule reliability, incident contribution, memory
  usefulness, collaboration quality, and cost;
- compute posterior distributions per agent/hat rather than storing only a scalar;
- expose `ReputationReadModel` to RMO and assignment engine;
- preserve current `rankRmoHatCandidates` presentation but feed it from posterior
  summaries: mean, lower confidence bound, uncertainty, and exploration bonus.
- split demo-only synthetic candidate generation from production RMO inputs so
  `org-runtime.ts` cannot be mistaken for the production staffing source.

**Algorithms:**

- **Beta-Bernoulli quality posterior:** success/failure style signals such as QA
  pass, review accepted, no escaped defect;
- **Normal-Gamma latency/cost posterior:** continuous signals such as lead time,
  token cost, p95 response time;
- **Thompson sampling or UCB:** RMO selects from ranked legal candidates with a
  controlled exploration term so one incumbent does not monopolize a hat;
- **risk-tiered exploration:** normal work can use Thompson sampling; high-risk
  or irreversible work requires a minimum lower-confidence bound before
  exploration is legal;
- **decay with evidence floor:** older outcomes decay, but severe incidents retain
  a minimum negative weight until reviewed;
- **lock-in penalty:** consecutive same-hat assignment count remains explicit and
  becomes stronger when confidence is high but outcome diversity is low.

**Checkpoint 2026-06-01: reputation decay and incident retention**

Posterior reputation now accepts an explicit decay policy when projecting
append-only observations. Old evidence keeps its evidence refs but contributes
less weight to the posterior, which lowers stale confidence instead of letting
old success lock an agent into a hat forever. Severe incident-contribution
observations can retain a configured minimum negative weight under decay, so a
high-severity incident remains a risk signal until a later review process
chooses to counterbalance it with durable evidence rather than being erased by
time alone. RMO candidate materialization now carries review-reversal and
incident-contribution posteriors into evidence refs, safety-adjusted agent-hat
reputation, and review-quality scoring, so retained incident evidence changes
assignment ranking instead of remaining a passive projection.

**Tests and proofs:**

- unit tests for posterior update math;
- simulation test proving a new agent with uncertainty gets sampled sometimes;
- simulation test proving a clearly unsafe agent is not selected by exploration;
- RMO test proving selected candidate includes evidence and posterior components;
- conformance test proving reputation updates are append-only observations, not
  authority mutations.

**Exit criteria:**

- RMO choices are explainable by durable reputation evidence;
- exploration is measurable and bounded;
- same-hat lock-in is structurally prevented.

### Phase 2.5: Work Market and Multi-Agent Same-Hat Lanes

**Goal:** allow many agents under the same hat to work concurrently without
duplicating work or self-approving.

**Implementation:**

- introduce `HatWorkQueue` per `(hatId, scope)` with priority, SLA, shardability,
  required skills, and review quorum;
- introduce `WorkClaim` with lease owner, fencing token, claimed shard, deadline,
  heartbeat, and release reason;
- split shardable work into `WorkShard` records with dependency edges and merge
  policy;
- make same-hat agents claim shards, not whole ambiguous queues;
- require peer or supervisory review for merged shard outputs;
- expose queue pressure and claim status in `observeForHat` and agent CLI.
- bind claims to schedule block, runtime session, worktree or workspace,
  credential scope, heartbeat deadline, and compensating action.

**Checkpoint 2026-06-01: foreground work-market visibility**

The same-hat work-market readout is now visible in the executable observe-act
foreground loop. `runAgentCliCycle` accepts `HatWorkQueue` context, computes the
same scoped `WorkMarketReadout` used by `observeForHat`, and renders queue
pressure, shard counts, stale-claim counts, and active claim ownership/fencing
tokens before the 16-slot menu. The production `runAgentCliMain` path can load
this context from `AGENTIC_ORG_WORK_MARKET_QUEUES_JSON` with typed setup
feedback on malformed input, so an agent can see whether it should claim a
different shard, wait for review, or escalate stale same-hat work instead of
staring at an undifferentiated work item.

**Checkpoint 2026-06-01: deterministic same-hat market clearing**

The work-market kernel now includes `planWorkMarketClaims`, a deterministic
cross-queue planner for same-hat agents. It scores claimable shards by queue
priority class, SLA urgency, shard priority, agent-hat reputation, current load,
recent same-hat claims, and required-skill fit, then emits a stable assignment
plan with at most one shard per agent and no duplicate shard ownership. The
planner makes the market surface explicit before claim mutation: supervisors and
foreground agents can see which agent should claim which queue/shard, which
ready shards remain unassigned, and why the selected assignments were preferred
without bypassing the existing lease-fenced `claimNextWorkShard` store boundary.

**Algorithms:**

- **weighted fair queueing:** reserve capacity by priority class and initiative
  trajectory while preventing low-priority starvation;
- **market clearing:** deterministic max-weight bipartite matching or min-cost
  max-flow over work demand, agent availability, posterior reputation, risk,
  schedule windows, and fairness penalties;
- **lease fencing:** only the current fencing token can complete or release a
  claim;
- **dependency-aware shard scheduling:** a shard is claimable only when upstream
  dependencies are complete or explicitly waived;
- **review quorum routing:** same-hat output cannot be accepted only by the agent
  that produced it.

**Tests and proofs:**

- two agents under `backend_implementer` claim different shards;
- duplicate bid/claim attempts resolve deterministically without duplicate work;
- stale claim is reaped and returned to the queue;
- old fencing token cannot complete a reclaimed shard;
- review quorum rejects self-only approval;
- kind proof: two same-hat agents complete separate shards and merge through a
  reviewer gate.

**Exit criteria:**

- adding agents increases useful throughput instead of duplicate activity;
- all same-hat concurrency is lease-protected and review-gated.

### Phase 2.6: Production Scheduling and Capacity Reassignment

**Goal:** make schedules runtime authority and allow supervisors to reassign hats
when capacity, reliability, or mission pressure changes.

**Implementation:**

- make scheduled blocks first-class inputs to observe-act availability;
- add `SchedulePressureSignal` from queue depth, SLA risk, stale claims,
  review lag, failure rate, and agent heartbeat reliability;
- add supervisor actions:
  `rebalance_hat_capacity`, `shorten_schedule_block`, `extend_focus_block`,
  `reassign_after_expiry`, `pause_low_priority_work`,
  `open_office_hours`, and `request_rmo_expand`;
- expire hat assignments through the lifecycle and route vacated hats to
  supervisor/RMO reassignment;
- expose schedule pressure in director, TPM, manager, and agent readouts.

**Checkpoint 2026-06-01: mission trajectory kernel**

The scheduling kernel now includes `evaluateMissionTrajectory`, a pure
expected-vs-actual mission slope model. It takes mission timeframe, target
progress, actual progress, and tolerance, then returns `on_track`, `at_risk`,
or `off_track` with expected progress, lag, remaining time, evidence refs, and
legal schedule corrective actions. Management observe readouts now derive their
mission progress slope from this shared kernel instead of a separate ad hoc
timeframe calculation, so director/TPM/manager surfaces and supervisor
reassignment policy use the same trajectory semantics. Subagent review for this
checkpoint was attempted but blocked by the platform agent-thread limit
(`collab spawn failed: agent thread limit reached`); the local TDD review
covered scheduler and observe tests instead.

**Algorithms:**

- **mission trajectory model:** compare target milestone slope to actual progress
  and produce `on_track`, `at_risk`, or `off_track`;
- **capacity pressure index:** queue pressure + SLA risk + review lag + agent
  reliability + uncertainty;
- **supervisor reassignment policy:** deterministic legal set, agentic supervisor
  choice among reassign/expand/pause/escalate;
- **burnout analogue for agents:** repeated long blocks, high failure rate, or
  context misses lower schedule reliability and trigger rotation.

**Tests and proofs:**

- director sees project/initiative trajectory and legal corrective actions;
- TPM sees initiative task pressure and meeting/schedule actions;
- manager sees agent schedule reliability and can reassign after expiry;
- an expired hat produces a legal reassignment path through RMO;
- conformance replay accepts schedule and reassignment transitions.

**Exit criteria:**

- schedules influence what agents can legally do now;
- supervisors see why a mission is behind and have legal corrective actions;
- expired or unreliable assignments do not leave work stranded.

### Phase 2.7: Org DST Simulator Before Policy Changes

**Goal:** require important policy/config changes to be simulated before they
ship, unless an emergency waiver is approved.

**Implementation:**

- create `packages/simulator` with in-memory adapters for org state, hat queues,
  reputation, schedules, prompt-flow runs, and telemetry summaries;
- replay recorded org_event slices and synthetic intake streams through cadence
  lanes and observe-act decisions;
- support policy overlays: autonomy level, model mapping, RMO parameters,
  schedule policy, reputation exploration rate, queue priority weights, and gate
  quorum;
- output `SimulationReport` with throughput, lead time, escaped defects,
  conformance failures, cost, review lag, stale claims, and incident count;
- require optimizer ChangeSets that alter policy/config to attach a simulation
  report evidence ref.

**Checkpoint 2026-06-01: simulator evidence gate present**

Phase 2.7 is now implemented in the current runtime substrate. The
`packages/simulator` package provides seeded counterfactual replay over
synthetic work events plus recorded `org_event` slices, in-memory adapters for
org state, hat queues, reputation, schedules, prompt-flow runs, and telemetry
summaries, policy overlays for autonomy/model/RMO/schedule/reputation/queue/gate
settings, and a `SimulationReport` containing throughput, lead time, escaped
defects, conformance failures, cost, review lag, stale claims, and incident
count. `evaluateSimulationRisk` performs the risk-envelope comparison, and the
scenario library covers incident spike, review bottleneck, QA churn, agent loss,
dependency outage, and model degradation.

The gate is wired into policy mutation surfaces: `openChangeSet` and
`applyChangeSet` reject policy/config changes without content-addressed
simulation evidence or an emergency waiver, the release queue refuses approved
config-policy applies without bound simulation evidence, and the decision
optimizer refuses model/config downgrades when simulation evidence is absent or
the simulation rejected the candidate. Subagent review for this checkpoint was
attempted but blocked by the platform agent-thread limit (`collab spawn failed:
agent thread limit reached`); local review cited the simulator,
change-control-kernel, decision-optimizer, and release-queue tests.

**Algorithms:**

- **counterfactual replay:** same input stream, different policy overlay;
- **paired comparison:** compare baseline and candidate on the same random seed;
- **risk envelope:** candidate must not regress safety metrics beyond thresholds;
- **scenario library:** incident spike, review bottleneck, QA churn, agent loss,
  dependency outage, and model degradation.

**Tests and proofs:**

- simulator replay is deterministic for fixed seed and input stream;
- candidate policy with lower cost but worse Class B quality is rejected;
- candidate schedule that improves lead time without raising defects is accepted;
- optimizer refuses policy ChangeSet without simulation evidence unless waiver
  evidence is present.

**Exit criteria:**

- simulator replay is deterministic for the same seed and input stream;
- the scenario library covers at least incident spike, review bottleneck, QA
  churn, agent loss, dependency outage, and model degradation;
- production policy changes carry simulation evidence.

### Phase 2.8: Hard Production Controls and No-Bypass Enforcement

**Goal:** make autonomy operationally safe before any self-improvement loop can
roll out config, model, policy, release, or tool-dispatch changes.

**Implementation:**

- add `ControlPlaneFlag` records for ESTOP, tenant freeze, hat freeze, budget
  freeze, provider freeze, and simulator-required mode;
- require control-plane checks at every side-effect boundary:
  `observe`, `act`, command dispatch, MCP/tool dispatch, org_event append,
  release application, reaction-plan execution, optimizer rollout, and cadence
  tick start;
- make coordinator/readiness/control lanes explicitly ESTOP-exempt and audited so
  operators can unfreeze the system;
- add per-tenant rate limits and budget ceilings for tokens, tools, model calls,
  external provider calls, and release actions;
- add secret-scope policy: prompt flows and MCP slots declare required secret
  scopes; observe-act hides slots whose secret scope is unavailable;
- define backup/restore and replay drills for git canonical state and Cockroach
  query index;
- add production incident runbooks as prompt flows with human approval gates.

**Checkpoint 2026-06-01: hard controls and no-bypass guardrails**

Phase 2.8 now has executable hard controls. `ControlPlaneFlag` covers ESTOP,
tenant/hat/org freeze, budget freeze, provider freeze, and simulator-required
mode. `ControlPlaneRateLimit` covers tokens, tools, model calls, external
provider calls, and release actions. The shared control-plane guard is wired
into observe slot rendering, act-time slot authorization, command dispatch,
MCP/tool dispatch, org-event append, release application, reaction-plan
execution, optimizer rollout, and cadence tick start; coordinator/readiness/
control lanes remain explicitly ESTOP-exempt and audited.

The foreground loop now treats secret scopes as typed data on MCP slots and
prompt-flow tool injections, hides unavailable prompt-flow tasks during observe,
and re-authorizes selected slots at act time so a late freeze or missing secret
cannot bypass the guard. Restore drills compute stable checksums over
tenant-scoped Cockroach projections, and the production incident runbook registry
ships the provider-outage runbook as a typed prompt flow with a human-approval
gate. The missing tenant-isolation proof is now covered directly: a tenant
freeze for `tenant-a` denies `tenant-a` and leaves `tenant-b` allowed.

Subagent review for this checkpoint was attempted but blocked by the platform
agent-thread limit (`collab spawn failed: agent thread limit reached`); local
review covered control-plane guard, agent CLI, org cadence, reaction-plan,
optimizer, restore-drill, and prompt-flow runbook tests.

**Algorithms:**

- **freeze propagation:** org freeze disables all non-control actions; hat freeze
  disables only matching hat actions; provider freeze disables external slots;
- **act-time fail-closed guard:** any side-effect boundary must reject if the
  applicable control flag is active, even when the action began before the flag
  was set;
- **budget-aware slot rendering:** expensive actions become `False` or `Neutral`
  with budget reason when ceilings are near;
- **replay consistency check:** restore Cockroach from git/event source and verify
  projected snapshots match pre-drill checksums.

**Tests and proofs:**

- ESTOP prevents lane actions while preserving heartbeat/control lanes;
- an action that passes observe but hits `act()` after ESTOP is rejected;
- command/MCP dispatch and org_event append fail closed under applicable freeze;
- tenant freeze does not affect another tenant;
- budget ceiling vetoes model/tool slots with visible reason;
- secret scope absence hides or vetoes the affected MCP slot;
- restore drill rebuilds projections and passes checksum comparison.

**Exit criteria:**

- no side-effect boundary can bypass active control flags;
- operators can stop, limit, and recover the organization;
- hard controls are tested, not just documented;
- Phase 2.9 optimizer changes may run only in proposal/shadow mode until this
  phase passes.

### Phase 2.9: Telemetry-Driven Self-Improvement Loop

**Goal:** turn DORA/LGTM telemetry regressions into reviewed improvement
ChangeSets.

**Implementation:**

- add optimizer triggers over `TelemetryQueryPort`: review p95, release queue
  depth, conformance pass ratio, QA bounce-backs, DORA lead time, model cost,
  token burn, incident count, and stale claim rate;
- define `ImprovementHypothesis` records:
  symptom, suspected cause, proposed change, evidence refs, expected metric
  movement, rollback condition;
- create ChangeSets for config/model/policy/prompt-flow changes;
- require queryable, non-empty telemetry evidence for telemetry-driven proposals
  unless the proposal is explicitly classified as eval/KPI-only;
- after rollout, compare observed metrics against expected movement and update
  reputation for the proposing optimizer hat.

**Algorithms:**

- **change-point detection:** detect metric shifts rather than reacting to noise;
- **causal guardrail:** require at least one trace/log/event link from symptom to
  suspected scope;
- **rollback trigger:** if post-change metrics regress beyond bound, propose or
  execute a rollback ChangeSet depending on autonomy level;
- **optimizer reputation:** optimizers gain reputation only when proposed changes
  improve realized metrics after review.

**Tests and proofs:**

- synthetic telemetry latency regression produces a ChangeSet with evidence;
- telemetry backend outage blocks telemetry-driven proposal with degraded
  evidence rather than producing a proposal from partial data;
- noisy metric fluctuation below threshold does not produce a proposal;
- post-change regression produces rollback proposal;
- optimizer proposal carries simulation evidence from Phase 2.7.

**Checkpoint 2026-06-01: telemetry optimizer learning loop**

Phase 2.9 now has a closed proposal-and-learning kernel. The telemetry
improvement optimizer already turns queryable DORA/LGTM regressions into
`ImprovementHypothesis` records and drafted ChangeSets with telemetry and
simulation evidence. It rejects degraded telemetry, empty telemetry, noise below
the change threshold, missing causal log/trace evidence, missing simulation
evidence, rejected simulation decisions, and rollback proposals without an
explicit rolled-out ChangeSet target. The KIND proof at
`deploy/run-telemetry-improvement-optimizer.ts` persists the proposal and
`decision_optimization_proposed` event through live Cockroach.

The missing production-learning edge is now explicit: post-rollout metric
movement is evaluated against the hypothesis' expected metric movement, and the
result becomes a durable `reputation_outcome_observed` event for the proposing
optimizer agent/hat. This means optimizer reputation can learn from realized
metric outcomes instead of gaining credit merely for drafting plausible
ChangeSets. A successful review-p95 improvement emits a positive quality
observation; missed movement emits the same substrate with a failed binary
signal, allowing the existing Bayesian reputation read model to reward or
penalize optimizer hats.

Subagent review for this checkpoint was attempted but blocked by the platform
agent-thread limit (`collab spawn failed: agent thread limit reached`); local
review covered the telemetry improvement optimizer, reputation event substrate,
export surface, and focused regression tests.

**Exit criteria:**

- telemetry is not passive dashboard data;
- the organization improves itself through reviewed, evidence-backed changes.
- rollout mode is blocked until Phase 2.8 controls and Phase 2.7 simulator
  evidence are present; before that, optimizer output is proposal-only.

### Phase 2.10: Pilot Readiness and Production Drill

**Goal:** run a bounded production pilot with measurable success criteria.

**Implementation:**

- choose one internal project and one department for the pilot;
- enable observe-act primary for selected lanes and hats;
- enable reputation updates, work market claims, schedule optimization,
  simulator-required policy changes, telemetry optimizer, and ESTOP;
- define pilot SLOs:
  conformance pass ratio, lead time, review lag, QA bounce-back rate,
  cost per completed work item, stale claim recovery time, and operator
  intervention count;
- run disaster drills: agent silence, bad model selector, queue overload,
  conformance breach, provider outage, and rollback.

**Tests and proofs:**

- seven-day synthetic replay before pilot;
- 24-hour continuous kind soak;
- production pilot report with all SLOs and incidents;
- post-pilot ChangeSet backlog generated from measured gaps.

**Exit criteria:**

- pilot completes without illegal transitions;
- ESTOP and restore drills pass;
- self-improvement backlog is generated from telemetry, not opinions.

## 7. Data Model Additions

### 7.1 Reputation

```ts
type ReputationObservation = {
  organizationId: string;
  agentId: string;
  hatId: string;
  workItemId?: string;
  workType?: string;
  outcomeClass:
    | "quality"
    | "latency"
    | "cost"
    | "review_reversal"
    | "qa_bounce_back"
    | "escaped_defect"
    | "incident_contribution"
    | "schedule_reliability"
    | "context_retention"
    | "collaboration";
  value: number;
  weight: number;
  evidenceRefs: readonly string[];
  observedAt: string;
};

type ReputationPosterior = {
  organizationId: string;
  agentId: string;
  hatId: string;
  workType?: string;
  outcomeClass: ReputationObservation["outcomeClass"];
  distribution:
    | { kind: "beta"; alpha: number; beta: number }
    | { kind: "normal_gamma"; mean: number; lambda: number; alpha: number; beta: number };
  sampleCount: number;
  mean: number;
  lowerConfidenceBound: number;
  uncertainty: number;
  decayHalfLifeDays: number;
  severeIncidentFloor?: number;
  evidenceWindow: { start: string; end: string };
  updatedAt: string;
};
```

### 7.2 Work Market

```ts
type HatWorkQueue = {
  organizationId: string;
  hatId: string;
  scopeKind: "work_item" | "initiative" | "project" | "organization";
  scopeId: string;
  priorityClass: string;
  slaDeadline?: string;
  shardPolicy: "not_shardable" | "independent_shards" | "dependency_graph";
  reviewQuorum: number;
};

type WorkClaim = {
  claimId: string;
  queueId: string;
  shardId?: string;
  runtimeLeaseId: string;
  agentId: string;
  hatAssignmentId: string;
  fencingToken: number;
  leaseExpiresAt: string;
  state: "claimed" | "heartbeat" | "completed" | "released" | "expired";
};
```

### 7.3 Lease and Runtime Allocation

```ts
type RuntimeLease = {
  leaseId: string;
  organizationId: string;
  workItemId: string;
  hatAssignmentId: string;
  agentId: string;
  scheduleBlockId: string;
  runtimeSessionId: string;
  workspaceRef: string;
  credentialScopeRefs: readonly string[];
  fencingToken: number;
  heartbeatDeadlineMs: number;
  leaseExpiresAt: string;
  compensatingActionRef: string;
  state: "reserved" | "active" | "renewed" | "completed" | "expired" | "revoked" | "handed_off";
};
```

`WorkClaim` owns queue/shard exclusivity. `RuntimeLease` owns execution
authority: schedule block, runtime session, workspace, credentials, heartbeat,
and compensating action. The two records share the same `fencingToken`; completing
a claim requires the active runtime lease with the matching token. A stale claim
without an active runtime lease is reclaimable, and a stale runtime lease without
an active claim cannot append work-completion events.

### 7.4 Simulation

```ts
type SimulationScenario = {
  scenarioId: string;
  inputStreamRef: string;
  baselinePolicyRef: string;
  candidatePolicyRef: string;
  randomSeed: string;
  metricThresholds: Record<string, number>;
};

type SimulationReport = {
  scenarioId: string;
  baseline: Record<string, number>;
  candidate: Record<string, number>;
  passed: boolean;
  regressions: readonly string[];
  evidenceRef: string;
};
```

### 7.5 Production Controls

```ts
type ControlPlaneFlag = {
  organizationId: string;
  scope:
    | { kind: "organization" }
    | { kind: "tenant"; tenantId: string }
    | { kind: "hat"; hatId: string }
    | { kind: "provider"; providerId: string };
  flag:
    | "estop"
    | "freeze"
    | "budget_freeze"
    | "provider_freeze"
    | "simulator_required";
  reason: string;
  setByHatId: string;
  setAt: string;
  expiresAt?: string;
};
```

## 8. Metrics and Alerts

Phase 2 adds these production metrics:

| Metric | Meaning | Alert |
|---|---|---|
| `org_reputation_observations_total` | Reputation evidence intake | zero for active org over pilot window |
| `org_reputation_uncertainty` | Per-agent/hat uncertainty | high uncertainty on critical hat |
| `org_rmo_exploration_ratio` | Share of exploratory assignments | outside configured min/max |
| `org_work_claims{state}` | Claim lifecycle counts | expired claims above threshold |
| `org_runtime_leases{state}` | Runtime lease lifecycle counts | expired/revoked above threshold |
| `org_queue_pressure` | Queue depth × SLA risk | sustained high by initiative |
| `org_schedule_pressure` | Schedule stress index | high for manager scope |
| `org_conformance_coverage_ratio` | Replayable transition coverage | below phase threshold |
| `org_telemetry_query_failures_total` | LGTM read-path failures | any optimizer-triggering query fails |
| `org_simulation_runs_total` | Policy simulation count | policy ChangeSet without simulation |
| `org_optimizer_proposals_total` | Improvement proposals | sudden spike or zero during regressions |
| `org_control_flags{flag}` | Active freezes/ESTOP | any ESTOP pages operator |
| `org_restore_drill_pass_ratio` | Restore proof health | below 1.0 |

These metrics should appear in director, TPM, RMO, and operator readouts through
the same `ScopedMetricAgent` path as existing LGTM/DORA metrics.

## 9. Review Gates

Phase 2 work must pass these gates:

- **Architecture gate:** new state machines, simulator, reputation math,
  work-market lease model, and production controls.
- **Security gate:** secret scopes, provider freeze, tenant isolation, control
  flags, and external tool dispatch.
- **Operations gate:** ESTOP, backup/restore, rate limits, budget ceilings, and
  incident drills.
- **Data correctness gate:** reputation posterior math, simulation determinism,
  conformance coverage, and replay integrity.
- **Product/organization gate:** hierarchy pressure readouts, supervisor actions,
  pilot scope, and operator UX.

No Phase 2 subsystem is production-enabled until its gate evidence is
content-addressed and attached to the relevant ChangeSet.

## 10. Risk Register

| Risk | Failure Mode | Mitigation |
|---|---|---|
| Reputation lock-in | one strong incumbent monopolizes a hat | UCB/Thompson exploration, lock-in penalty, rotation policy |
| Exploration harms critical work | low-confidence agent gets risky task | risk-tiered exploration; critical hats require lower-confidence bound threshold |
| Work market duplicates effort | two agents claim same work | lease fencing, shard ids, transaction boundaries |
| Stale authority persists | expired lease or hat still acts | fencing tokens, heartbeat deadlines, claim reaping, act-time authority check |
| Observe-act false readiness | CLI renders menus but cannot execute real actions | block production until command/MCP dispatch and org_event append are wired |
| Menu grammar drift | current slots diverge from ADR controller semantics | menu grammar tests and ADR-mapped slot registry |
| Silent telemetry gaps | optimizer trusts empty query results | typed degraded telemetry evidence and proposal blockers |
| Conformance overclaims | skipped events hide illegal transition classes | coverage ratio, transition-context envelope, skip-count ratchet |
| Schedule optimizer thrashes | constant reassignment destroys context | minimum block duration, cooldown, simulation, supervisor approval |
| Simulator gives false confidence | scenarios miss real production shape | recorded replay library, scenario expansion from incidents |
| Optimizer overfits telemetry noise | noisy metric creates bad ChangeSet | change-point detection, paired simulation, review gate |
| ESTOP blocks recovery | freeze stops the lane needed to unfreeze | coordinator/control lanes are ESTOP-exempt and audited |
| Tenant leakage | telemetry or context crosses org boundary | tenant-scoped query filters, secret scopes, projection tests |
| Agent selector drifts | local model picks illegal/free-text action | integer-only contract, clamp, rejection evidence, fallback selector |

## 11. Phase 2 Build Order

The recommended order is:

1. **Phase 2.0 baseline** so the branch is clean and current state is not
   ambiguous.
2. **Phase 2.1 observability and conformance hardening** because telemetry and
   replay are the evidence substrate for every autonomous improvement.
3. **Phase 2.2 observe-act primary lane** because every later capability should
   be visible through the same action surface.
4. **Phase 2.3 prompt-flow compiler** so agents can execute work from injected
   context and typed phases.
5. **Phase 2.4 Bayesian reputation** because RMO and scheduling need a learning
   signal.
6. **Phase 2.5 work market** because reputation without safe parallel work only
   improves one-at-a-time assignment.
7. **Phase 2.6 scheduling** because capacity changes need reputation and queues.
8. **Phase 2.7 simulator** before optimizers are allowed to mutate policy.
9. **Phase 2.8 hard controls** before telemetry optimizer rollout, because
   self-improvement can affect model/config/policy and must not bypass freezes.
10. **Phase 2.9 telemetry optimizer** once simulation evidence and control
   enforcement can gate changes.
11. **Phase 2.10 pilot** only after gates, controls, and simulator evidence exist.

## 12. Implementation Plan Artifacts to Generate Next

This CA should be decomposed into separate implementation plans, not one giant
PR:

- `docs/superpowers/plans/2026-05-31-phase-2-observability-conformance-hardening.md`
- `docs/superpowers/plans/2026-05-31-phase-2-observe-act-primary.md`
- `docs/superpowers/plans/2026-05-31-phase-2-prompt-flow-compiler.md`
- `docs/superpowers/plans/2026-05-31-phase-2-bayesian-reputation.md`
- `docs/superpowers/plans/2026-05-31-phase-2-work-market.md`
- `docs/superpowers/plans/2026-05-31-phase-2-schedule-optimizer.md`
- `docs/superpowers/plans/2026-05-31-phase-2-org-simulator.md`
- `docs/superpowers/plans/2026-05-31-phase-2-production-controls.md`
- `docs/superpowers/plans/2026-05-31-phase-2-telemetry-optimizer.md`

Each plan should follow TDD, include exact file paths, and end with a kind proof
or a documented reason that the phase is unit/contract only.

## 13. Subagent Review Notes

This CA incorporates three independent review passes.

### 13.1 Observe-Act / Universal Action Grammar Review

The observe-act substrate is real but not production-complete:

- `observe.ts` already has the core DUs, hat-aware observe, deterministic rules,
  action-class mapping, vetoed options, `TriAvailability`, `Menu16`,
  `renderMenu16`, `act`, metric-agent hooks, prompt-flow slots, hierarchy
  readouts, and `observeAgentSurface`.
- The executable CLI still wires action execution to stubs, so Phase 2
  must not claim real command/MCP execution until `act()` reaches the command
  pipeline, MCP dispatcher, and durable append path.
- The current 16-slot rendering is a menu, but not the final ADR controller
  grammar. Navigation, overflow paging, scope controls, retract/redo, and
  meta/escalation semantics are Phase 2 work.
- All-vetoed readouts must render disabled slots with reasons, not only return
  feedback.
- Local model selection must move from prompt/regex parsing to constrained
  1-of-16 output.
- CLI-visible failure paths need typed feedback instead of exceptions.

### 13.2 RMO / Reputation / Work Market Review

The RMO and assignment spine is credible but still prototype-shaped:

- RMO computes priority-weighted demand, supervisor quorum, and median target.
- Assignment filters already-wearing, cooldown, conflicts, active-hat cap, and
  supply cap.
- Candidate ranking includes reputation-shaped factors, load, freshness,
  exploration, and lock-in penalties.
- Missing production pieces are Bayesian posterior reputation, confidence
  bounds, decay, cold-start handling, causal outcome attribution, work-market
  clearing, runtime leases, same-hat sharding, and stale-authority fencing.
- `org-runtime.ts` demonstration paths must be separated from production lanes so
  synthetic candidates and hardcoded all-approval voters cannot be mistaken for
  production staffing.

The review recommends hierarchical Bayesian reputation, risk-tiered Thompson
sampling/UCB, deterministic market clearing, renewable leases with fencing
tokens, and same-hat cohorts with shard claims plus aggregator/review gates.

### 13.3 Production Controls / Simulator / Telemetry Review

The production hardening review found the main safety blockers:

- telemetry primitives exist, but live cadence composition must prove every lane
  emits lane telemetry;
- the current OTLP adapter is suitable for smoke/kind proof, but production needs
  stricter exporter semantics and metric-kind fidelity;
- LGTM query failures currently risk becoming empty data, which is unsafe for
  optimizer evidence;
- conformance is useful but incomplete because context-sensitive and ambiguous
  transitions can still be skipped;
- the whole-organization simulator/DST package and evidence gate now exist;
- ESTOP/control-plane freeze, no-bypass write guards, tenant isolation,
  restore-drill checksums, secret-scope guards, and rate limits now have
  executable proofs; ongoing production readiness still needs alert-ownership
  operating cadence and repeated disaster-drill evidence.

This is why Phase 2.1 hardens telemetry/conformance before the optimizer and why
Phase 2.7 requires simulator evidence before policy mutation.
