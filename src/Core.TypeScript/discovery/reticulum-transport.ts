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
//   1. SELF-DESCRIBING ADDRESS — a destination hash derived from the ZetaId (RNS truncates
//      SHA-256 of the identity; here we hash the ZetaId the substrate already carries). The
//      address IS the identity's fingerprint — no registrar, no broker (dual-use §: it only
//      RECOGNIZES a destination, it does not authorize it).
//      This said "SELF-CERTIFYING" until 2026-08-21, and the word swap stated a real bug:
//      hashing a PUBLIC identifier is self-DESCRIBING, and certifies nothing — anyone can
//      compute it for anyone. Real RNS earns self-certification from `dest = H(pubkey)` PLUS
//      signed announces. Zeta's divergence (hash the ZetaId, not the key) is deliberate and
//      correct — it keeps address separate from identity, which `dest = H(pubkey)` conflates,
//      and it is what permits key rotation without address churn. The missing half was never
//      the design, only the verification: see `reticulum-announce-auth.ts`.
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

/// A DETACHED announce signature riding the frame. Ed25519 over the canonical bytes of the
/// IDENTITY CLAIM `(dest, zid)` only — never over `hops`, which every relay bumps. Produced and
/// checked by `reticulum-announce-auth.ts`; this module only carries it, and holds no crypto.
export interface AnnounceSig {
  readonly key_id: string;
  readonly sig: string;
}

/// A Reticulum frame on the wire: a self-announce piggyback + an optional inner payload (the
/// upper transport's own text — a discovery packet or an LLMTV frame). `fid` dedups relay.
export interface RnsFrame {
  readonly src: string; // sender destination hash
  readonly fid: string; // frame id (relay dedup)
  readonly announce: Announce; // presence rides every frame — the path stays fresh with traffic
  readonly asig?: AnnounceSig; // detached signature over the announce's identity claim
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
///
/// ADDRESS-INTEGRITY invariant: rejects announces where `dest !== destinationHash(zid)`,
/// UNCONDITIONALLY. This guard used to read `a.dest.length === 32 && ...`, which made it
/// skippable by anyone sending a `dest` of any other length — the escape hatch existed only
/// to keep older fold tests using short literal dests (`"d1"`) passing, and an attacker could
/// take it as easily as a test could. Those tests now use real hashes.
///
/// This is an integrity check on the ADDRESS, and it is NOT authentication of the IDENTITY:
/// `destinationHash` hashes a PUBLIC identifier, so anyone can mint a pair-consistent announce
/// for any zid they have seen. Authenticity requires a signature — `reticulum-announce-auth.ts`
/// is the membrane that provides it, and it re-checks this binding itself.
export function observeAnnounce(table: PathTable, a: Announce, nowMs: number): PathTable {
  // Address-integrity guard: the address must commit to the identity. No length exemption.
  if (destinationHash(a.zid) !== a.dest) {
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

/// The windowed-migration control for the SIGNED announce wire, shaped as the discriminated
/// union `llmtv-node.ts`'s `BeaconConfig` already established for the discovery wire — same
/// three modes, same "illegal states unrepresentable" discipline, so a reader who knows one
/// knows the other.
///
/// `verify` and `sign` are INJECTED (noninterference §13): this module holds no key material,
/// no trust store, and no crypto — the caller wires `reticulum-announce-auth.ts`'s
/// `verifyAnnounceDetached` / `signAnnounceDetached` with its own trust store, so the ONE
/// authority door is a declared input and the transport stays a pure carrier. It also keeps
/// the dependency one-way (auth → transport), so neither module imports the other in a cycle.
export type AnnounceAuthConfig =
  /// Legacy: carry no signature, verify nothing (the pre-migration steady state).
  | { readonly mode: "off" }
  /// The overlap window: sign outbound (if `sign` is set) and fold BOTH signed and legacy-
  /// unsigned announces. An UNSIGNED announce is folded and flagged via `onUnsigned`; a
  /// SIGNED-but-invalid one is dropped — never downgraded to the unsigned path.
  | {
      readonly mode: "dual";
      readonly sign?: (a: Announce) => AnnounceSig;
      readonly verify: (a: Announce, asig: AnnounceSig | undefined) => boolean;
      readonly onUnsigned?: (a: Announce) => void;
    }
  /// Post-cutover: sign outbound and fold ONLY announces that verify (sign + verify required).
  | {
      readonly mode: "required";
      readonly sign: (a: Announce) => AnnounceSig;
      readonly verify: (a: Announce, asig: AnnounceSig | undefined) => boolean;
    };

export interface ReticulumConfig {
  readonly zid: string;
  /// Relay frames from other destinations onto the lower layer (be a transport node — this is
  /// what bridges two meshes). Default true. A leaf node can set false.
  readonly relay?: boolean;
  /// Max hops a relayed announce may travel (loop/blast guard). Default 8 (RNS default).
  readonly maxHops?: number;
  /// Announce authenticity. **REQUIRED — there is no default.** It was optional-defaulting-to-
  /// `{mode:"off"}` until 2026-08-22, and that default was the whole of RESIDUAL 1: an `off`
  /// transport is exactly as forgeable as the pre-fix wire, and a caller that never wrote the
  /// field could not tell (nor could a reviewer reading the call site) whether it had chosen the
  /// legacy mode or merely inherited it. Making the field mandatory does not make anyone safer by
  /// itself — `{mode:"off"}` still typechecks — it makes the choice **visible and greppable** at
  /// every construction site, which is the difference between a consumer that is obviously not
  /// migrated and one that only looks migrated.
  ///
  /// It is done NOW because it is free now: at the time of writing NO production code constructs
  /// a Reticulum transport (measured — the only `createReticulumTransport` call sites in the repo
  /// are this module's own tests), so the change costs three test files and nothing else. After a
  /// fleet depends on the default it is unretrofittable, which is the same argument
  /// `.claude/rules/clone-at-tag-stays-sufficient.md` makes about `ace`.
  readonly announceAuth: AnnounceAuthConfig;
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
  const auth: AnnounceAuthConfig = config.announceAuth;
  // The field is REQUIRED, so an absent one can only arrive from plain JS (or a JSON config that
  // predates this change). Refuse it rather than inheriting the legacy mode: silently defaulting
  // to `off` is the exact failure RESIDUAL 1 named — a caller believing it is on a migrated wire
  // while carrying the pre-fix one.
  if (!auth || typeof auth.mode !== "string") {
    throw new Error("createReticulumTransport: announceAuth is required (fail-closed; there is no legacy default)");
  }
  // JS-boundary backstop (TS makes this unreachable — the union requires `verify` for both
  // non-off modes). Mirrors `llmtv-node`'s signer backstop for the discovery wire. Without it a
  // plain-JS caller passing `{mode:"required"}` with no `verify` gets a TypeError thrown from
  // inside `lower.onPacket` on the FIRST inbound packet — a security surface failing by exception
  // on a hostile wire, which is the one place `decode` was carefully written never to do. Fail
  // closed at construction instead, where the mistake is legible.
  if (auth.mode !== "off" && typeof auth.verify !== "function") {
    throw new Error(`createReticulumTransport: announceAuth mode '${auth.mode}' needs a verify function (fail-closed)`);
  }
  let paths: PathTable = new Map();
  const seenFids = new Set<string>(); // grow-only relay-dedup set (G-set)
  const messageHandlers: Array<(text: string, from: string) => void> = [];
  const frameHandlers: Array<(text: string, from: string) => void> = [];
  let fidSeq = 0;

  const selfAnnounce = (): Announce => ({ dest, zid: config.zid, hops: 0, id: `${dest}:${fidSeq}` });

  const wrap = (payload?: string): string => {
    fidSeq += 1;
    const fid = `${dest}:${fidSeq}`;
    const announce = selfAnnounce();
    // Sign our own identity claim when the window says to. `sign` is injected — this module
    // never touches key material, so it can sit behind a Keychain / Secure Enclave / HSM.
    const asig = auth.mode !== "off" && auth.sign ? auth.sign(announce) : undefined;
    const base: RnsFrame = asig === undefined ? { src: dest, fid, announce } : { src: dest, fid, announce, asig };
    const frame: RnsFrame = payload === undefined ? base : { ...base, payload };
    return encode(frame);
  };

  /// Does this announce get to enter the path fold? `"off"` admits everything (the pre-fix
  /// behaviour, kept only for the legacy window). `"required"` admits only what verifies.
  /// `"dual"` admits an UNSIGNED announce (flagged) but never a signed-and-INVALID one — an
  /// invalid signature is a stronger signal than no signature and must not be downgraded to it.
  const admitAnnounce = (a: Announce, asig: AnnounceSig | undefined): boolean => {
    if (auth.mode === "off") return true;
    if (auth.verify(a, asig)) return true;
    if (auth.mode === "dual" && asig === undefined) {
      auth.onUnsigned?.(a);
      return true;
    }
    return false;
  };

  lower.onPacket((text) => {
    const frame = decode(text);
    if (!frame) return; // not a Reticulum frame (or garbage)
    if (frame.src === dest) return; // our own loopback

    // 1. THE GATE — evaluated ONCE, and it governs the WHOLE frame.
    //
    // This is the gate the whole routing story rests on: an announce that is not authenticated
    // to the identity it claims is an Eclipse primitive, because a peer that can announce an
    // identity it does not hold fills this table with identities the attacker controls, and the
    // node's whole view of the mesh becomes whatever the attacker chose. No routing geometry
    // fixes that downstream, so it is refused here, before anything downstream of it runs.
    //
    // It used to guard the path fold ONLY, and the two other exits below were reached anyway.
    // That left a `"required"` node doing two things it had no business doing with a refused
    // announce: handing the payload upward attributed to `frame.announce.zid` (an UNVERIFIED
    // identity presented to the upper layer as the sender), and RELAYING the frame onward, so a
    // node that itself refused a forgery still amplified it to every peer it bridges. The
    // comment at the relay step even asserted the opposite — that under `"required"` only
    // admitted frames reached it — which was false when written. It is true now, by this return.
    if (!admitAnnounce(frame.announce, frame.asig)) return;

    // 2. learn the path from the piggybacked announce. `maxHops` here is the LOOP/BLAST guard
    // (an over-distance announce is not folded), never the auth guard — those are separate
    // questions and are kept separate so neither can be mistaken for the other.
    if (frame.announce.hops <= maxHops) {
      paths = observeAnnounce(paths, frame.announce, sched.now());
    }

    // 3. dedup: fold each frame id once (relay + delivery guard)
    if (seenFids.has(frame.fid)) return;
    seenFids.add(frame.fid);

    // 4. deliver the inner payload upward to BOTH families (schema tag disambiguates on decode).
    // Reached only for an ADMITTED announce, so `frame.announce.zid` — which is what the upper
    // layer receives as the sender — carries whatever authenticity the configured mode requires.
    if (frame.payload !== undefined) {
      for (const h of messageHandlers) h(frame.payload, frame.announce.zid);
      for (const h of frameHandlers) h(frame.payload, frame.announce.zid);
    }

    // 5. be a transport node: relay onward with an incremented hop count (bridges meshes).
    // The spread PRESERVES `asig` unchanged, which is the whole reason the signature covers
    // `(dest, zid)` and not `hops`: the next hop verifies the ORIGIN's key, not the relay's,
    // so a relay can carry an announce it cannot forge. Under a non-`"off"` mode this is reached
    // only for admitted announces — enforced by the early return at step 1, not merely asserted.
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
