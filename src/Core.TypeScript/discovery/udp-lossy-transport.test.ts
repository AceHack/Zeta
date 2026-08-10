/**
 * udp-lossy-transport.test.ts — Tests for the lossy UDP transport with Adinkra [8,4,4] ECC.
 *
 * Anti-self-certifying: tests include fault injection (deliberate packet drops) and
 * negative controls (2+ erasures → unrecoverable).
 */
import { describe, it, expect } from "bun:test";
import {
  computeAdinkraParity,
  recoverAdinkraErasure,
  buildSenderBlock,
  addToBlock,
  makeReceiverBlock,
  makeAimdState,
  onNack,
  onSend,
  lossRate,
  encodePacket,
  decodePacket,
  xorParityBlock,
  xorRecoverErasure,
  scheduleGossipRebroadcast,
  LossyUdpChannel,
} from "./udp-lossy-transport";
import { createDimensionalBnn } from "../planning/error-bnn-bridge";

// ── Helpers ────────────────────────────────────────────────────────────────────────────────
function makeData(n: number, seed = 0): Uint8Array[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Uint8Array(8);
    for (let j = 0; j < 8; j++) d[j] = (seed * 37 + i * 13 + j * 7) & 0xff;
    return d;
  });
}

// ── ULT-1: Adinkra parity computation ─────────────────────────────────────────────────────
describe("udp-lossy-transport", () => {
  it("ULT-1: Adinkra parity XORs back to zero over all 8 positions", () => {
    const data = makeData(4, 42);
    const parity = computeAdinkraParity(data);
    expect(parity.length).toBe(4);
    // For a systematic [I|A] code, each parity packet p_j = XOR of data packets where G[i][4+j]=1.
    // Verify: XOR of the relevant data packets equals the parity packet.
    const G = [
      [1, 0, 0, 0, 0, 1, 1, 1],
      [0, 1, 0, 0, 1, 0, 1, 1],
      [0, 0, 1, 0, 1, 1, 0, 1],
      [0, 0, 0, 1, 1, 1, 1, 0],
    ];
    for (let j = 0; j < 4; j++) {
      const expected = new Uint8Array(8);
      for (let i = 0; i < 4; i++) {
        if (G[i]![4 + j] === 1) {
          for (let k = 0; k < 8; k++) expected[k] = expected[k]! ^ data[i]![k]!;
        }
      }
      expect(Array.from(parity[j]!)).toEqual(Array.from(expected));
    }
  });

  // ── ULT-2: Single data erasure recovery ───────────────────────────────────────────────
  it("ULT-2: recovers any single data packet erasure", () => {
    const data = makeData(4, 7);
    const parity = computeAdinkraParity(data);
    const block = [...data, ...parity] as (Uint8Array | null)[];
    for (let erased = 0; erased < 4; erased++) {
      const b = [...block] as (Uint8Array | null)[];
      b[erased] = null;
      const recovered = recoverAdinkraErasure(b);
      expect(recovered).not.toBeNull();
      expect(Array.from(recovered!)).toEqual(Array.from(data[erased]!));
    }
  });

  // ── ULT-3: Single parity erasure recovery ─────────────────────────────────────────────
  it("ULT-3: recovers any single parity packet erasure", () => {
    const data = makeData(4, 99);
    const parity = computeAdinkraParity(data);
    const block = [...data, ...parity] as (Uint8Array | null)[];
    for (let erased = 4; erased < 8; erased++) {
      const b = [...block] as (Uint8Array | null)[];
      b[erased] = null;
      const recovered = recoverAdinkraErasure(b);
      expect(recovered).not.toBeNull();
      expect(Array.from(recovered!)).toEqual(Array.from(parity[erased - 4]!));
    }
  });

  // ── ULT-4: Two erasures are unrecoverable (negative control) ──────────────────────────
  it("ULT-4 (negative): two erasures → unrecoverable", () => {
    const data = makeData(4, 3);
    const parity = computeAdinkraParity(data);
    const block = [...data, ...parity] as (Uint8Array | null)[];
    block[0] = null;
    block[1] = null;
    const recovered = recoverAdinkraErasure(block);
    expect(recovered).toBeNull();
  });

  // ── ULT-5: buildSenderBlock produces correct structure ────────────────────────────────
  it("ULT-5: buildSenderBlock produces 4 data + 4 parity packets", () => {
    const data = makeData(4, 55);
    const block = buildSenderBlock(0, data);
    expect(block.dataPackets.length).toBe(4);
    expect(block.parityPackets.length).toBe(4);
    expect(block.blockSeq).toBe(0);
  });

  // ── ULT-6: Receiver block recovers from 1 dropped packet ─────────────────────────────
  it("ULT-6: receiver block recovers from 1 dropped packet (fault injection)", () => {
    const data = makeData(4, 11);
    const block = buildSenderBlock(0, data);
    const recv = makeReceiverBlock(0);
    const allPkts = [...block.dataPackets, ...block.parityPackets];
    // Drop packet at position 2 (data packet)
    let result: Uint8Array[] | null = null;
    for (let pos = 0; pos < 8; pos++) {
      if (pos === 2) continue; // simulate drop
      result = addToBlock(recv, pos, allPkts[pos]!);
    }
    expect(result).not.toBeNull();
    expect(result!.length).toBe(4);
    expect(Array.from(result![2]!)).toEqual(Array.from(data[2]!));
  });

  // ── ULT-7: Receiver block delivers data when no packets dropped ───────────────────────
  it("ULT-7: receiver block delivers data when no packets dropped", () => {
    const data = makeData(4, 22);
    const block = buildSenderBlock(1, data);
    const recv = makeReceiverBlock(1);
    const allPkts = [...block.dataPackets, ...block.parityPackets];
    let result: Uint8Array[] | null = null;
    // Add data packets first (positions 0-3)
    for (let pos = 0; pos < 4; pos++) {
      result = addToBlock(recv, pos, allPkts[pos]!);
    }
    expect(result).not.toBeNull();
    for (let i = 0; i < 4; i++) {
      expect(Array.from(result![i]!)).toEqual(Array.from(data[i]!));
    }
  });

  // ── ULT-8: AIMD backoff on high loss ─────────────────────────────────────────────────
  it("ULT-8: AIMD doubles gap on high loss (>5%)", () => {
    let state = makeAimdState(10);
    // Simulate 30 sends with 5 NACKs (16.7% loss → above HIGH_LOSS_THRESHOLD=5%)
    // NACKs are interleaved before the window resets at 64 sends
    for (let i = 0; i < 30; i++) state = onSend(state);
    state = onNack(state, 5); // 5/30 = 16.7% loss → multiplicative decrease
    // onNack calls updateAimd which doubles the gap (10 → 20)
    expect(state.gapMs).toBeGreaterThanOrEqual(20);
  });

  // ── ULT-9: AIMD additive increase on low loss ─────────────────────────────────────────
  it("ULT-9: AIMD reduces gap on low loss (<1%)", () => {
    let state = makeAimdState(20);
    // Simulate 64 sends with 0 NACKs (0% loss → below LOW_LOSS_THRESHOLD)
    for (let i = 0; i < 64; i++) state = onSend(state);
    // After window reset, gap should have decreased
    expect(state.gapMs).toBeLessThan(20);
  });

  // ── ULT-10: lossRate returns correct fraction ─────────────────────────────────────────
  it("ULT-10: lossRate returns correct fraction", () => {
    let state = makeAimdState(10);
    // Add sends and NACKs without triggering a window reset (window resets at 64 sends)
    for (let i = 0; i < 10; i++) state = onSend(state);
    // Manually inject nackCount without calling onNack (which triggers updateAimd+reset)
    // Instead, check lossRate before the window resets
    const stateWithNack = { ...state, nackCount: 2 };
    expect(lossRate(stateWithNack)).toBeCloseTo(2 / 10, 5);
  });

  // ── ULT-11: Packet encode/decode round-trip ───────────────────────────────────────────
  it("ULT-11: packet encode/decode round-trip", () => {
    const payload = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    const header = { seq: 42, blockSeq: 5, blockPos: 2, isData: true, payloadLen: 8 };
    const buf = encodePacket(header, payload);
    const decoded = decodePacket(buf);
    expect(decoded).not.toBeNull();
    expect(decoded!.header.seq).toBe(42);
    expect(decoded!.header.blockSeq).toBe(5);
    expect(decoded!.header.blockPos).toBe(2);
    expect(decoded!.header.isData).toBe(true);
    expect(Array.from(decoded!.payload)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  // ── ULT-12: XOR parity fallback recovers 1 erasure ───────────────────────────────────
  it("ULT-12: XOR parity fallback recovers 1 erasure", () => {
    const data = makeData(7, 17);
    const parity = xorParityBlock(data);
    // Drop packet 3
    const withErasure = data.map((d, i) => (i === 3 ? null : d)) as (Uint8Array | null)[];
    const recovered = xorRecoverErasure(withErasure, parity);
    expect(recovered).not.toBeNull();
    expect(Array.from(recovered!)).toEqual(Array.from(data[3]!));
  });

  // ── ULT-13: XOR parity cannot recover 2 erasures (negative control) ──────────────────
  it("ULT-13 (negative): XOR parity cannot recover 2 erasures", () => {
    const data = makeData(7, 88);
    const parity = xorParityBlock(data);
    const withErasure = data.map((d, i) => (i === 1 || i === 4 ? null : d)) as (Uint8Array | null)[];
    const recovered = xorRecoverErasure(withErasure, parity);
    expect(recovered).toBeNull();
  });

  // ── ULT-14: Gossip debounce fires within jitter window ────────────────────────────────
  it("ULT-14: gossip debounce fires within jitter window", async () => {
    let fired = false;
    const cancel = scheduleGossipRebroadcast(
      () => {
        fired = true;
      },
      10,
      30,
    );
    await new Promise((r) => setTimeout(r, 50));
    expect(fired).toBe(true);
    cancel(); // no-op since already fired
  });

  it("ULT-15: teaching NACKs retain and update the supplied Bayesian state", async () => {
    let receive: (text: string, from: string) => void = () => {};
    const bnn = createDimensionalBnn();
    const transport = {
      broadcast: () => {},
      onMessage: (handler: (text: string, from: string) => void) => {
        receive = handler;
      },
    };
    const channel = new LossyUdpChannel(transport, "receiver", bnn);
    let resolveEnvelope: (() => void) | null = null;
    channel.onEnvelope(() => {
      const resolve = resolveEnvelope;
      resolveEnvelope = null;
      resolve?.();
    });

    const sendTeachingNack = async (missingSeq: number): Promise<void> => {
      const observed = new Promise<void>((resolve) => {
        resolveEnvelope = resolve;
      });
      receive(
        JSON.stringify({
          type: "lossy-udp-nack",
          nack: [missingSeq],
          teaching: {
            type: "nack",
            missingSeqs: [missingSeq],
            cause: "timeout",
            why: `sequence ${missingSeq} did not arrive`,
            howToFix: "increase the receive window",
            retractableBeliefId: `received:${missingSeq}`,
          },
        }),
        "sender",
      );
      await observed;
    };

    await sendTeachingNack(1);
    const afterFirst = bnn.states.get("transport")?.obsCount;
    await sendTeachingNack(2);
    const afterSecond = bnn.states.get("transport")?.obsCount;

    expect(afterFirst).toBe(1);
    expect(afterSecond).toBe(2);
  });
});
