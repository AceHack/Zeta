import { test, expect } from "bun:test";
import seedJson from "./golden-vectors.json";
import { compose, inverse, between, apply, magnitude, distance, type FrameMap } from "./frame-delta";

// FrameDelta TS oracle replay — reads the SAME seed the F# and C# oracles verify and asserts identical
// compose / inverse / between / apply / magnitude / distance results. F#+C#+TS agreeing == the frame-offset
// transformation group is locked across three oracles (Rust pending toward full 4-lang).

const seed = seedJson as unknown as {
  compose: { a: FrameMap; b: FrameMap; result: FrameMap }[];
  inverse: { d: FrameMap; result: FrameMap }[];
  between: { from: FrameMap; to: FrameMap; result: FrameMap }[];
  apply: { delta: FrameMap; frame: FrameMap; result: FrameMap }[];
  magnitude: { d: FrameMap; result: number }[];
  distance: { from: FrameMap; to: FrameMap; result: number }[];
};

test("TS FrameDelta agrees with the shared golden seed", () => {
  for (const v of seed.compose) expect(compose(v.a, v.b)).toEqual(v.result);
  for (const v of seed.inverse) expect(inverse(v.d)).toEqual(v.result);
  for (const v of seed.between) expect(between(v.from, v.to)).toEqual(v.result);
  for (const v of seed.apply) expect(apply(v.delta, v.frame)).toEqual(v.result);
  for (const v of seed.magnitude) expect(magnitude(v.d)).toBe(v.result);
  for (const v of seed.distance) expect(distance(v.from, v.to)).toBe(v.result);
});
