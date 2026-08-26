import { test, expect, describe } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  classifyFailedJob,
  decideRerun,
  APT_BUDGET_EXHAUSTED,
  INSTALL_STEP_NAME,
  type BlockingFloor,
  type Job,
  type WorkflowRun,
} from "./toolchain-install-stall.ts";
import { GATE_YML_PATH, parseBlockingFloor } from "./gate-blocking-floor.ts";
import { parse as parseYaml } from "yaml";

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

// The blocking floor as `gate.yml` declares it TODAY, derived not written down. Every
// assertion below that uses it is therefore a statement about the real workflow.
const FLOOR = parseBlockingFloor(readFileSync(GATE_YML_PATH, "utf8"))!;
// The clock a 15-minute sweep would actually be holding: shortly after the run ended. Used
// where STALENESS is not the property under test — case 32886176743 was captured 123 minutes
// after it failed, past the 120-minute limit, and `stale` would mask every other verdict.
const shortlyAfter = (c: Case) => new Date(Date.parse(c.run.updated_at) + 5 * 60_000);
const decideWithFloor = (c: Case, jobs: Job[] = c.jobs) =>
  decideRerun(c.run, jobs, logsOf(c), [], { now: shortlyAfter(c), blockingFloor: FLOOR });
/** The same evaluation with NO floor — i.e. the module exactly as it behaved before 2026-08-26. */
const decideWithoutFloor = (c: Case, jobs: Job[] = c.jobs) =>
  decideRerun(c.run, jobs, logsOf(c), [], { now: shortlyAfter(c) });

// The three runs whose ONLY failures are toolchain-install stalls.
const STALL_ONLY = [32890184155, 32890329848, 32889687326];
// gate run holding an install stall AND genuine reds.
const MIXED = 32896165119;
// gate run holding only a genuine tsc type error.
const REAL_RED = 32896987670;
// gate run holding an install stall AND a red `drift (loud)` — a job gate.yml deliberately
// keeps out of the required floor. Stranded PR #15410 for ~11 hours under `mixed-failure`.
const STALL_PLUS_NONBLOCKING = 32886176743;

describe("fixture sanity — the data under test is what we think it is", () => {
  test("carries the population it claims", () => {
    expect(fixture.cases.length).toBe(6);
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

// ─────────────────────────────────────────────────────────────────────────────────────────
// guard 5 — a red that CANNOT BLOCK is not a red for this decision (2026-08-26 amendment)
//
// MUTATION RESULTS — MEASURED 2026-08-26 by applying one mutant at a time to the shipped code
// and re-running the three test files that cover this policy (80 tests green unmutated). A
// test that survives every mutant proves nothing about the fix and is labelled an over-reach
// guard where one is kept anyway.
//
//   M1  the floor is never applied (revert to the pre-amendment classifier)      -> 4 red
//       "the stranded run is re-run once the floor is known"
//       "the demoted red is NAMED in the rerun detail, never swallowed"
//       "a non-blocking job's red classifies as `non-blocking`, not `unexplained`"
//       "the floor does not rescue a run with real reds even when a demotable one is present"
//   M2  delete decideRerun's workflow check (`floor.workflow === run.name`)      -> 1 red
//       "a floor belonging to a DIFFERENT workflow is dropped, not applied by name"
//   M3  let an UNDECLARED job name demote (drop `known` in isNonBlockingJob)     -> 4 red
//       "a job gate.yml does not declare never demotes" + 3 in gate-blocking-floor.test.ts
//   M4  make the `needs:` closure non-transitive                                 -> 4 red
//       "a floor job's own prerequisite still declines" + 3 in gate-blocking-floor.test.ts
//   M5  demote ANY verdict rather than only `unexplained`                        -> 1 red
//       "an install stall in a non-blocking job is still an install stall"
//   M6  isNonBlockingJob always true — every red treated as harmless            -> 16 red
//       incl. "THE MUTATION FALSIFIER STILL HOLDS" and every isNonBlockingJob row
//   M7  the PRE-EXISTING widening: any `failure` reads as a stall               -> 25 red
//       13 of the tests that predate this change, plus 12 of the new ones. The guard this
//       amendment narrows is demonstrably not weakened by it.
//   M8  an absent/empty `needs:` yields an EMPTY floor instead of null           -> 4 red
//       the four FAIL CLOSED rows in gate-blocking-floor.test.ts
//   M9  the CLI stops handing the floor to the policy (wiring only)              -> 1 red
//       "THE WIRING" in rerun-toolchain-install-stall-cli.test.ts. Before that test existed
//       M9 was a SURVIVING mutant — all 80 unit tests stayed green with the fix unplugged.
//  M10  GATE_YML_PATH drifts (the sparse-checkout failure)                       -> 4 red
// ─────────────────────────────────────────────────────────────────────────────────────────
describe("guard 5 — a red that cannot block is not a real red here", () => {
  test("WITHOUT the floor, the stranded run is declined — this is the defect, reproduced", () => {
    // Exactly what run 32886176743 got live: `skip / mixed-failure`, naming `drift (loud)`.
    // Nothing about that verdict was resolvable, so PR #15410 sat for ~11 hours.
    const c = byId(STALL_PLUS_NONBLOCKING);
    const d = decideWithoutFloor(c);
    expect(d.action).toBe("skip");
    expect(d.reason).toBe("mixed-failure");
    expect(d.detail).toContain("drift (loud)");
  });

  test("the stranded run is re-run once the floor is known", () => {
    const c = byId(STALL_PLUS_NONBLOCKING);
    const d = decideWithFloor(c);
    expect(d.action).toBe("rerun");
    expect(d.reason).toBe("toolchain-install-stall");
    // The stall is still the stall, the roll-up is still derived, and only the drift red moved.
    const verdicts = Object.fromEntries(d.classifications.map((x) => [x.jobName, x.verdict]));
    expect(verdicts).toEqual({
      "build-and-test (ubuntu-24.04)": "install-stall",
      "gate (required)": "derived",
      "drift (loud)": "non-blocking",
    });
  });

  test("the demoted red is NAMED in the rerun detail, never swallowed", () => {
    // Demotion must stay visible: the sweep's one structured line has to say what it carried
    // past, or the policy has laundered a red in exactly the way it claims not to.
    const d = decideWithFloor(byId(STALL_PLUS_NONBLOCKING));
    expect(d.detail).toContain("drift (loud)");
    expect(d.detail).toContain("non-blocking");
    expect(d.classifications.find((x) => x.jobName === "drift (loud)")!.detail).toContain(
      "outside the gate (required) floor",
    );
  });

  test("a non-blocking job's red classifies as `non-blocking`, not `unexplained`", () => {
    const c = byId(STALL_PLUS_NONBLOCKING);
    const drift = c.jobs.find((j) => j.name === "drift (loud)")!;
    expect(classifyFailedJob(drift, c.logExcerpts[String(drift.id)]!.excerpt).verdict).toBe("unexplained");
    expect(classifyFailedJob(drift, c.logExcerpts[String(drift.id)]!.excerpt, FLOOR).verdict).toBe("non-blocking");
  });

  test("THE MUTATION FALSIFIER STILL HOLDS: real reds decline even WITH the floor", () => {
    // The over-reach guard for the whole amendment. Run 32896165119's other two failures are
    // `lint (TS)` and `test (TS hermetic)` — both inside `gate-required.needs:` — so knowing
    // the floor must change nothing at all about this verdict.
    const c = byId(MIXED);
    const d = decideWithFloor(c);
    expect(d.action).toBe("skip");
    expect(d.reason).toBe("mixed-failure");
    expect(d.classifications.filter((x) => x.verdict === "unexplained").length).toBe(2);
    expect(d.classifications.filter((x) => x.verdict === "non-blocking").length).toBe(0);
    expect(d.detail).toContain("test (TS hermetic)");
    expect(d.detail).toContain("lint (TS)");
  });

  test("the floor does not rescue a run with real reds even when a demotable one is present", () => {
    // The forcing case for M6: add the stranded run's `drift (loud)` job to the MIXED run.
    // One demotion happening must not drag the other two along with it.
    const mixed = byId(MIXED);
    const drift = byId(STALL_PLUS_NONBLOCKING).jobs.find((j) => j.name === "drift (loud)")!;
    const logs = new Map([...logsOf(mixed), [drift.id, ""]]);
    const d = decideRerun(mixed.run, [...mixed.jobs, drift], logs, [], {
      now: shortlyAfter(mixed),
      blockingFloor: FLOOR,
    });
    expect(d.action).toBe("skip");
    expect(d.reason).toBe("mixed-failure");
    expect(d.classifications.filter((x) => x.verdict === "non-blocking").length).toBe(1);
  });

  test("a floor belonging to a DIFFERENT workflow is dropped, not applied by name", () => {
    // `gate.yml`'s floor says nothing about a CodeQL or helm-validate run's job names, and a
    // collision must not be allowed to speak for one. Same data, floor relabelled.
    const c = byId(STALL_PLUS_NONBLOCKING);
    const foreign: BlockingFloor = { ...FLOOR, workflow: "helm-validate" };
    const d = decideRerun(c.run, c.jobs, logsOf(c), [], { now: shortlyAfter(c), blockingFloor: foreign });
    expect(d.action).toBe("skip");
    expect(d.reason).toBe("mixed-failure");
  });

  test("a job gate.yml does not declare never demotes", () => {
    // Rename the drift job to something the workflow file has never heard of — a job added on
    // a pull request's own branch, or a rename that outran this checkout. Unknown is refused.
    const c = byId(STALL_PLUS_NONBLOCKING);
    const jobs = c.jobs.map((j) => (j.name === "drift (loud)" ? { ...j, name: "drift (louder)" } : j));
    const d = decideWithFloor(c, jobs);
    expect(d.action).toBe("skip");
    expect(d.reason).toBe("mixed-failure");
    expect(d.detail).toContain("drift (louder)");
  });

  test("a floor job's own prerequisite still declines (the closure is transitive)", () => {
    // `matrix setup` is not in `gate-required.needs:`; `build-and-test` needs it. A
    // non-transitive closure would call it harmless.
    const c = byId(STALL_PLUS_NONBLOCKING);
    const jobs = c.jobs.map((j) => (j.name === "drift (loud)" ? { ...j, name: "matrix setup" } : j));
    expect(decideWithFloor(c, jobs).reason).toBe("mixed-failure");
  });

  test("a floor job's red declines, under its floor name", () => {
    const c = byId(STALL_PLUS_NONBLOCKING);
    for (const name of ["lint (TS)", "test (TS hermetic)", "build-and-test (windows-2025)"]) {
      const jobs = c.jobs.map((j) => (j.name === "drift (loud)" ? { ...j, name } : j));
      expect(decideWithFloor(c, jobs).reason).toBe("mixed-failure");
    }
  });

  test("an install stall in a non-blocking job is still an install stall", () => {
    // The ordering guard for M5. `lint (Go)` is outside the floor; if demotion ran BEFORE
    // classification its stall would become `non-blocking`, `stalls.length` would drop to 0,
    // and the run would decline as `no-install-stall` — silently switching the policy off for
    // every drift-lint job that calls install.sh.
    const c = byId(32889687326);
    const job = { ...c.jobs[0]!, name: "lint (Go)" };
    const log = c.logExcerpts[String(c.jobs[0]!.id)]!.excerpt;
    expect(classifyFailedJob(job, log, FLOOR).verdict).toBe("install-stall");
  });

  test("with no floor, every pre-existing case decides exactly as it did before", () => {
    // The amendment is additive: absent a floor the module is byte-for-byte its old self.
    for (const c of fixture.cases) {
      if (c.run.id === STALL_PLUS_NONBLOCKING) continue;
      const before = decideRerun(c.run, c.jobs, logsOf(c), [], { now: NOW });
      expect(`${c.run.id} ${before.action}/${before.reason}`).toBe(`${c.run.id} ${c.expect}/${c.expect_reason}`);
    }
  });

  test("with the floor, every pre-existing case STILL decides as it did (over-reach guard)", () => {
    // Labelled as an over-reach guard because it passes under the unfixed code too: its value
    // is bounding the blast radius, not proving the fix. It dies under M6 (demote everything),
    // which would flip 32896165119 and 32896987670.
    for (const c of fixture.cases) {
      if (c.run.id === STALL_PLUS_NONBLOCKING) continue;
      const d = decideRerun(c.run, c.jobs, logsOf(c), [], { now: NOW, blockingFloor: FLOOR });
      expect(`${c.run.id} ${d.action}/${d.reason}`).toBe(`${c.run.id} ${c.expect}/${c.expect_reason}`);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// guard 6 — the Windows package-source chain must actually FALL THROUGH.
//
// Measured outage, 2026-08-26 (main, commits c3addd47 and 4ca7cc9b, both
// windows-2025 and windows-11-arm): `www.gnupg.org:443` stopped answering, and
// scoop's `main/gnupg` manifest fetches its installer from that one origin.
//
//   A connection attempt failed because the connected party did not properly
//   respond ... [::ffff:5.9.17.227]:443 (www.gnupg.org:443)
//   URL https://www.gnupg.org/ftp/gcrypt/binary/gnupg-w32-2.5.21_...exe is not valid
//   scoop install gnupg failed (exit 1)
//
// The same runner printed `choco: 2.7.3` seventy seconds earlier, and
// manifests/windows carries `choco=gnupg`. The third resolver was installed,
// declared, and never asked: the loop picked the FIRST AVAILABLE source with an
// if/elseif and ran only that one, so with scoop always bootstrapped, winget and
// choco could not be reached by any input. The "scoop -> winget -> choco" in the
// label and in step 1b's comment described a fallback that could not fire.
//
// These assertions are structural on purpose. The property is not "the words
// scoop/winget/choco appear" — it is "a non-zero exit from one source reaches
// the next", and the if/elseif shape is precisely what makes that impossible.
describe("guard 6 — install.ps1's scoop -> winget -> choco chain is a real fallback", () => {
  const installPs1 = readFileSync(join(import.meta.dir, "..", "..", "..", "tools", "setup", "install.ps1"), "utf8");
  // The manifest-driven install loop only; step 1b's bootstrap above it is a different concern.
  const start = installPs1.indexOf("# 2. system CLI tools from manifests/windows");
  const end = installPs1.indexOf("# 2b. Windows long-path enablement");
  const loop = installPs1.slice(start, end);

  test("the region under test was actually found (no vacuous slice)", () => {
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    expect(loop).toContain("manifests\\windows");
  });

  test("all three sources are offered ADDITIVELY — never as elseif branches", () => {
    // `elseif ($(Have winget))` is the exact shape that made choco unreachable.
    expect(loop).not.toMatch(/elseif\s*\(\$\(Have\s+(scoop|winget|choco)\)\)/);
    for (const source of ["scoop", "winget", "choco"]) {
      expect(loop).toMatch(new RegExp(`(?<!else)if\\s*\\(\\$\\(Have\\s+${source}\\)\\)\\s*\\{\\s*\\$candidates\\s*\\+=`));
    }
  });

  test("a non-zero exit from one source advances to the next, and only the LAST one throws", () => {
    const iterates = loop.indexOf("foreach ($candidate in $candidates)");
    expect(iterates).toBeGreaterThan(-1);
    // Success short-circuits (so a healthy scoop still costs exactly one attempt) ...
    expect(loop.slice(iterates)).toMatch(/if\s*\(\$code\s+-eq\s+0\)\s*\{\s*\$installed\s*=\s*\$true;\s*break\s*\}/);
    // ... and the required-tool `throw` is reached only after every candidate has been tried.
    const exhausted = loop.indexOf("if (-not $installed)");
    expect(exhausted).toBeGreaterThan(iterates);
    expect(loop.indexOf("failed on every available package source")).toBeGreaterThan(exhausted);
    // Nothing INSIDE the loop body may throw — a throw there re-breaks fall-through, which is
    // exactly the defect (`Invoke-Tool` threw on scoop's exit 1 and choco was never reached).
    expect(loop.slice(iterates, exhausted)).not.toContain("throw");
    expect(loop.slice(iterates, exhausted)).not.toContain("Invoke-Tool ");
  });

  test("`optional` tools still warn instead of throwing when every source fails", () => {
    expect(loop).toContain("failed on EVERY package source");
    expect(loop).toContain("best-effort substrate");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// guard 7 — the failure REPORTER must not be able to fail.
//
// Same two runs: after the install step died, `Name the crashed/hung test (on
// failure)` fired under a bare `failure()` and ran `bun ...` — with no `bun`,
// because installing it is the job of the step that had just failed:
//
//   The term 'bun' is not recognized as a name of a cmdlet, function, script
//   file, or executable program.
//   ##[error]Process completed with exit code 1.
//
// Both annotations on the check-run then read `Process completed with exit code
// 1` and neither named gnupg. print-blame-sequences.ts is exit-0-always by
// contract, so a non-zero exit there can only ever mean the step ran somewhere
// it does not belong.
describe("guard 7 — the blame printer runs only after the TEST step failed", () => {
  const gate = readFileSync(GATE_YML_PATH, "utf8");
  const workflow = parseYaml(gate) as {
    jobs: Record<string, { steps?: { name?: string; id?: string; if?: string; run?: string }[] }>;
  };
  const steps = workflow.jobs["build-and-test"]?.steps ?? [];
  const testStep = steps.findIndex((s) => s.name === "Test");
  const blameStep = steps.findIndex((s) => (s.run ?? "").includes("print-blame-sequences.ts"));

  test("both steps still exist in build-and-test (no vacuous lookup)", () => {
    expect(testStep).toBeGreaterThan(-1);
    expect(blameStep).toBeGreaterThan(testStep);
  });

  test("the Test step keeps the `id` the reporter's condition depends on", () => {
    expect(steps[testStep]?.id).toBe("test");
  });

  test("the reporter is gated on that step's OUTCOME, not on bare failure()", () => {
    const cond = steps[blameStep]?.if ?? "";
    expect(cond).toContain("steps.test.outcome == 'failure'");
    // The regression shape: `failure()` with no step-scoped clause fires after ANY
    // earlier step — including the one that installs the `bun` this step invokes.
    expect(cond.replace(/steps\.test\.outcome\s*==\s*'failure'/, "").includes("steps.")).toBe(false);
  });

  // The GENERAL form of the defect, stated once so the class cannot come back under a new name.
  // A step that runs on failure() and shells out to an installed program is betting that the
  // toolchain survived — a bet that is lost precisely when the install step is what failed.
  test("every failure()-gated reporter either needs no toolchain or names the step it reports on", () => {
    const TOOLCHAIN_FREE = /^\s*(#|echo\b|:\s*$|$)/; // `echo` is a bash builtin AND a pwsh alias
    const offenders: string[] = [];
    for (const step of steps) {
      const cond = step.if ?? "";
      if (!cond.includes("failure()")) continue;
      if (/steps\.[A-Za-z0-9_]+\.(outcome|conclusion)/.test(cond)) continue; // scoped to a step
      const body = (step.run ?? "").split(/\r?\n/);
      const nonBuiltin = body.filter((l) => l.trim().length > 0 && !TOOLCHAIN_FREE.test(l));
      if (nonBuiltin.length > 0) offenders.push(`${step.name}: ${nonBuiltin[0]?.trim()}`);
    }
    expect(offenders).toEqual([]);
  });

  test("the toolchain-free reporter exists, is unscoped on purpose, and pins no shell", () => {
    const free = steps.find((s) => (s.name ?? "").startsWith("Name the failing step"));
    expect(free).toBeDefined();
    expect(free?.if).toBe("failure()");
    // No `shell:` key => bash on Linux/macOS, pwsh on Windows; `echo` is valid in both, so the
    // step cannot be broken by whichever interpreter the failed install left behind.
    expect((free as { shell?: string } | undefined)?.shell).toBeUndefined();
    // It must actually name the steps, or it is a reporter that reports nothing.
    for (const id of ["install_unix", "install_windows", "roslyn_guard", "build", "test"]) {
      expect(free?.run ?? "").toContain(`steps.${id}.outcome`);
    }
    // And it must land in the check-run annotations, which is where the useless
    // `Process completed with exit code 1` pair showed up with nothing beside it.
    expect(free?.run ?? "").toContain("::error title=");
  });

  test("the reporter it guards is genuinely exit-0-always (the contract it relies on)", () => {
    const printer = readFileSync(join(import.meta.dir, "print-blame-sequences.ts"), "utf8");
    expect(printer).toContain("Exit 0 always");
    expect(printer).not.toContain("process.exit(1)");
    expect(printer).not.toContain("throw new Error");
  });
});
