/**
 * demand-schedule.test.ts — falsifiers for turning ready demand into calendar blocks.
 *
 * The property that matters most is the one a naive scheduler gets wrong silently: a hat NOBODY IS
 * WEARING must not be booked. Such a block looks like a scheduled day and is an appointment with no
 * attendee, so the tests below separate the three outcomes a step can have — booked, waiting on a
 * wearer, or waiting on a calendar — and check that each names its own cause.
 */

import { describe, expect, test } from "bun:test";
import {
  agendaForAgent,
  assignmentsFor,
  coverage,
  hatsToProvision,
  reworkFirst,
  scheduleDemand,
} from "./demand-schedule";
import type { GateStep } from "./gate-demand";
import { advanceBinding, beginBinding, isAuthorizing, type HatBinding } from "./hat-binding";
import { buildOrgChart, type OrgChart } from "./org-chart";
import { SEED_HATS } from "./org-seed";
import { GateKind, gateOwners } from "./quality-gate";
import { WorkType } from "./goal-cascade";
import { EMPTY_CALENDAR, ScheduleBlockState, ScheduleBlockType, scheduleBlock, type Calendar } from "./work-schedule";

function chartOf(): OrgChart {
  const built = buildOrgChart(SEED_HATS);
  if (!built.ok) throw new Error(built.reason);
  return built.chart;
}
// A COUNTER, NEVER `Math.random()`. Forcing every id to one value turns 9 tests red, so a
// collision fails the run — and a 6-digit random draw collides at a low-percent rate over a
// few hundred ids, which is what produced an unexplained single failure in six full runs.
// A counter also makes the run replayable, which is what made the original flake untraceable.
let idSeq = 0;

const CHART = chartOf();
const NOW = 1_000_000;
const HOUR = 3_600_000;

/** A gate with at least two owners, so "a colleague takes it" is expressible. */
const GATE = GateKind.QaUat;
const OWNERS = gateOwners(CHART, GATE).map((h) => h.id);

function step(over: Partial<GateStep> = {}): GateStep {
  return {
    workId: "T-1",
    workType: WorkType.Task,
    gate: GATE,
    title: "a task",
    ownerHatId: "owner",
    attempt: 1,
    rework: false,
    why: "not judged yet",
    ...over,
  };
}

/**
 * An ACTIVE binding, so `isAuthorizing` is true at NOW.
 *
 * `beginBinding` lands in `Warmup`; `advanceBinding` is what carries it to `Active` once the warmup
 * has elapsed. Bound an hour ago so the default 60s warmup is well past, and the 8h TTL still has
 * hours left at NOW.
 */
function wearing(hatId: string, agentId: string): HatBinding {
  const hat = CHART.byId.get(hatId);
  if (hat === undefined) throw new Error(`no hat ${hatId}`);
  const begun = beginBinding(hat, { bindingId: `b-${hatId}`, wearerAgentId: agentId, nowMs: NOW - HOUR });
  if (!begun.ok) throw new Error(begun.reason);
  const active = advanceBinding(begun.binding, hat, NOW);
  if (!isAuthorizing(active, NOW)) throw new Error(`binding did not activate: ${active.phase}`);
  return active;
}

const BASE = {
  chart: CHART,
  fromMs: NOW,
  untilMs: NOW + 8 * HOUR,
  blockMs: HOUR,
  createId: (p: string) => `${p}-${String(++idSeq)}`,
  nowMs: NOW,
};

describe("a hat nobody is wearing is PROVISIONING DEMAND, not a scheduling failure", () => {
  test("with no bindings at all, every step waits on a wearer", () => {
    const r = scheduleDemand({ ...BASE, calendar: EMPTY_CALENDAR, demand: [step()], bindings: [] });
    expect(r.scheduled).toEqual([]);
    expect(r.unscheduled).toEqual([]);
    expect(r.provisioning).toHaveLength(1);
    expect(r.provisioning[0]?.hatIds).toEqual(OWNERS);
    expect(r.provisioning[0]?.because).toContain("no agent is currently wearing");
  });

  test("staffing the hat moves the SAME step from provisioning to scheduled", () => {
    const owner = OWNERS[0] as string;
    const r = scheduleDemand({
      ...BASE,
      calendar: EMPTY_CALENDAR,
      demand: [step()],
      bindings: [wearing(owner, "agent-1")],
    });
    expect(r.provisioning).toEqual([]);
    expect(r.scheduled).toHaveLength(1);
    expect(r.scheduled[0]?.hatId).toBe(owner);
  });

  test("a WARMING-UP binding does not count as worn", () => {
    // `isAuthorizing` is the same predicate the gate evaluator uses. A hat that could not approve
    // the gate at execution time must not be booked for it at plan time.
    const owner = OWNERS[0] as string;
    const hat = CHART.byId.get(owner);
    if (hat === undefined) throw new Error("no hat");
    const begun = beginBinding(hat, { bindingId: "b", wearerAgentId: "agent-1", nowMs: NOW });
    if (!begun.ok) throw new Error(begun.reason);
    const r = scheduleDemand({
      ...BASE,
      calendar: EMPTY_CALENDAR,
      demand: [step()],
      bindings: [begun.binding],
    });
    expect(r.scheduled).toEqual([]);
    expect(r.provisioning).toHaveLength(1);
  });

  test("provisioning aggregates by ROLE — three steps on one hat is one hiring decision", () => {
    const r = scheduleDemand({
      ...BASE,
      calendar: EMPTY_CALENDAR,
      demand: [step({ workId: "T-1" }), step({ workId: "T-2" }), step({ workId: "T-3" })],
      bindings: [],
    });
    expect(r.provisioning).toHaveLength(3);
    const toStaff = hatsToProvision(r);
    expect(toStaff[0]?.waiting).toBe(3);
    expect(OWNERS).toContain(toStaff[0]?.hatId as string);
  });

  test("a gate no hat in the chart holds is a REFUSAL, not provisioning", () => {
    // Nobody to provision. The chart itself is missing the role, which is a different problem from
    // a role standing empty, and merging them would send the RMO looking for a hat to staff that
    // does not exist.
    const r = scheduleDemand({
      ...BASE,
      calendar: EMPTY_CALENDAR,
      demand: [step({ gate: "no_such_gate" as GateKind })],
      bindings: [],
    });
    expect(r.provisioning).toEqual([]);
    expect(r.unscheduled[0]?.because).toContain("no hat in this chart holds");
  });
});

describe("the block lands on the agent wearing the hat", () => {
  test("the assignment names the wearer, so observe can answer 'what am I doing'", () => {
    const owner = OWNERS[0] as string;
    const r = scheduleDemand({
      ...BASE,
      calendar: EMPTY_CALENDAR,
      demand: [step()],
      bindings: [wearing(owner, "agent-7")],
    });
    expect(r.scheduled[0]?.wearerAgentId).toBe("agent-7");
    expect(agendaForAgent(r, "agent-7")).toHaveLength(1);
    expect(agendaForAgent(r, "somebody-else")).toEqual([]);
  });

  test("the block carries the work item, so the room knows what it is opening", () => {
    const owner = OWNERS[0] as string;
    const r = scheduleDemand({
      ...BASE,
      calendar: EMPTY_CALENDAR,
      demand: [step({ workId: "ELERA-149570" })],
      bindings: [wearing(owner, "agent-1")],
    });
    expect(r.scheduled[0]?.block.workItemId).toBe("ELERA-149570");
    expect(r.scheduled[0]?.block.state).toBe(ScheduleBlockState.Scheduled);
  });

  test("an agent's agenda comes back in time order", () => {
    const owner = OWNERS[0] as string;
    const r = scheduleDemand({
      ...BASE,
      calendar: EMPTY_CALENDAR,
      demand: [step({ workId: "T-1" }), step({ workId: "T-2" }), step({ workId: "T-3" })],
      bindings: [wearing(owner, "agent-1")],
    });
    const starts = agendaForAgent(r, "agent-1").map((a) => a.block.startMs);
    expect(starts).toEqual([...starts].sort((a, b) => a - b));
  });
});

describe("who did the work cannot judge it", () => {
  test("the proposer is excluded, and a colleague takes the step", () => {
    // Asserted, not assumed: a skip here would make the test vacuous if the seed ever changed.
    expect(OWNERS.length).toBeGreaterThanOrEqual(2);
    const [first, second] = OWNERS as [string, string];
    const r = scheduleDemand({
      ...BASE,
      calendar: EMPTY_CALENDAR,
      demand: [step()],
      bindings: [wearing(first, "agent-1"), wearing(second, "agent-2")],
      proposerOf: () => first,
    });
    expect(r.scheduled[0]?.hatId).toBe(second);
  });

  test("the SOLE holder having done the work is refused, and says so", () => {
    // Built rather than drawn from the seed: every seed gate has several holders, so this case is
    // unreachable there and a conditional skip would have made the test assert nothing at all.
    const built = buildOrgChart([
      { id: "boss", name: "Boss", level: "c_suite", approvalScopes: [GateKind.QaUat] },
      { id: "worker", name: "Worker", level: "ic", reportsTo: "boss" },
    ] as unknown as typeof SEED_HATS);
    if (!built.ok) throw new Error(built.reason);
    const solo = built.chart;
    expect(gateOwners(solo, GATE).map((h) => h.id)).toEqual(["boss"]);

    const hat = solo.byId.get("boss");
    if (hat === undefined) throw new Error("no boss");
    const begun = beginBinding(hat, { bindingId: "b", wearerAgentId: "agent-1", nowMs: NOW - HOUR });
    if (!begun.ok) throw new Error(begun.reason);

    const r = scheduleDemand({
      ...BASE,
      chart: solo,
      calendar: EMPTY_CALENDAR,
      demand: [step()],
      bindings: [advanceBinding(begun.binding, hat, NOW)],
      proposerOf: () => "boss",
    });
    expect(r.scheduled).toEqual([]);
    expect(r.provisioning).toEqual([]);
    expect(r.unscheduled[0]?.because).toContain("cannot judge its own");
  });
});

describe("a busy hat moves work to a colleague, it does not drop it", () => {
  test("a full calendar on one holder is not the end of the step", () => {
    expect(OWNERS.length).toBeGreaterThanOrEqual(2);
    const [first, second] = OWNERS as [string, string];
    // Fill `first` solid across the whole window.
    let calendar: Calendar = EMPTY_CALENDAR;
    for (let t = NOW; t < NOW + 8 * HOUR; t += HOUR) {
      const r = scheduleBlock(calendar, {
        blockId: `busy-${String(t)}`,
        hatId: first,
        blockType: ScheduleBlockType.Meeting,
        startMs: t,
        endMs: t + HOUR,
        state: ScheduleBlockState.Scheduled,
      });
      if (!r.ok) throw new Error(r.reason);
      calendar = r.calendar;
    }
    const r = scheduleDemand({
      ...BASE,
      calendar,
      demand: [step()],
      bindings: [wearing(first, "agent-1"), wearing(second, "agent-2")],
    });
    expect(r.scheduled).toHaveLength(1);
    expect(r.scheduled[0]?.hatId).toBe(second);
  });

  test("EVERY staffed holder booked solid is reported, never silently dropped", () => {
    const owner = OWNERS[0] as string;
    let calendar: Calendar = EMPTY_CALENDAR;
    for (const h of OWNERS) {
      for (let t = NOW; t < NOW + 8 * HOUR; t += HOUR) {
        const r = scheduleBlock(calendar, {
          blockId: `busy-${h}-${String(t)}`,
          hatId: h,
          blockType: ScheduleBlockType.Meeting,
          startMs: t,
          endMs: t + HOUR,
          state: ScheduleBlockState.Scheduled,
        });
        if (!r.ok) throw new Error(r.reason);
        calendar = r.calendar;
      }
    }
    const r = scheduleDemand({
      ...BASE,
      calendar,
      demand: [step()],
      bindings: OWNERS.map((h, i) => wearing(h, `agent-${String(i)}`)),
    });
    expect(r.scheduled).toEqual([]);
    expect(r.unscheduled).toHaveLength(1);
    expect(r.unscheduled[0]?.because).toContain("booked solid");
    expect(assignmentsFor(r, owner)).toEqual([]);
  });

  test("blocks booked in one pass do not overlap on the same hat", () => {
    const owner = OWNERS[0] as string;
    const r = scheduleDemand({
      ...BASE,
      calendar: EMPTY_CALENDAR,
      demand: [step({ workId: "T-1" }), step({ workId: "T-2" })],
      bindings: [wearing(owner, "agent-1")],
    });
    const mine = assignmentsFor(r, owner);
    for (let i = 1; i < mine.length; i++) {
      expect((mine[i]?.block.startMs ?? 0) >= (mine[i - 1]?.block.endMs ?? 0)).toBe(true);
    }
  });
});

describe("ordering and reporting", () => {
  test("rework is offered a slot before fresh work", () => {
    expect(reworkFirst(step({ rework: true }), step({ rework: false }))).toBeLessThan(0);
    expect(reworkFirst(step({ rework: false }), step({ rework: true }))).toBeGreaterThan(0);
    expect(reworkFirst(step(), step())).toBe(0);
  });

  test("an injected ranking overrides the default", () => {
    const owner = OWNERS[0] as string;
    const r = scheduleDemand({
      ...BASE,
      calendar: EMPTY_CALENDAR,
      demand: [step({ workId: "FRESH" }), step({ workId: "REWORK", rework: true })],
      bindings: [wearing(owner, "agent-1")],
      rankOf: (s) => (s.workId === "FRESH" ? 0 : 1),
    });
    expect(r.scheduled[0]?.step.workId).toBe("FRESH");
  });

  test("THE INPUT ARRAY IS NOT REORDERED — a scheduler must not mutate its demand", () => {
    const demand = [step({ workId: "A" }), step({ workId: "B", rework: true })];
    const before = demand.map((s) => s.workId);
    const owner = OWNERS[0] as string;
    scheduleDemand({ ...BASE, calendar: EMPTY_CALENDAR, demand, bindings: [wearing(owner, "a")] });
    expect(demand.map((s) => s.workId)).toEqual(before);
  });

  test("coverage counts provisioning against it, not just calendar misses", () => {
    // Otherwise an org that staffed nobody reports perfect coverage of the zero steps it booked.
    const r = scheduleDemand({ ...BASE, calendar: EMPTY_CALENDAR, demand: [step()], bindings: [] });
    expect(coverage(r)).toBe(0);
  });

  test("coverage is 1 for empty demand — nothing owed is fully served", () => {
    const r = scheduleDemand({ ...BASE, calendar: EMPTY_CALENDAR, demand: [], bindings: [] });
    expect(coverage(r)).toBe(1);
  });

  test("an empty window schedules nothing and says why", () => {
    const r = scheduleDemand({
      ...BASE,
      untilMs: NOW,
      calendar: EMPTY_CALENDAR,
      demand: [step()],
      bindings: [],
    });
    expect(r.scheduled).toEqual([]);
    expect(r.unscheduled[0]?.because).toContain("window is empty");
  });
});
