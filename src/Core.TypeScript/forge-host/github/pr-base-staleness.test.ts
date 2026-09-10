/**
 * Falsifiers for pr-base-staleness.ts.
 *
 * Every test here fails when the behaviour it names is removed. The refusal tests are
 * the load-bearing ones: they pin that no-verdict reports `unknown`, never `current`.
 */

import { describe, expect, test } from "bun:test";
import {
  classifyBase,
  describeVerdict,
  hasVerdict,
  isFailing,
  latestPerName,
  type CheckRun,
} from "./pr-base-staleness.ts";

const INSTALL_STEP = "build-and-test";
const BASE_STEPS = [INSTALL_STEP, "full-verify"] as const;

function run(name: string, conclusion: string | null, startedAt: string, status = "completed"): CheckRun {
  return { name, conclusion, startedAt, status };
}

describe("latestPerName", () => {
  test("keeps the LATEST attempt per name, not the first match", () => {
    const runs = [
      run("gate (required)", "failure", "2026-09-09T08:29:00Z"),
      run("gate (required)", "success", "2026-09-09T08:46:00Z"),
    ];
    const kept = latestPerName(runs);
    expect(kept).toHaveLength(1);
    // Without the max-by-startedAt fold this is "failure" — the measured 2026-09-09 error.
    expect(kept[0]?.conclusion).toBe("success");
  });

  test("ordering is ordinal on the ISO string, so an earlier re-run never wins", () => {
    const runs = [
      run("x", "success", "2026-09-09T23:00:00Z"),
      run("x", "failure", "2026-09-09T09:00:00Z"),
    ];
    expect(latestPerName(runs)[0]?.conclusion).toBe("success");
  });

  test("distinct names are all retained", () => {
    const runs = [run("a", "success", "2026-09-09T01:00:00Z"), run("b", "failure", "2026-09-09T01:00:00Z")];
    expect(latestPerName(runs)).toHaveLength(2);
  });
});

describe("hasVerdict — cancelled and skipped are the ABSENCE of a verdict", () => {
  test("cancelled has no verdict", () => {
    expect(hasVerdict(run("x", "cancelled", "2026-09-09T01:00:00Z"))).toBe(false);
  });
  test("skipped has no verdict", () => {
    expect(hasVerdict(run("x", "skipped", "2026-09-09T01:00:00Z"))).toBe(false);
  });
  test("in-progress has no verdict even with a stale conclusion field", () => {
    expect(hasVerdict(run("x", "success", "2026-09-09T01:00:00Z", "in_progress"))).toBe(false);
  });
  test("success and failure both carry a verdict", () => {
    expect(hasVerdict(run("x", "success", "2026-09-09T01:00:00Z"))).toBe(true);
    expect(hasVerdict(run("x", "failure", "2026-09-09T01:00:00Z"))).toBe(true);
  });
  test("cancelled is NOT counted as failing", () => {
    // `gh pr checks` renders cancelled as a failure; that misreading skipped exactly the
    // runs that needed rerunning.
    expect(isFailing(run("x", "cancelled", "2026-09-09T01:00:00Z"))).toBe(false);
  });
  test("timed_out IS failing", () => {
    expect(isFailing(run("x", "timed_out", "2026-09-09T01:00:00Z"))).toBe(true);
  });
});

describe("classifyBase — refusals", () => {
  test("no check-runs at all reports unknown, NEVER current", () => {
    const v = classifyBase({ behindBy: 15, checkRuns: [], baseAttributableSteps: BASE_STEPS });
    expect(v.kind).toBe("unknown");
    if (v.kind === "unknown") expect(v.reason).toContain("nothing has been scheduled");
  });

  test("all-cancelled reports unknown, NEVER current — the vacuity guard", () => {
    const v = classifyBase({
      behindBy: 15,
      checkRuns: [run("a", "cancelled", "2026-09-09T01:00:00Z"), run("b", "cancelled", "2026-09-09T01:00:00Z")],
      baseAttributableSteps: BASE_STEPS,
    });
    // If this ever returns "current", an empty failure list has been read as health.
    expect(v.kind).toBe("unknown");
    if (v.kind === "unknown") expect(v.reason).toContain("no verdict");
  });

  test("all-queued reports unknown", () => {
    const v = classifyBase({
      behindBy: 3,
      checkRuns: [run("a", null, "2026-09-09T01:00:00Z", "queued")],
      baseAttributableSteps: BASE_STEPS,
    });
    expect(v.kind).toBe("unknown");
  });

  test("the unknown reason names the count, so the refusal is legible", () => {
    const v = classifyBase({
      behindBy: 1,
      checkRuns: [run("a", "cancelled", "2026-09-09T01:00:00Z")],
      baseAttributableSteps: BASE_STEPS,
    });
    if (v.kind !== "unknown") throw new Error("expected unknown");
    expect(v.reason).toContain("1");
  });
});

describe("classifyBase — behind is necessary but NOT sufficient", () => {
  test("behind AND failing a base-attributable step is stranded", () => {
    const v = classifyBase({
      behindBy: 15,
      checkRuns: [run(`${INSTALL_STEP} (ubuntu-24.04)`, "failure", "2026-09-09T01:00:00Z")],
      baseAttributableSteps: BASE_STEPS,
    });
    expect(v.kind).toBe("stranded");
    if (v.kind === "stranded") expect(v.behindBy).toBe(15);
  });

  test("behind but failing its OWN test is own-failure — refreshing would hide it", () => {
    const v = classifyBase({
      behindBy: 15,
      checkRuns: [run("my-unit-test", "failure", "2026-09-09T01:00:00Z")],
      baseAttributableSteps: BASE_STEPS,
    });
    // The whole point: this must NOT be "stranded", or a base refresh buries a real defect.
    expect(v.kind).toBe("own-failure");
  });

  test("up to date is current even when failing", () => {
    const v = classifyBase({
      behindBy: 0,
      checkRuns: [run(`${INSTALL_STEP} (ubuntu-24.04)`, "failure", "2026-09-09T01:00:00Z")],
      baseAttributableSteps: BASE_STEPS,
    });
    expect(v.kind).toBe("current");
  });

  test("behind but everything decided and green is current", () => {
    const v = classifyBase({
      behindBy: 15,
      checkRuns: [run("a", "success", "2026-09-09T01:00:00Z")],
      baseAttributableSteps: BASE_STEPS,
    });
    expect(v.kind).toBe("current");
  });

  test("a stale cancelled attempt does not resurrect a fixed failure", () => {
    const v = classifyBase({
      behindBy: 15,
      checkRuns: [
        run(`${INSTALL_STEP} (ubuntu-24.04)`, "failure", "2026-09-09T08:29:00Z"),
        run(`${INSTALL_STEP} (ubuntu-24.04)`, "success", "2026-09-09T08:46:00Z"),
      ],
      baseAttributableSteps: BASE_STEPS,
    });
    expect(v.kind).toBe("current");
  });
});

describe("describeVerdict", () => {
  test("own-failure says refreshing would HIDE it", () => {
    const s = describeVerdict(17176, {
      kind: "own-failure",
      behindBy: 15,
      failingChecks: ["my-unit-test"],
    });
    expect(s).toContain("HIDE");
  });
  test("unknown carries its reason forward", () => {
    const s = describeVerdict(1, { kind: "unknown", reason: "distinctive-reason-text" });
    expect(s).toContain("distinctive-reason-text");
  });
});
