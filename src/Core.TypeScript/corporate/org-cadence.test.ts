/**
 * org-cadence.test.ts — run the same week twice, once with the clock stopped.
 *
 * A cadence is trivially easy to fake: call the drive seven times instead of once and report seven
 * periods. That version passes every test you would think to write about it, because it does
 * everything a real cadence does except the one thing it is for. So the load-bearing test here is a
 * COMPARISON — the same organization, the same budget, the same hats, differing only in whether
 * `nowMs` moves — and the claim is that the two histories differ.
 *
 * Measured:
 *
 *   stopped clock, no review policy  149 changes: 149,0,0,0,0,0,0
 *   stopped clock, 1-day review      149 changes: 149,0,0,0,0,0,0
 *   moving clock,  1-day review      245 changes: 149,16,16,16,16,16,16
 *
 * The middle row is the one that matters. A review policy with a stopped clock changes NOTHING —
 * which is how we know the third row is the clock and not the policy.
 */

import { describe, expect, test } from "bun:test";
import { DAY_MS, runCadence, WEEK_MS, type Cadence } from "./org-cadence";
import { buildOrgChart } from "./org-chart";
import { SEED_HATS } from "./org-seed";
import { EMPTY_BOARD } from "./discussion-anchor";
import { EMPTY_CALENDAR } from "./work-schedule";
import { WorkType } from "./goal-cascade";
import { directionOpenings, GenerativeKind } from "./generative-work";
import type { DriveDeps, DriveState } from "./org-drive";

const chart = (() => {
  const r = buildOrgChart(SEED_HATS);
  if (!r.ok) throw new Error(r.reason);
  return r.chart;
})();

const HATS = chart.hats.map((h) => h.id);
const START = 1_000_000;
const WEEK: Cadence = { periodMs: DAY_MS, periods: 7, maxRoundsPerPeriod: 60 };

function fresh(): DriveState {
  return {
    view: { chart, board: EMPTY_BOARD, signals: [], cascade: [], artifacts: new Map(), blockers: new Map() },
    cascade: { nodes: [] },
    calendar: EMPTY_CALENDAR,
  };
}

function deps(directionReviewMs?: number): DriveDeps {
  let n = 0;
  return {
    chart,
    nowMs: START,
    createId: (p) => `${p}-${String((n += 1))}`,
    resourceAuthorityHatId: "rmo_office",
    ...(directionReviewMs === undefined ? {} : { directionReviewMs }),
  };
}

describe("THE FALSIFIER: does the clock do anything?", () => {
  const stoppedNoPolicy = runCadence(fresh(), HATS, deps(), { ...WEEK, periodMs: 0 });
  const stoppedWithPolicy = runCadence(fresh(), HATS, deps(DAY_MS), { ...WEEK, periodMs: 0 });
  const moving = runCadence(fresh(), HATS, deps(DAY_MS), WEEK);

  test("A STOPPED CLOCK GIVES SIX DEAD DAYS — the organization finishes and stays finished", () => {
    expect(stoppedNoPolicy.periods.map((p) => p.changes > 0)).toEqual([true, false, false, false, false, false, false]);
    expect(stoppedNoPolicy.quietPeriods).toBe(6);
  });

  test("THE REVIEW POLICY ALONE CHANGES NOTHING — which is how we know it is the clock", () => {
    // If this differed from the row above, the next test would prove only that a policy was
    // supplied, and the module's whole claim would rest on a comparison that never isolated time.
    expect(stoppedWithPolicy.periods.map((p) => p.changes)).toEqual(stoppedNoPolicy.periods.map((p) => p.changes));
  });

  test("A MOVING CLOCK GIVES SEVEN LIVE DAYS", () => {
    expect(moving.quietPeriods).toBe(0);
    expect(moving.periods.every((p) => p.changes > 0)).toBe(true);
  });

  test("...and the SAME first day, because nothing had aged yet", () => {
    // The difference must appear only where time has passed. A cadence whose FIRST period already
    // differs is doing something other than keeping time.
    expect(moving.periods[0]?.changes).toBe(stoppedNoPolicy.periods[0]?.changes);
  });

  test("EVERY LATER DAY IS THE SIXTEEN EXECUTIVES REVISITING THEIR DIRECTIONS", () => {
    // Sixteen domains, sixteen directions, one restatement each per day. Not a number pinned for
    // its own sake: it is the count of directions, so a seventeenth domain moves it on its own.
    const goals = moving.state.cascade.nodes.filter((n) => n.workType === WorkType.Goal).length;
    expect(goals).toBe(16);
    for (const p of moving.periods.slice(1)) expect(p.changes).toBe(goals);
  });

  test("no period ran out of rounds — busy is not the same as stuck", () => {
    expect(moving.unsettledPeriods).toBe(0);
  });
});

describe("A DIRECTION GOES STALE, AND A RESTATEMENT MAKES IT FRESH", () => {
  const goal = {
    workId: "g-1",
    workType: WorkType.Goal,
    title: "an old objective",
    state: "open" as const,
    ownerHatId: "ceo",
    directedAtMs: 0,
  };

  test("older than the interval is open, to the hat that HOLDS it", () => {
    const open = directionOpenings(chart, [goal], { nowMs: DAY_MS, reviewIntervalMs: DAY_MS });
    const restatements = open.filter((o) => o.restates === true);
    expect(restatements).toHaveLength(1);
    expect(restatements[0]?.byHatId).toBe("ceo");
    expect(restatements[0]?.subjectId).toBe("g-1");
  });

  test("YOUNGER THAN THE INTERVAL IS NOT", () => {
    const open = directionOpenings(chart, [goal], { nowMs: DAY_MS - 1, reviewIntervalMs: DAY_MS });
    expect(open.filter((o) => o.restates === true)).toEqual([]);
  });

  test("NO CLOCK MEANS NO RESTATEMENT — an org that cannot tell time cannot call anything old", () => {
    // The permissive direction stated out loud. Defaulting a `now` here would make every clockless
    // caller's directions spontaneously stale, which is a fact about this module rather than about
    // their organization.
    expect(directionOpenings(chart, [goal]).filter((o) => o.restates === true)).toEqual([]);
  });

  test("AN UNDATED DIRECTION IS NOT STALE, IT IS UNDATED", () => {
    // Two different silences, and this register's recurring defect is rendering them identically.
    const { directedAtMs: _none, ...undated } = goal;
    const open = directionOpenings(chart, [undated], { nowMs: WEEK_MS, reviewIntervalMs: DAY_MS });
    expect(open.filter((o) => o.restates === true)).toEqual([]);
  });

  test("a DELIVERED direction is not restated — it is finished, and its domain reopens instead", () => {
    const done = { ...goal, state: "done" as const };
    const open = directionOpenings(chart, [done], { nowMs: WEEK_MS, reviewIntervalMs: DAY_MS });
    expect(open.filter((o) => o.restates === true)).toEqual([]);
    expect(open.filter((o) => o.kind === GenerativeKind.SetDirection && o.restates !== true).length).toBe(16);
  });

  test("A RESTATEMENT DOES NOT GROW THE OBJECTIVE IT RESTATES", () => {
    // Measured, and it was a real defect: the restatement prompt quoted the current title, and a
    // deterministic driver answers a prompt with the prompt — so each day's objective wrapped the
    // previous one. 363 characters and six levels of "is 'is 'is '..." after ONE simulated week,
    // unbounded thereafter. Asserted over four weeks so a slow leak cannot hide inside a short run.
    const month = runCadence(fresh(), HATS, deps(DAY_MS), { periodMs: DAY_MS, periods: 28, maxRoundsPerPeriod: 60 });
    const titles = month.state.cascade.nodes.filter((n) => n.workType === WorkType.Goal).map((n) => n.title);
    expect(Math.max(...titles.map((t) => t.length))).toBeLessThan(120);
    expect(titles.some((t) => t.includes("still pointed the right way"))).toBe(true);
  });

  test("THE RESTATEMENT CLOSES ITS OWN OPENING — the clock is reset, not the title alone", () => {
    // Otherwise every executive restates every direction every round for the rest of the week,
    // which is the livelock this drive has now produced three times.
    const restated = runCadence(fresh(), HATS, deps(DAY_MS), { periodMs: DAY_MS, periods: 2, maxRoundsPerPeriod: 60 });
    const stamps = restated.state.cascade.nodes
      .filter((n) => n.workType === WorkType.Goal)
      .map((n) => n.directedAtMs);
    expect(new Set(stamps)).toEqual(new Set([START + DAY_MS]));
  });
});

describe("the cadence refuses what a calendar cannot mean", () => {
  test("zero periods", () => {
    expect(() => runCadence(fresh(), HATS, deps(), { ...WEEK, periods: 0 })).toThrow("at least one period");
  });

  test("negative time", () => {
    expect(() => runCadence(fresh(), HATS, deps(), { ...WEEK, periodMs: -1 })).toThrow("backwards");
  });

  test("a period nobody can act in — refused BY THE DRIVE, not by a second copy of the rule", () => {
    // `org-cadence` had its own guard here. A mutation run deleting it killed nothing, because
    // `driveUntilSettled` already refuses the same budget with the same message and every period
    // calls it. The guard was removed; the refusal is asserted where it actually lives.
    expect(() => runCadence(fresh(), HATS, deps(), { ...WEEK, maxRoundsPerPeriod: 0 })).toThrow(
      "maxRounds must be at least 1",
    );
  });

  test("A STOPPED CLOCK IS LEGAL — it is the control in the experiment above, not an error", () => {
    expect(() => runCadence(fresh(), HATS, deps(), { ...WEEK, periodMs: 0 })).not.toThrow();
  });
});

describe("QUIET AND STUCK ARE DIFFERENT, and are counted apart", () => {
  test("a period that ran out of rounds is unsettled, not quiet", () => {
    // One round is nowhere near enough for the opening day, so it cannot settle — and it certainly
    // was not quiet. A single counter would render an organization that could not finish and one
    // with nothing to do as the same number.
    const cramped = runCadence(fresh(), HATS, deps(), { periodMs: DAY_MS, periods: 2, maxRoundsPerPeriod: 1 });
    expect(cramped.unsettledPeriods).toBeGreaterThan(0);
    expect(cramped.quietPeriods).toBe(0);
  });

  test("every id in the finished organization is unique — work, artifacts and signals alike", () => {
    // WEAKER THAN IT LOOKS, and said so rather than left to imply otherwise. A mutation run
    // rebuilding `createId` per period survived this: every act in this drive that mints an id is
    // raised once, so the counter is never consulted after the opening period and a collision is
    // unreachable today. Recorded at `runCadence`'s docstring too. What this does still catch is a
    // collision WITHIN a period, which is where every id here is actually minted.
    const out = runCadence(fresh(), HATS, deps(DAY_MS), WEEK);
    const ids = [
      ...out.state.cascade.nodes.map((n) => n.workId),
      ...out.state.view.artifacts.keys(),
      ...out.state.view.signals.map((s) => s.signalId),
    ];
    expect(new Set(ids).size).toBe(ids.length);
  });
});
