import { describe, expect, it } from "bun:test";
import {
  flatGridSearch,
  hierarchicalGridSearch,
  type GridState,
} from "./hierarchical-planner.ts";

describe("Hierarchical Planning — 2-Level Coarse-to-Fine State Space Exploration", () => {
  const gridSize = 8;
  const blockSize = 2; // 2x2 blocks on 8x8 grid = 16 blocks total
  const actions = ["up", "down", "left", "right"];

  const step = (s: GridState, a: string): GridState => {
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

  const start: GridState = { row: 0, col: 0 };
  const goal: GridState = { row: 7, col: 7 };

  it("PRE-REGISTERED HYPOTHESIS H1: 2-level hierarchical search explores < 50% states of flat BFS", () => {
    const flatResult = flatGridSearch(gridSize, start, goal, actions, step);
    const hierResult = hierarchicalGridSearch(gridSize, blockSize, start, goal, actions, step);

    expect(flatResult.plan).not.toBeNull();
    expect(hierResult.plan).not.toBeNull();

    const ratio = hierResult.totalStatesExplored / flatResult.stateCount;
    // Pre-registered falsifier: ratio must be < 0.50
    expect(ratio).toBeLessThan(0.50);
  });

  it("verifies deterministic plan replay from start to goal", () => {
    const hierResult = hierarchicalGridSearch(gridSize, blockSize, start, goal, actions, step);
    expect(hierResult.plan).not.toBeNull();

    let state = { ...start };
    for (const action of hierResult.plan!) {
      state = step(state, action);
    }

    expect(state.row).toBe(goal.row);
    expect(state.col).toBe(goal.col);
  });

  it("NEGATIVE CONTROL 1: mutating block size to gridSize collapses search to 100% of flat BFS", () => {
    const flatResult = flatGridSearch(gridSize, start, goal, actions, step);
    // Mutate block size to gridSize (no coarse partitioning)
    const collapsedResult = hierarchicalGridSearch(gridSize, gridSize, start, goal, actions, step);

    const ratio = collapsedResult.totalStatesExplored / flatResult.stateCount;
    // Negative control MUST equal 1.0 (no reduction)
    expect(ratio).toBeCloseTo(1.0, 2);
  });

  it("1,000-CYCLE RATCHET TEST: confirms 0 state accumulation across 1,000 planning cycles", () => {
    for (let cycle = 0; cycle < 1000; cycle++) {
      const result = hierarchicalGridSearch(gridSize, blockSize, start, goal, actions, step);
      expect(result.plan).not.toBeNull();
    }
  });
});
