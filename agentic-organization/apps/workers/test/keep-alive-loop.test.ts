import { deepEqual, equal } from "node:assert/strict";
import { describe, test } from "node:test";

import { runKeepAliveLoop, type KeepAliveLoopLane, type KeepAliveLoopTickRecord } from "../src/keep-alive-loop.ts";

describe("independent keep-alive loop", () => {
  test("ticks the lane on its own cadence up to maxTicks, sleeping the interval between ticks", async () => {
    const lane = recordingLane({ status: "ticked", failures: [] });
    const sleeps: number[] = [];

    const result = await runKeepAliveLoop({
      lane,
      intervalMs: 5_000,
      isStopRequested: () => false,
      sleep: async (ms) => void sleeps.push(ms),
      maxTicks: 3,
    });

    equal(result.ticks, 3);
    equal(result.degradedTicks, 0);
    equal(lane.runCount, 3);
    // sleeps only BETWEEN ticks, not after the last one
    deepEqual(sleeps, [5_000, 5_000]);
  });

  test("stops promptly when a stop is requested", async () => {
    const lane = recordingLane({ status: "ticked", failures: [] });
    let calls = 0;

    const result = await runKeepAliveLoop({
      lane,
      intervalMs: 5_000,
      isStopRequested: () => {
        calls += 1;
        return calls > 2; // allow ~2 ticks then stop
      },
      sleep: async () => {},
    });

    equal(result.ticks <= 2, true);
  });

  test("counts a degraded tick (org flatlining / apply failure) but keeps ticking", async () => {
    const lane = recordingLane({ status: "degraded", failures: [{ message: "reap failed" }] });

    const result = await runKeepAliveLoop({
      lane,
      intervalMs: 1,
      isStopRequested: () => false,
      sleep: async () => {},
      maxTicks: 2,
    });

    equal(result.ticks, 2);
    equal(result.degradedTicks, 2);
  });

  test("captures a thrown lane without killing the heartbeat loop", async () => {
    const lane: KeepAliveLoopLane & { runCount: number } = {
      runCount: 0,
      runOnce: async () => {
        lane.runCount += 1;
        throw new Error("lane exploded");
      },
    };

    const result = await runKeepAliveLoop({
      lane,
      intervalMs: 1,
      isStopRequested: () => false,
      sleep: async () => {},
      maxTicks: 2,
    });

    equal(result.ticks, 2);
    equal(result.thrownTicks, 2);
    equal(result.degradedTicks, 2);
  });

  test("reports each tick to the observer", async () => {
    const lane = recordingLane({ status: "ticked", failures: [] });
    const records: KeepAliveLoopTickRecord[] = [];

    await runKeepAliveLoop({
      lane,
      intervalMs: 1,
      isStopRequested: () => false,
      sleep: async () => {},
      maxTicks: 2,
      observer: { record: (r) => void records.push(r) },
    });

    deepEqual(records, [
      { tick: 1, status: "ticked", failureCount: 0 },
      { tick: 2, status: "ticked", failureCount: 0 },
    ]);
  });
});

function recordingLane(result: {
  status: string;
  failures: readonly { message: string }[];
}): KeepAliveLoopLane & { runCount: number } {
  const lane = {
    runCount: 0,
    runOnce: async () => {
      lane.runCount += 1;
      return result;
    },
  };
  return lane;
}
