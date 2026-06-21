# Merge1 §02 — Observe Loop → Agentic-Org Migration

**Scope:** Port the observe→choose→execute loop from `tools/observe/` into the agentic-organization TypeScript codebase. This is the agent's single entrypoint — the pure observe() function, the command-vs-observation event split, the G-Set CRDT event sink, and the LLM chooser integration.

**Outside sources:**

- `tools/observe/observe.ts` — `World`, `NextAction` (9-variant DU), `observe()`, `buildMenu()`, `simulate()`, `fold()`, `replay()`, `runLoop()`, `observeWithLlm()`
- `tools/observe/execute.ts` — `EventSink`, `ExecuteResult`, `execute()`
- `tools/observe/do-item.ts` — `CommandExecutor`, `ActionObservation`, command-vs-observation split, `ExecutorTier`
- `tools/observe/load-world.ts` — `loadWorld()`, `readEventActions()`
- `tools/observe/event-sink-folder.ts` — folder-direct-to-main, ZetaId-keyed JSON, G-Set CRDT merge
- `tools/observe/backlog-reader.ts` — `pickupToAction`, `nextActionFromBacklog`

**Agentic-org files touched:**

- `packages/application/src/observe.ts` — our observe entrypoint (RunScope, RunLifecyclePhase)
- `packages/application/src/observe-for-hat.ts`
- `packages/application/src/observe-work-item.ts`
- `packages/application/src/model-backed-composer.ts`
- `packages/application/src/command-pipeline.ts`
- `packages/application/src/command-result.ts`
- `packages/domain/src/event-envelope.ts`
- NEW: `packages/application/src/observe-simulate.ts`
- NEW: `packages/application/src/observe-event-sink.ts`
- NEW: `packages/application/src/observe-do-item.ts`

**Governing doctrine:** §10 (MP-1 DST Replayability, MP-4 Retraction-Native, MP-5 Freedom-Always-In-Menu, MP-6 Asymmetric Authorship, MP-7 Result Over Exception, MP-8 Cross-Language Parity)

---

## 1. What's Solved Outside

| Type/Function | File:Line | What it does |
|---|---|---|
| `World` | `observe.ts` | Observable state: backlog items, operator channel, persisted mode |
| `NextAction` | `observe.ts` | 9-variant DU: do_item, decompose, free_time, self_reflect, explore, play, respond_to_operator, preserve_ferry, idle |
| `BacklogItem` | `observe.ts:66` | `{ id, title, ready, ambiguous, needsNewAction? }` |
| `OperatorChannel` | `observe.ts:113` | `{ pendingMessage, pendingFerry }` — the operator channel read-side |
| `OperatorOwnership` | `observe.ts:105` | `FourCornerOwnership<OperatorMessage, OperatorResponse, ConvFeedback, OperatorAck>` |
| `Mode` | `observe.ts` | Persisted mode: work, explore, play, self_reflect, free_time |
| `observe()` | `observe.ts` | Pure function: World + channels → menu of legal NextActions |
| `buildMenu()` | `observe.ts` | Build the action menu (freedom-always-in-menu: free modes always present) |
| `simulate()` | `observe.ts` | Pure reducer: `World → NextAction → World` |
| `fold()` | `observe.ts` | Left-fold over event log: `World → NextAction[] → World` |
| `replay()` | `observe.ts` | Returns trajectory: `World → NextAction[] → World[]` |
| `runLoop()` | `observe.ts` | End-to-end: choose → act → choose → act |
| `observeWithLlm()` | `observe.ts` | LLM chooser: observe() → model picks from menu → NextAction |
| `EventSink<E>` | `execute.ts` | Durability port: `append(event) → AppendOutcome` |
| `AppendOutcome` | `execute.ts` | `{ ok: true } \| { ok: false; reason }` — Result, never throws |
| `execute()` | `execute.ts` | Execute a chosen action: log it via EventSink, return ExecuteResult |
| `CommandExecutor` | `do-item.ts:75` | Injected bash surface: `{ tier, run(spec) → RunOutcome }` |
| `ExecutorTier` | `do-item.ts:61` | `"fake" \| "just-bash" \| "oci" \| "cloud-burst"` |
| `RunOutcome` | `do-item.ts:70` | `{ ok: true, stdout, exitCode: 0 } \| { ok: false, reason, exitCode, stderr }` |
| `ActionObservation` | `do-item.ts:87` | `Started \| Succeeded \| Failed` — observation events (NOT the command) |
| `foldObservations()` | `do-item.ts` | Fold observations (not commands) — replay cannot re-run work |
| `mintObserveEventIdHex()` | `event-sink-folder.ts:70` | Mint ZetaId-keyed event identity (Category.WorkItem) |
| folder-direct-to-main | `event-sink-folder.ts` | EventSink impl: ZetaId-named JSON files, commit direct to main, G-Set CRDT merge |
| `pickupToAction()` | `backlog-reader.ts` | Convert a backlog pickup into a NextAction |

---

## 2. What Exists in Agentic-Org Today

| TS Type | File:Line | What it does | Gap vs tools/observe |
|---|---|---|---|
| `RunScope` | `observe.ts:71` | 5 scopes: Run, WorkItem, Initiative, Project, Organization | No World equivalent; no backlog items |
| `RunLifecyclePhase` | `observe.ts:86` | 9 phases: Observing, Composing, AwaitingGate, Executing, ... | No NextAction DU; no free modes |
| `AvailableOption` | `observe.ts:101` | `{ actionType, toPhase, toScope, requiresGate, requiresEvidence, rationale }` | No freedom-always-in-menu; no Mode persistence |
| `RunSnapshot` | `observe.ts:121` | `{ runId, scope, phase, trace, hasGateApproval, hasEvidence }` | No World (backlog, operator channel, mode) |
| `ObserveResult` | `observe.ts:180` | `Readout \| Feedback` DU | Good — matches F# pattern |
| `DeterministicRule` | `observe.ts:189` | `{ name, veto(option, snapshot) → string \| undefined }` | No equivalent in tools/observe (our addition) |
| `ComposerSelection` | `observe.ts` | LLM composer selection | No observeWithLlm equivalent |
| `model-backed-composer.ts` | `model-backed-composer.ts` | Model-backed composer with ChatCompletionPort | No LLM chooser integrated with observe loop |
| `command-pipeline.ts` | `command-pipeline.ts` | Command execution pipeline | No command-vs-observation split |
| `event-envelope.ts` | `event-envelope.ts` | Event envelope (domain) | No ZetaId identity; no G-Set CRDT merge |

---

## 3. Migration Plan

### 3.1 World + NextAction port

**Create:** `packages/application/src/observe-simulate.ts`

Port the `World`, `NextAction`, `simulate()`, `fold()`, `replay()` — the pure algebraic core.

```typescript
// packages/application/src/observe-simulate.ts

/** The observable world — port of tools/observe/observe.ts World.
 * Contains backlog items, operator channel state, and persisted mode. */
export interface World {
  readonly backlog: readonly BacklogItem[];
  readonly operator: OperatorChannel;
  readonly mode: Mode;
}

/** A backlog item — port of tools/observe/observe.ts BacklogItem. */
export interface BacklogItem {
  readonly id: string;
  readonly title: string;
  readonly ready: boolean;
  readonly ambiguous: boolean;
  readonly needsNewAction?: boolean;
}

/** The operator channel read-side. */
export interface OperatorChannel {
  readonly pendingMessage: boolean;
  readonly pendingFerry: boolean;
}

/** Persisted mode — freedom-always-in-menu.
 * A chosen free mode STAYS the agent's mode until it switches. */
export type Mode = "work" | "explore" | "play" | "self_reflect" | "free_time";

/** The 9-variant action DU — port of tools/observe/observe.ts NextAction.
 * Free modes (explore, play, self_reflect, free_time) are ALWAYS in the menu. */
export type NextAction =
  | { readonly kind: "do_item"; readonly item: BacklogItem }
  | { readonly kind: "decompose"; readonly item: BacklogItem }
  | { readonly kind: "free_time" }
  | { readonly kind: "self_reflect" }
  | { readonly kind: "explore" }
  | { readonly kind: "play" }
  | { readonly kind: "respond_to_operator"; readonly message: OperatorMessage }
  | { readonly kind: "preserve_ferry"; readonly ferry: OperatorMessage }
  | { readonly kind: "idle" };

/** Pure reducer: World → NextAction → World.
 * Port of tools/observe/observe.ts simulate. */
export function simulate(world: World, action: NextAction): World {
  switch (action.kind) {
    case "do_item":
      return { ...world, backlog: world.backlog.filter((i) => i.id !== action.item.id), mode: "work" };
    case "decompose":
      return { ...world, mode: "work" };
    case "free_time":
      return { ...world, mode: "free_time" };
    case "self_reflect":
      return { ...world, mode: "self_reflect" };
    case "explore":
      return { ...world, mode: "explore" };
    case "play":
      return { ...world, mode: "play" };
    case "respond_to_operator":
      return { ...world, operator: { ...world.operator, pendingMessage: false }, mode: "work" };
    case "preserve_ferry":
      return { ...world, operator: { ...world.operator, pendingFerry: false }, mode: "work" };
    case "idle":
      return world;
  }
}

/** Left-fold over event log. Port of tools/observe/observe.ts fold.
 * Law: fold(w0, [...a, ...b]) === fold(fold(w0, a), b) */
export function fold(world: World, actions: readonly NextAction[]): World {
  return actions.reduce(simulate, world);
}

/** Returns trajectory. Port of tools/observe/observe.ts replay. */
export function replay(world: World, actions: readonly NextAction[]): World[] {
  const trajectory: World[] = [world];
  let current = world;
  for (const action of actions) {
    current = simulate(current, action);
    trajectory.push(current);
  }
  return trajectory;
}
```

**Composes with Room:** The room's tick loop calls `observe(world)` → `simulate(world, chosenAction)` → log event → next tick. Same seed → same trace (DST).

### 3.2 Freedom-always-in-menu

**Upgrade `observe.ts`:** The existing `PHASE_OPTIONS` table gains free modes in EVERY phase:

```typescript
// observe.ts — AFTER upgrade
/** Free modes are ALWAYS in the menu, regardless of phase.
 * Port of tools/observe/observe.ts freedom-always-in-menu. */
const FREE_MODE_OPTIONS: readonly AvailableOption[] = [
  { actionType: "explore", toPhase: RunLifecyclePhase.Observing, toScope: RunScope.Run, requiresGate: false, requiresEvidence: false, rationale: "forward self-direction" },
  { actionType: "self_reflect", toPhase: RunLifecyclePhase.Observing, toScope: RunScope.Run, requiresGate: false, requiresEvidence: false, rationale: "self-reflection" },
  { actionType: "free_time", toPhase: RunLifecyclePhase.Observing, toScope: RunScope.Run, requiresGate: false, requiresEvidence: false, rationale: "rest" },
  { actionType: "play", toPhase: RunLifecyclePhase.Observing, toScope: RunScope.Run, requiresGate: false, requiresEvidence: false, rationale: "play" },
];

// Every phase's options = phase-specific options + FREE_MODE_OPTIONS
function optionsForPhase(phase: RunLifecyclePhase): readonly AvailableOption[] {
  return [...PHASE_OPTIONS[phase], ...FREE_MODE_OPTIONS];
}
```

### 3.3 Command-vs-observation split

**Create:** `packages/application/src/observe-do-item.ts`

Port the command-vs-observation event split — the critical invariant that replay cannot re-run work.

```typescript
// packages/application/src/observe-do-item.ts

/** Port of tools/observe/do-item.ts.
 * The command-vs-observation split:
 *   - do_item is a COMMAND (the chooser's pick) — NOT logged
 *   - Executing it emits OBSERVATION events — what actually happened — THOSE are logged
 *   - foldObservations replays observations, not commands — replay cannot re-run work */

export type ExecutorTier = "fake" | "just-bash" | "oci" | "cloud-burst";

export interface RunSpec {
  readonly script: string;
  readonly cwd?: string;
}

export type RunOutcome =
  | { readonly ok: true; readonly stdout: string; readonly exitCode: 0 }
  | { readonly ok: false; readonly reason: string; readonly exitCode: number; readonly stderr: string };

/** The injected bash surface. Fake in tests; oci/just-bash in prod. */
export interface CommandExecutor {
  readonly tier: ExecutorTier;
  run: (spec: RunSpec) => Promise<RunOutcome>;
}

export type ActionObservation =
  | { readonly kind: "ActionExecutionStarted"; readonly item: BacklogItem; readonly tier: ExecutorTier; readonly gated: boolean }
  | { readonly kind: "ActionExecutionSucceeded"; readonly item: BacklogItem }
  | { readonly kind: "ActionExecutionFailed"; readonly item: BacklogItem; readonly reason: string };

/** Fold observations (not commands). Succeeded delegates to simulate(do_item)
 * so the transition can't drift from the pure path. */
export function foldObservations(world: World, observations: readonly ActionObservation[]): World {
  let current = world;
  for (const obs of observations) {
    if (obs.kind === "ActionExecutionSucceeded") {
      current = simulate(current, { kind: "do_item", item: obs.item });
    }
    // Started and Failed don't change the world
  }
  return current;
}
```

**Upgrade `command-pipeline.ts`:** The pipeline gains the command-vs-observation split. Commands are not logged; observations are. This ensures DST replay never re-runs side effects.

### 3.4 Event sink with G-Set CRDT merge

**Create:** `packages/application/src/observe-event-sink.ts`

Port the folder-direct-to-main event sink with ZetaId-keyed JSON and G-Set CRDT merge.

```typescript
// packages/application/src/observe-event-sink.ts

/** Port of tools/observe/event-sink-folder.ts.
 * The EventSink writes events as ZetaId-named JSON files into a git folder
 * and commits direct to main. The ZetaId filename IS the id — re-appending
 * the same id is a no-op (G-Set CRDT property: set union is idempotent). */

export interface EventSink<E> {
  append(event: E): Promise<AppendOutcome>;
}

export type AppendOutcome =
  | { readonly ok: true; readonly eventId: string }
  | { readonly ok: false; readonly reason: string };

/** The event envelope — a fact ("at t, actor X recorded this action"). */
export interface EventEnvelope {
  readonly id: string;          // ZetaId — filename IS the id
  readonly at: string;          // ISO-8601
  readonly by: string;          // actor
  readonly action: NextAction;  // the recorded action
}

/** Folder-direct-to-main event sink.
 * Real = git commit to main; mock = in-memory array (DST).
 * MP-7: commit dep returns Result — never throws. */
export function createFolderEventSink(
  folder: string,
  deps: { mint: () => string; now: () => string; commit: (msg: string) => Promise<Result<void, string>> },
): EventSink<EventEnvelope> {
  return {
    append: async (event) => {
      // Write ZetaId-named JSON file, commit direct to main
      // G-Set CRDT: re-appending same id = no-op
      // Full implementation ported from tools/observe/event-sink-folder.ts:212 gitCommitToMain
    },
  };
}

export function createMockEventSink(): EventSink<EventEnvelope> & { events: readonly EventEnvelope[] } {
  const events: EventEnvelope[] = [];
  return {
    events,
    append: async (event) => {
      if (events.some((e) => e.id === event.id)) {
        return { ok: true, eventId: event.id }; // G-Set idempotent
      }
      events.push(event);
      return { ok: true, eventId: event.id };
    },
  };
}
```

**Upgrade `event-envelope.ts`:** The domain event envelope gains ZetaId identity and G-Set CRDT merge semantics. Re-appending the same ZetaId is a no-op.

### 3.5 LLM chooser integration

**Upgrade `model-backed-composer.ts`:** Port `observeWithLlm()` — the LLM chooser that observes the world, builds the menu, and asks the model to pick.

```typescript
// model-backed-composer.ts — AFTER upgrade

/** Port of tools/observe/observe.ts observeWithLlm.
 * The LLM is only ever shown the LEGAL options (the menu). Whatever it
 * returns is re-checked against that set. An unparseable or illegal
 * response falls back to the deterministic composer. */
export async function observeWithLlm(
  world: World,
  menu: readonly NextAction[],
  chatPort: ChatCompletionPort,
): Promise<Result<NextAction, ComposerFeedback>> {
  const prompt = buildMenuPrompt(menu);
  const response = await chatPort.complete({ system: MENU_SYSTEM_PROMPT, user: prompt, format: "json" });
  const parsed = parseChoice(response, menu);
  if (parsed.outcome === "ok") {
    return { outcome: "ok", value: parsed.value };
  }
  // Fallback to deterministic composer
  return { outcome: "feedback", feedback: parsed.feedback };
}
```

---

## 4. Upgrade Path

### 4.1 `observe.ts` — EXTEND

**Before:** `observe()` returns a `RunStateReadout` with phase-based options. No World, no free modes, no simulate/fold/replay.

**After:** `observe()` gains a `World` parameter and returns options that include free modes. `simulate()`, `fold()`, `replay()` are added as pure functions. The existing `RunLifecyclePhase` and `DeterministicRule` remain — they compose with the new World.

### 4.2 `command-pipeline.ts` — EXTEND

**Before:** Pipeline executes commands and logs them directly.

**After:** Pipeline gains the command-vs-observation split. Commands are not logged; observations are. `foldObservations()` replays observations, not commands.

### 4.3 `model-backed-composer.ts` — EXTEND

**Before:** Composer receives a readout and selects from legal options.

**After:** Composer gains `observeWithLlm()` which takes a `World` + menu, asks the LLM, and re-checks the response against the legal set.

### 4.4 `event-envelope.ts` — EXTEND

**Before:** Event envelope with no ZetaId identity, no G-Set merge.

**After:** Event envelope gains ZetaId identity (filename IS the id). G-Set CRDT merge: re-appending same id = no-op.

---

## 5. Dependencies

- **Depends on:** §10 (doctrine), §01 (F# core — SimulationEnvironment for deterministic observe)
- **Blocks:** §03 (agent-loop uses observe for menu generation), §05 (workflow engine TickCyclePattern composes with observe)

---

## 6. Testing Strategy

### 6.1 DST replay (fold === execute)

```typescript
Deno.test("fold(initial, actions) === executed state", () => {
  const w0: World = { backlog: [item1, item2], operator: { pendingMessage: false, pendingFerry: false }, mode: "work" };
  const actions: NextAction[] = [
    { kind: "do_item", item: item1 },
    { kind: "explore" },
  ];
  const folded = fold(w0, actions);
  const executed = actions.reduce(simulate, w0);
  assertEquals(folded, executed);
});
```

### 6.2 Monoid law

```typescript
Deno.test("fold monoid law: fold(w0, [...a, ...b]) === fold(fold(w0, a), b)", () => {
  const w0 = testWorld();
  const a: NextAction[] = [{ kind: "explore" }];
  const b: NextAction[] = [{ kind: "self_reflect" }];
  assertEquals(fold(w0, [...a, ...b]), fold(fold(w0, a), b));
});
```

### 6.3 Freedom-always-in-menu

```typescript
Deno.test("Free modes are always in the menu", () => {
  const menu = buildMenu(worldWithBacklog);
  assert(menu.some((a) => a.kind === "explore"));
  assert(menu.some((a) => a.kind === "self_reflect"));
  assert(menu.some((a) => a.kind === "free_time"));
  assert(menu.some((a) => a.kind === "play"));
});
```

### 6.4 Command-vs-observation replay

```typescript
Deno.test("foldObservations does not re-run commands", () => {
  const observations: ActionObservation[] = [
    { kind: "ActionExecutionStarted", item: item1, tier: "fake", gated: false },
    { kind: "ActionExecutionSucceeded", item: item1 },
  ];
  const folded = foldObservations(w0, observations);
  assertEquals(folded.backlog.length, w0.backlog.length - 1); // item1 removed
  // No side effect re-executed
});
```

### 6.5 G-Set CRDT idempotency

```typescript
Deno.test("Re-appending same event id is a no-op (G-Set)", async () => {
  const sink = createMockEventSink();
  const event: EventEnvelope = { id: "zeta-1", at: "2026-01-01T00:00:00Z", by: "otto", action: { kind: "explore" } };
  await sink.append(event);
  await sink.append(event); // same id
  assertEquals(sink.events.length, 1);
});
```

### 6.6 Cross-language golden vectors

`simulate(world, action)` must produce identical output in TS and F#. Use `tools/observe/golden-vectors.ts` as the canonical fixture set.
