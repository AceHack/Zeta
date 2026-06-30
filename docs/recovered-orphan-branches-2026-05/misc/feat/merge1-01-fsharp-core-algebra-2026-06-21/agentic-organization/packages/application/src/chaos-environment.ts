/**
 * ChaosEnvironment — FoundationDB-style fault injection over a
 * SimulationEnvironment. Port of `src/Core/ChaosEnv.fs`
 * (`ChaosPolicy`, `ChaosEnvironment`).
 *
 * Merge1 §01 (F# Core Algebra). Governing doctrine: §10 MP-1 (DST: same
 * `(seed, policy)` → identical chaos trace). Policies are additive — combine
 * them to simulate messy production conditions (delay jitter, clock skew, RNG
 * stall, time reversal) without ever running real concurrent code. When a
 * property test fails, shrinking the seed drives it to the minimal trigger.
 */
import type { SimulationEnvironment } from "./simulation-environment.ts";
import { splitMix64 } from "./simulation-environment.ts";

/** Fault-injection policy. Maps to the F# `[<Flags>] ChaosPolicy`. */
export type ChaosPolicy = "delay_jitter" | "clock_skew" | "rng_stall" | "time_reversal";

const U64_MASK = 0xffffffffffffffffn;

export type ChaosEnvironmentOptions = {
  /** Delay() can return up to (1 + noise·delayMultiplier) × requested. Default 0.5. */
  delayMultiplier?: number;
  /** UtcNow may jitter ± clockSkewMs. Default 100. */
  clockSkewMs?: number;
  /** Virtual clock start (ms since epoch). Default 0. */
  baseTimeMs?: number;
  /** Ms the clock advances per `now()` call. Default 1. */
  stepMs?: number;
};

/**
 * Build a chaos environment. Same `(seed, policy, opts)` produces an identical
 * trace. Faithful to ChaosEnv.fs: clock-skew and time-reversal are computed at
 * read time over a seeded splitmix64 stream; RNG-stall replays the previous
 * draw; delay-jitter inflates the requested timeout deterministically.
 */
export function createChaosEnvironment(
  seed: bigint,
  policy: ChaosPolicy | readonly ChaosPolicy[],
  opts: ChaosEnvironmentOptions = {},
): SimulationEnvironment {
  const policies = new Set<ChaosPolicy>(Array.isArray(policy) ? policy : [policy]);
  const has = (p: ChaosPolicy): boolean => policies.has(p);

  const delayMultiplier = opts.delayMultiplier ?? 0.5;
  const clockSkewMs = BigInt(opts.clockSkewMs ?? 100);
  const stepMs = opts.stepMs ?? 1;

  let nowMs = opts.baseTimeMs ?? 0;
  let tickCount = 0;
  let rngState = seed & U64_MASK;
  let prevRng = 0n;
  let guidCounter = 0n;

  /** One seeded draw as a signed 64-bit value (mirrors F# int64 splitMix). */
  const draw = (): bigint => {
    const { value, next } = splitMix64(rngState);
    rngState = next;
    return BigInt.asIntN(64, value);
  };

  return {
    now: () => {
      const base = nowMs + tickCount++ * stepMs;
      if (!has("clock_skew")) {
        return new Date(base).toISOString();
      }
      const d = draw(); const absDraw = d < 0n ? -d : d; const skew = (absDraw % (clockSkewMs * 2n + 1n)) - clockSkewMs;
      // Rare time reversal — simulate NTP corrections moving the clock back.
      if (has("time_reversal") && (draw() & 0x3fn) === 0n) {
        const back = skew < 0n ? skew : -skew;
        return new Date(base + Number(back)).toISOString();
      }
      return new Date(base + Number(skew)).toISOString();
    },
    ticks: () => tickCount,
    nextInt64: () => {
      // RNG stall: occasionally replay the previous value (duplicate read / retry).
      if (has("rng_stall") && (draw() & 0x7n) === 0n) {
        return prevRng;
      }
      const { value, next } = splitMix64(rngState);
      rngState = next;
      prevRng = value;
      return prevRng;
    },
    newGuid: () => {
      guidCounter++;
      return `${guidCounter.toString(16).padStart(16, "0")}-${(seed & U64_MASK).toString(16).padStart(16, "0")}`;
    },
    delay: (ms) => {
      let actual = ms;
      if (has("delay_jitter")) {
        const noise = Number(draw() & 0x3ffn) / 1024.0;
        actual = ms * (1.0 + noise * delayMultiplier);
      }
      nowMs += actual;
      return Promise.resolve();
    },
  };
}
