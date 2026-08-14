/**
 * bnn-persistence.ts — Serialize and deserialize DimensionalBnn state for persistence.
 *
 * ## Why persistence matters
 *
 * The DimensionalBnn is an online learner: it updates its posterior on every error,
 * NACK, or calibration miss. Without persistence, each process restart discards all
 * learned posteriors and starts from the prior. With persistence, the BNN accumulates
 * knowledge across restarts — the "continuous" in continuous learning.
 *
 * ## Storage format
 *
 * The state is serialized as a JSON file at `docs/observe-events/bnn-state.json`.
 * This path is intentional: it is in the same G-set as the society evolution events,
 * so the BNN state is version-controlled alongside the society state.
 *
 * ## Protocol discipline
 *
 * Persistence is a teaching signal, not just bookkeeping. When the BNN is loaded
 * from disk, the loaded state is an observation: "this is what the system learned
 * before the restart." The load is idempotent (same state → same posterior).
 *
 * ## Homoiconicity
 *
 * The BNN state is content-addressed: the JSON file's SHA-256 is the belief ID.
 * This means the BNN state can be referenced in the error envelope's
 * `retractableBeliefId` field — a BNN retraction is a teaching error.
 *
 * ## Non-Gaussian robustness
 *
 * The persisted state includes the Student-t degrees-of-freedom (ν) per dimension.
 * This means the heavy-tail robustness is preserved across restarts. A dimension
 * that learned ν=3 (heavy-tailed, many outliers) stays at ν=3 after reload.
 *
 * ## Clifford homoclinic tangle avoidance
 *
 * The persisted state includes the FigureEightEnsemble rhoHistory (last 16 ticks).
 * On load, if rhoProxy > 0.8, the BNN is flagged as "in tangle" and the caller
 * should inject an external observation (the 4th body) before trusting the posterior.
 * This is the same principle as the UDP transport: the external observer is required.
 */

import type { DimensionalBnn, TailInterval } from "../planning/error-bnn-bridge";
import type { StudentTState } from "../planning/student-t-bnn";
// ── Serialized state format ────────────────────────────────────────────────────

/** One dimension's persisted EP state. */
export interface PersistedDimension {
  /** The error dimension name (e.g. "schema", "toolchain", "congestion"). */
  readonly dimension: string;
  /** Gaussian mean of the posterior. */
  readonly mu: number;
  /** Gaussian variance of the posterior. */
  readonly sigma2: number;
  /** Student-t degrees of freedom (ν). Smaller = heavier tail = more robust. */
  readonly nu: number;
  /** Number of observations absorbed. */
  readonly observationCount: number;
  /** Robustness weight from the last observation (w = (ν+1)/(ν+z²)). */
  readonly lastRobustnessWeight: number;
}

/** The full persisted BNN state. */
export interface PersistedBnnState {
  /** ISO timestamp of the last update. */
  readonly updatedAt: string;
  /** The Zeta ID of the agent that owns this BNN. */
  readonly zetaId: string;
  /** Per-dimension EP states. */
  readonly dimensions: readonly PersistedDimension[];
  /** Total observations absorbed across all dimensions. */
  readonly totalObservations: number;
  /** FigureEightEnsemble rhoProxy history (last 16 ticks). Used for tangle detection. */
  readonly rhoHistory: readonly number[];
  /** True if rhoProxy > 0.8 at last save (homoclinic tangle warning). */
  readonly tangleWarning: boolean;
  /** Content-addressed belief ID (SHA-256 of the JSON, set by the caller). */
  readonly beliefId?: string;
}

// ── Serialization ──────────────────────────────────────────────────────────────

/**
 * Serialize a DimensionalBnn to a PersistedBnnState.
 *
 * The DimensionalBnn interface (from error-bnn-bridge.ts) exposes:
 * - `dimensions`: Map<string, StudentTBnnState>
 * - `totalObservations`: number
 *
 * We extract the EP state (mu, sigma2, nu) per dimension.
 */
export function serializeBnn(
  bnn: DimensionalBnn,
  zetaId: string,
  rhoHistory: readonly number[] = [],
): PersistedBnnState {
  const dimensions: PersistedDimension[] = [];
  for (const [dim, state] of bnn.states) {
    const w = bnn.robustnessWeights.get(dim) ?? 1;
    dimensions.push({
      dimension: dim,
      mu: state.posterior.mu,
      sigma2: state.posterior.sigma2,
      nu: state.nu,
      observationCount: state.obsCount,
      lastRobustnessWeight: w,
    });
  }
  const lastRho = rhoHistory[rhoHistory.length - 1] ?? 0;
  return {
    updatedAt: new Date().toISOString(),
    zetaId,
    dimensions,
    totalObservations: dimensions.reduce((s, d) => s + d.observationCount, 0),
    rhoHistory: rhoHistory.slice(-16),
    tangleWarning: lastRho > 0.8,
  };
}

/**
 * Deserialize a PersistedBnnState back into a DimensionalBnn.
 *
 * Returns a new DimensionalBnn with the persisted posteriors pre-loaded.
 * If `tangleWarning` is true, the caller should inject an external observation
 * before trusting the posterior (homoclinic tangle avoidance).
 *
 * ## The tail index on the restore path
 *
 * Every dimension PRESENT in the file is restored at the ν the file carries, so
 * the constructor's declared heavy endpoint never decides a restored dimension's
 * tail — on that path it is dead. It is NOT dead in general: a dimension in
 * `ALL_DIMENSIONS` but ABSENT from the file (a state written before the dimension
 * existed, or a truncated one) keeps the scaffold's declared interval. That is
 * exactly the schema-evolution path, so the default has to be defensible rather
 * than merely unreachable — which is why it is now an interval that says it is
 * unmeasured instead of the point `nu = 3`.
 *
 * ## What a restore cannot recover
 *
 * The persisted form carries ONE rung per dimension. The shadow rungs are
 * re-seated at the restored posterior, so tail-dependence is measured afresh from
 * the restore point and any divergence accumulated before the restart is gone. A
 * dimension therefore reads `tail-independent` immediately after a restore
 * regardless of what it was before — a real limit of the format, named here
 * rather than papered over. Persisting the ladder would fix it and would change
 * the on-disk schema, which this change deliberately does not touch.
 */
export function deserializeBnn(
  state: PersistedBnnState,
  tail?: TailInterval,
): { bnn: DimensionalBnn; tangleWarning: boolean } {
  // Import DimensionalBnn constructor
  const { createDimensionalBnn } = require("../planning/error-bnn-bridge") as {
    createDimensionalBnn: (
      tail?: TailInterval,
      obsVariance?: number,
      rungCount?: number,
    ) => DimensionalBnn;
  };
  const bnn = tail ? createDimensionalBnn(tail) : createDimensionalBnn();
  const states = bnn.states as Map<string, StudentTState>;
  const shadows = bnn.shadowRungs as Map<string, readonly StudentTState[]>;
  const weights = bnn.robustnessWeights as Map<string, number>;
  const floorSeen = bnn.varianceOnFloorSeen as Map<string, boolean>;
  // The observation-noise scale the scaffold was built with. The persisted form
  // does not carry it, so a restored dimension has to inherit the BNN's — using
  // `createStudentTState`'s own default instead would give one dimension a
  // different noise scale from its nine siblings purely because it was new.
  const scaffoldObsVariance = states.values().next().value?.obsVariance ?? 1.0;

  // Restore each dimension's EP state
  for (const dim of state.dimensions) {
    // A persisted tail index that is not a tail index cannot be folded at — the
    // filter would carry it into `(nu+1)/(nu+z^2)` and publish arithmetic. Fail
    // fast and name the dimension: a corrupt file is an authoring condition, not
    // a runtime one, and the previous code already threw on this in one of its
    // two branches while silently accepting it in the other.
    if (!Number.isFinite(dim.nu) || dim.nu <= 0) {
      throw new RangeError(
        `persisted nu for dimension ${dim.dimension} must be finite and > 0; got ${String(dim.nu)}`,
      );
    }
    const s = states.get(dim.dimension);
    // StudentTState is readonly — create a new state object with the persisted values
    const restored: StudentTState = {
      posterior: { mu: dim.mu, sigma2: dim.sigma2 },
      // A restored state has no site message of its own: the persisted form does
      // not carry one. `factorSigma2 = Infinity` is the uniform message stated
      // exactly, which is what a state with nothing absorbed since the restore
      // should say. (It is diagnostic only and never divided back out.)
      factorMu: s?.factorMu ?? dim.mu,
      factorSigma2: s?.factorSigma2 ?? Number.POSITIVE_INFINITY,
      nu: dim.nu,
      obsVariance: s?.obsVariance ?? scaffoldObsVariance,
      // Previously the "new dimension" branch dropped this and restored a state
      // claiming zero observations, silently discarding the count the file
      // carried. Same field, same source, both branches.
      obsCount: dim.observationCount,
    };
    states.set(dim.dimension, restored);
    weights.set(dim.dimension, dim.lastRobustnessWeight);
    floorSeen.set(dim.dimension, false);
    // Re-seat the shadow rungs at the restored posterior, keeping only those
    // strictly LIGHTER than the restored tail — a rung at or below the published
    // ν does not bracket it, and a ladder that does not bracket cannot grade.
    // When none survive the dimension has no shadow, and `dimensionVerdict`
    // reports `not-gradable` rather than a pass it did not earn.
    const scaffoldShadows = shadows.get(dim.dimension) ?? [];
    shadows.set(
      dim.dimension,
      scaffoldShadows
        .filter((rung) => rung.nu > dim.nu)
        .map((rung) => ({ ...restored, nu: rung.nu })),
    );
  }
  return { bnn, tangleWarning: state.tangleWarning };
}

// ── File I/O (Node.js only) ────────────────────────────────────────────────────

/** Default path for the persisted BNN state. */
export const DEFAULT_BNN_STATE_PATH = "docs/observe-events/bnn-state.json";

/**
 * Save a PersistedBnnState to disk (Node.js only).
 *
 * The file is written atomically (write to temp, rename) to prevent corruption
 * on process kill. The path is relative to the repo root.
 */
export async function saveBnnState(
  state: PersistedBnnState,
  path = DEFAULT_BNN_STATE_PATH,
): Promise<void> {
  const fs = await import("node:fs/promises");
  const nodePath = await import("node:path");
  const crypto = await import("node:crypto");
  const json = JSON.stringify(state, null, 2);
  // Compute content-addressed belief ID
  const beliefId = crypto.createHash("sha256").update(json).digest("hex").slice(0, 16);
  const stateWithId: PersistedBnnState = { ...state, beliefId };
  const finalJson = JSON.stringify(stateWithId, null, 2);
  const tmpPath = `${path}.tmp`;
  const dir = nodePath.dirname(path);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(tmpPath, finalJson, "utf8");
  await fs.rename(tmpPath, path);
}

/**
 * Load a PersistedBnnState from disk (Node.js only).
 *
 * Returns null if the file does not exist (first run — start from prior).
 */
export async function loadBnnState(
  path = DEFAULT_BNN_STATE_PATH,
): Promise<PersistedBnnState | null> {
  const fs = await import("node:fs/promises");
  try {
    const json = await fs.readFile(path, "utf8");
    return JSON.parse(json) as PersistedBnnState;
  } catch {
    return null;
  }
}

// ── Tangle avoidance ──────────────────────────────────────────────────────────

/**
 * Clifford homoclinic tangle avoidance: inject an external observation when
 * the BNN is in a groupthink spiral (rhoProxy > 0.8).
 *
 * The "external observation" is a synthetic error with cause="tangle-break",
 * which forces the BNN to update its posterior away from the consensus attractor.
 * This is the information-theoretic equivalent of the 4th body in the 3-body problem.
 *
 * ## Why this works
 *
 * The FigureEightEnsemble collapses when all three cells process the same information
 * in the same order. The tangle-break observation is a new piece of information that
 * none of the cells have seen — it breaks the symmetry and allows the cells to
 * diverge again.
 *
 * ## Clifford connection
 *
 * The tangle-break observation is encoded as an Adinkra codeword (from the [8,4,4]
 * code). The codeword is chosen to be maximally distant from the current consensus
 * (Hamming distance = 4). This is the same criterion as the I-closure test for
 * E8 blade-mask survivors: the tangle-break is the "other survivor" that the
 * groupthink spiral cannot reach from inside.
 */
export function tangleBreakObservation(rhoProxy: number): {
  cause: string;
  howToFix: string;
  dimension: "tangle";
  rhoProxy: number;
  adinkraCw: number[];
} {
  // Choose the Adinkra codeword most distant from the current consensus.
  // The [8,4,4] code has 16 codewords; the one with Hamming distance 4 from
  // the all-zeros codeword is {0,3,4,7} (the I-closed survivor).
  const adinkraCw = [0, 3, 4, 7];
  return {
    cause: "homoclinic-tangle",
    howToFix: `rhoProxy=${rhoProxy.toFixed(3)} > 0.8 — inject external observation to break symmetry`,
    dimension: "tangle",
    rhoProxy,
    adinkraCw,
  };
}
