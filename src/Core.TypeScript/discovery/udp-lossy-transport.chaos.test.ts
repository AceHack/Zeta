/**
 * udp-lossy-transport.chaos.test.ts — UCH-1..UCH-16.
 *
 * These are CHAOS tests of a lossy channel, complementing (not replacing) ULT-1..ULT-16 in
 * `udp-lossy-transport.test.ts`, which are unit tests of the algebra and the state machine.
 *
 * Two of these tests exist to record that a SUSPECTED gap was not a real defect (UCH-9, UCH-10):
 * reordering and duplication were untested but the transport handles both correctly. Recording a
 * disproved suspicion is worth as much as recording a confirmed one, and cheaper than
 * rediscovering it.
 *
 * Four record defects the existing suite cannot see (UCH-13, UCH-14, UCH-15, UCH-16). Each is
 * written so it FAILS if the defect is fixed — they pin CURRENT MEASURED BEHAVIOUR, not desired
 * behaviour, and they say so, so nobody reads a green suite as an endorsement.
 */
import { describe, it, expect } from "bun:test";
import {
  drawUnit,
  drawU64,
  STREAM,
  burstParams,
  analyticLossRate,
  stationaryBadFraction,
  gilbertElliottTrace,
  generatorFromModule,
  invertGf2,
  mlDecodeBlock,
  runFerry,
  defaultConfig,
  buildWire,
  applyFaults,
  runScenario,
  characteriseCliff,
  BLOCK_TOTAL,
} from "./udp-lossy-transport.chaos";
import {
  computeAdinkraParity,
  recoverAdinkraErasure,
  makeAimdState,
  onSend,
  onNack,
  LossyUdpChannel,
} from "./udp-lossy-transport";

describe("udp-lossy-transport.chaos", () => {
  // ── UCH-1: the entropy channel is deterministic and counter-addressable ──────────────────
  it("UCH-1: draws are a pure function of (seed, stream, index) — replay is exact and O(1)", () => {
    const a = drawUnit(0x5eedn, STREAM.loss, 91847);
    const b = drawUnit(0x5eedn, STREAM.loss, 91847);
    expect(a).toBe(b);
    // Counter-addressable: index 91847 is reachable without generating 0..91846.
    expect(drawUnit(0x5eedn, STREAM.loss, 91848)).not.toBe(a);
    // Seed separation.
    expect(drawUnit(0x5eeen, STREAM.loss, 91847)).not.toBe(a);
    // In range.
    for (let i = 0; i < 500; i++) {
      const u = drawUnit(0x1234n, STREAM.loss, i);
      expect(u).toBeGreaterThanOrEqual(0);
      expect(u).toBeLessThan(1);
    }
    // 64-bit width is genuinely used (not silently collapsed to a small range).
    expect(drawU64(1n, 1, 1)).toBeGreaterThan(0n);
  });

  // ── UCH-2: fault streams are independent ────────────────────────────────────────────────
  it("UCH-2: changing the reorder/duplicate rate does not perturb the loss trace", () => {
    const loss = burstParams(0.05, 4);
    const base = defaultConfig({ blocks: 200, seed: 0xbeefn, loss });
    const wire = buildWire(base, "adinkra844");
    const t0 = applyFaults(wire, base).trace;
    const t1 = applyFaults(wire, { ...base, reorderProbability: 0.3, reorderDepth: 9 }).trace;
    const t2 = applyFaults(wire, { ...base, duplicateProbability: 0.4 }).trace;
    expect(t1.dropCount).toBe(t0.dropCount);
    expect(t2.dropCount).toBe(t0.dropCount);
    expect(t1.dropped).toEqual(t0.dropped);
    expect(t2.dropped).toEqual(t0.dropped);
  });

  // ── UCH-3: the loss model is METERED, not a toy — it matches its closed form ─────────────
  it("UCH-3: measured loss rate matches the analytic stationary rate p/(p+r)", () => {
    const N = 200_000;
    for (const [rate, L] of [
      [0.05, 1],
      [0.05, 4],
      [0.15, 8],
    ] as [number, number][]) {
      const params = burstParams(rate, L);
      expect(analyticLossRate(params)).toBeCloseTo(rate, 6);
      expect(stationaryBadFraction(params)).toBeCloseTo(rate, 6);
      const trace = gilbertElliottTrace(N, params, 0xabcdn);
      // 200k samples: sampling error is well under 1 percentage point.
      expect(Math.abs(trace.dropCount / N - rate)).toBeLessThan(0.005);
    }
  });

  it("UCH-4: measured mean burst length matches the model's 1/r", () => {
    const N = 200_000;
    for (const L of [2, 4, 8]) {
      const trace = gilbertElliottTrace(N, burstParams(0.15, L), 0xabcdn);
      expect(trace.meanBurstLength).toBeGreaterThan(L * 0.9);
      expect(trace.meanBurstLength).toBeLessThan(L * 1.1);
    }
  });

  it("UCH-5: meanBurstLength=1 degenerates to i.i.d. Bernoulli — every burst has length 1", () => {
    const trace = gilbertElliottTrace(50_000, burstParams(0.1, 1), 0xabcdn);
    expect(trace.meanBurstLength).toBeCloseTo(1, 10);
    expect([...trace.burstHistogram.keys()]).toEqual([1]);
  });

  // ── UCH-6: the harness reads the generator FROM the module (drift guard) ─────────────────
  it("UCH-6: generatorFromModule reproduces the module's own parity map", () => {
    const G = generatorFromModule();
    expect(G).toEqual([
      [1, 0, 0, 0, 0, 1, 1, 1],
      [0, 1, 0, 0, 1, 0, 1, 1],
      [0, 0, 1, 0, 1, 1, 0, 1],
      [0, 0, 0, 1, 1, 1, 1, 0],
    ]);
    // Round-trip through the live parity function on non-trivial data.
    const data = Array.from({ length: 4 }, (_, i) => Uint8Array.from([i + 1, i * 7 + 3, 0xff - i, i]));
    const parity = computeAdinkraParity(data);
    for (let j = 0; j < 4; j++) {
      const expected = new Uint8Array(4);
      for (let i = 0; i < 4; i++) {
        if (G[i]![4 + j] === 1) for (let b = 0; b < 4; b++) expected[b] = expected[b]! ^ data[i]![b]!;
      }
      expect(Array.from(parity[j]!)).toEqual(Array.from(expected));
    }
    // Sanity on the GF(2) inverter itself.
    expect(
      invertGf2([
        [1, 0],
        [0, 1],
      ]),
    ).toEqual([
      [1, 0],
      [0, 1],
    ]);
    expect(
      invertGf2([
        [1, 1],
        [1, 1],
      ]),
    ).toBeNull();
  });

  // ── UCH-7: the CAPABILITY GAP, as a test ────────────────────────────────────────────────
  // A linear code with minimum distance d corrects ANY d−1 erasures. [8,4,4] has d=4, so it
  // corrects any 3. The shipped `recoverAdinkraErasure` handles exactly 1 and returns null at 2.
  // This test pins BOTH facts side by side so the gap is a fact on file, not an opinion.
  it("UCH-7: the [8,4,4] code corrects any 3 erasures; the shipped decoder stops at 1", () => {
    const data = Array.from({ length: 4 }, (_, i) => Uint8Array.from([i * 31 + 1, 200 - i, i, 0x5a ^ i]));
    const parity = computeAdinkraParity(data);
    const full = [...data, ...parity] as (Uint8Array | null)[];
    const G = generatorFromModule();

    let mlRecovered = 0;
    let implRecovered = 0;
    let patterns = 0;
    for (let a = 0; a < BLOCK_TOTAL; a++)
      for (let b = a + 1; b < BLOCK_TOTAL; b++)
        for (let c = b + 1; c < BLOCK_TOTAL; c++) {
          patterns++;
          const blk = [...full];
          blk[a] = null;
          blk[b] = null;
          blk[c] = null;
          const ml = mlDecodeBlock(blk, G);
          if (ml && ml.every((s, i) => Array.from(s).every((v, k) => v === data[i]![k]))) mlRecovered++;
          if (recoverAdinkraErasure(blk) !== null) implRecovered++;
        }
    expect(patterns).toBe(56);
    // Every 3-erasure pattern is recoverable — the code's guarantee, measured.
    expect(mlRecovered).toBe(56);
    // The shipped decoder recovers none of them. This is the gap.
    expect(implRecovered).toBe(0);
  });

  // ── UCH-8: DoP is a throughput knob, never a semantics knob ─────────────────────────────
  it("UCH-8: results are byte-identical at DoP 1, 2 and 8", async () => {
    const cfg = defaultConfig({
      blocks: 800,
      seed: 0x5eedn,
      loss: burstParams(0.05, 4),
      reorderProbability: 0.1,
      reorderDepth: 8,
      duplicateProbability: 0.1,
    });
    const r1 = await runScenario(cfg, "impl-adinkra", 1);
    const r2 = await runScenario(cfg, "impl-adinkra", 2);
    const r8 = await runScenario(cfg, "impl-adinkra", 8);
    expect(r2.dataPacketsDelivered).toBe(r1.dataPacketsDelivered);
    expect(r8.dataPacketsDelivered).toBe(r1.dataPacketsDelivered);
    expect(r2.blocksLost).toBe(r1.blocksLost);
    expect(r8.blocksLost).toBe(r1.blocksLost);
    // The ferry itself preserves input order regardless of DoP.
    const items = Array.from({ length: 200 }, (_, i) => i);
    const seq = await runFerry(items, 1, async (x) => x * 2);
    const par = await runFerry(items, 16, async (x) => x * 2);
    expect(par).toEqual(seq);
  });

  // ── UCH-9: duplication — §12 idempotency HOLDS (a suspected gap that was not one) ────────
  it("UCH-9: duplication is idempotent — apply-N == apply-once, up to 100% duplication", async () => {
    const base = { blocks: 1500, seed: 0x5eedn, loss: burstParams(0, 1) };
    const clean = await runScenario(defaultConfig(base), "impl-adinkra", 1);
    for (const p of [0.1, 0.5, 1.0]) {
      const dup = await runScenario(defaultConfig({ ...base, duplicateProbability: p }), "impl-adinkra", 1);
      expect(dup.dataPacketsDelivered).toBe(clean.dataPacketsDelivered);
      expect(dup.corruptDeliveries).toBe(0);
      expect(dup.blocksLost).toBe(0);
      expect(dup.deliveryRatio).toBe(1);
    }
  });

  // ── UCH-10: reordering — block assembly is order-free (also NOT a defect) ────────────────
  // `addToBlock(block, pos, payload)` is indexed by position within the block, and `recvBlocks`
  // is keyed by blockSeq, so out-of-order arrival cannot mis-assemble a block. Pinned because
  // it was suspected and is worth not re-suspecting.
  it("UCH-10: block assembly is lossless under reordering, to depth 32", async () => {
    for (const [p, depth] of [
      [0.05, 3],
      [0.2, 8],
      [0.2, 32],
    ] as [number, number][]) {
      const cfg = defaultConfig({
        blocks: 1500,
        seed: 0x5eedn,
        loss: burstParams(0, 1),
        reorderProbability: p,
        reorderDepth: depth,
      });
      const r = await runScenario(cfg, "impl-adinkra", 1);
      expect(r.deliveryRatio).toBe(1);
      expect(r.corruptDeliveries).toBe(0);
    }
  });

  // ── UCH-11: THE FALSE GREEN — uniform loss hides the correlated-failure cliff ────────────
  it("UCH-11: at one fixed loss rate, correlation alone moves delivery — uniform reports a false green", async () => {
    const base = { blocks: 6000, seed: 0x5eedn };
    const uniform = await runScenario(defaultConfig({ ...base, loss: burstParams(0.05, 1) }), "ml-adinkra", 1);
    const bursty = await runScenario(defaultConfig({ ...base, loss: burstParams(0.05, 8) }), "ml-adinkra", 1);
    // Same mean loss rate, to within sampling error.
    expect(Math.abs(uniform.observedLossRate - bursty.observedLossRate)).toBeLessThan(0.02);
    // Uniform loss is essentially invisible to the code — this is the false green.
    expect(uniform.deliveryRatio).toBeGreaterThan(0.999);
    // Correlated loss at the SAME rate is not.
    expect(bursty.deliveryRatio).toBeLessThan(0.96);
    // The gap is the measurement a uniform injector would have thrown away.
    expect(uniform.deliveryRatio - bursty.deliveryRatio).toBeGreaterThan(0.04);
  });

  // ── UCH-12: the cliff, as numbers ───────────────────────────────────────────────────────
  // Reported, not asserted as a requirement: the highest swept loss rate holding >= 99%
  // delivery. Bounds are deliberately loose (one grid step) so this fails on a REGRESSION,
  // not on sampling noise.
  it("UCH-12: cliff — the shipped decoder holds 99% delivery only to ~2% uniform / ~0.5-1% bursty loss", async () => {
    const rates = [0.005, 0.01, 0.02, 0.03, 0.05, 0.08, 0.12, 0.2, 0.3];
    const impl = await characteriseCliff("impl-adinkra", rates, [1, 4], { blocks: 2000, seed: 0x5eedn }, 0.99, 1);
    const ml = await characteriseCliff("ml-adinkra", rates, [1, 4], { blocks: 2000, seed: 0x5eedn }, 0.99, 1);

    const implUniform = impl.cliffByBurstLength.get(1);
    const implBursty = impl.cliffByBurstLength.get(4);
    const mlUniform = ml.cliffByBurstLength.get(1);
    const mlBursty = ml.cliffByBurstLength.get(4);

    // Shipped decoder: falls off an order of magnitude earlier than the code allows.
    expect(implUniform).not.toBeNull();
    expect(implUniform!).toBeLessThanOrEqual(0.03);
    expect(implBursty!).toBeLessThanOrEqual(0.02);

    // Same code, full-capability decoder: an order of magnitude more headroom on uniform loss.
    expect(mlUniform!).toBeGreaterThanOrEqual(0.12);
    expect(mlBursty!).toBeGreaterThanOrEqual(0.02);
    expect(mlUniform!).toBeGreaterThan(implUniform!);
  });

  // ── UCH-13: the XOR fallback is NOT worse — which is the signal something is wrong ───────
  // The module header presents XOR-only (rate 7/8) as the low-bandwidth compromise for LoRa/BLE
  // and [8,4,4] (rate 4/8) as the choice for high-bandwidth UDP. Measured on goodput — delivered
  // data packets per wire packet, the only fair cross-rate comparison — the shipped [8,4,4] path
  // is DOMINATED by the XOR fallback across the whole useful operating range. It pays 50%
  // overhead for the same 1-erasure-per-8 correction the XOR code provides at 12.5%.
  //
  // PINS CURRENT BEHAVIOUR. If the transport adopts a full-capability decoder this SHOULD fail.
  it("UCH-13: XOR-7/8 goodput dominates the shipped [8,4,4] path at every measured loss rate", async () => {
    for (const [rate, L] of [
      [0.0, 1],
      [0.02, 1],
      [0.05, 4],
      [0.1, 4],
      [0.2, 4],
    ] as [number, number][]) {
      const cfg = defaultConfig({ blocks: 3000, seed: 0x5eedn, loss: burstParams(rate, L) });
      const impl = await runScenario(cfg, "impl-adinkra", 1);
      const xor = await runScenario(cfg, "xor7of8", 1);
      expect(xor.goodput).toBeGreaterThan(impl.goodput);
    }
    // And the shipped [8,4,4] decoder never exceeds the 0.5 goodput ceiling its rate imposes.
    const clean = await runScenario(
      defaultConfig({ blocks: 1000, seed: 0x5eedn, loss: burstParams(0, 1) }),
      "impl-adinkra",
      1,
    );
    expect(clean.goodput).toBeCloseTo(0.5, 6);
  });

  // ── UCH-14: AIMD evaluates against a PARTIAL window ──────────────────────────────────────
  // `onNack` calls `updateAimd` immediately, and `updateAimd` RESETS the window on every
  // evaluation. So the loss estimate is never "NACKs per 64 packets" as `LOSS_WINDOW = 64` and
  // the module comment state — it is "1 NACK per packets-since-the-last-NACK". A single NACK
  // arriving within 19 sends therefore reads as >5% loss and doubles the gap.
  //
  // ULT-8/9/10 cannot see this: they hand the controller a pre-arranged whole window.
  // PINS CURRENT BEHAVIOUR — this test SHOULD fail when the estimator is fixed.
  it("UCH-14: a single NACK after <=19 sends doubles the gap on a one-sample loss estimate", () => {
    for (const sends of [1, 5, 10, 19]) {
      let s = makeAimdState(10);
      for (let i = 0; i < sends; i++) s = onSend(s);
      const before = s.gapMs;
      s = onNack(s, 1);
      expect(s.gapMs).toBe(before * 2);
      // The window is reset by the evaluation, so the estimate is discarded immediately.
      expect(s.sentCount).toBe(0);
      expect(s.nackCount).toBe(0);
    }
    // 20 sends is exactly the 5% threshold and does NOT back off — pinning the real boundary.
    for (const sends of [20, 25, 40]) {
      let s = makeAimdState(10);
      for (let i = 0; i < sends; i++) s = onSend(s);
      const before = s.gapMs;
      s = onNack(s, 1);
      expect(s.gapMs).toBe(before);
    }
  });

  // ── UCH-15: AIMD has no fixed point under a real loss process — it saturates ─────────────
  // Driven by an actual Gilbert-Elliott trace rather than by arithmetic, the controller does not
  // converge to a rate tracking the loss. It pins at MAX_GAP_MS (500ms ~ 2 packets/second) for
  // loss at or above ~1% — well below the 5% HIGH_LOSS_THRESHOLD it is designed to back off at.
  // PINS CURRENT BEHAVIOUR.
  it("UCH-15: under a 1% real loss process the gap saturates at the 500ms floor, not at a fixed point", () => {
    const N = 20_000;
    const drive = (rate: number, L: number): number[] => {
      const trace = gilbertElliottTrace(N, burstParams(rate, L), 0x5eedn);
      let s = makeAimdState(10);
      const samples: number[] = [];
      for (let i = 0; i < N; i++) {
        s = onSend(s);
        if (trace.dropped[i]) s = onNack(s, 1);
        if (i % 2000 === 1999) samples.push(s.gapMs);
      }
      return samples;
    };
    // No loss: the controller correctly drives the gap to the minimum.
    expect(drive(0, 1).every((g) => g === 1)).toBe(true);
    // 1% loss — below the 5% backoff threshold — already saturates near the 500ms maximum.
    const at1pct = drive(0.01, 1);
    expect(Math.min(...at1pct)).toBeGreaterThan(400);
    // 10% bursty: fully pinned.
    const at10pct = drive(0.1, 4);
    expect(Math.min(...at10pct)).toBeGreaterThan(490);
  });

  // ── UCH-16: reordering alone produces spurious NACKs on a LOSSLESS channel ───────────────
  // `LossyUdpChannel.handleIncoming` NACKs any gap against `expectedSeq`, and a reordered packet
  // opens a gap that closes moments later. Delivery is unaffected (see UCH-10) but every
  // reordered packet costs one NACK, and by UCH-14/UCH-15 that NACK stream alone drives the
  // sender to the 500ms floor. Reordering therefore collapses throughput with zero packet loss.
  // PINS CURRENT BEHAVIOUR.
  it("UCH-16: 5% reordering on a zero-loss channel yields a ~4-5% spurious NACK rate", () => {
    const run = (reorderProbability: number, reorderDepth: number) => {
      const cfg = defaultConfig({
        blocks: 500,
        seed: 0x5eedn,
        loss: burstParams(0, 1),
        reorderProbability,
        reorderDepth,
      });
      const wire = buildWire(cfg, "adinkra844");
      const { delivered } = applyFaults(wire, cfg);
      expect(delivered.length).toBe(wire.length); // nothing was actually lost

      let receive: (t: string, f: string) => void = () => {};
      let nackBroadcasts = 0;
      const transport = {
        broadcast: (text: string) => {
          const e = JSON.parse(text) as { type?: string };
          if (e.type === "lossy-udp-nack") nackBroadcasts++;
        },
        onMessage: (h: (t: string, f: string) => void) => {
          receive = h;
        },
      };
      const ch = new LossyUdpChannel(transport, "receiver");
      let deliveredPayloads = 0;
      ch.onData(() => {
        deliveredPayloads++;
      });
      for (const pkt of delivered) {
        const hdr = Buffer.alloc(16);
        hdr.writeUInt32BE(pkt.seq, 0);
        hdr.writeUInt32BE(pkt.blockSeq, 4);
        hdr.writeUInt8(pkt.blockPos, 8);
        hdr.writeUInt8(pkt.blockPos < 4 ? 1 : 0, 9);
        hdr.writeUInt32BE(pkt.payload.length, 10);
        const buf = Buffer.concat([hdr, Buffer.from(pkt.payload)]);
        receive(JSON.stringify({ type: "lossy-udp", zid: "sender", pkt: buf.toString("base64") }), "sender");
      }
      return { nackBroadcasts, deliveredPayloads, sent: wire.length };
    };

    // Control: no reordering, no NACKs. Without this the numbers below could be a dead path.
    const control = run(0, 0);
    expect(control.nackBroadcasts).toBe(0);
    expect(control.deliveredPayloads).toBe(2000);

    const r = run(0.05, 8);
    // Data still arrives in full — the damage is entirely in the control channel.
    expect(r.deliveredPayloads).toBe(2000);
    const spuriousRate = r.nackBroadcasts / r.sent;
    expect(spuriousRate).toBeGreaterThan(0.03);
    expect(spuriousRate).toBeLessThan(0.06);
  });
});
