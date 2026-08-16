#!/usr/bin/env bun
// audit-stale-worktrees.ts — detect git-worktree admin entries whose working-
// directory has been deleted, recovering from the "branch already used by
// worktree at <missing-path>" lockout pattern.
//
// Mechanizes 081KRHWGX0008QG0R002DPG02X Phase 2 (worktree-prune cadence). Empirically, parallel-
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
//   - Per-Otto-process worktree isolation (substantial design per 081KRHWGX0008QG0R001HMWM1W RCA)
//   - GHA cron wire-up (a separate yml; would compose with
//     factory-hygiene-audit-cadence.yml)
//
// Usage:
//
//   bun src/Core.TypeScript/hygiene/audit-stale-worktrees.ts                # detect-only
//   bun src/Core.TypeScript/hygiene/audit-stale-worktrees.ts --prune        # also run `git worktree prune --expire=now`
//   bun src/Core.TypeScript/hygiene/audit-stale-worktrees.ts --report PATH  # write markdown report
//   bun src/Core.TypeScript/hygiene/audit-stale-worktrees.ts --root PATH    # audit PATH instead of cwd
//
// Exit codes:
//
//   0   detect-only mode, or prune ran successfully
//   64  argument error
//   128 git worktree list failed (not inside a worktree, --root points at a
//       non-repo or missing directory, git not on PATH, or other launch error)
//
// DST-friendliness:
//
//   The "Generated" timestamp is the only non-deterministic surface. Per
//   `typescript.md` universal-DST gate.

import { existsSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

type AuditExitCode = 0 | 64 | 128;

interface Args {
  readonly root: string | null;
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

function hasFlagValue(value: string | undefined): value is string {
  // Reject any dash-prefixed token (known flag or typo'd unknown flag) so a
  // bad invocation like `--report --verbose` is reported as a missing path
  // rather than silently treating `--verbose` as a filename.
  return value !== undefined && value.length > 0 && !value.startsWith("-");
}

function parseArgs(argv: string[]): { kind: "args"; args: Args } | { kind: "error"; message: string } {
  let root: string | null = null;
  let report: string | null = null;
  let prune = false;
  let i = 0;
  while (i < argv.length) {
    const a = argv[i]!;
    if (a === "--root") {
      const next = argv[i + 1];
      if (!hasFlagValue(next)) return { kind: "error", message: "--root requires a path" };
      root = next;
      i += 2;
    } else if (a === "--report") {
      const next = argv[i + 1];
      if (!hasFlagValue(next)) return { kind: "error", message: "--report requires a path" };
      report = next;
      i += 2;
    } else if (a === "--prune") {
      prune = true;
      i += 1;
    } else {
      return { kind: "error", message: `Unknown argument: ${a}` };
    }
  }
  return { kind: "args", args: { root, report, prune } };
}

function gitArgs(root: string | null, args: string[]): string[] {
  return root === null ? args : ["-C", root, ...args];
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

function audit(root: string | null): AuditResult | { error: string; code: AuditExitCode } {
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  const list = spawnSync("git", gitArgs(root, ["worktree", "list", "--porcelain"]), { encoding: "utf8" });
  if (list.error) {
    return { error: `git worktree list failed to launch: ${list.error.message}`, code: 128 };
  }
  if (list.status !== 0) {
    const stderr = (list.stderr || "").trim() || `(no stderr; exit ${list.status ?? "null"})`;
    return { error: `git worktree list failed: ${stderr}`, code: 128 };
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

function runPrune(root: string | null): { ok: boolean; output: string } {
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  const r = spawnSync("git", gitArgs(root, ["worktree", "prune", "--expire=now", "-v"]), { encoding: "utf8" });
  if (r.error) {
    return { ok: false, output: `git worktree prune failed to launch: ${r.error.message}` };
  }
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

  const r = audit(parsed.args.root);
  if ("error" in r) {
    console.error(r.error);
    return r.code;
  }

  let pruneOutput: string | null = null;
  if (parsed.args.prune && r.stalePathMissing.length > 0) {
    const p = runPrune(parsed.args.root);
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

export { audit, parseArgs, parseWorktreePorcelain, renderReport };
