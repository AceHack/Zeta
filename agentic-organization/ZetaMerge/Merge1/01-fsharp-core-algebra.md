# Merge1 §01 — F# Core Algebra → TypeScript Migration

**Scope:** Port the F# algebraic substrate from `src/Core/` and `src/Core.FSharp.*/` into the agentic-organization TypeScript codebase. This is the deepest layer — the deterministic simulation environment, operator algebra, checkpoint/durability, ZetaId, identity, and tracing primitives that underpin the Room abstraction.

**Outside sources:**

- `src/Core/Environment.fs` — `ISimulationEnvironment`, `SystemEnvironment`, `VirtualEnvironment`
- `src/Core/ChaosEnv.fs` — `ChaosPolicy`, `ChaosEnvironment` (fault injection for DST)
- `src/Core/PluginApi.fs` — `IOperator<'TOut>`, `IStrictOperator`, `OutputBuffer<'TOut>`
- `src/Core/Circuit.fs` — `Op` base class, `StepAsync`, `AfterStepAsync`, `Fixedpoint`
- `src/Core/Checkpoint.fs` — `ICheckpointable`, `ICheckpointStore`, `FileCheckpointStore`
- `src/Core/Durability.fs` — `DurabilityMode`, backing stores
- `src/Core.FSharp.Observe/Types.fs` — `World`, `NextAction`
- `src/Core.FSharp.Observe/Observe.fs` — `simulate`, `fold`, `replay`
- `src/Core.FSharp.Observe/EventLog.fs` — `EventLog` monoid
- `src/Core.FSharp.ZetaId/Types.fs` — `ZetaObservation`, `Category`, `Authority`, `Persona`
- `src/Core/Maji.fs` — `IdentitySubstrate`, `IdentityTuple`, `MessiahFunction`
- `src/Core/Tracing.fs` — `Traced.Arrow<'A,'B>`, Kleisli composition

**Agentic-org files touched:**

- `packages/application/src/room.ts` — extend Room with simulation environment
- `packages/application/src/ports.ts` — extend Clock/IdGenerator with full ISimulationEnvironment
- `packages/application/src/observe.ts` — wire fold/replay monoid laws
- `packages/domain/src/hat-binding.ts` — wire ZetaId identity
- `packages/domain/src/hat-definition.ts` — wire Maji identity tuple
- NEW: `packages/application/src/simulation-environment.ts`
- NEW: `packages/application/src/operator-algebra.ts`
- NEW: `packages/application/src/checkpoint.ts`
- NEW: `packages/application/src/durability.ts`

**Governing doctrine:** §10 (MP-1 DST Replayability, MP-2 Seam Injectability, MP-3 ZetaId Addressability, MP-7 Result Over Exception, MP-8 Cross-Language Parity)

---

## 1. What's Solved Outside

| F# Type/Interface | File:Line | What it does |
|---|---|---|
| `ISimulationEnvironment` | `Environment.fs:15` | Minimal side-effect surface: `UtcNow()`, `Ticks()`, `NextInt64()`, `NewGuid()`, `Delay()` |
| `SystemEnvironment` | `Environment.fs:36` | Production OS-backed implementation (wall clock, `Random.Shared`, `Guid.NewGuid()`) |
| `VirtualEnvironment` | `Environment.fs:53` | Deterministic test harness: seeded splitmix64 RNG, counter-based GUIDs, instant `Delay()` |
| `ChaosPolicy` | `ChaosEnv.fs:11` | Flags enum: `DelayJitter \| ClockSkew \| RngStall \| TimeReversal` |
| `ChaosEnvironment` | `ChaosEnv.fs:29` | FDB-style fault injection over `ISimulationEnvironment`; same (seed, policy) → same chaos |
| `IOperator<'TOut>` | `PluginApi.fs:52` | Plugin contract: `Name`, `ReadDependencies`, `StepAsync(output, ct)` |
| `IStrictOperator<'TOut>` | `PluginApi.fs:75` | Feedback-cut: `StepAsync` publishes delayed output; `AfterStepAsync` captures current input. This IS the room boundary (`z⁻¹`). |
| `OutputBuffer<'TOut>` | `PluginApi.fs:27` | Write-only output channel: `Publish(value)` exactly once per tick |
| `Op` / `Op<'T>` | `Circuit.fs:11` | Base class: `StepAsync`, `AfterStepAsync`, `ClockStart`/`ClockEnd`, `Fixedpoint`, algebra tags |
| `ICheckpointable` | `Checkpoint.fs:47` | `SaveState(writer)`, `LoadState(reader)`, `StateVersion` |
| `ICheckpointStore` | `Checkpoint.fs:55` | `SaveCheckpointAsync(circuitId, tick, states)`, `LoadCheckpointAsync(circuitId)` |
| `FileCheckpointStore` | `Checkpoint.fs:77` | TOCTOU-safe file persistence (atomic-rename pattern) |
| `DurabilityMode` | `Durability.fs:24` | `StableStorage \| OsBuffered \| InMemoryOnly \| WitnessDurable` |
| `World` | `Core.FSharp.Observe/Types.fs:34` | Observable state snapshot |
| `NextAction` | `Core.FSharp.Observe/Types.fs:42` | 9-variant action DU |
| `simulate` | `Core.FSharp.Observe/Observe.fs` | `World → NextAction → World` (pure reducer) |
| `fold` | `Core.FSharp.Observe/Observe.fs` | Left-fold over event log |
| `replay` | `Core.FSharp.Observe/Observe.fs` | Returns trajectory `World[]` |
| `EventLog` | `Core.FSharp.Observe/EventLog.fs:26` | Monoid: `Zero` + `(+)` + `FoldOnto`. Law: `(a+b).FoldOnto w0 = b.FoldOnto(a.FoldOnto w0)` |
| `ZetaObservation` | `Core.FSharp.ZetaId/Types.fs:179` | 128-bit ID: Version, Timestamp, Category, Authority, Persona, Momentum, Location |
| `Category` | `Core.FSharp.ZetaId/Types.fs:23` | `Observation \| Emission \| Workflow \| Heartbeat \| Batch \| FrictionTelemetry \| Bus \| Spawn \| WorkItem` |
| `Authority` | `Core.FSharp.ZetaId/Types.fs:87` | `HumanVerified \| TrustedAgent \| Standard \| BestEffort \| Simulated \| Raw` |
| `IdentitySubstrate` | `Maji.fs:19` | Single load-bearing identity item |
| `IdentityTuple` | `Maji.fs:35` | Canonical identity pattern (values/goals/roles/policies/memory/corrections/cross-refs/provenance) |
| `MessiahFunction` | `Maji.fs` | Identity-lift that preserves projection across boundaries |
| `Traced.Arrow<'A,'B>` | `Tracing.fs:105` | Kleisli arrow: `ActivityContext → 'A → Task<'B>` |
| `Traced.compose` | `Tracing.fs:107` | Kleisli composition for context propagation |

---

## 2. What Exists in Agentic-Org Today

| TS Type | File:Line | What it does | Gap vs F# |
|---|---|---|---|
| `Clock` | `ports.ts:20` | `{ now: () => string }` | Missing `ticks()`, `nextInt64()`, `newGuid()`, `delay()` — only `now()` |
| `IdGenerator` | `ports.ts:24` | `{ createId(prefix) => string }` | Missing RNG seed control; sequential only |
| `Room` | `room.ts:111` | Room container with `clock`, `ids`, `seams`, `hatIds`, `budget` | No `ISimulationEnvironment` equivalent; no checkpoint; no durability mode |
| `SeamMode` | `room.ts:25` | `"real" \| "mock"` | Maps to `SystemEnvironment` vs `VirtualEnvironment` but not typed as such |
| `createDeterministicRoom` | `room.ts:165` | All-mock room factory | Missing chaos injection; missing checkpoint save/restore |
| `RoomBudget` | `room.ts:56` | `{ maxSteps, maxWallClockMs? }` | No durability mode selector |
| `AgentIdentity` | `room.ts:67` | `{ agentId, subject }` | Missing ZetaId Category/Authority/Persona fields |
| `ZetaIdDecimal` | `observe.ts:61` | Branded decimal string | No pack/unpack codec; no Category/Authority/Persona metadata |
| `RunSnapshot` | `observe.ts:121` | Run state snapshot | No fold/replay monoid law enforcement |
| `ObserveResult` | `observe.ts:180` | `Readout \| Feedback` DU | Good — matches F# pattern |
| `HatDefinition` | `hat-definition.ts:96` | Hat with skills, authority, supervises DAG, throttles | Missing `IdentityTuple` from Maji; missing ZetaId Persona field |

---

## 3. Migration Plan

> **Result discipline (MP-7):** All async functions that can fail return `Result<T, E>` — never throw. The `Result` type is `{ outcome: "ok"; value: T } | { outcome: "feedback"; feedback: E }`. This applies to checkpoint, transport, credential, and change-control operations below. Pure functions (simulate, fold, transition) do not return Result — they are total.

### 3.1 SimulationEnvironment port

**Create:** `packages/application/src/simulation-environment.ts`

Port `ISimulationEnvironment` from F# to a TS interface. This supersedes the current `Clock` + `IdGenerator` split — they become projections of the simulation environment.

```typescript
// packages/application/src/simulation-environment.ts

/** Minimal side-effect surface for deterministic simulation.
 * Port of src/Core/Environment.fs ISimulationEnvironment.
 * Every room obtains side effects through this interface.
 * Same seed → same trace (DST). */
export interface SimulationEnvironment {
  /** Current logical time (ISO-8601). SystemEnv returns wall-clock; VirtualEnv returns scheduler clock. */
  readonly now: () => string;
  /** Monotonically-increasing tick counter. */
  readonly ticks: () => number;
  /** Next integer from the environment's RNG. */
  readonly nextInt64: () => bigint;
  /** Fresh deterministic ID. Virtual envs emit sequential; system env uses crypto-random. */
  readonly newGuid: () => string;
  /** Wait `timeoutMs`. Virtual envs fast-forward; system envs actually wait. */
  readonly delay: (timeoutMs: number) => Promise<void>;
}

/** Production environment backed by the actual OS. */
export function createSystemEnvironment(): SimulationEnvironment {
  return {
    now: () => new Date().toISOString(),
    ticks: () => Date.now(),
    nextInt64: () => {
      const buf = new BigUint64Array(1);
      crypto.getRandomValues(buf);
      return buf[0];
    },
    newGuid: () => crypto.randomUUID(),
    delay: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  };
}

/** Deterministic environment for simulation and tests.
 * Port of VirtualEnvironment — seeded splitmix64 RNG, counter-based GUIDs, instant delay. */
export function createVirtualEnvironment(seed: bigint, baseTimeMs = 0, stepMs = 1): SimulationEnvironment & {
  advanceTime: (deltaMs: number) => void;
  setTime: (instantMs: number) => void;
} {
  let now = baseTimeMs;
  let tickCount = 0;
  let rngState = seed;
  let guidCounter = 0n;

  const splitMix64 = (): bigint => {
    rngState = (rngState + 0x9E3779B97F4A7C15n) & 0xFFFFFFFFFFFFFFFFn;
    let z = rngState;
    z = ((z ^ (z >> 30n)) * 0xBF58476D1CE4E5B9n) & 0xFFFFFFFFFFFFFFFFn;
    z = ((z ^ (z >> 27n)) * 0x94D049BB133111EBn) & 0xFFFFFFFFFFFFFFFFn;
    return z ^ (z >> 31n);
  };

  return {
    now: () => new Date(now + tickCount++ * stepMs).toISOString(),
    ticks: () => tickCount,
    nextInt64: splitMix64,
    newGuid: () => {
      guidCounter++;
      return `${guidCounter.toString(16).padStart(16, "0")}-${seed.toString(16).padStart(16, "0")}`;
    },
    delay: (ms) => { now += ms; return Promise.resolve(); },
    advanceTime: (deltaMs) => { now += deltaMs; },
    setTime: (instantMs) => { now = instantMs; },
  };
}
```

**Upgrade `ports.ts`:** `Clock` and `IdGenerator` become projections of `SimulationEnvironment`:

```typescript
// ports.ts — AFTER upgrade
export type Clock = { now: () => string };
export type IdGenerator = { createId: (prefix: string) => string };

/** Project a Clock from a SimulationEnvironment. */
export function clockFromEnv(env: SimulationEnvironment): Clock {
  return { now: env.now };
}

/** Project an IdGenerator from a SimulationEnvironment. */
export function idGeneratorFromEnv(env: SimulationEnvironment): IdGenerator {
  const counters = new Map<string, number>();
  return {
    createId: (prefix: string) => {
      const next = (counters.get(prefix) ?? 0) + 1;
      counters.set(prefix, next);
      return `${prefix}-${String(next).padStart(3, "0")}`;
    },
  };
}
```

**Upgrade `room.ts`:** Room gains an optional `env: SimulationEnvironment` field. When present, `clock` and `ids` are projected from it. When absent, the current `createDeterministicRoom` inline implementation is used (backward compatible).

```typescript
// room.ts — AFTER upgrade
export type Room = {
  roomId: string;
  seamMode: SeamMode;
  /** Full simulation environment (supersedes clock+ids when present). */
  env?: SimulationEnvironment;
  clock: Clock;
  ids: IdGenerator;
  seams: readonly RoomSeamBinding[];
  hatIds: readonly string[];
  communicationStrategy: CommunicationStrategy;
  budget: RoomBudget;
  durabilityMode?: DurabilityMode;
  identity?: AgentIdentity;
  sandbox: SandboxSpec;
  credentialProxy: CredentialProxyPort;
};
```

### 3.2 ChaosEnvironment port

**Create:** `packages/application/src/chaos-environment.ts`

Port `ChaosEnvironment` for fault-injection testing in rooms.

```typescript
export type ChaosPolicy = "none" | "delay_jitter" | "clock_skew" | "rng_stall" | "time_reversal";

export function createChaosEnvironment(
  seed: bigint,
  policy: ChaosPolicy | ChaosPolicy[],
  opts: { delayMultiplier?: number; clockSkewMs?: number; baseTimeMs?: number } = {},
): SimulationEnvironment {
  // ... wraps createVirtualEnvironment with fault injection
  // Same (seed, policy) → same chaos trace (DST)
}
```

**Composes with Room:** A room can bind `env: createChaosEnvironment(seed, ["delay_jitter", "clock_skew"])` to test fault tolerance deterministically.

### 3.3 Operator algebra port (IStrictOperator = room boundary)

**Create:** `packages/application/src/operator-algebra.ts`

Port `IOperator` and `IStrictOperator` — the room tick boundary.

```typescript
/** Plugin-operator contract. Port of src/Core/PluginApi.fs IOperator<'TOut>. */
export interface Operator<TOut> {
  readonly name: string;
  readonly readDependencies: readonly string[];
  stepAsync(output: OutputBuffer<TOut>): Promise<void>;
}

/** Write-only output channel. Publish exactly once per tick. */
export interface OutputBuffer<TOut> {
  publish(value: TOut): void;
}

/** Strict operator (feedback-cut). StepAsync publishes delayed output;
 * AfterStepAsync captures current input for next tick. This IS the room
 * boundary — the z⁻¹ unit delay that separates room ticks.
 * Port of src/Core/PluginApi.fs IStrictOperator<'TOut>. */
export interface StrictOperator<TOut> extends Operator<TOut> {
  afterStepAsync(): Promise<void>;
}
```

**Composes with Room:** A room's tick loop is: `stepAsync()` (observe/execute) → `afterStepAsync()` (commit). The `createDeterministicRoom` factory implicitly implements this; making it explicit lets room operators compose algebraically.

### 3.4 Checkpoint port

**Create:** `packages/application/src/checkpoint.ts`

Port `ICheckpointable` and `ICheckpointStore` for room state save/restore.

```typescript
export interface CheckpointReader {
  readInt32(): number;
  readInt64(): bigint;
  readFloat(): number;
  readBool(): boolean;
  readBytes(): Uint8Array;
  readString(): string;
}

export interface CheckpointWriter {
  writeInt32(v: number): void;
  writeInt64(v: bigint): void;
  writeFloat(v: number): void;
  writeBool(v: boolean): void;
  writeBytes(v: Uint8Array): void;
  writeString(v: string): void;
}

export interface Checkpointable {
  saveState(writer: CheckpointWriter): void;
  loadState(reader: CheckpointReader): void;
  readonly stateVersion: number;
}

export type CheckpointError =
  | { readonly kind: "write_failed"; readonly reason: string }
  | { readonly kind: "read_failed"; readonly reason: string }
  | { readonly kind: "version_mismatch"; readonly expected: number; readonly actual: number };

export interface CheckpointStore {
  saveCheckpoint(roomId: string, tick: number, states: readonly [number, Checkpointable][]): Promise<Result<void, CheckpointError>>;
  loadCheckpoint(roomId: string): Promise<Result<{ tick: number; states: readonly [number, CheckpointReader][] } | undefined, CheckpointError>>;
}
```

**Composes with Room:** A room can optionally implement `Checkpointable` to save/restore state at tick boundaries, enabling DST replay from checkpoint.

### 3.5 Durability mode port

**Create:** `packages/application/src/durability.ts`

```typescript
export type DurabilityMode = "stable_storage" | "os_buffered" | "in_memory_only" | "witness_durable";
```

**Composes with Room:** `Room.durabilityMode` selects the persistence promise. `in_memory_only` for ephemeral test rooms; `stable_storage` for production rooms.

### 3.6 ZetaId metadata port

**Extend:** `packages/application/src/observe.ts` — add full ZetaId pack/unpack with Category/Authority/Persona.

The current `ZetaIdDecimal` is a branded string with no metadata. Port the F# `ZetaObservation` fields:

```typescript
export type ZetaCategory =
  | "observation" | "emission" | "workflow" | "heartbeat"
  | "batch" | "friction_telemetry" | "bus" | "spawn" | "work_item";

export type ZetaAuthority =
  | "human_verified" | "trusted_agent" | "standard"
  | "best_effort" | "simulated" | "raw";

export type ZetaPersona = "human_maintainer" | "firefly_coherence";

export type ZetaObservation = {
  version: 1;
  timestamp: number;       // 48-bit ms
  category: ZetaCategory;
  authority: ZetaAuthority;
  persona: ZetaPersona;
  momentum: number;        // 8-bit
  location: string;        // location hint
};
```

**Upgrade `AgentIdentity`** in `room.ts` to carry ZetaId metadata:

```typescript
export type AgentIdentity = {
  agentId: string;
  subject: string;
  /** ZetaId metadata — ported from src/Core.FSharp.ZetaId/Types.fs. */
  zetaId?: {
    category: ZetaCategory;
    authority: ZetaAuthority;
    persona: ZetaPersona;
  };
};
```

### 3.7 Maji identity tuple port

**Extend:** `packages/domain/src/hat-definition.ts` — add `IdentityTuple` from Maji.

```typescript
export type IdentityTuple = {
  values: readonly string[];
  goals: readonly string[];
  roles: readonly string[];
  policies: readonly string[];
  memory: readonly string[];
  corrections: readonly string[];
  crossRefs: readonly string[];
  provenance: readonly string[];
};

// HatDefinition gains:
export type HatDefinition = {
  // ... existing fields ...
  /** Identity tuple — ported from src/Core/Maji.fs IdentityTuple.
   * Preserves projection across room boundaries (MessiahFunction). */
  identityTuple?: IdentityTuple;
};
```

### 3.8 Tracing / Kleisli arrow port

**Create:** `packages/application/src/kleisli-trace.ts`

```typescript
/** Kleisli arrow for trace-context threading.
 * Port of src/Core/Tracing.fs Traced.Arrow<'A,'B>. */
export type KleisliArrow<A, B> = (ctx: TraceContext, a: A) => Promise<B>;

export type TraceContext = {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
};

export function composeKleisli<A, B, C>(
  f: KleisliArrow<A, B>,
  g: KleisliArrow<B, C>,
): KleisliArrow<A, C> {
  return (ctx, a) => f(ctx, a).then((b) => g(ctx, b));
}
```

**Composes with Room:** Room operations thread `TraceContext` across async boundaries via Kleisli composition.

---

## 4. Upgrade Path

### 4.1 `ports.ts` — EXTEND (not replace)

**Before:** `Clock` and `IdGenerator` are standalone interfaces with no RNG seed control.

**After:** They remain as-is (backward compat) but gain `clockFromEnv()` and `idGeneratorFromEnv()` projection functions. New code uses `SimulationEnvironment` directly; old code keeps working.

### 4.2 `room.ts` — EXTEND

**Before:** Room has `clock: Clock` and `ids: IdGenerator` as flat fields.

**After:** Room gains optional `env?: SimulationEnvironment` and `durabilityMode?: DurabilityMode`. When `env` is present, `clock` and `ids` are projected from it. `createDeterministicRoom` now creates a `VirtualEnvironment` internally and projects from it (same behavior, cleaner architecture).

```typescript
// room.ts — createDeterministicRoom AFTER
export function createDeterministicRoom(input: CreateDeterministicRoomInput): Room {
  const env = createVirtualEnvironment(
    BigInt(input.seed ?? 0),
    input.baseTimeMs ?? 0,
    input.stepMs ?? 1,
  );
  return {
    roomId: input.roomId,
    seamMode: "mock",
    env,
    clock: clockFromEnv(env),
    ids: idGeneratorFromEnv(env),
    // ... rest unchanged
  };
}
```

### 4.3 `observe.ts` — EXTEND

**Before:** `ZetaIdDecimal` is a branded string with no metadata.

**After:** Add `ZetaObservation` type and pack/unpack functions. `ZetaIdDecimal` remains as the index form; `ZetaObservation` is the metadata form. The fold/replay functions gain monoid law assertions in tests.

### 4.4 `hat-definition.ts` — EXTEND

**Before:** `HatDefinition` has no identity tuple.

**After:** Add optional `identityTuple?: IdentityTuple` field. Existing hats without it work unchanged.

---

## 5. Dependencies

- **Depends on:** §10 (doctrine — must comply with MP-1 through MP-8)
- **Blocks:** §02 (observe loop needs SimulationEnvironment), §03 (agent-loop needs checkpoint), §07 (hat-system needs ZetaId metadata), §08 (identity stack needs ZetaId Authority/Persona)

---

## 6. Testing Strategy

### 6.1 DST replay test

```typescript
// test/simulation-environment.test.ts
Deno.test("VirtualEnvironment is deterministic", () => {
  const env1 = createVirtualEnvironment(42n);
  const env2 = createVirtualEnvironment(42n);
  for (let i = 0; i < 1000; i++) {
    assertEquals(env1.now(), env2.now());
    assertEquals(env1.nextInt64(), env2.nextInt64());
    assertEquals(env1.newGuid(), env2.newGuid());
  }
});
```

### 6.2 Chaos determinism test

```typescript
Deno.test("ChaosEnvironment same seed+policy → same trace", () => {
  const env1 = createChaosEnvironment(42n, ["delay_jitter", "clock_skew"]);
  const env2 = createChaosEnvironment(42n, ["delay_jitter", "clock_skew"]);
  for (let i = 0; i < 100; i++) {
    assertEquals(env1.now(), env2.now());
  }
});
```

### 6.3 Cross-language golden vectors

`simulate(world, action)` must produce identical output in TS and F#. Use `tools/observe/golden-vectors.ts` as the canonical fixture set. Run `bun test golden-vectors` in CI.

### 6.4 Room checkpoint round-trip

```typescript
Deno.test("Room checkpoint save/restore round-trip", () => {
  const room = createDeterministicRoom({ roomId: "test", hatIds: ["hat-1"] });
  // ... step the room ...
  const store = createInMemoryCheckpointStore();
  await store.saveCheckpoint(room.roomId, 5, [[0, roomAsCheckpointable]]);
  const loaded = await store.loadCheckpoint(room.roomId);
  assertEquals(loaded?.tick, 5);
});
```

### 6.5 Monoid law test

```typescript
Deno.test("EventLog monoid law: (a+b).foldOnto(w0) === b.foldOnto(a.foldOnto(w0))", () => {
  const w0 = initialWorld();
  const a: NextAction[] = [/* ... */];
  const b: NextAction[] = [/* ... */];
  const left = fold(w0, [...a, ...b]);
  const right = fold(fold(w0, a), b);
  assertEquals(left, right);
});
```
