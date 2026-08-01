/**
 * reticulum-metered-transport.ts — High-Precision Reticulum Mesh Transport & Entropy Metering.
 *
 * Provides microsecond-level transport latency measurement, inter-arrival time jitter analytics,
 * and Maxwell-Demon entropy estimation for Reticulum mesh networks.
 *
 * Noninterference & Integrity:
 *   - Pure measurement engine: records real physical transport timings.
 *   - No un-falsified ICO or Tsirelson bound assertions baked into production.
 */

import { destinationHash } from "./reticulum-transport.js";

export interface TransportSample {
  readonly frameId: string;
  readonly srcDest: string;
  readonly dstDest: string;
  readonly sendTimeNs: bigint;
  readonly receiveTimeNs: bigint;
  readonly latencyNs: bigint;
  readonly payloadBytes: number;
}

export interface ReticulumEntropyMetrics {
  readonly totalPacketsMeasured: number;
  readonly meanLatencyMs: number;
  readonly medianLatencyMs: number;
  readonly jitterMs: number;
  readonly minLatencyMs: number;
  readonly maxLatencyMs: number;
  readonly interArrivalEntropyBits: number;
  readonly byteEntropyBits: number;
  readonly maxwellDemonInformationGainBits: number;
}

/**
 * Calculates Shannon entropy H(X) = -sum(p_i * log2(p_i)) over discrete histogram bins.
 */
export function calculateShannonEntropy(values: readonly number[], binCount: number = 32): number {
  if (values.length === 0) return 0;

  let min = Infinity;
  let max = -Infinity;
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }

  if (min === max) return 0;

  const bins = new Uint32Array(binCount);
  const range = max - min;
  for (const v of values) {
    const binIdx = Math.min(binCount - 1, Math.floor(((v - min) / range) * binCount));
    bins[binIdx]!++;
  }

  let entropy = 0;
  const total = values.length;
  for (let i = 0; i < binCount; i++) {
    const count = bins[i]!;
    if (count > 0) {
      const p = count / total;
      entropy -= p * Math.log2(p);
    }
  }

  return entropy;
}

/**
 * Metered Reticulum Node with High-Precision Maxwell Demon Entropy Metering.
 */
export class ReticulumMeteredPeer {
  readonly zid: string;
  readonly destHash: string;
  private readonly samples: TransportSample[] = [];
  private lastReceiveTimeNs?: bigint;

  constructor(zid: string) {
    this.zid = zid;
    this.destHash = destinationHash(zid);
  }

  /**
   * Records high-precision arrival of an incoming Reticulum frame.
   */
  recordFrameArrival(
    frameId: string,
    srcDest: string,
    sendTimeNs: bigint,
    receiveTimeNs: bigint,
    payloadBytes: number,
  ): TransportSample {
    const latencyNs = receiveTimeNs >= sendTimeNs ? receiveTimeNs - sendTimeNs : 0n;
    const sample: TransportSample = {
      frameId,
      srcDest,
      dstDest: this.destHash,
      sendTimeNs,
      receiveTimeNs,
      latencyNs,
      payloadBytes,
    };
    this.samples.push(sample);
    this.lastReceiveTimeNs = receiveTimeNs;
    return sample;
  }

  /**
   * Returns current transport sample count.
   */
  get sampleCount(): number {
    return this.samples.length;
  }

  get lastReceiveNs(): bigint | undefined {
    return this.lastReceiveTimeNs;
  }

  /**
   * Computes Maxwell Demon precise entropy & latency metrics over recorded samples.
   */
  computeEntropyMetrics(): ReticulumEntropyMetrics {
    if (this.samples.length === 0) {
      return {
        totalPacketsMeasured: 0,
        meanLatencyMs: 0,
        medianLatencyMs: 0,
        jitterMs: 0,
        minLatencyMs: 0,
        maxLatencyMs: 0,
        interArrivalEntropyBits: 0,
        byteEntropyBits: 0,
        maxwellDemonInformationGainBits: 0,
      };
    }

    const latenciesMs = this.samples.map((s) => Number(s.latencyNs) / 1e6);
    const sortedLatencies = [...latenciesMs].sort((a, b) => a - b);

    const totalPacketsMeasured = this.samples.length;
    const sumLatency = latenciesMs.reduce((a, b) => a + b, 0);
    const meanLatencyMs = sumLatency / totalPacketsMeasured;
    const medianLatencyMs = sortedLatencies[Math.floor(totalPacketsMeasured / 2)]!;
    const minLatencyMs = sortedLatencies[0]!;
    const maxLatencyMs = sortedLatencies[totalPacketsMeasured - 1]!;

    // Standard deviation / jitter
    const variance =
      latenciesMs.reduce((acc, l) => acc + Math.pow(l - meanLatencyMs, 2), 0) / totalPacketsMeasured;
    const jitterMs = Math.sqrt(variance);

    // Compute inter-arrival deltas for entropy calculation
    const interArrivalDeltasMs: number[] = [];
    for (let i = 1; i < this.samples.length; i++) {
      const deltaNs = this.samples[i]!.receiveTimeNs - this.samples[i - 1]!.receiveTimeNs;
      interArrivalDeltasMs.push(Number(deltaNs) / 1e6);
    }

    const payloadBytesList = this.samples.map((s) => s.payloadBytes);

    const interArrivalEntropyBits = calculateShannonEntropy(interArrivalDeltasMs);
    const byteEntropyBits = calculateShannonEntropy(payloadBytesList);

    // Maxwell Demon Information Gain: I = H_max - H_observed
    const maxEntropy = Math.log2(Math.max(1, interArrivalDeltasMs.length));
    const maxwellDemonInformationGainBits = Math.max(0, maxEntropy - interArrivalEntropyBits);

    return {
      totalPacketsMeasured,
      meanLatencyMs,
      medianLatencyMs,
      jitterMs,
      minLatencyMs,
      maxLatencyMs,
      interArrivalEntropyBits,
      byteEntropyBits,
      maxwellDemonInformationGainBits,
    };
  }
}

/**
 * Multi-Peer Reticulum Mesh Simulator for Network Metering & Benchmarking.
 */
export class ReticulumMeshMeteredNetwork {
  readonly peers: Map<string, ReticulumMeteredPeer> = new Map();

  addPeer(zid: string): ReticulumMeteredPeer {
    const peer = new ReticulumMeteredPeer(zid);
    this.peers.set(peer.destHash, peer);
    return peer;
  }

  /**
   * Broadcasts a frame from sender to all other peers in the mesh, adding simulated transport delay.
   */
  broadcastFrame(
    senderZid: string,
    frameId: string,
    payloadBytes: number,
    baseLatencyMs: number = 2.0,
    jitterStdDevMs: number = 0.5,
  ): TransportSample[] {
    const senderDest = destinationHash(senderZid);
    const samples: TransportSample[] = [];

    const nowNs = BigInt(Math.floor(performance.now() * 1e6));

    for (const [destHash, peer] of this.peers.entries()) {
      if (destHash === senderDest) continue;

      // Simulated network jitter (Box-Muller transform)
      const u1 = Math.random() || 1e-6;
      const u2 = Math.random() || 1e-6;
      const gaussian = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
      const simulatedLatencyMs = Math.max(0.1, baseLatencyMs + gaussian * jitterStdDevMs);

      const delayNs = BigInt(Math.floor(simulatedLatencyMs * 1e6));
      const receiveTimeNs = nowNs + delayNs;

      const sample = peer.recordFrameArrival(frameId, senderDest, nowNs, receiveTimeNs, payloadBytes);
      samples.push(sample);
    }

    return samples;
  }
}
