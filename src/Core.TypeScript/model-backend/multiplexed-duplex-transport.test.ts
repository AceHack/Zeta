import { describe, expect, test } from "bun:test";
import { localDuplexPair } from "./duplex-transport.ts";
import { type MuxChannel, type MuxFrame, categoryOf, mintChannelId, multiplexedDuplexTransport } from "./multiplexed-duplex-transport.ts";
import { Category } from "../zeta-id/types.ts";
import { toHex } from "../zeta-id/encoding.ts";

// N FOUR-CORNER CHANNELS OVER ONE TRANSPORT, ZETAID-KEYED (shadow*, Aaron 2026-07-04 "use ZetaIds, not GUIDs
// — make a category just for this; the id is a little program the far side decodes"). Proofs:
//   1. minted channel ids are self-describing: Category.Channel is decodable from the id; ids are unique.
//   2. two channels multiplex over ONE physical pair with NO cross-talk (each side's normalIn gets only its own).
//   3. the peer's opened channels surface on `accepted` with matching ids.
//   4. feedback is per-channel: a "stop" on channel 1 reaches channel 1's feedbackIn, NOT channel 2's.

async function collect<T>(stream: AsyncIterable<T>, max = Infinity): Promise<T[]> {
  const out: T[] = [];
  for await (const x of stream) {
    out.push(x);
    if (out.length >= max) break;
  }
  return out;
}

async function acceptN<TN, TF>(accepted: AsyncIterable<MuxChannel<TN, TF>>, n: number): Promise<MuxChannel<TN, TF>[]> {
  const out: MuxChannel<TN, TF>[] = [];
  for await (const c of accepted) {
    out.push(c);
    if (out.length >= n) break;
  }
  return out;
}

describe("multiplexed-duplex-transport — ZetaId-keyed channels", () => {
  test("minted channel ids are self-describing (Category.Channel) and unique", () => {
    const a = mintChannelId(1n);
    const b = mintChannelId(2n);
    expect(categoryOf(a)).toBe(Category.Channel); // the far side reads the nibble → "this is a channel"
    expect(categoryOf(b)).toBe(Category.Channel);
    expect(a).not.toBe(b); // unique discriminator
  });

  // BYTE-LOCK the minted key. `categoryOf(a) === Category.Channel` alone passes for a whole family of
  // wrong ids (any stray bit outside the category nibble is invisible to it), so pin the RAW id: Version=1
  // @123, Category.Channel=11 @65, discriminator in the low 48 bits, and NOTHING else set. The `16` nibble
  // pair is the load-bearing part — bit 64 is RESERVED (it held the 1-bit Firefly field until it was
  // reclaimed NO-SHIFT on 2026-08-11); if anything re-wrote it these would read `17`.
  test("minted channel id is byte-locked: version+category+discriminator only, reserved bit 64 is ZERO", () => {
    expect(toHex(mintChannelId(1n))).toBe("08000000000000160000000000000001");
    expect(toHex(mintChannelId(2n))).toBe("08000000000000160000000000000002");

    // Explicit, independent of the hex spelling: bit 64 must be 0 for every minted id.
    for (const seq of [0n, 1n, 2n, 7n, 0xffffffffffffn]) {
      expect((mintChannelId(seq) >> 64n) & 1n).toBe(0n);
    }
  });

  // NO-SHIFT guard: Firefly's removal moved nothing. Category must still decode from bit 65.
  test("NO-SHIFT: Category still lives at bit 65", () => {
    const id = mintChannelId(3n);
    expect(Number((id >> 65n) & 0xfn)).toBe(Category.Channel);
    expect(categoryOf(id)).toBe(Number((id >> 65n) & 0xfn));
  });

  test("two channels multiplex over one transport with no cross-talk; peer sees them on accepted", async () => {
    const [epA, epB] = localDuplexPair<MuxFrame, never>();
    const client = multiplexedDuplexTransport<string, string>(epA);
    const server = multiplexedDuplexTransport<string, string>(epB);

    const ch1 = client.open();
    const ch2 = client.open();
    await ch1.wire.sendNormal("a1");
    await ch2.wire.sendNormal("b1");
    await ch1.wire.sendNormal("a2");

    const accepted = await acceptN(server.accepted, 2);
    const byId = new Map(accepted.map((c) => [toHex(c.id), c]));
    const s1 = byId.get(toHex(ch1.id));
    const s2 = byId.get(toHex(ch2.id));
    if (!s1 || !s2) throw new Error("both channels should have been accepted by the peer");

    const p1 = collect(s1.wire.normalIn);
    const p2 = collect(s2.wire.normalIn);
    await epA.send({ channel: "close" }); // ends the server streams
    expect(await p1).toEqual(["a1", "a2"]); // channel 1 got only its own payloads
    expect(await p2).toEqual(["b1"]); // channel 2 got only its own — no cross-talk
  });

  test("feedback is per-channel: a stop on channel 1 does not leak to channel 2", async () => {
    const [epA, epB] = localDuplexPair<MuxFrame, never>();
    const client = multiplexedDuplexTransport<string, string>(epA);
    const server = multiplexedDuplexTransport<string, string>(epB);

    const ch1 = client.open();
    const ch2 = client.open();
    // touch both channels so the server accepts both, then push feedback on ch1 only
    await ch1.wire.sendNormal("hi1");
    await ch2.wire.sendNormal("hi2");
    await ch1.wire.feedbackOut.push("stop");

    const accepted = await acceptN(server.accepted, 2);
    const byId = new Map(accepted.map((c) => [toHex(c.id), c]));
    const s1 = byId.get(toHex(ch1.id));
    const s2 = byId.get(toHex(ch2.id));
    if (!s1 || !s2) throw new Error("both channels should have been accepted by the peer");

    const f1 = collect(s1.wire.feedbackIn);
    const f2 = collect(s2.wire.feedbackIn);
    await epA.send({ channel: "close" });
    expect(await f1).toEqual(["stop"]); // channel 1's feedback corner carried the signal
    expect(await f2).toEqual([]); // channel 2's did NOT — feedback is isolated per channel
  });
});
