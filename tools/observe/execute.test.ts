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

  it("returns not-yet-executable for EVERY non-executable kind (allowlist gate — no append attempted)", async () => {
    // All 7 currently non-executable kinds (the 9 NextAction kinds minus the 2
    // executable ones, free_time + self_reflect). Exhaustive so a future change
    // can't make one append without an explicit test update.
    const item = { id: "B-1", title: "x", ready: true, ambiguous: false };
    const effectful: NextAction[] = [
      { kind: "preserve_ferry", reason: "ferry" },
      { kind: "respond_to_operator", reason: "op spoke" },
      { kind: "do_item", item },
      { kind: "decompose", item },
      { kind: "explore", reason: "make" },
      { kind: "play", reason: "play" },
      { kind: "edit_grammar", reason: "needs new action", item },
    ];
    for (const action of effectful) {
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
