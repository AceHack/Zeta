// correlation.proof — the PROVEN core of the correlation model (math-team triage 2026-07-03).
//
// These are not sampled property tests: the correlation functions are total on integer milli-S, so
// we sweep the WHOLE meaningful domain [0, 5000] exhaustively — every claim below is proven for
// every input, deterministically (no randomness; DST-clean). The living-node exit guarantee is
// proven by bounded-trace enumeration: every op-sequence to depth 6 over 2 regions × 2 subjects.
//
// Register discipline: these five invariants are the register-B core ("formalizable here") of the
// shortcut corpus. The human readings (autonomy/intimacy/enmeshment) are register-C models and are
// NOT claimed by these proofs. See docs/research/2026-07-03-provability-triage-…md.

import { describe, it, expect } from "bun:test";
import { classify, classRank, distanceOf, isIndependent, LOCAL_BOUND_MILLI, TSIRELSON_MILLI, PR_BOX_MILLI, type CorrelationClass } from "./correlation";
import { createLivingNode, type LivingNodeConfig } from "./living-node";
import { type Scheduler } from "./llmtv-node";
import type { DiscoveryTransport } from "./discovery-beacon";
import type { BroadcastTransport, SourceMind } from "./llmtv-broadcast";

const SWEEP_MAX = 5000; // covers [0, PR_BOX_MILLI] with margin above the top bound

describe("PROVEN (exhaustive sweep over all integer milli-S in [0, 5000])", () => {
  it("bound ordering: 2000 ≤ 2828 ≤ 4000 (CHSH 1969 / Tsirelson 1980 / Popescu–Rohrlich 1994)", () => {
    expect(LOCAL_BOUND_MILLI).toBeLessThanOrEqual(TSIRELSON_MILLI);
    expect(TSIRELSON_MILLI).toBeLessThanOrEqual(PR_BOX_MILLI);
  });

  it("distanceOf is monotone non-decreasing and zero exactly at/below the local bound", () => {
    let prev = distanceOf(0);
    for (let s = 1; s <= SWEEP_MAX; s++) {
      const d = distanceOf(s);
      expect(d).toBeGreaterThanOrEqual(prev); // monotone
      expect(d === 0).toBe(s <= LOCAL_BOUND_MILLI); // zero ⟺ at/below S=2
      prev = d;
    }
  });

  it("classify is order-preserving into the poset local(0) ≤ quantum(1) ≤ signaling(2)", () => {
    let prevRank = classRank(classify(0));
    for (let s = 1; s <= SWEEP_MAX; s++) {
      const rank = classRank(classify(s));
      expect(rank).toBeGreaterThanOrEqual(prevRank); // more S never lowers the class
      prevRank = rank;
    }
  });

  it("class boundaries land exactly on the bounds (≤2000 local, ≤2828 quantum, else signaling)", () => {
    const expectedAt = (s: number): CorrelationClass => {
      if (s <= LOCAL_BOUND_MILLI) return "local";
      if (s <= TSIRELSON_MILLI) return "quantum";
      return "signaling";
    };
    for (let s = 0; s <= SWEEP_MAX; s++) {
      expect(classify(s)).toBe(expectedAt(s));
    }
  });

  it("isIndependent(s) ⟺ distanceOf(s) = 0 — the biconditional, everywhere", () => {
    for (let s = 0; s <= SWEEP_MAX; s++) {
      expect(isIndependent(s)).toBe(distanceOf(s) === 0);
    }
  });
});

// ── Exit restores independence — bounded-trace enumeration over the living node ────────────────
// The load-bearing safety claim: after ANY sequence of link/unlink operations that ends with no
// live links, the node reads S=2 (independent, class local). Proven for every op-sequence of
// length ≤ DEPTH over REGIONS × SUBJECTS, plus the drain (unlink-all) suffix on every trace.

function fakeNode() {
  const scheduler: Scheduler = { now: () => 0, setInterval: () => () => undefined };
  const transport: DiscoveryTransport & BroadcastTransport = {
    broadcast: () => undefined, // the proof node never transmits — links are exercised directly
    publish: () => undefined,
    onMessage: () => undefined,
    onFrame: () => undefined,
  };
  const mind = (): SourceMind => ({
    role: "living",
    hat: "proof hat",
    required: [{ label: "invariant", temp: "warm", valueMilli: 800, epsilonMilli: 100 }],
  });
  const config: LivingNodeConfig = {
    self: { persona: "proof", surface: "living", instance: "0", node: "test" },
    zid: "zid-proof",
    routes: [{ kind: "udp", addr: "239.0.0.1:5000#proof" }],
    source: { zid: "zid-proof", name: "proof" },
    mind,
    ttlMs: 10_000,
    helloEveryMs: 1_000,
    publishEveryMs: 1_000,
    cloneMind: {
      zid: "zid-proof",
      entropyBudget: 1_000_000, // ample — budget exhaustion is a different theorem
      regions: [
        { regionId: "rA", frosted: false },
        { regionId: "rB", frosted: false },
      ],
    },
    spendEnvelope: { id: "env-proof", capMicroUsd: 1_000_000, perCallMaxMicroUsd: 200_000, windowMs: 60_000, windowMaxMicroUsd: 500_000 },
    collapseThresholdMilli: 100,
    maxPauseMs: 60_000,
  };
  return createLivingNode(config, transport, scheduler);
}

type Op = { kind: "link"; region: string; subject: string } | { kind: "unlink"; region: string };

const REGIONS = ["rA", "rB"] as const;
const SUBJECTS = ["s1", "s2"] as const;
const OPS: Op[] = [
  ...REGIONS.flatMap((r) => SUBJECTS.map((s): Op => ({ kind: "link", region: r, subject: s }))),
  ...REGIONS.map((r): Op => ({ kind: "unlink", region: r })),
];
const DEPTH = 6;

describe("PROVEN (bounded-trace enumeration): exit always restores independence", () => {
  it(`every op-sequence to depth ${String(DEPTH)}, once drained of links, reads S=2 / local / distance 0`, () => {
    let traces = 0;
    const run = (trace: Op[]): void => {
      const node = fakeNode();
      for (const op of trace) {
        if (op.kind === "link") node.linkRegion(op.region, op.subject, 10);
        else node.unlinkRegion(op.region);
      }
      // drain: exit everything — unlink is never deniable, so this always succeeds
      for (const r of REGIONS) node.unlinkRegion(r);
      expect(node.links().size).toBe(0);
      expect(node.sReadout()).toBe(2);
      expect(node.correlationClass()).toBe("local");
      expect(node.distanceToCorrelation()).toBe(0);
      traces++;
    };
    const extend = (trace: Op[]): void => {
      run(trace);
      if (trace.length >= DEPTH) return;
      for (const op of OPS) extend([...trace, op]);
    };
    extend([]);
    // 6 ops per step, depth 6: 1 + 6 + 36 + … + 6^6 = 55987 traces, all proven
    expect(traces).toBe((6 ** (DEPTH + 1) - 1) / 5);
  });
});
