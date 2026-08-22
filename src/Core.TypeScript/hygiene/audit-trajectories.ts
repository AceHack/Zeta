#!/usr/bin/env bun
// audit-trajectories.ts — survey trajectory axes the factory runs on.
//
// TypeScript+Bun port of audit-trajectories.sh, per Aaron's just-landed Rule 0
// in CLAUDE.md ("no more .sh files except install-graph; TS IS cross-platform
// DST"). Same first-run output shape (markdown sections per axis).
//
// Sibling to src/Core.TypeScript/hygiene/audit-lost-files.ts. Where the lost-files audit
// answers "what artifacts might be drifting out of reach?", this audit
// answers "what trajectory axes is the factory currently running on, and
// is each one healthy?"
//
// Aaron 2026-05-05: "not just lost files all the trjaectoris and backlog
// tiems" -- extending the lost-files audit pattern to cover trajectories.
// Composes with the orthogonal-axes discipline
// (memory/feedback_orthogonal_axes_factory_hygiene.md): factory axes form
// an orthogonal basis; this audit enumerates them and reports drift.
//
// Axes covered:
//   1. Scheduled cadence workflows (.github/workflows/*-cadence.yml)
//   2. Event-driven lint / integrity workflows (*-lint.yml, *-integrity.yml)
//   3. Harness hooks (.claude/hooks/*.ts)
//   4. TS / bash hygiene tooling (tools/hygiene/audit-*.{sh,ts})
//   5. Razor-cadence tracking issues (gh label razor-cadence)
//   6. Skill router inventory (.claude/skills/)
//   7. Persona agent inventory (.claude/agents/)
//
// Pattern reference: tools/github/poll-pr-gate.ts. All shell-out via
// Bun.spawn with explicit argv arrays (no shell expansion).
//
// Usage:
//   bun src/Core.TypeScript/hygiene/audit-trajectories.ts
//
// Exit codes:
//   0 — survey ran (findings reported in body)
//   1 — fatal invocation error

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, "..", "..", "..");
const REPO = process.env.REPO ?? "Lucent-Financial-Group/Zeta";

interface SpawnResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
}

async function runCmd(
  cmd: readonly string[],
  cwd: string = REPO_ROOT,
): Promise<SpawnResult> {
  const proc = Bun.spawn({
    cmd: [...cmd],
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const exitCode = await proc.exited;
  return { stdout, stderr, exitCode };
}

async function hasCommand(name: string): Promise<boolean> {
  // Use Bun.which (cross-platform: scans PATH and PATHEXT on Windows)
  // instead of shelling out to `which`, which is not portable. This also
  // avoids Bun.spawn throwing when `which` is itself absent.
  return Bun.which(name) !== null;
}

function nowIso(): string {
  const d = new Date();
  return `${d.toISOString().slice(0, 16)}Z`;
}

function listFiles(dir: string, predicate: (name: string) => boolean): string[] {
  if (!existsSync(dir)) return [];
  let entries: string[] = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const name of entries) {
    const full = join(dir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isFile() && predicate(name)) {
      out.push(full);
    }
  }
  return out.sort();
}

function listDirs(dir: string): string[] {
  if (!existsSync(dir)) return [];
  let entries: string[] = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const name of entries) {
    const full = join(dir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) out.push(full);
  }
  return out.sort();
}

function extractCron(yml: string): string {
  const lines = yml.split("\n");
  for (const line of lines) {
    const m = /^\s*-?\s*cron:\s*(.*?)\s*$/.exec(line);
    if (m) {
      return (m[1] ?? "").trim();
    }
  }
  return "(no cron)";
}

function extractPathsFilter(yml: string): string {
  const lines = yml.split("\n");
  let inPaths = false;
  const collected: string[] = [];
  for (const line of lines) {
    if (/^\s*paths:/.test(line)) {
      inPaths = true;
      continue;
    }
    if (inPaths) {
      if (/^\s*-/.test(line)) {
        collected.push(line.trim());
        if (collected.length >= 5) break;
      } else {
        break;
      }
    }
  }
  if (collected.length === 0) {
    return "(no paths filter / runs on all changes)";
  }
  return collected.join(" ").replace(/\s+/g, " ");
}

interface RunRollupItem {
  readonly conclusion?: string | null;
  readonly createdAt?: string;
  readonly status?: string;
}

async function axisCadenceWorkflows(ghAvailable: boolean): Promise<void> {
  console.log(
    "## 1. Scheduled cadence workflows (.github/workflows/*-cadence.yml)",
  );
  const wfDir = join(REPO_ROOT, ".github", "workflows");
  const files = listFiles(wfDir, (n) => /-cadence\.yml$/.test(n));
  console.log(`Count: ${files.length}`);
  for (const wf of files) {
    const name = basename(wf);
    let cron = "(no cron)";
    try {
      cron = extractCron(readFileSync(wf, "utf8"));
    } catch {
      // ignore
    }
    console.log("");
    console.log(`### ${name}`);
    console.log(`Schedule: ${cron}`);
    if (!ghAvailable) {
      console.log("  SKIP: gh CLI not available");
      continue;
    }
    const r = await runCmd([
      "gh",
      "run",
      "list",
      "--repo",
      REPO,
      "--workflow",
      name,
      "--limit",
      "5",
      "--json",
      "conclusion,createdAt,status",
    ]);
    // Per PR #1702 review 2026-05-06: surface gh failures
    // explicitly so auth/network breakage doesn't masquerade as
    // "no recent runs" cleanliness.
    if (r.exitCode !== 0) {
      console.log(
        `  SKIP: gh run list exited ${r.exitCode}; recent-runs unreliable. stderr: ${r.stderr.trim()}`,
      );
      continue;
    }
    let runs: RunRollupItem[] = [];
    try {
      runs = JSON.parse(r.stdout || "[]") as RunRollupItem[];
    } catch {
      runs = [];
    }
    if (runs.length === 0) {
      console.log("  Recent runs: (none in last 5)");
    } else {
      console.log("  Recent runs (last 5):");
      for (const run of runs) {
        console.log(
          `  ${run.createdAt ?? "?"} status=${run.status ?? "?"} conclusion=${run.conclusion ?? "n/a"}`,
        );
      }
    }
  }
  console.log("");
}

async function axisLintWorkflows(ghAvailable: boolean): Promise<void> {
  console.log(
    "## 2. Event-driven lint / integrity workflows (*-lint.yml, *-integrity.yml)",
  );
  const wfDir = join(REPO_ROOT, ".github", "workflows");
  const files = listFiles(
    wfDir,
    (n) => /-lint\.yml$/.test(n) || /-integrity\.yml$/.test(n),
  );
  console.log(`Count: ${files.length}`);
  for (const wf of files) {
    const name = basename(wf);
    let pathsFilter = "(no paths filter / runs on all changes)";
    try {
      pathsFilter = extractPathsFilter(readFileSync(wf, "utf8"));
    } catch {
      // ignore
    }
    console.log("");
    console.log(`### ${name}`);
    console.log(`Paths: ${pathsFilter}`);
    if (!ghAvailable) {
      console.log("  SKIP: gh CLI not available");
      continue;
    }
    const r = await runCmd([
      "gh",
      "run",
      "list",
      "--repo",
      REPO,
      "--workflow",
      name,
      "--limit",
      "20",
      "--json",
      "conclusion",
    ]);
    // Per PR #1702 review 2026-05-06: surface gh failures
    // so a non-zero exit isn't reported as "0 failures" cleanliness.
    if (r.exitCode !== 0) {
      console.log(
        `  SKIP: gh run list exited ${r.exitCode}; failure-count unreliable. stderr: ${r.stderr.trim()}`,
      );
      continue;
    }
    let runs: Array<{ conclusion?: string | null }> = [];
    try {
      runs = JSON.parse(r.stdout || "[]") as Array<{
        conclusion?: string | null;
      }>;
    } catch {
      runs = [];
    }
    const failures = runs.filter((x) => x.conclusion === "failure").length;
    console.log(`  Recent failures (last 20 runs): ${failures}`);
  }
  console.log("");
}

async function lastCommitFor(relPath: string): Promise<string> {
  const r = await runCmd(["git", "log", "-1", "--format=%cI %h", "--", relPath]);
  const out = r.stdout.trim();
  return out.length > 0 ? out : "(no git history)";
}

async function axisHooks(): Promise<void> {
  console.log("## 3. Harness hooks (.claude/hooks/*.ts)");
  const hookDir = join(REPO_ROOT, ".claude", "hooks");
  const direct = listFiles(hookDir, (n) => /\.ts$/.test(n));
  // include 1-deep subdirs to mimic find -maxdepth 2
  const nested: string[] = [];
  for (const sub of listDirs(hookDir)) {
    nested.push(...listFiles(sub, (n) => /\.ts$/.test(n)));
  }
  const all = [...direct, ...nested].sort();
  console.log(`Count: ${all.length}`);
  for (const hk of all) {
    const rel = hk.replace(`${REPO_ROOT}/`, "");
    const last = await lastCommitFor(rel);
    console.log(`  ${rel} -- last modified: ${last}`);
  }
  console.log("");
}

async function axisHygieneTooling(): Promise<void> {
  console.log(
    "## 4. Hygiene tooling cadence (src/Core.TypeScript/hygiene/audit-*.ts)",
  );
  // The hygiene tools migrated from src/Core.TypeScript/hygiene/ to src/Core.TypeScript/hygiene/
  // (the "no more .sh files, TS IS cross-platform DST" port); the old dir is now
  // empty, so scanning it silently reported Count: 0. Scan the live location.
  const dir = join(REPO_ROOT, "src", "Core.TypeScript", "hygiene");
  const files = listFiles(
    dir,
    (n) => /^audit-.*\.ts$/.test(n) && !n.endsWith(".test.ts"),
  );
  console.log(`Count: ${files.length}`);
  for (const tf of files) {
    const rel = tf.replace(`${REPO_ROOT}/`, "");
    const last = await lastCommitFor(rel);
    console.log(`  ${rel} -- last modified: ${last}`);
  }
  console.log("");
}

interface IssueJson {
  readonly number: number;
  readonly title: string;
  readonly createdAt: string;
}

async function axisRazorCadence(ghAvailable: boolean): Promise<void> {
  console.log(
    "## 5. Razor-cadence tracking issues (gh label razor-cadence, open)",
  );
  if (!ghAvailable) {
    console.log("SKIP: gh CLI not available");
    console.log("");
    return;
  }
  const r = await runCmd([
    "gh",
    "issue",
    "list",
    "--repo",
    REPO,
    "--label",
    "razor-cadence",
    "--state",
    "open",
    // Default page size is 30; explicit --limit prevents truncation
    // when the razor-cadence backlog grows past the default. Per
    // PR #1702 review 2026-05-06.
    "--limit",
    "200",
    "--json",
    "number,title,createdAt",
  ]);
  // Per PR #1702 review 2026-05-06: never silently swallow
  // a non-zero exit. A failed gh call would otherwise print "Count: 0"
  // -- identical to genuine cleanliness -- masking real cadence skips.
  if (r.exitCode !== 0) {
    console.log(
      `SKIP: gh issue list exited ${r.exitCode}; razor-cadence count unreliable. stderr: ${r.stderr.trim()}`,
    );
    console.log("");
    return;
  }
  let issues: IssueJson[] = [];
  try {
    issues = JSON.parse(r.stdout || "[]") as IssueJson[];
  } catch {
    issues = [];
  }
  console.log(`Count: ${issues.length}`);
  if (issues.length > 0) {
    console.log("Open issues (sorted by age):");
    const sorted = [...issues].sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt),
    );
    for (const iss of sorted.slice(0, 20)) {
      console.log(
        `  #${iss.number} created=${iss.createdAt} -- ${iss.title}`,
      );
    }
    console.log("");
    console.log(
      "Triage: age IS the cadence-skip signal (per 081KQR4HQ0008QG0R001GAD29A). Older = more overdue.",
    );
  }
  console.log("");
}

function axisSkills(): void {
  console.log("## 6. Skill router inventory (.claude/skills/)");
  const dir = join(REPO_ROOT, ".claude", "skills");
  if (!existsSync(dir)) {
    console.log("SKIP: .claude/skills/ not present");
    console.log("");
    return;
  }
  const skillDirs = listDirs(dir);
  console.log(`Count: ${skillDirs.length} capability skills`);
  console.log("");
}

function axisAgents(): void {
  console.log("## 7. Persona agent inventory (.claude/agents/)");
  const dir = join(REPO_ROOT, ".claude", "agents");
  if (!existsSync(dir)) {
    console.log("SKIP: .claude/agents/ not present");
    console.log("");
    return;
  }
  const agents = listFiles(dir, (n) => /\.md$/.test(n));
  console.log(`Count: ${agents.length} persona agents`);
  console.log("");
}

async function main(): Promise<number> {
  console.log(`# Trajectory audit (${nowIso()})`);
  console.log("");
  console.log(`Repo: ${REPO_ROOT}`);
  console.log(
    "Sibling: src/Core.TypeScript/hygiene/audit-lost-files.ts (lost-files axis)",
  );
  console.log(
    "Discipline: orthogonal-axes (memory/feedback_orthogonal_axes_factory_hygiene.md)",
  );
  console.log("");

  const ghAvailable = await hasCommand("gh");

  await axisCadenceWorkflows(ghAvailable);
  await axisLintWorkflows(ghAvailable);
  await axisHooks();
  await axisHygieneTooling();
  await axisRazorCadence(ghAvailable);
  axisSkills();
  axisAgents();

  console.log("## Summary");
  console.log(
    "Audit complete. Sibling: src/Core.TypeScript/hygiene/audit-lost-files.ts.",
  );
  console.log(
    "Triage: per-axis. Aging razor-cadence issues = mechanization-firing-but-pass-not-run.",
  );
  console.log("Stale hook / tool last-modified-date = trajectory drift candidate.");
  return 0;
}

if (import.meta.main) {
  main().then(
    (code) => process.exit(code),
    (err) => {
      process.stderr.write(
        `fatal: ${err instanceof Error ? err.message : String(err)}\n`,
      );
      process.exit(1);
    },
  );
}
