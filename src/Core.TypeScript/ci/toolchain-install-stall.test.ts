import { test, expect, describe } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  classifyFailedJob,
  decideRerun,
  APT_BUDGET_EXHAUSTED,
  INSTALL_STEP_NAME,
  type Job,
  type WorkflowRun,
} from "./toolchain-install-stall.ts";

// REAL captured production data (2026-08-25), not hand-made examples. A policy that only
// passes on synthetic inputs has not been shown to survive the traffic it will actually see.
interface Case {
  run: WorkflowRun;
  total_jobs: number;
  jobs: Job[];
  logExcerpts: Record<string, { source: string; excerpt: string }>;
  expect: "rerun" | "skip";
  expect_reason: string;
  why: string;
}
const fixture = JSON.parse(
  readFileSync(join(import.meta.dir, "fixtures", "toolchain-install-stall-2026-08-25.json"), "utf8"),
) as { captured_at: string; repo: string; note: string[]; cases: Case[] };

const NOW = new Date(fixture.captured_at);
const logsOf = (c: Case) => new Map(Object.entries(c.logExcerpts).map(([k, v]) => [Number(k), v.excerpt]));
const decide = (c: Case, over: Partial<WorkflowRun> = {}) =>
  decideRerun({ ...c.run, ...over }, c.jobs, logsOf(c), [], { now: NOW });
const byId = (id: number) => {
  const c = fixture.cases.find((x) => x.run.id === id);
  if (!c) throw new Error(`fixture has no run ${id}`);
  return c;
};

// The three runs whose ONLY failures are toolchain-install stalls.
const STALL_ONLY = [32890184155, 32890329848, 32889687326];
// gate run holding an install stall AND genuine reds.
const MIXED = 32896165119;
// gate run holding only a genuine tsc type error.
const REAL_RED = 32896987670;

describe("fixture sanity — the data under test is what we think it is", () => {
  test("carries the population it claims", () => {
    expect(fixture.cases.length).toBe(5);
    expect(fixture.repo).toBe("Lucent-Financial-Group/Zeta");
    for (const c of fixture.cases) {
      expect(c.run.status).toBe("completed");
      expect(c.run.conclusion).toBe("failure");
      expect(c.jobs.length).toBeGreaterThan(0);
      for (const j of c.jobs) expect(j.conclusion).toBe("failure");
    }
  });

  test("every failed job in the fixture has a log excerpt (missing evidence must not absolve)", () => {
    for (const c of fixture.cases) {
      for (const j of c.jobs) expect(Object.keys(c.logExcerpts)).toContain(String(j.id));
    }
  });
});

describe("guard 1 — a genuine red is NEVER re-run (the whole safety property)", () => {
  test("a run whose only failure is a tsc type error is declined", () => {
    const c = byId(REAL_RED);
    const d = decide(c);
    expect(d.action).toBe("skip");
    expect(d.reason).toBe("no-install-stall");
    // and the type error is named, not silently swallowed
    expect(d.detail).toContain("lint (TS)");
  });

  test("THE MUTATION FALSIFIER: a run mixing an install stall with real reds is declined", () => {
    // This is the test that must fail if the predicate is widened to bare `failure`.
    // Run 32896165119 carries a genuine apt-budget stall in build-and-test AND a tsc type
    // error AND a failing hermetic TypeScript suite. Re-running it would re-run the real
    // reds too, which is how a real failure becomes a flake.
    const c = byId(MIXED);
    const d = decide(c);
    expect(d.action).toBe("skip");
    expect(d.reason).toBe("mixed-failure");
    // The stall IS recognised — the refusal is about the company it keeps, not blindness.
    expect(d.classifications.filter((x) => x.verdict === "install-stall").length).toBe(1);
    expect(d.classifications.filter((x) => x.verdict === "unexplained").length).toBe(2);
    expect(d.detail).toContain("test (TS hermetic)");
    expect(d.detail).toContain("lint (TS)");
  });

  test("an exit-1 test failure in a job that ALSO stalled does not ride along", () => {
    // Take a real stall-only job and give it a second, EARLIER failing step — the shape of a
    // pre-install red. It must stop classifying as a stall.
    const c = byId(32889687326);
    const job = c.jobs[0]!;
    const withEarlierRed: Job = {
      ...job,
      steps: [...job.steps, { number: 1, name: "Run the unit tests", conclusion: "failure" }],
    };
    const v = classifyFailedJob(withEarlierRed, c.logExcerpts[String(job.id)]!.excerpt);
    expect(v.verdict).toBe("unexplained");
    expect(v.detail).toContain("Run the unit tests");
  });

  test("an install step that failed WITHOUT the apt-budget banner is not a stall", () => {
    // The forcing case: a manifest naming a package that does not exist exits 100 from the
    // same step. Same step name, no signature, so it must reach a human.
    const c = byId(32889687326);
    const job = c.jobs[0]!;
    const log = "2026-08-25T00:00:00Z E: Unable to locate package zzz\n##[error]Process completed with exit code 100.";
    expect(classifyFailedJob(job, log).verdict).toBe("unexplained");
    const d = decideRerun(c.run, c.jobs, new Map([[job.id, log]]), [], { now: NOW });
    expect(d.action).toBe("skip");
    expect(d.reason).toBe("no-install-stall");
  });

  test("a 127 with no 124 above it is a real red, never a trigger", () => {
    // 127 is the AFTERSHOCK of a missing toolchain, never an independent signature.
    const c = byId(32889687326);
    const job = c.jobs[0]!;
    const log = "2026-08-25T00:00:00Z bun: command not found\n##[error]Process completed with exit code 127.";
    expect(classifyFailedJob(job, log).verdict).toBe("unexplained");
  });

  test("a failed job with NO log evidence blocks the rerun", () => {
    const c = byId(32889687326);
    const d = decideRerun(c.run, c.jobs, new Map(), [], { now: NOW });
    expect(d.action).toBe("skip");
    expect(d.reason).toBe("no-install-stall");
  });
});

describe("guard 2 — the signature DOES fire on the measured failure", () => {
  for (const id of STALL_ONLY) {
    test(`run ${id}: every failed job classifies as an install stall`, () => {
      const c = byId(id);
      for (const j of c.jobs) {
        const v = classifyFailedJob(j, c.logExcerpts[String(j.id)]!.excerpt);
        expect(v.verdict).toBe("install-stall");
        expect(v.detail).toContain("apt wall budget");
      }
    });
  }

  test("the two attempt-1 stall-only runs are re-run", () => {
    for (const id of [32890329848, 32889687326]) {
      const c = byId(id);
      const d = decide(c);
      expect(d.action).toBe("rerun");
      expect(d.reason).toBe("toolchain-install-stall");
    }
  });

  test("the 127 aftershock in a later step does not block the rerun", () => {
    // k8s-argocd-health-test: install step failed at #4, `Tear down kind cluster` at #10
    // then failed with `bun: command not found`. With no toolchain on the box a cleanup step
    // cannot produce a verdict, so its failure carries no information about the PR.
    const c = byId(32890329848);
    const d = decide(c);
    expect(d.action).toBe("rerun");
    for (const cl of d.classifications) expect(cl.detail).toContain("downstream-of-no-toolchain");
  });

  test("the roll-up job is recognised as derived, not as an unexplained red", () => {
    // Without this, `gate` could never be re-run: `gate (required)` always fails when any
    // gate job fails, so the policy would be vacuous on the workflow that matters most.
    const c = byId(MIXED);
    const rollup = c.jobs.find((j) => j.name === "gate (required)")!;
    const v = classifyFailedJob(rollup, c.logExcerpts[String(rollup.id)]!.excerpt);
    expect(v.verdict).toBe("derived");
  });

  test("a roll-up job failing for some OTHER reason is not laundered", () => {
    const c = byId(MIXED);
    const rollup = c.jobs.find((j) => j.name === "gate (required)")!;
    const elsewhere: Job = { ...rollup, steps: [{ number: 2, name: "Checkout", conclusion: "failure" }] };
    expect(classifyFailedJob(elsewhere, "").verdict).toBe("unexplained");
  });
});

describe("guard 3 — the retry is BOUNDED and exhaustion stays red", () => {
  test("a run GitHub already re-ran is refused, from real data", () => {
    const c = byId(32890184155);
    expect(c.run.run_attempt).toBe(2); // captured that way, not contrived
    const d = decide(c);
    expect(d.action).toBe("skip");
    expect(d.reason).toBe("already-retried");
  });

  test("the ceiling is exactly one automatic rerun", () => {
    const c = byId(32889687326);
    expect(decide(c, { run_attempt: 1 }).action).toBe("rerun");
    expect(decide(c, { run_attempt: 2 }).action).toBe("skip");
    expect(decide(c, { run_attempt: 9 }).action).toBe("skip");
  });

  test("an old failure is history, not a stuck merge", () => {
    const c = byId(32889687326);
    const d = decideRerun(c.run, c.jobs, logsOf(c), [], {
      now: new Date(Date.parse(c.run.updated_at) + 121 * 60_000),
    });
    expect(d.action).toBe("skip");
    expect(d.reason).toBe("stale");
  });

  test("a superseded run is not resurrected", () => {
    const c = byId(32889687326);
    const newer: WorkflowRun = {
      ...c.run,
      id: c.run.id + 1,
      created_at: new Date(Date.parse(c.run.updated_at) - 1000).toISOString(),
    };
    const d = decideRerun(c.run, c.jobs, logsOf(c), [newer], { now: NOW });
    expect(d.action).toBe("skip");
    expect(d.reason).toBe("superseded");
  });

  test("a run still in flight is left alone", () => {
    const c = byId(32889687326);
    expect(decide(c, { status: "in_progress" }).reason).toBe("still-running");
  });

  test("`cancelled` stays rerun-cancelled-gate.yml's business, not ours", () => {
    const c = byId(32889687326);
    expect(decide(c, { conclusion: "cancelled" }).reason).toBe("not-failed");
  });
});

describe("guard 4 — the Windows leg can never match", () => {
  test("the Windows install step is excluded even with a 124 in the log", () => {
    // install.ps1 has no apt phase, so this signature is impossible there by construction.
    const job: Job = {
      id: 1,
      name: "build-and-test (windows-2022)",
      conclusion: "failure",
      steps: [
        { number: 9, name: "Install toolchain via three-way-parity script (Windows; GOVERNANCE §24)", conclusion: "failure" },
      ],
    };
    const log = `${APT_BUDGET_EXHAUSTED} 420s apt budget\n##[error]Process completed with exit code 124.`;
    expect(classifyFailedJob(job, log).verdict).toBe("unexplained");
  });
});

describe("the step-name pattern matches every name the installer step currently carries", () => {
  // Read off `.github/workflows/` on 2026-08-25. A rename that breaks these is a silent
  // de-activation of the whole policy, so it is pinned here.
  const NAMES = [
    "Install toolchain via three-way-parity script (Unix; GOVERNANCE §24)",
    "Install toolchain via three-way-parity script",
    "Install toolchain (three-way-parity script)",
  ];
  for (const n of NAMES) test(`matches: ${n}`, () => expect(INSTALL_STEP_NAME.test(n)).toBe(true));
  test("does not match a step that merely mentions the installer", () => {
    expect(INSTALL_STEP_NAME.test("Cache install.sh outputs (mise runtimes)")).toBe(false);
    expect(INSTALL_STEP_NAME.test("Run installer unit tests")).toBe(false);
  });
});
