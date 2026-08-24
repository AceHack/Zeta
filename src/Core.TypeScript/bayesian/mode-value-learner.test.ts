/**
 * mode-value-learner.test.ts — the latch is learned, and here is the proof.
 *
 * The integration tests drive the FULL stack (emulator → composite →
 * perception → OCR reward → learner) on two carts that differ only in
 * appearance: normal mutual-sim (big hollow = hunter) and the inverted
 * variant (small solid = hunter). A hardcoded "big → flee" mapping cannot
 * pass both; a learner that eats its own OCR-read score deltas must.
 */
import { describe, expect, test } from "bun:test";
import { clearCausalMask, compositeInto, create, loadRom, step, type Frame } from "../chip8/chip8";
import { buildMutualSimRom } from "../chip8/games/mutual-sim";
import { BnnSocietyPredictor, desiredKeyOf, thompsonKeyOf } from "./bnn-key-predictor";
import { legacyRulePrior, ModeValueLearner, type ModeBucket } from "./mode-value-learner";

const STEPS_PER_TICK = 10;

const SMALL_CLOSING: ModeBucket = { bigAdversary: false, closing: true };
const SMALL_AWAY: ModeBucket = { bigAdversary: false, closing: false };
const BIG_CLOSING: ModeBucket = { bigAdversary: true, closing: true };

describe("unit — prior, credit, determinism", () => {
  test("cold start reproduces the retired rule exactly (rule demoted to prior)", () => {
    const learner = new ModeValueLearner();
    for (const bucket of [SMALL_CLOSING, SMALL_AWAY, BIG_CLOSING, { bigAdversary: true, closing: false }]) {
      expect(learner.choose(bucket)).toBe(legacyRulePrior(bucket));
    }
  });

  test("negative reward against an executed mode flips the choice; credit decays with age", () => {
    const learner = new ModeValueLearner();
    expect(learner.choose(SMALL_CLOSING)).toBe("hunt"); // the prior
    // Execute hunt in that context repeatedly, then eat tags for it.
    for (let i = 0; i < 6; i++) {
      learner.record(SMALL_CLOSING, "hunt");
      learner.reward(-1);
    }
    expect(learner.choose(SMALL_CLOSING)).toBe("flee"); // evidence beat the prior
    // The uncredited sibling bucket is untouched.
    expect(learner.choose(SMALL_AWAY)).toBe("hunt");
  });

  test("reward ignores zero and non-finite inputs", () => {
    const learner = new ModeValueLearner();
    learner.record(BIG_CLOSING, "flee");
    learner.reward(0);
    learner.reward(Number.NaN);
    expect(learner.rewardEvents).toBe(0);
  });

  test("same operations → byte-identical snapshot (deterministic)", () => {
    const run = () => {
      const l = new ModeValueLearner();
      l.record(SMALL_CLOSING, "hunt");
      l.reward(-1);
      l.record(BIG_CLOSING, "flee");
      l.reward(1);
      return JSON.stringify(l.exportSnapshot());
    };
    expect(run()).toBe(run());
  });

  test("snapshot round-trips through export/import", () => {
    const a = new ModeValueLearner();
    for (let i = 0; i < 4; i++) {
      a.record(SMALL_CLOSING, "hunt");
      a.reward(-1);
    }
    const b = new ModeValueLearner();
    b.importSnapshot(a.exportSnapshot());
    expect(b.exportSnapshot()).toEqual(a.exportSnapshot());
    expect(b.choose(SMALL_CLOSING)).toBe(a.choose(SMALL_CLOSING));
  });
});

/** Drive the full predictor+emulator loop, trainer-style. */
function play(invertAppearance: boolean, ticks: number): BnnSocietyPredictor {
  const frame: Frame = create();
  loadRom(buildMutualSimRom({ invertAppearance }), frame);
  const p = new BnnSocietyPredictor(3);
  // Exploration runs for real: the probe rota is what teaches the
  // self-identification layer which blob answers to the keys — skipping it
  // leaves self/adversary assignment to guesswork and poisons every bucket.
  let lastKey: number | undefined;
  for (let t = 0; t < ticks; t++) {
    const composite = new Array(64 * 32).fill(0);
    for (let i = 0; i < STEPS_PER_TICK; i++) {
      step(frame);
      if (frame.fault) break;
      compositeInto(composite, frame);
    }
    if (frame.fault) break;
    p.predict(composite, lastKey);
    // Press the key the policy's own steering layer names (the same
    // worm-fusion path the live arena drives), not a raw-probability argmax:
    // the mode question is only exercised when the agent actually commits.
    frame.keys.fill(false);
    const key = desiredKeyOf(p);
    if (key !== undefined) {
      frame.keys[key] = true;
      lastKey = key;
    } else {
      lastKey = undefined;
    }
  }
  return p;
}

/**
 * A NOTE ON THE WINDOW LENGTHS (raised 2000/2600 → 4000, 2026-08-24).
 *
 * These runs are scored by the cart's own scoreboard, so their evidence is
 * however many tags the episode happens to contain. On the normal cart the
 * 2000-tick window used to contain **exactly one** event, at t1633 — one lucky
 * tag away from red, and far too thin to carry a sentence about what the
 * learner "survived".
 *
 * Fixing self-identification (the wall-as-self defect) made the agent
 * competent at the half of the game that AVOIDS contact: it now keeps 34 px
 * from the hunter where it used to hug it at 22 px. A better escape means
 * fewer tags per tick, so the same single event no longer lands inside 2000
 * ticks. The assertions are untouched; only the observation window grew, and
 * it now carries THREE events (t2906, t3058, t3137) instead of one. Longer and
 * denser is the opposite of weakening — a broken reward channel still fires
 * zero at any window length, which is what these tests exist to catch.
 */
const PLAY_TICKS = 4000;

describe("integration — the inverted-cart falsifier", () => {
  test(
    "the OCR reward channel actually fires during play (signal exists)",
    () => {
      const p = play(false, PLAY_TICKS);
      expect(p.modeLearner.rewardEvents).toBeGreaterThan(0);
    },
    120_000,
  );

  test(
    "INVERTED cart: the small shape is the hunter — the learner flips the prior",
    () => {
      // On this cart the hunter wears the SMALL shape. The retired rule (and
      // the learner's prior) says small → hunt: approach it, get tagged.
      // The learner must discover from its own scoreboard that hunting the
      // small-shape adversary in this world costs points.
      const p = play(true, PLAY_TICKS);
      expect(p.modeLearner.rewardEvents).toBeGreaterThan(0);
      const preferHuntSmall =
        p.modeLearner.valueOf(SMALL_CLOSING, "hunt") > p.modeLearner.valueOf(SMALL_CLOSING, "flee");
      expect(preferHuntSmall).toBe(false); // flipped away from the prior
    },
    120_000,
  );

  test(
    "NORMAL cart: the same run does NOT flip the small-shape bucket",
    () => {
      // Normal appearance: the small shape is the fleeing prey — hunting it is
      // what SCORES. The learner must keep (or strengthen) the prior there.
      // rewardEvents > 0 keeps this non-vacuous: the prior survived EVIDENCE,
      // not an eventless run.
      const p = play(false, PLAY_TICKS);
      expect(p.modeLearner.rewardEvents).toBeGreaterThan(0);
      const preferHuntSmall =
        p.modeLearner.valueOf(SMALL_CLOSING, "hunt") > p.modeLearner.valueOf(SMALL_CLOSING, "flee");
      expect(preferHuntSmall).toBe(true);
    },
    120_000,
  );
});

describe("the reward sensor does not invent rewards", () => {
  test(
    "reward events never outnumber the score changes that actually happened",
    () => {
      // MEASURED DEFECT (2026-08-24). `absorbScoreboardReward` certifies a
      // reading once it is "seen twice in a row" — which catches a ONE-tick
      // flicker and is blind to a TWO-tick one. Live on main: with the true
      // score parked at 0:3 for a thousand ticks, a sprite brushing the
      // top-right digit made it template-match 9 for exactly two ticks, so
      // the learner absorbed r = -6 and then +6, roughly every sixteen ticks.
      // The pair sums to zero and does NOT cancel, because each half lands on
      // different eligibility-trace contents.
      //
      // This asserts the INVARIANT rather than the anecdote — the sensor may
      // miss a change (a skipped reading is honest), but it may never report
      // more changes than the game contained. The seed is chosen because it
      // fabricates hardest: 35 reward events against 3 real score changes
      // without the fix, 3 against 3 with it.
      // Driven by THOMPSON sampling, not `desiredKeyOf` — the arena's own
      // fusion path (`swarm-controller.ts`). This is load-bearing, not a
      // stylistic choice: the two policies produce different trajectories, and
      // under `desiredKeyOf` this seed never brushes the digit, so the test
      // would pass with the bug still in place. It was written that way first
      // and was vacuous.
      const frame: Frame = create();
      loadRom(buildMutualSimRom({ invertAppearance: true }), frame);
      const p = new BnnSocietyPredictor(3, 23);
      let lastKey: number | undefined;
      let previous = "0:0";
      let realChanges = 0;
      for (let t = 0; t < 4000; t++) {
        clearCausalMask(frame);
        const composite = new Array(64 * 32).fill(0);
        for (let i = 0; i < STEPS_PER_TICK; i++) {
          step(frame);
          if (frame.fault) break;
          compositeInto(composite, frame);
        }
        if (frame.fault) break;
        const key = thompsonKeyOf(p.predict([...composite], lastKey), () => p.gaussianDraw());
        frame.keys.fill(false);
        if (key >= 0 && key <= 15) frame.keys[key] = true;
        lastKey = key >= 0 ? key : undefined;
        // Ground truth from the cart's own counters, read for MEASUREMENT
        // only — the agent never sees a register.
        const score = `${String(frame.v[9])}:${String(frame.v[5])}`;
        if (score !== previous) {
          realChanges += 1;
          previous = score;
        }
      }
      expect(realChanges).toBeGreaterThan(0); // the run must contain real scoring
      expect(p.modeLearner.rewardEvents).toBeLessThanOrEqual(realChanges);
    },
    120_000,
  );
});
