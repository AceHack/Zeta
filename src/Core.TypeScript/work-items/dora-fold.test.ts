import { describe, expect, it } from "bun:test";
import {
  computeDoraMetrics,
  foldWorkItemTimelines,
  leadTimeSamples,
  openCountsByType,
  throughputByUtcWeek,
  utcWeekStart,
} from "./dora-fold";
import { makeClosedEvent, makeCreatedEvent, makeStateChangedEvent, mintWorkItemEventIdHex } from "./types";
import { DETERMINISTIC_ENV } from "../zeta-id/zeta-id";

const WI_TASK = "081KSXN940008QG0R002FWR9B2";
const WI_BUG = "081KSXN940008QG0R002KEJ7C2";
const mintAt = (ms: number) => mintWorkItemEventIdHex(DETERMINISTIC_ENV, ms);

describe("utcWeekStart", () => {
  it("returns UTC Monday for mid-week timestamps", () => {
    expect(utcWeekStart("2026-07-01T15:00:00.000Z")).toBe("2026-06-29"); // Wed → Mon
  });
});

describe("foldWorkItemTimelines", () => {
  it("records created type and done timestamp", () => {
    const t0 = Date.UTC(2026, 6, 1, 10, 0, 0);
    const t1 = Date.UTC(2026, 6, 3, 10, 0, 0);
    const events = [
      makeCreatedEvent(
        {
          workItemId: WI_TASK,
          type: "task",
          title: "T",
          slug: "t",
          priority: "P2",
          filename: `${WI_TASK}-t.md`,
        },
        "otto",
        t0,
        mintAt,
      ),
      makeStateChangedEvent({ workItemId: WI_TASK, from: "backlog", to: "done" }, "otto", t1, mintAt),
    ];
    const tl = foldWorkItemTimelines(events).get(WI_TASK)!;
    expect(tl.type).toBe("task");
    expect(tl.createdAt).toBe("2026-07-01T10:00:00.000Z");
    expect(tl.doneAt).toBe("2026-07-03T10:00:00.000Z");
  });
});

describe("leadTimeSamples", () => {
  it("computes created → done duration", () => {
    const t0 = Date.UTC(2026, 6, 1, 0, 0, 0);
    const t1 = Date.UTC(2026, 6, 2, 12, 0, 0); // 36h
    const events = [
      makeCreatedEvent(
        {
          workItemId: WI_TASK,
          type: "task",
          title: "T",
          slug: "t",
          priority: "P2",
          filename: `${WI_TASK}-t.md`,
        },
        "otto",
        t0,
        mintAt,
      ),
      makeStateChangedEvent({ workItemId: WI_TASK, from: "in-progress", to: "done" }, "otto", t1, mintAt),
    ];
    const samples = leadTimeSamples(foldWorkItemTimelines(events));
    expect(samples).toHaveLength(1);
    expect(samples[0]!.leadTimeMs).toBe(36 * 60 * 60 * 1000);
  });
});

describe("openCountsByType", () => {
  it("counts open backlog items by task vs bug", () => {
    const t0 = Date.UTC(2026, 6, 1, 0, 0, 0);
    const events = [
      makeCreatedEvent(
        {
          workItemId: WI_TASK,
          type: "task",
          title: "T",
          slug: "t",
          priority: "P2",
          filename: `${WI_TASK}-t.md`,
        },
        "otto",
        t0,
        mintAt,
      ),
      makeCreatedEvent(
        {
          workItemId: WI_BUG,
          type: "bug",
          title: "B",
          slug: "b",
          priority: "P1",
          filename: `${WI_BUG}-b.md`,
        },
        "otto",
        t0 + 1,
        mintAt,
      ),
      makeStateChangedEvent({ workItemId: WI_BUG, from: "backlog", to: "done" }, "otto", t0 + 2, mintAt),
    ];
    expect(openCountsByType(events)).toEqual({ task: 1, bug: 0, total: 1 });
  });
});

describe("throughputByUtcWeek", () => {
  it("Bag-folds done completions per UTC week and type", () => {
    const mon = Date.UTC(2026, 5, 29, 12, 0, 0); // 2026-06-29 Monday
    const wed = Date.UTC(2026, 6, 1, 12, 0, 0); // 2026-07-01 Wednesday (same week)
    const nextMon = Date.UTC(2026, 6, 6, 12, 0, 0); // 2026-07-06 Monday
    const events = [
      makeCreatedEvent(
        {
          workItemId: WI_TASK,
          type: "task",
          title: "T",
          slug: "t",
          priority: "P2",
          filename: `${WI_TASK}-t.md`,
        },
        "otto",
        mon - 86400000,
        mintAt,
      ),
      makeCreatedEvent(
        {
          workItemId: WI_BUG,
          type: "bug",
          title: "B",
          slug: "b",
          priority: "P1",
          filename: `${WI_BUG}-b.md`,
        },
        "otto",
        mon - 86400000,
        mintAt,
      ),
      makeStateChangedEvent({ workItemId: WI_TASK, from: "backlog", to: "done" }, "otto", wed, mintAt),
      makeStateChangedEvent({ workItemId: WI_BUG, from: "backlog", to: "done" }, "otto", nextMon, mintAt),
    ];
    const rows = throughputByUtcWeek(events);
    expect(rows).toEqual([
      { weekStart: "2026-06-29", taskCompletions: 1, bugCompletions: 0, totalCompletions: 1 },
      { weekStart: "2026-07-06", taskCompletions: 0, bugCompletions: 1, totalCompletions: 1 },
    ]);
  });
});

describe("computeDoraMetrics", () => {
  it("aggregates open, lead-time, and throughput folds", () => {
    const t0 = Date.UTC(2026, 6, 1, 0, 0, 0);
    const t1 = Date.UTC(2026, 6, 2, 0, 0, 0);
    const events = [
      makeCreatedEvent(
        {
          workItemId: WI_TASK,
          type: "task",
          title: "T",
          slug: "t",
          priority: "P2",
          filename: `${WI_TASK}-t.md`,
        },
        "otto",
        t0,
        mintAt,
      ),
      makeStateChangedEvent({ workItemId: WI_TASK, from: "backlog", to: "done" }, "otto", t1, mintAt),
      makeCreatedEvent(
        {
          workItemId: WI_BUG,
          type: "bug",
          title: "B",
          slug: "b",
          priority: "P1",
          filename: `${WI_BUG}-b.md`,
        },
        "otto",
        t1,
        mintAt,
      ),
      makeClosedEvent({ workItemId: WI_BUG, reason: "dup" }, "otto", t1 + 1, mintAt),
    ];
    const m = computeDoraMetrics(events);
    expect(m.openByType.total).toBe(0);
    expect(m.leadTime.count).toBe(1);
    expect(m.leadTime.averageMs).toBe(24 * 60 * 60 * 1000);
    expect(m.throughputByWeek[0]?.totalCompletions).toBe(1);
  });
});
