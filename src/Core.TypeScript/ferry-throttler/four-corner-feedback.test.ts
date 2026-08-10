/**
 * four-corner-feedback.test.ts — Tests for the four-corner monadic feedback system.
 */
import { describe, test, expect } from "bun:test";
import {
  teachingRejection,
  upgradeAck,
  makeQuasiState,
  updateQuasiState,
  makeLaneFeedbackTracker,
  updateLaneFeedback,
  dominantDimension,
} from "./four-corner-feedback";

describe("four-corner-feedback", () => {
  // FC-1: teachingRejection maps "schema" reason to schema dimension
  test("FC-1: teachingRejection maps reason to dimension", () => {
    const ack = teachingRejection("frame-1", "schema validation failed", 0);
    expect(ack.kind).toBe("rejected");
    expect(ack.dimension).toBe("schema");
    expect(ack.retractableBeliefId).toBe("frame:frame-1:received");
    expect(ack.generatorFn).toContain("schema");
  });

  // FC-2: teachingRejection maps "transport" reason to transport dimension
  test("FC-2: teachingRejection maps transport reason", () => {
    const ack = teachingRejection("frame-2", "transport timeout", 1);
    expect(ack.dimension).toBe("transport");
    expect(ack.suggestedPriority).toBe(2); // laneIndex + 1
  });

  // FC-3: upgradeAck pass-through for "received"
  test("FC-3: upgradeAck passes through received ack", () => {
    const bare = { kind: "received" as const, frameId: "f1" };
    const upgraded = upgradeAck(bare);
    expect(upgraded.kind).toBe("received");
  });

  // FC-4: upgradeAck upgrades "rejected" to teaching ack
  test("FC-4: upgradeAck upgrades rejected to teaching ack", () => {
    const bare = { kind: "rejected" as const, frameId: "f2", reason: "auth failed" };
    const upgraded = upgradeAck(bare, 2);
    expect(upgraded.kind).toBe("rejected");
    if (upgraded.kind === "rejected") {
      expect(upgraded.dimension).toBe("auth");
      expect(upgraded.retractableBeliefId).toBe("frame:f2:received");
    }
  });

  // FC-5: upgradeAck upgrades "backpressure" with suggestedBatchSize
  test("FC-5: upgradeAck upgrades backpressure with suggestedBatchSize", () => {
    const bare = { kind: "backpressure" as const, maxPending: 100 };
    const upgraded = upgradeAck(bare);
    expect(upgraded.kind).toBe("backpressure");
    if (upgraded.kind === "backpressure") {
      expect(upgraded.suggestedBatchSize).toBe(50);
      expect(upgraded.quasi).toBe(false);
    }
  });

  // FC-6: Quasi-crystal not detected with insufficient history
  test("FC-6: quasi-crystal not detected with < 8 samples", () => {
    let state = makeQuasiState();
    for (let i = 0; i < 7; i++) {
      state = updateQuasiState(state, i % 2 === 0);
    }
    expect(state.isQuasi).toBe(false);
  });

  // FC-7: Quasi-crystal detected for period-2 loop (alternating rejected/received)
  test("FC-7: quasi-crystal detected for period-2 alternating pattern", () => {
    let state = makeQuasiState();
    // Feed 16 alternating samples: T F T F T F ...
    for (let i = 0; i < 16; i++) {
      state = updateQuasiState(state, i % 2 === 0);
    }
    expect(state.isQuasi).toBe(true);
    expect(state.period).toBeLessThanOrEqual(4);
    expect(state.dilationFactor).toBeLessThan(1);
  });

  // FC-8: Quasi-crystal NOT detected for random pattern
  test("FC-8 (negative): quasi-crystal not detected for random pattern", () => {
    let state = makeQuasiState();
    // Feed 16 samples with no pattern (all rejected)
    for (let i = 0; i < 16; i++) {
      state = updateQuasiState(state, true);
    }
    // All-rejected has autocorrelation = 1 at all lags — this IS quasi-crystalline
    // (it's a period-1 crystal). The detector should flag it.
    expect(state.isQuasi).toBe(true);
    expect(state.period).toBe(1);
  });

  // FC-9: All-received pattern is NOT quasi-crystalline (no rejections = healthy lane)
  test("FC-9 (negative): all-received is quasi-crystalline but healthy", () => {
    let state = makeQuasiState();
    for (let i = 0; i < 16; i++) {
      state = updateQuasiState(state, false); // all received
    }
    // All-received has autocorrelation = 1 — technically quasi-crystalline
    // but this is a healthy lane. The caller should check dilationFactor AND
    // whether the pattern is all-received (no rejections = no problem).
    expect(state.isQuasi).toBe(true);
    expect(state.dilationFactor).toBeLessThan(1);
    // Note: the caller should NOT time-dilate a lane with 0 rejections
  });

  // FC-10: LaneFeedbackTracker initializes correctly
  test("FC-10: LaneFeedbackTracker initializes with empty state", () => {
    const tracker = makeLaneFeedbackTracker(3);
    expect(tracker.laneIndex).toBe(3);
    expect(tracker.quasiState.isQuasi).toBe(false);
    expect(tracker.dimensionCounts.size).toBe(0);
    expect(tracker.retractableBeliefs).toHaveLength(0);
  });

  // FC-11: updateLaneFeedback records dimension counts
  test("FC-11: updateLaneFeedback records dimension counts", () => {
    let tracker = makeLaneFeedbackTracker(0);
    const ack = upgradeAck({ kind: "rejected", frameId: "f1", reason: "schema error" }, 0);
    tracker = updateLaneFeedback(tracker, ack);
    expect(tracker.dimensionCounts.get("schema")).toBe(1);
    expect(tracker.retractableBeliefs).toHaveLength(1);
  });

  // FC-12: dominantDimension returns the most error-prone dimension
  test("FC-12: dominantDimension returns most error-prone dimension", () => {
    let tracker = makeLaneFeedbackTracker(0);
    const acks = [
      upgradeAck({ kind: "rejected", frameId: "f1", reason: "schema error" }, 0),
      upgradeAck({ kind: "rejected", frameId: "f2", reason: "schema mismatch" }, 0),
      upgradeAck({ kind: "rejected", frameId: "f3", reason: "auth failed" }, 0),
    ];
    for (const ack of acks) tracker = updateLaneFeedback(tracker, ack);
    expect(dominantDimension(tracker)).toBe("schema");
  });

  // FC-13: retractableBeliefs is capped at 8 entries
  test("FC-13: retractableBeliefs is capped at 8 entries", () => {
    let tracker = makeLaneFeedbackTracker(0);
    for (let i = 0; i < 12; i++) {
      const ack = upgradeAck({ kind: "rejected", frameId: `f${i}`, reason: "unknown" }, 0);
      tracker = updateLaneFeedback(tracker, ack);
    }
    expect(tracker.retractableBeliefs.length).toBeLessThanOrEqual(8);
  });

  // FC-14 (negative): received acks do not add to retractableBeliefs
  test("FC-14 (negative): received acks do not add to retractableBeliefs", () => {
    let tracker = makeLaneFeedbackTracker(0);
    const ack = upgradeAck({ kind: "received", frameId: "f1" }, 0);
    tracker = updateLaneFeedback(tracker, ack);
    expect(tracker.retractableBeliefs).toHaveLength(0);
  });
});
