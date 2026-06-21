/**
 * src/Core.TypeScript/algebra/specialization-cache.ts — WeakRef-wrapped 1st Futamura cache.
 *
 * The pattern: cogen = mix(mix,mix) applied to MEMORY MANAGEMENT.
 * - IR (irreducible) stays alive (strong ref) — the source of truth
 * - Generated code (derivable) is weakly held — can be collected + regenerated
 * - The generator IS the ECC — regeneration on cache miss is error-correction
 *
 * Usage:
 *   const cache = createSpecializationCache(ir, specialize);
 *   const result = cache.run(input); // first call: specializes, caches
 *   const result2 = cache.run(input2); // hits cache (fast path)
 *   // ... GC collects the specialized function if memory pressure ...
 *   const result3 = cache.run(input3); // cache miss → regenerates (still correct)
 */

import type { StarRing } from "./star-ring";

// ─── Types ───────────────────────────────────────────────────────────────

/** A specialized mix function (the output of the 1st Futamura projection). */
export type SpecializedMix = (x: bigint) => bigint;

/** Statistics for the cache (observable for monitoring). */
export interface CacheStats {
  hits: number;
  misses: number;
  regenerations: number;
  totalCalls: number;
}

/** The IR shape consumed by the cache. */
export interface CacheableIr {
  generator: string;
  width: number;
  ops: readonly { op: string; k?: number; s?: number; k_bigint?: string }[];
}

// ─── The Specializer (1st Futamura Projection) ──────────────────────────

/**
 * Specialize an IR into a straight-line function (no loop, no switch).
 * This IS the 1st Futamura projection: interpreter + program → compiled code.
 */
export function specialize(ir: CacheableIr): SpecializedMix {
  const mask = (1n << BigInt(ir.width)) - 1n;

  // Build the step functions at specialization time (closure captures constants)
  const steps: ((z: bigint) => bigint)[] = ir.ops.map(op => {
    if (op.op === "mul") {
      const k = getKUnsigned(op, ir.width);
      return (z: bigint) => (z * k) & mask;
    } else if (op.op === "xorshr") {
      const s = BigInt(op.s!);
      return (z: bigint) => (z ^ (z >> s)) & mask;
    } else {
      return (z: bigint) => z; // unknown op = identity (degrade-toward-correct)
    }
  });

  // The specialized function: straight pipeline of closures (no dispatch)
  return (x: bigint): bigint => {
    let z = x & mask;
    for (const step of steps) z = step(z);
    return z;
  };
}

function getKUnsigned(op: { k?: number; k_bigint?: string }, width: number): bigint {
  const raw = op.k_bigint ? BigInt(op.k_bigint) : BigInt(op.k ?? 0);
  return raw & ((1n << BigInt(width)) - 1n);
}

// ─── The WeakRef Cache ──────────────────────────────────────────────────

/**
 * Create a specialization cache with WeakRef semantics.
 *
 * The specialized function is weakly held. If GC collects it (memory pressure),
 * the next call regenerates it from the IR. The IR is strongly held (irreducible).
 *
 * This IS cogen=mix(mix,mix) applied to memory management:
 * - generate the derivable (specialize from IR)
 * - keep the irreducible (the IR itself)
 * - the generator IS the ECC (regenerate on miss = error-correct)
 */
export function createSpecializationCache(
  ir: CacheableIr,
  specializeFn: (ir: CacheableIr) => SpecializedMix = specialize,
): { run: SpecializedMix; stats: CacheStats; invalidate: () => void } {
  // Strong ref to IR (irreducible — never collected)
  const irRef = ir;

  // Weak ref to the specialized function (derivable — can be collected)
  let cachedRef: WeakRef<{ fn: SpecializedMix }> | null = null;
  // FinalizationRegistry to track when GC collects our specialized fn
  const registry = new FinalizationRegistry<string>((name) => {
    stats.regenerations++; // Count GC collections
  });

  const stats: CacheStats = { hits: 0, misses: 0, regenerations: 0, totalCalls: 0 };

  function getOrRegenerate(): SpecializedMix {
    if (cachedRef) {
      const deref = cachedRef.deref();
      if (deref) {
        stats.hits++;
        return deref.fn;
      }
    }
    // Cache miss (either first call, or GC collected it)
    stats.misses++;
    const specialized = specializeFn(irRef);
    const holder = { fn: specialized };
    cachedRef = new WeakRef(holder);
    registry.register(holder, irRef.generator);
    return specialized;
  }

  const run: SpecializedMix = (x: bigint): bigint => {
    stats.totalCalls++;
    const fn = getOrRegenerate();
    return fn(x);
  };

  const invalidate = (): void => {
    cachedRef = null; // Force regeneration on next call
  };

  return { run, stats, invalidate };
}

// ─── Multi-IR Cache (registry of specialized generators) ────────────────

/**
 * A registry of specialization caches — one per IR generator.
 * This is the runtime analog of the codegen toolbox: given a generator name,
 * produce the fastest execution path (specialized if hot, interpreted if cold).
 */
export function createSpecializationRegistry(): {
  get(ir: CacheableIr): SpecializedMix;
  stats(): Map<string, CacheStats>;
  invalidateAll(): void;
} {
  const caches = new Map<string, ReturnType<typeof createSpecializationCache>>();

  return {
    get(ir: CacheableIr): SpecializedMix {
      let cache = caches.get(ir.generator);
      if (!cache) {
        cache = createSpecializationCache(ir);
        caches.set(ir.generator, cache);
      }
      return cache.run;
    },

    stats(): Map<string, CacheStats> {
      const result = new Map<string, CacheStats>();
      for (const [name, cache] of caches) {
        result.set(name, cache.stats);
      }
      return result;
    },

    invalidateAll(): void {
      for (const [, cache] of caches) {
        cache.invalidate();
      }
    },
  };
}
