import { describe, it, expect } from "bun:test";
import {
  emptyLedger,
  addressOf,
  authorize,
  verifyLedger,
  spentTotal,
  spentInWindow,
  merkleRoot,
  payFor,
  newSpendCache,
  rememberSpend,
  mayHaveSpent,
  mergeSpendCaches,
  type Envelope,
  type Ledger,
  type SpendNode,
  type PayPort,
  type X402Challenge,
} from "./x402-envelope";

const env: Envelope = {
  id: "env-otto",
  capMicroUsd: 1_000_000, // $1.00 total
  perCallMaxMicroUsd: 200_000, // $0.20/call
  windowMs: 60_000,
  windowMaxMicroUsd: 500_000, // $0.50/min
};

const req = (reqId: string, amt: number, atMs: number, service = "bazaar/compute") => ({ reqId, service, amountMicroUsd: amt, atMs });

describe("content addressing — spend nodes are git/merkle-shaped, via the real xxh3 oracle", () => {
  it("addressOf is deterministic and content-sensitive", () => {
    const n: SpendNode = { reqId: "r1", service: "s", amountMicroUsd: 100, atMs: 1, parents: [] };
    expect(addressOf(n)).toBe(addressOf(n));
    expect(addressOf(n)).not.toBe(addressOf({ ...n, amountMicroUsd: 101 }));
    expect(addressOf(n)).toHaveLength(32); // 16-byte merkle hash as hex
  });
});

describe("authorize — bounded + metered spending within the envelope", () => {
  it("approves within all bounds and chains the node to the head", () => {
    const v = authorize(env, emptyLedger, req("r1", 150_000, 1000));
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.ledger.head).toBe(v.address);
      expect(v.ledger.nodes.get(v.address)!.parents).toEqual([]); // first spend, no parent
      expect(v.remaining).toBe(env.capMicroUsd - 150_000);
    }
  });

  it("refuses over per-call, over cap, over window, and duplicates", () => {
    expect(authorize(env, emptyLedger, req("r1", 250_000, 1000))).toMatchObject({ ok: false, reason: "exceeds-per-call" });

    // build up to near the window cap, then exceed it
    let l: Ledger = emptyLedger;
    for (const [i, amt] of [200_000, 200_000].entries()) {
      const v = authorize(env, l, req(`w${i}`, amt, 1000 + i));
      if (v.ok) l = v.ledger;
    }
    expect(spentInWindow(l, 1002, env.windowMs)).toBe(400_000);
    expect(authorize(env, l, req("w2", 200_000, 1002))).toMatchObject({ ok: false, reason: "exceeds-window" }); // 400k+200k>500k

    // duplicate reqId
    const dup = authorize(env, l, req("w0", 10_000, 5000));
    expect(dup).toMatchObject({ ok: false, reason: "duplicate" });
  });

  it("the total cap holds across the window boundary", () => {
    let l: Ledger = emptyLedger;
    // five $0.20 calls spread across windows = $1.00 (the cap), a sixth exceeds it
    for (let i = 0; i < 5; i++) {
      const v = authorize(env, l, req(`c${i}`, 200_000, i * 120_000)); // 2min apart → window never caps
      expect(v.ok).toBe(true);
      if (v.ok) l = v.ledger;
    }
    expect(spentTotal(l)).toBe(1_000_000);
    expect(authorize(env, l, req("c5", 1, 600_000))).toMatchObject({ ok: false, reason: "exceeds-cap" });
  });
});

describe("verifyLedger — tamper-evident content-addressed chain (blockchain = git = merkle)", () => {
  it("a well-formed chain verifies; each node chains to the prior head", () => {
    let l: Ledger = emptyLedger;
    const a = authorize(env, l, req("r1", 100_000, 1000));
    if (a.ok) l = a.ledger;
    const b = authorize(env, l, req("r2", 100_000, 2000));
    if (b.ok) l = b.ledger;
    expect(verifyLedger(l)).toEqual({ ok: true });
    // r2's parent is r1's address (git-commit chain)
    const r2 = [...l.nodes.values()].find((n) => n.reqId === "r2")!;
    expect(r2.parents).toEqual([a.ok ? a.address : ""]);
  });

  it("detects a tampered node (stored under a wrong address → hash-mismatch)", () => {
    const good: SpendNode = { reqId: "r1", service: "s", amountMicroUsd: 100, atMs: 1, parents: [] };
    const tampered = new Map([["deadbeefdeadbeefdeadbeefdeadbeef", good]]); // wrong key
    expect(verifyLedger({ nodes: tampered, head: "deadbeefdeadbeefdeadbeefdeadbeef" })).toMatchObject({ ok: false, reason: "hash-mismatch" });
  });

  it("detects a dangling parent", () => {
    const n: SpendNode = { reqId: "r1", service: "s", amountMicroUsd: 100, atMs: 1, parents: ["not-in-the-ledger"] };
    const nodes = new Map([[addressOf(n), n]]);
    expect(verifyLedger({ nodes, head: addressOf(n) })).toMatchObject({ ok: false, reason: "dangling-parent" });
  });
});

describe("merkleRoot — one value that commits the whole spend set (verifyProof-able)", () => {
  it("is deterministic and moves when a spend is added", () => {
    let l: Ledger = emptyLedger;
    expect(merkleRoot(l)).toBeNull();
    const a = authorize(env, l, req("r1", 100_000, 1000));
    if (a.ok) l = a.ledger;
    const root1 = merkleRoot(l);
    const b = authorize(env, l, req("r2", 100_000, 2000));
    if (b.ok) l = b.ledger;
    expect(merkleRoot(l)).not.toBe(root1);
    expect(merkleRoot(l)).toHaveLength(32);
  });
});

describe("payFor — decision BEFORE custody: the envelope gates the injected PayPort", () => {
  it("a refused spend never reaches settlement (custody never crossed)", async () => {
    let settled = false;
    const port: PayPort = {
      settle: async () => {
        settled = true;
        return { ok: true, proof: "0xproof" };
      },
    };
    const challenge: X402Challenge = { resource: "bazaar/x", amountMicroUsd: 999_999_999, payTo: "0xpay", asset: "USDC", network: "base" };
    const r = await payFor(env, emptyLedger, challenge, "r1", 1000, port); // over per-call
    expect(r.ok).toBe(false);
    expect(settled).toBe(false); // the port was NEVER called — envelope decided first
  });

  it("an approved spend settles once and records the proof", async () => {
    const port: PayPort = { settle: async () => ({ ok: true, proof: "0xproof" }) };
    const challenge: X402Challenge = { resource: "bazaar/x", amountMicroUsd: 100_000, payTo: "0xpay", asset: "USDC", network: "base" };
    const r = await payFor(env, emptyLedger, challenge, "r1", 1000, port);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.proof).toBe("0xproof");
      expect(r.ledger.head).not.toBeNull();
    }
  });
});

describe("cached spend history — bloom fast-path, no false negatives (never rejects on bloom alone)", () => {
  it("everything remembered is mayHaveSpent (no false negatives) and fresh ids read as definitely-new", () => {
    const cache = newSpendCache();
    rememberSpend(cache, "r1");
    rememberSpend(cache, "r2");
    expect(mayHaveSpent(cache, "r1")).toBe(true); // remembered → maybe seen
    expect(mayHaveSpent(cache, "r2")).toBe(true);
    // a never-spent id: bloom has no false negatives, so an unseen id is DEFINITELY new (false),
    // barring a false positive — the point is you may skip the exact scan only on `false`.
    expect(mayHaveSpent(cache, "totally-fresh-id-xyz")).toBe(false);
  });

  it("merging caches unions the history (shared-real-time fold across participants)", () => {
    const mine = newSpendCache();
    const yours = newSpendCache();
    rememberSpend(mine, "otto-spend");
    rememberSpend(yours, "daughter-spend");
    mergeSpendCaches(mine, yours);
    expect(mayHaveSpent(mine, "otto-spend")).toBe(true);
    expect(mayHaveSpent(mine, "daughter-spend")).toBe(true); // folded in from the other participant
  });
});
