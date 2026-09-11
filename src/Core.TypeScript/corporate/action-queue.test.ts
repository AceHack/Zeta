/**
 * action-queue.test.ts — a request that vanished with no trace is worse than one refused.
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { appendAction, queueProblems, readActions } from "./action-queue";
import { acceptAction, HumanActionKind, type HumanAction } from "./human-action";

const dir = () => mkdtempSync(join(tmpdir(), "aq-"));
const make = (over: Record<string, unknown>): HumanAction => {
  const r = acceptAction({ kind: HumanActionKind.PauseRun, byHuman: "max", subjectId: "run", reason: "checking", ...over });
  if (!r.ok) throw new Error(r.reason);
  return r.action;
};

describe("THE QUEUE IS THE INBOUND PATH, AND IT IS DULL ON PURPOSE", () => {
  test("an action written is an action read back", () => {
    const d = dir();
    appendAction(make({ atMs: 5, actionId: "a" }), d);
    const back = readActions(d);
    expect(back).toHaveLength(1);
    expect(back[0]?.byHuman).toBe("max");
    expect(back[0]?.reason).toBe("checking");
  });

  test("ordered by the ACTION'S clock, not by filename or write order", () => {
    const d = dir();
    appendAction(make({ atMs: 30, actionId: "zzz" }), d);
    appendAction(make({ atMs: 10, actionId: "aaa" }), d);
    appendAction(make({ atMs: 20, actionId: "mmm" }), d);
    expect(readActions(d).map((a) => a.actionId)).toEqual(["aaa", "mmm", "zzz"]);
  });

  test("IDEMPOTENT by id — a retried click does not approve twice", () => {
    const d = dir();
    const a = make({ atMs: 1, actionId: "same" });
    appendAction(a, d);
    appendAction(a, d);
    expect(readActions(d)).toHaveLength(1);
  });

  test("a missing queue is EMPTY, not an error", () => {
    expect(readActions(join(tmpdir(), "queue-that-is-not-there-" + String(Date.now())))).toEqual([]);
  });

  test("one malformed file does not make the queue unreadable", () => {
    // A bad request must not become an outage for every other request.
    const d = dir();
    appendAction(make({ atMs: 1, actionId: "good" }), d);
    writeFileSync(join(d, "broken.json"), "{ not json", "utf-8");
    writeFileSync(join(d, "noreason.json"), JSON.stringify({ kind: "pause_run", byHuman: "x", subjectId: "y" }), "utf-8");
    expect(readActions(d).map((a) => a.actionId)).toEqual(["good"]);
  });

  test("but the bad files are REPORTED — nothing vanishes without a trace", () => {
    const d = dir();
    writeFileSync(join(d, "broken.json"), "{ not json", "utf-8");
    writeFileSync(join(d, "noreason.json"), JSON.stringify({ kind: "pause_run", byHuman: "x", subjectId: "y" }), "utf-8");
    const problems = queueProblems(d);
    expect(problems.map((p) => p.file).sort()).toEqual(["broken.json", "noreason.json"]);
    expect(problems.find((p) => p.file === "noreason.json")?.reason).toContain("reason is required");
  });

  test("a hostile id cannot escape the queue directory", () => {
    // The property is CONTAINMENT, not the absence of dots. The separators are what would let an id
    // traverse, and they are replaced; a filename that merely contains ".." sits harmlessly inside
    // the directory. An earlier version of this test asserted no-dots and failed on a safe path,
    // which would have sent me editing working code to satisfy a wrong assertion.
    const d = dir();
    const path = appendAction(make({ atMs: 1, actionId: "../../escape" }), d);
    expect(path.startsWith(d)).toBe(true);
    expect(path.includes("/")).toBe(path.slice(d.length).includes("/"));
    expect(readActions(d)).toHaveLength(1);
  });
});
