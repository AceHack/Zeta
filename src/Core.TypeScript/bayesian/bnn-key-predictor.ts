/**
 * bnn-key-predictor.ts — a Society of Student-t BNNs over FORCED perception
 * layers, predicting the next CHIP-8 key.
 *
 * ## What changed and why (2026-08-23, Otto)
 *
 * Before: "spatial reasoning" was two color-filtered centroids over raw
 * pixels. In mutual-sim the two static walls share color 1 with the adversary,
 * so the "target" centroid was dominated by furniture (32 wall pixels vs a
 * 4-12 pixel adversary) — the agent steered off the average of the walls, the
 * hunt/flee cue (`targetCount > 8`) was permanently "flee", and with three
 * `Math.random()` channels on top the buttons read as random. All three are
 * structural, so the fix is structural:
 *
 *   Layer 0  raw display (colors)
 *   Layer 1  objects: connected components + bounding boxes   (perception.ts)
 *   Layer 2  tracking: stable ids, velocities, static/moving  (perception.ts)
 *   Layer 3  relations: offsets, distances, closing speeds    (perception.ts)
 *   Layer 4  symbols: OCR of the fontset → score grid         (ocr.ts)
 *   Layer 5  roles: WHICH object is me (key↔motion correlation — the
 *            empowerment probe), which is the adversary, which is scenery
 *   Layer 6  mode: hunt / flee latch with hysteresis
 *   Layer 7  policy: geometry-aware steering with obstacle avoidance,
 *            smoothed by the Student-t EP society and WSet consensus
 *
 * These layers are FORCED (engineered, inspectable, individually testable)
 * rather than hoped-for emergent structure — each exposes its output on the
 * predictor (`lastPerception`, `lastOcr`, `lastSelfId`, `lastMode`, …) so the
 * UI can show them and the curriculum carts can grade them one at a time.
 *
 * ## Determinism
 *
 * All randomness flows from ONE seeded stream derived from COMMON_SEED
 * (phase-clock). Same display sequence + same pressed keys → byte-identical
 * distributions, on every machine, every run. Two viewers of the stream fold
 * identical evidence (noninterference §13); DST replays.
 *
 * ## Anchors
 *
 * Student-t EP: Minka 2001 (expectation propagation). Self-identification by
 * action-effect correlation is the practical core of empowerment (Klyubin,
 * Polani & Nehaniv 2005: control as agent→sensor channel capacity) — here the
 * degenerate, cheap estimator: which object's velocity correlates with my key
 * presses. The mode latch with hysteresis is a Schmitt trigger over the
 * threat cues. All toy-register: labelled, tested, falsifiable.
 */

import { createStudentTState, updateStudentT, type StudentTState } from "../planning/student-t-bnn";
import { WSet, RealAlgebra } from "./wset";
import { COMMON_SEED } from "../observe/phase-clock";
import { createSeededStream, type SeededStream } from "../chip8/seeded-rng";
import {
  createPerceptionState,
  perceive,
  relationBetween,
  type PerceptionState,
  type TrackedObject,
} from "../chip8/perception";
import {
  readScreenFoveated,
  COL_PITCH as OCR_COL_PITCH,
  GLYPH_H as OCR_GLYPH_H,
  type GlyphGrid,
  type ReadNumber,
} from "../chip8/ocr";
import {
  ModeValueLearner,
  type ModeBucket,
  type ModeChoice,
  type ModeValueSnapshot,
} from "./mode-value-learner";
import { TILE_COUNT, TileAttentionField, type AttentionSnapshot } from "./attention-field";
import { societyRho as computeSocietyRho, type SocietyRho } from "./society-rho";
import type { WhyContext } from "./why-chain";

export interface BnnPriors {
  explorationRate: number; // 0.0 - 1.0 (how uniform the distribution is)
  targetTrackingWeight: number; // 0.0 - 1.0 (how much to care about closing the distance)
}

export type AgentMode = "explore" | "hunt" | "flee";

/** Direction keys in the CHIP-8 convention this arena uses (2=up 8=down 4=left 6=right). */
const KEY_UP = 2;
const KEY_DOWN = 8;
const KEY_LEFT = 4;
const KEY_RIGHT = 6;
const DIRECTION_KEYS: readonly { key: number; dx: number; dy: number }[] = [
  { key: KEY_UP, dx: 0, dy: -1 },
  { key: KEY_DOWN, dx: 0, dy: 1 },
  { key: KEY_LEFT, dx: -1, dy: 0 },
  { key: KEY_RIGHT, dx: 1, dy: 0 },
];

/** Ticks of purposeful exploration before the mode latch may engage. */
export const EXPLORE_TICKS = 240;
/** Dwell per probed direction during exploration (long enough to see motion). */
const EXPLORE_DWELL = 12;
/** Hysteresis: threat evidence must persist this many net ticks to flip mode. */
const MODE_HYSTERESIS = 8;
/** An adversary blob at or above this area is read as "the hunter shape". */
const HUNTER_AREA_MIN = 10;
/** Closing-speed (px/tick) above which the gap counts as shrinking. */
const CLOSING_SPEED_MIN = 0.05;
/** D2: tiles granted full perception per tick (tunable, displayed on the page). */
export const ATTENTION_TOP_K = 8;
/** D2: a reading change below this is noise, not useful work. */
const USEFUL_WORK_EPS = 0.5;
/** D4: ticks a candidate must hold top rank before the fixation moves. */
const FIXATION_MIN_DELAY = 6;
/** Obstacle lookahead distance (pixels) for steering penalties. */
const LOOKAHEAD = 6;
/**
 * Hysteresis on the IDENTITY latch: a challenger must out-score the held body
 * by this margin before it takes over. Same Schmitt-trigger idiom as
 * MODE_HYSTERESIS, and bought for the same reason — motor smoothing, not
 * policy. Without it the self flickers between two near-tied tracks and the
 * steering vector thrashes every tick.
 */
const SELF_LATCH_MARGIN = 1.0;
/**
 * The most a score may move in one reading. Not a tuned threshold — it is the
 * cart's own arithmetic: `ADD V5, 1` / `ADD V9, 1`, counters that never reset
 * and never decrement. See `absorbScoreboardReward`.
 */
const SCORE_MAX_STEP = 1;
/**
 * Exponential forgetting on the per-key beliefs — the fix for a HABIT that
 * outlived its evidence.
 *
 * MEASURED DEFECT (2026-08-24). `updateStudentT` accumulates with no decay, so
 * a key's posterior mean is an average over ALL history. The arena is 64×32 —
 * twice as wide as it is tall — so the desired vector's |dx| (mean 0.863)
 * dominates its |dy| (mean 0.395) permanently, and the society converged to
 * RIGHT μ=0.391, LEFT μ=0.302, DOWN μ=0.118, UP μ=0.062. Over 1461 decision
 * ticks the steering layer asked for a VERTICAL move 188 times and the
 * consensus committed vertical ZERO times. The agent had learned "right is
 * usually good" and could no longer answer the geometry in front of it.
 *
 * Inflating the posterior variance before each absorption is the standard
 * fading-memory filter (Jazwinski 1970, *Stochastic Processes and Filtering
 * Theory* §7.3 — exponential age-weighting of past data): old evidence stays,
 * but it grows less certain, so present evidence can move the mean. Same
 * discipline the tile attention field already earned (FORGET there = 0.98).
 */
const KEY_BELIEF_FORGET = 0.90;
/** Never let a belief's variance inflate past this — forgetting, not amnesia. */
const KEY_BELIEF_MAX_SIGMA2 = 4.0;

/** Serializable snapshot of the society — the priors that live in source. */
export interface SocietySnapshot {
  /** v1: keys only. v2: + the learned hunt/flee table. v3: + the tile attention field. */
  readonly version: 1 | 2 | 3;
  readonly seed: number;
  readonly agentCount: number;
  /** Per agent, per key (-1..15): the EP posterior. */
  readonly agents: readonly {
    readonly beliefs: readonly {
      readonly key: number;
      readonly mu: number;
      readonly sigma2: number;
      readonly nu: number;
      readonly obsCount: number;
    }[];
  }[];
  /** Exploration already performed — restored runs skip what was learned. */
  readonly exploreTicksDone: number;
  readonly priors: BnnPriors;
  /** v2: the learned mode policy (absent in v1 snapshots — fresh prior then). */
  readonly modeValues?: ModeValueSnapshot;
  /** v3: the tile attention field (absent before v3 — fresh prior then). */
  readonly attention?: AttentionSnapshot;
}

export class BnnSocietyPredictor {
  private priors: BnnPriors = {
    explorationRate: 0.1,
    targetTrackingWeight: 0.9,
  };

  private agents: Map<string, Record<number, StudentTState>> = new Map();
  public agentCount: number;

  private readonly seed: number;
  private rng: SeededStream;

  // ── Forced-layer state (all inspectable) ─────────────────────────────────
  public lastPerception: PerceptionState = createPerceptionState();
  public lastOcr: readonly ReadNumber[] = [];
  public lastSelfId: number | null = null;
  public lastAdversaryId: number | null = null;
  public lastMode: AgentMode = "explore";
  /** The steering vector the policy wanted (before EP smoothing), for the UI. */
  public lastDesired: { dx: number; dy: number } | null = null;

  private tickCount = 0;
  private exploreTicksDone = 0;
  /** Accumulated key↔motion correlation per track id (the empowerment probe). */
  private selfEvidence: Map<number, number> = new Map();
  /** Net threat evidence for the Schmitt-trigger mode latch. */
  private threatCharge = 0;

  /**
   * Layer 6, learned: the hunt/flee policy as per-context value posteriors,
   * rewarded by the OCR scoreboards (layer 4 is the reward sensor). The old
   * hardcoded rule survives only as this learner's PRIOR.
   */
  public readonly modeLearner = new ModeValueLearner();
  /** Last OCR scoreboard readings, for delta→reward detection. */
  private prevMyScore: number | null = null;
  private prevTheirScore: number | null = null;
  /** Last tick's raw OCR readings — the two-tick-agreement staging slot. */
  private pendingMyScore: number | null = null;
  private pendingTheirScore: number | null = null;
  /** Track ids ever seen inside OCR-recognised numbers (readout, not agents).
   *  Sticky for the track's lifetime: the OCR misses a tick exactly when a
   *  digit is mid-redraw — which is exactly when the digit track glitches. */
  private readonly scoreboardTrackIds = new Set<number>();
  /** Identity committed at the end of exploration; re-elected only if the
   *  track dies. A pursuer MIMICS your motion during a straight chase, so
   *  correlation evidence alone will eventually crown the chaser — identity
   *  has to persist through the degenerate stretches. */
  private committedSelfId: number | null = null;
  /** Appearance continuity for re-election after the committed track dies. */
  private committedSelfColor: number | null = null;
  /** The context bucket the last mode decision was made in (UI + tests). */
  public lastModeBucket: ModeBucket | null = null;
  /**
   * D5: the self↔adversary relation AS USED by the last mode decision —
   * stored at the decision site so the WHY chain cites the numbers that
   * actually drove the latch, not a later recomputation.
   */
  public lastRelation: { readonly dist: number; readonly closingSpeed: number } | null = null;

  /**
   * The tile attention field (D1 of #14503) — per-tile uncertainty on the
   * same Student-t carrier as every other belief, part of this society's
   * snapshot (v3). Its posterior variance is the frost channel; its top-K
   * is where the foveated OCR spends full perception.
   */
  public readonly attentionField = new TileAttentionField();
  /** The tiles fully attended this tick (top-K by variance + the sweep tile). */
  public lastAttendedTiles: readonly number[] = [];
  /**
   * D2's meter: OCR match attempts that CHANGED a reading, over attempts —
   * or "ambiguous" when the variance field is flat and the allocator had no
   * signal (the loud half: a quiet fallback would report the attentive
   * system and the blind one identically).
   */
  public lastUsefulWork: number | "ambiguous" = "ambiguous";
  /** Per-cell previous OCR reading ("x,y" → glyph value), for the meter. */
  private prevGlyphAt = new Map<string, number>();
  /** Tiles that have ever held a recognised glyph — instruments, always read. */
  private readonly knownGlyphTiles = new Set<number>();
  /**
   * D4: the fixation tile — top-variance tile held through a dwell latch.
   * The same suppress-inside-MinDelay shape as src/Core/DebouncedOracle.fs:
   * a candidate must hold top rank for FIXATION_MIN_DELAY consecutive ticks
   * before the fixation MOVES (the move is the saccade the UI sweeps).
   */
  public lastFixationTile: number | null = null;
  private fixationCandidate: number | null = null;
  private fixationCharge = 0;

  constructor(agentCount: number = 3, seed: number = COMMON_SEED) {
    this.agentCount = agentCount;
    this.seed = seed | 0;
    this.rng = createSeededStream(this.seed, 1);
    this.initializeSociety();
  }

  private initializeSociety() {
    for (let i = 0; i < this.agentCount; i++) {
      const agentBeliefs: Record<number, StudentTState> = {};
      for (let k = -1; k <= 0xf; k++) {
        const diversityVariance = 1.0 + this.rng.next() * 0.5;
        agentBeliefs[k] = createStudentTState(4.0, 0.0, diversityVariance, 0.1);
      }
      this.agents.set(`agent_${i}`, agentBeliefs);
    }
  }

  public setPriors(priors: Partial<BnnPriors>) {
    this.priors = { ...this.priors, ...priors };
  }

  public getPriors(): BnnPriors {
    return this.priors;
  }

  // ── Priors in source: snapshot / restore ─────────────────────────────────

  public exportSnapshot(): SocietySnapshot {
    const agents: SocietySnapshot["agents"][number][] = [];
    for (const beliefs of this.agents.values()) {
      const rows: { key: number; mu: number; sigma2: number; nu: number; obsCount: number }[] = [];
      for (let k = -1; k <= 0xf; k++) {
        const s = beliefs[k]!;
        rows.push({
          key: k,
          mu: s.posterior.mu,
          sigma2: s.posterior.sigma2,
          nu: s.nu,
          obsCount: s.obsCount,
        });
      }
      agents.push({ beliefs: rows });
    }
    return {
      version: 3,
      seed: this.seed,
      agentCount: this.agentCount,
      agents,
      exploreTicksDone: this.exploreTicksDone,
      priors: { ...this.priors },
      modeValues: this.modeLearner.exportSnapshot(),
      attention: this.attentionField.exportSnapshot(),
    };
  }

  /**
   * Restore a snapshot (committed priors). Restored posteriors replace the
   * fresh ones; exploration already performed is not repeated — that is the
   * whole point of priors in source: never starting from zero.
   */
  public importSnapshot(snap: SocietySnapshot): void {
    if (snap.version !== 1 && snap.version !== 2 && snap.version !== 3) throw new RangeError(`unknown SocietySnapshot version ${String((snap as { version: unknown }).version)}`);
    const agentEntries = [...this.agents.values()];
    for (let i = 0; i < Math.min(agentEntries.length, snap.agents.length); i++) {
      const beliefs = agentEntries[i]!;
      for (const row of snap.agents[i]!.beliefs) {
        if (!Number.isFinite(row.nu) || row.nu <= 0) {
          throw new RangeError(`snapshot nu for key ${row.key} must be finite and > 0`);
        }
        const fresh = beliefs[row.key];
        beliefs[row.key] = {
          posterior: { mu: row.mu, sigma2: row.sigma2 },
          factorMu: row.mu,
          factorSigma2: Number.POSITIVE_INFINITY,
          nu: row.nu,
          obsVariance: fresh?.obsVariance ?? 0.1,
          obsCount: row.obsCount,
        } as StudentTState;
      }
    }
    this.exploreTicksDone = snap.exploreTicksDone;
    this.priors = { ...snap.priors };
    // v1 snapshots carry no mode table: the learner stays at its prior,
    // which reproduces the retired hardcoded rule exactly.
    if (snap.modeValues) this.modeLearner.importSnapshot(snap.modeValues);
    if (snap.attention) this.attentionField.importSnapshot(snap.attention);
  }

  // ── Layer 4→6 bridge: the OCR scoreboards are the reward sensor ──────────

  private absorbScoreboardReward(): void {
    /**
     * A score is a COUNTER: it may hold, or rise by exactly one. It can never
     * fall and never leap. A reading that violates that is a corrupted glyph,
     * not a score. (`null` on either side means "no reading", which is not a
     * violation — the caller already skips those.)
     */
    const plausibleScoreStep = (now: number | null, prev: number | null): boolean =>
      now === null || prev === null || (now - prev >= 0 && now - prev <= SCORE_MAX_STEP);
    // The cart draws MY score in color 2 and THEIRS in color 1 (and the OCR
    // grid carries colors). Missing readings (mid-tag redraw, win flood) skip
    // the tick rather than fabricate a delta.
    const mineRaw = this.lastOcr.find((n) => n.color === 2)?.value ?? null;
    const theirsRaw = this.lastOcr.find((n) => n.color === 1)?.value ?? null;
    // Two-tick agreement: a digit sampled mid-XOR-redraw (or brushed by a
    // passing sprite) can template-match the WRONG value for one tick. A
    // reading becomes the score only after being seen twice in a row; the
    // eligibility trace absorbs the one-tick reporting delay.
    const mine = mineRaw !== null && mineRaw === this.pendingMyScore ? mineRaw : null;
    const theirs = theirsRaw !== null && theirsRaw === this.pendingTheirScore ? theirsRaw : null;
    this.pendingMyScore = mineRaw;
    this.pendingTheirScore = theirsRaw;
    // MEASURED DEFECT (2026-08-24): the two-tick agreement above catches a
    // one-tick flicker and is BLIND TO A TWO-TICK ONE — a stable misread is
    // "seen twice in a row" and is therefore certified as the score. Live on
    // main: with the true score sitting at 0:3 for a thousand ticks, the AI
    // brushing the top-right digit made it template-match 9 for exactly two
    // ticks, so the learner absorbed r = -6 and then +6 about every sixteen
    // ticks. The pair sums to zero and does NOT cancel, because each half is
    // credited against different eligibility-trace contents. Measured over
    // 12 runs at shipped settings: 2 fabricated 8 and 2 phantom rewards
    // against 5 and 3 real ones. 3 and 9 differ by one stroke in a 3x5 glyph,
    // which is why that pair is the one that shows up.
    //
    // The guard is the cart's OWN arithmetic, not a tuned threshold: both
    // scores are counters (`ADD V5, 1` / `ADD V9, 1` in mutual-sim.ts), never
    // reset and never decremented, so a delta outside {0, +1} did not come
    // from the game. Distrust the READING rather than believe an impossible
    // score — and crucially do not let it become the new baseline, or the
    // return to the true value reads as a second impossible jump.
    if (!plausibleScoreStep(mine, this.prevMyScore) || !plausibleScoreStep(theirs, this.prevTheirScore)) {
      return;
    }
    if (mine !== null && this.prevMyScore !== null && theirs !== null && this.prevTheirScore !== null) {
      const r = mine - this.prevMyScore - (theirs - this.prevTheirScore);
      if (r !== 0) this.modeLearner.reward(r);
    }
    if (mine !== null) this.prevMyScore = mine;
    if (theirs !== null) this.prevTheirScore = theirs;
  }

  /**
   * D2's meter, both halves of Aaron's meter spec: measure precisely (a
   * reading-change fraction over actual match attempts) and fail loudly
   * (a flat variance field gives the allocator NO signal, so the meter says
   * `ambiguous` instead of quietly printing a number over uniform sampling).
   * "Useful" = an attempted cell whose recognised value appeared or changed;
   * disappearances are not counted (the cell is simply absent), which is
   * stated here so the meter's blind spot is on the record.
   */
  private updateUsefulWorkMeter(scan: { readonly grid: GlyphGrid; readonly attempts: number }): void {
    if (this.attentionField.isFlat()) {
      this.lastUsefulWork = "ambiguous";
      return;
    }
    let changed = 0;
    for (const cell of scan.grid.cells) {
      const key = `${String(cell.x)},${String(cell.y)}`;
      const val = parseInt(cell.char, 16);
      const prev = this.prevGlyphAt.get(key);
      if (prev === undefined || Math.abs(val - prev) >= USEFUL_WORK_EPS) changed += 1;
      this.prevGlyphAt.set(key, val);
    }
    this.lastUsefulWork = scan.attempts > 0 ? changed / scan.attempts : 0;
  }

  /**
   * D4: fixation moves only after a new top-variance tile holds its rank
   * for FIXATION_MIN_DELAY consecutive ticks — the suppress-inside-MinDelay
   * split of src/Core/DebouncedOracle.fs, one granularity down: readings
   * inside the delay are the SACCADE (prediction step, the UI's fast dim
   * sweep); the accepted move is the FIXATION (update step, bright settle).
   */
  private updateFixation(): void {
    const top = this.attentionField.topK(1)[0];
    if (top === undefined) return;
    if (top === this.lastFixationTile) {
      this.fixationCandidate = null;
      this.fixationCharge = 0;
      return;
    }
    if (top === this.fixationCandidate) {
      this.fixationCharge += 1;
      if (this.fixationCharge >= FIXATION_MIN_DELAY || this.lastFixationTile === null) {
        this.lastFixationTile = top; // the saccade lands
        this.fixationCandidate = null;
        this.fixationCharge = 0;
      }
    } else {
      this.fixationCandidate = top;
      this.fixationCharge = 1;
    }
  }

  /**
   * One standard-normal draw from the society's own seeded stream
   * (Box–Muller). Exposed so the live fusion can Thompson-sample without
   * reaching for ambient entropy — same seed, same run, same keys.
   */
  public gaussianDraw(): number {
    const u1 = Math.max(1e-9, this.rng.next());
    const u2 = this.rng.next();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  /** Measured belief-similarity between society members (never assumed). */
  public societyRho(): SocietyRho {
    const vectors: number[][] = [];
    for (const beliefs of this.agents.values()) {
      const v: number[] = [];
      for (let k = -1; k <= 0xf; k++) v.push(beliefs[k]!.posterior.mu);
      vectors.push(v);
    }
    return computeSocietyRho(vectors);
  }

  /**
   * D5 (#14503): the state that drove THIS tick's decision, assembled for
   * the WHY chain. Every value is read from the live deciding state — the
   * latch's mode and bucket, the learner's posterior means and reward
   * count, the relation stored AT the decision site, the fixation tile
   * with its current predictive variance. Plain data: it rides the frame
   * payload verbatim, so the UI's answers cite exactly what the wire
   * carried (the acceptance test asserts the round-trip).
   */
  public whyContext(): WhyContext {
    const bucket = this.lastModeBucket;
    return {
      mode: this.lastMode,
      bucket: bucket ? { bigAdversary: bucket.bigAdversary, closing: bucket.closing } : null,
      huntValue: bucket ? this.modeLearner.valueOf(bucket, "hunt") : null,
      fleeValue: bucket ? this.modeLearner.valueOf(bucket, "flee") : null,
      rewardEvents: this.modeLearner.rewardEvents,
      adversary: this.lastRelation,
      explore: { done: Math.min(this.exploreTicksDone, EXPLORE_TICKS), total: EXPLORE_TICKS },
      fixation:
        this.lastFixationTile !== null
          ? {
              tile: this.lastFixationTile,
              variance: this.attentionField.varianceAt(this.lastFixationTile),
            }
          : null,
    };
  }

  /**
   * Layer 4 informing layer 5: tracks whose centroid sits inside an
   * OCR-recognised number's glyph box are READOUT, not agents — they can
   * never be self or the adversary. (Before this, a scoreboard digit that
   * got brushed by the player once counted as "moved" and was then chased
   * as the adversary for thousands of ticks.)
   */
  private markScoreboardTracks(): void {
    if (this.lastOcr.length === 0) return;
    for (const t of this.lastPerception.tracks) {
      for (const n of this.lastOcr) {
        const x0 = n.col - 1;
        const x1 = n.col + n.digits * OCR_COL_PITCH;
        const y0 = n.row - 1;
        const y1 = n.row + OCR_GLYPH_H;
        if (t.cx >= x0 && t.cx <= x1 && t.cy >= y0 && t.cy <= y1) {
          this.scoreboardTrackIds.add(t.id);
          break;
        }
      }
    }
  }

  // ── Layer 5: which object is me? (empowerment probe) ────────────────────

  /**
   * The empowerment probe, BOTH branches.
   *
   * What separates my body from everything else is CONTINGENCY, not
   * correlation: it moves when I command it *and holds still when I do not*.
   * Measuring only the commanded branch measures half a channel, and the half
   * it drops is the half that matters here — the AI opponent CHASES me, so
   * when I move right it moves right too and scores as well as I do on
   * agreement alone. It cannot fake the other branch: it keeps moving on the
   * ticks I command nothing, and I do not. (Measured: with the commanded
   * branch only, track #69 — the c3 opponent — held the body at t2999 while
   * the real player sat at evidence 6.99, labelled adversary.)
   *
   * Anchors: Klyubin, Polani & Nehaniv, *Empowerment: A Universal
   * Agent-Centric Measure of Control* (IEEE CEC 2005) — empowerment is the
   * channel capacity from actuators to sensors, and a channel is defined by
   * what it does across ALL inputs including the null one; Watson (1966,
   * 1994) on contingency detection as the infant's self-recognition cue.
   */
  private updateSelfEvidence(pressedKey: number | undefined): void {
    const dir =
      pressedKey === undefined ? undefined : DIRECTION_KEYS.find((d) => d.key === pressedKey);
    // A non-direction key commands nothing about movement — no reading either
    // way. Distinct from `undefined`, which is the null action and IS a reading.
    if (pressedKey !== undefined && !dir) return;
    for (const t of this.lastPerception.tracks) {
      const speed = Math.hypot(t.vx, t.vy);
      if (speed < 1e-3) continue; // held still: expected under the null action,
      // and unreadable under a commanded one (a wall I pushed into looks the
      // same as a body that ignored me). Either way, no evidence.
      const prev = this.selfEvidence.get(t.id) ?? 0;
      // Reward agreement, decay disagreement — a leaky accumulator. Motion
      // under the NULL action is full disagreement: nothing I did caused it.
      const reading = dir ? (t.vx / speed) * dir.dx + (t.vy / speed) * dir.dy : -1;
      this.selfEvidence.set(t.id, prev * 0.95 + reading);
    }
  }

  /**
   * MEASURED DEFECT (2026-08-24), and the reason this reads the way it does.
   *
   * The previous version committed the body on a CLOCK
   * (`exploreTicksDone >= EXPLORE_TICKS`) and `mutual-sim.priors` bakes
   * `exploreTicksDone: 240` into its snapshot — so exploration was already
   * spent before tick 0 and the election was final on the FIRST tick that had
   * any track at all. On tick 1 the only things drawn are the two walls (the
   * player and the AI first appear on tick 2), so the agent committed to
   * WALL 1 at (34,12), with `committedSelfColor = 1`. That second field then
   * sealed it: `elect(committedSelfColor) ?? elect(null)` only falls through
   * when the colour-filtered election finds NOTHING, and a wall is always on
   * screen — so the unfiltered election was unreachable for the rest of the
   * run. At t239 the real player carried empowerment evidence 15.06 and was
   * labelled the ADVERSARY while a wall with evidence 0.00 stayed "self", and
   * every hunt/flee vector for 3000 ticks was steered from a wall's position.
   *
   * Three changes, all the same correction — the probe, not a clock or a
   * costume, says which body is mine:
   *   1. commit only once `selfEvidence` is actually POSITIVE;
   *   2. colour is a tie-break BONUS, never a filter, so a wrong commitment
   *      can be escaped;
   *   3. the latch is revisable — a challenger that out-scores the held body
   *      by SELF_LATCH_MARGIN takes it, and since the evidence accumulator
   *      leaks (×0.95) a wrong self decays out on its own.
   */
  private pickSelf(): TrackedObject | null {
    const candidates = this.lastPerception.tracks.filter(
      (t) => !this.scoreboardTrackIds.has(t.id), // readout, not an agent
    );
    if (candidates.length === 0) return null;

    // Snapshot the continuity colour so the mutations below cannot change
    // this tick's scoring under it.
    const continuityColor = this.committedSelfColor;
    // Correlation evidence (the empowerment probe) leads. The plane-2 prior
    // and the appearance-continuity bonus are PRIORS: they break ties before
    // any evidence exists and are dominated by it afterwards. A STILL self
    // stays selectable — standing still is a legal move.
    const scoreOf = (t: TrackedObject): number =>
      (this.selfEvidence.get(t.id) ?? 0) +
      (t.color === 2 ? 0.5 : 0) +
      (continuityColor !== null && t.color === continuityColor ? 0.25 : 0) -
      (t.isStatic && !t.everMoved ? 0.25 : 0);

    let best = candidates[0]!;
    let bestScore = scoreOf(best);
    for (const t of candidates) {
      const score = scoreOf(t);
      if (score > bestScore || (score === bestScore && t.id < best.id)) {
        best = t;
        bestScore = score;
      }
    }

    if (this.committedSelfId !== null) {
      const held = candidates.find((t) => t.id === this.committedSelfId);
      if (held) {
        // Latched while it remains the best-supported body (coasting included).
        if (bestScore < scoreOf(held) + SELF_LATCH_MARGIN) return held;
        // Out-evidenced: the appearance we were following was wrong too, so
        // the continuity bonus goes with it.
        this.committedSelfId = null;
        this.committedSelfColor = null;
      } else {
        // The track merely DIED (a seam crossing, a win flood). Keep the
        // colour — the returning body wears the same costume.
        this.committedSelfId = null;
      }
    }

    // Commit only once the probe has SPOKEN. A clock cannot know which body
    // is mine; only motion that answered to my own keys can.
    if ((this.selfEvidence.get(best.id) ?? 0) > 0) {
      this.committedSelfId = best.id;
      this.committedSelfColor = best.color;
    }
    return best;
  }

  private pickAdversary(self: TrackedObject | null): TrackedObject | null {
    if (!self) return null;
    // Pass 1: nearest PROVEN agent currently in motion. everMoved (travelled
    // ≥ MOVED_DIST_MIN from birth) gates out the two impostor classes: a
    // fresh XOR/seam fragment of a sprite ("currently moving" for its first
    // STATIC_AGE ticks by definition) and furniture wiggling when brushed.
    let best: TrackedObject | null = null;
    let bestDist = Infinity;
    for (const t of this.lastPerception.tracks) {
      if (t.id === self.id) continue;
      if (this.scoreboardTrackIds.has(t.id)) continue; // readout, not an agent
      if (t.isStatic || !t.everMoved) continue;
      const d = Math.hypot(t.cx - self.cx, t.cy - self.cy);
      if (d < bestDist || (d === bestDist && best !== null && t.id < best.id)) {
        bestDist = d;
        best = t;
      }
    }
    if (best) return best;
    // Pass 2: the lurker holding still — the track that has TRAVELLED
    // farthest from its birth spot. Furniture oscillates around a fixed
    // point however often it is brushed; an agent has been somewhere else.
    let bestRange = 0;
    for (const t of this.lastPerception.tracks) {
      if (t.id === self.id) continue;
      if (this.scoreboardTrackIds.has(t.id)) continue;
      if (!t.everMoved) continue;
      const d = Math.hypot(t.cx - self.cx, t.cy - self.cy);
      if (
        t.farthest > bestRange ||
        (t.farthest === bestRange && best !== null && (d < bestDist || (d === bestDist && t.id < best.id)))
      ) {
        bestRange = t.farthest;
        bestDist = d;
        best = t;
      }
    }
    return best;
  }

  // ── Layer 6: the mode latch ──────────────────────────────────────────────

  private updateMode(self: TrackedObject | null, adversary: TrackedObject | null): void {
    if (this.exploreTicksDone < EXPLORE_TICKS) {
      this.lastMode = "explore";
      this.lastRelation = null;
      return;
    }
    if (!self || !adversary) {
      // Nothing to hunt or flee; hold the previous non-explore mode.
      this.lastModeBucket = null;
      this.lastRelation = null;
      if (this.lastMode === "explore") this.lastMode = "hunt";
      return;
    }
    // The CONTEXT is engineered (layers 1–3 discretised into a bucket); the
    // DECISION is learned: the learner's value posteriors, rewarded by the
    // OCR scoreboards, say which mode this context is worth. The retired
    // hardcoded rule (big→flee, small→hunt) persists only as the learner's
    // prior, so a cart with no score events behaves as before.
    const rel = relationBetween(this.lastPerception, self.id, adversary.id);
    this.lastRelation = rel ? { dist: rel.dist, closingSpeed: rel.closingSpeed } : null;
    const closing = rel ? rel.closingSpeed : 0;
    const bucket: ModeBucket = {
      bigAdversary: adversary.area >= HUNTER_AREA_MIN,
      // Sprites cover ~1 px per game frame and a tick samples a fraction of
      // a frame, so real approach speeds sit near 0.1–0.3 px/tick — the
      // threshold must be well under that or the closing bucket never fills.
      closing: closing > CLOSING_SPEED_MIN,
    };
    this.lastModeBucket = bucket;
    const preferred: ModeChoice = this.modeLearner.choose(bucket);
    this.threatCharge = Math.max(
      -MODE_HYSTERESIS,
      Math.min(MODE_HYSTERESIS, this.threatCharge + (preferred === "flee" ? 1 : -1)),
    );
    if (this.lastMode === "explore") this.lastMode = this.threatCharge > 0 ? "flee" : "hunt";
    else if (this.threatCharge >= MODE_HYSTERESIS) this.lastMode = "flee";
    else if (this.threatCharge <= -MODE_HYSTERESIS) this.lastMode = "hunt";
    // Between the rails: keep the latched mode (motor smoothing, not policy).

    // Credit goes to the mode actually EXECUTED in this context.
    if (this.lastMode === "hunt" || this.lastMode === "flee") {
      this.modeLearner.record(bucket, this.lastMode);
    }
  }

  // ── Layer 7: geometry-aware steering ─────────────────────────────────────

  /** Penalty if moving from `self` along (dx,dy) runs into scenery or the edge. */
  private obstaclePenalty(self: TrackedObject, dx: number, dy: number): number {
    const px = self.cx + dx * LOOKAHEAD;
    const py = self.cy + dy * LOOKAHEAD;
    if (px < 1 || px > 62 || py < 1 || py > 30) return 0.6; // screen edge
    for (const t of this.lastPerception.tracks) {
      if (!t.isStatic) continue;
      if (
        px >= t.minX - 1 &&
        px <= t.maxX + 1 &&
        py >= t.minY - 1 &&
        py <= t.maxY + 1
      ) {
        return 0.8; // static obstacle in the path
      }
    }
    return 0;
  }

  /**
   * Calculates the probability distribution for all 16 hex keys (+ -1 No-Op)
   * through the forced layers, smoothed by WSet Comonoid consensus.
   *
   * `pressedKey` is the key actually committed last tick — it feeds the
   * self-identification probe (layer 5). Omitting it degrades gracefully to
   * the color prior.
   */
  public predict(display: number[], pressedKey?: number): Record<number, number> {
    this.tickCount += 1;

    // Layers 1–3: objects, tracks, relations. The connected-component pass
    // stays GLOBAL deliberately: field coherence is a global property and a
    // local check cannot see it (#14503 session-context §1) — foveation
    // applies one layer up, where work is per-tile.
    this.lastPerception = perceive(this.lastPerception, display);

    // D1: the tile attention field absorbs the same composite every tick
    // (the cheap path runs everywhere; only FULL perception is rationed).
    this.attentionField.observe(display);
    // D2: full OCR on the top-K variance tiles, plus one deterministic
    // peripheral-sweep tile per tick so no tile can starve into a stale
    // belief (tick-indexed, no ambient entropy), plus every tile that has
    // EVER held a recognised glyph: a discovered scoreboard is an
    // INSTRUMENT, and an instrument sampled one tick in thirty-two cannot
    // produce the consecutive readings the reward channel's two-tick
    // agreement requires. The sweep discovers instruments; stickiness keeps
    // them read.
    const attended = new Set<number>(this.attentionField.topK(ATTENTION_TOP_K));
    attended.add(this.tickCount % TILE_COUNT);
    for (const t of this.knownGlyphTiles) attended.add(t);
    this.lastAttendedTiles = [...attended].sort((a, b) => a - b);

    // Layer 4: symbols — and the reward channel: score deltas grade the mode.
    const scan = readScreenFoveated(display, attended);
    this.lastOcr = scan.numbers;
    for (const cell of scan.grid.cells) {
      this.knownGlyphTiles.add(((cell.y / 8) | 0) * 8 + ((cell.x / 8) | 0));
    }
    this.updateUsefulWorkMeter(scan);
    this.updateFixation();
    this.absorbScoreboardReward();
    this.markScoreboardTracks();
    // Layer 5: roles.
    this.updateSelfEvidence(pressedKey);
    const self = this.pickSelf();
    const adversary = this.pickAdversary(self);
    this.lastSelfId = self?.id ?? null;
    this.lastAdversaryId = adversary?.id ?? null;
    // Layer 6: mode.
    if (this.exploreTicksDone < EXPLORE_TICKS) this.exploreTicksDone += 1;
    this.updateMode(self, adversary);

    // Layer 7: policy → per-key observations.
    const observations: Record<number, number> = {};
    for (let i = -1; i <= 0xf; i++) {
      observations[i] = this.rng.next() * this.priors.explorationRate * 0.1; // baseline noise (seeded)
    }
    observations[-1] = (observations[-1] ?? 0) + 0.5; // prefer stillness absent a reason to move

    this.lastDesired = null;

    if (this.lastMode === "explore") {
      // Purposeful exploration: probe each direction in a fixed rota so the
      // self-evidence accumulator can see which object answers to our keys.
      const probe = DIRECTION_KEYS[Math.floor(this.exploreTicksDone / EXPLORE_DWELL) % DIRECTION_KEYS.length]!;
      observations[probe.key] = (observations[probe.key] ?? 0) + this.priors.targetTrackingWeight;
      observations[-1] = 0.05;
      this.lastDesired = { dx: probe.dx, dy: probe.dy };
    } else if (self && adversary) {
      const dx = adversary.cx - self.cx;
      const dy = adversary.cy - self.cy;
      const dist = Math.hypot(dx, dy);
      if (dist > 0) {
        const sign = this.lastMode === "flee" ? -1 : 1;
        const desired = { dx: (dx / dist) * sign, dy: (dy / dist) * sign };
        this.lastDesired = desired;
        for (const d of DIRECTION_KEYS) {
          const align = d.dx * desired.dx + d.dy * desired.dy;
          if (align <= 0) continue;
          const penalty = this.obstaclePenalty(self, d.dx, d.dy);
          const weight = Math.max(0, align - penalty) * this.priors.targetTrackingWeight;
          observations[d.key] = (observations[d.key] ?? 0) + weight;
        }
        // If every aligned direction was blocked, sidestep: score the two
        // orthogonal directions by obstacle clearance alone.
        const anyForward = DIRECTION_KEYS.some(
          (d) => d.dx * desired.dx + d.dy * desired.dy > 0 && this.obstaclePenalty(self, d.dx, d.dy) === 0,
        );
        if (!anyForward) {
          for (const d of DIRECTION_KEYS) {
            const align = d.dx * desired.dx + d.dy * desired.dy;
            if (align > 0) continue;
            const penalty = this.obstaclePenalty(self, d.dx, d.dy);
            observations[d.key] = (observations[d.key] ?? 0) + Math.max(0, 0.5 - penalty) * this.priors.targetTrackingWeight;
          }
        }
        observations[-1] = 0.05; // moving with purpose — stillness demoted
      }
    }

    // EP smoothing: each agent absorbs the observation with its own seeded
    // subjective noise; the WSet comonoid consolidates the society.
    const agentWSets: WSet<number, number>[] = [];
    for (const beliefs of this.agents.values()) {
      const wsetEntries: { key: number; weight: number }[] = [];
      for (let k = -1; k <= 0xf; k++) {
        const obsValue = observations[k] ?? 0.0;
        const y = obsValue + (this.rng.next() - 0.5) * 0.05;
        // Forget before absorbing: age the belief's certainty so the present
        // observation can still move it (see KEY_BELIEF_FORGET).
        const aged = beliefs[k]!;
        const faded: StudentTState = {
          ...aged,
          posterior: {
            mu: aged.posterior.mu,
            sigma2: Math.min(KEY_BELIEF_MAX_SIGMA2, aged.posterior.sigma2 / KEY_BELIEF_FORGET),
          },
        };
        const result = updateStudentT(faded, y);
        beliefs[k] = result.state;
        const weight = Math.max(0, result.state.posterior.mu);
        wsetEntries.push({ key: k, weight });
      }
      agentWSets.push(new WSet(RealAlgebra, wsetEntries));
    }

    const allEntries: { key: number; weight: number }[] = [];
    for (const wset of agentWSets) {
      allEntries.push(...wset.entries);
    }
    const unifiedSet = new WSet(RealAlgebra, allEntries);
    const consensusSet = unifiedSet.consolidate();

    // Normalize with a NaN/degenerate guard: a distribution that cannot be
    // normalized honestly is reported as uniform, never as NaN (a NaN here
    // freezes the dashboard downstream — observed live, now impossible).
    const consensusProbs: Record<number, number> = {};
    for (let i = -1; i <= 0xf; i++) consensusProbs[i] = 0.0;

    let sum = 0;
    for (const entry of consensusSet.entries) {
      const w = entry.weight / this.agentCount;
      consensusProbs[entry.key] = w + this.priors.explorationRate / 16;
      sum += consensusProbs[entry.key]!;
    }

    if (!Number.isFinite(sum) || sum <= 0) {
      const uniform = 1 / 17;
      for (let i = -1; i <= 0xf; i++) consensusProbs[i] = uniform;
      return consensusProbs;
    }
    for (let i = -1; i <= 0xf; i++) {
      const p = consensusProbs[i]! / sum;
      consensusProbs[i] = Number.isFinite(p) ? p : 0;
    }
    return consensusProbs;
  }
}

/**
 * Commit to a key by POSTERIOR SAMPLING (Thompson 1933; Russo, Van Roy,
 * Kazerouni, Osband & Wen, *A Tutorial on Thompson Sampling*, FnT ML 2018,
 * arXiv:1707.02038) — draw one score per key from that key's own belief and
 * take the argmax OF THE DRAW.
 *
 * WHY THIS REPLACES A THRESHOLD, rather than tuning one. The live fusion asked
 * `maxProb > 0.4`, and the consensus distribution over 17 keys is bounded far
 * below that: measured over 900 post-exploration ticks the max was 0.3818
 * (p50 0.3433), so the gate was crossed **0 times** and the agent committed
 * nothing at all once its 300-tick explorer expired. The agent was six times
 * more confident than uniform (0.0588) and still structurally forbidden to
 * act. Lowering the constant would only move the cliff to the next cart; a
 * decision rule with no constant in it cannot have a cliff.
 *
 * It is also the honest JUMPSTART. Sampling spreads in proportion to the
 * belief's own uncertainty, so a cold agent explores because it is unsure and
 * a warm one commits because it is not — one rule, annealing itself, with no
 * explore/exploit switch to schedule and no game knowledge injected. The
 * spread is drawn from the predictor's seeded stream, so replay stays
 * byte-identical (noninterference §13: no ambient entropy).
 */
export function thompsonKeyOf(
  probs: Readonly<Record<number, number>>,
  draw: () => number,
): number {
  let bestScore = -Infinity;
  let bestKey = -1;
  for (let k = -1; k <= 0xf; k++) {
    const p = probs[k] ?? 0;
    // Bernoulli-style spread: a key's uncertainty is widest at p≈0.5 and
    // vanishes as the society approaches agreement either way.
    const sd = Math.sqrt(Math.max(1e-9, p * (1 - p)));
    const score = p + sd * draw();
    if (score > bestScore) {
      bestScore = score;
      bestKey = k;
    }
  }
  return bestKey;
}

/**
 * The direction key the predictor's own steering intent names, if any —
 * what a headless harness (trainer, tests) should press.
 *
 * HISTORICAL NOTE, kept because it names the defect this file now fixes: this
 * helper existed because "a bare argmax over 17 normalized keys rarely clears
 * a confidence threshold and the agent stands still". That was true, it was
 * measured, and the workaround was handed to the trainer while the LIVE agent
 * was left standing still. The gate is gone (see `thompsonKeyOf`); this stays
 * as the steering-intent accessor the WHY chain and the tests read.
 */
export function desiredKeyOf(p: BnnSocietyPredictor): number | undefined {
  const d = p.lastDesired;
  if (!d) return undefined;
  if (Math.abs(d.dx) >= Math.abs(d.dy)) return d.dx >= 0 ? 6 : 4;
  return d.dy >= 0 ? 8 : 2;
}
