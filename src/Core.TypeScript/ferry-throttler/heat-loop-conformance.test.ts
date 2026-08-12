/**
 * Heat-loop conformance: a real teaching-error envelope must be the only input
 * that can drive heat into transport backpressure. The test observes selection
 * frequency and recovery, so it fails if any bridge is disconnected.
 */
import { describe, expect, test } from "bun:test";
import { makeBatchEnvelope, makeBatchItemCell } from "../protocol/batch-teaching-envelope";
import { createHeatAwareScheduler } from "./heat-aware-scheduler";
import { createStrictPriorityScheduler } from "./drain-scheduler";
import { createNetworkProcessBatch, fakeNetworkTransport } from "./network-transport";

function envelope(accounted: boolean) {
  return makeBatchEnvelope({
    batchFrameId: accounted ? "accounted-frame" : "leaking-frame",
    correlationId: "heat-loop",
    totalItems: 3,
    errors: ["a", "b", "c"].map(itemId => makeBatchItemCell({
      itemId,
      generatorFn: "teach:retry-over-cold-transport",
      dimension: "transport",
      severity: "error",
      reason: "simulated packet loss",
      what: itemId,
      ...(accounted ? { accountedReason: "deliberate migration" } : {}),
    })),
  });
}

const twoBusyLanes = [
  { hasWork: true, queueDepth: 10, bytesQueued: 100, drainCount: 0 },
  { hasWork: true, queueDepth: 10, bytesQueued: 100, drainCount: 0 },
] as const;

describe("HeatLoopConformance", () => {
  test("HLC-1: unaccounted teaching failures → critical band → observable throttle → additive recovery", async () => {
    const scheduler = createHeatAwareScheduler(createStrictPriorityScheduler(), 2);
    const leaking = envelope(false);
    const failed = fakeNetworkTransport({
      ok: false,
      reason: "simulated loss",
      batchTeachingEnvelope: leaking,
    });
    const failProcess = createNetworkProcessBatch(
      { transport: failed, nodeId: "conformance", heatScheduler: scheduler, laneIndex: 0 },
      items => JSON.stringify(items),
    );

    await failProcess(["a", "b", "c"]);
    expect(scheduler.heatWeights[0]).toBeCloseTo(0.1, 8); // critical: 1.0 × 0.1

    let hotLaneSelections = 0;
    let coldLaneSelections = 0;
    for (let tick = 0; tick < 20; tick++) {
      const selected = scheduler.selectLane(twoBusyLanes);
      if (selected === 0) hotLaneSelections++;
      if (selected === 1) coldLaneSelections++;
    }
    // Observable negative control: a critical lane is not merely labelled hot;
    // it loses selection opportunities to an equally busy cold alternative.
    expect(hotLaneSelections).toBeLessThan(coldLaneSelections);

    const succeeded = fakeNetworkTransport({ ok: true, acked: true });
    const recoverProcess = createNetworkProcessBatch(
      { transport: succeeded, nodeId: "conformance", heatScheduler: scheduler, laneIndex: 0 },
      items => JSON.stringify(items),
    );
    for (let drain = 0; drain < 18; drain++) await recoverProcess([`recovery-${drain}`]);
    expect(scheduler.heatWeights[0]).toBe(1.0); // 0.1 + 18 × 0.05, capped at 1
  });

  test("HLC-2 FAULT INJECTION: accounted erasures do not throttle the transport lane", async () => {
    const scheduler = createHeatAwareScheduler(createStrictPriorityScheduler(), 1);
    const accounted = envelope(true);
    const failed = fakeNetworkTransport({
      ok: false,
      reason: "deliberate migration",
      batchTeachingEnvelope: accounted,
    });
    const process = createNetworkProcessBatch(
      { transport: failed, nodeId: "conformance", heatScheduler: scheduler, laneIndex: 0 },
      items => JSON.stringify(items),
    );

    await process(["a", "b", "c"]);
    expect(scheduler.heatWeights[0]).toBe(1.0);
  });

  test("HLC-3 FAULT INJECTION: a bare transport failure without teaching envelope cannot fabricate heat", async () => {
    const scheduler = createHeatAwareScheduler(createStrictPriorityScheduler(), 1);
    const bareFailure = fakeNetworkTransport({ ok: false, reason: "connection refused" });
    const process = createNetworkProcessBatch(
      { transport: bareFailure, nodeId: "conformance", heatScheduler: scheduler, laneIndex: 0 },
      items => JSON.stringify(items),
    );

    await process(["a"]);
    expect(scheduler.heatWeights[0]).toBe(1.0);
  });
});
