import { test, expect } from "bun:test";
import seedJson from "./golden-vectors.json";
import { differentiate, integrate, curvature } from "./curve";

// Curve TS oracle replay — reads the SAME seed the F# and C# oracles verify and asserts identical rate
// (∂), integrate (I), and curvature (∂²) outputs. F#+C#+TS agreeing on every vector = the discrete DBSP
// D/I calculus is byte-locked across three oracles (Rust pending toward full 4-lang).

interface Vector {
  input: number[];
  rate: number[];
  integrate: number[];
  curvature: number[];
}

const seed = seedJson as unknown as { vectors: Vector[] };

test("TS Curve agrees with the shared golden seed", () => {
  expect(seed.vectors.length).toBeGreaterThan(0);
  for (const v of seed.vectors) {
    expect(differentiate(v.input)).toEqual(v.rate);
    expect(integrate(v.input)).toEqual(v.integrate);
    expect(curvature(v.input)).toEqual(v.curvature);
  }
});
