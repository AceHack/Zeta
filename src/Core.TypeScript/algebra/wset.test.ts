import { describe, expect, it } from "bun:test";
import {
  LogProbRing,
  TropicalRing,
  IntegerRing,
  consolidateWSet,
  applyWSet,
  tensorWSet,
  type WSet,
} from "./wset.ts";

describe("WSet — Ring-Generic Weighted Set & Generalized Distributive Law", () => {
  it("consolidates weights over LogProbRing (logsumexp)", () => {
    const logSet: WSet<string, number> = [
      { key: "state-A", weight: -1.0 },
      { key: "state-A", weight: -2.0 },
      { key: "state-B", weight: -0.5 },
    ];

    const consolidated = consolidateWSet(
      LogProbRing,
      (w) => w === -Infinity,
      (k) => k,
      logSet,
    );

    expect(consolidated.length).toBe(2);

    const stateA = consolidated.find((e) => e.key === "state-A")!;
    // logsumexp(-1, -2) = -1 + log(1 + exp(-1)) ~= -0.686738
    const expectedLog = -1.0 + Math.log(1 + Math.exp(-1));
    expect(stateA.weight).toBeCloseTo(expectedLog, 5);
  });

  it("consolidates weights over TropicalRing (min-plus least-action planning)", () => {
    const tropicalSet: WSet<string, number> = [
      { key: "path-1", weight: 10.0 }, // Cost 10
      { key: "path-1", weight: 5.0 },  // Cost 5 (better path!)
      { key: "path-2", weight: 8.0 },
    ];

    const consolidated = consolidateWSet(
      TropicalRing,
      (w) => w === Infinity,
      (k) => k,
      tropicalSet,
    );

    expect(consolidated.length).toBe(2);
    const path1 = consolidated.find((e) => e.key === "path-1")!;
    expect(path1.weight).toBe(5.0); // min(10, 5) = 5
  });

  it("verifies ring-linear applyWSet matrix operator application", () => {
    const startSet: WSet<string, number> = [{ key: "node-0", weight: LogProbRing.one }]; // log(1.0) = 0.0

    const op = (k: string): WSet<string, number> => {
      if (k === "node-0") {
        return [
          { key: "node-1", weight: -0.5 },
          { key: "node-2", weight: -1.2 },
        ];
      }
      return [];
    };

    const nextSet = applyWSet(LogProbRing, op, startSet);
    expect(nextSet.length).toBe(2);
    expect(nextSet[0]!.weight).toBe(-0.5);
    expect(nextSet[1]!.weight).toBe(-1.2);
  });

  it("executes Kronecker tensor product over WSet", () => {
    const setA: WSet<string, number> = [
      { key: "a1", weight: 2 },
      { key: "a2", weight: 3 },
    ];
    const setB: WSet<string, number> = [{ key: "b1", weight: 5 }];

    const tensorResult = tensorWSet(IntegerRing, setA, setB);
    expect(tensorResult.length).toBe(2);
    expect(tensorResult[0]!.weight).toBe(10); // 2 * 5
    expect(tensorResult[1]!.weight).toBe(15); // 3 * 5
  });
});
