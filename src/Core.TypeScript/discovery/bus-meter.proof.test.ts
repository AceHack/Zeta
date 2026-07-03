// bus-meter.proof — the armed readout, proven (register B, same discipline as the other proofs:
// exhaustive sweeps over integer domains, deterministic, no randomness) — plus a delayed-mesh
// integration test: two living nodes on a fake wire with REAL latency, regime flips with τ.

import { describe, it, expect } from "bun:test";
import {
  emptyMeter,
  foldSample,
  bestOneWayMs,
  regimeOf,
  isEvidential,
  encodeProbe,
  decodeProbe,
  SAMPLE_CAP,
  type BusMeter,
  type Regime,
} from "./bus-meter";
import { TSIRELSON_MILLI } from "./correlation";
import { createLivingNode, type LivingNodeConfig } from "./living-node";
import { type Scheduler } from "./llmtv-node";
import type { DiscoveryTransport } from "./discovery-beacon";
import type { BroadcastTransport, SourceMind } from "./llmtv-broadcast";

describe("PROVEN: the meter fold and the regime verdict (exhaustive)", () => {
  it("unmeasured until the first sample; then best one-way = min(RTT)/2, for every sample order", () => {
    expect(bestOneWayMs(emptyMeter)).toBeNull();
    expect(regimeOf(emptyMeter, 1000)).toBe("unmeasured");
    // all permutations of a 4-sample set give the same best (fold is order-insensitive on min)
    const samples = [80, 40, 120, 60];
    const perms = permute(samples);
    for (const perm of perms) {
      let m: BusMeter = emptyMeter;
      for (const s of perm) m = foldSample(m, s);
      expect(bestOneWayMs(m)).toBe(20); // min 40 → one-way 20
    }
  });

  it("regime boundary is exact: in-cone ⟺ min(RTT)/2 ≤ τ (swept over RTT × τ grids)", () => {
    for (let rtt = 0; rtt <= 400; rtt++) {
      const m = foldSample(emptyMeter, rtt);
      const best = Math.round(rtt / 2);
      for (let tau = 0; tau <= 200; tau += 1) {
        expect(regimeOf(m, tau)).toBe(best <= tau ? "in-cone" : "out-of-cone");
      }
    }
  });

  it("a single fast crossing kills out-of-cone forever within the window (conservative min)", () => {
    let m: BusMeter = emptyMeter;
    for (let i = 0; i < SAMPLE_CAP - 1; i++) m = foldSample(m, 500); // slow bus, out-of-cone at τ=100
    expect(regimeOf(m, 100)).toBe("out-of-cone");
    m = foldSample(m, 10); // ONE fast crossing observed
    expect(regimeOf(m, 100)).toBe("in-cone"); // evidence dies — a signal path existed
  });

  it("the window is bounded: old samples age out past SAMPLE_CAP", () => {
    let m: BusMeter = emptyMeter;
    m = foldSample(m, 10); // fast crossing
    for (let i = 0; i < SAMPLE_CAP; i++) m = foldSample(m, 500); // cap pushes it out
    expect(m.rttSamples.length).toBe(SAMPLE_CAP);
    expect(regimeOf(m, 100)).toBe("out-of-cone"); // the stale fast sample no longer rules
  });

  it("isEvidential truth table: S > 2√2 AND out-of-cone, nothing else (swept over S × regime)", () => {
    const regimes: Regime[] = ["in-cone", "out-of-cone", "unmeasured"];
    for (let s = 0; s <= 5000; s++) {
      for (const r of regimes) {
        expect(isEvidential(s, r)).toBe(s > TSIRELSON_MILLI && r === "out-of-cone");
      }
    }
  });

  it("probe codec round-trips; foreign packets decode to null", () => {
    const p = { t: "probe" as const, from: "zid-a", nonce: 7, sentAt: 123 };
    const a = { t: "ack" as const, from: "zid-b", to: "zid-a", nonce: 7, sentAt: 123 };
    expect(decodeProbe(encodeProbe(p))).toEqual({ ...p, to: undefined });
    expect(decodeProbe(encodeProbe(a))).toEqual(a);
    expect(decodeProbe("llmtv/1 {}")).toBeNull();
    expect(decodeProbe("busprobe/1 not-json")).toBeNull();
    expect(decodeProbe('busprobe/1 {"t":"probe"}')).toBeNull(); // missing fields
    expect(decodeProbe("")).toBeNull();
  });
});

function permute<T>(xs: T[]): T[][] {
  if (xs.length <= 1) return [xs];
  return xs.flatMap((x, i) => permute([...xs.slice(0, i), ...xs.slice(i + 1)]).map((rest) => [x, ...rest]));
}

// ── Integration: two living nodes on a mesh with REAL latency — the regime flips with τ ────────

/// A fake mesh whose deliveries take `delayMs` of simulated time — messages land only as the
/// clock advances past sendTime + delay. Deterministic; interleaves interval fires and deliveries
/// in time order.
type MeshHandler = (t: string, f: string) => void;

function createDelayedMesh(delayMs: number) {
  const nodes: { id: string; handlers: MeshHandler[] }[] = [];
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
      const self = { id, handlers: [] as MeshHandler[] };
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
  hat: "meter hat",
  required: [{ label, temp: "warm", valueMilli: 800, epsilonMilli: 100 }],
});

const cfg = (name: string, deadlineMs: number, metered = true): LivingNodeConfig => ({
  self: { persona: name, surface: "living", instance: "0", node: "test" },
  zid: `zid-${name}`,
  routes: [{ kind: "udp", addr: `239.0.0.1:5000#${name}` }],
  source: { zid: `zid-${name}`, name },
  mind: mind(name),
  ttlMs: 60_000,
  helloEveryMs: 1_000,
  publishEveryMs: 1_000,
  cloneMind: {
    zid: `zid-${name}`,
    entropyBudget: 1000,
    regions: [
      { regionId: "work", frosted: false },
      { regionId: "inner", frosted: true },
    ],
  },
  spendEnvelope: { id: `env-${name}`, capMicroUsd: 1_000_000, perCallMaxMicroUsd: 200_000, windowMs: 60_000, windowMaxMicroUsd: 500_000 },
  collapseThresholdMilli: 100,
  maxPauseMs: 60_000,
  ...(metered ? { probeEveryMs: 1_000 } : {}),
  decisionDeadlineMs: deadlineMs,
});

describe("integration: the meter arms the living node's readout on a delayed wire", () => {
  it("fast bus (delay 40, τ=100): in-cone — S above 2√2 is measured but NOT evidential", () => {
    const mesh = createDelayedMesh(40);
    const sched = mesh.scheduler();
    const a = createLivingNode(cfg("aria", 100), mesh.attach("aria"), sched);
    const b = createLivingNode(cfg("boro", 100), mesh.attach("boro"), sched);
    a.start();
    b.start();
    mesh.advance(3_000); // probes fire and acks return: RTT = 80, one-way = 40 ≤ τ=100
    expect(a.busDelayMs()).toBe(40);
    expect(a.regime()).toBe("in-cone");
    // both link both linkable... only "work" is unfrosted; both link it → coordination
    a.linkRegion("work", "hive/build", 100);
    b.linkRegion("work", "hive/build", 100);
    mesh.advance(200); // join announcements cross the 40ms wire
    const armed = a.sEvidential();
    expect(armed.sMilli).toBe(3000); // 1 of 2 regions coordinated → S=3 (> 2√2)
    expect(armed.cls).toBe("superquantum");
    expect(armed.regime).toBe("in-cone");
    expect(armed.evidential).toBe(false); // fakeable — the bus beats the deadline
    a.stop();
    b.stop();
  });

  it("slow bus (delay 400, τ=100): out-of-cone — the same S=3 readout IS evidential", () => {
    const mesh = createDelayedMesh(400);
    const sched = mesh.scheduler();
    const a = createLivingNode(cfg("aria", 100), mesh.attach("aria"), sched);
    const b = createLivingNode(cfg("boro", 100), mesh.attach("boro"), sched);
    a.start();
    b.start();
    mesh.advance(5_000); // RTT = 800, one-way = 400 > τ=100
    expect(a.busDelayMs()).toBe(400);
    expect(a.regime()).toBe("out-of-cone");
    a.linkRegion("work", "hive/build", 100);
    b.linkRegion("work", "hive/build", 100);
    mesh.advance(1_000); // join announcements cross the slow wire
    const armed = a.sEvidential();
    expect(armed.sMilli).toBe(3000);
    expect(armed.cls).toBe("superquantum");
    expect(armed.regime).toBe("out-of-cone");
    expect(armed.evidential).toBe(true); // more correlation than the wire can explain
    a.stop();
    b.stop();
  });

  it("unmetered node (no probeEveryMs): regime stays unmeasured, never evidential", () => {
    const mesh = createDelayedMesh(400);
    const sched = mesh.scheduler();
    const a = createLivingNode(cfg("aria", 100, false), mesh.attach("aria"), sched);
    const b = createLivingNode(cfg("boro", 100), mesh.attach("boro"), sched);
    a.start();
    b.start();
    mesh.advance(5_000);
    expect(a.busDelayMs()).toBeNull();
    expect(a.regime()).toBe("unmeasured");
    a.linkRegion("work", "hive/build", 100);
    b.linkRegion("work", "hive/build", 100);
    mesh.advance(1_000);
    expect(a.sEvidential().evidential).toBe(false); // an unmeasured bus never upgrades to evidence
    a.stop();
    b.stop();
  });
});
