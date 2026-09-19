import { describe, expect, test } from "bun:test";
import { judge, classifyAnalyzeRun } from "./audit-sast-covers-main.ts";

const c = (sha: string, ok: number, bad = 0) => ({ sha, successfulAnalyze: ok, unsuccessfulAnalyze: bad });

describe("SAST coverage premise", () => {
  test("all commits scanned passes", () => {
    expect(judge([c("a".repeat(40), 5), c("b".repeat(40), 5)]).ok).toBe(true);
  });

  // THE FORCING CASE, and the reason this file exists. A cancelled Analyze run still
  // CREATES a check run, so a checker that counts run EXISTENCE reports full coverage over
  // a commit nothing actually scanned. That error was made while investigating this alert:
  // counting commits that "have Analyze check-runs" gave 30/30 while a third of the
  // workflow runs on main were being cancelled.
  test("a commit with only UNSUCCESSFUL Analyze runs is UNSCANNED, not covered", () => {
    const v = judge([c("a".repeat(40), 0, 3)]);
    expect(v.ok).toBe(false);
    expect(v.unscanned.length).toBe(1);
    expect(v.scanned).toBe(0);
  });

  test("one unscanned commit among many fails, and names it", () => {
    const v = judge([c("a".repeat(40), 5), c("b".repeat(40), 0), c("c".repeat(40), 5)]);
    expect(v.ok).toBe(false);
    expect(v.unscanned).toEqual(["b".repeat(40)]);
    expect(v.message).toContain("bbbbbbbbb");
  });

  test("the message names the premise it is guarding", () => {
    expect(judge([c("a".repeat(40), 0)]).message).toContain("Scorecard #24");
  });

  // An empty sample is UNKNOWN-shaped: it must not read as "nothing unscanned, therefore ok".
  test("zero commits FAILS rather than passing vacuously", () => {
    const v = judge([]);
    expect(v.ok).toBe(false);
    expect(v.message).toContain("not-evaluated is not satisfied");
  });

  // A commit scanned successfully AND carrying a cancelled run is covered -- the cancellation
  // is noted, never counted either way.
  test("success alongside a cancelled run is still covered, and is reported as degraded", () => {
    const v = judge([c("a".repeat(40), 4, 1)]);
    expect(v.ok).toBe(true);
    expect(v.degraded).toEqual(["a".repeat(40)]);
  });

  test("scanned counts commits, not runs", () => {
    expect(judge([c("a".repeat(40), 10), c("b".repeat(40), 10)]).scanned).toBe(2);
  });
});

describe("an Analyze still in flight is UNDECIDED, not uncovered", () => {
  // The false alarm that produced this block: run 35404883426, 2026-09-18. `drift (loud)`
  // read main's LIVE newest-30 during its own 23:34:25-23:38:33 window, `4ad5d300e` landed
  // at 23:37:49, and the audit called it a premise violation for having no successful
  // Analyze 12 seconds after it was pushed. No commit could have satisfied that.

  test("a commit whose only Analyze runs are in flight does NOT fail the premise", () => {
    const v = judge([
      { sha: "aaaaaaaaa", successfulAnalyze: 1, unsuccessfulAnalyze: 0 },
      { sha: "bbbbbbbbb", successfulAnalyze: 0, unsuccessfulAnalyze: 0, pendingAnalyze: 2 },
    ]);
    expect(v.ok).toBe(true);
    expect(v.pending).toEqual(["bbbbbbbbb"]);
    expect(v.unscanned).toEqual([]);
  });

  // THE GUARD THAT KEEPS THE ABOVE FROM BEING A HOLE. If "pending" could be reached by a
  // commit nothing ever analysed, this audit would pass forever on an empty CI.
  test("a commit with NO Analyze runs at all is still UNSCANNED and still fails", () => {
    const v = judge([{ sha: "ccccccccc", successfulAnalyze: 0, unsuccessfulAnalyze: 0 }]);
    expect(v.ok).toBe(false);
    expect(v.unscanned).toEqual(["ccccccccc"]);
    expect(v.pending).toEqual([]);
  });

  test("a commit whose Analyze FINISHED without success is still UNSCANNED", () => {
    const v = judge([{ sha: "ddddddddd", successfulAnalyze: 0, unsuccessfulAnalyze: 3, pendingAnalyze: 0 }]);
    expect(v.ok).toBe(false);
    expect(v.unscanned).toEqual(["ddddddddd"]);
  });

  test("pending commits are not counted as scanned -- the accounting stays honest", () => {
    const v = judge([
      { sha: "eeeeeeeee", successfulAnalyze: 1, unsuccessfulAnalyze: 0 },
      { sha: "fffffffff", successfulAnalyze: 0, unsuccessfulAnalyze: 0, pendingAnalyze: 1 },
    ]);
    expect(v.scanned).toBe(1);
    expect(v.message).toContain("1 of 2");
    expect(v.message).toContain("UNDECIDED");
  });

  test("a real unscanned commit still fails even when another is pending", () => {
    const v = judge([
      { sha: "111111111", successfulAnalyze: 0, unsuccessfulAnalyze: 0, pendingAnalyze: 1 },
      { sha: "222222222", successfulAnalyze: 0, unsuccessfulAnalyze: 1 },
    ]);
    expect(v.ok).toBe(false);
    expect(v.unscanned).toEqual(["222222222"]);
    expect(v.pending).toEqual(["111111111"]);
  });
});

describe("classifyAnalyzeRun reads STATUS, not a null conclusion", () => {
  test("a finished success is coverage", () => {
    expect(classifyAnalyzeRun({ conclusion: "success", status: "completed" })).toBe("success");
  });

  test("in_progress and queued are pending", () => {
    expect(classifyAnalyzeRun({ conclusion: null, status: "in_progress" })).toBe("pending");
    expect(classifyAnalyzeRun({ conclusion: null, status: "queued" })).toBe("pending");
  });

  // The distinction the comment in the source exists for: a COMPLETED run can carry a null
  // conclusion, and excusing those as in-flight would hide real holes behind the fix.
  test("a COMPLETED run with a null conclusion is unsuccessful, NOT pending", () => {
    expect(classifyAnalyzeRun({ conclusion: null, status: "completed" })).toBe("unsuccessful");
  });

  test("an absent status fails closed -- old fixtures read as completed", () => {
    expect(classifyAnalyzeRun({ conclusion: null })).toBe("unsuccessful");
    expect(classifyAnalyzeRun({ conclusion: "cancelled" })).toBe("unsuccessful");
  });
});
