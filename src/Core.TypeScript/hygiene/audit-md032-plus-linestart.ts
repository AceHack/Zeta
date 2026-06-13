#!/usr/bin/env bun
// audit-md032-plus-linestart.ts — detect MD032 false-trigger pattern.
//
// TypeScript+Bun port of audit-md032-plus-linestart.sh, per the
// 2026-04-29 directive to canonicalize on TS+Bun for tooling.
// See docs/trajectories/typescript-bun-migration/RESUME.md for the
// trajectory; see B-0086 for the migration discipline.
//
// Type discipline (typed boundaries, not noise):
//   Findings flow as `readonly AuditFinding[]` of structured
//   `{ file, line }` objects, not stringly-formatted "file:line"
//   text. Strings are produced only at the output boundary. Exit
//   code is a literal-type union `AuditExitCode = 0 | 2`. CLI mode
//   is a literal-type union `Mode`. The git-spawn boundary uses
//   `type SpawnSyncReturns<string>` and a structured failure
//   classifier that distinguishes launch / termination / non-zero
//   exit. Idioms follow upstream Bun + TS 6 + typescript-eslint v8
//   strictTypeChecked guidance and `../SQLSharp/tools/automation/
//   format/process-runner.ts`.
//
// What this does:
//   Detects markdown files where a line starts with `+ ` inside a
//   paragraph (no blank line above, previous line is not itself a
//   `+ `-list continuation) — the markdownlint MD032 false-trigger.
//
// Detection shape (CommonMark-aware):
//   * Scans each line matching `^ {0,3}\+ ` (CommonMark allows up
//     to 3 leading spaces on list-marker lines).
//   * Flags a gap only when the previous line is non-blank (after
//     stripping all whitespace) AND the previous line is itself NOT
//     a `^ {0,3}\+ ` line.
//
// Usage:
//   bun tools/hygiene/audit-md032-plus-linestart.ts              # summary
//   bun tools/hygiene/audit-md032-plus-linestart.ts --list       # list offending lines
//   bun tools/hygiene/audit-md032-plus-linestart.ts --enforce    # exit 2 on any gap
//
// Exit codes:
//   0 — clean (or --enforce not set and gaps found)
//   2 — gaps found and --enforce was set

import {
  spawnSync,
  type SpawnSyncReturns,
} from "node:child_process";
import { readFileSync } from "node:fs";

type Mode = "summary" | "list" | "enforce";

type AuditExitCode = 0 | 2;

interface AuditFinding {
  readonly file: string;
  readonly line: number;
}

interface AuditResult {
  readonly findings: readonly AuditFinding[];
}

const PLUS_MARKER_RE = /^ {0,3}\+ /;
const EXCLUDE_RE =
  /^(docs\/ROUND-HISTORY\.md|docs\/hygiene-history\/|docs\/DECISIONS\/|tools\/hygiene\/audit-md032-plus-linestart\.(sh|ts))/;

function parseMode(argv: readonly string[]): Mode {
  const arg = argv[0];
  if (arg === "--list") return "list";
  if (arg === "--enforce") return "enforce";
  return "summary";
}

function classifyGitFailure(
  args: readonly string[],
  result: SpawnSyncReturns<string>,
): string | null {
  if (result.error) {
    return `Failed to start 'git ${args.join(" ")}': ${result.error.message}`;
  }
  if (result.status === null) {
    if (result.signal !== null) {
      return `'git ${args.join(" ")}' terminated by signal ${result.signal}`;
    }
    return `'git ${args.join(" ")}' terminated before reporting an exit code`;
  }
  if (result.status !== 0) {
    const stderr = result.stderr.trim();
    return stderr !== ""
      ? stderr
      : `'git ${args.join(" ")}' exited ${String(result.status)}`;
  }
  return null;
}

// Set maxBuffer high enough that `git ls-files -z "*.md"` does not
// hit ENOBUFS as the repo grows. Default Node maxBuffer is 1 MiB,
// which can be exceeded by markdown-heavy trees. The bash original
// streamed output and had no fixed-buffer failure mode; we restore
// equivalent headroom rather than re-introducing a regression.
const SPAWN_MAX_BUFFER = 64 * 1024 * 1024; // 64 MiB

function runGit(args: readonly string[]): string {
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- git is repo-pinned via .mise.toml; args are an explicit string array (no shell interpolation).
  const result = spawnSync("git", args, {
    encoding: "utf8",
    maxBuffer: SPAWN_MAX_BUFFER,
  });
  const failure = classifyGitFailure(args, result);
  if (failure !== null) throw new Error(failure);
  return result.stdout;
}

function repoRoot(): string {
  return runGit(["rev-parse", "--show-toplevel"]).trim();
}

function listMarkdownFiles(): readonly string[] {
  return runGit(["ls-files", "-z", "*.md"])
    .split("\0")
    .filter((s): s is string => s.length > 0);
}

function isBlankAfterStrip(line: string): boolean {
  return line.replace(/\s/g, "").length === 0;
}

function auditFile(file: string): readonly AuditFinding[] {
  const content = readFileSync(file, "utf8");
  const lines = content.split("\n");
  // Match bash behavior: trailing newline produces an empty last
  // element which we drop; a file without trailing newline keeps
  // its final partial line.
  if (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }

  const findings: AuditFinding[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (!PLUS_MARKER_RE.test(line)) continue;
    if (i === 0) continue;
    const prev = lines[i - 1] ?? "";
    if (isBlankAfterStrip(prev)) continue;
    if (PLUS_MARKER_RE.test(prev)) continue;
    findings.push({ file, line: i + 1 });
  }
  return findings;
}

export function auditRepo(): AuditResult {
  process.chdir(repoRoot());
  const files = listMarkdownFiles().filter((f) => !EXCLUDE_RE.test(f));
  const findings: AuditFinding[] = [];
  for (const file of files) {
    findings.push(...auditFile(file));
  }
  return { findings };
}

function formatFinding(finding: AuditFinding): string {
  return `${finding.file}:${String(finding.line)}`;
}

export function main(argv: readonly string[]): AuditExitCode {
  const mode = parseMode(argv);
  const { findings } = auditRepo();
  const count = findings.length;

  if (mode === "list") {
    if (count > 0) console.log(findings.map(formatFinding).join("\n"));
    return 0;
  }

  if (mode === "enforce") {
    if (count > 0) {
      console.log(`MD032 '+'-at-line-start gaps: ${String(count)}`);
      for (const finding of findings) console.log(`  ${formatFinding(finding)}`);
      console.log("");
      console.log(
        "Fix: replace '+' at line start with 'and' or similar prose",
      );
      console.log(
        "continuation, OR add a blank line before the '+' to make it",
      );
      console.log("an intentional list (which markdownlint accepts).");
      return 2;
    }
    console.log("MD032 '+'-at-line-start gaps: 0 (clean)");
    return 0;
  }

  if (count > 0) {
    console.log(`MD032 '+'-at-line-start gaps: ${String(count)}`);
    console.log("run with --list to see offending file:line locations");
  } else {
    console.log("MD032 '+'-at-line-start gaps: 0 (clean)");
  }
  return 0;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
