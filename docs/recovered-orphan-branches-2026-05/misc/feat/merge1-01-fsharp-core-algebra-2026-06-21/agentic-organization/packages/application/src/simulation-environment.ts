/**
 * SimulationEnvironment — the minimal side-effect surface every room obtains
 * its observable effects through. Port of `src/Core/Environment.fs`
 * (`ISimulationEnvironment`, `SystemEnvironment`, `VirtualEnvironment`).
 *
 * Merge1 §01 (F# Core Algebra). Governing doctrine: §10 MP-1 (DST replayability:
 * same seed → same trace), MP-2 (seam injectability: real vs virtual at the same
 * boundary). No room code calls `Date.now()`, `Math.random()`, `crypto.*`, or
 * `setTimeout` directly — it goes through this interface so simulations replay
 * bit-identically.
 *
 * `Clock` and `IdGenerator` in ports.ts become projections of this environment
 * (see `clockFromEnv` / `idGeneratorFromEnv`).
 */

/** 64-bit unsigned mask for splitmix64 arithmetic. */
const U64_MASK = 0xffffffffffffffffn;

/**
 * Minimal side-effect surface for deterministic simulation. Port of
 * `ISimulationEnvironment` (Environment.fs). System envs return wall-clock /
 * crypto-random; virtual envs return a scheduler clock and a seeded RNG.
 */
export interface SimulationEnvironment {
  /** Current logical time (ISO-8601). */
  readonly now: () => string;
  /** Monotonically-increasing tick counter. */
  readonly ticks: () => number;
  /** Next integer from the environment's RNG (full 64-bit). */
  readonly nextInt64: () => bigint;
  /** Fresh ID. Virtual envs emit sequential/seeded; system env uses crypto-random. */
  readonly newGuid: () => string;
  /** Wait `timeoutMs`. Virtual envs fast-forward virtual time; system envs actually wait. */
  readonly delay: (timeoutMs: number) => Promise<void>;
}

/** A virtual environment additionally exposes explicit clock control for tests. */
export interface ControllableSimulationEnvironment extends SimulationEnvironment {
  /** Advance the virtual clock by `deltaMs` without drawing a tick. */
  readonly advanceTime: (deltaMs: number) => void;
  /** Set the virtual clock to an absolute instant (ms since epoch). */
  readonly setTime: (instantMs: number) => void;
}

/**
 * Production environment backed by the actual OS clock and crypto RNG. Port of
 * `SystemEnvironment` (Environment.fs). Stateless apart from the tick baseline.
 */
export function createSystemEnvironment(): SimulationEnvironment {
  return {
    now: () => new Date().toISOString(),
    ticks: () => Date.now(),
    nextInt64: () => {
      const buf = new BigUint64Array(1);
      crypto.getRandomValues(buf);
      return buf[0] ?? 0n;
    },
    newGuid: () => crypto.randomUUID(),
    delay: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  };
}

/**
 * One splitmix64 step over a mutable state cell. Identical algorithm to the F#
 * `VirtualEnvironment` RNG (Environment.fs:58) so cross-language golden vectors
 * (MP-8) match. Returns the next value and the advanced state.
 */
export function splitMix64(state: bigint): { value: bigint; next: bigint } {
  const next = (state + 0x9e3779b97f4a7c15n) & U64_MASK;
  let z = next;
  z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & U64_MASK;
  z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & U64_MASK;
  return { value: (z ^ (z >> 31n)) & U64_MASK, next };
}

/**
 * Deterministic environment for simulation and tests. Port of
 * `VirtualEnvironment` (Environment.fs): seeded splitmix64 RNG, counter+seed
 * GUIDs, and a `delay` that advances virtual time and resolves immediately —
 * no wall-clock waiting. Same `(seed, baseTimeMs, stepMs)` → bit-identical trace.
 */
export function createVirtualEnvironment(
  seed: bigint,
  baseTimeMs = 0,
  stepMs = 1,
): ControllableSimulationEnvironment {
  let baseMs = baseTimeMs;
  let tickCount = 0;
  let rngState = seed & U64_MASK;
  let guidCounter = 0n;

  return {
    now: () => new Date(baseMs + tickCount++ * stepMs).toISOString(),
    ticks: () => tickCount,
    nextInt64: () => {
      const { value, next } = splitMix64(rngState);
      rngState = next;
      return value;
    },
    newGuid: () => {
      guidCounter++;
      return `${guidCounter.toString(16).padStart(16, "0")}-${(seed & U64_MASK).toString(16).padStart(16, "0")}`;
    },
    delay: (ms) => {
      baseMs += ms;
      return Promise.resolve();
    },
    advanceTime: (deltaMs) => {
      baseMs += deltaMs;
    },
    setTime: (instantMs) => {
      baseMs = instantMs;
    },
  };
}
