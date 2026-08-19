import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  GITHUB_DEFAULT_TIMEOUT_MINUTES,
  PRE_APT_RESERVE_SECONDS,
  auditRepo,
  installerJobs,
  parseAptBudget,
  reconcile,
  type AptBudget,
  type BudgetKind,
} from "./audit-apt-budget-fits-job-timeout";

const ROOT = resolve(import.meta.dir, "../../..");

const BUDGET: AptBudget = {
  ciDefaultSeconds: 150,
  localDefaultSeconds: 1800,
  killAfterSeconds: 10,
};

function job(workflow: string, name: string, timeoutMinutes: number | null, budgetKind: BudgetKind = "ci") {
  return {
    workflow,
    job: name,
    timeoutMinutes,
    effectiveSeconds: (timeoutMinutes ?? GITHUB_DEFAULT_TIMEOUT_MINUTES) * 60,
    budgetKind,
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

describe("installerJobs — which jobs pay the apt phase", () => {
  const yaml = `
jobs:
  runs-installer:
    runs-on: ubuntu-24.04
    timeout-minutes: 12
    steps:
      - run: ./tools/setup/install.sh
  no-installer:
    runs-on: ubuntu-24.04
    timeout-minutes: 2
    steps:
      - run: bun test
  windows-only:
    runs-on: windows-2022
    timeout-minutes: 3
    steps:
      - run: ./tools/setup/install.sh
  undeclared-timeout:
    runs-on: ubuntu-24.04
    steps:
      - run: bash tools/setup/linux.sh
  docker-ubuntu:
    runs-on: ubuntu-24.04
    timeout-minutes: 45
    steps:
      - run: docker build -f src/Core.TypeScript/ci/dockerfiles/ubuntu-x/Dockerfile .
  docker-nixos:
    runs-on: ubuntu-24.04
    timeout-minutes: 15
    steps:
      - run: docker build -f src/Core.TypeScript/ci/dockerfiles/nixos-x/Dockerfile .
`;
  const dockerfiles: Record<string, string> = {
    "src/Core.TypeScript/ci/dockerfiles/ubuntu-x/Dockerfile": "RUN ./tools/setup/install.sh\n",
    "src/Core.TypeScript/ci/dockerfiles/nixos-x/Dockerfile": "RUN touch /etc/NIXOS\nRUN ./tools/setup/install.sh\n",
  };
  const found = installerJobs(yaml, "w.yml", (p) => dockerfiles[p] ?? null);

  test("finds jobs that invoke the installer, ignores jobs that do not", () => {
    expect(found.map((j) => j.job).sort()).toEqual(["docker-ubuntu", "runs-installer", "undeclared-timeout"]);
  });

  test("a job that runs the installer inside `docker build` is NOT invisible", () => {
    // Its `run:` never names the installer. Missing this class is the same
    // unaudited-hole defect the whole audit exists to prevent.
    const d = found.find((j) => j.job === "docker-ubuntu");
    expect(d?.budgetKind).toBe("local");
  });

  test("a NixOS container is excluded — linux.sh skips the entire apt phase there", () => {
    // /etc/NIXOS short-circuits the apt step, so there is no budget to fit and a
    // 15-minute job is not a violation.
    expect(found.some((j) => j.job === "docker-nixos")).toBe(false);
  });

  test("a Windows-only job is excluded — install.ps1 never runs the apt phase", () => {
    // Otherwise a tight Windows job would constrain a Linux-only budget.
    expect(found.some((j) => j.job === "windows-only")).toBe(false);
  });

  test("an undeclared timeout means GitHub's 360-minute default, not 'unbounded'", () => {
    const u = found.find((j) => j.job === "undeclared-timeout");
    expect(u?.timeoutMinutes).toBeNull();
    expect(u?.effectiveSeconds).toBe(GITHUB_DEFAULT_TIMEOUT_MINUTES * 60);
  });
});

describe("reconcile — the invariant", () => {
  test("fits when the tightest job leaves room for budget + grace + reserve", () => {
    const r = reconcile(BUDGET, [job("gate.yml", "lint-shell", 12), job("a.yml", "b", 5)]);
    expect(r.ok).toBe(true);
    expect(r.perKind).toHaveLength(1);
    expect(r.perKind[0]?.required).toBe(150 + 10 + PRE_APT_RESERVE_SECONDS);
    expect(r.perKind[0]?.tightest.job).toBe("b");
  });

  test("a docker job is judged against the LOCAL default, not the CI one", () => {
    // `docker build` passes no GITHUB_ACTIONS, so linux.sh picks the local default
    // there. Judging it by the CI number would check a budget nothing uses.
    const r = reconcile(BUDGET, [job("d.yml", "docker", 45, "local")]);
    expect(r.perKind[0]?.required).toBe(1800 + 10 + PRE_APT_RESERVE_SECONDS);
    expect(r.ok).toBe(true);
  });

  test("a docker job too tight for the local default FAILS on its own class", () => {
    const r = reconcile(BUDGET, [job("gate.yml", "runner", 12), job("d.yml", "docker", 20, "local")]);
    expect(r.ok).toBe(false);
    expect(r.detail).toContain("d.yml:docker");
    // ...and the runner class, which is fine, still reports its own margin.
    expect(r.perKind.find((k) => k.kind === "ci")?.ok).toBe(true);
  });

  test("FAILS when a job is tightened below the budget — the drift this audit is for", () => {
    const r = reconcile(BUDGET, [job("gate.yml", "lint-shell", 12), job("a.yml", "tight", 4)]);
    expect(r.ok).toBe(false);
    expect(r.detail).toContain("cancelled");
    expect(r.detail).toContain("a.yml:tight");
  });

  test("FAILS when the budget is raised past the tightest job — the same drift, other side", () => {
    const r = reconcile({ ...BUDGET, ciDefaultSeconds: 600 }, [job("a.yml", "b", 5)]);
    expect(r.ok).toBe(false);
  });

  test("the pre-2026-08-18 retry budget would NOT have fitted — the defect, priced", () => {
    // 3 x 600s per-attempt timeout + 45s backoff = 1845s against a 300s job.
    const r = reconcile({ ...BUDGET, ciDefaultSeconds: 1845 }, [job("a.yml", "b", 5)]);
    expect(r.ok).toBe(false);
    expect(r.perKind[0]?.required).toBeGreaterThan(6 * 300);
  });

  test("an empty job set FAILS — an audit with nothing to check is not a pass", () => {
    const r = reconcile(BUDGET, []);
    expect(r.ok).toBe(false);
    expect(r.detail).toContain("nothing to check");
  });
});

describe("the live repository", () => {
  test("the shipped apt budget fits inside the tightest job that runs install.sh", () => {
    const r = auditRepo(ROOT);
    expect(r.jobs.length).toBeGreaterThan(20);
    // Both classes are actually present — a pass that checked only one would be
    // half an audit wearing a whole one's face.
    expect(r.perKind.map((k) => k.kind).sort()).toEqual(["ci", "local"]);
    // Message carries the arithmetic so a failure needs no second command to explain it.
    expect(r.ok, r.detail).toBe(true);
  });
});
