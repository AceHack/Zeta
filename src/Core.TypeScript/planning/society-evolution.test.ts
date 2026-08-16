/**
 * society-evolution.test.ts — Tests for the evolutionary loop.
 *
 * SE-1..SE-4: basic society construction and statistics
 * SE-5..SE-8: evolutionary step (selection, reproduction, diversity)
 * SE-9..SE-10: reservoir readout
 * SE-11..SE-12: single-parity-check [8,7,2] genome byte (NOT an adinkra code)
 */
import { describe, test, expect } from "bun:test";
import {
  createAgent, createSociety, evolve, reservoirReadout, genomeToParityByte,
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
    // Fitness = trustBound(mu, sigma=0.2236, k=3) = clamp01(mu - 3*0.2236)
    // For mu=0.8: 0.8 - 0.6708 = 0.1292; for mu=0.2: max(0, -0.4708)=0; for mu=0.5: max(0,-0.1708)=0
    // Assert the values, not `>= 0`: trustBound is clamped to [0,1], so mean is
    // non-negative and spread = max - min is non-negative for EVERY possible
    // implementation. `>= 0` held with both computations deleted (mutant: set
    // meanFitness = fitnessSpread = 0 → 12 pass / 0 fail).
    expect(society.meanFitness).toBeCloseTo(0.1292 / 3, 10);
    expect(society.fitnessSpread).toBeCloseTo(0.1292, 10);
  });

  // SE-1b: the fixture above has two fitnesses clamped to 0, so it cannot tell a
  // mean apart from max/n. Repeat with every fitness strictly inside the clamp.
  test("SE-1b: mean and spread over unclamped fitnesses", () => {
    const society = createSociety(
      [makeAgent("hi", 0.95), makeAgent("mid", 0.85), makeAgent("lo", 0.75)],
      0,
    );
    // fitness = mu - 0.6708 → 0.2792, 0.1792, 0.0792
    expect(society.meanFitness).toBeCloseTo(0.1792, 10);
    expect(society.fitnessSpread).toBeCloseTo(0.2, 10);
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
  test("SE-7: survivors are the top-k by fitness, in descending order", () => {
    const agents = [
      makeAgent("low", 0.1),
      makeAgent("mid", 0.5),
      makeAgent("high", 0.95),
    ];
    const s0 = createSociety(agents, 0);
    const s1 = evolve(s0, {
      survivalRate: 0.34, // ceil(3 * 0.34) = 2 survivors — NOT 1, as the old comment claimed
      mutationRate: 0.0,  // no mutation — offspring are clones
      sexual: false,
      rng: makeRng(1),
    });
    // `expect(survivor).toBeDefined()` was the whole assertion. It could not see
    // the survivor COUNT (2, not 1) and it could not see WHICH other agent
    // survived — see SE-7b, which is why that mattered.
    expect(s1.agents.map(a => a.id)).toEqual(["high", "low", "gen1-0"]);
  });

  // ── DEFECT PIN ─────────────────────────────────────────────────────────────
  // Asserts BROKEN behaviour deliberately, so a fix turns this RED. `trustBound`
  // clamps to [0,1] with k = 3 and the fresh-prior sigma = 0.2236, so EVERY agent
  // with mu <= 0.6708 has fitness exactly 0 — including every freshly-created
  // offspring (mu = 0.5 by construction in `evolve`). Ties in the descending
  // fitness sort are then broken by Array.prototype.sort's stability, i.e. by
  // insertion order, so below the clamp floor `evolve` has ZERO selection
  // pressure and keeps the first k agents regardless of their calibration.
  // Reported to Aaron 2026-08-16; not fixed here — the fix is a policy choice
  // (unclamped fitness for ranking, a smaller k, or an explicit tie-break).
  test("SE-7b: DEFECT — below the trustBound clamp floor, evolve selects the WORST agents", () => {
    const agents = [
      makeAgent("worst", 0.05),
      makeAgent("bad", 0.25),
      makeAgent("ok", 0.45),
      makeAgent("best", 0.66), // still under 3*0.2236 = 0.6708
    ];
    const s0 = createSociety(agents, 0);
    expect(s0.agents.map(a => a.fitness)).toEqual([0, 0, 0, 0]);
    const s1 = evolve(s0, {
      survivalRate: 0.5, mutationRate: 0, sexual: false, rng: () => 0.5,
    });
    // Strictly increasing mu, and the two LOWEST survive.
    expect(s1.agents.slice(0, 2).map(a => a.id)).toEqual(["worst", "bad"]);
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

  // SE-11: genomeToParityByte is deterministic
  test("SE-11: genomeToParityByte is deterministic (same genome → same byte)", () => {
    const genome = founderGenome(0b10101010, 0b11001100, 0b11110000);
    const b1 = genomeToParityByte(genome);
    const b2 = genomeToParityByte(genome);
    expect(b1).toBe(b2);
  });

  // SE-12: byte-lock + the parity invariant the encoding actually claims.
  // `0 <= b <= 255` was the old assertion; the function is 8 bit-ors of 0/1
  // values, so it is a byte by construction. Mutant `return 0` at the top of
  // genomeToParityByte left SE-11 and SE-12 at 12 pass / 0 fail — the whole
  // encoding could be deleted with no test noticing.
  test("SE-12: genomeToParityByte byte-lock (channel MSBs at bits 0..6, parity at bit 7)", () => {
    // founderGenome fixes cmyk = {c:128, m:128, y:128, k:0} → MSBs 1,1,1,0 → bits 3,4,5 set.
    // rgb MSBs land at bits 0,1,2; bit 7 = XOR of the seven MSBs (even parity).
    expect(genomeToParityByte(founderGenome(0b10101010, 0b11001100, 0b11110000))).toBe(0b00111111);
    expect(genomeToParityByte(founderGenome(0, 0, 0))).toBe(0b10111000);
    expect(genomeToParityByte(founderGenome(255, 0, 0))).toBe(0b00111001);
    expect(genomeToParityByte(founderGenome(255, 255, 0))).toBe(0b10111011);
  });

  test("SE-12b: every codeword has even parity (the single-bit-error detection property)", () => {
    const popcount = (n: number): number => n.toString(2).split("").filter(c => c === "1").length;
    for (let i = 0; i < 10; i++) {
      const b = genomeToParityByte(founderGenome(i * 25, i * 20, i * 15));
      expect(b).toBeLessThanOrEqual(255);
      expect(popcount(b) % 2).toBe(0);
    }
  });

  // SE-12c: the encoding must be sensitive to the bit it claims to encode.
  test("SE-12c: flipping a channel MSB flips its codeword bit and the parity bit", () => {
    const lo = genomeToParityByte(founderGenome(127, 0, 0)); // r MSB = 0
    const hi = genomeToParityByte(founderGenome(128, 0, 0)); // r MSB = 1
    expect(hi ^ lo).toBe(0b10000001); // bit 0 (r) and bit 7 (parity)
  });

  // SE-12d: the falsifier for the docstring's negative claim. The function was
  // named genomeToAdinkraByte and documented as [8,4,4] extended Hamming; it is
  // the single-parity-check [8,7,2]. The invariant that separates them is
  // DOUBLY-EVEN (every codeword weight ≡ 0 mod 4), not the shared length 8.
  // A weight-2 codeword exists ⇒ not doubly-even ⇒ not self-dual at length 8
  // ⇒ not an adinkra code. If someone later "restores" the [8,4,4] claim in the
  // docstring without changing the encoding, this test says so.
  test("SE-12d: the code is NOT doubly-even (a weight-2 codeword exists) ⇒ not [8,4,4]", () => {
    const popcount = (n: number): number => n.toString(2).split("").filter(c => c === "1").length;
    // One channel MSB set, all others clear ⇒ 1 data bit + 1 parity bit = weight 2.
    const oneChannelHigh = {
      rgb: { r: 128, g: 0, b: 0 },
      cmyk: { c: 0, m: 0, y: 0, k: 0 },
      generation: 0,
      parentIds: [],
    };
    const b = genomeToParityByte(oneChannelHigh);
    expect(b).toBe(0b10000001);
    expect(popcount(b)).toBe(2);       // even ⇒ a valid codeword of this code
    expect(popcount(b) % 4).not.toBe(0); // but NOT doubly-even
  });
});
