// produce-extract-game.proof — the toy's four claims, proven over swept parameter grids
// (register B, TOY ONLY — see the module header's honest scope; nothing here proves anything
// about love, ethics, or the world. It proves the toy, exhaustively, deterministically).

import { describe, it, expect } from "bun:test";
import { play, pairTotal, tournamentScore, type GameParams, type Strategy } from "./produce-extract-game";

// Swept region: production creates surplus (gain > cost), extraction is lossy (yield < take).
// These are the discriminator's own definitions — produce creates value, extract destroys it in
// transit — so the region IS the model, not a tuning trick; and claim 3 proves what happens
// anyway on short horizons even inside it.
const GRID: GameParams[] = [];
for (const produceCost of [50, 100]) {
  for (const surplus of [25, 50, 100]) {
    for (const extractTake of [100, 200]) {
      for (const lossPct of [25, 50, 75]) {
        GRID.push({
          initialCapacity: 1000,
          produceCost,
          produceGain: produceCost + surplus,
          extractTake,
          extractYield: Math.round((extractTake * (100 - lossPct)) / 100),
        });
      }
    }
  }
}

describe("PROVEN (toy, swept grid): the vampire's countdown", () => {
  it("claim 1 — mutual extraction self-terminates: both are ground to dust, value is DESTROYED", () => {
    for (const p of GRID) {
      const r = play("alwaysExtract", "alwaysExtract", 400, p);
      // Zeno's vampire: the pro-rated take shrinks with the shrinking host, so the pair decays
      // geometrically toward zero — dead outright, or left with under 1% of what they started
      // with. Either way the coordination annihilated itself; >99% of the value was burned in
      // lossy transit (destroyed, not moved).
      expect(pairTotal(r)).toBeLessThan(Math.round(0.01 * 2 * p.initialCapacity));
    }
  });

  it("claim 2 — mutual production compounds: nobody dies, total strictly grows with the horizon", () => {
    for (const p of GRID) {
      const short = play("alwaysProduce", "alwaysProduce", 50, p);
      const long = play("alwaysProduce", "alwaysProduce", 400, p);
      expect(short.deadA).toBeNull();
      expect(long.deadB).toBeNull();
      expect(pairTotal(long)).toBeGreaterThan(pairTotal(short)); // surplus × rounds
      expect(pairTotal(short)).toBeGreaterThan(2 * p.initialCapacity);
    }
  });

  it("claim 3 — THE TEMPTATION IS REAL: on a short horizon, the extractor outscores the producer", () => {
    // proven, not hidden: against a pure producer, one round of extraction beats one round of
    // production in every swept params — extraction pays first. The dishonest region exists.
    for (const p of GRID) {
      const r = play("alwaysExtract", "alwaysProduce", 1, p);
      expect(r.finalA).toBeGreaterThan(r.finalB); // vampire ahead at round 1
    }
  });

  it("claim 4 — THE HORIZON IS THE THEOREM: past it, the extractor's lead dies with its host", () => {
    for (const p of GRID) {
      const long = play("alwaysExtract", "alwaysProduce", 400, p);
      // the host is drained (dies or is pinned at the floor) …
      expect(long.deadB).not.toBeNull();
      // … and from then on the vampire earns NOTHING; its final capacity is frozen at
      // whatever it drained, while a produce-pair's total keeps compounding past it.
      const pp = play("alwaysProduce", "alwaysProduce", 400, p);
      expect(pairTotal(pp)).toBeGreaterThan(pairTotal(long)); // the coalition out-accumulates the predation
      const ppLonger = play("alwaysProduce", "alwaysProduce", 800, p);
      expect(pairTotal(ppLonger) - pairTotal(pp)).toBeGreaterThan(0); // producers still growing
      const longer = play("alwaysExtract", "alwaysProduce", 800, p);
      expect(pairTotal(longer)).toBe(pairTotal(long)); // the vampire's world stopped growing forever
    }
  });

  it("tit-for-tat contains extraction: the reciprocator never feeds the vampire more than one round", () => {
    for (const p of GRID) {
      const vsVampire = play("titForTat", "alwaysExtract", 400, p);
      const victim = play("alwaysProduce", "alwaysExtract", 400, p);
      // TFT's final capacity beats the pure producer's against the same extractor
      expect(vsVampire.finalA).toBeGreaterThanOrEqual(victim.finalA);
      // and TFT with TFT walks the produce-produce path exactly
      const tt = play("titForTat", "titForTat", 400, p);
      const pp = play("alwaysProduce", "alwaysProduce", 400, p);
      expect(pairTotal(tt)).toBe(pairTotal(pp));
    }
  });

  it("tournament (Axelrod shape): on long horizons, producers top the table in every swept params", () => {
    const field: Strategy[] = ["alwaysProduce", "alwaysExtract", "titForTat"];
    for (const p of GRID) {
      const produce = tournamentScore("alwaysProduce", field, 400, p);
      const extract = tournamentScore("alwaysExtract", field, 400, p);
      const tft = tournamentScore("titForTat", field, 400, p);
      expect(Math.max(produce, tft)).toBeGreaterThan(extract); // a producer strategy wins the table
      expect(tft).toBeGreaterThanOrEqual(produce); // and the guarded producer never does worse than the naive one
    }
  });

  it("honesty check — OUTSIDE the model region the claims rightly fail (lossless extraction)", () => {
    // extraction that destroys nothing (yield == take) merely MOVES value: totals are conserved,
    // nobody-starves claims weaken. Proving the boundary keeps the citation honest: the results
    // above are properties of lossy extraction + surplus production, not of the words.
    const p: GameParams = { initialCapacity: 1000, produceCost: 100, produceGain: 150, extractTake: 100, extractYield: 100 };
    const r = play("alwaysExtract", "alwaysExtract", 10, p);
    expect(pairTotal(r)).toBe(2 * p.initialCapacity); // value conserved — no burn, no countdown story
  });
});
