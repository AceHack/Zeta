import { describe, it, expect } from "bun:test";
import {
  founderGenome, fromHex, toHex, toHyperparams,
  mutate, crossover, mix, geneticDistance, dominantTrait
} from "./agent-genome";

describe("Agent Genome", () => {
  it("AG-1: founderGenome clamps to [0,255]", () => {
    const g = founderGenome(300, -10, 128);
    expect(g.rgb.r).toBe(255);
    expect(g.rgb.g).toBe(0);
    expect(g.rgb.b).toBe(128);
    expect(g.generation).toBe(0);
    expect(g.parentIds).toHaveLength(0);
  });

  it("AG-2: fromHex/toHex round-trip", () => {
    const hex = "#ff8040";
    const g = fromHex(hex);
    expect(toHex(g)).toBe(hex);
  });

  it("AG-3: toHyperparams maps channels correctly", () => {
    const g = founderGenome(255, 128, 0);
    const h = toHyperparams(g);
    expect(h.posteriorPrecision).toBeCloseTo(10.0, 1);
    expect(h.domainBreadth).toBeCloseTo(0.502, 1);
    expect(h.exploreBoundK).toBeCloseTo(0.0, 1);
  });

  it("AG-4: mutate increments generation and sets parentId", () => {
    const g = founderGenome(128, 128, 128);
    const child = mutate(g, "parent-1", 0.0); // zero mutation
    expect(child.generation).toBe(1);
    expect(child.parentIds).toEqual(["parent-1"]);
    // Zero mutation: channels unchanged
    expect(child.rgb.r).toBe(128);
  });

  it("AG-5: mutate with nonzero rate changes channels", () => {
    const g = founderGenome(128, 128, 128);
    // Use a deterministic rng that always returns 1.0 (max positive noise)
    const child = mutate(g, "p", 0.1, () => 1.0);
    // noise = round((1.0*2-1) * 0.1 * 255) = round(25.5) = 26
    expect(child.rgb.r).toBe(154); // 128 + 26
  });

  it("AG-6: crossover at point 0 takes all from parent2", () => {
    const p1 = founderGenome(255, 0, 0);
    const p2 = founderGenome(0, 255, 0);
    const child = crossover(p1, p2, "p1", "p2", 0);
    // crossoverPoint=0: all channels from parent2
    expect(child.rgb.r).toBe(0);
    expect(child.rgb.g).toBe(255);
    expect(child.parentIds).toEqual(["p1", "p2"]);
  });

  it("AG-7: crossover at point 3 takes RGB from parent1, CMYK from parent2", () => {
    const p1 = founderGenome(255, 0, 0);
    const p2 = founderGenome(0, 255, 0);
    const child = crossover(p1, p2, "p1", "p2", 3);
    expect(child.rgb.r).toBe(255); // from p1
    expect(child.rgb.g).toBe(0);   // from p1
    expect(child.rgb.b).toBe(0);   // from p1
  });

  it("AG-8: mix at weight=0.5 averages channels", () => {
    const g1 = founderGenome(0, 0, 0);
    const g2 = founderGenome(200, 100, 50);
    const mixed = mix(g1, g2, "g1", "g2", 0.5);
    expect(mixed.rgb.r).toBe(100);
    expect(mixed.rgb.g).toBe(50);
    expect(mixed.rgb.b).toBe(25);
  });

  it("AG-9: geneticDistance is 0 for identical genomes", () => {
    const g = founderGenome(100, 150, 200);
    expect(geneticDistance(g, g)).toBe(0);
  });

  it("AG-10: dominantTrait identifies highest channel", () => {
    expect(dominantTrait(founderGenome(200, 100, 50))).toBe("belief");
    expect(dominantTrait(founderGenome(50, 200, 100))).toBe("breadth");
    expect(dominantTrait(founderGenome(50, 100, 200))).toBe("exploration");
  });
});
