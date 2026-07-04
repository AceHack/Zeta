// multiplexed-duplex-transport.ts — N four-corner channels over ONE physical transport, ZetaId-keyed (shadow*).
//
// Aaron 2026-07-04: "GUID-keyed — I think we should use ZetaIds, they're our universal pointers; we can make
// a category just for this. In our 128-bit ids it's a little program — every ZetaId — the system will know
// how to decode on the other side." So this is the merge of the two prior bricks: the four-corner framing
// (duplex-transport.ts) + the maintainer's own MultiplexedWebSockets (many logical channels over one physical
// socket), but keyed by a **ZetaId** instead of a GUID. A GUID is an opaque random token; a ZetaId is a
// SELF-DESCRIBING 128-bit pointer whose `Category` nibble (= `Category.Channel`, added 2026-07-04) tells the
// far side "this is a channel" — the id carries its own decode. Each logical channel is a virtual
// `DuplexEndpoint` over the shared physical one, so ALL the four-corner machinery (normal+feedback corners,
// mid-stream interrupt, close) works per-channel unchanged — this layer only wraps/unwraps the channel
// envelope and routes by ZetaId. Reuses `fourCornerOverDuplex`; the physical endpoint can be `localDuplexPair`
// (deterministic) or a real socket (`webSocketEndpoint`), so the multiplex rides any transport.
//
// Byte-lock note: `Category.Channel = 11` is added to `registry/categories.yaml` + the TS ZetaId oracle here;
// the C#/F# ZetaId oracles lag (they also predate `InventoryAsset = 10`) — backfilling both + regenerating
// golden vectors so all four oracles agree is a tracked follow-up (this brick is TS-only and does not claim
// cross-oracle byte-lock on the new category).

import { type DuplexEndpoint, type Frame, type FourCornerWire, fourCornerOverDuplex } from "./duplex-transport.ts";
import { Category, type ZetaId } from "../zeta-id/types.ts";
import { fromHex, toHex } from "../zeta-id/encoding.ts";

// Bit offsets from docs/zeta-id-v1-layout.yaml (Version @123 w5, Category @65 w4, Firefly @64 w1).
const VERSION_OFFSET = 123n;
const CATEGORY_OFFSET = 65n;
const FIREFLY_OFFSET = 64n;
const DISCRIMINATOR_BITS = 48n;

/// Mint a channel ZetaId: Version=1, Category=Channel, Firefly=NoDirective(1), + a unique discriminator in
/// the low bits. This is a TRANSPORT KEY, not a fully-populated observation id — the semantically-load-bearing
/// fields are Version+Category+Firefly (so the far side decodes `Category.Channel` and knows it's a channel);
/// the discriminator makes it unique. `seq` supplies the uniqueness (a monotonic counter — deterministic, no
/// ambient clock/RNG, DST-friendly; a production mint can put a timestamp there instead).
export function mintChannelId(seq: bigint): ZetaId {
  const discriminator = seq & ((1n << DISCRIMINATOR_BITS) - 1n);
  const id = (1n << VERSION_OFFSET) | (BigInt(Category.Channel) << CATEGORY_OFFSET) | (1n << FIREFLY_OFFSET) | discriminator;
  return id as ZetaId;
}

/// Read the `Category` nibble out of a ZetaId (so a receiver can confirm `Category.Channel` before opening).
export function categoryOf(id: ZetaId): number {
  return Number((id >> CATEGORY_OFFSET) & 0xfn);
}

/// The multiplex envelope on the physical wire: the channel key (ZetaId hex) + the inner four-corner frame.
export interface MuxFrame {
  readonly chan: string; // ZetaId hex — the self-describing channel key
  readonly inner: Frame<unknown, unknown>; // the four-corner frame for that channel
}

/// A logical channel: its ZetaId + the four-corner wire (normal/feedback corners) scoped to that channel.
export interface MuxChannel<TN, TF> {
  readonly id: ZetaId;
  readonly wire: FourCornerWire<TN, TF>;
}

/// N four-corner channels over one physical transport. `open` starts a channel (minting a ZetaId if none
/// given); `accepted` yields channels the PEER opened (first frame on a not-yet-seen ZetaId); `pump` resolves
/// when the physical transport closes.
export interface MultiplexedTransport<TN, TF> {
  open(channelId?: ZetaId): MuxChannel<TN, TF>;
  readonly accepted: AsyncIterable<MuxChannel<TN, TF>>;
  readonly pump: Promise<void>;
}

/// A single-consumer async queue (same shape as the sibling transports): push non-blocking, drain until close.
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

/// Multiplex N four-corner channels over one physical `DuplexEndpoint`, keyed by ZetaId. The physical
/// endpoint carries `MuxFrame`s as its normal payload; each channel is a virtual endpoint whose frames are
/// wrapped `{ chan, inner }` and routed back by ZetaId hex. `mint` supplies channel ids (default: a monotonic
/// counter — deterministic; inject a timestamp-based mint in production).
export function multiplexedDuplexTransport<TN, TF>(physical: DuplexEndpoint<MuxFrame, never>, mint: (seq: bigint) => ZetaId = mintChannelId): MultiplexedTransport<TN, TF> {
  const channels = new Map<string, { inbox: ReturnType<typeof asyncQueue<Frame<TN, TF>>>; channel: MuxChannel<TN, TF> }>();
  const accepted = asyncQueue<MuxChannel<TN, TF>>();
  let seq = 0n;

  const makeChannel = (id: ZetaId): MuxChannel<TN, TF> => {
    const hex = toHex(id);
    const existing = channels.get(hex);
    if (existing) return existing.channel;
    const inbox = asyncQueue<Frame<TN, TF>>();
    const endpoint: DuplexEndpoint<TN, TF> = {
      send: (frame: Frame<TN, TF>) => physical.send({ channel: "normal", payload: { chan: hex, inner: frame } }),
      inbound: () => inbox.drain(),
    };
    const channel: MuxChannel<TN, TF> = { id, wire: fourCornerOverDuplex(endpoint) };
    channels.set(hex, { inbox, channel });
    return channel;
  };

  const closeAll = () => {
    for (const { inbox } of channels.values()) inbox.close();
    accepted.close();
  };

  const pump = (async () => {
    for await (const pf of physical.inbound()) {
      if (pf.channel === "close") break;
      if (pf.channel !== "normal") continue; // physical feedback wire unused by the mux layer
      const mf = pf.payload;
      let entry = channels.get(mf.chan);
      if (!entry) {
        const channel = makeChannel(fromHex(mf.chan)); // a channel the PEER opened
        entry = channels.get(mf.chan);
        accepted.push(channel);
      }
      if (entry) entry.inbox.push(mf.inner as Frame<TN, TF>);
    }
    closeAll();
  })();

  return {
    open(channelId?: ZetaId): MuxChannel<TN, TF> {
      const id = channelId ?? mint(++seq);
      return makeChannel(id);
    },
    accepted: accepted.drain(),
    pump,
  };
}
