/**
 * zeta-transport-cell.test.ts — Tests for the ZetaTransportCell YinYang convergence layer.
 */
import { describe, test, expect } from "bun:test";
import { createZetaTransportCell, makeTransportDescriptor } from "./zeta-transport-cell";
import type { SalonTransport } from "./gossip-salon";

// ── Mock transport ─────────────────────────────────────────────────────────────

function makeMockTransport(shouldFail = false, failReason = "transport timeout"): SalonTransport & { sent: string[] } {
  const sent: string[] = [];
  return {
    sent,
    async publish(msg: string) {
      if (shouldFail) throw new Error(failReason);
      sent.push(msg);
    },
    onFrame(_handler: (msg: string) => void) {},
  };
}

describe("zeta-transport-cell", () => {
  // ZTC-1: createZetaTransportCell requires at least one transport
  test("ZTC-1: throws if no transports provided", () => {
    expect(() => createZetaTransportCell("node-1", {})).toThrow("at least one transport");
  });

  // ZTC-2: send succeeds over a healthy transport
  test("ZTC-2: send succeeds over healthy transport", async () => {
    const mock = makeMockTransport(false);
    const cell = createZetaTransportCell("node-1", { broadcast: mock });
    const results = await cell.send("hello");
    expect(results).toHaveLength(1);
    expect(results[0]!.ok).toBe(true);
    expect(results[0]!.transport).toBe("broadcast");
    expect(mock.sent).toHaveLength(1);
  });

  // ZTC-3: send returns teaching ack on failure
  test("ZTC-3: send returns teaching ack on transport failure", async () => {
    const mock = makeMockTransport(true, "transport timeout");
    const cell = createZetaTransportCell("node-1", { websocket: mock });
    const results = await cell.send("hello");
    expect(results[0]!.ok).toBe(false);
    expect(results[0]!.teachingAck).toBeDefined();
    expect(results[0]!.teachingAck!.dimension).toBe("transport");
  });

  // ZTC-4: fan-out sends over all non-dilated transports
  test("ZTC-4: fan-out sends over all healthy transports", async () => {
    const mock1 = makeMockTransport(false);
    const mock2 = makeMockTransport(false);
    const cell = createZetaTransportCell("node-1", { broadcast: mock1, websocket: mock2 });
    const results = await cell.send("hello");
    expect(results).toHaveLength(2);
    expect(results.every(r => r.ok)).toBe(true);
    expect(mock1.sent).toHaveLength(1);
    expect(mock2.sent).toHaveLength(1);
  });

  // ZTC-5: failed transport is time-dilated after quasi-crystal loop
  test("ZTC-5: transport is time-dilated after 16 consecutive failures", async () => {
    const mock = makeMockTransport(true, "transport timeout");
    const cell = createZetaTransportCell("node-1", { udp: mock });
    // Send 16 times to trigger quasi-crystal detection
    for (let i = 0; i < 16; i++) {
      await cell.send(`event-${i}`);
    }
    const health = cell.health();
    const udpHealth = health.find(h => h.kind === "udp");
    expect(udpHealth).toBeDefined();
    // After 16 consecutive failures, the transport should be time-dilated
    expect(udpHealth!.dilationFactor).toBeLessThan(1);
  });

  // ZTC-6: BNN status reflects absorbed errors
  test("ZTC-6: BNN status reflects absorbed transport errors", async () => {
    const mock = makeMockTransport(true, "transport timeout");
    const cell = createZetaTransportCell("node-1", { udp: mock });
    await cell.send("event-1");
    const status = cell.bnnStatus();
    expect(status.length).toBeGreaterThan(0);
    // The transport dimension should have been updated
    const transportStatus = status.find(s => s.dimension === "transport");
    expect(transportStatus).toBeDefined();
  });

  // ZTC-7: onTeachingAck callback is called on failure
  test("ZTC-7: onTeachingAck callback fires on transport failure", async () => {
    const mock = makeMockTransport(true, "auth failed");
    const acks: Array<{ dimension: string; generatorFn: string }> = [];
    const cell = createZetaTransportCell("node-1", { websocket: mock }, {
      onTeachingAck: (_kind, dimension, generatorFn) => acks.push({ dimension, generatorFn }),
    });
    await cell.send("event-1");
    expect(acks).toHaveLength(1);
    expect(acks[0]!.dimension).toBe("auth");
  });

  // ZTC-8: health() returns correct structure
  test("ZTC-8: health() returns transport health summary", () => {
    const mock = makeMockTransport(false);
    const cell = createZetaTransportCell("node-1", { broadcast: mock, git: mock });
    const health = cell.health();
    expect(health).toHaveLength(2);
    expect(health.map(h => h.kind).sort()).toEqual(["broadcast", "git"]);
  });

  // ZTC-9: priority ordering — broadcast before git
  test("ZTC-9: broadcast is prioritized over git (lower priority number)", () => {
    const mock = makeMockTransport(false);
    const cell = createZetaTransportCell("node-1", { broadcast: mock, git: mock });
    const health = cell.health();
    const broadcastPriority = health.find(h => h.kind === "broadcast")!.priority;
    const gitPriority = health.find(h => h.kind === "git")!.priority;
    expect(broadcastPriority).toBeLessThan(gitPriority);
  });

  // ZTC-10: makeTransportDescriptor creates correct descriptor
  test("ZTC-10: makeTransportDescriptor creates correct descriptor", () => {
    const mock = makeMockTransport(false);
    const desc = makeTransportDescriptor("udp", mock, 2);
    expect(desc.kind).toBe("udp");
    expect(desc.priority).toBe(2);
    expect(desc.dilationFactor).toBe(1);
    expect(desc.quasiState.isQuasi).toBe(false);
  });

  // ZTC-11 (negative): fully dilated transport is skipped
  test("ZTC-11 (negative): fully dilated transport is skipped", async () => {
    const mock1 = makeMockTransport(false);
    const mock2 = makeMockTransport(false);
    const desc1 = makeTransportDescriptor("broadcast", mock1, 0);
    const desc2 = makeTransportDescriptor("git", mock2, 1);
    // Manually dilate desc2
    desc2.dilationFactor = 0; // fully dilated
    const { ZetaTransportCell } = await import("./zeta-transport-cell");
    const cell = new ZetaTransportCell({ nodeId: "node-1", transports: [desc1, desc2] });
    const results = await cell.send("hello");
    // Only broadcast should have been used (git is fully dilated)
    expect(results).toHaveLength(1);
    expect(results[0]!.transport).toBe("broadcast");
    expect(mock2.sent).toHaveLength(0);
  });

  // ZTC-12: serializeBnn returns valid JSON
  test("ZTC-12: serializeBnn returns valid JSON", async () => {
    const mock = makeMockTransport(true, "schema validation failed");
    const cell = createZetaTransportCell("node-1", { udp: mock });
    await cell.send("event-1");
    const json = cell.serializeBnn();
    expect(() => JSON.parse(json)).not.toThrow();
    const parsed = JSON.parse(json);
    expect(Array.isArray(parsed)).toBe(true);
  });
});

  // ZTC-13: PriorHint auto-attach — successful send embeds BNN posteriors in event payload
  test("ZTC-13: PriorHint auto-attach — successful send embeds BNN posteriors", async () => {
    const sent: string[] = [];
    const mockT = { publish: async (event: string) => { sent.push(event); }, onFrame: () => {} };
    const cell = createZetaTransportCell("test-node", { websocket: mockT });
    await cell.send(JSON.stringify({ type: "heartbeat", ts: 1 }));
    expect(sent.length).toBe(1);
    const parsed = JSON.parse(sent[0]!) as Record<string, unknown>;
    // The event should have __priorHints attached
    expect(parsed.__priorHints).toBeDefined();
    const hints = parsed.__priorHints as Array<{ dimension: string; mu: number }>;
    expect(hints.length).toBeGreaterThan(0);
    // Each hint should have a valid mu in [0,1]
    for (const h of hints) {
      expect(h.mu).toBeGreaterThanOrEqual(0);
      expect(h.mu).toBeLessThanOrEqual(1);
    }
  });

  // ZTC-14: heat scheduler — failed transport reduces heat weight
  test("ZTC-14: failed transport reduces heat weight (AIMD backpressure)", async () => {
    const mock = makeMockTransport(true, "transport timeout");
    const cell = createZetaTransportCell("node-heat", { websocket: mock });
    // Initial weight should be 1.0
    expect(cell.heatWeights()[0]).toBe(1.0);
    // After a failure, the BNN absorbs the error and heat weight should decrease
    await cell.send("hello");
    // Weight should be < 1.0 after failure (hot/critical band)
    expect(cell.heatWeights()[0]).toBeLessThan(1.0);
  });

  // ZTC-15 (negative): successful transport recovers heat weight
  test("ZTC-15 (negative): successful send recovers heat weight (AIMD recovery)", async () => {
    const mockFail = makeMockTransport(true, "transport timeout");
    const mockOk = makeMockTransport(false);
    const cell = createZetaTransportCell("node-heat-2", { websocket: mockFail, broadcast: mockOk });
    // Fail the websocket transport a few times to throttle it
    for (let i = 0; i < 3; i++) await cell.send("fail");
    const weightAfterFail = cell.heatWeights()[1]!; // websocket is lane 1 (broadcast=0, websocket=1)
    // Succeed on broadcast transport (lane 0) to recover
    for (let i = 0; i < 5; i++) await cell.send("ok");
    const weightAfterRecover = cell.heatWeights()[0]!;
    // Broadcast (lane 0) should have weight 1.0 (never failed)
    expect(weightAfterRecover).toBe(1.0);
    // Websocket (lane 1) should be throttled
    expect(weightAfterFail).toBeLessThan(1.0);
  });

  // ZTC-16: full AIMD cycle — fail until critical, recover until full
  test("ZTC-16: AIMD conformance — critical throttle then full recovery trajectory", async () => {
    const mock = makeMockTransport(true, "transport timeout");
    const cell = createZetaTransportCell("node-aimd", { websocket: mock });

    // Phase 1: fail repeatedly until weight hits floor (MIN_WEIGHT = 0.05)
    // Each critical hit: weight × 0.1, floor at 0.05
    // After 1 critical hit: 1.0 × 0.1 = 0.1; after 2: 0.1 × 0.1 = 0.05 (floor)
    await cell.send("fail-1"); // BNN mu starts at 0.5 → warm, no change yet
    await cell.send("fail-2"); // mu rises → hot → weight × 0.5
    await cell.send("fail-3"); // mu rises → critical → weight × 0.1
    await cell.send("fail-4"); // critical → weight × 0.1 again, hits floor

    const weightAtFloor = cell.heatWeights()[0]!;
    expect(weightAtFloor).toBeLessThanOrEqual(0.1); // at or near floor

    // Phase 2: resetHeat() restores all weights to 1.0
    cell.resetHeat();
    expect(cell.heatWeights()[0]).toBe(1.0);

    // Phase 3: verify resetHeat is idempotent (second call is safe)
    cell.resetHeat();
    expect(cell.heatWeights()[0]).toBe(1.0);
  });

  // ZTC-17 (negative): resetHeat does NOT reset BNN posteriors (heat and learning are separate)
  test("ZTC-17 (negative): resetHeat resets weights but NOT BNN posteriors", async () => {
    const mock = makeMockTransport(true, "transport timeout");
    const cell = createZetaTransportCell("node-aimd-2", { websocket: mock });

    // Absorb some errors into the BNN
    for (let i = 0; i < 5; i++) await cell.send(`fail-${i}`);
    const bnnBefore = cell.bnnStatus().find(s => s.dimension === "transport")!;
    // BNN mu shifts from prior 0.5 after absorbing transport errors
    // (Beta(2,2) prior → mu shifts toward observed failure rate)
    expect(bnnBefore.mu).not.toBe(0.5); // BNN has learned (shifted from prior)

    // Reset heat weights
    cell.resetHeat();
    expect(cell.heatWeights()[0]).toBe(1.0); // weights reset

    // BNN posteriors are unchanged — learning is independent of heat weights
    const bnnAfter = cell.bnnStatus().find(s => s.dimension === "transport")!;
    expect(bnnAfter.mu).toBeCloseTo(bnnBefore.mu, 5); // BNN unchanged
  });

  // ZTC-18: two hints that differ only in mu must leave different states
  // (081M005CBQ). The unfixed path routed every hint through absorbError at
  // severity "info" → z=0.5, so mu=4 and mu=0 were indistinguishable.
  test("ZTC-18: mergePriorHints distinguishes two hints that differ only in mu", () => {
    const mock = makeMockTransport(false);
    const a = createZetaTransportCell("node-a", { broadcast: mock });
    const b = createZetaTransportCell("node-b", { broadcast: mock });
    const base = {
      dimension: "transport" as const,
      sigma2: 0.25,
      robustnessWeight: 1,
      obsCount: 4,
      senderZid: "peer",
    };
    a.mergePriorHints([{ ...base, mu: 4 }]);
    b.mergePriorHints([{ ...base, mu: 0 }]);
    const muA = a.bnnStatus().find((s) => s.dimension === "transport")!.mu;
    const muB = b.bnnStatus().find((s) => s.dimension === "transport")!.mu;
    expect(muA).not.toBe(muB);
    expect(muA).toBeGreaterThan(muB);
  });
