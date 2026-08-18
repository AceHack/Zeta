/**
 * udp-lossy-transport.test.ts — Tests for the lossy UDP transport with Adinkra [8,4,4] ECC.
 *
 * Anti-self-certifying: tests include fault injection (deliberate packet drops) and
 * negative controls (2+ erasures → unrecoverable).
 */
import { describe, it, expect } from "bun:test";
import { yieldTurns } from "../testing/deterministic-async";
import fc from "fast-check";
import {
  MAX_NACK_GAP,
  RECV_BLOCK_WINDOW,
  DELIVERED_BLOCK_CAP,
  type DesyncEvent,
  computeAdinkraParity,
  recoverAdinkraErasure,
  recoverAdinkraBlock,
  buildSenderBlock,
  addToBlock,
  makeReceiverBlock,
  makeAimdState,
  onLoss,
  onSend,
  retractLoss,
  lossRates,
  evaluatedLossRates,
  congestionSuspectRate,
  encodeNack,
  decodeNack,
  type NackMessage,
  encodePacket,
  decodePacket,
  blockAddressOf,
  PACKET_HEADER_BYTES,
  PACKET_CHECKSUM_BYTES,
  xorParityBlock,
  xorRecoverErasure,
  scheduleGossipRebroadcast,
  LossyUdpChannel,
} from "./udp-lossy-transport";
import { createDimensionalBnn } from "../planning/error-bnn-bridge";
import { sweepOnce } from "./udp-lossy-transport.reorder-sweep";

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

  // ── ULT-4: the REAL negative control — what the code genuinely cannot do ───────────────
  //
  // FLIPPED 2026-08-13 (081KZYN3B79087G0R0014ZKE3C). This test used to read
  //   "ULT-4 (negative): two erasures → unrecoverable"
  // and it passed. It was pinning the DECODER's limit while describing it as the CODE's:
  // [8,4,4] has d=4 and therefore corrects any 3 erasures. Two erasures are recovered now, so
  // the old assertion is false and is replaced rather than relaxed.
  //
  // A negative control still has to exist, or "recovers everything" becomes untestable. The
  // honest one is a pattern no decoder can resolve: the erased set contains the support of a
  // nonzero codeword, so two distinct codewords agree on every surviving position.
  it("ULT-4 (negative): an erased weight-4 codeword support is unrecoverable — by any decoder", () => {
    const data = makeData(4, 3);
    const parity = computeAdinkraParity(data);
    const full = [...data, ...parity] as (Uint8Array | null)[];

    // {0,5,6,7} is the support of generator row 0 (10000111) — itself a codeword of weight 4.
    const onCodeword = [...full];
    for (const i of [0, 5, 6, 7]) onCodeword[i] = null;
    expect(recoverAdinkraBlock(onCodeword)).toBeNull();
    expect(recoverAdinkraErasure(onCodeword)).toBeNull();

    // WHY it is unrecoverable, demonstrated rather than asserted: adding that codeword to the
    // data produces a DIFFERENT message whose codeword agrees on all four surviving positions.
    // The survivors therefore do not identify the message, and no decoder can choose.
    const alt = data.map((d, i) => {
      const c = new Uint8Array(d);
      if (i === 0) for (let b = 0; b < c.length; b++) c[b] = c[b]! ^ 0xff; // flip d0 by the codeword
      return c;
    });
    const altFull = [...alt, ...computeAdinkraParity(alt)];
    for (const survivor of [1, 2, 3, 4]) {
      expect(Array.from(altFull[survivor]!)).toEqual(Array.from(full[survivor]!));
    }
    expect(Array.from(altFull[0]!)).not.toEqual(Array.from(full[0]!)); // …but the messages differ

    // Five erasures: more unknowns than the 4 parity checks can pin down.
    const fiveGone = [...full];
    for (const i of [0, 1, 2, 3, 4]) fiveGone[i] = null;
    expect(recoverAdinkraBlock(fiveGone)).toBeNull();

    // Anti-vacuity: a decoder that returned null for everything would satisfy all of the above.
    const threeGone = [...full];
    for (const i of [0, 5, 6]) threeGone[i] = null;
    expect(recoverAdinkraBlock(threeGone)).not.toBeNull();
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
  //
  // AMENDED 2026-08-13 (081KZYN3B79087G0R0014ZKE3C). This test used to keep only the LAST
  // call's return value and assert it was non-null. That held only because delivery used to
  // happen at the 7th packet, which was also the last one fed in. With the block solved as
  // soon as 4 independent symbols are in hand, delivery moves EARLIER and the last three calls
  // now correctly return null (nothing further to deliver) — so the old shape failed on an
  // improvement. Capturing the FIRST delivery, and asserting WHICH arrival produced it, tests
  // the thing the name claims and pins the latency as a number.
  it("ULT-6: receiver block recovers from 1 dropped packet, delivering at the 4th arrival", () => {
    const data = makeData(4, 11);
    const block = buildSenderBlock(0, data);
    const recv = makeReceiverBlock(0);
    const allPkts = [...block.dataPackets, ...block.parityPackets];
    // Drop packet at position 2 (a data packet).
    let result: Uint8Array[] | null = null;
    let deliveredAfter = -1;
    let arrivals = 0;
    let deliveries = 0;
    for (let pos = 0; pos < 8; pos++) {
      if (pos === 2) continue; // simulate drop
      arrivals++;
      const got = addToBlock(recv, pos, allPkts[pos]!);
      if (got) {
        deliveries++;
        if (result === null) {
          result = got;
          deliveredAfter = arrivals;
        }
      }
    }
    expect(result).not.toBeNull();
    expect(result!.length).toBe(4);
    expect(Array.from(result![2]!)).toEqual(Array.from(data[2]!));
    // Every data packet, not just the recovered one.
    for (let i = 0; i < 4; i++) expect(Array.from(result![i]!)).toEqual(Array.from(data[i]!));
    // 4 symbols suffice: positions 0,1,3,4 arrived — the block did not wait for a 7th packet.
    expect(deliveredAfter).toBe(4);
    // §12 idempotency: the later arrivals deliver nothing a second time.
    expect(deliveries).toBe(1);
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

  // ── ULT-8: AIMD backoff on UNATTRIBUTED loss ─────────────────────────────────────────
  //
  // Unattributed loss keeps the classical response, and that is a deliberate choice rather than
  // an omission: `unknown` is the union {congestion, corruption}, and refusing to back off on it
  // would be ASSUMING corruption — the same error as the one 081KZYQ8KNB fixes, with the sign
  // flipped, and with congestion collapse as its failure mode instead of lost throughput.
  it("ULT-8: unattributed loss above 5% still doubles the gap (the conservative direction)", () => {
    let state = makeAimdState(10);
    for (let i = 0; i < 30; i++) state = onSend(state);
    state = onLoss(state, { cause: "unknown", seqs: [0, 1, 2, 3, 4] }); // 5/30 = 16.7%
    expect(state.gapMs).toBeGreaterThanOrEqual(20);
  });

  // ── ULT-8b: THE FIX. Attributed non-congestion loss does not move the gap at all ──────
  //
  // Same window, same 16.7%, different cause. Before 081KZYQ8KNB there was no way to express
  // this difference: `onNack(state, 5)` was the only door and it took a bare count.
  it("ULT-8b: the SAME 16.7% loss, attributed to reorder, moves the gap the OPPOSITE way", () => {
    let state = makeAimdState(10);
    for (let i = 0; i < 30; i++) state = onSend(state);
    expect(congestionSuspectRate(state)).toBe(0);
    state = onLoss(state, { cause: "reorder", seqs: [0, 1, 2, 3, 4] });
    // Not merely "does not back off": with no congestion-suspect loss the channel reads CLEAR, so
    // additive increase runs and the gap SHRINKS. ULT-8 doubled it to 20 on the identical rate.
    expect(state.gapMs).toBe(8);
    // ...and it was COUNTED, not discarded. A suppressed signal that vanishes is not honest, and
    // the evaluated window is where it is visible (the live one is reset by the evaluation).
    const row = evaluatedLossRates(state).find((r) => r.cause === "reorder")!;
    expect(row.missing).toBe(5);
    expect(row.windowPackets).toBe(30);
    expect(row.rate).toBeCloseTo(5 / 30, 5);
    // MUTATION GUARD: if `updateAimd` summed all causes instead of the congestion-suspect ones,
    // 5/30 = 16.7% would double the gap to 20 and this test fails. That is the falsifier, and it
    // was checked by making that mutation rather than by assuming it.
  });

  // ── ULT-9: AIMD additive increase on low loss ─────────────────────────────────────────
  it("ULT-9: AIMD reduces gap on low loss (<1%)", () => {
    let state = makeAimdState(20);
    // Simulate 64 sends with 0 NACKs (0% loss → below LOW_LOSS_THRESHOLD)
    for (let i = 0; i < 64; i++) state = onSend(state);
    // After window reset, gap should have decreased
    expect(state.gapMs).toBeLessThan(20);
  });

  // ── ULT-10: lossRates returns one row PER CAUSE ──────────────────────────────────────
  //
  // This test used to read `lossRate(state)` and assert a single fraction. That function is gone:
  // it is the operation that discarded the distinction, and it was removed rather than kept
  // beside a replacement, because a scalar that is still reachable is still the easy path.
  it("ULT-10: lossRates reports every cause separately and never as one number", () => {
    // One report per window, because the estimator evaluates AND resets on every report
    // (081KZYN37T, pinned in ULT-10b). That is exactly why `evaluatedLossRates` has to exist.
    const by = (rows: ReturnType<typeof lossRates>) => new Map(rows.map((r) => [r.cause, r]));

    let state = makeAimdState(10);
    for (let i = 0; i < 40; i++) state = onSend(state);
    state = onLoss(state, { cause: "reorder", seqs: [1, 2, 3, 4, 5] }); // 5/40 = 12.5%
    const afterReorder = evaluatedLossRates(state);
    expect(afterReorder.map((r) => r.cause)).toEqual(["congestion", "corruption", "reorder", "unknown"]);
    expect(by(afterReorder).get("reorder")!.missing).toBe(5);
    expect(by(afterReorder).get("unknown")!.missing).toBe(0);
    // The denominator travels with the numerator, so a reader can check the division.
    for (const r of afterReorder) expect(r.windowPackets).toBe(40);
    expect(by(afterReorder).get("reorder")!.rate).toBeCloseTo(5 / 40, 6);
    const gapAfterReorder = state.gapMs;

    for (let i = 0; i < 40; i++) state = onSend(state);
    state = onLoss(state, { cause: "unknown", seqs: [50, 51, 52, 53, 54] }); // the SAME 12.5%
    const afterUnknown = evaluatedLossRates(state);
    expect(by(afterUnknown).get("unknown")!.missing).toBe(5);
    expect(by(afterUnknown).get("reorder")!.missing).toBe(0);

    // Same rate, different cause, OPPOSITE response. A single `lossRate` number could not have
    // told these two windows apart, which is the whole of 081KZYQ8KNB in two assertions.
    expect(gapAfterReorder).toBeLessThan(10);
    expect(state.gapMs).toBe(gapAfterReorder * 2);
  });

  // ── ULT-10b: the live window is emptied by every evaluation — 081KZYN37T, PINNED ─────
  //
  // PINS CURRENT BEHAVIOUR of a defect this change deliberately does NOT fix (it is next in the
  // ordering). `updateAimd` resets the window on every evaluation, so a caller that samples
  // `lossRates` right after a decision sees nothing. It is pinned rather than worked around so
  // that whoever fixes the estimator sees this test fail and knows the surface changed.
  // Expected to FAIL when 081KZYN37T4087G0R00181THA4 is fixed.
  it("ULT-10b: after a backoff the live window is empty and only the evaluated window remembers", () => {
    let state = makeAimdState(10);
    for (let i = 0; i < 10; i++) state = onSend(state);
    state = onLoss(state, { cause: "unknown", seqs: [0, 1] }); // 2/10 = 20% → decrease + reset
    expect(state.gapMs).toBe(20);
    expect(lossRates(state).every((r) => r.missing === 0 && r.windowPackets === 0)).toBe(true);
    const evaluated = evaluatedLossRates(state).find((r) => r.cause === "unknown")!;
    expect(evaluated.missing).toBe(2);
    expect(evaluated.windowPackets).toBe(10);
  });

  // ── ULT-11: Packet encode/decode round-trip ───────────────────────────────────────────
  it("ULT-11: packet encode/decode round-trip", () => {
    const payload = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    const header = { seq: 42, blockSeq: 5, blockPos: 2, isData: true, payloadLen: 8 };
    const buf = encodePacket(header, payload);
    // PIN UPDATED 2026-08-14 (081KZYP1X3B087G0R001EZ37PQ). The frame now carries a 4-byte CRC-32C
    // TRAILER and `decodePacket` returns a discriminated result rather than `T | null`, because a
    // framing failure and a checksum failure license different conclusions and `null` could not
    // tell them apart. The round-trip property itself is unchanged.
    expect(buf.length).toBe(PACKET_HEADER_BYTES + payload.length + PACKET_CHECKSUM_BYTES);
    const decoded = decodePacket(buf);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) throw new Error("unreachable");
    expect(decoded.header.seq).toBe(42);
    expect(decoded.header.blockSeq).toBe(5);
    expect(decoded.header.blockPos).toBe(2);
    expect(decoded.header.isData).toBe(true);
    expect(Array.from(decoded.payload)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
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
  //
  // ASSERTION STRENGTHENED. This test used to schedule a real 10-30ms timer, sleep 50ms, and
  // assert `fired === true`. Two defects in one line: on a loaded runner 50ms of wall-clock is
  // not enough for a 30ms timer to be DELIVERED, so it went red for the machine; and it never
  // checked the jitter window its own name claims -- a bug that fired at 30 SECONDS would have
  // been caught, a bug that fired at 1ms would not. With the timer injected the delay itself is
  // the observable, so the window is now actually asserted, and no wall-clock elapses at all.
  it("ULT-14: gossip debounce fires within the jitter window, at both ends of it", () => {
    for (const [r, expected] of [[0, 10], [0.5, 20], [0.999, 29.98]] as const) {
      let fired = false;
      let scheduledDelay = Number.NaN;
      const cancel = scheduleGossipRebroadcast(() => { fired = true; }, 10, 30, {
        random: () => r,
        setTimeout: (fn, ms) => { scheduledDelay = ms; fn(); return 1; },
        clearTimeout: () => {},
      });
      expect(fired).toBe(true);
      expect(scheduledDelay).toBeCloseTo(expected, 1);
      // The contract: never below the floor, never at or above the ceiling.
      expect(scheduledDelay).toBeGreaterThanOrEqual(10);
      expect(scheduledDelay).toBeLessThan(30);
      cancel(); // no-op since already fired
    }
  });

  it("ULT-14b: cancelling before the timer fires means the callback never runs", () => {
    let fired = false;
    let scheduled: (() => void) | undefined;
    let cleared = false;
    const cancel = scheduleGossipRebroadcast(() => { fired = true; }, 10, 30, {
      random: () => 0.5,
      setTimeout: (fn) => { scheduled = fn; return 7; },
      clearTimeout: (h) => { cleared = h === 7; },
    });
    cancel();
    expect(cleared).toBe(true);
    // ANTI-VACUITY: prove the callback was real and would have fired had it not been cancelled.
    expect(fired).toBe(false);
    scheduled?.();
    expect(fired).toBe(true);
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
            cause: "unknown",
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

  // The REJECT path of the `isNackMessage` type guard, and an HONEST NOTE about what this test
  // does and does not prove. Found 2026-08-11 by the mutation runner.
  //
  // The runner flips `return false` (for non-objects) to `return true` and the suite stays green.
  // I first assumed that was a missing negative test and wrote this one. IT DOES NOT KILL THE
  // MUTANT, and re-running the runner is what proved it — not the green suite.
  //
  // The reason is downstream: the teaching branch wraps its work in `try { ... } catch { }` with an
  // EMPTY body, justified in the source as "browser env without dynamic import". When the guard is
  // mutated to accept a string, the code enters the try and throws on `teaching.missingSeqs.join`,
  // and the bare catch swallows it. Guard-true and guard-false therefore produce IDENTICAL
  // observable behaviour, so NO test can distinguish them while that catch is that broad. The
  // mutant is unobservable by construction, not under-tested.
  //
  // This test is still worth keeping — it pins that a well-formed teaching advances the BNN and a
  // malformed one does not — but the second half currently holds because of the catch, not because
  // of the guard. Narrowing the catch is a behaviour change on a live module and is left as a
  // separate call.
  it("ULT-16: a non-object `teaching` produces no teaching — the BNN is not fed network garbage", async () => {
    let receive: (text: string, from: string) => void = () => {};
    const bnn = createDimensionalBnn();
    const transport = {
      broadcast: () => {},
      onMessage: (handler: (text: string, from: string) => void) => {
        receive = handler;
      },
    };
    // Constructed for its SIDE EFFECT: the channel registers the transport's message handler, which
    // is what `receive` below invokes. Nothing calls a method on it, hence the void.
    void new LossyUdpChannel(transport, "receiver", bnn);
    // SETTLE, IN TURNS RATHER THAN MILLISECONDS. Everything this waits on is in-memory: the
    // receiver's message handler and the promise chain it kicks off. A macrotask turn is a turn
    // on any machine, so `yieldTurns` drains that chain identically on an idle laptop and a
    // contended runner -- where the 10ms sleep it replaces was a bet on how fast the runner was.
    // MEASURED: one turn is enough for every settle site in this file (51 pass at yieldTurns(1)),
    // so eight is 8x headroom in a unit that does not shrink under load. It costs microseconds:
    // each turn is a ZERO-delay timer, which is the whole point.
    const settle = () => yieldTurns(8);

    // FIRST prove the teaching path is live, so a later zero cannot be mistaken for a dead path —
    // that would be a vacuous pass. A well-formed teaching object must advance obsCount.
    receive(
      JSON.stringify({
        type: "lossy-udp-nack",
        nack: [1],
        teaching: {
          type: "nack",
          missingSeqs: [1],
          cause: "unknown",
          why: "sequence 1 did not arrive",
          howToFix: "increase the receive window",
        },
      }),
      "sender",
    );
    await settle();
    const afterValid = bnn.states.get("transport")?.obsCount ?? 0;
    expect(afterValid).toBe(1);

    // NOW the reject path. Each of these is a shape the guard must refuse; `null` is the
    // interesting one, since `typeof null === "object"` exercises the guard's SECOND clause.
    for (const teaching of ["not-an-object", 42, null, true]) {
      receive(JSON.stringify({ type: "lossy-udp-nack", nack: [1], teaching }), "sender");
    }
    await settle();

    // The NACK path ran four more times and NOTHING further was taught. Note what this does NOT
    // prove: with the bare catch downstream, this would also hold if the guard were removed
    // entirely. It pins the BEHAVIOUR, not the mechanism.
    expect(bnn.states.get("transport")?.obsCount ?? 0).toBe(afterValid);
  });

  // ── ULT-17..21: NACK amplification (workitem 081KZYP1S96087G0R002G8XQZP, BUGS.md P0) ──────
  //
  // MEASURED ON THE UNFIXED CODE, on this machine, before the fix landed:
  //
  //   seq=8        in=74B  out=527B        amp=7.1x        elapsed=0.7ms
  //   seq=64       in=74B  out=2483B       amp=33.6x       elapsed=0.1ms
  //   seq=65       in=74B  out=2518B       amp=34.0x       elapsed=0.0ms
  //   seq=5000000  in=74B  out=246666953B  amp=3333337.2x  elapsed=537.2ms
  //
  // The last row is the defect: a single unauthenticated packet turned into a 246 MB BROADCAST.
  // `header.seq` is `readUInt32BE`, so 4294967295 is reachable — 859x the probed value.
  //
  // What these tests do NOT claim: the fix does not make the module non-amplifying. The 33.6x
  // row is IN-WINDOW and still stands after the fix; bounding the gap bounds the reflector, it
  // does not remove it. ULT-19 pins that number so it cannot grow unnoticed.

  /** A receiver wired to count what it emits. Returns the harness, not a channel, because every
   *  assertion below is about the OUTBOUND side. */
  function makeProbe(): {
    deliver: (seq: number, opts?: { blockSeq?: number; blockPos?: number }) => number;
    outBytes: () => number;
    broadcasts: () => string[];
    desyncs: () => DesyncEvent[];
  } {
    let receive: (text: string, from: string) => void = () => {};
    const sent: string[] = [];
    const desyncs: DesyncEvent[] = [];
    const transport = {
      broadcast: (text: string) => {
        sent.push(text);
      },
      onMessage: (handler: (text: string, from: string) => void) => {
        receive = handler;
      },
    };
    const channel = new LossyUdpChannel(transport, "receiver");
    channel.onDesync((e) => desyncs.push(e));
    return {
      // Returns the INBOUND byte count, so the caller can compute a real amplification ratio.
      deliver: (seq, opts = {}) => {
        const pkt = encodePacket(
          {
            seq,
            blockSeq: opts.blockSeq ?? 0,
            blockPos: opts.blockPos ?? 0,
            isData: true,
            payloadLen: 4,
          },
          new Uint8Array([1, 2, 3, 4]),
        );
        const wire = JSON.stringify({ type: "lossy-udp", zid: "attacker", pkt: pkt.toString("base64") });
        receive(wire, "attacker");
        return Buffer.byteLength(wire, "utf8");
      },
      outBytes: () => sent.reduce((n, t) => n + Buffer.byteLength(t, "utf8"), 0),
      broadcasts: () => sent,
      desyncs: () => desyncs,
    };
  }

  /** Derived ceiling on one NACK envelope, NOT a chosen round number: the message carries at
   *  most `MAX_NACK_GAP` sequence numbers, and each appears three times — once in `nack`, once
   *  in `teaching.missingSeqs`, and once inside a `received:seq=N:zid=Z` belief id. A u32 seq is
   *  ≤ 10 digits and this test's zid is 8 chars, so one seq costs < 64 bytes; 64 * 64 = 4 KiB,
   *  plus a fixed envelope. 8 KiB is that with slack, and it is ~30000x below the defect. */
  const NACK_ENVELOPE_CEILING_BYTES = 8 * 1024;

  it("ULT-17 (property): no single packet, at any u32 header value, provokes an unbounded reply", async () => {
    // The property the defect violated, stated over the whole input domain rather than at one
    // value — because the defect is "any sufficiently large u32", not one specific seq.
    // Seeded so a failure replays exactly (DST, manifesto §7).
    let sawANack = false;
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 0xffffffff }),
        fc.integer({ min: 0, max: 0xffffffff }),
        fc.integer({ min: 0, max: 0xff }),
        async (seq, blockSeq, blockPos) => {
          const probe = makeProbe();
          const inBytes = probe.deliver(seq, { blockSeq, blockPos });
          await Promise.resolve();

          expect(probe.outBytes()).toBeLessThanOrEqual(NACK_ENVELOPE_CEILING_BYTES);
          expect(probe.broadcasts().length).toBeLessThanOrEqual(1);
          for (const text of probe.broadcasts()) {
            const parsed = JSON.parse(text) as { nack?: number[]; teaching?: { missingSeqs?: number[] } };
            sawANack = true;
            // The tight invariant. The byte ceiling above is a consequence of this one.
            expect(parsed.nack?.length ?? 0).toBeLessThanOrEqual(MAX_NACK_GAP);
            expect(parsed.teaching?.missingSeqs?.length ?? 0).toBeLessThanOrEqual(MAX_NACK_GAP);
          }
          // Amplification is bounded by a constant, so it cannot scale with the claimed seq.
          expect(probe.outBytes() / inBytes).toBeLessThan(NACK_ENVELOPE_CEILING_BYTES / inBytes);
        },
      ),
      { numRuns: 300, seed: 0x5eed },
    );
    // ANTI-VACUITY: a channel that never NACKs would satisfy every assertion above. At least one
    // generated seq must have reached the NACK path for this property to mean anything.
    expect(sawANack).toBe(true);
  });

  it("ULT-18: the filed reproduction — seq=5e6 and seq=2^32-1 emit nothing and return promptly", () => {
    for (const seq of [5_000_000, 0xffffffff]) {
      const probe = makeProbe();
      const started = performance.now();
      probe.deliver(seq);
      const elapsed = performance.now() - started;

      expect(probe.outBytes()).toBe(0); // was 246,666,953 bytes at seq=5e6
      expect(probe.desyncs().length).toBe(1);
      // A smoke bound on the 537 ms of blocking work, not a benchmark: the fixed path allocates
      // nothing proportional to `seq`, so it completes in microseconds on any machine. Generous
      // enough not to be flaky, tight enough that a reintroduced O(seq) loop fails it.
      expect(elapsed).toBeLessThan(250);
    }
  });

  it("ULT-19: the bound is the retention window — at the boundary a full, untruncated NACK is sent", () => {
    // BOTH SIDES of the boundary, because a bound tested on one side is not tested.
    // At exactly MAX_NACK_GAP the receiver still holds the blocks, so it enumerates every
    // missing seq — no truncation, no partial list presented as a complete one.
    const atBound = makeProbe();
    const inBytes = atBound.deliver(MAX_NACK_GAP);
    expect(atBound.broadcasts().length).toBe(1);
    const parsed = JSON.parse(atBound.broadcasts()[0]!) as { nack: number[] };
    expect(parsed.nack.length).toBe(MAX_NACK_GAP);
    expect(parsed.nack).toEqual(Array.from({ length: MAX_NACK_GAP }, (_, i) => i)); // exact, complete
    expect(atBound.desyncs().length).toBe(0);

    // PINNED MEASUREMENT, not a derived bound: 33.6x was the in-window amplification measured on
    // the unfixed code at this same seq, and the fix does not change it. It is asserted so that
    // growth in the NACK envelope shows up as a failing test rather than as a bigger reflector.
    expect(atBound.outBytes() / inBytes).toBeLessThan(40);

    // One past the boundary: the receiver would be speaking about blocks it no longer holds.
    const pastBound = makeProbe();
    pastBound.deliver(MAX_NACK_GAP + 1);
    expect(pastBound.broadcasts().length).toBe(0);
    expect(pastBound.desyncs()).toEqual([
      { expectedSeq: 0, observedSeq: MAX_NACK_GAP + 1, gap: MAX_NACK_GAP + 1, maxNackGap: MAX_NACK_GAP },
    ]);
  });

  it("ULT-20: an in-window gap still reports every missing sequence — the signal is not degraded", () => {
    // The regression this fix could plausibly have caused. Ordinary loss must be reported
    // exactly as before: complete list, right values, right order.
    const probe = makeProbe();
    probe.deliver(0); // establish sync
    probe.deliver(5); // seqs 1,2,3,4 missing
    expect(probe.desyncs().length).toBe(0);
    const nacks = probe.broadcasts().map((t) => (JSON.parse(t) as { nack: number[] }).nack);
    expect(nacks).toEqual([[1, 2, 3, 4]]);
  });

  it("ULT-21 (§12 idempotency): replaying the oversized packet N times has the effect of once", () => {
    const probe = makeProbe();
    for (let i = 0; i < 5; i++) probe.deliver(1_000_000);
    // The first delivery resynchronises `expectedSeq`; the replays find no gap. Emitting nothing
    // five times is the same as emitting nothing once, and the local report fires once.
    expect(probe.outBytes()).toBe(0);
    expect(probe.desyncs().length).toBe(1);
  });

  // ── ULT-22..24: the erasure census (workitem 081KZYN3B79087G0R0014ZKE3C) ──────────────────
  //
  // The defect these exist to prevent recurring: `recoverAdinkraErasure` returned null at 2
  // erasures, so the transport used ONE of the THREE erasures its 50%-overhead code pays for.
  // It survived because the suite only ever erased one packet, and the one test that erased two
  // asserted the decoder's limit as though it were the code's.
  //
  // The standing falsifier is therefore EXHAUSTIVE and derived from the algebra: all 256 erasure
  // patterns, each checked against what the code itself permits — never against a remembered
  // number. It fails the moment the decoder is weaker (or stronger) than [8,4,4] actually is.

  /** The supports of all 16 codewords, ENUMERATED through the module's own parity function.
   *  `ADINKRA_G` is module-private, so this recovers the code's structure the only way a caller
   *  can — by feeding it messages. A hand-written table of the 14 weight-4 supports would be a
   *  second source of truth free to disagree with the generator. */
  function codewordSupports(): number[][] {
    const supports: number[][] = [];
    for (let m = 0; m < 16; m++) {
      // Message bit i selects the all-ones byte for data symbol i; GF(2) then acts bytewise, so
      // a symbol is 0xff exactly where the codeword bit is 1.
      const data = Array.from({ length: 4 }, (_, i) => Uint8Array.from([(m >> i) & 1 ? 0xff : 0x00]));
      const cw = [...data, ...computeAdinkraParity(data)];
      supports.push(cw.map((s, i) => (s[0] === 0xff ? i : -1)).filter((i) => i >= 0));
    }
    return supports;
  }

  it("ULT-22 (exhaustive): all 256 erasure patterns decode exactly when — and only when — the code allows", () => {
    const data = makeData(4, 61);
    const full = [...data, ...computeAdinkraParity(data)];

    // First establish the code's own structure, so the expectations below are DERIVED.
    const supports = codewordSupports();
    expect(supports.length).toBe(16);
    expect(supports.filter((s) => s.length === 0).length).toBe(1); // the zero codeword
    expect(supports.filter((s) => s.length === 8).length).toBe(1); // the all-ones codeword
    const weight4 = supports.filter((s) => s.length === 4);
    expect(weight4.length).toBe(14); // …and nothing between: minimum distance 4, hence d−1 = 3
    expect(supports.every((s) => s.length === 0 || s.length === 4 || s.length === 8)).toBe(true);
    const undecodable = new Set(weight4.map((s) => s.join(",")));

    const census = new Map<number, { recovered: number; total: number }>();
    for (let mask = 0; mask < 256; mask++) {
      const erased: number[] = [];
      for (let i = 0; i < 8; i++) if ((mask >> i) & 1) erased.push(i);
      const blk = full.map((s, i) => (erased.includes(i) ? null : s)) as (Uint8Array | null)[];
      const got = recoverAdinkraBlock(blk);

      // The verdict must agree with the algebra pattern-by-pattern, not just in aggregate:
      // any k ≤ 3 erasures are correctable (d−1 = 3); 4 are correctable unless the erased set
      // IS a codeword's support; 5+ leave more unknowns than there are checks.
      const shouldDecode = erased.length <= 3 || (erased.length === 4 && !undecodable.has(erased.join(",")));
      expect(got !== null).toBe(shouldDecode);
      if (got !== null) {
        // Byte-exact on ALL 8 positions — not merely non-null, and not only the erased ones.
        for (let i = 0; i < 8; i++) expect(Array.from(got[i]!)).toEqual(Array.from(full[i]!));
      }

      const tally = census.get(erased.length) ?? { recovered: 0, total: 0 };
      tally.total++;
      if (got !== null) tally.recovered++;
      census.set(erased.length, tally);
    }

    // The census, as one readable fact. Row k=3 is the defect's signature: it read 0 of 56.
    expect(
      [...census.entries()].sort((a, b) => a[0] - b[0]).map(([k, t]) => `${k}: ${t.recovered}/${t.total}`),
    ).toEqual([
      "0: 1/1",
      "1: 8/8",
      "2: 28/28",
      "3: 56/56", // ← was 0/56 before 081KZYN3B79087G0R0014ZKE3C
      "4: 56/70", // the 14 misses are exactly the weight-4 codeword supports, asserted above
      "5: 0/56",
      "6: 0/28",
      "7: 0/8",
      "8: 0/1",
    ]);
  });

  it("ULT-23 (property): any 3 losses, in any arrival order, still deliver the exact data", () => {
    // Through the RECEIVER STATE MACHINE, not the decoder alone — the defect lived at the seam
    // (`addToBlock` only attempted recovery at 7-of-8, so a decodable block was thrown away).
    // Arrival order is shuffled because a decoder that quietly depended on it would be a
    // `local-time-never-enters-the-shared-fold` violation. Seeded, so a failure replays (§7).
    fc.assert(
      fc.property(
        fc.uint8Array({ minLength: 32, maxLength: 32 }),
        fc.shuffledSubarray([0, 1, 2, 3, 4, 5, 6, 7], { minLength: 3, maxLength: 3 }),
        fc.shuffledSubarray([0, 1, 2, 3, 4, 5, 6, 7], { minLength: 8, maxLength: 8 }),
        (bytes, lost, arrivalOrder) => {
          const data = Array.from({ length: 4 }, (_, i) => bytes.slice(i * 8, i * 8 + 8));
          const sent = buildSenderBlock(0, data);
          const wire = [...sent.dataPackets, ...sent.parityPackets];
          const lostSet = new Set(lost);

          const recv = makeReceiverBlock(0);
          let delivered: Uint8Array[] | null = null;
          let deliveries = 0;
          for (const pos of arrivalOrder) {
            if (lostSet.has(pos)) continue;
            const got = addToBlock(recv, pos, wire[pos]!);
            if (got) {
              deliveries++;
              delivered ??= got;
            }
          }
          expect(delivered).not.toBeNull();
          for (let i = 0; i < 4; i++) expect(Array.from(delivered![i]!)).toEqual(Array.from(data[i]!));
          expect(deliveries).toBe(1); // §12: delivered once, however many packets follow
        },
      ),
      { numRuns: 500, seed: 0x5eed },
    );
  });

  it("ULT-24: an out-of-range blockPos is refused — it is a uint8 off an unauthenticated packet", () => {
    // `handleIncoming` passes `header.blockPos` straight through and the field is a `uint8`, so
    // 8..255 are values a peer can choose. Writing one of those into the 8-slot array would grow
    // it, and `recoverAdinkraBlock`'s length check would then refuse that block forever — a
    // peer-triggered denial of a block, for one packet.
    //
    // WHAT ACTUALLY STOPS IT — checked, having first got this wrong. I added an explicit
    // `Number.isInteger(pos) && pos < BLOCK_TOTAL` guard, and mutation testing could not
    // observe its removal. The reason is that `addToBlock`'s duplicate check already covers it:
    // `packets[9]` reads `undefined`, and `undefined !== null` is true, so it returns early.
    // The explicit guard was dead code and was removed. This test stays, because the surviving
    // protection is an incidental property of a STRICT `!==` and deserves a falsifier of its
    // own — `!=` would make every assertion below fail.
    const data = makeData(4, 5);
    const sent = buildSenderBlock(0, data);
    const wire = [...sent.dataPackets, ...sent.parityPackets];
    const recv = makeReceiverBlock(0);

    for (const pos of [8, 9, 255, -1, 1.5, Number.NaN]) {
      expect(addToBlock(recv, pos, wire[0]!)).toBeNull();
    }
    expect(recv.packets.length).toBe(8);
    expect(recv.receivedCount).toBe(0);

    // The block is undamaged: {0,1,3,5} is not a codeword support, so 4 arrivals still decode.
    let delivered: Uint8Array[] | null = null;
    for (const pos of [0, 1, 3, 5]) {
      const got = addToBlock(recv, pos, wire[pos]!);
      delivered ??= got;
    }
    expect(delivered).not.toBeNull();
    for (let i = 0; i < 4; i++) expect(Array.from(delivered![i]!)).toEqual(Array.from(data[i]!));
  });

  it("ULT-36: the receiver derives blockSeq/blockPos from seq — lying wire fields cannot re-address", async () => {
    // 081KZZZH24H. Honest senders set blockSeq=floor(seq/8), blockPos=seq%8. The wire
    // still carries both independently. Until this test, handleIncoming trusted the
    // wire fields, so a peer could hold seq monotone (no NACK) and write any slot of
    // any block.
    expect(blockAddressOf(0)).toEqual({ blockSeq: 0, blockPos: 0 });
    expect(blockAddressOf(7)).toEqual({ blockSeq: 0, blockPos: 7 });
    expect(blockAddressOf(8)).toEqual({ blockSeq: 1, blockPos: 0 });

    let receive: (text: string, from: string) => void = () => {};
    const delivered: Uint8Array[] = [];
    const transport = {
      broadcast: (_text: string) => {},
      onMessage: (h: (text: string, from: string) => void) => {
        receive = h;
      },
    };
    const ch = new LossyUdpChannel(transport, "receiver");
    ch.onData((p) => delivered.push(p));

    const data = makeData(4, 5);
    const sent = buildSenderBlock(0, data);
    const wire = [...sent.dataPackets, ...sent.parityPackets];
    // Every packet claims a DIFFERENT blockSeq and blockPos=0, while seq is the
    // honest 0..7. Unfixed, that is 8 one-slot blocks and no decode. Fixed, they
    // land in block 0 at the derived positions and deliver.
    for (let pos = 0; pos < 8; pos++) {
      const pkt = encodePacket(
        { seq: pos, blockSeq: 1000 + pos, blockPos: 0, isData: pos < 4, payloadLen: wire[pos]!.length },
        wire[pos]!,
      );
      receive(JSON.stringify({ type: "lossy-udp", zid: "liar", pkt: pkt.toString("base64") }), "liar");
    }
    await yieldTurns(8); // in turns, not milliseconds -- see the settle() note above
    expect(delivered.length).toBe(4);
    for (let i = 0; i < 4; i++) expect(Array.from(delivered[i]!)).toEqual(Array.from(data[i]!));
  });

  it("ULT-25: recovery is sized by the LONGEST surviving symbol, not by whichever arrived first", () => {
    // Found by mutating `len` from "max over present symbols" to "length of the first present
    // symbol" (which is what the pre-fix decoder used, via `block.find(...)`) — the whole suite
    // stayed green, because the sender pads every packet in a block to one length so no test
    // ever had a mixed-length block. `payloadLen` is a peer-controlled `uint32` header field,
    // so a short symbol IS reachable from the wire, and a recovery silently truncated to it
    // would hand the application a short payload with no error anywhere.
    const data = makeData(4, 71); // four 8-byte symbols
    const full = [...data, ...computeAdinkraParity(data)] as (Uint8Array | null)[];

    // Erase position 0, and truncate position 1 — so the FIRST surviving symbol is the short one.
    const blk = [...full];
    blk[0] = null;
    blk[1] = full[1]!.slice(0, 4);

    const got = recoverAdinkraBlock(blk);
    expect(got).not.toBeNull();
    // The recovered symbol keeps the block's full width. With "first present" it would be 4.
    expect(got![0]!.length).toBe(8);
    // The prefix is exact: every contribution to bytes 0..3 is present, truncation or not.
    expect(Array.from(got![0]!.subarray(0, 4))).toEqual(Array.from(data[0]!.subarray(0, 4)));
    // The tail is NOT claimed correct — the truncated symbol's missing bytes are absent from the
    // equations that determine it. Pinned as the honest boundary rather than asserted away: a
    // short symbol corrupts the tail, it does not shorten the output.
    expect(got![0]!.length).toBe(full[0]!.length);
  });

  it("ULT-26: the decoder's block-length precondition is a real check, not decoration", () => {
    // `recoverAdinkraBlock` is exported, so its "length must be 8" precondition is a contract
    // with callers it cannot see. Mutation testing found the check unobservable — every caller
    // in the repo passes 8 — which is exactly the state in which a precondition rots. A wrong
    // length is not a decodable block under ANY erasure pattern, so it must be refused rather
    // than silently indexed past the end of `ADINKRA_H`.
    const data = makeData(4, 13);
    const full = [...data, ...computeAdinkraParity(data)] as (Uint8Array | null)[];

    expect(recoverAdinkraBlock(full.slice(0, 7))).toBeNull(); // short
    expect(recoverAdinkraBlock([...full, full[0]!])).toBeNull(); // long
    expect(recoverAdinkraBlock([])).toBeNull();
    expect(recoverAdinkraErasure(full.slice(0, 7) as (Uint8Array | null)[])).toBeNull();

    // Anti-vacuity: the SAME symbols at the right length decode fine, so the nulls above are
    // the length check firing and not a decoder that refuses this data.
    const erased = [...full];
    erased[2] = null;
    erased[5] = null;
    expect(recoverAdinkraBlock(erased)).not.toBeNull();
  });
});

// ── ULT-27..31: the loss signal is typed (081KZYQ8KNB087G0R000G8QPRE, P1) ─────────────────
//
// The defect: `nackCount / sentCount` could not say WHAT KIND of loss it was, so a corruption
// erasure and a queue overflow produced the same number and the same multiplicative decrease.
// Measured cost with congestion held at zero by construction: 7.1x throughput at 2% corruption,
// 90x at 10% (`UBL-10`). These tests check the mechanism that replaced it.
describe("udp-lossy-transport: separated loss signals", () => {
  // ── ULT-27: a retraction reverses EXACTLY the decrease its own evidence caused ─────────
  it("ULT-27: retracting the loss that caused a backoff restores the gap, and is idempotent", () => {
    let state = makeAimdState(10);
    for (let i = 0; i < 30; i++) state = onSend(state);
    state = onLoss(state, { cause: "unknown", seqs: [100, 101] }); // 2/30 = 6.7% > 5%
    expect(state.gapMs).toBe(20);

    // Both sequence numbers turn up: the decision had no evidence left, so it is undone.
    const undone = retractLoss(state, [100, 101]);
    expect(undone.gapMs).toBe(10);
    // ...and the count is RE-ATTRIBUTED rather than deleted. Suppressed evidence that vanishes
    // is not honest; the reorder rate is a real measurement of the channel.
    expect(undone.lossByCause.reorder).toBe(2);

    // §12: applying the same retraction again has the effect of applying it once.
    const twice = retractLoss(undone, [100, 101]);
    expect(twice.gapMs).toBe(10);
    expect(twice.lossByCause.reorder).toBe(2);
    // ...and a retraction of numbers that were never reported does nothing at all.
    expect(retractLoss(undone, [7000, 7001]).gapMs).toBe(10);

    // A loss that was never CONGESTION-SUSPECT is not retractable either, and this is the
    // falsifier for the narrow condition in `onLoss` that decides what enters `suspectSeqs`.
    //
    // Found by mutation, and the first attempt at this assertion did NOT kill the mutant — it was
    // written against a 30-send window, where `updateAimd` clears `suspectSeqs` on the way out
    // and hides the difference. The reachable case is a report arriving with an EMPTY window,
    // which `updateAimd` returns from early without resetting — and that is not exotic here,
    // because the window is reset by every previous evaluation (081KZYN37T). Under the mutant
    // seq 5 enters `suspectSeqs` as a reorder and the retraction then credits `reorder` twice
    // for one packet.
    const reorderOnly = onLoss(makeAimdState(10), { cause: "reorder", seqs: [5] });
    expect(reorderOnly.lossByCause.reorder).toBe(1);
    expect(reorderOnly.suspectSeqs).toEqual([]);
    const afterNoop = retractLoss(reorderOnly, [5]);
    expect(afterNoop.lossByCause.reorder).toBe(1); // still 1, not 2
    expect(afterNoop).toBe(reorderOnly); // literally the same object: nothing to retract
  });

  // ── ULT-28: the NEGATIVE control — a decrease that survives its own recount stands ─────
  //
  // Without this, ULT-27 would be satisfied by "any retraction undoes any backoff", which is not
  // a recomputation, it is an undo button. The decision is re-evaluated on the evidence that
  // remains, and 3/30 = 10% is still above the 5% threshold.
  it("ULT-28 (negative): retracting one of four losses does NOT undo a backoff that still holds", () => {
    let state = makeAimdState(10);
    for (let i = 0; i < 30; i++) state = onSend(state);
    state = onLoss(state, { cause: "unknown", seqs: [200, 201, 202, 203] }); // 4/30 = 13.3%
    expect(state.gapMs).toBe(20);

    const partial = retractLoss(state, [200]);
    expect(partial.gapMs).toBe(20); // 3/30 = 10% > 5% — the decision stands
    expect(partial.lossByCause.reorder).toBe(1);

    // Retract two more and it falls to 1/30 = 3.3%, below the threshold: NOW it is reversed.
    const enough = retractLoss(partial, [201, 202]);
    expect(enough.gapMs).toBe(10);
  });

  // ── ULT-29: the compact NACK codec carries the cause, and refuses one it does not know ──
  it("ULT-29: encodeNack/decodeNack round-trip the cause; an unknown cause byte is refused", () => {
    for (const cause of ["congestion", "corruption", "reorder", "unknown"] as const) {
      const msg: NackMessage = {
        type: "nack",
        missingSeqs: [1, 2, 4294967295],
        cause,
        why: "test",
        howToFix: "test",
      };
      const decoded = decodeNack(encodeNack(msg));
      expect(decoded).not.toBeNull();
      expect(decoded!.cause).toBe(cause);
      expect(decoded!.missingSeqs).toEqual([1, 2, 4294967295]);
    }

    // The cause byte is peer-controlled. An index outside the declared set must not decode as
    // some default — inventing a cause at the parser is the circular inference this fix removed,
    // re-entering by the back door.
    const buf = encodeNack({ type: "nack", missingSeqs: [9], cause: "unknown", why: "", howToFix: "" });
    for (const bogus of [4, 5, 127, 255]) {
      const tampered = Buffer.from(buf);
      tampered.writeUInt8(bogus, 4);
      expect(decodeNack(tampered)).toBeNull();
    }
    // Anti-vacuity: the untampered buffer still decodes, so the nulls above are the cause check.
    expect(decodeNack(buf)).not.toBeNull();
    // Short buffers are still refused (the header grew from 4 bytes to 5).
    expect(decodeNack(Buffer.alloc(4))).toBeNull();
  });

  // ── ULT-30: end to end — the channel reports `unknown`, then RETRACTS as `reorder` ─────
  it("ULT-30: a gap is reported unknown; when the packet arrives the receiver retracts it", async () => {
    let receive: (text: string, from: string) => void = () => {};
    const sent: string[] = [];
    const transport = {
      broadcast: (text: string) => {
        sent.push(text);
      },
      onMessage: (h: (text: string, from: string) => void) => {
        receive = h;
      },
    };
    const ch = new LossyUdpChannel(transport, "receiver");
    const reordered: number[] = [];
    ch.onReorder((seqs) => reordered.push(...seqs));

    const wire = (seq: number): string => {
      const pkt = encodePacket(
        { seq, blockSeq: Math.floor(seq / 8), blockPos: seq % 8, isData: seq % 8 < 4, payloadLen: 2 },
        new Uint8Array([seq & 0xff, 1]),
      );
      return JSON.stringify({ type: "lossy-udp", zid: "sender", pkt: pkt.toString("base64") });
    };
    const nacksSoFar = (): Array<{ nack: number[]; teaching: { cause: string; why: string } }> =>
      sent.map((t) => JSON.parse(t) as Record<string, unknown>).filter((e) => e["type"] === "lossy-udp-nack") as never;
    // SETTLE, IN TURNS RATHER THAN MILLISECONDS. Everything this waits on is in-memory: the
    // receiver's message handler and the promise chain it kicks off. A macrotask turn is a turn
    // on any machine, so `yieldTurns` drains that chain identically on an idle laptop and a
    // contended runner -- where the 10ms sleep it replaces was a bet on how fast the runner was.
    // MEASURED: one turn is enough for every settle site in this file (51 pass at yieldTurns(1)),
    // so eight is 8x headroom in a unit that does not shrink under load. It costs microseconds:
    // each turn is a ZERO-delay timer, which is the whole point.
    const settle = (): Promise<unknown> => yieldTurns(8);

    receive(wire(0), "sender");
    receive(wire(3), "sender"); // gap: 1 and 2 are missing
    await settle();

    expect(nacksSoFar().length).toBe(1);
    expect(nacksSoFar()[0]!.nack).toEqual([1, 2]);
    // NOT "congestion", NOT "timeout": at this instant the receiver can evidence nothing.
    expect(nacksSoFar()[0]!.teaching.cause).toBe("unknown");
    expect(nacksSoFar()[0]!.teaching.why).toContain("NOT attributable");

    // Now seq 1 turns up late. It was never lost, so the report is withdrawn.
    receive(wire(1), "sender");
    await settle();
    expect(nacksSoFar().length).toBe(2);
    expect(nacksSoFar()[1]!.teaching.cause).toBe("reorder");
    expect(nacksSoFar()[1]!.nack).toEqual([1]);
    expect(reordered).toEqual([1]);

    // §12: a duplicate of the same late packet retracts nothing further.
    receive(wire(1), "sender");
    await settle();
    expect(nacksSoFar().length).toBe(2);
    expect(reordered).toEqual([1]);

    // Anti-vacuity: seq 2 never arrived, so it stays reported-missing and is never retracted.
    expect(reordered).not.toContain(2);
  });

  // ── ULT-32: end to end — a corrupt frame is refused, surfaced, and RE-ATTRIBUTED ────────
  //
  // The channel-level companion to UCH-21 (081KZYP1X3B087G0R001EZ37PQ). Three properties, and the
  // third is the one that changes a control decision:
  //
  //   1. the corrupt frame delivers NOTHING — it never reaches `addToBlock`;
  //   2. `onCorruption` fires with LOCAL evidence — this receiver ran the check;
  //   3. the next gap emits TWO reports: the `unknown` the receiver always owed, and a
  //      `corruption` re-attribution withdrawing the part it can now account for.
  //
  // Why two messages rather than one NACK with a mixed cause: a report is a claim about a set of
  // sequence numbers, and the receiver genuinely does not know WHICH of them the corrupt frame
  // was — only how many. Splitting is what keeps the count a measurement and the assignment an
  // admitted convention.
  it("ULT-32: a corrupt frame delivers nothing, surfaces evidence, and re-attributes the next gap", async () => {
    let receive: (text: string, from: string) => void = () => {};
    const sent: string[] = [];
    const transport = {
      broadcast: (text: string) => {
        sent.push(text);
      },
      onMessage: (h: (text: string, from: string) => void) => {
        receive = h;
      },
    };
    const ch = new LossyUdpChannel(transport, "receiver");
    const corruptions: string[] = [];
    ch.onCorruption((e) => corruptions.push(e.source));
    const delivered: number[] = [];
    ch.onData((p) => delivered.push(p[0]!));

    const frame = (seq: number): Buffer =>
      encodePacket(
        { seq, blockSeq: Math.floor(seq / 8), blockPos: seq % 8, isData: seq % 8 < 4, payloadLen: 2 },
        new Uint8Array([seq & 0xff, 1]),
      );
    const send = (buf: Buffer): void => {
      receive(JSON.stringify({ type: "lossy-udp", zid: "sender", pkt: buf.toString("base64") }), "sender");
    };
    const nacks = (): Array<{ nack: number[]; teaching: { cause: string; why: string } }> =>
      sent.map((t) => JSON.parse(t) as Record<string, unknown>).filter((e) => e["type"] === "lossy-udp-nack") as never;
    // SETTLE, IN TURNS RATHER THAN MILLISECONDS. Everything this waits on is in-memory: the
    // receiver's message handler and the promise chain it kicks off. A macrotask turn is a turn
    // on any machine, so `yieldTurns` drains that chain identically on an idle laptop and a
    // contended runner -- where the 10ms sleep it replaces was a bet on how fast the runner was.
    // MEASURED: one turn is enough for every settle site in this file (51 pass at yieldTurns(1)),
    // so eight is 8x headroom in a unit that does not shrink under load. It costs microseconds:
    // each turn is a ZERO-delay timer, which is the whole point.
    const settle = (): Promise<unknown> => yieldTurns(8);

    send(frame(0));
    await settle();
    expect(corruptions.length).toBe(0); // control: a good frame mints nothing

    // seq 1 arrives with one bit of its PAYLOAD flipped.
    const bad = Buffer.from(frame(1));
    bad[PACKET_HEADER_BYTES] = bad[PACKET_HEADER_BYTES]! ^ 0x01;
    send(bad);
    await settle();

    // (1) refused — and note `expectedSeq` did NOT advance, so seq 1 is still owed.
    // (2) surfaced, with local evidence naming what the check saw.
    expect(corruptions.length).toBe(1);
    expect(corruptions[0]).toContain("crc32c mismatch");
    // Nothing was broadcast in response to it: a rejected frame is not a wire event.
    expect(nacks().length).toBe(0);

    // seq 2 arrives cleanly and reveals the gap at 1.
    send(frame(2));
    await settle();

    // (3) TWO reports: the honest `unknown`, then the withdrawal of the part now accounted for.
    expect(nacks().length).toBe(2);
    expect(nacks()[0]!.teaching.cause).toBe("unknown");
    expect(nacks()[0]!.nack).toEqual([1]);
    expect(nacks()[1]!.teaching.cause).toBe("corruption");
    expect(nacks()[1]!.nack).toEqual([1]);
    expect(nacks()[1]!.teaching.why).toContain("only the COUNT is a measurement");

    // The pending count was SPENT, so a second gap does not re-claim the same corrupt frame.
    send(frame(4)); // gap at 3
    await settle();
    expect(nacks().length).toBe(3);
    expect(nacks()[2]!.teaching.cause).toBe("unknown");

    // ANTI-VACUITY: good frames still deliver. Without this every assertion above would hold on
    // a channel that dropped everything.
    expect(delivered.length).toBe(0); // block 0 is still incomplete — 1 is genuinely gone
    for (const s of [3, 5, 6, 7]) send(frame(s));
    await settle();
    expect(delivered.length).toBeGreaterThan(0);
  });

  // ── ULT-33: a wire-borne corruption report is a RETRACTION, and mints no evidence ───────
  //
  // The sender never held the bytes, so it never ran a check, so it has no `CorruptionEvidence`
  // and must not be handed one. `retractLoss(state, seqs, "corruption")` is the honest shape: the
  // reporter is withdrawing its OWN earlier congestion-suspect claim, and the decision is
  // RECOMPUTED without it rather than inverted.
  it("ULT-33: a corruption report withdraws the backoff it caused, recomputing rather than inverting", () => {
    let state = makeAimdState(10);
    for (let i = 0; i < 10; i++) state = onSend(state);
    state = onLoss(state, { cause: "unknown", seqs: [1, 2] }); // 2/10 = 20% → multiplicative decrease
    expect(state.gapMs).toBe(20);

    // Both were corrupt frames the receiver rejected. Without them the decrease would not have
    // fired (0/10 = 0% ≤ 5%), so it is undone exactly.
    const after = retractLoss(state, [1, 2], "corruption");
    expect(after.gapMs).toBe(10);
    expect(after.lossByCause.corruption).toBe(2);
    expect(after.lossByCause.reorder).toBe(0); // NOT re-attributed to the wrong cause
    expect(congestionSuspectRate(after)).toBe(0);

    // RECOMPUTED, not inverted: with enough OTHER unattributed loss the decrease still stands.
    let heavy = makeAimdState(10);
    for (let i = 0; i < 10; i++) heavy = onSend(heavy);
    heavy = onLoss(heavy, { cause: "unknown", seqs: [1, 2, 3] }); // 3/10 = 30%
    expect(heavy.gapMs).toBe(20);
    const partial = retractLoss(heavy, [1], "corruption");
    expect(partial.gapMs).toBe(20); // 2/10 = 20% > 5% — still justified
    expect(partial.lossByCause.corruption).toBe(1);

    // §12: retracting the same sequence twice is the SAME object, not an equal copy.
    expect(retractLoss(after, [1, 2], "corruption")).toBe(after);
  });

  // ── ULT-34: more rejections than the gap they are spent against ────────────────────────
  //
  // FOUND BY MUTATING THE FIX, and it is the reason to do that rather than to trust a green
  // suite. `Math.min(this.pendingCorruptFrames, missing.length)` is the bound on the only
  // adversarial lever this change opens — a peer spraying deliberately bad frames can RE-LABEL
  // losses the receiver independently observed, never manufacture them. Replacing that `min`
  // with the bare `pendingCorruptFrames` left ALL 75 tests across the three suites green.
  //
  // The reason it was invisible is worth recording, because it is a property of the instruments
  // and not of the assertions: the clamp only bites when MORE frames were rejected than the next
  // gap is wide, and neither sweep can produce that. The chaos harness does not drive the channel
  // class at all, and the BDP sweep runs `meanBurstLength = 1`, whose Gilbert-Elliott chain
  // FORBIDS consecutive corruptions (081KZYY6SVJ087G0R0035SW945, filed, unfixed). The one
  // configuration that exercises the bound is the one the instrument cannot generate — so the
  // case is constructed directly here instead of hoped for from a sweep.
  //
  // Note the NACK CONTENTS are identical either way: `missing.slice(0, 2)` on a one-element list
  // is a one-element list. The divergence is in the RESIDUE — unclamped, the counter goes
  // NEGATIVE and silently swallows a later, genuine attribution.
  it("ULT-34: two rejections against a one-packet gap clamp to one, and the second is still owed", async () => {
    let receive: (text: string, from: string) => void = () => {};
    const sent: string[] = [];
    const transport = {
      broadcast: (text: string) => {
        sent.push(text);
      },
      onMessage: (h: (text: string, from: string) => void) => {
        receive = h;
      },
    };
    const ch = new LossyUdpChannel(transport, "receiver");
    const corruptions: string[] = [];
    ch.onCorruption((e) => corruptions.push(e.source));

    const frame = (seq: number): Buffer =>
      encodePacket(
        { seq, blockSeq: Math.floor(seq / 8), blockPos: seq % 8, isData: seq % 8 < 4, payloadLen: 2 },
        new Uint8Array([seq & 0xff, 1]),
      );
    const corruptFrame = (seq: number): Buffer => {
      const b = Buffer.from(frame(seq));
      b[PACKET_HEADER_BYTES] = b[PACKET_HEADER_BYTES]! ^ 0x01;
      return b;
    };
    const send = (buf: Buffer): void => {
      receive(JSON.stringify({ type: "lossy-udp", zid: "sender", pkt: buf.toString("base64") }), "sender");
    };
    const causes = (): string[] =>
      sent
        .map((t) => JSON.parse(t) as { type?: string; teaching?: { cause?: string } })
        .filter((e) => e.type === "lossy-udp-nack")
        .map((e) => e.teaching?.cause ?? "");
    // SETTLE, IN TURNS RATHER THAN MILLISECONDS. Everything this waits on is in-memory: the
    // receiver's message handler and the promise chain it kicks off. A macrotask turn is a turn
    // on any machine, so `yieldTurns` drains that chain identically on an idle laptop and a
    // contended runner -- where the 10ms sleep it replaces was a bet on how fast the runner was.
    // MEASURED: one turn is enough for every settle site in this file (51 pass at yieldTurns(1)),
    // so eight is 8x headroom in a unit that does not shrink under load. It costs microseconds:
    // each turn is a ZERO-delay timer, which is the whole point.
    const settle = (): Promise<unknown> => yieldTurns(8);

    send(frame(0)); // expectedSeq -> 1
    send(corruptFrame(1)); // refused; expectedSeq stays 1
    send(corruptFrame(2)); // refused; expectedSeq stays 1
    await settle();
    expect(corruptions.length).toBe(2); // TWO rejections pending
    expect(causes().length).toBe(0); // and no wire traffic yet — a rejection is not an event

    // A gap of exactly ONE. Two rejections are pending, so the clamp must fire.
    send(frame(2)); // gap = [1], one sequence number
    await settle();
    expect(causes()).toEqual(["unknown", "corruption"]);

    // THE ASSERTION THE MUTANT FAILS. One rejection is still owed, so the NEXT gap gets an
    // attribution too. Unclamped, the counter went to -1 above and this second one vanishes.
    send(frame(4)); // gap = [3]
    await settle();
    expect(causes()).toEqual(["unknown", "corruption", "unknown", "corruption"]);

    // ...and now the credit really is exhausted: a third gap is `unknown` and stays that way.
    send(frame(6)); // gap = [5]
    await settle();
    expect(causes()).toEqual(["unknown", "corruption", "unknown", "corruption", "unknown"]);
  });

  // ── ULT-35: pending corruption does not survive a desync (081KZZYESKA) ────────
  //
  // A CRC-failed frame increments `pendingCorruptFrames` without advancing
  // `expectedSeq`. A later gap > MAX_NACK_GAP takes the desync branch, which
  // used to leave that count standing. The NEXT in-window gap then spent it
  // against a different region of sequence space — re-labelling as
  // `corruption` losses the receiver never checksummed. The desync branch
  // already argues it cannot evidence anything past the window; the count
  // is the same class of claim.
  it("ULT-35: a desync clears pendingCorruptFrames so the next gap is not mis-attributed", async () => {
    let receive: (text: string, from: string) => void = () => {};
    const sent: string[] = [];
    const desyncs: DesyncEvent[] = [];
    const transport = {
      broadcast: (text: string) => {
        sent.push(text);
      },
      onMessage: (h: (text: string, from: string) => void) => {
        receive = h;
      },
    };
    const ch = new LossyUdpChannel(transport, "receiver");
    ch.onDesync((e) => desyncs.push(e));

    const frame = (seq: number): Buffer =>
      encodePacket(
        { seq, blockSeq: Math.floor(seq / 8), blockPos: seq % 8, isData: seq % 8 < 4, payloadLen: 2 },
        new Uint8Array([seq & 0xff, 1]),
      );
    const corruptFrame = (seq: number): Buffer => {
      const b = Buffer.from(frame(seq));
      b[PACKET_HEADER_BYTES] = b[PACKET_HEADER_BYTES]! ^ 0x01;
      return b;
    };
    const send = (buf: Buffer): void => {
      receive(JSON.stringify({ type: "lossy-udp", zid: "sender", pkt: buf.toString("base64") }), "sender");
    };
    const causes = (): string[] =>
      sent
        .map((t) => JSON.parse(t) as { type?: string; teaching?: { cause?: string } })
        .filter((e) => e.type === "lossy-udp-nack")
        .map((e) => e.teaching?.cause ?? "");
    // SETTLE, IN TURNS RATHER THAN MILLISECONDS. Everything this waits on is in-memory: the
    // receiver's message handler and the promise chain it kicks off. A macrotask turn is a turn
    // on any machine, so `yieldTurns` drains that chain identically on an idle laptop and a
    // contended runner -- where the 10ms sleep it replaces was a bet on how fast the runner was.
    // MEASURED: one turn is enough for every settle site in this file (51 pass at yieldTurns(1)),
    // so eight is 8x headroom in a unit that does not shrink under load. It costs microseconds:
    // each turn is a ZERO-delay timer, which is the whole point.
    const settle = (): Promise<unknown> => yieldTurns(8);

    send(frame(0));
    send(corruptFrame(1));
    send(corruptFrame(2));
    await settle();
    expect(causes()).toEqual([]);

    send(frame(MAX_NACK_GAP + 8));
    await settle();
    expect(desyncs.length).toBe(1);
    expect(causes()).toEqual([]);

    // Narrow gap after the desync. Unfixed, this would emit unknown+corruption
    // by spending the pre-desync rejections against [expected .. this seq).
    sent.length = 0;
    const after = desyncs[0]!.observedSeq + 3;
    send(frame(after));
    await settle();
    expect(causes()).toEqual(["unknown"]);
  });

  // ── ULT-31: the evidence brands, and the ASYMMETRY between them ────────────────────────
  //
  // PIN UPDATED 2026-08-14 (081KZYP1X3B087G0R001EZ37PQ), and the update IS the signal this test
  // was built to give. It used to assert that BOTH `congestion` and `corruption` were
  // unconstructible; it now asserts that exactly one of them still is.
  //
  // The old form said: this transport has no integrity check and no queue signal, so it cannot
  // perceive either cause, and a taxonomy whose cases can be filled in by assertion would be a
  // taxonomy that pretends. That was true, and the fix for the corruption half was never to relax
  // the assertion — it was to build the instrument. The CRC-32C trailer is that instrument, so
  // `CorruptionEvidence` is now minted, by exactly one function, with exactly one caller.
  //
  // `CongestionEvidence` is deliberately NOT promoted alongside it. There is still no timestamp,
  // no ECN bit and no receiver-side queue estimate, so a queue drop is still invisible here. A
  // change that quietly promoted both would be the pretending taxonomy arriving by the back door.
  it("ULT-31: corruption evidence is minted once and only once; congestion evidence still cannot exist", async () => {
    const src = await Bun.file(new URL("./udp-lossy-transport.ts", import.meta.url).pathname).text();
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(code.length).toBeGreaterThan(5000);

    // CONGESTION — unchanged. Type-only brand, never exported, never cast into being.
    expect(code).toContain("declare const CONGESTION_EVIDENCE: unique symbol");
    expect(code).not.toContain("export const CONGESTION_EVIDENCE");
    expect(code).not.toContain("as CongestionEvidence");
    // Nothing constructs the brand, so `LossSignal`'s `congestion` arm stays unreachable. Counted
    // rather than string-matched on `cause: "congestion"`, which also appears in the `LossSignal`
    // type alias — a check that cannot separate a type from a construction is not a check.
    // Two sites: the `declare const`, and the interface member that names it.
    expect((code.match(/CONGESTION_EVIDENCE/g) ?? []).length).toBe(2);

    // CORRUPTION — a REAL runtime symbol now, because a brand you cannot instantiate is a brand
    // whose case cannot be built. Still unexported, so it stays unforgeable outside this module.
    expect(code).toContain("const CORRUPTION_EVIDENCE: unique symbol = Symbol(");
    expect(code).not.toContain("export const CORRUPTION_EVIDENCE");
    // No cast smuggles one into existence — the mint is a real constructor, not an assertion.
    expect(code).not.toContain("as CorruptionEvidence");

    // THE LOAD-BEARING COUNT: one minting function, one caller, and the caller is the checksum
    // verification failure. A second caller is the moment this type stops meaning "a check ran
    // here and failed" and starts meaning "someone decided this was corruption".
    expect(code).not.toContain("export function mintCorruptionEvidence");
    const mintSites = code.match(/mintCorruptionEvidence/g) ?? [];
    expect(mintSites.length).toBe(2); // the declaration, and its single call site
    // ...and that single call site is inside the CRC-32C comparison, not anywhere else.
    expect(code).toMatch(/if \(claimed !== actual\)[\s\S]{0,220}mintCorruptionEvidence\(/);

    // The reachable causes ARE constructed, or the whole taxonomy would be decorative.
    expect(code).toContain('cause: "unknown"');
    expect(code).toContain('cause: "reorder"');
    expect(code).toContain('cause: "corruption"');
  });
});

// ── ULT-32..36: the receiver's block memory is BOUNDED (081KZYQJPNG087G0R002B9E9S1, P1) ────
//
// The defect: `recvBlocks` grew one `ReceiverBlock` per peer-chosen u32 `blockSeq`, forever,
// because eviction was lexically inside `if (recovered)` — the one branch a stream that never
// completes a block never reaches. Measured on the unfixed code: 200,000 packets (82 MB in)
// retained 200,000 blocks and 279,805,952 bytes of RSS, zero evicted.
//
// It is NOT an attack-only path. A block becomes recoverable at 4 of 8 symbols, so a block that
// never recovers is a block that lost 5+ — ordinary heavy loss, which is what this transport is
// for. The address is derived from `seq` (`blockAddressOf`, 081KZZZH24H), so a peer cannot
// mint a new key with a lying `blockSeq` — it has to spend a new sequence number. The remaining
// drain is many *incomplete* derived blocks (`seq = 8k`, position 0 only).
//
// These tests observe `retainedBlockCount`, which exists for exactly this reason: unbounded
// growth changes no delivered output, so before it there was nothing in the module a test could
// see. The RSS number itself lives in `udp-lossy-transport.retention-measure.ts` — process memory
// is too noisy to assert on inside a unit test, and asserting it there would be a benchmark
// pretending to be a falsifier.
describe("udp-lossy-transport: bounded receiver block memory", () => {
  function makeReceiver(): {
    channel: LossyUdpChannel;
    delivered: Uint8Array[];
    /** Deliver one raw packet with FULLY peer-chosen header fields — which is what the wire is. */
    raw: (seq: number, blockSeq: number, blockPos: number, payload: Uint8Array) => void;
    /** Deliver every packet of an honest Adinkra block, at honest `seq`s, minus `lost` positions. */
    honestBlock: (blockSeq: number, lost?: readonly number[]) => void;
    /** The 4 data payloads an honest block for `blockSeq` carries — the delivery expectation. */
    expectedPayloads: (blockSeq: number) => Uint8Array[];
  } {
    let receive: (text: string, from: string) => void = () => {};
    const delivered: Uint8Array[] = [];
    const channel = new LossyUdpChannel(
      {
        broadcast: () => {},
        onMessage: (h: (text: string, from: string) => void) => {
          receive = h;
        },
      },
      "receiver",
    );
    channel.onData((p) => delivered.push(p));

    const raw = (seq: number, blockSeq: number, blockPos: number, payload: Uint8Array): void => {
      const pkt = encodePacket({ seq, blockSeq, blockPos, isData: blockPos < 4, payloadLen: payload.length }, payload);
      receive(JSON.stringify({ type: "lossy-udp", zid: "peer", pkt: pkt.toString("base64") }), "peer");
    };
    // Distinct per block AND per position, so a delivery can be attributed to its own block.
    const dataFor = (blockSeq: number): Uint8Array[] =>
      Array.from({ length: 4 }, (_, i) => Uint8Array.from([blockSeq & 0xff, (blockSeq >> 8) & 0xff, i, 0x5a]));
    return {
      channel,
      delivered,
      raw,
      honestBlock: (blockSeq, lost = []) => {
        const sent = buildSenderBlock(blockSeq, dataFor(blockSeq));
        const wire = [...sent.dataPackets, ...sent.parityPackets];
        for (let pos = 0; pos < 8; pos++) {
          if (lost.includes(pos)) continue;
          raw(blockSeq * 8 + pos, blockSeq, pos, wire[pos]!);
        }
      },
      expectedPayloads: dataFor,
    };
  }

  it("ULT-32 (property): no stream of peer-chosen seq takes retention past the window", () => {
    // Stated over the whole u32 domain rather than at one value, because the defect was "any
    // sufficiently long stream of distinct keys", not one key. Seeded, so a failure replays (§7).
    // Address is derived from seq (ULT-36), so the generator is seqs, aligned to position 0
    // of each derived block — otherwise consecutive seqs complete blocks and the window
    // empties, which is a different measurement (and is what #10778 left these tests doing).
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 0, max: 0xffffffff }), { minLength: 64, maxLength: 256 }), (seqs) => {
        const r = makeReceiver();
        seqs.forEach((seq) => r.raw(seq - (seq % 8), 0, 0, new Uint8Array([7, 7, 7, 7])));
        expect(r.channel.retainedBlockCount).toBeLessThanOrEqual(RECV_BLOCK_WINDOW);
        // ANTI-VACUITY: a receiver that retained NOTHING would also pass the line above, and would
        // be a different, worse module. With ≥64 distinct-ish derived blocks and only pos 0,
        // the window must actually be full — the bound is being exercised, not merely satisfied.
        const distinctBlocks = new Set(seqs.map((s) => Math.floor(s / 8))).size;
        expect(r.channel.retainedBlockCount).toBe(Math.min(RECV_BLOCK_WINDOW, distinctBlocks));
      }),
      { numRuns: 200, seed: 0x5eed },
    );
  });

  it("ULT-33: the filed reproduction — 20,000 never-completing blocks retain 8", () => {
    // The defect's own shape at 1/10 scale (20k rather than 200k, to stay inside a test budget):
    // one packet at position 0 of each derived block, so nothing ever becomes recoverable.
    // `seq = 8i` is monotone so the NACK path is never entered and `recvBlocks` is the only
    // thing under measurement. Wire `blockSeq`/`blockPos` are ignored (ULT-36).
    const r = makeReceiver();
    for (let i = 0; i < 20_000; i++) r.raw(i * 8, 0, 0, new Uint8Array(64).fill(0xa5));
    expect(r.channel.retainedBlockCount).toBe(RECV_BLOCK_WINDOW); // was 20,000
    expect(r.delivered.length).toBe(0); // nothing was ever recoverable — anti-vacuity on the setup

    // §12 idempotency: replaying the same stream has the effect of running it once.
    for (let i = 0; i < 20_000; i++) r.raw(i * 8, 0, 0, new Uint8Array(64).fill(0xa5));
    expect(r.channel.retainedBlockCount).toBe(RECV_BLOCK_WINDOW);
  }, 30_000);

  it("ULT-34: eviction is by RECENCY — 8 packets at the top of u32 cannot park the window", () => {
    // The negative control that chose the policy, and it is a real fork rather than a preference:
    // evicting the LOWEST `blockSeq` bounds memory just as well and tracks the unbounded map more
    // closely under reordering — but it was measured to take honest delivery from 20/20 payloads to
    // 0/20, permanently, for 8 attacker packets, because every honest block sorts below the parked
    // keys and is evicted the instant it is created. Trading an unauthenticated memory drain for an
    // unauthenticated permanent shutdown is not a fix, and this test is what refuses it.
    //
    // Squatters are high *derived* blocks (seq near 2^32-1, stride 8) — a lying wire blockSeq
    // no longer parks a key (ULT-36). Consecutive seqs 0..7 would complete block 0 and leave
    // the window empty, which is what the unfixed test started measuring after #10778.
    const parked = makeReceiver();
    for (let i = 0; i < RECV_BLOCK_WINDOW; i++) parked.raw(0xffffffff - i * 8, 0, 0, new Uint8Array([7, 7, 7, 7]));
    expect(parked.channel.retainedBlockCount).toBe(RECV_BLOCK_WINDOW); // the window is full of squatters
    for (let b = 0; b < 5; b++) parked.honestBlock(b);
    expect(parked.delivered.length).toBe(20); // 5 blocks * 4 data payloads — was 0 under key order

    // Same traffic with no squatters: byte-identical delivery, so the assertion above is about the
    // parking and not about the honest path being weak.
    const clean = makeReceiver();
    for (let b = 0; b < 5; b++) clean.honestBlock(b);
    expect(parked.delivered.map((p) => Array.from(p))).toEqual(clean.delivered.map((p) => Array.from(p)));
  });

  it("ULT-35: a full window of concurrent, 3-erasure blocks all deliver — the cap does not clip its own size", () => {
    // BOTH SIDES of the boundary, as ULT-19 does for the NACK bound.
    // At exactly RECV_BLOCK_WINDOW concurrent open blocks, nothing is evicted and every block that
    // the [8,4,4] code can decode is decoded. Symbols are interleaved round-robin across all the
    // blocks, so every block is genuinely open at once — delivering them in sequence would leave
    // the cap untouched and make this test vacuous.
    const r = makeReceiver();
    const lost = [1, 4, 6]; // 3 erasures: within d−1, decodable by the code itself
    const sent = Array.from({ length: RECV_BLOCK_WINDOW }, (_, b) => ({
      blockSeq: b,
      wire: (() => {
        const s = buildSenderBlock(b, r.expectedPayloads(b));
        return [...s.dataPackets, ...s.parityPackets];
      })(),
    }));
    for (let pos = 0; pos < 8; pos++) {
      if (lost.includes(pos)) continue;
      for (const blk of sent) r.raw(blk.blockSeq * 8 + pos, blk.blockSeq, pos, blk.wire[pos]!);
    }
    expect(r.channel.retainedBlockCount).toBe(RECV_BLOCK_WINDOW);
    expect(r.delivered.length).toBe(RECV_BLOCK_WINDOW * 4);
    for (let b = 0; b < RECV_BLOCK_WINDOW; b++) {
      const mine = r.delivered.filter((p) => p[0] === (b & 0xff) && p[1] === ((b >> 8) & 0xff));
      expect(mine.map((p) => Array.from(p))).toEqual(r.expectedPayloads(b).map((p) => Array.from(p)));
    }
  });

  it("ULT-36: one block past the window collapses to ZERO delivery — the priced worst case", () => {
    // The other side of the boundary, and the number is exact rather than "less than": at
    // RECV_BLOCK_WINDOW + 1 blocks open in a perfectly uniform round-robin, delivery is 0. Not
    // degraded — zero, even with no channel loss at all.
    //
    // This is the textbook worst case of the chosen policy rather than a surprise: a cyclic access
    // pattern one larger than the cache evicts every entry exactly before its next use, which is
    // the classical LRU pathology (Belady 1966; it is why Belady's OPT and LRU diverge maximally
    // here). Every bounded policy has some such pattern — a hard cap must drop something, and a
    // uniform cycle makes every choice the wrong one. What is pinned here is that the cliff sits
    // one block past the declared window and is TOTAL, so nobody reads "bounded at 8" as "degrades
    // gently at 9". Widening RECV_BLOCK_WINDOW moves this cliff; it does not remove it.
    //
    // Measured against the ordinary path for scale: under a seeded reorder model rather than a
    // uniform stride, this same policy delivers 1600/1600 through a reorder depth of 32 packets —
    // identical to the unbounded map it replaces. The stride below is the adversarial shape.
    const r = makeReceiver();
    const open = RECV_BLOCK_WINDOW + 1;
    const sent = Array.from({ length: open }, (_, b) => {
      const s = buildSenderBlock(b, r.expectedPayloads(b));
      return { blockSeq: b, wire: [...s.dataPackets, ...s.parityPackets] };
    });
    for (let pos = 0; pos < 8; pos++) {
      for (const blk of sent) r.raw(blk.blockSeq * 8 + pos, blk.blockSeq, pos, blk.wire[pos]!);
    }
    expect(r.channel.retainedBlockCount).toBe(RECV_BLOCK_WINDOW);
    expect(r.delivered.length).toBe(0);

    // ANTI-VACUITY / the control: the SAME traffic, one block fewer, delivers everything. Without
    // this line the assertion above would be satisfied by a receiver that delivers nothing ever.
    const atWindow = makeReceiver();
    const fits = Array.from({ length: RECV_BLOCK_WINDOW }, (_, b) => {
      const s = buildSenderBlock(b, atWindow.expectedPayloads(b));
      return { blockSeq: b, wire: [...s.dataPackets, ...s.parityPackets] };
    });
    for (let pos = 0; pos < 8; pos++) {
      for (const blk of fits) atWindow.raw(blk.blockSeq * 8 + pos, blk.blockSeq, pos, blk.wire[pos]!);
    }
    expect(atWindow.delivered.length).toBe(RECV_BLOCK_WINDOW * 4);
  });

  it("ULT-37: a block that is still RECEIVING outlives an idle one — recency, not creation age", () => {
    // This exists because mutation testing found the recency half unobservable. Removing the
    // move-to-tail turns the policy into FIFO on creation age, and every other test in this file
    // stayed green — so the line that makes it LRU was, until this test, decoration.
    //
    // The discriminator: fill the window, then TOUCH the oldest block, then force one eviction.
    // Under LRU the victim is the untouched block 1; under FIFO it is block 0, which is the one
    // actively receiving. Whichever survived is then completed, and delivery says which it was.
    const r = makeReceiver();
    const sent = Array.from({ length: RECV_BLOCK_WINDOW + 1 }, (_, b) => {
      const s = buildSenderBlock(b, r.expectedPayloads(b));
      return [...s.dataPackets, ...s.parityPackets];
    });

    // Fill the window: blocks 0..7, one symbol each. Nothing is evicted yet.
    for (let b = 0; b < RECV_BLOCK_WINDOW; b++) r.raw(b * 8, b, 0, sent[b]![0]!);
    expect(r.channel.retainedBlockCount).toBe(RECV_BLOCK_WINDOW);

    // Touch block 0 — it is now the most-recently-used, and the least-recently-used is block 1.
    r.raw(1, 0, 1, sent[0]![1]!);
    expect(r.delivered.length).toBe(0); // 2 of 4 data symbols: not yet decodable, anti-vacuity

    // Open a 9th block. Exactly one eviction happens; the policy chooses whom.
    r.raw(RECV_BLOCK_WINDOW * 8, RECV_BLOCK_WINDOW, 0, sent[RECV_BLOCK_WINDOW]![0]!);
    expect(r.channel.retainedBlockCount).toBe(RECV_BLOCK_WINDOW);

    // Complete block 0's data. It kept its first two symbols iff it was NOT the victim.
    r.raw(2, 0, 2, sent[0]![2]!);
    r.raw(3, 0, 3, sent[0]![3]!);
    expect(r.delivered.map((p) => Array.from(p))).toEqual(r.expectedPayloads(0).map((p) => Array.from(p)));

    // The negative control, and it is what makes the assertion above about RECENCY rather than
    // about block 0 being special: with the touch omitted, block 0 IS the least-recently-used, is
    // evicted by the 9th block, and the identical completion sequence delivers nothing.
    const untouched = makeReceiver();
    for (let b = 0; b < RECV_BLOCK_WINDOW; b++) untouched.raw(b * 8, b, 0, sent[b]![0]!);
    untouched.raw(RECV_BLOCK_WINDOW * 8, RECV_BLOCK_WINDOW, 0, sent[RECV_BLOCK_WINDOW]![0]!);
    untouched.raw(1, 0, 1, sent[0]![1]!);
    untouched.raw(2, 0, 2, sent[0]![2]!);
    untouched.raw(3, 0, 3, sent[0]![3]!);
    expect(untouched.delivered.length).toBe(0);
  });
});

// ── ULT-38..43: the delivered-once guard OUTLIVES the block (081KZZZGYBR087G0R00302Z2J6, §12) ──
//
// The defect: `ReceiverBlock.recovered` is the §12 duplicate guard and it lives ON the block, so
// evicting an already-delivered block threw the guard away with it. A straggler then created a
// FRESH block with `recovered = false`, the [8,4,4] decoder solved it a second time, and `onData`
// fired again for the same four payloads.
//
// It is not an attack path and it is not a regression to be embarrassed about. The unbounded map
// hit it too (at reorder depth 128); bounding the map to 8 entries in 081KZYQJPNG087G0R002B9E9S1
// necessarily evicts blocks the unbounded map remembered forever, so the SAME cost moved out of
// memory and onto the guard. Measured on the seeded reorder sweep, 400 blocks / 1600 payloads,
// 0% channel loss: at depth 64, 1672 delivered against 1560 distinct — 112 duplicate payloads
// across 28 blocks. Zero at depth <= 32, which is why the ordinary path never showed it.
//
// The fix is a SEPARATE bounded structure, because the two bounds answer different questions: a
// retained block is 8 payload references, a delivered-block identifier is one integer, so the
// cheaper item earns the wider window (`DELIVERED_BLOCK_CAP = 2 * RECV_BLOCK_WINDOW`, the same
// construction `SUSPECT_SEQ_CAP = 2 * MAX_NACK_GAP` already uses one level down).
describe("udp-lossy-transport: the delivered-once guard outlives the block", () => {
  function makeReceiver(): {
    channel: LossyUdpChannel;
    delivered: Uint8Array[];
    raw: (seq: number, blockSeq: number, blockPos: number, payload: Uint8Array) => void;
    /** Emit an honest block's chosen positions, with `seq` and `blockSeq` separately controllable —
     *  which is what the wire is, and what makes the key-choice test below expressible at all. */
    emit: (opts: { blockSeq: number; seqBase?: number; positions?: readonly number[]; payloadsOf?: number }) => void;
    expectedPayloads: (blockSeq: number) => Uint8Array[];
  } {
    let receive: (text: string, from: string) => void = () => {};
    const delivered: Uint8Array[] = [];
    const channel = new LossyUdpChannel(
      {
        broadcast: () => {},
        onMessage: (h: (text: string, from: string) => void) => {
          receive = h;
        },
      },
      "receiver",
    );
    channel.onData((p) => delivered.push(p));
    const raw = (seq: number, blockSeq: number, blockPos: number, payload: Uint8Array): void => {
      const pkt = encodePacket({ seq, blockSeq, blockPos, isData: blockPos < 4, payloadLen: payload.length }, payload);
      receive(JSON.stringify({ type: "lossy-udp", zid: "peer", pkt: pkt.toString("base64") }), "peer");
    };
    const dataFor = (blockSeq: number): Uint8Array[] =>
      Array.from({ length: 4 }, (_, i) => Uint8Array.from([blockSeq & 0xff, (blockSeq >> 8) & 0xff, i, 0x5a]));
    return {
      channel,
      delivered,
      raw,
      emit: ({ blockSeq, seqBase, positions = [0, 1, 2, 3], payloadsOf }) => {
        const s = buildSenderBlock(blockSeq, dataFor(payloadsOf ?? blockSeq));
        const wire = [...s.dataPackets, ...s.parityPackets];
        const base = seqBase ?? blockSeq * 8;
        for (const pos of positions) raw(base + pos, blockSeq, pos, wire[pos]!);
      },
      expectedPayloads: dataFor,
    };
  }

  /** Push `count` distinct blocks through the RECEIVER BLOCK window without delivering any of
   *  them, which is what evicts an already-delivered block from `recvBlocks`. One symbol each at
   *  `blockPos = 0` is never recoverable, so nothing here can be mistaken for a delivery. */
  function openBlocks(r: ReturnType<typeof makeReceiver>, from: number, count: number): void {
    for (let i = 0; i < count; i++) r.raw((from + i) * 8, from + i, 0, new Uint8Array([7, 7, 7, 7]));
  }

  it("ULT-38: the filed reproduction — a delivered block, evicted, then replayed, delivers ONCE", () => {
    const r = makeReceiver();
    r.emit({ blockSeq: 0 });
    expect(r.delivered.length).toBe(4);
    expect(r.channel.deliveredGuardCount).toBe(1);

    // Force block 0 out of `recvBlocks` — this is the eviction that used to take the guard with it.
    openBlocks(r, 100, RECV_BLOCK_WINDOW + 1);
    expect(r.channel.retainedBlockCount).toBe(RECV_BLOCK_WINDOW);

    // The straggler. Before the guard this re-created block 0 and delivered its payloads a second
    // time; the assertion below was `8`.
    r.emit({ blockSeq: 0 });
    expect(r.delivered.length).toBe(4);
    expect(r.delivered.map((p) => Array.from(p))).toEqual(r.expectedPayloads(0).map((p) => Array.from(p)));

    // ANTI-VACUITY, and it is the load-bearing half: the guard must refuse a REPEAT, not refuse
    // everything old. A block that was never delivered still delivers on exactly the same path,
    // at a `seq` well behind `expectedSeq`. A receiver that had simply stopped accepting late
    // packets would pass every assertion above and fail this one.
    r.emit({ blockSeq: 1 });
    expect(r.delivered.length).toBe(8);
    expect(r.delivered.slice(4).map((p) => Array.from(p))).toEqual(r.expectedPayloads(1).map((p) => Array.from(p)));
  });

  it("ULT-39 (property): no stream of peer-chosen deliveries takes the guard past its cap", () => {
    // Over the whole u32 domain, seeded (§7). The guard is keyed on a peer-controlled field, so
    // "bounded" has to be a property over that domain and not a check at one value — the same
    // shape as ULT-32 for the block window, for the same reason.
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 0, max: 0x0fffffff }), { minLength: 40, maxLength: 120 }), (blockSeqs) => {
        const r = makeReceiver();
        for (const b of blockSeqs) r.emit({ blockSeq: b });
        expect(r.channel.deliveredGuardCount).toBeLessThanOrEqual(DELIVERED_BLOCK_CAP);
        // ANTI-VACUITY: a guard that retained NOTHING would also satisfy the line above and
        // would be the unfixed module. With >= 40 deliveries the cap must actually be reached.
        expect(r.channel.deliveredGuardCount).toBe(DELIVERED_BLOCK_CAP);
      }),
      { numRuns: 200, seed: 0x5eed },
    );
  });

  it("ULT-40: the guard evicts by RECENCY — deliveries at the top of u32 cannot park it", () => {
    // The same negative control ULT-34 is for the block map, and it is needed independently here:
    // a second bounded structure is a second chance to reintroduce the parking fixed point.
    // Evicting the lowest key would let a peer hold every guard slot with `DELIVERED_BLOCK_CAP`
    // high-keyed deliveries, after which every honest guard entry is evicted the instant it is
    // created and the duplicate defect is restored for everyone but the attacker.
    const HIGH = 0x0f000000;
    const parked = makeReceiver();
    for (let i = 0; i < DELIVERED_BLOCK_CAP; i++) parked.emit({ blockSeq: HIGH + i });
    expect(parked.channel.deliveredGuardCount).toBe(DELIVERED_BLOCK_CAP); // full of squatters
    const squatterPayloads = parked.delivered.length;

    // Honest traffic now arrives, delivers, is evicted from the block window, and is replayed.
    for (let b = 0; b < 4; b++) parked.emit({ blockSeq: b });
    const afterFirstPass = parked.delivered.length;
    expect(afterFirstPass).toBe(squatterPayloads + 16);
    openBlocks(parked, 500, RECV_BLOCK_WINDOW + 1);
    for (let b = 0; b < 4; b++) parked.emit({ blockSeq: b });
    // Under key-order eviction the four honest guard entries are gone and this is 16 duplicates.
    expect(parked.delivered.length).toBe(afterFirstPass);

    // The control: the identical honest traffic with no squatters present is byte-identical, so
    // the assertion above is about the parking and not about the honest path being weak.
    const clean = makeReceiver();
    for (let b = 0; b < 4; b++) clean.emit({ blockSeq: b });
    openBlocks(clean, 500, RECV_BLOCK_WINDOW + 1);
    for (let b = 0; b < 4; b++) clean.emit({ blockSeq: b });
    expect(parked.delivered.slice(squatterPayloads).map((p) => Array.from(p))).toEqual(
      clean.delivered.map((p) => Array.from(p)),
    );
  });

  it("ULT-41: a straggler REFRESHES its block's guard — recency, not delivery age", () => {
    // This exists because the same mutation was unobservable one level down: ULT-37 records that
    // removing the block map's move-to-tail left every other test green. The guard has its own
    // move-to-tail, on the branch where a straggler HITS the guard, and it needs its own falsifier
    // or it is decoration for exactly the same reason.
    //
    // The discriminator: two delivered blocks, both evicted from the block window; touch block 0
    // with a straggler; then deliver enough further blocks to force exactly one guard eviction.
    // Under LRU the victim is the untouched block 1; under insertion-order-only it is block 0.
    // Replaying both says which it was.
    const r = makeReceiver();
    r.emit({ blockSeq: 0 });
    r.emit({ blockSeq: 1 });
    openBlocks(r, 300, RECV_BLOCK_WINDOW + 1); // both are now out of `recvBlocks`
    expect(r.channel.deliveredGuardCount).toBe(2);

    // TOUCH: a parity straggler for block 0. It is refused (that is the guard working) and it
    // moves block 0's entry to the tail. Delivery must not change — anti-vacuity on the touch.
    const beforeTouch = r.delivered.length;
    r.emit({ blockSeq: 0, positions: [4] });
    expect(r.delivered.length).toBe(beforeTouch);

    // Fill the guard to its cap and then force exactly one eviction.
    for (let b = 0; b < DELIVERED_BLOCK_CAP - 1; b++) r.emit({ blockSeq: 400 + b });
    expect(r.channel.deliveredGuardCount).toBe(DELIVERED_BLOCK_CAP);
    const beforeReplay = r.delivered.length;

    // Replay both. Block 0 survived (touched); block 1 did not, so it delivers a second time —
    // and that second delivery is the honest cost of a bounded guard, pinned rather than hidden.
    r.emit({ blockSeq: 0 });
    expect(r.delivered.length).toBe(beforeReplay); // still guarded
    r.emit({ blockSeq: 1 });
    expect(r.delivered.length).toBe(beforeReplay + 4); // evicted: §12 holds over a WINDOW only
    expect(r.delivered.slice(beforeReplay).map((p) => Array.from(p))).toEqual(
      r.expectedPayloads(1).map((p) => Array.from(p)),
    );
  });

  it("ULT-42: the guard is keyed on the block index DERIVED from seq, not on the blockSeq field", () => {
    // `seq = blockSeq * BLOCK_TOTAL + pos` in the encoder, so for any honest sender the two are the
    // same number and this test is invisible. It is expressible only because the receiver trusts
    // them independently — which is 081KZZZH24H087G0R002TXQA15, still open, and the reason a guard
    // keyed on `blockSeq` would inherit a 4.29e9-value key space bounded by nothing the receiver
    // already tracks. Keyed on `seq >> 3` the guard lives in the key space `expectedSeq`,
    // `reportedMissing` and `MAX_NACK_GAP` are all built on.
    const r = makeReceiver();
    r.emit({ blockSeq: 0, seqBase: 0 });
    expect(r.delivered.length).toBe(4);
    openBlocks(r, 700, RECV_BLOCK_WINDOW + 1);

    // Same sequence numbers, a DIFFERENT `blockSeq`, the same payloads. Under `blockSeq` keying
    // this is a fresh block and delivers again; under seq-derived keying it is the same block
    // position on the wire and is refused.
    r.emit({ blockSeq: 0xabcdef, seqBase: 0, payloadsOf: 0 });
    expect(r.delivered.length).toBe(4);

    // ANTI-VACUITY / the converse: the same `blockSeq` at a DIFFERENT seq base is a different
    // block on the wire and delivers. Without this line the assertion above would be satisfied by
    // a guard that refuses everything after the first delivery.
    r.emit({ blockSeq: 0, seqBase: 8000, payloadsOf: 2 });
    expect(r.delivered.length).toBe(8);
    expect(r.delivered.slice(4).map((p) => Array.from(p))).toEqual(r.expectedPayloads(2).map((p) => Array.from(p)));
  });

  it("ULT-43: the seeded reorder sweep delivers 1600 of 1600 with ZERO duplicates", () => {
    // The filed measurement, run in the suite rather than remembered from a pull request. The
    // harness is `udp-lossy-transport.reorder-sweep.ts`; `distinct` and `delivered` are reported
    // apart precisely because the defect hid inside a goodput total that read as a good number
    // (1672 of 1600 sent).
    //
    //     depth   before (delivered / distinct / dup)     after
    //        32           1600 / 1600 /   0               1600 / 1600 / 0
    //        64           1672 / 1560 / 112               1600 / 1600 / 0
    //       128            508 /  496 /  12                696 /  696 / 0
    //
    // Depth 128 also gains DISTINCT delivery (496 -> 696) — refusing a straggler for a
    // delivered block keeps a dead block out of the recovery window. That is a side effect of the
    // guard, not its purpose, and it is not pinned exactly below because it is a property of the
    // eviction policy (081KZZZH7H4087G0R001HV0W40), which is free to move.
    for (const depth of [32, 64] as const) {
      const s = sweepOnce(400, depth, 0, 0x5eed);
      expect(s.duplicates).toBe(0);
      expect(s.delivered).toBe(1600); // exact: 0% loss inside the declared envelope loses nothing
      expect(s.distinct).toBe(1600);
    }
    // Past the declared envelope the guard still holds even though delivery degrades — the §12
    // property is not conditional on the reorder depth being polite.
    const deep = sweepOnce(400, 128, 0, 0x5eed);
    expect(deep.duplicates).toBe(0);
    expect(deep.distinct).toBeGreaterThan(0); // anti-vacuity: it is not zero-delivery that holds it
    expect(deep.distinct).toBeLessThan(1600); // and the loss past the window is real, not hidden
  }, 20_000);
});
