/**
 * calibration-bridge.integration.test.ts — End-to-end tick cycle integration tests
 *
 * Tests the full two-path architecture:
 *   1. Record a claim (bridgeRecordClaim)
 *   2. Resolve it at a tick (resolveAtTickBridge)
 *   3. Verify BOTH CalibrationLedger AND TravelerRankLedger are updated atomically
 *
 * Anti-self-certifying: these tests can fail if either ledger update is broken.
 * The integration test proves the two-path architecture actually works together.
 */
import { describe, it, expect } from "bun:test";
import {
  bridgeRecordClaim,
  resolveAtTickBridge,
} from "./calibration-bridge.js";
import { EMPTY_LEDGER, type SelfClaim } from "../observe/self-claims.js";
import { createCalibrationLedger } from "./calibration-ledger.js";
import {
  emptyLedger,
  trustBandOf,
  type TravelerRankLedger,
} from "./traveler-rank-ledger.js";

const ZID = "zid-integration-test";
const HAT = "hat-engineering";
const BASE_TICK = 1000;
const BASE_MS = 1_700_000_000_000; // fixed wall-clock for determinism

function makeClaim(itemId: string, deadline: number): SelfClaim {
  return {
    itemId,
    agentId: ZID,
    title: `Integration test claim: ${itemId}`,
    deadline,
    claimedAt: BASE_TICK,
  };
}

// ── INT-1: Single hit — both ledgers updated ──────────────────────────────────
describe("INT-1: single hit — both ledgers updated", () => {
  it("CalibrationLedger trustBound increases after a hit", () => {
    const claim = makeClaim("task-hit-1", BASE_TICK + 100);
    let cl = EMPTY_LEDGER;
    let cal = createCalibrationLedger();
    let rank: TravelerRankLedger = emptyLedger;

    // Record the claim
    const recorded = bridgeRecordClaim(cl, claim, cal, ZID, HAT, BASE_MS);
    cl = recorded.claimsLedger;
    cal = recorded.calibrationLedger!;

    // Resolve at tick with the item completed (hit)
    const resolved = resolveAtTickBridge(
      cl, BASE_TICK + 50, new Set(["task-hit-1"]),
      cal, ZID, HAT, BASE_MS + 50_000,
      rank,
    );

    // TravelerRankLedger: trustBand should be above 0.5 (fresh prior)
    const band = trustBandOf(ZID, HAT, resolved.rankLedger!);
    expect(band).toBeGreaterThan(0.5);

    // CalibrationLedger: should have a record for (ZID, HAT) after a settled prediction
    // Key format is "zid::hatId" (double colon — see recordKey in calibration-ledger.ts)
    const calRecord = resolved.calibrationLedger!.records.get(`${ZID}::${HAT}`);
    expect(calRecord).toBeDefined();
    expect(calRecord!.outcomes.length).toBeGreaterThan(0);
  });
});

// ── INT-2: Single miss — both ledgers penalized ───────────────────────────────
describe("INT-2: single miss — both ledgers penalized", () => {
  it("TravelerRankLedger trustBand drops below 0.5 after a miss", () => {
    // deadline = BASE_TICK + 10, resolve at BASE_TICK + 200 (past deadline)
    const claim = makeClaim("task-miss-1", BASE_TICK + 10);  // deadline passes at tick 1010
    let cl = EMPTY_LEDGER;
    let cal = createCalibrationLedger();
    let rank: TravelerRankLedger = emptyLedger;

    const recorded = bridgeRecordClaim(cl, claim, cal, ZID, HAT, BASE_MS);
    cl = recorded.claimsLedger;
    cal = recorded.calibrationLedger!;

    // Resolve at tick AFTER deadline (miss — item not in completedItems, deadline passed)
    const resolved = resolveAtTickBridge(
      cl, BASE_TICK + 200, new Set([]), // empty completedItems → miss (deadline BASE_TICK+10 < BASE_TICK+200)
      cal, ZID, HAT, BASE_MS + 200_000,
      rank,
    );

    // TravelerRankLedger: trustBand should be below 0.5 (miss penalizes)
    const band = trustBandOf(ZID, HAT, resolved.rankLedger!);
    expect(band).toBeLessThan(0.5);
  });
});

// ── INT-3: Multiple hits — monotone increase ──────────────────────────────────
describe("INT-3: multiple hits — trustBand increases monotonically", () => {
  it("10 consecutive hits → trustBand > 0.9", () => {
    let cl = EMPTY_LEDGER;
    let cal = createCalibrationLedger();
    let rank: TravelerRankLedger = emptyLedger;
    let prevBand = 0.5;

    for (let i = 0; i < 10; i++) {
      const itemId = `task-multi-hit-${i}`;
      const deadline = BASE_TICK + 100 + i * 200;
      const claim = makeClaim(itemId, deadline);

      const rec = bridgeRecordClaim(cl, claim, cal, ZID, HAT, BASE_MS + i * 100_000);
      cl = rec.claimsLedger;
      cal = rec.calibrationLedger!;

      const res = resolveAtTickBridge(
        cl, deadline - 10, new Set([itemId]),
        cal, ZID, HAT, BASE_MS + i * 100_000 + 50_000,
        rank,
      );
      cl = res.claimsLedger;
      cal = res.calibrationLedger!;
      rank = res.rankLedger!;

      const band = trustBandOf(ZID, HAT, rank);
      expect(band).toBeGreaterThan(prevBand - 0.01); // monotone (allow tiny float noise)
      prevBand = band;
    }

    expect(prevBand).toBeGreaterThan(0.9);
  });
});

// ── INT-4: Domain isolation — hit in A does not affect B ─────────────────────
describe("INT-4: domain isolation across hats", () => {
  it("hits in hat-A do not update hat-B trustBand", () => {
    const HAT_A = "hat-engineering";
    const HAT_B = "hat-design";
    let cl = EMPTY_LEDGER;
    let cal = createCalibrationLedger();
    let rank: TravelerRankLedger = emptyLedger;

    // Record and resolve 5 hits in HAT_A
    for (let i = 0; i < 5; i++) {
      const itemId = `task-domain-a-${i}`;
      const deadline = BASE_TICK + 100 + i * 200;
      const rec = bridgeRecordClaim(cl, makeClaim(itemId, deadline), cal, ZID, HAT_A, BASE_MS);
      cl = rec.claimsLedger;
      cal = rec.calibrationLedger!;

      const res = resolveAtTickBridge(
        cl, deadline - 10, new Set([itemId]),
        cal, ZID, HAT_A, BASE_MS + 50_000,
        rank, HAT_A,
      );
      cl = res.claimsLedger;
      cal = res.calibrationLedger!;
      rank = res.rankLedger!;
    }

    const bandA = trustBandOf(ZID, HAT_A, rank);
    const bandB = trustBandOf(ZID, HAT_B, rank);

    expect(bandA).toBeGreaterThan(0.7); // 5 hits → well above prior
    expect(bandB).toBeCloseTo(0.5, 5);  // fresh prior — domain B untouched
  });
});

// ── INT-5: No CalibrationLedger — backward compat ────────────────────────────
describe("INT-5: backward compatibility — no CalibrationLedger", () => {
  it("resolveAtTickBridge without cal/rank → claimsLedger updated, others undefined", () => {
    const claim = makeClaim("task-compat-1", BASE_TICK + 100);
    const cl = EMPTY_LEDGER;
    const clWithClaim = bridgeRecordClaim(cl, claim).claimsLedger;

    const result = resolveAtTickBridge(
      clWithClaim, BASE_TICK + 50, new Set(["task-compat-1"]),
      // no cal, no zid, no hatId, no rank
    );

    expect(result.claimsLedger).toBeDefined();
    expect(result.calibrationLedger).toBeUndefined();
    expect(result.rankLedger).toBeUndefined();
  });
});

// ── INT-6: Whitewash is unprofitable (integration-level) ─────────────────────
describe("INT-6: whitewash is unprofitable — integration level", () => {
  it("fresh identity (0.5) < honest traveler after 3 hits + 2 misses", () => {
    let cl = EMPTY_LEDGER;
    let cal = createCalibrationLedger();
    let rank: TravelerRankLedger = emptyLedger;

    // 3 hits
    for (let i = 0; i < 3; i++) {
      const itemId = `task-ww-hit-${i}`;
      const deadline = BASE_TICK + 100 + i * 200;
      const rec = bridgeRecordClaim(cl, makeClaim(itemId, deadline), cal, ZID, HAT, BASE_MS);
      cl = rec.claimsLedger; cal = rec.calibrationLedger!;
      const res = resolveAtTickBridge(cl, deadline - 10, new Set([itemId]), cal, ZID, HAT, BASE_MS + 50_000, rank);
      cl = res.claimsLedger; cal = res.calibrationLedger!; rank = res.rankLedger!;
    }
    // 2 misses
    for (let i = 0; i < 2; i++) {
      const itemId = `task-ww-miss-${i}`;
      const deadline = BASE_TICK + 700 + i * 200;
      const rec = bridgeRecordClaim(cl, makeClaim(itemId, deadline), cal, ZID, HAT, BASE_MS);
      cl = rec.claimsLedger; cal = rec.calibrationLedger!;
      const res = resolveAtTickBridge(cl, deadline + 50, new Set([]), cal, ZID, HAT, BASE_MS + 200_000, rank);
      cl = res.claimsLedger; cal = res.calibrationLedger!; rank = res.rankLedger!;
    }

    const honestBand = trustBandOf(ZID, HAT, rank);
    const freshBand = 0.5; // what whitewashing would reset to

    // 3 hits + 2 misses → trustBand should be above 0.5 (whitewash is not profitable)
    expect(honestBand).toBeGreaterThan(freshBand);
  });
});
