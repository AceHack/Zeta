/**
 * check-observations.test.ts — falsifiers for the GitHub→neutral mapping.
 *
 * Everything here is a PURE function over API-shaped records, so the mapping is
 * exercised without `gh`, without a network, and without an adapter instance.
 */

import { describe, expect, it } from "bun:test";

import {
  checkIdForWorkflow,
  expectationForWorkflow,
  triggerClassForEvent,
  isConclusive,
  observationForRuns,
  verdictForRun,
  type GhRun,
} from "./check-observations.ts";

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
