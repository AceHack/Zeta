// Falsifiers for the benchmark's own scoring.
//
// The defect these exist for, measured 2026-08-25: a model emitting the constant
// "0" scores 6/6 = 100% on the full suite. Three of six scenarios accept EVERY
// option, and all three that discriminate happen to accept index 0. The published
// run reported qwen2.5:0.5b and gemma2:2b at "100% correct" — both answered "0" to
// every prompt — while llama3.2:1b, the only model that varied its answer, scored
// worst. A benchmark a `console.log("0")` wins cannot rank judgement.

import { describe, expect, test } from "bun:test";
import { SCENARIOS, bestConstantBaseline, constantBaselineRate, isDiscriminating } from "./model-benchmark";

describe("isDiscriminating", () => {
  test("a scenario accepting every option cannot fail, so it is not discriminating", () => {
    expect(isDiscriminating({ name: "x", context: "", options: ["a", "b"], acceptableIndices: [0, 1] })).toBe(false);
  });

  test("a scenario with a wrong answer available IS discriminating", () => {
    expect(isDiscriminating({ name: "x", context: "", options: ["a", "b"], acceptableIndices: [0] })).toBe(true);
  });
});

describe("the live suite — pinning the defect so a fix cannot silently regress", () => {
  test("exactly three of six scenarios accept every option", () => {
    const disc = SCENARIOS.filter(isDiscriminating);
    expect(SCENARIOS.length).toBe(6);
    expect(disc.length).toBe(3);
  });

  test("THE DEFECT: a constant responder still scores 100% on the discriminating subset", () => {
    // Every discriminating scenario accepts index 0, so constant-"0" is perfect
    // even after excluding the unfailable ones. Excluding them is necessary and
    // NOT sufficient; the suite needs a scenario whose answer is not 0.
    expect(constantBaselineRate(SCENARIOS, 0)).toBe(1);
  });

  test("bestConstantBaseline surfaces it rather than leaving it implicit", () => {
    const b = bestConstantBaseline(SCENARIOS);
    expect(b.rate).toBe(1);
    expect(b.index).toBe(0);
  });
});

describe("constantBaselineRate", () => {
  test("a constant that misses every discriminating scenario scores 0", () => {
    const s = [
      { name: "a", context: "", options: ["x", "y"], acceptableIndices: [0] },
      { name: "b", context: "", options: ["x", "y"], acceptableIndices: [0] },
    ];
    expect(constantBaselineRate(s, 1)).toBe(0);
  });

  test("a suite with differing answers cannot be won by any single constant", () => {
    // This is the shape the live suite needs: no constant reaches 1.
    const s = [
      { name: "a", context: "", options: ["x", "y"], acceptableIndices: [0] },
      { name: "b", context: "", options: ["x", "y"], acceptableIndices: [1] },
    ];
    expect(bestConstantBaseline(s).rate).toBe(0.5);
  });

  test("VACUITY GUARD: a suite with NO discriminating scenarios reports 1, not a false pass", () => {
    // Returning 1 is correct and is the point: it says a constant wins outright,
    // which is what the caller must refuse to publish as a score.
    const s = [{ name: "a", context: "", options: ["x", "y"], acceptableIndices: [0, 1] }];
    expect(constantBaselineRate(s, 0)).toBe(1);
    expect(constantBaselineRate(s, 1)).toBe(1);
  });
});
