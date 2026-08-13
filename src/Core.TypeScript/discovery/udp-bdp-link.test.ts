/**
 * udp-bdp-link.test.ts - UBL-1..UBL-14.
 *
 * Two kinds of test live here and they are labelled, because mixing them is how a green suite
 * becomes an endorsement:
 *
 *   - **MODEL FALSIFIERS** (UBL-1..UBL-5) - checks on the SIMULATOR. If the link model is wrong,
 *     every number below it is decoration. These must always pass.
 *   - **BEHAVIOUR PINS** (UBL-6..UBL-14) - checks on the TRANSPORT as it is today. Several pin
 *     defects, and each such test says so in its own comment and is **expected to FAIL when the
 *     defect is fixed**. That is deliberate: precedent set by UCH-13..16 in #10417. Whoever fixes
 *     the controller updates the pin in the same PR, and the failure is the signal it landed.
 */
import { describe, it, expect } from "bun:test";
import {
  bdpPackets,
  bufferbloatSweep,
  convergenceReport,
  corruptionVsCongestion,
  defaultLink,
  defaultSim,
  fairnessReport,
  gridConfig,
  jainFairness,
  recoveryReport,
  runLink,
  utilisationTable,
  type GridPoint,
  type SimResult,
} from "./udp-bdp-link";
import { burstParams } from "./udp-lossy-transport.chaos";

/** A comparable projection of a run. `config` holds a bigint, so it cannot go through JSON. */
function summarise(res: SimResult): string {
  return JSON.stringify({
    util: res.deliveredUtilisation,
    link: res.linkUtilisation,
    q: res.meanQueuePackets,
    maxq: res.maxQueuePackets,
    cong: res.totalCongestionDrops,
    corr: res.totalCorruptionDrops,
    fair: res.jainFairness,
    flows: res.flows.map((f) => [
      f.sent,
      f.delivered,
      f.congestionDrops,
      f.corruptionDrops,
      f.nacksEmitted,
      f.seqsReportedMissing,
      f.spuriousMissingSeqs,
      f.finalGapMs,
      f.meanOwdMs,
      f.p95OwdMs,
    ]),
  });
}

describe("udp-bdp-link model falsifiers", () => {
  // -- UBL-1: DST. Same seed replays byte-identically; a different seed does not. -----------
  it("UBL-1: a run is a pure function of its config (same seed identical, other seed differs)", () => {
    const cfg = gridConfig(
      "aimd",
      { capacityPktPerSec: 1000, owdMs: 20, bufferBdpMultiple: 1 },
      { durationMs: 5000 },
      burstParams(0.02, 4),
    );
    const a = summarise(runLink(cfg));
    const b = summarise(runLink(cfg));
    expect(b).toBe(a);
    const c = summarise(runLink({ ...cfg, seed: 0xd1ffn }));
    expect(c).not.toBe(a);
  });

  // -- UBL-2: Sec.13 stream disjointness. --------------------------------------------------
  // Delivery jitter draws on LINK_STREAM.jitter, corruption on LINK_STREAM.corrupt. In the
  // OPEN-LOOP arm the send schedule does not depend on feedback, so changing the jitter cannot
  // change which packets the channel corrupts. (In the AIMD arm it legitimately can, because
  // jitter changes NACKs, NACKs change the gap, and the gap changes the send schedule - that is
  // causation through the control loop, not stream leakage, so the test uses the arm where the
  // two are separable.)
  it("UBL-2: changing delivery jitter does not perturb the corruption trace (open-loop arm)", () => {
    const base = defaultSim({
      durationMs: 5000,
      pacing: { kind: "open-loop", offeredPktPerSec: 500 },
      link: defaultLink({ capacityPktPerSec: 4000, owdMs: 20, bufferPackets: 400, corruption: burstParams(0.05, 3) }),
    });
    const noJitter = runLink(base);
    const withJitter = runLink({ ...base, link: { ...base.link, jitterMs: 25 } });
    expect(withJitter.flows[0]!.sent).toBe(noJitter.flows[0]!.sent);
    expect(withJitter.totalCorruptionDrops).toBe(noJitter.totalCorruptionDrops);
    expect(withJitter.totalCorruptionDrops).toBeGreaterThan(0);
    // ... and jitter DID change something, or the test would be vacuous.
    expect(withJitter.flows[0]!.nacksEmitted).toBeGreaterThan(noJitter.flows[0]!.nacksEmitted);
  });

  // -- UBL-3: conservation + an exact analytic check on the empty queue. --------------------
  it("UBL-3: every sent packet is delivered, congestion-dropped or corrupted; empty-queue OWD is exact", () => {
    const link = defaultLink({ capacityPktPerSec: 1000, owdMs: 30, bufferPackets: 500, corruption: burstParams(0, 1) });
    const cfg = defaultSim({ link, durationMs: 5000, pacing: { kind: "open-loop", offeredPktPerSec: 200 } });
    const res = runLink(cfg);
    const f = res.flows[0]!;
    // A few packets are still in flight at the horizon, so delivered can trail sent by at most
    // the number that can be in the pipe: one delay-bandwidth product plus the buffer.
    const inFlightBound = Math.ceil((link.owdMs * link.capacityPktPerSec) / 1000) + link.bufferPackets;
    expect(f.sent - (f.delivered + f.congestionDrops + f.corruptionDrops)).toBeLessThanOrEqual(inFlightBound);
    expect(f.congestionDrops).toBe(0);
    expect(f.corruptionDrops).toBe(0);
    // Offered 200 pkt/s into a 1000 pkt/s link: the queue is always empty, so every packet takes
    // exactly one service time plus one propagation delay. This is the closed form, not a fit.
    expect(f.meanOwdMs).toBeCloseTo(link.owdMs + 1000 / link.capacityPktPerSec, 9);
    expect(res.meanQueuePackets).toBeLessThan(1);
  });

  // -- UBL-4: DoP is a throughput dial, not a semantics dial. -------------------------------
  it("UBL-4: the sweep is byte-identical at DoP 1, 4 and 8", async () => {
    const grid: GridPoint[] = [
      { capacityPktPerSec: 1000, owdMs: 20, bufferBdpMultiple: 1 },
      { capacityPktPerSec: 1000, owdMs: 20, bufferBdpMultiple: 4 },
      { capacityPktPerSec: 200, owdMs: 100, bufferBdpMultiple: 1 },
    ];
    const at = async (dop: number): Promise<string> =>
      JSON.stringify(await utilisationTable(grid, ["open-loop", "aimd"], { durationMs: 4000 }, dop));
    const one = await at(1);
    expect(await at(4)).toBe(one);
    expect(await at(8)).toBe(one);
  });

  // -- UBL-5: drop-tail bounds the queue, and the bound is the buffer. ----------------------
  it("UBL-5: a drop-tail buffer of B packets bounds queueing delay by B service times", () => {
    for (const bufferPackets of [1, 5, 50]) {
      const link = defaultLink({ capacityPktPerSec: 1000, owdMs: 10, bufferPackets, corruption: burstParams(0, 1) });
      const cfg = defaultSim({ link, durationMs: 4000, pacing: { kind: "open-loop", offeredPktPerSec: 4000 } });
      const res = runLink(cfg);
      const serviceMs = 1000 / link.capacityPktPerSec;
      expect(res.maxQueuePackets).toBeLessThanOrEqual(bufferPackets);
      expect(res.flows[0]!.p95OwdMs).toBeLessThanOrEqual(link.owdMs + bufferPackets * serviceMs + 1e-9);
      // A saturating source keeps a bounded buffer busy: the link should be essentially full.
      expect(res.linkUtilisation).toBeGreaterThan(0.99);
    }
  });

  it("UBL-5c: link utilisation never exceeds 1.0, even with a buffer deep enough to spill past the horizon", () => {
    for (const bufferPackets of [10, 800, 4000]) {
      const link = defaultLink({ capacityPktPerSec: 5000, owdMs: 100, bufferPackets, corruption: burstParams(0, 1) });
      const cfg = defaultSim({ link, durationMs: 10000, pacing: { kind: "open-loop", offeredPktPerSec: 10000 } });
      const res = runLink(cfg);
      expect(res.linkUtilisation).toBeLessThanOrEqual(1);
      expect(res.linkUtilisation).toBeGreaterThan(0.99);
      expect(res.deliveredUtilisation).toBeLessThanOrEqual(1);
    }
  });

  it("UBL-5b: the Jain index is 1 for an equal split and 1/n for total capture", () => {
    expect(jainFairness([100, 100])).toBeCloseTo(1, 12);
    expect(jainFairness([100, 0])).toBeCloseTo(0.5, 12);
    expect(jainFairness([100, 0, 0, 0])).toBeCloseTo(0.25, 12);
  });
});

describe("udp-bdp-link behaviour pins (current transport)", () => {
  // -- UBL-6: the utilisation table. --------------------------------------------------------
  //
  // PINS CURRENT BEHAVIOUR, and two rows of it are defects.
  //
  //   (a) The SHIPPED path (open-loop) fills any link, because `flushBlock` never reads `gapMs`.
  //       It fills it by overflowing the buffer, which is why the congestion-drop column is
  //       enormous - but the link itself is saturated.
  //   (b) The AIMD path cannot exceed 1000 packets/second on ANY link, because MIN_GAP_MS = 1ms
  //       is a hard ceiling of one packet per millisecond. On a 5000 pkt/s link that is a 16.8%
  //       utilisation ceiling that no channel condition can lift.
  //
  // Expected to FAIL when either the pacing is wired up (a) or MIN_GAP_MS is revisited (b).
  it("UBL-6: shipped open-loop saturates every link; AIMD is capped at 1000 pkt/s regardless of C", async () => {
    const grid: GridPoint[] = [
      { capacityPktPerSec: 200, owdMs: 20, bufferBdpMultiple: 1 },
      { capacityPktPerSec: 1000, owdMs: 20, bufferBdpMultiple: 1 },
      { capacityPktPerSec: 5000, owdMs: 20, bufferBdpMultiple: 1 },
    ];
    const rows = await utilisationTable(grid, ["open-loop", "aimd"], { durationMs: 10000 }, 1);
    const open = rows.filter((r) => r.arm === "open-loop");
    const aimd = rows.filter((r) => r.arm === "aimd");

    for (const r of open) {
      expect(r.deliveredUtilisation).toBeGreaterThan(0.99);
      // Saturation is bought with mass overflow, not with control.
      expect(r.congestionDrops).toBeGreaterThan(0.4 * r.capacityPktPerSec * 10);
    }

    // The 1000 pkt/s ceiling, as an absolute rate rather than a fraction.
    for (const r of aimd) {
      const achieved = r.deliveredUtilisation * r.capacityPktPerSec;
      expect(achieved).toBeLessThanOrEqual(1005);
    }
    const at5000 = aimd.find((r) => r.capacityPktPerSec === 5000)!;
    expect(at5000.deliveredUtilisation).toBeGreaterThan(0.15);
    expect(at5000.deliveredUtilisation).toBeLessThan(0.2);
    // And on a link SLOWER than the ceiling, the controller undershoots badly rather than
    // settling on the available bandwidth.
    const at200 = aimd.find((r) => r.capacityPktPerSec === 200)!;
    expect(at200.deliveredUtilisation).toBeLessThan(0.3);
  });

  // -- UBL-7: convergence. ------------------------------------------------------------------
  //
  // PINS CURRENT BEHAVIOUR - a defect. Neither arm converges to the available bandwidth.
  // The open-loop arm shows what the estimator COMPUTES while its output is discarded: the gap
  // is pinned at MAX_GAP_MS for 99% of the run on a link it is saturating perfectly well.
  // Expected to FAIL when 081KZYN37T4087G0R00181THA4 is fixed.
  it("UBL-7: the discarded gap pins at MAX_GAP_MS on a link the sender is saturating", () => {
    const cfg = gridConfig(
      "open-loop",
      { capacityPktPerSec: 1000, owdMs: 20, bufferBdpMultiple: 1 },
      { durationMs: 20000 },
    );
    const r = convergenceReport(cfg);
    expect(r.verdict).toBe("pinned-max");
    expect(r.fractionAtMaxGap).toBeGreaterThan(0.99);
    expect(r.finalGapMs).toBe(500);
    // The gap is a two-valued step function, not a control trajectory.
    expect(r.distinctGapValues).toBeLessThanOrEqual(3);
    // Meanwhile the link is full - so the signal driving the backoff is not a capacity signal.
    expect(r.deliveredUtilisation).toBeGreaterThan(0.99);
  });

  it("UBL-7b: on a link matched to its own ceiling the AIMD arm reaches MIN_GAP and stops there", () => {
    const cfg = gridConfig("aimd", { capacityPktPerSec: 1000, owdMs: 20, bufferBdpMultiple: 1 }, { durationMs: 20000 });
    const r = convergenceReport(cfg);
    expect(r.verdict).toBe("pinned-min");
    expect(r.nacksEmitted).toBe(0);
    // 0.92, not 1.0, because additive increase needs 19 windows to walk 10ms down to 1ms.
    expect(r.deliveredUtilisation).toBeGreaterThan(0.9);
    expect(r.deliveredUtilisation).toBeLessThan(0.95);
  });

  // -- UBL-8: fairness, and the model-hygiene control that goes with it. --------------------
  //
  // The first half of this test is a check on the HARNESS, not on the transport. Deterministic
  // pacing into a drop-tail queue is the exact configuration Floyd and Jacobson 1992 name as
  // producing phase-lock, where one flow is shut out by arrival phase rather than by any control
  // law. Measured at zero phase noise the harness reports total starvation - and that number is
  // an ARTIFACT. With 2ms of send-phase jitter it disappears. Reporting the first number as a
  // fairness finding would have been wrong, so both are pinned and the second is the real one.
  it("UBL-8: starvation at zero phase noise is a phase-lock artifact; with jitter both arms are fair", () => {
    const mk = (arm: "open-loop" | "aimd", sendPhaseJitterMs: number) => {
      const base = gridConfig(arm, { capacityPktPerSec: 1000, owdMs: 20, bufferBdpMultiple: 1 }, { durationMs: 20000 });
      return fairnessReport({ ...base, flowCount: 2, flowStartMs: [0, 5000], sendPhaseJitterMs });
    };

    const lockedOpen = mk("open-loop", 0);
    expect(lockedOpen.jainIndex).toBeLessThan(0.85);
    const jitteredOpen = mk("open-loop", 2);
    expect(jitteredOpen.jainIndex).toBeGreaterThan(0.95);

    // The transport finding, once the artifact is removed. Under loss that IS congestion -
    // no corruption, no reordering, just a full buffer - the controller does roughly what
    // Chiu and Jain 1989 promise: two flows converge to a fair share at a high utilisation.
    // This is the control that makes the corruption result below mean something: the
    // controller is not broken AS A CONGESTION CONTROLLER. It is broken when the loss it
    // reacts to is not congestion.
    const jitteredAimd = mk("aimd", 2);
    expect(jitteredAimd.jainIndex).toBeGreaterThan(0.95);
    expect(jitteredAimd.totalDeliveredUtilisation).toBeGreaterThan(0.7);
    expect(jitteredAimd.totalDeliveredUtilisation).toBeLessThan(0.9);
    expect(jitteredOpen.totalDeliveredUtilisation).toBeGreaterThan(0.85);
  });

  // -- UBL-9: bufferbloat. ------------------------------------------------------------------
  //
  // PINS CURRENT BEHAVIOUR - a defect, and it is the shipped path. Gettys and Nichols 2011: the
  // signature is a flat throughput column beside a rising delay column. A sender with no rate
  // control fills whatever buffer it is given.
  // Expected to FAIL when pacing is wired up.
  it("UBL-9: the shipped sender fills any buffer - 91x delay inflation for 0% more throughput", async () => {
    const pts = await bufferbloatSweep(
      ["open-loop"],
      [0.25, 1, 4, 16, 64],
      { capacityPktPerSec: 1000, owdMs: 20 },
      { durationMs: 10000 },
      1,
    );
    const small = pts.find((p) => p.bufferBdpMultiple === 0.25)!;
    const huge = pts.find((p) => p.bufferBdpMultiple === 64)!;
    // Throughput: identical to three decimal places.
    expect(Math.abs(huge.deliveredUtilisation - small.deliveredUtilisation)).toBeLessThan(0.005);
    // Delay: two orders of magnitude worse.
    expect(small.delayInflation).toBeLessThan(2);
    expect(huge.delayInflation).toBeGreaterThan(50);
    expect(huge.meanOwdMs).toBeGreaterThan(1500);
    // Monotone in the buffer, which is what makes it bufferbloat and not noise.
    const sorted = pts.slice().sort((a, b) => a.bufferBdpMultiple - b.bufferBdpMultiple);
    for (let i = 1; i < sorted.length; i++) expect(sorted[i]!.meanOwdMs).toBeGreaterThan(sorted[i - 1]!.meanOwdMs);
  });
});

describe("udp-bdp-link: the decisive experiment", () => {
  // -- UBL-10: corruption vs congestion. ----------------------------------------------------
  //
  // THE ONE THE HARNESS EXISTS FOR. Congestion is held at ZERO by construction (asserted, not
  // assumed): capacity is 4x the fastest rate either arm can produce and the buffer is 4x BDP.
  // Only the corruption rate moves.
  //
  // A controller that responds only to congestion is FLAT here, because nothing it does changes
  // the corruption rate - its throughput should track (1 - lossRate), the ideal line. The
  // open-loop arm does exactly that, which is the NEGATIVE CONTROL: it is flat because it
  // discards `gapMs` and therefore cannot respond to anything.
  //
  // PINS A DEFECT. Expected to FAIL when the corruption and congestion signals are separated.
  it("UBL-10: with congestion at zero, corruption alone collapses the AIMD arm 70x", async () => {
    const rates = [0, 0.005, 0.01, 0.02, 0.05, 0.1];
    const pts = await corruptionVsCongestion(["open-loop", "aimd"], rates, 1, { durationMs: 10000 }, 1);

    // The premise of the experiment, checked rather than asserted in prose.
    for (const p of pts) expect(p.congestionDrops).toBe(0);
    for (const p of pts) {
      if (p.targetCorruptionRate === 0) expect(p.observedCorruptionRate).toBe(0);
      else
        expect(Math.abs(p.observedCorruptionRate - p.targetCorruptionRate) / p.targetCorruptionRate).toBeLessThan(0.2);
    }

    const open = new Map(pts.filter((p) => p.arm === "open-loop").map((p) => [p.targetCorruptionRate, p]));
    const aimd = new Map(pts.filter((p) => p.arm === "aimd").map((p) => [p.targetCorruptionRate, p]));

    // NEGATIVE CONTROL: the signal-blind arm tracks the ideal line within 1 percentage point.
    for (const rate of rates) {
      const p = open.get(rate)!;
      expect(Math.abs(p.throughputRelativeToClean - (1 - rate))).toBeLessThan(0.01);
    }

    // THE FINDING: the arm that reacts to NACKs surrenders throughput no congestion asked for.
    expect(aimd.get(0.005)!.throughputRelativeToClean).toBeLessThan(0.9);
    expect(aimd.get(0.01)!.throughputRelativeToClean).toBeLessThan(0.7);
    expect(aimd.get(0.02)!.throughputRelativeToClean).toBeLessThan(0.2);
    expect(aimd.get(0.1)!.throughputRelativeToClean).toBeLessThan(0.02);

    // Stated as the ratio a reader can carry: at 2% corruption loss, the controller delivers
    // about 7x less than a controller that ignored the loss, and at 10% about 90x less.
    expect(open.get(0.02)!.throughputPktPerSec / aimd.get(0.02)!.throughputPktPerSec).toBeGreaterThan(5);
    expect(open.get(0.1)!.throughputPktPerSec / aimd.get(0.1)!.throughputPktPerSec).toBeGreaterThan(50);
  });

  // -- UBL-11: the same defect through the reordering door. --------------------------------
  //
  // Zero loss. Zero congestion. Only per-packet delivery jitter, which is how reordering arises
  // on a mesh link that retries per hop. The receiver NACKs every sequence gap, a reordered
  // packet IS a gap, and the estimator reads those NACKs as loss.
  //
  // This is 081KZYN3D53087G0R0036XZSYM composed with 081KZYN37T4087G0R00181THA4, measured on a
  // link with real delay rather than on a synthetic packet permutation - and it is the evidence
  // for reading the two as one defect: a non-congestion signal driving a congestion response.
  // PINS A DEFECT. Expected to FAIL when either is fixed.
  it("UBL-11: 5ms of jitter, zero loss, zero congestion - and the AIMD arm loses 11x throughput", () => {
    const mk = (arm: "open-loop" | "aimd", jitterMs: number) => {
      const link = defaultLink({
        capacityPktPerSec: 4000,
        owdMs: 20,
        bufferPackets: Math.max(1, Math.round(4 * bdpPackets({ capacityPktPerSec: 4000, owdMs: 20 }))),
        corruption: burstParams(0, 1),
        jitterMs,
      });
      return runLink(
        defaultSim({
          link,
          durationMs: 10000,
          pacing:
            arm === "open-loop" ? { kind: "open-loop", offeredPktPerSec: 1000 } : { kind: "aimd", initialGapMs: 1 },
        }),
      );
    };

    const cleanOpen = mk("open-loop", 0);
    const jitterOpen = mk("open-loop", 5);
    const cleanAimd = mk("aimd", 0);
    const jitterAimd = mk("aimd", 5);

    // Nothing was lost and nothing was congested, in every one of the four runs.
    for (const r of [cleanOpen, jitterOpen, cleanAimd, jitterAimd]) {
      expect(r.totalCorruptionDrops).toBe(0);
      expect(r.totalCongestionDrops).toBe(0);
    }

    // Jitter produced NACKs for packets that were never lost. Every one of them is spurious.
    expect(jitterOpen.flows[0]!.spuriousMissingSeqs).toBeGreaterThan(1000);
    expect(cleanOpen.flows[0]!.nacksEmitted).toBe(0);

    // Delivery itself is unharmed - the damage is entirely in the control channel.
    expect(jitterOpen.flows[0]!.delivered / cleanOpen.flows[0]!.delivered).toBeGreaterThan(0.99);

    // And once the control channel is wired to the sender, the collapse arrives.
    expect(jitterAimd.flows[0]!.delivered / cleanAimd.flows[0]!.delivered).toBeLessThan(0.15);
  });

  // -- UBL-12: recovery from a single spurious backoff. -------------------------------------
  //
  // The measured value also VALIDATES the simulator: the closed form for the additive-increase
  // walk is independent of the event loop, and they agree to better than 0.1%.
  //
  // PINS A DEFECT: one spurious multiplicative decrease costs 67 minutes of recovery on a
  // perfectly clean link. Expected to FAIL when the increase rule is revisited.
  it("UBL-12: recovering from one backoff to MAX_GAP takes 67 minutes, matching the closed form", () => {
    const r = recoveryReport(500);
    expect(r.msToGapMin).not.toBeNull();
    // Simulated against analytic - two independent derivations of the same quantity.
    expect(Math.abs(r.msToGapMin! - r.analyticMsToGapMin) / r.analyticMsToGapMin).toBeLessThan(0.001);
    expect(r.msToGapMin!).toBeGreaterThan(60 * 60 * 1000);
    expect(r.msToGapMin!).toBeLessThan(70 * 60 * 1000);
    // Halving the starting gap quarters the recovery, because the walk is quadratic in the gap:
    // the number of windows is linear in the gap and each window costs one gap.
    const half = recoveryReport(256);
    expect(r.analyticMsToGapMin / half.analyticMsToGapMin).toBeGreaterThan(3.5);
    expect(r.analyticMsToGapMin / half.analyticMsToGapMin).toBeLessThan(4.2);
  });

  // -- UBL-13: no ambient entropy. ----------------------------------------------------------
  it("UBL-13: the harness source contains no Math.random and no Date.now OUTSIDE comments", async () => {
    const raw = await Bun.file(new URL("./udp-bdp-link.ts", import.meta.url).pathname).text();
    // Both names appear in the module docstring, where they name what is ABSENT. Strip comments
    // first, or this test passes on prose and would fail on prose rather than on code.
    const code = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(code.length).toBeGreaterThan(5000);
    expect(code).not.toContain("Math.random");
    expect(code).not.toContain("Date.now");
  });

  // -- UBL-14: the wiring fact, asserted so it cannot silently change. ----------------------
  //
  // Everything above turns on `gapMs` not reaching the send path. If someone wires the
  // controller up, the whole reading of this file changes - so the fact is pinned here rather
  // than only stated in a comment.
  // Expected to FAIL when the controller is wired up, and that failure is the point.
  it("UBL-14: LossyUdpChannel.flushBlock does not read gapMs anywhere on the send path", async () => {
    const src = await Bun.file(new URL("./udp-lossy-transport.ts", import.meta.url).pathname).text();
    const flush = src.slice(src.indexOf("private flushBlock()"), src.indexOf("private async handleIncoming"));
    expect(flush.length).toBeGreaterThan(100);
    expect(flush).toContain("onSend(this.aimd)");
    expect(flush).not.toContain("gapMs");
    // gapMs appears only inside updateAimd, which is the function that writes it.
    const readers = src.split("\n").filter((l) => l.includes("gapMs") && !l.trimStart().startsWith("//"));
    expect(readers.length).toBeLessThanOrEqual(6);
  });
});
