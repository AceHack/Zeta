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
 *
 * Soraya review 2026-08-01 — four defects fixed in this revision:
 *   1. Interval score tests added (coverage-at-τ, Gneiting & Raftery 2007 eq. 43).
 *   2. Whitewash boundary test: one-miss case (not just fresh vs 50 hits).
 *   3. Early-miss test: now tests a genuinely early completion, not the late case twice.
 *   4. trustBound clamping: k=3 with fresh prior must not go negative.
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
    const ledger2 = settlePrediction(ledger1, "alice", "hat-A", "pred-1", makeDeadline(5)); // settled within interval — hit
    const rec1 = getRecord(ledger1, "alice", "hat-A")!;
    const rec2 = getRecord(ledger2, "alice", "hat-A")!;
    expect(rec1.outcomes[0]!.hit).toBeNull();
    expect(rec2.outcomes[0]!.hit).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Hit/miss scoring — coverage-at-τ (Gneiting & Raftery 2007 eq. 43)
//
// Declared interval: [predictedAt, predictedDeadline].
// hit = settledAt ∈ [predictedAt, predictedDeadline].
// miss = settledAt outside the interval (either early or late).
//
// FIX (Soraya): The original test "early miss — symmetric penalty" at line 86
// used deadline = -1 day and settledAt = NOW+1, which is the LATE case
// (settledAt > predictedDeadline). It tested the late case twice and never
// tested a genuinely early completion. This revision fixes that.
// ─────────────────────────────────────────────────────────────────────────────

describe("CalibrationLedger — hit/miss scoring (coverage-at-τ)", () => {
  it("settles as hit when settledAt is within [predictedAt, predictedDeadline]", () => {
    let ledger = createCalibrationLedger();
    // predictedAt = NOW, predictedDeadline = NOW+7d, settledAt = NOW+6d → hit
    ledger = recordPrediction(ledger, "bob", "hat-B", "pred-1", makeDeadline(7), NOW);
    ledger = settlePrediction(ledger, "bob", "hat-B", "pred-1", makeDeadline(6));
    const rec = getRecord(ledger, "bob", "hat-B")!;
    expect(rec.outcomes[0]!.hit).toBe(true);
    // Interval score for a hit: (u-l)/T = 7 days / 1 day = 7.0 (no miss penalty)
    expect(rec.outcomes[0]!.intervalScore).toBeCloseTo(7.0, 5);
  });

  it("settles as miss when settledAt > predictedDeadline (late miss)", () => {
    let ledger = createCalibrationLedger();
    // predictedAt = NOW, predictedDeadline = NOW+7d, settledAt = NOW+8d → late miss
    ledger = recordPrediction(ledger, "bob", "hat-B", "pred-2", makeDeadline(7), NOW);
    ledger = settlePrediction(ledger, "bob", "hat-B", "pred-2", makeDeadline(8));
    const rec = getRecord(ledger, "bob", "hat-B")!;
    expect(rec.outcomes[0]!.hit).toBe(false);
    // Interval score: width=7 + latePenalty=(2/0.1)*1 = 7 + 20 = 27.0
    expect(rec.outcomes[0]!.intervalScore).toBeCloseTo(27.0, 5);
  });

  it("settles as miss when settledAt < predictedAt (early miss — genuinely early completion)", () => {
    // FIX: This is the test that was missing. An agent predicted a task would
    // take 7 days (predictedAt=NOW, predictedDeadline=NOW+7d) but it completed
    // in 0.5 days (settledAt = NOW + 0.5d). This is an early miss because
    // the agent's interval was too wide — they sandbagged.
    //
    // NOTE: In the coverage-at-τ model, settledAt < predictedAt is an early
    // miss because the actual completion fell BEFORE the declared interval.
    // This happens when the agent declares a start date in the future but the
    // task completes before that declared start.
    let ledger = createCalibrationLedger();
    // predictedAt = NOW+2d (agent says "I'll start in 2 days"),
    // predictedDeadline = NOW+7d,
    // settledAt = NOW+1d (completed before the declared start — early miss)
    const predictedAt = makeDeadline(2);
    const predictedDeadline = makeDeadline(7);
    const settledAt = makeDeadline(1); // before predictedAt
    ledger = recordPrediction(ledger, "bob", "hat-B", "pred-3", predictedDeadline, predictedAt);
    ledger = settlePrediction(ledger, "bob", "hat-B", "pred-3", settledAt);
    const rec = getRecord(ledger, "bob", "hat-B")!;
    expect(rec.outcomes[0]!.hit).toBe(false);
    // Interval score: width=5 + earlyPenalty=(2/0.1)*1 = 5 + 20 = 25.0
    expect(rec.outcomes[0]!.intervalScore).toBeCloseTo(25.0, 5);
  });

  it("settles as hit when settledAt = predictedAt (lower boundary — inclusive)", () => {
    let ledger = createCalibrationLedger();
    ledger = recordPrediction(ledger, "bob", "hat-B", "pred-4", makeDeadline(7), NOW);
    ledger = settlePrediction(ledger, "bob", "hat-B", "pred-4", NOW); // exactly at lower bound
    const rec = getRecord(ledger, "bob", "hat-B")!;
    expect(rec.outcomes[0]!.hit).toBe(true);
  });

  it("settles as hit when settledAt = predictedDeadline (upper boundary — inclusive)", () => {
    let ledger = createCalibrationLedger();
    ledger = recordPrediction(ledger, "bob", "hat-B", "pred-5", makeDeadline(7), NOW);
    ledger = settlePrediction(ledger, "bob", "hat-B", "pred-5", makeDeadline(7)); // exactly at upper bound
    const rec = getRecord(ledger, "bob", "hat-B")!;
    expect(rec.outcomes[0]!.hit).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Sandbagging prevention — interval score penalises wide intervals
//
// FIX (Soraya): The original settlePrediction used hit = settledAt <= deadline,
// which means argmax(expected score) = D = +∞. The interval score fixes this:
// declaring a wider interval increases the (u-l)/T term, so sandbagging is
// penalised. An agent that declares predictedDeadline = +∞ gets an infinite
// interval score (worst possible).
// ─────────────────────────────────────────────────────────────────────────────

describe("CalibrationLedger — sandbagging prevention", () => {
  it("wider declared interval produces higher (worse) interval score for the same hit", () => {
    // Agent A: narrow interval [NOW, NOW+7d], settles at NOW+6d → hit, score=7
    let ledgerA = createCalibrationLedger();
    ledgerA = recordPrediction(ledgerA, "agentA", "hat-S", "pred-1", makeDeadline(7), NOW);
    ledgerA = settlePrediction(ledgerA, "agentA", "hat-S", "pred-1", makeDeadline(6));
    const recA = getRecord(ledgerA, "agentA", "hat-S")!;

    // Agent B: wide interval [NOW, NOW+30d], settles at NOW+6d → hit, score=30
    let ledgerB = createCalibrationLedger();
    ledgerB = recordPrediction(ledgerB, "agentB", "hat-S", "pred-1", makeDeadline(30), NOW);
    ledgerB = settlePrediction(ledgerB, "agentB", "hat-S", "pred-1", makeDeadline(6));
    const recB = getRecord(ledgerB, "agentB", "hat-S")!;

    // Both are hits, but B's interval score is worse (wider interval)
    expect(recA.outcomes[0]!.hit).toBe(true);
    expect(recB.outcomes[0]!.hit).toBe(true);
    expect(recB.outcomes[0]!.intervalScore!).toBeGreaterThan(recA.outcomes[0]!.intervalScore!);
  });

  it("late miss score is worse than hit score for the same interval width", () => {
    // Hit: settledAt = NOW+6d, interval [NOW, NOW+7d] → score = 7
    let ledgerHit = createCalibrationLedger();
    ledgerHit = recordPrediction(ledgerHit, "agentC", "hat-S", "pred-1", makeDeadline(7), NOW);
    ledgerHit = settlePrediction(ledgerHit, "agentC", "hat-S", "pred-1", makeDeadline(6));
    const recHit = getRecord(ledgerHit, "agentC", "hat-S")!;

    // Late miss: settledAt = NOW+8d, interval [NOW, NOW+7d] → score = 7 + 20 = 27
    let ledgerMiss = createCalibrationLedger();
    ledgerMiss = recordPrediction(ledgerMiss, "agentD", "hat-S", "pred-1", makeDeadline(7), NOW);
    ledgerMiss = settlePrediction(ledgerMiss, "agentD", "hat-S", "pred-1", makeDeadline(8));
    const recMiss = getRecord(ledgerMiss, "agentD", "hat-S")!;

    expect(recMiss.outcomes[0]!.intervalScore!).toBeGreaterThan(recHit.outcomes[0]!.intervalScore!);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. THE ANTI-SELF-CERTIFYING TEST (spec §8)
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
    for (let i = 0; i < 5; i++) {
      ledger = recordPrediction(ledger, "carol", "hat-C", `pred-${i}`, makeDeadline(7), NOW);
      ledger = settlePrediction(ledger, "carol", "hat-C", `pred-${i}`, makeDeadline(5));
    }
    const posterior = updatePosterior(ledger, "carol", "hat-C");
    // Cold-start prior: mu = 2/(2+2) = 0.5. After 5 hits: mu = 7/(7+2) ≈ 0.778
    expect(posterior.mu).toBeGreaterThan(0.5);
    expect(posterior.settledCount).toBe(5);
  });

  it("posterior mu falls below prior mean after multiple misses", () => {
    let ledger = createCalibrationLedger();
    for (let i = 0; i < 5; i++) {
      ledger = recordPrediction(ledger, "dave", "hat-D", `pred-${i}`, makeDeadline(7), NOW);
      ledger = settlePrediction(ledger, "dave", "hat-D", `pred-${i}`, makeDeadline(9));
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

    expect(p300.sigma).toBeLessThan(p3.sigma);
    expect(p3.settledCount).toBe(3);
    expect(p300.settledCount).toBe(300);
  });

  it("unsettled predictions do not affect the posterior (only settled outcomes count)", () => {
    let ledgerSettled = createCalibrationLedger();
    let ledgerUnsettled = createCalibrationLedger();

    for (let i = 0; i < 3; i++) {
      ledgerSettled = recordPrediction(ledgerSettled, "frank", "hat-F", `pred-${i}`, makeDeadline(7), NOW);
      ledgerSettled = settlePrediction(ledgerSettled, "frank", "hat-F", `pred-${i}`, makeDeadline(5));
    }
    for (let i = 0; i < 103; i++) {
      ledgerUnsettled = recordPrediction(ledgerUnsettled, "frank", "hat-F", `pred-${i}`, makeDeadline(7), NOW);
    }
    for (let i = 0; i < 3; i++) {
      ledgerUnsettled = settlePrediction(ledgerUnsettled, "frank", "hat-F", `pred-${i}`, makeDeadline(5));
    }

    const pSettled = updatePosterior(ledgerSettled, "frank", "hat-F");
    const pUnsettled = updatePosterior(ledgerUnsettled, "frank", "hat-F");

    expect(pSettled.mu).toBeCloseTo(pUnsettled.mu, 10);
    expect(pSettled.sigma).toBeCloseTo(pUnsettled.sigma, 10);
    expect(pSettled.settledCount).toBe(3);
    expect(pUnsettled.settledCount).toBe(3); // NOT 103
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Named bounds — sign trap guard and clamping (spec §5, §6)
//
// FIX (Soraya): trustBound must be clamped to [0, 1].
// At k=3 with the cold-start prior (mu≈0.5, sigma≈0.22):
//   trustBound = 0.5 - 3*0.22 = -0.16 → clamped to 0.0
// This is correct: a fresh identity has no trust floor above zero.
//
// FIX (Soraya): The whitewash boundary test at line 215 only tested
// fresh (0 outcomes) vs proven (50 hits). It did not test the one-miss
// case — the actual whitewash boundary. This revision adds that test.
// ─────────────────────────────────────────────────────────────────────────────

describe("exploreBound / trustBound — sign trap guard and clamping", () => {
  it("exploreBound > trustBound for any positive sigma (sign trap guard)", () => {
    let ledger = createCalibrationLedger();
    ledger = recordPrediction(ledger, "grace", "hat-G", "pred-1", makeDeadline(7), NOW);
    ledger = settlePrediction(ledger, "grace", "hat-G", "pred-1", makeDeadline(5));
    const posterior = updatePosterior(ledger, "grace", "hat-G");
    expect(exploreBound(posterior)).toBeGreaterThan(trustBound(posterior));
  });

  it("exploreBound = clamp(mu + k*sigma, 0, 1) and trustBound = clamp(mu - k*sigma, 0, 1)", () => {
    let ledger = createCalibrationLedger();
    for (let i = 0; i < 4; i++) {
      ledger = recordPrediction(ledger, "hank", "hat-H", `pred-${i}`, makeDeadline(7), NOW);
      ledger = settlePrediction(ledger, "hank", "hat-H", `pred-${i}`, i < 3 ? makeDeadline(5) : makeDeadline(9));
    }
    const p = updatePosterior(ledger, "hank", "hat-H");
    const k = 2.0;
    const rawExplore = p.mu + k * p.sigma;
    const rawTrust = p.mu - k * p.sigma;
    expect(exploreBound(p, k)).toBeCloseTo(Math.min(1, Math.max(0, rawExplore)), 10);
    expect(trustBound(p, k)).toBeCloseTo(Math.min(1, Math.max(0, rawTrust)), 10);
  });

  it("trustBound with k=3 on fresh prior is clamped to 0 (not negative)", () => {
    // FIX: trustBound(k=3) = 0.5 - 3*0.22 ≈ -0.16 before clamping.
    // Must be clamped to 0.0, not returned as -0.16.
    const freshLedger = createCalibrationLedger();
    const freshPosterior = updatePosterior(freshLedger, "fresh", "hat-X");
    const tb = trustBound(freshPosterior, 3.0);
    expect(tb).toBeGreaterThanOrEqual(0.0);
    expect(tb).toBeLessThanOrEqual(1.0);
  });

  it("exploreBound is clamped to 1 (not above 1)", () => {
    // With 50 hits, mu ≈ 0.96, sigma ≈ 0.027. exploreBound(k=3) ≈ 0.96 + 0.08 = 1.04 → clamped to 1.
    let ledger = createCalibrationLedger();
    for (let i = 0; i < 50; i++) {
      ledger = recordPrediction(ledger, "topagent", "hat-T", `pred-${i}`, makeDeadline(7), NOW);
      ledger = settlePrediction(ledger, "topagent", "hat-T", `pred-${i}`, makeDeadline(5));
    }
    const p = updatePosterior(ledger, "topagent", "hat-T");
    const eb = exploreBound(p, 3.0);
    expect(eb).toBeLessThanOrEqual(1.0);
    expect(eb).toBeGreaterThanOrEqual(0.0);
  });

  it("trustBound is lower for a fresh identity than for a proven one (sybil resistance)", () => {
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

    expect(trustBound(freshPosterior)).toBeLessThanOrEqual(trustBound(provenPosterior));
  });

  it("whitewash boundary: 0 hits / 1 miss — gap documented, not papered over", () => {
    // FIX (Soraya): The original test only tested fresh vs 50 hits.
    // The actual whitewash boundary is at 0 hits / 1 miss.
    //
    // FINDING: At k=3, both fresh and one-miss clamp to 0.0 (floor).
    // The raw values are:
    //   fresh:    mu=0.5, sigma≈0.224 → 0.5 - 3*0.224 = -0.17 → clamped to 0.0
    //   one-miss: mu=0.4, sigma≈0.200 → 0.4 - 3*0.200 = -0.20 → clamped to 0.0
    // The gap is real in the unclamped space but invisible at the floor.
    // This is the Friedman-Resnick gap: whitewashing is profitable because
    // the floor treats fresh and one-miss identically. The Friedman-Resnick
    // cost model (explicit whitewash cost) is the correct next step.
    //
    // This test documents the gap rather than asserting a strict inequality
    // that the clamping prevents. It is intentionally NOT green on a false claim.
    const freshLedger = createCalibrationLedger();
    const freshPosterior = updatePosterior(freshLedger, "fresh", "hat-W");

    let oneMissLedger = createCalibrationLedger();
    oneMissLedger = recordPrediction(oneMissLedger, "onemiss", "hat-W", "pred-1", makeDeadline(7), NOW);
    oneMissLedger = settlePrediction(oneMissLedger, "onemiss", "hat-W", "pred-1", makeDeadline(9)); // late miss
    const oneMissPosterior = updatePosterior(oneMissLedger, "onemiss", "hat-W");

    const freshTB = trustBound(freshPosterior, 3.0);
    const oneMissTB = trustBound(oneMissPosterior, 3.0);

    // Both clamp to 0 at k=3 — the floor is the same for fresh and one-miss.
    // This is the documented gap: whitewashing is profitable here.
    //
    // ANTI-RECURRENCE (Otto/Soraya, 2026-08-02 — this question has surfaced twice):
    //   This is NOT a prior-shape problem. Beta(2,2) IS the shipped prior
    //   (PRIOR_ALPHA=2, PRIOR_BETA=2 in calibration-ledger.ts, shipped at 5a65daf37).
    //   Soraya's ruling: no prior shape closes this window because the gap is
    //   the clamp at k=3, not the prior mass. Strengthening the prior moves the
    //   wrong way — Beta(2,2) already hands a zero-evidence identity mu=0.5;
    //   an asymmetric pessimistic prior (alpha<beta) only relocates the clamp.
    //   The real whitewash window (P2) was the epsilon-sign / peer-count bug
    //   in vault-state-bridge.ts, which shipped in #9958.
    //   The only levers that change this floor are architecture/values calls:
    //     (a) lower k (gap becomes visible, but floor becomes vacuous), or
    //     (b) raise the clamp floor (should a fresh identity floor above 0?).
    //   Do NOT re-route to Soraya on prior shape — she already answered this.
    //   See docs/research/2026-08-02-caveat-b-* for the separate BusRegime issue.
    expect(freshTB).toBe(0.0);
    expect(oneMissTB).toBe(0.0);

    // The raw (unclamped) posterior mean is lower after one miss — the gap
    // exists in the unclamped space. Verify this so the finding is testable.
    expect(oneMissPosterior.mu).toBeLessThan(freshPosterior.mu);

    // At k=1 (vacuous floor, Soraya's note), the gap IS visible:
    const freshTB_k1 = trustBound(freshPosterior, 1.0);
    const oneMissTB_k1 = trustBound(oneMissPosterior, 1.0);
    // fresh trustBound(k=1) ≈ 0.5 - 0.224 = 0.276
    // one-miss trustBound(k=1) ≈ 0.4 - 0.200 = 0.200
    // Whitewashing is profitable at k=1 too — fresh has a higher floor.
    expect(freshTB_k1).toBeGreaterThan(oneMissTB_k1);
  });

  it("five misses produces lower trustBound than one miss (monotone in miss count)", () => {
    let oneMissLedger = createCalibrationLedger();
    oneMissLedger = recordPrediction(oneMissLedger, "agent", "hat-W", "pred-1", makeDeadline(7), NOW);
    oneMissLedger = settlePrediction(oneMissLedger, "agent", "hat-W", "pred-1", makeDeadline(9));

    let fiveMissLedger = createCalibrationLedger();
    for (let i = 0; i < 5; i++) {
      fiveMissLedger = recordPrediction(fiveMissLedger, "agent", "hat-W", `pred-${i}`, makeDeadline(7), NOW);
      fiveMissLedger = settlePrediction(fiveMissLedger, "agent", "hat-W", `pred-${i}`, makeDeadline(9));
    }

    const p1 = updatePosterior(oneMissLedger, "agent", "hat-W");
    const p5 = updatePosterior(fiveMissLedger, "agent", "hat-W");

    expect(trustBound(p5)).toBeLessThanOrEqual(trustBound(p1));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Ledger is unbolt-immune — passes through unchanged (spec §3.1)
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

    let ledger = createCalibrationLedger();
    ledger = recordPrediction(ledger, "p1", "task-1", "pred-1", makeDeadline(7), NOW);
    ledger = settlePrediction(ledger, "p1", "task-1", "pred-1", makeDeadline(5));

    const result = unboltTaskHierarchy(bolted, undefined, ledger);

    expect(result.calibrationLedger).toBeDefined();
    const rec = getRecord(result.calibrationLedger!, "p1", "task-1");
    expect(rec).toBeDefined();
    expect(rec!.outcomes[0]!.hit).toBe(true);

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
// 7. Query helpers
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
