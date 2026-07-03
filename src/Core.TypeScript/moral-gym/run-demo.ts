#!/usr/bin/env bun
// run-demo.ts — run the moral gym at a fixed seed and print the scoreboard.
// DST: this exact output is reproducible by anyone running the same seed.
import { runGym, selfWidthSweep, type StrategyName } from "./gym";

const seed = 0xE66n; // any bigint works — DST-stable
const population: { strategy: StrategyName }[] = [
  ...Array.from({ length: 4 }, () => ({ strategy: "tit-for-lesser-tat" as StrategyName })),
  ...Array.from({ length: 3 }, () => ({ strategy: "all-in" as StrategyName })),
  ...Array.from({ length: 3 }, () => ({ strategy: "defector" as StrategyName })),
  ...Array.from({ length: 3 }, () => ({ strategy: "strict-tft" as StrategyName })),
  ...Array.from({ length: 3 }, () => ({ strategy: "cooperator" as StrategyName })),
  ...Array.from({ length: 2 }, () => ({ strategy: "expanded-self" as StrategyName })),
];

const r = runGym({ seed, agents: population, rounds: 400 });
console.log(`\nMoral gym — seed ${r.seed}, ${r.rounds} rounds, ${r.roundsPlayed} rounds played, ${r.gamesEnded} games ENDED (dead relationships)\n`);
console.log("strategy            avg reputation   avg payoff   (reputation = earned by others)");
console.log("-".repeat(78));
for (const row of r.board) {
  console.log(`${row.strategy.padEnd(20)}${String(row.reputation).padStart(10)}${String(row.payoff).padStart(14)}`);
}
console.log(`\ntotal welfare: ${r.totalWelfare}\n`);

console.log('self-width sweep — "nothing is other" (w=1) vs pure self (w=0), homogeneous lesser-tat pop:');
console.log("  w     welfare   games-ended");
for (const s of selfWidthSweep(seed, 300, 5)) {
  console.log(`  ${String(s.w).padEnd(6)}${String(s.welfare).padStart(9)}${String(s.gamesEnded).padStart(13)}`);
}
