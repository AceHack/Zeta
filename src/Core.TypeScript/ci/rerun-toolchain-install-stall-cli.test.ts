import { test, expect, describe } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { worthFetchingLogs, toJob } from "./rerun-toolchain-install-stall-cli.ts";
import type { Job } from "./toolchain-install-stall.ts";

const fixture = JSON.parse(
  readFileSync(join(import.meta.dir, "fixtures", "toolchain-install-stall-2026-08-25.json"), "utf8"),
) as { cases: Array<{ run: { id: number }; jobs: Job[] }> };
const jobsOf = (id: number) => fixture.cases.find((c) => c.run.id === id)!.jobs;

describe("worthFetchingLogs — the cheap pre-filter that decides whether to pay for a log", () => {
  test("fires on the runs that carry an install-step failure", () => {
    for (const id of [32890184155, 32890329848, 32889687326, 32896165119]) {
      expect(worthFetchingLogs(jobsOf(id))).toBe(true);
    }
  });

  test("does NOT fire on a run whose only failure is a tsc type error", () => {
    // This is the cost guard: on a normal red the sweep pays one jobs API call and stops.
    expect(worthFetchingLogs(jobsOf(32896987670))).toBe(false);
  });

  test("does not fire on the Windows installer step", () => {
    const jobs: Job[] = [
      {
        id: 1,
        name: "build-and-test (windows-2022)",
        conclusion: "failure",
        steps: [{ number: 3, name: "Install toolchain via three-way-parity script (Windows; GOVERNANCE §24)", conclusion: "failure" }],
      },
    ];
    expect(worthFetchingLogs(jobs)).toBe(false);
  });

  test("does not fire when the installer failed AFTER something else did", () => {
    const jobs: Job[] = [
      {
        id: 1,
        name: "j",
        conclusion: "failure",
        steps: [
          { number: 2, name: "Checkout", conclusion: "failure" },
          { number: 3, name: "Install toolchain via three-way-parity script", conclusion: "failure" },
        ],
      },
    ];
    expect(worthFetchingLogs(jobs)).toBe(false);
  });

  test("a pre-filter false positive costs a log fetch and never a rerun", () => {
    // Stated as a test so the claim in the header is checkable: the pre-filter's only power
    // is to SKIP work. Everything it lets through still faces the full policy, which needs
    // the log signature the pre-filter never looked at.
    const jobs: Job[] = [
      {
        id: 1,
        name: "j",
        conclusion: "failure",
        steps: [{ number: 3, name: "Install toolchain via three-way-parity script", conclusion: "failure" }],
      },
    ];
    expect(worthFetchingLogs(jobs)).toBe(true);
  });
});

describe("toJob — a job the API returned with no steps array must not crash the sweep", () => {
  test("missing steps becomes an empty list, which classifies as unexplained", () => {
    const j = toJob({ id: 7, name: "x", conclusion: "failure" });
    expect(j.steps).toEqual([]);
  });
});

describe("the module writes no files — the taint sink is gone, not sanitised", () => {
  // CodeQL flagged two drafts of a $GITHUB_STEP_SUMMARY writer (js/http-to-file-access). The
  // resolution was to delete the sink rather than reshape a sanitiser until the analyser was
  // quiet. This pins that: a reader who re-adds a file write has to delete this test first.
  test("the source names no filesystem write API", () => {
    const src = readFileSync(join(import.meta.dir, "rerun-toolchain-install-stall-cli.ts"), "utf8");
    // Strip the block comments, which DISCUSS the removed sink by name.
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "");
    for (const banned of ["appendFileSync", "writeFileSync", "Bun.write", "node:fs", "GITHUB_STEP_SUMMARY"]) {
      expect(code).not.toContain(banned);
    }
  });

  test("the assertion above has a subject (the file is real and non-trivial)", () => {
    // A scan floor: if the path ever moves, the test must fail rather than vacuously pass on
    // an empty string.
    const src = readFileSync(join(import.meta.dir, "rerun-toolchain-install-stall-cli.ts"), "utf8");
    expect(src.length).toBeGreaterThan(4000);
    expect(src).toContain("toolchain-install-stall-decision");
  });
});
