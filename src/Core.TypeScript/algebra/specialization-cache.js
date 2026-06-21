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
// ─── The Specializer (1st Futamura Projection) ──────────────────────────
/**
 * Specialize an IR into a straight-line function (no loop, no switch).
 * This IS the 1st Futamura projection: interpreter + program → compiled code.
 */
export function specialize(ir) {
    const mask = (1n << BigInt(ir.width)) - 1n;
    // Build the step functions at specialization time (closure captures constants)
    const steps = ir.ops.map(op => {
        if (op.op === "mul") {
            const k = getKUnsigned(op, ir.width);
            return (z) => (z * k) & mask;
        }
        else if (op.op === "xorshr") {
            const s = BigInt(op.s);
            return (z) => (z ^ (z >> s)) & mask;
        }
        else {
            return (z) => z; // unknown op = identity (degrade-toward-correct)
        }
    });
    // The specialized function: straight pipeline of closures (no dispatch)
    return (x) => {
        let z = x & mask;
        for (const step of steps)
            z = step(z);
        return z;
    };
}
function getKUnsigned(op, width) {
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
export function createSpecializationCache(ir, specializeFn = specialize) {
    // Strong ref to IR (irreducible — never collected)
    const irRef = ir;
    // Weak ref to the specialized function (derivable — can be collected)
    let cachedRef = null;
    // FinalizationRegistry to track when GC collects our specialized fn
    const registry = new FinalizationRegistry((_name) => {
        stats.regenerations++; // Count GC collections
    });
    const stats = { hits: 0, misses: 0, regenerations: 0, errors: 0, totalCalls: 0 };
    function getOrRegenerate() {
        if (cachedRef) {
            const deref = cachedRef.deref();
            if (deref) {
                stats.hits++;
                return deref.fn;
            }
        }
        // Cache miss (either first call, or GC collected it)
        stats.misses++;
        try {
            const specialized = specializeFn(irRef);
            const holder = { fn: specialized };
            cachedRef = new WeakRef(holder);
            registry.register(holder, irRef.generator);
            return specialized;
        }
        catch (err) {
            // NEVER cache errors — always retry on next call
            stats.errors++;
            cachedRef = null;
            throw err;
        }
    }
    const run = (x) => {
        stats.totalCalls++;
        const fn = getOrRegenerate();
        return fn(x);
    };
    const invalidate = () => {
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
export function createSpecializationRegistry() {
    const caches = new Map();
    return {
        get(ir) {
            let cache = caches.get(ir.generator);
            if (!cache) {
                cache = createSpecializationCache(ir);
                caches.set(ir.generator, cache);
            }
            return cache.run;
        },
        stats() {
            const result = new Map();
            for (const [name, cache] of caches) {
                result.set(name, cache.stats);
            }
            return result;
        },
        invalidateAll() {
            for (const [, cache] of caches) {
                cache.invalidate();
            }
        },
    };
}
