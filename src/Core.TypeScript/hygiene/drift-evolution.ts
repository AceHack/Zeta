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
//   rent cost  — every tick a finding is open, the candidate pays
//                TOLERANCE_RENT x its budget for that class: standing
//                tolerance is accepted risk, paid for whether used or not.
//                Loose budgets bleed here, strictly.
//   leak cost  — every tick the finding lives BEYOND budget costs
//                (age − budget): a budget the fleet can't meet.
//   alarm cost — the first budget crossing files once: ALARM_WEIGHT.
//                Tight budgets cry wolf here.
// Total cost minimized ⇒ shadowFitness = −cost, with a STRICT interior
// optimum just above the class's demonstrated heal age: alarm stragglers
// promptly, and don't hold tolerance you don't need.
//
// OBJECTIVE V3 (2026-08-12): v2's two terms BOTH fell as budgets loosened —
// "budget = ∞" was weakly optimal on every history, so shadow selection
// could only ever counsel loosening (found by the proposer's law tests
// before any bad proposal shipped; every bug has economic value). Rent on
// extended tolerance is the counter-pressure that makes the ridge real;
// 1/8 is exact in binary, keeping every cost an exact float (DST byte-lock).
//
// SHADOW V2 (2026-08-11): the replay computes each tick's budget via the
// LIVE adaptive rule — a running fold of heal durations gives the class's
// MTTH *as measured up to that tick*, and budget = max(floorTicks,
// ceil(multiplier × runningMtth)) once healedCount ≥ minHeals (explicit
// BD001 still wins; evidence-poor classes ride defaultBudgetTicks). Same
// semantics as drift-ledger's sloLimit, folded incrementally. This wakes
// the r/g/b channels (multiplier, min_heals, floor): under v1's static
// budgets those three mutated invisibly — selection could not feel them.
// Now every one of the seven genome channels faces the objective.

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
export const TOLERANCE_RENT = 0.125; // per open-finding tick: rent on the budget extended (1/8, exact in binary)

interface HealStats {
  count: number;
  totalTicks: number;
}

/** The LIVE adaptive rule (drift-ledger sloLimit semantics) over the
 * running heal statistics at this point of the replay. */
export function budgetAt(rule: string, p: DriftPhenotype, healed: ReadonlyMap<string, HealStats>): number {
  if (rule === "BD001") return p.bd001BudgetTicks; // explicit always wins
  const h = healed.get(rule);
  if (h !== undefined && h.count >= p.adaptiveMinHeals) {
    return Math.max(p.adaptiveFloorTicks, Math.ceil(p.adaptiveMultiplier * (h.totalTicks / h.count)));
  }
  return p.defaultBudgetTicks;
}

/** Replay the ledger under a candidate's budgets — v2: the budget at each
 * tick is the ADAPTIVE one, from heal durations folded up to that tick.
 * Pure over (events, p); sweep order is canonical (sorted by tick), so the
 * fold is order-independent over the same event SET. */
export function shadowCost(events: readonly SweepEvent[], p: DriftPhenotype): number {
  const sweeps = [...events].sort((a, b) => a.tick - b.tick);
  const birth = new Map<string, { tick: number; rule: string; alarmed: boolean }>();
  const healed = new Map<string, HealStats>();
  let cost = 0;
  for (const sweep of sweeps) {
    const present = new Set(sweep.findings.map((f) => JSON.stringify([f.path, f.rule])));
    for (const [key, b] of [...birth]) {
      if (!present.has(key)) {
        const h = healed.get(b.rule) ?? { count: 0, totalTicks: 0 };
        h.count += 1;
        h.totalTicks += sweep.tick - b.tick; // same duration foldMtth banks
        healed.set(b.rule, h);
        birth.delete(key); // healed
      }
    }
    for (const f of sweep.findings) {
      const key = JSON.stringify([f.path, f.rule]);
      if (!birth.has(key)) birth.set(key, { tick: sweep.tick, rule: f.rule, alarmed: false });
    }
    for (const b of birth.values()) {
      const age = sweep.tick - b.tick;
      const budget = budgetAt(b.rule, p, healed);
      cost += TOLERANCE_RENT * budget; // rent on the tolerance being extended
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
