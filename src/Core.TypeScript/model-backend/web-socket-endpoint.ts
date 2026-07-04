// web-socket-endpoint.ts — DuplexEndpoint over a real WebSocket (shadow*).
//
// Aaron 2026-07-04: "wire the DuplexEndpoint over a real WebSocket next — this is just one of our many
// transports." duplex-transport.ts lit the four corners over the in-process reference pair (DoP=1,
// deterministic). This is the SOCKET-BACKED fill of the SAME `DuplexEndpoint` port: frames serialize to
// text, cross a genuine WebSocket, deserialize on the peer — so the feedback corners carry live signals
// over a real network wire. Nothing upstream changes: `fourCornerOverDuplex(webSocketEndpoint(sock))` is
// the same four corners, now over ws:// instead of an in-process queue. WebSocket is one transport; a
// Reticulum link / WebRTC data channel / QUIC stream implement the same port identically.
//
// Noninterference §13: the network crosses ONLY through the injected `DuplexSocket` door — this module has
// no `new WebSocket` of its own, so it is fake-testable with NO real socket (`fakeDuplexSocketPair`) and
// the platform adapter (`platformWebSocket`) is the thin real fill wired at the edge. Payloads must be
// codec-serializable (JSON by default) — that is the honest cost of crossing a real wire vs an in-process
// reference where any value passes.
//
// ANCHOR (human prior art — the maintainer's own): AceHack/MultiplexedWebSockets (C#, 2023) — the design
// this descends from. There, MANY logical request/response pairs multiplex over ONE physical WebSocket,
// correlated by a per-message Guid (`_inFlightRequests: ConcurrentDictionary<Guid, TCS>`), under a message
// envelope (version byte v1, 32-byte header, `MessageType` Request=1/Response=2, max 0xFFFF). The send path
// is a DoP=1 ferry-throttle — `ActionBlock { MaxDegreeOfParallelism = 1, BoundedCapacity = 1 }` over
// `System.IO.Pipelines` — the exact "beautiful on one thread, scale to N" pattern the async-all-the-way
// rules cite. Measured ~16x over HttpClient (115,309 vs 7,075 req/s) precisely because it multiplexes
// instead of paying per-request HTTP overhead. Lineage: this `DuplexEndpoint`/`Frame` is the SINGLE-channel
// case; the Guid-correlated multiplexing is the MULTI-channel generalization over one socket; and the
// four-corner feedback corners ADD to that envelope's Request/Response the return channel it lacks
// (extraction Request/Response → mutual-empowerment four-corner). A future `MultiplexedDuplexTransport`
// carries N four-corner channels over one socket, Guid-keyed — the merge of the two.

import type { DuplexEndpoint, Frame } from "./duplex-transport.ts";

/// The injected socket door — a minimal text-message duplex socket (noninterference §13). A real
/// WebSocket is wrapped by `platformWebSocket`; tests use `fakeDuplexSocketPair`. Text frames only (JSON).
export interface DuplexSocket {
  send(data: string): void;
  close(): void;
  onMessage(cb: (data: string) => void): void;
  onClose(cb: () => void): void;
  onError(cb: (err: unknown) => void): void;
}

/// A Frame ⇄ wire-string codec. `decode` returns null on garbage (a bad message is skipped, not a crash).
export interface FrameCodec<TN, TF> {
  encode(frame: Frame<TN, TF>): string;
  decode(data: string): Frame<TN, TF> | null;
}

/// The default JSON codec. Payloads must be JSON-serializable (the honest cost of a real wire). `decode`
/// validates the `channel` tag and returns null otherwise — an unrecognized message never crashes inbound.
export function jsonFrameCodec<TN, TF>(): FrameCodec<TN, TF> {
  return {
    encode: (frame) => JSON.stringify(frame),
    decode: (data) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(data);
      } catch {
        return null;
      }
      if (typeof parsed !== "object" || parsed === null) return null;
      const ch = (parsed as { channel?: unknown }).channel;
      if (ch === "normal" || ch === "feedback" || ch === "close") return parsed as Frame<TN, TF>;
      return null;
    },
  };
}

/// A single-consumer async queue (same shape as duplex-transport's): push non-blocking, drain until close.
function asyncQueue<T>() {
  const items: T[] = [];
  const waiters: ((r: IteratorResult<T>) => void)[] = [];
  let closed = false;
  return {
    push(v: T): void {
      const w = waiters.shift();
      if (w) w({ value: v, done: false });
      else items.push(v);
    },
    close(): void {
      closed = true;
      let w = waiters.shift();
      while (w) {
        w({ value: undefined, done: true });
        w = waiters.shift();
      }
    },
    async *drain(): AsyncIterable<T> {
      for (;;) {
        const next = items.shift();
        if (next !== undefined) {
          yield next;
          continue;
        }
        if (closed) return;
        const r = await new Promise<IteratorResult<T>>((res) => waiters.push(res));
        if (r.done) return;
        yield r.value;
      }
    },
  };
}

/// A `DuplexEndpoint` over an injected `DuplexSocket`: send encodes+ships a frame (a `close` frame also
/// closes the socket); inbound decodes incoming messages and yields frames until the socket closes.
export function webSocketEndpoint<TN, TF>(socket: DuplexSocket, codec: FrameCodec<TN, TF> = jsonFrameCodec<TN, TF>()): DuplexEndpoint<TN, TF> {
  const q = asyncQueue<Frame<TN, TF>>();
  socket.onMessage((data) => {
    const frame = codec.decode(data);
    if (frame) q.push(frame);
  });
  socket.onClose(() => {
    q.close();
  });
  socket.onError(() => {
    q.close();
  });
  return {
    send(frame: Frame<TN, TF>): Promise<void> {
      socket.send(codec.encode(frame));
      if (frame.channel === "close") socket.close();
      return Promise.resolve();
    },
    inbound: () => q.drain(),
  };
}

/// Wrap a WHATWG `WebSocket` (the browser/Bun client global) as a `DuplexSocket` — the thin REAL fill.
/// Pure until used; the socket must already be open (await its `open` event) before frames are sent.
export function platformWebSocket(ws: WebSocket): DuplexSocket {
  return {
    send: (data) => {
      ws.send(data);
    },
    close: () => {
      ws.close();
    },
    onMessage: (cb) => {
      ws.addEventListener("message", (e: MessageEvent) => {
        if (typeof e.data === "string") cb(e.data); // text frames only (the codec is text)
      });
    },
    onClose: (cb) => {
      ws.addEventListener("close", () => {
        cb();
      });
    },
    onError: (cb) => {
      ws.addEventListener("error", (e) => {
        cb(e);
      });
    },
  };
}

/// Two connected in-memory `DuplexSocket`s (string-level): whatever `a` sends arrives on `b`'s onMessage
/// and vice-versa. The deterministic test double for the WHOLE serialize→cross→deserialize path — proves
/// `webSocketEndpoint` end-to-end with no real socket.
export function fakeDuplexSocketPair(): [DuplexSocket, DuplexSocket] {
  const mk = () => ({ msg: [] as ((d: string) => void)[], close: [] as (() => void)[], closed: false });
  const A = mk();
  const B = mk();
  const socket = (self: typeof A, peer: typeof B): DuplexSocket => ({
    send: (data) => {
      if (!peer.closed) for (const cb of peer.msg) cb(data);
    },
    close: () => {
      if (self.closed) return;
      self.closed = true;
      for (const cb of self.close) cb();
      for (const cb of peer.close) cb();
    },
    onMessage: (cb) => {
      self.msg.push(cb);
    },
    onClose: (cb) => {
      self.close.push(cb);
    },
    onError: () => undefined,
  });
  return [socket(A, B), socket(B, A)];
}
