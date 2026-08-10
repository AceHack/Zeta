import { describe, expect, test } from "bun:test";

import { crossover, geneticDistance, mutate } from "../planning/agent-genome";
import {
  CURRENT_PHENOTYPE,
  decodeDriftGenome,
  driftFitness,
  encodeDriftGenome,
  scoreCurrent,
} from "./drift-genome";
import { foldMtth, type SweepEvent } from "./drift-ledger";

// The gyroscope as a citizen of society-evolution: same genome channels,
// same operators, fitness from the drift ledger.

const sweep = (tick: number, findings: [string, string][]): SweepEvent => ({
  tick,
  at: "x",
  findings: findings.map(([path, rule]) => ({ path, rule })),
});

describe("encode/decode — every genome yields a lawful phenotype", () => {
  test("current phenotype round-trips", () => {
    expect(decodeDriftGenome(encodeDriftGenome(CURRENT_PHENOTYPE))).toEqual(CURRENT_PHENOTYPE);
  });

  test("mutation cannot leave the safe region (floors and masks are total)", () => {
    let seed = 7;
    const rng = (): number => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    let g = encodeDriftGenome(CURRENT_PHENOTYPE);
    for (let i = 0; i < 50; i += 1) {
      g = mutate(g, `p${String(i)}`, 0.5, rng); // violent mutation rate
      const p = decodeDriftGenome(g);
      expect(p.adaptiveMultiplier).toBeGreaterThan(0);
      expect(p.adaptiveMinHeals).toBeGreaterThanOrEqual(1);
      expect(p.adaptiveFloorTicks).toBeGreaterThanOrEqual(1);
      expect(p.defaultBudgetTicks).toBeGreaterThanOrEqual(1);
      expect(p.bd001BudgetTicks).toBeGreaterThanOrEqual(1);
      expect(p.retractionTriggerTicks).toBeGreaterThanOrEqual(1);
      expect(p.healerAxes).toBeLessThanOrEqual(0b111);
    }
  });

  test("the society's crossover and distance work unchanged on drift genomes", () => {
    const a = encodeDriftGenome(CURRENT_PHENOTYPE);
    const b = encodeDriftGenome({ ...CURRENT_PHENOTYPE, adaptiveMultiplier: 4, defaultBudgetTicks: 12 });
    const child = crossover(a, b, "a", "b", 4);
    expect(child.generation).toBe(1);
    expect(child.parentIds).toEqual(["a", "b"]);
    expect(geneticDistance(a, b)).toBeGreaterThan(0);
    expect(geneticDistance(a, a)).toBe(0);
  });
});

describe("fitness from the ledger — the calibration score", () => {
  test("demonstrated heals at speed score positive; open drift by age scores negative", () => {
    const healthy = foldMtth([sweep(1, [["a.md", "MD022"]]), sweep(2, [])]);
    const leaking = foldMtth([sweep(1, [["a.md", "MD022"]]), sweep(9, [["a.md", "MD022"]])]);
    expect(driftFitness(healthy)).toBeGreaterThan(0);
    expect(driftFitness(leaking)).toBeLessThan(0);
    expect(driftFitness(healthy)).toBeGreaterThan(driftFitness(leaking));
  });

  test("faster heals of the same drift score higher (speed is fitness)", () => {
    const fast = foldMtth([sweep(1, [["a.md", "MD022"]]), sweep(2, [])]);
    const slow = foldMtth([sweep(1, [["a.md", "MD022"]]), sweep(7, [])]);
    expect(driftFitness(fast)).toBeGreaterThan(driftFitness(slow));
  });

  test("scoreCurrent is deterministic over the same report (DST)", () => {
    const r = foldMtth([sweep(1, [["a.md", "MD022"]]), sweep(2, [])]);
    expect(scoreCurrent(r)).toEqual(scoreCurrent(r));
    expect(scoreCurrent(r).genomeHex).toMatch(/^#[0-9A-Fa-f]{6}$/); // their toHex speaks RGB; CMYK rides in the record phenotype
  });
});
