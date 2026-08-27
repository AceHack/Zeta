// flush-lane-debounce.test.ts — the falsifiers.
//
// A debounce is the easiest thing in CI to get silently wrong in the expensive direction. Two
// opposite failures, and only one of them is loud:
//
//   SKIPS TOO MUCH  -> the lane goes quiet and looks healthy. Silence that looks like health is
//                      the failure class this repository is built against, and nothing in CI will
//                      report it.
//   SKIPS TOO LITTLE -> the supersession churn it was written to fix simply continues, and the
//                      only symptom is a metric nobody is watching.
//
// So the tests are weighted toward the first: every path that could starve the lane is pinned
// open, and the ONE path that skips is pinned closed.

import { describe, expect, test } from "bun:test";
import { decide, parsePriorRun, type PriorRun } from "./flush-lane-debounce.ts";

const NOW = new Date("2026-08-27T21:00:00Z");
const ago = (min: number): string => new Date(NOW.getTime() - min * 60000).toISOString();
const MAX = 45;

describe("it skips only while the previous tick is genuinely still in gate", () => {
  test("a young in-flight run SKIPS — the one case that must say no", () => {
    // The whole point of the module. Measured: pushes 6-11 min apart cancelled gate; 13+ did not.
    const d = decide({ status: "in_progress", startedAt: ago(8) }, NOW, MAX);
    expect(d.shouldRun).toBe(false);
    expect(d.reason).toMatch(/SKIPPING this tick/);
  });

  test("every not-finished status counts as in flight, not just in_progress", () => {
    // `queued` was the one that mattered in practice: a queued run has not started burning
    // minutes, and superseding it wastes the queue position rather than the compute.
    for (const status of ["in_progress", "queued", "waiting", "requested", "pending"]) {
      expect(decide({ status, startedAt: ago(5) }, NOW, MAX).shouldRun).toBe(false);
    }
  });

  test("a COMPLETED run proceeds — otherwise the lane would never tick again", () => {
    // The control. Without it, an implementation that always skipped would pass every
    // skip-assertion above and starve the lane permanently.
    for (const status of ["completed", "success", "failure", "cancelled"]) {
      expect(decide({ status, startedAt: ago(5) }, NOW, MAX).shouldRun).toBe(true);
    }
  });
});

describe("it fails OPEN — a broken observer must never starve the lane", () => {
  test("no readable run proceeds", () => {
    expect(decide({ status: null, startedAt: null }, NOW, MAX).shouldRun).toBe(true);
  });

  test("in flight but no start time proceeds", () => {
    expect(decide({ status: "in_progress", startedAt: null }, NOW, MAX).shouldRun).toBe(true);
  });

  test("an unparseable start time proceeds", () => {
    const d = decide({ status: "in_progress", startedAt: "not-a-date" }, NOW, MAX);
    expect(d.shouldRun).toBe(true);
    expect(d.reason).toMatch(/fail open/);
  });

  test("a STUCK run past the cutoff proceeds — a hung gate cannot own the lane forever", () => {
    // Without this the worst case is permanent: one wedged gate run silences the lane and the
    // silence is indistinguishable from a quiet repo.
    const d = decide({ status: "in_progress", startedAt: ago(46) }, NOW, MAX);
    expect(d.shouldRun).toBe(true);
    expect(d.reason).toMatch(/treating as stuck/);
  });

  test("the cutoff boundary is inclusive, and one minute under it still skips", () => {
    expect(decide({ status: "in_progress", startedAt: ago(45) }, NOW, MAX).shouldRun).toBe(true);
    expect(decide({ status: "in_progress", startedAt: ago(44) }, NOW, MAX).shouldRun).toBe(false);
  });

  test("clock skew (a run starting in the future) does NOT proceed", () => {
    // Negative age is skew between GitHub and the runner. Skew is not evidence the run finished,
    // so the safe reading is still-in-flight. Proceeding here would reintroduce the supersession
    // this module exists to stop, on exactly the runs that are freshest.
    const future = new Date(NOW.getTime() + 3 * 60000).toISOString();
    expect(decide({ status: "in_progress", startedAt: future }, NOW, MAX).shouldRun).toBe(false);
  });
});

describe("a skip is never silent", () => {
  test("every decision carries a reason, including the ones that proceed", () => {
    const cases: PriorRun[] = [
      { status: "in_progress", startedAt: ago(8) },
      { status: "completed", startedAt: ago(8) },
      { status: null, startedAt: null },
      { status: "in_progress", startedAt: ago(90) },
    ];
    for (const c of cases) expect(decide(c, NOW, MAX).reason.length).toBeGreaterThan(20);
  });
});

describe("parsing the Actions API shape", () => {
  test("a real run object yields both fields", () => {
    const r = parsePriorRun(JSON.stringify({ status: "in_progress", run_started_at: "2026-08-27T20:51:14Z", id: 1 }));
    expect(r).toEqual({ status: "in_progress", startedAt: "2026-08-27T20:51:14Z" });
  });

  test("`null` — what the API returns when the lane has no runs — is an absent run, not a crash", () => {
    expect(parsePriorRun("null")).toEqual({ status: null, startedAt: null });
  });

  test("malformed JSON is an absent run, so a monitoring outage does not become a lane outage", () => {
    // Deliberately not a throw. If reading the observer fails, the lane must still tick.
    expect(parsePriorRun("{not json")).toEqual({ status: null, startedAt: null });
    expect(parsePriorRun("")).toEqual({ status: null, startedAt: null });
  });

  test("wrong-typed fields degrade to null rather than being coerced", () => {
    expect(parsePriorRun(JSON.stringify({ status: 7, run_started_at: false }))).toEqual({
      status: null,
      startedAt: null,
    });
  });

  test("end to end: an in-flight API response skips, a completed one proceeds", () => {
    const inflight = JSON.stringify({ status: "in_progress", run_started_at: ago(10) });
    const done = JSON.stringify({ status: "completed", run_started_at: ago(10) });
    expect(decide(parsePriorRun(inflight), NOW, MAX).shouldRun).toBe(false);
    expect(decide(parsePriorRun(done), NOW, MAX).shouldRun).toBe(true);
  });
});
