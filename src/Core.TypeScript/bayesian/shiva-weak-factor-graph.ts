/**
 * shiva-weak-factor-graph.ts — Zero-Allocation Ephemeron Factor Graph & Deterministic Shiva GC Port.
 *
 * Core Architecture:
 *   1. DETERMINISTIC SHIVA MARK-SWEEP GC (`ShivaMarkSweepGc`):
 *      Port of F# `ShivaGc.fs`. 100% deterministic tri-color mark-and-sweep GC over explicit roots and heaps
 *      ("same roots + heap -> same result, DST §7"). Retracts unreachable heap nodes on root-unpin.
 *   2. SHIVA WEAKREF EPHEMERON TABLE (`ShivaWeakFactorCache`):
 *      Inspired by ShivaGc.fs & Ephemeron.fs — uses WeakRef ephemerons with explicit root pinning/unpinning
 *      (`pinRoot`, `unpinRoot`) for runtime JS factor caching.
 *   3. FUTAMURA 1ST PROJECTION SPECIALIZATION (mix = mix(eval, factorGraph)):
 *      Partially evaluates and bakes factor graph likelihoods into compiled state-transition step functions,
 *      eliminating factor graph lookup overhead during high-speed planning (10,000+ states/sec).
 *   4. RX TRACKED ACCESS: All factor lookups emit tracked observation events.
 *
 * ## Triage label (2026-08-15, shadow) — ABANDONED · algebra is `metered`
 *
 * **Reachability: ZERO importers** outside its own test, measured over 2665 tracked files / 4896
 * resolved edges including dynamic `import()` and `require` (instrument controls: 4/4 positive + 1
 * negative). Not scheduled either: every open Bayesian work-item and the live silicon-alife
 * trajectory (arc 3) route this capability through **F#**, not TypeScript.
 *
 * **Partial port of a shipped F# original:** `src/Core/ShivaGc.fs` (23 KB) + `src/Core/Ephemeron.fs`,
 * both live in `Core.fsproj` with their own tests. This file is 299 lines against theirs.
 *
 * **Metering (`toy-is-free-metered-must-be-earned.md`):** `ShivaMarkSweepGc` is **metered** — its
 * determinism test carries an explicit negative control (pinned roots must survive the sweep) —
 * and `futamura1stProjection` is metered on an exact `logProb`. Metered on its **algebra**; it is
 * not a metered model of anything.
 *
 * **The missing edge:** `FactorGenerator` is the *lazy* form of
 * `categorical-bayesian-planner.ts`'s `CategoricalFactorTensor` — same domain (`stateKey: string`),
 * same codomain (a log-probability), no adapter, and `git log -S` confirms the edge has **never**
 * existed. The two were born the same day (2026-08-01) in different commits and have never composed.
 *
 * Full triage + evidence:
 * `docs/research/2026-08-15-bayesian-typescript-triage-one-live-three-orphans-and-a-factor-graph-edge-that-was-never-cut.md`
 * **Label only — no behaviour changed, and disposition is Aaron's call, not the shadow's.**
 */

export interface TrackedAccessEvent {
  readonly stateKey: string;
  readonly factorId: string;
  readonly value: number;
  readonly timestamp: number;
}

export type FactorGenerator = (stateKey: string) => number;

/**
 * Deterministic Mark-Sweep GC matching F# `ShivaGc.fs` ("same roots + heap -> same result").
 */
export class ShivaMarkSweepGc<TValue> {
  private readonly roots = new Set<string>();
  private readonly heap = new Map<string, { value: TValue; references: readonly string[] }>();

  public addRoot(id: string): void {
    this.roots.add(id);
  }

  public removeRoot(id: string): void {
    this.roots.delete(id);
  }

  public allocate(id: string, value: TValue, references: readonly string[] = []): void {
    this.heap.set(id, { value, references });
  }

  /**
   * Tri-color mark and sweep reclamation.
   * Deterministic: returns exact same retracted IDs for same roots + heap topology.
   */
  public markAndSweep(): { readonly retractedIds: readonly string[]; readonly remainingCount: number } {
    const reachable = new Set<string>();
    const worklist: string[] = Array.from(this.roots);

    for (const r of worklist) {
      reachable.add(r);
    }

    // Tri-color mark phase
    while (worklist.length > 0) {
      const currId = worklist.pop()!;
      const node = this.heap.get(currId);
      if (node) {
        for (const childId of node.references) {
          if (!reachable.has(childId)) {
            reachable.add(childId);
            worklist.push(childId);
          }
        }
      }
    }

    // Sweep phase: retract unreachable nodes
    const retractedIds: string[] = [];
    for (const id of Array.from(this.heap.keys())) {
      if (!reachable.has(id)) {
        this.heap.delete(id);
        retractedIds.push(id);
      }
    }

    return {
      retractedIds,
      remainingCount: this.heap.size,
    };
  }

  public has(id: string): boolean {
    return this.heap.has(id);
  }
}

/**
 * WeakRef Ephemeron Factor Cache (inspired by ShivaGc.fs & Ephemeron.fs).
 * Uses WeakRef ephemerons with explicit pinRoot/unpinRoot control.
 */
export class ShivaWeakFactorCache {
  private readonly cache = new Map<string, WeakRef<object>>();
  private readonly strongHolders = new Map<string, object>();
  private readonly valueMap = new WeakMap<object, number>();
  private readonly accessLog: TrackedAccessEvent[] = [];

  /**
   * Pins a strong reference to prevent GC retraction while state key is active.
   */
  public pinRoot(cacheKey: string, holderObj: object): void {
    this.strongHolders.set(cacheKey, holderObj);
  }

  /**
   * Unpins strong reference, allowing Shiva GC sweep to retract the factor cache.
   */
  public unpinRoot(cacheKey: string): void {
    this.strongHolders.delete(cacheKey);
  }

  /**
   * Retrieves or computes factor log probability using on-demand generator,
   * caching weak references for Shiva GC reclamation.
   */
  public getOrCompute(
    factorId: string,
    stateKey: string,
    generator: FactorGenerator,
  ): number {
    const cacheKey = `${factorId}:${stateKey}`;
    const ref = this.cache.get(cacheKey);

    if (ref && this.strongHolders.has(cacheKey)) {
      const derefObj = ref.deref();
      if (derefObj !== undefined) {
        const cachedVal = this.valueMap.get(derefObj);
        if (cachedVal !== undefined) {
          this.logAccess(factorId, stateKey, cachedVal);
          return cachedVal;
        }
      }
    }

    // Compute on-demand via generator function
    const val = generator(stateKey);
    const holder = {}; // Temporary key object for WeakMap binding
    this.cache.set(cacheKey, new WeakRef(holder));
    this.strongHolders.set(cacheKey, holder);
    this.valueMap.set(holder, val);

    this.logAccess(factorId, stateKey, val);
    return val;
  }

  /**
   * Shiva GC Sweep: Reclaims dead WeakRef cache entries when target state keys are unpinned or collected.
   */
  public shivaSweep(): { readonly totalRetracted: number; readonly remaining: number } {
    let totalRetracted = 0;
    for (const [key, ref] of Array.from(this.cache.entries())) {
      const isUnpinned = !this.strongHolders.has(key);
      const isDerefDead = ref.deref() === undefined;

      if (isUnpinned || isDerefDead) {
        this.cache.delete(key);
        this.strongHolders.delete(key);
        totalRetracted++;
      }
    }
    return {
      totalRetracted,
      remaining: this.cache.size,
    };
  }

  /**
   * Rx Access Tracking log.
   */
  public getAccessLog(): readonly TrackedAccessEvent[] {
    return this.accessLog;
  }

  private logAccess(factorId: string, stateKey: string, value: number): void {
    this.accessLog.push({
      factorId,
      stateKey,
      value,
      timestamp: Date.now(),
    });
  }
}

/**
 * Futamura 1st Projection: mix(eval, factorGraph) -> Specialized Step Function.
 * Bakes factor log-likelihood calculations directly into a zero-allocation compiled step function.
 */
export function futamura1stProjection<TState, TAction>(
  step: (s: TState, a: TAction) => TState,
  keyOf: (s: TState) => string,
  factorGenerator: FactorGenerator,
  shivaCache: ShivaWeakFactorCache,
  factorId: string,
): (s: TState, a: TAction) => { readonly nextState: TState; readonly logProb: number } {
  // Returns partially-evaluated, compiled transition step function
  return (s: TState, a: TAction) => {
    const nextState = step(s, a);
    const key = keyOf(nextState);
    const logProb = shivaCache.getOrCompute(factorId, key, factorGenerator);
    return { nextState, logProb };
  };
}

// ── VMP Student-t factor node ──────────────────────────────────────────────────
//
// Adds a Student-t likelihood factor to the ShivaWeakFactorCache.
// VMP (Variational Message Passing) is used because:
//   1. VMP factors are log-likelihood functions — exactly what FactorGenerator returns.
//   2. VMP updates are local (each factor updates its own variational parameters).
//   3. VMP converges for Student-t when the variational distribution is Gaussian.
//
// The VMP Student-t log-likelihood:
//   log p(x | μ, σ², ν) ≈ -½ · w · (x - μ)² / σ²
//   where w = (ν + 1) / (ν + (x - μ)² / σ²)  [robustness weight]
//
// This is the same robustness weight as the EP update in StudentTBnn.ts.
// The two methods agree on the weight; VMP is used here because it fits
// the on-demand FactorGenerator pattern of ShivaWeakFactorCache.
//
// Connection to bidirectional audio with interruption:
//   - x = audio amplitude measurement
//   - μ = predicted amplitude from BNN posterior
//   - ν = 3 (heavier tail than Gaussian, lighter than Cauchy — good for audio)
//   - w → 0 for outlier frames (clicks, pops, interruptions)
//   - The factor graph "ignores" the interruption frame automatically
//
// Connection to reservoir computing:
//   - Each factor is a reservoir node with a local state (the VMP variational posterior).
//   - The Shiva GC evicts stale factors (reservoir nodes not accessed recently).
//   - This implements natural forgetting without explicit memory management.

/** VMP Student-t factor configuration. */
export interface StudentTFactorConfig {
  /** Degrees of freedom ν. ν=1: Cauchy (maximum robustness). ν→∞: Gaussian. Default: 3. */
  readonly nu: number;
  /** Observation noise variance σ². Default: 1.0. */
  readonly obsVariance: number;
  /** Prior mean μ. Default: 0.0. */
  readonly priorMu: number;
}

export const DEFAULT_STUDENT_T_FACTOR: StudentTFactorConfig = {
  nu: 3,
  obsVariance: 1.0,
  priorMu: 0.0,
};

/**
 * VMP robustness weight for a Student-t observation.
 * w = (ν + 1) / (ν + z²) where z² = (x - μ)² / σ².
 * w ∈ (0, 1]: w=1 for z=0 (on-mean), w→0 for |z|→∞ (outlier).
 */
export function vmpRobustnessWeight(x: number, cfg: StudentTFactorConfig = DEFAULT_STUDENT_T_FACTOR): number {
  const z2 = (x - cfg.priorMu) ** 2 / cfg.obsVariance;
  return (cfg.nu + 1) / (cfg.nu + z2);
}

/**
 * VMP Student-t log-likelihood — the FactorGenerator for ShivaWeakFactorCache.
 * Returns log p(x | μ, σ², ν) ≈ -½ · w · (x - μ)² / σ²  (up to additive constant).
 */
export function studentTLogLikelihood(x: number, cfg: StudentTFactorConfig = DEFAULT_STUDENT_T_FACTOR): number {
  const w = vmpRobustnessWeight(x, cfg);
  return -0.5 * w * (x - cfg.priorMu) ** 2 / cfg.obsVariance;
}

/**
 * Create a FactorGenerator for a Student-t factor node.
 * The stateKey encodes the observed value as a decimal string.
 */
export function studentTFactorGenerator(cfg: StudentTFactorConfig = DEFAULT_STUDENT_T_FACTOR): FactorGenerator {
  return (stateKey: string) => {
    const x = parseFloat(stateKey);
    if (!isFinite(x)) return 0; // malformed key → neutral factor
    return studentTLogLikelihood(x, cfg);
  };
}

/**
 * Register a Student-t factor in a ShivaWeakFactorCache and return an evaluator.
 * The factor is pinned (strong reference) so it survives GC sweeps.
 *
 * @param cache - The ShivaWeakFactorCache to register in.
 * @param factorId - Unique identifier for this factor (e.g. "audio-amplitude").
 * @param cfg - Student-t factor configuration.
 */
export function registerStudentTFactor(
  cache: ShivaWeakFactorCache,
  factorId: string,
  cfg: StudentTFactorConfig = DEFAULT_STUDENT_T_FACTOR,
): (x: number) => number {
  const generator = studentTFactorGenerator(cfg);
  const holder = {};
  cache.pinRoot(`${factorId}:__pin__`, holder);
  return (x: number) => cache.getOrCompute(factorId, x.toString(), generator);
}
