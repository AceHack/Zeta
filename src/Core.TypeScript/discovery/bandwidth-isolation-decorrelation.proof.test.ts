/**
 * bandwidth-isolation-decorrelation.proof.test.ts — BID-1..BID-12.
 *
 * Three kinds of test live here and they are labelled, because mixing them is how a green suite
 * becomes an endorsement:
 *
 *   - **INSTRUMENT FALSIFIERS** (BID-1..BID-4) — checks on the CORRELATION STATISTIC itself. If
 *     `pearson` / `covarianceLeverage` are wrong, every number below them is decoration.
 *   - **ARTIFACT PINS** (BID-5..BID-7) — the three ways this instrument was observed to lie. Each
 *     pins the LIE, so that a future change which quietly stops producing it is visible.
 *   - **FINDING PINS** (BID-8..BID-12) — the measured result and its falsifier. BID-11 is the one
 *     that would void the study; BID-12 pins the finding that CONTRADICTS the claim under test and
 *     is the most important test in the file.
 *
 * Every test is a pure function of a fixed seed ladder. No clock, no rng, no network.
 */
import { describe, expect, it } from "bun:test";
import {
  contentionSweep,
  correlate,
  covarianceLeverage,
  defaultIsolation,
  isolationPoint,
  pearson,
  seedLadder,
  sweepIsolation,
  type IsolationConfig,
} from "./bandwidth-isolation-decorrelation";
import { defaultLink } from "./udp-bdp-link";

const SEEDS = seedLadder(24);

/** The primary configuration: open-loop (the SHIPPED sender), 300 pkt/s per flow, 20 s. */
function primary(overrides: Partial<IsolationConfig["base"]> = {}): IsolationConfig {
  const b = defaultIsolation();
  return { ...b, base: { ...b.base, pacing: { kind: "open-loop", offeredPktPerSec: 300 }, ...overrides } };
}

function atCapacity(C: number): IsolationConfig {
  const p = primary();
  return {
    ...p,
    base: {
      ...p.base,
      link: defaultLink({ capacityPktPerSec: C, owdMs: 20, bufferPackets: Math.max(1, Math.round(C * 0.04)) }),
    },
  };
}

// -- INSTRUMENT FALSIFIERS -----------------------------------------------------------------

describe("BID: instrument falsifiers", () => {
  it("BID-1 pearson is exact on the two cases whose answer is known by construction", () => {
    expect(pearson([1, 2, 3, 4], [2, 4, 6, 8])).toBeCloseTo(1, 12);
    expect(pearson([1, 2, 3, 4], [8, 6, 4, 2])).toBeCloseTo(-1, 12);
  });

  it("BID-2 a constant series makes r UNDEFINED, not zero", () => {
    // The whole distinction. A `0` here would report "no coupling" for a run that measured
    // nothing, which is the blind-instrument class this repo has found eleven of.
    expect(pearson([5, 5, 5, 5], [1, 2, 3, 4])).toBeNull();
    expect(pearson([5, 5, 5, 5], [5, 5, 5, 5])).toBeNull();
    expect(correlate([5, 5, 5, 5], [1, 2, 3, 4], 2).verdict).toBe("undefined-constant");
  });

  it("BID-3 covarianceLeverage detects a one-sample statistic", () => {
    // 199 identical samples and one outlier pair: r is +1 and it is entirely one sample.
    const x = Array.from({ length: 200 }, (_, i) => (i === 199 ? 51 : 50));
    const y = x.slice();
    expect(pearson(x, y)).toBeCloseTo(1, 12);
    // 0.995, not 1.0: the 199 identical samples each sit 0.005 off the mean, so they contribute a
    // vanishing but nonzero share. Asserted as a bound rather than rounded to 1 — asserting the
    // tidy number would have been the first small lie in a file about numbers that lie.
    expect(covarianceLeverage(x, y)!).toBeGreaterThan(0.99);
    expect(covarianceLeverage(x, y)!).toBeLessThan(1);
    expect(correlate(x, y, 0).verdict).toBe("one-sample-leverage");
    // ...while a genuinely varying series of the same length is NOT refused.
    const z = Array.from({ length: 200 }, (_, i) => (i % 7) - 3);
    expect(correlate(z, z, 0).verdict).toBe("ok");
  });

  it("BID-4 the sweep is DST-deterministic — same seeds, byte-identical r", () => {
    const cfg = atCapacity(1000);
    const a = sweepIsolation(cfg, SEEDS.slice(0, 4));
    const b = sweepIsolation(cfg, SEEDS.slice(0, 4));
    expect(a.points.map((p) => p.delivered.r)).toEqual(b.points.map((p) => p.delivered.r));
    expect(a.points.map((p) => p.saturation)).toEqual(b.points.map((p) => p.saturation));
  });
});

// -- ARTIFACT PINS -------------------------------------------------------------------------

describe("BID: the three ways this instrument lies", () => {
  it("BID-5 (F1) a SATURATED shared link reports r = -1 as an ACCOUNTING IDENTITY", () => {
    // Every bucket sums to exactly C*sampleMs/1000, so d1 = TOTAL - d0. The -1 is arithmetic.
    // It is pinned here so that anyone reading a -1 off the shared arm sees this test first.
    const sat = primary({ pacing: { kind: "open-loop", offeredPktPerSec: 900 } });
    const p = isolationPoint(sat, "shared", SEEDS[0]!);
    expect(p.saturation).toBeGreaterThan(0.95);
    expect(p.delivered.r!).toBeLessThan(-0.99);
    // The guard is `saturation`, and it is the only thing standing between this number and a
    // headline. The verdict is deliberately still "ok": the statistic is well-formed, it is the
    // INTERPRETATION that is void, and a verdict cannot carry that.
    expect(p.delivered.verdict).toBe("ok");
  });

  it("BID-6 (F2) two SATURATED ISOLATED links report r = +1 off ONE bucket in 190 — refused", () => {
    // Independent by construction, maximal correlation reported. The series takes exactly two
    // distinct values; a single partial final bucket rescues it from being constant.
    const sat = primary({ pacing: { kind: "open-loop", offeredPktPerSec: 900 } });
    const p = isolationPoint(sat, "isolated-split", SEEDS[0]!);
    expect(p.delivered.r!).toBeGreaterThan(0.99);
    expect(p.delivered.distinct[0]).toBeLessThanOrEqual(2);
    expect(p.delivered.leverage!).toBeGreaterThan(0.9);
    // ...and THIS one the instrument does refuse, which is the difference the guard makes.
    expect(p.delivered.verdict).toBe("one-sample-leverage");
  });

  it("BID-7 the guard is load-bearing: the saturated isolated arm is refused for EVERY seed", () => {
    const sat = primary({ pacing: { kind: "open-loop", offeredPktPerSec: 900 } });
    const sw = sweepIsolation(sat, SEEDS.slice(0, 8));
    const iso = sw.summaries.find((s) => s.arm === "isolated-split")!;
    expect(iso.refusedLeverage).toBe(8);
    expect(iso.usable).toBe(0);
    expect(iso.meanR).toBeNull(); // refusing to answer IS the answer
  });
});

// -- FINDING PINS --------------------------------------------------------------------------

describe("BID: the measured finding", () => {
  it("BID-8 a SHARED bottleneck couples two independent flows — 24/24 seeds, one sign", () => {
    // 300 pkt/s per flow on a 700 pkt/s link: 74% utilisation, ZERO congestion drops. The only
    // coupling is queueing delay — one flow's packet in service is the other flow's wait.
    const sw = sweepIsolation(atCapacity(700), SEEDS);
    const shared = sw.summaries.find((s) => s.arm === "shared")!;
    expect(shared.usable).toBe(24);
    expect(shared.meanSaturation).toBeLessThan(0.8); // not the F1 regime
    expect(shared.meanR!).toBeLessThan(-0.15);
    // The sign test — Binomial(24, 1/2) under the null, p = 2^-24. It assumes nothing about the
    // series being i.i.d., which is why it and not a t-statistic is the significance claim.
    expect(shared.negative).toBe(24);
  });

  it("BID-9 ISOLATING the bandwidth returns the correlation to a coin flip", () => {
    const sw = sweepIsolation(atCapacity(700), SEEDS);
    const iso = sw.summaries.find((s) => s.arm === "isolated-split")!;
    expect(iso.usable).toBe(24);
    expect(Math.abs(iso.meanR!)).toBeLessThan(0.05);
    // A coin flip: the sign is not consistent, which is the property the shared arm lacks.
    expect(iso.negative).toBeGreaterThan(6);
    expect(iso.negative).toBeLessThan(18);
  });

  it("BID-10 capacity is CONSERVED across the arms — isolation is not measured against a bigger pipe", () => {
    const sw = sweepIsolation(atCapacity(700), SEEDS);
    const shared = sw.summaries.find((s) => s.arm === "shared")!;
    const iso = sw.summaries.find((s) => s.arm === "isolated-split")!;
    // Same total delivered throughput to within a packet per second: `isolated-split` is a
    // BULKHEAD (C/2 + C/2), not an upgrade. Without this the whole comparison is confounded.
    expect(Math.abs(shared.meanTotalThroughputPktPerSec - iso.meanTotalThroughputPktPerSec)).toBeLessThan(1);
  });

  it("BID-11 THE FALSIFIER: the coupling is the QUEUE — it decays to the null as capacity rises", () => {
    // Offered load FIXED, capacity raised. If the shared-arm correlation did NOT decay, it was an
    // artifact of running both flows in one simulation and the entire study is void.
    const pts = contentionSweep(primary(), SEEDS, [700, 1000, 1400, 2000, 5000, 20000]);
    const shared = pts.map((p) => Math.abs(p.shared.meanR!));
    // Monotone decay, no threshold moved.
    for (let i = 1; i < shared.length; i++) expect(shared[i]!).toBeLessThanOrEqual(shared[i - 1]! + 1e-9);
    expect(shared[0]!).toBeGreaterThan(0.2); // 74% utilisation
    expect(shared[shared.length - 1]!).toBeLessThan(0.02); // 3% utilisation — indistinguishable from null
    // The isolated arm is FLAT across the same sweep: it never had a queue to share.
    for (const p of pts) expect(Math.abs(p.isolatedSplit.meanR!)).toBeLessThan(0.05);
  }, 120_000); // 6 capacities x 3 arms x 24 seeds of 20 s discrete-event simulation

  it("BID-12 THE LIMIT: a SHARED ATTRACTOR correlates ISOLATED flows MORE than a shared link", () => {
    // The finding that contradicts the unqualified claim, and the most important test here.
    //
    // Two flows, each alone on its own private sub-link, running the same AIMD control law, both
    // driven toward `MAX_GAP_MS` by the known unwired-controller defect (`UBL-12`). There is NO
    // channel between them — and their controller trajectories correlate at ~0.71, nearly three
    // times the shared arm's ~0.26. Both readings pass both guards; this is not an artifact.
    //
    // Reichenbach 1956: a correlation has a common cause OR a channel. Bandwidth isolation removes
    // the channel. It does not remove the shared design, and a shared design at a shared boundary
    // is a common cause. If this test ever goes green by the isolated number FALLING, check
    // whether the controller was wired up before concluding the claim was rescued.
    const b = defaultIsolation();
    const cfg: IsolationConfig = {
      ...b,
      base: {
        ...b.base,
        link: defaultLink({ capacityPktPerSec: 1000, owdMs: 20, bufferPackets: 40 }),
        pacing: { kind: "aimd", initialGapMs: 3 },
      },
    };
    const seeds = SEEDS.slice(0, 16);
    const gapR = (arm: "shared" | "isolated-split"): number => {
      const rs = seeds
        .map((s) => isolationPoint(cfg, arm, s))
        .filter((p) => p.gap.verdict === "ok")
        .map((p) => p.gap.r!);
      expect(rs.length).toBe(16); // every reading usable — no guard is doing the work here
      return rs.reduce((x, y) => x + y, 0) / rs.length;
    };
    const sharedGapR = gapR("shared");
    const isolatedGapR = gapR("isolated-split");
    expect(isolatedGapR).toBeGreaterThan(0.6);
    expect(sharedGapR).toBeLessThan(0.4);
    expect(isolatedGapR).toBeGreaterThan(sharedGapR);
  });
});
