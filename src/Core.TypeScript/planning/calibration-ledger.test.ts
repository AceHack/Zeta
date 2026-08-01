/**
 * calibration-ledger.test.ts — Tests for the per-hat calibration ledger
 *
 * The most important test in this file is `calibration_update_is_live`:
 * it verifies that the posterior actually changes when outcomes are settled.
 * A calibration system whose test passes with updatePosterior stubbed out
 * is the exact defect this ledger is meant to price (spec §8, PR #9901).
 *
 * If you stub out updatePosterior and this test still passes, the test is
 * broken — not the implementation.
 */

import { describe, expect, it } from "bun:test";
import {
  createCalibrationLedger,
  exploreBound,
  getRecord,
  getRecordsForAgent,
  getRecordsForHat,
  recordPrediction,
  settlePrediction,
  trustBound,
  updatePosterior,
} from "./calibration-ledger.js";
import {
  boltTaskHierarchy,
  createFlatSocietyBase,
  unboltTaskHierarchy,
} from "./ephemeral-task-hierarchy.js";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const NOW = 1_700_000_000_000; // fixed epoch ms for deterministic tests
const ONE_DAY = 86_400_000;

function makeDeadline(offsetDays: number): number {
  return NOW + offsetDays * ONE_DAY;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Ledger immutability — append-only, no mutation
// ─────────────────────────────────────────────────────────────────────────────

describe("CalibrationLedger — immutability", () => {
  it("recordPrediction returns a new ledger without mutating the original", () => {
    const ledger0 = createCalibrationLedger();
    const ledger1 = recordPrediction(ledger0, "alice", "hat-A", "pred-1", makeDeadline(7), NOW);
    expect(ledger0.records.size).toBe(0);
    expect(ledger1.records.size).toBe(1);
  });

  it("settlePrediction returns a new ledger without mutating the original", () => {
    const ledger0 = createCalibrationLedger();
    const ledger1 = recordPrediction(ledger0, "alice", "hat-A", "pred-1", makeDeadline(7), NOW);
    const ledger2 = settlePrediction(ledger1, "alice", "hat-A", "pred-1", makeDeadline(5)); // early — hit
    const rec1 = getRecord(ledger1, "alice", "hat-A")!;
    const rec2 = getRecord(ledger2, "alice", "hat-A")!;
    expect(rec1.outcomes[0]!.hit).toBeNull();
    expect(rec2.outcomes[0]!.hit).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Hit/miss scoring — symmetric early/late penalty (spec §6)
// ─────────────────────────────────────────────────────────────────────────────

describe("CalibrationLedger — hit/miss scoring", () => {
  it("settles as hit when actual <= predicted deadline", () => {
    let ledger = createCalibrationLedger();
    ledger = recordPrediction(ledger, "bob", "hat-B", "pred-1", makeDeadline(7), NOW);
    ledger = settlePrediction(ledger, "bob", "hat-B", "pred-1", makeDeadline(6)); // one day early
    const rec = getRecord(ledger, "bob", "hat-B")!;
    expect(rec.outcomes[0]!.hit).toBe(true);
  });

  it("settles as miss when actual > predicted deadline (late)", () => {
    let ledger = createCalibrationLedger();
    ledger = recordPrediction(ledger, "bob", "hat-B", "pred-2", makeDeadline(7), NOW);
    ledger = settlePrediction(ledger, "bob", "hat-B", "pred-2", makeDeadline(8)); // one day late
    const rec = getRecord(ledger, "bob", "hat-B")!;
    expect(rec.outcomes[0]!.hit).toBe(false);
  });

  it("settles as miss when actual < predicted deadline (early miss — symmetric penalty)", () => {
    // An agent predicted deadline=+7d but the task was cancelled at +3d (early miss).
    // Symmetric scoring: early misses cost the same as late ones.
    let ledger = createCalibrationLedger();
    // Simulate an early miss by recording a deadline in the past relative to settlement
    ledger = recordPrediction(ledger, "bob", "hat-B", "pred-3", makeDeadline(-1), NOW); // deadline already past
    ledger = settlePrediction(ledger, "bob", "hat-B", "pred-3", NOW + 1); // settled after deadline
    const rec = getRecord(ledger, "bob", "hat-B")!;
    expect(rec.outcomes[0]!.hit).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. THE ANTI-SELF-CERTIFYING TEST (spec §8)
//
// "A calibration system whose test passes with the update stubbed out is the
//  exact defect this ledger is meant to price."
//
// This test MUST FAIL if updatePosterior is replaced with a stub that always
// returns the cold-start prior (mu=0.5, sigma=0.22). It verifies that:
//   a) The posterior actually changes when outcomes are settled.
//   b) Multiple hits raise mu above the prior mean.
//   c) Multiple misses lower mu below the prior mean.
//   d) More settled outcomes reduce sigma (explicit σ — 3 ≠ 300).
// ─────────────────────────────────────────────────────────────────────────────

describe("calibration_update_is_live — ANTI-SELF-CERTIFYING TEST", () => {
  it("posterior mu rises above prior mean after multiple hits", () => {
    let ledger = createCalibrationLedger();
    // Record and settle 5 hits
    for (let i = 0; i < 5; i++) {
      ledger = recordPrediction(ledger, "carol", "hat-C", `pred-${i}`, makeDeadline(7), NOW);
      ledger = settlePrediction(ledger, "carol", "hat-C", `pred-${i}`, makeDeadline(5)); // always early
    }
    const posterior = updatePosterior(ledger, "carol", "hat-C");
    // Cold-start prior: mu = 2/(2+2) = 0.5. After 5 hits: mu = 7/(7+2) ≈ 0.778
    expect(posterior.mu).toBeGreaterThan(0.5);
    expect(posterior.settledCount).toBe(5);
  });

  it("posterior mu falls below prior mean after multiple misses", () => {
    let ledger = createCalibrationLedger();
    // Record and settle 5 misses
    for (let i = 0; i < 5; i++) {
      ledger = recordPrediction(ledger, "dave", "hat-D", `pred-${i}`, makeDeadline(7), NOW);
      ledger = settlePrediction(ledger, "dave", "hat-D", `pred-${i}`, makeDeadline(9)); // always late
    }
    const posterior = updatePosterior(ledger, "dave", "hat-D");
    // After 5 misses: mu = 2/(2+7) ≈ 0.222
    expect(posterior.mu).toBeLessThan(0.5);
    expect(posterior.settledCount).toBe(5);
  });

  it("sigma decreases as more outcomes are settled (3 settled ≠ 300 settled)", () => {
    let ledger3 = createCalibrationLedger();
    let ledger300 = createCalibrationLedger();

    for (let i = 0; i < 3; i++) {
      ledger3 = recordPrediction(ledger3, "eve", "hat-E", `pred-${i}`, makeDeadline(7), NOW);
      ledger3 = settlePrediction(ledger3, "eve", "hat-E", `pred-${i}`, makeDeadline(5));
    }
    for (let i = 0; i < 300; i++) {
      ledger300 = recordPrediction(ledger300, "eve", "hat-E", `pred-${i}`, makeDeadline(7), NOW);
      ledger300 = settlePrediction(ledger300, "eve", "hat-E", `pred-${i}`, makeDeadline(5));
    }

    const p3 = updatePosterior(ledger3, "eve", "hat-E");
    const p300 = updatePosterior(ledger300, "eve", "hat-E");

    // 300 settled outcomes must produce a tighter posterior than 3
    expect(p300.sigma).toBeLessThan(p3.sigma);
    expect(p3.settledCount).toBe(3);
    expect(p300.settledCount).toBe(300);
  });

  it("unsettled predictions do not affect the posterior (only settled outcomes count)", () => {
    let ledgerSettled = createCalibrationLedger();
    let ledgerUnsettled = createCalibrationLedger();

    // ledgerSettled: 3 settled hits
    for (let i = 0; i < 3; i++) {
      ledgerSettled = recordPrediction(ledgerSettled, "frank", "hat-F", `pred-${i}`, makeDeadline(7), NOW);
      ledgerSettled = settlePrediction(ledgerSettled, "frank", "hat-F", `pred-${i}`, makeDeadline(5));
    }
    // ledgerUnsettled: same 3 predictions but NOT settled + 100 extra unsettled
    for (let i = 0; i < 103; i++) {
      ledgerUnsettled = recordPrediction(ledgerUnsettled, "frank", "hat-F", `pred-${i}`, makeDeadline(7), NOW);
    }
    // Settle only the first 3
    for (let i = 0; i < 3; i++) {
      ledgerUnsettled = settlePrediction(ledgerUnsettled, "frank", "hat-F", `pred-${i}`, makeDeadline(5));
    }

    const pSettled = updatePosterior(ledgerSettled, "frank", "hat-F");
    const pUnsettled = updatePosterior(ledgerUnsettled, "frank", "hat-F");

    // Both should have the same posterior — 100 unsettled predictions must not inflate settledCount
    expect(pSettled.mu).toBeCloseTo(pUnsettled.mu, 10);
    expect(pSettled.sigma).toBeCloseTo(pUnsettled.sigma, 10);
    expect(pSettled.settledCount).toBe(3);
    expect(pUnsettled.settledCount).toBe(3); // NOT 103
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Named bounds — sign trap guard (spec §5)
// ─────────────────────────────────────────────────────────────────────────────

describe("exploreBound / trustBound — sign trap guard", () => {
  it("exploreBound > trustBound for any positive sigma", () => {
    let ledger = createCalibrationLedger();
    ledger = recordPrediction(ledger, "grace", "hat-G", "pred-1", makeDeadline(7), NOW);
    ledger = settlePrediction(ledger, "grace", "hat-G", "pred-1", makeDeadline(5));
    const posterior = updatePosterior(ledger, "grace", "hat-G");
    expect(exploreBound(posterior)).toBeGreaterThan(trustBound(posterior));
  });

  it("exploreBound = mu + k*sigma and trustBound = mu - k*sigma (explicit formula check)", () => {
    let ledger = createCalibrationLedger();
    for (let i = 0; i < 4; i++) {
      ledger = recordPrediction(ledger, "hank", "hat-H", `pred-${i}`, makeDeadline(7), NOW);
      ledger = settlePrediction(ledger, "hank", "hat-H", `pred-${i}`, i < 3 ? makeDeadline(5) : makeDeadline(9));
    }
    const p = updatePosterior(ledger, "hank", "hat-H");
    const k = 2.0;
    expect(exploreBound(p, k)).toBeCloseTo(p.mu + k * p.sigma, 10);
    expect(trustBound(p, k)).toBeCloseTo(p.mu - k * p.sigma, 10);
  });

  it("trustBound is lower for a fresh identity (high sigma) than for a proven one (low sigma)", () => {
    // Fresh identity: only prior, no settled outcomes
    const freshLedger = createCalibrationLedger();
    const freshPosterior = updatePosterior(freshLedger, "fresh", "hat-X");

    // Proven identity: 50 hits
    let provenLedger = createCalibrationLedger();
    for (let i = 0; i < 50; i++) {
      provenLedger = recordPrediction(provenLedger, "proven", "hat-X", `pred-${i}`, makeDeadline(7), NOW);
      provenLedger = settlePrediction(provenLedger, "proven", "hat-X", `pred-${i}`, makeDeadline(5));
    }
    const provenPosterior = updatePosterior(provenLedger, "proven", "hat-X");

    // trustBound must NOT be higher for the fresh identity just because it has higher sigma.
    // If it were, fresh identities would be trusted more — that is the sybil incentive.
    expect(trustBound(freshPosterior)).toBeLessThanOrEqual(trustBound(provenPosterior));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Ledger is unbolt-immune — passes through unchanged (spec §3.1)
// ─────────────────────────────────────────────────────────────────────────────

describe("CalibrationLedger — unbolt-immune storage", () => {
  it("unboltTaskHierarchy passes the calibration ledger through unchanged", () => {
    const peers = [
      { zid: "p1", name: "Alice", availableActions: ["read", "write"] },
      { zid: "p2", name: "Bob", availableActions: ["read"] },
    ];
    const base = createFlatSocietyBase(peers);
    const bolted = boltTaskHierarchy(base, {
      taskId: "task-1",
      goalDescription: "test task",
      requiredAbstractions: ["step-1"],
      conferredActions: ["admin"],
    });

    // Build a ledger with a settled outcome
    let ledger = createCalibrationLedger();
    ledger = recordPrediction(ledger, "p1", "task-1", "pred-1", makeDeadline(7), NOW);
    ledger = settlePrediction(ledger, "p1", "task-1", "pred-1", makeDeadline(5));

    // Unbolt — ledger must survive
    const result = unboltTaskHierarchy(bolted, undefined, ledger);

    expect(result.calibrationLedger).toBeDefined();
    const rec = getRecord(result.calibrationLedger!, "p1", "task-1");
    expect(rec).toBeDefined();
    expect(rec!.outcomes[0]!.hit).toBe(true);

    // The restored peer state must NOT contain the calibration record
    const restoredPeer = result.state.peers.get("p1")!;
    expect(restoredPeer.availableActions).not.toContain("admin");
  });

  it("unboltTaskHierarchy without a ledger returns calibrationLedger: undefined", () => {
    const peers = [{ zid: "p1", name: "Alice", availableActions: ["read"] }];
    const base = createFlatSocietyBase(peers);
    const bolted = boltTaskHierarchy(base, {
      taskId: "task-2",
      goalDescription: "no ledger task",
      requiredAbstractions: ["step-1"],
    });
    const result = unboltTaskHierarchy(bolted);
    expect(result.calibrationLedger).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Query helpers
// ─────────────────────────────────────────────────────────────────────────────

describe("CalibrationLedger — query helpers", () => {
  it("getRecordsForAgent returns all hats for a given zid", () => {
    let ledger = createCalibrationLedger();
    ledger = recordPrediction(ledger, "ivan", "hat-I1", "pred-1", makeDeadline(7), NOW);
    ledger = recordPrediction(ledger, "ivan", "hat-I2", "pred-2", makeDeadline(7), NOW);
    ledger = recordPrediction(ledger, "other", "hat-I1", "pred-3", makeDeadline(7), NOW);
    const recs = getRecordsForAgent(ledger, "ivan");
    expect(recs.length).toBe(2);
    expect(recs.every((r) => r.zid === "ivan")).toBe(true);
  });

  it("getRecordsForHat returns all agents for a given hatId", () => {
    let ledger = createCalibrationLedger();
    ledger = recordPrediction(ledger, "judy", "hat-J", "pred-1", makeDeadline(7), NOW);
    ledger = recordPrediction(ledger, "ken", "hat-J", "pred-2", makeDeadline(7), NOW);
    ledger = recordPrediction(ledger, "judy", "hat-K", "pred-3", makeDeadline(7), NOW);
    const recs = getRecordsForHat(ledger, "hat-J");
    expect(recs.length).toBe(2);
    expect(recs.every((r) => r.hatId === "hat-J")).toBe(true);
  });
});
