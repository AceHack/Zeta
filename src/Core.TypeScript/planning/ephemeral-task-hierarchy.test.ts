import { describe, expect, it } from "bun:test";
import {
  computeMutualEmpowerment,
  createFlatSocietyBase,
  boltTaskHierarchy,
  unboltTaskHierarchy,
  type TravelerPeer,
  type TaskHat,
} from "./ephemeral-task-hierarchy.ts";

describe("Ephemeral Task-Bolted Hierarchies & Flat Society Base Model", () => {
  const peers: TravelerPeer[] = [
    { zid: "peer-01", name: "alexa", availableActions: ["move", "broadcast", "read"] },
    { zid: "peer-02", name: "soraya", availableActions: ["move", "verify", "sign"] },
    { zid: "peer-03", name: "otto", availableActions: ["move", "probe", "audit"] },
  ];

  it("verifies base state society is flat, unweighted, and calculates mutual empowerment", () => {
    const flatBase = createFlatSocietyBase(peers);
    expect(flatBase.peers.size).toBe(3);
    // Total actions = 3 + 3 + 3 = 9 => E = 9 / 3 = 3.0
    expect(flatBase.mutualEmpowermentScore).toBeCloseTo(3.0, 4);
    expect(computeMutualEmpowerment(peers)).toBeCloseTo(3.0, 4);
  });

  it("instantiates an ephemeral task hierarchy bolted on for a specific goal", () => {
    const flatBase = createFlatSocietyBase(peers);
    const task: TaskHat = {
      taskId: "task-nav-64x64",
      goalDescription: "Navigate CHIP-8 nav ROM maze",
      requiredAbstractions: ["Coarse Region BFS", "Fine Room Step"],
    };

    const hierarchy = boltTaskHierarchy(flatBase, task);
    expect(hierarchy.taskId).toBe("task-nav-64x64");
    expect(hierarchy.levels.length).toBe(2);
    expect(hierarchy.activeHats.size).toBe(2);
  });

  it("dissolves task hierarchy completely, restoring flat unweighted base state with zero residual hierarchy", () => {
    const flatBase = createFlatSocietyBase(peers);
    const task: TaskHat = {
      taskId: "task-nav-64x64",
      goalDescription: "Navigate CHIP-8 nav ROM maze",
      requiredAbstractions: ["Coarse Region BFS"],
    };

    const hierarchy = boltTaskHierarchy(flatBase, task);
    const restoredBase = unboltTaskHierarchy(flatBase, hierarchy);

    expect(restoredBase.peers.size).toBe(3);
    expect(restoredBase.mutualEmpowermentScore).toBeCloseTo(3.0, 4);
  });
});
