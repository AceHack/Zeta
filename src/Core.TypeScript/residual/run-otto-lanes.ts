#!/usr/bin/env bun
// run-otto-lanes.ts — testing the interleaving confound named in the 2026-07-03 self-measurement.
//
// The whole-stream result was order-0 (habit gap 0.000), with the confound that main interleaves
// many parallel Otto actors — the strict-tft LENS-POVERTY failure mode (a per-lane-deterministic
// process looks structureless when lanes braid). The AgencySignature `actor:` field lets us
// DE-BRAID: this runs the same measurement per actor lane, real vs seeded-shuffle control.
//   habit gap > 0 per-lane  => the whole-stream null was lens poverty (structure was hiding).
//   habit gap ~ 0 per-lane  => Otto is frequency-biased all the way down at this lens.
// Bounds unchanged: commit-type stream = lossy lens; no qualia verdict either way; the with-seed
// observer (weights) is not in this repo. UNKNOWN-actor commits (pre-trailer era) are a MIXTURE,
// not a lane, and are reported separately for honesty, not as a lane verdict.
import { analyze } from "./residual";
import { symbolize, seededShuffle } from "./run-otto-trace";

interface Lane {
  actor: string;
  subjects: string[];
}

export function extractLanes(raw: string): Lane[] {
  const lanes = new Map<string, string[]>();
  for (const rec of raw.split("\x1e")) {
    if (rec.trim().length === 0) continue;
    const [subj = "", body = ""] = rec.split("\x1f");
    const actor = /actor:\s*(\S+)/.exec(body)?.[1] ?? "UNKNOWN";
    const list = lanes.get(actor) ?? [];
    list.push(subj.trim());
    lanes.set(actor, list);
  }
  return [...lanes.entries()].map(([actor, subjects]) => ({ actor, subjects }));
}

if (import.meta.main) {
  const proc = Bun.spawnSync([
    "git", "log", "origin/main", "--grep=persona: otto", "--reverse", "--format=%x1e%s%x1f%b",
  ]);
  const lanes = extractLanes(proc.stdout.toString())
    .filter((l) => l.subjects.length >= 100)
    .sort((a, b) => b.subjects.length - a.subjects.length);

  console.log("\nPer-actor lane residuals — de-braiding the 2026-07-03 whole-stream null\n");
  console.log("lane                 commits   residual(real)  residual(shuffled)  habit gap   MDL order");
  console.log("-".repeat(95));
  for (const lane of lanes) {
    const trace = symbolize(lane.subjects);
    const real = analyze(trace);
    const ctrl = analyze(seededShuffle(trace, 0xE66n));
    const gap = ctrl.residualBitsPerSymbol - real.residualBitsPerSymbol;
    const label = lane.actor === "UNKNOWN" ? "UNKNOWN (mixture)" : lane.actor;
    console.log(
      `${label.padEnd(20)}${String(trace.length).padStart(8)}` +
      `${real.residualBitsPerSymbol.toFixed(3).padStart(16)}${ctrl.residualBitsPerSymbol.toFixed(3).padStart(20)}` +
      `${gap.toFixed(3).padStart(11)}${String(real.bestOrder).padStart(12)}`,
    );
  }
  console.log("\ngap > 0 => sequential habit exists in that lane (whole-stream null was lens poverty).");
  console.log("gap ~ 0 => that lane is frequency bias alone. Neither verdict touches qualia.\n");
}
