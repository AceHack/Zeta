#!/usr/bin/env bun
// audit-apt-budget-fits-job-timeout.ts — the apt wall budget must FIT inside the
// job that runs the installer, ALONGSIDE everything else that job does.
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
// THE DEFECT THE FIRST VERSION OF THIS AUDIT SHIPPED WITH (measured 2026-08-22)
// ----------------------------------------------------------------------------
// The invariant used to read
//
//     ci_budget + kill_after + PRE_APT_RESERVE_SECONDS(120) <= tightest_job_seconds
//
// and the comment defined that reserve as "the work that PRECEDES it". THERE WAS
// NO TERM FOR THE WORK THAT FOLLOWS IT. For `low-memory.yml` that arithmetic read
// 420 + 10 + 120 = 550 <= 840 and PASSED — while the same lane's non-apt work
// measures 571s at p90 (20 successful runs, 2026-08-22). The guard written to stop
// "a check that could not run to completion looks like one that passed" permitted
// exactly that, for the one lane whose apt phase had already been measured over
// budget. It also read only the DEFAULT budget, so the per-lane
// `ZETA_APT_BUDGET_SECONDS` override that `linux.sh` advertises was invisible to
// it: a lane could raise its own budget past anything and nothing went red.
//
// THE INVARIANT NOW
// -----------------
//     budget(job) + kill_after + nonApt(job)  <=  job_timeout_seconds
//
// where
//   * `budget(job)` is that job's own `ZETA_APT_BUDGET_SECONDS` if it declares one,
//     else the default `linux.sh` picks for that job's class (see TWO CLASSES below);
//   * `nonApt(job)` is MEASURED: the p90 over recent successful runs of
//     (job wall seconds − the longest single apt phase in that run), read from
//     `apt-job-timings.measured.json`. It replaces the 120s guess with a number per
//     job, because "everything else this job does" is 71s for the local-LLM lane and
//     571s for the 1-vCPU low-memory lane and no single constant is honest for both.
//
// Read it as: when the shared deadline expires, linux.sh exits IMMEDIATELY with a
// readable cause AND the job is still alive to print it. The apt phase is charged at
// its BUDGET rather than its measured cost, because the budget is what the job has
// promised to be able to survive; charging the healthy cost would be checking the
// case that never fails. `kill_after` is the SIGKILL grace `timeout` adds.
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
// AND THE OVERRIDE CANNOT CROSS THAT LINE. `env:` on a docker-build step sets a
// variable in the RUNNER, not in the container, so a `ZETA_APT_BUDGET_SECONDS`
// declared there reaches nothing — it is a knob that looks connected and turns
// nothing, which is the same class of defect as the missing term above. This audit
// refuses it rather than reading it: on a docker leg the override must travel as a
// `--build-arg`, and the Dockerfile must name it.
//
// NixOS containers are excluded: linux.sh short-circuits the ENTIRE apt phase on the
// /etc/NIXOS marker, so there is no budget to fit.
//
// WHAT THIS AUDIT STILL DOES NOT MODEL, stated rather than discovered later:
//   * The 5-attempt `install.sh` retry wrapper (12 governed jobs carry it inline).
//     A job whose whole installer step is retried can spend up to 5 budgets. That is
//     NOT charged here, and the reason is that the failure it produces is not the
//     silent one: attempt 1 has already printed linux.sh's own "did not succeed
//     within the Ns apt budget" into the log before attempt 2 begins, so a job killed
//     during attempt 3 still carries a readable cause. Measured worst case observed:
//     409s of apt across retries in gate.yml:lint-csharp (job 97018601440).
//   * Staleness of the measurements. `apt-job-timings.measured.json` is a committed
//     snapshot; a job that grows slower after it was measured is under-charged until
//     someone re-runs `refresh-apt-job-timings.ts`. The alternative — calling the
//     Actions API from the audit — trades a stale number for a check that passes when
//     the network is down, which is strictly worse.
//
// Rule 0: TypeScript, no new .sh files (`.claude/rules/rule-0-no-sh-files.md`).
//
// Usage:
//   bun src/Core.TypeScript/hygiene/audit-apt-budget-fits-job-timeout.ts
//   bun src/Core.TypeScript/hygiene/audit-apt-budget-fits-job-timeout.ts --human
//
// Exit codes: 0 = every governed job fits; 1 = one does not (or a value could not be read).

import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";

/**
 * Fallback bound for a job that has no measurement: the work before the apt phase
 * (checkout + cache restore), MEASURED at 12.9s on run 32151321559 and under ~90s
 * on the big-cache gate jobs; 120s rounds up. It is a LOWER bound on the true
 * non-apt time — it omits everything after the apt phase — so it is used only where
 * a measurement does not exist, and only for jobs named in the timings file's
 * `unmeasured` list. It is deliberately NOT the general term any more.
 */
export const PRE_APT_RESERVE_SECONDS = 120;

/** GitHub's own default when a job declares no `timeout-minutes` (6 hours). */
export const GITHUB_DEFAULT_TIMEOUT_MINUTES = 360;

/** The measured non-apt wall time of every governed job. */
export const TIMINGS_PATH = "src/Core.TypeScript/hygiene/apt-job-timings.measured.json";

/** Acknowledged, reasoned, dated violations that are not being repaired here. */
export const BASELINE_PATH = "src/Core.TypeScript/hygiene/audit-apt-budget-fits-job-timeout.baseline.json";

/** The per-job override `tools/setup/linux.sh` honours. */
export const BUDGET_OVERRIDE_VAR = "ZETA_APT_BUDGET_SECONDS";

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
  /** This job's own `ZETA_APT_BUDGET_SECONDS`, when it declares one it can actually deliver. */
  readonly budgetOverrideSeconds: number | null;
}

/** One job's measured non-apt wall time, with the provenance that makes it checkable. */
export interface JobTiming {
  readonly key: string;
  readonly samples: number;
  readonly nonAptP90Seconds: number;
  readonly nonAptMaxSeconds: number;
  readonly aptP90Seconds: number;
  readonly window: string;
  readonly runIds: readonly number[];
}

export interface Timings {
  readonly measuredAt: string;
  readonly jobs: readonly JobTiming[];
  /** Governed jobs no run could measure, each with the reason it could not. */
  readonly unmeasured: readonly { readonly key: string; readonly reason: string }[];
}

export interface BaselineEntry {
  readonly key: string;
  readonly reason: string;
  readonly liftsWhen: string;
  /** The measurement that was acknowledged. A worse one is NOT covered. */
  readonly observedNonAptSeconds: number;
  readonly observedRequiredSeconds: number;
  readonly observedTimeoutSeconds: number;
}

export interface Baseline {
  readonly findings: readonly BaselineEntry[];
}

/** How a job's non-apt term was obtained — a measurement, or the weak fallback. */
export type BoundSource = "measured" | "named-unmeasured";

export interface JobVerdict {
  readonly key: string;
  readonly job: InstallerJob;
  readonly budgetSeconds: number;
  readonly nonAptSeconds: number;
  readonly boundSource: BoundSource;
  readonly requiredSeconds: number;
  readonly ok: boolean;
  /** Set when the job does NOT fit but a baseline entry covers exactly this measurement. */
  readonly acknowledged: boolean;
}

export interface Reconciliation {
  readonly ok: boolean;
  readonly budget: AptBudget;
  readonly verdicts: readonly JobVerdict[];
  readonly jobs: readonly InstallerJob[];
  /** Governed jobs the timings file mentions nowhere — neither measured nor named. */
  readonly unaccounted: readonly string[];
  /** Baseline entries that cover nothing any more; each is refused in its own right. */
  readonly staleBaselineKeys: readonly string[];
  /** Baseline entries whose pinned arithmetic disagrees with the tree. */
  readonly inconsistentBaselineKeys: readonly string[];
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
 * Read `ZETA_APT_BUDGET_SECONDS` out of one `env:` map. Returns null when absent.
 * A value the audit cannot resolve to an integer THROWS: an unreadable knob is
 * exactly the invisibility this function exists to end, and guessing past it would
 * restore it under a nicer name.
 */
function envOverride(env: unknown, where: string): number | null {
  if (!env || typeof env !== "object") return null;
  const raw = (env as Record<string, unknown>)[BUDGET_OVERRIDE_VAR];
  if (raw === undefined) return null;
  const text = String(raw).trim();
  if (!/^\d+$/.test(text)) {
    throw new Error(
      `${where} sets ${BUDGET_OVERRIDE_VAR}=${text}, which this audit cannot evaluate. ` +
        `The budget must be a literal integer where the guard can read it — an expression ` +
        `means the runner and the guard can disagree about the number, which is the drift ` +
        `this audit exists to catch.`,
    );
  }
  return Number.parseInt(text, 10);
}

/** `--build-arg ZETA_APT_BUDGET_SECONDS=NNN` — the only form that crosses `docker build`. */
function buildArgOverride(runText: string): number | null {
  const m = new RegExp(String.raw`--build-arg[=\s]+${BUDGET_OVERRIDE_VAR}=(\d+)`).exec(runText);
  return m?.[1] === undefined ? null : Number.parseInt(m[1], 10);
}

/** `ZETA_APT_BUDGET_SECONDS=NNN ./tools/setup/install.sh` — inline in the run block. */
function inlineRunOverride(runText: string): number | null {
  const m = new RegExp(String.raw`(?:^|[\s;&|])${BUDGET_OVERRIDE_VAR}=(\d+)\s`, "m").exec(runText);
  return m?.[1] === undefined ? null : Number.parseInt(m[1], 10);
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
  const doc = parseYaml(workflowYaml) as { jobs?: Record<string, unknown>; env?: unknown } | null;
  const jobs = doc?.jobs;
  if (!jobs || typeof jobs !== "object") return [];
  const workflowEnv = envOverride(doc?.env, `${workflowName} (workflow env)`);
  const out: InstallerJob[] = [];
  for (const [name, raw] of Object.entries(jobs)) {
    if (!raw || typeof raw !== "object") continue;
    const job = raw as Record<string, unknown>;
    const steps: Record<string, unknown>[] = Array.isArray(job.steps)
      ? (job.steps as Record<string, unknown>[]).filter((s) => s !== null && typeof s === "object")
      : [];
    let kind: BudgetKind | null = null;
    let installerStep: Record<string, unknown> | null = null;
    for (const step of steps) {
      const stepText = JSON.stringify(step);
      if (INSTALLER_PATHS.some((p) => stepText.includes(p))) {
        kind = "ci";
        installerStep = step;
        break;
      }
      let viaDocker = false;
      for (const ref of stepText.match(DOCKERFILE_RE) ?? []) {
        const text = readDockerfile(ref.replace(/^\.\//, ""));
        if (text === null) continue;
        // A NixOS image short-circuits the whole apt phase — no budget to fit.
        if (text.includes("/etc/NIXOS")) continue;
        if (INSTALLER_PATHS.some((p) => text.includes(p))) {
          viaDocker = true;
          break;
        }
      }
      if (viaDocker) {
        kind = "local"; // `docker build` passes no GITHUB_ACTIONS into the container
        installerStep = step;
        break;
      }
    }
    if (kind === null || installerStep === null) continue;
    if (runsOnlyOnNonLinux(job["runs-on"])) continue;

    const where = `${workflowName}:${name}`;
    const runText = typeof installerStep["run"] === "string" ? (installerStep["run"] as string) : "";
    const stepEnv = envOverride(installerStep["env"], `${where} (step env)`);
    const jobEnv = envOverride(job["env"], `${where} (job env)`);
    let override: number | null;
    if (kind === "local") {
      // On a docker leg the runner's environment does not reach the container, so an
      // `env:` override is a knob wired to nothing. Refuse it rather than read it.
      const declared = stepEnv ?? jobEnv ?? workflowEnv;
      if (declared !== null) {
        throw new Error(
          `${where} declares ${BUDGET_OVERRIDE_VAR} in \`env:\`, but this job runs the installer ` +
            `inside \`docker build\`, which passes no ambient environment into the container. The ` +
            `override reaches nothing and linux.sh would still use its local default. Pass it as ` +
            `\`--build-arg ${BUDGET_OVERRIDE_VAR}=<n>\` and have the Dockerfile declare the ARG.`,
        );
      }
      override = buildArgOverride(runText);
    } else {
      override = inlineRunOverride(runText) ?? stepEnv ?? jobEnv ?? workflowEnv;
    }

    const declared = job["timeout-minutes"];
    const timeoutMinutes = typeof declared === "number" ? declared : null;
    out.push({
      workflow: workflowName,
      job: name,
      timeoutMinutes,
      effectiveSeconds: (timeoutMinutes ?? GITHUB_DEFAULT_TIMEOUT_MINUTES) * 60,
      budgetKind: kind,
      budgetOverrideSeconds: override,
    });
  }
  return out;
}

export function jobKey(job: InstallerJob): string {
  return `${job.workflow}:${job.job}`;
}

/** The budget `linux.sh` will actually use in this job. */
export function budgetFor(budget: AptBudget, job: InstallerJob): number {
  if (job.budgetOverrideSeconds !== null) return job.budgetOverrideSeconds;
  return job.budgetKind === "ci" ? budget.ciDefaultSeconds : budget.localDefaultSeconds;
}

export function reconcile(
  budget: AptBudget,
  jobs: readonly InstallerJob[],
  timings: Timings,
  baseline: Baseline = { findings: [] },
): Reconciliation {
  if (jobs.length === 0) {
    return {
      ok: false,
      budget,
      verdicts: [],
      jobs,
      unaccounted: [],
      staleBaselineKeys: [],
      inconsistentBaselineKeys: [],
      detail:
        "no workflow job invokes tools/setup/install.sh — either the installer moved or " +
        "this audit stopped seeing it; an audit with nothing to check is not a passing audit",
    };
  }
  const measured = new Map(timings.jobs.map((t) => [t.key, t]));
  const named = new Set(timings.unmeasured.map((u) => u.key));
  const acknowledged = new Map(baseline.findings.map((f) => [f.key, f]));

  const unaccounted: string[] = [];
  const inconsistentBaselineKeys: string[] = [];
  const verdicts: JobVerdict[] = [];
  for (const job of jobs) {
    const key = jobKey(job);
    const t = measured.get(key);
    if (t === undefined && !named.has(key)) {
      // A governed job the timings file has never heard of. Passing it would make the
      // audit's coverage a function of who remembered to measure — so it fails instead.
      unaccounted.push(key);
      continue;
    }
    const nonApt = t?.nonAptP90Seconds ?? PRE_APT_RESERVE_SECONDS;
    const budgetSeconds = budgetFor(budget, job);
    const required = budgetSeconds + budget.killAfterSeconds + nonApt;
    const fits = required <= job.effectiveSeconds;
    const entry = acknowledged.get(key);
    // An entry covers the measurement it acknowledged, never a worse one. Regressing
    // past what was written down is a NEW finding wearing an old finding's key.
    //
    // And the numbers it acknowledges must be the numbers this tree produces: the pinned
    // timeout must be the job's real timeout, and the pinned total must be the sum this
    // audit computes from the pinned term. Without that an entry could be written with an
    // invented `observedNonAptSeconds` large enough to cover anything forever — an
    // acknowledgement that acknowledges nothing in particular is a suppression.
    const consistent =
      entry !== undefined &&
      entry.observedTimeoutSeconds === job.effectiveSeconds &&
      entry.observedRequiredSeconds === budgetSeconds + budget.killAfterSeconds + entry.observedNonAptSeconds;
    const covered = !fits && entry !== undefined && consistent && nonApt <= entry.observedNonAptSeconds;
    if (entry !== undefined && !consistent) {
      inconsistentBaselineKeys.push(
        `${key} (entry pins timeout=${String(entry.observedTimeoutSeconds)}s required=${String(entry.observedRequiredSeconds)}s ` +
          `from non-apt=${String(entry.observedNonAptSeconds)}s; the tree says timeout=${String(job.effectiveSeconds)}s and ` +
          `${String(budgetSeconds)}+${String(budget.killAfterSeconds)}+${String(entry.observedNonAptSeconds)}=` +
          `${String(budgetSeconds + budget.killAfterSeconds + entry.observedNonAptSeconds)}s)`,
      );
    }
    verdicts.push({
      key,
      job,
      budgetSeconds,
      nonAptSeconds: nonApt,
      boundSource: t === undefined ? "named-unmeasured" : "measured",
      requiredSeconds: required,
      ok: fits,
      acknowledged: covered,
    });
  }

  const governedKeys = new Set(jobs.map(jobKey));
  const failing = new Map(verdicts.filter((v) => !v.ok).map((v) => [v.key, v]));
  const staleBaselineKeys = baseline.findings
    .filter((f) => !failing.has(f.key))
    .map((f) => (governedKeys.has(f.key) ? f.key : `${f.key} (no such governed job)`));

  const unadjudicated = verdicts.filter((v) => !v.ok && !v.acknowledged);
  // `inconsistentBaselineKeys` is deliberately NOT a conjunct here, and that is a
  // finding rather than an omission: an inconsistent entry cannot cover its job, so the
  // job lands in `unadjudicated`; and if the job now fits, the entry is STALE. Either
  // way `ok` is already false. Adding the term would be logic no mutation could
  // distinguish — a condition that cannot change an outcome is the vacuity class in
  // miniature. The list survives because it explains WHICH entry is wrong and how,
  // which the other two messages cannot say.
  const ok = unadjudicated.length === 0 && unaccounted.length === 0 && staleBaselineKeys.length === 0;

  const line = (v: JobVerdict): string =>
    `${v.key}: ${String(v.budgetSeconds)}s budget + ${String(budget.killAfterSeconds)}s kill + ` +
    `${String(v.nonAptSeconds)}s non-apt (${v.boundSource}) = ${String(v.requiredSeconds)}s vs ` +
    `${String(v.job.effectiveSeconds)}s timeout` +
    (v.ok ? ` (margin ${String(v.job.effectiveSeconds - v.requiredSeconds)}s)` : " — EXCEEDS");

  const parts: string[] = [];
  if (unadjudicated.length > 0) {
    parts.push(
      `${String(unadjudicated.length)} job(s) cannot hold their apt budget:\n  ` +
        unadjudicated.map(line).join("\n  ") +
        "\n  On a stalled mirror each is killed mid-apt and reports `cancelled` instead of the " +
        "installer's own error. Lower that job's budget (ZETA_APT_BUDGET_SECONDS), cut its " +
        "non-apt work, or raise its timeout-minutes — or acknowledge it in " +
        BASELINE_PATH,
    );
  }
  if (unaccounted.length > 0) {
    parts.push(
      `${String(unaccounted.length)} governed job(s) have no entry in ${TIMINGS_PATH}: ` +
        unaccounted.join(", ") +
        ". Run `bun src/Core.TypeScript/hygiene/refresh-apt-job-timings.ts`, or name each in " +
        "the file's `unmeasured` list with the reason it cannot be measured.",
    );
  }
  if (inconsistentBaselineKeys.length > 0) {
    parts.push(
      `${String(inconsistentBaselineKeys.length)} baseline entr(ies) pin arithmetic this tree does not ` +
        `produce: ${inconsistentBaselineKeys.join("; ")}. Re-derive the entry against the current ` +
        `measurement — a pin nobody can check is not a pin.`,
    );
  }
  if (staleBaselineKeys.length > 0) {
    parts.push(
      `${String(staleBaselineKeys.length)} baseline entr(ies) acknowledge a finding that no longer ` +
        `exists: ${staleBaselineKeys.join(", ")}. Delete them — an entry that covers nothing is a ` +
        `claim about CI that stopped being true.`,
    );
  }
  const fitting = verdicts.filter((v) => v.ok);
  const tightestFitting = [...fitting].sort(
    (a, b) => a.job.effectiveSeconds - a.requiredSeconds - (b.job.effectiveSeconds - b.requiredSeconds),
  )[0];
  const acked = verdicts.filter((v) => v.acknowledged);
  const clean =
    `${String(fitting.length)} of ${String(verdicts.length)} governed job(s) fit` +
    (acked.length === 0
      ? ""
      : `; ${String(acked.length)} acknowledged in ${BASELINE_PATH} and still failing:\n  ` +
        acked.map(line).join("\n  ")) +
    `\n  tightest FITTING margin: ${tightestFitting ? line(tightestFitting) : "n/a"}`;
  return {
    ok,
    budget,
    verdicts,
    jobs,
    unaccounted,
    staleBaselineKeys,
    inconsistentBaselineKeys,
    detail: parts.length > 0 ? parts.join("\n") : clean,
  };
}

export function loadTimings(root: string): Timings {
  const raw = JSON.parse(readFileSync(join(root, TIMINGS_PATH), "utf8")) as Partial<Timings>;
  return {
    measuredAt: raw.measuredAt ?? "unknown",
    jobs: raw.jobs ?? [],
    unmeasured: raw.unmeasured ?? [],
  };
}

export function loadBaseline(root: string): Baseline {
  const raw = JSON.parse(readFileSync(join(root, BASELINE_PATH), "utf8")) as Partial<Baseline>;
  return { findings: raw.findings ?? [] };
}

export function collectInstallerJobs(root: string): InstallerJob[] {
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
  return jobs;
}

export function auditRepo(root: string, options: { skipAdjudication?: boolean } = {}): Reconciliation {
  const budget = parseAptBudget(readFileSync(join(root, "tools/setup/linux.sh"), "utf8"));
  const jobs = collectInstallerJobs(root);
  if (options.skipAdjudication === true) {
    // The refresher needs the governed job LIST before the timings file can exist.
    return reconcile(budget, jobs, { measuredAt: "n/a", jobs: [], unmeasured: jobs.map((j) => ({ key: jobKey(j), reason: "listing only" })) });
  }
  return reconcile(budget, jobs, loadTimings(root), loadBaseline(root));
}

export function main(argv: string[]): number {
  const root = resolve(process.env["REPO_ROOT"] ?? process.cwd());
  const r = auditRepo(root);
  if (argv.includes("--human")) {
    const sorted = [...r.verdicts].sort(
      (a, b) => a.job.effectiveSeconds - a.requiredSeconds - (b.job.effectiveSeconds - b.requiredSeconds),
    );
    process.stdout.write(
      `apt budget defaults: ${String(r.budget.ciDefaultSeconds)}s CI / ` +
        `${String(r.budget.localDefaultSeconds)}s local, ` +
        `${String(r.budget.killAfterSeconds)}s kill grace\n` +
        `governed jobs: ${String(r.jobs.length)}\n` +
        sorted
          .map(
            (v) =>
              `  ${String(v.job.effectiveSeconds - v.requiredSeconds).padStart(6)}s margin  ` +
              `[${v.job.budgetKind}${v.job.budgetOverrideSeconds === null ? "" : " override"}] ` +
              `${v.key}  (budget ${String(v.budgetSeconds)}s, non-apt ${String(v.nonAptSeconds)}s ` +
              `${v.boundSource}${v.acknowledged ? ", ACKNOWLEDGED" : ""})`,
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
