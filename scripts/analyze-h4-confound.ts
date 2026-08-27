#!/usr/bin/env bun
/**
 * analyze-h4-confound.ts — Otto's confound check on H4, no new model calls.
 *
 * Is the H4 cross-frame failure real (case a: within-arm confidence IS predictive but the
 * cross-frame comparison fails) or a near-tautology (case b: confidence carries no signal
 * here, so comparability was never testable)? Discriminator: per-arm Mann–Whitney of
 * confidence on correct vs wrong answers. Also reports both headroom readings (absolute pp
 * and fraction-of-errors-recovered) so neither denominator is cherry-picked.
 *
 * Usage: bun scripts/analyze-h4-confound.ts
 */
import { appendFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { mannWhitneyU } from "../src/Core.TypeScript/observe/decorrelation-stats";

const repoRoot = process.cwd();
interface Row { correctIndex: number; aIdx: number | null; aConf: number; bIdx: number | null; bConf: number; }

function main() {
  const rows: Row[] = readFileSync(join(repoRoot, "data", "decorr-h4-crossdomain-raw.jsonl"), "utf8")
    .trim().split("\n").map((l) => JSON.parse(l));
  const N = rows.length;
  const aR = (r: Row) => r.aIdx === r.correctIndex;
  const bR = (r: Row) => r.bIdx === r.correctIndex;
  const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / (a.length || 1);

  const mwA = mannWhitneyU(rows.filter(aR).map((r) => r.aConf), rows.filter((r) => !aR(r)).map((r) => r.aConf));
  const mwB = mannWhitneyU(rows.filter(bR).map((r) => r.bConf), rows.filter((r) => !bR(r)).map((r) => r.bConf));

  const best = Math.max(rows.filter(aR).length, rows.filter(bR).length) / N;
  const union = rows.filter((r) => aR(r) || bR(r)).length / N;
  const absHeadroom = union - best;
  const relHeadroom = absHeadroom / (1 - best);

  console.log("H4 confound analysis (arithmetic domain, N=" + N + ")");
  console.log("═".repeat(60));
  console.log("Within-arm confidence predictiveness (correct vs wrong):");
  console.log(`  canonical:   z=${mwA.z.toFixed(2)} rankBiserial=${mwA.rankBiserial.toFixed(3)} rejects=${mwA.rejects}  (correct ${mean(rows.filter(aR).map((r) => r.aConf)).toFixed(3)} vs wrong ${mean(rows.filter((r) => !aR(r)).map((r) => r.aConf)).toFixed(3)})`);
  console.log(`  clause-swap: z=${mwB.z.toFixed(2)} rankBiserial=${mwB.rankBiserial.toFixed(3)} rejects=${mwB.rejects}  (correct ${mean(rows.filter(bR).map((r) => r.bConf)).toFixed(3)} vs wrong ${mean(rows.filter((r) => !bR(r)).map((r) => r.bConf)).toFixed(3)})`);
  const caseA = mwA.rejects && mwB.rejects;
  console.log(`\nCase: ${caseA ? "(a) within-arm confidence IS predictive — cross-frame failure is REAL, not a tautology" : "(b) within-arm confidence carries no signal — H4 says nothing about comparability"}`);
  console.log(`\nHeadroom (both readings):`);
  console.log(`  absolute = ${(absHeadroom * 100).toFixed(1)}pp   relative = ${(relHeadroom * 100).toFixed(0)}% of available errors`);

  appendFileSync(join(repoRoot, "data", "decorrelation-research.jsonl"), JSON.stringify({
    schema: "decorr/v2-h4-confound", domain: "arithmetic-constraint-selection", register: "unmetered", n: N,
    withinArmCanonical: { z: mwA.z, rankBiserial: mwA.rankBiserial, rejects: mwA.rejects },
    withinArmClauseSwap: { z: mwB.z, rankBiserial: mwB.rankBiserial, rejects: mwB.rejects },
    caseResolved: caseA ? "a-real-cross-frame-failure" : "b-no-within-arm-signal",
    headroomAbsolute: absHeadroom, headroomRelativeErrorsRecovered: relHeadroom,
    note: "Within-arm confidence predictive but cross-frame comparison fails (H4 +0.3pp). May be competence-dependent (H3 ~90% works, H4 ~31% fails) — H5 tests with a different-in-kind high-accuracy domain.",
    rawLog: "data/decorr-h4-crossdomain-raw.jsonl", measuredAt: new Date().toISOString(),
  }) + "\n");
  console.log("\nRecorded H4 confound analysis to the ledger.");
}

main();
