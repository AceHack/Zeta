#!/usr/bin/env bun
/**
 * run-decorr-h3-crossval.ts — Otto's fix: is the H3 +3.2pp in-sample optimism?
 *
 * H3 reported a confidence-gated selector at +3.2pp over best-single, but the selection
 * rule (pick the more confident config; implicitly threshold at gap=0) and the direction
 * were chosen on the same data they were scored on. A fitted-threshold selector essentially
 * always beats best-single in-sample because the threshold absorbs the noise it saw.
 *
 * This runs 5-fold cross-validation over the EXISTING raw log (no new model calls): fit the
 * threshold on train folds, score the held-out fold. Reports the OUT-OF-SAMPLE lift and the
 * optimism (in-sample − OOS) the split removed, with a McNemar CI of OOS-selector vs
 * best-single. If ~3pp survives, the result is real; if it shrinks, that is the honest
 * number.
 *
 * Usage: bun scripts/run-decorr-h3-crossval.ts
 */
import { appendFileSync } from "node:fs";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { kFoldThresholdSelector, mcNemar, wilsonInterval, type ThresholdItem } from "../src/Core.TypeScript/observe/decorrelation-stats";

const repoRoot = process.cwd();
const rawPath = join(repoRoot, "data", "decorr-h3-signal-raw.jsonl");

interface Row { i: number; correctIndex: number; aIdx: number | null; aConf: number; bIdx: number | null; bConf: number; }

function main() {
  const rows: Row[] = readFileSync(rawPath, "utf8").trim().split("\n").map((l) => JSON.parse(l));
  const aRight = (r: Row) => r.aIdx === r.correctIndex;
  const bRight = (r: Row) => r.bIdx === r.correctIndex;

  // Signal = confidence gap (bConf - aConf); pick B iff gap > τ.
  const items: ThresholdItem[] = rows.map((r) => ({
    signal: r.bConf - r.aConf, bCorrect: bRight(r), aCorrect: aRight(r),
  }));

  const k = 5;
  const cv = kFoldThresholdSelector(items, k);

  // The in-sample zero-threshold rule (what H3 originally reported): pick more confident.
  const zeroThreshCorrect = rows.map((r) => {
    const pickB = (r.bConf - r.aConf) > 0;
    return (pickB ? bRight(r) : aRight(r));
  });
  const zeroThreshAcc = zeroThreshCorrect.filter(Boolean).length / rows.length;

  const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
  console.log("H3 cross-validation — is the +3.2pp in-sample optimism? (Otto's guard)");
  console.log("═".repeat(70));
  console.log(`N=${rows.length}  best-single=${pct(cv.bestSingle)}`);
  console.log(`\nIn-sample:`);
  console.log(`  zero-threshold rule (H3 as reported) = ${pct(zeroThreshAcc)}  lift=${((zeroThreshAcc-cv.bestSingle)*100).toFixed(1)}pp`);
  console.log(`  fitted-threshold, in-sample          = ${pct(cv.inSampleAccuracy)}  lift=${((cv.inSampleAccuracy-cv.bestSingle)*100).toFixed(1)}pp`);
  console.log(`\nOut-of-sample (${k}-fold, threshold fit on train, scored on held-out):`);
  console.log(`  OOS accuracy = ${pct(cv.oosAccuracy)}  OOS lift = ${(cv.oosLift*100).toFixed(1)}pp`);
  console.log(`  optimism removed by the split (in-sample − OOS) = ${(cv.optimism*100).toFixed(1)}pp`);

  // McNemar: OOS selector vs best-single (the stronger config, per-item).
  const bestIsA = rows.filter(aRight).length >= rows.filter(bRight).length;
  const mc = mcNemar(rows.map((r, i) => ({
    aCorrect: cv.oosCorrect[i]!,                 // OOS selector
    bCorrect: bestIsA ? aRight(r) : bRight(r),   // best-single baseline
  })));
  const oosCI = wilsonInterval(cv.oosCorrect.filter(Boolean).length, rows.length);
  console.log(`\n  OOS selector accuracy 95% CI = [${pct(oosCI.lo)}, ${pct(oosCI.hi)}]`);
  console.log(`  McNemar (OOS selector vs best-single): diff=${(mc.accuracyDiff*100).toFixed(1)}pp CI [${(mc.diffLo*100).toFixed(1)}, ${(mc.diffHi*100).toFixed(1)}] resolved=${mc.resolved}`);

  const survives = mc.resolved && mc.accuracyDiff > 0;
  const verdict = survives
    ? `SURVIVES: OOS lift ${(cv.oosLift*100).toFixed(1)}pp, McNemar CI excludes zero — the result is real out-of-sample.`
    : `DOES NOT SURVIVE: OOS lift not resolvable — the in-sample +3.2pp was optimism.`;
  console.log(`\nVERDICT: ${verdict}`);

  appendFileSync(join(repoRoot, "data", "decorrelation-research.jsonl"), JSON.stringify({
    schema: "decorr/v2-h3-crossval",
    axis: { axis: "prompt-frame:clause-swap:confidence-gate:cross-validated", description: "5-fold CV of the confidence-threshold selector; OOS lift vs in-sample", kind: "candidate" },
    register: "unmetered", n: rows.length, k,
    bestSingle: cv.bestSingle, zeroThreshInSample: zeroThreshAcc,
    fittedInSample: cv.inSampleAccuracy, oosAccuracy: cv.oosAccuracy, oosLift: cv.oosLift, optimism: cv.optimism,
    oosCI, mcNemarVsBest: { accuracyDiff: mc.accuracyDiff, diffLo: mc.diffLo, diffHi: mc.diffHi, resolved: mc.resolved },
    verdict, rawLog: "data/decorr-h3-signal-raw.jsonl", measuredAt: new Date().toISOString(),
  }) + "\n");
  console.log("\nRecorded H3 cross-validation to the ledger.");
}

main();
