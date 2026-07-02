// discovery-beacon — WS-Discovery reborn on the mesh, transport-agnostic (shadow*).
//
// Aaron 2026-07-02: the bus's zero-config bootstrap; "discovery is going to grow into
// multiple local and global DHT-like mechanisms over Reticulum — a system that can
// always discover itself if it's in broadcast range anywhere, even over the global
// internet." Design consequence: the PROTOCOL is transport-agnostic. UDP multicast is
// the FIRST transport, not the only one — the same Hello/Bye/Probe/ProbeMatch core
// serves LAN multicast, a Reticulum announce, or a DHT ping. Transports are injected
// (the `DiscoveryTransport` port); the core is pure.
//
// Lineage: WS-Discovery (OASIS Web Services Dynamic Discovery — Aaron's maintainer
// anchor; WCF System.ServiceModel.Discovery). Hello/Bye = presence beacons,
// Probe/ProbeMatch = find-a-peer. Disciplines: pure core (no ambient clock/socket —
// `nowMs` injected, noninterference §13); TEXT wire (JSON, no binary in the proof
// lineage); DST-replayable (same message+time sequence → same peer table).

/// The writer-actor bus address (persona ⊕ surface ⊕ instance ⊕ node) — a routing
/// facet, NOT identity (identity is the ZetaId; a bus address is not identity).
export interface EndpointRef {
  readonly persona: string;
  readonly surface: string;
  readonly instance: string;
  readonly node: string;
}

/// Where to reach a peer, per transport — the growth path (udp now; reticulum/dht next).
export interface RouteHint {
  readonly kind: "udp" | "reticulum" | "dht";
  readonly addr: string;
}

/// The discovery wire vocabulary (WS-Discovery lineage), transport-agnostic.
export type DiscoveryMessage =
  | { readonly t: "hello"; readonly ep: EndpointRef; readonly zid: string; readonly routes: readonly RouteHint[]; readonly seq: number }
  | { readonly t: "bye"; readonly ep: EndpointRef; readonly seq: number }
  | { readonly t: "probe"; readonly matchId: string; readonly scope?: Partial<EndpointRef> }
  | { readonly t: "probeMatch"; readonly inReplyTo: string; readonly ep: EndpointRef; readonly zid: string; readonly routes: readonly RouteHint[] };

const SCHEMA = "zeta.discovery.v1";

/// A discovered peer with the tick it was last heard (for TTL expiry).
export interface Peer {
  readonly ep: EndpointRef;
  readonly zid: string;
  readonly routes: readonly RouteHint[];
  readonly lastSeenMs: number;
}

export type PeerTable = ReadonlyMap<string, Peer>;

/// Stable key for an endpoint (the bus address flattened). Order-independent identity
/// of a routing facet.
export function endpointKey(ep: EndpointRef): string {
  return `${ep.persona}/${ep.surface}/${ep.instance}/${ep.node}`;
}

/// TEXT wire (JSON, no binary in the proof lineage) with a schema tag.
export function encode(msg: DiscoveryMessage): string {
  return JSON.stringify({ schema: SCHEMA, msg });
}

/// Guarded decode — foreign / malformed / wrong-schema input returns null, never throws
/// (a beacon receives arbitrary bytes off the wire; refuse, don't crash).
export function decode(text: string): DiscoveryMessage | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const p = parsed as { schema?: unknown; msg?: unknown };
  if (p.schema !== SCHEMA || typeof p.msg !== "object" || p.msg === null) return null;
  const m = p.msg as { t?: unknown };
  if (m.t === "hello" || m.t === "bye" || m.t === "probe" || m.t === "probeMatch") {
    return p.msg as DiscoveryMessage;
  }
  return null;
}

/// Does `ep` satisfy a partial probe scope? Every DEFINED scope field must equal ep's;
/// an empty scope matches everyone (ad-hoc discovery).
export function scopeMatches(ep: EndpointRef, scope?: Partial<EndpointRef>): boolean {
  if (!scope) return true;
  return (["persona", "surface", "instance", "node"] as const).every(
    (k) => scope[k] === undefined || scope[k] === ep[k],
  );
}

function upsert(table: PeerTable, peer: Peer): PeerTable {
  const next = new Map(table);
  next.set(endpointKey(peer.ep), peer);
  return next;
}

/// The pure discovery step: fold one inbound message into the peer table and compute
/// the replies to broadcast. `self` is this node's own endpoint (so it answers probes
/// that match it and never adds itself as a peer). `nowMs` is injected — no ambient
/// clock (noninterference). Deterministic: same (self, table, msg, nowMs) → same result.
export function observe(
  self: EndpointRef,
  table: PeerTable,
  msg: DiscoveryMessage,
  nowMs: number,
): { table: PeerTable; replies: readonly DiscoveryMessage[] } {
  switch (msg.t) {
    case "hello":
      if (endpointKey(msg.ep) === endpointKey(self)) return { table, replies: [] };
      return { table: upsert(table, { ep: msg.ep, zid: msg.zid, routes: msg.routes, lastSeenMs: nowMs }), replies: [] };
    case "bye": {
      if (!table.has(endpointKey(msg.ep))) return { table, replies: [] };
      const next = new Map(table);
      next.delete(endpointKey(msg.ep));
      return { table: next, replies: [] };
    }
    case "probe":
      // answer only if *I* match the probe's scope — I announce myself (ProbeMatch).
      if (!scopeMatches(self, msg.scope)) return { table, replies: [] };
      return { table, replies: [] }; // reply is built by the caller who holds self's zid/routes
    case "probeMatch":
      if (endpointKey(msg.ep) === endpointKey(self)) return { table, replies: [] };
      return { table: upsert(table, { ep: msg.ep, zid: msg.zid, routes: msg.routes, lastSeenMs: nowMs }), replies: [] };
  }
}

/// Build this node's ProbeMatch reply to a probe (caller supplies self's identity+routes).
export function probeMatchReply(
  self: EndpointRef,
  zid: string,
  routes: readonly RouteHint[],
  probe: Extract<DiscoveryMessage, { t: "probe" }>,
): DiscoveryMessage | null {
  return scopeMatches(self, probe.scope)
    ? { t: "probeMatch", inReplyTo: probe.matchId, ep: self, zid, routes }
    : null;
}

/// Drop peers unheard for longer than `ttlMs` (pure; `nowMs` injected). Expiry keeps
/// the table honest without an ambient timer — the caller ticks it.
export function expire(table: PeerTable, nowMs: number, ttlMs: number): PeerTable {
  const next = new Map<string, Peer>();
  for (const [k, p] of table) if (nowMs - p.lastSeenMs <= ttlMs) next.set(k, p);
  return next;
}

/// The injected transport port — the ONE declared channel entropy crosses
/// (noninterference §13). UDP multicast is the first impl; reticulum/dht are next.
/// The core never imports a socket; a transport is handed in.
export interface DiscoveryTransport {
  broadcast(text: string): void;
  onMessage(handler: (text: string, from: string) => void): void;
}
