/**
 * org-life.test.ts — the organization when nobody is asking it for anything.
 *
 * Three properties, and each one is the answer to "this feels hardcoded, not alive":
 * idle time produces something checkable, a person outranks the schedule and the cost of that is
 * recorded, and authority exists while there is work for it and not otherwise.
 */

import { describe, expect, test } from "bun:test";

import { acceptGoal, decompose, EMPTY_CASCADE, WorkState, WorkType, type Cascade } from "./goal-cascade";
import { buildOrgChart } from "./org-chart";
import { SEED_HATS } from "./org-seed";
import { MemoryTier } from "./memory";
import { ScheduleBlockState, ScheduleBlockType, type Calendar, type ScheduleBlock } from "./work-schedule";
import {
  blockForProposal,
  blocksForMeeting,
  meetingShortfall,
  MeetingReason,
  proposeMeetings,
  decideHats,
  hatDemand,
  HatMove,
  idleHats,
  isPresence,
  replanForWork,
  memoryFromSelfDirected,
  preemptForConversation,
  Presence,
  presenceOf,
  presenceSummary,
  proposeSelfDirected,
  SelfDirectedKind,
  waking,
} from "./org-life";

const chart = (() => {
  const r = buildOrgChart(SEED_HATS);
  if (!r.ok) throw new Error(r.reason);
  return r.chart;
})();

const T0 = 1_700_000_000_000;
const HOUR = 3_600_000;

/**
 * The full ladder, because the cascade enforces it: a task may not hang off a goal. That refusal is
 * the register working, so the fixture builds every rung rather than the test loosening the rule.
 */
function cascadeWithWork(state: WorkState = WorkState.InProgress): Cascade {
  const goal = acceptGoal(EMPTY_CASCADE, chart, { workId: "goal-1", title: "ship it", acceptingHatId: "cto" });
  if (!goal.ok) throw new Error(goal.reason);
  const init = decompose(goal.cascade, chart, "goal-1", [{ workId: "init-1", title: "the initiative" }]);
  if (!init.ok) throw new Error(init.reason);
  const proj = decompose(init.cascade, chart, "init-1", [{ workId: "proj-1", title: "the project" }]);
  if (!proj.ok) throw new Error(proj.reason);
  const tasks = decompose(proj.cascade, chart, "proj-1", [
    { workId: "task-1", title: "do the thing", workType: WorkType.Task },
  ]);
  if (!tasks.ok) throw new Error(tasks.reason);
  // Every rung carries the state.
  //
  // ── THIS FIXTURE CANNOT OCCUR IN PRODUCTION, AND THAT MATTERS ──────────────
  // `setState` REFUSES to mark an internal node done — a goal is delivered when the work beneath
  // it is, never by being declared complete. So a real cascade never has a goal in `Done`, and a
  // check written against `state === Done` is false by construction for every internal node.
  //
  // This fixture put every rung in `Done` and so hid exactly that bug: `hatDemand` and `idleHats`
  // both read `state === Done`, both passed here, and both kept every goal owner's hat on forever
  // in the real system. An end-to-end run found it; 2640 unit tests did not.
  //
  // Kept as-is, because several tests legitimately want "everything is in state X". Use
  // `cascadeDeliveredRealistically` below for anything that asks whether work is FINISHED.
  return { ...tasks.cascade, nodes: tasks.cascade.nodes.map((n) => ({ ...n, state })) };
}

/**
 * A cascade the production code could actually produce: the LEAF is done, and every rung above it
 * is untouched — because nothing is allowed to touch them.
 */
function cascadeDeliveredRealistically(): Cascade {
  const built = cascadeWithWork(WorkState.Open);
  return {
    nodes: built.nodes.map((node) =>
      node.workType === WorkType.Task
        ? { ...node, state: WorkState.Done, assigneeHatId: node.assigneeHatId ?? node.ownerHatId }
        : node,
    ),
  };
}

const emptyCalendar: Calendar = { blocks: [] };

function block(over: Partial<ScheduleBlock> & { hatId: string; blockId: string }): ScheduleBlock {
  return {
    blockType: ScheduleBlockType.PrioritizedWork,
    startMs: T0,
    endMs: T0 + HOUR,
    state: ScheduleBlockState.Scheduled,
    ...over,
  };
}

describe("IDLE IS A STATE, and it is visible", () => {
  test("a hat with no work and no block is idle", () => {
    const idle = idleHats(chart, EMPTY_CASCADE, emptyCalendar, T0);
    expect(idle.length).toBe(chart.hats.length);
    expect(idle[0]?.because).toBe("no_work_assigned");
  });

  test("a hat with live work is not idle", () => {
    const cascade = cascadeWithWork(WorkState.InProgress);
    const owner = cascade.nodes.find((n) => n.workId === "task-1")?.ownerHatId;
    expect(idleHats(chart, cascade, emptyCalendar, T0).some((h) => h.hatId === owner)).toBe(false);
  });

  test("a hat whose work is all DONE is idle, and says which kind of idle", () => {
    const cascade = cascadeWithWork(WorkState.Done);
    const owner = cascade.nodes.find((n) => n.workId === "task-1")?.ownerHatId;
    const found = idleHats(chart, cascade, emptyCalendar, T0).find((h) => h.hatId === owner);
    expect(found?.because).toBe("all_work_done");
  });

  test("a hat in a meeting is not idle even with nothing assigned", () => {
    const calendar: Calendar = {
      blocks: [block({ blockId: "b1", hatId: "cto", blockType: ScheduleBlockType.Meeting, state: ScheduleBlockState.Active })],
    };
    expect(idleHats(chart, EMPTY_CASCADE, calendar, T0).some((h) => h.hatId === "cto")).toBe(false);
  });

  test("a block that has ENDED does not keep a hat busy", () => {
    const calendar: Calendar = { blocks: [block({ blockId: "b1", hatId: "cto" })] };
    expect(idleHats(chart, EMPTY_CASCADE, calendar, T0 + 2 * HOUR).some((h) => h.hatId === "cto")).toBe(true);
  });
});

describe("IDLE TIME MUST PRODUCE SOMETHING", () => {
  const idle = [
    { hatId: "code_reviewer", because: "no_work_assigned" as const },
    { hatId: "architect", because: "no_work_assigned" as const },
  ];

  test("every proposal names the memory it will produce", () => {
    // The whole justification for the block. Without a required output, "the organization is
    // learning" is a claim nothing can contradict.
    for (const p of proposeSelfDirected({ idle, nowMs: T0, concurrency: 2 })) {
      expect(p.produces.key.length).toBeGreaterThan(0);
      expect(p.produces.scope).toBe(p.hatId);
    }
  });

  test("what a hat learns belongs to the HAT, so the next wearer inherits it", () => {
    const p = proposeSelfDirected({ idle, nowMs: T0 })[0];
    expect(p?.produces.tier).toBe(MemoryTier.Hat);
  });

  test("not every idle hat is booked — spare capacity stays visibly spare", () => {
    // Filling every calendar would make the organization look busy at the moment its capacity is
    // free, and capacity that reads as busy never gets used.
    expect(proposeSelfDirected({ idle, nowMs: T0, concurrency: 1 }).length).toBe(1);
  });

  test("the same state proposes the same thing, so a calendar replays", () => {
    const a = proposeSelfDirected({ idle, nowMs: T0, cycle: 3 });
    const b = proposeSelfDirected({ idle: [...idle].reverse(), nowMs: T0, cycle: 3 });
    expect(a).toEqual(b);
  });

  test("the subject rotates, so a hat does not study one thing forever", () => {
    const first = proposeSelfDirected({ idle, nowMs: T0, cycle: 0, concurrency: 2 });
    const later = proposeSelfDirected({ idle, nowMs: T0, cycle: 1, concurrency: 2 });
    expect(first[0]?.kind).not.toBe(later[0]?.kind);
  });

  test("a completed study block writes a memory at STUDY confidence, not delivery confidence", () => {
    const p = proposeSelfDirected({ idle, nowMs: T0, cycle: 0 })[0];
    if (p === undefined) throw new Error("no proposal");
    const write = memoryFromSelfDirected(p, "The archiver writes the row before the blob.", T0);
    expect(write?.value).toContain("archiver");
    // Studying forms a belief; delivering finds out whether it was right. The number says which.
    expect(write?.confidence).toBeLessThan(0.6);
    expect(write?.contextHint).toContain(p.kind);
  });

  test("a block that found nothing writes NOTHING rather than proving itself", () => {
    const p = proposeSelfDirected({ idle, nowMs: T0, cycle: 0 })[0];
    if (p === undefined) throw new Error("no proposal");
    expect(memoryFromSelfDirected(p, "   ", T0)).toBeUndefined();
  });

  test("tending memory writes no new memory — it confirms what is already there", () => {
    const tend = {
      hatId: "code_reviewer",
      kind: SelfDirectedKind.TendMemory,
      startMs: T0,
      endMs: T0 + HOUR,
      subject: "its own memory",
      produces: { tier: MemoryTier.Hat, scope: "code_reviewer", key: "k" },
    } as const;
    expect(memoryFromSelfDirected(tend, "all still true", T0)).toBeUndefined();
  });

  test("a proposal becomes a FreeTime block on the calendar", () => {
    const p = proposeSelfDirected({ idle, nowMs: T0 })[0];
    if (p === undefined) throw new Error("no proposal");
    expect(blockForProposal(p, 0).blockType).toBe(ScheduleBlockType.FreeTime);
  });
});

describe("A PERSON OUTRANKS THE SCHEDULE, and the cost is recorded", () => {
  const busy: Calendar = {
    blocks: [
      block({ blockId: "work-1", hatId: "code_reviewer", startMs: T0, endMs: T0 + 2 * HOUR }),
      block({ blockId: "work-2", hatId: "code_reviewer", startMs: T0 + 3 * HOUR, endMs: T0 + 4 * HOUR }),
      block({ blockId: "other", hatId: "architect", startMs: T0, endMs: T0 + HOUR }),
    ],
  };

  test("the conversation takes the slot now", () => {
    const r = preemptForConversation(busy, { hatId: "code_reviewer", nowMs: T0, durationMs: HOUR, withHuman: "Max" });
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    const talk = r.preemption.calendar.blocks.find((b) => b.blockId === r.preemption.conversationBlockId);
    expect(talk?.startMs).toBe(T0);
    expect(talk?.blockType).toBe(ScheduleBlockType.Meeting);
    expect(talk?.state).toBe(ScheduleBlockState.Active);
  });

  test("displaced work MOVES rather than disappearing, keeping its length", () => {
    const r = preemptForConversation(busy, { hatId: "code_reviewer", nowMs: T0, durationMs: HOUR, withHuman: "Max" });
    if (!r.ok) throw new Error("unreachable");
    const moved = r.preemption.calendar.blocks.find((b) => b.blockId === "work-1");
    expect(moved?.startMs).toBe(T0 + HOUR);
    expect((moved?.endMs ?? 0) - (moved?.startMs ?? 0)).toBe(2 * HOUR);
  });

  test("the displacement is REPORTED — an interruption has a cost and it is not hidden", () => {
    const r = preemptForConversation(busy, { hatId: "code_reviewer", nowMs: T0, durationMs: HOUR, withHuman: "Max" });
    if (!r.ok) throw new Error("unreachable");
    expect(r.preemption.displaced).toEqual([{ blockId: "work-1", byMs: HOUR }]);
  });

  test("work that does not overlap is left alone", () => {
    const r = preemptForConversation(busy, { hatId: "code_reviewer", nowMs: T0, durationMs: HOUR, withHuman: "Max" });
    if (!r.ok) throw new Error("unreachable");
    expect(r.preemption.calendar.blocks.find((b) => b.blockId === "work-2")?.startMs).toBe(T0 + 3 * HOUR);
  });

  test("another hat's calendar is untouched", () => {
    const r = preemptForConversation(busy, { hatId: "code_reviewer", nowMs: T0, durationMs: HOUR, withHuman: "Max" });
    if (!r.ok) throw new Error("unreachable");
    expect(r.preemption.calendar.blocks.find((b) => b.blockId === "other")?.startMs).toBe(T0);
  });

  test("a conversation may NOT displace another conversation", () => {
    // Two people cannot both have the agent's attention, and letting the second arrival take the
    // slot would silently cancel the first person's meeting while they were sitting in it.
    const inRoom: Calendar = {
      blocks: [
        block({
          blockId: "talk-1", hatId: "code_reviewer", blockType: ScheduleBlockType.Meeting,
          state: ScheduleBlockState.Active, startMs: T0, endMs: T0 + HOUR,
        }),
      ],
    };
    const r = preemptForConversation(inRoom, { hatId: "code_reviewer", nowMs: T0, durationMs: HOUR, withHuman: "Someone else" });
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toContain("already in");
  });

  test("a cancelled block does not block a conversation, because it holds no slot", () => {
    const cancelled: Calendar = {
      blocks: [
        block({
          blockId: "talk-x", hatId: "code_reviewer", blockType: ScheduleBlockType.Meeting,
          state: ScheduleBlockState.Canceled, startMs: T0, endMs: T0 + HOUR,
        }),
      ],
    };
    expect(preemptForConversation(cancelled, { hatId: "code_reviewer", nowMs: T0, durationMs: HOUR, withHuman: "Max" }).ok).toBe(true);
  });

  test("a conversation with nobody, or of no length, is refused", () => {
    expect(preemptForConversation(busy, { hatId: "x", nowMs: T0, durationMs: 0, withHuman: "Max" }).ok).toBe(false);
    expect(preemptForConversation(busy, { hatId: "x", nowMs: T0, durationMs: HOUR, withHuman: " " }).ok).toBe(false);
  });
});

describe("AN AGENT RE-PLANS ITS OWN DAY WHEN WORK LANDS", () => {
  const HOUR_MS = 3_600_000;

  function blockOf(blockType: ScheduleBlockType, startMs: number, blockId: string): ScheduleBlock {
    return {
      blockId,
      hatId: "architect",
      blockType,
      startMs,
      endMs: startMs + HOUR_MS,
      state: ScheduleBlockState.Scheduled,
    };
  }

  test("work displaces a study hour, and the delay is RECORDED rather than absorbed", () => {
    const calendar: Calendar = { blocks: [blockOf(ScheduleBlockType.FreeTime, T0, "free-1")] };
    const out = replanForWork(calendar, {
      hatId: "architect",
      nowMs: T0,
      durationMs: HOUR_MS,
      workItemId: "task-1",
    });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.replan.displaced).toEqual([{ blockId: "free-1", byMs: HOUR_MS }]);
    // MOVED, not cancelled. Cancelling would make the organisation look instantly available and
    // quietly lose the reading.
    const moved = out.replan.calendar.blocks.find((b) => b.blockId === "free-1");
    expect(moved?.startMs).toBe(T0 + HOUR_MS);
    expect(moved?.endMs).toBe(T0 + 2 * HOUR_MS);
    expect(out.replan.calendar.blocks.some((b) => b.blockType === ScheduleBlockType.PrioritizedWork)).toBe(true);
  });

  test("a MEETING is not moved for work — it is other people's time", () => {
    const calendar: Calendar = { blocks: [blockOf(ScheduleBlockType.Meeting, T0, "mtg-1")] };
    const out = replanForWork(calendar, {
      hatId: "architect",
      nowMs: T0,
      durationMs: HOUR_MS,
      workItemId: "task-1",
    });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.replan.displaced).toEqual([]);
    expect(out.replan.kept.map((k) => k.blockId)).toEqual(["mtg-1"]);
    // And the work is NOT booked on top of it: a calendar that says two things happen at once has
    // stopped being an answer to "what is this hat doing".
    expect(out.replan.calendar.blocks.length).toBe(1);
  });

  test("work already in progress is not moved for other work", () => {
    const calendar: Calendar = { blocks: [blockOf(ScheduleBlockType.PrioritizedWork, T0, "work-1")] };
    const out = replanForWork(calendar, {
      hatId: "architect",
      nowMs: T0,
      durationMs: HOUR_MS,
      workItemId: "task-2",
    });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.replan.kept.map((k) => k.blockId)).toEqual(["work-1"]);
  });

  test("REFUSING says why, so 'the work did not start' has an answer", () => {
    const calendar: Calendar = { blocks: [blockOf(ScheduleBlockType.Meeting, T0, "mtg-1")] };
    const out = replanForWork(calendar, {
      hatId: "architect",
      nowMs: T0,
      durationMs: HOUR_MS,
      workItemId: "task-1",
    });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.replan.kept[0]?.because).toContain("other people's time");
  });

  test("another hat's blocks are never touched", () => {
    const calendar: Calendar = {
      blocks: [{ ...blockOf(ScheduleBlockType.FreeTime, T0, "free-other"), hatId: "cto" }],
    };
    const out = replanForWork(calendar, {
      hatId: "architect",
      nowMs: T0,
      durationMs: HOUR_MS,
      workItemId: "task-1",
    });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.replan.displaced).toEqual([]);
    expect(out.replan.calendar.blocks.find((b) => b.blockId === "free-other")?.startMs).toBe(T0);
  });

  test("an hour that does not overlap is left alone", () => {
    const calendar: Calendar = { blocks: [blockOf(ScheduleBlockType.FreeTime, T0 + 5 * HOUR_MS, "free-later")] };
    const out = replanForWork(calendar, {
      hatId: "architect",
      nowMs: T0,
      durationMs: HOUR_MS,
      workItemId: "task-1",
    });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.replan.displaced).toEqual([]);
  });

  test("work with no duration or no item is refused rather than booked as nothing", () => {
    const calendar: Calendar = { blocks: [] };
    const base = { hatId: "architect", nowMs: T0, durationMs: HOUR_MS, workItemId: "task-1" };
    expect(replanForWork(calendar, { ...base, durationMs: 0 }).ok).toBe(false);
    expect(replanForWork(calendar, { ...base, workItemId: "  " }).ok).toBe(false);
  });
});

describe("A DELIVERED GOAL RELEASES ITS HAT", () => {
  test("demand ignores a goal whose work is DELIVERED, though its own state is never `done`", () => {
    // The defect an end-to-end run found: the organisation finished its work and three hats stayed
    // on through four consecutive idle runs, so it could never go quiet and could never sleep.
    const cascade = cascadeDeliveredRealistically();

    // The premise, asserted rather than assumed — if this ever stops holding, the test below is
    // testing nothing and should say so loudly.
    const goal = cascade.nodes.find((node) => node.workType === WorkType.Goal);
    expect(goal?.state).not.toBe(WorkState.Done);

    expect(hatDemand(cascade)).toEqual([]);
  });

  test("the owner of a delivered goal is IDLE, and can be offered an hour to read", () => {
    const cascade = cascadeDeliveredRealistically();
    const idle = idleHats(chart, cascade, emptyCalendar, T0);
    const owners = new Set(cascade.nodes.map((node) => node.ownerHatId));
    for (const owner of owners) {
      if (owner === undefined) continue;
      expect(idle.some((h) => h.hatId === owner)).toBe(true);
    }
  });

  test("work that is NOT delivered still holds every hat above it", () => {
    // The other direction, and the one that stops the fix from becoming "always release".
    const cascade = cascadeWithWork(WorkState.InProgress);
    const demanded = new Set(hatDemand(cascade).map((d) => d.hatId));
    const owners = cascade.nodes.map((node) => node.ownerHatId).filter((o): o is string => o !== undefined);
    for (const owner of owners) expect(demanded.has(owner)).toBe(true);
  });

  test("a goal with a done leaf and an unfinished sibling is NOT released", () => {
    const base = cascadeWithWork(WorkState.Open);
    const withTwo = decompose(base, chart, "proj-1", [
      { workId: "task-2", title: "the other thing", workType: WorkType.Task },
    ]);
    if (!withTwo.ok) throw new Error(withTwo.reason);
    const halfDone: Cascade = {
      nodes: withTwo.cascade.nodes.map((node) =>
        node.workId === "task-1"
          ? { ...node, state: WorkState.Done, assigneeHatId: node.assigneeHatId ?? node.ownerHatId }
          : node,
      ),
    };
    expect(hatDemand(halfDone).length).toBeGreaterThan(0);
  });

  test("a CANCELED item releases its hat too, and does not count as delivered", () => {
    const cascade = cascadeWithWork(WorkState.Canceled);
    expect(hatDemand(cascade)).toEqual([]);
  });
});

describe("WORKING, IN A ROOM, STUDYING, OR ASLEEP", () => {
  const ALL = ["a", "b", "c", "d"];

  test("every hat gets exactly one state — the census is TOTAL", () => {
    // A census of only the interesting ones lets the sleeping majority go unreported, which is the
    // half that says whether the organisation is doing anything at all.
    const p = presenceOf({ allHatIds: ALL, demandedHatIds: ["a"], studying: [{ hatId: "b", subject: "s" }], inMeeting: ["c"] });
    expect(p.map((x) => x.hatId)).toEqual(["a", "b", "c", "d"]);
    expect(p.map((x) => x.presence)).toEqual([
      Presence.Working,
      Presence.Studying,
      Presence.InAMeeting,
      Presence.Asleep,
    ]);
  });

  test("a hat with work is NEVER asleep, whatever else it was offered", () => {
    const p = presenceOf({
      allHatIds: ["a"],
      demandedHatIds: ["a"],
      studying: [{ hatId: "a", subject: "s" }],
      inMeeting: ["a"],
    });
    // Precedence, and it is the order a person would give: you are in the room ABOUT the work.
    expect(p[0]?.presence).toBe(Presence.Working);
  });

  test("a meeting outranks a study block — the room takes the hour", () => {
    const p = presenceOf({ allHatIds: ["a"], demandedHatIds: [], studying: [{ hatId: "a", subject: "s" }], inMeeting: ["a"] });
    expect(p[0]?.presence).toBe(Presence.InAMeeting);
  });

  test("a studying hat is not asleep, and says what it is reading", () => {
    const p = presenceOf({ allHatIds: ["a"], demandedHatIds: [], studying: [{ hatId: "a", subject: "the parser" }], inMeeting: [] });
    expect(p[0]?.presence).toBe(Presence.Studying);
    expect(p[0]?.subject).toBe("the parser");
  });

  test("ASLEEP CARRIES A REASON — without one it is indistinguishable from stuck", () => {
    const p = presenceOf({ allHatIds: ["a"], demandedHatIds: [], studying: [], inMeeting: [] });
    expect(p[0]?.presence).toBe(Presence.Asleep);
    expect(p[0]?.because.length).toBeGreaterThan(0);
  });

  test("an empty organisation has an empty census, not a fabricated one", () => {
    expect(presenceOf({ allHatIds: [], demandedHatIds: ["ghost"], studying: [], inMeeting: [] })).toEqual([]);
  });

  test("the summary counts every state, including the boring one", () => {
    const p = presenceOf({ allHatIds: ALL, demandedHatIds: ["a"], studying: [{ hatId: "b", subject: "s" }], inMeeting: ["c"] });
    const line = presenceSummary(p);
    expect(line).toContain("1 working");
    expect(line).toContain("1 in a meeting");
    expect(line).toContain("1 studying");
    expect(line).toContain("1 asleep");
  });
});

describe("SLEEP ENDS — otherwise it is a hole, not a state", () => {
  test("a hat that was asleep and is now needed is reported as waking", () => {
    const before = presenceOf({ allHatIds: ["a", "b"], demandedHatIds: [], studying: [], inMeeting: [] });
    expect(waking(before, ["b"])).toEqual(["b"]);
  });

  test("a hat that was already working is not reported as waking", () => {
    // Otherwise every busy hat reads as "just woke" on every tick and the organisation looks like
    // it springs to life continuously, which would make the signal meaningless.
    const before = presenceOf({ allHatIds: ["a"], demandedHatIds: ["a"], studying: [], inMeeting: [] });
    expect(waking(before, ["a"])).toEqual([]);
  });

  test("a hat that was STUDYING is not woken — it was already up", () => {
    const before = presenceOf({ allHatIds: ["a"], demandedHatIds: [], studying: [{ hatId: "a", subject: "s" }], inMeeting: [] });
    expect(waking(before, ["a"])).toEqual([]);
  });

  test("with no previous census nobody is woken", () => {
    expect(waking([], ["a", "b"])).toEqual([]);
  });

  test("a sleeping hat nobody needs stays asleep", () => {
    const before = presenceOf({ allHatIds: ["a", "b"], demandedHatIds: [], studying: [], inMeeting: [] });
    expect(waking(before, [])).toEqual([]);
  });

  test("a state this build does not recognise is refused, not read as asleep", () => {
    // The census is stored as a plain string so an older log stays readable. A value that is no
    // longer a known state must be DROPPED — treating it as `asleep` would report a hat as
    // sleeping on the strength of not being understood.
    expect(isPresence("asleep")).toBe(true);
    expect(isPresence("working")).toBe(true);
    expect(isPresence("on_holiday")).toBe(false);
    expect(isPresence("")).toBe(false);
  });
});

describe("MEETINGS HAPPEN FOR A REASON, and the reason is computable", () => {
  const T = T0;

  test("a gate that rejected the same work twice puts the author and the reviewer in a room", () => {
    const m = proposeMeetings({
      nowMs: T,
      repeatedRejections: [
        { workId: "task-1", gate: "peer_review", authorHatId: "brd_author", reviewerHatId: "brd_reviewer", attempts: 2 },
      ],
    });
    expect(m.length).toBe(1);
    expect(m[0]?.reason).toBe(MeetingReason.RepeatedRejection);
    expect([...(m[0]?.attendeeHatIds ?? [])].sort()).toEqual(["brd_author", "brd_reviewer"]);
  });

  test("ONE rejection is not a disagreement — no meeting", () => {
    // A standing meeting nobody can cancel is how an organization stops noticing it is not working.
    expect(
      proposeMeetings({
        nowMs: T,
        repeatedRejections: [
          { workId: "task-1", gate: "peer_review", authorHatId: "a", reviewerHatId: "b", attempts: 1 },
        ],
      }),
    ).toEqual([]);
  });

  test("nobody meets themselves", () => {
    expect(
      proposeMeetings({
        nowMs: T,
        repeatedRejections: [
          { workId: "task-1", gate: "g", authorHatId: "same", reviewerHatId: "same", attempts: 5 },
        ],
      }),
    ).toEqual([]);
  });

  test("work held for a person longer than a day is worth asking about", () => {
    const m = proposeMeetings({
      nowMs: T,
      heldForPeople: [
        {
          workId: "task-1",
          gate: "architecture_approval",
          ownerHatId: "architect",
          heldSinceMs: T - 2 * 24 * HOUR * 24,
          escalateToHatId: "chief_architect",
        },
      ],
    });
    expect(m[0]?.reason).toBe(MeetingReason.StalledOnAPerson);
    expect(m[0]?.about).toContain("day(s)");
    expect(m[0]?.attendeeHatIds).toEqual(["architect", "chief_architect"]);
  });

  test("a wait is never reported as SHORTER than it was", () => {
    // The defect this pins. `Math.floor(ms / one day)` said "1 day(s)" for a hold 47h58m old,
    // because the walk advances the clock by a minute and a hold started at 09:01 is never a whole
    // number of days at 09:00. A duration a person decides from must not round toward comfortable.
    const almostTwoDays = 48 * HOUR - 2 * 60_000;
    const m = proposeMeetings({
      nowMs: T,
      heldForPeople: [
        {
          workId: "task-1",
          gate: "g",
          ownerHatId: "architect",
          heldSinceMs: T - almostTwoDays,
          escalateToHatId: "chief_architect",
        },
      ],
    });
    expect(m[0]?.about).toContain("47 hour(s)");
    expect(m[0]?.about).not.toContain("1 day");
  });

  test("past two days it says days, rounded rather than truncated", () => {
    const m = proposeMeetings({
      nowMs: T,
      heldForPeople: [
        {
          workId: "task-1",
          gate: "g",
          ownerHatId: "architect",
          heldSinceMs: T - (72 * HOUR - 60_000),
          escalateToHatId: "chief_architect",
        },
      ],
    });
    expect(m[0]?.about).toContain("3 day(s)");
  });

  test("a stalled hold with NOBODY to escalate to proposes nothing", () => {
    // `scheduleMeeting` refuses fewer than two attendees, because a one-person block is a work
    // block and calling it a meeting would let a hat manufacture an unavailability nobody else is
    // party to. So a proposal with one attendee could never be booked — a check that always fails
    // at the calendar reports a busy organisation and produces an empty one.
    expect(
      proposeMeetings({
        nowMs: T,
        heldForPeople: [
          { workId: "task-1", gate: "g", ownerHatId: "ceo", heldSinceMs: T - 30 * 24 * HOUR },
        ],
      }),
    ).toEqual([]);
  });

  test("a hat is never escalated to itself", () => {
    expect(
      proposeMeetings({
        nowMs: T,
        heldForPeople: [
          {
            workId: "task-1",
            gate: "g",
            ownerHatId: "architect",
            heldSinceMs: T - 30 * 24 * HOUR,
            escalateToHatId: "architect",
          },
        ],
      }),
    ).toEqual([]);
  });

  test("held for an hour is not stalled", () => {
    expect(
      proposeMeetings({
        nowMs: T,
        heldForPeople: [{ workId: "task-1", gate: "g", ownerHatId: "h", heldSinceMs: T - HOUR }],
      }),
    ).toEqual([]);
  });

  test("an unresolved blocker brings in the raiser and whoever was already asked, and nobody else", () => {
    // Widening it further would be a meeting held to spread responsibility rather than resolve.
    const m = proposeMeetings({
      nowMs: T,
      unresolvedBlockers: [
        { blockerId: "b-1", about: "the vendor will not answer", raisedByHatId: "architect", askedHatIds: ["cto", "architect"] },
      ],
    });
    expect([...(m[0]?.attendeeHatIds ?? [])].sort()).toEqual(["architect", "cto"]);
  });

  test("two hats believing different things about one key meet about it", () => {
    const m = proposeMeetings({
      nowMs: T,
      memoryConflicts: [{ key: "review:rollback", scopes: ["code_reviewer", "architect"] }],
    });
    expect(m[0]?.reason).toBe(MeetingReason.ConflictingMemory);
    expect(m[0]?.about).toContain("one of them is wrong");
  });

  test("one scope is not a conflict", () => {
    expect(proposeMeetings({ nowMs: T, memoryConflicts: [{ key: "k", scopes: ["only"] }] })).toEqual([]);
  });

  test("EVERY meeting names what must come out of it", () => {
    // A meeting whose output is optional can always report success.
    const m = proposeMeetings({
      nowMs: T,
      repeatedRejections: [{ workId: "w", gate: "g", authorHatId: "a", reviewerHatId: "b", attempts: 3 }],
      unresolvedBlockers: [{ blockerId: "b1", about: "x", raisedByHatId: "a", askedHatIds: [] }],
      memoryConflicts: [{ key: "k", scopes: ["a", "b"] }],
    });
    expect(m.length).toBe(3);
    for (const one of m) expect(one.mustProduce.length).toBeGreaterThan(10);
  });

  test("the same state proposes the same meetings, so a calendar replays", () => {
    const input = {
      nowMs: T,
      repeatedRejections: [
        { workId: "b", gate: "g", authorHatId: "x", reviewerHatId: "y", attempts: 2 },
        { workId: "a", gate: "g", authorHatId: "x", reviewerHatId: "y", attempts: 2 },
      ],
    };
    expect(proposeMeetings(input).map((x) => x.meetingId)).toEqual(
      proposeMeetings({ ...input, repeatedRejections: [...input.repeatedRejections].reverse() }).map((x) => x.meetingId),
    );
  });

  test("a meeting becomes one calendar leg per attendee, sharing an id", () => {
    const m = proposeMeetings({
      nowMs: T,
      repeatedRejections: [{ workId: "w", gate: "g", authorHatId: "a", reviewerHatId: "b", attempts: 2 }],
    })[0];
    if (m === undefined) throw new Error("no meeting");
    const blocks = blocksForMeeting(m);
    expect(blocks.length).toBe(2);
    expect(new Set(blocks.map((b) => b.meetingId)).size).toBe(1);
    expect(blocks.every((b) => b.blockType === ScheduleBlockType.Meeting)).toBe(true);
  });

  test("nothing happening proposes nothing — an empty calendar is a legitimate answer", () => {
    expect(proposeMeetings({ nowMs: T })).toEqual([]);
  });
});

describe("A MEETING OWES AN OUTPUT", () => {
  const meeting = () => {
    const m = proposeMeetings({
      nowMs: T0,
      repeatedRejections: [{ workId: "w", gate: "g", authorHatId: "a", reviewerHatId: "b", attempts: 2 }],
    })[0];
    if (m === undefined) throw new Error("no meeting");
    return m;
  };

  test("producing nothing is a shortfall, and the shortfall names what was owed", () => {
    const short = meetingShortfall(meeting(), "   ");
    expect(short).toContain("produced nothing");
    expect(short).toContain("acceptance criterion");
  });

  test("'we discussed it' is not an outcome", () => {
    expect(meetingShortfall(meeting(), "We discussed it.")).toContain("not what it decided");
  });

  test("a real decision is not a shortfall", () => {
    expect(
      meetingShortfall(
        meeting(),
        "Agreed: the acceptance criterion is that archival writes the blob before the row, and the reviewer will check call ORDER rather than presence.",
      ),
    ).toBeUndefined();
  });

  test("a long account that starts with 'reviewed' is still an outcome", () => {
    // The guard is for a SHORT attendance note, not for any sentence beginning with a verb.
    const long = "Reviewed the two positions and settled on the stricter one: the reviewer checks call order, and the author adds a test that fails when the order is swapped.";
    expect(meetingShortfall(meeting(), long)).toBeUndefined();
  });
});

describe("A HAT IS WORN, NOT OWNED", () => {
  test("demand is the live work that needs each authority", () => {
    const demand = hatDemand(cascadeWithWork(WorkState.InProgress));
    expect(demand.length).toBeGreaterThan(0);
    expect(demand.every((d) => d.forWorkIds.length > 0)).toBe(true);
  });

  test("finished work creates no demand", () => {
    expect(hatDemand(cascadeWithWork(WorkState.Done))).toEqual([]);
  });

  test("a hat with work to do is donned", () => {
    const demand = hatDemand(cascadeWithWork());
    const decisions = decideHats({ demand, worn: [], calendar: emptyCalendar, nowMs: T0 });
    expect(decisions.every((d) => d.move === HatMove.Don)).toBe(true);
    expect(decisions[0]?.reason).toContain("work needs this authority");
  });

  test("a hat already worn with work stays on", () => {
    const demand = hatDemand(cascadeWithWork());
    const worn = demand.map((d) => d.hatId);
    const decisions = decideHats({ demand, worn, calendar: emptyCalendar, nowMs: T0 });
    expect(decisions.every((d) => d.move === HatMove.Keep)).toBe(true);
  });

  test("a hat with nothing left to do is taken off", () => {
    const decisions = decideHats({ demand: [], worn: ["code_reviewer"], calendar: emptyCalendar, nowMs: T0 });
    expect(decisions[0]?.move).toBe(HatMove.Doff);
  });

  test("a hat is NEVER taken off somebody mid-room", () => {
    // The room's record would otherwise be signed by an authority that had already been revoked.
    const inRoom: Calendar = {
      blocks: [
        block({
          blockId: "m", hatId: "code_reviewer", blockType: ScheduleBlockType.Meeting,
          state: ScheduleBlockState.Active, startMs: T0, endMs: T0 + HOUR,
        }),
      ],
    };
    const decisions = decideHats({ demand: [], worn: ["code_reviewer"], calendar: inRoom, nowMs: T0 });
    expect(decisions[0]?.move).toBe(HatMove.Keep);
    expect(decisions[0]?.reason).toContain("meeting");
  });

  test("a meeting that has ended does not keep a hat on forever", () => {
    const past: Calendar = {
      blocks: [
        block({
          blockId: "m", hatId: "code_reviewer", blockType: ScheduleBlockType.Meeting,
          state: ScheduleBlockState.Active, startMs: T0, endMs: T0 + HOUR,
        }),
      ],
    };
    expect(decideHats({ demand: [], worn: ["code_reviewer"], calendar: past, nowMs: T0 + 2 * HOUR })[0]?.move).toBe(HatMove.Doff);
  });
});
