/**
 * mode-value-learner.ts — the hunt/flee decision, learned instead of ruled.
 *
 * ## What was hardcoded, and what changes
 *
 * Layer 6 of the key predictor decided hunt-vs-flee by a hand-authored rule:
 * `adversary.area >= 10 → threat`, `closingSpeed > 0.2 → threat`, Schmitt
 * latch. The FEATURES were perceived (layers 1–3), but the MAPPING from
 * features to mode was authored knowledge about one cart's shapes. A cart
 * where the big shape is the prey is steered wrong forever.
 *
 * This module replaces the mapping with a learned one, using only machinery
 * the stack already has:
 *
 *  - **Context** (layers 1–3): the adversary bucketed by (big/small ×
 *    closing/receding) — 4 cells. The bucket EDGES remain engineered feature
 *    discretisation; what becomes learned is the POLICY over them.
 *  - **Value model**: one Student-t EP state per (bucket × mode), estimating
 *    the expected score-delta of holding that mode in that context — a
 *    deterministic contextual bandit over the same posteriors the keys use.
 *  - **Reward** (layer 4): the OCR layer already reads both scoreboards off
 *    the pixels. Δ(my score) − Δ(their score) IS the ground truth the mode
 *    question needs — the agent grades itself with its own eyes, no oracle
 *    wire into the cart.
 *  - **Credit assignment**: a tag lands a beat after the choices that caused
 *    it, so rewards are assigned backward over a decaying eligibility trace
 *    (Sutton & Barto ch.12; λ-return in its simplest honest form).
 *
 * ## The old rule is demoted, not deleted
 *
 * The constructor seeds each bucket with a weak prior MATCHING the old rule
 * (big → flee, small → hunt). Hardcoded→learned is done as rule→prior: the
 * knowledge is kept, its authority is revoked — evidence overrides it. On a
 * cart with no score events the learner sits at the prior and behaves
 * exactly like the old rule (the mode-flip curriculum cart still grades the
 * latch unchanged).
 *
 * ## Falsifier
 *
 * `buildMutualSimRom({ invertAppearance: true })` — identical dynamics, but
 * the hunter wears the SMALL shape. The old rule approaches the hunter
 * forever; the learner must flip that bucket from its prior after eating the
 * negative reward. `mode-value-learner.test.ts` runs both carts and asserts
 * the flip happens on the inverted one and does NOT happen on the normal one.
 *
 * Deterministic throughout: no randomness, ordinal argmax with a fixed
 * tie-break, same run → same table (asserted).
 */

import {
  createStudentTState,
  updateStudentT,
  type StudentTState,
} from "../planning/student-t-bnn";

export type ModeChoice = "hunt" | "flee";

export interface ModeBucket {
  /** Layer-1 cue: adversary blob at or above the hunter-shape area. */
  readonly bigAdversary: boolean;
  /** Layer-3 cue: the gap is shrinking. */
  readonly closing: boolean;
}

export const MODE_BUCKET_COUNT = 4;
export const bucketIndex = (b: ModeBucket): number =>
  (b.bigAdversary ? 2 : 0) | (b.closing ? 1 : 0);

/** The retired rule, kept as the PRIOR: big → flee, small → hunt. */
export const legacyRulePrior = (b: ModeBucket): ModeChoice => (b.bigAdversary ? "flee" : "hunt");

/** Eligibility-trace depth (ticks) and per-tick decay. */
const TRACE_DEPTH = 20;
const TRACE_DECAY = 0.9;
/** Weak prior magnitude — enough to steer a cold start, cheap to override. */
const PRIOR_MEAN = 0.2;

export interface ModeValueCell {
  readonly bucket: number;
  readonly mode: ModeChoice;
  readonly mu: number;
  readonly sigma2: number;
  readonly nu: number;
  readonly obsCount: number;
}

export interface ModeValueSnapshot {
  readonly version: 1;
  readonly cells: readonly ModeValueCell[];
}

const MODES: readonly ModeChoice[] = ["hunt", "flee"];

export class ModeValueLearner {
  /** cells[bucket * 2 + modeIx] — Student-t posterior over score-delta. */
  private cells: StudentTState[] = [];
  /** Newest-first ring of executed (bucket, mode) choices. */
  private trace: { bucket: number; mode: ModeChoice }[] = [];
  /** Reward events absorbed — exposed so tests can assert signal existed. */
  public rewardEvents = 0;

  constructor(prior: (b: ModeBucket) => ModeChoice = legacyRulePrior) {
    for (let bucket = 0; bucket < MODE_BUCKET_COUNT; bucket++) {
      const b: ModeBucket = { bigAdversary: (bucket & 2) !== 0, closing: (bucket & 1) !== 0 };
      const preferred = prior(b);
      for (const mode of MODES) {
        const mu = mode === preferred ? PRIOR_MEAN : -PRIOR_MEAN;
        // nu=4 heavy-ish tail (outlier-tolerant), wide prior sigma2 so a
        // handful of real tags outweighs the seeded opinion, obsVariance 0.5
        // because a single tag is a noisy measurement of a context's worth.
        this.cells.push(createStudentTState(4.0, mu, 1.0, 0.5));
      }
    }
  }

  private cellIx(bucket: number, mode: ModeChoice): number {
    return bucket * 2 + (mode === "flee" ? 1 : 0);
  }

  /** The learned preference for a context. Tie breaks to flee (survivable). */
  choose(bucket: ModeBucket): ModeChoice {
    const ix = bucketIndex(bucket);
    const hunt = this.cells[this.cellIx(ix, "hunt")]!.posterior.mu;
    const flee = this.cells[this.cellIx(ix, "flee")]!.posterior.mu;
    return hunt > flee ? "hunt" : "flee";
  }

  /** Record the mode actually EXECUTED this tick (credit goes to deeds). */
  record(bucket: ModeBucket, mode: ModeChoice): void {
    this.trace.unshift({ bucket: bucketIndex(bucket), mode });
    if (this.trace.length > TRACE_DEPTH) this.trace.pop();
  }

  /**
   * Absorb a reward event (Δmine − Δtheirs from the OCR scoreboards),
   * credited backward over the eligibility trace with decay.
   */
  reward(r: number): void {
    if (!Number.isFinite(r) || r === 0) return;
    const clipped = Math.max(-1, Math.min(1, r));
    this.rewardEvents += 1;
    for (let i = 0; i < this.trace.length; i++) {
      const entry = this.trace[i]!;
      const y = clipped * Math.pow(TRACE_DECAY, i);
      const ix = this.cellIx(entry.bucket, entry.mode);
      this.cells[ix] = updateStudentT(this.cells[ix]!, y).state;
    }
  }

  /** Inspect a cell's posterior mean (tests + the arena readout). */
  valueOf(bucket: ModeBucket, mode: ModeChoice): number {
    return this.cells[this.cellIx(bucketIndex(bucket), mode)]!.posterior.mu;
  }

  exportSnapshot(): ModeValueSnapshot {
    const cells: ModeValueCell[] = [];
    for (let bucket = 0; bucket < MODE_BUCKET_COUNT; bucket++) {
      for (const mode of MODES) {
        const s = this.cells[this.cellIx(bucket, mode)]!;
        cells.push({
          bucket,
          mode,
          mu: s.posterior.mu,
          sigma2: s.posterior.sigma2,
          nu: s.nu,
          obsCount: s.obsCount,
        });
      }
    }
    return { version: 1, cells };
  }

  importSnapshot(snap: ModeValueSnapshot): void {
    if (snap.version !== 1) {
      throw new RangeError(`unknown ModeValueSnapshot version ${String((snap as { version: unknown }).version)}`);
    }
    for (const cell of snap.cells) {
      if (!Number.isFinite(cell.nu) || cell.nu <= 0) {
        throw new RangeError(`snapshot nu for bucket ${cell.bucket}/${cell.mode} must be finite and > 0`);
      }
      if (cell.bucket < 0 || cell.bucket >= MODE_BUCKET_COUNT) continue;
      const fresh = this.cells[this.cellIx(cell.bucket, cell.mode)]!;
      this.cells[this.cellIx(cell.bucket, cell.mode)] = {
        posterior: { mu: cell.mu, sigma2: cell.sigma2 },
        factorMu: cell.mu,
        factorSigma2: Number.POSITIVE_INFINITY,
        nu: cell.nu,
        obsVariance: fresh.obsVariance,
        obsCount: cell.obsCount,
      } as StudentTState;
    }
    this.trace = [];
  }
}
