#!/usr/bin/env bun
// audit-install-tier-declared.ts — a CI job that runs `install.sh` must DECLARE its host tier.
//
// The rule this enforces
// ----------------------
// `tools/setup/install.sh` resolves `ZETA_HOST_TIER` in one of two ways:
//
//   declared  the caller exported it, and the payload is the one the caller chose
//   detected  nobody said, so `tools/setup/common/host-tier.sh` guesses from RAM
//             (>=16 GB full; >=8 GB standard; else slim)
//
// On a laptop, detection is adaptation and it is the right default. On a GitHub-hosted
// `ubuntu-*` runner it is not adaptation at all: every one of them has 16 GB, so
// detection is a CONSTANT, and that constant is `full` — the entire 388-package /
// 713 MiB apt manifest, on every job, forever. "Detected" there is not a measurement.
// It is an undeclared default wearing a measurement's name.
//
// So: on a literal `ubuntu-*` runner, a job that runs `install.sh` must say which tier it
// wants. The audit never says WHICH tier is right — that is the workflow author's call and
// it is recorded in the YAML where a reviewer can see it. It refuses only SILENCE.
//
// The vacuity this closes
// -----------------------
// The tier gate already exists and already works: `081M0K36K69087G0R003BYSCF8` taught the
// apt leg to honour `tier=`, and twelve `gate.yml` lint jobs declare `slim` and install
// 149 packages / 139.7 MiB instead of 388 / 713.0 MiB. A mechanism that only the jobs which
// already opted in ever exercise is the vacuity class: it reads as cost control and
// constrains nothing about the next job someone writes. The gate was built; nothing made
// anyone walk through it.
//
// Live instance (measured 2026-08-25). `ci-cache-paths-lint.yml` runs ONE bun script and
// did not declare a tier, so it fetched the full manifest. Its last 20 completed runs:
// 5 failures, and ALL FIVE failed in the step named "Install toolchain via three-way-parity
// script" — none of them in the audit step. Job 97860804880 is the specimen:
//
//     Get:131 .../noble/universe amd64 pandoc amd64 3.1.3+ds-2 [26.9 MB]
//     Get:149 .../noble/universe amd64 r-base-core amd64 4.3.3-2build2 [27.1 MB]
//       budget (attempt 3/3) — stalled archive mirror,
//     ✗ apt-get install did not succeed within the 420s apt budget
//     ##[error]Process completed with exit code 124.
//
// `pandoc` and `r-base` are both `tier=standard`. Neither is used by that job, or by any
// job this audit flags. So the exposure is not merely "slower": a stall lands on the
// BIGGEST packages, which means the number of packages a job fetches is proportional to
// its chance of being killed. Trimming the payload is the RELIABILITY fix, and the check
// named "audit actions/cache paths vs git ls-files" spent 25% of its recent life reporting
// red for work it never reached.
//
// Scope, stated rather than left to be discovered
// -----------------------------------------------
// Only jobs whose `runs-on:` is a LITERAL `ubuntu-*` are in scope.
//
//   * A matrix `runs-on: ${{ matrix.os }}` (gate.yml `build-and-test`) spans macOS and
//     Windows legs whose detected tier is genuinely NOT constant — macos-15 is a 7 GB host
//     and detects `standard`, so a step-level declaration would silently change what those
//     legs install. That is a real decision and it needs its own measurement, not a
//     side-effect of this audit.
//   * `macos-*` / `windows-*` install-shield workflows exist to exercise `install.sh`
//     itself, detection included. Declaring a tier there would replace the subject under
//     test with a constant.
//
// Rule 0: TypeScript (no .sh) per `.claude/rules/rule-0-no-sh-files.md`.
//
// Usage:
//   bun src/Core.TypeScript/hygiene/audit-install-tier-declared.ts
//   bun src/Core.TypeScript/hygiene/audit-install-tier-declared.ts --json
//
// Exit codes:
//   0   every in-scope job declares ZETA_HOST_TIER
//   1   at least one in-scope job leaves the tier to RAM detection
//   2   configuration error (workflow dir missing)

import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const WORKFLOW_DIR = ".github/workflows";
export const DRIFT_CLASS = "AH003";

/** `run:` invocation of the installer. Comments are stripped before this is applied. */
const INSTALL_SH = /(?<![\w-])\.?\/?tools\/setup\/install\.sh(?![\w-])/;
/** The declaration, anywhere in the job block (job-level `env:` or step-level `env:`). */
const TIER_DECL = /(?<![\w-])ZETA_HOST_TIER\s*:/;
/** A literal hosted-Linux runner label. `${{ ... }}` never matches, by design. */
const LITERAL_UBUNTU = /^ubuntu-[\w.-]+$/;

export interface JobBlock {
  readonly job: string;
  readonly line: number;
  readonly runsOn: string | null;
  readonly runsInstallSh: boolean;
  readonly declaresTier: boolean;
}

export interface Finding {
  readonly file: string;
  readonly job: string;
  readonly line: number;
  readonly runsOn: string;
}

export interface AuditResult {
  readonly workflowsScanned: number;
  readonly jobsInScope: number;
  readonly findings: readonly Finding[];
}

/** Drop a trailing `#` comment. Cheap and sufficient: no workflow key we read is quoted. */
function stripComment(line: string): string {
  const hash = line.indexOf("#");
  if (hash < 0) return line;
  // A `#` inside a quoted string would be mangled; none of the three regexes above can
  // match on the tail of such a line, so truncating is safe for this audit's purposes.
  return line.slice(0, hash);
}

/**
 * Split a workflow into job blocks by indentation.
 *
 * Workflows here are uniformly 2-space indented under a top-level `jobs:`, so a
 * `^  <name>:` line opens a job and the next one closes it. This is deliberately a line
 * scan and not a YAML parse: the audits in this directory carry no third-party dependency,
 * and a job's `runs-on` / `env:` are flat keys that a scan reads exactly.
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
    if (/^\S/.test(raw) && !/^jobs:/.test(raw)) inJobs = false;
    const m = /^ {2}([A-Za-z0-9_-]+):\s*$/.exec(raw);
    if (inJobs && m) starts.push({ name: m[1] ?? "", line: i + 1 });
  }
  const blocks: JobBlock[] = [];
  for (let s = 0; s < starts.length; s++) {
    const from = (starts[s]?.line ?? 1) - 1;
    const to = s + 1 < starts.length ? (starts[s + 1]?.line ?? lines.length) - 1 : lines.length;
    const body = lines.slice(from, to).map(stripComment);
    const runsOnLine = body.find((l) => /^\s{4}runs-on:/.test(l));
    const runsOn = runsOnLine === undefined ? null : (runsOnLine.split(":").slice(1).join(":").trim() || null);
    blocks.push({
      job: starts[s]?.name ?? "",
      line: starts[s]?.line ?? 0,
      runsOn,
      runsInstallSh: body.some((l) => INSTALL_SH.test(l)),
      declaresTier: body.some((l) => TIER_DECL.test(l)),
    });
  }
  return blocks;
}

/** Is this job subject to the rule? See "Scope" in the header. */
export function inScope(job: JobBlock): boolean {
  if (!job.runsInstallSh) return false;
  if (job.runsOn === null) return false;
  return LITERAL_UBUNTU.test(job.runsOn);
}

export function auditWorkflow(file: string, source: string): { readonly inScope: number; readonly findings: readonly Finding[] } {
  const jobs = parseJobs(source).filter(inScope);
  const findings = jobs
    .filter((j) => !j.declaresTier)
    .map((j) => ({ file, job: j.job, line: j.line, runsOn: j.runsOn ?? "" }));
  return { inScope: jobs.length, findings };
}

export function runAudit(root: string = resolve(process.env["REPO_ROOT"] ?? process.cwd())): AuditResult {
  const dir = resolve(root, WORKFLOW_DIR);
  const files = readdirSync(dir).filter((f) => f.endsWith(".yml") || f.endsWith(".yaml")).sort();
  const findings: Finding[] = [];
  let jobsInScope = 0;
  for (const f of files) {
    const r = auditWorkflow(`${WORKFLOW_DIR}/${f}`, readFileSync(resolve(dir, f), "utf8"));
    jobsInScope += r.inScope;
    findings.push(...r.findings);
  }
  return { workflowsScanned: files.length, jobsInScope, findings };
}

export function renderHuman(r: AuditResult): string {
  const head = `${r.workflowsScanned} workflow(s), ${r.jobsInScope} in-scope job(s)`;
  if (r.findings.length === 0) {
    return `install-tier-declared: OK — ${head}; every ubuntu job that runs install.sh declares ZETA_HOST_TIER.`;
  }
  return [
    `install-tier-declared: UNDECLARED — ${r.findings.length} job(s) leave the apt payload to RAM detection. (${head})`,
    "",
    "On a hosted ubuntu runner, detection is not adaptation: every one of them has 16 GB, so",
    "the detected tier is the constant `full` — 388 packages / 713.0 MiB of apt on every run.",
    "Declare the tier the job actually needs, in its install step's `env:`:",
    "",
    "    env:",
    "      ZETA_HOST_TIER: slim      # or standard / full — say which, and say why",
    "",
    "`slim` (149 packages / 139.7 MiB) is right for a job whose payload is bun/git/gh only.",
    "Declaring `full` is a fine answer; leaving it unsaid is not.",
    "",
    ...r.findings.map((f) => `  ${f.file}:${f.line}  job \`${f.job}\` (runs-on: ${f.runsOn})`),
  ].join("\n");
}

export function main(argv: readonly string[]): number {
  const root = resolve(process.env["REPO_ROOT"] ?? process.cwd());
  try {
    if (!statSync(resolve(root, WORKFLOW_DIR)).isDirectory()) throw new Error("not a dir");
  } catch {
    process.stderr.write(`error: ${WORKFLOW_DIR} not found under ROOT=${root}\n`);
    return 2;
  }
  const r = runAudit(root);
  process.stdout.write((argv.includes("--json") ? JSON.stringify(r, null, 2) : renderHuman(r)) + "\n");
  return r.findings.length > 0 ? 1 : 0;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
