import { describe, expect, test } from "bun:test";
import { judge } from "./audit-sast-covers-main.ts";

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
