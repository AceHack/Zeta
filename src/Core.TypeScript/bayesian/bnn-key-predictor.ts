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
import { readScreen, type ReadNumber } from "../chip8/ocr";

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
/** Obstacle lookahead distance (pixels) for steering penalties. */
const LOOKAHEAD = 6;

/** Serializable snapshot of the society — the priors that live in source. */
export interface SocietySnapshot {
  readonly version: 1;
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
      version: 1,
      seed: this.seed,
      agentCount: this.agentCount,
      agents,
      exploreTicksDone: this.exploreTicksDone,
      priors: { ...this.priors },
    };
  }

  /**
   * Restore a snapshot (committed priors). Restored posteriors replace the
   * fresh ones; exploration already performed is not repeated — that is the
   * whole point of priors in source: never starting from zero.
   */
  public importSnapshot(snap: SocietySnapshot): void {
    if (snap.version !== 1) throw new RangeError(`unknown SocietySnapshot version ${String((snap as { version: unknown }).version)}`);
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
    let best: TrackedObject | null = null;
    let bestScore = -Infinity;
    for (const t of this.lastPerception.tracks) {
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
  }

  private pickAdversary(self: TrackedObject | null): TrackedObject | null {
    if (!self) return null;
    // Pass 1: currently-moving non-self tracks. Pass 2: tracks that have EVER
    // moved (a lurker holding still). Furniture — static since birth — is
    // never an adversary: that was the wall bug, and it stays fixed.
    for (const requireMoving of [true, false]) {
      let best: TrackedObject | null = null;
      let bestDist = Infinity;
      for (const t of this.lastPerception.tracks) {
        if (t.id === self.id) continue;
        if (requireMoving ? t.isStatic : !t.everMoved) continue;
        const d = Math.hypot(t.cx - self.cx, t.cy - self.cy);
        if (d < bestDist || (d === bestDist && best !== null && t.id < best.id)) {
          bestDist = d;
          best = t;
        }
      }
      if (best) return best;
    }
    return null;
  }

  // ── Layer 6: the mode latch ──────────────────────────────────────────────

  private updateMode(self: TrackedObject | null, adversary: TrackedObject | null): void {
    if (this.exploreTicksDone < EXPLORE_TICKS) {
      this.lastMode = "explore";
      return;
    }
    if (!self || !adversary) {
      // Nothing to hunt or flee; hold the previous non-explore mode.
      if (this.lastMode === "explore") this.lastMode = "hunt";
      return;
    }
    // Cue A: the hunter shape is big (mutual-sim: hollow 4×4 = 12 px hunter,
    // solid 2×2 = 4 px prey). Cue B: it is closing on us.
    const rel = relationBetween(this.lastPerception, self.id, adversary.id);
    const closing = rel ? rel.closingSpeed : 0;
    const threat = (adversary.area >= HUNTER_AREA_MIN ? 1 : -1) + (closing > 0.2 ? 1 : 0);
    this.threatCharge = Math.max(
      -MODE_HYSTERESIS,
      Math.min(MODE_HYSTERESIS, this.threatCharge + (threat > 0 ? 1 : -1)),
    );
    if (this.lastMode === "explore") this.lastMode = this.threatCharge > 0 ? "flee" : "hunt";
    else if (this.threatCharge >= MODE_HYSTERESIS) this.lastMode = "flee";
    else if (this.threatCharge <= -MODE_HYSTERESIS) this.lastMode = "hunt";
    // Between the rails: keep the latched mode (that is the hysteresis).
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
    // Layer 4: symbols.
    this.lastOcr = readScreen(display).numbers;
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
