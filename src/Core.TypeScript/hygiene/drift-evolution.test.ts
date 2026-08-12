import { describe, expect, test } from "bun:test";

import type { DriftPhenotype } from "./drift-genome";
import { ALARM_WEIGHT, budgetAt, generation, lcg, shadowCost, TOLERANCE_RENT } from "./drift-evolution";
import type { SweepEvent } from "./drift-ledger";

// Generational selection in shadow — the objective's shape and the loop's
// determinism, law-pinned.

// Laws are pinned against a FIXED base phenotype, deliberately independent
// of CURRENT_PHENOTYPE: adoption of a consented proposal must never move
// the objective's law tests (config changes; laws don't).
const BASE: DriftPhenotype = {
  adaptiveMultiplier: 2,
  adaptiveMinHeals: 2,
  adaptiveFloorTicks: 1,
  defaultBudgetTicks: 6,
  bd001BudgetTicks: 1,
  retractionTriggerTicks: 2,
  healerAxes: 0b111,
};

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

describe("shadowCost — the rent/leak/alarm objective (v3)", () => {
  test("within-budget drift costs exactly the rent on its tolerance", () => {
    // born 1, healed 3 → open at ticks 1,2; budget 6 → rent 2·(6·RENT), nothing else
    expect(shadowCost(drift(1, 3), { ...BASE, defaultBudgetTicks: 6 })).toBe(2 * 6 * TOLERANCE_RENT);
  });

  test("drift living beyond budget pays rent + per-tick leak + the filing", () => {
    // open ticks 1..9 (rent 9·6·RENT); ages 7,8 over budget 6 (leak 1+2) + one alarm
    const cost = shadowCost(drift(1, 10), { ...BASE, defaultBudgetTicks: 6 });
    expect(cost).toBe(9 * 6 * TOLERANCE_RENT + 1 + 2 + ALARM_WEIGHT);
  });

  test("too-tight budgets cry wolf: same history, budget 1 costs more alarms+leak", () => {
    const calibrated = shadowCost(drift(1, 10), { ...BASE, defaultBudgetTicks: 6 });
    const tight = shadowCost(drift(1, 10), { ...BASE, defaultBudgetTicks: 1 });
    expect(tight).toBeGreaterThan(calibrated);
  });

  test("THE V3 POINT: budget = ∞ is no longer optimal — the optimum is interior", () => {
    // straggler heals at age 10 (born 1, healed 11): the calibrated budget
    // beats BOTH the too-tight and the maximal one, strictly.
    const at = (b: number): number => shadowCost(drift(1, 11), { ...BASE, defaultBudgetTicks: b });
    expect(at(10)).toBeLessThan(at(2)); // tight pays leak + alarm
    expect(at(10)).toBeLessThan(at(44)); // loose pays rent on unused tolerance
    expect(at(10)).toBeLessThan(at(255)); // and the walls only get worse
  });

  test("BD001 uses its explicit budget, not the default", () => {
    // open ticks 1..3 (rent 3·1·RENT); age 2 over budget 1 (leak 1) + alarm
    const cost = shadowCost(drift(1, 4, "BD001"), { ...BASE, bd001BudgetTicks: 1, defaultBudgetTicks: 6 });
    expect(cost).toBe(3 * 1 * TOLERANCE_RENT + 1 + ALARM_WEIGHT);
  });

  test("pure and order-independent over the same event set", () => {
    const events = drift(1, 10);
    const shuffled = [events[3]!, events[0]!, events[5]!, ...events.filter((_, i) => ![0, 3, 5].includes(i))];
    expect(shadowCost(shuffled, BASE)).toBe(shadowCost(events, BASE));
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

// ── Shadow v2: the ADAPTIVE rule replayed (081KZQ6881G08QG0R003PPKR8B) ──────
// History used throughout: two fast MD022 heals (durations 1,1 → running
// MTTH 1) then a slow third drift born tick 10, healed tick 15.
const adaptiveHistory = (): SweepEvent[] => [...drift(1, 2), ...drift(4, 5), ...drift(10, 15)];

describe("shadow v2 — the adaptive rule is replayed, not the static budget", () => {
  test("earned evidence tightens the budget mid-replay: the slow third drift now costs", () => {
    // multiplier 2 × running MTTH 1 → budget 2 (floor 1). Ages 3,4 leak 1+2; one alarm.
    const p = { ...BASE, adaptiveMultiplier: 2, adaptiveMinHeals: 2, adaptiveFloorTicks: 1, defaultBudgetTicks: 6 };
    // rent: 2 pre-evidence ticks at budget 6, 5 tightened ticks at budget 2;
    // ages 3,4 over the earned budget 2 → leak 1+2 + one alarm.
    expect(shadowCost(adaptiveHistory(), p)).toBe(2 * (6 * TOLERANCE_RENT) + 5 * (2 * TOLERANCE_RENT) + 1 + 2 + ALARM_WEIGHT);
  });

  test("static default 6 would have tolerated it — v1 semantics cost zero here", () => {
    // Same history, min_heals gate NOT met (needs 3): stays on default 6 —
    // no leak, no alarm; only the rent on 7 open ticks of budget-6 tolerance.
    const p = { ...BASE, adaptiveMinHeals: 3, defaultBudgetTicks: 6 };
    expect(shadowCost(adaptiveHistory(), p)).toBe(7 * (6 * TOLERANCE_RENT));
  });

  test("floor clamps the adaptive budget from below (live sloLimit semantics)", () => {
    const healed = new Map([["MD022", { count: 2, totalTicks: 2 }]]); // MTTH 1
    expect(budgetAt("MD022", { ...BASE, adaptiveMultiplier: 1, adaptiveFloorTicks: 3 }, healed)).toBe(3);
    expect(budgetAt("MD022", { ...BASE, adaptiveMultiplier: 5, adaptiveFloorTicks: 3 }, healed)).toBe(5);
  });

  test("explicit BD001 budget still wins over any adaptive evidence", () => {
    const healed = new Map([["BD001", { count: 9, totalTicks: 90 }]]);
    expect(budgetAt("BD001", { ...BASE, bd001BudgetTicks: 1 }, healed)).toBe(1);
  });

  test("THE POINT: the r channel (multiplier) is now visible to selection", () => {
    // v1 scored these identically (same c, m); v2 separates them.
    const tight = shadowCost(adaptiveHistory(), { ...BASE, adaptiveMultiplier: 2 });
    const loose = shadowCost(adaptiveHistory(), { ...BASE, adaptiveMultiplier: 8 });
    expect(tight).toBeGreaterThan(loose); // mult 8 → budget 8 tolerates the slow heal
    // loose pays only rent: 2 ticks of budget-6 + 5 ticks of earned budget-8
    expect(loose).toBe(2 * (6 * TOLERANCE_RENT) + 5 * (8 * TOLERANCE_RENT));
  });

  test("g and b channels visible too: min_heals gates, floor loosens", () => {
    const gated = shadowCost(adaptiveHistory(), { ...BASE, adaptiveMinHeals: 3 });
    const active = shadowCost(adaptiveHistory(), { ...BASE, adaptiveMinHeals: 2 });
    expect(active).toBeGreaterThan(gated);
    const flooredHigh = shadowCost(adaptiveHistory(), { ...BASE, adaptiveFloorTicks: 5 });
    expect(flooredHigh).toBeLessThan(active); // floor 5 tolerates ages 3,4
  });
});
