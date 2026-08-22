#!/usr/bin/env bun
// check-shard-before-push.ts — bundled pre-push self-checks for tick shards
//
// Run on a single shard (or multiple) before pushing. Wraps three CI gates
// that the shard would otherwise hit only after push:
//
//   1. MD032 paragraph-immediately-followed-by-bullet detection
//      (markdownlint catches this; running before push is faster feedback)
//   2. `markdownlint-cli2` for the broad markdown lint surface
//      (MD038 no-space-in-code, MD024, etc.)
//   3. `audit-tick-shard-relative-paths` for broken relative-path links
//      (the dedicated audit gate — same as CI runs in `--enforce --baseline`
//      mode, but here in detect-only-for-this-file mode)
//
// This is a DX helper, not a CI gate. CI gates remain authoritative; this
// script just shortens the local-feedback loop from "push + wait for CI"
// to "single command + immediate output."
//
// Usage:
//
//   bun tools/hygiene/check-shard-before-push.ts <shard-path>...
//   bun tools/hygiene/check-shard-before-push.ts docs/hygiene-history/ticks/2026/05/16/0340Z.md
//
// Exit codes:
//
//   0   all checks passed on all input files
//   1   one or more checks failed
//   64  argument error (no files / non-file inputs)
//
// Composes with: audit-tick-shard-relative-paths.ts (relative-path audit),
// audit-md032-plus-linestart.ts (sibling `+`-marker MD032 check),
// AUDIT-LIFECYCLE.md (the lifecycle template that motivates pre-push catches).

import { existsSync, statSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

// arg parsing

interface Args {
  files: readonly string[];
}

type ParseResult = { ok: true; args: Args } | { ok: false; exitCode: 64; message: string };

function parseArgs(argv: readonly string[]): ParseResult {
  if (argv.length === 0) {
    return { ok: false, exitCode: 64, message: "usage: check-shard-before-push.ts <shard-path>..." };
  }
  return { ok: true, args: { files: argv } };
}

// MD032 paragraph-immediately-followed-by-bullet detection.
// The same `awk`-shaped scan I've been running per-tick this session,
// ported to TS for the bundled-helper interface.

interface Md032Finding {
  readonly file: string;
  readonly line: number;
  readonly paragraph: string;
  readonly bullet: string;
}

// Per-line "inside fenced code block" tracking. A `- ` line inside ``` ``` ```
// fences is not a markdown list item — markdownlint correctly ignores it,
// and so must this scanner. Same pattern as audit-tick-shard-relative-paths.ts.
function buildCodeFenceFlags(lines: readonly string[]): boolean[] {
  const flags = new Array<boolean>(lines.length).fill(false);
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i]!.trim();
    if (trimmed.startsWith("```")) {
      inFence = !inFence;
      flags[i] = inFence; // the fence-marker line itself is "inside" the closing-toggle direction
    } else {
      flags[i] = inFence;
    }
  }
  return flags;
}

// A line starting with whitespace is typically a wrap-continuation of the
// previous structural element (list-item continuation, blockquote-continuation,
// fenced-block-continuation). markdownlint correctly treats these as part
// of the prior element, NOT as a paragraph that would need a blank line
// before a following list. Detect by leading whitespace on the prev line.
function isContinuationLine(line: string): boolean {
  return /^\s/.test(line);
}

function checkMd032(file: string): Md032Finding[] {
  const text = readFileSync(file, "utf8");
  const lines = text.split("\n");
  const fenceFlags = buildCodeFenceFlags(lines);
  const findings: Md032Finding[] = [];
  for (let i = 1; i < lines.length; i++) {
    if (fenceFlags[i]) continue; // skip lines inside fenced code blocks
    const prev = lines[i - 1]!;
    const cur = lines[i]!;
    // Trigger: cur starts with "- " bullet AND prev is non-blank
    //          AND prev is not itself a structural marker (#, >, *, -, |, ```)
    //          AND prev is not a wrap-continuation of a prior structural element
    if (!cur.startsWith("- ")) continue;
    if (prev.trim() === "") continue;
    if (/^[#>*\-|`]/.test(prev)) continue;
    if (isContinuationLine(prev)) continue;
    findings.push({ file, line: i + 1, paragraph: prev, bullet: cur });
  }
  return findings;
}

// markdownlint-cli2 wrapper.
// Returns true on clean exit, false on findings. Stdout/stderr are echoed
// directly so the user sees the same output they'd see from the CI gate.

function runMarkdownlint(file: string): boolean {
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- bun invoked as explicit args array; no shell; no user input beyond the file path which is validated upfront.
  const r = spawnSync("bun", ["x", "markdownlint-cli2", file], {
    stdio: ["ignore", "inherit", "inherit"],
  });
  return r.status === 0;
}

// relative-path-audit wrapper.
// The audit's `--files` mode is detect-only by default (no --enforce), so
// we get the findings list. Exit 0 with findings == clean; non-zero =
// argument error.

function runRelativePathAudit(file: string): boolean {
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- bun invoked as explicit args array; no shell; no user input beyond the file path which is validated upfront.
  const r = spawnSync(
    "bun",
    [
      "tools/hygiene/audit-tick-shard-relative-paths.ts",
      "--files",
      file,
    ],
    { encoding: "utf8" },
  );
  const out = r.stdout ?? "";
  const err = r.stderr ?? "";

  // The audit script in detect-only mode (no --enforce) exits 0 even with
  // findings; we need to inspect the output. But ANY non-zero exit (crash,
  // argument error, signal) is unambiguously a failure regardless of stdout.
  if (r.status !== 0) {
    process.stdout.write(out);
    if (err) process.stderr.write(err);
    process.stderr.write(`audit exited with status ${r.status}\n`);
    return false;
  }

  // Exit 0 + findings: parse the output. Match the canonical "X broken
  // relative-path links" suffix; treat "0 broken" as clean, anything else
  // as findings. Tolerate future wording tweaks by allowing whitespace
  // variation around the digit.
  const FINDINGS_RE = /;\s*(\d+)\s+broken relative-path links/;
  const m = out.match(FINDINGS_RE);
  if (!m) {
    // Unexpected output format — echo and fail loud rather than silent-pass.
    process.stdout.write(out);
    if (err) process.stderr.write(err);
    process.stderr.write("audit produced unrecognized output format\n");
    return false;
  }
  const count = Number(m[1]);
  if (count === 0) return true;

  // findings present — print them
  process.stdout.write(out);
  if (err) process.stderr.write(err);
  return false;
}

// main

export function main(argv: readonly string[]): 0 | 1 | 64 {
  const parsed = parseArgs(argv);
  if (!parsed.ok) {
    process.stderr.write(`${parsed.message}\n`);
    return parsed.exitCode;
  }
  const args = parsed.args;

  // Validate inputs (per the validation pattern from the audit script).
  const bad: { path: string; reason: string }[] = [];
  for (const f of args.files) {
    const abs = resolve(f);
    if (!existsSync(abs)) {
      bad.push({ path: f, reason: "not found" });
      continue;
    }
    try {
      if (!statSync(abs).isFile()) {
        bad.push({ path: f, reason: "not a regular file" });
      }
    } catch (e) {
      bad.push({ path: f, reason: `stat failed (${(e as Error).message})` });
    }
  }
  if (bad.length > 0) {
    for (const b of bad) process.stderr.write(`input ${b.reason}: ${b.path}\n`);
    return 64;
  }

  let anyFailed = false;
  for (const f of args.files) {
    process.stdout.write(`=== ${f}\n`);

    // 1. MD032
    const md032 = checkMd032(f);
    if (md032.length === 0) {
      process.stdout.write("  ok: MD032 (paragraph-before-bullet)\n");
    } else {
      anyFailed = true;
      process.stdout.write(`  FAIL: MD032 (${md032.length} finding${md032.length === 1 ? "" : "s"}):\n`);
      for (const m of md032) {
        process.stdout.write(`    line ${m.line}: '${m.paragraph.slice(0, 60)}' → '${m.bullet.slice(0, 60)}'\n`);
      }
    }

    // 2. markdownlint
    process.stdout.write("  running: markdownlint-cli2 ...\n");
    if (runMarkdownlint(f)) {
      process.stdout.write("  ok: markdownlint\n");
    } else {
      anyFailed = true;
      process.stdout.write("  FAIL: markdownlint\n");
    }

    // 3. relative-path audit
    process.stdout.write("  running: audit-tick-shard-relative-paths ...\n");
    if (runRelativePathAudit(f)) {
      process.stdout.write("  ok: relative-path audit\n");
    } else {
      anyFailed = true;
      process.stdout.write("  FAIL: relative-path audit\n");
    }
  }

  return anyFailed ? 1 : 0;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
