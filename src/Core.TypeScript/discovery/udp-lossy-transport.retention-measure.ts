/**
 * udp-lossy-transport.retention-measure.ts — the RSS measurement behind 081KZYQJPNG087G0R002B9E9S1.
 *
 * A retention fix asserted without a memory measurement is a claim, so the number that filed the
 * defect is reproducible rather than remembered. Run:
 *
 *     bun src/Core.TypeScript/discovery/udp-lossy-transport.retention-measure.ts [packets]
 *
 * What it drives: `packets` well-formed `lossy-udp` envelopes at 256-byte payloads, each with a
 * FRESH `blockSeq` and `blockPos = 0`, so no block ever becomes recoverable. `seq` advances by one
 * so no NACK is provoked — this isolates `recvBlocks` retention from the reply path that
 * 081KZYP1S96087G0R002G8XQZP bounded.
 *
 * `blockSeq` is a header field independent of `seq` on the wire (an honest sender always sets
 * `blockSeq = seq / BLOCK_TOTAL`, and nothing checks it), which is why a fresh key per packet is a
 * thing a peer may simply do. It is also what an ordinary lossy link does by accident: a block that
 * never becomes recoverable never completes, and before this fix a block that never completed was
 * never evicted.
 *
 * ## Read the SLOPE, not the total
 *
 * Total RSS growth from a cold start is confounded and will not go to zero however correct the
 * receiver is: a Bun heap that expanded to hold ~100 MB of transient JSON/Buffer garbage does not
 * hand those pages back to the OS, so a high-water mark survives `Bun.gc(true)`. Measured on the
 * FIXED code, that mark is flat in the packet count — 72.9 MB at 25k packets, 104.1 MB at 400k —
 * i.e. 16x the traffic for the same residue.
 *
 * `rssSecondHalfGrowth` is not confounded, and it is the number to look at. A leak linear in
 * packets grows the second half of the run by as much as the first; a bounded receiver grows it by
 * approximately nothing, because the allocator reached its high-water mark long before halfway.
 */
import { encodePacket, LossyUdpChannel } from "./udp-lossy-transport";

export interface RetentionSample {
  readonly packets: number;
  readonly inBytes: number;
  readonly rssBefore: number;
  /** Sampled at the halfway packet, after a full GC — the base of the steady-state slope. */
  readonly rssMid: number;
  readonly rssAfter: number;
  readonly rssGrowth: number;
  /** `rssAfter - rssMid`: growth over the second half. See the module header — this is the
   *  measurement that discriminates retention from allocator high-water mark. */
  readonly rssSecondHalfGrowth: number;
  readonly retainedBlocks: number;
  readonly bytesPerPacket: number;
  readonly retentionRatio: number;
}

export function measureRetention(packets: number, payloadLen = 256): RetentionSample {
  let receive: (text: string, from: string) => void = () => {};
  const transport = {
    broadcast: () => {},
    onMessage: (h: (text: string, from: string) => void) => {
      receive = h;
    },
  };
  const channel = new LossyUdpChannel(transport, "receiver");
  const payload = new Uint8Array(payloadLen).fill(0xa5);

  Bun.gc(true);
  const rssBefore = process.memoryUsage.rss();

  const half = packets >> 1;
  let rssMid = rssBefore;
  let inBytes = 0;
  for (let i = 0; i < packets; i++) {
    if (i === half) {
      Bun.gc(true);
      rssMid = process.memoryUsage.rss();
    }
    const pkt = encodePacket({ seq: i, blockSeq: i, blockPos: 0, isData: true, payloadLen }, payload);
    const wire = JSON.stringify({ type: "lossy-udp", zid: "attacker", pkt: pkt.toString("base64") });
    inBytes += Buffer.byteLength(wire, "utf8");
    receive(wire, "attacker");
  }

  Bun.gc(true);
  const rssAfter = process.memoryUsage.rss();

  return {
    packets,
    inBytes,
    rssBefore,
    rssMid,
    rssAfter,
    rssGrowth: rssAfter - rssBefore,
    rssSecondHalfGrowth: rssAfter - rssMid,
    retainedBlocks: channel.retainedBlockCount,
    bytesPerPacket: (rssAfter - rssBefore) / packets,
    retentionRatio: (rssAfter - rssBefore) / inBytes,
  };
}

if (import.meta.main) {
  const packets = Number(process.argv[2] ?? 200_000);
  const s = measureRetention(packets);
  const fmt = (n: number) => n.toLocaleString("en-US");
  process.stdout.write(
    [
      `packets delivered          ${fmt(s.packets)}`,
      `inbound bytes              ${fmt(s.inBytes)}`,
      `recvBlocks retained        ${fmt(s.retainedBlocks)}`,
      `RSS before                 ${fmt(s.rssBefore)}`,
      `RSS at halfway             ${fmt(s.rssMid)}`,
      `RSS after                  ${fmt(s.rssAfter)}`,
      `RSS growth (total)         ${fmt(s.rssGrowth)}`,
      `RSS growth (2nd half)      ${fmt(s.rssSecondHalfGrowth)}   <- the discriminating number`,
      `retained per inbound byte  ${s.retentionRatio.toFixed(2)}x`,
      `retained per packet        ${s.bytesPerPacket.toFixed(0)} bytes`,
      "",
    ].join("\n"),
  );
}
