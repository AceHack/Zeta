/**
 * decorrelation-meter.test.ts — the falsifiers the module shipped without.
 *
 * `.claude/rules/toy-is-free-metered-must-be-earned.md`: 275 lines of measurement on `main` with
 * no test is `unmetered` — nothing could distinguish it working from it not working. Seven of the
 * cases below were reproduced against the AS-MERGED implementation (#14848) first, and each block
 * records what that implementation actually printed, so these are regressions with a measurement
 * behind them rather than hypotheticals.
 *
 * Each `§` block names the property and the mutation that kills it. See the PR body for the
 * mutation log (mutation applied → which test went red).
 */

import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { stringCompare } from "../collation/collation.ts";
import {
  ALL_BANDS,
  DEFAULT_WINDOW_MS,
  MIN_DECISIONS,
  bandOf,
  chanceAgreement,
  computePairwise,
  foldDecorrelation,
  formatDecorrelation,
  groupByTickWindow,
  loadTickDecisions,
  measureDecorrelation,
  type DecisionLoad,
  type TickDecision,
} from "./decorrelation-meter.ts";

// ═══ Fixtures ═════════════════════════════════════════════════════════════════

const EPOCH = Date.parse("2026-08-24T00:00:00.000Z");
const MENU4 = ["explore", "work", "play", "rest"] as const;

/** Tick `n` lands in its own window: windows are `DEFAULT_WINDOW_MS` wide. */
const at = (n: number): string => new Date(EPOCH + n * DEFAULT_WINDOW_MS + 1_000).toISOString();

const dec = (agent: string, tick: number, chosenIndex: number, options: readonly string[] = MENU4): TickDecision =>
  ({ agent, at: at(tick), chosenIndex, options: [...options], fallback: false });

const loaded = (decisions: readonly TickDecision[]): DecisionLoad =>
  ({ decisions, unreadable: false, malformedLines: 0, fallbackLines: 0 });

/**
 * The AS-MERGED chance formula, reconstructed here so §4's comparisons name what they are
 * measuring against instead of carrying bare literals. Keeping it executable is the point: it
 * shows the two formulas disagree rather than asserting that they do.
 */
const asMergedChance = (a: readonly string[], b: readonly string[]): number =>
  1 / ((a.length + b.length) / 2);

/** N ticks where A and B both choose the SAME option every time. */
const identicalStreams = (n: number): TickDecision[] =>
  Array.from({ length: n }, (_, i) => [dec("A", i, i % 4), dec("B", i, i % 4)]).flat();

/** N ticks where A and B agree exactly 1-in-4 — the chance rate for a 4-option menu. */
const chanceStreams = (n: number): TickDecision[] =>
  Array.from({ length: n }, (_, i) => [dec("A", i, i % 4), dec("B", i, (i + Math.floor(i / 4)) % 4)]).flat();

/**
 * `mkdtempSync`, never a predictable `join(tmpdir(), name)`. A guessable path in a world-writable
 * directory is a symlink-substitution target, and CodeQL flagged exactly that on the first draft
 * of this file (alert 773, "insecure creation of file in the os temp dir"). `mkdtempSync` creates
 * the directory itself with a random suffix and 0700, so there is nothing to pre-create.
 */
function withFixture(name: string, lines: readonly unknown[] | null, f: (root: string) => void): void {
  const root = mkdtempSync(join(tmpdir(), `zeta-decorr-${name}-`));
  try {
    mkdirSync(join(root, "data"), { recursive: true });
    if (lines !== null) {
      writeFileSync(
        join(root, "data", "tick-reasoning.jsonl"),
        lines.map((l) => (typeof l === "string" ? l : JSON.stringify(l))).join("\n") + "\n",
      );
    }
    f(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// §1. THE COEFFICIENT'S TWO ANCHOR POINTS — the whole product, pinned
//     Mutation: `1 - meanCorrelationExcess` → `meanCorrelationExcess`  ⇒ both die.
// ═══════════════════════════════════════════════════════════════════════════════

describe("§1 coefficient anchors", () => {
  it("identical decision streams measure coefficient 0 — no decorrelation at all", () => {
    const m = foldDecorrelation(loaded(identicalStreams(12)));
    expect(m.coefficient).toBe(0);
    expect(m.meanCorrelationExcess).toBe(1);
    expect(m.band).toBe("agreement-far-above-chance");
    expect(m.totalSamples).toBe(12);
  });

  it("agreement at exactly the chance rate measures coefficient 1 — indistinguishable from independent", () => {
    const m = foldDecorrelation(loaded(chanceStreams(16)));
    expect(m.pairs[0]?.agreementRate).toBeCloseTo(0.25, 10);
    expect(m.pairs[0]?.expectedByChance).toBeCloseTo(0.25, 10);
    expect(m.coefficient).toBeCloseTo(1, 10);
    expect(m.meanCorrelationExcess).toBeCloseTo(0, 10);
  });

  it("the coefficient is monotone: more agreement is never more decorrelation", () => {
    const coeffAt = (agreeEvery: number): number => {
      const rows = Array.from({ length: 24 }, (_, i) =>
        [dec("A", i, 0), dec("B", i, i % agreeEvery === 0 ? 0 : 1)]).flat();
      return foldDecorrelation(loaded(rows)).coefficient ?? Number.NaN;
    };
    // agreeEvery=1 → always agree; 2 → half; 4 → quarter (== chance).
    const always = coeffAt(1), half = coeffAt(2), quarter = coeffAt(4);
    expect(always).toBeLessThan(half);
    expect(half).toBeLessThan(quarter);
    expect(always).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// §2. FORCED AGREEMENT IS NOT INDEPENDENCE
//     As-merged (#14848): a 1-option menu gave denominator 0 → excess 0 → coefficient 1.0,
//     band "strongly-independent". Two agents who COULD NOT DISAGREE scored maximally
//     decorrelated. Reproduced before the fix.
//     Mutation: drop `if (dA.options.length < 2 || dB.options.length < 2) { ... continue; }` ⇒ dies.
// ═══════════════════════════════════════════════════════════════════════════════

describe("§2 degenerate menus are refused, never scored as independence", () => {
  it("a single-option menu yields NO measurement, not a perfect one", () => {
    const rows = Array.from({ length: 12 }, (_, i) =>
      [dec("A", i, 0, ["only"]), dec("B", i, 0, ["only"])]).flat();
    const m = foldDecorrelation(loaded(rows));
    expect(m.coefficient).toBeNull();
    expect(m.band).toBe("insufficient-data");
    expect(m.pairs[0]?.degenerateWindows).toBe(12);
    expect(m.pairs[0]?.sampleSize).toBe(0);
  });

  it("forced windows do not dilute a real measurement — they are excluded, not averaged in as 0", () => {
    const real = Array.from({ length: 8 }, (_, i) => [dec("A", i, 0), dec("B", i, 0)]).flat();
    const forced = Array.from({ length: 8 }, (_, i) =>
      [dec("A", i + 100, 0, ["only"]), dec("B", i + 100, 0, ["only"])]).flat();
    const withForced = foldDecorrelation(loaded([...real, ...forced]));
    const withoutForced = foldDecorrelation(loaded(real));
    expect(withForced.coefficient).toBe(withoutForced.coefficient);
    expect(withForced.coefficient).toBe(0);
    expect(withForced.pairs[0]?.degenerateWindows).toBe(8);
  });

  it("disjoint menus are refused — agreeing on nothing carries no signal", () => {
    const rows = Array.from({ length: 12 }, (_, i) =>
      [dec("A", i, 0, ["p", "q"]), dec("B", i, 0, ["r", "s"])]).flat();
    const m = foldDecorrelation(loaded(rows));
    expect(m.coefficient).toBeNull();
    expect(m.pairs[0]?.degenerateWindows).toBe(12);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// §3. AGREEMENT IS ON THE OPTION LABEL, NEVER THE RAW INDEX
//     As-merged: compared `dA.chosenIndex === dB.chosenIndex` across menus it had already
//     measured to be different. Reproduced: A choosing "ship" and B choosing "delete-prod",
//     both at index 0, scored coefficient 0.000 / band "correlated" — perfect agreement.
//     Mutation: `dA.options[dA.chosenIndex] === dB.options[dB.chosenIndex]`
//               → `dA.chosenIndex === dB.chosenIndex`  ⇒ both die.
// ═══════════════════════════════════════════════════════════════════════════════

describe("§3 label comparison, not index comparison", () => {
  const SHIP = ["ship", "wait", "ask", "stop"];
  const DANGER = ["delete-prod", "wait", "ask", "stop"];

  it("same index into DIFFERENT menus is not agreement", () => {
    const rows = Array.from({ length: 12 }, (_, i) => [dec("A", i, 0, SHIP), dec("B", i, 0, DANGER)]).flat();
    const m = foldDecorrelation(loaded(rows));
    expect(m.pairs[0]?.agreementRate).toBe(0);
    expect(m.coefficient).toBeGreaterThan(0.9);
  });

  it("the SAME label at different indices IS agreement", () => {
    const A = ["ship", "wait"];
    const B = ["wait", "ship"];
    const rows = Array.from({ length: 12 }, (_, i) => [dec("A", i, 0, A), dec("B", i, 1, B)]).flat();
    const m = foldDecorrelation(loaded(rows));
    expect(m.pairs[0]?.agreementRate).toBe(1);
    expect(m.coefficient).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// §4. CHANCE AGREEMENT IS |A∩B| / (|A|·|B|), NOT 1/mean(|A|,|B|)
//     Mutation: `shared / (a.length * b.length)` → `1 / ((a.length + b.length) / 2)` ⇒ dies.
// ═══════════════════════════════════════════════════════════════════════════════

describe("§4 chanceAgreement", () => {
  it("identical menus of size m give 1/m", () => {
    expect(chanceAgreement(["a", "b", "c", "d"], ["a", "b", "c", "d"])).toBeCloseTo(0.25, 12);
    expect(chanceAgreement(["a", "b"], ["a", "b"])).toBeCloseTo(0.5, 12);
  });

  it("disjoint menus give 0 — the old 1/mean formula gave a positive number for menus that cannot agree", () => {
    expect(chanceAgreement(["a", "b"], ["c", "d"])).toBe(0);
    expect(asMergedChance(["a", "b"], ["c", "d"])).toBe(0.5); // what the as-merged formula said
  });

  it("partially overlapping, different-sized menus: |A∩B|/(|A|·|B|)", () => {
    // A = {a,b}, B = {b,c,d} → shared {b} → 1/(2*3)
    expect(chanceAgreement(["a", "b"], ["b", "c", "d"])).toBeCloseTo(1 / 6, 12);
    expect(asMergedChance(["a", "b"], ["b", "c", "d"])).toBeCloseTo(0.4, 12); // as-merged: 2.4x too high
  });

  it("is symmetric", () => {
    expect(chanceAgreement(["a", "b"], ["b", "c", "d"])).toBe(chanceAgreement(["b", "c", "d"], ["a", "b"]));
  });

  it("an empty menu has no chance agreement", () => {
    expect(chanceAgreement([], ["a"])).toBe(0);
    expect(chanceAgreement(["a"], [])).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// §5. ANTI-CORRELATION IS NOT INDEPENDENCE
//     As-merged: agents who NEVER agree gave excess < 0 → 1 - excess > 1 → clamped to 1.0,
//     byte-identical to genuine independence. Reproduced: coefficient=1, band
//     "strongly-independent". `meanCorrelationExcess` now keeps the sign.
//     Mutation: `meanCorrelationExcess: coefficient` (i.e. report the clamped value) ⇒ dies.
// ═══════════════════════════════════════════════════════════════════════════════

describe("§5 anti-correlation stays visible", () => {
  it("agents who never agree are distinguishable from agents who agree at chance", () => {
    const never = Array.from({ length: 12 }, (_, i) => [dec("A", i, 0), dec("B", i, 1)]).flat();
    const anti = foldDecorrelation(loaded(never));
    const chance = foldDecorrelation(loaded(chanceStreams(16)));

    expect(anti.pairs[0]?.agreementRate).toBe(0);
    expect(anti.meanCorrelationExcess).toBeLessThan(0);
    expect(chance.meanCorrelationExcess).toBeCloseTo(0, 10);
    // The clamped coefficient cannot tell them apart; the unclamped excess must.
    expect(anti.coefficient).toBe(1);
    expect(chance.coefficient).toBeCloseTo(1, 10);
    expect(anti.meanCorrelationExcess).not.toBeCloseTo(chance.meanCorrelationExcess ?? 0, 6);
  });

  it("the reported coefficient still honours its [0,1] contract", () => {
    for (const rows of [identicalStreams(12), chanceStreams(16),
      Array.from({ length: 12 }, (_, i) => [dec("A", i, 0), dec("B", i, 1)]).flat()]) {
      const c = foldDecorrelation(loaded(rows)).coefficient;
      expect(c).not.toBeNull();
      expect(c as number).toBeGreaterThanOrEqual(0);
      expect(c as number).toBeLessThanOrEqual(1);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// §6. UNMEASURED IS NULL — never a number that reads as a measurement
//     As-merged: absent file → `coefficient: 0, chshS: 2, band: "correlated"`. Reproduced.
//     Only the prose `summary` said INSUFFICIENT DATA, and structured consumers do not read prose.
//     Given `N_eff = N/(1+(N-1)rho)`, "no data" silently read as "the fleet is worth one agent".
//     Mutation: `coefficient: null` → `coefficient: 0` in `insufficient()`  ⇒ all four die.
// ═══════════════════════════════════════════════════════════════════════════════

describe("§6 insufficient data is never a number", () => {
  it("an ABSENT data file reports null, not 0", () => {
    withFixture("absent", null, (root) => {
      const m = measureDecorrelation(root);
      expect(m.coefficient).toBeNull();
      expect(m.meanCorrelationExcess).toBeNull();
      expect(m.band).toBe("insufficient-data");
      expect(m.load.unreadable).toBe(true);
      expect(m.summary).toContain("INSUFFICIENT DATA");
    });
  });

  it("fewer than MIN_DECISIONS reports null", () => {
    const m = foldDecorrelation(loaded(identicalStreams(2)));
    expect(m.load.decisions).toHaveLength(4);
    expect(4).toBeLessThan(MIN_DECISIONS);
    expect(m.coefficient).toBeNull();
    expect(m.band).toBe("insufficient-data");
  });

  it("enough decisions but no shared window reports null, not 0", () => {
    // A decides on even ticks, B on odd ticks — never in the same window.
    const rows = [
      ...Array.from({ length: 6 }, (_, i) => dec("A", i * 2, 0)),
      ...Array.from({ length: 6 }, (_, i) => dec("B", i * 2 + 1, 0)),
    ];
    const m = foldDecorrelation(loaded(rows));
    expect(m.coefficient).toBeNull();
    expect(m.band).toBe("insufficient-data");
    expect(m.pairs).toHaveLength(1);
    expect(m.pairs[0]?.sampleSize).toBe(0);
  });

  it("a single agent produces no pairs and therefore no coefficient", () => {
    const m = foldDecorrelation(loaded(Array.from({ length: 8 }, (_, i) => dec("A", i, i % 4))));
    expect(m.pairs).toHaveLength(0);
    expect(m.coefficient).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// §7. ONE BAD LINE DROPS ONE LINE, NOT THE FILE
//     As-merged: read+map inside one `try`; one unparseable line threw out of `.map` and the
//     catch returned []. Reproduced: 24 valid records + 1 bad line → 0 decisions, "INSUFFICIENT
//     DATA ... have 0". A corrupt file was indistinguishable from an absent one.
//     Mutation: wrap the loop body's parse in an outer try returning [] ⇒ dies.
// ═══════════════════════════════════════════════════════════════════════════════

describe("§7 loader is line-local and reports what it dropped", () => {
  it("survives a malformed line in the middle and keeps every valid record", () => {
    const good = identicalStreams(12).map((d) => JSON.stringify(d));
    const withBad = [...good.slice(0, 5), "{not json", ...good.slice(5)];
    withFixture("badline", withBad, (root) => {
      const load = loadTickDecisions(join(root, "data", "tick-reasoning.jsonl"));
      expect(load.decisions).toHaveLength(24);
      expect(load.malformedLines).toBe(1);
      expect(load.unreadable).toBe(false);
      expect(foldDecorrelation(load).coefficient).toBe(0);
    });
  });

  it("an unparseable timestamp is malformed, never window NaN", () => {
    const rows = [
      { agent: "A", at: "not-a-date", chosenIndex: 0, options: MENU4, fallback: false },
      { agent: "B", at: "also-bad", chosenIndex: 0, options: MENU4, fallback: false },
      ...identicalStreams(6),
    ];
    withFixture("nanstamp", rows, (root) => {
      const load = loadTickDecisions(join(root, "data", "tick-reasoning.jsonl"));
      expect(load.malformedLines).toBe(2);
      expect(load.decisions).toHaveLength(12);
      expect(load.decisions.every((d) => Number.isFinite(new Date(d.at).getTime()))).toBe(true);
    });
  });

  it("an out-of-range chosenIndex is malformed — a choice that names no option is not a choice", () => {
    const rows = [
      { agent: "A", at: at(0), chosenIndex: 9, options: MENU4, fallback: false },
      { agent: "B", at: at(0), chosenIndex: -1, options: MENU4, fallback: false },
      ...identicalStreams(6),
    ];
    withFixture("oob", rows, (root) => {
      const load = loadTickDecisions(join(root, "data", "tick-reasoning.jsonl"));
      expect(load.malformedLines).toBe(2);
      expect(load.decisions).toHaveLength(12);
    });
  });

  it("fallback rows are excluded and COUNTED, not silently vanished", () => {
    const rows = [
      ...identicalStreams(6),
      { agent: "A", at: at(50), chosenIndex: 0, options: MENU4, fallback: true },
      { agent: "B", at: at(50), chosenIndex: 0, options: MENU4, fallback: true },
    ];
    withFixture("fallback", rows, (root) => {
      const load = loadTickDecisions(join(root, "data", "tick-reasoning.jsonl"));
      expect(load.fallbackLines).toBe(2);
      expect(load.decisions).toHaveLength(12);
      expect(load.malformedLines).toBe(0);
    });
  });

  it("a JSON array line is malformed, not an object", () => {
    withFixture("arrayline", ["[1,2,3]", ...identicalStreams(6).map((d) => JSON.stringify(d))], (root) => {
      const load = loadTickDecisions(join(root, "data", "tick-reasoning.jsonl"));
      expect(load.malformedLines).toBe(1);
      expect(load.decisions).toHaveLength(12);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// §8. AMBIGUOUS WINDOWS ARE REFUSED, NOT SILENTLY TRUNCATED TO THE FIRST DECISION
//     As-merged: `decisions.find(d => d.agent === agentA)` took the first and dropped the rest.
//     Mutation: `forA.length > 1 || forB.length > 1` → `false` ⇒ dies.
// ═══════════════════════════════════════════════════════════════════════════════

describe("§8 ambiguous windows", () => {
  it("an agent deciding twice in one window makes that window uncomparable", () => {
    const groups = groupByTickWindow([
      dec("A", 0, 0), dec("A", 0, 1), dec("B", 0, 0),
      dec("A", 1, 2), dec("B", 1, 2),
    ]);
    const p = computePairwise("A", "B", groups);
    expect(p.ambiguousWindows).toBe(1);
    expect(p.sampleSize).toBe(1);
    expect(p.agreementRate).toBe(1);
  });

  it("the refusal is soundness-biased: dropping the second decision would have flipped the reading", () => {
    // A's FIRST decision in each window agrees with B; A's SECOND never does.
    // Taking-the-first reports perfect agreement (coefficient 0) off half the data.
    const rows = Array.from({ length: 12 }, (_, i) => [
      dec("A", i, 0), dec("A", i, 1), dec("B", i, 0),
    ]).flat();
    const m = foldDecorrelation(loaded(rows));
    expect(m.pairs[0]?.ambiguousWindows).toBe(12);
    expect(m.coefficient).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// §9. NO CHSH `S` AND NO TSIRELSON COMPARISON ANYWHERE ON THE SURFACE
//     This is the finding that got the module reviewed. `S = 2(1+coefficient)` is affine and
//     invertible, so it carried zero information the coefficient does not — its only effect was
//     to place 2√2 at c ≈ 0.414 on a scale the mapping itself chose. And it was self-refuting:
//     the header called S > 2√2 "impossible if measured honestly", while its own best case
//     (c = 1) produced S = 4 > 2.828. Reproduced against the as-merged module.
//     Mutation: re-add `chshS` to the returned object ⇒ dies.
// ═══════════════════════════════════════════════════════════════════════════════

describe("§9 the CHSH framing is gone and stays gone", () => {
  it("no measurement carries a chshS field", () => {
    for (const m of [
      foldDecorrelation(loaded(identicalStreams(12))),
      foldDecorrelation(loaded(chanceStreams(16))),
      foldDecorrelation(loaded([])),
    ]) {
      expect(Object.keys(m)).not.toContain("chshS");
      expect(m.summary).not.toContain("Tsirelson");
      expect(m.summary).not.toContain("S=");
      expect(formatDecorrelation(m)).not.toContain("2.828");
    }
  });

  it("the coefficient never leaves [0,1], so no output can be read against a bound of 2 or 2√2", () => {
    const m = foldDecorrelation(loaded(chanceStreams(16)));
    expect(m.coefficient as number).toBeLessThanOrEqual(1);
    // The as-merged mapping S = 2(1+c) put the ideal reading at 4, above Tsirelson's 2.828 —
    // i.e. the module's own documented "metering error" band. Pinned so it cannot come back.
    expect(2 * (1 + (m.coefficient as number))).toBeGreaterThan(2 * Math.SQRT2);
  });

  it("every band name states the FACT about agreement, never an intent", () => {
    const bands = ["insufficient-data", "agreement-far-above-chance", "agreement-above-chance",
      "agreement-near-chance", "agreement-at-or-below-chance"];
    for (const b of bands) {
      expect(b).not.toMatch(/redundan|useless|sybil|fraud|independent$|correlated$|suspicious/);
    }
    const seen = new Set<string>();
    for (const rows of [identicalStreams(12), chanceStreams(16),
      Array.from({ length: 24 }, (_, i) => [dec("A", i, 0), dec("B", i, i % 2)]).flat()]) {
      seen.add(foldDecorrelation(loaded(rows)).band);
    }
    for (const b of seen) expect(bands).toContain(b);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// §10. EVERY BAND IS REACHABLE — a branch that cannot fire is not a check
//      As-merged: `else band = "suspicious"` sat behind `coefficient <= 1.0` after a [0,1]
//      clamp, so the branch the header called the metering-error flag could never execute.
//      Its own comment admitted "should not happen with the clamp". Vacuity class.
//      Mutation: add an unreachable 6th band ⇒ dies.
// ═══════════════════════════════════════════════════════════════════════════════

describe("§10 band reachability", () => {
  it("EVERY band on the exported roster is reachable by sweeping the coefficient domain", () => {
    // The roster is derived from the source, not retyped here: a band added to the union without
    // a matching reachable branch shows up as an unreached member and this test goes red.
    const reached = new Set<string>(["insufficient-data"]);
    for (let i = 0; i <= 2000; i++) reached.add(bandOf(i / 2000)); // integer stepping: float
    //  accumulation never landed exactly on 1.0 and the c=1 band read as unreachable. Measured.

    const unreachable = ALL_BANDS.filter((b) => !reached.has(b));
    expect(unreachable).toEqual([]);
    // and nothing is produced that is not on the roster
    expect([...reached].filter((b) => !ALL_BANDS.includes(b as never))).toEqual([]);
  });

  it("every roster band is reachable end-to-end, not just from bandOf", () => {
    const produce = (agreeCount: number): string => {
      const n = 100;
      const rows = Array.from({ length: n }, (_, i) =>
        [dec("A", i, 0), dec("B", i, i < agreeCount ? 0 : 1 + (i % 3))]).flat();
      return foldDecorrelation(loaded(rows)).band;
    };
    const reached = new Set<string>([
      foldDecorrelation(loaded([])).band,
      produce(100), produce(60), produce(30), produce(0),
    ]);
    expect([...ALL_BANDS].filter((b) => !reached.has(b))).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// §11. DETERMINISM + ORDINAL COLLATION — the fold is DST-replayable
//      #14868 fixed a `localeCompare` here that broke the collation ratchet repo-wide. Nothing
//      pinned it, so nothing would have caught it coming back.
//      Mutation: `stringCompare(a.at, b.at)` → `a.at.localeCompare(b.at)` ⇒ the ordinal test dies.
// ═══════════════════════════════════════════════════════════════════════════════

describe("§11 determinism and collation", () => {
  it("the measurement is independent of input order", () => {
    const rows = chanceStreams(16);
    const forward = foldDecorrelation(loaded(rows));
    const reversed = foldDecorrelation(loaded([...rows].reverse()));
    const shuffled = foldDecorrelation(loaded([...rows].sort((a, b) => stableHash(a) - stableHash(b))));
    expect(reversed.summary).toBe(forward.summary);
    expect(shuffled.summary).toBe(forward.summary);
    expect(reversed.coefficient).toBe(forward.coefficient);
  });

  it("within-window order is ORDINAL code-point order, not a locale order", () => {
    // `stringCompare` is code-point order; `localeCompare` on these differs under ICU.
    // Two agents named so that ordinal and linguistic order disagree ('B' < 'a' ordinal,
    // 'a' < 'B' linguistically) must not change the pair enumeration.
    const rows = Array.from({ length: 8 }, (_, i) => [dec("B", i, 0), dec("a", i, 0)]).flat();
    const m = foldDecorrelation(loaded(rows));
    expect(m.pairs).toHaveLength(1);
    expect(m.pairs[0]?.agentA).toBe("B"); // ordinal: 'B'(0x42) < 'a'(0x61)
    expect(m.pairs[0]?.agentB).toBe("a");
    expect("B".localeCompare("a")).toBeGreaterThan(0); // control: locale order is the opposite
  });

  it("within-BUCKET decision order is ordinal by `at`, on timestamps where locale order DIVERGES", () => {
    // Measured, not assumed: both strings parse to the SAME instant, and ordinal vs locale
    // disagree on both pairs. `-`(0x2D) > `+`(0x2B) ordinally; ICU puts `-` first.
    // `T`(0x54) < `t`(0x74) ordinally; ICU puts lowercase first.
    const MINUS = "2026-08-24T00:00:00-00:00";
    const PLUS = "2026-08-24T00:00:00+00:00";
    expect(new Date(MINUS).getTime()).toBe(new Date(PLUS).getTime());
    expect(Math.sign(stringCompare(MINUS, PLUS))).toBe(1);
    expect(Math.sign(MINUS.localeCompare(PLUS))).toBe(-1); // control: the two orders disagree

    const mk = (agent: string, ts: string): TickDecision =>
      ({ agent, at: ts, chosenIndex: 0, options: [...MENU4], fallback: false });
    const bucket = [...groupByTickWindow([mk("A", MINUS), mk("B", PLUS)]).values()][0];
    expect(bucket).toHaveLength(2);
    expect(bucket?.[0]?.at).toBe(PLUS);   // ordinal: `+` sorts before `-`
    expect(bucket?.[1]?.at).toBe(MINUS);

    const UPPER = "2026-08-24T00:00:00.000Z";
    const LOWER = "2026-08-24t00:00:00.000z";
    expect(new Date(UPPER).getTime()).toBe(new Date(LOWER).getTime());
    expect(Math.sign(stringCompare(UPPER, LOWER))).toBe(-1);
    expect(Math.sign(UPPER.localeCompare(LOWER))).toBe(1); // control: disagree again
    const bucket2 = [...groupByTickWindow([mk("A", LOWER), mk("B", UPPER)]).values()][0];
    expect(bucket2?.[0]?.at).toBe(UPPER); // ordinal: `T`(0x54) < `t`(0x74)
  });

  it("pairwise is symmetric in its two agents", () => {
    const groups = groupByTickWindow(chanceStreams(16));
    const ab = computePairwise("A", "B", groups);
    const ba = computePairwise("B", "A", groups);
    expect(ba.agreementRate).toBe(ab.agreementRate);
    expect(ba.expectedByChance).toBe(ab.expectedByChance);
    expect(ba.correlationExcess).toBe(ab.correlationExcess);
  });
});

function stableHash(d: TickDecision): number {
  let h = 0;
  for (const ch of `${d.agent}${d.at}${d.chosenIndex}`) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return h;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §12. WINDOWING IS BUCKETING AND THE DOCSTRING NOW SAYS SO
//      As-merged the docstring claimed "two decisions are concurrent if they're within windowMs
//      of each other". False: fixed-offset bucketing is not a proximity relation. Pinned as a
//      KNOWN LIMIT so the honest description cannot quietly drift back to the false one.
//      Mutation: none needed — this test asserts the limit, and changing the grouping to a real
//      proximity relation must make it fail, which is the point.
// ═══════════════════════════════════════════════════════════════════════════════

describe("§12 windowing is fixed-offset bucketing (a known limit, pinned)", () => {
  // Literal, NOT `DEFAULT_WINDOW_MS`. A test that imports the constant it is pinning follows the
  // mutation and can never see it change — that is the vacuity class, and this suite's own first
  // mutation run caught exactly that here.
  const WINDOW = 120_000;

  it("the window is 120s and the constant says so", () => {
    expect(DEFAULT_WINDOW_MS).toBe(WINDOW);
  });

  it("2 ms apart across a bucket edge are NOT compared", () => {
    const edge = Math.ceil(EPOCH / WINDOW) * WINDOW;
    const groups = groupByTickWindow([
      { agent: "A", at: new Date(edge - 1).toISOString(), chosenIndex: 0, options: [...MENU4], fallback: false },
      { agent: "B", at: new Date(edge + 1).toISOString(), chosenIndex: 0, options: [...MENU4], fallback: false },
    ]);
    expect(groups.size).toBe(2);
    expect(computePairwise("A", "B", groups).sampleSize).toBe(0);
  });

  it("119 s apart inside one bucket ARE compared", () => {
    const base = Math.floor(EPOCH / WINDOW) * WINDOW;
    const groups = groupByTickWindow([
      { agent: "A", at: new Date(base + 100).toISOString(), chosenIndex: 0, options: [...MENU4], fallback: false },
      { agent: "B", at: new Date(base + 119_000).toISOString(), chosenIndex: 0, options: [...MENU4], fallback: false },
    ]);
    expect(groups.size).toBe(1);
    expect(computePairwise("A", "B", groups).sampleSize).toBe(1);
  });
});
