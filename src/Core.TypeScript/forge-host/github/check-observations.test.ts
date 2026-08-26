/**
 * check-observations.test.ts — falsifiers for the GitHub→neutral mapping.
 *
 * Everything here is a PURE function over API-shaped records, so the mapping is
 * exercised without `gh`, without a network, and without an adapter instance.
 */

import { describe, expect, it } from "bun:test";

import {
  checkIdForWorkflow,
  definitionSinceForPaths,
  expectationForWorkflow,
  parseFirstAddDates,
  triggerClassForEvent,
  isConclusive,
  observationForRuns,
  verdictForRun,
  withSuperseding,
  type GhRun,
} from "./check-observations.ts";
import { isPlainApiGet, resolveGitHubToken } from "./gh-cli.ts";

function run(over: Partial<GhRun>): GhRun {
  return { id: 1, status: "completed", conclusion: "success", created_at: "2026-08-22T00:00:00Z", updated_at: "2026-08-22T00:00:00Z", ...over };
}

describe("checkIdForWorkflow — identity that survives the substrate migration", () => {
  it("is the file basename without extension, not the display name or numeric id", () => {
    expect(checkIdForWorkflow(".github/workflows/pr-manifest-integrity.yml")).toBe("pr-manifest-integrity");
    expect(checkIdForWorkflow(".github/workflows/gate.yaml")).toBe("gate");
    expect(checkIdForWorkflow("dynamic/copilot-swe-agent/copilot")).toBe("copilot");
  });
});

describe("verdictForRun", () => {
  it("success is green", () => expect(verdictForRun(run({})).kind).toBe("green"));
  it("failure is red", () => expect(verdictForRun(run({ conclusion: "failure" })).kind).toBe("red"));
  it("timed_out and startup_failure are red", () => {
    expect(verdictForRun(run({ conclusion: "timed_out" })).kind).toBe("red");
    expect(verdictForRun(run({ conclusion: "startup_failure" })).kind).toBe("red");
  });
  it("in_progress is running, not green", () => expect(verdictForRun(run({ status: "in_progress", conclusion: null })).kind).toBe("running"));

  it("CANCELLED is unknown — its jobs never executed, so it established no verdict", () => {
    // platform-drift-report.ts measured 265 of 300 recent gate push runs cancelled:
    // main pushes arrive faster than a run takes. Reading those as anything but
    // "we learned nothing" would be a green built out of runs that never ran.
    const v = verdictForRun(run({ conclusion: "cancelled" }));
    expect(v.kind).toBe("unknown");
    expect(v.kind === "unknown" && v.reason).toBe("not-observed-this-pass");
    expect(isConclusive("cancelled")).toBe(false);
  });

  it("an unrecognised future conclusion is unknown, never green", () => {
    expect(verdictForRun(run({ conclusion: "some_new_conclusion" })).kind).toBe("unknown");
    expect(verdictForRun(run({ status: "completed", conclusion: null })).kind).toBe("unknown");
  });
});

describe("observationForRuns", () => {
  it("no runs yields NO observation — never a green", () => {
    expect(observationForRuns("c", [], "github-actions")).toBeNull();
  });

  it("steps past cancelled runs to the newest run that established a verdict, and says how many", () => {
    const obs = observationForRuns("c", [
      run({ id: 3, conclusion: "cancelled", updated_at: "2026-08-22T03:00:00Z" }),
      run({ id: 2, conclusion: "cancelled", updated_at: "2026-08-22T02:00:00Z" }),
      run({ id: 1, conclusion: "failure", updated_at: "2026-08-22T01:00:00Z" }),
    ], "github-actions");
    expect(obs?.verdict.kind).toBe("red");
    expect(obs?.observedAt).toBe("2026-08-22T01:00:00Z");
    expect(obs?.sourceDetail?.steppedPastInconclusiveRuns).toBe("2");
  });

  it("when EVERY recent run was cancelled the observation is unknown, not the last green from beyond the slice", () => {
    const obs = observationForRuns("c", [
      run({ id: 2, conclusion: "cancelled" }),
      run({ id: 1, conclusion: "cancelled" }),
    ], "github-actions");
    expect(obs?.verdict.kind).toBe("unknown");
  });

  it("carries provenance but never lets it into the verdict", () => {
    const obs = observationForRuns("c", [run({ id: 42, html_url: "https://example/42" })], "github-actions");
    expect(obs?.source).toBe("github-actions");
    expect(obs?.sourceDetail?.runId).toBe("42");
    expect(obs?.verdict).toEqual({ kind: "green" });
  });

  it("uses updated_at (verdict established) rather than created_at (run queued)", () => {
    const obs = observationForRuns("c", [run({ created_at: "2026-08-22T00:00:00Z", updated_at: "2026-08-22T00:41:00Z" })], "github-actions");
    expect(obs?.observedAt).toBe("2026-08-22T00:41:00Z");
  });
});

describe("host-managed checks are not repository drift — a false red teaches people to stop reading reds", () => {
  it("`dynamic/...` with no file is host-managed/underivable, NOT definition-absent", () => {
    for (const p of [
      "dynamic/pages/pages-build-deployment",
      "dynamic/dependabot/dependabot-updates",
      "dynamic/github-code-scanning/codeql",
      "dynamic/copilot-swe-agent/copilot",
    ]) {
      const e = expectationForWorkflow(p, null, "main");
      expect(e.kind).toBe("unknown");
      expect(e.kind === "unknown" && e.reason).toBe("underivable");
      expect(e.detail).toContain("host-managed");
    }
  });

  it("a `.github/workflows/` file that is missing IS definition-absent — the genuine drift class", () => {
    for (const p of [
      ".github/workflows/substrate-claim-checker.yml",
      ".github/workflows/inventory-phase5-proof.yml",
      ".github/workflows/zz-rustup-cache-probe.yml",
      ".github/workflows/k8s-lane-partition.yml",
    ]) {
      const e = expectationForWorkflow(p, null, "main");
      expect(e.kind === "unknown" && e.reason).toBe("definition-absent");
    }
  });

  it("a present source is parsed, whatever the path", () => {
    expect(expectationForWorkflow(".github/workflows/x.yml", "on:\n  schedule:\n    - cron: '0 9 * * 1'\n", "main").kind).toBe("periodic");
  });
});

describe("triggerClassForEvent — only `schedule` counts as periodic", () => {
  it("maps the events that matter", () => {
    expect(triggerClassForEvent("schedule")).toBe("periodic");
    expect(triggerClassForEvent("push")).toBe("on-change");
    expect(triggerClassForEvent("merge_group")).toBe("on-change");
    expect(triggerClassForEvent("pull_request")).toBe("on-request");
    expect(triggerClassForEvent("workflow_dispatch")).toBe("on-request");
    expect(triggerClassForEvent(undefined)).toBe("unknown");
  });

  it("does NOT let a pull_request run stand in for a schedule — the chart-version-refresh defect", () => {
    // Its 14 runs are all event=pull_request against a declared weekly cron. If this
    // mapping were loose, that would read as "the cadence is alive".
    expect(triggerClassForEvent("pull_request")).not.toBe("periodic");
    expect(triggerClassForEvent("workflow_dispatch")).not.toBe("periodic");
  });
});

// ───────────────────────────────────────────────────────────────────────────
// A guard slower than the unsafe path selects for the unsafe path.
//
// This tool's first user timed out at 400s on the default and at 540s on
// `--dop 8`, and went back to their hand-rolled scan — the identical dynamic that
// killed `src/Core.TypeScript/search/grep.ts`, which was correct, existed for exactly
// the incident it was meant to prevent, and produced no output in 300s.
//
// Measured with a counting shim on PATH: **73 `git` + 87 `gh` = 160 subprocesses per
// pass**, with the 73 serialised in a phase that had no DoP knob at all. So the cost
// shape gets falsifiers, not a promise in a comment.
// ───────────────────────────────────────────────────────────────────────────

describe("definition ages cost ONE subprocess, not one per check", () => {
  it("issues exactly one git invocation for eighty paths", () => {
    const calls: (readonly string[])[] = [];
    const paths = Array.from({ length: 80 }, (_, i) => `.github/workflows/w${i}.yml`);
    definitionSinceForPaths("/repo", paths, (args) => {
      calls.push(args);
      return "";
    });
    expect(calls).toHaveLength(1);
  });

  it("still issues exactly one for a single path — the count is O(1), not O(checks)", () => {
    let n = 0;
    definitionSinceForPaths("/repo", [".github/workflows/a.yml"], () => { n += 1; return ""; });
    expect(n).toBe(1);
  });

  it("issues NO subprocess when there is nothing to ask about", () => {
    let n = 0;
    definitionSinceForPaths("/repo", [], () => { n += 1; return ""; });
    expect(n).toBe(0);
  });

  it("asks git for the whole workflow directory, never for one file at a time", () => {
    let args: readonly string[] = [];
    definitionSinceForPaths("/repo", [".github/workflows/a.yml", ".github/workflows/b.yml"], (a) => { args = a; return ""; });
    expect(args).toContain(".github/workflows/");
    expect(args).not.toContain(".github/workflows/a.yml");
  });

  it("a failed git invocation yields no ages rather than throwing — unknown age declines to alarm", () => {
    expect(definitionSinceForPaths("/repo", [".github/workflows/a.yml"], () => null).size).toBe(0);
  });
});

describe("parseFirstAddDates — the OLDEST add wins, because git logs newest-first", () => {
  const log = [
    "C2026-08-21T20:18:00-04:00",
    ".github/workflows/chart-version-refresh.yml",
    ".github/workflows/other.yml",
    "",
    "C2026-04-18T17:19:36-04:00",
    ".github/workflows/gate.yml",
    ".github/workflows/other.yml",
  ].join("\n");

  it("maps each path to its earliest add", () => {
    const m = parseFirstAddDates(log);
    expect(m.get(".github/workflows/gate.yml")).toBe("2026-04-18T17:19:36-04:00");
    expect(m.get(".github/workflows/chart-version-refresh.yml")).toBe("2026-08-21T20:18:00-04:00");
  });

  it("a path added twice reports the OLDER date — a later re-add must not reset its age", () => {
    // Getting this backwards would make an established check look brand new, and a
    // brand-new periodic check is `not-yet-due`: the alarm would silently switch off.
    expect(parseFirstAddDates(log).get(".github/workflows/other.yml")).toBe("2026-04-18T17:19:36-04:00");
  });

  it("empty output yields no ages", () => {
    expect(parseFirstAddDates("").size).toBe(0);
  });
});

describe("withSuperseding — carry the rival verdict only when it is genuinely newer and different", () => {
  const base = (over = {}) => ({
    checkId: "c", verdict: { kind: "green" } as const, observedAt: "2026-08-16T09:00:00Z",
    source: "github-actions", trigger: "periodic" as const, ...over,
  });

  it("attaches a newer verdict from a different trigger", () => {
    const out = withSuperseding(
      base({ verdict: { kind: "red", detail: "failure" } }),
      base({ observedAt: "2026-08-22T17:32:00Z", trigger: "on-request" }),
    );
    expect(out.supersededBy?.verdict.kind).toBe("green");
    expect(out.supersededBy?.trigger).toBe("on-request");
  });

  it("does NOT attach an OLDER rival — superseding means newer", () => {
    expect(withSuperseding(
      base({ observedAt: "2026-08-22T17:32:00Z" }),
      base({ observedAt: "2026-08-16T09:00:00Z", trigger: "on-request" }),
    ).supersededBy).toBeUndefined();
  });

  it("does NOT attach a rival from the SAME trigger — that is the same fact twice", () => {
    expect(withSuperseding(
      base(),
      base({ observedAt: "2026-08-22T17:32:00Z", trigger: "periodic" }),
    ).supersededBy).toBeUndefined();
  });

  it("no rival leaves the observation untouched", () => {
    expect(withSuperseding(base(), null).supersededBy).toBeUndefined();
  });
});

describe("attempt counts feed the flapping detector", () => {
  it("counts concluded passes and failures, ignoring cancelled and in-flight", () => {
    const o = observationForRuns("c", [
      run({ id: 9, status: "in_progress", conclusion: null, updated_at: "2026-08-22T21:55:00Z" }),
      run({ id: 8, conclusion: "success", updated_at: "2026-08-22T21:53:34Z" }),
      run({ id: 7, conclusion: "cancelled", updated_at: "2026-08-22T21:13:40Z" }),
      run({ id: 6, conclusion: "failure", updated_at: "2026-08-22T21:18:29Z" }),
      run({ id: 5, conclusion: "success", updated_at: "2026-08-22T20:37:03Z" }),
      run({ id: 4, conclusion: "failure", updated_at: "2026-08-22T19:07:46Z" }),
    ], "github-actions");
    expect(o?.attempts?.concluded.filter((c) => c.passed)).toHaveLength(2);
    expect(o?.attempts?.concluded.filter((c) => !c.passed)).toHaveLength(2);
    // timestamps, not just counts — the fold cannot window without them
    expect(o?.attempts?.concluded[0]).toEqual({ at: "2026-08-22T21:53:34Z", passed: true });
    expect(o?.attempts?.recheckInFlight).toBe(true);
    // the verdict is still the newest CONCLUDED one
    expect(o?.verdict.kind).toBe("green");
  });
});

describe("the transport is spawn-free for plain reads, and narrowly so", () => {
  it("recognises exactly `api <path>` and nothing else", () => {
    expect(isPlainApiGet(["api", "repos/o/r/actions/workflows"])).toBe(true);
    // Anything with flags, a method or a body must keep the subprocess semantics --
    // a transport swap that quietly changed those would be worse than the latency saved.
    expect(isPlainApiGet(["api", "repos/o/r", "-X", "POST"])).toBe(false);
    expect(isPlainApiGet(["api", "--paginate", "repos/o/r"])).toBe(false);
    expect(isPlainApiGet(["api"])).toBe(false);
    expect(isPlainApiGet(["run", "list"])).toBe(false);
    expect(isPlainApiGet(["api", "-q", ".x"])).toBe(false);
  });

  // THE ENVIRONMENT IS PASSED IN, NEVER ASSIGNED. Both tests below used to do
  // `process.env["GH_TOKEN"] = "t1"` with a restoring `finally`. `process.env` is
  // inherited by every child this process spawns — including the real
  // `Bun.spawnSync(["gh", "auth", "token"])` inside the function under test, and any
  // other test in the same run that shells out to `gh` — so that assignment handed a
  // fake credential to real subprocesses for as long as it stood, and a throw before
  // the `finally` left it standing for the rest of the run. Refused by
  // `hygiene/lint-no-ambient-credential-hoist.ts`, and it was right to: reading the
  // ambient environment is fine, writing a credential into it is not.

  it("prefers the store over env, and never spawns gh", () => {
    expect(resolveGitHubToken({ GH_TOKEN: "token-from-env" }, () => "gho_store")).toBe("gho_store");
  });

  it("falls back to GH_TOKEN, then GITHUB_TOKEN; empty GH_TOKEN is absent", () => {
    expect(resolveGitHubToken({ GH_TOKEN: "token-from-env" }, () => null)).toBe("token-from-env");
    expect(resolveGitHubToken({ GITHUB_TOKEN: "from-github-token" }, () => null)).toBe("from-github-token");
    expect(resolveGitHubToken({ GH_TOKEN: "  ", GITHUB_TOKEN: "from-github-token" }, () => null)).toBe("from-github-token");
  });

  it("null when store and env are empty — does not spawn gh auth token", () => {
    expect(resolveGitHubToken({}, () => null)).toBeNull();
  });

  it("is a pure function of (env, readStore) — no process memo to reset", () => {
    expect(resolveGitHubToken({ GH_TOKEN: "t1" }, () => null)).toBe("t1");
    expect(resolveGitHubToken({ GH_TOKEN: "t2" }, () => null)).toBe("t2");
  });
});
