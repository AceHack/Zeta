#!/usr/bin/env bun
/**
 * arena-reward-audit.ts — reproduce the reward-channel measurement.
 *
 * This is the instrument behind
 * `docs/research/2026-08-24-the-mode-learner-was-learning-all-along-the-defect-is-one-sided-evidence.md`.
 * It exists so that document's numbers can be RE-RUN rather than trusted.
 *
 * TWO PROVENANCE RULES, both learned by getting them wrong first:
 *
 * 1. NEVER assign `rng` after construction. `initializeSociety()` consumes 51
 *    draws (3 agents x 17 keys), so replacing the stream afterwards rewinds it
 *    and measures a family of trajectories THE ARENA NEVER RUNS. Earlier
 *    harnesses did exactly that and every number they produced was off-arena.
 *    Construct `new BnnSocietyPredictor(3)` and touch nothing.
 *
 * 2. Drive the arena's ACTUAL policy, `thompsonKeyOf`. `desiredKeyOf` consumes
 *    no randomness and follows a different trajectory; a falsifier written
 *    against it once passed with a live reward bug still in place.
 *
 * AND ONE LABELLING TRAP, which nearly produced a false bug report: in
 * `mutual-sim.ts`, **V5 is the AI's score and V9 is the PLAYER's** (lines
 * 34/38), and the predictor plays the player. Printing `mine=v[5]` makes a
 * 0-3 loss look like a 3-0 win and makes the correct `r = -1` rewards look
 * like the reward sign is inverted. Read the ROM, not the variable name.
 *
 * Usage:
 *   bun src/Core.TypeScript/bayesian/arena-reward-audit.ts [ticks] [normal|inverted]
 */
import { compositeInto, create, loadRom, step, type Frame } from "../chip8/chip8";
import { buildMutualSimRom } from "../chip8/games/mutual-sim";
import { BnnSocietyPredictor, thompsonKeyOf } from "./bnn-key-predictor";
import { type ModeBucket } from "./mode-value-learner";

const STEPS_PER_TICK = 10;

const BUCKETS: readonly ModeBucket[] = [
  { bigAdversary: false, closing: false },
  { bigAdversary: false, closing: true },
  { bigAdversary: true, closing: false },
  { bigAdversary: true, closing: true },
];

const bucketName = (b: ModeBucket): string =>
  `${b.bigAdversary ? "big" : "small"}/${b.closing ? "closing" : "away"}`;

export interface AuditResult {
  readonly cart: "normal" | "inverted";
  readonly ticks: number;
  /** Ticks where a scoreboard REGISTER actually changed (ground truth). */
  readonly trueScoreChanges: number;
  /** Reward events the learner absorbed. Should equal the above, modulo §1. */
  readonly rewardEvents: number;
  readonly agentPoints: number;
  readonly aiPoints: number;
  readonly buckets: readonly {
    readonly name: string;
    readonly visits: number;
    readonly huntPrior: number;
    readonly huntPosterior: number;
    readonly fleePrior: number;
    readonly fleePosterior: number;
  }[];
}

export function auditRewardChannel(invertAppearance: boolean, ticks: number): AuditResult {
  const frame: Frame = create();
  loadRom(buildMutualSimRom({ invertAppearance }), frame);
  const p = new BnnSocietyPredictor(3); // arena construction, verbatim — see rule 1

  const priors = BUCKETS.map((b) => ({
    hunt: p.modeLearner.valueOf(b, "hunt"),
    flee: p.modeLearner.valueOf(b, "flee"),
  }));

  const visits = new Map<number, number>();
  let lastKey: number | undefined;
  let trueScoreChanges = 0;
  let agentPoints = 0;
  let aiPoints = 0;
  // V9 is the PLAYER's score and the predictor plays the player. See the header.
  let prevAgent = frame.v[9]!;
  let prevAi = frame.v[5]!;

  for (let t = 0; t < ticks; t++) {
    const composite = new Array(64 * 32).fill(0);
    for (let i = 0; i < STEPS_PER_TICK; i++) {
      step(frame);
      if (frame.fault) break;
      compositeInto(composite, frame);
    }
    if (frame.fault) break;

    const agent = frame.v[9]!;
    const ai = frame.v[5]!;
    if (agent !== prevAgent || ai !== prevAi) trueScoreChanges++;
    agentPoints += agent - prevAgent;
    aiPoints += ai - prevAi;
    prevAgent = agent;
    prevAi = ai;

    const probs = p.predict(composite, lastKey);
    if (p.lastModeBucket) {
      const ix = (p.lastModeBucket.bigAdversary ? 2 : 0) + (p.lastModeBucket.closing ? 1 : 0);
      visits.set(ix, (visits.get(ix) ?? 0) + 1);
    }

    frame.keys.fill(false);
    const key = thompsonKeyOf(probs, () => p.gaussianDraw()); // see rule 2
    if (key >= 0) {
      frame.keys[key] = true;
      lastKey = key;
    } else {
      lastKey = undefined;
    }
  }

  return {
    cart: invertAppearance ? "inverted" : "normal",
    ticks,
    trueScoreChanges,
    rewardEvents: p.modeLearner.rewardEvents,
    agentPoints,
    aiPoints,
    buckets: BUCKETS.map((b, i) => ({
      name: bucketName(b),
      visits: visits.get(i) ?? 0,
      huntPrior: priors[i]!.hunt,
      huntPosterior: p.modeLearner.valueOf(b, "hunt"),
      fleePrior: priors[i]!.flee,
      fleePosterior: p.modeLearner.valueOf(b, "flee"),
    })),
  };
}

function report(r: AuditResult): void {
  console.log(`\ncart=${r.cart} ticks=${r.ticks}`);
  console.log(`true score changes : ${r.trueScoreChanges}`);
  console.log(`reward events      : ${r.rewardEvents}`);
  console.log(`points             : agent=${r.agentPoints}  ai=${r.aiPoints}`);
  console.log(`\nbucket           visits    hunt (prior -> post)    flee (prior -> post)`);
  for (const b of r.buckets) {
    console.log(
      `${b.name.padEnd(14)} ${String(b.visits).padStart(6)}    ` +
        `${b.huntPrior.toFixed(3)} -> ${b.huntPosterior.toFixed(3)}` +
        `${b.visits === 0 ? "  (unvisited)" : ""}`.padEnd(10) +
        `    ${b.fleePrior.toFixed(3)} -> ${b.fleePosterior.toFixed(3)}`,
    );
  }
}

if (import.meta.main) {
  const ticks = Number(process.argv[2] ?? 4000);
  const which = process.argv[3];
  const carts = which === "normal" ? [false] : which === "inverted" ? [true] : [false, true];
  for (const inverted of carts) report(auditRewardChannel(inverted, ticks));
}
