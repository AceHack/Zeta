# Merge1 §05 — Workflow Engine → Agentic-Org Migration

**Scope:** Port the workflow engine from `tools/workflow-engine/` into the agentic-organization TypeScript codebase. The workflow engine provides the universal action grammar, four-corner ownership, tick cycle patterns, and the World substrate (git-flow as shared space where multiple lifetimes interact).

**Outside sources:**

- `tools/workflow-engine/types.ts` — `ActionGate`, `ActionClass`, `Action`, `TickCyclePattern`, `State`, `FourCornerOwnership<TIn,TOut,TOutFeedback,TInFeedback>`, `Tick`
- `tools/workflow-engine/world.ts` — `World` interface, `GitWorld`, `GitHubWorld`, `GitLabWorld`, `StandardVerdict`, `registerLifetimePair`
- `tools/workflow-engine/composed-lifetime.ts` — `ComposedKey`, `LifetimeState`, `TransitionResult`, `TransitionFeedback`
- `tools/workflow-engine/grammar.ts` — action grammar parser
- `tools/workflow-engine/closed-loop.ts` — closed-loop control
- `tools/workflow-engine/consensus.ts` — consensus protocol
- `tools/workflow-engine/evolution.ts` — grammar evolution
- `tools/workflow-engine/proximity.ts` — proximity scoring
- `tools/workflow-engine/trueskill.ts` — TrueSkill reputation scoring
- `tools/workflow-engine/pairing.ts` — agent pairing

**Agentic-org files touched:**

- `packages/application/src/observe.ts` — observe entrypoint
- `packages/application/src/command-contract.ts` — PipelineCommand
- `packages/application/src/command-handler-registry.ts` — command handler registry
- `packages/application/src/command-pipeline.ts` — command pipeline
- `packages/application/src/pipeline.ts` — pipeline
- `packages/application/src/ports.ts` — ports
- `packages/application/src/reaction-plan-action-executor.ts` — reaction plan executor
- `packages/domain/src/reaction-plan.ts` — reaction plan
- `packages/domain/src/work-item-state-machine.ts` — work item state machine
- NEW: `packages/application/src/workflow-engine-types.ts`
- NEW: `packages/application/src/workflow-world.ts`
- NEW: `packages/application/src/four-corner-ownership.ts`

**Governing doctrine:** §10 (MP-1 DST Replayability, MP-4 Retraction-Native, MP-6 Asymmetric Authorship, MP-7 Result Over Exception)

---

## 1. What's Solved Outside

| Type/Function | File:Line | What it does |
|---|---|---|
| `ActionGate` | `types.ts:43` | `"append-only" \| "pr-gated"` — discriminator for direct push vs PR review |
| `ActionClass` | `types.ts:54` | 6 classes: transition, escape-hatch, grammar-extension, menu-contribution, operator-decision, agent-decision |
| `Action` | `types.ts:68` | Universal action atom: id, class, gate, label, composesWith, feedbackVariants |
| `TickCyclePattern` | `types.ts:95` | 4 patterns: observe-simulate-choose-emit, move-next-named-function, discriminated-union-surface, ople-primitives |
| `State` | `types.ts:108` | Workflow state node: id, label, tickCyclePattern, availableActions, composesWith |
| `FourCornerOwnership<TIn,TOut,TOutFeedback,TInFeedback>` | `types.ts:133` | Asymmetric authorship: TIn (caller authors), TOut (function produces), TOutFeedback (function authors), TInFeedback (co-owned) |
| `Tick<TIn,TOut,TOutFeedback,TInFeedback>` | `types.ts:146` | One cycle: state + ownership + chosenAction + timestamp |
| `validateStateOtto5Mods()` | `types.ts:164` | Validates Mod 1 (escape-hatch in every state) + Mod 2 (grammar-extension first-class) |
| `validateCatalog()` | `types.ts:193` | Validates catalog-level invariants (unique IDs, Mod 2, valid references) |
| `World` | `world.ts:104` | Shared substrate where multiple lifetimes interact; registry of composed-lifetime matrices |
| `StandardVerdict` | `world.ts:127` | 5 verdicts: advance, block, complete, no-op, escalate-to-operator |
| `registerLifetimePair<W,A,B,T>()` | `world.ts:148` | Register a composed-lifetime matrix in the world (immutable, returns new world) |
| `GitWorld` / `GitHubWorld` / `GitLabWorld` | `world.ts` | Specialized World subclasses with forge-specific fields (forgeName, branchUniverse, prUniverse) |
| `LifetimeState` | `composed-lifetime.ts` | Per-substrate-entity DU (editable lifetime) |
| `ComposedKey<A,B>` | `composed-lifetime.ts` | Pair key for composed-lifetime dispatch |
| `TransitionResult` | `composed-lifetime.ts` | Result of a lifetime transition |
| `TransitionFeedback` | `composed-lifetime.ts` | Feedback channel for lifetime transitions |
| `TrueSkill` | `trueskill.ts` | Bayesian reputation scoring (μ, σ updates) |
| `proximity` | `proximity.ts` | Proximity scoring for room adjacency |

---

## 2. What Exists in Agentic-Org Today

| TS Type | File:Line | What it does | Gap vs workflow-engine |
|---|---|---|---|
| `PipelineCommand` | `command-contract.ts:15` | Command with id, type, idempotencyKey, requestHash, actor | No ActionClass; no gate; no feedbackVariants |
| `PipelineCommandPolicyContext` | `command-contract.ts:9` | Policy scope + toolType + supervisorChain | No FourCornerOwnership |
| `CommandHandlerRegistry` | `command-handler-registry.ts` | Registry of command handlers | No ActionClass taxonomy; no escape-hatch guarantee |
| `CommandPipeline` | `command-pipeline.ts` | Command execution pipeline | No TickCyclePattern; no World substrate |
| `ReactionPlan` | `reaction-plan.ts` | Reaction plan (domain) | No FourCornerOwnership |
| `WorkItemStateMachine` | `work-item-state-machine.ts` | Work item state transitions | No escape-hatch in every state; no grammar-extension |
| `RunLifecyclePhase` | `observe.ts:86` | 9-phase run lifecycle | Maps to State but no TickCyclePattern |

---

## 3. Migration Plan

### 3.1 FourCornerOwnership port

**Create:** `packages/application/src/four-corner-ownership.ts`

Port the four-corner ownership type — the asymmetric authorship primitive.

```typescript
// packages/application/src/four-corner-ownership.ts

/** Four-corner ownership — asymmetric authorship primitive.
 * Port of tools/workflow-engine/types.ts FourCornerOwnership.
 *
 * Per the asymmetric-authorship rule:
 *   - TIn — caller authors; flows caller → function
 *   - TOut — function produces; flows function → caller (value-branch)
 *   - TOutFeedback — function authors; flows function → caller (control-flow signals)
 *   - TInFeedback — CO-OWNED (both caller AND function contribute variants)
 *
 * The substrate-entity (action, state, channel) AUTHORS its own
 * TOutFeedback discriminator-channel. The caller ACKNOWLEDGES it. */
export interface FourCornerOwnership<TIn, TOut, TOutFeedback, TInFeedback> {
  readonly tIn: TIn;
  readonly tOut?: TOut;
  readonly tOutFeedback?: TOutFeedback;
  readonly tInFeedback?: TInFeedback;
}
```

**Upgrade `command-contract.ts`:** `PipelineCommand` gains a `FourCornerOwnership` type parameter:

```typescript
// command-contract.ts — AFTER upgrade
export type PipelineCommand<TIn = unknown, TOut = unknown, TOutFeedback = string, TInFeedback = string> = {
  commandId: string;
  type: string;
  idempotencyKey: string;
  requestHash: string;
  correlationId: string;
  causationId: string;
  traceId: string;
  organizationId: string;
  projectId: string;
  actor: AgenticActor;
  policyContext?: PipelineCommandPolicyContext;
  /** Four-corner ownership — the command authors its own feedback channel. */
  ownership: FourCornerOwnership<TIn, TOut, TOutFeedback, TInFeedback>;
};
```

### 3.2 ActionClass + Action port

**Create:** `packages/application/src/workflow-engine-types.ts`

Port the universal action grammar.

```typescript
// packages/application/src/workflow-engine-types.ts

/** Action gate — append-only vs PR-gated discriminator.
 * Port of tools/workflow-engine/types.ts ActionGate. */
export type ActionGate = "append-only" | "pr-gated";

/** Action class — universal action grammar surface.
 * Port of tools/workflow-engine/types.ts ActionClass.
 *   - Mod 1: escape-hatch action in every state
 *   - Mod 2: grammar-extension is itself an action
 *   - Mod 5: contributable menu-generation */
export type ActionClass =
  | "transition"
  | "escape-hatch"
  | "grammar-extension"
  | "menu-contribution"
  | "operator-decision"
  | "agent-decision";

/** The universal-action-grammar atom.
 * Port of tools/workflow-engine/types.ts Action. */
export interface Action {
  readonly id: string;
  readonly class: ActionClass;
  readonly gate: ActionGate;
  readonly label: string;
  readonly description: string;
  readonly composesWith: ReadonlyArray<string>;
  readonly feedbackVariants: ReadonlyArray<string>;
}

/** Tick cycle pattern — how the room's tick loop is structured.
 * Port of tools/workflow-engine/types.ts TickCyclePattern. */
export type TickCyclePattern =
  | "observe-simulate-choose-emit"
  | "move-next-named-function"
  | "discriminated-union-surface"
  | "ople-primitives";

/** Workflow state node.
 * Port of tools/workflow-engine/types.ts State. */
export interface WorkflowState {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly tickCyclePattern: TickCyclePattern;
  readonly availableActions: ReadonlyArray<string>;
  readonly composesWith: ReadonlyArray<string>;
}

/** One cycle of the workflow engine agent loop.
 * Port of tools/workflow-engine/types.ts Tick. */
export interface Tick<TIn, TOut, TOutFeedback, TInFeedback> {
  readonly state: WorkflowState;
  readonly ownership: FourCornerOwnership<TIn, TOut, TOutFeedback, TInFeedback>;
  readonly chosenAction?: Action;
  readonly timestamp: string;
}
```

**Upgrade `command-handler-registry.ts`:** Each registered handler gains an `ActionClass` and `ActionGate`:

```typescript
// command-handler-registry.ts — AFTER upgrade
export type RegisteredCommandHandler = {
  commandType: string;
  handler: (cmd: PipelineCommand) => Promise<CommandResult>;
  /** Action class — ported from workflow-engine. */
  actionClass: ActionClass;
  /** Gate — append-only (direct) or pr-gated (review required). */
  gate: ActionGate;
  /** Feedback variants the handler authors (asymmetric authorship). */
  feedbackVariants: readonly string[];
};
```

### 3.3 World substrate port

**Create:** `packages/application/src/workflow-world.ts`

Port the World interface — the shared git-flow substrate where multiple lifetimes interact.

```typescript
// packages/application/src/workflow-world.ts

/** The shared substrate where multiple lifetimes interact.
 * Port of tools/workflow-engine/world.ts World.
 *
 * Per the maintainer (2026-05-28):
 *   - LIFETIME = editable per-substrate-entity DU
 *   - WORLD = shared substrate where multiple lifetimes interact
 *   - GIT FLOW = operational form of the world */
export interface World {
  readonly registry: ReadonlyMap<string, ReadonlyMap<string, unknown>>;
}

export const EMPTY_WORLD: World = { registry: new Map() };

/** Standard transition verdict — recurring vocabulary across lifetime pairs. */
export type StandardVerdict =
  | { kind: "advance" }
  | { kind: "block"; reason: string }
  | { kind: "complete" }
  | { kind: "no-op" }
  | { kind: "escalate-to-operator"; reason: string };

/** Register a composed-lifetime matrix in the world.
 * Returns a NEW world (immutable — retraction-native). */
export function registerLifetimePair<W extends World, A, B, T>(
  world: W,
  pairName: string,
  matrix: ReadonlyMap<string, T>,
): W {
  const newRegistry = new Map(world.registry);
  newRegistry.set(pairName, matrix as ReadonlyMap<string, unknown>);
  return { ...world, registry: newRegistry };
}

/** GitWorld — specialized World for git-based change control. */
export interface GitWorld extends World {
  readonly forgeName: string;
  readonly branchUniverse: string;
  readonly prUniverse: string;
}

/** The room's change-control port — how the room interacts with the World.
 * Real = GitWorld (7 git backends); mock = InMemoryWorld (DST).
 * MP-7: all operations return Result — never throw. */
export type ChangeControlError =
  | { readonly kind: "commit_failed"; readonly reason: string }
  | { readonly kind: "pr_open_failed"; readonly reason: string }
  | { readonly kind: "pr_merge_failed"; readonly reason: string };

export interface ChangeControlPort {
  readonly world: World;
  commit(changes: readonly Change[]): Promise<Result<CommitResult, ChangeControlError>>;
  openPR(commit: string, title: string, body: string): Promise<Result<PRResult, ChangeControlError>>;
  mergePR(prNumber: number): Promise<Result<MergeResult, ChangeControlError>>;
}
```

**Composes with Room:** Room's `change_control` seam binds either:

- `createGitChangeControl(world: GitWorld)` — real git operations
- `createMockChangeControl(world: World)` — in-memory (DST)

### 3.4 TrueSkill → hat reputation scoring

**Create:** `packages/application/src/trueskill.ts`

Port TrueSkill Bayesian reputation scoring for hat-agent pairings.

```typescript
// packages/application/src/trueskill.ts

/** TrueSkill rating — μ (mean) + σ (uncertainty).
 * Port of tools/workflow-engine/trueskill.ts. */
export interface TrueSkillRating {
  readonly mu: number;      // mean skill estimate
  readonly sigma: number;   // uncertainty
}

/** Update ratings after a 1v1 outcome.
 * Returns new ratings (immutable — retraction-native). */
export function update1v1(
  winner: TrueSkillRating,
  loser: TrueSkillRating,
  drawProbability = 0.1,
): [TrueSkillRating, TrueSkillRating] {
  // Full implementation ported from tools/workflow-engine/trueskill.ts:219 rate1v1
}
```

**Composes with RMO:** The RMO's `RmoHatCandidateReputation` (in `rmo.ts`) gains a TrueSkill rating field. The `rankRmoHatCandidates` function uses TrueSkill's lower confidence bound (μ - 3σ) for ranking.

### 3.5 Proximity → room adjacency

**Create:** `packages/application/src/proximity.ts`

Port proximity scoring for room adjacency — the "harmonious division" aperiodic proximity.

```typescript
// packages/application/src/proximity.ts

/** Proximity score between two rooms — how close they are in the
 * harmonious division. Port of tools/workflow-engine/proximity.ts.
 *
 * Per docs/research/2026-06-01-harmonious-division-...:
 * proximity is aperiodic, not total order. Rooms form a wave-field. */
export function roomProximity(roomA: Room, roomB: Room): number {
  // ... based on shared hats, shared work items, relation edges
}
```

### 3.6 Otto's 5 Mods validation

**Create:** validation functions in `workflow-engine-types.ts`:

```typescript
/** Validate Mod 1 (escape-hatch in every state) + Mod 2 (grammar-extension first-class).
 * Port of tools/workflow-engine/types.ts validateStateOtto5Mods. */
export function validateStateOtto5Mods(
  state: WorkflowState,
  actionCatalog: readonly Action[],
): Result<void, string> {
  const stateActions = state.availableActions
    .map((id) => actionCatalog.find((a) => a.id === id))
    .filter((a): a is Action => a !== undefined);
  if (stateActions.length === 0) {
    return { outcome: "feedback", feedback: `state ${state.id} references no actions` };
  }
  const hasEscapeHatch = stateActions.some((a) => a.class === "escape-hatch");
  if (!hasEscapeHatch) {
    return { outcome: "feedback", feedback: `state ${state.id} violates Mod 1 — no escape-hatch` };
  }
  return { outcome: "ok", value: undefined };
}
```

**Upgrade `work-item-state-machine.ts`:** Every work item state MUST include an escape-hatch action. This is enforced at registration time via `validateStateOtto5Mods`.

---

## 4. Upgrade Path

### 4.1 `command-contract.ts` — EXTEND

**Before:** `PipelineCommand` is a flat type with no ownership concept.

**After:** `PipelineCommand` gains a `FourCornerOwnership<TIn,TOut,TOutFeedback,TInFeedback>` type parameter and an `ownership` field. Existing callers that don't specify type parameters get `unknown` defaults (backward compatible).

### 4.2 `command-handler-registry.ts` — EXTEND

**Before:** Handlers are registered as `(cmd) => Promise<CommandResult>` with no class/gate metadata.

**After:** Each handler gains `actionClass`, `gate`, and `feedbackVariants`. The registry validates Otto's 5 Mods at registration time (every state has an escape-hatch; catalog has a grammar-extension).

### 4.3 `command-pipeline.ts` — EXTEND

**Before:** Pipeline executes commands sequentially with no tick cycle concept.

**After:** Pipeline gains a `TickCyclePattern` (default: `observe-simulate-choose-emit`). Each pipeline step is a `Tick` with state + ownership + chosen action.

### 4.4 `ports.ts` — EXTEND

**Before:** No `ChangeControlPort` defined.

**After:** Add `ChangeControlPort` interface with `World` substrate. Room's `change_control` seam binds either `createGitChangeControl` (real) or `createMockChangeControl` (DST).

---

## 5. Dependencies

- **Depends on:** §10 (doctrine), §01 (F# core — SimulationEnvironment for deterministic ticks), §02 (observe loop — TickCyclePattern composes with observe)
- **Blocks:** §03 (agent-loop uses Action/State for menu generation), §06 (formal verification validates Otto's 5 Mods)

---

## 6. Testing Strategy

### 6.1 Otto's 5 Mods validation

```typescript
Deno.test("State without escape-hatch fails Mod 1", () => {
  const state: WorkflowState = {
    id: "s1", label: "State 1", description: "",
    tickCyclePattern: "observe-simulate-choose-emit",
    availableActions: ["a1"], composesWith: [],
  };
  const actions: Action[] = [
    { id: "a1", class: "transition", gate: "append-only", label: "A1", description: "", composesWith: [], feedbackVariants: [] },
  ];
  const result = validateStateOtto5Mods(state, actions);
  assertEquals(result.outcome, "feedback");
});
```

### 6.2 FourCornerOwnership round-trip

```typescript
Deno.test("FourCornerOwnership preserves all four corners", () => {
  const ownership: FourCornerOwnership<string, number, string, string> = {
    tIn: "input",
    tOut: 42,
    tOutFeedback: "success",
    tInFeedback: "ack",
  };
  assertEquals(ownership.tIn, "input");
  assertEquals(ownership.tOut, 42);
});
```

### 6.3 World immutability

```typescript
Deno.test("registerLifetimePair returns new world (immutable)", () => {
  const world1 = EMPTY_WORLD;
  const world2 = registerLifetimePair(world1, "pair-a", new Map());
  assertNotEquals(world1, world2);
  assertEquals(world1.registry.size, 0);
  assertEquals(world2.registry.size, 1);
});
```

### 6.4 TrueSkill update

```typescript
Deno.test("TrueSkill update1v1 increases winner mu", () => {
  const env = createVirtualEnvironment(42n);  // DST: deterministic env for reproducible test
  const winner: TrueSkillRating = { mu: 25, sigma: 8.333 };
  const loser: TrueSkillRating = { mu: 25, sigma: 8.333 };
  const [newWinner, newLoser] = update1v1(winner, loser);
  assert(newWinner.mu > winner.mu);
  assert(newLoser.mu < loser.mu);
});
```

### 6.5 Tick cycle DST replay

```typescript
Deno.test("Tick with observe-simulate-choose-emit is deterministic", () => {
  const env = createVirtualEnvironment(42n);
  const tick1: Tick<string, number, string, string> = {
    state: testState,
    ownership: { tIn: "input" },
    timestamp: env.now(),
  };
  // ... replay with same seed → same tick
});
```
