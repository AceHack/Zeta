/**
 * dht-discovery.adversarial.test.ts — the address-integrity membrane on the Kademlia wire.
 *
 * Closes RESIDUAL 3 of the `docs/BUGS.md` Reticulum-announce entry: `DhtNode` carried `dest` and
 * `zid` as two independent fields, `observeNode` never checked that they were the same claim, and
 * `lookup` folded peer-supplied `foundNodes` straight into its shortlist. A peer answering a
 * findNode could therefore seed a querier's routing table with ARBITRARY (dest, zid) pairs.
 *
 * BOTH DIRECTIONS, everywhere. A validator that refuses everything passes every forgery test and
 * is useless — worse than useless, because it looks like a control. So every refusal here is
 * paired with the genuine record that must still be ADMITTED, and the two Kademlia properties the
 * guard could plausibly break (a lookup converging, a relay-through hop) are asserted to still
 * hold. `reject-everything` must fail this file loudly.
 *
 * WHAT THIS DOES NOT CLAIM. `destinationHash` hashes a PUBLIC identifier, so a pair-consistent
 * record is mintable by anyone for any zid they have seen. This is integrity of the ADDRESS, not
 * authenticity of the IDENTITY — the same measured limit `reticulum-announce-auth.ts` records for
 * the announce wire, where only a signature closes it. Tests below assert the LIMIT too, so the
 * membrane is not read as more than it is.
 */

import { describe, expect, it } from "bun:test";
import {
  admissibleNodes,
  allNodes,
  answerFindNode,
  bucketIndex,
  classifyDhtNode,
  closest,
  emptyTable,
  found,
  isAddressBound,
  lookup,
  observeNode,
  type DhtNode,
  type DhtNodeRefuseReason,
  type RoutingTable,
} from "./dht-discovery";
import { destinationHash } from "./reticulum-transport";

const node = (zid: string, t = 0): DhtNode => ({ dest: destinationHash(zid), zid, lastSeenMs: t });

/** A record that claims someone else's address under its own identity — the forgery. */
const impersonate = (victimZid: string, asZid: string, t = 0): DhtNode => ({
  dest: destinationHash(victimZid),
  zid: asZid,
  lastSeenMs: t,
});

/** A record that plants a victim's identity at an id of the attacker's choosing. */
const displace = (victimZid: string, atDest: string, t = 0): DhtNode => ({
  dest: atDest,
  zid: victimZid,
  lastSeenMs: t,
});

const SELF = node("adv-self");

describe("classifyDhtNode — the address must commit to the identity", () => {
  it("ADMITS a genuine record", () => {
    expect(classifyDhtNode(node("alice"))).toEqual({ ok: true });
    expect(isAddressBound(node("alice"))).toBe(true);
  });

  it("refuses a record carrying someone else's dest", () => {
    expect(classifyDhtNode(impersonate("alice", "mallory"))).toEqual({ ok: false, reason: "dest-not-bound" });
  });

  it("refuses a victim identity planted at an attacker-chosen id", () => {
    // The other half of the same defect: not "who is at alice's address" but "where is alice".
    // Kademlia's whole geometry is that a node's id IS its destination hash; an unbound pair lets
    // an attacker choose the XOR neighbourhood a victim's identity appears in.
    expect(classifyDhtNode(displace("alice", destinationHash("mallory")))).toEqual({
      ok: false,
      reason: "dest-not-bound",
    });
  });

  it("has NO length escape hatch — a short dest is refused like any other", () => {
    // The announce-side guard once read `dest.length === 32 && ...`, so any dest of another length
    // skipped the check entirely. Anything shaped like the old test literals must be refused now.
    expect(classifyDhtNode({ dest: "8000", zid: "a", lastSeenMs: 0 })).toEqual({ ok: false, reason: "dest-not-bound" });
    expect(classifyDhtNode({ dest: "", zid: "a", lastSeenMs: 0 })).toEqual({ ok: false, reason: "dest-not-bound" });
    expect(classifyDhtNode({ dest: "d1", zid: "zid-d1", lastSeenMs: 0 })).toEqual({
      ok: false,
      reason: "dest-not-bound",
    });
  });

  it("is total on a hostile wire — malformed input gets a verdict, never a throw", () => {
    const junk: unknown[] = [
      null,
      undefined,
      42,
      "not-a-node",
      {},
      { dest: "abc" },
      { dest: 1, zid: "a", lastSeenMs: 0 },
      { dest: "abc", zid: 7, lastSeenMs: 0 },
      { dest: "abc", zid: "a", lastSeenMs: "soon" },
      { dest: "abc", zid: "a", lastSeenMs: Number.NaN },
      { dest: "abc", zid: "a", lastSeenMs: Number.POSITIVE_INFINITY },
    ];
    for (const j of junk) {
      const verdict = classifyDhtNode(j as DhtNode);
      expect(verdict.ok).toBe(false);
      if (!verdict.ok) expect(verdict.reason).toBe("malformed-node");
    }
  });

  it("names the NEUTRAL FACT, never an intent (dual-use §)", () => {
    const reasons: DhtNodeRefuseReason[] = ["malformed-node", "dest-not-bound"];
    for (const r of reasons) {
      expect(/forg|fraud|attack|malicious|sybil|caught|evil|liar/i.test(r)).toBe(false);
    }
    // and the vocabulary is the SAME word the announce wire uses for the same fact
    expect(reasons).toContain("dest-not-bound");
  });

  it("does not read a clock — the verdict is a function of the record alone", () => {
    // `lastSeenMs` is shape-checked and never compared against a now. Local receive-time must not
    // decide what enters a shared fold (.claude/rules/local-time-never-enters-the-shared-fold.md):
    // two nodes with different receive-times must reach the SAME verdict on the same record.
    const ancient = { ...node("alice"), lastSeenMs: -1_000_000 };
    const future = { ...node("alice"), lastSeenMs: 8.64e15 };
    expect(classifyDhtNode(ancient)).toEqual({ ok: true });
    expect(classifyDhtNode(future)).toEqual({ ok: true });
    // and repeated calls agree (no ambient state)
    expect(classifyDhtNode(node("alice"))).toEqual(classifyDhtNode(node("alice")));
  });
});

describe("observeNode — the first entry", () => {
  it("ADMITS a genuine record", () => {
    const t = observeNode(emptyTable(SELF.dest, 20), node("alice", 1), 5);
    expect(allNodes(t).map((n) => n.zid)).toEqual(["alice"]);
  });

  it("refuses an unbound record and leaves the table BYTE-IDENTICAL", () => {
    const t0 = observeNode(emptyTable(SELF.dest, 20), node("alice", 1), 5);
    const t1 = observeNode(t0, impersonate("bob", "mallory", 9), 9);
    expect(t1).toBe(t0); // same object reference — not merely an equal table
  });

  it("a forgery cannot displace the genuine holder of an address", () => {
    let t: RoutingTable = emptyTable(SELF.dest, 20);
    t = observeNode(t, node("alice", 1), 1);
    t = observeNode(t, impersonate("alice", "mallory", 2), 2);
    const held = allNodes(t).find((n) => n.dest === destinationHash("alice"))!;
    expect(held.zid).toBe("alice");
    expect(allNodes(t)).toHaveLength(1);
  });

  it("a forgery cannot force an eviction — it never reaches the bucket", () => {
    // Without the guard this is the cheap denial: flood k impostors into one bucket and the real
    // peers are evicted. The victim pool and the impostors share a bucket by construction.
    const wanted = bucketIndex(SELF.dest, node("adv-peer-0").dest);
    const peers: DhtNode[] = [];
    for (let i = 0; i < 64 && peers.length < 2; i++) {
      const n = node(`adv-peer-${i}`);
      if (bucketIndex(SELF.dest, n.dest) === wanted) peers.push(n);
    }
    expect(peers).toHaveLength(2); // the fixture found what it needed — never sweep an empty pool
    let t: RoutingTable = emptyTable(SELF.dest, 2);
    for (const p of peers) t = observeNode(t, p, 1);
    const before = allNodes(t).map((n) => n.zid).sort();
    for (const p of peers) t = observeNode(t, impersonate(p.zid, "mallory", 2), 2);
    expect(allNodes(t).map((n) => n.zid).sort()).toEqual(before);
  });

  it("nowMs is WRITTEN onto an accepted record, never used to decide acceptance", () => {
    const stale = { ...node("alice"), lastSeenMs: 0 };
    const t = observeNode(emptyTable(SELF.dest, 20), stale, 999_999);
    const held = allNodes(t)[0]!;
    expect(held.lastSeenMs).toBe(999_999); // stamped
    expect(held.zid).toBe("alice"); // and admitted regardless of how old the claim said it was
  });
});

describe("admissibleNodes — the neutral report", () => {
  it("admits the genuine, refuses the forged, and reports which was which", () => {
    const good = [node("alice"), node("bob")];
    const bad = [impersonate("alice", "mallory"), { dest: 5, zid: "x", lastSeenMs: 0 } as unknown as DhtNode];
    const { admitted, refused } = admissibleNodes([...good, ...bad]);
    expect(admitted.map((n) => n.zid)).toEqual(["alice", "bob"]);
    expect(refused.map((r) => r.reason)).toEqual(["dest-not-bound", "malformed-node"]);
  });

  it("admits ALL of a wholly-genuine list — the reject-everything falsifier", () => {
    const all = Array.from({ length: 12 }, (_, i) => node(`peer-${i}`));
    const { admitted, refused } = admissibleNodes(all);
    expect(admitted).toHaveLength(12);
    expect(refused).toHaveLength(0);
  });
});

describe("lookup — the second entry: a peer's answer is a peer's CLAIM", () => {
  const K = 8;

  /** S knows A; A knows T. The honest three-node chain the guard must not break. */
  function honestChain() {
    const S = node("adv-source", 1);
    const A = node("adv-relay", 1);
    const T = node("adv-target", 1);
    const tS = observeNode(emptyTable(S.dest, K), A, 1);
    const tA = observeNode(emptyTable(A.dest, K), T, 1);
    const tT = emptyTable(T.dest, K);
    const tables = new Map([
      [S.dest, tS],
      [A.dest, tA],
      [T.dest, tT],
    ]);
    return { S, A, T, tS, tables };
  }

  it("ACCEPT: the honest multi-hop lookup still converges under the guard", () => {
    const { T, tS, tables } = honestChain();
    const net = (n: DhtNode, target: string) => {
      const t = tables.get(n.dest);
      return t ? answerFindNode(t, target, K) : [];
    };
    expect(closest(tS, T.dest, K).some((n) => n.dest === T.dest)).toBe(false); // S does not know T
    expect(found(lookup(tS, T.dest, net, K), T.dest)).toBeDefined(); // …and finds it through A
  });

  it("REFUSE: a peer's unbound answers never enter the shortlist", () => {
    const { A, T, tS, tables } = honestChain();
    // A is compromised: it answers with the honest T *plus* a pile of unbound records — some
    // impersonating T's address, some planting T's identity elsewhere.
    const forged: DhtNode[] = [
      impersonate("adv-target", "mallory", 1),
      displace("adv-target", destinationHash("mallory"), 1),
      { dest: "8000", zid: "adv-target", lastSeenMs: 1 },
    ];
    const net = (n: DhtNode, target: string) => {
      if (n.dest === A.dest) return [...answerFindNode(tables.get(A.dest)!, target, K), ...forged];
      const t = tables.get(n.dest);
      return t ? answerFindNode(t, target, K) : [];
    };

    const result = lookup(tS, T.dest, net, K);
    // the genuine target is still reached — the guard did not cost the lookup its job
    expect(found(result, T.dest)).toBeDefined();
    // …and not one forged record survived into the result
    expect(result.some((n) => n.zid === "mallory")).toBe(false);
    expect(result.every((n) => isAddressBound(n))).toBe(true);
    expect(result.some((n) => n.dest === "8000")).toBe(false);
  });

  it("REFUSE: a peer answering with NOTHING but forgeries seeds nothing", () => {
    const { A, T, tS, tables } = honestChain();
    const net = (n: DhtNode, target: string) => {
      if (n.dest === A.dest) {
        return Array.from({ length: 20 }, (_, i) => impersonate("adv-target", `mallory-${i}`, 1));
      }
      const t = tables.get(n.dest);
      return t ? answerFindNode(t, target, K) : [];
    };
    const result = lookup(tS, T.dest, net, K);
    expect(result.every((n) => isAddressBound(n))).toBe(true);
    expect(result.some((n) => n.zid.startsWith("mallory"))).toBe(false);
    // A itself is genuine and stays in the result — refusing its ANSWERS is not refusing IT.
    expect(result.some((n) => n.dest === A.dest)).toBe(true);
  });

  it("ACCEPT: a fully-connected honest network still converges to the exact target", () => {
    // The convergence half of the migration claim: authentication changes nothing for honest
    // traffic. A guard that broke this would pass every forgery test above and be undeployable.
    const ids = Array.from({ length: 12 }, (_, i) => node(`conv-peer-${i}`, 1));
    const k = 4;
    const tables = new Map<string, RoutingTable>();
    for (const self of ids) {
      let t = emptyTable(self.dest, k);
      for (const other of ids) if (other.dest !== self.dest) t = observeNode(t, other, 1);
      tables.set(self.dest, t);
    }
    const net = (n: DhtNode, target: string) => {
      const t = tables.get(n.dest);
      return t ? answerFindNode(t, target, k) : [];
    };
    const target = ids[11]!.dest;
    expect(found(lookup(tables.get(ids[0]!.dest)!, target, net, k), target)).toBeDefined();
  });
});

describe("the limit, stated so the membrane is not read as more than it is", () => {
  it("a pair-consistent record for a zid you do not hold is STILL admitted", () => {
    // `destinationHash` hashes a PUBLIC identifier. Anyone who has seen `alice` can mint a
    // perfectly bound record claiming to be alice. Address integrity cannot see this; only a
    // signature can (see `reticulum-announce-auth.ts` for the membrane that provides it).
    // Recorded as a passing test rather than a comment, so the residual cannot quietly be
    // believed closed.
    const mintedByAnyone = node("alice", 1);
    expect(classifyDhtNode(mintedByAnyone)).toEqual({ ok: true });
  });

  it("a route hint is outside the pair entirely — attacker-supplied even when bound", () => {
    // `DhtNode.route` says how to physically reach a node and is covered by nothing here. Filed,
    // not hidden. Nothing in-repo reads `DhtNode.route` today, which is why it is a latent gap and
    // not a live hole — and this test fails the moment the record stops carrying it unchecked.
    const withRoute: DhtNode = {
      ...node("alice", 1),
      route: { kind: "udp", addr: "203.0.113.66:1900" }, // an endpoint nothing verified
    };
    expect(classifyDhtNode(withRoute)).toEqual({ ok: true });
  });
});

describe("the dependency stays one-way", () => {
  it("dht-discovery imports destinationHash from reticulum-transport, and never the reverse", async () => {
    const dht = await Bun.file(new URL("./dht-discovery.ts", import.meta.url)).text();
    const rns = await Bun.file(new URL("./reticulum-transport.ts", import.meta.url)).text();
    expect(/import\s*\{[^}]*destinationHash[^}]*\}\s*from\s*"\.\/reticulum-transport"/.test(dht)).toBe(true);
    expect(/from\s*"\.\/dht-discovery/.test(rns)).toBe(false);
  });
});
