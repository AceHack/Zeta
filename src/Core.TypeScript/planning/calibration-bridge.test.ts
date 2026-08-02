/**
 * calibration-bridge.test.ts — Tests for the self-claims ↔ CalibrationLedger bridge.
 *
 * Key properties tested:
 *   1. Without a CalibrationLedger, bridge functions behave identically to the
 *      underlying self-claims functions (no breaking change).
 *   2. With a CalibrationLedger, both ledgers are updated atomically.
 *   3. A met claim produces a hit in the CalibrationLedger (settledAt ∈ interval).
 *   4. A missed claim produces a miss in the CalibrationLedger (settledAt > deadline).
 *   5. The bridge does NOT self-certify: the CalibrationLedger posterior shifts
 *      after a miss — it cannot be green-CI on a false claim.
 */

import { describe, expect, it } from "bun:test";
import { EMPTY_LEDGER } from "../observe/self-claims.js";
import {
  createCalibrationLedger,
  getRecord,
  trustBound,
  updatePosterior,
} from "./calibration-ledger.js";
import {
  bridgeMarkMet,
  bridgeMarkMissed,
  bridgeRecordClaim,
} from "./calibration-bridge.js";

// ─── Helpers ────────────────────────────────────────────────────────────────

const NOW = 1_700_000_000_000; // fixed ms for determinism
const ONE_DAY = 86_400_000;

function makeClaim(itemId: string, deadlineMs: number) {
  return {
    agentId: "agent-A",
    itemId,
    title: `Deliver ${itemId}`,
    deadline: deadlineMs,
    claimedAt: NOW,
  };
}

// ─── Without CalibrationLedger ───────────────────────────────────────────────

describe("bridge without CalibrationLedger (backward-compat)", () => {
  it("bridgeRecordClaim updates only claimsLedger, calibrationLedger stays undefined", () => {
    const claim = makeClaim("item-1", NOW + ONE_DAY);
    const result = bridgeRecordClaim(EMPTY_LEDGER, claim);
    expect(result.claimsLedger.claims).toHaveLength(1);
    expect(result.calibrationLedger).toBeUndefined();
  });

  it("bridgeMarkMet updates only claimsLedger, calibrationLedger stays undefined", () => {
    const claim = makeClaim("item-2", NOW + ONE_DAY);
    const { claimsLedger: l1 } = bridgeRecordClaim(EMPTY_LEDGER, claim);
    const result = bridgeMarkMet(l1, "item-2", "agent-A", NOW + ONE_DAY / 2);
    expect(result.claimsLedger.resolved[0]?.outcome.status).toBe("met");
    expect(result.calibrationLedger).toBeUndefined();
  });

  it("bridgeMarkMissed updates only claimsLedger, calibrationLedger stays undefined", () => {
    const claim = makeClaim("item-3", NOW + ONE_DAY);
    const { claimsLedger: l1 } = bridgeRecordClaim(EMPTY_LEDGER, claim);
    const result = bridgeMarkMissed(l1, "item-3", "agent-A", "too slow");
    expect(result.claimsLedger.resolved[0]?.outcome.status).toBe("missed");
    expect(result.calibrationLedger).toBeUndefined();
  });
});

// ─── With CalibrationLedger ──────────────────────────────────────────────────

describe("bridge with CalibrationLedger", () => {
  const ZID = "zid-agent-A";
  const HAT = "hat-task-1";

  it("bridgeRecordClaim adds a pending prediction to the CalibrationLedger", () => {
    const claim = makeClaim("item-4", NOW + ONE_DAY);
    const cal = createCalibrationLedger();
    const result = bridgeRecordClaim(EMPTY_LEDGER, claim, cal, ZID, HAT, NOW);
    expect(result.calibrationLedger).toBeDefined();
    const rec = getRecord(result.calibrationLedger!, ZID, HAT);
    expect(rec).toBeDefined();
    expect(rec!.outcomes).toHaveLength(1);
    expect(rec!.outcomes[0]!.settledAt).toBeNull();
    expect(rec!.outcomes[0]!.hit).toBeNull();
  });

  it("bridgeMarkMet: met claim → hit in CalibrationLedger (settledAt within interval)", () => {
    const claim = makeClaim("item-5", NOW + ONE_DAY);
    const cal = createCalibrationLedger();
    const { claimsLedger: l1, calibrationLedger: c1 } = bridgeRecordClaim(
      EMPTY_LEDGER, claim, cal, ZID, HAT, NOW,
    );
    // Settle within the interval [NOW, NOW + ONE_DAY]
    const settledAtMs = NOW + ONE_DAY / 2;
    const result = bridgeMarkMet(l1, "item-5", "agent-A", 42, c1, ZID, HAT, settledAtMs);
    expect(result.claimsLedger.resolved[0]?.outcome.status).toBe("met");
    const rec = getRecord(result.calibrationLedger!, ZID, HAT);
    expect(rec!.outcomes[0]!.hit).toBe(true);
    expect(rec!.outcomes[0]!.settledAt).toBe(settledAtMs);
  });

  it("bridgeMarkMissed: missed claim → miss in CalibrationLedger (settledAt after deadline)", () => {
    const claim = makeClaim("item-6", NOW + ONE_DAY);
    const cal = createCalibrationLedger();
    const { claimsLedger: l1, calibrationLedger: c1 } = bridgeRecordClaim(
      EMPTY_LEDGER, claim, cal, ZID, HAT, NOW,
    );
    // Settle after the deadline — late miss
    const missedAtMs = NOW + ONE_DAY + 3_600_000; // 1 hour after deadline
    const result = bridgeMarkMissed(l1, "item-6", "agent-A", "overdue", c1, ZID, HAT, missedAtMs);
    expect(result.claimsLedger.resolved[0]?.outcome.status).toBe("missed");
    const rec = getRecord(result.calibrationLedger!, ZID, HAT);
    expect(rec!.outcomes[0]!.hit).toBe(false);
    expect(rec!.outcomes[0]!.settledAt).toBe(missedAtMs);
  });

  it("posterior shifts after a miss — anti-self-certifying", () => {
    // After a miss, trustBound must be lower than after a hit.
    // This test fails if settlePrediction is disabled (same shape as the
    // calibration-ledger.ts anti-self-certifying test).
    const claim = makeClaim("item-7", NOW + ONE_DAY);
    const cal = createCalibrationLedger();
    const { claimsLedger: l1, calibrationLedger: c1 } = bridgeRecordClaim(
      EMPTY_LEDGER, claim, cal, ZID, HAT, NOW,
    );

    // Scenario A: hit
    const hitMs = NOW + ONE_DAY / 2;
    const { calibrationLedger: cHit } = bridgeMarkMet(l1, "item-7", "agent-A", 42, c1, ZID, HAT, hitMs);
    const posteriorHit = updatePosterior(cHit!, ZID, HAT);
    const boundHit = trustBound(posteriorHit, 3);

    // Scenario B: miss (fresh ledger, same claim)
    const cal2 = createCalibrationLedger();
    const { claimsLedger: l2, calibrationLedger: c2 } = bridgeRecordClaim(
      EMPTY_LEDGER, claim, cal2, ZID, HAT, NOW,
    );
    const missMs = NOW + ONE_DAY + 3_600_000;
    const { calibrationLedger: cMiss } = bridgeMarkMissed(l2, "item-7", "agent-A", "late", c2, ZID, HAT, missMs);
    const posteriorMiss = updatePosterior(cMiss!, ZID, HAT);
    const boundMiss = trustBound(posteriorMiss, 3);

    // After a hit, trustBound must be >= after a miss (or equal at the floor).
    // The posterior MUST have shifted — if it didn't, the bridge is broken.
    expect(posteriorHit.mu).not.toBe(posteriorMiss.mu);
    expect(boundHit).toBeGreaterThanOrEqual(boundMiss);
  });

  it("multiple claims: each is tracked independently by predictionId", () => {
    const cal = createCalibrationLedger();
    const claim1 = makeClaim("item-8a", NOW + ONE_DAY);
    const claim2 = makeClaim("item-8b", NOW + 2 * ONE_DAY);

    const { claimsLedger: l1, calibrationLedger: c1 } = bridgeRecordClaim(
      EMPTY_LEDGER, claim1, cal, ZID, HAT, NOW,
    );
    const { claimsLedger: l2, calibrationLedger: c2 } = bridgeRecordClaim(
      l1, claim2, c1, ZID, HAT, NOW,
    );

    // Settle item-8a as hit, item-8b as miss
    const { calibrationLedger: c3 } = bridgeMarkMet(
      l2, "item-8a", "agent-A", 42, c2, ZID, HAT, NOW + ONE_DAY / 2,
    );
    const { calibrationLedger: c4 } = bridgeMarkMissed(
      l2, "item-8b", "agent-A", "late", c3, ZID, HAT, NOW + 3 * ONE_DAY,
    );

    const rec = getRecord(c4!, ZID, HAT);
    expect(rec!.outcomes).toHaveLength(2);
    const o8a = rec!.outcomes.find((o) => o.predictionId === "item-8a");
    const o8b = rec!.outcomes.find((o) => o.predictionId === "item-8b");
    expect(o8a!.hit).toBe(true);
    expect(o8b!.hit).toBe(false);
  });
});
