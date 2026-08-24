/**
 * attention-field.ts — per-tile uncertainty on the NG4 carrier (D1 of the
 * attention-density spec, #14503).
 *
 * ## What this is
 *
 * A grid of Normal-Gamma beliefs, one per screen tile, each tracking the
 * tile's per-tick CHANGE FRACTION (how much of the tile toggled since the
 * previous tick). The PREDICTIVE VARIANCE of each cell is the attention
 * signal:
 *
 *  - a tile whose activity is predictable (empty sky, a parked wall)
 *    converges → low variance → "known" → rendered clear;
 *  - a tile whose activity keeps surprising the model (a fight, a respawn,
 *    a scoreboard mid-redraw) stays wide → high variance → "not known yet"
 *    → rendered frosted;
 *  - the top-K variance tiles are where the foveated ladder (D2) spends
 *    full perception.
 *
 * ## Why the NG4 carrier, and why a forgetting factor
 *
 * The spec names the source exactly: "the NG4 precision components — λ, α —
 * are the natural source; do not add a parallel uncertainty estimate". The
 * Normal-Gamma conjugate update is CLOSED FORM (four arithmetic updates —
 * the additive-blend fact the GPU-mapping doc rests on), measured here at
 * ~ns against ~177 µs per Student-t EP update — the field runs every tile
 * every tick, so the carrier choice IS the frame budget. The Student-t
 * marginal stays recoverable from any cell (ngStudentT in the codec), so
 * nothing about the API narrows.
 *
 * A plain conjugate filter never forgets: λ grows without bound and a tile
 * that converged once could never re-frost when its content changes
 * character. The field therefore applies an exponential FORGETTING FACTOR
 * to the sufficient statistics before each update (a standard discounted
 * conjugate filter): old evidence decays geometrically, variance stays
 * responsive, and the whole thing remains deterministic.
 *
 * Deterministic throughout: no randomness, no wall-clock; same observation
 * stream → byte-identical field (asserted in the tests).
 */

/** CHIP-8 display geometry (the natural 8×8 blocking the spec names). */
export const SCREEN_W = 64;
export const SCREEN_H = 32;
export const TILE_SIZE = 8;
export const TILE_COLS = SCREEN_W / TILE_SIZE; // 8
export const TILE_ROWS = SCREEN_H / TILE_SIZE; // 4
export const TILE_COUNT = TILE_COLS * TILE_ROWS; // 32

/** Prior: centred on "nothing changes", weak enough to learn fast. */
const PRIOR_M = 0.0;
const PRIOR_LAMBDA = 1.0;
const PRIOR_ALPHA = 1.5;
const PRIOR_BETA = 0.05;
/** Evidence half-life ≈ 34 ticks: 0.98^34 ≈ 0.5. */
const FORGET = 0.98;
/** Floors keep the marginal proper (ν = 2α must stay > 2 for a variance). */
const ALPHA_FLOOR = 1.05;
const LAMBDA_FLOOR = 0.05;

/** One tile's Normal-Gamma belief, in moment form (m, λ, α, β). */
interface TileNg {
  m: number;
  lambda: number;
  alpha: number;
  beta: number;
}

export interface AttentionCell {
  readonly tile: number;
  readonly m: number;
  readonly lambda: number;
  readonly alpha: number;
  readonly beta: number;
}

export interface AttentionSnapshot {
  readonly version: 1;
  readonly cells: readonly AttentionCell[];
}

/** One tick's exported field, ready to cross the worker boundary. */
export interface AttentionReadout {
  readonly cols: number;
  readonly rows: number;
  /** Predictive variance per tile, row-major — the frost channel. */
  readonly variance: readonly number[];
  /** Posterior mean change-fraction per tile (what the tile usually does). */
  readonly mean: readonly number[];
}

/** Student-t predictive variance of a Normal-Gamma cell (ν = 2α > 2 held by floor). */
const predictiveVariance = (c: TileNg): number => {
  const nu = 2 * c.alpha;
  const scale2 = (c.beta * (c.lambda + 1)) / (c.alpha * c.lambda);
  return nu > 2 ? (scale2 * nu) / (nu - 2) : scale2 * 40;
};

export class TileAttentionField {
  /** cells[row * TILE_COLS + col]. */
  private cells: TileNg[] = [];
  /** Previous composite, for the change fraction. Null until first observe. */
  private prev: number[] | null = null;
  /** Reused per-tick change counters (no per-frame allocation). */
  private readonly changedScratch: number[] = new Array<number>(TILE_COUNT).fill(0);

  constructor() {
    for (let i = 0; i < TILE_COUNT; i++) {
      this.cells.push({ m: PRIOR_M, lambda: PRIOR_LAMBDA, alpha: PRIOR_ALPHA, beta: PRIOR_BETA });
    }
  }

  /**
   * Absorb one tick's composite display (length 64×32, color-mask values).
   * Cost: one in-place pass over the display + TILE_COUNT closed-form
   * conjugate updates — no allocation, no iteration, no special functions.
   */
  observe(display: readonly number[]): void {
    if (display.length !== SCREEN_W * SCREEN_H) return;
    this.prev ??= new Array<number>(SCREEN_W * SCREEN_H).fill(0);
    const prev = this.prev;
    const changed = this.changedScratch;
    changed.fill(0);
    for (let y = 0; y < SCREEN_H; y++) {
      const rowBase = ((y / TILE_SIZE) | 0) * TILE_COLS;
      for (let x = 0; x < SCREEN_W; x++) {
        const i = y * SCREEN_W + x;
        const after = display[i] ?? 0;
        if (prev[i] !== after) {
          const c = rowBase + ((x / TILE_SIZE) | 0);
          changed[c] = (changed[c] ?? 0) + 1;
          prev[i] = after;
        }
      }
    }
    const pixelsPerTile = TILE_SIZE * TILE_SIZE;
    for (let t = 0; t < TILE_COUNT; t++) {
      const x = (changed[t] ?? 0) / pixelsPerTile;
      const c = this.cells[t];
      if (!c) continue;
      // Discounted conjugate update: decay the evidence, then absorb x.
      const lambda0 = Math.max(LAMBDA_FLOOR, c.lambda * FORGET);
      const alpha0 = Math.max(ALPHA_FLOOR, c.alpha * FORGET);
      const beta0 = c.beta * FORGET;
      const d = x - c.m;
      c.m = (lambda0 * c.m + x) / (lambda0 + 1);
      c.beta = beta0 + (lambda0 * d * d) / (2 * (lambda0 + 1));
      c.lambda = lambda0 + 1;
      c.alpha = alpha0 + 0.5;
    }
  }

  /** Predictive variance of one tile (the WHY chain cites the fixation's). */
  varianceAt(tile: number): number {
    const c = this.cells[tile];
    return c ? predictiveVariance(c) : 0;
  }

  /** The exported field for this tick (plain arrays — see protocol note). */
  readout(): AttentionReadout {
    const variance: number[] = [];
    const mean: number[] = [];
    for (const c of this.cells) {
      variance.push(predictiveVariance(c));
      mean.push(c.m);
    }
    return { cols: TILE_COLS, rows: TILE_ROWS, variance, mean };
  }

  /**
   * Indices of the K highest-variance tiles, ordinal-stable (ties break to
   * the lower index so the same field always yields the same set).
   */
  topK(k: number): readonly number[] {
    const order = this.cells
      .map((c, i) => ({ i, v: predictiveVariance(c) }))
      .sort((a, b) => b.v - a.v || a.i - b.i);
    return order.slice(0, Math.max(0, k)).map((e) => e.i);
  }

  /**
   * Is the field FLAT — no tile meaningfully more uncertain than another?
   * A flat field gives the foveation allocator no signal, and the meter
   * must say `ambiguous` rather than quietly falling back to uniform
   * sampling (D2's loud half).
   */
  isFlat(relativeSpread = 0.05): boolean {
    let min = Infinity;
    let max = -Infinity;
    for (const c of this.cells) {
      const v = predictiveVariance(c);
      if (v < min) min = v;
      if (v > max) max = v;
    }
    if (!Number.isFinite(min) || max <= 0) return true;
    return (max - min) / max < relativeSpread;
  }

  exportSnapshot(): AttentionSnapshot {
    return {
      version: 1,
      cells: this.cells.map((c, i) => ({
        tile: i,
        m: c.m,
        lambda: c.lambda,
        alpha: c.alpha,
        beta: c.beta,
      })),
    };
  }

  importSnapshot(snap: AttentionSnapshot): void {
    const version = (snap as { version: unknown }).version;
    if (version !== 1) {
      throw new RangeError(`unknown AttentionSnapshot version ${String(version)}`);
    }
    for (const cell of snap.cells) {
      if (cell.tile < 0 || cell.tile >= TILE_COUNT) continue;
      if (
        !Number.isFinite(cell.lambda) ||
        cell.lambda <= 0 ||
        !Number.isFinite(cell.alpha) ||
        cell.alpha <= 0 ||
        !Number.isFinite(cell.beta) ||
        cell.beta <= 0
      ) {
        throw new RangeError(`snapshot NG for tile ${String(cell.tile)} must be a proper belief`);
      }
      this.cells[cell.tile] = {
        m: cell.m,
        lambda: cell.lambda,
        alpha: cell.alpha,
        beta: cell.beta,
      };
    }
    this.prev = null;
  }
}
