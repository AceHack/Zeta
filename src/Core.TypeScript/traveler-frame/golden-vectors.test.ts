import { test, expect } from "bun:test";
import seedJson from "./golden-vectors.json";
import { transform, dominates, converge, type Frame } from "./traveler-frame";

// TravelerFrame TS oracle replay — reads the SAME seed the F# and C# oracles verify and asserts identical
// transform / dominates / converge results. F#+C#+TS agreeing == the causal frame is locked across three
// oracles (Rust pending toward full 4-lang).

const seed = seedJson as unknown as {
  transform: { a: Frame; b: Frame; result: Frame }[];
  dominates: { a: Frame; b: Frame; result: boolean }[];
  converge: { frames: Frame[]; lub: Frame }[];
};

test("TS TravelerFrame agrees with the shared golden seed", () => {
  for (const v of seed.transform) expect(transform(v.a, v.b)).toEqual(v.result);
  for (const v of seed.dominates) expect(dominates(v.a, v.b)).toBe(v.result);
  for (const v of seed.converge) {
    expect(converge(v.frames)).toEqual(v.lub);
    expect(converge([...v.frames].reverse())).toEqual(v.lub); // order-independent (homeostat)
  }
});
