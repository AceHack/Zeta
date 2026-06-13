#!/usr/bin/env bun
// runner-version-freshness.ts — fail CI when a GitHub Actions
// workflow pins a runner to a label not on the current allow-list.
//
// TypeScript+Bun port of runner-version-freshness.sh, slice 8 of
// the TS+Bun migration. See docs/best-practices/repo-scripting.md.
//
// Allow-list sourced from the authoritative GitHub docs page:
//   https://docs.github.com/en/actions/how-tos/write-workflows/choose-where-workflows-run/choose-the-runner-for-a-job#standard-github-hosted-runners-for-public-repositories
// "Standard GitHub-hosted runners for public repositories" table.
//
// LAST_VERIFIED below has an explicit timestamp. If older than 30
// days, the script prints a warning to stderr but exits 0
// (warning-only — does NOT fail CI). When GitHub announces a new
// stable runner, update ALLOWED_LABELS + bump LAST_VERIFIED.
//
// Usage:
//   bun tools/lint/runner-version-freshness.ts             # all workflows
//   bun tools/lint/runner-version-freshness.ts <file>...   # specific
//
// Exit codes:
//   0  current (or freshness warning only — non-fatal)
//   1  environment / usage error
//   2  stale / rolling / not-on-allow-list label found

import { readFileSync, readdirSync, statSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

type ExitCode = 0 | 1 | 2;

const SPAWN_MAX_BUFFER = 64 * 1024 * 1024;

const LAST_VERIFIED = "2026-04-24";
const VERIFY_URL =
  "https://docs.github.com/en/actions/how-tos/write-workflows/choose-where-workflows-run/choose-the-runner-for-a-job#standard-github-hosted-runners-for-public-repositories";

const ALLOWED_LABELS: readonly string[] = [
  "ubuntu-slim",
  "ubuntu-24.04",
  "ubuntu-24.04-arm",
  "windows-2025",
  "windows-2025-vs2026",
  "windows-11-arm",
  "macos-26",
  "macos-26-intel",
];

const ROLLING_ALIASES: readonly string[] = [
  "ubuntu-latest",
  "windows-latest",
  "macos-latest",
];

const STALE_LABELS: readonly string[] = [
  "ubuntu-22.04",
  "ubuntu-22.04-arm",
  "ubuntu-20.04",
  "macos-14",
  "macos-15",
  "macos-15-intel",
  "macos-13",
  "macos-13-xlarge",
  "windows-2022",
  "windows-2019",
];

const REGEX_META_RE = /[\\.*^$+?()[\]{}|/]/g;

function repoRoot(): string {
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  const result = spawnSync("git", ["rev-parse", "--show-toplevel"], {
    encoding: "utf8",
    maxBuffer: SPAWN_MAX_BUFFER,
  });
  if (result.status !== 0) {
    process.stderr.write("ERROR: not inside a git working tree\n");
    return "";
  }
  return result.stdout.trim();
}

function escapeForRegex(s: string): string {
  return s.replace(REGEX_META_RE, "\\$&");
}

function alternation(labels: readonly string[]): string {
  return labels.map(escapeForRegex).join("|");
}

function ageDays(lastVerified: string): number | null {
  const parsed = Date.parse(`${lastVerified}T00:00:00Z`);
  if (Number.isNaN(parsed)) return null;
  return Math.floor((Date.now() - parsed) / 86_400_000);
}

function emitFreshnessWarning(): boolean {
  const days = ageDays(LAST_VERIFIED);
  if (days === null) {
    process.stderr.write(
      `WARN: could not parse LAST_VERIFIED=${LAST_VERIFIED} on this platform\n`,
    );
    return false;
  }
  if (days <= 30) return false;
  process.stderr.write(
    `WARN: runner-version allow-list last verified ${String(days)} days ago (${LAST_VERIFIED}).\n`,
  );
  process.stderr.write(`      Re-verify against: ${VERIFY_URL}\n`);
  process.stderr.write("      Then bump LAST_VERIFIED in this script.\n");
  return true;
}

function listWorkflowFiles(root: string): readonly string[] {
  const wfDir = join(root, ".github", "workflows");
  let entries: readonly import("node:fs").Dirent[];
  try {
    entries = readdirSync(wfDir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const e of entries) {
    if (!e.isFile()) continue;
    if (!e.name.endsWith(".yml") && !e.name.endsWith(".yaml")) continue;
    out.push(join(wfDir, e.name));
  }
  return out.sort((a, b) => a.localeCompare(b));
}

const COMMENT_LINE_RE = /^[\t ]*#/;

function stripTrailingComment(line: string): string {
  // Find first '#' preceded by whitespace; strip from the
  // whitespace onward. Manual scan avoids sonarjs/slow-regex.
  for (let i = 0; i < line.length; i++) {
    if (line[i] !== "#") continue;
    if (i === 0) continue;
    const prev = line[i - 1];
    if (prev !== " " && prev !== "\t") continue;
    let start = i - 1;
    while (start > 0) {
      const c = line[start - 1];
      if (c !== " " && c !== "\t") break;
      start--;
    }
    return line.slice(0, start);
  }
  return line;
}

function stripComments(content: string): string {
  const lines = content.split("\n");
  const out: string[] = [];
  for (const line of lines) {
    if (COMMENT_LINE_RE.test(line)) continue;
    out.push(stripTrailingComment(line));
  }
  return out.join("\n");
}

interface ScanResult {
  readonly stale: readonly string[];
  readonly rolling: readonly string[];
  readonly unknown: readonly string[];
}

const NONWORD_START = "([^A-Za-z0-9_]|^)";
const NONWORD_END = "([^A-Za-z0-9_]|$)";
const MATRIX_PREFIX = "^[\\t ]*-[\\t ]+(['\"]?)";
const MATRIX_PREFIX_LN = "(^|^[0-9]+:)[\\t ]*-[\\t ]+(['\"]?)";

function findMatchingLines(
  uncommented: string,
  prefilter: RegExp,
  boundary: RegExp,
): readonly string[] {
  const lines = uncommented.split("\n");
  const hits: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (!prefilter.test(line)) continue;
    if (!boundary.test(line)) continue;
    hits.push(`${String(i + 1)}:${line}`);
  }
  return hits;
}

function scanStaleOrRolling(
  uncommented: string,
  pattern: string,
): readonly string[] {
  const prefilter = new RegExp(
    `runs-on:|(^|[^A-Za-z0-9_])os:|${MATRIX_PREFIX}(${pattern})`,
  );
  const boundary = new RegExp(`${NONWORD_START}(${pattern})${NONWORD_END}`);
  return findMatchingLines(uncommented, prefilter, boundary);
}

function scanUnknownScalar(
  uncommented: string,
  rollingOrAllowed: string,
): readonly string[] {
  const lines = uncommented.split("\n");
  const out: string[] = [];
  const matchRe = /runs-on:[\t ]*[A-Za-z0-9_-][A-Za-z0-9._-]*/;
  const exprRe = /runs-on:[\t ]*\$\{\{/;
  const allowedRe = new RegExp(
    `runs-on:[\\t ]*(${rollingOrAllowed})($|[\\t ]|#)`,
  );
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (!matchRe.test(line)) continue;
    if (exprRe.test(line)) continue;
    if (allowedRe.test(line)) continue;
    out.push(`${String(i + 1)}:${line}`);
  }
  return out;
}

function scanUnknownMatrix(
  uncommented: string,
  rollingOrAllowed: string,
  stalePattern: string,
): readonly string[] {
  const lines = uncommented.split("\n");
  const out: string[] = [];
  const labelRe = new RegExp(
    `${MATRIX_PREFIX}[A-Za-z][A-Za-z0-9._-]*[0-9][A-Za-z0-9._-]*`,
  );
  const allowedRe = new RegExp(
    `${MATRIX_PREFIX_LN}(${rollingOrAllowed})(['"]?)([\\t ]|$|#)`,
  );
  const staleRe = new RegExp(`${MATRIX_PREFIX_LN}(${stalePattern})`);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (!labelRe.test(line)) continue;
    const numbered = `${String(i + 1)}:${line}`;
    if (allowedRe.test(numbered)) continue;
    if (staleRe.test(numbered)) continue;
    out.push(numbered);
  }
  return out;
}

function scanFile(content: string): ScanResult {
  const uncommented = stripComments(content);
  const stalePattern = alternation(STALE_LABELS);
  const rollingPattern = alternation(ROLLING_ALIASES);
  const allowedPattern = alternation(ALLOWED_LABELS);
  const rollingOrAllowed = `${allowedPattern}|${rollingPattern}`;

  const stale = scanStaleOrRolling(uncommented, stalePattern);
  const rolling = scanStaleOrRolling(uncommented, rollingPattern);
  const scalarUnknown = scanUnknownScalar(uncommented, rollingOrAllowed);
  const matrixUnknown = scanUnknownMatrix(
    uncommented,
    rollingOrAllowed,
    stalePattern,
  );
  const unknown = [...scalarUnknown, ...matrixUnknown];

  return { stale, rolling, unknown };
}

function emitFileFindings(file: string, r: ScanResult): boolean {
  let any = false;
  if (r.stale.length > 0) {
    process.stdout.write(`STALE RUNNER LABEL(S) in ${file}:\n`);
    for (const h of r.stale) process.stdout.write(`  ${h}\n`);
    any = true;
  }
  if (r.rolling.length > 0) {
    process.stdout.write(
      `ROLLING-ALIAS RUNNER LABEL(S) in ${file} (use a pinned version per repo convention):\n`,
    );
    for (const h of r.rolling) process.stdout.write(`  ${h}\n`);
    any = true;
  }
  if (r.unknown.length > 0) {
    process.stdout.write(
      `NOT-ON-ALLOW-LIST RUNNER LABEL(S) in ${file} (label is neither stale nor allowed; allow-list may need refresh):\n`,
    );
    for (const h of r.unknown) process.stdout.write(`  ${h}\n`);
    any = true;
  }
  return any;
}

function emitFailureFooter(): void {
  process.stdout.write("\n");
  process.stdout.write(
    "One or more workflow files pin stale / rolling /\n",
  );
  process.stdout.write(
    "not-on-allow-list runner labels. Update to current\n",
  );
  process.stdout.write(
    "standard-runner labels. Canonical list:\n",
  );
  for (const l of ALLOWED_LABELS) process.stdout.write(`  - ${l}\n`);
  process.stdout.write("\n");
  process.stdout.write(`Source: ${VERIFY_URL}\n`);
}

function emitEnvErrorFooter(): void {
  process.stderr.write("\n");
  process.stderr.write(
    "Environment / usage error encountered (see ERROR\n",
  );
  process.stderr.write(
    "lines above). This is distinct from stale-label\n",
  );
  process.stderr.write(
    "findings; exit 1 reserves an out-of-band code so\n",
  );
  process.stderr.write(
    "callers can distinguish 'something broke' from\n",
  );
  process.stderr.write("'stale labels found'.\n");
}

function resolveArgs(argv: readonly string[], cwd: string): readonly string[] {
  return argv.map((a) => (isAbsolute(a) ? a : resolve(cwd, a)));
}

function isReadable(file: string): boolean {
  try {
    statSync(file);
    return true;
  } catch {
    return false;
  }
}

export function main(argv: readonly string[]): ExitCode {
  const cwd = process.cwd();
  const root = repoRoot();
  if (root === "") return 1;

  const absArgs = resolveArgs(argv, cwd);
  process.chdir(root);

  const files = absArgs.length === 0 ? listWorkflowFiles(root) : absArgs;
  if (files.length === 0) {
    process.stdout.write("no workflow files found; nothing to lint\n");
    return 0;
  }

  let fail = false;
  let envError = false;

  for (const file of files) {
    if (!isReadable(file)) {
      process.stderr.write(
        `ERROR: cannot read ${file} (does not exist or unreadable)\n`,
      );
      envError = true;
      continue;
    }
    let content: string;
    try {
      content = readFileSync(file, "utf8");
    } catch {
      process.stderr.write(
        `ERROR: cannot read ${file} (does not exist or unreadable)\n`,
      );
      envError = true;
      continue;
    }
    const result = scanFile(content);
    if (emitFileFindings(file, result)) fail = true;
  }

  const warn = emitFreshnessWarning();

  if (envError) {
    emitEnvErrorFooter();
    return 1;
  }
  if (fail) {
    emitFailureFooter();
    return 2;
  }
  if (warn) return 0;
  process.stdout.write(
    `ok: all workflow runner labels are current (verified ${LAST_VERIFIED})\n`,
  );
  return 0;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
