// duplex-transport.ts — a REAL full-duplex transport that lights all four corners (shadow*).
//
// Aaron 2026-07-04: "fill the four-corner feedback corners over a real transport." four-corner.ts typed the
// shape (Input/Output/FeedbackSink/FourCorner) and proved chat-completions is the feedback-free projection —
// but against OpenAI the two feedback corners stay DARK (an HTTP request/response is a half-duplex, 2-channel
// wire; the vendor has nowhere to carry feedback). This module supplies a genuinely BIDIRECTIONAL transport:
// two independent directions, each carrying framed normal+feedback messages, so the feedback corners carry
// LIVE signals — the mutual interruption chat-completions provably cannot do.
//
// HONEST SCOPE (Ryan-paranoia, incl. about self): "real transport" here means a genuine full-duplex channel
// (independent directions, framing, independently scheduled) — NOT yet a network socket. The reference impl is
// `localDuplexPair` (in-process, two async queues). That is deliberately the DoP=1 / single-loop form the
// async rules call the reference standard ("beautiful on one thread, deterministic, DST-replayable"): no
// socket, no thread, fully deterministic, fake-testable. A WebSocket / Reticulum link implements the SAME
// `DuplexEndpoint` port with a wire underneath (send → frame → socket; inbound ← socket ← frame) — that
// socket-backed fill is the next slice, not built here. So the four corners are lit over a real duplex
// mechanism; the network fill is named, not claimed. Noninterference §13: the endpoint is the only channel.
//
// Anchors: full-duplex mutual interruption (Twilio OutboundClearEvent; MultiplexedWebSockets; HEAT
// backpressure); the ferry/queue abstraction degrading to DoP=1 (async-all-the-way rules); Reticulum
// bidirectional links (the eventual socket fill).

import type { FeedbackSink } from "./four-corner.ts";

/// A framed message on the duplex wire: which corner it belongs to + its payload. `close` ends the direction.
export type Frame<TNormal, TFeedback> =
  | { readonly channel: "normal"; readonly payload: TNormal }
  | { readonly channel: "feedback"; readonly payload: TFeedback }
  | { readonly channel: "close" };

/// A full-duplex endpoint: send frames one way, receive frames the other, the two directions INDEPENDENT
/// (unlike request/response). A socket-backed impl wraps a real wire; `localDuplexPair` is the in-process one.
export interface DuplexEndpoint<TNormal, TFeedback> {
  send(frame: Frame<TNormal, TFeedback>): Promise<void>;
  inbound(): AsyncIterable<Frame<TNormal, TFeedback>>;
}

/// A single-consumer async queue: push is non-blocking, `drain` yields until `close`. Genuine async (a
/// waiter is a resolved promise, not a blocked thread) — the single-loop-friendly form (async-all-the-way).
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

/// Two connected full-duplex endpoints: whatever `a` sends arrives on `b.inbound()` and vice-versa, the two
/// directions independent. The in-process reference transport — a genuine bidirectional channel, deterministic.
export function localDuplexPair<TN, TF>(): [DuplexEndpoint<TN, TF>, DuplexEndpoint<TN, TF>] {
  const aToB = asyncQueue<Frame<TN, TF>>();
  const bToA = asyncQueue<Frame<TN, TF>>();
  const endpoint = (out: ReturnType<typeof asyncQueue<Frame<TN, TF>>>, inq: ReturnType<typeof asyncQueue<Frame<TN, TF>>>): DuplexEndpoint<TN, TF> => ({
    send(frame: Frame<TN, TF>): Promise<void> {
      out.push(frame);
      if (frame.channel === "close") out.close();
      return Promise.resolve();
    },
    inbound: () => inq.drain(),
  });
  return [endpoint(aToB, bToA), endpoint(bToA, aToB)];
}

/// The four corners lit over a duplex endpoint. `sendNormal`/`normalIn` are the normal wire; `feedbackOut`
/// (a real FeedbackSink) / `feedbackIn` are the feedback wire — both carrying LIVE signals over the transport.
/// A background pump demuxes inbound frames by channel into the two streams; `pump` resolves when the wire closes.
export interface FourCornerWire<TN, TF> {
  readonly sendNormal: (payload: TN) => Promise<void>;
  readonly feedbackOut: FeedbackSink<TF>;
  readonly close: () => Promise<void>;
  readonly normalIn: AsyncIterable<TN>;
  readonly feedbackIn: AsyncIterable<TF>;
  readonly pump: Promise<void>;
}

/// Present the four corners over a duplex endpoint: normal payloads ride `normal` frames, feedback rides
/// `feedback` frames, and inbound frames are demultiplexed by channel. This is where the feedback corners
/// stop being dark — `feedbackOut.push` actually crosses the wire and surfaces on the peer's `feedbackIn`.
export function fourCornerOverDuplex<TN, TF>(ep: DuplexEndpoint<TN, TF>): FourCornerWire<TN, TF> {
  const normalIn = asyncQueue<TN>();
  const feedbackIn = asyncQueue<TF>();
  const pump = (async () => {
    for await (const f of ep.inbound()) {
      if (f.channel === "normal") normalIn.push(f.payload);
      else if (f.channel === "feedback") feedbackIn.push(f.payload);
      else break; // close frame
    }
    normalIn.close();
    feedbackIn.close();
  })();
  return {
    sendNormal: (payload: TN) => ep.send({ channel: "normal", payload }),
    feedbackOut: { push: (signal: TF) => ep.send({ channel: "feedback", payload: signal }) },
    close: () => ep.send({ channel: "close" }),
    normalIn: normalIn.drain(),
    feedbackIn: feedbackIn.drain(),
    pump,
  };
}
