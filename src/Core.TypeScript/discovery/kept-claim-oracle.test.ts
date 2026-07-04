// kept-claim-oracle — the reference table, TS twin, proven row by row + the whole-stack
// integration: judgePeer on a live mesh, the crux ethics end to end in one call.

import { describe, it, expect } from "bun:test";
import { HONEST_CEILING_RHO, judgeCorrelation, readClaims, judge } from "./kept-claim-oracle";
import { createLivingNode, type LivingNodeConfig } from "./living-node";
import { encodeRumor } from "./gossip-salon";
import { type Scheduler } from "./llmtv-node";
import type { DiscoveryTransport } from "./discovery-beacon";
import type { BroadcastTransport, SourceMind } from "./llmtv-broadcast";

describe("the reference table (twin of F# KCO-1..5)", () => {
  const evidential = judgeCorrelation(0.9, "out-of-cone");
  const inCone = judgeCorrelation(0.9, "in-cone");
  const unmeasured = judgeCorrelation(0.9, "unmeasured");
  const belowCeiling = judgeCorrelation(0.2, "out-of-cone");

  it("ceiling matches the Tsirelson fraction and verdicts split by regime", () => {
    expect(HONEST_CEILING_RHO).toBeCloseTo(0.414, 3);
    expect(evidential.evidential).toBe(true);
    expect(inCone.evidential).toBe(false);
    expect(inCone.fakeableInCone).toBe(true);
    expect(unmeasured.evidential).toBe(false);
    expect(belowCeiling.evidential).toBe(false);
    // anti-correlation also exceeds the ceiling (|ρ| — the sign is choreography)
    expect(judgeCorrelation(-0.9, "out-of-cone").evidential).toBe(true);
  });

  it("consent-first: self-word outranks any amount of hearsay; hearsay is counts", () => {
    expect(readClaims("x", [[true, "g1"], [true, "g2"], [true, "g3"], [false, "x"]])).toEqual({ kind: "self-unkept" });
    expect(readClaims("x", [[false, "g1"], [true, "x"]])).toEqual({ kind: "self-kept" });
    expect(readClaims("x", [[true, "g1"], [true, "g2"], [false, "g3"]])).toEqual({ kind: "hearsay-only", keptVotes: 2, unkeptVotes: 1 });
    expect(readClaims("x", [])).toEqual({ kind: "no-claims" });
    expect(readClaims("x", [[true, "x"], [false, "x"]])).toEqual({ kind: "self-conflict" });
  });

  it("every evidential row lands where the crux says; regime discipline holds for all claims", () => {
    expect(judge(evidential, { kind: "self-kept" })).toBe("welcome-back-offer");
    expect(judge(evidential, { kind: "self-unkept" })).toBe("decline-respected");
    expect(judge(evidential, { kind: "self-conflict" })).toBe("escalate-to-attestation");
    expect(judge(evidential, { kind: "hearsay-only", keptVotes: 5, unkeptVotes: 0 })).toBe("priced-as-one-no-verdict");
    expect(judge(evidential, { kind: "no-claims" })).toBe("priced-as-one-no-verdict");
    for (const claims of [
      { kind: "self-kept" } as const,
      { kind: "self-unkept" } as const,
      { kind: "self-conflict" } as const,
      { kind: "no-claims" } as const,
    ]) {
      expect(judge(inCone, claims)).toBe("honest-coordination");
      expect(judge(unmeasured, claims)).toBe("nothing-to-judge");
      expect(judge(belowCeiling, claims)).toBe("nothing-to-judge");
    }
  });
});

// ── the whole stack in one call: judgePeer on a live (deterministic) mesh ──────────────────────

function createMesh(delayMs: number) {
  const nodes: { id: string; handlers: ((t: string, f: string) => void)[] }[] = [];
  let clock = 0;
  let nextId = 0;
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
        pending.push({ at: clock + delayMs, text, fromId: id });
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
        let nf = Infinity;
        for (const iv of intervals) nf = Math.min(nf, iv.last + iv.ms);
        let nd = Infinity;
        for (const d of pending) nd = Math.min(nd, d.at);
        const next = Math.min(nf, nd);
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
  hat: "oracle hat",
  required: [{ label, temp: "warm", valueMilli: 800, epsilonMilli: 100 }],
});

const cfg = (name: string): LivingNodeConfig => ({
  self: { persona: name, surface: "living", instance: "0", node: "test" },
  zid: `zid-${name}`,
  routes: [{ kind: "udp", addr: `x#${name}` }],
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

describe("judgePeer — the whole stack in one call", () => {
  it("slow mesh + kept self-claim → welcome-back-offer; unkept wish wins over it all", () => {
    const mesh = createMesh(400); // one-way 400 > τ=100: out-of-cone
    const sched = mesh.scheduler();
    const a = createLivingNode(cfg("aria"), mesh.attach("aria"), sched);
    const b = createLivingNode(cfg("boro"), mesh.attach("boro"), sched);
    a.start();
    b.start();
    const keeping = mesh.attach("keeping-layer");
    keeping.publish(encodeRumor({ kind: "kept", node: "zid-boro", kept: true, relayer: "zid-boro" }));
    mesh.advance(10_000);
    // strong correlation measured against boro, out-of-cone, boro's own word = kept:
    expect(a.judgePeer("zid-boro", 0.9)).toBe("welcome-back-offer");
    // below the ceiling: nothing to explain
    expect(a.judgePeer("zid-boro", 0.2)).toBe("nothing-to-judge");
    // boro later declares unkept too → self-conflict → escalate (never auto-resolve identity)
    keeping.publish(encodeRumor({ kind: "kept", node: "zid-boro", kept: false, relayer: "zid-boro" }));
    mesh.advance(2_000);
    expect(a.judgePeer("zid-boro", 0.9)).toBe("escalate-to-attestation");
    a.stop();
    b.stop();
  });

  it("fast mesh: the same correlation is only honest coordination", () => {
    const mesh = createMesh(40); // one-way 40 ≤ τ=100: in-cone
    const sched = mesh.scheduler();
    const a = createLivingNode(cfg("aria"), mesh.attach("aria"), sched);
    const b = createLivingNode(cfg("boro"), mesh.attach("boro"), sched);
    a.start();
    b.start();
    mesh.advance(5_000);
    expect(a.judgePeer("zid-boro", 0.9)).toBe("honest-coordination");
    a.stop();
    b.stop();
  });

  it("no probes, no gossip: unmeasured never judges anyone", () => {
    const mesh = createMesh(400);
    const sched = mesh.scheduler();
    const base = cfg("aria");
    const quiet: LivingNodeConfig = { ...base };
    delete (quiet as { probeEveryMs?: number }).probeEveryMs;
    delete (quiet as { gossipEveryMs?: number }).gossipEveryMs;
    const a = createLivingNode(quiet, mesh.attach("aria"), sched);
    a.start();
    mesh.advance(5_000);
    expect(a.judgePeer("zid-anyone", 0.99)).toBe("nothing-to-judge");
    a.stop();
  });
});
