#!/usr/bin/env bun
// apt-archive-cache.ts — a Linux job that runs `install.sh` must restore the apt archives,
// and the tier it caches under must be the tier it installs with.
//
// What this is guarding
// ---------------------
// `.github/actions/apt-archive-cache` restores apt's `.deb` directory and exports
// `ZETA_APT_ARCHIVES_DIR`, which `tools/setup/linux.sh` passes to apt as
// `Dir::Cache::archives`. That removes the 561 MB fetch which — against a mirror
// measured at ~1.1 MB/s on 2026-08-25 — could not fit inside the installer's 420s apt
// budget and killed 17 jobs under six different job names in one five-hour window.
//
// Two ways that mechanism goes quietly inert, and both are what this audit refuses:
//
//   ABSENT   A new (or existing) Linux job runs `install.sh` with no cache step. It
//            works, it is just slow, and it re-enters the failure class alone. Nothing
//            in the tree would say so — the job is green until the mirror is slow, and
//            then it is red for a reason that reads as its own. Same shape as the tier
//            gate before `audit-install-tier-declared.ts`: a mechanism only the jobs
//            that already opted in ever exercise.
//
//   MISKEYED The cache step declares `tier: slim` and the install step declares
//            `ZETA_HOST_TIER: full`. The tier decides the package set (149 packages /
//            139.7 MiB vs 388 / 713.0 MiB), and the tier is IN THE CACHE KEY. A
//            disagreement stores a slim payload under a full name, so the next
//            full-tier job restores a cache that is missing two thirds of what it
//            needs — and gets a cache HIT while doing it. Never incorrect (apt
//            re-fetches what is absent), and invisible: the step is green, the key
//            matched, and the saving silently is not there.
//
// What it does NOT check, said out loud
// -------------------------------------
// Whether a particular tier is the RIGHT tier — that is the workflow author's call and
// `audit-install-tier-declared.ts` already refuses silence about it. And whether the
// cache step carries the same `if:` as the install step: a mismatch there costs a few
// seconds of restore on a leg that will not install, which is waste, not a defect.
//
// Rule 0: TypeScript (no .sh) per `.claude/rules/rule-0-no-sh-files.md`.
//
// Usage:
//   bun src/Core.TypeScript/ci/apt-archive-cache.ts
//   bun src/Core.TypeScript/ci/apt-archive-cache.ts --json
//
// Exit codes:
//   0   every in-scope job restores the archives, with a tier that matches its install
//   1   at least one job is ABSENT or MISKEYED
//   2   configuration error (workflow dir or the composite action is missing)

import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const WORKFLOW_DIR = ".github/workflows";
export const ACTION_PATH = ".github/actions/apt-archive-cache";
export const ACTION_USES = "./.github/actions/apt-archive-cache";
export const DRIFT_CLASS = "AH004";

/** `run:` invocation of the installer. Comments are stripped before this is applied. */
const INSTALL_SH = /(?<![\w-])\.?\/?tools\/setup\/install\.sh(?![\w-])/;
/** Runners with no apt at all. `${{ ... }}` never matches, so a matrix stays IN scope. */
const NON_LINUX_RUNNER = /^(windows|macos)-/;

export type Verdict = "ok" | "absent" | "miskeyed" | "after-install";

export interface JobFinding {
  readonly file: string;
  readonly job: string;
  readonly line: number;
  readonly verdict: Verdict;
  readonly declaredTier: string | null;
  readonly cachedTier: string | null;
}

export interface AuditResult {
  readonly workflowsScanned: number;
  readonly jobsInScope: number;
  readonly findings: readonly JobFinding[];
}

function stripComment(line: string): string {
  const hash = line.indexOf("#");
  return hash < 0 ? line : line.slice(0, hash);
}

interface JobBlock {
  readonly job: string;
  readonly line: number;
  readonly body: readonly string[];
}

/**
 * Split a workflow into job blocks by indentation — the same line scan
 * `audit-install-tier-declared.ts` uses, and for the same reason: these audits carry no
 * YAML dependency, and `runs-on` / `env:` / `uses:` are flat keys a scan reads exactly.
 */
export function parseJobs(source: string): readonly JobBlock[] {
  const lines = source.split("\n");
  let inJobs = false;
  const starts: { name: string; line: number }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i] ?? "";
    if (/^jobs:\s*$/.test(raw)) {
      inJobs = true;
      continue;
    }
    if (!inJobs) continue;
    if (/^\S/.test(raw)) {
      inJobs = false;
      continue;
    }
    const m = /^ {2}([A-Za-z0-9_-]+):\s*$/.exec(raw);
    if (m) starts.push({ name: m[1] ?? "", line: i + 1 });
  }
  return starts.map((s, idx) => {
    const from = s.line - 1;
    const to = idx + 1 < starts.length ? (starts[idx + 1]?.line ?? lines.length) - 1 : lines.length;
    return { job: s.name, line: s.line, body: lines.slice(from, to).map(stripComment) };
  });
}

function runsOnOf(body: readonly string[]): string {
  const l = body.find((x) => /^\s{4}runs-on:/.test(x));
  return l === undefined ? "" : l.split(":").slice(1).join(":").trim();
}

/** A job is in scope when it runs the installer somewhere apt exists. */
export function inScope(body: readonly string[]): boolean {
  if (!body.some((l) => INSTALL_SH.test(l))) return false;
  return !NON_LINUX_RUNNER.test(runsOnOf(body));
}

export function judgeJob(file: string, block: JobBlock): JobFinding {
  const { body } = block;
  const installAt = body.findIndex((l) => INSTALL_SH.test(l));
  const usesAt = body.findIndex((l) => l.includes(ACTION_USES));

  const declared = body
    .slice(0, installAt < 0 ? body.length : installAt + 1)
    .reverse()
    .map((l) => /ZETA_HOST_TIER:\s*([a-z]+)/.exec(l))
    .find((m) => m !== null);
  const declaredTier = declared?.[1] ?? null;

  const base = { file, job: block.job, line: block.line, declaredTier } as const;

  if (usesAt < 0) return { ...base, verdict: "absent", cachedTier: null };

  // The `tier:` belonging to THIS step: the first one after the `uses:` line, before the
  // next step begins. Reading the job's first `tier:` anywhere would let a later step's
  // value vouch for an earlier step's key.
  let cachedTier: string | null = null;
  for (let k = usesAt; k < body.length; k++) {
    if (k > usesAt && /^\s+- /.test(body[k] ?? "")) break;
    const m = /^\s+tier:\s*([a-z]+)\s*$/.exec(body[k] ?? "");
    if (m) {
      cachedTier = m[1] ?? null;
      break;
    }
  }

  if (usesAt > installAt) return { ...base, verdict: "after-install", cachedTier };
  if (declaredTier !== null && cachedTier !== declaredTier) {
    return { ...base, verdict: "miskeyed", cachedTier };
  }
  return { ...base, verdict: "ok", cachedTier };
}

export function auditWorkflow(file: string, source: string): readonly JobFinding[] {
  return parseJobs(source)
    .filter((b) => inScope(b.body))
    .map((b) => judgeJob(file, b));
}

export function runAudit(root: string = resolve(process.env["REPO_ROOT"] ?? process.cwd())): AuditResult {
  const dir = resolve(root, WORKFLOW_DIR);
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"))
    .sort();
  const all: JobFinding[] = [];
  for (const f of files) {
    all.push(...auditWorkflow(`${WORKFLOW_DIR}/${f}`, readFileSync(resolve(dir, f), "utf8")));
  }
  return {
    workflowsScanned: files.length,
    jobsInScope: all.length,
    findings: all.filter((f) => f.verdict !== "ok"),
  };
}

export function renderHuman(r: AuditResult): string {
  const head = `${r.workflowsScanned} workflow(s), ${r.jobsInScope} Linux job(s) running install.sh`;
  if (r.findings.length === 0) {
    return `apt-archive-cache: OK — ${head}; every one restores the apt archives at its own tier.`;
  }
  return [
    `apt-archive-cache: ${r.findings.length} job(s) do not restore the apt archives correctly. (${head})`,
    "",
    "A Linux job that runs install.sh fetches its whole apt payload from the Ubuntu mirror.",
    "Measured 2026-08-25: 561 MB at ~1.1 MB/s is ~510s of download inside a 420s budget, and",
    "17 jobs died at exit 124 in the install step under six different job names. Add, before",
    "the install step:",
    "",
    "    - name: Restore apt archives (root fix for the exit-124 install-step class)",
    `      uses: ${ACTION_USES}`,
    "      with:",
    "        tier: <the SAME tier the install step declares>",
    "",
    ...r.findings.map(
      (f) =>
        `  ${f.file}:${f.line}  job \`${f.job}\`  ${f.verdict}` +
        (f.verdict === "miskeyed"
          ? ` — install declares \`${f.declaredTier}\`, cache keys on \`${f.cachedTier}\``
          : f.verdict === "after-install"
            ? " — the restore step runs AFTER the install it is meant to serve"
            : ""),
    ),
  ].join("\n");
}

export function main(argv: readonly string[]): number {
  const root = resolve(process.env["REPO_ROOT"] ?? process.cwd());
  for (const required of [WORKFLOW_DIR, ACTION_PATH]) {
    try {
      if (!statSync(resolve(root, required)).isDirectory()) throw new Error("not a dir");
    } catch {
      process.stderr.write(`error: ${required} not found under ROOT=${root}\n`);
      return 2;
    }
  }
  const r = runAudit(root);
  process.stdout.write((argv.includes("--json") ? JSON.stringify(r, null, 2) : renderHuman(r)) + "\n");
  return r.findings.length > 0 ? 1 : 0;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
