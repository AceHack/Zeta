#!/usr/bin/env bun
// drift-genome.ts — the gyroscope joins the society's evolutionary loop
// (Aaron 2026-08-10: "look up our evolutionary algos and make sure you
// expand in that way"). The pattern is planning/society-evolution.ts,
// verbatim: fitness is a score computed from a LEDGER in the repo;
// reproduction is AgentGenome crossover + mutation; the loop runs on the
// Actions cadence with results committed (the heartbeat pattern the module
// itself names as the transport already in place).
//
// This module makes the drift system a CITIZEN of that loop rather than a
// parallel invention: the gyroscope's tunables encode onto the SAME
// 7-channel (RGB+CMYK) genome, so the society's own operators — mutate,
// crossover, geneticDistance from planning/agent-genome.ts — work on it
// UNCHANGED (only-the-irreducible-is-primitive: reuse the generator, do
// not mint a sibling). Fitness derives from the drift ledger's MtthReport
// in the proper-scoring spirit (Gneiting–Raftery, per society-evolution's
// own anchor): reward demonstrated heals at speed, penalize open drift by
// age. Every tick publishes data/drift-genome.json — the calibration-
// ledger-shaped signal a generational loop selects on.
//
// Channel map (0–255 each; decode clamps keep every phenotype lawful):
//   r → adaptive multiplier ×32   (current 2   → 64)
//   g → adaptive min_heals        (current 2)
//   b → adaptive floor_ticks      (current 1)
//   c → default max_open_age_ticks (current 6)
//   m → BD001 explicit budget      (current 1)
//   y → retraction trigger ticks   (current 2)
//   k → healer-axis bitmask        (current 0b111 = md ⊕ memory ⊕ retraction)
//
// NOTHING here mutates the live registries: this module measures the
// CURRENT genome's fitness and provides the encode/decode + reused
// operators. Selection over generations is the society loop's act, with
// its own consent surface — a genome that wants to become config goes
// through the registry-change discipline like any other registry write.

import { writeFileSync } from "node:fs";

import {
  crossover,
  geneticDistance,
  mutate,
  toHex,
  type AgentGenome,
} from "../planning/agent-genome.ts";
import { foldMtth, readLedger, type MtthReport } from "./drift-ledger.ts";

export { crossover, geneticDistance, mutate, toHex }; // the society's operators, re-exported unchanged

// ── Encode / decode ─────────────────────────────────────────────────────────

export interface DriftPhenotype {
  readonly adaptiveMultiplier: number; // (0, 8] in steps of 1/32
  readonly adaptiveMinHeals: number; // >= 1
  readonly adaptiveFloorTicks: number; // >= 1
  readonly defaultBudgetTicks: number; // >= 1
  readonly bd001BudgetTicks: number; // >= 1
  readonly retractionTriggerTicks: number; // >= 1
  readonly healerAxes: number; // bitmask: 1 md, 2 memory, 4 retraction
}

export const CURRENT_PHENOTYPE: DriftPhenotype = {
  adaptiveMultiplier: 2,
  adaptiveMinHeals: 2,
  adaptiveFloorTicks: 1,
  defaultBudgetTicks: 6,
  bd001BudgetTicks: 1,
  retractionTriggerTicks: 2,
  healerAxes: 0b111,
};

const clamp8 = (n: number): number => Math.max(0, Math.min(255, Math.round(n)));

export function encodeDriftGenome(p: DriftPhenotype, generation = 0, parentIds: string[] = []): AgentGenome {
  return {
    rgb: {
      r: clamp8(p.adaptiveMultiplier * 32),
      g: clamp8(p.adaptiveMinHeals),
      b: clamp8(p.adaptiveFloorTicks),
    },
    cmyk: {
      c: clamp8(p.defaultBudgetTicks),
      m: clamp8(p.bd001BudgetTicks),
      y: clamp8(p.retractionTriggerTicks),
      k: clamp8(p.healerAxes),
    },
    generation,
    parentIds,
  };
}

/** Total decode: every 7-channel genome yields a LAWFUL phenotype (mutation
 * can wander; the phenotype space cannot leave the safe region — floors at
 * 1 tick, multiplier > 0, axes masked to the three that exist). */
export function decodeDriftGenome(g: AgentGenome): DriftPhenotype {
  return {
    adaptiveMultiplier: Math.max(1 / 32, g.rgb.r / 32),
    adaptiveMinHeals: Math.max(1, g.rgb.g),
    adaptiveFloorTicks: Math.max(1, g.rgb.b),
    defaultBudgetTicks: Math.max(1, g.cmyk.c),
    bd001BudgetTicks: Math.max(1, g.cmyk.m),
    retractionTriggerTicks: Math.max(1, g.cmyk.y),
    healerAxes: g.cmyk.k & 0b111,
  };
}

// ── Fitness from the ledger (the calibration score) ─────────────────────────

/** Proper-scoring spirit over the drift ledger: each class contributes its
 * demonstrated heal throughput discounted by its speed (heals / (1 + mtth)),
 * minus its open drift weighted by age (old open drift is the leak). Pure
 * over the report — same ledger, same fitness, bit for bit (DST). */
export function driftFitness(report: MtthReport): number {
  let f = 0;
  for (const c of report.classes) {
    if (c.mtthTicks !== null) f += c.healedCount / (1 + c.mtthTicks);
    if (c.oldestOpenAgeTicks !== null) f -= c.openCount * (1 + c.oldestOpenAgeTicks);
  }
  return Math.round(f * 1000) / 1000;
}

export interface GenomeFitnessRecord {
  readonly genomeHex: string;
  readonly generation: number;
  readonly tick: number;
  readonly fitness: number;
  readonly phenotype: DriftPhenotype;
}

export function scoreCurrent(report: MtthReport): GenomeFitnessRecord {
  const genome = encodeDriftGenome(CURRENT_PHENOTYPE);
  return {
    genomeHex: toHex(genome),
    generation: genome.generation,
    tick: report.latestTick,
    fitness: driftFitness(report),
    phenotype: CURRENT_PHENOTYPE,
  };
}

// ── CLI: publish the fitness signal (society-evolution's ledger contract) ───

const invokedDirectly = typeof process.argv[1] === "string" && /drift-genome\.(?:ts|js)$/.test(process.argv[1]);
if (invokedDirectly) {
  const report = foldMtth(readLedger("docs/drift-events"));
  const rec = scoreCurrent(report);
  writeFileSync("data/drift-genome.json", `${JSON.stringify(rec, null, 2)}\n`);
  console.log(
    `drift-genome: ${rec.genomeHex} gen ${String(rec.generation)} fitness ${String(rec.fitness)} at tick ${String(rec.tick)}`,
  );
  // Prove the society's operators run on this genome (seeded, deterministic).
  let seed = 42;
  const rng = (): number => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  const child = mutate(encodeDriftGenome(CURRENT_PHENOTYPE), "drift-gen0", 0.05, rng);
  console.log(`drift-genome: example mutant ${toHex(child)} → ${JSON.stringify(decodeDriftGenome(child))}`);
  process.exit(0);
}
