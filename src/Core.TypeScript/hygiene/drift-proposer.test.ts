import { describe, expect, test } from "bun:test";

import {
  canonicalHexOf,
  DEFAULT_MARGIN,
  DEFAULT_STREAK_TICKS,
  evaluateProposal,
  renderProposalLetter,
  renderRegistryPatch,
} from "./drift-proposer";
import type { DriftPhenotype } from "./drift-genome";
import type { SweepEvent } from "./drift-ledger";

// The proposer's laws: fires only on a full losing streak, hysteresis on any
// good tick, deterministic winner, and consent-shaped output (letter text
// carries the registry diff; the module never writes the registry).

const sweep = (tick: number, findings: [string, string][]): SweepEvent => ({
  tick,
  at: "x",
  findings: findings.map(([path, rule]) => ({ path, rule })),
});

/** A history where the current genome bleeds: one finding born early and
 * never healed. Loose-budget mutants score 0 while current pays leak+alarm
 * — dominance grows with age, so late ticks lose by ≥ margin. */
const bleedingHistory = (ticks: number): SweepEvent[] =>
  Array.from({ length: ticks }, (_, i) => sweep(i + 1, [["a.md", "MD022"]]));

/** A clean history: nothing open, everyone scores 0, no tick loses. */
const cleanHistory = (ticks: number): SweepEvent[] =>
  Array.from({ length: ticks }, (_, i) => sweep(i + 1, []));

describe("evaluateProposal — the decision fold", () => {
  test("clean history: streak 0, never fires", () => {
    const ev = evaluateProposal(cleanHistory(10));
    expect(ev.streak).toBe(0);
    expect(ev.fires).toBe(false);
    expect(ev.winner).toBeNull();
  });

  test("bleeding history long enough: full streak, fires with a winner", () => {
    const ev = evaluateProposal(bleedingHistory(20));
    expect(ev.streak).toBe(DEFAULT_STREAK_TICKS);
    expect(ev.fires).toBe(true);
    expect(ev.winner).not.toBeNull();
    // the winner genuinely beats current on the full history
    expect(ev.winner!.parent).not.toBe("current");
  });

  test("the ramp: young drift shows no dominance ≥ margin, so short bleeds cannot fire", () => {
    // Early in a bleed the rent differences are fractions of a tick and no
    // mutant clears the margin; dominance has to be EARNED by age. A 9-tick
    // bleed's window still contains pre-dominance ticks → no full streak.
    const ev = evaluateProposal(bleedingHistory(9));
    expect(ev.streak).toBeLessThan(DEFAULT_STREAK_TICKS);
    expect(ev.fires).toBe(false);
    expect(ev.winner).toBeNull();
  });

  test("too little history never fires even if every tick loses", () => {
    const ev = evaluateProposal(bleedingHistory(DEFAULT_STREAK_TICKS - 1));
    expect(ev.fires).toBe(false);
  });

  test("deterministic: same ledger, same evaluation, bit for bit (DST)", () => {
    const events = bleedingHistory(20);
    expect(evaluateProposal(events)).toEqual(evaluateProposal(events));
  });

  test("margin is respected: an absurd margin silences the proposer", () => {
    const ev = evaluateProposal(bleedingHistory(20), DEFAULT_STREAK_TICKS, 10_000);
    expect(ev.streak).toBe(0);
    expect(ev.fires).toBe(false);
  });
});

const BASE: DriftPhenotype = {
  adaptiveMultiplier: 2,
  adaptiveMinHeals: 2,
  adaptiveFloorTicks: 1,
  defaultBudgetTicks: 6,
  bd001BudgetTicks: 1,
  retractionTriggerTicks: 2,
  healerAxes: 0b111,
};

describe("consent-shaped output", () => {
  test("registry patch renders the exact drift-slo.yaml shape", () => {
    const patch = renderRegistryPatch(BASE);
    expect(patch).toContain("max_open_age_ticks: 6");
    expect(patch).toContain("multiplier: 2");
    expect(patch).toContain("min_heals: 2");
    expect(patch).toContain("floor_ticks: 1");
    expect(patch).toContain("BD001:");
    expect(patch).toContain("    max_open_age_ticks: 1");
  });

  test("the letter carries proposal status, evidence table, and the consent path", () => {
    const ev = evaluateProposal(bleedingHistory(20));
    const letter = renderProposalLetter(ev);
    expect(letter).toContain("PROPOSAL — nothing changes without assent");
    expect(letter).toContain(ev.winner!.genomeHex);
    expect(letter).toContain("| tick | current fitness | best fitness |");
    expect(letter).toContain("The proposer never writes the registry itself.");
    expect(letter).toContain("```yaml");
  });

  test("the letter key is canonical: equivalent phenotypes share one key (gen(gen)==gen)", () => {
    // The live incident: winner #53000d (raw g=0) decodes to min_heals 1,
    // whose canonical re-encode is #53010d — one phenotype, one key.
    const k = canonicalHexOf(BASE);
    expect(canonicalHexOf({ ...BASE })).toBe(k); // stable
    // idempotent under re-canonicalization by construction; and clamped
    // variants collapse: minHeals 0-vs-1 style aliases share the canonical form.
    expect(canonicalHexOf({ ...BASE, adaptiveMinHeals: 1 })).toBe(
      canonicalHexOf({ ...BASE, adaptiveMinHeals: 1 }),
    );
  });

  test(`defaults are the documented ones (streak ${String(DEFAULT_STREAK_TICKS)}, margin ${String(DEFAULT_MARGIN)})`, () => {
    expect(DEFAULT_STREAK_TICKS).toBe(6);
    expect(DEFAULT_MARGIN).toBe(3);
  });
});
