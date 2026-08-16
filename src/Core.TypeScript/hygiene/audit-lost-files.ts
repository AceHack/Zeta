#!/usr/bin/env bun
// audit-lost-files.ts — survey artifacts that may be drifting out of reach.
//
// TypeScript+Bun port of audit-lost-files.sh, per Aaron's just-landed Rule 0
// in CLAUDE.md ("no more .sh files except install-graph; TS IS cross-platform
// DST"). Same first-run output shape (markdown sections per location-class).
//
// Implements the survey commands from src/Core.TypeScript/hygiene/LOST-FILES-LOCATIONS.md
// (Otto-329 Phase 8 substrate, 2026-04-25). The list-of-15-location-classes
// has been canonical since 2026-04-25; the executable form was named as
// owed-work in the doc's "Owed work" section but never landed in TS until now.
//
// Composes with: src/Core.TypeScript/hygiene/LOST-FILES-LOCATIONS.md (the catalog),
// memory/feedback_otto_329_*.md (Otto-329 ownership), Otto-262 trunk-based,
// Otto-257 clean-default smell, Otto-238 retractability glass-halo.
//
// Pattern reference: tools/github/poll-pr-gate.ts — `Bun.spawn` for shell-out,
// async main, structured-output, top-of-file shebang.
//
// Usage:
//   bun src/Core.TypeScript/hygiene/audit-lost-files.ts
//
// Output: markdown to stdout, one section per location class.
// Exit codes:
//   0 — survey ran (findings reported in body; non-zero counts are not errors)
//   1 — fatal invocation / spawn error

import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
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
  // instead of shelling out to `which`, which is not portable. Aligns
  // with audit-trajectories.ts and audit-backlog-items.ts (per
  // Copilot review on PR #1702).
  return Bun.which(name) !== null;
}

function nowIso(): string {
  // YYYY-MM-DDTHH:MMZ to match the .sh output format.
  const d = new Date();
  const iso = d.toISOString();
  return `${iso.slice(0, 16)}Z`;
}

interface PrJson {
  readonly number: number;
  readonly title: string;
  readonly closedAt?: string | null;
  readonly mergedAt?: string | null;
  readonly headRefName?: string;
}

async function classClosedNotMergedPRs(ghAvailable: boolean): Promise<void> {
  console.log("## 1. Closed-not-merged PRs");
  if (!ghAvailable) {
    console.log("SKIP: gh CLI not available");
    console.log("");
    return;
  }
  const r = await runCmd([
    "gh",
    "pr",
    "list",
    "--repo",
    REPO,
    "--state",
    "closed",
    "--limit",
    "500",
    "--json",
    "number,title,closedAt,mergedAt,headRefName",
  ]);
  // Per PR #1702 review 2026-05-06: never silently swallow a non-zero
  // exit. A failed gh call would otherwise produce "Count: 0", which
  // looks identical to genuine cleanliness and hides auth/network
  // breakage. Surface the failure as a SKIP with the gh stderr.
  if (r.exitCode !== 0) {
    console.log(
      `SKIP: gh pr list (closed) exited ${r.exitCode}; closed-not-merged class unreliable. stderr: ${r.stderr.trim()}`,
    );
    console.log("");
    return;
  }
  let prs: PrJson[] = [];
  try {
    prs = JSON.parse(r.stdout || "[]") as PrJson[];
  } catch {
    prs = [];
  }
  const closedNotMerged = prs.filter((p) => p.mergedAt == null);
  console.log(`Count: ${closedNotMerged.length}`);
  if (closedNotMerged.length > 0) {
    console.log(
      "Triage: per Otto-262 + Otto-257 + Otto-254 -- recover via roll-forward on fresh short-lived branch OR prune.",
    );
    for (const p of closedNotMerged.slice(0, 10)) {
      console.log(`PR #${p.number}: ${p.title} (closed ${p.closedAt ?? "?"})`);
    }
  }
  console.log("");
}

async function classOrphanBranches(ghAvailable: boolean): Promise<void> {
  console.log(
    "## 2. Orphan branches (remote, unmerged-to-main AND no-open-PR)",
  );
  const refsResult = await runCmd([
    "git",
    "for-each-ref",
    "--no-merged",
    "origin/main",
    "--format=%(refname:short)",
    "refs/remotes/origin/",
  ]);
  // Per PR #1702 review 2026-05-06: surface git failures
  // explicitly so the orphan-branch class isn't silently reported as
  // empty when origin/main is missing or the local repo is bare.
  if (refsResult.exitCode !== 0) {
    console.log(
      `SKIP: git for-each-ref exited ${refsResult.exitCode}; orphan-branch ref scan unreliable. stderr: ${refsResult.stderr.trim()}`,
    );
    console.log("");
    return;
  }
  const unmerged = new Set(
    refsResult.stdout
      .split("\n")
      .map((s) => s.replace(/^origin\//, "").trim())
      .filter((s) => s.length > 0),
  );
  if (!ghAvailable) {
    console.log("SKIP: gh CLI not available");
    console.log("");
    return;
  }
  // Per PR #1702 review 2026-05-06: orphan-branch detection wants the
  // OPEN-PR set ("which branches still have a live PR keeping them
  // attached"), not all-states. Closed/merged PRs do not block a
  // branch from being orphaned -- in fact, a closed-not-merged PR is
  // exactly the orphan signal we want to surface.
  const prResult = await runCmd([
    "gh",
    "pr",
    "list",
    "--repo",
    REPO,
    "--state",
    "open",
    "--limit",
    "500",
    "--json",
    "headRefName",
  ]);
  if (prResult.exitCode !== 0) {
    console.log(
      `SKIP: gh pr list exited ${prResult.exitCode}; orphan-branch detection unreliable. stderr: ${prResult.stderr.trim()}`,
    );
    console.log("");
    return;
  }
  let prBranches = new Set<string>();
  try {
    const arr = JSON.parse(prResult.stdout || "[]") as Array<{
      headRefName?: string;
    }>;
    prBranches = new Set(
      arr.map((x) => x.headRefName ?? "").filter((s) => s.length > 0),
    );
  } catch {
    prBranches = new Set();
  }
  const orphans = [...unmerged].filter((b) => !prBranches.has(b)).sort();
  console.log(`Count: ${orphans.length}`);
  if (orphans.length > 0) {
    console.log("Sample (first 10):");
    for (const b of orphans.slice(0, 10)) {
      console.log(b);
    }
  }
  console.log("");
}

async function classDeletedFilesRecent(): Promise<void> {
  console.log("## 3. Deleted files in git history (last 30 days)");
  const r = await runCmd([
    "git",
    "log",
    "--all",
    "--diff-filter=D",
    "--since=30 days ago",
    "--name-only",
    "--pretty=format:",
  ]);
  const deleted = [
    ...new Set(
      r.stdout
        .split("\n")
        .map((s) => s.trim())
        .filter((s) => s.length > 0),
    ),
  ].sort();
  console.log(`Count: ${deleted.length}`);
  if (deleted.length > 0) {
    console.log("Sample (first 10):");
    for (const f of deleted.slice(0, 10)) console.log(f);
  }
  console.log("");
}

async function classReflog(): Promise<void> {
  console.log("## 4. Reflog entries (local-only; risk of loss on git gc)");
  const r = await runCmd(["git", "reflog", "--all"]);
  const lines = r.stdout.split("\n").filter((l) => l.length > 0);
  console.log(`Count: ${lines.length}`);
  if (lines.length > 0) {
    console.log("Latest entries (first 5):");
    for (const l of lines.slice(0, 5)) console.log(l);
  }
  console.log("");
}

async function classStash(): Promise<void> {
  console.log("## 5. Stash entries");
  const r = await runCmd(["git", "stash", "list"]);
  const lines = r.stdout.split("\n").filter((l) => l.length > 0);
  console.log(`Count: ${lines.length}`);
  if (lines.length > 0) {
    console.log("All stashes:");
    for (const l of lines) console.log(l);
  }
  console.log("");
}

async function classUntracked(): Promise<void> {
  console.log(
    "## 6. Untracked working-directory artifacts (db/drop/, .playwright-mcp/, *.tmp, *.log)",
  );
  const r = await runCmd(["git", "status", "--porcelain", "--ignored"]);
  const lines = r.stdout
    .split("\n")
    .filter((l) => /^(\?\?|!!)/.test(l))
    .slice(0, 20);
  console.log(`Count (sample 20): ${lines.length}`);
  if (lines.length > 0) {
    console.log("Sample:");
    for (const l of lines.slice(0, 10)) console.log(l);
  }
  console.log("");
}

async function classWorktrees(): Promise<void> {
  console.log("## 7. Subagent worktree remnants");
  const r = await runCmd(["git", "worktree", "list"]);
  const lines = r.stdout.split("\n").filter((l) => l.length > 0);
  console.log(`Count: ${lines.length}`);
  if (lines.length !== 1) {
    console.log("Worktrees:");
    for (const l of lines) console.log(l);
  }
  console.log("");
}

async function classDraftPRs(ghAvailable: boolean): Promise<void> {
  console.log("## 8. GitHub draft PRs (unpublished)");
  if (!ghAvailable) {
    console.log("SKIP: gh CLI not available");
    console.log("");
    return;
  }
  const r = await runCmd([
    "gh",
    "pr",
    "list",
    "--repo",
    REPO,
    "--state",
    "open",
    "--search",
    "is:draft",
    "--json",
    "number,title",
  ]);
  // Per PR #1702 review 2026-05-06: never silently swallow
  // a non-zero exit. A failed gh call would otherwise print "Count: 0"
  // -- identical to genuine cleanliness -- masking unreliable data.
  if (r.exitCode !== 0) {
    console.log(
      `SKIP: gh pr list (drafts) exited ${r.exitCode}; draft-PR count unreliable. stderr: ${r.stderr.trim()}`,
    );
    console.log("");
    return;
  }
  let drafts: Array<{ number: number; title: string }> = [];
  try {
    drafts = JSON.parse(r.stdout || "[]") as Array<{
      number: number;
      title: string;
    }>;
  } catch {
    drafts = [];
  }
  console.log(`Count: ${drafts.length}`);
  for (const d of drafts.slice(0, 5)) {
    console.log(`PR #${d.number}: ${d.title}`);
  }
  console.log("");
}

function classDeferred(): void {
  console.log(
    "## 9-14. Closed-PR threads / squash intermediates / force-pushed / courier-ferry / external exports / deleted-PR-descriptions",
  );
  console.log(
    "DEFERRED: per-PR API calls expensive; run on incident or full-sweep cadence.",
  );
  console.log(
    "See: src/Core.TypeScript/hygiene/LOST-FILES-LOCATIONS.md classes 9-14 for survey commands.",
  );
  console.log("");
}

async function classMemoryRefs(bunAvailable: boolean): Promise<void> {
  console.log("## 15. Memory-file deletions (cross-tree drift; broken refs)");
  // Migrated from src/Core.TypeScript/hygiene/ to src/Core.TypeScript/hygiene/ (TS-port);
  // the old path silently SKIP'd this whole class.
  const sub = resolve(
    REPO_ROOT,
    "src/Core.TypeScript/hygiene/audit-memory-references.ts",
  );
  if (!existsSync(sub)) {
    console.log(
      "SKIP: src/Core.TypeScript/hygiene/audit-memory-references.ts not found",
    );
    console.log("");
    return;
  }
  if (!bunAvailable) {
    console.log("SKIP: bun not available");
    console.log("");
    return;
  }
  console.log(
    "Delegating to: bun src/Core.TypeScript/hygiene/audit-memory-references.ts",
  );
  const r = await runCmd(["bun", sub]);
  const merged = `${r.stdout}${r.stderr}`;
  const lines = merged.split("\n");
  // Match `tail -20` of the .sh.
  const tail = lines.slice(-20);
  for (const l of tail) {
    if (l.length > 0) console.log(l);
  }
  if (r.exitCode !== 0 && merged.trim().length === 0) {
    console.log("SCRIPT FAILED");
  }
  console.log("");
}

async function main(): Promise<number> {
  console.log(`# Lost-files audit (${nowIso()})`);
  console.log("");
  console.log(`Repo: ${REPO_ROOT}`);
  console.log("Catalog: src/Core.TypeScript/hygiene/LOST-FILES-LOCATIONS.md (15 location-classes)");
  console.log("");

  const [ghAvailable, bunAvailable] = await Promise.all([
    hasCommand("gh"),
    hasCommand("bun"),
  ]);

  await classClosedNotMergedPRs(ghAvailable);
  await classOrphanBranches(ghAvailable);
  await classDeletedFilesRecent();
  await classReflog();
  await classStash();
  await classUntracked();
  await classWorktrees();
  await classDraftPRs(ghAvailable);
  classDeferred();
  await classMemoryRefs(bunAvailable);

  console.log("## Summary");
  console.log("Audit complete. Catalog: src/Core.TypeScript/hygiene/LOST-FILES-LOCATIONS.md");
  console.log(
    "Triage: per-class (see catalog for protocols + Otto-262/-254/-257/-238 lineage).",
  );
  return 0;
}

if (import.meta.main) {
  main().then(
    (code) => process.exit(code),
    (err) => {
      process.stderr.write(`fatal: ${err instanceof Error ? err.message : String(err)}\n`);
      process.exit(1);
    },
  );
}
