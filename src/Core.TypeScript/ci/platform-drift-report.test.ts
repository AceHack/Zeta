// platform-drift-report.test.ts — falsifiers for the platform-drift fold.
//
// Every test below fails if the corresponding line of the fold is removed or inverted;
// none of them assert a tautology. The three that matter most are the ones encoding a
// claim the report makes in prose and would otherwise merely assert:
//   * a leg with no failures is `unobserved`, NOT "healthy" — the vacuity guard;
//   * the clean streak counts EXECUTED runs, so cancelled runs cannot inflate it;
//   * classification is derived from `gate (required)`, so nothing needs to know the
//     word "windows".

import { describe, expect, test } from "bun:test";

import { foldRuns, mergeRecords, orderNewestFirst, renderMarkdown, type RunRecord } from "./platform-drift-report.ts";

const WIN = "build-and-test (windows-2025)";
const LINUX = "build-and-test (ubuntu-24.04)";
const MAC = "build-and-test (macos-26)";

/** `rollup` is the `gate (required)` conclusion — the only signal separating a blocking
 * leg failure from a non-blocking one, and the reason nothing here knows a platform name. */
function run(id: number, rollup: string, legs: Readonly<Record<string, string>>): RunRecord {
  return {
    id,
    at: `2026-08-19T00:00:${String(id % 60).padStart(2, "0")}Z`,
    sha: `sha${id}`,
    conclusion: rollup === "success" ? "success" : "failure",
    rollup,
    legs,
  };
}

function cancelled(id: number): RunRecord {
  return { id, at: "2026-08-19T00:00:00Z", sha: `sha${id}`, conclusion: "cancelled", rollup: "absent", legs: {} };
}

describe("orderNewestFirst", () => {
  test("orders by run id, not by the timestamp field", () => {
    const a = { ...run(1, "success", {}), at: "2026-12-31T00:00:00Z" };
    const b = { ...run(9, "success", {}), at: "2026-01-01T00:00:00Z" };
    expect(orderNewestFirst([a, b]).map((r) => r.id)).toEqual([9, 1]);
  });
});

describe("foldRuns classification", () => {
  test("a leg that failed beside a GREEN rollup is observed non-blocking", () => {
    const records = [run(2, "success", { [WIN]: "failure", [LINUX]: "success" })];
    const win = foldRuns(records).legs.find((l) => l.name === WIN);
    expect(win?.classification).toBe("non-blocking");
    expect(win?.nonBlockingFailures).toBe(1);
  });

  test("a leg that failed beside a RED rollup is observed blocking", () => {
    const records = [run(2, "failure", { [MAC]: "failure" })];
    const mac = foldRuns(records).legs.find((l) => l.name === MAC);
    expect(mac?.classification).toBe("blocking");
    expect(mac?.nonBlockingFailures).toBe(0);
  });

  test("a leg with zero failures is `unobserved`, never asserted healthy", () => {
    const records = [run(2, "success", { [WIN]: "success" })];
    const win = foldRuns(records).legs.find((l) => l.name === WIN);
    expect(win?.classification).toBe("unobserved");
    expect(win?.failures).toBe(0);
  });

  test("nothing in the fold depends on a platform name", () => {
    const odd = "build-and-test (freebsd-99)";
    const records = [run(2, "success", { [odd]: "failure" })];
    expect(foldRuns(records).legs[0]?.classification).toBe("non-blocking");
  });
});

describe("foldRuns rates and streaks", () => {
  const records = [
    run(10, "success", { [WIN]: "success", [LINUX]: "success" }),
    run(9, "success", { [WIN]: "success", [LINUX]: "success" }),
    cancelled(8),
    run(7, "success", { [WIN]: "failure", [LINUX]: "success" }),
    run(6, "success", { [WIN]: "success", [LINUX]: "success" }),
  ];

  test("clean streak counts consecutive EXECUTED runs since the newest failure", () => {
    const win = foldRuns(records).legs.find((l) => l.name === WIN);
    // Runs 10 and 9 are clean; the cancelled run 8 contributes nothing; run 7 failed.
    expect(win?.cleanStreak).toBe(2);
  });

  test("failure rate uses executed runs as the denominator, not pushes", () => {
    const win = foldRuns(records).legs.find((l) => l.name === WIN);
    expect(win?.executedRuns).toBe(4);
    expect(win?.failureRate).toBeCloseTo(0.25, 10);
  });

  test("coverage reports how many pushes actually ran the matrix", () => {
    const report = foldRuns(records);
    expect(report.runs).toBe(5);
    expect(report.executedRuns).toBe(4);
    expect(report.cancelledRuns).toBe(1);
    expect(report.coverage).toBeCloseTo(0.8, 10);
  });

  test("last failure records whether it blocked", () => {
    const win = foldRuns(records).legs.find((l) => l.name === WIN);
    expect(win?.lastFailure).toEqual({ runId: 7, at: records[3]!.at, blocked: false });
  });

  test("a leg with no failures reports a streak equal to its executed runs", () => {
    const linux = foldRuns(records).legs.find((l) => l.name === LINUX);
    expect(linux?.cleanStreak).toBe(4);
    expect(linux?.lastFailure).toBeNull();
  });

  test("an empty ledger folds to zeros rather than NaN", () => {
    const report = foldRuns([]);
    expect(report.coverage).toBe(0);
    expect(report.latestRunId).toBe(0);
    expect(report.legs).toEqual([]);
  });
});

describe("mergeRecords", () => {
  const a = run(1, "success", { [WIN]: "success" });
  const b = run(2, "success", { [WIN]: "failure" });

  test("is idempotent: merging the same batch twice equals merging it once", () => {
    const once = mergeRecords([a], [b], 10);
    const twice = mergeRecords(once, [b], 10);
    expect(twice).toEqual(once);
  });

  test("incoming wins on the same run id (a re-run corrects the record)", () => {
    const corrected = run(2, "success", { [WIN]: "success" });
    const merged = mergeRecords([a, b], [corrected], 10);
    expect(merged.find((r) => r.id === 2)?.legs[WIN]).toBe("success");
  });

  test("bounds the window to the newest maxRuns records", () => {
    const many = [1, 2, 3, 4, 5].map((i) => run(i, "success", { [WIN]: "success" }));
    expect(mergeRecords([], many, 3).map((r) => r.id)).toEqual([5, 4, 3]);
  });
});

describe("renderMarkdown", () => {
  test("names the non-blocking leg and says its failure did not block", () => {
    const md = renderMarkdown(foldRuns([run(3, "success", { [WIN]: "failure" })]));
    expect(md).toContain(WIN);
    expect(md).toContain("did NOT block");
    expect(md).toContain("drift check (observed non-blocking)");
  });

  test("publishes coverage, so a streak over runs that never ran cannot read as evidence", () => {
    const md = renderMarkdown(foldRuns([run(3, "success", { [WIN]: "success" }), cancelled(2)]));
    expect(md).toContain("1/2 push runs actually executed the matrix");
  });
});
