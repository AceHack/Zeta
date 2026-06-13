#!/usr/bin/env bun
// audit-post-setup-script-stack.ts — detects bash/PowerShell scripts
// under tools/ that violate the post-setup-stack rule (post-setup
// tooling should be bun + TypeScript by default).
//
// TypeScript+Bun port of audit-post-setup-script-stack.sh, slice 5
// of the TS+Bun migration. See docs/best-practices/repo-scripting.md.
//
// Classification:
//   exempt    — tools/setup/**, tools/_deprecated/**
//   labelled  — header comment carries one of the 5 exception labels
//   violation — bash/PowerShell under tools/ outside exempt without label
//
// Usage:
//   bun tools/hygiene/audit-post-setup-script-stack.ts             # full report
//   bun tools/hygiene/audit-post-setup-script-stack.ts --summary   # counts
//
// Exit codes:
//   0   no violations (labelled + exempt acceptable)
//   1   usage error
//   2   one or more violations

import { readFileSync } from "node:fs";
import {
  spawnSync,
  type SpawnSyncReturns,
} from "node:child_process";

type AuditExitCode = 0 | 1 | 2;
type Mode = "report" | "summary";

type ParseResult =
  | { readonly kind: "mode"; readonly mode: Mode }
  | { readonly kind: "help" }
  | { readonly kind: "error"; readonly message: string };

interface AuditBuckets {
  readonly exempt: readonly string[];
  readonly labelled: readonly string[];
  readonly violations: readonly string[];
}

const SPAWN_MAX_BUFFER = 64 * 1024 * 1024;

const LABEL_RE = /(bun\+TS migration candidate|bash scaffolding|thin wrapper over existing CLI|trivial find-xargs pipeline|stay bash forever)/;

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

function runGit(args: readonly string[]): string {
  const result = spawnSync(
    // eslint-disable-next-line sonarjs/no-os-command-from-path
    "git",
    args,
    { encoding: "utf8", maxBuffer: SPAWN_MAX_BUFFER },
  );
  const failure = classifyFailure("git", args, result);
  if (failure !== null) throw new Error(failure);
  return result.stdout;
}

function repoRoot(): string {
  return runGit(["rev-parse", "--show-toplevel"]).trim();
}

function listAllScripts(): readonly string[] {
  const raw = runGit([
    "ls-files",
    "-z",
    "tools/*.sh",
    "tools/*.ps1",
    "tools/**/*.sh",
    "tools/**/*.ps1",
  ]);
  return raw
    .split("\0")
    .filter((s): s is string => s.length > 0)
    .sort((a, b) => byteCompare(a, b));
}

function byteCompare(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function isExempt(path: string): boolean {
  return path.startsWith("tools/setup/") || path.startsWith("tools/_deprecated/");
}

function hasLabel(path: string): boolean {
  let content: string;
  try {
    content = readFileSync(path, "utf8");
  } catch {
    return false;
  }
  const head = content.split("\n").slice(0, 60).join("\n");
  return LABEL_RE.test(head);
}

function parseMode(argv: readonly string[]): ParseResult {
  let mode: Mode = "report";
  for (const arg of argv) {
    if (arg === "-h" || arg === "--help") return { kind: "help" };
    if (arg === "--summary") {
      mode = "summary";
      continue;
    }
    return { kind: "error", message: `error: unknown arg: ${arg}` };
  }
  return { kind: "mode", mode };
}

export function audit(): AuditBuckets {
  const all = listAllScripts();
  const exempt: string[] = [];
  const labelled: string[] = [];
  const violations: string[] = [];
  for (const file of all) {
    if (isExempt(file)) {
      exempt.push(file);
    } else if (hasLabel(file)) {
      labelled.push(file);
    } else {
      violations.push(file);
    }
  }
  return { exempt, labelled, violations };
}

function emitSummary(b: AuditBuckets): string {
  return [
    `exempt:     ${String(b.exempt.length)}`,
    `labelled:   ${String(b.labelled.length)}`,
    `violations: ${String(b.violations.length)}`,
  ].join("\n");
}

function emitReportSection(title: string, items: readonly string[], hint?: string): readonly string[] {
  const lines: string[] = [];
  lines.push(`## ${title}`);
  if (items.length > 0) {
    for (const i of items) lines.push(`- ${i}`);
  } else {
    lines.push(hint === "clean" ? "- (none — clean)" : "- (none)");
  }
  return lines;
}

function emitReport(b: AuditBuckets): string {
  // Run timestamp matches bash format `date -u +%Y-%m-%dT%H:%M:%SZ`.
  const now = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const lines: string[] = [];
  lines.push("# Post-setup script stack audit");
  lines.push("");
  lines.push(`Run: ${now}`);
  lines.push("Authoritative rule: docs/POST-SETUP-SCRIPT-STACK.md");
  lines.push("");
  for (const l of emitReportSection(`Exempt (${String(b.exempt.length)})`, b.exempt)) lines.push(l);
  lines.push("");
  for (const l of emitReportSection(`Labelled exceptions (${String(b.labelled.length)})`, b.labelled)) lines.push(l);
  lines.push("");
  for (const l of emitReportSection(`Violations (${String(b.violations.length)})`, b.violations, "clean")) lines.push(l);
  if (b.violations.length > 0) {
    lines.push("");
    lines.push("Each violation must either (a) gain an exception label");
    lines.push("header comment (see docs/POST-SETUP-SCRIPT-STACK.md Q3");
    lines.push("exceptions), (b) migrate to bun + TypeScript under");
    lines.push("tools/**/*.ts, or (c) move to tools/_deprecated/ if");
    lines.push("unused.");
  }
  return lines.join("\n");
}

export function main(argv: readonly string[]): AuditExitCode {
  const parsed = parseMode(argv);
  if (parsed.kind === "help") {
    process.stdout.write("Usage: audit-post-setup-script-stack.ts [--summary]\n");
    return 0;
  }
  if (parsed.kind === "error") {
    process.stderr.write(`${parsed.message}\n`);
    return 1;
  }
  process.chdir(repoRoot());
  const b = audit();
  if (parsed.mode === "summary") {
    process.stdout.write(`${emitSummary(b)}\n`);
  } else {
    process.stdout.write(`${emitReport(b)}\n`);
  }
  return b.violations.length > 0 ? 2 : 0;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
