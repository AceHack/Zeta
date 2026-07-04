import { describe, expect, test } from "bun:test";
import { type Frame, fourCornerOverDuplex, localDuplexPair } from "./duplex-transport.ts";

// FILL THE FEEDBACK CORNERS OVER A REAL TRANSPORT (shadow*, Aaron 2026-07-04). four-corner.ts typed the
// shape; against OpenAI the feedback corners are dark. Here they carry LIVE signals over a genuine full-duplex
// channel. Proofs:
//   1. both directions independent — a.send arrives on b.inbound and vice-versa.
//   2. demux — normal frames surface on normalIn, feedback frames on feedbackIn, on the peer.
//   3. THE headline: a feedback "stop" crosses the wire mid-stream and cuts a running normal output short —
//      the mutual interruption chat-completions provably cannot do.
//   4. close ends both demuxed streams and resolves the pump.

async function collect<T>(stream: AsyncIterable<T>, max = Infinity): Promise<T[]> {
  const out: T[] = [];
  for await (const x of stream) {
    out.push(x);
    if (out.length >= max) break;
  }
  return out;
}

describe("duplex-transport — four corners over a real transport", () => {
  test("both directions are independent (a→b and b→a)", async () => {
    const [a, b] = localDuplexPair<string, string>();
    await a.send({ channel: "normal", payload: "from-a" });
    await b.send({ channel: "normal", payload: "from-b" });
    const bGot = await collect(b.inbound(), 1); // exactly the one frame a sent
    const aGot = await collect(a.inbound(), 1); // exactly the one frame b sent
    const expA: Frame<string, string> = { channel: "normal", payload: "from-a" };
    const expB: Frame<string, string> = { channel: "normal", payload: "from-b" };
    expect(bGot).toEqual([expA]);
    expect(aGot).toEqual([expB]);
  });

  test("frames demux by channel into normalIn / feedbackIn on the peer", async () => {
    const [a, b] = localDuplexPair<string, string>();
    const wa = fourCornerOverDuplex(a);
    const wb = fourCornerOverDuplex(b);
    await wa.sendNormal("token");
    await wa.feedbackOut.push("ctrl");
    await wa.close();
    expect(await collect(wb.normalIn)).toEqual(["token"]);
    expect(await collect(wb.feedbackIn)).toEqual(["ctrl"]);
    await wb.close();
    await Promise.all([wa.pump, wb.pump]);
  });

  test("HEADLINE: a feedback 'stop' crosses the wire mid-stream and cuts a running output short", async () => {
    const [a, b] = localDuplexPair<number, string>();
    const producer = fourCornerOverDuplex(a);
    const consumer = fourCornerOverDuplex(b);
    const N = 20;

    // Producer watches its feedbackIn; when "stop" arrives it halts. (The feedback corner, live.)
    // Holder object so the flow analyzer sees a genuine mutation across the async closure.
    const ctrl = { stop: false };
    const watch = (async () => {
      for await (const s of producer.feedbackIn) {
        if (s === "stop") {
          ctrl.stop = true;
          break;
        }
      }
    })();

    // Consumer reads the normal stream; on the FIRST token it pushes "stop" back UP the feedback wire.
    const consumed: number[] = [];
    const consume = (async () => {
      for await (const n of consumer.normalIn) {
        consumed.push(n);
        if (consumed.length === 1) await consumer.feedbackOut.push("stop");
      }
    })();

    // Producer emits until interrupted, yielding between sends so the round-trip stop can land.
    let sent = 0;
    for (let i = 0; i < N; i++) {
      if (ctrl.stop) break;
      await producer.sendNormal(i);
      sent++;
      await new Promise<void>((r) => setTimeout(r, 0)); // let the peer + feedback round-trip make progress
    }
    await producer.close();
    await consumer.close();
    await Promise.all([producer.pump, consumer.pump, watch, consume]);

    expect(ctrl.stop).toBe(true); // the feedback signal crossed the wire and was observed
    expect(sent).toBeLessThan(N); // the running output was genuinely cut short by the interrupt
    expect(consumed.length).toBeGreaterThan(0); // some normal tokens flowed before the stop
    expect(consumed.length).toBeLessThan(N); // ...but not all — mutual interruption worked
  });

  test("close ends both demuxed streams and resolves the pump", async () => {
    const [a, b] = localDuplexPair<string, string>();
    const wa = fourCornerOverDuplex(a);
    const wb = fourCornerOverDuplex(b);
    await wa.close();
    await wb.close();
    expect(await collect(wb.normalIn)).toEqual([]);
    expect(await collect(wb.feedbackIn)).toEqual([]);
    await Promise.all([wa.pump, wb.pump]); // resolves — no hang
  });
});
