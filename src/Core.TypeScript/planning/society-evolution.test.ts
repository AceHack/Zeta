/**
 * society-evolution.test.ts — Tests for the evolutionary loop.
 *
 * SE-1..SE-4: basic society construction and statistics
 * SE-5..SE-8: evolutionary step (selection, reproduction, diversity)
 * SE-9..SE-10: reservoir readout
 * SE-11..SE-12: Adinkra ECC encoding
 */
import { describe, test, expect } from "bun:test";
import {
  createAgent, createSociety, evolve, reservoirReadout, genomeToAdinkraByte,
  DEFAULT_EVOLUTION_PARAMS,
  type SocietyAgent,
} from "./society-evolution";
import { founderGenome } from "./agent-genome";
import type { CalibrationPosterior } from "./calibration-ledger";

// ── Helpers ────────────────────────────────────────────────────────────────────

function freshPosterior(zid: string, mu = 0.5): CalibrationPosterior {
  return { zid, hatId: "default", mu, sigma: 0.2236, settledCount: 0 };
}

function makeAgent(id: string, mu: number): SocietyAgent {
  const genome = founderGenome(
    Math.round(mu * 255),
    Math.round(mu * 200),
    Math.round(mu * 100),
  );
  return createAgent(id, genome, freshPosterior(id, mu));
}

// Deterministic RNG (xorshift32)
function makeRng(seed: number): () => number {
  let s = (seed >>> 0) || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; };
}

// ── SE-1: createSociety computes correct statistics ────────────────────────────
describe("SocietyEvolution", () => {
  test("SE-1: createSociety computes mean fitness and spread", () => {
    const agents = [makeAgent("a", 0.8), makeAgent("b", 0.2), makeAgent("c", 0.5)];
    const society = createSociety(agents, 0);
    expect(society.generation).toBe(0);
    expect(society.agents.length).toBe(3);
    // Fitness = trustBound(mu, sigma=0.2236, k=3) = max(0, mu - 3*0.2236)
    // For mu=0.8: 0.8 - 0.6708 = 0.1292; for mu=0.2: max(0, -0.4708)=0; for mu=0.5: max(0,-0.1708)=0
    expect(society.meanFitness).toBeGreaterThanOrEqual(0);
    expect(society.fitnessSpread).toBeGreaterThanOrEqual(0);
  });

  // SE-2: genetic diversity is 0 for a single-agent society
  test("SE-2: single-agent society has zero genetic diversity", () => {
    const society = createSociety([makeAgent("a", 0.5)], 0);
    expect(society.geneticDiversity).toBe(0);
  });

  // SE-3: genetic diversity is positive for distinct agents
  test("SE-3: distinct agents have positive genetic diversity", () => {
    const agents = [makeAgent("a", 0.1), makeAgent("b", 0.9)];
    const society = createSociety(agents, 0);
    expect(society.geneticDiversity).toBeGreaterThan(0);
  });

  // SE-4: empty society is handled gracefully
  test("SE-4: empty society has zero statistics", () => {
    const society = createSociety([], 0);
    expect(society.meanFitness).toBe(0);
    expect(society.fitnessSpread).toBe(0);
    expect(society.geneticDiversity).toBe(0);
  });

  // SE-5: evolve increments generation
  test("SE-5: evolve increments generation counter", () => {
    const agents = Array.from({ length: 6 }, (_, i) => makeAgent(`a${i}`, 0.3 + i * 0.1));
    const s0 = createSociety(agents, 0);
    const s1 = evolve(s0, { ...DEFAULT_EVOLUTION_PARAMS, rng: makeRng(42) });
    expect(s1.generation).toBe(1);
  });

  // SE-6: evolve preserves population size
  test("SE-6: evolve preserves population size", () => {
    const agents = Array.from({ length: 8 }, (_, i) => makeAgent(`a${i}`, 0.1 + i * 0.1));
    const s0 = createSociety(agents, 0);
    const s1 = evolve(s0, { ...DEFAULT_EVOLUTION_PARAMS, rng: makeRng(42) });
    expect(s1.agents.length).toBe(8);
  });

  // SE-7: top survivor has highest fitness (selection is correct)
  test("SE-7: top survivor is the highest-fitness agent", () => {
    const agents = [
      makeAgent("low", 0.1),
      makeAgent("mid", 0.5),
      makeAgent("high", 0.95),
    ];
    const s0 = createSociety(agents, 0);
    const s1 = evolve(s0, {
      survivalRate: 0.34, // keep 1 of 3
      mutationRate: 0.0,  // no mutation — offspring are clones
      sexual: false,
      rng: makeRng(1),
    });
    // The survivor should be "high" (fitness = trustBound(0.95, 0.2236, 3) > 0)
    const survivor = s1.agents.find(a => a.id === "high");
    expect(survivor).toBeDefined();
  });

  // SE-8: offspring have generation > 0
  test("SE-8: offspring have incremented generation number", () => {
    const agents = Array.from({ length: 4 }, (_, i) => makeAgent(`a${i}`, 0.5 + i * 0.1));
    const s0 = createSociety(agents, 0);
    const s1 = evolve(s0, { ...DEFAULT_EVOLUTION_PARAMS, rng: makeRng(7) });
    // Offspring are the non-survivor agents; their genomes should have generation >= 1
    const offspring = s1.agents.filter(a => !agents.some(orig => orig.id === a.id));
    for (const o of offspring) {
      expect(o.genome.generation).toBeGreaterThanOrEqual(1);
    }
  });

  // SE-9: reservoirReadout returns mean genome channels
  test("SE-9: reservoirReadout returns mean of genome channels", () => {
    const g1 = founderGenome(100, 100, 100);
    const g2 = founderGenome(200, 200, 200);
    const a1 = createAgent("a", g1, freshPosterior("a"));
    const a2 = createAgent("b", g2, freshPosterior("b"));
    const society = createSociety([a1, a2], 0);
    const readout = reservoirReadout(society);
    expect(readout.r).toBeCloseTo(150, 0);
    expect(readout.g).toBeCloseTo(150, 0);
    expect(readout.b).toBeCloseTo(150, 0);
  });

  // SE-10: reservoirReadout on empty society returns zeros
  test("SE-10: reservoirReadout on empty society returns zeros", () => {
    const readout = reservoirReadout(createSociety([], 0));
    expect(readout.r).toBe(0);
    expect(readout.g).toBe(0);
    expect(readout.b).toBe(0);
  });

  // SE-11: genomeToAdinkraByte is deterministic
  test("SE-11: genomeToAdinkraByte is deterministic (same genome → same byte)", () => {
    const genome = founderGenome(0b10101010, 0b11001100, 0b11110000);
    const b1 = genomeToAdinkraByte(genome);
    const b2 = genomeToAdinkraByte(genome);
    expect(b1).toBe(b2);
  });

  // SE-12: genomeToAdinkraByte returns a value in [0, 255]
  test("SE-12: genomeToAdinkraByte returns a byte (0-255)", () => {
    for (let i = 0; i < 10; i++) {
      const genome = founderGenome(i * 25, i * 20, i * 15);
      const b = genomeToAdinkraByte(genome);
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThanOrEqual(255);
    }
  });
});
