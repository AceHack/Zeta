import { describe, expect, it } from "bun:test";
import {
  combineFactorsCommutatively,
  computeFactorEntropy,
  BayesianHierarchicalSearch,
  type CategoricalFactorTensor,
} from "./categorical-bayesian-planner.ts";

describe("Categorical Bayesian Factor Graphs & Order-Independent Hierarchical Planner", () => {
  const factorA: CategoricalFactorTensor = {
    factorId: "mesh-frame-alpha",
    logProbabilities: new Map([
      ["0,0", -0.10000000000000002],
      ["0,1", -0.5000000000000001],
      ["1,1", -0.20000000000000003],
    ]),
  };

  const factorB: CategoricalFactorTensor = {
    factorId: "mesh-frame-beta",
    logProbabilities: new Map([
      ["0,1", -0.30000000000000004],
      ["1,1", -0.10000000000000002],
      ["2,2", -0.8000000000000002],
    ]),
  };

  it("STRICT BYTE-LOCK COMMUTATIVE INVARIANT: factor fusion combine(A, B) is strictly === identical to combine(B, A)", () => {
    const fusedAB = combineFactorsCommutatively(factorA, factorB);
    const fusedBA = combineFactorsCommutatively(factorB, factorA);

    expect(fusedAB.logProbabilities.size).toBe(fusedBA.logProbabilities.size);

    for (const [key, valAB] of fusedAB.logProbabilities.entries()) {
      const valBA = fusedBA.logProbabilities.get(key);
      expect(valBA).toBeDefined();
      // Strict === equality (not toBeCloseTo!) thanks to canonical key sorting
      expect(valBA).toBe(valAB);
    }
  });

  it("PROPERTY TEST: 100 random frame arrival permutations yield 100% byte-lock identical belief tensors", () => {
    const factors: CategoricalFactorTensor[] = [
      factorA,
      factorB,
      {
        factorId: "mesh-frame-gamma",
        logProbabilities: new Map([
          ["0,0", -0.05],
          ["2,2", -0.15],
          ["3,3", -0.99],
        ]),
      },
    ];

    // Reference canonical fusion
    let referenceFused = factors[0]!;
    for (let i = 1; i < factors.length; i++) {
      referenceFused = combineFactorsCommutatively(referenceFused, factors[i]!);
    }

    const referenceJSON = JSON.stringify(Array.from(referenceFused.logProbabilities.entries()));

    // Test 100 randomized permutations of factor arrival order over Reticulum mesh
    for (let perm = 0; perm < 100; perm++) {
      const shuffled = [...factors].sort(() => Math.random() - 0.5);
      let permFused = shuffled[0]!;
      for (let i = 1; i < shuffled.length; i++) {
        permFused = combineFactorsCommutatively(permFused, shuffled[i]!);
      }
      const permJSON = JSON.stringify(Array.from(permFused.logProbabilities.entries()));
      expect(permJSON).toBe(referenceJSON);
    }
  });

  it("calculates Shannon entropy uncertainty over categorical factor tensor", () => {
    const entropyA = computeFactorEntropy(factorA);
    expect(entropyA).toBeGreaterThan(0.0);
    // Equal log-probabilities give maximum entropy log2(N)
    const maxEntropyFactor: CategoricalFactorTensor = {
      factorId: "uniform",
      logProbabilities: new Map([
        ["s1", 0.0],
        ["s2", 0.0],
        ["s3", 0.0],
        ["s4", 0.0],
      ]),
    };
    expect(computeFactorEntropy(maxEntropyFactor)).toBeCloseTo(2.0, 4); // log2(4) = 2.0
  });

  it("executes Bayesian Hierarchical Search with joint log-likelihood maximization and plan replay", () => {
    const gridSize = 8;
    const blockSize = 2;
    const actions = ["up", "down", "left", "right"];

    const step = (s: { row: number; col: number }, a: string) => {
      switch (a) {
        case "up":
          return { row: Math.max(0, s.row - 1), col: s.col };
        case "down":
          return { row: Math.min(gridSize - 1, s.row + 1), col: s.col };
        case "left":
          return { row: s.row, col: Math.max(0, s.col - 1) };
        case "right":
          return { row: s.row, col: Math.min(gridSize - 1, s.col + 1) };
        default:
          return s;
      }
    };

    const start = { row: 0, col: 0 };
    const goal = { row: 7, col: 7 };

    const result = BayesianHierarchicalSearch(
      gridSize,
      blockSize,
      start,
      goal,
      actions,
      step,
      factorA,
    );

    expect(result.plan).not.toBeNull();
    expect(result.totalStatesExplored).toBeGreaterThan(0);
    // NOT toBeDefined(): -Infinity is this planner's *failure* sentinel (returned
    // alongside plan:null on both no-path exits), and NaN / 0 would satisfy it too —
    // the assertion could not fail for any value the function is able to produce.
    // A succeeding plan's joint log-likelihood is a finite sum of log-probabilities,
    // so it is finite and <= 0.
    expect(Number.isFinite(result.jointLogLikelihood)).toBe(true);
    expect(result.jointLogLikelihood).toBeLessThanOrEqual(0);

    // Replay plan and verify goal is reached
    let state = { ...start };
    for (const act of result.plan!) {
      state = step(state, act);
    }
    expect(state.row).toBe(goal.row);
    expect(state.col).toBe(goal.col);
  });
});
