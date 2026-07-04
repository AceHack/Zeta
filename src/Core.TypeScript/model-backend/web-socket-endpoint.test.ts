import { afterAll, describe, expect, test } from "bun:test";
import { fourCornerOverDuplex } from "./duplex-transport.ts";
import { type DuplexSocket, fakeDuplexSocketPair, jsonFrameCodec, platformWebSocket, webSocketEndpoint } from "./web-socket-endpoint.ts";

// DUPLEXENDPOINT OVER A REAL WEBSOCKET (shadow*, Aaron 2026-07-04 "wire it over a real WebSocket — just one
// of our many transports"). Anchored to AceHack/MultiplexedWebSockets. Proofs:
//   1. codec round-trips a frame (encode → decode = id); garbage decodes to null (skipped, not a crash).
//   2. over the FAKE socket pair: the whole serialize→cross→deserialize path lights the four corners, and a
//      feedback "stop" cuts a running output short (the deterministic mirror of the duplex-transport headline).
//   3. over a REAL ws:// loopback (Bun.serve): a normal frame crosses a genuine WebSocket, the peer replies
//      with a FEEDBACK frame, and it surfaces on the client's feedbackIn — mutual empowerment over a real wire.

async function collect<T>(stream: AsyncIterable<T>, max = Infinity): Promise<T[]> {
  const out: T[] = [];
  for await (const x of stream) {
    out.push(x);
    if (out.length >= max) break;
  }
  return out;
}

describe("web-socket-endpoint — codec + fake socket", () => {
  test("json codec round-trips a frame; garbage → null", () => {
    const codec = jsonFrameCodec<string, string>();
    const enc = codec.encode({ channel: "normal", payload: "hi" });
    expect(codec.decode(enc)).toEqual({ channel: "normal", payload: "hi" });
    expect(codec.decode("not json")).toBeNull();
    expect(codec.decode(JSON.stringify({ channel: "bogus" }))).toBeNull();
  });

  test("four corners light over the fake socket pair (serialize→cross→deserialize)", async () => {
    const [sa, sb] = fakeDuplexSocketPair();
    const wa = fourCornerOverDuplex(webSocketEndpoint<string, string>(sa));
    const wb = fourCornerOverDuplex(webSocketEndpoint<string, string>(sb));
    await wa.sendNormal("token");
    await wa.feedbackOut.push("ctrl");
    await wa.close();
    expect(await collect(wb.normalIn)).toEqual(["token"]);
    expect(await collect(wb.feedbackIn)).toEqual(["ctrl"]);
    await wb.close();
    await Promise.all([wa.pump, wb.pump]);
  });

  test("feedback 'stop' cuts a running output short over the fake socket", async () => {
    const [sa, sb] = fakeDuplexSocketPair();
    const producer = fourCornerOverDuplex(webSocketEndpoint<number, string>(sa));
    const consumer = fourCornerOverDuplex(webSocketEndpoint<number, string>(sb));
    const N = 20;
    const ctrl = { stop: false };
    const watch = (async () => {
      for await (const s of producer.feedbackIn) {
        if (s === "stop") {
          ctrl.stop = true;
          break;
        }
      }
    })();
    const consumed: number[] = [];
    const consume = (async () => {
      for await (const n of consumer.normalIn) {
        consumed.push(n);
        if (consumed.length === 1) await consumer.feedbackOut.push("stop");
      }
    })();
    let sent = 0;
    for (let i = 0; i < N; i++) {
      if (ctrl.stop) break;
      await producer.sendNormal(i);
      sent++;
      await new Promise<void>((r) => setTimeout(r, 0));
    }
    await producer.close();
    await consumer.close();
    await Promise.all([producer.pump, consumer.pump, watch, consume]);
    expect(ctrl.stop).toBe(true);
    expect(sent).toBeLessThan(N);
    expect(consumed.length).toBeGreaterThan(0);
    expect(consumed.length).toBeLessThan(N);
  });
});

// ── REAL ws:// loopback: a genuine Bun WebSocket server + client. The peer replies to a normal frame with a
// feedback frame; we assert it crosses a real socket and surfaces on the client's feedbackIn. ──────────────
const server = Bun.serve<undefined>({
  port: 0, // ephemeral
  fetch(req, srv) {
    if (srv.upgrade(req)) return undefined;
    return new Response("expected a websocket upgrade", { status: 426 });
  },
  websocket: {
    message(ws, msg) {
      const frame = jsonFrameCodec<string, string>().decode(String(msg));
      // On a normal frame, reply with a feedback frame — proving the return corner over a real wire.
      if (frame?.channel === "normal") ws.send(JSON.stringify({ channel: "feedback", payload: `ack:${frame.payload}` }));
    },
  },
});
const url = `ws://localhost:${String(server.port)}`;

afterAll(() => {
  void server.stop(true);
});

describe("web-socket-endpoint — REAL ws:// loopback", () => {
  test("a normal frame crosses a real WebSocket; the peer's feedback frame returns on feedbackIn", async () => {
    const ws = new WebSocket(url);
    await new Promise<void>((resolve, reject) => {
      ws.addEventListener("open", () => {
        resolve();
      }, { once: true });
      ws.addEventListener("error", () => {
        reject(new Error("ws connection error"));
      }, { once: true });
    });
    const wire = fourCornerOverDuplex(webSocketEndpoint<string, string>(platformWebSocket(ws)));
    await wire.sendNormal("ping");
    const [fb] = await collect(wire.feedbackIn, 1); // the feedback frame the server sent back over the real socket
    expect(fb).toBe("ack:ping");
    ws.close();
  });

  test("platformWebSocket adapter is a well-formed DuplexSocket", () => {
    const ws = new WebSocket(url);
    const sock: DuplexSocket = platformWebSocket(ws);
    expect(typeof sock.send).toBe("function");
    expect(typeof sock.close).toBe("function");
    ws.close();
  });
});
