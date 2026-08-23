/**
 * arc-explorer.ts — the bounded exploration phase, in ticks, from the seed.
 *
 * The previous version measured its phase in `Date.now()` milliseconds and
 * emitted `Math.random()` distributions — so the first ~30 wall-clock seconds
 * of every stream were literally random button presses, different for every
 * viewer, replaying never (the "buttons are being pressed randomly" report,
 * and a noninterference §13 violation on both counts).
 *
 * Now: the budget is counted in TICKS (the worker's own cycle counter — the
 * only legitimate clock here), and the emitted distribution is drawn from a
 * seeded stream derived from COMMON_SEED. Same run, same bytes, every time.
 *
 * Note the predictor's own layer-5 exploration (directional probing to find
 * which object answers to the keys) largely supersedes this uniform phase;
 * this class remains as the outer safety net for carts where perception finds
 * nothing to probe.
 */

import { COMMON_SEED } from "../observe/phase-clock";
import { createSeededStream, type SeededStream } from "../chip8/seeded-rng";

export class ArcExplorer {
  private readonly budgetTicks: number;
  private ticksSeen = 0;
  private isExploring = true;
  private readonly rng: SeededStream;

  constructor(budgetTicks: number = 300, seed: number = COMMON_SEED) {
    this.budgetTicks = budgetTicks;
    this.rng = createSeededStream(seed, 2);
  }

  /** Advance one tick; returns true while still in the exploration phase. */
  public tick(): boolean {
    if (this.isExploring) {
      this.ticksSeen += 1;
      if (this.ticksSeen > this.budgetTicks) {
        this.isExploring = false;
        console.log("[ArcExplorer] Exploration phase complete. Transitioning to objective phase.");
      }
    }
    return this.isExploring;
  }

  public explore(): Record<number, number> {
    const observations: Record<number, number> = {};
    for (let i = -1; i <= 0xf; i++) {
      observations[i] = this.rng.next();
    }
    return observations;
  }
}
