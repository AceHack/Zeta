import { describe, expect, test } from "bun:test";
import { observe, isLate, combine, type Strategy } from "./watermark";
import vectors from "./golden-vectors.json";

// Replays the shared golden seed through the TS oracle; the C#/F#/Rust oracles replay the same file.

describe("Watermark golden vectors", () => {
  test("observe agrees with the seed", () => {
    for (const v of vectors.observe) {
      expect(observe(v.strategy as Strategy, v.lateness, v.events)).toEqual(v.result);
    }
  });

  test("isLate agrees with the seed", () => {
    for (const v of vectors.isLate) {
      expect(isLate(v.wm, v.eventTime)).toBe(v.result);
    }
  });

  test("combine agrees with the seed", () => {
    for (const v of vectors.combine) {
      expect(combine(v.sources)).toBe(v.result);
    }
  });
});
