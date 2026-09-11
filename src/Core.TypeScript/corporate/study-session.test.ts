/**
 * study-session.test.ts — falsifiers for study being bounded.
 *
 * The property is that a hat RUNS OUT. A budget that is computed and never enforced is the vacuity
 * class, so the tests that matter are the ones where the answer is no: the third session of the day
 * must be refused, and the refusal must say why rather than quietly handing back a shorter one.
 */

import { stringCompare } from "../collation/collation.ts";
import { describe, expect, test } from "bun:test";
import {
  DEFAULT_STUDY_BUDGET,
  hatsWithStudyLeft,
  isStudyBlock,
  openStudySession,
  remainingStudy,
  STUDY_BLOCK_TYPE,
  studySpentIn,
  type StudyBudget,
} from "./study-session";
import { replanForWork } from "./org-life";
import {
  EMPTY_CALENDAR,
  ScheduleBlockState,
  ScheduleBlockType,
  scheduleBlock,
  setBlockState,
  type Calendar,
} from "./work-schedule";

const HOUR = 3_600_000;
const MIN = 60_000;
const NOW = 10 * HOUR;
let idSeq = 0;
const ID = () => `id-${String(++idSeq)}`;

/** Book `n` back-to-back sessions from `startMs`, returning the calendar. */
function withSessions(n: number, startMs = NOW, budget: StudyBudget = DEFAULT_STUDY_BUDGET): Calendar {
  let calendar: Calendar = EMPTY_CALENDAR;
  for (let i = 0; i < n; i++) {
    const r = openStudySession({
      calendar,
      hatId: "architect",
      nowMs: startMs + i * budget.maxSessionMs,
      topic: `topic ${String(i)}`,
      createId: ID,
      budget,
    });
    if (!r.ok) throw new Error(`session ${String(i)} refused: ${r.because}`);
    calendar = r.calendar;
  }
  return calendar;
}

describe("a session has an end, and the allowance runs out", () => {
  test("the first session is granted at the per-session cap", () => {
    const r = openStudySession({
      calendar: EMPTY_CALENDAR,
      hatId: "architect",
      nowMs: NOW,
      topic: "pay-lite retry paths",
      createId: ID,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.session.endMs - r.session.startMs).toBe(DEFAULT_STUDY_BUDGET.maxSessionMs);
    expect(r.session.block.blockType).toBe(STUDY_BLOCK_TYPE);
  });

  test("a session never exceeds the per-session cap, however much is asked for", () => {
    const r = openStudySession({
      calendar: EMPTY_CALENDAR,
      hatId: "architect",
      nowMs: NOW,
      topic: "everything",
      createId: ID,
      requestedMs: 12 * HOUR,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.session.endMs - r.session.startMs).toBe(DEFAULT_STUDY_BUDGET.maxSessionMs);
  });

  test("THE THIRD SESSION IS REFUSED — two hours a day is two hours", () => {
    // The whole point. Without this the budget is a number nothing enforces.
    const calendar = withSessions(2);
    const r = openStudySession({
      calendar,
      hatId: "architect",
      nowMs: NOW + 2 * HOUR,
      topic: "one more thing",
      createId: ID,
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.because).toContain("allowance left");
  });

  test("the refusal says how much is left, not just that there is none", () => {
    const budget: StudyBudget = { ...DEFAULT_STUDY_BUDGET, perPeriodMs: 70 * MIN };
    const calendar = withSessions(1, NOW, budget);
    const r = openStudySession({
      calendar,
      hatId: "architect",
      nowMs: NOW + HOUR,
      topic: "next",
      createId: ID,
      budget,
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.because).toContain("10 min");
  });

  test("A SHORT REMAINDER IS REFUSED, never silently substituted", () => {
    // "You have studied enough" and "here is ten minutes" are different facts, and a caller acting
    // on the second cannot tell it got the first.
    const budget: StudyBudget = { ...DEFAULT_STUDY_BUDGET, perPeriodMs: 65 * MIN };
    const calendar = withSessions(1, NOW, budget);
    const r = openStudySession({
      calendar,
      hatId: "architect",
      nowMs: NOW + HOUR,
      topic: "next",
      createId: ID,
      budget,
    });
    expect(r.ok).toBe(false);
  });

  test("a session needs a subject", () => {
    const r = openStudySession({
      calendar: EMPTY_CALENDAR,
      hatId: "architect",
      nowMs: NOW,
      topic: "   ",
      createId: ID,
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.because).toContain("needs a subject");
  });

  test("remaining drops by exactly what was booked", () => {
    const before = remainingStudy(EMPTY_CALENDAR, "architect", NOW);
    expect(before).toBe(DEFAULT_STUDY_BUDGET.perPeriodMs);
    const calendar = withSessions(1);
    expect(remainingStudy(calendar, "architect", NOW)).toBe(
      DEFAULT_STUDY_BUDGET.perPeriodMs - DEFAULT_STUDY_BUDGET.maxSessionMs,
    );
  });

  test("the session reports what is left after it", () => {
    const r = openStudySession({
      calendar: EMPTY_CALENDAR,
      hatId: "architect",
      nowMs: NOW,
      topic: "t",
      createId: ID,
    });
    if (!r.ok) throw new Error(r.because);
    expect(r.session.remainingAfterMs).toBe(
      DEFAULT_STUDY_BUDGET.perPeriodMs - DEFAULT_STUDY_BUDGET.maxSessionMs,
    );
  });
});

describe("the budget is READ OFF THE CALENDAR, not counted", () => {
  test("one hat's study does not spend another's allowance", () => {
    const calendar = withSessions(2);
    expect(remainingStudy(calendar, "qa_engineer", NOW)).toBe(DEFAULT_STUDY_BUDGET.perPeriodMs);
  });

  test("a CANCELED session gives its budget back", () => {
    // Because spend is derived from occupying blocks rather than incremented, this falls out — and
    // a counter implementation would get it wrong without extra code.
    const calendar = withSessions(1);
    const block = calendar.blocks.find((b) => b.blockType === STUDY_BLOCK_TYPE);
    if (block === undefined) throw new Error("no study block");
    const cancelled = setBlockState(calendar, block.blockId, ScheduleBlockState.Canceled);
    if (!cancelled.ok) throw new Error(cancelled.reason);
    expect(remainingStudy(cancelled.calendar, "architect", NOW)).toBe(DEFAULT_STUDY_BUDGET.perPeriodMs);
  });

  test("non-study blocks never count against the study allowance", () => {
    const booked = scheduleBlock(EMPTY_CALENDAR, {
      blockId: "meeting-1",
      hatId: "architect",
      blockType: ScheduleBlockType.Meeting,
      startMs: NOW,
      endMs: NOW + HOUR,
      state: ScheduleBlockState.Scheduled,
    });
    if (!booked.ok) throw new Error(booked.reason);
    expect(remainingStudy(booked.calendar, "architect", NOW)).toBe(DEFAULT_STUDY_BUDGET.perPeriodMs);
  });

  test("spend is CLIPPED to the window, not counted whole", () => {
    const calendar = withSessions(1);
    // A window covering only the last 15 minutes of a 60-minute session.
    expect(studySpentIn(calendar, "architect", NOW + 45 * MIN, NOW + HOUR)).toBe(15 * MIN);
  });

  test("study far outside the period does not count", () => {
    const calendar = withSessions(1, NOW);
    const muchLater = NOW + 10 * 24 * HOUR;
    expect(remainingStudy(calendar, "architect", muchLater)).toBe(DEFAULT_STUDY_BUDGET.perPeriodMs);
  });

  test("isStudyBlock rejects a canceled session — history does not hold a slot", () => {
    const calendar = withSessions(1);
    const block = calendar.blocks.find((b) => b.blockType === STUDY_BLOCK_TYPE);
    if (block === undefined) throw new Error("no study block");
    expect(isStudyBlock(block)).toBe(true);
    expect(isStudyBlock({ ...block, state: ScheduleBlockState.Canceled })).toBe(false);
  });
});

describe("study yields to assigned work — through replanForWork", () => {
  test("A STUDY HOUR IS MOVED, NOT CANCELLED, when work needs the slot", () => {
    // The reconciliation: this module used to cancel, `replanForWork` moves. Moving keeps the
    // commitment and makes the delay visible, and the agent still gets its study.
    const calendar = withSessions(1);
    const r = replanForWork(calendar, {
      hatId: "architect",
      nowMs: NOW,
      durationMs: HOUR,
      workItemId: "ELERA-149570",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.replan.displaced).toHaveLength(1);
    expect(r.replan.kept).toEqual([]);
    const study = r.replan.calendar.blocks.find((b) => b.blockType === STUDY_BLOCK_TYPE);
    expect(study?.state).toBe(ScheduleBlockState.Scheduled);
    expect((study?.startMs ?? 0) >= NOW + HOUR).toBe(true);
  });

  test("the moved session still counts against the allowance — it was not lost", () => {
    const calendar = withSessions(1);
    const r = replanForWork(calendar, {
      hatId: "architect",
      nowMs: NOW,
      durationMs: HOUR,
      workItemId: "W-1",
    });
    if (!r.ok) return;
    const spent = DEFAULT_STUDY_BUDGET.perPeriodMs - remainingStudy(r.replan.calendar, "architect", NOW);
    expect(spent).toBe(DEFAULT_STUDY_BUDGET.maxSessionMs);
  });

  test("A MEETING IS NOT YIELDED — work does not take other people's time", () => {
    const booked = scheduleBlock(EMPTY_CALENDAR, {
      blockId: "meeting-1",
      hatId: "architect",
      blockType: ScheduleBlockType.Meeting,
      startMs: NOW,
      endMs: NOW + HOUR,
      state: ScheduleBlockState.Scheduled,
    });
    if (!booked.ok) throw new Error(booked.reason);
    const r = replanForWork(booked.calendar, {
      hatId: "architect",
      nowMs: NOW,
      durationMs: HOUR,
      workItemId: "W-1",
    });
    if (!r.ok) return;
    expect(r.replan.kept).toHaveLength(1);
    expect(r.replan.displaced).toEqual([]);
  });

  test("study outside the work window is left where it is", () => {
    const calendar = withSessions(1);
    const r = replanForWork(calendar, {
      hatId: "architect",
      nowMs: NOW + 5 * HOUR,
      durationMs: HOUR,
      workItemId: "W-1",
    });
    if (!r.ok) return;
    expect(r.replan.displaced).toEqual([]);
  });

  test("another hat's study is untouched", () => {
    const calendar = withSessions(1);
    const r = replanForWork(calendar, {
      hatId: "qa_engineer",
      nowMs: NOW,
      durationMs: HOUR,
      workItemId: "W-1",
    });
    if (!r.ok) return;
    expect(r.replan.displaced).toEqual([]);
  });
});

describe("who still has allowance", () => {
  test("a hat out of budget is not offered a session", () => {
    const calendar = withSessions(2);
    const left = hatsWithStudyLeft(calendar, ["architect", "qa_engineer"], NOW + 2 * HOUR);
    expect(left.map((h) => h.hatId)).toEqual(["qa_engineer"]);
  });

  test("the list is ordered, so the same state proposes the same way twice", () => {
    const ids = ["zeta_hat", "alpha_hat", "mid_hat"];
    const left = hatsWithStudyLeft(EMPTY_CALENDAR, ids, NOW).map((h) => h.hatId);
    expect(left).toEqual([...ids].sort((a, b) => stringCompare(a, b)));
  });

  test("everyone fresh has the full allowance", () => {
    const left = hatsWithStudyLeft(EMPTY_CALENDAR, ["a", "b"], NOW);
    for (const h of left) expect(h.remainingMs).toBe(DEFAULT_STUDY_BUDGET.perPeriodMs);
  });
});
