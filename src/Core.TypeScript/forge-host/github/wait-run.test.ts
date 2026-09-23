// wait-run.test.ts — falsifiers for the three-valued wait verdict, fed fake REST answers.
//
// No network, no timers: the forge is a scripted fake, the clock is a counter that `sleep`
// advances. Every test here is meant to FAIL if the decision it names is broken — the central
// ones (completed / timed-out / unknown) were mutation-checked when written.

import { describe, expect, test } from "bun:test";
import type { ForgeError, Result } from "../types";
import { err, forgeError, ok } from "../result";
import type { GithubRest } from "./github-pr-rest.ts";
import {
  decideAfterObservation,
  effectiveIntervalMs,
  exitCodeFor,
  failedJobNames,
  MAX_BACKOFF_MS,
  MIN_INTERVAL_MS,
  nextDelayMs,
  parseArgs,
  parseDurationMs,
  pickLatestRun,
  summarizeJob,
  waitRun,
  type RestRun,
} from "./wait-run.ts";

const SHA = "a".repeat(40);
const run = (status: string, conclusion: string | null = null, extra: Partial<RestRun> = {}): RestRun => ({
  id: 7,
  head_sha: SHA,
  status,
  conclusion,
  ...extra,
});

type Answer = Result<string, ForgeError>;

/** A scripted forge: each path answers from its queue; the last answer repeats. */
function fakeRest(script: Record<string, readonly Answer[]>): GithubRest & { calls: string[] } {
  const calls: string[] = [];
  const cursor = new Map<string, number>();
  return {
    calls,
    request: (method, path) => {
      const key = `${method} ${path}`;
      calls.push(key);
      const answers = script[key];
      if (answers === undefined) return Promise.resolve(err(forgeError("not-found", `unscripted ${key}`)));
      const i = cursor.get(key) ?? 0;
      cursor.set(key, i + 1);
      return Promise.resolve(answers[Math.min(i, answers.length - 1)] as Answer);
    },
  };
}

function fakeClock(): { now: () => number; sleep: (ms: number) => Promise<void>; slept: number[] } {
  let t = 1_000_000;
  const slept: number[] = [];
  return {
    now: () => t,
    sleep: (ms) => {
      slept.push(ms);
      t += ms;
      return Promise.resolve();
    },
    slept,
  };
}

const NWO = "o/r";
const RUN_PATH = `GET repos/${NWO}/actions/runs/7`;
const JOBS_PATH = `GET repos/${NWO}/actions/runs/7/jobs?filter=latest&per_page=100&page=1`;
const J = (v: unknown): Answer => ok(JSON.stringify(v));
const rateLimitedError = forgeError("permission-denied", "gh: You have exceeded a secondary rate limit (HTTP 403)");
const networkError = forgeError("network", "connection reset");
const rateLimited: Answer = err(rateLimitedError);
const network: Answer = err(networkError);

const ctx = (over: Partial<{ nowMs: number; deadlineMs: number; intervalMs: number; consecutiveFailures: number }> = {}) => ({
  nowMs: 0,
  deadlineMs: 100,
  intervalMs: 60_000,
  consecutiveFailures: 0,
  ...over,
});

describe("decideAfterObservation — the three-valued verdict", () => {
  test("a completed run is completed, even past the deadline", () => {
    expect(decideAfterObservation({ kind: "run", run: run("completed", "success") }, ctx({ nowMs: 500 })).kind).toBe("completed");
  });

  test("a running run before the deadline waits one interval", () => {
    expect(decideAfterObservation({ kind: "run", run: run("in_progress") }, ctx())).toEqual({ kind: "wait", delayMs: 60_000 });
  });

  test("a running run AT the deadline is timed-out (the last probe succeeded)", () => {
    const s = decideAfterObservation({ kind: "run", run: run("queued") }, ctx({ nowMs: 100 }));
    expect(s.kind).toBe("timed-out");
  });

  test("one millisecond before the deadline still waits", () => {
    expect(decideAfterObservation({ kind: "run", run: run("queued") }, ctx({ nowMs: 99 })).kind).toBe("wait");
  });

  test("no run yet at the deadline is timed-out, and says no run was ever seen", () => {
    const s = decideAfterObservation({ kind: "no-run-yet" }, ctx({ nowMs: 100 }));
    expect(s.kind).toBe("timed-out");
    expect(s.kind === "timed-out" && s.reason).toContain("no run");
  });

  test("a FAILED probe at the deadline is unknown, never timed-out", () => {
    const s = decideAfterObservation({ kind: "error", error: networkError }, ctx({ nowMs: 100, consecutiveFailures: 1 }));
    expect(s.kind).toBe("unknown");
  });

  test("a fatal error is unknown at once, before the deadline", () => {
    const s = decideAfterObservation(
      { kind: "error", error: forgeError("auth-failure", "bad credentials") },
      ctx({ consecutiveFailures: 1 }),
    );
    expect(s.kind).toBe("unknown");
  });

  test("a rate limit before the deadline backs off (doubles from the first failure)", () => {
    const s = decideAfterObservation({ kind: "error", error: rateLimitedError }, ctx({ consecutiveFailures: 1 }));
    expect(s).toEqual({ kind: "wait", delayMs: 120_000 });
  });

  test("a network error before the deadline waits one interval on the first failure", () => {
    const s = decideAfterObservation({ kind: "error", error: networkError }, ctx({ consecutiveFailures: 1 }));
    expect(s).toEqual({ kind: "wait", delayMs: 60_000 });
  });
});

describe("back-off and interval floor", () => {
  test("no failure means the plain interval", () => {
    expect(nextDelayMs(60_000, 0, "rate-limited")).toBe(60_000);
    expect(nextDelayMs(60_000, 3, null)).toBe(60_000);
  });
  test("rate limit doubles per consecutive failure and caps", () => {
    expect(nextDelayMs(60_000, 2, "rate-limited")).toBe(240_000);
    expect(nextDelayMs(60_000, 30, "rate-limited")).toBe(MAX_BACKOFF_MS);
  });
  test("transient backs off one step gentler than rate limit", () => {
    expect(nextDelayMs(60_000, 2, "transient")).toBe(120_000);
  });
  test("interval below the floor is raised to it; above is kept", () => {
    expect(effectiveIntervalMs(1000)).toBe(MIN_INTERVAL_MS);
    expect(effectiveIntervalMs(90_000)).toBe(90_000);
    expect(effectiveIntervalMs(Number.NaN)).toBe(60_000);
  });
});

describe("exit codes distinguish the outcomes", () => {
  test("completed success / neutral / skipped is 0", () => {
    for (const c of ["success", "neutral", "skipped"]) expect(exitCodeFor({ outcome: "completed", conclusion: c })).toBe(0);
  });
  test("completed failure / cancelled / null is 1", () => {
    expect(exitCodeFor({ outcome: "completed", conclusion: "failure" })).toBe(1);
    expect(exitCodeFor({ outcome: "completed", conclusion: "cancelled" })).toBe(1);
    expect(exitCodeFor({ outcome: "completed", conclusion: null })).toBe(1);
  });
  test("timed-out is 3 and unknown is 4, whatever the conclusion field says", () => {
    expect(exitCodeFor({ outcome: "timed-out", conclusion: "success" })).toBe(3);
    expect(exitCodeFor({ outcome: "unknown", conclusion: "success" })).toBe(4);
  });
});

describe("jobs and runs", () => {
  test("failing steps are the steps whose OWN conclusion failed", () => {
    const s = summarizeJob({
      id: 1,
      name: "build",
      status: "completed",
      conclusion: "failure",
      steps: [
        { name: "checkout", conclusion: "success" },
        { name: "compile", conclusion: "failure" },
        { name: "upload", conclusion: "skipped" },
        { name: "hung", conclusion: "timed_out" },
      ],
    });
    expect(s.failingSteps).toEqual(["compile", "hung"]);
  });
  test("a job with no steps has no failing steps", () => {
    expect(summarizeJob({ id: 1, name: "x", status: "completed", conclusion: "failure" }).failingSteps).toEqual([]);
  });
  test("failed job names exclude success and skipped", () => {
    expect(
      failedJobNames([
        { name: "a", status: "completed", conclusion: "success", failingSteps: [] },
        { name: "b", status: "completed", conclusion: "cancelled", failingSteps: [] },
        { name: "c", status: "completed", conclusion: "skipped", failingSteps: [] },
      ]),
    ).toEqual(["b"]);
  });
  test("latest run is newest created_at, ties broken by id", () => {
    const a = run("completed", "success", { id: 1, created_at: "2026-09-01T00:00:00Z" });
    const b = run("queued", null, { id: 2, created_at: "2026-09-02T00:00:00Z" });
    const c = run("queued", null, { id: 3, created_at: "2026-09-02T00:00:00Z" });
    expect(pickLatestRun([a, b])?.id).toBe(2);
    expect(pickLatestRun([b, a])?.id).toBe(2);
    expect(pickLatestRun([c, b])?.id).toBe(3);
    expect(pickLatestRun([])).toBeNull();
  });
});

describe("waitRun end to end against a fake forge", () => {
  test("polls until completed, then reports conclusion and failing steps", async () => {
    const clock = fakeClock();
    const rest = fakeRest({
      [RUN_PATH]: [J(run("queued")), J(run("in_progress")), J(run("completed", "failure"))],
      [JOBS_PATH]: [
        J({
          total_count: 1,
          jobs: [{ id: 9, name: "gate", status: "completed", conclusion: "failure", steps: [{ name: "test", conclusion: "failure" }] }],
        }),
      ],
    });
    const v = await waitRun(NWO, { kind: "run-id", runId: 7 }, { intervalMs: 60_000, timeoutMs: 3_600_000 }, { rest, ...clock });
    expect(v.outcome).toBe("completed");
    expect(v.conclusion).toBe("failure");
    expect(v.failedJobs).toEqual(["gate"]);
    expect(v.jobs?.[0]?.failingSteps).toEqual(["test"]);
    expect(v.probes).toBe(3);
    expect(clock.slept).toEqual([60_000, 60_000]);
    expect(exitCodeFor(v)).toBe(1);
  });

  test("still running at the deadline is timed-out with the last seen run, and never oversleeps", async () => {
    const clock = fakeClock();
    const rest = fakeRest({ [RUN_PATH]: [J(run("in_progress"))] });
    const v = await waitRun(NWO, { kind: "run-id", runId: 7 }, { intervalMs: 60_000, timeoutMs: 150_000 }, { rest, ...clock });
    expect(v.outcome).toBe("timed-out");
    expect(v.run?.status).toBe("in_progress");
    // 60 + 60 + 30: the final sleep is clipped so the last probe lands AT the deadline.
    expect(clock.slept).toEqual([60_000, 60_000, 30_000]);
    expect(v.probes).toBe(4);
  });

  test("a probe that keeps failing through the deadline is unknown, not timed-out", async () => {
    const clock = fakeClock();
    const rest = fakeRest({ [RUN_PATH]: [J(run("in_progress")), network] });
    const v = await waitRun(NWO, { kind: "run-id", runId: 7 }, { intervalMs: 60_000, timeoutMs: 200_000 }, { rest, ...clock });
    expect(v.outcome).toBe("unknown");
    expect(exitCodeFor(v)).toBe(4);
  });

  test("the goal met after a rate-limited probe is still completed", async () => {
    const clock = fakeClock();
    const rest = fakeRest({
      [RUN_PATH]: [rateLimited, J(run("completed", "success"))],
      [JOBS_PATH]: [J({ total_count: 0, jobs: [] })],
    });
    const v = await waitRun(NWO, { kind: "run-id", runId: 7 }, { intervalMs: 60_000, timeoutMs: 3_600_000 }, { rest, ...clock });
    expect(v.outcome).toBe("completed");
    expect(clock.slept).toEqual([120_000]);
    expect(exitCodeFor(v)).toBe(0);
  });

  test("a 404 run id is unknown on the first probe, with no sleeping", async () => {
    const clock = fakeClock();
    const rest = fakeRest({});
    const v = await waitRun(NWO, { kind: "run-id", runId: 7 }, { intervalMs: 60_000, timeoutMs: 3_600_000 }, { rest, ...clock });
    expect(v.outcome).toBe("unknown");
    expect(clock.slept).toEqual([]);
  });

  test("PR mode resolves the head once, waits for the run to appear, then locks onto its id", async () => {
    const clock = fakeClock();
    const listPath = `GET repos/${NWO}/actions/workflows/gate.yml/runs?head_sha=${SHA}&per_page=20`;
    const rest = fakeRest({
      [`GET repos/${NWO}/pulls/5`]: [J({ head: { sha: SHA } })],
      [listPath]: [J({ workflow_runs: [] }), J({ workflow_runs: [run("queued")] })],
      [RUN_PATH]: [J(run("completed", "success"))],
      [JOBS_PATH]: [J({ total_count: 0, jobs: [] })],
    });
    const v = await waitRun(NWO, { kind: "pr", pr: 5, workflow: "gate.yml" }, { intervalMs: 60_000, timeoutMs: 3_600_000 }, { rest, ...clock });
    expect(v.outcome).toBe("completed");
    expect(rest.calls.filter((c) => c.includes("/pulls/5")).length).toBe(1);
    expect(rest.calls.filter((c) => c === listPath).length).toBe(2);
    expect(rest.calls.filter((c) => c === RUN_PATH).length).toBe(1);
  });

  test("completed but jobs unreadable keeps the conclusion and says jobs are unknown (null, not [])", async () => {
    const clock = fakeClock();
    const rest = fakeRest({
      [RUN_PATH]: [J(run("completed", "success"))],
      [JOBS_PATH]: [err(forgeError("auth-failure", "nope"))],
    });
    const v = await waitRun(NWO, { kind: "run-id", runId: 7 }, { intervalMs: 60_000, timeoutMs: 3_600_000 }, { rest, ...clock });
    expect(v.outcome).toBe("completed");
    expect(v.jobs).toBeNull();
    expect(v.reason).toContain("jobs could not be read");
  });

  test("no route ever goes near GraphQL", async () => {
    const clock = fakeClock();
    const rest = fakeRest({ [RUN_PATH]: [J(run("completed", "success"))], [JOBS_PATH]: [J({ total_count: 0, jobs: [] })] });
    await waitRun(NWO, { kind: "run-id", runId: 7 }, { intervalMs: 60_000, timeoutMs: 60_000 }, { rest, ...clock });
    expect(rest.calls.every((c) => c.startsWith("GET repos/"))).toBe(true);
  });
});

describe("argument parsing", () => {
  test("durations", () => {
    expect(parseDurationMs("90")).toBe(90_000);
    expect(parseDurationMs("45m")).toBe(2_700_000);
    expect(parseDurationMs("2h")).toBe(7_200_000);
    expect(parseDurationMs("soon")).toBeNull();
  });
  test("exactly one target, and PR / SHA need a workflow", () => {
    expect(parseArgs(["--run-id", "12"]).ok).toBe(true);
    expect(parseArgs(["--run-id", "12", "--pr", "3"]).ok).toBe(false);
    expect(parseArgs(["--pr", "3"]).ok).toBe(false);
    expect(parseArgs(["--pr", "3", "--workflow", "gate.yml"]).ok).toBe(true);
    expect(parseArgs(["--sha", "abc", "--workflow", "gate.yml"]).ok).toBe(false);
    expect(parseArgs(["--sha", SHA, "--workflow", "../x"]).ok).toBe(false);
    expect(parseArgs(["--run-id", "1", "--repo", "../../x"]).ok).toBe(false);
    expect(parseArgs(["--bogus", "1"]).ok).toBe(false);
  });
});
