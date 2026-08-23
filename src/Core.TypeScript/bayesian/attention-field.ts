/**
 * attention-field.ts — per-tile uncertainty on the SAME carrier as every
 * other belief in the arena (D1 of the attention-density spec, #14503).
 *
 * ## What this is
 *
 * A grid of Student-t/NG4 beliefs, one per screen tile, each tracking the
 * tile's per-tick CHANGE FRACTION (how much of the tile's pixels toggled
 * since the previous tick). The posterior VARIANCE of each cell is the
 * attention signal:
 *
 *  - a tile whose activity is predictable (empty sky, a parked wall)
 *    converges → low variance → "known" → rendered clear;
 *  - a tile whose activity keeps surprising the model (a fight, a respawn,
 *    a scoreboard mid-redraw) stays wide → high variance → "not known yet"
 *    → rendered frosted;
 *  - the top-K variance tiles are where the foveated ladder (D2) spends
 *    full perception.
 *
 * ## Why this and not a second estimator
 *
 * The spec's constraint is that the field must not be "a parallel
 * uncertainty estimate able to drift from the first". There is no per-tile
 * belief anywhere in the stack today (key beliefs are per-key, mode values
 * are per-bucket) — so this module does not duplicate one; it EXTENDS the
 * belief state with the missing spatial axis, using the same
 * createStudentTState/updateStudentT machinery, serialized in the same
 * society snapshot, replayable from the same seed. λ and α — the NG4
 * precision components the spec names — are recoverable from any cell via
 * the studentTStateToNg bridge; nothing here mints a second representation.
 *
 * Deterministic throughout: no randomness, no wall-clock; same observation
 * stream → byte-identical field (asserted in the tests).
 */

import {
  createStudentTState,
  updateStudentT,
  type StudentTState,
} from "../planning/student-t-bnn";

/** CHIP-8 display geometry (the natural 8×8 blocking the spec names). */
export const SCREEN_W = 64;
export const SCREEN_H = 32;
export const TILE_SIZE = 8;
export const TILE_COLS = SCREEN_W / TILE_SIZE; // 8
export const TILE_ROWS = SCREEN_H / TILE_SIZE; // 4
export const TILE_COUNT = TILE_COLS * TILE_ROWS; // 32

/** Prior: moderate tail, centred on "nothing changes", wide enough to learn. */
const PRIOR_NU = 4.0;
const PRIOR_MU = 0.0;
const PRIOR_SIGMA2 = 1.0;
const OBS_VARIANCE = 0.05;

export interface AttentionCell {
  readonly tile: number;
  readonly mu: number;
  readonly sigma2: number;
  readonly nu: number;
  readonly obsCount: number;
}

export interface AttentionSnapshot {
  readonly version: 1;
  readonly cells: readonly AttentionCell[];
}

/** One tick's exported field, ready to cross the worker boundary. */
export interface AttentionReadout {
  readonly cols: number;
  readonly rows: number;
  /** Posterior variance per tile, row-major — the frost channel. */
  readonly variance: readonly number[];
  /** Posterior mean change-fraction per tile (what the tile usually does). */
  readonly mean: readonly number[];
}

export class TileAttentionField {
  /** cells[row * TILE_COLS + col] — Student-t posterior over change fraction. */
  private cells: StudentTState[] = [];
  /** Previous composite, for the change fraction. Null until first observe. */
  private prev: number[] | null = null;

  constructor() {
    for (let i = 0; i < TILE_COUNT; i++) {
      this.cells.push(createStudentTState(PRIOR_NU, PRIOR_MU, PRIOR_SIGMA2, OBS_VARIANCE));
    }
  }

  /**
   * Absorb one tick's composite display (length 64×32, color-mask values).
   * Cost: one pass over the display + TILE_COUNT belief updates.
   */
  observe(display: readonly number[]): void {
    if (display.length !== SCREEN_W * SCREEN_H) return;
    const changed = new Array<number>(TILE_COUNT).fill(0);
    const prev = this.prev;
    for (let y = 0; y < SCREEN_H; y++) {
      const tileRow = (y / TILE_SIZE) | 0;
      for (let x = 0; x < SCREEN_W; x++) {
        const i = y * SCREEN_W + x;
        const before = prev ? (prev[i] ?? 0) : 0;
        const after = display[i] ?? 0;
        if (before !== after) {
          changed[((tileRow * TILE_COLS) + ((x / TILE_SIZE) | 0))]! += 1;
        }
      }
    }
    const pixelsPerTile = TILE_SIZE * TILE_SIZE;
    for (let t = 0; t < TILE_COUNT; t++) {
      const fraction = (changed[t] ?? 0) / pixelsPerTile;
      this.cells[t] = updateStudentT(this.cells[t]!, fraction).state;
    }
    this.prev = [...display];
  }

  /** The exported field for this tick (plain arrays — see protocol note). */
  readout(): AttentionReadout {
    const variance: number[] = [];
    const mean: number[] = [];
    for (const c of this.cells) {
      variance.push(c.posterior.sigma2);
      mean.push(c.posterior.mu);
    }
    return { cols: TILE_COLS, rows: TILE_ROWS, variance, mean };
  }

  /**
   * Indices of the K highest-variance tiles, ordinal-stable (ties break to
   * the lower index so the same field always yields the same set).
   */
  topK(k: number): readonly number[] {
    const order = this.cells
      .map((c, i) => ({ i, v: c.posterior.sigma2 }))
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
      const v = c.posterior.sigma2;
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
        mu: c.posterior.mu,
        sigma2: c.posterior.sigma2,
        nu: c.nu,
        obsCount: c.obsCount,
      })),
    };
  }

  importSnapshot(snap: AttentionSnapshot): void {
    if (snap.version !== 1) {
      throw new RangeError(
        `unknown AttentionSnapshot version ${String((snap as { version: unknown }).version)}`,
      );
    }
    for (const cell of snap.cells) {
      if (cell.tile < 0 || cell.tile >= TILE_COUNT) continue;
      if (!Number.isFinite(cell.nu) || cell.nu <= 0) {
        throw new RangeError(`snapshot nu for tile ${String(cell.tile)} must be finite and > 0`);
      }
      const fresh = this.cells[cell.tile]!;
      this.cells[cell.tile] = {
        posterior: { mu: cell.mu, sigma2: cell.sigma2 },
        factorMu: cell.mu,
        factorSigma2: Number.POSITIVE_INFINITY,
        nu: cell.nu,
        obsVariance: fresh.obsVariance,
        obsCount: cell.obsCount,
      } as StudentTState;
    }
    this.prev = null;
  }
}
