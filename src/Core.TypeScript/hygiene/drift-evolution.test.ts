import { describe, expect, test } from "bun:test";

import { CURRENT_PHENOTYPE } from "./drift-genome";
import { ALARM_WEIGHT, generation, lcg, shadowCost } from "./drift-evolution";
import type { SweepEvent } from "./drift-ledger";

// Generational selection in shadow — the objective's shape and the loop's
// determinism, law-pinned.

const sweep = (tick: number, findings: [string, string][]): SweepEvent => ({
  tick,
  at: "x",
  findings: findings.map(([path, rule]) => ({ path, rule })),
});

const drift = (bornTick: number, healTick: number, rule = "MD022"): SweepEvent[] => {
  const out: SweepEvent[] = [];
  for (let t = bornTick; t < healTick; t += 1) out.push(sweep(t, [["a.md", rule]]));
  out.push(sweep(healTick, []));
  return out;
};

describe("shadowCost — the leak/alarm objective", () => {
  test("drift healed within budget costs nothing", () => {
    expect(shadowCost(drift(1, 3), { ...CURRENT_PHENOTYPE, defaultBudgetTicks: 6 })).toBe(0);
  });

  test("drift living beyond budget pays the filing plus per-tick leak", () => {
    // born 1, healed 10 → ages 0..8; budget 6 → over at ages 7,8 (leak 1+2) + one alarm
    const cost = shadowCost(drift(1, 10), { ...CURRENT_PHENOTYPE, defaultBudgetTicks: 6 });
    expect(cost).toBe(1 + 2 + ALARM_WEIGHT);
  });

  test("too-tight budgets cry wolf: same history, budget 1 costs more alarms+leak", () => {
    const loose = shadowCost(drift(1, 10), { ...CURRENT_PHENOTYPE, defaultBudgetTicks: 6 });
    const tight = shadowCost(drift(1, 10), { ...CURRENT_PHENOTYPE, defaultBudgetTicks: 1 });
    expect(tight).toBeGreaterThan(loose);
  });

  test("BD001 uses its explicit budget, not the default", () => {
    // born 1, healed 4 → ages 0..2; bd budget 1 → over at age 2 (leak 1) + alarm
    const cost = shadowCost(drift(1, 4, "BD001"), { ...CURRENT_PHENOTYPE, bd001BudgetTicks: 1, defaultBudgetTicks: 6 });
    expect(cost).toBe(1 + ALARM_WEIGHT);
  });

  test("pure and order-independent over the same event set", () => {
    const events = drift(1, 10);
    const shuffled = [events[3]!, events[0]!, events[5]!, ...events.filter((_, i) => ![0, 3, 5].includes(i))];
    expect(shadowCost(shuffled, CURRENT_PHENOTYPE)).toBe(shadowCost(events, CURRENT_PHENOTYPE));
  });
});

describe("generation — deterministic selection", () => {
  const events = [...drift(1, 10), ...drift(12, 14, "BD001")];

  test("same seed ⇒ identical ranked population, bit for bit (DST)", () => {
    expect(generation(events, 8, lcg(7))).toEqual(generation(events, 8, lcg(7)));
  });

  test("current genome is always in the population and ranking is by shadow fitness", () => {
    const ranked = generation(events, 8, lcg(7));
    expect(ranked).toHaveLength(9);
    expect(ranked.some((c) => c.parent === "current")).toBe(true);
    for (let i = 1; i < ranked.length; i += 1) {
      expect(ranked[i - 1]!.shadowFitness).toBeGreaterThanOrEqual(ranked[i]!.shadowFitness);
    }
  });

  test("selection pressure is real: some mutant beats or ties current on a leaky history", () => {
    // History with drift the CURRENT default budget (6) tolerates too long:
    // a tighter mutant should score at least as well somewhere in 16 tries.
    const leaky = [...drift(1, 20), ...drift(25, 40)];
    const ranked = generation(leaky, 16, lcg(3));
    const current = ranked.find((c) => c.parent === "current")!;
    expect(ranked[0]!.shadowFitness).toBeGreaterThanOrEqual(current.shadowFitness);
  });
});
