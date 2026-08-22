import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  BASELINE_PATH,
  main,
  GITHUB_DEFAULT_TIMEOUT_MINUTES,
  PRE_APT_RESERVE_SECONDS,
  TIMINGS_PATH,
  auditRepo,
  budgetFor,
  installerJobs,
  jobKey,
  loadBaseline,
  loadTimings,
  parseAptBudget,
  reconcile,
  type AptBudget,
  type Baseline,
  type BudgetKind,
  type InstallerJob,
  type Timings,
} from "./audit-apt-budget-fits-job-timeout";

const ROOT = resolve(import.meta.dir, "../../..");

const BUDGET: AptBudget = {
  ciDefaultSeconds: 420,
  localDefaultSeconds: 1800,
  killAfterSeconds: 10,
};

function job(
  workflow: string,
  name: string,
  timeoutMinutes: number | null,
  budgetKind: BudgetKind = "ci",
  budgetOverrideSeconds: number | null = null,
): InstallerJob {
  return {
    workflow,
    job: name,
    timeoutMinutes,
    effectiveSeconds: (timeoutMinutes ?? GITHUB_DEFAULT_TIMEOUT_MINUTES) * 60,
    budgetKind,
    budgetOverrideSeconds,
  };
}

/** A timings file that measures exactly the jobs handed to it. */
function timings(...rows: { key: string; nonApt: number }[]): Timings {
  return {
    measuredAt: "2026-08-22",
    jobs: rows.map((r) => ({
      key: r.key,
      samples: 20,
      nonAptP90Seconds: r.nonApt,
      nonAptMaxSeconds: r.nonApt,
      aptP90Seconds: 50,
      window: "test",
      runIds: [1],
    })),
    unmeasured: [],
  };
}

describe("parseAptBudget — read the value the runner actually uses", () => {
  test("reads the three constants from linux.sh itself", () => {
    const b = parseAptBudget(readFileSync(resolve(ROOT, "tools/setup/linux.sh"), "utf8"));
    expect(b.ciDefaultSeconds).toBeGreaterThan(0);
    expect(b.localDefaultSeconds).toBeGreaterThan(b.ciDefaultSeconds);
    expect(b.killAfterSeconds).toBeGreaterThan(0);
  });

  test("a value that is no longer a bare integer FAILS rather than defaulting", () => {
    // The whole point of parsing the shell is that there is no second copy. If the
    // assignment becomes computed, silently substituting a guess would restore the
    // drift this audit exists to prevent.
    const shell = [
      "ZETA_APT_CI_BUDGET_DEFAULT_SECONDS=$((JOB_TIMEOUT / 2))",
      "ZETA_APT_LOCAL_BUDGET_DEFAULT_SECONDS=1800",
      "apt_kill_after=10",
    ].join("\n");
    expect(() => parseAptBudget(shell)).toThrow(/ZETA_APT_CI_BUDGET_DEFAULT_SECONDS/);
  });
});

describe("installerJobs — which jobs are governed, and at which budget", () => {
  const installerStep = (extra = ""): string =>
    `      - name: Install\n        run: ./tools/setup/install.sh${extra}\n`;

  test("a job that runs install.sh directly is governed at the CI budget", () => {
    const wf = `jobs:\n  a:\n    runs-on: ubuntu-24.04\n    timeout-minutes: 12\n    steps:\n${installerStep()}`;
    const jobs = installerJobs(wf, "w.yml");
    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.budgetKind).toBe("ci");
    expect(jobs[0]?.effectiveSeconds).toBe(720);
    expect(jobs[0]?.budgetOverrideSeconds).toBeNull();
  });

  test("a Windows-only job is not governed — linux.sh never runs there", () => {
    const wf = `jobs:\n  a:\n    runs-on: windows-2025\n    steps:\n${installerStep()}`;
    expect(installerJobs(wf, "w.yml")).toHaveLength(0);
  });

  test("a docker job is governed at the LOCAL budget, through its Dockerfile", () => {
    const wf =
      "jobs:\n  a:\n    runs-on: ubuntu-24.04\n    timeout-minutes: 45\n    steps:\n" +
      "      - name: build\n        run: docker build -f src/dockerfiles/ubuntu/Dockerfile .\n";
    const jobs = installerJobs(wf, "w.yml", () => "RUN ./tools/setup/install.sh");
    expect(jobs[0]?.budgetKind).toBe("local");
  });

  test("a NixOS Dockerfile is NOT governed — linux.sh skips the whole apt phase there", () => {
    const wf =
      "jobs:\n  a:\n    runs-on: ubuntu-24.04\n    steps:\n" +
      "      - name: build\n        run: docker build -f src/dockerfiles/nixos/Dockerfile .\n";
    expect(installerJobs(wf, "w.yml", () => "RUN touch /etc/NIXOS\nRUN ./tools/setup/install.sh")).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DEFECT 2: the per-job budget knob the guard could not see.
// ─────────────────────────────────────────────────────────────────────────────
describe("ZETA_APT_BUDGET_SECONDS — the per-job override is now visible to the guard", () => {
  test("a step-level env override is read, and IS what the job is judged against", () => {
    const wf =
      "jobs:\n  a:\n    runs-on: ubuntu-24.04\n    timeout-minutes: 12\n    steps:\n" +
      "      - name: Install\n        env:\n          ZETA_APT_BUDGET_SECONDS: 900\n" +
      "        run: ./tools/setup/install.sh\n";
    const jobs = installerJobs(wf, "w.yml");
    expect(jobs[0]?.budgetOverrideSeconds).toBe(900);
    expect(budgetFor(BUDGET, jobs[0]!)).toBe(900);
    // 900 + 10 + 100 = 1010 > 720. Invisible to the old audit, red now.
    const r = reconcile(BUDGET, jobs, timings({ key: "w.yml:a", nonApt: 100 }));
    expect(r.ok).toBe(false);
    expect(r.detail).toContain("w.yml:a");
  });

  test("job-level and workflow-level env are read too, step wins over job wins over workflow", () => {
    const wf =
      "env:\n  ZETA_APT_BUDGET_SECONDS: 111\njobs:\n" +
      "  wfLevel:\n    runs-on: ubuntu-24.04\n    steps:\n      - run: ./tools/setup/install.sh\n" +
      "  jobLevel:\n    runs-on: ubuntu-24.04\n    env:\n      ZETA_APT_BUDGET_SECONDS: 222\n" +
      "    steps:\n      - run: ./tools/setup/install.sh\n" +
      "  stepLevel:\n    runs-on: ubuntu-24.04\n    env:\n      ZETA_APT_BUDGET_SECONDS: 222\n" +
      "    steps:\n      - env:\n          ZETA_APT_BUDGET_SECONDS: 333\n        run: ./tools/setup/install.sh\n";
    const by = new Map(installerJobs(wf, "w.yml").map((j) => [j.job, j.budgetOverrideSeconds]));
    expect(by.get("wfLevel")).toBe(111);
    expect(by.get("jobLevel")).toBe(222);
    expect(by.get("stepLevel")).toBe(333);
  });

  test("an inline `VAR=n ./tools/setup/install.sh` in the run block is read", () => {
    const wf =
      "jobs:\n  a:\n    runs-on: ubuntu-24.04\n    steps:\n" +
      "      - run: ZETA_APT_BUDGET_SECONDS=250 ./tools/setup/install.sh\n";
    expect(installerJobs(wf, "w.yml")[0]?.budgetOverrideSeconds).toBe(250);
  });

  test("an override the audit cannot evaluate THROWS — it must not fall back to the default", () => {
    // A `${{ }}` expression means the runner and the guard can disagree about the
    // number. Reading past it would reinstate the invisibility this fixes.
    const wf =
      "jobs:\n  a:\n    runs-on: ubuntu-24.04\n    steps:\n" +
      "      - env:\n          ZETA_APT_BUDGET_SECONDS: ${{ inputs.budget }}\n        run: ./tools/setup/install.sh\n";
    expect(() => installerJobs(wf, "w.yml")).toThrow(/cannot evaluate/);
  });

  test("an env override on a DOCKER leg is refused — it cannot cross `docker build`", () => {
    // `env:` sets a variable in the runner, not in the container. Reading it would
    // credit the job with a budget linux.sh never sees.
    const wf =
      "jobs:\n  a:\n    runs-on: ubuntu-24.04\n    steps:\n" +
      "      - env:\n          ZETA_APT_BUDGET_SECONDS: 600\n" +
      "        run: docker build -f src/dockerfiles/ubuntu/Dockerfile .\n";
    expect(() => installerJobs(wf, "w.yml", () => "RUN ./tools/setup/install.sh")).toThrow(/docker build/);
  });

  test("...but a --build-arg on a docker leg IS read, because that one does cross", () => {
    const wf =
      "jobs:\n  a:\n    runs-on: ubuntu-24.04\n    steps:\n" +
      "      - run: docker build --build-arg ZETA_APT_BUDGET_SECONDS=600 -f src/dockerfiles/ubuntu/Dockerfile .\n";
    expect(installerJobs(wf, "w.yml", () => "RUN ./tools/setup/install.sh")[0]?.budgetOverrideSeconds).toBe(600);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DEFECT 1: the missing post-installer term.
// ─────────────────────────────────────────────────────────────────────────────
describe("reconcile — the invariant now charges EVERYTHING that is not the apt phase", () => {
  test("fits when the job's own measured non-apt work leaves room for budget + grace", () => {
    const r = reconcile(BUDGET, [job("w.yml", "a", 12)], timings({ key: "w.yml:a", nonApt: 150 }));
    expect(r.ok).toBe(true);
    expect(r.verdicts[0]?.requiredSeconds).toBe(420 + 10 + 150);
    expect(r.verdicts[0]?.boundSource).toBe("measured");
  });

  test("THE BAR — low-memory as it stood before PR #13476 goes RED, and the old bound passed it", () => {
    // MEASURED, from PR #13476's own body against run 32539360563 (a HEALTHY run of the
    // lane, before manifests/apt was tier-gated): apt phase 148s, whole job 637s of the
    // 840s cap. So non-apt = 637 - 148 = 489s.
    const preFix = job("low-memory.yml", "build-and-test-low-memory", 14);
    const r = reconcile(BUDGET, [preFix], timings({ key: jobKey(preFix), nonApt: 489 }));
    expect(r.verdicts[0]?.requiredSeconds).toBe(420 + 10 + 489); // 919s
    expect(r.verdicts[0]?.job.effectiveSeconds).toBe(840);
    expect(r.ok).toBe(false);
    expect(r.detail).toContain("low-memory.yml:build-and-test-low-memory");
    expect(r.detail).toContain("EXCEEDS");

    // ...and this is the exact configuration the SHIPPED bound called fine: the old
    // invariant was budget + kill + a flat 120s "pre-apt reserve", with no term at all
    // for the work that follows. 420 + 10 + 120 = 550 <= 840.
    expect(BUDGET.ciDefaultSeconds + BUDGET.killAfterSeconds + PRE_APT_RESERVE_SECONDS).toBeLessThanOrEqual(840);
  });

  test("the same lane fails on the docker class too when the local budget cannot fit", () => {
    const r = reconcile(BUDGET, [job("d.yml", "docker", 20, "local")], timings({ key: "d.yml:docker", nonApt: 400 }));
    expect(r.verdicts[0]?.requiredSeconds).toBe(1800 + 10 + 400);
    expect(r.ok).toBe(false);
  });

  test("a docker job with room passes at the LOCAL default, not the CI one", () => {
    // `docker build` passes no GITHUB_ACTIONS, so judging it by the CI number would
    // check a budget nothing uses.
    const r = reconcile(BUDGET, [job("d.yml", "docker", 45, "local")], timings({ key: "d.yml:docker", nonApt: 700 }));
    expect(r.verdicts[0]?.budgetSeconds).toBe(1800);
    expect(r.ok).toBe(true);
  });

  test("EVERY job is judged, not just the tightest of its class", () => {
    // The old audit reduced each class to one job and checked that. A roomy job with
    // enormous post-work would have hidden behind a tight job with none.
    const r = reconcile(
      BUDGET,
      [job("w.yml", "tight-but-fine", 12), job("w.yml", "roomy-but-fat", 15)],
      timings({ key: "w.yml:tight-but-fine", nonApt: 100 }, { key: "w.yml:roomy-but-fat", nonApt: 800 }),
    );
    expect(r.verdicts).toHaveLength(2);
    expect(r.ok).toBe(false);
    expect(r.detail).toContain("roomy-but-fat");
    expect(r.detail).not.toContain("tight-but-fine:");
  });

  test("FAILS when a job is tightened below the budget — the original drift, still caught", () => {
    const r = reconcile(BUDGET, [job("a.yml", "tight", 8)], timings({ key: "a.yml:tight", nonApt: 100 }));
    expect(r.ok).toBe(false);
    expect(r.detail).toContain("cancelled");
  });

  test("FAILS when the budget is raised past the job — the same drift, other side", () => {
    const r = reconcile({ ...BUDGET, ciDefaultSeconds: 900 }, [job("a.yml", "b", 12)], timings({ key: "a.yml:b", nonApt: 100 }));
    expect(r.ok).toBe(false);
  });

  test("an empty job set FAILS — an audit with nothing to check is not a pass", () => {
    const r = reconcile(BUDGET, [], timings());
    expect(r.ok).toBe(false);
    expect(r.detail).toContain("nothing to check");
  });

  test("a governed job the timings file never heard of FAILS — coverage is not optional", () => {
    const r = reconcile(BUDGET, [job("new.yml", "just-added", 30)], timings());
    expect(r.ok).toBe(false);
    expect(r.unaccounted).toEqual(["new.yml:just-added"]);
    expect(r.detail).toContain("refresh-apt-job-timings.ts");
  });

  test("a job NAMED unmeasured falls back to the weak pre-apt bound, and says so", () => {
    const t: Timings = { measuredAt: "x", jobs: [], unmeasured: [{ key: "w.yml:never-runs", reason: "0 runs ever" }] };
    const r = reconcile(BUDGET, [job("w.yml", "never-runs", 15)], t);
    expect(r.verdicts[0]?.boundSource).toBe("named-unmeasured");
    expect(r.verdicts[0]?.requiredSeconds).toBe(420 + 10 + PRE_APT_RESERVE_SECONDS);
    expect(r.ok).toBe(true);
  });

  test("...and that fallback still fails when even the weak bound does not fit", () => {
    const t: Timings = { measuredAt: "x", jobs: [], unmeasured: [{ key: "w.yml:never-runs", reason: "0 runs ever" }] };
    const r = reconcile(BUDGET, [job("w.yml", "never-runs", 8)], t);
    expect(r.ok).toBe(false);
  });
});

describe("the baseline is a ratchet, not a suppression", () => {
  const failing = job("low-memory.yml", "build-and-test-low-memory", 14);
  const entry = {
    key: jobKey(failing),
    reason: "measured",
    liftsWhen: "when it fits",
    observedNonAptSeconds: 571,
    observedRequiredSeconds: 1001,
    observedTimeoutSeconds: 840,
  };
  const baseline: Baseline = { findings: [entry] };

  test("an acknowledged finding at the measurement it acknowledged keeps the gate green", () => {
    const r = reconcile(BUDGET, [failing], timings({ key: jobKey(failing), nonApt: 571 }), baseline);
    expect(r.ok).toBe(true);
    expect(r.verdicts[0]?.ok).toBe(false); // still failing — the entry buys a gate, not a fit
    expect(r.verdicts[0]?.acknowledged).toBe(true);
    expect(r.detail).toContain("acknowledged");
  });

  test("ONE SECOND worse than what was acknowledged is NOT covered", () => {
    // A baseline that keeps matching after the thing it excused has grown is the
    // vacuity class with a filename.
    const r = reconcile(BUDGET, [failing], timings({ key: jobKey(failing), nonApt: 572 }), baseline);
    expect(r.ok).toBe(false);
    expect(r.verdicts[0]?.acknowledged).toBe(false);
  });

  test("an entry whose job now FITS is STALE and fails — the ratchet ratchets", () => {
    const r = reconcile(BUDGET, [failing], timings({ key: jobKey(failing), nonApt: 300 }), baseline);
    expect(r.ok).toBe(false);
    expect(r.staleBaselineKeys).toContain(jobKey(failing));
    expect(r.detail).toContain("stopped being true");
  });

  test("an entry naming no governed job at all is STALE too", () => {
    const r = reconcile(
      BUDGET,
      [job("w.yml", "a", 12)],
      timings({ key: "w.yml:a", nonApt: 100 }),
      { findings: [{ ...entry, key: "deleted.yml:gone" }] },
    );
    expect(r.ok).toBe(false);
    expect(r.staleBaselineKeys.join()).toContain("no such governed job");
  });

  test("an entry whose pinned TIMEOUT is not the job's timeout covers nothing", () => {
    // If the lane's cap moves, the entry describes a job that no longer exists.
    const r = reconcile(
      BUDGET,
      [failing],
      timings({ key: jobKey(failing), nonApt: 571 }),
      { findings: [{ ...entry, observedTimeoutSeconds: 900 }] },
    );
    expect(r.ok).toBe(false);
    expect(r.inconsistentBaselineKeys.join()).toContain(jobKey(failing));
  });

  test("an entry whose pinned TOTAL is not budget + kill + its own term covers nothing", () => {
    // Closes the invented-pin hole: without this, `observedNonAptSeconds: 99999` would
    // acknowledge anything this job ever does, forever.
    const r = reconcile(
      BUDGET,
      [failing],
      timings({ key: jobKey(failing), nonApt: 571 }),
      { findings: [{ ...entry, observedNonAptSeconds: 99999 }] },
    );
    expect(r.ok).toBe(false);
    expect(r.detail).toContain("a pin nobody can check is not a pin");
  });

  test("`liftsWhen` names the audit's own arithmetic — a stricter condition would outlive its defect", () => {
    // The 2026-08-22 trap: a LIFTS WHEN stricter than the gate it names keeps an entry
    // alive after the defect is gone. Every shipped condition must mention the numbers
    // this audit actually compares.
    for (const f of loadBaseline(ROOT).findings) {
      expect(f.liftsWhen).toContain("LIFTS WHEN");
      expect(f.liftsWhen).toContain(String(f.observedTimeoutSeconds));
      expect(f.liftsWhen).toContain("nonAptP90Seconds");
    }
  });
});

describe("the live repository", () => {
  test("every governed job is either measured or named unmeasured", () => {
    const r = auditRepo(ROOT);
    expect(r.jobs.length).toBeGreaterThan(20);
    expect(r.unaccounted).toEqual([]);
  });

  test("both budget classes are actually present — half an audit is not a whole one", () => {
    const r = auditRepo(ROOT);
    expect([...new Set(r.verdicts.map((v) => v.job.budgetKind))].sort()).toEqual(["ci", "local"]);
  });

  test("every shipped baseline entry pins arithmetic this tree actually produces", () => {
    expect(auditRepo(ROOT).inconsistentBaselineKeys).toEqual([]);
  });

  test("the shipped budget fits every governed job that is not acknowledged", () => {
    const r = auditRepo(ROOT);
    expect(r.ok, r.detail).toBe(true);
  });

  test("the low-memory lane is caught by the corrected invariant on the REAL tree", () => {
    // Not a fixture: this is the shipped workflow, the shipped budget and the shipped
    // measurement. The lane fails the invariant and is carried by a baseline entry —
    // which is what "caught" means here. A guard that could not catch the case that
    // motivated it has not been demonstrated to work.
    const v = auditRepo(ROOT).verdicts.find((x) => x.key === "low-memory.yml:build-and-test-low-memory");
    expect(v).toBeDefined();
    expect(v?.ok).toBe(false);
    expect(v?.acknowledged).toBe(true);
    expect(v?.requiredSeconds).toBeGreaterThan(v?.job.effectiveSeconds ?? 0);
  });

  test("the measurements carry provenance — run ids and a window, not bare numbers", () => {
    const t = loadTimings(ROOT);
    expect(t.jobs.length).toBeGreaterThan(20);
    for (const row of t.jobs) {
      expect(row.samples).toBeGreaterThan(0);
      expect(row.runIds.length).toBeGreaterThan(0);
      expect(row.nonAptP90Seconds).toBeGreaterThan(0);
      expect(row.nonAptMaxSeconds).toBeGreaterThanOrEqual(row.nonAptP90Seconds);
      expect(row.window).toMatch(/\d{4}-\d\d-\d\d/);
    }
  });

  test("every unmeasured job carries a REASON, not a shrug", () => {
    for (const u of loadTimings(ROOT).unmeasured) {
      expect(u.reason.length).toBeGreaterThan(80);
      expect(u.reason).not.toContain("WRITE THE REAL REASON");
    }
  });

  test("the two acknowledgement files are the ones the audit actually reads", () => {
    expect(() => readFileSync(resolve(ROOT, TIMINGS_PATH), "utf8")).not.toThrow();
    expect(() => readFileSync(resolve(ROOT, BASELINE_PATH), "utf8")).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// The CLI's own exit code. Everything above tests `reconcile`; `main` is what CI
// actually runs, and a `main` that always returns 0 is the whole audit wearing a
// pass. (Caught by mutation M4 on 2026-08-22: every other check survived it.)
// ─────────────────────────────────────────────────────────────────────────────
describe("main — the exit code CI reads", () => {
  /** A miniature repo: one installer job, one budget, one measurement. */
  function fixtureRepo(timeoutMinutes: number, nonAptSeconds: number): string {
    const dir = mkdtempSync(join(tmpdir(), "zeta-apt-main-"));
    mkdirSync(join(dir, "tools/setup"), { recursive: true });
    mkdirSync(join(dir, ".github/workflows"), { recursive: true });
    mkdirSync(join(dir, "src/Core.TypeScript/hygiene"), { recursive: true });
    writeFileSync(
      join(dir, "tools/setup/linux.sh"),
      ["ZETA_APT_CI_BUDGET_DEFAULT_SECONDS=420", "ZETA_APT_LOCAL_BUDGET_DEFAULT_SECONDS=1800", "apt_kill_after=10", ""].join("\n"),
    );
    writeFileSync(
      join(dir, ".github/workflows/w.yml"),
      `jobs:\n  a:\n    runs-on: ubuntu-24.04\n    timeout-minutes: ${String(timeoutMinutes)}\n` +
        "    steps:\n      - run: ./tools/setup/install.sh\n",
    );
    writeFileSync(
      join(dir, TIMINGS_PATH),
      JSON.stringify({
        measuredAt: "2026-08-22",
        jobs: [
          {
            key: "w.yml:a",
            samples: 20,
            nonAptP90Seconds: nonAptSeconds,
            nonAptMaxSeconds: nonAptSeconds,
            aptP90Seconds: 50,
            window: "2026-08-22 .. 2026-08-22",
            runIds: [1],
          },
        ],
        unmeasured: [],
      }),
    );
    writeFileSync(join(dir, BASELINE_PATH), JSON.stringify({ findings: [] }));
    return dir;
  }

  function mainIn(dir: string, argv: string[]): number {
    const prior = process.env["REPO_ROOT"];
    process.env["REPO_ROOT"] = dir;
    try {
      return main(argv);
    } finally {
      if (prior === undefined) delete process.env["REPO_ROOT"];
      else process.env["REPO_ROOT"] = prior;
    }
  }

  test("exits 1 when a job cannot hold its budget", () => {
    const dir = fixtureRepo(10, 400); // 420 + 10 + 400 = 830 > 600
    try {
      expect(mainIn(dir, [])).toBe(1);
      expect(mainIn(dir, ["--human"])).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("exits 0 when it fits — so the 1 above is a verdict, not a constant", () => {
    const dir = fixtureRepo(20, 400); // 830 <= 1200
    try {
      expect(mainIn(dir, [])).toBe(0);
      expect(mainIn(dir, ["--human"])).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("exits 0 on the live repository — the shipped tree is green", () => {
    expect(main([])).toBe(0);
  });
});

