#!/usr/bin/env bun
// audit-stale-worktrees.ts — detect git-worktree admin entries whose working-
// directory has been deleted, recovering from the "branch already used by
// worktree at <missing-path>" lockout pattern.
//
// Mechanizes B-0506 Phase 2 (worktree-prune cadence). Empirically, parallel-
// Otto sessions on the same maintainer machine accumulate stale worktree
// admin entries (`.git/worktrees/<name>/`) that point to `/private/tmp/zeta-*`
// directories which have been cleaned up by OS retention. The next agent's
// `git checkout <branch>` fails with "branch already used by worktree."
//
// What this does:
//
//   - Enumerate `git worktree list --porcelain` entries
//   - For each entry, test whether the working-directory path exists on disk
//   - Report stale entries (markdown summary)
//   - With `--prune`, run `git worktree prune --expire=now -v` to remove them
//
// Out of scope (next slice if needed):
//
//   - Per-Otto-process worktree isolation (substantial design per B-0519 RCA)
//   - GHA cron wire-up (a separate yml; would compose with
//     factory-hygiene-audit-cadence.yml)
//
// Usage:
//
//   bun tools/hygiene/audit-stale-worktrees.ts                # detect-only
//   bun tools/hygiene/audit-stale-worktrees.ts --prune        # also run `git worktree prune --expire=now`
//   bun tools/hygiene/audit-stale-worktrees.ts --report PATH  # write markdown report
//
// Exit codes:
//
//   0   detect-only mode, or prune ran successfully
//   64  argument error
//   128 not inside a git worktree
//
// DST-friendliness:
//
//   The "Generated" timestamp is the only non-deterministic surface. Per
//   `typescript.md` universal-DST gate.

import { existsSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

type AuditExitCode = 0 | 64 | 128;

interface Args {
  readonly report: string | null;
  readonly prune: boolean;
}

interface WorktreeEntry {
  readonly path: string;
  readonly head: string | null;
  readonly branch: string | null;
  readonly prunable: boolean;
}

interface AuditResult {
  readonly totalWorktrees: number;
  readonly stalePathExists: WorktreeEntry[]; // path exists but git flagged prunable
  readonly stalePathMissing: WorktreeEntry[]; // path missing on disk
  readonly healthy: number;
}

function parseArgs(argv: string[]): { kind: "args"; args: Args } | { kind: "error"; message: string } {
  let report: string | null = null;
  let prune = false;
  let i = 0;
  while (i < argv.length) {
    const a = argv[i]!;
    if (a === "--report") {
      const next = argv[i + 1];
      if (!next) return { kind: "error", message: "--report requires a path" };
      report = next;
      i += 2;
    } else if (a === "--prune") {
      prune = true;
      i += 1;
    } else {
      return { kind: "error", message: `Unknown argument: ${a}` };
    }
  }
  return { kind: "args", args: { report, prune } };
}

function parseWorktreePorcelain(stdout: string): WorktreeEntry[] {
  const entries: WorktreeEntry[] = [];
  const blocks = stdout.split("\n\n");
  for (const block of blocks) {
    if (!block.trim()) continue;
    const lines = block.split("\n");
    let path = "";
    let head: string | null = null;
    let branch: string | null = null;
    let prunable = false;
    for (const line of lines) {
      if (line.startsWith("worktree ")) path = line.slice(9);
      else if (line.startsWith("HEAD ")) head = line.slice(5);
      else if (line.startsWith("branch ")) branch = line.slice(7);
      else if (line === "prunable" || line.startsWith("prunable ")) prunable = true;
    }
    if (path) entries.push({ path, head, branch, prunable });
  }
  return entries;
}

function audit(): AuditResult | { error: string; code: AuditExitCode } {
  const list = spawnSync("git", ["worktree", "list", "--porcelain"], { encoding: "utf8" });
  if (list.status !== 0) {
    return { error: `git worktree list failed: ${list.stderr}`, code: 128 };
  }

  const entries = parseWorktreePorcelain(list.stdout);
  const stalePathExists: WorktreeEntry[] = [];
  const stalePathMissing: WorktreeEntry[] = [];
  let healthy = 0;

  for (const entry of entries) {
    if (entry.prunable && !existsSync(entry.path)) {
      stalePathMissing.push(entry);
    } else if (entry.prunable) {
      stalePathExists.push(entry);
    } else {
      healthy++;
    }
  }

  return {
    totalWorktrees: entries.length,
    stalePathExists,
    stalePathMissing,
    healthy,
  };
}

function runPrune(): { ok: boolean; output: string } {
  const r = spawnSync("git", ["worktree", "prune", "--expire=now", "-v"], { encoding: "utf8" });
  return { ok: r.status === 0 || r.status === 1, output: (r.stdout || "") + (r.stderr || "") };
}

function renderReport(result: AuditResult, now: Date, pruned: string | null): string {
  const lines: string[] = [];
  lines.push("# git-worktree staleness audit");
  lines.push("");
  lines.push(`Generated: ${now.toISOString()}`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- Total worktrees: ${result.totalWorktrees}`);
  lines.push(`- Healthy: ${result.healthy}`);
  lines.push(`- Stale, path missing on disk: ${result.stalePathMissing.length}`);
  lines.push(`- Stale, path still exists (manual triage): ${result.stalePathExists.length}`);
  lines.push("");
  if (result.stalePathMissing.length > 0) {
    lines.push("## Stale worktrees (path missing — safe to prune)");
    lines.push("");
    lines.push("| Path | Branch |");
    lines.push("|------|--------|");
    for (const e of result.stalePathMissing) {
      lines.push(`| \`${e.path}\` | ${e.branch ? `\`${e.branch}\`` : "_(detached)_"} |`);
    }
    lines.push("");
  }
  if (result.stalePathExists.length > 0) {
    lines.push("## Stale worktrees (path still exists — investigate before prune)");
    lines.push("");
    lines.push("| Path | Branch |");
    lines.push("|------|--------|");
    for (const e of result.stalePathExists) {
      lines.push(`| \`${e.path}\` | ${e.branch ? `\`${e.branch}\`` : "_(detached)_"} |`);
    }
    lines.push("");
  }
  if (pruned !== null) {
    lines.push("## Prune output");
    lines.push("");
    lines.push("```");
    lines.push(pruned.trim() || "(no entries pruned)");
    lines.push("```");
    lines.push("");
  }
  return lines.join("\n");
}

function main(argv: string[]): AuditExitCode {
  const parsed = parseArgs(argv);
  if (parsed.kind === "error") {
    console.error(`error: ${parsed.message}`);
    return 64;
  }

  const r = audit();
  if ("error" in r) {
    console.error(r.error);
    return r.code;
  }

  let pruneOutput: string | null = null;
  if (parsed.args.prune && r.stalePathMissing.length > 0) {
    const p = runPrune();
    pruneOutput = p.output;
    if (!p.ok) console.error("git worktree prune exited non-zero (continuing — some entries may have pruned)");
  }

  const report = renderReport(r, new Date(), pruneOutput);

  if (parsed.args.report) {
    writeFileSync(parsed.args.report, report);
    console.log(`wrote ${parsed.args.report}`);
  } else {
    console.log(report);
  }

  return 0;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}

export { audit, parseWorktreePorcelain, renderReport };
