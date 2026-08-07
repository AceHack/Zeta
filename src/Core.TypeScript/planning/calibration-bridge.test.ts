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

// ─── resolveAtTickBridge ──────────────────────────────────────────────────────
import { resolveAtTickBridge } from "./calibration-bridge.js";
import { updatePosterior as _updatePosterior } from "./calibration-ledger.js";
import {
  emptyLedger as emptyRankLedger,
  trustBandOf,
} from "./traveler-rank-ledger.js";
import { EMPTY_LEDGER as emptyClaims, recordClaim } from "../observe/self-claims.js";
import { createCalibrationLedger as emptyCalibration } from "./calibration-ledger.js";
// ClaimsLedger type alias for new tests
type ClaimsLedger = ReturnType<typeof emptyClaims>;

describe("resolveAtTickBridge", () => {
  const ZID2 = "zid-agent-B";
  const HAT2 = "hat-task-2";

  it("without CalibrationLedger: behaves identically to resolveAtTick (backward-compat)", () => {
    const claim = makeClaim("item-r1", NOW + ONE_DAY);
    const { claimsLedger: l1 } = bridgeRecordClaim(EMPTY_LEDGER, claim);
    const result = resolveAtTickBridge(l1, NOW + ONE_DAY, new Set());
    expect(result.claimsLedger.resolved[0]?.outcome.status).toBe("missed");
    expect(result.calibrationLedger).toBeUndefined();
  });

  it("without CalibrationLedger: completed item → met (backward-compat)", () => {
    const claim = makeClaim("item-r2", NOW + ONE_DAY);
    const { claimsLedger: l1 } = bridgeRecordClaim(EMPTY_LEDGER, claim);
    const result = resolveAtTickBridge(l1, NOW + ONE_DAY / 2, new Set(["item-r2"]));
    expect(result.claimsLedger.resolved[0]?.outcome.status).toBe("met");
    expect(result.calibrationLedger).toBeUndefined();
  });

  it("with CalibrationLedger: MET claim → prediction settled as hit", () => {
    const claim = makeClaim("item-r3", NOW + ONE_DAY);
    const cal = createCalibrationLedger();
    const { claimsLedger: l1, calibrationLedger: c1 } = bridgeRecordClaim(
      EMPTY_LEDGER, claim, cal, ZID2, HAT2, NOW,
    );
    const completedAtMs = NOW + ONE_DAY / 2;
    const result = resolveAtTickBridge(
      l1!, NOW + ONE_DAY / 2, new Set(["item-r3"]),
      c1, ZID2, HAT2, completedAtMs,
    );
    expect(result.claimsLedger.resolved[0]?.outcome.status).toBe("met");
    const rec = getRecord(result.calibrationLedger!, ZID2, HAT2);
    expect(rec).toBeDefined();
    expect(rec!.outcomes[0]?.settledAt).toBe(completedAtMs);
    expect(rec!.outcomes[0]?.hit).toBe(true);
  });

  it("with CalibrationLedger: MISSED claim → prediction settled as miss (late penalty)", () => {
    const claim = makeClaim("item-r4", NOW + ONE_DAY);
    const cal = createCalibrationLedger();
    const { claimsLedger: l1, calibrationLedger: c1 } = bridgeRecordClaim(
      EMPTY_LEDGER, claim, cal, ZID2, HAT2, NOW,
    );
    const missedAtMs = NOW + 2 * ONE_DAY;
    const result = resolveAtTickBridge(
      l1!, NOW + ONE_DAY, new Set(),
      c1, ZID2, HAT2, missedAtMs,
    );
    expect(result.claimsLedger.resolved[0]?.outcome.status).toBe("missed");
    const rec = getRecord(result.calibrationLedger!, ZID2, HAT2);
    expect(rec!.outcomes[0]?.hit).toBe(false);
    expect(rec!.outcomes[0]?.intervalScore).toBeGreaterThan(0);
  });

  it("with CalibrationLedger: still-pending claims are NOT settled", () => {
    const claimA = makeClaim("item-r5a", NOW + ONE_DAY);
    const claimB = makeClaim("item-r5b", NOW + 3 * ONE_DAY);
    const cal = createCalibrationLedger();
    const { claimsLedger: l1, calibrationLedger: c1 } = bridgeRecordClaim(
      EMPTY_LEDGER, claimA, cal, ZID2, HAT2, NOW,
    );
    const { claimsLedger: l2, calibrationLedger: c2 } = bridgeRecordClaim(
      l1!, claimB, c1, ZID2, HAT2, NOW,
    );
    const result = resolveAtTickBridge(
      l2!, NOW + ONE_DAY, new Set(),
      c2, ZID2, HAT2, NOW + ONE_DAY,
    );
    expect(result.claimsLedger.resolved[0]?.outcome.status).toBe("missed");
    expect(result.claimsLedger.resolved[1]?.outcome.status).toBe("pending");
    const rec = getRecord(result.calibrationLedger!, ZID2, HAT2);
    const o5a = rec!.outcomes.find((o) => o.predictionId === "item-r5a");
    const o5b = rec!.outcomes.find((o) => o.predictionId === "item-r5b");
    expect(o5a!.settledAt).not.toBeNull();
    expect(o5b!.settledAt).toBeNull();
  });

  it("anti-self-certifying: posterior shifts after bulk-miss via resolveAtTickBridge", () => {
    const cal = createCalibrationLedger();
    const posteriorBefore = _updatePosterior(cal, ZID2, HAT2);
    let ledger = EMPTY_LEDGER;
    let calLedger: typeof cal | undefined = cal;
    for (let i = 0; i < 3; i++) {
      const claim = makeClaim(`item-bulk-${i}`, NOW + ONE_DAY);
      const r = bridgeRecordClaim(ledger, claim, calLedger, ZID2, HAT2, NOW);
      ledger = r.claimsLedger;
      calLedger = r.calibrationLedger;
    }
    const result = resolveAtTickBridge(
      ledger, NOW + ONE_DAY, new Set(),
      calLedger, ZID2, HAT2, NOW + 2 * ONE_DAY,
    );
    const posteriorAfter = _updatePosterior(result.calibrationLedger!, ZID2, HAT2);
    expect(posteriorAfter.mu).toBeLessThan(posteriorBefore.mu);
    expect(posteriorAfter.settledCount).toBe(3);
  });

  it("deterministic: same inputs always produce same result (DST §7)", () => {
    const claim = makeClaim("item-det", NOW + ONE_DAY);
    const cal = createCalibrationLedger();
    const { claimsLedger: l1, calibrationLedger: c1 } = bridgeRecordClaim(
      EMPTY_LEDGER, claim, cal, ZID2, HAT2, NOW,
    );
    const r1 = resolveAtTickBridge(l1!, NOW + ONE_DAY, new Set(), c1, ZID2, HAT2, NOW + ONE_DAY);
    const r2 = resolveAtTickBridge(l1!, NOW + ONE_DAY, new Set(), c1, ZID2, HAT2, NOW + ONE_DAY);
    const rec1 = getRecord(r1.calibrationLedger!, ZID2, HAT2);
    const rec2 = getRecord(r2.calibrationLedger!, ZID2, HAT2);
    expect(rec1!.outcomes[0]?.intervalScore).toBe(rec2!.outcomes[0]?.intervalScore);
    expect(rec1!.outcomes[0]?.hit).toBe(rec2!.outcomes[0]?.hit);
  });
});

// ═══ resolveAtTickBridge + TravelerRankLedger co-update ═══════════════════════

describe("resolveAtTickBridge + TravelerRankLedger", () => {
  const BASE_TICK = 1000;
  const BASE_MS = 1_700_000_000_000;
  const ZID = "traveler-rank-test";
  const HAT_ID = "hat-coding";

  function makeClaimsLedger(): ClaimsLedger {
    let ledger = { ...EMPTY_LEDGER };
    ledger = recordClaim(ledger, {
      itemId: "task-A",
      agentId: ZID,
      deadline: BASE_TICK + 100,
      createdAt: BASE_TICK,
    });
    return ledger;
  }

  it("TRL-BRIDGE-1: rankLedger is undefined when not passed", () => {
    const cl = makeClaimsLedger();
    const result = resolveAtTickBridge(cl, BASE_TICK + 200, new Set(["task-A"]));
    expect(result.rankLedger).toBeUndefined();
  });

  it("TRL-BRIDGE-2: rankLedger is updated on a MET claim", () => {
    const cl = makeClaimsLedger();
    const calLedger = createCalibrationLedger();
    const rankLedger = emptyRankLedger;
    const result = resolveAtTickBridge(
      cl, BASE_TICK + 50, new Set(["task-A"]),
      calLedger, ZID, HAT_ID, BASE_MS,
      rankLedger, HAT_ID,
    );
    expect(result.rankLedger).toBeDefined();
    const tb = trustBandOf(ZID, HAT_ID, result.rankLedger!);
    // After 1 hit, trustBand should be above 0.5 (positive skill update)
    expect(tb).toBeGreaterThan(0.5);
  });

  it("TRL-BRIDGE-3: rankLedger is updated on a MISSED claim", () => {
    const cl = makeClaimsLedger();
    const calLedger = createCalibrationLedger();
    const rankLedger = emptyRankLedger;
    // Resolve at a tick AFTER the deadline — claim is missed
    const result = resolveAtTickBridge(
      cl, BASE_TICK + 200, new Set<string>(),
      calLedger, ZID, HAT_ID, BASE_MS,
      rankLedger, HAT_ID,
    );
    expect(result.rankLedger).toBeDefined();
    const tb = trustBandOf(ZID, HAT_ID, result.rankLedger!);
    // After 1 miss, trustBand should be below 0.5 (negative skill update)
    expect(tb).toBeLessThan(0.5);
  });

  it("TRL-BRIDGE-4: trustBand is monotone — 5 hits > 1 hit > fresh > 1 miss > 5 misses", () => {
    function runN(hits: number, misses: number): number {
      let cl = { ...EMPTY_LEDGER };
      let calLedger = createCalibrationLedger();
      let rankLedger = emptyRankLedger;
      for (let i = 0; i < hits + misses; i++) {
        cl = recordClaim(cl, { itemId: `t${i}`, agentId: ZID, deadline: BASE_TICK + 100, createdAt: BASE_TICK });
        const completedItems = i < hits ? new Set([`t${i}`]) : new Set<string>();
        const result = resolveAtTickBridge(
          cl, BASE_TICK + (i < hits ? 50 : 200), completedItems,
          calLedger, ZID, HAT_ID, BASE_MS,
          rankLedger, HAT_ID,
        );
        cl = result.claimsLedger;
        calLedger = result.calibrationLedger!;
        rankLedger = result.rankLedger!;
      }
      return trustBandOf(ZID, HAT_ID, rankLedger);
    }
    const tb5hits = runN(5, 0);
    const tb1hit = runN(1, 0);
    const tbFresh = trustBandOf(ZID, HAT_ID, emptyRankLedger);
    const tb1miss = runN(0, 1);
    const tb5misses = runN(0, 5);
    expect(tb5hits).toBeGreaterThan(tb1hit);
    expect(tb1hit).toBeGreaterThan(tbFresh);
    expect(tbFresh).toBeGreaterThan(tb1miss);
    expect(tb1miss).toBeGreaterThan(tb5misses);
  });

  it("TRL-BRIDGE-5: rankLedger uses rankDomain when provided", () => {
    const cl = makeClaimsLedger();
    const calLedger = createCalibrationLedger();
    const rankLedger = emptyRankLedger;
    const result = resolveAtTickBridge(
      cl, BASE_TICK + 50, new Set(["task-A"]),
      calLedger, ZID, HAT_ID, BASE_MS,
      rankLedger, "custom-domain",
    );
    // trustBand in custom-domain should be updated
    const tbCustom = trustBandOf(ZID, "custom-domain", result.rankLedger!);
    // trustBand in HAT_ID should be fresh (not updated)
    const tbHat = trustBandOf(ZID, HAT_ID, result.rankLedger!);
    expect(tbCustom).toBeGreaterThan(0.5);
    expect(tbHat).toBeCloseTo(0.5, 5); // fresh prior
  });

  it("TRL-BRIDGE-6: rankLedger defaults to hatId domain when rankDomain not provided", () => {
    const cl = makeClaimsLedger();
    const calLedger = createCalibrationLedger();
    const rankLedger = emptyRankLedger;
    const result = resolveAtTickBridge(
      cl, BASE_TICK + 50, new Set(["task-A"]),
      calLedger, ZID, HAT_ID, BASE_MS,
      rankLedger,
      // rankDomain not provided — should default to HAT_ID
    );
    const tbHat = trustBandOf(ZID, HAT_ID, result.rankLedger!);
    expect(tbHat).toBeGreaterThan(0.5);
  });
});
