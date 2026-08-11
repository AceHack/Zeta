#!/usr/bin/env bun
// drift-evolution.ts — generational selection over drift genomes, IN SHADOW
// (the last organ of the evolutionary expansion; society-evolution.ts is the
// template: population → fitness from the ledger → selection → publish).
//
// Nothing here touches live config. Each tick: spawn N mutants of the
// current phenotype with the society's own mutate(); score every candidate
// by REPLAYING the existing drift ledger under its budgets; rank; publish
// data/drift-evolution.json. A candidate that wants to become config goes
// through the registry consent path — evolution proposes, the society
// disposes.
//
// The shadow objective (pure over the event history, DST-deterministic):
//   leak cost  — for every tick a class's oldest open finding lives BEYOND
//                the candidate's budget, cost += (age − budget). Loose
//                budgets bleed here.
//   alarm cost — each time a class's age FIRST crosses the candidate's
//                budget, one filing: cost += ALARM_WEIGHT. Tight budgets
//                cry wolf here.
// Total cost minimized ⇒ shadowFitness = −cost. The ridge between the two
// is what selection climbs. (Shadow v1 uses the candidate's static budgets
// — defaultBudgetTicks + explicit BD001 — not the adaptive rule, which is
// itself history-dependent; noted as the v2 refinement.)

import { writeFileSync } from "node:fs";

import { mutate, toHex } from "../planning/agent-genome.ts";
import {
  CURRENT_PHENOTYPE,
  decodeDriftGenome,
  encodeDriftGenome,
  type DriftPhenotype,
} from "./drift-genome.ts";
import { readLedger, type SweepEvent } from "./drift-ledger.ts";

export const ALARM_WEIGHT = 3; // one filing costs three tick-units of leak

function budgetFor(rule: string, p: DriftPhenotype): number {
  return rule === "BD001" ? p.bd001BudgetTicks : p.defaultBudgetTicks;
}

/** Replay the ledger under a candidate's budgets. Pure over (events, p). */
export function shadowCost(events: readonly SweepEvent[], p: DriftPhenotype): number {
  const sweeps = [...events].sort((a, b) => a.tick - b.tick);
  const birth = new Map<string, { tick: number; rule: string; alarmed: boolean }>();
  let cost = 0;
  for (const sweep of sweeps) {
    const present = new Set(sweep.findings.map((f) => JSON.stringify([f.path, f.rule])));
    for (const [key] of [...birth]) {
      if (!present.has(key)) birth.delete(key); // healed
    }
    for (const f of sweep.findings) {
      const key = JSON.stringify([f.path, f.rule]);
      if (!birth.has(key)) birth.set(key, { tick: sweep.tick, rule: f.rule, alarmed: false });
    }
    for (const b of birth.values()) {
      const age = sweep.tick - b.tick;
      const budget = budgetFor(b.rule, p);
      if (age > budget) {
        cost += age - budget; // leak: living beyond tolerance, per tick
        if (!b.alarmed) {
          b.alarmed = true;
          cost += ALARM_WEIGHT; // the filing
        }
      }
    }
  }
  return cost;
}

export interface Candidate {
  readonly genomeHex: string;
  readonly phenotype: DriftPhenotype;
  readonly shadowFitness: number; // −cost; higher is better
  readonly parent: string;
}

/** One generation: current + N seeded mutants, ranked by shadow fitness.
 * Deterministic under the injected rng (DST). */
export function generation(
  events: readonly SweepEvent[],
  populationSize: number,
  rng: () => number,
): readonly Candidate[] {
  const base = encodeDriftGenome(CURRENT_PHENOTYPE);
  const pool = [{ genome: base, parent: "current" }];
  for (let i = 0; i < populationSize; i += 1) {
    pool.push({ genome: mutate(base, "drift-gen0", 0.15, rng), parent: "drift-gen0" });
  }
  const scored: Candidate[] = pool.map(({ genome, parent }) => {
    const phenotype = decodeDriftGenome(genome);
    return {
      genomeHex: toHex(genome),
      phenotype,
      shadowFitness: -shadowCost(events, phenotype),
      parent,
    };
  });
  return [...scored].sort(
    (a, b) => b.shadowFitness - a.shadowFitness || (a.genomeHex < b.genomeHex ? -1 : 1),
  );
}

/** Seeded LCG — the only entropy source, injected (noninterference §13). */
export function lcg(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

const invokedDirectly = typeof process.argv[1] === "string" && /drift-evolution\.(?:ts|js)$/.test(process.argv[1]);
if (invokedDirectly) {
  const events = readLedger("docs/drift-events");
  const latestTick = events.reduce((m, e) => Math.max(m, e.tick), 0);
  // Seed = latest tick: each tick explores a fresh, reproducible population.
  const ranked = generation(events, 16, lcg(latestTick + 1));
  const top = ranked.slice(0, 5);
  const currentRank = ranked.findIndex((c) => c.parent === "current") + 1;
  writeFileSync(
    "data/drift-evolution.json",
    `${JSON.stringify({ tick: latestTick, populationSize: ranked.length, currentRank, top }, null, 2)}\n`,
  );
  console.log(
    `drift-evolution: tick ${String(latestTick)} — current genome ranks ${String(currentRank)}/${String(ranked.length)} in shadow`,
  );
  for (const c of top.slice(0, 3)) {
    console.log(
      `  ${c.genomeHex} (${c.parent}) fitness ${String(c.shadowFitness)} budgets d=${String(c.phenotype.defaultBudgetTicks)} bd=${String(c.phenotype.bd001BudgetTicks)}`,
    );
  }
  process.exit(0);
}
