// graded-reciprocity.proof — Tit for Lesser Tat, proven in-toy (deterministic sweeps).
//
// The three claims of Aaron's strategy, each a theorem of this toy:
//   CONTRACTION — λ<1 makes every feud decay geometrically to cooperation (finite total cost).
//   ECHO — λ=1 (classic TFT) preserves any noise forever (the Axelrod noise pathology).
//   VENDETTA — λ>1 saturates at maximal conflict (the game goes terminal).
// Plus TEACH (legible lesson: proportionate, monotone, never exceeds the wrong) and PLAY
// (non-terminal for every seed).

import { describe, it, expect } from "bun:test";
import {
  titForTat,
  titForLesserTat,
  titForGreaterTat,
  feud,
  feudCost,
  isLegibleLesson,
  staysPlayable,
} from "./graded-reciprocity";

const SEEDS = [0.05, 0.2, 0.5, 0.8, 1.0];
const LAMBDAS = [0.1, 0.3, 0.5, 0.7, 0.9];

describe("PROVEN (toy): Tit for Lesser Tat — the contraction theorem", () => {
  it("λ<1: every feud decays geometrically to the cooperation fixed point (swept λ × seeds)", () => {
    for (const lambda of LAMBDAS) {
      for (const seed of SEEDS) {
        const t = feud(titForLesserTat(lambda), seed, 200);
        // strictly decreasing while positive, exact geometric law m_n = seed·λ^n
        for (let n = 0; n < 50; n++) {
          expect(Math.abs((t[n] ?? 0) - seed * lambda ** n)).toBeLessThan(1e-9);
        }
        // and the tail is (numerically) home: cooperation
        expect(t[199] ?? 1).toBeLessThan(1e-4);
        // total damage is finite and exactly bounded by the geometric series seed/(1−λ)
        expect(feudCost(t)).toBeLessThanOrEqual(seed / (1 - lambda) + 1e-9);
      }
    }
  });

  it("λ=1 (classic TFT): the echo pathology — any noise persists forever, cost grows without bound", () => {
    for (const seed of SEEDS) {
      const t = feud(titForTat, seed, 200);
      expect(t[199]).toBe(seed); // the wrong echoes, undiminished, at round 200
      expect(feudCost(t)).toBeCloseTo(seed * 200, 6); // linear damage: no healing, ever
    }
  });

  it("λ>1 (vendetta): escalation saturates at maximal conflict — the game goes terminal", () => {
    const t = feud(titForGreaterTat(1.5), 0.05, 60);
    expect(t[59]).toBe(1); // a 5% slight became total war
    expect(staysPlayable(titForGreaterTat(1.5), 0.05, 60)).toBe(false);
  });

  it("TEACH: lesser-tat is a legible lesson (proportionate, monotone, never exceeds the wrong); escalation is not", () => {
    for (const lambda of LAMBDAS) expect(isLegibleLesson(titForLesserTat(lambda))).toBe(true);
    expect(isLegibleLesson(titForTat)).toBe(true); // equal mirror is legible too — just unforgiving
    expect(isLegibleLesson(titForGreaterTat(1.5))).toBe(false); // vendetta reads as a new wrong
  });

  it("PLAY: lesser-tat stays non-terminal for every seed — including a maximal wrong", () => {
    for (const lambda of LAMBDAS) {
      for (const seed of SEEDS) {
        expect(staysPlayable(titForLesserTat(lambda), seed, 200)).toBe(true);
      }
    }
  });

  it("the ordering theorem: total feud cost is monotone in λ — less tat, less total damage", () => {
    for (const seed of SEEDS) {
      let prev = -Infinity;
      for (const lambda of LAMBDAS) {
        const cost = feudCost(feud(titForLesserTat(lambda), seed, 500));
        expect(cost).toBeGreaterThan(prev);
        prev = cost;
      }
      // and every damped cost is below the undamped echo's
      expect(prev).toBeLessThan(feudCost(feud(titForTat, seed, 500)));
    }
  });
});
