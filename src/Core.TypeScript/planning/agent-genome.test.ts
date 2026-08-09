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

  it("AG-11: crossover at point 6 takes RGB+CMYK c/m/y from parent1, k from parent1 (bug fix: was always parent2)", () => {
    // Before fix: cp was clamped to 6, so k (index 6) always came from parent2.
    // After fix: cp=6 means channels[0..5] from parent1, channels[6] (k) from parent2.
    // cp=7 means all 7 channels from parent1.
    const p1 = founderGenome(255, 0, 0);
    const p2 = founderGenome(0, 255, 0);
    // Set distinct k values via CMYK extension (founderGenome sets k=0; mutate to distinguish)
    const p1k = { ...p1, cmyk: { ...p1.cmyk, k: 42 } };
    const p2k = { ...p2, cmyk: { ...p2.cmyk, k: 99 } };
    const childAt6 = crossover(p1k, p2k, "p1", "p2", 6);
    // cp=6: indices 0-5 from p1k, index 6 (k) from p2k
    expect(childAt6.rgb.r).toBe(255);      // index 0 from p1k
    expect(childAt6.cmyk.c).toBe(128);     // index 3 from p1k (founderGenome default)
    expect(childAt6.cmyk.k).toBe(99);      // index 6 from p2k
  });

  it("AG-12: crossover at point 7 takes all channels from parent1 (was unreachable before fix)", () => {
    const p1k = { ...founderGenome(255, 0, 0), cmyk: { c: 10, m: 20, y: 30, k: 42 } };
    const p2k = { ...founderGenome(0, 255, 0), cmyk: { c: 50, m: 60, y: 70, k: 99 } };
    const childAt7 = crossover(p1k, p2k, "p1", "p2", 7);
    // cp=7: all 7 channels from p1k
    expect(childAt7.rgb.r).toBe(255);
    expect(childAt7.rgb.g).toBe(0);
    expect(childAt7.cmyk.c).toBe(10);
    expect(childAt7.cmyk.k).toBe(42);  // k from p1k — was impossible before fix
  });

  it("AG-13: crossover k-channel anti-regression — cp=6 gives k from parent2, not parent1", () => {
    // This test would have PASSED before the fix (k always came from parent2).
    // It documents the old (wrong) behaviour so any regression is immediately visible.
    const p1k = { ...founderGenome(100, 100, 100), cmyk: { c: 10, m: 10, y: 10, k: 11 } };
    const p2k = { ...founderGenome(200, 200, 200), cmyk: { c: 20, m: 20, y: 20, k: 22 } };
    const child = crossover(p1k, p2k, "p1", "p2", 6);
    // cp=6: channels[0..5] from p1k, channel[6] (k) from p2k
    expect(child.cmyk.k).toBe(22); // k from p2k
    expect(child.cmyk.y).toBe(10); // y (index 5) from p1k
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
