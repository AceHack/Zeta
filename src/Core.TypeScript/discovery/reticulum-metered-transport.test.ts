import { describe, expect, it } from "bun:test";
import {
  calculateShannonEntropy,
  ReticulumMeteredPeer,
  ReticulumMeshMeteredNetwork,
} from "./reticulum-metered-transport.ts";

describe("Reticulum Metered Transport & Maxwell Demon Entropy Engine", () => {
  it("calculates Shannon entropy over discrete histogram distributions", () => {
    // Uniform distribution across 8 values
    const uniform = [1, 2, 3, 4, 5, 6, 7, 8];
    const entropy = calculateShannonEntropy(uniform, 8);
    expect(entropy).toBeGreaterThan(2.5);

    // Constant array has zero entropy
    const constant = [5, 5, 5, 5, 5];
    expect(calculateShannonEntropy(constant)).toBe(0);
  });

  it("records high-precision frame arrivals on ReticulumMeteredPeer", () => {
    const peer = new ReticulumMeteredPeer("node-alpha-zeta-01");
    expect(peer.sampleCount).toBe(0);

    const nowNs = BigInt(Date.now()) * 1_000_000n;
    const sample = peer.recordFrameArrival("frame-001", "src-hash-123", nowNs, nowNs + 5_000_000n, 256);

    expect(peer.sampleCount).toBe(1);
    expect(sample.latencyNs).toBe(5_000_000n);
    expect(sample.payloadBytes).toBe(256);
  });

  it("computes Maxwell Demon entropy metrics over multi-sample transport history", () => {
    const peer = new ReticulumMeteredPeer("node-beta-zeta-02");

    let t = BigInt(Date.now()) * 1_000_000n;
    for (let i = 0; i < 50; i++) {
      const latencyNs = BigInt(Math.floor(2_000_000 + (i % 5) * 500_000));
      peer.recordFrameArrival(`frame-${i}`, "src-hash-456", t, t + latencyNs, 128 + (i % 16));
      t += 10_000_000n + BigInt((i % 7) * 1_000_000);
    }

    const metrics = peer.computeEntropyMetrics();
    expect(metrics.totalPacketsMeasured).toBe(50);
    expect(metrics.meanLatencyMs).toBeGreaterThan(1.5);
    expect(metrics.meanLatencyMs).toBeLessThan(5.0);
    expect(metrics.jitterMs).toBeGreaterThan(0);
    expect(metrics.interArrivalEntropyBits).toBeGreaterThan(0);
    expect(metrics.byteEntropyBits).toBeGreaterThan(0);
  });

  it("simulates multi-peer mesh network broadcast and collects metrics", () => {
    const mesh = new ReticulumMeshMeteredNetwork();
    mesh.addPeer("node-p1");
    const p2 = mesh.addPeer("node-p2");
    const p3 = mesh.addPeer("node-p3");

    for (let i = 0; i < 30; i++) {
      mesh.broadcastFrame("node-p1", `broadcast-frame-${i}`, 512, 3.0, 0.8);
    }

    expect(p2.sampleCount).toBe(30);
    expect(p3.sampleCount).toBe(30);

    const metricsP2 = p2.computeEntropyMetrics();
    expect(metricsP2.totalPacketsMeasured).toBe(30);
    expect(metricsP2.meanLatencyMs).toBeGreaterThan(1.0);
    expect(metricsP2.jitterMs).toBeGreaterThan(0);
  });
});
