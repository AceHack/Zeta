// src/Core.TypeScript/hygiene/lint-workflow-job-timeouts.test.ts
//
// The guard needs both directions or it is decorative:
//
//   SENSITIVITY — a job with no timeout-minutes MUST be reported. This is the exact
//                 shape that held a runner 90+ minutes on 2026-08-18.
//   SPECIFICITY — a bounded job MUST NOT be reported, and a step-level timeout-minutes
//                 (indent 8) MUST NOT be mistaken for a job-level one. That confusion
//                 would let an unbounded job pass because one of its steps is bounded,
//                 which is the vacuity class: a check that cannot fail.
//
// Also pinned: the real .github/workflows tree is fully bounded, so a regression in the
// repo itself fails here and not only in CI.

import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { scanWorkflowJobs } from "./lint-workflow-job-timeouts.ts";

function fixture(name: string, body: string): string {
  const dir = mkdtempSync(join(tmpdir(), "wf-timeout-"));
  writeFileSync(join(dir, name), body);
  return dir;
}

describe("scanWorkflowJobs", () => {
  test("SENSITIVITY: a job with no timeout-minutes is reported unbounded", () => {
    const dir = fixture("a.yml", ["name: a", "jobs:", "  build:", "    runs-on: ubuntu-24.04", "    steps:", "      - run: echo hi", ""].join("\n"));
    const jobs = scanWorkflowJobs(dir);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.job).toBe("build");
    expect(jobs[0]?.bounded).toBe(false);
  });

  test("SPECIFICITY: a job WITH timeout-minutes is not reported", () => {
    const dir = fixture("b.yml", ["name: b", "jobs:", "  build:", "    timeout-minutes: 10", "    runs-on: ubuntu-24.04", ""].join("\n"));
    const jobs = scanWorkflowJobs(dir);
    expect(jobs[0]?.bounded).toBe(true);
  });

  test("a STEP-level timeout does not satisfy the JOB-level requirement", () => {
    const dir = fixture("c.yml", ["name: c", "jobs:", "  build:", "    runs-on: ubuntu-24.04", "    steps:", "      - name: slow", "        timeout-minutes: 5", "        run: echo hi", ""].join("\n"));
    const jobs = scanWorkflowJobs(dir);
    expect(jobs[0]?.bounded).toBe(false);
  });

  test("a reusable-workflow call is exempt by shape (GitHub rejects timeout-minutes there)", () => {
    const dir = fixture("d.yml", ["name: d", "jobs:", "  call:", "    uses: ./.github/workflows/other.yml", ""].join("\n"));
    const jobs = scanWorkflowJobs(dir);
    expect(jobs[0]?.reusable).toBe(true);
  });

  test("multiple jobs in one file are all enumerated", () => {
    const dir = fixture("e.yml", ["name: e", "jobs:", "  one:", "    timeout-minutes: 5", "    runs-on: ubuntu-24.04", "  two:", "    runs-on: ubuntu-24.04", ""].join("\n"));
    const jobs = scanWorkflowJobs(dir);
    expect(jobs.map((j) => j.job)).toEqual(["one", "two"]);
    expect(jobs.map((j) => j.bounded)).toEqual([true, false]);
  });

  test("keys after the jobs block do not leak into the last job", () => {
    const dir = fixture("f.yml", ["name: f", "jobs:", "  one:", "    runs-on: ubuntu-24.04", "timeout-minutes: 9", ""].join("\n"));
    const jobs = scanWorkflowJobs(dir);
    expect(jobs[0]?.bounded).toBe(false);
  });

  test("the real .github/workflows tree is fully bounded", () => {
    const jobs = scanWorkflowJobs(".github/workflows");
    expect(jobs.length).toBeGreaterThanOrEqual(60);
    const unbounded = jobs.filter((j) => !j.bounded && !j.reusable);
    expect(unbounded.map((j) => `${j.file}:${j.job}`)).toEqual([]);
  });
});
