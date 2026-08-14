/**
 * udp-lossy-transport.test.ts — Tests for the lossy UDP transport with Adinkra [8,4,4] ECC.
 *
 * Anti-self-certifying: tests include fault injection (deliberate packet drops) and
 * negative controls (2+ erasures → unrecoverable).
 */
import { describe, it, expect } from "bun:test";
import fc from "fast-check";
import {
  MAX_NACK_GAP,
  type DesyncEvent,
  computeAdinkraParity,
  recoverAdinkraErasure,
  recoverAdinkraBlock,
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
    const settle = () => new Promise((r) => setTimeout(r, 50));

    // FIRST prove the teaching path is live, so a later zero cannot be mistaken for a dead path —
    // that would be a vacuous pass. A well-formed teaching object must advance obsCount.
    receive(
      JSON.stringify({
        type: "lossy-udp-nack",
        nack: [1],
        teaching: {
          type: "nack",
          missingSeqs: [1],
          cause: "timeout",
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
