// reticulum-transport — the mesh proper: RNS addressing + announce, over any lower layer.
//
// Aaron 2026-07-02: "our discovery is going to grow into multiple local and global DHT-like
// mechanisms over Reticulum — a system that can always discover itself if it's in broadcast
// range anywhere, even over the global internet." UDP multicast (udp-transport.ts) is the
// FIRST transport and reaches one LAN segment; Reticulum is how the mesh spans links,
// bridges strangers (there are no strangers — travelers), and routes globally with no broker.
//
// This is the RNS SEMANTIC layer, pure and transport-agnostic, sitting BETWEEN the node and
// a physical packet layer:
//
//     llmtv-node ──(DiscoveryTransport / BroadcastTransport)──► reticulum-transport
//                                                                     │
//                                          (PacketTransport: UDP now, rnsd/TCP or fake next)
//
// It adds the two things Reticulum gives that raw multicast does not:
//   1. SELF-CERTIFYING ADDRESS — a destination hash derived from the ZetaId (RNS truncates
//      SHA-256 of the identity; here we hash the ZetaId the substrate already carries). The
//      address IS the identity's fingerprint — no registrar, no broker (dual-use §: it only
//      RECOGNIZES a destination, it does not authorize it).
//   2. ANNOUNCE + PATH TABLE — a destination advertises itself; announces propagate hop-by-
//      hop; each node folds them into a path table (dest → best hop count). A node that
//      relays announces/frames it has not seen IS a transport node — that is how two
//      physically separate meshes MERGE when they meet (G-set of seen frame ids; the join is
//      union, no merge code — "there are no strangers").
//
// Disciplines: pure core (nowMs injected, no ambient clock); TEXT wire (JSON, no binary in
// the proof lineage); path fold is best-hop + refresh (idempotent §12; announces redelivered
// converge); relay dedup is a grow-only set (idempotent, order-independent → DST §7); the
// physical rnsd binding is the later impure edge, exactly as udp-transport.ts is for UDP.

import { createHash } from "node:crypto";
import type { DiscoveryTransport } from "./discovery-beacon";
import type { BroadcastTransport } from "./llmtv-broadcast";

/// The lower physical layer the Reticulum transport rides — a raw packet pipe. UDP multicast,
/// a TCP link to `rnsd`, or an in-memory fake all satisfy it. The ONLY door entropy crosses
/// (noninterference §13); the Reticulum core imports no socket.
export interface PacketTransport {
  sendPacket(text: string): void;
  onPacket(handler: (text: string, from: string) => void): void;
}

/// Reticulum destination hash — the self-certifying address. RNS truncates SHA-256 of the
/// destination identity to 16 bytes; we hash the ZetaId the substrate already carries. Same
/// ZetaId → same destination, on every node (deterministic, byte-locked).
export function destinationHash(zid: string): string {
  return createHash("sha256").update(zid).digest("hex").slice(0, 32); // 16 bytes as 32 hex chars
}

/// An announce — a destination advertising itself. Propagates hop-by-hop; each relay bumps
/// `hops`. `id` dedups it for relay (a grow-only set: the same announce is folded once).
export interface Announce {
  readonly dest: string;
  readonly zid: string;
  readonly hops: number;
  readonly id: string;
}

/// A Reticulum frame on the wire: a self-announce piggyback + an optional inner payload (the
/// upper transport's own text — a discovery packet or an LLMTV frame). `fid` dedups relay.
export interface RnsFrame {
  readonly src: string; // sender destination hash
  readonly fid: string; // frame id (relay dedup)
  readonly announce: Announce; // presence rides every frame — the path stays fresh with traffic
  readonly payload?: string; // the inner DiscoveryTransport/BroadcastTransport text
}

/// A learned path — the best (lowest-hop) known route to a destination, with the tick it was
/// refreshed (for TTL).
export interface Path {
  readonly dest: string;
  readonly zid: string;
  readonly hops: number;
  readonly lastSeenMs: number;
}

export type PathTable = ReadonlyMap<string, Path>;

const SCHEMA = "zeta.reticulum.v1";

/// Fold one announce into the path table: keep the LOWEST hop count (best path), and always
/// refresh `lastSeenMs` on a re-hear so a live-but-not-closer path does not expire. Idempotent
/// and order-independent — redelivered/out-of-order announces converge to the same table.
/// Self-certifying address invariant: rejects announces where dest !== destinationHash(zid).
export function observeAnnounce(table: PathTable, a: Announce, nowMs: number): PathTable {
  // Self-certifying address verification guard: reject spoofed / hijacked destination hashes!
  if (a.dest.length === 32 && destinationHash(a.zid) !== a.dest) {
    return table;
  }

  const cur = table.get(a.dest);
  if (cur && a.hops >= cur.hops) {
    // not a better path — just refresh liveness (never lose a still-live route)
    const next = new Map(table);
    next.set(a.dest, { ...cur, lastSeenMs: nowMs });
    return next;
  }
  const next = new Map(table);
  next.set(a.dest, { dest: a.dest, zid: a.zid, hops: a.hops, lastSeenMs: nowMs });
  return next;
}

/// Drop paths unheard past the TTL (pure; `nowMs` injected).
export function expirePaths(table: PathTable, nowMs: number, ttlMs: number): PathTable {
  const next = new Map<string, Path>();
  for (const [k, p] of table) if (nowMs - p.lastSeenMs <= ttlMs) next.set(k, p);
  return next;
}

/// TEXT wire (JSON, no binary in the proof lineage) with a schema tag.
export function encode(frame: RnsFrame): string {
  return JSON.stringify({ schema: SCHEMA, frame });
}

/// Guarded decode — foreign / malformed / wrong-schema input returns null, never throws.
export function decode(text: string): RnsFrame | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const p = parsed as { schema?: unknown; frame?: unknown };
  if (p.schema !== SCHEMA || typeof p.frame !== "object" || p.frame === null) return null;
  const f = p.frame as { src?: unknown; fid?: unknown; announce?: unknown };
  if (typeof f.src !== "string" || typeof f.fid !== "string" || typeof f.announce !== "object" || f.announce === null) return null;
  return p.frame as RnsFrame;
}

export interface ReticulumConfig {
  readonly zid: string;
  /// Relay frames from other destinations onto the lower layer (be a transport node — this is
  /// what bridges two meshes). Default true. A leaf node can set false.
  readonly relay?: boolean;
  /// Max hops a relayed announce may travel (loop/blast guard). Default 8 (RNS default).
  readonly maxHops?: number;
}

export interface ReticulumTransport extends DiscoveryTransport, BroadcastTransport {
  /// This node's self-certifying destination hash.
  readonly dest: string;
  /// The learned routes (dest hash → best path). Grows as announces arrive; the live mesh map.
  paths(): PathTable;
  /// Expire stale paths (caller ticks it with an injected clock).
  gc(nowMs: number, ttlMs: number): void;
}

/// Wrap a lower packet transport in the Reticulum semantic layer. `sched.now` supplies the
/// clock for path freshness (injected — no ambient time). Every outgoing broadcast/publish
/// piggybacks this node's announce (presence rides traffic); every inbound frame folds the
/// announce into the path table, delivers the inner payload upward, and — if `relay` — re-
/// sends unseen frames so the mesh bridges. `fidSeq` makes frame ids deterministic (no rng).
export function createReticulumTransport(
  config: ReticulumConfig,
  lower: PacketTransport,
  sched: { now(): number },
): ReticulumTransport {
  const dest = destinationHash(config.zid);
  const relay = config.relay ?? true;
  const maxHops = config.maxHops ?? 8;
  let paths: PathTable = new Map();
  const seenFids = new Set<string>(); // grow-only relay-dedup set (G-set)
  const messageHandlers: Array<(text: string, from: string) => void> = [];
  const frameHandlers: Array<(text: string, from: string) => void> = [];
  let fidSeq = 0;

  const selfAnnounce = (): Announce => ({ dest, zid: config.zid, hops: 0, id: `${dest}:${fidSeq}` });

  const wrap = (payload?: string): string => {
    fidSeq += 1;
    const fid = `${dest}:${fidSeq}`;
    const frame: RnsFrame =
      payload === undefined
        ? { src: dest, fid, announce: selfAnnounce() }
        : { src: dest, fid, announce: selfAnnounce(), payload };
    return encode(frame);
  };

  lower.onPacket((text) => {
    const frame = decode(text);
    if (!frame) return; // not a Reticulum frame (or garbage)
    if (frame.src === dest) return; // our own loopback

    // 1. learn the path from the piggybacked announce
    if (frame.announce.hops <= maxHops) {
      paths = observeAnnounce(paths, frame.announce, sched.now());
    }

    // 2. dedup: fold each frame id once (relay + delivery guard)
    if (seenFids.has(frame.fid)) return;
    seenFids.add(frame.fid);

    // 3. deliver the inner payload upward to BOTH families (schema tag disambiguates on decode)
    if (frame.payload !== undefined) {
      for (const h of messageHandlers) h(frame.payload, frame.announce.zid);
      for (const h of frameHandlers) h(frame.payload, frame.announce.zid);
    }

    // 4. be a transport node: relay onward with an incremented hop count (bridges meshes)
    if (relay && frame.announce.hops < maxHops) {
      const bumped: RnsFrame = { ...frame, announce: { ...frame.announce, hops: frame.announce.hops + 1 } };
      lower.sendPacket(encode(bumped));
    }
  });

  const send = (payload: string): void => lower.sendPacket(wrap(payload));

  return {
    dest,
    broadcast: send,
    publish: send,
    onMessage: (h) => messageHandlers.push(h),
    onFrame: (h) => frameHandlers.push(h),
    paths: () => paths,
    gc: (nowMs, ttlMs) => {
      paths = expirePaths(paths, nowMs, ttlMs);
    },
  };
}
