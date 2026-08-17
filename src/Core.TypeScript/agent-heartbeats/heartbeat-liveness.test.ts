import { describe, expect, it } from "bun:test";

import {
  DEFAULT_STALE_AFTER_MINUTES,
  assessHeartbeatLiveness,
  extractRuns,
  type HeartbeatRunRecord,
} from "./heartbeat-liveness";

const NOW = new Date("2026-08-17T01:15:00Z");

function minutesBefore(minutes: number): string {
  return new Date(NOW.getTime() - minutes * 60_000).toISOString();
}

function ok(minutes: number): HeartbeatRunRecord {
  return { created_at: minutesBefore(minutes), status: "completed", conclusion: "success" };
}

function failed(minutes: number): HeartbeatRunRecord {
  return { created_at: minutesBefore(minutes), status: "completed", conclusion: "failure" };
}

describe("assessHeartbeatLiveness", () => {
  it("reports alive when a success is inside the window", () => {
    const verdict = assessHeartbeatLiveness([ok(14), failed(30)], NOW, 60);
    expect(verdict.alive).toBe(true);
    expect(verdict.ageMinutes).toBe(14);
    expect(verdict.lastSuccessAt).toBe(minutesBefore(14));
  });

  it("tolerates GitHub's measured worst-case dropped-slot gap without crying wolf", () => {
    // 43min is the largest gap between consecutive scheduled runs observed over a 25h sample
    // with the lane healthy. The default threshold exists to sit above this; if someone lowers
    // it below the noise floor, this test is what fails.
    expect(assessHeartbeatLiveness([ok(43)], NOW, DEFAULT_STALE_AFTER_MINUTES).alive).toBe(true);
  });

  // THE ALARM PATH. Each of these is an outage shape that must produce alive=false. A watchdog
  // whose negative branch is never exercised is an untested claim, so these are the point of
  // the file — not the happy path above.

  it("fires when the newest success is older than the threshold", () => {
    const verdict = assessHeartbeatLiveness([failed(5), failed(20), ok(140)], NOW, 60);
    expect(verdict.alive).toBe(false);
    expect(verdict.ageMinutes).toBe(140);
    expect(verdict.summary).toContain("NO SUCCESSFUL agent-heartbeat IN 140 MINUTES");
  });

  it("fires when runs are firing but every one of them is failing", () => {
    const verdict = assessHeartbeatLiveness([failed(2), failed(18), failed(35)], NOW, 60);
    expect(verdict.alive).toBe(false);
    expect(verdict.lastSuccessAt).toBeUndefined();
    expect(verdict.summary).toContain("no SUCCESSFUL agent-heartbeat run");
  });

  it("fires when the API returns no runs at all rather than reading emptiness as health", () => {
    // The decorative-monitor case: a renamed workflow, a token without `actions: read`, or an
    // API hiccup all look like this, and all of them must be loud.
    const verdict = assessHeartbeatLiveness([], NOW, 60);
    expect(verdict.alive).toBe(false);
    expect(verdict.consideredRuns).toBe(0);
    expect(verdict.summary).toContain("no agent-heartbeat runs were returned at all");
  });

  it("does not count a still-running run as proof of life", () => {
    const inProgress: HeartbeatRunRecord = { created_at: minutesBefore(1), status: "in_progress", conclusion: null };
    const verdict = assessHeartbeatLiveness([inProgress, ok(200)], NOW, 60);
    expect(verdict.alive).toBe(false);
    expect(verdict.ageMinutes).toBe(200);
  });

  it("does not count a cancelled run as proof of life", () => {
    const cancelled: HeartbeatRunRecord = {
      created_at: minutesBefore(3),
      status: "completed",
      conclusion: "cancelled",
    };
    expect(assessHeartbeatLiveness([cancelled, ok(90)], NOW, 60).alive).toBe(false);
  });

  it("drops unparseable timestamps instead of treating them as fresh", () => {
    // A bad timestamp defaulted to `now` would mask a real outage. Dropping it leaves the true
    // newest success (or none) to decide, so corruption degrades toward the alarm.
    const garbage: HeartbeatRunRecord = { created_at: "not-a-date", status: "completed", conclusion: "success" };
    const missing: HeartbeatRunRecord = { status: "completed", conclusion: "success" };
    const verdict = assessHeartbeatLiveness([garbage, missing], NOW, 60);
    expect(verdict.alive).toBe(false);
    expect(verdict.consideredRuns).toBe(2);
    expect(verdict.summary).toContain("no SUCCESSFUL agent-heartbeat run");
  });

  it("clamps a future-dated success to age 0 so clock skew cannot silence the alarm forever", () => {
    const skewed: HeartbeatRunRecord = { created_at: minutesBefore(-90), status: "completed", conclusion: "success" };
    const verdict = assessHeartbeatLiveness([skewed], NOW, 60);
    expect(verdict.ageMinutes).toBe(0);
    expect(verdict.alive).toBe(true);
  });

  it("picks the newest success by timestamp, not by list position", () => {
    const verdict = assessHeartbeatLiveness([ok(300), ok(10), ok(120)], NOW, 60);
    expect(verdict.ageMinutes).toBe(10);
    expect(verdict.alive).toBe(true);
  });

  it("treats the threshold as exclusive so an exactly-stale lane alarms", () => {
    expect(assessHeartbeatLiveness([ok(60)], NOW, 60).alive).toBe(false);
    expect(assessHeartbeatLiveness([ok(59)], NOW, 60).alive).toBe(true);
  });
});

describe("extractRuns", () => {
  it("accepts the full API object", () => {
    expect(extractRuns({ workflow_runs: [ok(1)] })).toHaveLength(1);
  });

  it("accepts a bare array", () => {
    expect(extractRuns([ok(1), ok(2)])).toHaveLength(2);
  });

  it("throws on an unrecognised shape rather than manufacturing an empty result", () => {
    // Returning [] here would be indistinguishable from "the lane is stopped", handing the
    // watchdog a real-looking finding it did not actually observe.
    expect(() => extractRuns({ message: "Not Found" })).toThrow(/unrecognised Actions API payload/);
    expect(() => extractRuns(null)).toThrow(/unrecognised Actions API payload/);
  });
});
