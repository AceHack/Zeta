// dht-discovery — global path discovery over the mesh: Kademlia on destination hashes (shadow*).
//
// Aaron 2026-07-02: "our discovery is going to grow into multiple local and global DHT-like
// mechanisms over Reticulum — a system that can always discover itself if it's in broadcast
// range anywhere, even over the global internet." Announce (reticulum-transport.ts) gives
// LOCAL presence — you learn who is in earshot. This is the layer ABOVE it: a Kademlia DHT
// keyed on the self-certifying destination hash, so a node can FIND a destination that is
// beyond direct announce range by walking the network toward it.
//
// Kademlia (Maymounkov & Mazières, 2002): node id = the destination hash; distance = XOR;
// a k-bucket routing table holds, per distance shell, the k most-recently-seen nodes; a
// lookup iteratively queries the closest-known nodes for ones closer still, converging on
// the k closest to the target. XOR distance makes "closest" a metric and makes the routing
// table O(log n) deep.
//
// Disciplines: PURE, DST-replayable — the lookup driver takes an INJECTED query function
// (no ambient network), so convergence is tested deterministically over a fake global graph;
// the real async transport wraps `query` at the edge (noninterference §13). Node ids are the
// deterministic destination hashes (no rng — Kademlia's random ids become byte-locked here).
// TEXT wire (findNode/foundNodes are JSON). The routing table grows/refreshes idempotently.

import type { RouteHint } from "./discovery-beacon";

/// A node known to the DHT — its self-certifying destination hash, the identity behind it, an
/// optional route hint (how to physically reach it), and when it was last heard (MRU / TTL).
export interface DhtNode {
  readonly dest: string; // destination hash = node id (hex; see reticulum-transport.destinationHash)
  readonly zid: string;
  readonly route?: RouteHint;
  readonly lastSeenMs: number;
}

const HEX_BITS = 4;

function hexVal(ch: string): number {
  const code = ch.charCodeAt(0);
  if (code >= 48 && code <= 57) return code - 48; // 0-9
  if (code >= 97 && code <= 102) return code - 87; // a-f
  if (code >= 65 && code <= 70) return code - 55; // A-F
  return 0;
}

/// XOR distance between two equal-length hex ids, as a fixed-width hex string. Same width →
/// lexicographic comparison of the result IS numeric comparison of the distance (the metric).
export function xorDistance(a: string, b: string): string {
  const n = Math.min(a.length, b.length);
  let out = "";
  for (let i = 0; i < n; i++) out += (hexVal(a[i]!) ^ hexVal(b[i]!)).toString(16);
  return out;
}

/// True if `a` is strictly closer to `target` than `b` (smaller XOR distance).
export function closerTo(target: string, a: string, b: string): boolean {
  return xorDistance(a, target) < xorDistance(b, target);
}

/// The k-bucket index for a node relative to self: the number of leading zero BITS in the XOR
/// distance (the length of the shared id prefix). Nodes far from self share few prefix bits →
/// low bucket index; nodes near self → high index. Range 0..(4·idLen − 1).
export function bucketIndex(self: string, node: string): number {
  const d = xorDistance(self, node);
  let bits = 0;
  for (let i = 0; i < d.length; i++) {
    const nibble = hexVal(d[i]!);
    if (nibble === 0) {
      bits += HEX_BITS;
      continue;
    }
    // leading zero bits within this nonzero nibble
    let mask = 1 << (HEX_BITS - 1);
    while (mask > 0 && (nibble & mask) === 0) {
      bits += 1;
      mask >>= 1;
    }
    return bits;
  }
  return bits; // identical ids (distance 0) — self
}

export interface RoutingTable {
  readonly self: string;
  readonly k: number;
  readonly buckets: ReadonlyMap<number, readonly DhtNode[]>;
}

export function emptyTable(self: string, k = 20): RoutingTable {
  return { self, k, buckets: new Map() };
}

/// Fold a node into the routing table: MRU order within its k-bucket (a re-heard node moves to
/// the end = freshest), and if the bucket is full the OLDEST (least-recently-seen) is evicted —
/// Kademlia's preference for long-lived nodes. Never inserts self. Idempotent per (dest, time):
/// re-observing refreshes rather than duplicates.
export function observeNode(table: RoutingTable, node: DhtNode, nowMs: number): RoutingTable {
  if (node.dest === table.self) return table;
  const idx = bucketIndex(table.self, node.dest);
  const bucket = table.buckets.get(idx) ?? [];
  const withoutNode = bucket.filter((n) => n.dest !== node.dest);
  const refreshed: DhtNode = { ...node, lastSeenMs: nowMs };
  let next = [...withoutNode, refreshed]; // append = most-recently-seen at the end
  if (next.length > table.k) next = next.slice(next.length - table.k); // evict oldest (front)
  const buckets = new Map(table.buckets);
  buckets.set(idx, next);
  return { ...table, buckets };
}

/// Every node currently known, flattened across buckets.
export function allNodes(table: RoutingTable): readonly DhtNode[] {
  const out: DhtNode[] = [];
  for (const bucket of table.buckets.values()) out.push(...bucket);
  return out;
}

/// The `count` known nodes closest (by XOR distance) to `target`. Deterministic tie-break by
/// dest hash so the order is stable (DST).
export function closest(table: RoutingTable, target: string, count: number): readonly DhtNode[] {
  return [...allNodes(table)]
    .sort((a, b) => {
      const da = xorDistance(a.dest, target);
      const db = xorDistance(b.dest, target);
      if (da < db) return -1;
      if (da > db) return 1;
      return a.dest < b.dest ? -1 : a.dest > b.dest ? 1 : 0;
    })
    .slice(0, count);
}

/// Drop nodes unheard past the TTL (pure; `nowMs` injected).
export function expireNodes(table: RoutingTable, nowMs: number, ttlMs: number): RoutingTable {
  const buckets = new Map<number, readonly DhtNode[]>();
  for (const [idx, bucket] of table.buckets) {
    const live = bucket.filter((n) => nowMs - n.lastSeenMs <= ttlMs);
    if (live.length > 0) buckets.set(idx, live);
  }
  return { ...table, buckets };
}

/// The DHT wire vocabulary: ask a node for its closest-known to a target; it answers with them.
export type DhtMessage =
  | { readonly t: "findNode"; readonly target: string; readonly from: DhtNode }
  | { readonly t: "foundNodes"; readonly target: string; readonly nodes: readonly DhtNode[] };

const SCHEMA = "zeta.dht.v1";

export function encode(msg: DhtMessage): string {
  return JSON.stringify({ schema: SCHEMA, msg });
}

export function decode(text: string): DhtMessage | null {
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
  if (m.t === "findNode" || m.t === "foundNodes") return p.msg as DhtMessage;
  return null;
}

/// A node's answer to a findNode: its own `count` closest-known to the target. This is what a
/// queried peer runs; the querier folds the results and asks the newly-learned closer nodes.
export function answerFindNode(table: RoutingTable, target: string, count: number): readonly DhtNode[] {
  return closest(table, target, count);
}

/// The iterative lookup — the heart of Kademlia. Starting from our own closest-known, query the
/// α closest un-queried nodes for ones closer still, fold their answers, and repeat until a round
/// surfaces nothing closer (converged). Returns the k closest to `target` we could reach.
///
/// `query(node, target)` is INJECTED and SYNCHRONOUS for the pure algorithm — in tests it reads
/// a fake global graph; the real async transport (findNode → foundNodes round trip) wraps it at
/// the edge. This keeps convergence deterministic and DST-replayable. `alpha` is the parallelism
/// width (Kademlia's concurrency knob; default 3).
export function lookup(
  table: RoutingTable,
  target: string,
  query: (node: DhtNode, target: string) => readonly DhtNode[],
  k = table.k,
  alpha = 3,
): readonly DhtNode[] {
  const queried = new Set<string>();
  const known = new Map<string, DhtNode>();
  for (const n of closest(table, target, k)) known.set(n.dest, n);

  const rank = (nodes: Iterable<DhtNode>): DhtNode[] =>
    [...nodes].sort((a, b) => {
      const da = xorDistance(a.dest, target);
      const db = xorDistance(b.dest, target);
      if (da < db) return -1;
      if (da > db) return 1;
      return a.dest < b.dest ? -1 : a.dest > b.dest ? 1 : 0;
    });

  for (;;) {
    const shortlist = rank(known.values()).slice(0, k);
    const toQuery = shortlist.filter((n) => !queried.has(n.dest)).slice(0, alpha);
    if (toQuery.length === 0) break; // every close node queried — converged

    const beforeClosest = shortlist[0]?.dest;
    for (const n of toQuery) {
      queried.add(n.dest);
      for (const found of query(n, target)) {
        if (found.dest !== table.self && !known.has(found.dest)) known.set(found.dest, found);
      }
    }
    const afterClosest = rank(known.values())[0]?.dest;
    // keep going as long as new nodes appeared to query; convergence is the toQuery-empty break.
    // (afterClosest tracked only to document progress; the queried-set guarantees termination.)
    void beforeClosest;
    void afterClosest;
  }

  return rank(known.values()).slice(0, k);
}

/// Did the lookup actually reach the target (an exact destination match among the closest)?
export function found(nodes: readonly DhtNode[], target: string): DhtNode | undefined {
  return nodes.find((n) => n.dest === target);
}
