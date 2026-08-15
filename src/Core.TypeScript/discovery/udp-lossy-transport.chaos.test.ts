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
  bernoulliParams,
  gilbertElliottParams,
  CALIBRATION,
  LOMAX_WIFI2022_DERIVED,
  lomaxBurstTrace,
  analyticLossRate,
  analyticLossRunLength,
  conditionalRepeatLossRate,
  blockErasureHistogram,
  binomialPmf,
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
  deriveSweepBurstLengths,
  SWEEP_BURST_LENGTHS,
} from "./udp-lossy-transport.chaos";
import {
  computeAdinkraParity,
  recoverAdinkraErasure,
  recoverAdinkraBlock,
  makeAimdState,
  onSend,
  onLoss,
  addToBlock,
  buildSenderBlock,
  decodePacket,
  encodePacket,
  makeReceiverBlock,
  PACKET_CHECKSUM_BYTES,
  PACKET_HEADER_BYTES,
  LossyUdpChannel,
  MAX_NACK_GAP,
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

  // ── UCH-5: `meanBurstLength = 1` is the ANTI-CORRELATED extremum, NOT Bernoulli ──────────
  //
  // RENAMED AND RE-AIMED 2026-08-14 (081KZYY6SVJ087G0R0035SW945). This test used to be called
  // "meanBurstLength=1 degenerates to i.i.d. Bernoulli — every burst has length 1" and asserted
  // exactly the two things below. Both assertions were TRUE. The NAME was false, and the name is
  // what everything downstream believed.
  //
  // "Every burst has length 1" is not evidence of independence — it is proof of ANTI-dependence.
  // An i.i.d. Bernoulli(ρ) channel has `P(drop | previous drop) = ρ > 0`, so it produces runs;
  // its mean run length is `1/(1−ρ)`, which is strictly greater than 1 for every ρ > 0. A mean
  // run length of exactly 1 is therefore UNATTAINABLE for any i.i.d. lossy channel, and `L = 1`
  // is the far end of the correlation axis from Bernoulli rather than the origin of it.
  //
  // The assertions are kept, unweakened, and the claim attached to them is corrected. `L = 1`
  // remains a legitimate channel — a genuine anti-correlated bound — and is now labelled as one.
  it("UCH-5: meanBurstLength=1 FORBIDS consecutive loss — the anti-correlated extremum, not Bernoulli", () => {
    const trace = gilbertElliottTrace(50_000, burstParams(0.1, 1), 0xabcdn);
    expect(trace.meanBurstLength).toBeCloseTo(1, 10);
    expect([...trace.burstHistogram.keys()]).toEqual([1]);
    // The measurement that renames the test: an i.i.d. channel would report ~0.1 here.
    expect(conditionalRepeatLossRate(trace)).toBe(0);
    // …and the closed form agrees, so this is a property of the MODEL, not of one seed.
    expect(analyticLossRunLength(burstParams(0.1, 1))).toBe(1);
  });

  // ── UCH-5b: THE FALSIFIER the harness lacked ─────────────────────────────────────────────
  //
  // This is the test whose ABSENCE was the defect. Every assertion in UCH-5 passes on a channel
  // that cannot produce a consecutive loss, so nothing in the suite could tell "uncorrelated"
  // from "anti-correlated" — and the harness's entire purpose is to measure the effect of
  // correlation. A model that cannot fail the independence check was never checked for it.
  //
  // This test FAILS if consecutive losses are impossible. Run it against `burstParams(ρ, 1)` and
  // every one of the four assertions below breaks.
  it("UCH-5b: genuine i.i.d. Bernoulli PRODUCES consecutive losses — fails if the channel forbids them", () => {
    const rho = 0.1;
    const trace = gilbertElliottTrace(200_000, bernoulliParams(rho), 0xabcdn);

    // 1. Independence, stated as the conditional that `burstParams(ρ,1)` pins to 0.
    expect(conditionalRepeatLossRate(trace)).toBeGreaterThan(0.08);
    expect(conditionalRepeatLossRate(trace)).toBeCloseTo(rho, 2);

    // 2. Runs of length >= 2 EXIST. `burstParams(ρ,1)` has an empty histogram above key 1.
    const runs = [...trace.burstHistogram.keys()].sort((a, b) => a - b);
    expect(Math.max(...runs)).toBeGreaterThanOrEqual(3);
    expect(trace.burstHistogram.get(2)).toBeGreaterThan(0);

    // 3. The mean run length is 1/(1−ρ) — DERIVED from independence, never asserted of it.
    expect(analyticLossRunLength(bernoulliParams(rho))).toBeCloseTo(1 / (1 - rho), 12);
    expect(trace.meanBurstLength).toBeCloseTo(1 / (1 - rho), 1);
    expect(trace.meanBurstLength).toBeGreaterThan(1); // the inequality L=1 cannot satisfy

    // 4. The overall rate is unchanged, so 1-3 measure CORRELATION and not a different channel.
    expect(analyticLossRate(bernoulliParams(rho))).toBeCloseTo(rho, 12);
    expect(Math.abs(trace.dropCount / 200_000 - rho)).toBeLessThan(0.005);
  });

  // ── UCH-5c: the per-block erasure tail — the distribution the [8,4,4] code is decided by ──
  //
  // The block code does not see a loss RATE, it sees a count of erasures per block of 8. That
  // distribution is where the anti-correlated model's error actually lands, and it lands in the
  // tail — the only part an erasure code cares about.
  it("UCH-5c: Bernoulli matches Binomial(8,ρ); the L=1 model understates the tail and forbids k>=5", () => {
    const rho = 0.1;
    const N = 400_000;
    const binom = binomialPmf(8, rho);
    const berHist = blockErasureHistogram(gilbertElliottTrace(N, bernoulliParams(rho), 0xabcdn));
    const oldHist = blockErasureHistogram(gilbertElliottTrace(N, burstParams(rho, 1), 0xabcdn));

    // Bernoulli IS the binomial, to sampling error, across the whole support.
    for (let k = 0; k <= 4; k++) expect(Math.abs(berHist[k]! - binom[k]!)).toBeLessThan(0.005);
    // …including the tail the code fails on.
    expect(berHist[5]!).toBeGreaterThan(0);
    expect(berHist[6]!).toBeGreaterThan(0);

    // The L=1 model does not, and every discrepancy flatters the code.
    expect(oldHist[5]!).toBe(0); // k>=5 is IMPOSSIBLE, not merely rare
    expect(oldHist[6]!).toBe(0);
    expect(oldHist[7]!).toBe(0);
    expect(oldHist[8]!).toBe(0);
    // k=4 is understated by ~4.6x against the binomial (measured 0.001000 vs 0.004593).
    expect(oldHist[4]!).toBeLessThan(binom[4]! / 3);
    // k=3 by ~1.8x (0.018300 vs 0.033067).
    expect(oldHist[3]!).toBeLessThan(binom[3]! / 1.5);
    // Understated where it matters means OVERSTATED where the code succeeds — the false green.
    expect(oldHist[0]! + oldHist[1]!).toBeGreaterThan(berHist[0]! + berHist[1]!);
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

  // ── UCH-7: the CAPABILITY GAP — CLOSED 2026-08-13 ───────────────────────────────────────
  // A linear code with minimum distance d corrects ANY d−1 erasures. [8,4,4] has d=4, so it
  // corrects any 3.
  //
  // FLIPPED, as the workitem said it would. This test used to end
  //     expect(mlRecovered).toBe(56);
  //     expect(implRecovered).toBe(0);   // "The shipped decoder recovers none of them."
  // and 0/56 was the measurement that filed 081KZYN3B79087G0R0014ZKE3C. `recoverAdinkraErasure`
  // now solves the erasure system over the code's parity checks, so it recovers 56/56.
  //
  // The pin is UPDATED rather than deleted, and strengthened where it was weak: the old
  // implementation check was `!== null`, which would have accepted a decoder returning
  // confident garbage. Both decoders are now compared BYTE-FOR-BYTE against the sent data and
  // against each other — and they are independent implementations (the harness searches
  // invertible 4-column submatrices of G; the module runs Gauss–Jordan on H), so agreement is
  // evidence rather than a tautology.
  it("UCH-7: the [8,4,4] code corrects any 3 erasures — and the shipped decoder now gets all 56", () => {
    const data = Array.from({ length: 4 }, (_, i) => Uint8Array.from([i * 31 + 1, 200 - i, i, 0x5a ^ i]));
    const parity = computeAdinkraParity(data);
    const full = [...data, ...parity] as (Uint8Array | null)[];
    const G = generatorFromModule();

    let mlRecovered = 0;
    let implRecovered = 0;
    let agreed = 0;
    let patterns = 0;
    for (let a = 0; a < BLOCK_TOTAL; a++)
      for (let b = a + 1; b < BLOCK_TOTAL; b++)
        for (let c = b + 1; c < BLOCK_TOTAL; c++) {
          patterns++;
          const blk = [...full];
          blk[a] = null;
          blk[b] = null;
          blk[c] = null;
          const exact = (s: Uint8Array, i: number) => Array.from(s).every((v, k) => v === full[i]![k]);

          const ml = mlDecodeBlock(blk, G);
          if (ml && ml.every((s, i) => exact(s, i))) mlRecovered++;

          const impl = recoverAdinkraBlock(blk);
          if (impl && impl.every((s, i) => exact(s, i))) implRecovered++;

          // The single-packet projection must agree with the block decode at the first erasure.
          const one = recoverAdinkraErasure(blk);
          if (impl && one && Array.from(one).every((v, k) => v === full[a]![k])) agreed++;
        }
    expect(patterns).toBe(56);
    // Every 3-erasure pattern is recoverable — the code's guarantee, measured.
    expect(mlRecovered).toBe(56);
    // …and the shipped decoder now attains it, byte-exactly. Was 0.
    expect(implRecovered).toBe(56);
    expect(agreed).toBe(56);
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

  // ── UCH-11: THE FALSE GREEN — low-correlation loss hides the correlated-failure cliff ────
  //
  // The `L = 1` arm was called "uniform" here until 2026-08-14. It is the ANTI-correlated
  // extremum, not the uncorrelated case (UCH-5/UCH-5b), so the test now measures the correlation
  // axis with all three points on it named correctly. The finding survives the correction and
  // gets STRONGER at the honest end: a genuine i.i.d. injector still reports 0.99983 where the
  // bursty channel reports 0.946, so the false green is real and was never resting on the model
  // defect. Assertions are added, none relaxed.
  it("UCH-11: at one fixed loss rate, correlation alone moves delivery — a low-correlation injector reports a false green", async () => {
    const base = { blocks: 6000, seed: 0x5eedn };
    const anti = await runScenario(defaultConfig({ ...base, loss: burstParams(0.05, 1) }), "ml-adinkra", 1);
    const iid = await runScenario(defaultConfig({ ...base, loss: bernoulliParams(0.05) }), "ml-adinkra", 1);
    const bursty = await runScenario(defaultConfig({ ...base, loss: burstParams(0.05, 8) }), "ml-adinkra", 1);
    // Same mean loss rate, to within sampling error — so this measures CORRELATION, nothing else.
    expect(Math.abs(anti.observedLossRate - bursty.observedLossRate)).toBeLessThan(0.02);
    expect(Math.abs(iid.observedLossRate - bursty.observedLossRate)).toBeLessThan(0.02);
    // Low-correlation loss is essentially invisible to the code — this is the false green, and
    // it holds for the genuine Bernoulli injector a naive harness would have built.
    expect(anti.deliveryRatio).toBeGreaterThan(0.999);
    expect(iid.deliveryRatio).toBeGreaterThan(0.999);
    // Correlated loss at the SAME rate is not.
    expect(bursty.deliveryRatio).toBeLessThan(0.96);
    // The gap is the measurement a uniform injector would have thrown away.
    expect(anti.deliveryRatio - bursty.deliveryRatio).toBeGreaterThan(0.04);
    expect(iid.deliveryRatio - bursty.deliveryRatio).toBeGreaterThan(0.04);
    // …and the ordering along the correlation axis is monotone, which is the axis's own falsifier.
    expect(iid.deliveryRatio).toBeLessThanOrEqual(anti.deliveryRatio);
    expect(bursty.deliveryRatio).toBeLessThan(iid.deliveryRatio);
  });

  // ── UCH-12: the cliff, as numbers ───────────────────────────────────────────────────────
  // Reported, not asserted as a requirement: the highest swept loss rate holding >= 99%
  // delivery. Bounds are deliberately loose (one grid step) so this fails on a REGRESSION,
  // not on sampling noise.
  //
  // FLIPPED 2026-08-13 (081KZYN3B79087G0R0014ZKE3C). The old assertions were
  //     expect(implUniform!).toBeLessThanOrEqual(0.03);   // measured 0.02
  //     expect(mlUniform!).toBeGreaterThan(implUniform!);
  // i.e. the shipped decoder fell off an order of magnitude before the code did. It no longer
  // does: the two cliffs now COINCIDE, which is the whole point of the fix, so the assertion
  // that they differ had to be inverted rather than loosened.
  //
  // NAME CORRECTED 2026-08-14: the `L = 1` row is the ANTI-CORRELATED extremum, not "uniform"
  // (081KZYY6SVJ087G0R0035SW945). The 20% figure below is real and is a property of THAT
  // channel; on genuine i.i.d. loss the same cliff is 12%, measured in UCH-25. The assertions
  // here are unchanged — the channel they describe has not changed, only its name — and UCH-25
  // carries the honest number rather than this one being quietly relaxed to accommodate it.
  it("UCH-12: cliff — the shipped decoder's cliff has moved out to the code's own, ~20% anti-correlated", async () => {
    const rates = [0.005, 0.01, 0.02, 0.03, 0.05, 0.08, 0.12, 0.2, 0.3];
    // Cost: 2000 blocks × 2 decoders × 2 L × ~5 rates. The full derived grid
    // (`SWEEP_BURST_LENGTHS`, 081KZZYETRX) is walked by UCH-27/28; this test
    // samples the anti-correlated extremum and a moderate in-window burst.
    const impl = await characteriseCliff("impl-adinkra", rates, [1, 4], { blocks: 2000, seed: 0x5eedn }, 0.99, 1);
    const ml = await characteriseCliff("ml-adinkra", rates, [1, 4], { blocks: 2000, seed: 0x5eedn }, 0.99, 1);

    const implUniform = impl.cliffByBurstLength.get(1);
    const implBursty = impl.cliffByBurstLength.get(4);
    const mlUniform = ml.cliffByBurstLength.get(1);
    const mlBursty = ml.cliffByBurstLength.get(4);

    // The code's ceiling, unchanged — it was never the code that moved.
    expect(mlUniform!).toBeGreaterThanOrEqual(0.12);
    expect(mlBursty!).toBeGreaterThanOrEqual(0.02);

    // The shipped decoder now sits ON it, at both burst lengths.
    expect(implUniform).not.toBeNull();
    expect(implUniform!).toBe(mlUniform!);
    expect(implBursty!).toBe(mlBursty!);

    // Stated absolutely too, so this cannot pass by both decoders regressing together.
    expect(implUniform!).toBeGreaterThanOrEqual(0.12);
    expect(implBursty!).toBeGreaterThanOrEqual(0.02);
  });

  // ── UCH-13: XOR-7/8 still wins on goodput — and the DECODER was not why ──────────────────
  // The module header presents XOR-only (rate 7/8) as the low-bandwidth compromise for LoRa/BLE
  // and [8,4,4] (rate 4/8) as the choice for high-bandwidth UDP. Measured on goodput — delivered
  // data packets per wire packet, the only fair cross-rate comparison — the [8,4,4] path is
  // DOMINATED by the XOR fallback across the whole useful operating range.
  //
  // THIS TEST PREDICTED ITS OWN FAILURE AND THE PREDICTION WAS WRONG. It was filed saying
  // "PINS CURRENT BEHAVIOUR. If the transport adopts a full-capability decoder this SHOULD
  // fail", on the reasoning that the shipped decoder corrected 1 erasure for 50% overhead where
  // XOR corrected 1 for 12.5%. The decoder was fixed on 2026-08-13
  // (081KZYN3B79087G0R0014ZKE3C) and it corrects 3 now — and every assertion below still holds,
  // unchanged, at the same seed. Recorded rather than quietly re-baselined, because a wrong
  // prediction that goes unremarked is how the next one gets believed.
  //
  // Why it was wrong: at LOW loss, goodput → rate, and 7/8 > 4/8 by construction. No decoder
  // improvement can close that — it can only raise [8,4,4] toward its own 0.5 ceiling, which is
  // still below the 0.875 the XOR code delivers when it rarely fails. Erasure capability only
  // starts paying once loss is high enough to break the 7/8 code often, i.e. once the block
  // failure probability at rate 7/8 exceeds 1 − 0.5/0.875 ≈ 0.43. So the crossover is set by
  // the RATES, and the decoder fix moves it without abolishing it — measured on this harness at
  // the same seed, the crossover moved from roughly 33% to roughly 18% uniform loss, and from
  // beyond 40% to roughly 31% at mean burst length 4. The header's rate guidance is still
  // inverted for the useful range; what changed is by how much and why.
  it("UCH-13: XOR-7/8 goodput dominates the [8,4,4] path at every measured loss rate — decoder fix and all", async () => {
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
    // And the [8,4,4] path never exceeds the 0.5 goodput ceiling its rate imposes — now reached
    // exactly on a clean channel, where before the fix it was reached only because nothing was
    // lost to recover from.
    const clean = await runScenario(
      defaultConfig({ blocks: 1000, seed: 0x5eedn, loss: burstParams(0, 1) }),
      "impl-adinkra",
      1,
    );
    expect(clean.goodput).toBeCloseTo(0.5, 6);
  });

  // ── UCH-13b: the crossover EXISTS — so UCH-13 is a range claim, not a verdict on the code ─
  // Without this, UCH-13 reads as "the [8,4,4] code is simply worse", which is false and would
  // be an argument for deleting a code that wins decisively where it is meant to be used.
  // Above the crossover the 7/8 code collapses and [8,4,4] keeps delivering.
  it("UCH-13b: above the crossover the ranking inverts — [8,4,4] wins where the 7/8 code collapses", async () => {
    for (const [rate, L] of [
      [0.25, 1],
      [0.3, 1],
      [0.4, 1],
      [0.4, 4],
    ] as [number, number][]) {
      const cfg = defaultConfig({ blocks: 3000, seed: 0x5eedn, loss: burstParams(rate, L) });
      const impl = await runScenario(cfg, "impl-adinkra", 1);
      const xor = await runScenario(cfg, "xor7of8", 1);
      expect(impl.goodput).toBeGreaterThan(xor.goodput);
    }
    // The margin at 40% uniform loss is not marginal: the 7/8 code is essentially dead there.
    const cfg = defaultConfig({ blocks: 3000, seed: 0x5eedn, loss: burstParams(0.4, 1) });
    const impl = await runScenario(cfg, "impl-adinkra", 1);
    const xor = await runScenario(cfg, "xor7of8", 1);
    expect(impl.goodput).toBeGreaterThan(0.3);
    expect(xor.goodput).toBeLessThan(0.05);
  });

  // ── UCH-14: AIMD evaluates against a PARTIAL window ──────────────────────────────────────
  // `onLoss` calls `updateAimd` immediately, and `updateAimd` RESETS the window on every
  // evaluation. So the loss estimate is never "losses per 64 packets" as `LOSS_WINDOW = 64` and
  // the module comment state — it is "1 loss per packets-since-the-last-loss". A single report
  // arriving within 19 sends therefore reads as >5% loss and doubles the gap.
  //
  // ULT-8/9/10 cannot see this: they hand the controller a pre-arranged whole window.
  // PINS CURRENT BEHAVIOUR — this test SHOULD fail when the estimator is fixed.
  //
  // UPDATED 2026-08-13 for 081KZYQ8KNB087G0R000G8QPRE: `onNack(s, 1)` became
  // `onLoss(s, { cause: "unknown", seqs: [n] })`, and the `nackCount` field became a per-cause
  // map. The DEFECT this pins is unchanged and deliberately unfixed — it is the next work-item in
  // the ordering — so the assertions are the same numbers through the new door. What the second
  // loop now also shows is that the SAME report attributed to `reorder` never backs off at all.
  it("UCH-14: a single loss report after <=19 sends doubles the gap on a one-sample estimate", () => {
    for (const sends of [1, 5, 10, 19]) {
      let s = makeAimdState(10);
      for (let i = 0; i < sends; i++) s = onSend(s);
      const before = s.gapMs;
      s = onLoss(s, { cause: "unknown", seqs: [sends] });
      expect(s.gapMs).toBe(before * 2);
      // The window is reset by the evaluation, so the estimate is discarded immediately.
      expect(s.sentCount).toBe(0);
      expect(s.lossByCause.unknown).toBe(0);
      // ...but it is not LOST: the evaluated window remembers what the decision was taken on.
      expect(s.lastWindow.lossByCause.unknown).toBe(1);
      expect(s.lastWindow.windowPackets).toBe(sends);
    }
    // 20 sends is exactly the 5% threshold and does NOT back off — pinning the real boundary.
    for (const sends of [20, 25, 40]) {
      let s = makeAimdState(10);
      for (let i = 0; i < sends; i++) s = onSend(s);
      const before = s.gapMs;
      s = onLoss(s, { cause: "unknown", seqs: [sends] });
      expect(s.gapMs).toBe(before);
    }
    // And the contrast that is the point of 081KZYQ8KNB: identical arithmetic, attributed cause,
    // and the one-sample estimate never fires because the sample is not congestion-suspect.
    for (const sends of [1, 5, 10, 19]) {
      let s = makeAimdState(10);
      for (let i = 0; i < sends; i++) s = onSend(s);
      s = onLoss(s, { cause: "reorder", seqs: [sends] });
      expect(s.gapMs).toBeLessThanOrEqual(10);
      expect(s.lastWindow.lossByCause.reorder).toBe(1);
    }
  });

  // ── UCH-15: AIMD has no fixed point under a real loss process — it saturates ─────────────
  // Driven by an actual Gilbert-Elliott trace rather than by arithmetic, the controller does not
  // converge to a rate tracking the loss. It pins at MAX_GAP_MS (500ms ~ 2 packets/second) for
  // loss at or above ~1% — well below the 5% HIGH_LOSS_THRESHOLD it is designed to back off at.
  // PINS CURRENT BEHAVIOUR.
  //
  // The Gilbert-Elliott trace is a CHANNEL process — corruption, not queue overflow — so under
  // 081KZYQ8KNB the honest attribution for every one of these drops is `unknown`: the receiver
  // has no integrity check, so it cannot tell this from a full buffer. That is why this test
  // still saturates, and it is the measurement, not a disappointment: separating the signals
  // does not help where the transport cannot perceive the separation. `attrib` below is the
  // counterfactual — the same trace with the cause attributed — and the gap between the two
  // columns is exactly what 081KZYP1X3B087G0R001EZ37PQ would buy.
  it("UCH-15: under a 1% real loss process the gap saturates at the 500ms floor, not at a fixed point", () => {
    const N = 20_000;
    const drive = (rate: number, L: number, cause: "unknown" | "corruption-if-perceivable" = "unknown"): number[] => {
      const trace = gilbertElliottTrace(N, burstParams(rate, L), 0x5eedn);
      let s = makeAimdState(10);
      const samples: number[] = [];
      for (let i = 0; i < N; i++) {
        s = onSend(s);
        // `corruption` cannot be constructed (no integrity check), so the counterfactual is
        // driven through `reorder` — the one attributed non-congestion cause that exists. It
        // stands in for "the receiver could tell this was not congestion", which is the property
        // under test, not the specific cause name.
        if (trace.dropped[i]) s = onLoss(s, { cause: cause === "unknown" ? "unknown" : "reorder", seqs: [i] });
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

    // THE COUNTERFACTUAL, and the number this work-item is really about. The same 10% bursty
    // trace, with the cause attributed instead of unattributed, does not back off at all — the
    // controller drives to the floor because nothing it can do would change a channel process.
    // 490ms versus 1ms is the whole of "separate the signals", and it is unreachable for
    // corruption today because the receiver cannot perceive corruption.
    const attributed = drive(0.1, 4, "corruption-if-perceivable");
    expect(Math.max(...attributed)).toBe(1);
  });

  // ── UCH-16: reordering alone produces spurious NACKs on a LOSSLESS channel ───────────────
  // `LossyUdpChannel.handleIncoming` NACKs any gap against `expectedSeq`, and a reordered packet
  // opens a gap that closes moments later. Delivery is unaffected (see UCH-10) but every
  // reordered packet costs one NACK, and by UCH-14/UCH-15 that NACK stream alone drives the
  // sender to the 500ms floor. Reordering therefore collapses throughput with zero packet loss.
  // PINS CURRENT BEHAVIOUR.
  //
  // FLIPPED 2026-08-13 by 081KZYQ8KNB087G0R000G8QPRE, and the flip is a COST, not a win, so it
  // is recorded as one. The measured broadcast rate went from 4.7% to 9.4% — almost exactly
  // double — because the receiver now also emits a RETRACTION when a sequence number it reported
  // missing arrives. That retraction is what carries the reorder attribution back to the sender,
  // and it is the mechanism that stops the backoff; it is bought with a second broadcast per
  // reordered packet.
  //
  // Named honestly because this module bounds NACK amplification deliberately (ULT-17..21, the
  // 3,333,337x incident): the bound is now 2 broadcasts per in-window gap rather than 1. It adds
  // no new peer-controlled lever — a retraction is only ever emitted for a sequence number this
  // receiver itself reported — but it is more traffic on an existing one, and a mesh deployment
  // should know that before it turns this on.
  //
  // The test is split so both halves are visible: total broadcasts (what the mesh pays) and
  // retractions specifically (what the attribution costs).
  it("UCH-16: 5% reordering on a zero-loss channel yields a ~9% broadcast rate — half of it retractions", () => {
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
      let retractions = 0;
      const transport = {
        broadcast: (text: string) => {
          const e = JSON.parse(text) as { type?: string; teaching?: { cause?: string } };
          if (e.type === "lossy-udp-nack") {
            nackBroadcasts++;
            if (e.teaching?.cause === "reorder") retractions++;
          }
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
      // PIN UPDATED 2026-08-14 (081KZYP1X3B087G0R001EZ37PQ), and the flip was informative rather
      // than incidental. This loop used to hand-roll a 16-byte header and concatenate the payload
      // — i.e. it emitted an OLD-FORMAT frame. Against the new receiver every one of those frames
      // is refused as `truncated` (no CRC-32C trailer), and `deliveredPayloads` fell from 2000 to
      // 0. That is the wire-compatibility direction demonstrated by accident, and it is the
      // direction the design chose deliberately: old sender → new receiver FAILS, loudly and as a
      // FRAMING error rather than as fabricated channel corruption. `UCH-20` now pins it on
      // purpose. Here the harness simply sends the real frame the sender built.
      for (const pkt of delivered) {
        receive(JSON.stringify({ type: "lossy-udp", zid: "sender", pkt: pkt.frame.toString("base64") }), "sender");
      }
      return { nackBroadcasts, retractions, deliveredPayloads, sent: wire.length };
    };

    // Control: no reordering, no NACKs and no retractions. Without this the numbers below could
    // be a dead path.
    const control = run(0, 0);
    expect(control.nackBroadcasts).toBe(0);
    expect(control.retractions).toBe(0);
    expect(control.deliveredPayloads).toBe(2000);

    const r = run(0.05, 8);
    // Data still arrives in full — the damage is entirely in the control channel.
    expect(r.deliveredPayloads).toBe(2000);
    const broadcastRate = r.nackBroadcasts / r.sent;
    expect(broadcastRate).toBeGreaterThan(0.07);
    expect(broadcastRate).toBeLessThan(0.12);

    // The gap reports themselves are unchanged from the pre-fix measurement — no hold-down was
    // added, deliberately, because a hold-down treats the symptom. Every extra broadcast is a
    // retraction, and every retraction carries an attribution the sender could not otherwise have.
    const reports = r.nackBroadcasts - r.retractions;
    const reportRate = reports / r.sent;
    expect(reportRate).toBeGreaterThan(0.03);
    expect(reportRate).toBeLessThan(0.06);
    // The two counts are NOT the same unit, and the measurement made that concrete: a gap report
    // is one message naming SEVERAL sequence numbers, while a retraction is one message per
    // sequence number that arrives. Measured 183 reports against 193 retractions — retractions
    // slightly EXCEED reports, which was not the shape assumed when this assertion was first
    // written. Pinned as measured.
    expect(r.retractions).toBeGreaterThanOrEqual(reports);
    expect(r.retractions).toBeLessThan(1.3 * reports);
  });

  // ── UCH-17: the shipped receiver attains the code's ceiling, end to end ─────────────────
  // The standing falsifier for 081KZYN3B79087G0R0014ZKE3C at the TRANSPORT layer, not the
  // decoder layer. ULT-22 proves the decoder is exactly as strong as [8,4,4]; this proves the
  // receiver STATE MACHINE gives that away nowhere — the defect lived at that seam, where
  // `addToBlock` only attempted recovery at 7-of-8 and discarded decodable blocks.
  //
  // `impl-adinkra` drives the live `makeReceiverBlock`/`addToBlock` path packet by packet, in
  // arrival order, through loss AND reordering AND duplication. `ml-adinkra` collects each
  // block's arrival SET and decodes once by an independent algorithm. Byte-for-byte equality of
  // the two under a real fault process is a much stronger statement than either alone, and any
  // shortfall — a missed pattern, an order dependence, a lost block held one packet too long —
  // shows up as a difference rather than as a slightly worse number nobody notices.
  it("UCH-17: the live receiver delivers exactly what the code allows — no shortfall vs the ML ceiling", async () => {
    for (const [rate, L] of [
      [0.02, 1],
      [0.05, 1],
      [0.1, 1],
      [0.2, 1],
      [0.3, 1],
      [0.05, 4],
      [0.1, 4],
      [0.2, 4],
      [0.35, 8],
    ] as [number, number][]) {
      const cfg = defaultConfig({
        blocks: 2000,
        seed: 0x5eedn,
        loss: burstParams(rate, L),
        reorderProbability: 0.1,
        reorderDepth: 8,
        duplicateProbability: 0.1,
      });
      const impl = await runScenario(cfg, "impl-adinkra", 1);
      const ml = await runScenario(cfg, "ml-adinkra", 1);
      expect(impl.dataPacketsDelivered).toBe(ml.dataPacketsDelivered);
      expect(impl.blocksLost).toBe(ml.blocksLost);
      expect(impl.corruptDeliveries).toBe(0);
      expect(ml.corruptDeliveries).toBe(0);
    }
    // ANTI-VACUITY. Every assertion above would hold if both decoders delivered nothing, and it
    // would also hold if the channel dropped nothing. Pin that the hard points are genuinely
    // hard — blocks ARE being lost at 30% — and that recovery is genuinely doing work.
    const hard = defaultConfig({ blocks: 2000, seed: 0x5eedn, loss: burstParams(0.3, 1) });
    const hardRun = await runScenario(hard, "impl-adinkra", 1);
    expect(hardRun.blocksLost).toBeGreaterThan(0);
    expect(hardRun.deliveryRatio).toBeGreaterThan(0.9); // …and recovered anyway, at 30% loss
    expect(hardRun.observedLossRate).toBeGreaterThan(0.25);
  });

  // ── UCH-19: the corruption curve, with the check and without it ─────────────────────────
  //
  // The fault class this harness could not express until 081KZYP1X3B087G0R001EZ37PQ. Erasure,
  // duplication and reordering all PRESERVE BYTES, so every number this file produced before
  // today described a channel that never lied — and the one fault where the code's capability was
  // weakest and its blast radius largest went unmeasured.
  //
  // Both arms run, and the DIFFERENCE between them is the measurement. An assertion that only
  // ever runs the checked path cannot distinguish a working check from one that never fires.
  //
  // MEASURED (seed 0x5eed, 2000 blocks, 8B payload, loss held at ZERO so corruption is isolated):
  //
  //     corrupt%   corrupted   rejected   SILENT-WRONG deliveries      deliveryRatio
  //                             (check)    check off   check on    check off   check on
  //       0.5%          73         73          15           0        0.9981     1.0000
  //       1.0%         137        137          21           0        0.9974     1.0000
  //       2.0%         318        318          47           0        0.9941     1.0000
  //       5.0%         803        803         128           0        0.9840     1.0000
  //      10.0%        1593       1593         278           0        0.9653     0.9970
  //
  // Two things in that table, and the second is the one worth arguing about:
  //
  //   1. Silently-wrong deliveries go to ZERO and stay there. That is the defect closed.
  //   2. Delivery ratio goes UP, not down. Rejecting a frame COSTS nothing and BUYS a repair,
  //      because the [8,4,4] code corrects erasures and cannot correct errors: discarding a
  //      corrupt frame converts a fault the code cannot handle into one it can. The intuition
  //      that an integrity check trades goodput for safety is simply wrong for an erasure-coded
  //      transport, and this is the number that says so.
  //
  // NOT affected by the `meanBurstLength = 1` instrument caveat (081KZYY6SVJ087G0R0035SW945):
  // corruption here is drawn per-packet from `drawUnit(seed, STREAM.corrupt, i) < p`, which is
  // genuine i.i.d. Bernoulli, not a Gilbert-Elliott chain forbidden from repeating.
  it("UCH-19: the CRC-32C rejects every corrupt frame, delivers zero wrong bytes, and RAISES delivery", async () => {
    const mk = (corruptProbability: number, verifyChecksum: boolean) =>
      defaultConfig({
        blocks: 2000,
        seed: 0x5eedn,
        loss: burstParams(0, 1), // corruption ISOLATED — no erasure anywhere
        corruptProbability,
        verifyChecksum,
      });

    // Control: no corruption, both arms identical and perfect. Without this the rows below could
    // be a dead path that delivers nothing and passes every "no wrong bytes" assertion.
    const cleanOn = await runScenario(mk(0, true), "impl-adinkra");
    const cleanOff = await runScenario(mk(0, false), "impl-adinkra");
    expect(cleanOn.framesCorrupted).toBe(0);
    expect(cleanOn.framesRejected).toBe(0);
    expect(cleanOn.dataPacketsDelivered).toBe(8000);
    expect(cleanOff.dataPacketsDelivered).toBe(8000);

    for (const [p, wrongWithoutCheck] of [
      [0.005, 15],
      [0.01, 21],
      [0.02, 47],
      [0.05, 128],
      [0.1, 278],
    ] as [number, number][]) {
      const off = await runScenario(mk(p, false), "impl-adinkra");
      const on = await runScenario(mk(p, true), "impl-adinkra");

      // The channel corrupted the same frames in both arms — the check changes what the RECEIVER
      // does, never what the channel did. Disjoint streams are what make that true.
      expect(on.framesCorrupted).toBe(off.framesCorrupted);
      expect(on.framesCorrupted).toBeGreaterThan(0);

      // Detection is TOTAL, and it is an identity rather than a probability: every corruption
      // here is a single bit flip, and every CRC has minimum distance ≥ 2, so a single-bit error
      // is undetectable by NO CRC. A shortfall here would be a bug, not bad luck.
      expect(on.framesRejected).toBe(on.framesCorrupted);
      expect(off.framesRejected).toBe(0);

      // THE DEFECT, and its closure. Without the check, wrong bytes reach the application with
      // no error signal — that is `recoverAdinkraErasure` laundering a flipped parity bit into a
      // data packet. With it, zero, at every rate.
      expect(off.corruptDeliveries).toBe(wrongWithoutCheck);
      expect(on.corruptDeliveries).toBe(0);

      // ...and the check is not paid for in goodput. It is paid for BY goodput.
      expect(on.dataPacketsDelivered).toBeGreaterThan(off.dataPacketsDelivered);
    }
  });

  // ── UCH-20: the wire change is one-way compatible, and the failing direction is LOUD ────
  //
  // A wire-format change that only says "a field was added" has not said the part that matters.
  // This pins both directions, because the ASYMMETRY is the design decision (see `encodePacket`):
  //
  //   new sender → OLD receiver   WORKS   — the trailer sits past the payload and is ignored.
  //   old sender → NEW receiver   FAILS   — as `truncated`, a FRAMING error, never `checksum`.
  //
  // The second half is the load-bearing one. A version skew reported as channel corruption would
  // suppress a peer's backoff for the whole of a rollout, so the decode result keeps framing and
  // corruption apart and this test is what stops them being merged back into one `null` later.
  it("UCH-20: old frames are refused as `truncated`, not as corruption; new frames stay old-readable", () => {
    const payload = new Uint8Array([9, 8, 7, 6]);
    const header = { seq: 12, blockSeq: 1, blockPos: 4, isData: false, payloadLen: 4 };
    const frame = encodePacket(header, payload);
    expect(frame.length).toBe(PACKET_HEADER_BYTES + 4 + PACKET_CHECKSUM_BYTES);

    // OLD sender → NEW receiver: the pre-2026-08-14 frame, rebuilt here exactly as the old
    // encoder built it (16-byte header, payload, nothing else).
    const legacy = Buffer.concat([frame.subarray(0, PACKET_HEADER_BYTES), Buffer.from(payload)]);
    const onLegacy = decodePacket(legacy);
    expect(onLegacy.ok).toBe(false);
    if (onLegacy.ok) throw new Error("unreachable");
    expect(onLegacy.reason).toBe("truncated");
    // Emphatically NOT corruption — a rollout is not a noisy channel.
    expect(onLegacy.reason).not.toBe("checksum");

    // NEW sender → OLD receiver: the old decoder, reconstructed. It reads `payloadLen` and slices
    // from offset 16, tolerating trailing bytes — so it decodes the new frame correctly, unaware.
    const oldPayloadLen = frame.readUInt32BE(10);
    expect(frame.length).toBeGreaterThanOrEqual(PACKET_HEADER_BYTES + oldPayloadLen);
    expect(frame.readUInt32BE(0)).toBe(12);
    expect(frame.readUInt8(8)).toBe(4);
    expect(Array.from(frame.subarray(PACKET_HEADER_BYTES, PACKET_HEADER_BYTES + oldPayloadLen))).toEqual([9, 8, 7, 6]);

    // A short buffer is `short`, distinct again from both of the above.
    const stub = decodePacket(frame.subarray(0, 8));
    expect(stub.ok).toBe(false);
    if (stub.ok) throw new Error("unreachable");
    expect(stub.reason).toBe("short");

    // And a genuinely corrupt full frame IS `checksum` — otherwise the three-way split would be
    // a two-way split with a decorative third case.
    for (const bit of [0, 7, 63, 8 * PACKET_HEADER_BYTES + 3, frame.length * 8 - 1]) {
      const bad = Buffer.from(frame);
      bad[bit >> 3] = bad[bit >> 3]! ^ (1 << (bit & 7));
      const d = decodePacket(bad);
      expect(d.ok).toBe(false);
      if (d.ok) throw new Error("unreachable");
      expect(d.reason).toBe("checksum");
    }
  });

  // ── UCH-21: the original probe from the work-item, now refused ──────────────────────────
  //
  // 081KZYP1X3B087G0R001EZ37PQ was filed on exactly this: erase data packet 0, flip ONE bit in
  // PARITY packet 5, decode. The measured result was
  //
  //     erased d0 truth : [ 1, 2, 3, 4 ]
  //     recovered       : [ 254, 2, 3, 4 ]
  //     returned null?  : false          ← non-null, WRONG, silent
  //
  // One flipped bit in a packet the application never sees and would not have missed became a
  // wrong byte in a packet it does see. The decoder is UNCHANGED — it is still a pure erasure
  // decoder and would still do this — so this test pins the membrane in front of it: the corrupt
  // parity frame never reaches the block, the block sees an erasure at position 5 instead, and
  // the [8,4,4] code repairs BOTH positions and returns the truth.
  it("UCH-21: erase d0 + flip one bit of parity p5 — the corrupt frame is refused and d0 is recovered CORRECTLY", () => {
    const data = [
      new Uint8Array([1, 2, 3, 4]),
      new Uint8Array([5, 6, 7, 8]),
      new Uint8Array([9, 10, 11, 12]),
      new Uint8Array([13, 14, 15, 16]),
    ];
    const block = buildSenderBlock(0, data);
    const all = [...block.dataPackets, ...block.parityPackets];
    const frames = all.map((p, pos) =>
      encodePacket({ seq: pos, blockSeq: 0, blockPos: pos, isData: pos < 4, payloadLen: p.length }, p),
    );

    // Flip one bit in the PAYLOAD of parity packet 5 — the exact fault from the work-item.
    const corrupt = Buffer.from(frames[5]!);
    corrupt[PACKET_HEADER_BYTES] = corrupt[PACKET_HEADER_BYTES]! ^ 0x01;

    // The membrane refuses it...
    const rejected = decodePacket(corrupt);
    expect(rejected.ok).toBe(false);
    if (rejected.ok) throw new Error("unreachable");
    expect(rejected.reason).toBe("checksum");

    // ...so the receiver sees d0 erased AND p5 erased — two erasures, well inside d−1 = 3.
    const recv = makeReceiverBlock(0);
    let delivered: Uint8Array[] | null = null;
    for (const pos of [1, 2, 3, 4, 6, 7]) {
      const d = decodePacket(frames[pos]!);
      expect(d.ok).toBe(true);
      if (!d.ok) throw new Error("unreachable");
      delivered = addToBlock(recv, d.header.blockPos, new Uint8Array(d.payload)) ?? delivered;
    }
    expect(delivered).not.toBeNull();
    // The TRUTH, not [254, 2, 3, 4].
    expect(Array.from(delivered![0]!)).toEqual([1, 2, 3, 4]);
    for (let i = 0; i < 4; i++) expect(Array.from(delivered![i]!)).toEqual(Array.from(data[i]!));

    // ANTI-VACUITY: the un-flipped block must ALSO decode, or the assertion above could be
    // passing because nothing was ever decoded at all.
    const control = makeReceiverBlock(0);
    let controlOut: Uint8Array[] | null = null;
    for (const pos of [1, 2, 3, 4, 5, 6, 7]) {
      const d = decodePacket(frames[pos]!);
      if (!d.ok) throw new Error("unreachable");
      controlOut = addToBlock(control, d.header.blockPos, new Uint8Array(d.payload)) ?? controlOut;
    }
    expect(Array.from(controlOut![0]!)).toEqual([1, 2, 3, 4]);
  });

  // ── UCH-18: the closed form for the LOSS-RUN length — the falsifier `1/r` was standing in for
  //
  // The harness had two closed forms (stationary π_B and the loss rate) and treated `1/r` as a
  // third. `1/r` is the mean sojourn in the BAD STATE, which equals the mean run of consecutive
  // DROPS only when `lossInBad = 1` — i.e. only on the two-parameter Gilbert channel every call
  // site was pinned to. Under the measured 802.11 fit the two differ by 2.8x, and it is the DROP
  // run, not the state sojourn, that an erasure code experiences.
  it("UCH-18: analyticLossRunLength predicts the measured run length on all four channel families", () => {
    const N = 400_000;
    for (const [name, params] of [
      ["anti-correlated L=1", burstParams(0.1, 1)],
      ["geometric burst L=5.37", burstParams(0.1108, 5.37)],
      ["i.i.d. Bernoulli", bernoulliParams(0.1)],
      ["calibrated 802.11 (4-param)", CALIBRATION.wifi2022],
    ] as const) {
      const trace = gilbertElliottTrace(N, params, 0xabcdn);
      const predicted = analyticLossRunLength(params);
      expect(`${name}:${Math.abs(trace.meanBurstLength - predicted) < 0.15}`).toBe(`${name}:true`);
      // …and the loss RATE closed form holds at the same time, so this is not a rescaled fit.
      expect(Math.abs(trace.dropCount / N - analyticLossRate(params))).toBeLessThan(0.005);
    }
    // The state sojourn and the drop run COINCIDE only on a total-outage bad state.
    expect(analyticLossRunLength(burstParams(0.1108, 5.37))).toBeCloseTo(5.37, 6);
    // …and diverge by 2.8x once `lossInBad` is the measured 0.6097 rather than 1.
    expect(1 / CALIBRATION.wifi2022.pBadToGood).toBeCloseTo(5.37, 2);
    expect(analyticLossRunLength(CALIBRATION.wifi2022)).toBeLessThan(2.0);
  });

  // ── UCH-22: all four Gilbert–Elliott parameters are REACHABLE ────────────────────────────
  //
  // `lossInGood = 0, lossInBad = 1` was hardcoded on every path, which is Gilbert's 1960 channel
  // (`k = 1, h = 0`), not the Elliott 1963 generalisation the harness is named for. Two of four
  // parameters had no call site (081KZYP23HG087G0R000117H0K). Named, cited operating points beat
  // a large uncalibrated grid, so the fix is a constructor plus ONE cited point — not a
  // four-dimensional sweep nobody can afford or interpret.
  it("UCH-22: the calibrated 802.11 point exercises lossInGood and lossInBad, and is not a total outage", () => {
    const p = CALIBRATION.wifi2022;
    // The two parameters that had been unreachable are genuinely interior.
    expect(p.lossInGood).toBeGreaterThan(0);
    expect(p.lossInBad).toBeLessThan(1);
    expect(p.lossInBad).toBeCloseTo(0.6097, 6);

    // A bad state that drops ~61% leaves ~3 of 8 gone per block — ON the [8,4,4] boundary, which
    // is the region a total-outage model skips over entirely rather than merely exaggerating.
    const N = 400_000;
    const cal = blockErasureHistogram(gilbertElliottTrace(N, p, 0xabcdn));
    const outage = blockErasureHistogram(gilbertElliottTrace(N, burstParams(analyticLossRate(p), 5.37), 0xabcdn));
    const anti = blockErasureHistogram(gilbertElliottTrace(N, burstParams(analyticLossRate(p), 1), 0xabcdn));
    // The calibrated channel puts MORE mass on the k=3..5 boundary than either substitute.
    // Measured at ρ = 0.1108: calibrated 0.12620, total-outage 0.08878, anti-correlated 0.02634
    // — i.e. 1.42x the total-outage model and 4.79x the anti-correlated one. Pinned at the
    // measured ratios rather than at round numbers, so a drift shows up as a diff.
    const boundary = (h: number[]) => h[3]! + h[4]! + h[5]!;
    expect(boundary(cal)).toBeCloseTo(0.1262, 3);
    expect(boundary(cal) / boundary(outage)).toBeGreaterThan(1.4);
    expect(boundary(cal) / boundary(anti)).toBeGreaterThan(4.7);
    // k>=5 is IMPOSSIBLE under the anti-correlated model and 2.7% of blocks under the fit.
    expect(anti[5]!).toBe(0);
    expect(cal[5]!).toBeGreaterThan(0.02);
    // …at the SAME overall loss rate, so the difference is shape and not severity.
    expect(analyticLossRate(p)).toBeCloseTo(analyticLossRate(burstParams(analyticLossRate(p), 5.37)), 6);

    // The constructor validates rather than trusting.
    expect(() => gilbertElliottParams(1.2, 0.5, 0, 1)).toThrow();
    expect(() => gilbertElliottParams(0, 0, 0, 1)).toThrow();
    expect(gilbertElliottParams(0.0393, 0.1862, 0.0055, 0.6097)).toEqual(p);
  });

  // ── UCH-23: the heavy tail a geometric burst length cannot represent ─────────────────────
  //
  // GE burst lengths are geometric BY CONSTRUCTION. The measured traces are Pareto Type II with
  // max 8,853 against a mean of 5.37 — three orders of magnitude — and a block code's failure
  // probability is dominated by that tail. This is the honest limit of the whole exercise: the
  // paper that supplies the calibration also concludes a 2-state GE "cannot capture the behavior
  // of the real system". The renewal channel here is richer than GE and still weaker than the
  // paper's 4-state HMM, and is labelled as such rather than presented as sufficient.
  it("UCH-23: the Lomax renewal channel produces runs a geometric channel of equal mean cannot", () => {
    const N = 400_000;
    const heavy = lomaxBurstTrace(N, LOMAX_WIFI2022_DERIVED, 0xabcdn);
    const geo = gilbertElliottTrace(N, burstParams(heavy.dropCount / N, heavy.meanBurstLength), 0xabcdn);

    // Same overall rate and same MEAN burst — matched on everything a GE model can express.
    expect(Math.abs(heavy.dropCount / N - geo.dropCount / N)).toBeLessThan(0.01);
    expect(Math.abs(heavy.meanBurstLength - geo.meanBurstLength)).toBeLessThan(0.6);

    // …and the tails are nothing alike. That is the point: matching the first two moments of a
    // heavy-tailed process with a geometric one does not match the risk.
    const maxOf = (h: ReadonlyMap<number, number>) => Math.max(...h.keys());
    expect(maxOf(heavy.burstHistogram)).toBeGreaterThan(maxOf(geo.burstHistogram) * 3);
    // Total block wipeouts (k=8) are far more common under the tail.
    expect(blockErasureHistogram(heavy)[8]!).toBeGreaterThan(blockErasureHistogram(geo)[8]!);

    // DST: the renewal channel replays exactly, like every other draw in this harness.
    expect(lomaxBurstTrace(1000, LOMAX_WIFI2022_DERIVED, 0xabcdn).dropped).toEqual(
      lomaxBurstTrace(1000, LOMAX_WIFI2022_DERIVED, 0xabcdn).dropped,
    );
    expect(lomaxBurstTrace(1000, LOMAX_WIFI2022_DERIVED, 0xabcen).dropped).not.toEqual(
      lomaxBurstTrace(1000, LOMAX_WIFI2022_DERIVED, 0xabcdn).dropped,
    );
  });

  // ── UCH-24: the DELTA — every headline number re-run on a channel that is what it claims ──
  //
  // The numbers get WORSE, which is the point. Reported as measurements, with the old value
  // beside the new one, so the size of the instrument's error is legible rather than quietly
  // absorbed into a re-baselined figure.
  it("UCH-24: delivery under genuine Bernoulli is strictly below the anti-correlated model's, at every rate", async () => {
    const rows: string[] = [];
    for (const rate of [0.05, 0.12, 0.2, 0.3]) {
      const anti = await runScenario(
        defaultConfig({ blocks: 3000, seed: 0x5eedn, loss: burstParams(rate, 1) }),
        "impl-adinkra",
        1,
      );
      const ber = await runScenario(
        defaultConfig({ blocks: 3000, seed: 0x5eedn, loss: bernoulliParams(rate) }),
        "impl-adinkra",
        1,
      );
      rows.push(`${rate}: ${anti.deliveryRatio.toFixed(5)} -> ${ber.deliveryRatio.toFixed(5)}`);
      // The anti-correlated model NEVER reports worse than the honest one. Not once.
      expect(`${rate}:${ber.deliveryRatio <= anti.deliveryRatio}`).toBe(`${rate}:true`);
    }
    // Pinned so a regression in either direction is visible in the diff.
    expect(rows).toEqual([
      "0.05: 1.00000 -> 0.99967",
      "0.12: 0.99900 -> 0.99767",
      "0.2: 0.99433 -> 0.98367",
      "0.3: 0.95933 -> 0.91333",
    ]);
  }, 20_000);

  // ── UCH-25: the cliff moves IN by a full grid step under an honest channel ───────────────
  //
  // UCH-12 reports "~20% uniform". That row was never uniform. On genuine i.i.d. loss the 99%
  // cliff is 12%, and UCH-12's own words are corrected rather than its threshold lowered.
  it("UCH-25: the 99% cliff is 12% under Bernoulli, not the 20% the anti-correlated row reported", async () => {
    const rates = [0.005, 0.01, 0.02, 0.03, 0.05, 0.08, 0.12, 0.2, 0.3];
    const base = { blocks: 2000, seed: 0x5eedn };
    for (const dec of ["impl-adinkra", "ml-adinkra"] as const) {
      const anti = await characteriseCliff(dec, rates, [1], base, 0.99, 1);
      const ber = await characteriseCliff(dec, rates, [1], base, 0.99, 1, (r) => bernoulliParams(r));
      expect(`${dec}:${anti.cliffByBurstLength.get(1)}`).toBe(`${dec}:0.2`);
      expect(`${dec}:${ber.cliffByBurstLength.get(1)}`).toBe(`${dec}:0.12`);
    }
  }, 30_000);

  // ── UCH-26: the bias is NOT uniformly optimistic — the direction reverses at high loss ────
  //
  // 081KZYY6SVJ087G0R0035SW945 states that "every uniform-loss row is optimistic in the code's
  // favour". Measured, that is true for the [8,4,4] delivery curve and FALSE for the XOR-7/8
  // goodput curve at high loss, and the correction is recorded here rather than left standing.
  //
  // The mechanism: anti-correlation SUPPRESSES VARIANCE. At high loss a rate-7/8 code needs a
  // lucky block (<=1 erasure in 8), and luck is variance. Forbidding runs also forbids the clean
  // stretches, so the anti-correlated model under-reports XOR-7/8 — by 9x at 40% loss. A model
  // error is not a bias with a sign; it is a distortion, and which way it points depends on
  // which tail the consumer of the number lives in.
  it("UCH-26: at 40% loss the anti-correlated model UNDER-reports XOR-7/8 by ~9x — the bias has no fixed sign", async () => {
    const cfgAt = (loss: ReturnType<typeof burstParams>) => defaultConfig({ blocks: 3000, seed: 0x5eedn, loss });
    // Low loss: the honest channel is worse for BOTH codes (the expected direction).
    const antiLo = await runScenario(cfgAt(burstParams(0.05, 1)), "xor7of8", 1);
    const berLo = await runScenario(cfgAt(bernoulliParams(0.05)), "xor7of8", 1);
    expect(berLo.goodput).toBeLessThan(antiLo.goodput);

    // High loss: it is BETTER, and by a lot. UCH-13b's `xor.goodput < 0.05` at 40% is a property
    // of the anti-correlated channel and does not survive on an i.i.d. one.
    const antiHi = await runScenario(cfgAt(burstParams(0.4, 1)), "xor7of8", 1);
    const berHi = await runScenario(cfgAt(bernoulliParams(0.4)), "xor7of8", 1);
    expect(antiHi.goodput).toBeLessThan(0.05); // the number the module header quotes as 0.010
    expect(berHi.goodput).toBeGreaterThan(0.05); // …and the honest channel says otherwise
    expect(berHi.goodput / antiHi.goodput).toBeGreaterThan(5);

    // The crossover itself barely moves, because both curves shift together: ~18% -> ~19%.
    for (const [rate, expected] of [
      [0.18, "xor"],
      [0.19, "impl"],
    ] as const) {
      const impl = await runScenario(cfgAt(bernoulliParams(rate)), "impl-adinkra", 1);
      const xor = await runScenario(cfgAt(bernoulliParams(rate)), "xor7of8", 1);
      expect(`${rate}:${xor.goodput > impl.goodput ? "xor" : "impl"}`).toBe(`${rate}:${expected}`);
    }
  }, 20_000);

  // ── UCH-27: what ACTUALLY put ULT-34's bound out of the instrument's reach ───────────────
  //
  // PR #10541 records that mutating `Math.min(pendingCorruptFrames, missing.length)` to the bare
  // count left all 75 tests green, and attributes the blindness to `meanBurstLength = 1`
  // forbidding consecutive corruptions. The first half is a fact. **The causal half is wrong,
  // and this test is the measurement that says so.**
  //
  // CONFIRMED EMPIRICALLY once #10541 merged, against the real code rather than a model: with
  // `Math.min(...)` replaced by the bare `this.pendingCorruptFrames`, this whole chaos file —
  // all 30 tests, genuine Bernoulli channel and all — stays GREEN, and only the hand-built
  // `ULT-34` goes red. The corrected loss model does not kill this mutant.
  //
  // Replaying the receiver's own arithmetic (READ from `udp-lossy-transport.ts`, the
  // `pendingCorruptFrames` increment and the `attributable` clamp, not inferred) against
  // 400,000 frames:
  //
  //   channel                        clamp fires
  //   burstParams(rho, 1)            0
  //   bernoulliParams(rho)           0      <-- fixing the Bernoulli defect changes NOTHING here
  //   + loss bursts wider than MAX_NACK_GAP  ~1,000
  //
  // The reason is structural, and it is a proof rather than a sample. A refused frame does not
  // advance `expectedSeq`, and arrivals are in sequence order, so every refused sequence number
  // still lies inside the NEXT reported gap: `missing.length >= pending`, always, at every burst
  // length and every loss rate. `pending > missing.length` is UNREACHABLE in an in-order channel
  // — consecutive corruption is neither necessary nor sufficient for it.
  //
  // The DESYNC branch used to be the way the clamp fired: pending survived a gap wider
  // than MAX_NACK_GAP and was spent against the next narrow gap (081KZZYESKA). That leak
  // is closed — pending is cleared on desync — so the clamp is unreachable on both the
  // in-order path and the desync path. ULT-35 is the unit falsifier; this test is the
  // channel-scale confirmation.
  it("UCH-27: the clamp's precondition is unreachable in-order at ANY burst length, and stays so past MAX_NACK_GAP", () => {
    const N = 200_000;
    // The receiver's arithmetic, transcribed. `loss` never arrives; `corrupt` arrives and is
    // refused, incrementing pending without advancing expectedSeq.
    const replay = (loss: readonly boolean[], corrupt: readonly boolean[]) => {
      let expectedSeq = 0;
      let pending = 0;
      let bites = 0;
      let desyncs = 0;
      for (let seq = 0; seq < N; seq++) {
        if (loss[seq]) continue;
        if (corrupt[seq]) {
          pending = Math.min(MAX_NACK_GAP, pending + 1);
          continue;
        }
        const gap = seq - expectedSeq;
        if (gap > MAX_NACK_GAP) {
          desyncs++;
          pending = 0; // 081KZZYESKA: desync cannot evidence the prior count
        } else if (gap > 0) {
          if (pending > gap) bites++;
          pending -= Math.min(pending, gap);
        }
        expectedSeq = Math.max(expectedSeq, seq + 1);
      }
      return { bites, desyncs };
    };
    const clean = new Array<boolean>(N).fill(false);
    const corruptAnti = gilbertElliottTrace(N, burstParams(0.05, 1), 0xc0ffeen, STREAM.duplicate).dropped;
    const corruptBer = gilbertElliottTrace(N, bernoulliParams(0.05), 0xc0ffeen, STREAM.duplicate).dropped;

    // (a) No loss at all: the clamp cannot fire under EITHER corruption model.
    expect(replay(clean, corruptAnti).bites).toBe(0);
    expect(replay(clean, corruptBer).bites).toBe(0);

    // (b) The derived in-window grid — still 0, Bernoulli corruption and all. This is the
    //     assertion that refutes "meanBurstLength = 1 is why the mutation survived".
    const inWindow = SWEEP_BURST_LENGTHS.filter((L) => L <= MAX_NACK_GAP);
    for (const L of inWindow) {
      const loss = gilbertElliottTrace(N, burstParams(0.05, L), 0xabcdn, STREAM.loss).dropped;
      expect(`L=${L}:${replay(loss, corruptAnti).bites}`).toBe(`L=${L}:0`);
      expect(`L=${L}:${replay(loss, corruptBer).bites}`).toBe(`L=${L}:0`);
    }

    // (c) Past MAX_NACK_GAP the desync branch used to CARRY pending across (081KZZYESKA).
    //     That leak is closed: pending is cleared, so the clamp stays unreachable.
    //     The past-desync L is taken from the derived grid, not a remembered 100.
    const pastDesync = Math.max(...SWEEP_BURST_LENGTHS);
    const longBurst = gilbertElliottTrace(N, burstParams(0.05, pastDesync), 0xabcdn, STREAM.loss).dropped;
    const reached = replay(longBurst, corruptBer);
    expect(reached.desyncs).toBeGreaterThan(0);
    expect(reached.bites).toBe(0);

    // (d) The heavy-tailed channel still desyncs at ~12% overall loss, and still
    //     does not bite the clamp once pending dies with the desync.
    const heavy = lomaxBurstTrace(N, LOMAX_WIFI2022_DERIVED, 0xabcdn, STREAM.loss);
    const heavyReached = replay(heavy.dropped, corruptBer);
    expect(heavyReached.desyncs).toBeGreaterThan(0);
    expect(heavyReached.bites).toBe(0);
  });

  // ── UCH-28: the grid itself is the instrument — it must cross the desync threshold ──────
  //
  // 081KZZYETRX. The previous sweep list was `[1, 2, 4, 8]`. Nothing in it could produce a
  // gap of `MAX_NACK_GAP` (64) at any realistic sample size, so the desync branch was never
  // walked by the chaos harness — only by hand-built unit cases. A grid that silently stops
  // below a threshold in the code under test is the same class of defect as a model that
  // cannot produce a fault class (the lesson of `burstParams(ρ, 1)` being named Bernoulli).
  //
  // The fix is to DERIVE the top of the grid from `MAX_NACK_GAP`. This test is the
  // falsifier: it fails if the exported grid no longer exceeds the threshold, if it is a
  // remembered list that has drifted from the derivation, or if the past-desync point
  // cannot actually produce a gap wider than the window.
  it("UCH-28: the sweep grid is derived from MAX_NACK_GAP and its top produces desync-width gaps", () => {
    expect(SWEEP_BURST_LENGTHS).toEqual(deriveSweepBurstLengths(MAX_NACK_GAP));
    expect(Math.max(...SWEEP_BURST_LENGTHS)).toBeGreaterThan(MAX_NACK_GAP);
    expect(SWEEP_BURST_LENGTHS.some((L) => L < MAX_NACK_GAP)).toBe(true);
    // The property, not the 64: a smaller window still grows a past-desync point.
    expect(Math.max(...deriveSweepBurstLengths(8))).toBeGreaterThan(8);
    expect(Math.max(...deriveSweepBurstLengths(32))).toBeGreaterThan(32);
    expect(() => deriveSweepBurstLengths(1)).toThrow(/integer >= 2/);

    // Anti-vacuity: a GE trace at the past-desync L produces runs wider than the window.
    // Cheap — boolean array, no ferry — so this can live under the default 5s cap.
    const past = Math.max(...SWEEP_BURST_LENGTHS);
    const N = 50_000;
    const dropped = gilbertElliottTrace(N, burstParams(0.05, past), 0xabcdn, STREAM.loss).dropped;
    let run = 0;
    let wideRuns = 0;
    for (let i = 0; i < N; i++) {
      if (dropped[i]) {
        run++;
      } else {
        if (run > MAX_NACK_GAP) wideRuns++;
        run = 0;
      }
    }
    if (run > MAX_NACK_GAP) wideRuns++;
    expect(wideRuns).toBeGreaterThan(0);
  });
});
