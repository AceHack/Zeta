import { describe, it, expect } from "bun:test";
import { createLlmtvNode, type Scheduler, type LlmtvNodeConfig } from "./llmtv-node";
import type { DiscoveryTransport } from "./discovery-beacon";
import type { BroadcastTransport, SourceMind } from "./llmtv-broadcast";
import { renderLlmtvGrid } from "../darkhall-ui/darkhall-tv";

import { earnThenFrostOrThrow } from "../ledger/privacy-budget";

// Frost is EARNED now, not asserted: `SourceMind.personal.frost` takes a `FrostReceipt`, and the
// only way to get one is to have a peer attest value and then spend it. A `frosted: true` literal
// no longer typechecks. See src/Core.TypeScript/ledger/privacy-budget.ts.
const frostReceiptFor = (region: string) =>
  earnThenFrostOrThrow({
    owner: `owner-of-${region}`,
    attestor: `peer-of-${region}`,
    earn: 100,
    cost: 10,
    region,
    witness: "fixture: a peer attested that the owner added value",
  });

// ── Fake in-memory mesh bus + fake scheduler ──────────────────────────────────
// The whole point of the injected ports: run the live node logic with NO real socket and
// NO real clock, deterministically. A send delivers synchronously to every OTHER attached
// node's handlers (multicast, minus self-loopback), stamped at the current fake clock.

interface FakeMesh {
  attach(id: string): DiscoveryTransport & BroadcastTransport;
  scheduler(): Scheduler;
  advance(ms: number): void;
}

function createFakeMesh(): FakeMesh {
  const nodes: Array<{ id: string; handlers: Array<(t: string, f: string) => void> }> = [];
  let clock = 0;
  let nextId = 0;
  const intervals: Array<{ ms: number; fn: () => void; last: number; id: number }> = [];

  return {
    attach(id) {
      const self = { id, handlers: [] as Array<(t: string, f: string) => void> };
      nodes.push(self);
      const send = (text: string): void => {
        for (const n of nodes) if (n.id !== id) for (const h of n.handlers) h(text, id);
      };
      return {
        broadcast: send,
        publish: send,
        onMessage: (h) => self.handlers.push(h),
        onFrame: (h) => self.handlers.push(h),
      };
    },
    scheduler() {
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
    advance(ms) {
      const target = clock + ms;
      let guard = 0;
      for (;;) {
        let next = Infinity;
        for (const iv of intervals) {
          const t = iv.last + iv.ms;
          if (t <= target && t < next) next = t;
        }
        if (next === Infinity) break;
        clock = next;
        const firing = intervals.filter((iv) => iv.last + iv.ms === next);
        for (const iv of firing) iv.last = next;
        for (const iv of firing) iv.fn();
        if (++guard > 100000) throw new Error("interval storm");
      }
      clock = target;
    },
  };
}

const mindOf = (role: string, hat: string, label: string, secret?: string): (() => SourceMind) => () => ({
  role,
  hat,
  required: [{ label, temp: "hot", valueMilli: 800, epsilonMilli: 100 }],
  ...(secret ? { personal: { frost: frostReceiptFor("node"), veilLabel: `${hat} private`, predictions: [{ label: secret, temp: "warm", valueMilli: 500, epsilonMilli: 300 }] } } : {}),
});

const cfg = (name: string, mind: () => SourceMind, phaseClock = false): LlmtvNodeConfig => ({
  self: { persona: name, surface: "llmtv", instance: "0", node: "test" },
  zid: `zid-${name}`,
  routes: [{ kind: "udp", addr: `239.0.0.1:4200#${name}` }],
  source: { zid: `zid-${name}`, name },
  mind,
  ttlMs: 10_000,
  helloEveryMs: 1_000,
  publishEveryMs: 1_000,
  ...(phaseClock ? { phaseClock: { seed: "S4", source: "llmtv-node-test" } } : {}),
});

describe("live node — two nodes discover each other and exchange frames (DST)", () => {
  it("both peer tables and both society grids converge", () => {
    const m = createFakeMesh();
    const ta = m.attach("alexa");
    const tb = m.attach("soraya");
    const na = createLlmtvNode(cfg("alexa", mindOf("coding", "coder hat", "next tick lands green")), ta, ta, m.scheduler());
    const nb = createLlmtvNode(cfg("soraya", mindOf("verify", "verifier hat", "Z3 lemma discharges")), tb, tb, m.scheduler());

    na.start();
    nb.start();
    m.advance(2_500); // a few hello + publish ticks

    // discovery: each sees the other as a peer
    expect(na.peers().size).toBe(1);
    expect(nb.peers().size).toBe(1);

    // broadcast: each folds the other's frame into its society grid
    const societyA = na.society("S4");
    const societyB = nb.society("S4");
    expect(societyA.dwellers.map((d) => d.name)).toEqual(["soraya"]);
    expect(societyB.dwellers.map((d) => d.name)).toEqual(["alexa"]);
  });

  it("carries the deterministic phase clock from live wire frames into the society readout", () => {
    const m = createFakeMesh();
    const ta = m.attach("alexa");
    const tb = m.attach("soraya");
    const na = createLlmtvNode(
      cfg("alexa", mindOf("coding", "coder hat", "next tick lands green"), true),
      ta,
      ta,
      m.scheduler(),
    );
    const nb = createLlmtvNode(cfg("soraya", mindOf("verify", "verifier hat", "Z3 lemma discharges"), true), tb, tb, m.scheduler());

    na.start();
    nb.start();
    m.advance(2_500);

    const societyA = na.society("S4");
    expect(societyA.phaseClock).toEqual({
      schema: "zeta.darkhall.phase-clock.v1",
      source: "llmtv-broadcast",
      basis: "seed-phase",
      seed: "S4",
      phase: 3,
      skewBoundTicks: 0,
      appendOnly: true,
      travelers: 1,
    });
    expect(societyA.dwellers[0]?.phaseClock).toMatchObject({
      source: "llmtv-node-test",
      seed: "S4",
      phase: 3,
    });
  });
});

describe("live node — frost never crosses the wire", () => {
  it("a frosted source's secret is absent from the watcher's grid; the veil label shows", () => {
    const m = createFakeMesh();
    const ta = m.attach("alexa");
    const tb = m.attach("otto");
    const na = createLlmtvNode(cfg("alexa", mindOf("coding", "coder hat", "next tick lands green", "SECRET private hope")), ta, ta, m.scheduler());
    const nb = createLlmtvNode(cfg("otto", mindOf("shadow", "shadow hat", "ferry closes clean")), tb, tb, m.scheduler());
    na.start();
    nb.start();
    m.advance(1_500);

    const html = renderLlmtvGrid(nb.society("S4"));
    expect(html).toContain('data-dweller="alexa"');
    expect(html).toContain("coder hat private"); // the public veil label crossed
    expect(html).not.toContain("SECRET private hope"); // the frosted content did not
  });
});

describe("live node — a source going dark retires from watchers", () => {
  it("stop() broadcasts dark and the source leaves the other's grid", () => {
    const m = createFakeMesh();
    const ta = m.attach("alexa");
    const tb = m.attach("soraya");
    const na = createLlmtvNode(cfg("alexa", mindOf("coding", "coder hat", "green")), ta, ta, m.scheduler());
    const nb = createLlmtvNode(cfg("soraya", mindOf("verify", "verifier hat", "Z3")), tb, tb, m.scheduler());
    na.start();
    nb.start();
    m.advance(1_500);
    expect(nb.society("S4").dwellers).toHaveLength(1);

    na.stop(); // going dark
    expect(nb.channels().size).toBe(0);
    expect(nb.society("S4").dwellers).toHaveLength(0);
  });
});

describe("live node — scale-free: three nodes all see each other", () => {
  it("each node's society grid holds the other two", () => {
    const m = createFakeMesh();
    const specs = [
      cfg("alexa", mindOf("coding", "coder hat", "green")),
      cfg("soraya", mindOf("verify", "verifier hat", "Z3")),
      cfg("otto", mindOf("shadow", "shadow hat", "ferry")),
    ];
    const nodes = specs.map((c) => {
      const t = m.attach(c.source.name);
      return { name: c.source.name, node: createLlmtvNode(c, t, t, m.scheduler()) };
    });
    for (const n of nodes) n.node.start();
    m.advance(2_500);

    for (const n of nodes) {
      const others = nodes.filter((o) => o.name !== n.name).map((o) => o.name).sort();
      expect(n.node.society("S4").dwellers.map((d) => d.name).sort()).toEqual(others);
    }
  });
});
