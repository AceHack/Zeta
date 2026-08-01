import { describe, expect, it } from "bun:test";
import {
  computeMutualEmpowerment,
  computeEmpowermentFloor,
  noPeerDisempowered,
  hatAccumulationDidNotTransfer,
  createFlatSocietyBase,
  boltTaskHierarchy,
  unboltTaskHierarchy,
  type TravelerPeer,
  type TaskHat,
  type HatLedger,
} from "./ephemeral-task-hierarchy.ts";

describe("Ephemeral Task-Bolted Hierarchies & Flat Society Base Model", () => {
  const peers: TravelerPeer[] = [
    { zid: "peer-01", name: "alexa", availableActions: ["move", "broadcast", "read"] },
    { zid: "peer-02", name: "soraya", availableActions: ["move", "verify", "sign"] },
    { zid: "peer-03", name: "otto", availableActions: ["move", "probe", "audit"] },
  ];

  it("verifies base state society is flat, unweighted, and calculates maximin empowerment floor", () => {
    const flatBase = createFlatSocietyBase(peers);
    expect(flatBase.peers.size).toBe(3);
    // Total actions = 3 + 3 + 3 = 9 => E = 9 / 3 = 3.0
    expect(flatBase.mutualEmpowermentScore).toBeCloseTo(3.0, 4);
    expect(flatBase.empowermentFloor).toBe(3);
  });

  it("demonstrates why mean E(S) alone fails and why Rawlsian maximin floor is required", () => {
    const beforePeers: TravelerPeer[] = [
      { zid: "strong-01", name: "strong", availableActions: ["a1", "a2", "a3", "a4", "a5"] },
      { zid: "weak-02", name: "weak", availableActions: ["w1", "w2", "w3", "w4", "w5"] },
    ];

    // Strong peer gains +100 actions while weak peer is stripped (5 -> 0)
    const afterPeers: TravelerPeer[] = [
      { zid: "strong-01", name: "strong", availableActions: Array.from({ length: 105 }, (_, i) => `act-${i}`) },
      { zid: "weak-02", name: "weak", availableActions: [] }, // Disempowered!
    ];

    const meanBefore = computeMutualEmpowerment(beforePeers); // 5.0
    const meanAfter = computeMutualEmpowerment(afterPeers);   // 52.5 (Mean improves 10x!)

    const floorBefore = computeEmpowermentFloor(beforePeers); // 5
    const floorAfter = computeEmpowermentFloor(afterPeers);   // 0 (Floor drops to zero!)

    expect(meanAfter).toBeGreaterThan(meanBefore);
    expect(floorAfter).toBeLessThan(floorBefore);
    // Pareto side-condition correctly flags the disempowerment!
    expect(noPeerDisempowered(beforePeers, afterPeers)).toBeFalse();
  });

  it("non-vacuously confers capabilities during bolt and strips them completely upon unbolt", () => {
    const flatBase = createFlatSocietyBase(peers);
    const task: TaskHat = {
      taskId: "task-nav-64x64",
      goalDescription: "Navigate CHIP-8 nav ROM maze",
      requiredAbstractions: ["Coarse Region BFS", "Fine Room Step"],
      conferredActions: ["chip8-nav-boost"],
    };

    const boltedState = boltTaskHierarchy(flatBase, task);
    expect(boltedState.hierarchy.taskId).toBe("task-nav-64x64");

    // Verify capability was ACTUALLY conferred to assigned peers during bolt
    const peer1Active = boltedState.activePeers.get("peer-01")!;
    expect(peer1Active.availableActions).toContain("chip8-nav-boost");
    expect(peer1Active.hat).toBeDefined();

    // Unbolt and verify complete stripping back to flat base
    // unboltTaskHierarchy returns UnboltResult { state, calibrationLedger } as of the
    // calibration-ledger work — the society state is under .state, and the ledger is passed
    // through untouched (that pass-through is the point: hat time must survive unbolt).
    const restoredBase = unboltTaskHierarchy(boltedState).state;
    expect(restoredBase.peers.get("peer-01")!.availableActions).not.toContain("chip8-nav-boost");
    expect(restoredBase.peers.get("peer-01")!.hat).toBeUndefined();
    expect(restoredBase.empowermentFloor).toBe(3);
  });

  it("NEGATIVE CONTROL 1: fails hatAccumulationDidNotTransfer if an action leaks post-unbolt", () => {
    const wearerBefore: TravelerPeer = peers[0]!;
    const wearerAfterLeaked: TravelerPeer = {
      ...wearerBefore,
      availableActions: [...wearerBefore.availableActions, "leaked-action"],
    };
    const ledger = { wearCount: 1, accumulated: ["leaked-action"] };

    // Negative control MUST return false when an action leaks!
    expect(hatAccumulationDidNotTransfer(wearerBefore, wearerAfterLeaked, ledger)).toBeFalse();
  });

  it("1,000-CYCLE RATCHET TEST: confirms 0 hat accumulation across 1,000 bolt/unbolt cycles", () => {
    let currentBase = createFlatSocietyBase(peers);

    for (let cycle = 0; cycle < 1000; cycle++) {
      const task: TaskHat = {
        taskId: `ratchet-task-${cycle}`,
        goalDescription: `Cycle ${cycle} execution`,
        requiredAbstractions: [`Abs-${cycle % 3}`],
        conferredActions: [`temp-cap-${cycle}`],
      };

      const bolted = boltTaskHierarchy(currentBase, task);
      currentBase = unboltTaskHierarchy(bolted).state;
    }

    // After 1,000 cycles, state MUST be byte-lock identical to original base
    const origPeer = peers[0]!;
    const restoredPeer = currentBase.peers.get("peer-01")!;
    const ledger = { wearCount: 1000, accumulated: Array.from({ length: 1000 }, (_, i) => `temp-cap-${i}`) };
    expect(hatAccumulationDidNotTransfer(origPeer, restoredPeer, ledger)).toBeTrue();
    expect(currentBase.empowermentFloor).toBe(3);
  });
});

// ─── THE TWO INVARIANTS (shadow*, 2026-08-01) ────────────────────────────────
// The architecture is right — ephemeral hats, no permanent class. These test the two
// places permanent imbalance can still accrue underneath a correct architecture.



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
      base = unboltTaskHierarchy(h).state;
    }
    expect(JSON.stringify(Array.from(base.peers.values()))).toBe(snapshot);
    expect(computeEmpowermentFloor(Array.from(base.peers.values()))).toBe(floor0);
  });
});
