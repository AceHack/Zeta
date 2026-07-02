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
    const t = emptyTable("self-dest", 4);
    expect(observeNode(t, { dest: "self-dest", zid: "z", lastSeenMs: 1 }, 1)).toBe(t);
  });
  it("caps a bucket at k, evicting the least-recently-seen", () => {
    // ids that all land in the same bucket relative to self "0000": pick ids differing in the top nibble
    let t: RoutingTable = emptyTable("0000", 2);
    t = observeNode(t, { dest: "8000", zid: "a", lastSeenMs: 1 }, 1);
    t = observeNode(t, { dest: "9000", zid: "b", lastSeenMs: 2 }, 2);
    t = observeNode(t, { dest: "a000", zid: "c", lastSeenMs: 3 }, 3); // bucket 0 full at k=2 → evict oldest "8000"
    const dests = allNodes(t).map((n) => n.dest).sort();
    expect(dests).toEqual(["9000", "a000"]);
  });
  it("re-observing refreshes to most-recently-seen (moves to end, no duplicate)", () => {
    let t: RoutingTable = emptyTable("0000", 2);
    t = observeNode(t, { dest: "8000", zid: "a", lastSeenMs: 1 }, 1);
    t = observeNode(t, { dest: "9000", zid: "b", lastSeenMs: 2 }, 2);
    t = observeNode(t, { dest: "8000", zid: "a", lastSeenMs: 3 }, 3); // refresh a → a now freshest
    t = observeNode(t, { dest: "a000", zid: "c", lastSeenMs: 4 }, 4); // evict oldest, which is now "9000"
    const dests = allNodes(t).map((n) => n.dest).sort();
    expect(dests).toEqual(["8000", "a000"]);
  });
});

describe("closest — k nearest by XOR, deterministic", () => {
  it("returns the count nearest to a target, tie-broken by dest", () => {
    let t: RoutingTable = emptyTable("0000", 20);
    for (const d of ["1000", "2000", "0100", "f000"]) t = observeNode(t, { dest: d, zid: d, lastSeenMs: 1 }, 1);
    const near = closest(t, "0000", 2).map((n) => n.dest);
    expect(near).toEqual(["0100", "1000"]); // 0100 (dist 0100) then 1000 (dist 1000)
  });
});

describe("expireNodes", () => {
  it("drops nodes unheard past the TTL", () => {
    let t: RoutingTable = emptyTable("0000", 20);
    t = observeNode(t, { dest: "1000", zid: "a", lastSeenMs: 1000 }, 1000);
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
