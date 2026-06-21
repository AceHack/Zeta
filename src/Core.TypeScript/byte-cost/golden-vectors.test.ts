import { test, expect } from "bun:test";
import seedJson from "./golden-vectors.json";
import { measureText, add, sum, Zero, ofBytes } from "./byte-cost";

// Byte-cost TS oracle replay — the distribution-side leg of the meter byte-lock
// (081KT7YW00008QG0R002T1XNWT slice 1). Reads the SAME seed the F# oracle verifies
// (ByteCost.Laws.Tests.fs) and asserts identical UTF-8 byte counts. If F# and TS
// agree on every vector, the meter is byte-locked across the two oracles.

interface Vector {
  name: string;
  text: string;
  bytes: number;
}

const seed = seedJson as unknown as {
  primitive: string;
  version: string;
  unit: string;
  vectors: Vector[];
};

test("seed identifies as byte-cost v1 in utf8-bytes", () => {
  expect(seed.primitive).toBe("byte-cost");
  expect(seed.version).toBe("v1");
  expect(seed.unit).toBe("utf8-bytes");
  expect(seed.vectors.length).toBeGreaterThan(0);
});

for (const v of seed.vectors) {
  test(`byte-lock measure: ${v.name}`, () => {
    expect(measureText(v.text).bytes).toBe(v.bytes);
  });
}

test("monoid: Zero is identity and empty text costs Zero", () => {
  expect(measureText("")).toEqual(Zero);
  const a = ofBytes(7);
  expect(add(a, Zero)).toEqual(a);
  expect(add(Zero, a)).toEqual(a);
});

test("sum is order-independent (sound DORA aggregate)", () => {
  const costs = seed.vectors.map((v) => measureText(v.text));
  expect(sum(costs)).toEqual(sum([...costs].reverse()));
});
