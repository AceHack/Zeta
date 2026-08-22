import { describe, it, expect } from "bun:test";
import {
  xorDistance,
  closerTo,
  bucketIndex,
  emptyTable,
  observeNode,
  allNodes,
  closest,
  expireNodes,
  encode,
  decode,
  answerFindNode,
  lookup,
  found,
  type DhtNode,
  type RoutingTable,
} from "./dht-discovery";
import { destinationHash } from "./reticulum-transport";

const node = (zid: string, t = 0): DhtNode => ({ dest: destinationHash(zid), zid, lastSeenMs: t });

// `dest` must be `destinationHash(zid)` or the fold refuses the record (address integrity, added
// 2026-08-22 — see `classifyDhtNode`). Ids are therefore no longer choosable, so the fixtures that
// used to write short literals (`{dest: "8000", zid: "a"}`) find their ids instead: a deterministic
// scan for the first zids whose destination hash lands in one shared k-bucket relative to self.
// Same property the literals were chosen for; the search has no rng, so it stays DST-replayable.
const SELF_ZID = "dht-self";
const SELF = destinationHash(SELF_ZID);
const SHARED_BUCKET = 3;

function peersInSharedBucket(count: number): DhtNode[] {
  const out: DhtNode[] = [];
  for (let i = 0; out.length < count; i++) {
    const zid = `dht-peer-${i}`;
    const dest = destinationHash(zid);
    if (bucketIndex(SELF, dest) === SHARED_BUCKET) out.push({ dest, zid, lastSeenMs: 0 });
  }
  return out;
}

describe("XOR distance metric", () => {
  it("distance to self is zero; identity of indiscernibles", () => {
    expect(xorDistance("abcd", "abcd")).toBe("0000");
    expect(xorDistance("f0", "0f")).toBe("ff");
  });
  it("closerTo orders by XOR distance", () => {
    // target 0000: 0001 is closer than 1000
    expect(closerTo("0000", "0001", "1000")).toBe(true);
    expect(closerTo("0000", "1000", "0001")).toBe(false);
  });
});

describe("bucketIndex — leading zero bits of the XOR distance", () => {
  it("counts shared prefix bits (far nodes → low bucket, near → high)", () => {
    // XOR("0000","8000") = 8000 → nibble 8 = 1000b → 0 leading zero bits
    expect(bucketIndex("0000", "8000")).toBe(0);
    // XOR("0000","1000") = 1000 → nibble 1 = 0001b → 3 leading zero bits
    expect(bucketIndex("0000", "1000")).toBe(3);
    // XOR("0000","0100") = 0100 → first nibble 0 (4 bits) + nibble 1 (3) = 7
    expect(bucketIndex("0000", "0100")).toBe(7);
  });
});

describe("observeNode — k-bucket insert, MRU refresh, oldest-eviction", () => {
  it("never inserts self", () => {
    // Self is a BOUND record, so this exercises the self-check rather than the address guard —
    // two different reasons to return the table unchanged, and a test that cannot tell them apart
    // would keep passing if the self-check were deleted.
    const self = node("self-node", 1);
    const t = emptyTable(self.dest, 4);
    expect(observeNode(t, self, 1)).toBe(t);
    // …and the same table DOES take a bound non-self record, so "returns t" is not the only outcome.
    expect(allNodes(observeNode(t, node("someone-else", 1), 1))).toHaveLength(1);
  });
  it("caps a bucket at k, evicting the least-recently-seen", () => {
    const [a, b, c] = peersInSharedBucket(3) as [DhtNode, DhtNode, DhtNode];
    let t: RoutingTable = emptyTable(SELF, 2);
    t = observeNode(t, a, 1);
    t = observeNode(t, b, 2);
    t = observeNode(t, c, 3); // the shared bucket is full at k=2 → evict the oldest, `a`
    expect(allNodes(t).map((n) => n.zid).sort()).toEqual([b.zid, c.zid].sort());
  });
  it("re-observing refreshes to most-recently-seen (moves to end, no duplicate)", () => {
    const [a, b, c] = peersInSharedBucket(3) as [DhtNode, DhtNode, DhtNode];
    let t: RoutingTable = emptyTable(SELF, 2);
    t = observeNode(t, a, 1);
    t = observeNode(t, b, 2);
    t = observeNode(t, a, 3); // refresh a → a now freshest
    t = observeNode(t, c, 4); // evict the oldest, which is now `b`
    expect(allNodes(t).map((n) => n.zid).sort()).toEqual([a.zid, c.zid].sort());
  });
});

describe("closest — k nearest by XOR, deterministic", () => {
  it("returns the count nearest to a target, tie-broken by dest", () => {
    // The ids are hashes now, so the expected answer is checked two ways rather than read off the
    // literals: against an independently-computed brute-force minimum, and against a pinned pair.
    const pool = ["c-0", "c-1", "c-2", "c-3"].map((z) => node(z, 1));
    let t: RoutingTable = emptyTable(SELF, 20);
    for (const n of pool) t = observeNode(t, n, 1);

    const bruteForce = [...pool]
      .map((n) => ({ n, d: xorDistance(n.dest, SELF) }))
      .sort((x, y) => (x.d < y.d ? -1 : x.d > y.d ? 1 : 0))
      .slice(0, 2)
      .map((x) => x.n.zid);

    const near = closest(t, SELF, 2);
    expect(near.map((n) => n.zid)).toEqual(bruteForce);
    expect(near.map((n) => n.zid)).toEqual(["c-1", "c-0"]); // pinned
  });
});

describe("expireNodes", () => {
  it("drops nodes unheard past the TTL", () => {
    let t: RoutingTable = emptyTable(SELF, 20);
    t = observeNode(t, node("expiring-peer", 1000), 1000);
    expect(allNodes(expireNodes(t, 1500, 1000))).toHaveLength(1);
    expect(allNodes(expireNodes(t, 3000, 1000))).toHaveLength(0);
  });
});

describe("decode — guarded", () => {
  it("round-trips and rejects junk", () => {
    const msg = { t: "findNode", target: "abcd", from: node("x") } as const;
    expect(decode(encode(msg))).toEqual(msg);
    expect(decode("nope")).toBeNull();
    expect(decode(JSON.stringify({ schema: "other", msg }))).toBeNull();
  });
});

// ── The heart: iterative lookup converges to a target beyond direct knowledge ──

/// A fake global network: each node id → its own routing table. `query` answers a findNode by
/// reading the queried node's table — exactly what the real transport would fetch over the wire.
function fakeNetwork(tables: Map<string, RoutingTable>, k: number) {
  return (n: DhtNode, target: string) => {
    const t = tables.get(n.dest);
    return t ? answerFindNode(t, target, k) : [];
  };
}

describe("lookup — reaches a target it did not directly know (multi-hop)", () => {
  it("S knows A, A knows T: lookup(S, T) walks S→A→T and finds T", () => {
    const S = node("source", 1);
    const A = node("relay", 1);
    const T = node("target", 1);
    const k = 8;
    // build the three nodes' tables: S only knows A; A only knows T; T knows nobody
    const tS = observeNode(emptyTable(S.dest, k), A, 1);
    const tA = observeNode(emptyTable(A.dest, k), T, 1);
    const tT = emptyTable(T.dest, k);
    const net = fakeNetwork(new Map([[S.dest, tS], [A.dest, tA], [T.dest, tT]]), k);

    // S's own table does NOT contain T
    expect(closest(tS, T.dest, k).some((n) => n.dest === T.dest)).toBe(false);
    // but the lookup discovers T by hopping through A
    const result = lookup(tS, T.dest, net, k);
    expect(found(result, T.dest)).toBeDefined();
  });
});

describe("lookup — converges to the true k-closest in a fully-connected network", () => {
  it("finds the exact target when the graph is reachable", () => {
    const ids = Array.from({ length: 12 }, (_, i) => node(`peer-${i}`, 1));
    const k = 4;
    // every node knows every other (fully connected) — lookup must still return the exact closest
    const tables = new Map<string, RoutingTable>();
    for (const self of ids) {
      let t = emptyTable(self.dest, k);
      for (const other of ids) if (other.dest !== self.dest) t = observeNode(t, other, 1);
      tables.set(self.dest, t);
    }
    const net = fakeNetwork(tables, k);
    const start = tables.get(ids[0]!.dest)!;
    const target = ids[11]!.dest;
    const result = lookup(start, target, net, k);
    expect(found(result, target)).toBeDefined();
    // and the result is genuinely sorted by closeness to the target
    for (let i = 1; i < result.length; i++) {
      expect(xorDistance(result[i - 1]!.dest, target) <= xorDistance(result[i]!.dest, target)).toBe(true);
    }
  });
});

describe("lookup — terminates and never regresses on a sparse ring", () => {
  it("returns nodes at least as close as the starting table's best", () => {
    const ids = Array.from({ length: 10 }, (_, i) => node(`ring-${i}`, 1));
    const k = 3;
    // each node knows only its 3 XOR-closest — a sparse graph
    const tables = new Map<string, RoutingTable>();
    for (const self of ids) {
      let t = emptyTable(self.dest, 20);
      const others = ids.filter((o) => o.dest !== self.dest);
      const near = [...others].sort((a, b) => (xorDistance(a.dest, self.dest) < xorDistance(b.dest, self.dest) ? -1 : 1)).slice(0, 3);
      for (const nkey of near) t = observeNode(t, nkey, 1);
      tables.set(self.dest, t);
    }
    const net = fakeNetwork(tables, k);
    const start = tables.get(ids[0]!.dest)!;
    const target = ids[5]!.dest;
    const startBest = closest(start, target, 1)[0]!;
    const result = lookup(start, target, net, k);
    // lookup never returns something worse than what we started knowing
    expect(xorDistance(result[0]!.dest, target) <= xorDistance(startBest.dest, target)).toBe(true);
    // and it terminated with a bounded result
    expect(result.length).toBeLessThanOrEqual(k);
  });
});
