// gossip-salon.proof — the salon circulating: CRDT laws proven, and the wire test that matters:
// a third node learns a crossing it never saw, and the same failure modes UDP/analog inflict
// (duplication, reordering, loss-with-retransmit) are all absorbed by algebra. Deterministic.

import { describe, it, expect } from "bun:test";
import {
  emptySalon,
  hear,
  merge,
  rumorsOf,
  regimeOfPair,
  claimsAbout,
  encodeRumor,
  decodeRumor,
  pruneCrossings,
  createSalonGossiper,
  pairKey,
  plausibilityOf,
  type Crossing,
  type Rumor,
  type Salon,
} from "./gossip-salon";
import { createLivingNode, type LivingNodeConfig } from "./living-node";
import { type Scheduler } from "./llmtv-node";
import type { DiscoveryTransport } from "./discovery-beacon";
import type { BroadcastTransport, SourceMind } from "./llmtv-broadcast";

const crossing = (a: string, b: string, rttMs: number, observer: string): Rumor => ({ kind: "crossing", a, b, rttMs, observer });
const kept = (node: string, k: boolean, relayer: string): Rumor => ({ kind: "kept", node, kept: k, relayer });
const hearAll = (rumors: Rumor[]): Salon => rumors.reduce(hear, emptySalon);

const salonEq = (x: Salon, y: Salon): boolean => {
  if (x.claims.size !== y.claims.size || x.crossings.size !== y.crossings.size) return false;
  for (const c of x.claims) if (!y.claims.has(c)) return false;
  for (const [k, set] of x.crossings) {
    const other = y.crossings.get(k);
    if (other?.size !== set.size) return false;
    for (const e of set) if (!other.has(e)) return false;
  }
  return true;
};

// all permutations of a small array (module scope to keep test nesting shallow)
const permute = <T,>(xs: T[]): T[][] =>
  xs.length <= 1 ? [xs] : xs.flatMap((x, i) => permute([...xs.slice(0, i), ...xs.slice(i + 1)]).map((r) => [x, ...r]));

describe("PROVEN: the salon's algebra absorbs every dirty-transport failure mode", () => {
  const RUMORS: Rumor[] = [
    crossing("a", "b", 800, "w1"),
    crossing("b", "a", 60, "w2"), // same pair, reversed order — unordered key
    crossing("a", "c", 900, "w1"),
    kept("x", true, "x"),
    kept("x", false, "rumor-mill"),
  ];

  it("duplication → idempotence: hearing everything twice equals hearing it once", () => {
    expect(salonEq(hearAll([...RUMORS, ...RUMORS]), hearAll(RUMORS))).toBe(true);
  });

  it("reordering → commutativity: every permutation folds to the same salon (5! = 120, exhaustive)", () => {
    const reference = hearAll(RUMORS);
    for (const perm of permute(RUMORS)) {
      expect(salonEq(hearAll(perm), reference)).toBe(true);
    }
  });

  it("partition → merge: commutative, associative, idempotent (and merge ≡ hearing)", () => {
    const s1 = hearAll(RUMORS.slice(0, 2));
    const s2 = hearAll(RUMORS.slice(2));
    expect(salonEq(merge(s1, s2), merge(s2, s1))).toBe(true);
    expect(salonEq(merge(merge(s1, s2), s2), merge(s1, s2))).toBe(true);
    expect(salonEq(merge(s1, s2), hearAll(RUMORS))).toBe(true);
  });

  it("loss → anti-entropy: rumorsOf round-trips the whole salon (what one node knows, all can relearn)", () => {
    const original = hearAll(RUMORS);
    const relearned = hearAll(rumorsOf(original));
    expect(salonEq(relearned, original)).toBe(true);
  });

  it("monotone toward in-cone: unheard = unmeasured; fast crossing forces in-cone; slow gossip cannot resurrect", () => {
    expect(regimeOfPair(emptySalon, "a", "b", 100)).toBe("unmeasured");
    const slow = hearAll([crossing("a", "b", 900, "w")]);
    expect(regimeOfPair(slow, "a", "b", 100)).toBe("out-of-cone");
    const withFast = hear(slow, crossing("a", "b", 60, "v"));
    expect(regimeOfPair(withFast, "a", "b", 100)).toBe("in-cone");
    expect(regimeOfPair(hear(withFast, crossing("a", "b", 5000, "u")), "a", "b", 100)).toBe("in-cone");
  });

  it("kept-claims stay neutral facts: contradictions kept side by side, attributed", () => {
    const salon = hearAll([kept("ryn", true, "ryn"), kept("ryn", false, "rumor-mill")]);
    expect(claimsAbout(salon, "ryn").sort((p1, p2) => String(p1[0]).localeCompare(String(p2[0]), "en"))).toEqual([
      [false, "rumor-mill"],
      [true, "ryn"],
    ]);
    expect(claimsAbout(salon, "nobody")).toEqual([]);
  });

  it("codec round-trips; foreign packets decode to null", () => {
    for (const r of RUMORS) expect(decodeRumor(encodeRumor(r))).toEqual(r);
    expect(decodeRumor("busprobe/1 {}")).toBeNull();
    expect(decodeRumor("salon/1 not-json")).toBeNull();
    expect(decodeRumor('salon/1 {"kind":"crossing"}')).toBeNull();
    expect(decodeRumor("")).toBeNull();
  });
});

// ── the wire test that matters: a third node learns what it never saw ──────────────────────────

function createLossyDupMesh(delayMs: number) {
  const nodes: { id: string; handlers: ((t: string, f: string) => void)[] }[] = [];
  let clock = 0;
  let nextId = 0;
  let dropCounter = 0;
  const intervals: { ms: number; fn: () => void; last: number; id: number }[] = [];
  const pending: { at: number; text: string; fromId: string }[] = [];

  const removeInterval = (id: number): void => {
    const i = intervals.findIndex((x) => x.id === id);
    if (i >= 0) intervals.splice(i, 1);
  };

  const deliverDue = (upTo: number): void => {
    for (;;) {
      const idx = pending.findIndex((d) => d.at <= upTo);
      if (idx < 0) return;
      const [d] = pending.splice(idx, 1);
      if (!d) return;
      for (const n of nodes) if (n.id !== d.fromId) for (const h of n.handlers) h(d.text, d.fromId);
    }
  };

  return {
    attach(id: string): DiscoveryTransport & BroadcastTransport {
      const self = { id, handlers: [] as ((t: string, f: string) => void)[] };
      nodes.push(self);
      const send = (text: string): void => {
        // deterministic NON-RESONANT dirt (a plain every-3rd counter resonates with the fixed
        // per-cycle packet pattern and can starve one packet class forever — found the hard
        // way): Weyl-sequence dropper ~29% drops, duplicator ~20%, both aperiodic vs the cycle.
        dropCounter += 1;
        const w = (dropCounter * 2654435761) % 4294967296;
        if (w % 7 === 0 || w % 7 === 1) return;
        pending.push({ at: clock + delayMs, text, fromId: id });
        if (w % 5 === 3) pending.push({ at: clock + delayMs * 2, text, fromId: id });
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
            removeInterval(myId);
          };
        },
      };
    },
    advance(ms: number) {
      const target = clock + ms;
      for (;;) {
        let nextFire = Infinity;
        for (const iv of intervals) nextFire = Math.min(nextFire, iv.last + iv.ms);
        let nextDelivery = Infinity;
        for (const d of pending) nextDelivery = Math.min(nextDelivery, d.at);
        const next = Math.min(nextFire, nextDelivery);
        if (next === Infinity || next > target) break;
        clock = next;
        deliverDue(clock);
        const firing = intervals.filter((iv) => iv.last + iv.ms === next);
        for (const iv of firing) iv.last = next;
        for (const iv of firing) iv.fn();
      }
      clock = target;
      deliverDue(clock);
    },
  };
}

const mind = (label: string): (() => SourceMind) => () => ({
  role: "living",
  hat: "salon hat",
  required: [{ label, temp: "warm", valueMilli: 800, epsilonMilli: 100 }],
});

const cfg = (name: string): LivingNodeConfig => ({
  self: { persona: name, surface: "living", instance: "0", node: "test" },
  zid: `zid-${name}`,
  routes: [{ kind: "udp", addr: `239.0.0.1:5000#${name}` }],
  source: { zid: `zid-${name}`, name },
  mind: mind(name),
  ttlMs: 60_000,
  helloEveryMs: 1_000,
  publishEveryMs: 1_000,
  cloneMind: { zid: `zid-${name}`, entropyBudget: 1000, regions: [{ regionId: "work", frosted: false }] },
  spendEnvelope: { id: `env-${name}`, capMicroUsd: 1_000_000, perCallMaxMicroUsd: 200_000, windowMs: 60_000, windowMaxMicroUsd: 500_000 },
  collapseThresholdMilli: 100,
  maxPauseMs: 60_000,
  probeEveryMs: 1_000,
  decisionDeadlineMs: 100,
  gossipEveryMs: 1_000,
});

describe("integration: the salon circulates over a lossy, duplicating wire", () => {
  it("a third node learns a crossing it never measured — through drops and duplicates", () => {
    const mesh = createLossyDupMesh(40); // fast wire: 40ms delay → crossings are in-cone at τ=100
    const sched = mesh.scheduler();
    const a = createLivingNode(cfg("aria"), mesh.attach("aria"), sched);
    const b = createLivingNode(cfg("boro"), mesh.attach("boro"), sched);
    const c = createLivingNode(cfg("cass"), mesh.attach("cass"), sched);
    a.start();
    b.start();
    c.start();
    // probes fire; acks measured; measurements told to the salon; anti-entropy re-broadcasts
    // repair whatever the dirty wire dropped
    mesh.advance(20_000);
    // cass never probed the aria↔boro pair itself — but the salon knows, so cass knows:
    expect(c.pairRegime("zid-aria", "zid-boro")).toBe("in-cone");
    // and an unheard pair stays honestly unmeasured
    expect(c.pairRegime("zid-aria", "zid-nobody")).toBe("unmeasured");
    a.stop();
    b.stop();
    c.stop();
  });

  it("kept-claims circulate the same way: told once, known everywhere despite the dirt", () => {
    const mesh = createLossyDupMesh(40);
    const sched = mesh.scheduler();
    const a = createLivingNode(cfg("aria"), mesh.attach("aria"), sched);
    const c = createLivingNode(cfg("cass"), mesh.attach("cass"), sched);
    a.start();
    c.start();
    mesh.advance(3_000);
    // aria declares itself kept — one tell, into a wire that drops every 3rd packet
    // (reach into the salon via the node's gossiper: tell is exercised through probes above,
    //  here we inject the claim as an inbound rumor by publishing from aria's transport)
    // simplest honest path: aria's salon hears it locally via its own gossiper broadcast
    const ariaSalonBefore = a.salon();
    expect(claimsAbout(ariaSalonBefore, "zid-aria")).toEqual([]);
    // no public tell() on LivingNode (deliberate: kept-claims come from the keeping layer);
    // simulate the keeping layer publishing once through the wire:
    mesh.attach("keeping-layer").publish(encodeRumor(kept("zid-aria", true, "zid-aria")));
    mesh.advance(10_000); // anti-entropy spreads it, dirt notwithstanding
    expect(c.keptClaims("zid-aria")).toEqual([[true, "zid-aria"]]);
    a.stop();
    c.stop();
  });
});

// ── pruning: bounded memory, regime preserved EXACTLY (the monotone-safe theorem) ──────────────

describe("PROVEN: pruneCrossings preserves the regime exactly, for every deadline", () => {
  // a salon with many crossings per pair, varied RTTs (deterministic construction)
  const buildBig = (): Salon => {
    let s = emptySalon;
    for (let i = 0; i < 60; i++) {
      s = hear(s, crossing("a", "b", 100 + ((i * 137) % 900), `w${String(i)}`));
      s = hear(s, crossing("a", "c", 50 + ((i * 61) % 400), `w${String(i)}`));
    }
    return s;
  };

  it("regime identical before/after prune across the whole deadline sweep (0..600, both pairs)", () => {
    const big = buildBig();
    const pruned = pruneCrossings(big, 4);
    for (let deadline = 0; deadline <= 600; deadline++) {
      expect(regimeOfPair(pruned, "a", "b", deadline)).toBe(regimeOfPair(big, "a", "b", deadline));
      expect(regimeOfPair(pruned, "a", "c", deadline)).toBe(regimeOfPair(big, "a", "c", deadline));
    }
    // unheard pairs unaffected
    expect(regimeOfPair(pruned, "a", "z", 100)).toBe("unmeasured");
  });

  it("bound holds, prune is idempotent, floor of 1 keeps the minimum, claims untouched", () => {
    const big = hear(buildBig(), kept("x", true, "x"));
    const pruned = pruneCrossings(big, 4);
    for (const [, set] of pruned.crossings) expect(set.size).toBeLessThanOrEqual(4);
    expect(pruneCrossings(pruned, 4)).toEqual(pruned);
    // keepPerPair below 1 clamps to 1 — the evidence-killer always survives
    const one = pruneCrossings(big, 0);
    for (let deadline = 0; deadline <= 600; deadline++) {
      expect(regimeOfPair(one, "a", "b", deadline)).toBe(regimeOfPair(big, "a", "b", deadline));
    }
    expect(pruned.claims.has("x 1 x")).toBe(true);
  });

  it("the gossiper stays bounded under a flood of crossings", () => {
    let published = 0;
    const transport = {
      publish: (): void => {
        published += 1;
      },
      onFrame: (): void => undefined,
    };
    const sched = { setInterval: (): (() => void) => () => undefined };
    const g = createSalonGossiper(transport, sched, 1000, 4);
    for (let i = 0; i < 200; i++) g.tell(crossing("a", "b", 100 + i, `w${String(i)}`));
    const set = g.salon().crossings.get(pairKey("a", "b"));
    expect(set?.size).toBe(4);
    // and the minimum survived: 100 is still the fastest known crossing
    expect([...(set ?? [])].some((e) => e.startsWith("100 "))).toBe(true);
    expect(published).toBe(200); // every tell was rumor-mongered even while pruned
  });
});

// ── proof of distance: the plausibility floor ──────────────────────────────────────────────────

describe("proof of distance: geometry tags claims — detection, never rejection", () => {
  const geometry = hearAll([crossing("witness", "a", 500, "witness"), crossing("witness", "b", 100, "witness")]);
  const claim = (rttMs: number, observer = "witness"): Crossing => ({ kind: "crossing", a: "a", b: "b", rttMs, observer });

  it("self-witness / consistent / implausibly-fast / unverifiable — the four tags", () => {
    expect(plausibilityOf(geometry, claim(10, "a"))).toBe("self-witnessed");
    // reverse-triangle bound |500−100| = 400: a 10ms third-party claim is physically suspect
    expect(plausibilityOf(geometry, claim(10))).toBe("implausibly-fast");
    expect(plausibilityOf(geometry, claim(380))).toBe("consistent");
    expect(plausibilityOf(geometry, claim(10, "stranger"))).toBe("unverifiable");
  });

  it("the implausible claim still lands in the salon — the tag is a fact for the oracle", () => {
    const withSuspect = hear(geometry, claim(10));
    expect(regimeOfPair(withSuspect, "a", "b", 100)).toBe("in-cone"); // kept, still evidence-killing
    expect(plausibilityOf(withSuspect, claim(10))).toBe("implausibly-fast"); // and tagged
  });
});
