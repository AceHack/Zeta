/**
 * drift-rate.test.ts — the falsifiers.
 *
 * `.claude/rules/toy-is-free-metered-must-be-earned.md`: this module is `unmetered`
 * without tests that FAIL when it is wrong. Every case below was reproduced against
 * the previous implementation first, and the header of each block records what that
 * implementation actually printed — so these are regressions with a measurement behind
 * them, not hypotheticals.
 *
 * The three load-bearing properties, each with a test that dies if it is removed:
 *   1. cancelled never counts toward green
 *   2. insufficient-data is the DEFAULT and no trend is named without earning it
 *   3. a lane that stops reporting keeps its slot in the denominator
 */

import { describe, expect, it } from "bun:test";

import {
  DARK_AFTER_MS,
  MIN_SAMPLES_FOR_TREND,
  compareChecks,
  computeDrift,
  computeWindow,
  formatRate,
  loadRosterCheckIds,
  normalizeRun,
  trendFrom,
  wilson,
  type CIRun,
} from "./drift-rate.ts";

const NOW = Date.parse("2026-08-22T20:00:00.000Z");
const HOUR = 3_600_000;
const ago = (hours: number): string => new Date(NOW - hours * HOUR).toISOString();
const run = (checkId: string, outcome: CIRun["outcome"], hoursAgo: number): CIRun =>
  ({ checkId, outcome, at: ago(hoursAgo) });
const many = (n: number, f: (i: number) => CIRun): CIRun[] => Array.from({ length: n }, (_, i) => f(i));

// ═══════════════════════════════════════════════════════════════════════════════
// 1. CANCELLED IS ITS OWN STATE AND NEVER COUNTS TOWARD GREEN
// ═══════════════════════════════════════════════════════════════════════════════

describe("cancelled never counts toward green", () => {
  /**
   * THE MEASURED CATASTROPHE. Old implementation, probed 2026-08-22:
   *
   *   B dark(33c+2 old success):
   *     [{"workflow":"dark-lane","total":35,"green":2,"red":0,"greenRatio":1,...}]
   *
   * `greenRatio: 1` — 100% green — for a lane that is 94% cancelled. Cancelled was
   * dropped from the denominator, so the two stale successes were the entire sample.
   * This is the exact shape the parent brief called catastrophic, and it was live.
   */
  it("a 33-cancelled / 2-green lane is NOT green", () => {
    const runs = [
      ...many(33, (i) => run("dark-lane", "cancelled", i + 1)),
      ...many(2, (i) => run("dark-lane", "green", i + 1)),
    ];
    const snap = computeDrift(runs, { nowMs: NOW, roster: ["dark-lane"] });
    const lane = snap.byCheck.find((c) => c.checkId === "dark-lane")!;

    expect(lane.cancelled).toBe(33);
    expect(lane.green_of_all.n).toBe(35); // cancelled IS in the denominator
    expect(lane.green_of_all.point).toBeCloseTo(2 / 35, 10);
    expect(lane.green_of_all.point!).toBeLessThan(0.1);
    // And the interval's upper bound cannot reach anywhere near green either.
    expect(lane.green_of_all.hi).toBeLessThan(0.25);
  });

  it("cancelled runs are counted, not silently discarded", () => {
    const runs = [
      run("c", "cancelled", 1), run("c", "cancelled", 2), run("c", "green", 3),
    ];
    const w = computeWindow(runs, "7d", 7 * 24 * HOUR, NOW);
    expect(w.total).toBe(3);
    expect(w.cancelled).toBe(2);
    expect(w.green_of_all.n).toBe(3);
    expect(w.green_of_concluded.n).toBe(1); // the other view, reported beside it
  });

  /**
   * `tlaps-proof`'s live shape, measured 2026-08-22: 33 cancelled + 7 failure in its
   * last 40 runs, last success 2026-07-01. Both readings must be bad, and the lane must
   * be flagged DARK by TIME rather than by cancelled count.
   */
  it("tlaps-proof's shape: 33 cancelled + 7 red, seven weeks since a conclusion", () => {
    const weeks7 = 7 * 24 * 7;
    const runs = [
      ...many(33, (i) => run("tlaps-proof", "cancelled", i + 1)),
      ...many(7, (i) => run("tlaps-proof", "red", weeks7 + i)),
    ];
    const snap = computeDrift(runs, { nowMs: NOW, roster: ["tlaps-proof"], reportWindowMs: 365 * 24 * HOUR });
    const lane = snap.byCheck.find((c) => c.checkId === "tlaps-proof")!;
    expect(lane.green_of_all.point).toBe(0);
    expect(lane.green_of_concluded.point).toBe(0);
    expect(lane.sinceConcludedMs!).toBeGreaterThan(DARK_AFTER_MS);
    expect(lane.dark).toBe(true);
    expect(snap.darkChecks).toContain("tlaps-proof");
  });

  /**
   * The discriminator is TIME, NOT COUNT — the same call `drift-dashboard/fold.ts`
   * makes. `gate` is cancelled by its own concurrency group on ~88% of pushes and is
   * perfectly alive. If darkness keyed on the cancelled fraction, this lane would be
   * flagged, the alarm would cry wolf, and a guard that cries wolf gets muted.
   */
  it("a heavily-cancelled lane that still concludes hourly is NOT dark", () => {
    const runs = [
      ...many(88, (i) => run("gate", "cancelled", (i + 1) * 0.1)),
      ...many(12, (i) => run("gate", "green", (i + 1) * 0.5)),
    ];
    const snap = computeDrift(runs, { nowMs: NOW, roster: ["gate"] });
    const gate = snap.byCheck.find((c) => c.checkId === "gate")!;
    expect(gate.cancelled).toBe(88);
    expect(gate.dark).toBe(false);
    expect(snap.darkChecks).not.toContain("gate");
  });

  it("a lane with runs but NO conclusion ever is dark, not 0% green with no comment", () => {
    const runs = many(40, (i) => run("all-cancelled", "cancelled", i + 1));
    const snap = computeDrift(runs, { nowMs: NOW, roster: ["all-cancelled"] });
    const lane = snap.byCheck.find((c) => c.checkId === "all-cancelled")!;
    expect(lane.sinceConcludedMs).toBeNull();
    expect(lane.dark).toBe(true);
    // The old code reported greenRatio 0 AND redRatio 0 simultaneously — incoherent.
    // Here the concluded view refuses to answer at all.
    expect(lane.green_of_concluded.point).toBeNull();
    expect(lane.green_of_all.point).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. INSUFFICIENT DATA IS THE DEFAULT
// ═══════════════════════════════════════════════════════════════════════════════

describe("insufficient-data never reports a trend", () => {
  /**
   * Old implementation, probed 2026-08-22:
   *   E one-green summary: "7d: 100% green (1/1), 24h: 100% green, trend: stable"
   * A single sample produced a confident headline and a named trend.
   */
  it("one green run does not produce a trend", () => {
    const snap = computeDrift([run("x", "green", 1)], { nowMs: NOW, roster: ["x"] });
    expect(snap.trending).toBe("insufficient-data");
    expect(snap.summary).toContain("INSUFFICIENT DATA");
    expect(snap.summary).not.toContain("trend: stable");
  });

  it("the empty log is insufficient-data, and says why", () => {
    const snap = computeDrift([], { nowMs: NOW, roster: [] });
    expect(snap.trending).toBe("insufficient-data");
    expect(snap.insufficientReason).toContain("no runs recorded");
  });

  /** "40% green over 5" must be structurally distinguishable from "40% over 500". */
  it("40% over 5 samples and 40% over 500 have the same point and different intervals", () => {
    const small = wilson(2, 5);
    const large = wilson(200, 500);
    expect(small.point).toBeCloseTo(0.4, 10);
    expect(large.point).toBeCloseTo(0.4, 10);
    expect(small.hi - small.lo).toBeGreaterThan(large.hi - large.lo);
    expect(formatRate(small)).toContain("n=5");
    expect(formatRate(large)).toContain("n=500");
  });

  /**
   * The Wald interval degenerates to zero width at p̂ = 1 and would report a CERTAIN
   * 100% off one green run. Wilson is chosen precisely because it does not. This test
   * is the anchor's entailment check, not a citation.
   */
  it("Wilson does not claim certainty at p-hat = 1 with n = 1", () => {
    const one = wilson(1, 1);
    expect(one.point).toBe(1);
    expect(one.lo).toBeLessThan(0.3); // Wald would say 1.0
    expect(one.hi).toBe(1);
  });

  it("n = 0 yields a null point and total-ignorance bounds — never 0%", () => {
    const none = wilson(0, 0);
    expect(none.point).toBeNull();
    expect(none.lo).toBe(0);
    expect(none.hi).toBe(1);
    expect(formatRate(none)).toBe("no data");
  });

  it("a trend needs MIN_SAMPLES_FOR_TREND in BOTH halves", () => {
    const plenty = wilson(9, 10);
    const scant = wilson(0, MIN_SAMPLES_FOR_TREND - 1);
    expect(trendFrom(plenty, scant)).toBe("insufficient-data");
    expect(trendFrom(scant, plenty)).toBe("insufficient-data");
  });

  it("overlapping intervals are 'stable', never 'improving'", () => {
    // 8/10 vs 9/10 — a visible point difference that the sample cannot support.
    const earlier = wilson(8, 10);
    const later = wilson(9, 10);
    expect(later.point!).toBeGreaterThan(earlier.point!);
    expect(trendFrom(earlier, later)).toBe("stable");
  });

  it("disjoint intervals with enough samples DO name a trend — the refusal is not blanket", () => {
    const earlier = wilson(10, 100);  // 10%
    const later = wilson(90, 100);    // 90%
    expect(trendFrom(earlier, later)).toBe("improving");
    expect(trendFrom(later, earlier)).toBe("worsening");
  });

  /** End-to-end: a genuinely improving week, large sample, is still reportable. */
  it("a real improvement over a large sample is reported, not suppressed", () => {
    const week = 7 * 24;
    const runs = [
      ...many(60, (i) => run("k", "red", week * 0.75 + (i % 10))),
      ...many(60, (i) => run("k", "green", (i % 10) + 1)),
    ];
    const snap = computeDrift(runs, { nowMs: NOW, roster: ["k"] });
    expect(snap.trending).toBe("improving");
    expect(snap.insufficientReason).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. A LANE THAT STOPS REPORTING DOES NOT VANISH FROM THE DENOMINATOR
// ═══════════════════════════════════════════════════════════════════════════════

describe("the roster is the denominator", () => {
  /**
   * Old implementation, probed 2026-08-22, with one healthy lane and one that stopped
   * ten days ago:
   *   F 24h window: {"total":20,"green":20,"greenRatio":1}
   *   F summary: "7d: 100% green (20/20), 24h: 100% green, trend: stable"
   * Silence read as health: the stopped lane simply left the window.
   */
  it("a lane that went silent keeps its slot and is named", () => {
    const runs = [
      ...many(20, (i) => run("stopped", "red", 24 * 10 + i)),
      ...many(20, (i) => run("healthy", "green", i + 1)),
    ];
    const snap = computeDrift(runs, { nowMs: NOW, roster: ["stopped", "healthy"] });
    const stopped = snap.byCheck.find((c) => c.checkId === "stopped");
    expect(stopped).toBeDefined();
    expect(stopped!.status).toBe("went-silent");
    expect(stopped!.samples).toBe(0);
    expect(snap.silent).toContain("stopped");
    expect(snap.summary).toContain("silent");
  });

  it("a rostered check that NEVER reported is 'no-data', a different fact from 'went-silent'", () => {
    const snap = computeDrift([run("a", "green", 1)], { nowMs: NOW, roster: ["a", "never-ran"] });
    const never = snap.byCheck.find((c) => c.checkId === "never-ran")!;
    expect(never.status).toBe("no-data");
    expect(never.lastRunAt).toBeNull();
    expect(never.green_of_all.point).toBeNull(); // not 0% — we know nothing
    expect(snap.silent).toContain("never-ran");
  });

  /**
   * THE FROZEN-ROSTER FAILURE, in the other direction. Two workflows were invisible for
   * eight consecutive passes of a scanner because they were not in its list. A check
   * that appears in the log and NOT in the roster must be loud, or the two features
   * accumulate separate vocabularies and tell two disagreeing health stories.
   */
  it("a recorded check the roster has never heard of is flagged 'unrostered'", () => {
    const snap = computeDrift([run("heartbeat-otto", "green", 1)], { nowMs: NOW, roster: ["agent-heartbeat"] });
    const seen = snap.byCheck.find((c) => c.checkId === "heartbeat-otto")!;
    expect(seen.status).toBe("unrostered");
    expect(snap.unrostered).toContain("heartbeat-otto");
    expect(snap.summary).toContain("unrostered");
  });

  it("the shared vocabulary holds: recording under a rostered CheckId is NOT unrostered", () => {
    const snap = computeDrift(
      [{ checkId: "agent-heartbeat", outcome: "green", at: ago(1), lane: "otto" }],
      { nowMs: NOW, roster: ["agent-heartbeat"] },
    );
    const c = snap.byCheck.find((x) => x.checkId === "agent-heartbeat")!;
    expect(c.status).toBe("reporting");
    expect(snap.unrostered).toHaveLength(0);
  });

  it("an empty roster degrades loudly, not silently", () => {
    const snap = computeDrift([run("x", "green", 1)], { nowMs: NOW, roster: [] });
    expect(snap.unrostered).toContain("x");
  });

  it("unknown outranks red in the worst-first ordering", () => {
    const runs = [
      ...many(10, (i) => run("failing", "red", i + 1)),
      ...many(10, (i) => run("fine", "green", i + 1)),
    ];
    const snap = computeDrift(runs, { nowMs: NOW, roster: ["failing", "fine", "unseen"] });
    const ids = snap.byCheck.map((c) => c.checkId);
    expect(ids.indexOf("unseen")).toBeLessThan(ids.indexOf("failing"));
    expect(ids.indexOf("failing")).toBeLessThan(ids.indexOf("fine"));
  });

  /**
   * A SURVIVING MUTANT, caught and killed 2026-08-22. The ordering test above used a
   * `no-data` check, so flipping the DARK band from first to last changed nothing any
   * test could see. A dark lane — a gate that has been switched off for seven weeks
   * while still producing runs — is the single worst thing this module can find, and
   * "worst-first" has to mean it or the band order is decoration.
   */
  it("a DARK lane sorts ahead of a never-observed one and of a failing one", () => {
    const weeks7 = 7 * 24 * 7;
    const runs = [
      ...many(20, (i) => run("dark", "cancelled", i + 1)),
      ...many(3, (i) => run("dark", "red", weeks7 + i)),
      ...many(10, (i) => run("failing", "red", i + 1)),
      ...many(10, (i) => run("fine", "green", i + 1)),
    ];
    const snap = computeDrift(runs, { nowMs: NOW, roster: ["dark", "failing", "fine", "unseen"] });
    const ids = snap.byCheck.map((c) => c.checkId);
    expect(snap.byCheck.find((c) => c.checkId === "dark")!.dark).toBe(true);
    expect(ids.indexOf("dark")).toBe(0);
    expect(ids.indexOf("dark")).toBeLessThan(ids.indexOf("unseen"));
    expect(ids.indexOf("dark")).toBeLessThan(ids.indexOf("failing"));
  });

  it("ties break ordinally, so the order is the data and not the collation", () => {
    const mk = (checkId: string) => ({
      checkId, status: "reporting" as const, samples: 1, green: 1, red: 0, cancelled: 0,
      green_of_all: wilson(1, 1), green_of_concluded: wilson(1, 1),
      lastRunAt: null, lastConcludedAt: null, sinceConcludedMs: null, dark: false,
      trend: "insufficient-data" as const,
    });
    expect(compareChecks(mk("Z"), mk("a"))).toBeLessThan(0); // 'Z' < 'a' ordinally
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PARSING — what a log may say, and what it may not
// ═══════════════════════════════════════════════════════════════════════════════

describe("normalizeRun", () => {
  it("accepts the legacy {workflow, conclusion} shape", () => {
    const r = normalizeRun({ workflow: "gate", conclusion: "success", at: ago(1) });
    expect(r).not.toBeNull();
    expect(r!.checkId).toBe("gate");
    expect(r!.outcome).toBe("green");
  });

  it("accepts the current {checkId, outcome, lane} shape", () => {
    const r = normalizeRun({ checkId: "agent-heartbeat", outcome: "green", at: ago(1), lane: "otto" });
    expect(r!.lane).toBe("otto");
  });

  it("DROPS an unrecognised conclusion rather than guessing one", () => {
    expect(normalizeRun({ checkId: "x", conclusion: "banana", at: ago(1) })).toBeNull();
  });

  it("drops a line with an unparseable timestamp", () => {
    expect(normalizeRun({ checkId: "x", outcome: "green", at: "not-a-date" })).toBeNull();
  });

  it("drops a line with an empty checkId", () => {
    expect(normalizeRun({ checkId: "", outcome: "green", at: ago(1) })).toBeNull();
  });

  it("maps timed_out to red and skipped to cancelled — never to green", () => {
    expect(normalizeRun({ checkId: "x", conclusion: "timed_out", at: ago(1) })!.outcome).toBe("red");
    expect(normalizeRun({ checkId: "x", conclusion: "skipped", at: ago(1) })!.outcome).toBe("cancelled");
  });
});

describe("the normalization boundary — why consumers must not cast", () => {
  /**
   * MEASURED 2026-08-22, and the reason `society-status.ts` was changed in this PR.
   *
   * That module read the log with its own `loadJSONL<{workflow, conclusion, at}>` and
   * passed the result straight in as `computeDrift(ciRuns as any)`. `computeDrift` keys
   * on `checkId`/`outcome`; a raw legacy line carries neither, so `as any` let ten
   * SUCCESSES through as `{total:10, green:0, red:0, cancelled:10}` — a completely
   * miscounted fold rendering a plausible-looking summary. Probed output, verbatim:
   *
   *   UNCAST (the old `as any` path): {"total":10,"green":0,"red":0,"cancelled":10}
   *
   * The legacy shape is SUPPORTED — through `normalizeRun` / `loadCIRuns` — and it is
   * only supported there. This test pins both halves of that sentence.
   */
  it("raw legacy objects are NOT valid input to the fold — they must be normalized first", () => {
    const raw = Array.from({ length: 10 }, (_, i) => ({
      workflow: "gate", conclusion: "success", at: ago(i + 1),
    })) as unknown as CIRun[];
    const w = computeWindow(raw, "7d", 7 * 24 * HOUR, NOW);
    expect(w.green).toBe(0);
    expect(w.cancelled).toBe(10); // the miscount, pinned so nobody re-introduces the cast
  });

  it("...and the SAME objects through normalizeRun fold correctly", () => {
    const normalized = Array.from({ length: 10 }, (_, i) =>
      normalizeRun({ workflow: "gate", conclusion: "success", at: ago(i + 1) })!,
    );
    const w = computeWindow(normalized, "7d", 7 * 24 * HOUR, NOW);
    expect(w.green).toBe(10);
    expect(w.cancelled).toBe(0);
  });
});

describe("loadRosterCheckIds", () => {
  it("a missing roster degrades to [] and does not throw", () => {
    expect(loadRosterCheckIds("/nonexistent/roster.json")).toEqual([]);
  });

  it("reads the real roster on main and finds the checks the dashboard declares", () => {
    // Not a fixture: the actual shared artifact. If the dashboard changes its schema,
    // this fails, which is the point — the two features share one vocabulary or neither
    // of them is trustworthy.
    const ids = loadRosterCheckIds("db/drift-dashboard/roster.json");
    expect(ids.length).toBeGreaterThan(0);
    expect(ids).toContain("agent-heartbeat");
  });
});
