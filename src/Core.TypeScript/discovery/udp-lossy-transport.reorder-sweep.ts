/**
 * udp-lossy-transport.reorder-sweep.ts — the seeded reorder harness behind the receiver's
 * retention policy (081KZYQJPNG087G0R002B9E9S1) and its duplicate-delivery defect
 * (081KZZZGYBR087G0R00302Z2J6).
 *
 * Run:
 *
 *     bun src/Core.TypeScript/discovery/udp-lossy-transport.reorder-sweep.ts [blocks] [seed]
 *
 * ## Why this file exists
 *
 * The eviction-policy table in `udp-lossy-transport.ts` ("depth / unbounded / lowest key / LRU /
 * FIFO / fewest-sym") and the duplicate counts in 081KZZZGYBR087G0R00302Z2J6 were both produced by
 * a harness that lived only in a pull request. A measurement whose harness is not in the repo is a
 * number nobody can re-derive, so it is here now. `retention-measure.ts` is the sibling for RSS.
 *
 * ## The model
 *
 * `blocks` honest Adinkra [8,4,4] blocks are emitted in wire order, `seq = blockSeq * 8 + pos`, and
 * then displaced: packet `i` is sorted by `i + rng() * depth`, a bounded jitter of `depth` PACKET
 * POSITIONS. Deterministic from `seed` (§7 DST) — mulberry32, so a run replays exactly.
 *
 * Loss is INDEPENDENT per packet at rate `loss`, drawn from the same seeded generator. That is
 * deliberately the crude model, and naming what it cannot show is the point: a Bernoulli channel
 * produces the consecutive losses that break a block only by coincidence, so most unrecovered
 * blocks here cost REORDER rather than loss — which is exactly the isolation this sweep is for.
 *
 * NOT the chaos harness, and the separation matters right now. `udp-lossy-transport.chaos.ts`
 * carries the burst-correlated model and a KNOWN understatement of it
 * (081KZYY6SVJ087G0R0035SW945 — `meanBurstLength = 1` currently forbids consecutive losses, which
 * has already been shown to hide a weak assertion). No number produced by this file passes through
 * that harness, so that defect does not touch the duplicate-delivery measurements in
 * 081KZZZGYBR087G0R00302Z2J6. The converse is the honest limit: this file says nothing about burst
 * behaviour either, and a burst-shaped duplicate would have to be measured there.
 *
 * ## What it counts, and why DISTINCT is separate from TOTAL
 *
 * Each data payload is tagged with its own `(blockSeq, index)`, so a delivery can be attributed
 * back to the block that produced it. Then:
 *
 *   - `delivered`  — total `onData` calls. This is the number the goodput table reports.
 *   - `distinct`   — how many of the `blocks * 4` payloads were delivered AT LEAST once.
 *   - `duplicates` — `delivered - distinct`: §12 violations, deliveries that were not new.
 *
 * Reporting only `delivered` is what let the duplicate defect hide inside a goodput column: at
 * reorder depth 64 the post-#10552 receiver scored 1632 of 1600, and a total ABOVE the sent count
 * reads as a good number until it is split.
 */
import { buildSenderBlock, encodePacket, LossyUdpChannel } from "./udp-lossy-transport";

/** mulberry32 — a small, fast, fully-specified 32-bit PRNG. Named rather than `Math.random` so a
 *  sweep replays byte-identically on any machine (§7 DST; §13 — entropy enters through this one
 *  declared door and no other). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SweepSample {
  readonly depth: number;
  readonly loss: number;
  readonly blocks: number;
  /** `blocks * 4` — the data payloads the sender handed to `send`. */
  readonly sent: number;
  /** Total `onData` calls. */
  readonly delivered: number;
  /** Payloads delivered at least once. `sent - distinct` is what the channel LOST. */
  readonly distinct: number;
  /** `delivered - distinct` — §12 violations. */
  readonly duplicates: number;
  /** How many distinct blocks contributed at least one duplicate. */
  readonly duplicateBlocks: number;
  readonly retainedBlocks: number;
}

/** One payload per (block, index), distinguishable by its own bytes so a delivery is attributable.
 *  4 bytes: blockSeq lo, blockSeq hi, index, a fixed tag. `blocks` must stay under 65536. */
function payloadFor(blockSeq: number, index: number): Uint8Array {
  return Uint8Array.from([blockSeq & 0xff, (blockSeq >> 8) & 0xff, index, 0x5a]);
}

export function sweepOnce(blocks: number, depth: number, loss: number, seed: number): SweepSample {
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

  // Build the wire stream in honest order.
  const wire: { readonly order: number; readonly text: string }[] = [];
  for (let b = 0; b < blocks; b++) {
    const sent = buildSenderBlock(
      b,
      Array.from({ length: 4 }, (_, i) => payloadFor(b, i)),
    );
    const packets = [...sent.dataPackets, ...sent.parityPackets];
    for (let pos = 0; pos < 8; pos++) {
      const pkt = encodePacket(
        { seq: b * 8 + pos, blockSeq: b, blockPos: pos, isData: pos < 4, payloadLen: packets[pos]!.length },
        packets[pos]!,
      );
      wire.push({
        order: wire.length,
        text: JSON.stringify({ type: "lossy-udp", zid: "peer", pkt: pkt.toString("base64") }),
      });
    }
  }

  // Displace and drop. One RNG, consumed in a fixed order, so `loss` and `depth` do not perturb
  // each other's stream: both draws happen for every packet whatever the parameters are.
  const rng = mulberry32(seed);
  const keyed = wire.map((w) => ({ w, key: w.order + rng() * depth, drop: rng() < loss }));
  keyed.sort((x, y) => x.key - y.key || x.w.order - y.w.order);
  for (const k of keyed) if (!k.drop) receive(k.w.text, "peer");

  const seen = new Set<number>();
  let duplicates = 0;
  const duplicateBlocks = new Set<number>();
  for (const p of delivered) {
    const blockSeq = p[0]! | (p[1]! << 8);
    const key = blockSeq * 4 + p[2]!;
    if (seen.has(key)) {
      duplicates++;
      duplicateBlocks.add(blockSeq);
    } else seen.add(key);
  }

  return {
    depth,
    loss,
    blocks,
    sent: blocks * 4,
    delivered: delivered.length,
    distinct: seen.size,
    duplicates,
    duplicateBlocks: duplicateBlocks.size,
    retainedBlocks: channel.retainedBlockCount,
  };
}

export const SWEEP_DEPTHS: readonly number[] = [0, 8, 16, 32, 64, 128, 256] as const;

if (import.meta.main) {
  const blocks = Number(process.argv[2] ?? 400);
  const seed = Number(process.argv[3] ?? 0x5eed);
  const rows = ["depth  delivered  distinct  duplicates  dupBlocks  retained"];
  for (const depth of SWEEP_DEPTHS) {
    const s = sweepOnce(blocks, depth, 0, seed);
    rows.push(
      `${String(s.depth).padStart(5)}  ${String(s.delivered).padStart(9)}  ${String(s.distinct).padStart(8)}  ` +
        `${String(s.duplicates).padStart(10)}  ${String(s.duplicateBlocks).padStart(9)}  ` +
        `${String(s.retainedBlocks).padStart(8)}`,
    );
  }
  process.stdout.write(
    `${blocks} blocks / ${blocks * 4} payloads, 0% loss, seed 0x${seed.toString(16)}\n${rows.join("\n")}\n`,
  );
}
