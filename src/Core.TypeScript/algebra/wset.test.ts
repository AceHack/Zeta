import { describe, expect, it } from "bun:test";
import {
  LogProbRing,
  TropicalRing,
  IntegerRing,
  BooleanRing,
  consolidateWSet,
  applyWSet,
  tensorWSet,
  copyWSet,
  discardWSet,
  type WSet,
  type WElement,
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
    const startSet: WSet<string, number> = [{ key: "node-0", weight: LogProbRing.one }];

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

  it("consolidates relational weights over BooleanRing (GSet / Rel)", () => {
    const boolSet: WSet<string, boolean> = [
      { key: "edge-1", weight: true },
      { key: "edge-1", weight: false },
      { key: "edge-2", weight: false },
    ];

    const consolidated = consolidateWSet(
      BooleanRing,
      (w) => w === false,
      (k) => k,
      boolSet,
    );

    expect(consolidated.length).toBe(1);
    expect(consolidated[0]!.key).toBe("edge-1");
    expect(consolidated[0]!.weight).toBe(true);
  });
});

describe("WSet Comonoid Laws & The Fritz Axis Discriminator (Port of WSet.Comonoid.Laws.Tests.fs)", () => {
  const consol = <K>(s: WSet<K, number>): WSet<K, number> =>
    consolidateWSet(IntegerRing, (w) => w === 0, JSON.stringify, s);

  const sampleSet: WSet<number, number> = [
    { key: 1, weight: 2 },
    { key: 3, weight: 5 },
  ];

  it("LAW 1: copy Delta is coassociative ((Delta (x) id) o Delta === (id (x) Delta) o Delta)", () => {
    const s = consol(sampleSet);
    const dd = copyWSet(s);
    // Left: ((x, y), w) -> ((x, x, y), w)
    const lhs = consol(dd.map((e) => ({ key: [e.key[0], e.key[0], e.key[1]], weight: e.weight })));
    // Right: ((x, y), w) -> ((x, y, y), w)
    const rhs = consol(dd.map((e) => ({ key: [e.key[0], e.key[1], e.key[1]], weight: e.weight })));

    expect(lhs).toEqual(rhs);
  });

  it("LAW 2: copy Delta is counital ((epsilon (x) id) o Delta === id === (id (x) epsilon) o Delta)", () => {
    const s = consol(sampleSet);
    const dd = copyWSet(s);

    const sumOutFirst = consol(dd.map((e) => ({ key: e.key[1], weight: e.weight })));
    const sumOutSecond = consol(dd.map((e) => ({ key: e.key[0], weight: e.weight })));

    expect(sumOutFirst).toEqual(s);
    expect(sumOutSecond).toEqual(s);
  });

  it("LAW 3: copy Delta is cocommutative (swap o Delta === Delta)", () => {
    const s = consol(sampleSet);
    const dd = copyWSet(s);
    const swapped = consol(dd.map((e) => ({ key: [e.key[1], e.key[0]], weight: e.weight })));

    expect(swapped).toEqual(dd);
  });

  it("LAW 4: discard ! is counit epsilon (returns exact scalar weight sum over ring)", () => {
    const s = consol(sampleSet);
    const totalWeight = discardWSet(IntegerRing, s);

    expect(totalWeight).toBe(7); // 2 + 5 = 7
  });

  it("DISCRIMINATOR (+): deterministic arr g is copy-natural and discard-natural", () => {
    const s = consol(sampleSet);
    const detOp = (k: number): WSet<number, number> => [{ key: k * 7 + 1, weight: IntegerRing.one }];

    // LHS: Delta_B o f
    const lhs = consol(copyWSet(applyWSet(IntegerRing, detOp, s)));

    // RHS: (f (x) f) o Delta_A
    const copied = copyWSet(s);
    const rhsUnconsolidated: WElement<[number, number], number>[] = [];
    for (const elem of copied) {
      const op1 = detOp(elem.key[0]);
      const op2 = detOp(elem.key[1]);
      const tensorResult = tensorWSet(IntegerRing, op1, op2);
      for (const t of tensorResult) {
        rhsUnconsolidated.push({
          key: t.key,
          weight: IntegerRing.mul(elem.weight, t.weight),
        });
      }
    }
    const rhs = consol(rhsUnconsolidated);

    expect(lhs).toEqual(rhs);

    // Discard naturality: epsilon_B o f === epsilon_A
    const massBefore = discardWSet(IntegerRing, s);
    const massAfter = discardWSet(IntegerRing, applyWSet(IntegerRing, detOp, s));
    expect(massAfter).toBe(massBefore);
  });

  it("DISCRIMINATOR (-): branching map fails copy-naturality and doubles discarded mass", () => {
    const s: WSet<number, number> = [
      { key: 1, weight: 2 },
      { key: 3, weight: 5 },
    ];
    // Branching op: maps every key to [100, 200]
    const branchOp = (_k: number): WSet<number, number> => [
      { key: 100, weight: IntegerRing.one },
      { key: 200, weight: IntegerRing.one },
    ];

    // Discard naturality FAILS by doubling mass: epsilon(s) = 7, epsilon(branchOp(s)) = 14!
    const massBefore = discardWSet(IntegerRing, s);
    const massAfter = discardWSet(IntegerRing, applyWSet(IntegerRing, branchOp, s));
    expect(massBefore).toBe(7);
    expect(massAfter).toBe(14); // Doubled mass!
    expect(massAfter).not.toBe(massBefore);

    // Copy naturality FAILS: RHS creates cross terms (100, 200) and (200, 100) not present in diagonal LHS
    const lhs = consol(copyWSet(applyWSet(IntegerRing, branchOp, s)));

    const copied = copyWSet(s);
    const rhsUnconsolidated: WElement<[number, number], number>[] = [];
    for (const elem of copied) {
      const op1 = branchOp(elem.key[0]);
      const op2 = branchOp(elem.key[1]);
      const tensorResult = tensorWSet(IntegerRing, op1, op2);
      for (const t of tensorResult) {
        rhsUnconsolidated.push({
          key: t.key,
          weight: IntegerRing.mul(elem.weight, t.weight),
        });
      }
    }
    const rhs = consol(rhsUnconsolidated);

    // LHS has ONLY diagonal keys [100,100] and [200,200]
    const lhsKeys = lhs.map((e) => e.key);
    expect(lhsKeys).toEqual([[100, 100], [200, 200]]);

    // RHS has cross terms [100,200] and [200,100] as well!
    const hasCrossTerm1 = rhs.some((e) => e.key[0] === 100 && e.key[1] === 200);
    const hasCrossTerm2 = rhs.some((e) => e.key[0] === 200 && e.key[1] === 100);
    expect(hasCrossTerm1).toBeTrue();
    expect(hasCrossTerm2).toBeTrue();

    expect(lhs).not.toEqual(rhs);
  });
});
