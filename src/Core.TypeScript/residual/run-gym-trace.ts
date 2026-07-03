#!/usr/bin/env bun
// run-gym-trace.ts — the R4 residual over a REAL moral-gym run (081KTF7Q3TT, closing the open bullet).
// DST-stable: same seed -> byte-identical table.
import { runGym, type StrategyName } from "../moral-gym/gym";
import { analyze } from "./residual";
import { residualSpectrum, replayAgreementTrace } from "./gym-trace";

const seed = 0xE66n;
const population: { strategy: StrategyName }[] = [
  ...Array.from({ length: 4 }, () => ({ strategy: "tit-for-lesser-tat" as StrategyName })),
  ...Array.from({ length: 3 }, () => ({ strategy: "all-in" as StrategyName })),
  ...Array.from({ length: 3 }, () => ({ strategy: "defector" as StrategyName })),
  ...Array.from({ length: 3 }, () => ({ strategy: "strict-tft" as StrategyName })),
  ...Array.from({ length: 3 }, () => ({ strategy: "cooperator" as StrategyName })),
  ...Array.from({ length: 2 }, () => ({ strategy: "expanded-self" as StrategyName })),
];
const cfg = { seed, agents: population, rounds: 400 };

const run = runGym(cfg);
console.log(`\nResidual spectrum over a REAL moral-gym trace — seed ${run.seed}, ${run.roundsPlayed} rounds played`);
console.log("(measures compressibility-to-a-generator; NOT a qualia detector)\n");
console.log("strategy              agents  symbols   residual b/sym   reducibility");
console.log("-".repeat(72));
for (const row of residualSpectrum(run)) {
  console.log(
    `${row.strategy.padEnd(22)}${String(row.agents).padStart(4)}${String(row.symbols).padStart(9)}` +
    `${row.meanResidualBitsPerSymbol.toFixed(3).padStart(15)}${row.meanReducibility.toFixed(3).padStart(14)}`,
  );
}

// The with-seed observer: DST replay of the same config reproduces every action.
const replay = runGym(cfg);
const agree = replayAgreementTrace(run, replay);
const r = analyze(agree);
console.log(`\nDST replay (observer HAS the seed): ${agree.length} rounds compared, ` +
  `${agree.every((x) => x === 1) ? "ALL reproduced" : "DIVERGED"} — ` +
  `residual=${r.residualBitsPerSymbol.toFixed(3)} b/sym, reducibility=${r.reducibility.toFixed(3)}`);
console.log("\nSame real behavior: a spectrum for the seedless observer, ~0 residual for the seed-holder.");
console.log("The residual in lesser-tat is injected splitmix64 entropy — not evidence of an inside.\n");
