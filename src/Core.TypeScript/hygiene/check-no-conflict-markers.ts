#!/usr/bin/env bun
// check-no-conflict-markers.ts — fails the build if any committed
// file contains git merge-conflict markers (<<<<<<<, =======, >>>>>>>).
//
// TypeScript+Bun port of check-no-conflict-markers.sh, slice 6 of
// the TS+Bun migration. See docs/best-practices/repo-scripting.md.
//
// What this checks:
//   - All tracked files (via `git ls-files`) for the three conflict
//     marker patterns at line-start.
//   - Reports each violation with file:line.
//   - Exits non-zero if any found.
//
// Usage:
//   bun tools/hygiene/check-no-conflict-markers.ts
//
// Exit codes:
//   0   clean
//   1   conflict markers found

import { readFileSync } from "node:fs";
import {
  spawnSync,
  type SpawnSyncReturns,
} from "node:child_process";

type ExitCode = 0 | 1;

interface Violation {
  readonly file: string;
  readonly line: number;
  readonly content: string;
}

const SPAWN_MAX_BUFFER = 64 * 1024 * 1024;
const SELF_PATH = "tools/hygiene/check-no-conflict-markers.sh";

const ALLOWLIST: readonly string[] = [
  SELF_PATH,
  "tools/hygiene/check-no-conflict-markers.ts",
  "memory/feedback_otto_341_lint_suppression_is_self_deception_noise_signal_or_underlying_fix_greenfield_large_refactors_welcome_training_data_human_shortcut_bias_2026_04_26.md",
  // Rerere cache dividend memory file — landed PR #694 (2026-04-30).
  // The "Worked-example trace" section quotes the MEMORY.md sibling-
  // DIRTY conflict shape inside a fenced code block as the rule's
  // documented example. Fenced examples of merge markers are
  // documentation, not leakage. Parity with .sh ALLOWLIST.
  "memory/feedback_rerere_conflict_resolution_cache_dividend_amara_2026_04_28.md",
];

const MARKER_RE = /^(<<<<<<<[\t ]|=======$|>>>>>>>[\t ])/;

function classifyFailure(
  cmd: string,
  args: readonly string[],
  result: SpawnSyncReturns<string>,
): string | null {
  if (result.error) {
    return `Failed to start '${cmd} ${args.join(" ")}': ${result.error.message}`;
  }
  if (result.status === null) {
    return `'${cmd} ${args.join(" ")}' terminated before reporting an exit code`;
  }
  if (result.status !== 0) {
    return `'${cmd} ${args.join(" ")}' exited ${String(result.status)}`;
  }
  return null;
}

function repoRoot(): string {
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  const result = spawnSync("git", ["rev-parse", "--show-toplevel"], {
    encoding: "utf8",
    maxBuffer: SPAWN_MAX_BUFFER,
  });
  // Bash falls back to pwd if git fails; mirror that.
  if (result.status !== 0) return process.cwd();
  return result.stdout.trim();
}

function listTrackedFiles(): readonly string[] {
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  const result = spawnSync("git", ["ls-files"], {
    encoding: "utf8",
    maxBuffer: SPAWN_MAX_BUFFER,
  });
  const failure = classifyFailure("git", ["ls-files"], result);
  if (failure !== null) throw new Error(failure);
  return result.stdout.split("\n").filter((s) => s.length > 0);
}

function isAllowed(path: string): boolean {
  return ALLOWLIST.includes(path);
}

function checkFile(path: string): readonly Violation[] {
  let content: string;
  try {
    content = readFileSync(path, "utf8");
  } catch {
    return [];
  }
  const out: Violation[] = [];
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (MARKER_RE.test(line)) {
      out.push({ file: path, line: i + 1, content: line });
    }
  }
  return out;
}

export function audit(): readonly Violation[] {
  const all = listTrackedFiles();
  const out: Violation[] = [];
  for (const file of all) {
    if (isAllowed(file)) continue;
    out.push(...checkFile(file));
  }
  return out;
}

export function main(): ExitCode {
  process.chdir(repoRoot());
  const violations = audit();
  if (violations.length > 0) {
    let firstHit = "";
    for (const v of violations) {
      const hit = `${v.file}:${String(v.line)}:${v.content}`;
      if (firstHit === "") firstHit = hit;
      process.stderr.write(`VIOLATION: ${hit}\n`);
    }
    process.stderr.write("\n");
    process.stderr.write(
      `FAIL: ${String(violations.length)} git merge-conflict marker line(s) found in committed files\n`,
    );
    process.stderr.write("\n");
    process.stderr.write(`First hit: ${firstHit}\n`);
    process.stderr.write("\n");
    process.stderr.write("How to fix:\n");
    process.stderr.write("  - Open each flagged file\n");
    process.stderr.write(
      "  - Resolve the conflict (pick one side, both sides, or\n",
    );
    process.stderr.write("    re-merge manually); REMOVE all marker lines\n");
    process.stderr.write(
      "  - Verify by re-running this script (exit 0 = clean)\n",
    );
    process.stderr.write("\n");
    process.stderr.write(
      "If a file legitimately discusses these markers (docs about\n",
    );
    process.stderr.write(
      "merge resolution, this script itself, or substrate files\n",
    );
    process.stderr.write(
      "documenting merge-conflict-resolution work), add the path\n",
    );
    process.stderr.write("to the ALLOWLIST in this script.\n");
    return 1;
  }
  process.stdout.write("OK: no git merge-conflict markers found in committed files\n");
  return 0;
}

if (import.meta.main) {
  process.exit(main());
}
