/**
 * network-transport.test.ts — verify the ferry→network bridge (anti-Nagle over wire).
 *
 * Proves: batched items go over the network as ONE frame per flush (not one per item),
 * entropy is stamped on each frame, and transport failures are non-fatal.
 */

import { describe, test, expect } from "bun:test";
import { createEntropyTracker } from "../algebra/entropy-tracker";
import { FerryThrottler, DETERMINISTIC_CONFIG } from "./ferry-throttler";
import {
  createNetworkProcessBatch,
  createReticulumProcessBatch,
  fakeNetworkTransport,
  type BatchFrame,
} from "./network-transport";

describe("network-transport — ferry batch → wire frame", () => {
  test("one batch = one network frame (the anti-Nagle property)", async () => {
    const transport = fakeNetworkTransport();
    const processBatch = createNetworkProcessBatch<number>(
      { transport, nodeId: "node-1" },
      (items) => JSON.stringify(items),
    );

    // Simulate a batch of 5 items arriving at once
    await processBatch([1, 2, 3, 4, 5]);

    // ONE frame sent, not five
    expect(transport.sent).toHaveLength(1);
    expect(transport.sent[0]!.count).toBe(5);
    expect(JSON.parse(transport.sent[0]!.payload)).toEqual([1, 2, 3, 4, 5]);
  });

  test("entropy snapshot is stamped on each frame when tracker is wired", async () => {
    const tracker = createEntropyTracker();
    tracker.branch(); tracker.branch(); tracker.branch(); // 3 bits uncertainty

    const transport = fakeNetworkTransport();
    const processBatch = createNetworkProcessBatch<string>(
      { transport, nodeId: "node-2", entropy: tracker },
      (items) => JSON.stringify(items),
    );

    await processBatch(["event-a", "event-b"]);

    const frame = transport.sent[0]!;
    expect(frame.entropy).toBeDefined();
    expect(frame.entropy!.state).toBe(3); // tracker state at flush time
    expect(frame.entropy!.heat).toBe(0);  // no measurements yet
  });

  test("transport failure is non-fatal (fire-and-forget, local log is truth)", async () => {
    const transport = fakeNetworkTransport({ ok: false, reason: "network unreachable" });
    const processBatch = createNetworkProcessBatch<number>(
      { transport, nodeId: "node-3" },
      (items) => JSON.stringify(items),
    );

    // Should not throw — transport failure is logged, not thrown
    await processBatch([1, 2, 3]);

    // Frame was attempted (recorded in sent) even though outcome is failure
    expect(transport.sent).toHaveLength(1);
  });

  test("empty batch sends nothing (no empty frames on the wire)", async () => {
    const transport = fakeNetworkTransport();
    const processBatch = createNetworkProcessBatch<number>(
      { transport, nodeId: "node-4" },
      (items) => JSON.stringify(items),
    );

    await processBatch([]);
    expect(transport.sent).toHaveLength(0);
  });

  test("frame ids are monotone (dedup-safe on the receiver)", async () => {
    const transport = fakeNetworkTransport();
    const processBatch = createNetworkProcessBatch<number>(
      { transport, nodeId: "node-5" },
      (items) => JSON.stringify(items),
    );

    await processBatch([1]);
    await processBatch([2]);
    await processBatch([3]);

    const ids = transport.sent.map((f) => f.id);
    expect(ids).toEqual(["node-5:1", "node-5:2", "node-5:3"]);
  });

  test("priority is stamped on the frame (maps to QoS on the transport)", async () => {
    const transport = fakeNetworkTransport();
    const highPri = createNetworkProcessBatch<string>(
      { transport, nodeId: "node-6" },
      (items) => JSON.stringify(items),
      0, // high priority
    );
    const lowPri = createNetworkProcessBatch<string>(
      { transport, nodeId: "node-6" },
      (items) => JSON.stringify(items),
      2, // low priority
    );

    await highPri(["urgent"]);
    await lowPri(["background"]);

    expect(transport.sent[0]!.priority).toBe(0);
    expect(transport.sent[1]!.priority).toBe(2);
  });
});

describe("network-transport — composes with FerryThrottler end-to-end", () => {
  test("FerryThrottler → network: items batched then sent as one frame", async () => {
    const transport = fakeNetworkTransport();
    const processBatch = createNetworkProcessBatch<number>(
      { transport, nodeId: "e2e-node" },
      (items) => JSON.stringify(items),
    );

    // Wire the ferry throttler with our network processBatch
    const throttler = new FerryThrottler(DETERMINISTIC_CONFIG, processBatch);

    // Enqueue items (they batch in the throttler's internal queue)
    for (let i = 1; i <= 10; i++) {
      await throttler.enqueue(i);
    }

    // Complete flushes all remaining
    await throttler.complete();

    // The throttler batched and flushed — each flush produced one network frame
    expect(transport.sent.length).toBeGreaterThan(0);

    // Total items sent across all frames = 10
    const totalItems = transport.sent.reduce((sum, f) => sum + f.count, 0);
    expect(totalItems).toBe(10);

    // Each frame's payload deserializes to the batch items
    for (const frame of transport.sent) {
      const items = JSON.parse(frame.payload) as number[];
      expect(items.length).toBe(frame.count);
    }
  });
});

describe("createReticulumProcessBatch — mesh broadcast adapter", () => {
  test("broadcasts one JSON frame per batch (not per item)", async () => {
    const broadcasts: string[] = [];
    const fakeMesh = { broadcast: (text: string) => broadcasts.push(text) };

    const processBatch = createReticulumProcessBatch<number>(fakeMesh, {
      nodeId: "mesh-node-1",
    });

    await processBatch([10, 20, 30]);

    expect(broadcasts).toHaveLength(1);
    const frame = JSON.parse(broadcasts[0]!) as BatchFrame;
    expect(frame.count).toBe(3);
    expect(JSON.parse(frame.payload)).toEqual([10, 20, 30]);
    expect(frame.id).toBe("mesh-node-1:1");
  });

  test("entropy is stamped when tracker is provided", async () => {
    const tracker = createEntropyTracker();
    tracker.branch(); tracker.branch();

    const broadcasts: string[] = [];
    const fakeMesh = { broadcast: (text: string) => broadcasts.push(text) };

    const processBatch = createReticulumProcessBatch<string>(fakeMesh, {
      nodeId: "mesh-node-2",
      entropy: tracker,
    });

    await processBatch(["a", "b"]);

    const frame = JSON.parse(broadcasts[0]!) as BatchFrame;
    expect(frame.entropy).toEqual({ state: 2, heat: 0 });
  });
});
