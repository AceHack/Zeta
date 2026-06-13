#!/usr/bin/env bun
// backfill_dv2_frontmatter.ts — mechanical DV-2.0 frontmatter
// backfill for SKILL.md files.
//
// TypeScript+Bun port of backfill_dv2_frontmatter.sh, slice 11 of
// the TS+Bun migration. See docs/best-practices/repo-scripting.md.
//
// Phase-1 deliverable of the DV-2.0 provenance rollout. Computes
// missing fields (record_source / load_datetime / last_updated /
// status / bp_rules_cited) from git history and injects before the
// closing frontmatter fence. Idempotent.
//
// Usage:
//   bun tools/skill-catalog/backfill_dv2_frontmatter.ts [--dry-run] <path>...
//   bun tools/skill-catalog/backfill_dv2_frontmatter.ts [--dry-run] --all
//
// Exit codes:
//   0    success
//   1    usage error
//   2    a file was malformed (no closing frontmatter fence)

import { readdirSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

type ExitCode = 0 | 1 | 2;

const SPAWN_MAX_BUFFER = 64 * 1024 * 1024;

const ROUND_RE = /[Rr]ound\s*(\d+)/;
const BP_RE = /BP-\d+/g;

interface ParsedArgs {
  readonly dryRun: boolean;
  readonly all: boolean;
  readonly files: readonly string[];
}

interface ParseResult {
  readonly args: ParsedArgs | null;
  readonly errorMessage: string;
  readonly help: boolean;
}

function parseArgs(argv: readonly string[]): ParseResult {
  let dryRun = false;
  let all = false;
  const files: string[] = [];
  for (const arg of argv) {
    if (arg === "--dry-run") dryRun = true;
    else if (arg === "--all") all = true;
    else if (arg === "-h" || arg === "--help") {
      return { args: null, errorMessage: "", help: true };
    } else if (arg.startsWith("-")) {
      return { args: null, errorMessage: `unknown flag: ${arg}`, help: false };
    } else {
      files.push(arg);
    }
  }
  return { args: { dryRun, all, files }, errorMessage: "", help: false };
}

function emitHelp(): void {
  process.stdout.write(
    "Usage: bun tools/skill-catalog/backfill_dv2_frontmatter.ts [--dry-run] <path>... | --all\n",
  );
}

function gitOutput(args: readonly string[]): string {
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  const result = spawnSync("git", args, {
    encoding: "utf8",
    maxBuffer: SPAWN_MAX_BUFFER,
  });
  if (result.status !== 0) return "";
  return result.stdout;
}

function repoRoot(): string {
  const out = gitOutput(["rev-parse", "--show-toplevel"]).trim();
  return out === "" ? process.cwd() : out;
}

function findAllSkillFiles(): readonly string[] {
  const out: string[] = [];
  const skillsDir = ".claude/skills";
  let entries: readonly import("node:fs").Dirent[];
  try {
    entries = readdirSync(skillsDir, { withFileTypes: true });
  } catch {
    return [];
  }
  // List candidate paths; processOne uses readFileSync directly with
  // try/catch (no statSync gate), so missing/non-file paths surface as
  // a warn outcome rather than racing the file system.
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    out.push(join(skillsDir, e.name, "SKILL.md"));
  }
  return out.sort((a, b) => a.localeCompare(b));
}

function fieldPresent(content: string, field: string): boolean {
  const lines = content.split("\n");
  let count = 0;
  for (const line of lines) {
    if (line === "---") {
      count++;
      if (count === 2) return false;
      continue;
    }
    if (count === 1 && line.startsWith(`${field}:`)) return true;
  }
  return false;
}

function dashCount(content: string): number {
  let count = 0;
  for (const line of content.split("\n")) {
    if (line === "---") count++;
  }
  return count;
}

function firstLine(text: string): string {
  const idx = text.indexOf("\n");
  return idx < 0 ? text : text.slice(0, idx);
}

function isoDateOnly(text: string): string {
  const trimmed = text.trim();
  const sp = trimmed.indexOf(" ");
  return sp < 0 ? trimmed : trimmed.slice(0, sp);
}

function computeRecordSource(file: string): string {
  const subj = firstLine(
    gitOutput(["log", "--reverse", "--format=%s", "--", file]),
  );
  const m = ROUND_RE.exec(subj);
  if (m !== null) return `skill-creator, round ${m[1] ?? ""}`;
  const authorLine = firstLine(
    gitOutput(["log", "--reverse", "--format=%an on %ai", "--", file]),
  );
  if (authorLine === "") return "git: unknown";
  const parts = authorLine.split(/\s+/);
  if (parts.length < 4) return `git: ${authorLine}`;
  return `git: ${parts[0] ?? ""} ${parts[1] ?? ""} on ${parts[3] ?? ""}`;
}

function computeLoadDatetime(file: string): string {
  const line = firstLine(
    gitOutput(["log", "--reverse", "--format=%ai", "--", file]),
  );
  return isoDateOnly(line);
}

function computeLastUpdated(file: string): string {
  const line = firstLine(gitOutput(["log", "-1", "--format=%ai", "--", file]));
  return isoDateOnly(line);
}

function computeBpRules(file: string): string {
  let content: string;
  try {
    content = readFileSync(file, "utf8");
  } catch {
    return "[]";
  }
  const matches = content.match(BP_RE);
  if (matches === null || matches.length === 0) return "[]";
  const unique = [...new Set(matches)].sort((a, b) => a.localeCompare(b));
  return `[${unique.join(", ")}]`;
}

interface ProcessOutcome {
  readonly status: "ok" | "wrote" | "warn" | "error";
  readonly message: string;
  readonly exitCode: ExitCode;
}

function buildInjections(
  file: string,
  content: string,
  today: string,
): readonly string[] {
  const inject: string[] = [];
  if (!fieldPresent(content, "record_source")) {
    inject.push(`record_source: "${computeRecordSource(file)}"`);
  }
  if (!fieldPresent(content, "load_datetime")) {
    inject.push(`load_datetime: "${computeLoadDatetime(file)}"`);
  }
  if (!fieldPresent(content, "last_updated")) {
    const value = computeLastUpdated(file) || today;
    inject.push(`last_updated: "${value}"`);
  }
  if (!fieldPresent(content, "status")) inject.push("status: active");
  if (!fieldPresent(content, "bp_rules_cited")) {
    inject.push(`bp_rules_cited: ${computeBpRules(file)}`);
  }
  return inject;
}

function injectBeforeSecondFence(
  content: string,
  blob: readonly string[],
): string {
  const lines = content.split("\n");
  const out: string[] = [];
  let count = 0;
  for (const line of lines) {
    if (line === "---") {
      count++;
      if (count === 2) {
        for (const b of blob) out.push(b);
        out.push(line);
        continue;
      }
    }
    out.push(line);
  }
  return out.join("\n");
}

function processOne(
  file: string,
  dryRun: boolean,
  today: string,
): ProcessOutcome {
  // Single readFileSync — avoids TOCTOU race the bash original had via
  // separate `[ ! -f "$file" ]` test before content read. Errors from
  // ENOENT, EACCES, EISDIR, etc. all surface as readFileSync exceptions
  // and we map them to the same warn/error outcomes here.
  let content: string;
  try {
    content = readFileSync(file, "utf8");
  } catch (err) {
    const code =
      err !== null && typeof err === "object" && "code" in err
        ? String(err.code)
        : "";
    if (code === "ENOENT" || code === "EISDIR") {
      return {
        status: "warn",
        message: `warn: skipping non-file: ${file}`,
        exitCode: 0,
      };
    }
    return { status: "error", message: `error: cannot read ${file}`, exitCode: 2 };
  }
  if (dashCount(content) < 2) {
    return {
      status: "error",
      message: `error: ${file} has no closing frontmatter fence`,
      exitCode: 2,
    };
  }
  const inject = buildInjections(file, content, today);
  if (inject.length === 0) {
    return { status: "ok", message: `ok   ${file} (already compliant)`, exitCode: 0 };
  }
  if (dryRun) {
    const lines = [
      `--- ${file} (dry-run, would inject ${String(inject.length)} field(s)):`,
      ...inject.map((l) => `    ${l}`),
    ];
    return { status: "ok", message: lines.join("\n"), exitCode: 0 };
  }
  const newContent = injectBeforeSecondFence(content, inject);
  // Atomic rewrite: write to a sibling tmp file + rename. Mirrors the
  // bash original's `mktemp` + `mv` pattern. Crash/kill/disk-full mid-
  // write leaves the original file intact rather than truncated. The
  // tmp lives next to the target so rename is a same-filesystem
  // operation (atomic on POSIX).
  const tmpPath = `${file}.tmp.${String(process.pid)}.${String(Date.now())}`;
  try {
    writeFileSync(tmpPath, newContent);
    renameSync(tmpPath, file);
  } catch (err) {
    // Preserve-original-on-failure: do NOT unlink the original; leave
    // the tmp file behind for manual recovery rather than risk losing
    // data in a delete-before-retry pattern. Modern Node/Bun
    // renameSync overwrites atomically on all platforms in the common
    // case; failure is rare (Windows file lock, perms, disk-full) and
    // a stray tmp file is recoverable. Deleting the target before a
    // retry that might also fail is the unsafe path Codex flagged.
    const message = err instanceof Error ? err.message : "unknown error";
    return {
      status: "error",
      message: `error: cannot rewrite ${file}: ${message} (tmp preserved at ${tmpPath})`,
      exitCode: 2,
    };
  }
  return {
    status: "wrote",
    message: `wrote ${file} (${String(inject.length)} field(s) added)`,
    exitCode: 0,
  };
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function emitOutcome(outcome: ProcessOutcome): void {
  if (outcome.status === "warn" || outcome.status === "error") {
    process.stderr.write(`${outcome.message}\n`);
  } else {
    process.stdout.write(`${outcome.message}\n`);
  }
}

export function main(argv: readonly string[]): ExitCode {
  const parsed = parseArgs(argv);
  if (parsed.help) {
    emitHelp();
    return 0;
  }
  if (parsed.args === null) {
    process.stderr.write(`error: ${parsed.errorMessage}\n`);
    return 1;
  }
  const args = parsed.args;
  if (args.all && args.files.length > 0) {
    process.stderr.write("error: --all is mutually exclusive with explicit paths\n");
    return 1;
  }
  // chdir to repo root before scanning so --all works regardless of
  // caller cwd. Bash original used `find .claude/skills -maxdepth 2`
  // which has the same cwd-dependence issue; the TS port fixes this
  // at the entry point.
  if (args.all) process.chdir(repoRoot());
  const files = args.all ? findAllSkillFiles() : args.files;
  if (files.length === 0) {
    process.stderr.write(
      "usage: bun tools/skill-catalog/backfill_dv2_frontmatter.ts [--dry-run] <SKILL.md path>... | --all\n",
    );
    return 1;
  }
  const today = todayUtc();
  let rc: ExitCode = 0;
  for (const f of files) {
    const outcome = processOne(f, args.dryRun, today);
    emitOutcome(outcome);
    if (outcome.exitCode !== 0) rc = outcome.exitCode;
  }
  return rc;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
