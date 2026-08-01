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

// ─── THE TWO INVARIANTS (shadow*, 2026-08-01) ────────────────────────────────
// The architecture is right — ephemeral hats, no permanent class. These test the two
// places permanent imbalance can still accrue underneath a correct architecture.

import {
  computeEmpowermentFloor,
  noPeerDisempowered,
  hatAccumulationDidNotTransfer,
  type HatLedger,
} from "./ephemeral-task-hierarchy.ts";

const peer = (zid: string, actions: readonly string[]): TravelerPeer => ({
  zid,
  name: zid,
  availableActions: actions,
});

describe("INVARIANT 1 — maximin, not mean", () => {
  it("THE DEFECT: the MEAN rises while the weakest peer is stripped to zero", () => {
    const before = [peer("strong", ["a", "b"]), peer("weak", ["c", "d", "e", "f", "g"])];
    const after = [peer("strong", Array.from({ length: 100 }, (_, i) => `s${i}`)), peer("weak", [])];
    // the mean IMPROVES — which is exactly why it is the wrong objective
    expect(computeMutualEmpowerment(after)).toBeGreaterThan(computeMutualEmpowerment(before));
    // the FLOOR correctly collapses
    expect(computeEmpowermentFloor(before)).toBe(2);
    expect(computeEmpowermentFloor(after)).toBe(0);
    // and the guard rejects it
    expect(noPeerDisempowered(before, after)).toBe(false);
  });

  it("accepts a change that raises the floor (a high-capacity peer lifting the worst-off)", () => {
    const before = [peer("a", ["x"]), peer("b", ["x", "y"])];
    const after = [peer("a", ["x", "z"]), peer("b", ["x", "y"])];
    expect(noPeerDisempowered(before, after)).toBe(true);
    expect(computeEmpowermentFloor(after)).toBeGreaterThan(computeEmpowermentFloor(before));
  });

  it("NEGATIVE CONTROL: the guard is not vacuous — it rejects a single peer losing one action", () => {
    const before = [peer("a", ["x", "y"]), peer("b", ["x", "y"])];
    const after = [peer("a", ["x", "y"]), peer("b", ["x"])];
    expect(noPeerDisempowered(before, after)).toBe(false);
  });
});

describe("INVARIANT 2 — a hat may accumulate, but nothing it accumulates may flow to its wearer", () => {
  const ledger: HatLedger = { wearCount: 999, accumulated: ["root-access", "override-quorum"] };

  it("THE HAZARD: an inherited action from the hat's ledger is rejected (Horcrux, not Sorting Hat)", () => {
    const beforeWearing = peer("p", ["read"]);
    const afterRemoving = peer("p", ["read", "root-access"]); // leaked from the ledger
    expect(hatAccumulationDidNotTransfer(beforeWearing, afterRemoving, ledger)).toBe(false);
  });

  it("a hat that accumulates but confers nothing passes, however many wearings", () => {
    const beforeWearing = peer("p", ["read"]);
    const afterRemoving = peer("p", ["read"]);
    expect(hatAccumulationDidNotTransfer(beforeWearing, afterRemoving, ledger)).toBe(true);
    expect(ledger.wearCount).toBe(999); // accumulation itself is NOT the hazard
  });

  it("RATCHET TEST: 1000 bolt/unbolt cycles leave the society byte-identical", () => {
    // A bounded timeframe does NOT bound accumulation — a 5-second hat worn 1000 times has
    // accumulated 1000 times. Single-cycle dissolution tests cannot see a ratchet; each cycle
    // may leave a sliver. This runs the loop.
    const peers = [peer("a", ["x"]), peer("b", ["y", "z"])];
    let base = createFlatSocietyBase(peers);
    const snapshot = JSON.stringify(Array.from(base.peers.values()));
    const floor0 = computeEmpowermentFloor(Array.from(base.peers.values()));
    for (let i = 0; i < 1000; i++) {
      const h = boltTaskHierarchy(base, {
        taskId: `t${i}`,
        goalDescription: "cycle",
        requiredAbstractions: ["coarse", "fine"],
      });
      base = unboltTaskHierarchy(base, h);
    }
    expect(JSON.stringify(Array.from(base.peers.values()))).toBe(snapshot);
    expect(computeEmpowermentFloor(Array.from(base.peers.values()))).toBe(floor0);
  });
});
