/**
 * tools/observe/execute.test.ts — the impure twin (free_time + self_reflect slice).
 *
 * Verifies: execute appends FIRST then transitions via `simulate`; the executed
 * world is identical to the pure `simulate` path; effectful kinds are
 * `not-yet-executable`; append failure surfaces as feedback (never throws).
 */

import { describe, expect, it } from "bun:test";
import { simulate, type NextAction, type World } from "./observe";
import { execute, type AppendOutcome, type EventSink } from "./execute";
import { fakeExecutor, type RunOutcome } from "./do-item";

/** A fake sink that records appends and replies with a fixed outcome. */
function fakeSink(outcome: AppendOutcome = { ok: true, eventId: "evt-1" }): EventSink & { appended: NextAction[] } {
  const appended: NextAction[] = [];
  return {
    appended,
    append: (action: NextAction): Promise<AppendOutcome> => {
      appended.push(action);
      return Promise.resolve(outcome);
    },
  };
}

const emptyWorld: World = { backlog: [] };
const freeTime: NextAction = { kind: "free_time", reason: "rest" };
const selfReflect: NextAction = { kind: "self_reflect", reason: "journal" };

describe("execute — free_time + self_reflect slice", () => {
  it("executes free_time: appends the event then sets mode via simulate", async () => {
    const sink = fakeSink();
    const r = await execute(emptyWorld, freeTime, sink);
    expect(r.ok).toBe(true);
    expect(sink.appended).toEqual([freeTime]); // appended FIRST
    if (r.ok) {
      expect(r.world.mode).toBe("free_time");
      expect(r.appended).toBe(freeTime);
      expect(r.eventId).toBe("evt-1");
    }
  });

  it("executes self_reflect: appends + sets mode", async () => {
    const sink = fakeSink();
    const r = await execute(emptyWorld, selfReflect, sink);
    expect(r.ok).toBe(true);
    expect(sink.appended).toEqual([selfReflect]);
    if (r.ok) expect(r.world.mode).toBe("self_reflect");
  });

  it("executed world is IDENTICAL to the pure simulate path (single reducer)", async () => {
    const sink = fakeSink();
    const r = await execute(emptyWorld, freeTime, sink);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.world).toEqual(simulate(emptyWorld, freeTime));
  });

  it("returns not-yet-executable for kinds that still lack wired effects", async () => {
    const item = { id: "B-1", title: "x", ready: true, ambiguous: false };
    const notYet: NextAction[] = [
      { kind: "preserve_ferry", reason: "ferry" },
      { kind: "respond_to_operator", reason: "op spoke" },
      { kind: "decompose", item },
      { kind: "edit_grammar", reason: "needs new action", item },
    ];
    for (const action of notYet) {
      const sink = fakeSink();
      const r = await execute(emptyWorld, action, sink);
      expect(r.ok).toBe(false);
      expect(sink.appended).toEqual([]); // not-yet-executable → nothing appended
      if (!r.ok) {
        expect(r.feedback.kind).toBe("not-yet-executable");
        if (r.feedback.kind === "not-yet-executable") expect(r.feedback.actionKind).toBe(action.kind);
      }
    }
  });

  it("do_item returns not-yet-executable when no executor is provided", async () => {
    const item = { id: "B-1", title: "x", ready: true, ambiguous: false };
    const sink = fakeSink();
    const r = await execute(emptyWorld, { kind: "do_item", item }, sink);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.feedback.kind).toBe("not-yet-executable");
  });

  it("surfaces append failure as feedback (no transition, never throws)", async () => {
    const sink = fakeSink({ ok: false, reason: "remote ahead" });
    const r = await execute(emptyWorld, freeTime, sink);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.feedback.kind).toBe("append-failed");
      if (r.feedback.kind === "append-failed") {
        expect(r.feedback.actionKind).toBe("free_time");
        expect(r.feedback.reason).toBe("remote ahead");
      }
    }
  });

  it("does NOT advance the world when the append fails", async () => {
    const sink = fakeSink({ ok: false, reason: "sink down" });
    const r = await execute(emptyWorld, selfReflect, sink);
    // caller keeps the prior world; execute reports failure, no mode change leaked
    expect(r.ok).toBe(false);
  });
});

describe("execute — explore + play slice (zero-effect, mode-set)", () => {
  const explore: NextAction = { kind: "explore", reason: "self-directed making" };
  const play: NextAction = { kind: "play", reason: "leisure" };

  it("executes explore: appends + sets mode", async () => {
    const sink = fakeSink();
    const r = await execute(emptyWorld, explore, sink);
    expect(r.ok).toBe(true);
    expect(sink.appended).toEqual([explore]);
    if (r.ok) expect(r.world.mode).toBe("explore");
  });

  it("executes play: appends + sets mode", async () => {
    const sink = fakeSink();
    const r = await execute(emptyWorld, play, sink);
    expect(r.ok).toBe(true);
    expect(sink.appended).toEqual([play]);
    if (r.ok) expect(r.world.mode).toBe("play");
  });

  it("executed world matches pure simulate path", async () => {
    const sink = fakeSink();
    const r = await execute(emptyWorld, explore, sink);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.world).toEqual(simulate(emptyWorld, explore));
  });
});

describe("execute — do_item with injected executor", () => {
  const item = { id: "B-42", title: "ship the feature", ready: true, ambiguous: false };
  const doItem: NextAction = { kind: "do_item", item };
  const worldWithItem: World = { backlog: [item] };
  const successOutcome: RunOutcome = { ok: true, stdout: "done", exitCode: 0 };
  const failOutcome: RunOutcome = { ok: false, reason: "exit 1", exitCode: 1, stderr: "error" };

  it("do_item succeeds: item leaves backlog, world transitions", async () => {
    const sink = fakeSink();
    const executor = fakeExecutor(successOutcome);
    const opts = { spec: { script: "echo done" }, gated: false };
    const r = await execute(worldWithItem, doItem, sink, executor, opts);
    expect(r.ok).toBe(true);
    if (r.ok) {
      // item should be gone from the backlog
      expect(r.world.backlog.find((i) => i.id === "B-42")).toBeUndefined();
      expect(r.world.mode).toBe("work");
    }
  });

  it("do_item fails: item stays in backlog, still reports ok (machinery worked)", async () => {
    const sink = fakeSink();
    const executor = fakeExecutor(failOutcome);
    const opts = { spec: { script: "failing-cmd" }, gated: false };
    const r = await execute(worldWithItem, doItem, sink, executor, opts);
    expect(r.ok).toBe(true);
    if (r.ok) {
      // item stays in backlog (work failed, not machinery)
      expect(r.world.backlog.find((i) => i.id === "B-42")).toBeDefined();
      expect(r.world.mode).toBe("work");
    }
  });

  it("do_item with append failure surfaces as feedback", async () => {
    const sink = fakeSink({ ok: false, reason: "disk full" });
    const executor = fakeExecutor(successOutcome);
    const opts = { spec: { script: "echo done" }, gated: false };
    const r = await execute(worldWithItem, doItem, sink, executor, opts);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.feedback.kind).toBe("append-failed");
    }
  });
});
