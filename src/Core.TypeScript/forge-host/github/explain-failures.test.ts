// explain-failures.test.ts — falsifiers for "why did it fail", fed fake REST answers.
//
// Pins the two measured traps (check-run id IS the job id; a 0-byte log is unknown, not
// "no output") and the per-field rule: a failed sub-read is null + error, never an empty list.

import { describe, expect, test } from "bun:test";
import type { ForgeError, Result } from "../types";
import { err, forgeError, ok } from "../result";
import type { GithubRest } from "./github-pr-rest.ts";
import {
  classifyLog,
  explainFailures,
  explanationExitCode,
  failureAnnotations,
  isFailingConclusion,
  isPending,
  jobIdOfCheckRun,
  parseArgs,
  parseFailingStatuses,
} from "./explain-failures.ts";

type Answer = Result<string, ForgeError>;
const J = (v: unknown): Answer => ok(JSON.stringify(v));
const SHA = "c".repeat(40);

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

const opts = { intervalMs: 60_000, maxChecks: 20, logTail: 0 };
const noSleep = (): Promise<void> => Promise.resolve();
const CHECKS = `GET repos/o/r/commits/${SHA}/check-runs?per_page=100&page=1`;
const STATUS = `GET repos/o/r/commits/${SHA}/status`;

const actionsCheck = (id: number, name: string, conclusion: string | null, status = "completed", annotations = 1) => ({
  id,
  name,
  status,
  conclusion,
  html_url: `https://x/job/${String(id)}`,
  app: { slug: "github-actions" },
  output: { annotations_count: annotations },
});

describe("pure pieces", () => {
  test("failing conclusions", () => {
    for (const c of ["failure", "cancelled", "timed_out", "startup_failure", "action_required", "stale"]) {
      expect(isFailingConclusion(c)).toBe(true);
    }
    for (const c of ["success", "neutral", "skipped", null, undefined]) expect(isFailingConclusion(c)).toBe(false);
  });

  test("anything not completed is pending, including a missing status", () => {
    expect(isPending("completed")).toBe(false);
    expect(isPending("in_progress")).toBe(true);
    expect(isPending(null)).toBe(true);
  });

  test("the check-run id IS the job id for GitHub Actions, and null for any other app", () => {
    expect(jobIdOfCheckRun({ id: 42, name: "x", status: "completed", conclusion: "failure", app: { slug: "github-actions" } })).toBe(42);
    expect(jobIdOfCheckRun({ id: 42, name: "x", status: "completed", conclusion: "failure", app: { slug: "codeql" } })).toBeNull();
    expect(jobIdOfCheckRun({ id: 42, name: "x", status: "completed", conclusion: "failure" })).toBeNull();
  });

  test("only failure-level annotations are kept, with path and line", () => {
    const a = failureAnnotations([
      { annotation_level: "warning", message: "meh" },
      { annotation_level: "failure", message: "boom", path: "src/a.ts", start_line: 3, end_line: 4, title: "T" },
      { annotation_level: "notice", message: "fyi" },
    ]);
    expect(a).toEqual([{ level: "failure", message: "boom", title: "T", path: "src/a.ts", line: 3, endLine: 4 }]);
  });

  test("a 0-byte log is UNKNOWN, never 'no output'", () => {
    const l = classifyLog(ok(""), 10);
    expect(l.state).toBe("unknown");
  });

  test("a failed log read is unknown", () => {
    expect(classifyLog(err(forgeError("not-found", "gone")), 10).state).toBe("unknown");
  });

  test("a log is tailed, CRLF-normalised, and stripped of ANSI colour", () => {
    const l = classifyLog(ok("a\r\nb\n\u001b[31mc\u001b[0m\nd\n"), 2);
    expect(l).toEqual({ state: "observed", lines: ["c", "d"] });
  });

  test("failing commit statuses: failure and error only", () => {
    const s = parseFailingStatuses(
      JSON.stringify({
        statuses: [
          { context: "a", state: "success" },
          { context: "b", state: "failure", description: "d", target_url: "u" },
          { context: "c", state: "error" },
          { context: "p", state: "pending" },
        ],
      }),
    );
    expect(s.ok && s.value.map((x) => x.context)).toEqual(["b", "c"]);
  });

  test("exit codes: unknown 4, failing 1, pending-only 3, clean 0", () => {
    const base = { outcome: "observed" as const, failing: [], failingStatuses: [], pending: [], undetailed: [] };
    expect(explanationExitCode({ ...base, outcome: "unknown" })).toBe(4);
    expect(explanationExitCode({ ...base, undetailed: ["x"] })).toBe(1);
    expect(explanationExitCode({ ...base, failingStatuses: [{ context: "c", state: "error", description: null, url: null }] })).toBe(1);
    expect(explanationExitCode({ ...base, pending: ["p"] })).toBe(3);
    expect(explanationExitCode(base)).toBe(0);
  });
});

describe("explainFailures against a fake forge", () => {
  test("SHA mode: one jobs call per failing Actions check names the failing step (check-run id = job id)", async () => {
    const rest = fakeRest({
      [CHECKS]: [
        J({
          total_count: 3,
          check_runs: [actionsCheck(11, "gate", "failure"), actionsCheck(12, "lint", "success"), actionsCheck(13, "slow", null, "in_progress")],
        }),
      ],
      "GET repos/o/r/actions/jobs/11": [
        J({ id: 11, name: "gate", status: "completed", conclusion: "failure", steps: [{ name: "Run tests", conclusion: "failure" }] }),
      ],
      "GET repos/o/r/check-runs/11/annotations?per_page=100": [
        J([{ annotation_level: "failure", message: "exit 1", path: ".github", start_line: 9, end_line: 9 }]),
      ],
      [STATUS]: [J({ statuses: [] })],
    });
    const e = await explainFailures("o/r", { kind: "sha", sha: SHA }, opts, { rest, sleep: noSleep });
    expect(e.outcome).toBe("observed");
    expect(e.failing.length).toBe(1);
    expect(e.failing[0]).toMatchObject({ name: "gate", jobId: 11, failingSteps: ["Run tests"], stepsError: null });
    expect(e.failing[0]?.annotations?.[0]).toMatchObject({ message: "exit 1", line: 9 });
    expect(e.pending).toEqual(["slow"]);
    // No run lookup, no job search: exactly one jobs call.
    expect(rest.calls.filter((c) => c.includes("/actions/jobs/")).length).toBe(1);
    expect(rest.calls.every((c) => c.startsWith("GET repos/"))).toBe(true);
    expect(explanationExitCode(e)).toBe(1);
  });

  test("annotations_count 0 is observed as [] without a call; a failed annotations read is null + error", async () => {
    const rest = fakeRest({
      [CHECKS]: [J({ total_count: 2, check_runs: [actionsCheck(21, "a", "failure", "completed", 0), actionsCheck(22, "b", "cancelled")] })],
      "GET repos/o/r/actions/jobs/21": [J({ id: 21, name: "a", status: "completed", conclusion: "failure", steps: [] })],
      "GET repos/o/r/actions/jobs/22": [J({ id: 22, name: "b", status: "completed", conclusion: "cancelled", steps: [] })],
      "GET repos/o/r/check-runs/22/annotations?per_page=100": [err(forgeError("auth-failure", "no"))],
      [STATUS]: [J({ statuses: [] })],
    });
    const e = await explainFailures("o/r", { kind: "sha", sha: SHA }, opts, { rest, sleep: noSleep });
    expect(e.failing[0]?.annotations).toEqual([]);
    expect(rest.calls.some((c) => c.includes("check-runs/21/annotations"))).toBe(false);
    expect(e.failing[1]?.annotations).toBeNull();
    expect(e.failing[1]?.annotationsError).toContain("auth-failure");
  });

  test("a failed jobs read leaves failingSteps null, never []", async () => {
    const rest = fakeRest({
      [CHECKS]: [J({ total_count: 1, check_runs: [actionsCheck(31, "a", "failure", "completed", 0)] })],
      [STATUS]: [J({ statuses: [] })],
    });
    const e = await explainFailures("o/r", { kind: "sha", sha: SHA }, opts, { rest, sleep: noSleep });
    expect(e.failing[0]?.failingSteps).toBeNull();
    expect(e.failing[0]?.stepsError).toContain("not-found");
  });

  test("a non-Actions failing check has no job and says so", async () => {
    const rest = fakeRest({
      [CHECKS]: [J({ total_count: 1, check_runs: [{ ...actionsCheck(41, "ext", "failure", "completed", 0), app: { slug: "codeql" } }] })],
      [STATUS]: [J({ statuses: [] })],
    });
    const e = await explainFailures("o/r", { kind: "sha", sha: SHA }, opts, { rest, sleep: noSleep });
    expect(e.failing[0]?.jobId).toBeNull();
    expect(e.failing[0]?.stepsError).toContain("not a GitHub Actions check");
    expect(rest.calls.some((c) => c.includes("/actions/jobs/"))).toBe(false);
  });

  test("an empty log with --log-tail is unknown and the annotations are still there", async () => {
    const rest = fakeRest({
      [CHECKS]: [J({ total_count: 1, check_runs: [actionsCheck(51, "a", "failure")] })],
      "GET repos/o/r/actions/jobs/51": [J({ id: 51, name: "a", status: "completed", conclusion: "failure", steps: [] })],
      "GET repos/o/r/check-runs/51/annotations?per_page=100": [J([{ annotation_level: "failure", message: "why" }])],
      "GET repos/o/r/actions/jobs/51/logs": [ok("")],
      [STATUS]: [J({ statuses: [] })],
    });
    const e = await explainFailures("o/r", { kind: "sha", sha: SHA }, { ...opts, logTail: 5 }, { rest, sleep: noSleep });
    expect(e.failing[0]?.log?.state).toBe("unknown");
    expect(e.failing[0]?.annotations?.[0]?.message).toBe("why");
  });

  test("the check list unreadable is unknown (exit 4), not 'nothing failed'", async () => {
    const rest = fakeRest({});
    const e = await explainFailures("o/r", { kind: "sha", sha: SHA }, opts, { rest, sleep: noSleep });
    expect(e.outcome).toBe("unknown");
    expect(explanationExitCode(e)).toBe(4);
  });

  test("a rate-limited check list is retried with back-off, then read", async () => {
    const slept: number[] = [];
    const rest = fakeRest({
      [CHECKS]: [err(forgeError("permission-denied", "You have exceeded a secondary rate limit")), J({ total_count: 0, check_runs: [] })],
      [STATUS]: [J({ statuses: [] })],
    });
    const e = await explainFailures("o/r", { kind: "sha", sha: SHA }, opts, {
      rest,
      sleep: (ms) => {
        slept.push(ms);
        return Promise.resolve();
      },
    });
    expect(e.outcome).toBe("observed");
    expect(slept).toEqual([120_000]);
    expect(explanationExitCode(e)).toBe(0);
  });

  test("PR mode resolves the head SHA over REST first", async () => {
    const rest = fakeRest({
      "GET repos/o/r/pulls/9": [J({ head: { sha: SHA } })],
      [CHECKS]: [J({ total_count: 0, check_runs: [] })],
      [STATUS]: [J({ statuses: [{ context: "legacy", state: "failure" }] })],
    });
    const e = await explainFailures("o/r", { kind: "pr", pr: 9 }, opts, { rest, sleep: noSleep });
    expect(e.headSha).toBe(SHA);
    expect(e.failingStatuses.map((s) => s.context)).toEqual(["legacy"]);
    expect(explanationExitCode(e)).toBe(1);
  });

  test("run mode: failing jobs of the latest attempt, beyond --max-checks listed undetailed", async () => {
    const rest = fakeRest({
      "GET repos/o/r/actions/runs/77/jobs?filter=latest&per_page=100&page=1": [
        J({
          total_count: 3,
          jobs: [
            { id: 1, name: "a", status: "completed", conclusion: "failure", steps: [{ name: "s1", conclusion: "failure" }] },
            { id: 2, name: "b", status: "completed", conclusion: "failure", steps: [] },
            { id: 3, name: "c", status: "completed", conclusion: "success", steps: [] },
          ],
        }),
      ],
      "GET repos/o/r/check-runs/1/annotations?per_page=100": [J([])],
    });
    const e = await explainFailures("o/r", { kind: "run-id", runId: 77 }, { ...opts, maxChecks: 1 }, { rest, sleep: noSleep });
    expect(e.failing.map((f) => f.name)).toEqual(["a"]);
    expect(e.failing[0]?.failingSteps).toEqual(["s1"]);
    expect(e.undetailed).toEqual(["b"]);
  });

  test("args", () => {
    expect(parseArgs(["--pr", "3"]).ok).toBe(true);
    expect(parseArgs(["--pr", "3", "--sha", SHA]).ok).toBe(false);
    expect(parseArgs(["--sha", "abc"]).ok).toBe(false);
    expect(parseArgs(["--run-id", "5", "--log-tail", "x"]).ok).toBe(false);
    const p = parseArgs(["--run-id", "5", "--interval", "1"]);
    expect(p.ok && p.value.opts.intervalMs).toBe(20_000);
  });
});
