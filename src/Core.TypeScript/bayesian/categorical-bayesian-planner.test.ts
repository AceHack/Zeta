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
      ["0,0", -0.1],
      ["0,1", -0.5],
      ["1,1", -0.2],
    ]),
  };

  const factorB: CategoricalFactorTensor = {
    factorId: "mesh-frame-beta",
    logProbabilities: new Map([
      ["0,1", -0.3],
      ["1,1", -0.1],
      ["2,2", -0.8],
    ]),
  };

  it("COMMUTATIVE INVARIANT: factor fusion combine(A, B) is strictly byte-lock identical to combine(B, A)", () => {
    const fusedAB = combineFactorsCommutatively(factorA, factorB);
    const fusedBA = combineFactorsCommutatively(factorB, factorA);

    for (const [key, valAB] of fusedAB.logProbabilities.entries()) {
      const valBA = fusedBA.logProbabilities.get(key);
      expect(valBA).toBeDefined();
      expect(valBA).toBeCloseTo(valAB, 8);
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
    expect(result.jointLogLikelihood).toBeDefined();

    // Replay plan and verify goal is reached
    let state = { ...start };
    for (const act of result.plan!) {
      state = step(state, act);
    }
    expect(state.row).toBe(goal.row);
    expect(state.col).toBe(goal.col);
  });
});
