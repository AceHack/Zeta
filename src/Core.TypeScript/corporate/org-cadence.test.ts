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
import { deliveredSet, WorkType } from "./goal-cascade";
import { directionOpenings, GenerativeKind } from "./generative-work";
import { Domain } from "./domain-ontology";
import type { DriveDeps, DriveState } from "./org-drive";
import { GateOutcome } from "./quality-gate";
import type { OrgChooser } from "./org-decision";
import { BlockerKind } from "./blocker-taxonomy";
import { SignalTool } from "./supervisor-signal";
import { EscalationAction } from "./escalation";

const chart = (() => {
  const r = buildOrgChart(SEED_HATS);
  if (!r.ok) throw new Error(r.reason);
  return r.chart;
})();

const HATS = chart.hats.map((h) => h.id);
const START = 1_000_000;
const WEEK: Cadence = { periodMs: DAY_MS, periods: 7, maxRoundsPerPeriod: 60 };

function fresh(gates = false): DriveState {
  return {
    view: {
      chart,
      board: EMPTY_BOARD,
      signals: [],
      cascade: [],
      artifacts: new Map(),
      blockers: new Map(),
      ...(gates ? { gateAttempts: { counts: new Map<string, number>(), maxAttempts: 3 } } : {}),
    },
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
  }, 120_000);

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

describe("A WEEK, END TO END, FROM AN EMPTY COMPANY", () => {
  // No fixture: a chart, an empty cascade, and seven days. Everything below is what came out.
  const week = runCadence(fresh(true), HATS, deps(DAY_MS), { periodMs: DAY_MS, periods: 7, maxRoundsPerPeriod: 80 });
  const nodes = week.state.cascade.nodes;

  test("it decides what it is for, breaks that down, documents it and prices it", () => {
    // SIXTEEN GOALS WAS A CENSUS OF A COMPANY THAT COULD NOT FINISH ANYTHING. Now that delivery
    // rolls up, a domain whose cascade completes is empty again and its executive sets a new
    // direction the next day — so the count is many times sixteen and grows with the run length.
    // Asserted as the property instead: every domain has been pointed somewhere, and no domain has
    // two live directions at once.
    const goals = nodes.filter((n) => n.workType === WorkType.Goal);
    expect(new Set(goals.map((g) => g.domain))).toEqual(new Set(Object.values(Domain)));
    expect(goals.length).toBeGreaterThan(16);
    const liveByDomain = new Map<string, number>();
    for (const g of goals) {
      if (g.state === "done" || g.state === "canceled") continue;
      if (!nodes.some((n) => n.parentWorkId === g.workId)) continue;
      const delivered = deliveredSet({ nodes }).has(g.workId);
      if (delivered) continue;
      liveByDomain.set(g.domain ?? "?", (liveByDomain.get(g.domain ?? "?") ?? 0) + 1);
    }
    for (const [, n] of liveByDomain) expect(n).toBeLessThanOrEqual(1);
  });

  test("AND A SECOND WEEK'S WORTH OF DIRECTION — the C-suite keeps deciding", () => {
    // The gap this closes, stated as the measurement that exposed it. Before delivery rolled up,
    // days two through seven were sixteen restatements and nothing else: a company that finishes
    // its work and then has nothing to say about it. Every day now sets NEW directions as domains
    // complete, on top of the restatements.
    const perDay = week.periods.map((p) =>
      p.rounds.flatMap((r) => r.ticks).filter((t) => t.chosen?.kind === "set_direction" && t.effect.kind === "direction").length,
    );
    expect(perDay[0]).toBe(16);
    expect(perDay.slice(1).every((n) => n > 0)).toBe(true);
  });

  test("AND IT FINISHES SOMETHING — through the gates, not by declaring itself done", () => {
    // The last thing only `org-cycle.ts` could do. Work reaches `done` here by the SAME
    // `runGateChain` the script calls: seven gates, none of them evaluated by the hat that did the
    // work. A submission path that judged work more leniently than the scripted one would be a
    // second, weaker route to a passed gate.
    const done = nodes.filter((n) => n.state === "done");
    expect(done.length).toBeGreaterThan(0);
    expect(done.every((n) => n.assigneeHatId !== undefined)).toBe(true);
  });

  test("...and NOT ONE REFUSAL over seven days", () => {
    const refused = week.periods
      .flatMap((p) => p.rounds)
      .flatMap((r) => r.ticks)
      .filter((t) => t.refusals.length > 0);
    expect(refused.map((t) => `${t.hatId}:${t.chosen?.kind}:${t.refusals[0]}`)).toEqual([]);
  });

  test("EVERY TASK IT CREATED, IT STAFFED — the hollow-lead gap is closed, not merely reported", () => {
    // Three of the seed's four leads supervise nobody, and tasks are owned at lead level, so three
    // of every four tasks used to be unstaffable. Reporting that to the RMO was an improvement on
    // silence and was never the answer: the ladder bends now, so a department with no lead staffs
    // its work out of the contributors it actually has.
    //
    // The reporting path is NOT dead — `generative-work.test.ts` pins it against `cost_controller`,
    // a manager with nobody at all beneath it. What changed is that it stopped firing on ten of
    // sixteen departments that were working fine.
    const tasks = nodes.filter((n) => n.workType === WorkType.Task);
    expect(tasks.length).toBeGreaterThan(0);
    expect(tasks.filter((n) => n.assigneeHatId === undefined)).toEqual([]);
  });

  test("every unfinished task is either staffed or reported — none is merely forgotten", () => {
    // The property the previous test measures, stated as the rule it exists for. A task with
    // nobody on it and nothing said about it is the exact defect this register was built to end.
    const raised = new Set(week.state.view.signals.map((s) => s.title));
    for (const task of nodes.filter((n) => n.workType === WorkType.Task && n.state === "open")) {
      expect(task.assigneeHatId !== undefined || raised.has(`staff:${task.ownerHatId}`)).toBe(true);
    }
  });
});

describe("WHEN THE GATES SAY NO — the bound, and the fact somebody is told", () => {
  // Every gate rejects. The interesting half of the submission verb: a passing drive cannot show
  // that a turned-back submission is bounded, and an unbounded one is a loop.
  const rejectAll: OrgChooser<GateOutcome> = (legal) => {
    const i = legal.indexOf(GateOutcome.Rejected);
    return { index: i < 0 ? 0 : i, reason: "rejected" };
  };
  const MAX = 2;

  const out = (() => {
    let n = 0;
    const state = fresh(true);
    const view = { ...state.view, gateAttempts: { counts: new Map<string, number>(), maxAttempts: MAX } };
    return runCadence(
      { ...state, view },
      HATS,
      {
        chart,
        nowMs: START,
        createId: (p) => `${p}-${String((n += 1))}`,
        resourceAuthorityHatId: "rmo_office",
        directionReviewMs: DAY_MS,
        gateChooser: rejectAll,
      },
      { periodMs: DAY_MS, periods: 3, maxRoundsPerPeriod: 80 },
    );
  })();

  test("NOTHING IS DELIVERED — the gates decide, and they said no", () => {
    expect(out.state.cascade.nodes.filter((n) => n.state === "done")).toEqual([]);
  });

  test("THE SUBMISSION IS BOUNDED — MAX attempts, an escalation, then MAX more, then it stops", () => {
    // Per item rather than in total: the organization staffs every department now, so a run this
    // long has many tasks in flight and a single total would be a census that moves whenever the
    // chart does.
    //
    // TWICE MAX, not once, and that is the escalation rather than a leak. A hat spends its
    // attempts, a manager rules on the churn, the ruling `changes_the_input` and the work gets its
    // attempts back — ONCE. The second exhaustion is final: `escalationOpenings` refuses a second
    // ruling on the same item, which is what stops this becoming a pump that does real work
    // forever.
    const attempts = [...(out.state.view.gateAttempts?.counts.values() ?? [])];
    expect(attempts.length).toBeGreaterThan(0);
    expect(attempts.every((n) => n === MAX)).toBe(true);

    const ticks = out.periods.flatMap((p) => p.rounds).flatMap((r) => r.ticks);
    expect(ticks.filter((t) => t.chosen?.kind === "submit_work")).toHaveLength(attempts.length * MAX * 2);
    // ONE RULING PER ITEM. More would be the pump; none would leave the bound as a counter nobody
    // reads at the limit, which is the defect the escalation exists to close.
    expect(ticks.filter((t) => t.chosen?.kind === "escalate_churn")).toHaveLength(attempts.length);
  });

  test("A MANAGER DECIDED IT — not the owner, and not nobody", () => {
    // `decideEscalation` refuses anyone below manager, and `escalationDeciderFor` walks up from the
    // owner until it finds a level that holds the authority. The owner ruling on its own churn
    // would be the failing loop assessing itself.
    const rulings = out.state.view.signals.filter((s) => s.tool === SignalTool.RequestEscalation);
    expect(rulings.length).toBeGreaterThan(0);
    for (const ruling of rulings) {
      const decider = chart.byId.get(ruling.fromHatId);
      expect(decider).toBeDefined();
      expect(["manager", "director", "c_suite", "executive_board"]).toContain(decider?.level ?? "?");
    }
  });

  test("...and the ruling is an ACTION from the legal set, not a note", () => {
    // The title carries what was decided. A ruling that recorded only "escalated" would tell the
    // next reader that something happened and nothing about what.
    const rulings = out.state.view.signals.filter((s) => s.tool === SignalTool.RequestEscalation);
    for (const ruling of rulings) {
      expect((Object.values(EscalationAction) as readonly string[])).toContain(ruling.title);
    }
  });

  test("AND SOMEBODY IS TOLD — exhaustion is a blocker, routed and raised ONCE", () => {
    // The bound alone was a counter nobody read at the limit: the count reached the maximum, the
    // opening closed, and the work sat open in silence. A reader with no writer.
    const blocked = out.state.view.signals.filter((s) => s.title === BlockerKind.ReleaseBlocked);
    const exhausted = [...(out.state.view.gateAttempts?.counts.entries() ?? [])]
      .filter(([, n]) => n >= MAX)
      .map(([id]) => id);
    // ONE PER EXHAUSTED ITEM, and no more. Both halves matter: a missing one is work stuck in
    // silence, and a second is the same blocker re-raised every round.
    expect(new Set(blocked.map((s) => s.workItemId))).toEqual(new Set(exhausted));
    expect(blocked).toHaveLength(exhausted.length);
    expect(blocked.every((s) => s.toHatId !== s.fromHatId)).toBe(true);
  });

  test("...and it still SETTLES — a refusal is not a reason to spin", () => {
    expect(out.periods.every((p) => p.settled)).toBe(true);
  });
});

describe("A RULING THAT STOPS THE WORK — the other half of an escalation", () => {
  // The deterministic ruling always CHANGES THE INPUT, so without a chooser this branch is
  // unreachable — measured as a surviving mutant that left the halting path untested. A manager who
  // decides to PAUSE is not a failure case; it is the organization choosing to stop, which is how
  // it gets to do something else.
  const rejectAll: OrgChooser<GateOutcome> = (legal) => {
    const i = legal.indexOf(GateOutcome.Rejected);
    return { index: i < 0 ? 0 : i, reason: "rejected" };
  };
  const pause: OrgChooser<EscalationAction> = (legal) => {
    const i = legal.indexOf(EscalationAction.Pause);
    return { index: i < 0 ? 0 : i, reason: "pause it" };
  };

  const out = (() => {
    let n = 0;
    const state = fresh(true);
    const view = { ...state.view, gateAttempts: { counts: new Map<string, number>(), maxAttempts: 2 } };
    return runCadence(
      { ...state, view },
      HATS,
      {
        chart,
        nowMs: START,
        createId: (p) => `${p}-${String((n += 1))}`,
        resourceAuthorityHatId: "rmo_office",
        directionReviewMs: DAY_MS,
        gateChooser: rejectAll,
        escalationChooser: pause,
      },
      { periodMs: DAY_MS, periods: 3, maxRoundsPerPeriod: 80 },
    );
  })();

  test("the work is CANCELLED — this cascade has no state for 'stopped but not finished'", () => {
    const cancelled = out.state.cascade.nodes.filter((n) => n.state === "canceled");
    expect(cancelled.length).toBeGreaterThan(0);
    expect(cancelled.every((n) => n.workType === WorkType.Task)).toBe(true);
  });

  test("...and it is NOT retried — a halted loop does not get its attempts back", () => {
    // The distinction the effect carries. A ruling that halted and then reset would be a manager
    // saying stop and the organization carrying on.
    const submissions = out.periods
      .flatMap((p) => p.rounds)
      .flatMap((r) => r.ticks)
      .filter((t) => t.chosen?.kind === "submit_work");
    const cancelled = out.state.cascade.nodes.filter((n) => n.state === "canceled");
    expect(submissions).toHaveLength(cancelled.length * 2);
  });

  test("THE DOMAIN IS FREED — a cancelled child does not hold its goal open forever", () => {
    // Why cancelling is a real consequence rather than a tidy-up: `deliveredSet` skips cancelled
    // children, so a cascade whose only failing task is cancelled COMPLETES, and its executive is
    // asked for a new direction. An organization that decides to stop gets to do something else.
    const goals = out.state.cascade.nodes.filter((n) => n.workType === WorkType.Goal);
    expect(goals.length).toBeGreaterThan(16);
  });

  test("and the run still settles", () => {
    expect(out.periods.every((p) => p.settled)).toBe(true);
  });
});

describe("THE CALENDAR IS RUNTIME AUTHORITY — the last two script-only phases", () => {
  const HOUR = 60 * 60 * 1000;
  const week = (scheduling = true) => {
    let n = 0;
    return runCadence(
      fresh(true),
      HATS,
      {
        chart,
        nowMs: START,
        createId: (p) => `${p}-${String((n += 1))}`,
        resourceAuthorityHatId: "rmo_office",
        directionReviewMs: DAY_MS,
        // The keys are ABSENT rather than undefined when scheduling is off:
        // `exactOptionalPropertyTypes` makes those different things, and the register's own rule is
        // that an absent key means the caller declared nothing.
        ...(scheduling ? { workBlockMs: HOUR, meetingMs: HOUR / 2 } : {}),
      },
      { periodMs: DAY_MS, periods: 3, maxRoundsPerPeriod: 80 },
    );
  };

  const out = week();
  // HOISTED, for the same reason `out` is: `week()` runs a real three-period cadence with up to 80
  // rounds each, and it is the ONLY expensive thing in this describe. Computed at describe scope it
  // is module-load time; computed inside a test body it is charged against that test's 5000ms
  // budget, and the whole simulation has to fit.
  //
  // It did not. CI run 34535382381 (job 103065663507): this file's `NO workBlockMs MEANS NO
  // BOOKING` test took **5873ms against a 5000ms limit** and timed out, while the same file passes
  // locally in 27.4s total across 42 tests. A verdict that flips on how fast the runner is, is not
  // reporting on the code -- and raising the timeout would only move the threshold rather than
  // remove the dependence.
  const unscheduled = week(false);

  test("EVERY ASSIGNMENT RESERVES TIME — an assignment nobody booked is one nobody can honour", () => {
    // `org-cycle.ts` booked work blocks as its own phase and it was the last thing it did that no
    // tick could. Not a menu item here, deliberately: making it a separate act the assignee might
    // not choose would put "was this scheduled" back among the things that can be silently skipped.
    const assigned = out.state.cascade.nodes.filter((n) => n.assigneeHatId !== undefined);
    const booked = out.state.calendar.blocks.filter((b) => b.blockType === "prioritized_work");
    expect(assigned.length).toBeGreaterThan(0);
    expect(new Set(booked.map((b) => b.workItemId))).toEqual(new Set(assigned.map((n) => n.workId)));
  });

  test("...for the hat that actually holds the work", () => {
    const byWork = new Map(out.state.cascade.nodes.map((n) => [n.workId, n.assigneeHatId]));
    for (const block of out.state.calendar.blocks.filter((b) => b.blockType === "prioritized_work")) {
      expect(block.hatId).toBe(byWork.get(block.workItemId ?? "") ?? "?");
    }
  });

  test("NO `workBlockMs` MEANS NO BOOKING — a register that does not know how long work takes cannot reserve it", () => {
    // The honest default said out loud. Picking an hour on the caller's behalf would put a number
    // nobody chose into the one surface that decides whether a hat is busy.
    expect(unscheduled.state.calendar.blocks).toEqual([]);
    // AND THE ORGANISATION STILL RUNS. Scheduling is a consequence of assignment, not a gate on it.
    expect(unscheduled.state.cascade.nodes.filter((n) => n.state === "done").length).toBeGreaterThan(0);
  });

  test("THE ACCOUNTABLE CHAIN MEETS, at a time they are all free", () => {
    const meetings = out.state.calendar.blocks.filter((b) => b.meetingId !== undefined);
    expect(meetings.length).toBeGreaterThan(0);
    // Every leg of a meeting shares its id, its start and its end — that is what makes it one
    // booking across several calendars rather than several bookings that happen to agree.
    for (const [, legs] of Object.entries(
      meetings.reduce<Record<string, typeof meetings>>((acc, b) => {
        const key = b.meetingId ?? "";
        return { ...acc, [key]: [...(acc[key] ?? []), b] };
      }, {}),
    )) {
      expect(legs.length).toBeGreaterThan(1);
      expect(new Set(legs.map((l) => l.startMs)).size).toBe(1);
      expect(new Set(legs.map((l) => l.hatId)).size).toBe(legs.length);
    }
  });

  test("...ONCE per work item — the calendar is the record, so it reads its own effect back", () => {
    const met = out.state.calendar.blocks
      .filter((b) => b.meetingId !== undefined)
      .map((b) => b.workItemId);
    const perWork = new Map<string, Set<string>>();
    for (const b of out.state.calendar.blocks.filter((x) => x.meetingId !== undefined)) {
      const key = b.workItemId ?? "";
      perWork.set(key, (perWork.get(key) ?? new Set<string>()).add(b.meetingId ?? ""));
    }
    expect(met.length).toBeGreaterThan(0);
    for (const [, ids] of perWork) expect(ids.size).toBe(1);
  });

  test("NOT ONE REFUSAL, with the calendar in play", () => {
    // A booking placed over somebody's existing work is a conflict the calendar exists to refuse,
    // and a run that produced them would mean the drive was proposing meetings it could not hold.
    const refused = out.periods
      .flatMap((p) => p.rounds)
      .flatMap((r) => r.ticks)
      .filter((t) => t.refusals.length > 0);
    expect(refused.map((t) => `${t.hatId}:${t.chosen?.kind}:${t.refusals[0]}`)).toEqual([]);
  });
});

describe("PER-TASK OUTCOMES — a claim checked rather than asserted", () => {
  // `org-cycle.ts`'s docstring listed `outcomeFor` among the things only it could do. That was too
  // strong and this is the check: `DriveDeps.choose` already lets a caller decide, per hat and per
  // tick, which offered act to take — including declining to submit a particular item while
  // submitting another.
  test("a chooser can hold one item back and let the rest through", () => {
    let n = 0;
    const held = "direction-implementation-1-1-1-1";
    const out = runCadence(
      fresh(true),
      HATS,
      {
        chart,
        nowMs: START,
        createId: (p) => `${p}-${String((n += 1))}`,
        resourceAuthorityHatId: "rmo_office",
        directionReviewMs: DAY_MS,
        // Everything except submitting THIS item. The menu is ordered, so declining the first
        // choice takes the next one rather than idling the hat.
        choose: (menu) => menu.find((a) => !(a.kind === "submit_work" && a.subjectId === held)),
      },
      { periodMs: DAY_MS, periods: 2, maxRoundsPerPeriod: 80 },
    );
    const nodes = out.state.cascade.nodes;
    expect(nodes.filter((x) => x.state === "done").length).toBeGreaterThan(0);
    const holdout = nodes.find((x) => x.workId === held);
    // Either the item was never created in this shorter run, or it exists and was NOT completed.
    // Both are honest; what must not happen is it completing anyway.
    expect(holdout?.state).not.toBe("done");
  });
});
