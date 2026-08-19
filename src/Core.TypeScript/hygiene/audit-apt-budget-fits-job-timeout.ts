#!/usr/bin/env bun
// audit-apt-budget-fits-job-timeout.ts — the apt wall budget must FIT inside the
// tightest CI job that runs the installer.
//
// THE DEFECT THIS CLOSES (measured 2026-08-18)
// --------------------------------------------
// `tools/setup/linux.sh` bounded each `apt-get install` at 600s and retried it
// three times, with 45s of backoff: a worst case of 1845s = 30.75 minutes. Every
// job that runs `tools/setup/install.sh` carries a `timeout-minutes` between 5
// and 45, and the tightest are 5-12 minutes. So on a stalling archive mirror the
// JOB was killed part-way through attempt 2 and reported `cancelled` — the guard
// made `apt-get` return, but the retry loop it returned into could not finish.
//
// That is the vacuity class in its CI form: a check that cannot run to completion
// looks exactly like one that ran and passed. Fixing the arithmetic once does not
// keep it fixed, because the two numbers live in two files that nobody diffs
// together — `timeout-minutes` is edited in workflow YAML by whoever is tuning a
// job, and the budget is edited in a shell script by whoever is tuning the
// installer. This audit is the edge between them.
//
// THE INVARIANT
// -------------
//     ci_budget + kill_after + PRE_APT_RESERVE_SECONDS  <=  tightest_job_seconds
//
// Read it as: when the shared deadline expires, linux.sh exits IMMEDIATELY with a
// readable cause. For that exit to be observable the whole apt phase plus the
// work that precedes it (checkout, cache restore) must fit inside the job. The
// reserve is that preceding work — MEASURED at 12.9s on run 32151321559 (a
// no-cache 5-minute job) and under ~90s on the big-cache gate jobs; 120s rounds
// up. `kill_after` is the SIGKILL grace `timeout` adds when SIGTERM is ignored.
//
// WHY THE BUDGET IS PARSED FROM linux.sh AND NOT RESTATED HERE. A constant copied
// into the checker is a second source of truth, and a checker that agrees with
// its own copy proves nothing. The shell assignment IS the value the runner uses.
//
// TWO CLASSES OF JOB, TWO BUDGETS. linux.sh picks its default from GITHUB_ACTIONS.
// A job that runs the installer directly on the runner sees that variable and gets
// the CI default; a job that runs it inside `docker build` does NOT (Docker passes
// no ambient environment), so the container gets the LOCAL default — which is the
// right budget there, because a cold container really does fetch the whole manifest.
// Checking every job against the CI number would therefore have been checking the
// wrong number for the docker legs, and missing them entirely (their `run:` names a
// Dockerfile, not the installer) would have left a whole class unaudited. Both are
// the failure this audit exists to prevent, so both are modelled.
//
// NixOS containers are excluded: linux.sh short-circuits the ENTIRE apt phase on the
// /etc/NIXOS marker, so there is no budget to fit.
//
// Rule 0: TypeScript, no new .sh files (`.claude/rules/rule-0-no-sh-files.md`).
//
// Usage:
//   bun src/Core.TypeScript/hygiene/audit-apt-budget-fits-job-timeout.ts
//   bun src/Core.TypeScript/hygiene/audit-apt-budget-fits-job-timeout.ts --human
//
// Exit codes: 0 = the budget fits; 1 = it does not (or a value could not be read).

import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";

/** Work that runs BEFORE the apt phase inside the same job: checkout + cache restore. */
export const PRE_APT_RESERVE_SECONDS = 120;

/** GitHub's own default when a job declares no `timeout-minutes` (6 hours). */
export const GITHUB_DEFAULT_TIMEOUT_MINUTES = 360;

/** Paths whose presence in a `run:` block means "this job runs the apt phase". */
const INSTALLER_PATHS = ["tools/setup/install.sh", "tools/setup/linux.sh"];

/** Dockerfile references in a `run:` block — the indirect way a job runs the installer. */
const DOCKERFILE_RE = /[\w./-]*dockerfiles\/[\w.-]+\/Dockerfile/g;

/** Which default linux.sh will pick, given how the job invokes it. */
export type BudgetKind = "ci" | "local";

export interface AptBudget {
  /** Default wall budget for the whole apt phase under GITHUB_ACTIONS=true. */
  readonly ciDefaultSeconds: number;
  /** Default wall budget everywhere else (laptop, devcontainer). */
  readonly localDefaultSeconds: number;
  /** `timeout --kill-after` grace, in seconds. */
  readonly killAfterSeconds: number;
}

export interface InstallerJob {
  readonly workflow: string;
  readonly job: string;
  /** null when the job declares none — GitHub's 360-minute default then applies. */
  readonly timeoutMinutes: number | null;
  readonly effectiveSeconds: number;
  /** "ci" on the runner (GITHUB_ACTIONS is set); "local" inside `docker build`. */
  readonly budgetKind: BudgetKind;
}

export interface Reconciliation {
  readonly ok: boolean;
  readonly budget: AptBudget;
  /** Per class: what the budget needs, and the tightest job that has to grant it. */
  readonly perKind: readonly {
    readonly kind: BudgetKind;
    readonly required: number;
    readonly tightest: InstallerJob;
    readonly ok: boolean;
  }[];
  readonly jobs: readonly InstallerJob[];
  readonly detail: string;
}

function requireInt(source: string, name: string): number {
  // Anchored to a bare-integer assignment on its own line, so a computed or
  // quoted value fails loudly rather than being silently mis-read.
  const m = new RegExp(String.raw`^\s*${name}=(\d+)\s*$`, "m").exec(source);
  if (!m?.[1]) {
    throw new Error(
      `could not read ${name} from tools/setup/linux.sh — the audit reads the shell ` +
        `assignment directly so there is no second copy to drift; keep it a bare integer ` +
        `on its own line`,
    );
  }
  return Number.parseInt(m[1], 10);
}

/** Read the budget constants out of the shell source that actually uses them. */
export function parseAptBudget(shellSource: string): AptBudget {
  return {
    ciDefaultSeconds: requireInt(shellSource, "ZETA_APT_CI_BUDGET_DEFAULT_SECONDS"),
    localDefaultSeconds: requireInt(shellSource, "ZETA_APT_LOCAL_BUDGET_DEFAULT_SECONDS"),
    killAfterSeconds: requireInt(shellSource, "apt_kill_after"),
  };
}

function runsOnlyOnNonLinux(runsOn: unknown): boolean {
  const text = JSON.stringify(runsOn ?? "").toLowerCase();
  if (text.includes("${{")) return false; // matrix expression — assume it can be Linux
  const namesLinux = text.includes("ubuntu") || text.includes("linux") || text.includes("self-hosted");
  const namesOther = text.includes("windows") || text.includes("macos");
  return namesOther && !namesLinux;
}

/**
 * Every job in one workflow whose steps invoke the installer on a Linux runner —
 * directly (`run: ./tools/setup/install.sh`) or through a Dockerfile that does.
 *
 * `readDockerfile` returns the text of a repo-relative Dockerfile path, or null when
 * it does not exist. Injected so the parsing is testable without a filesystem.
 */
export function installerJobs(
  workflowYaml: string,
  workflowName: string,
  readDockerfile: (repoRelativePath: string) => string | null = () => null,
): InstallerJob[] {
  const doc = parseYaml(workflowYaml) as { jobs?: Record<string, unknown> } | null;
  const jobs = doc?.jobs;
  if (!jobs || typeof jobs !== "object") return [];
  const out: InstallerJob[] = [];
  for (const [name, raw] of Object.entries(jobs)) {
    if (!raw || typeof raw !== "object") continue;
    const job = raw as Record<string, unknown>;
    const steps = JSON.stringify(job.steps ?? "");
    let kind: BudgetKind | null = null;
    if (INSTALLER_PATHS.some((p) => steps.includes(p))) {
      kind = "ci";
    } else {
      for (const ref of steps.match(DOCKERFILE_RE) ?? []) {
        const text = readDockerfile(ref.replace(/^\.\//, ""));
        if (text === null) continue;
        // A NixOS image short-circuits the whole apt phase — no budget to fit.
        if (text.includes("/etc/NIXOS")) continue;
        if (INSTALLER_PATHS.some((p) => text.includes(p))) {
          kind = "local"; // `docker build` passes no GITHUB_ACTIONS into the container
          break;
        }
      }
    }
    if (kind === null) continue;
    if (runsOnlyOnNonLinux(job["runs-on"])) continue;
    const declared = job["timeout-minutes"];
    const timeoutMinutes = typeof declared === "number" ? declared : null;
    out.push({
      workflow: workflowName,
      job: name,
      timeoutMinutes,
      effectiveSeconds: (timeoutMinutes ?? GITHUB_DEFAULT_TIMEOUT_MINUTES) * 60,
      budgetKind: kind,
    });
  }
  return out;
}

export function reconcile(budget: AptBudget, jobs: readonly InstallerJob[]): Reconciliation {
  if (jobs.length === 0) {
    return {
      ok: false,
      budget,
      perKind: [],
      jobs,
      detail:
        "no workflow job invokes tools/setup/install.sh — either the installer moved or " +
        "this audit stopped seeing it; an audit with nothing to check is not a passing audit",
    };
  }
  const defaults: Record<BudgetKind, number> = {
    ci: budget.ciDefaultSeconds,
    local: budget.localDefaultSeconds,
  };
  const perKind: Reconciliation["perKind"] = (["ci", "local"] as const)
    .map((kind) => {
      const of = jobs.filter((j) => j.budgetKind === kind);
      if (of.length === 0) return null;
      const tightest = of.reduce((a, b) => (b.effectiveSeconds < a.effectiveSeconds ? b : a));
      const required = defaults[kind] + budget.killAfterSeconds + PRE_APT_RESERVE_SECONDS;
      return { kind, required, tightest, ok: required <= tightest.effectiveSeconds };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const ok = perKind.every((k) => k.ok);
  const line = (k: Reconciliation["perKind"][number]) =>
    `${k.kind}: ${String(k.required)}s needed vs ${String(k.tightest.effectiveSeconds)}s in ` +
    `${k.tightest.workflow}:${k.tightest.job}` +
    (k.ok ? ` (margin ${String(k.tightest.effectiveSeconds - k.required)}s)` : " — EXCEEDS");
  return {
    ok,
    budget,
    perKind,
    jobs,
    detail: ok
      ? perKind.map(line).join("; ")
      : perKind.map(line).join("; ") +
        ". On a stalled mirror that job is killed mid-apt and reports `cancelled` instead of " +
        "the installer's own error. Lower the matching default in tools/setup/linux.sh, or " +
        "raise that job's timeout-minutes.",
  };
}

export function auditRepo(root: string): Reconciliation {
  const budget = parseAptBudget(readFileSync(join(root, "tools/setup/linux.sh"), "utf8"));
  const readDockerfile = (rel: string): string | null => {
    try {
      return readFileSync(join(root, rel), "utf8");
    } catch {
      return null;
    }
  };
  const dir = join(root, ".github/workflows");
  const jobs: InstallerJob[] = [];
  for (const file of readdirSync(dir).sort()) {
    if (!file.endsWith(".yml") && !file.endsWith(".yaml")) continue;
    jobs.push(...installerJobs(readFileSync(join(dir, file), "utf8"), file, readDockerfile));
  }
  return reconcile(budget, jobs);
}

export function main(argv: string[]): number {
  const root = resolve(process.env["REPO_ROOT"] ?? process.cwd());
  const r = auditRepo(root);
  if (argv.includes("--human")) {
    const sorted = [...r.jobs].sort((a, b) => a.effectiveSeconds - b.effectiveSeconds).slice(0, 10);
    process.stdout.write(
      `apt budget: ${String(r.budget.ciDefaultSeconds)}s CI / ` +
        `${String(r.budget.localDefaultSeconds)}s local, ` +
        `${String(r.budget.killAfterSeconds)}s kill grace, ` +
        `${String(PRE_APT_RESERVE_SECONDS)}s pre-apt reserve\n` +
        `installer jobs: ${String(r.jobs.length)}\n` +
        sorted
          .map(
            (j) =>
              `  ${String(j.effectiveSeconds).padStart(6)}s  [${j.budgetKind}] ` +
              `${j.workflow}:${j.job}` +
              (j.timeoutMinutes === null ? "  (no timeout-minutes — GitHub default)" : ""),
          )
          .join("\n") +
        `\n${r.ok ? "OK" : "FAIL"} — ${r.detail}\n`,
    );
  } else if (!r.ok) {
    process.stderr.write(`apt-budget-fits-job-timeout: FAIL — ${r.detail}\n`);
  }
  return r.ok ? 0 : 1;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
