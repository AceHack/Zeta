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
import { readScreen, COL_PITCH as OCR_COL_PITCH, GLYPH_H as OCR_GLYPH_H, type ReadNumber } from "../chip8/ocr";
import {
  ModeValueLearner,
  type ModeBucket,
  type ModeChoice,
  type ModeValueSnapshot,
} from "./mode-value-learner";

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
/** Obstacle lookahead distance (pixels) for steering penalties. */
const LOOKAHEAD = 6;

/** Serializable snapshot of the society — the priors that live in source. */
export interface SocietySnapshot {
  /** v1: keys only. v2: adds the learned hunt/flee value table. */
  readonly version: 1 | 2;
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
      version: 2,
      seed: this.seed,
      agentCount: this.agentCount,
      agents,
      exploreTicksDone: this.exploreTicksDone,
      priors: { ...this.priors },
      modeValues: this.modeLearner.exportSnapshot(),
    };
  }

  /**
   * Restore a snapshot (committed priors). Restored posteriors replace the
   * fresh ones; exploration already performed is not repeated — that is the
   * whole point of priors in source: never starting from zero.
   */
  public importSnapshot(snap: SocietySnapshot): void {
    if (snap.version !== 1 && snap.version !== 2) throw new RangeError(`unknown SocietySnapshot version ${String((snap as { version: unknown }).version)}`);
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
  }

  // ── Layer 4→6 bridge: the OCR scoreboards are the reward sensor ──────────

  private absorbScoreboardReward(): void {
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
    if (mine !== null && this.prevMyScore !== null && theirs !== null && this.prevTheirScore !== null) {
      const r = mine - this.prevMyScore - (theirs - this.prevTheirScore);
      if (r !== 0) this.modeLearner.reward(r);
    }
    if (mine !== null) this.prevMyScore = mine;
    if (theirs !== null) this.prevTheirScore = theirs;
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

  private updateSelfEvidence(pressedKey: number | undefined): void {
    if (pressedKey === undefined) return;
    const dir = DIRECTION_KEYS.find((d) => d.key === pressedKey);
    if (!dir) return;
    for (const t of this.lastPerception.tracks) {
      const speed = Math.hypot(t.vx, t.vy);
      if (speed < 1e-3) continue;
      const dot = (t.vx / speed) * dir.dx + (t.vy / speed) * dir.dy;
      // Reward agreement, decay disagreement — a leaky accumulator.
      const prev = this.selfEvidence.get(t.id) ?? 0;
      this.selfEvidence.set(t.id, prev * 0.95 + dot);
    }
  }

  private pickSelf(): TrackedObject | null {
    // Committed identity persists while its track lives (coasting included).
    if (this.committedSelfId !== null) {
      const alive = this.lastPerception.tracks.find((t) => t.id === this.committedSelfId);
      if (alive) return alive;
      this.committedSelfId = null; // track died — re-elect below
    }
    const elect = (colorFilter: number | null): TrackedObject | null => {
      let best: TrackedObject | null = null;
      let bestScore = -Infinity;
      for (const t of this.lastPerception.tracks) {
        if (this.scoreboardTrackIds.has(t.id)) continue; // readout, not an agent
        if (colorFilter !== null && t.color !== colorFilter) continue;
        // Correlation evidence (the empowerment probe), plus a small prior on
        // the player plane (color 2) so the first frames are not rudderless,
        // minus a nudge against furniture (static since birth, no evidence).
        // A STILL self stays selectable — standing still is a legal move.
        const evidence = this.selfEvidence.get(t.id) ?? 0;
        const score =
          evidence + (t.color === 2 ? 0.5 : 0) - (t.isStatic && !t.everMoved ? 0.25 : 0);
        if (score > bestScore || (score === bestScore && best !== null && t.id < best.id)) {
          bestScore = score;
          best = t;
        }
      }
      return best;
    };
    // Appearance continuity: after death (a seam crossing, a win flood), the
    // returning self WEARS THE SAME COLOR — prefer it before free election.
    const best =
      (this.committedSelfColor !== null ? elect(this.committedSelfColor) : null) ?? elect(null);
    // Elections stay open while the probe rota runs; the winner is committed
    // once exploration ends (chases are correlation-degenerate — see above).
    if (best && this.exploreTicksDone >= EXPLORE_TICKS) {
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
      return;
    }
    if (!self || !adversary) {
      // Nothing to hunt or flee; hold the previous non-explore mode.
      this.lastModeBucket = null;
      if (this.lastMode === "explore") this.lastMode = "hunt";
      return;
    }
    // The CONTEXT is engineered (layers 1–3 discretised into a bucket); the
    // DECISION is learned: the learner's value posteriors, rewarded by the
    // OCR scoreboards, say which mode this context is worth. The retired
    // hardcoded rule (big→flee, small→hunt) persists only as the learner's
    // prior, so a cart with no score events behaves as before.
    const rel = relationBetween(this.lastPerception, self.id, adversary.id);
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

    // Layers 1–3: objects, tracks, relations.
    this.lastPerception = perceive(this.lastPerception, display);
    // Layer 4: symbols — and the reward channel: score deltas grade the mode.
    this.lastOcr = readScreen(display).numbers;
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
        const result = updateStudentT(beliefs[k]!, y);
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
 * The direction key the predictor's own steering intent names, if any —
 * what a headless harness (trainer, tests) should press. Mirrors the live
 * fusion's behaviour where the worm-tower fallback keeps the agent moving:
 * without it a bare argmax over 17 normalized keys rarely clears a
 * confidence threshold and the agent stands still.
 */
export function desiredKeyOf(p: BnnSocietyPredictor): number | undefined {
  const d = p.lastDesired;
  if (!d) return undefined;
  if (Math.abs(d.dx) >= Math.abs(d.dy)) return d.dx >= 0 ? 6 : 4;
  return d.dy >= 0 ? 8 : 2;
}
