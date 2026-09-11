/**
 * run-life.test.ts — the organization at 4pm on a Tuesday with nothing in flight.
 *
 * The property under test is that the answer to "what was it doing" is never silence and never an
 * unfalsifiable claim. A tick with no learner configured says it studied nothing; a tick with one
 * writes a memory that is on disk afterwards; and a memory that has decayed to worthless is
 * actually forgotten.
 */

import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { acceptGoal, decompose, EMPTY_CASCADE, WorkState, WorkType, type Cascade } from "./goal-cascade";
import { buildOrgChart } from "./org-chart";
import { SEED_HATS } from "./org-seed";
import { MemoryPhase, MemoryTier, write } from "./memory";
import { directoryMemoryStore } from "./memory-store";
import { conflictsFor, type Calendar } from "./work-schedule";
import { knownBy, lifeSummary, lifeTick, writeMemory, type Study } from "./run-life";

// A COUNTER, NEVER `Math.random()`. Forcing every id to one value turns 9 tests red, so a
// collision fails the run — and a 6-digit random draw collides at a low-percent rate over a
// few hundred ids, which is what produced an unexplained single failure in six full runs.
// A counter also makes the run replayable, which is what made the original flake untraceable.
let idSeq = 0;

const chart = (() => {
  const r = buildOrgChart(SEED_HATS);
  if (!r.ok) throw new Error(r.reason);
  return r.chart;
})();

const T0 = 1_700_000_000_000;
const DAY = 86_400_000;
const emptyCalendar: Calendar = { blocks: [] };

const roots: string[] = [];
function tempStore() {
  const dir = mkdtempSync(join(tmpdir(), "zeta-life-"));
  roots.push(dir);
  return directoryMemoryStore(dir);
}
afterEach(() => {
  while (roots.length > 0) {
    const d = roots.pop();
    if (d !== undefined) rmSync(d, { recursive: true, force: true });
  }
});

function withWork(state: WorkState): Cascade {
  const goal = acceptGoal(EMPTY_CASCADE, chart, { workId: "g", title: "ship", acceptingHatId: "cto" });
  if (!goal.ok) throw new Error(goal.reason);
  const i = decompose(goal.cascade, chart, "g", [{ workId: "i", title: "init" }]);
  if (!i.ok) throw new Error(i.reason);
  const p = decompose(i.cascade, chart, "i", [{ workId: "p", title: "proj" }]);
  if (!p.ok) throw new Error(p.reason);
  const t = decompose(p.cascade, chart, "p", [{ workId: "t", title: "task", workType: WorkType.Task }]);
  if (!t.ok) throw new Error(t.reason);
  return { ...t.cascade, nodes: t.cascade.nodes.map((n) => ({ ...n, state })) };
}

const found: Study = () => ({ ok: true, found: "The archiver writes the row before the blob." });

describe("A TICK WITH NO LEARNER SAYS SO", () => {
  test("hats are still idle and blocks are still proposed", async () => {
    const report = await lifeTick({ chart, cascade: EMPTY_CASCADE, calendar: emptyCalendar, nowMs: T0, worn: [], concurrency: 2 });
    expect(report.idle.length).toBeGreaterThan(0);
    expect(report.studied.length).toBe(2);
  });

  test("but nothing was learned, and the reason is given", async () => {
    // The alternative — reporting a study block as productive with no learner — would make "the
    // organization is learning" true by construction.
    const report = await lifeTick({ chart, cascade: EMPTY_CASCADE, calendar: emptyCalendar, nowMs: T0, worn: [], concurrency: 1 });
    expect(report.memoriesWritten).toBe(0);
    expect(report.studied[0]?.wrote).toBe(false);
    expect(report.studied[0]?.reason).toContain("nothing was configured");
  });

  test("the facts still record that the time was spent", async () => {
    const report = await lifeTick({ chart, cascade: EMPTY_CASCADE, calendar: emptyCalendar, nowMs: T0, worn: [], concurrency: 1 });
    const block = report.facts.find((f) => f.kind === "self_directed");
    expect(block).toBeDefined();
    // The intended output travels with the block, so a block that produced nothing is visible later.
    expect((block as { producesKey?: string }).producesKey?.length).toBeGreaterThan(0);
  });
});

describe("A TICK WITH A LEARNER WRITES SOMETHING THAT IS THERE AFTERWARDS", () => {
  test("the memory is on disk, readable, and attributed to the hat", async () => {
    const store = tempStore();
    const report = await lifeTick({
      chart, cascade: EMPTY_CASCADE, calendar: emptyCalendar, nowMs: T0, worn: [],
      store, study: found, concurrency: 1, cycle: 0,
    });
    expect(report.memoriesWritten).toBe(1);
    const loaded = store.load();
    expect(loaded.length).toBe(1);
    expect(loaded[0]?.content.value).toContain("archiver");
    expect(loaded[0]?.content.tier).toBe(MemoryTier.Hat);
  });

  test("a study that FAILS is reported and writes nothing", async () => {
    const store = tempStore();
    const broken: Study = () => ({ ok: false, reason: "could not read the repository" });
    const report = await lifeTick({
      chart, cascade: EMPTY_CASCADE, calendar: emptyCalendar, nowMs: T0, worn: [],
      store, study: broken, concurrency: 1,
    });
    expect(report.memoriesWritten).toBe(0);
    expect(report.studied[0]?.reason).toContain("could not read");
    expect(store.load()).toEqual([]);
  });

  test("a study that THROWS is caught, not lost", async () => {
    const store = tempStore();
    const boom: Study = () => {
      throw new Error("spawn ENOENT");
    };
    const report = await lifeTick({
      chart, cascade: EMPTY_CASCADE, calendar: emptyCalendar, nowMs: T0, worn: [],
      store, study: boom, concurrency: 1,
    });
    expect(report.studied[0]?.reason).toContain("ENOENT");
  });

  test("studying the same thing twice REINFORCES rather than duplicating", async () => {
    const store = tempStore();
    await lifeTick({ chart, cascade: EMPTY_CASCADE, calendar: emptyCalendar, nowMs: T0, worn: [], store, study: found, concurrency: 1, cycle: 0 });
    await lifeTick({ chart, cascade: EMPTY_CASCADE, calendar: emptyCalendar, nowMs: T0 + DAY, worn: [], store, study: found, concurrency: 1, cycle: 0 });
    const loaded = store.load();
    expect(loaded.length).toBe(1);
    expect(loaded[0]?.state.reinforcementCount).toBe(1);
    expect(loaded[0]?.state.phase).toBe(MemoryPhase.Reinforced);
  });
});

describe("HATS GO ON WHEN THERE IS WORK AND COME OFF WHEN THERE IS NOT", () => {
  test("live work dons the hats that own it", async () => {
    const report = await lifeTick({ chart, cascade: withWork(WorkState.InProgress), calendar: emptyCalendar, nowMs: T0, worn: [] });
    expect(report.donned.length).toBeGreaterThan(0);
    expect(report.facts.some((f) => f.kind === "hat_move" && (f as { move?: string }).move === "don")).toBe(true);
  });

  test("finished work takes them off again", async () => {
    const worn = ["cto", "code_reviewer"];
    const report = await lifeTick({ chart, cascade: withWork(WorkState.Done), calendar: emptyCalendar, nowMs: T0, worn });
    expect([...report.doffed].sort()).toEqual(["code_reviewer", "cto"]);
  });

  test("a hat already worn for live work is not re-donned every tick", async () => {
    const cascade = withWork(WorkState.InProgress);
    const first = await lifeTick({ chart, cascade, calendar: emptyCalendar, nowMs: T0, worn: [] });
    const second = await lifeTick({ chart, cascade, calendar: emptyCalendar, nowMs: T0 + 1, worn: first.donned });
    expect(second.donned).toEqual([]);
  });
});

describe("WHAT IS WORTHLESS IS ACTUALLY FORGOTTEN", () => {
  test("a decayed, uncited, badly-correlated memory is archived by a tick", async () => {
    const store = tempStore();
    const made = write(undefined, {
      tier: MemoryTier.Hat, scope: "code_reviewer", key: "old-belief",
      value: "something nobody ever used", writtenBy: "code_reviewer", atMs: T0, confidence: 0,
    });
    if (!made.ok) throw new Error(made.reason);
    store.save({
      content: made.memory.content,
      state: {
        ...made.memory.state,
        phase: MemoryPhase.Active,
        freshnessAtMs: T0 - 400 * DAY,
        utility: { injectedCount: 20, citedCount: 0, lastInjectedAtMs: T0 },
        outcome: { successCount: 0, failureCount: 10, inconclusiveCount: 0, lastOutcomeAtMs: T0, workItemsObserved: [] },
      },
    });

    const report = await lifeTick({ chart, cascade: EMPTY_CASCADE, calendar: emptyCalendar, nowMs: T0, worn: [], store, concurrency: 0 });
    expect(report.memoriesArchived).toBe(1);
    expect(store.load()[0]?.state.phase).toBe(MemoryPhase.Archived);
    // And the fact carries the WEIGHT, so the decision is checkable rather than asserted.
    const fact = report.facts.find((f) => f.kind === "memory_phase") as { weight?: number } | undefined;
    expect(fact?.weight).toBeLessThanOrEqual(0.15);
  });

  test("a PROMOTION is proposed but never applied by the clock", async () => {
    // Promotion is a hat's decision. Applying one here because a counter moved would be exactly the
    // authority-by-arithmetic this register refuses everywhere else.
    const store = tempStore();
    const made = write(undefined, {
      tier: MemoryTier.Hat, scope: "code_reviewer", key: "widely-true",
      value: "everyone learned this", writtenBy: "code_reviewer", atMs: T0, confidence: 0.9,
    });
    if (!made.ok) throw new Error(made.reason);
    store.save({
      content: made.memory.content,
      state: { ...made.memory.state, phase: MemoryPhase.Active, crossScope: { distinctScopes: ["a", "b", "c"], firstObservedAtMs: T0, lastObservedAtMs: T0 } },
    });
    const report = await lifeTick({ chart, cascade: EMPTY_CASCADE, calendar: emptyCalendar, nowMs: T0, worn: [], store, concurrency: 0 });
    expect(store.load()[0]?.state.phase).toBe(MemoryPhase.Active);
    expect(report.facts.some((f) => f.kind === "memory_phase")).toBe(false);
  });

  test("a healthy memory is left alone", async () => {
    const store = tempStore();
    const made = write(undefined, {
      tier: MemoryTier.Hat, scope: "code_reviewer", key: "good", value: "still true",
      writtenBy: "code_reviewer", atMs: T0, confidence: 0.9,
    });
    if (!made.ok) throw new Error(made.reason);
    store.save({ content: made.memory.content, state: { ...made.memory.state, phase: MemoryPhase.Active } });
    const report = await lifeTick({ chart, cascade: EMPTY_CASCADE, calendar: emptyCalendar, nowMs: T0, worn: [], store, concurrency: 0 });
    expect(report.memoriesArchived).toBe(0);
    expect(report.memoriesStale).toBe(0);
  });
});

describe("WHAT A HAT ALREADY KNOWS", () => {
  test("its own memory comes back, heaviest first, and the archived stays buried", () => {
    const store = tempStore();
    for (const [key, value, conf] of [["a", "weak thing", 0.2], ["b", "strong thing", 0.95]] as const) {
      const made = write(undefined, { tier: MemoryTier.Hat, scope: "code_reviewer", key, value, writtenBy: "x", atMs: T0, confidence: conf });
      if (!made.ok) throw new Error(made.reason);
      store.save({ content: made.memory.content, state: { ...made.memory.state, phase: MemoryPhase.Active } });
    }
    const dead = write(undefined, { tier: MemoryTier.Hat, scope: "code_reviewer", key: "c", value: "forgotten thing", writtenBy: "x", atMs: T0 });
    if (!dead.ok) throw new Error(dead.reason);
    store.save({ content: dead.memory.content, state: { ...dead.memory.state, phase: MemoryPhase.Archived } });

    const known = knownBy(store, "code_reviewer", T0);
    expect(known[0]).toBe("strong thing");
    expect(known).not.toContain("forgotten thing");
  });

  test("another hat's memory is not returned", () => {
    const store = tempStore();
    const made = write(undefined, { tier: MemoryTier.Hat, scope: "architect", key: "a", value: "theirs", writtenBy: "x", atMs: T0 });
    if (!made.ok) throw new Error(made.reason);
    store.save(made.memory);
    expect(knownBy(store, "code_reviewer", T0)).toEqual([]);
  });
});

describe("A PROTECTED MEMORY REFUSES THE WRITE RATHER THAN BEING OVERWRITTEN", () => {
  test("writeMemory returns undefined and the value stands", () => {
    const store = tempStore();
    const made = write(undefined, {
      tier: MemoryTier.Org, scope: "org", key: "legal", value: "Legal reviews public copy.",
      writtenBy: "human", atMs: T0, protected: true,
    });
    if (!made.ok) throw new Error(made.reason);
    store.save(made.memory);
    const attempt = writeMemory(store, {
      tier: MemoryTier.Org, scope: "org", key: "legal", value: "Actually nobody reviews it.",
      writtenBy: "code_reviewer", atMs: T0 + 1,
    });
    expect(attempt).toBeUndefined();
    expect(store.load()[0]?.content.value).toContain("Legal reviews");
  });
});

describe("A MEETING SAYS WHAT CAME OUT OF IT", () => {
  const MEETING_DEMAND = {
    nowMs: T0,
    unresolvedBlockers: [
      { blockerId: "blk-1", about: "which retention window applies", raisedByHatId: "architect", askedHatIds: ["cto"] },
    ],
  };

  async function tickWith(hold?: (p: { readonly meetingId: string }) => { ok: true; produced: string } | { ok: false; reason: string }) {
    return lifeTick({
      chart,
      cascade: EMPTY_CASCADE,
      calendar: emptyCalendar,
      nowMs: T0,
      worn: [],
      concurrency: 1,
      createId: (p) => `${p}-t-${String(++idSeq)}`,
      meetings: MEETING_DEMAND,
      ...(hold === undefined ? {} : { hold: hold as never }),
    });
  }

  test("a meeting that produced something records WHAT", async () => {
    const report = await tickWith(() => ({ ok: true, produced: "raise it out of the organisation" }));
    expect(report.met.length).toBeGreaterThan(0);
    expect(report.meetingOutcomes[0]?.produced).toBe("raise it out of the organisation");
    expect(report.meetingOutcomes[0]?.reason).toBeUndefined();
  });

  test("EMPTY OUTPUT IS RECORDED, not dropped — that is the finding, not the failure", async () => {
    // A register that kept only the meetings which produced something would report every meeting
    // as productive. "We met and nothing came of it" is precisely what a meeting register exists
    // to surface, and it is the claim `mustProduce` was written to make checkable.
    const report = await tickWith(() => ({ ok: true, produced: "   " }));
    expect(report.met.length).toBeGreaterThan(0);
    expect(report.meetingOutcomes.length).toBe(report.met.length);
    expect(report.meetingOutcomes[0]?.produced).toBe("");
    expect(report.meetingOutcomes[0]?.reason).toContain("produced nothing");
  });

  test("with NO facilitator the meeting is still booked and says nobody held it", async () => {
    const report = await tickWith(undefined);
    expect(report.met.length).toBeGreaterThan(0);
    expect(report.meetingOutcomes[0]?.produced).toBe("");
    expect(report.meetingOutcomes[0]?.reason).toContain("nobody was configured");
  });

  test("a facilitator that THROWS is a meeting that produced nothing, with the error", async () => {
    const report = await tickWith(() => {
      throw new Error("the facilitator fell over");
    });
    expect(report.meetingOutcomes[0]?.produced).toBe("");
    expect(report.meetingOutcomes[0]?.reason).toContain("fell over");
  });

  test("the outcome reaches the LOG, so it survives the process", async () => {
    const report = await tickWith(() => ({ ok: true, produced: "agreed to escalate" }));
    const held = report.facts.find((f) => f.kind === "meeting_held");
    expect(held).toBeDefined();
    if (held === undefined || held.kind !== "meeting_held") return;
    expect(held.produced).toBe("agreed to escalate");
    // Carried forward so the output can be judged against what was ASKED of the meeting.
    expect(held.mustProduce.length).toBeGreaterThan(0);
  });

  test("the summary gives BOTH numbers — a count alone is attendance", async () => {
    const report = await tickWith(() => ({ ok: true, produced: "" }));
    const line = lifeSummary(report);
    expect(line).toContain("meeting(s)");
    expect(line).toContain("0 produced something");
  });
});

describe("A MEETING IS NOT BOOKED OVER AN HOUR THIS TICK JUST GAVE AWAY", () => {
  test("the free time proposed by this tick is on the calendar the meeting booker reads", async () => {
    // `input.calendar` is the fold of PRIOR runs, and a self-directed block only reaches a folded
    // calendar on the NEXT run. Without the tick feeding its own bookings forward, a meeting lands
    // straight on top of an hour a hat was given moments earlier — and both records look fine.
    const report = await lifeTick({
      chart,
      cascade: EMPTY_CASCADE,
      calendar: emptyCalendar,
      nowMs: T0,
      worn: [],
      concurrency: 4,
      createId: (p) => `${p}-test-${String(++idSeq)}`,
      meetings: {
        nowMs: T0,
        memoryConflicts: [{ key: "k", scopes: [] }],
      },
    });

    const free = report.facts.filter((f) => f.kind === "self_directed");
    expect(free.length).toBeGreaterThan(0);

    // Every free hour this tick proposed is on the calendar it returns, under the SAME id the
    // fold derives — two ids for one hour would make this tick and the next run disagree.
    for (const f of free) {
      if (f.kind !== "self_directed") continue;
      const onCalendar = report.calendar.blocks.find(
        (b) => b.blockId === `free-${f.hatId}-${String(f.startMs)}`,
      );
      expect(onCalendar).toBeDefined();
      expect(onCalendar?.hatId).toBe(f.hatId);
      expect(onCalendar?.endMs).toBe(f.endMs);
    }
  });

  test("a hat with a study block is not free for a meeting in that hour", async () => {
    const report = await lifeTick({
      chart,
      cascade: EMPTY_CASCADE,
      calendar: emptyCalendar,
      nowMs: T0,
      worn: [],
      concurrency: 2,
    });
    const block = report.facts.find((f) => f.kind === "self_directed");
    if (block === undefined || block.kind !== "self_directed") throw new Error("no study block proposed");
    // The whole point of booking it: the hour is taken, and `conflictsFor` says so.
    expect(
      conflictsFor(report.calendar, block.hatId, block.startMs + 60_000, block.startMs + 120_000).length,
    ).toBe(1);
  });
});

describe("THE SUMMARY a person reads", () => {
  test("says how many blocks actually produced something", async () => {
    const store = tempStore();
    const report = await lifeTick({
      chart, cascade: EMPTY_CASCADE, calendar: emptyCalendar, nowMs: T0, worn: [],
      store, study: found, concurrency: 2,
    });
    expect(lifeSummary(report)).toContain("study block(s) produced a memory");
    expect(lifeSummary(report)).toContain("idle");
  });
});
