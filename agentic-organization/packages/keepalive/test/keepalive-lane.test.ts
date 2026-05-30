import { equal } from "node:assert/strict";
import { test } from "node:test";
import { KeepAliveActionKind, type KeepAliveSnapshot } from "../src/keepalive.ts";
import {
  KeepAliveLaneStatus,
  createKeepAliveLane,
  type KeepAliveActionSink,
  type KeepAliveSnapshotSource,
} from "../src/keepalive-lane.ts";

function fixedSource(snapshot: KeepAliveSnapshot): KeepAliveSnapshotSource {
  return { loadSnapshot: async () => snapshot };
}

function recordingSink(): KeepAliveActionSink & { kinds: string[] } {
  const kinds: string[] = [];
  return {
    kinds,
    applyAction: async (action) => {
      kinds.push(action.kind);
    },
  };
}

const aliveSnapshot: KeepAliveSnapshot = {
  nowMs: 1000,
  orgHeartbeatAgeMs: 5_000,
  orgHeartbeatDeadlineMs: 30_000,
  agents: [],
  leases: [],
};

test("a tick on a live, idle org applies exactly the heartbeat action and reports Ticked", async () => {
  const sink = recordingSink();
  const lane = createKeepAliveLane({ source: fixedSource(aliveSnapshot), sink });
  const result = await lane.runOnce();
  equal(result.status, KeepAliveLaneStatus.Ticked);
  equal(sink.kinds.length, 1);
  equal(sink.kinds[0], KeepAliveActionKind.EmitHeartbeat);
  equal(result.appliedCount, 1);
});

test("a flatlining org reports Degraded and still applies its actions", async () => {
  const sink = recordingSink();
  const lane = createKeepAliveLane({
    source: fixedSource({ ...aliveSnapshot, orgHeartbeatAgeMs: 60_000 }),
    sink,
  });
  const result = await lane.runOnce();
  equal(result.status, KeepAliveLaneStatus.Degraded);
  equal(sink.kinds.includes(KeepAliveActionKind.RaiseOrgStallAlert), true);
});

test("a sink failure is captured as a lane failure, not thrown (loop must not die)", async () => {
  const lane = createKeepAliveLane({
    source: fixedSource(aliveSnapshot),
    sink: {
      applyAction: async () => {
        throw new Error("sink exploded");
      },
    },
  });
  const result = await lane.runOnce();
  equal(result.status, KeepAliveLaneStatus.Degraded);
  equal(result.failures.length, 1);
  equal(result.failures[0]?.message.includes("sink exploded"), true);
});

test("a source failure is captured as a lane failure, not thrown", async () => {
  const lane = createKeepAliveLane({
    source: {
      loadSnapshot: async () => {
        throw new Error("source exploded");
      },
    },
    sink: recordingSink(),
  });
  const result = await lane.runOnce();
  equal(result.status, KeepAliveLaneStatus.Degraded);
  equal(result.failures[0]?.message.includes("source exploded"), true);
  equal(result.appliedCount, 0);
});
