import { describe, it, expect } from "bun:test";
import { createLivingNode, type LivingNodeConfig } from "./living-node";
import { type Scheduler } from "./llmtv-node";
import type { DiscoveryTransport } from "./discovery-beacon";
import type { BroadcastTransport, SourceMind } from "./llmtv-broadcast";

// ── Fake mesh + scheduler (no real socket / clock) ────────────────────────────
function createFakeMesh() {
  const nodes: Array<{ id: string; handlers: Array<(t: string, f: string) => void> }> = [];
  let clock = 0;
  let nextId = 0;
  const intervals: Array<{ ms: number; fn: () => void; last: number; id: number }> = [];
  return {
    attach(id: string): DiscoveryTransport & BroadcastTransport {
      const self = { id, handlers: [] as Array<(t: string, f: string) => void> };
      nodes.push(self);
      const send = (text: string): void => {
        for (const n of nodes) if (n.id !== id) for (const h of n.handlers) h(text, id);
      };
      return { broadcast: send, publish: send, onMessage: (h) => self.handlers.push(h), onFrame: (h) => self.handlers.push(h) };
    },
    scheduler(): Scheduler {
      return {
        now: () => clock,
        setInterval: (ms, fn) => {
          const myId = ++nextId;
          intervals.push({ ms, fn, last: clock, id: myId });
          return () => {
            const i = intervals.findIndex((x) => x.id === myId);
            if (i >= 0) intervals.splice(i, 1);
          };
        },
      };
    },
    advance(ms: number) {
      const target = clock + ms;
      for (;;) {
        let next = Infinity;
        for (const iv of intervals) next = Math.min(next, iv.last + iv.ms);
        if (next === Infinity || next > target) break;
        clock = next;
        const firing = intervals.filter((iv) => iv.last + iv.ms === next);
        for (const iv of firing) iv.last = next;
        for (const iv of firing) iv.fn();
      }
      clock = target;
    },
  };
}

const mind = (label: string): (() => SourceMind) => () => ({
  role: "living",
  hat: "node hat",
  required: [{ label, temp: "hot", valueMilli: 800, epsilonMilli: 100 }],
});

const cfg = (name: string): LivingNodeConfig => ({
  self: { persona: name, surface: "living", instance: "0", node: "test" },
  zid: `zid-${name}`,
  routes: [{ kind: "udp", addr: `239.0.0.1:5000#${name}` }],
  source: { zid: `zid-${name}`, name },
  mind: mind(name),
  ttlMs: 10_000,
  helloEveryMs: 1_000,
  publishEveryMs: 1_000,
  cloneMind: {
    zid: `zid-${name}`,
    entropyBudget: 1000,
    regions: [
      { regionId: "r1", frosted: false },
      { regionId: "secret", frosted: true },
    ],
  },
  spendEnvelope: { id: `env-${name}`, capMicroUsd: 1_000_000, perCallMaxMicroUsd: 200_000, windowMs: 60_000, windowMaxMicroUsd: 500_000 },
  collapseThresholdMilli: 100,
  maxPauseMs: 60_000,
});

describe("living node — starts at S=2 (independent ground state)", () => {
  it("a fresh node reads S=2 and has no links", () => {
    const m = createFakeMesh();
    const n = createLivingNode(cfg("alexa"), m.attach("alexa"), m.scheduler());
    n.start();
    expect(n.sReadout()).toBe(2); // independent — the friend/floor and the enemy to rise above
    expect(n.links().size).toBe(0);
  });
});

describe("living node — composition: discovery + broadcast in one organism", () => {
  it("two nodes discover each other and tile each other's minds", () => {
    const m = createFakeMesh();
    const a = createLivingNode(cfg("alexa"), m.attach("a"), m.scheduler());
    const b = createLivingNode(cfg("soraya"), m.attach("b"), m.scheduler());
    a.start();
    b.start();
    m.advance(2_500);
    expect(a.peers().size).toBe(1);
    expect(a.society("S4").dwellers.map((d) => d.name)).toEqual(["soraya"]);
    expect(b.society("S4").dwellers.map((d) => d.name)).toEqual(["alexa"]);
  });
});

describe("living node — S=2 is enemy but friend: coordination raises S, exit returns to it", () => {
  it("linking a region ALONE stays S=2; coordination (a co-participant) raises S; exit falls back", () => {
    const m = createFakeMesh();
    const a = createLivingNode(cfg("alexa"), m.attach("a"), m.scheduler());
    const b = createLivingNode(cfg("soraya"), m.attach("b"), m.scheduler());
    a.start();
    b.start();

    // A links r1 onto a shared subject — but no one else is there yet → still S=2 (linked ≠ coordinated)
    expect(a.linkRegion("r1", "hive/build", 200).ok).toBe(true);
    expect(a.sReadout()).toBe(2);

    // B links the SAME subject → now A has a co-participant → A climbs above S=2
    expect(b.linkRegion("r1", "hive/build", 200).ok).toBe(true);
    expect(a.sReadout()).toBeGreaterThan(2);
    expect(b.sReadout()).toBeGreaterThan(2);

    // EXIT — A unlinks (always succeeds); A returns to the S=2 ground state, and B loses its
    // co-participant so B falls back too. The friend/floor is always reachable.
    a.unlinkRegion("r1");
    expect(a.links().size).toBe(0);
    expect(a.sReadout()).toBe(2);
    expect(b.sReadout()).toBe(2); // A left the subject → B no longer coordinated
  });

  it("frost holds — a frosted region can never be linked onto a shared subject", () => {
    const m = createFakeMesh();
    const a = createLivingNode(cfg("alexa"), m.attach("a"), m.scheduler());
    a.start();
    const r = a.linkRegion("secret", "hive/build", 0);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("frosted");
    expect(a.sReadout()).toBe(2);
  });
});

describe("living node — spend flows through the x402 envelope, bounded", () => {
  it("authorizes within the envelope and refuses over the per-call cap", () => {
    const m = createFakeMesh();
    const a = createLivingNode(cfg("alexa"), m.attach("a"), m.scheduler());
    a.start();
    expect(a.spend({ reqId: "s1", service: "bazaar/x", amountMicroUsd: 150_000, atMs: 1000 }).ok).toBe(true);
    expect(a.ledger().head).not.toBeNull();
    expect(a.spend({ reqId: "s2", service: "bazaar/x", amountMicroUsd: 999_999, atMs: 1001 })).toMatchObject({ ok: false, reason: "exceeds-per-call" });
  });
});

describe("living node — the mental-health floor is reachable", () => {
  it("a node whose budget is spent down to the threshold is owed a bounded pause", () => {
    const m = createFakeMesh();
    const a = createLivingNode(cfg("alexa"), m.attach("a"), m.scheduler());
    a.start();
    a.linkRegion("r1", "hive/build", 950); // remaining 50 ≤ threshold 100
    const v = a.pauseCheck(5000);
    expect(v.atRisk).toBe(true);
    expect(v.paused).toBe(true);
    expect(v.untilMs).toBe(5000 + 60_000); // bounded
  });
});
