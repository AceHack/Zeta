#!/usr/bin/env bun
// no-python-files.ts — Phase 6 of B-0156: fail the build if a .py
// file exists outside the allowlisted paths (references/prior-art
// mirrors, vendored toolchain dirs). Per Aaron 2026-05-01:
// "any .py" should be ported to TS; this lint enforces the policy
// going forward so future contributors can't introduce one by
// accident.
//
// Usage:
//   bun src/Core.TypeScript/lint/no-python-files.ts          # check mode
//   bun src/Core.TypeScript/lint/no-python-files.ts --list   # list mode
//
// Exit codes:
//   0   no flagged .py files (or --list mode)
//   1   one or more flagged .py files
//   2   allowlist missing

import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { spawnSync } from "node:child_process";

type ExitCode = 0 | 1 | 2;
type Mode = "check" | "list";

const SPAWN_MAX_BUFFER = 64 * 1024 * 1024;
const ALLOWLIST_REL = "src/Core.TypeScript/lint/no-python-files.allowlist";
const SPACE = 0x20;
const TAB = 0x09;
const CR = 0x0d;
const HASH = 0x23;

const HARD_EXCLUDE_PREFIXES: readonly string[] = [
  ".git",
  "references/prior-art",
  "tools/lean4/.lake",
  ".claude/plugins",
  "artifacts",
];

const HARD_EXCLUDE_SEGMENTS: readonly string[] = [
  "bin",
  "obj",
  ".vs",
  ".venv",
  "node_modules",
  "__pycache__",
  "TestResults",
  "site-packages",
];

function repoRoot(): string {
  const result = spawnSync("git", ["rev-parse", "--show-toplevel"], {
    encoding: "utf8",
    maxBuffer: SPAWN_MAX_BUFFER,
  });
  if (result.status !== 0) return process.cwd();
  return result.stdout.trim();
}

function gitCheckIgnore(paths: readonly string[]): readonly string[] {
  if (paths.length === 0) return [];
  const result = spawnSync("git", ["check-ignore", "--stdin"], {
    encoding: "utf8",
    maxBuffer: SPAWN_MAX_BUFFER,
    input: `${paths.join("\n")}\n`,
  });
  return result.stdout.split("\n").filter((s) => s.length > 0);
}

function toPosixRel(p: string): string {
  return p.replace(/\\/g, "/");
}

function isHardExcluded(rel: string): boolean {
  for (const prefix of HARD_EXCLUDE_PREFIXES) {
    if (rel === prefix || rel.startsWith(`${prefix}/`)) return true;
  }
  for (const segment of HARD_EXCLUDE_SEGMENTS) {
    if (
      rel === segment ||
      rel.endsWith(`/${segment}`) ||
      rel.includes(`/${segment}/`)
    ) {
      return true;
    }
  }
  return false;
}

function readDirSafe(
  dir: string,
): readonly import("node:fs").Dirent[] | null {
  try {
    return readdirSync(dir, { withFileTypes: true });
  } catch {
    return null;
  }
}

function byteCompare(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function findPythonFiles(root: string): readonly string[] {
  const out: string[] = [];
  const stack: string[] = [root];
  while (stack.length > 0) {
    const dir = stack.pop();
    if (dir === undefined) continue;
    const entries = readDirSafe(dir);
    if (entries === null) continue;
    for (const e of entries) {
      const full = join(dir, e.name);
      const rel = toPosixRel(relative(root, full));
      if (isHardExcluded(rel)) continue;
      if (e.isDirectory()) {
        stack.push(full);
      } else if (e.isFile() && e.name.endsWith(".py")) {
        out.push(rel);
      }
    }
  }
  return out.sort(byteCompare);
}

function trimTrailingSpaceTab(s: string): string {
  let end = s.length;
  while (end > 0) {
    const c = s.charCodeAt(end - 1);
    if (c !== SPACE && c !== TAB && c !== CR) break;
    end--;
  }
  return s.slice(0, end);
}

function isCommentOrBlankLine(line: string): boolean {
  let i = 0;
  while (i < line.length) {
    const c = line.charCodeAt(i);
    if (c !== SPACE && c !== TAB) break;
    i++;
  }
  return i === line.length || line.charCodeAt(i) === HASH;
}

function loadAllowlist(path: string): readonly string[] {
  const content = readFileSync(path, "utf8");
  const out: string[] = [];
  for (const line of content.split("\n")) {
    if (isCommentOrBlankLine(line)) continue;
    out.push(trimTrailingSpaceTab(line));
  }
  return out;
}

function partitionPython(
  found: readonly string[],
  allowed: readonly string[],
): {
  flagged: readonly string[];
  allowlisted: readonly string[];
} {
  const allowedSet = new Set(allowed);
  const flagged: string[] = [];
  const allowlisted: string[] = [];
  for (const f of found) {
    if (allowedSet.has(f)) allowlisted.push(f);
    else flagged.push(f);
  }
  return { flagged, allowlisted };
}

function emitList(
  allowlisted: readonly string[],
  flagged: readonly string[],
): void {
  process.stdout.write("=== Python files (allowlisted) ===\n");
  if (allowlisted.length === 0) {
    process.stdout.write("  (none)\n");
  } else {
    for (const f of allowlisted) process.stdout.write(`  ${f}\n`);
  }
  process.stdout.write("\n");
  process.stdout.write("=== Python files (flagged) ===\n");
  if (flagged.length === 0) {
    process.stdout.write("  (none)\n");
  } else {
    for (const f of flagged) process.stdout.write(`  ${f}\n`);
  }
}

function emitFailure(
  flagged: readonly string[],
  allowlistFile: string,
): void {
  process.stderr.write(
    `no-python-files: FAIL — ${String(flagged.length)} disallowed .py file(s):\n`,
  );
  for (const f of flagged) process.stderr.write(`  ${f}\n`);
  process.stderr.write("\n");
  process.stderr.write("Per B-0156 (Aaron 2026-05-01): TS is preferred over Python in our codebase.\n");
  process.stderr.write("Fix options:\n");
  process.stderr.write("  1. Port the file to TypeScript (preferred).\n");
  process.stderr.write("  2. Delete the file if it is no longer needed.\n");
  process.stderr.write("  3. If the file is legitimately required (e.g. vendored\n");
  process.stderr.write(`     toolchain), add it to ${allowlistFile} with a reason comment.\n`);
}

export function main(argv: readonly string[]): ExitCode {
  const root = repoRoot();
  process.chdir(root);

  const mode: Mode = argv[0] === "--list" ? "list" : "check";

  const allowlistPath = ALLOWLIST_REL;
  let allowed: readonly string[];
  try {
    allowed = loadAllowlist(allowlistPath);
  } catch {
    process.stderr.write(
      `no-python-files: allowlist missing at ${allowlistPath}\n`,
    );
    return 2;
  }

  const candidates = findPythonFiles(root);
  const ignored = new Set(gitCheckIgnore(candidates));
  const filtered = candidates.filter((f) => !ignored.has(f));
  const { flagged, allowlisted } = partitionPython(filtered, allowed);

  if (mode === "list") {
    emitList(allowlisted, flagged);
    return 0;
  }

  if (flagged.length === 0) {
    process.stdout.write(
      `no-python-files: OK (${String(allowlisted.length)} allowlisted, 0 flagged)\n`,
    );
    return 0;
  }

  emitFailure(flagged, allowlistPath);
  return 1;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
