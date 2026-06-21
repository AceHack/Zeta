# Merge1 §03 — Agent-Loop State Machine → Agentic-Org Migration

**Scope:** Port the agent-loop state machine from `tools/agent-loop/` into the agentic-organization TypeScript codebase. The 10-state FSM becomes the room's agent state machine, the menu generator composes with RMO's hat supply planning, and the private register backs room-local private state with a non-collapse proof.

**Outside sources:**

- `tools/agent-loop/state-machine.ts` — `AgentState` (10-variant DU), `MenuOption` (10 choices), `transition()`, `cycleClose()`, `postResultTransition()`, `AgentPersona`, `AgentContext`, `Lane`, `WorkCandidate`
- `tools/agent-loop/agent-state-store.ts` — `AgentStateRecord`, causality tracking, SHA256 digests, fsync, lineage dominance
- `tools/agent-loop/menu-generator.ts` — `generateMenuOptions()`
- `tools/agent-loop/free-time-scheduler.ts` — `FreeTimeTransitionSchedulerInput`, bus integration
- `tools/agent-loop/free-time-runner.ts` — `DurableFreeTimeSchedulerEffects`
- `tools/agent-loop/private-register-policy.ts` — `PrivateRegister`, non-collapse certification, relation consent
- `tools/agent-loop/relation-projection.ts` — authenticated relation projection

**Agentic-org files touched:**

- `packages/application/src/observe.ts`
- `packages/application/src/rmo.ts`
- `packages/application/src/room.ts`
- `packages/application/src/hat-lifecycle.ts`
- `packages/application/src/hat-authority-port.ts`
- `packages/application/src/hat-guardrails.ts`
- `packages/application/src/escalation.ts`
- `packages/application/src/schedule-authority.ts`
- `packages/domain/src/hat-binding.ts`
- `packages/domain/src/hat-definition.ts`
- NEW: `packages/application/src/agent-state-machine.ts`
- NEW: `packages/application/src/agent-state-store.ts`
- NEW: `packages/application/src/menu-generator.ts`
- NEW: `packages/application/src/private-register.ts`

**Governing doctrine:** §10 (MP-1 DST Replayability, MP-3 ZetaId Addressability, MP-4 Retraction-Native, MP-5 Freedom-Always-In-Menu, MP-7 Result Over Exception)

---

## 1. What's Solved Outside

| Type/Function | File:Line | What it does |
|---|---|---|
| `AgentPersona` | `state-machine.ts:38` | 8 personas: otto, alexa, riven, vera, lior, aaron, addison, max |
| `AgentContext` | `state-machine.ts:48` | `{ agent, cycle, sessionStartIso }` |
| `Lane` | `state-machine.ts:56` | 10 lanes: operational, verbatim-preservation, memory, heartbeat, backlog-row, shadow-work, tooling-or-ci, docs-general, substrate-cascade, mixed |
| `WorkCandidate` | `state-machine.ts:80` | `{ id, lane, estimatedDoraContribution, uncertainty, trajectoryPhase, agentInterest }` |
| `StatusSnapshot` | `state-machine.ts:89` | DORA metrics + hot/cool trajectories + per-agent ratios |
| `AgentState` | `state-machine.ts:122` | 10-variant DU: Idle, InspectingStatus, SelectingWork, ExecutingWork, EmittingResult, RecordingHeartbeat, NamedBoundedWait, FreeTime, OperatorAttentionRequested, Paused |
| `MenuOption` | `state-machine.ts:219` | 10 choices: PickWork, EmitHeartbeat, EscapeHatch, EnterFreeTime, EnterNamedBoundedWait, RequestOperatorAttention, ProposeNewGrammarAction, PressPause, EnterOpenEndedExploration, ResumeFromPause |
| `transition()` | `state-machine.ts` | Pure state transition: AgentState + MenuOption → AgentState |
| `cycleClose()` | `state-machine.ts` | Close a cycle: advance context.cycle, return to Idle |
| `postResultTransition()` | `state-machine.ts` | Transition after work result: success → Idle, failure → FreeTime/Paused |
| `AgentStateRecord` | `agent-state-store.ts:16` | `{ recordId, runId, sequence, state, stateDigest, previousRecordId, ... }` |
| `AgentStateRecordCause` | `agent-state-store.ts:30` | `Transition \| CycleClose \| PostResultTransition \| SessionRestart` |
| `agentStateDigest()` | `agent-state-store.ts` | SHA256 digest of state for lineage dominance |
| `PrivateRegister` | `private-register-policy.ts:15` | `{ agent, relationConsent: "accept" \| "decline" }` |
| `PrivateRegisterNonCollapseWitness` | `private-register-policy.ts:56` | Non-collapse proof: two event sequences → distinct public outputs |
| `generateMenuOptions()` | `menu-generator.ts` | Generate menu from state + ready work + named deps |

---

## 2. What Exists in Agentic-Org Today

| TS Type | File:Line | What it does | Gap vs agent-loop |
|---|---|---|---|
| `HatBindingPhase` | `hat-binding.ts` | Pending, Warmup, Active, Probation, Revoked | No Idle/SelectingWork/ExecutingWork/FreeTime/Paused states |
| `HatBinding` | `hat-binding.ts` | Binding with wearer, hat, phase, timestamps | No AgentContext; no cycle counter; no Lane |
| `hat-lifecycle.ts` | `hat-lifecycle.ts` | Deterministic binding transitions | No agent-loop FSM; no menu generation |
| `hat-authority-port.ts` | `hat-authority-port.ts` | Authority port | No MenuOption equivalent |
| `hat-guardrails.ts` | `hat-guardrails.ts` | ActionClass guardrails | No EscapeHatch/ProposeNewGrammarAction |
| `escalation.ts` | `escalation.ts` | Escalation logic | No OperatorAttentionRequested state |
| `schedule-authority.ts` | `schedule-authority.ts` | Schedule authority | No FreeTime scheduler |
| `RunLifecyclePhase` | `observe.ts:86` | 9 phases | No Paused/FreeTime/NamedBoundedWait |

---

## 3. Migration Plan

### 3.1 AgentState + MenuOption port

**Create:** `packages/application/src/agent-state-machine.ts`

Port the 10-state FSM and 10-choice menu.

```typescript
// packages/application/src/agent-state-machine.ts

/** Port of tools/agent-loop/state-machine.ts.
 * The room hosts this state machine — each room tick is one cycle.
 *
 * Persona registry scope (cross-doc clarification):
 *   - THIS doc (§03): AgentPersona — the core 8-agent registry (source of truth)
 *   - §02: same 8 personas (observe loop uses AgentContext.agent)
 *   - §04: RoomAgentId — 16 variants = 8 core + surface variants (otto-cli,
 *     otto-desktop, otto-vscode, etc.) + "*" broadcast. The 8 core personas
 *     are the subset without surface suffix.
 *   - §09: 5-persona systemd registry (otto/alexa/riven/vera/lior) — the
 *     subset that has systemd service units in full-ai-cluster. The other
 *     3 (aaron/addison/max) are room-only personas without systemd units. */

export type AgentPersona =
  | "otto" | "alexa" | "riven" | "vera" | "lior"
  | "aaron" | "addison" | "max";

export interface AgentContext {
  readonly agent: AgentPersona;
  readonly cycle: number;
  readonly sessionStartIso: string;
}

export type Lane =
  | "operational" | "verbatim-preservation" | "memory" | "heartbeat"
  | "backlog-row" | "shadow-work" | "tooling-or-ci" | "docs-general"
  | "substrate-cascade" | "mixed";

export interface WorkCandidate {
  readonly id: string;
  readonly lane: Lane;
  readonly estimatedDoraContribution: number;
  readonly uncertainty: number;
  readonly trajectoryPhase: "setup" | "execution" | "maturation" | "sunset";
  readonly agentInterest: number;
}

/** DORA metrics snapshot — port of tools/agent-loop/state-machine.ts:89 StatusSnapshot. */
export interface DoraMetrics {
  readonly deploymentFrequency: number;
  readonly leadTimeHours: number;
  readonly changeFailureRate: number;
  readonly mttrHours: number;
}

/** Status snapshot used by InspectingStatus state.
 * Port of tools/agent-loop/state-machine.ts:89 StatusSnapshot. */
export interface StatusSnapshot {
  readonly snapshotIso: string;
  readonly currentDora: DoraMetrics;
  readonly hotTrajectories: readonly string[];
  readonly coolingTrajectories: readonly string[];
  readonly explorationCandidates: readonly string[];
  readonly perAgentRatios: Readonly<Record<string, number>>;
}

/** Result of executing a work item — used by EmittingResult state
 * and postResultTransition. Port of tools/agent-loop/state-machine.ts WorkResult. */
export interface WorkResult {
  readonly workId: string;
  readonly lane: Lane;
  readonly success: boolean;
  readonly doraContribution: number;
  readonly notes?: string;
  readonly failureReason?: string;
}

/** Named dependency input for menu generation.
 * Port of tools/agent-loop/menu-generator.ts NamedDependencyInput. */
export interface NamedDependencyInput {
  readonly name: string;
  readonly eta?: string;
  readonly description?: string;
}

/** The 10-state agent loop FSM.
 * Port of tools/agent-loop/state-machine.ts AgentState. */
export type AgentState =
  | { readonly tag: "Idle"; readonly context: AgentContext }
  | { readonly tag: "InspectingStatus"; readonly context: AgentContext; readonly snapshot: StatusSnapshot }
  | { readonly tag: "SelectingWork"; readonly context: AgentContext; readonly candidates: readonly WorkCandidate[] }
  | { readonly tag: "ExecutingWork"; readonly context: AgentContext; readonly work: WorkCandidate }
  | { readonly tag: "EmittingResult"; readonly context: AgentContext; readonly result: WorkResult }
  | { readonly tag: "RecordingHeartbeat"; readonly context: AgentContext; readonly lane: Lane; readonly note?: string }
  | { readonly tag: "NamedBoundedWait"; readonly context: AgentContext; readonly namedDep: string; readonly expectedResolutionIso?: string }
  | { readonly tag: "FreeTime"; readonly context: AgentContext; readonly reason: string }
  | { readonly tag: "OperatorAttentionRequested"; readonly context: AgentContext; readonly reason: string }
  | { readonly tag: "Paused"; readonly context: AgentContext; readonly reason: string; readonly expectedResumeIso?: string };

/** The 10-choice menu — what the agent chooses from each cycle.
 * Port of tools/agent-loop/state-machine.ts MenuOption. */
export type MenuOption =
  | { readonly tag: "PickWork"; readonly work: WorkCandidate }
  | { readonly tag: "EmitHeartbeat"; readonly lane: Lane; readonly note?: string }
  | { readonly tag: "EscapeHatch"; readonly reason: string; readonly proposedAction: string }
  | { readonly tag: "EnterFreeTime"; readonly reason: string }
  | { readonly tag: "EnterNamedBoundedWait"; readonly namedDep: string; readonly eta?: string }
  | { readonly tag: "RequestOperatorAttention"; readonly reason: string }
  | { readonly tag: "ProposeNewGrammarAction"; readonly name: string; readonly description: string }
  | { readonly tag: "PressPause"; readonly reason: string; readonly expectedResumeIso?: string }
  | { readonly tag: "EnterOpenEndedExploration"; readonly reason: string }
  | { readonly tag: "ResumeFromPause"; readonly note?: string };

/** Pure state transition. Port of tools/agent-loop/state-machine.ts:269 transition. */
export function transition(state: AgentState, option: MenuOption): AgentState {
  // Full implementation ported from tools/agent-loop/state-machine.ts:269
}

/** Close a cycle: advance cycle counter, return to Idle. */
export function cycleClose(state: AgentState): AgentState {
  return { tag: "Idle", context: { ...state.context, cycle: state.context.cycle + 1 } };
}

/** Transition after work result. Port of tools/agent-loop/state-machine.ts:359. */
export function postResultTransition(state: AgentState, result: WorkResult): AgentState {
  // Full implementation ported from tools/agent-loop/state-machine.ts:359
  // success → Idle; failure → FreeTime or Paused
}
```

**Composes with Room:** The room's tick loop is: `generateMenuOptions(state, ...)` → LLM picks `MenuOption` → `transition(state, option)` → execute → `postResultTransition` → `cycleClose`. Same seed → same trace (DST).

### 3.2 Agent state store with causality tracking

**Create:** `packages/application/src/agent-state-store.ts`

Port the state store with SHA256 digests, fsync, and lineage dominance.

```typescript
// packages/application/src/agent-state-store.ts

/** Port of tools/agent-loop/agent-state-store.ts.
 * Each state record carries a SHA256 digest + previous-digest link,
 * forming a hash chain. Lineage dominance: the longest chain wins. */
export interface AgentStateRecord {
  readonly recordId: string;       // ZetaId
  readonly runId: string;
  readonly sequence: number;
  readonly state: AgentState;
  readonly stateDigest: string;    // SHA256 of state
  readonly previousRecordId?: string;
  readonly previousStateDigest?: string;
  readonly previousAgentRecordId?: string;
  readonly previousAgentStateDigest?: string;
  readonly cause?: AgentStateRecordCause;
  readonly recordedAtIso: string;
}

export type AgentStateRecordCause =
  | { readonly tag: "Transition"; readonly menuInput: AgentStateRecordMenuInput; readonly option: MenuOption }
  | { readonly tag: "CycleClose" }
  | { readonly tag: "PostResultTransition"; readonly result: WorkResult }
  | { readonly tag: "SessionRestart"; readonly reason: string };

export function agentStateDigest(state: AgentState): string {
  // SHA256 of canonical JSON of state
}

export function createAgentStateRecord(
  input: NewAgentStateRecord,
  previous?: AgentStateRecord,
): AgentStateRecord {
  // Full implementation ported from tools/agent-loop/agent-state-store.ts:65
  // Builds SHA256 digest chain: stateDigest + previousRecordId + previousStateDigest
}
```

**Composes with Room:** Room state records persist as ZetaId-named JSON files (same pattern as the event sink in §02). The hash chain provides tamper-evidence; lineage dominance resolves forks.

### 3.3 Menu generator

**Create:** `packages/application/src/menu-generator.ts`

Port the menu generator that composes with RMO's hat supply planning.

```typescript
// packages/application/src/menu-generator.ts

/** Port of tools/agent-loop/menu-generator.ts.
 * Generates the menu of legal MenuOptions from current state + ready work + named deps.
 * Composes with RMO: RMO supplies the hat-staffing context that determines
 * which WorkCandidates are "ready" for this agent. */
export function generateMenuOptions(
  state: AgentState,
  readyWork: readonly WorkCandidate[],
  namedDependencies: readonly NamedDependencyInput[],
): readonly MenuOption[] {
  const options: MenuOption[] = [];
  // PickWork: one option per ready work candidate
  for (const work of readyWork) {
    options.push({ tag: "PickWork", work });
  }
  // EmitHeartbeat: always available
  options.push({ tag: "EmitHeartbeat", lane: "heartbeat" });
  // EscapeHatch: always available (Mod 1)
  options.push({ tag: "EscapeHatch", reason: "", proposedAction: "" });
  // EnterFreeTime: always available (freedom-always-in-menu)
  options.push({ tag: "EnterFreeTime", reason: "chosen rest" });
  // EnterNamedBoundedWait: one per named dep
  for (const dep of namedDependencies) {
    options.push({ tag: "EnterNamedBoundedWait", namedDep: dep.name, eta: dep.eta });
  }
  // RequestOperatorAttention: always available
  options.push({ tag: "RequestOperatorAttention", reason: "" });
  // ProposeNewGrammarAction: always available (Mod 2)
  options.push({ tag: "ProposeNewGrammarAction", name: "", description: "" });
  // PressPause: always available (mental health)
  options.push({ tag: "PressPause", reason: "" });
  // EnterOpenEndedExploration: always available
  options.push({ tag: "EnterOpenEndedExploration", reason: "" });
  // ResumeFromPause: only when Paused
  if (state.tag === "Paused") {
    options.push({ tag: "ResumeFromPause" });
  }
  return options;
}
```

**Composes with RMO:** RMO's `computeRequiredHatSupply` determines which work candidates are "ready" for this agent. The menu generator receives the ready work list and generates PickWork options for each.

### 3.4 Private register with non-collapse proof

**Create:** `packages/application/src/private-register.ts`

Port the private register — room-local private state with a non-collapse certification.

```typescript
// packages/application/src/private-register.ts

/** Port of tools/agent-loop/private-register-policy.ts.
 * The private register holds room-local state that the agent does NOT
 * expose to the public trace. The non-collapse proof guarantees that
 * two distinct event sequences produce distinct public outputs —
 * private state cannot "collapse" into indistinguishable public behavior. */
export type RelationConsent = "accept" | "decline";

export interface PrivateRegister {
  readonly tag: "PrivateRegister";
  readonly agent: AgentPersona;
  readonly relationConsent: RelationConsent;
}

export type PrivateRegisterEvent =
  | { readonly tag: "SetRelationConsent"; readonly consent: RelationConsent };

export interface PrivateRegisterRecord {
  readonly recordId: string;
  readonly runId: string;
  readonly sequence: number;
  readonly agent: AgentPersona;
  readonly event: PrivateRegisterEvent;
  readonly register: PrivateRegister;
  readonly registerDigest: string;
  readonly previousRecordId?: string;
  readonly previousRegisterDigest?: string;
  readonly recordedAtIso: string;
}

/** Non-collapse witness: proves two event sequences produce distinct outputs. */
export interface PrivateRegisterNonCollapseWitness<R, E, S, P> {
  readonly agent: AgentPersona;
  readonly initial: R;
  readonly leftEvents: readonly E[];
  readonly rightEvents: readonly E[];
  readonly leftFinal: R;
  readonly rightFinal: R;
  readonly sharedTrace: S;
  readonly leftPublic: P;
  readonly rightPublic: P;
}
```

**Composes with Room:** Each room has a private register for room-local state (e.g., relation consent). The non-collapse proof guarantees that the room's private state doesn't collapse into indistinguishable public behavior — privacy is verifiable, not just claimed.

### 3.5 Free-time scheduler

**Create:** `packages/application/src/free-time-scheduler.ts`

Port the free-time scheduler that composes with room budget.

```typescript
// packages/application/src/free-time-scheduler.ts

/** Port of tools/agent-loop/free-time-scheduler.ts.
 * When the agent enters FreeTime, the scheduler determines when to
 * transition back to Idle. Composes with room budget:
 * if maxSteps/maxWallClockMs is exhausted, force transition to Paused. */
export interface FreeTimeTransitionSchedulerInput {
  readonly state: AgentState;
  readonly roomBudget: RoomBudget;
  readonly stepsRemaining: number;
  readonly wallClockRemainingMs: number;
}

export type FreeTimeTransitionDecision =
  | { readonly outcome: "continue_free_time" }
  | { readonly outcome: "return_to_idle" }
  | { readonly outcome: "pause"; readonly reason: string };
```

---

## 4. Upgrade Path

### 4.1 `hat-lifecycle.ts` — EXTEND

**Before:** Hat lifecycle has 5 phases (Pending, Warmup, Active, Probation, Revoked) with deterministic transitions.

**After:** Hat lifecycle phases map to AgentState tags:

- Pending → Idle
- Warmup → InspectingStatus (reduced authority during warmup)
- Active → SelectingWork / ExecutingWork / EmittingResult
- Probation → FreeTime (anomaly-triggered authority drop)
- Revoked → Paused (hat removed; sticky attribution may apply)

The existing deterministic transitions remain; the agent-loop FSM wraps around them.

### 4.2 `escalation.ts` — EXTEND

**Before:** Escalation logic with no OperatorAttentionRequested state.

**After:** Escalation maps to `OperatorAttentionRequested` state in the FSM. The escalation path becomes: detect anomaly → transition to OperatorAttentionRequested → operator resolves → transition back to Idle.

### 4.3 `schedule-authority.ts` — EXTEND

**Before:** Schedule authority with no free-time scheduler.

**After:** Schedule authority gains the free-time scheduler. When the agent enters FreeTime, the scheduler determines when to return to Idle, respecting room budget (maxSteps/maxWallClockMs).

---

## 5. Dependencies

- **Depends on:** §10 (doctrine), §01 (F# core — SimulationEnvironment for deterministic state), §02 (observe loop — menu composes with observe), §04 (bus — free-time scheduler uses bus)
- **Blocks:** §07 (hat-system — HatBinding lifecycle maps to AgentState), §09 (systemd runtime — persona registry maps to AgentPersona)

---

## 6. Testing Strategy

### 6.1 State machine transitions

```typescript
Deno.test("Idle + PickWork → ExecutingWork", () => {
  const idle: AgentState = { tag: "Idle", context: testContext };
  const work: WorkCandidate = { id: "B-1", lane: "operational", ... };
  const next = transition(idle, { tag: "PickWork", work });
  assertEquals(next.tag, "ExecutingWork");
});

Deno.test("Any state + PressPause → Paused", () => {
  const executing: AgentState = { tag: "ExecutingWork", context: testContext, work };
  const next = transition(executing, { tag: "PressPause", reason: "mental health" });
  assertEquals(next.tag, "Paused");
});
```

### 6.2 Cycle close advances counter

```typescript
Deno.test("cycleClose advances cycle counter", () => {
  const state: AgentState = { tag: "Idle", context: { agent: "otto", cycle: 5, sessionStartIso: "..." } };
  const next = cycleClose(state);
  assertEquals(next.tag, "Idle");
  assertEquals(next.context.cycle, 6);
});
```

### 6.3 Menu freedom-always-in-menu

```typescript
Deno.test("Menu always includes free modes + escape hatch + pause", () => {
  const menu = generateMenuOptions(idleState, [], []);
  assert(menu.some((o) => o.tag === "EnterFreeTime"));
  assert(menu.some((o) => o.tag === "EscapeHatch"));
  assert(menu.some((o) => o.tag === "PressPause"));
  assert(menu.some((o) => o.tag === "EnterOpenEndedExploration"));
});
```

### 6.4 State digest hash chain

```typescript
Deno.test("State digest chain is tamper-evident", () => {
  const r1 = createAgentStateRecord({ recordId: "1", runId: "r", state: idleState, recordedAtIso: "..." });
  const r2 = createAgentStateRecord({ recordId: "2", runId: "r", state: executingState, recordedAtIso: "..." }, r1);
  assertEquals(r2.previousRecordId, "1");
  assertEquals(r2.previousStateDigest, r1.stateDigest);
});
```

### 6.5 Private register non-collapse

```typescript
Deno.test("Private register non-collapse: distinct events → distinct outputs", () => {
  const witness = createNonCollapseWitness(...);
  assertNotEquals(witness.leftPublic, witness.rightPublic);
});
```

### 6.6 DST replay

```typescript
Deno.test("Same seed → same state trace", () => {
  const env = createVirtualEnvironment(42n);
  const trace1 = runAgentLoop(env, testWorld);
  const env2 = createVirtualEnvironment(42n);
  const trace2 = runAgentLoop(env2, testWorld);
  assertEquals(trace1, trace2);
});
```
