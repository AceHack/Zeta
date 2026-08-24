#!/usr/bin/env bun
// report-shape-confusability.ts — REPORT-ONLY. Prints the pairwise confusability matrix over
// the vector shape catalog under the quotient family declared in `shape-occupancy-skeleton.ts`.
//
// WHY REPORT-ONLY, AND NOT A GATE. Turning this into a build gate would fail `main` today on
// live shapes and force a redesign of `crossing` or `lightcone`. Choosing a threshold and
// deciding which shape moves is an architect's call, not this file's. So this reports and exits
// 0 always; the number that would become the gate (`sup`) is printed for every pair, so the
// threshold can be argued from the distribution rather than picked first.
//
// Usage:  bun src/Core.TypeScript/hygiene/report-shape-confusability.ts [--all]

import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseSvg,
  raster,
  gridDims,
  comparePair,
  QUOTIENT_RADII,
  DIAGNOSTIC_RADII,
  GRID,
  type PairCurve,
} from "./shape-occupancy-skeleton.ts";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const goldenDir = join(repoRoot, "db", "shapes", "golden");
const showAll = process.argv.includes("--all");

const rastered: { name: string; grid: Float64Array; gw: number; gh: number }[] = [];
const unaudited: { name: string; why: string }[] = [];

for (const file of readdirSync(goldenDir)
  .filter((f) => f.endsWith(".svg"))
  .sort()) {
  const doc = parseSvg(readFileSync(join(goldenDir, file), "utf8"));
  const name = file.replace(/\.svg$/, "");
  if (doc.polys.length === 0) {
    unaudited.push({ name, why: `no <polyline>; uses ${doc.unparsed.join(", ") || "unknown elements"}` });
    continue;
  }
  if (doc.unparsed.length > 0)
    unaudited.push({
      name,
      why: `PARTIAL — ${doc.polys.length} polylines rastered, also has ${doc.unparsed.join(", ")}`,
    });
  const { gw, gh } = gridDims(doc, GRID);
  rastered.push({ name, grid: raster(doc, GRID), gw, gh });
}

// Pairs are only comparable when their grids agree; a differing viewBox aspect is reported.
const pairs: PairCurve[] = [];
const incomparable: string[] = [];
for (let i = 0; i < rastered.length; i++)
  for (let j = i + 1; j < rastered.length; j++) {
    const a = rastered[i]!,
      b = rastered[j]!;
    if (a.gw !== b.gw || a.gh !== b.gh) {
      incomparable.push(`${a.name} (${a.gw}x${a.gh}) vs ${b.name} (${b.gw}x${b.gh})`);
      continue;
    }
    pairs.push(comparePair(a.name, a.grid, b.name, b.grid, a.gw, a.gh));
  }

pairs.sort((p, q) => q.sup - p.sup);
const sups = pairs.map((p) => p.sup).sort((a, b) => a - b);
const quantile = (q: number) => sups[Math.floor(q * (sups.length - 1))]!;

const g0 = rastered[0];
console.log(
  `\nSHAPE CONFUSABILITY MATRIX — ${rastered.length} shapes, ${pairs.length} pairs, grid ${g0?.gw}x${g0?.gh} (square cells)`,
);
console.log(
  `guard family (blur radii): ${QUOTIENT_RADII.join(", ")}   diagnostic only: ${DIAGNOSTIC_RADII.join(", ")}`,
);
console.log(
  `sup distribution over guard family: min ${quantile(0).toFixed(3)}  median ${quantile(0.5).toFixed(3)}  p90 ${quantile(0.9).toFixed(3)}  max ${quantile(1).toFixed(3)}\n`,
);

const cols = [...QUOTIENT_RADII, ...DIAGNOSTIC_RADII];
const header = "   sup   slope  mirror |" + cols.map((r) => `r=${r}`.padStart(7)).join("") + "   pair";
console.log(header);
console.log("   " + "-".repeat(header.length - 3));
for (const p of showAll ? pairs : pairs.slice(0, 12)) {
  const cls =
    p.sup > quantile(0.9) && p.slope > 0.4 ? "  << GLANCE-ONLY" : p.sup > quantile(0.9) ? "  << BOTH-READERS" : "";
  console.log(
    `  ${p.sup.toFixed(3)} ${p.slope >= 0 ? "+" : ""}${p.slope.toFixed(3)}  ${p.mirrorSup.toFixed(3)} |` +
      p.curve
        .map(
          (c, i) =>
            (i === QUOTIENT_RADII.length ? "|" : "") + c.toFixed(3).padStart(i === QUOTIENT_RADII.length ? 6 : 7),
        )
        .join("") +
      `   ${p.a} ~ ${p.b}${cls}`,
  );
}

console.log(`\nUNAUDITED (${unaudited.length}) — reported, never silently skipped:`);
for (const u of unaudited) console.log(`  ${u.name}: ${u.why}`);
if (incomparable.length) {
  console.log(`\nINCOMPARABLE (differing viewBox aspect, ${incomparable.length}):`);
  for (const s of incomparable.slice(0, 10)) console.log(`  ${s}`);
}
console.log(
  "\nREGISTER: the correlations are exact arithmetic; the mapping from a correlation to human\n" +
    "confusion is an UNMETERED model. No forced-choice trial has been run. Limits are in the\n" +
    "header of shape-occupancy-skeleton.ts; the design rule is in docs/design/2026-08-24-*.md\n",
);
