/**
 * udp-bdp-link.demo.ts - renders every table in `udp-bdp-link.ts` as text.
 *
 * Run: `bun src/Core.TypeScript/discovery/udp-bdp-link.demo.ts`
 *
 * This is the measurement instrument, not a test. The tests pin a handful of these numbers;
 * this prints all of them so a reader can see the shape rather than the assertions. Text only -
 * no binary in the proof lineage.
 */

import {
  attributionPoint,
  bdpPackets,
  bufferbloatSweep,
  convergenceReport,
  corruptionVsCongestion,
  defaultLink,
  defaultSim,
  fairnessReport,
  formatAttribution,
  formatBufferbloat,
  formatCorruptionPlot,
  formatUtilisationTable,
  gridConfig,
  recoveryReport,
  utilisationTable,
  type GridPoint,
} from "./udp-bdp-link";
import { burstParams } from "./udp-lossy-transport.chaos";

const GRID: GridPoint[] = [];
for (const capacityPktPerSec of [200, 1000, 5000]) {
  for (const owdMs of [1, 20, 100]) {
    for (const bufferBdpMultiple of [0.25, 1, 4]) {
      GRID.push({ capacityPktPerSec, owdMs, bufferBdpMultiple });
    }
  }
}

async function main(): Promise<void> {
  console.log("=== UBL-A: utilisation over (C, D, B), clean channel, 10s, greedy source ===");
  const util = await utilisationTable(GRID, ["open-loop", "aimd"], { durationMs: 10000 }, 1);
  console.log(formatUtilisationTable(util));

  console.log("");
  console.log("=== UBL-B: convergence of the gap, C=1000 D=20 B=BDP ===");
  for (const arm of ["open-loop", "aimd"] as const) {
    const cfg = gridConfig(arm, { capacityPktPerSec: 1000, owdMs: 20, bufferBdpMultiple: 1 }, { durationMs: 20000 });
    const r = convergenceReport(cfg);
    console.log(
      [
        "  arm=" + r.arm.padEnd(10),
        "verdict=" + r.verdict.padEnd(12),
        "final=" + r.finalGapMs.toFixed(0).padStart(4) + "ms",
        "min=" + r.minGapMs.toFixed(0).padStart(4),
        "max=" + r.maxGapMs.toFixed(0).padStart(4),
        "distinct=" + String(r.distinctGapValues).padStart(3),
        "atMax=" + r.fractionAtMaxGap.toFixed(3),
        "atMin=" + r.fractionAtMinGap.toFixed(3),
        "flips/sample=" + r.directionChangesPerSample.toFixed(3),
        "tailCV=" + r.tailCoefficientOfVariation.toFixed(3),
        "util=" + r.deliveredUtilisation.toFixed(3),
        "NACKs=" + String(r.nacksEmitted),
      ].join("  "),
    );
    console.log("    first 40 gap samples: " + r.gapTrajectory.slice(0, 40).join(","));
  }

  console.log("");
  console.log("=== UBL-C: fairness, two flows on one link, C=1000 D=20 B=BDP, flow 2 joins at 5s ===");
  for (const arm of ["open-loop", "aimd"] as const) {
    const base = gridConfig(arm, { capacityPktPerSec: 1000, owdMs: 20, bufferBdpMultiple: 1 }, { durationMs: 20000 });
    const cfg = { ...base, flowCount: 2, flowStartMs: [0, 5000] };
    const r = fairnessReport(cfg);
    console.log(
      [
        "  arm=" + arm.padEnd(10),
        "x1=" + r.throughputs[0]!.toFixed(1).padStart(7),
        "x2=" + r.throughputs[1]!.toFixed(1).padStart(7),
        "equalShare=" + r.equalShareEach.toFixed(0),
        "jain=" + r.jainIndex.toFixed(4),
        "util=" + r.totalDeliveredUtilisation.toFixed(3),
        "congDrop=" + String(r.congestionDrops),
      ].join("  "),
    );
    const tail = r.phaseTrajectory.slice(-10).map((p) => "(" + p[0].toFixed(0) + "," + p[1].toFixed(0) + ")");
    console.log("    last 10 phase points (x1,x2): " + tail.join(" "));
  }

  console.log("");
  console.log("=== UBL-D: standing queue / bufferbloat, C=1000 D=20 ===");
  const bb = await bufferbloatSweep(
    ["open-loop", "aimd"],
    [0.25, 1, 4, 16, 64],
    { capacityPktPerSec: 1000, owdMs: 20 },
    { durationMs: 10000 },
    1,
  );
  console.log(formatBufferbloat(bb));

  console.log("");
  console.log("=== UBL-E: THE DECISIVE ONE - congestion held at zero, corruption raised ===");
  const rates = [0, 0.005, 0.01, 0.02, 0.05, 0.1];
  for (const burst of [1, 4]) {
    const cvc = await corruptionVsCongestion(["open-loop", "aimd"], rates, burst, { durationMs: 10000 }, 1);
    console.log("  mean burst length = " + String(burst));
    console.log(formatCorruptionPlot(cvc));
  }

  console.log("");
  console.log("=== UBL-F: reordering from jitter alone, lossless and uncongested ===");
  console.log("  arm          jitter(ms)   NACKs   spuriousSeqs   thru(pkt/s)   gapMs");
  for (const arm of ["open-loop", "aimd"] as const) {
    for (const jitterMs of [0, 5, 20, 50]) {
      const link = defaultLink({
        capacityPktPerSec: 4000,
        owdMs: 20,
        bufferPackets: Math.max(1, Math.round(4 * bdpPackets({ capacityPktPerSec: 4000, owdMs: 20 }))),
        corruption: burstParams(0, 1),
        jitterMs,
      });
      const cfg = defaultSim({
        link,
        durationMs: 10000,
        pacing:
          arm === "open-loop" ? { kind: "open-loop", offeredPktPerSec: 1000 } : { kind: "aimd", initialGapMs: 10 },
      });
      const r = convergenceReport(cfg);
      console.log(
        [
          "  " + arm.padEnd(12),
          String(jitterMs).padStart(8),
          String(r.nacksEmitted).padStart(9),
          String(r.spuriousMissingSeqs).padStart(14),
          (r.deliveredUtilisation * 4000).toFixed(1).padStart(13),
          r.finalGapMs.toFixed(0).padStart(8),
        ].join(""),
      );
    }
  }

  console.log("");
  console.log("=== UBL-G: recovery from ONE spurious multiplicative decrease, clean link ===");
  for (const start of [500, 256, 64]) {
    const r = recoveryReport(start);
    console.log(
      [
        "  startGap=" + String(r.startGapMs).padStart(4) + "ms",
        "toGap10=" + (r.msToGap10 === null ? "never" : (r.msToGap10 / 1000).toFixed(1) + "s"),
        "toGapMin=" + (r.msToGapMin === null ? "never" : (r.msToGapMin / 1000).toFixed(1) + "s"),
        "analytic=" + (r.analyticMsToGapMin / 1000).toFixed(1) + "s",
        "packets=" + String(r.packetsSent),
        "finalGap=" + String(r.finalGapMs),
      ].join("  "),
    );
  }

  console.log("");
  console.log("=== UBL-H: fairness again, WITH jitter (Floyd-Jacobson phase-effect control) ===");
  for (const arm of ["open-loop", "aimd"] as const) {
    const base = gridConfig(arm, { capacityPktPerSec: 1000, owdMs: 20, bufferBdpMultiple: 1 }, { durationMs: 20000 });
    const cfg = {
      ...base,
      link: { ...base.link, jitterMs: 5 },
      sendPhaseJitterMs: 2,
      flowCount: 2,
      flowStartMs: [0, 5000],
    };
    const r = fairnessReport(cfg);
    console.log(
      [
        "  arm=" + arm.padEnd(10),
        "x1=" + r.throughputs[0]!.toFixed(1).padStart(7),
        "x2=" + r.throughputs[1]!.toFixed(1).padStart(7),
        "jain=" + r.jainIndex.toFixed(4),
        "util=" + r.totalDeliveredUtilisation.toFixed(3),
        "congDrop=" + String(r.congestionDrops),
      ].join("  "),
    );
  }

  console.log("");
  console.log("=== UBL-I: ATTRIBUTION - how much of the loss can the receiver actually NAME? ===");
  console.log("  (read this table BEFORE UBL-E: separating the signals only pays where the");
  console.log("   receiver can separate them, and this is the measurement of that.)");
  const corrupt = (arm: "open-loop" | "aimd", rate: number) =>
    defaultSim({
      link: defaultLink({
        capacityPktPerSec: 4000,
        owdMs: 20,
        bufferPackets: Math.max(1, Math.round(4 * bdpPackets({ capacityPktPerSec: 4000, owdMs: 20 }))),
        corruption: burstParams(rate, 1),
      }),
      pacing: arm === "open-loop" ? { kind: "open-loop", offeredPktPerSec: 1000 } : { kind: "aimd", initialGapMs: 1 },
      durationMs: 10000,
    });
  const jittered = (arm: "open-loop" | "aimd", jitterMs: number) =>
    defaultSim({
      link: defaultLink({
        capacityPktPerSec: 4000,
        owdMs: 20,
        bufferPackets: Math.max(1, Math.round(4 * bdpPackets({ capacityPktPerSec: 4000, owdMs: 20 }))),
        corruption: burstParams(0, 1),
        jitterMs,
      }),
      pacing: arm === "open-loop" ? { kind: "open-loop", offeredPktPerSec: 1000 } : { kind: "aimd", initialGapMs: 1 },
      durationMs: 10000,
    });
  console.log(
    formatAttribution([
      attributionPoint("corruption 2%", corrupt("aimd", 0.02)),
      attributionPoint("corruption 10%", corrupt("aimd", 0.1)),
      attributionPoint("corruption 10%", corrupt("open-loop", 0.1)),
      attributionPoint("jitter 5ms", jittered("aimd", 5)),
      attributionPoint("jitter 5ms", jittered("open-loop", 5)),
      attributionPoint(
        "congestion 2x",
        gridConfig("open-loop", { capacityPktPerSec: 1000, owdMs: 20, bufferBdpMultiple: 1 }, { durationMs: 10000 }),
      ),
    ]),
  );
}

await main();
