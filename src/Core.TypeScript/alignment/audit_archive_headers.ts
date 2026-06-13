#!/usr/bin/env bun
// audit_archive_headers.ts — archive-header discipline lint
// (5th-ferry Artifact C, detect-only v0).
//
// TypeScript+Bun port of audit_archive_headers.sh, slice 3 of
// the TS+Bun migration. See `docs/best-practices/repo-scripting.md`
// for the per-slice audit checklist + Zeta scripting conventions.
//
// What this does:
//   Checks every `docs/aurora/**/*.md` absorb doc for the four
//   archive-header fields:
//
//     Scope:                research / cross-review / archival purpose
//     Attribution:          speaker labels preserved
//     Operational status:   research-grade | operational
//     Non-fusion disclaimer: explicit non-fusion clause
//
//   Detect-only at v0; --enforce flips exit 1 on gaps.
//
// Output modes:
//   default  : human-readable summary on stderr.
//   --json   : single JSON object with rollup counters on stdout.
//   --out DIR: one JSON file per source doc under DIR/, with an
//              injective slash-encoding so distinct source paths
//              cannot collide on output filename.
//
// Usage:
//   bun tools/alignment/audit_archive_headers.ts                # detect-only
//   bun tools/alignment/audit_archive_headers.ts --enforce      # exit 1 on gap
//   bun tools/alignment/audit_archive_headers.ts --path DIR     # custom path
//   bun tools/alignment/audit_archive_headers.ts --json         # JSON rollup
//   bun tools/alignment/audit_archive_headers.ts --out DIR      # per-file JSON
//
// Exit codes:
//   0  All archive docs have all four headers (or --enforce unset)
//   1  Missing headers AND --enforce set
//   2  Script error / missing dependency / bad args

import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import {
  spawnSync,
  type SpawnSyncReturns,
} from "node:child_process";

type AuditExitCode = 0 | 1 | 2;

interface Args {
  readonly targetPath: string;
  readonly enforce: boolean;
  readonly json: boolean;
  readonly outDir: string | null;
}

type ParseResult =
  | { readonly kind: "args"; readonly args: Args }
  | { readonly kind: "help" }
  | { readonly kind: "error"; readonly message: string };

interface FileFinding {
  readonly path: string;
  readonly status: "ok" | "missing";
  readonly missingLabels: readonly string[];
}

interface AuditResult {
  readonly targetPath: string;
  readonly findings: readonly FileFinding[];
}

const SPAWN_MAX_BUFFER = 64 * 1024 * 1024;

const HEADER_LABELS: readonly string[] = [
  "Scope:",
  "Attribution:",
  "Operational status:",
  "Non-fusion disclaimer:",
];

const HEAD_LINES = 20;

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
  const failure = classifyFailure("git", ["rev-parse", "--show-toplevel"], result);
  if (failure !== null) throw new Error(failure);
  return result.stdout.trim();
}

function readDirentsOrEmpty(dir: string): readonly import("node:fs").Dirent[] {
  try {
    return readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

function isExcludedReferences(full: string, refsRoot: string): boolean {
  return full === refsRoot || full.startsWith(`${refsRoot}/`);
}

// Bun-native recursive markdown enumeration via fs.readdirSync (Bun
// provides the Node API). Avoids forking `find` which can be slow on
// macOS. Stable sort matches `LC_ALL=C sort` output: byte-order on
// the resulting paths.
function listMarkdownFilesUnder(targetPath: string): readonly string[] {
  const refsRoot = `${targetPath}/references`;
  const out: string[] = [];
  const stack: string[] = [targetPath];
  while (stack.length > 0) {
    const dir = stack.pop();
    if (dir === undefined) continue;
    for (const entry of readDirentsOrEmpty(dir)) {
      const full = join(dir, entry.name);
      if (entry.isDirectory() && !isExcludedReferences(full, refsRoot)) {
        stack.push(full);
      } else if (entry.isFile() && full.endsWith(".md")) {
        out.push(full);
      }
    }
  }
  return out.sort(byteCompare);
}

function byteCompare(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function stripTrailingSlashes(p: string): string {
  let result = p;
  while (result.endsWith("/") && result !== "/") {
    result = result.slice(0, -1);
  }
  return result;
}

function reduceFlag(
  arg: string,
  next: string | undefined,
  state: { targetPath: string; enforce: boolean; json: boolean; outDir: string | null },
): { ok: true; consumed: 1 | 2 } | { ok: false; message: string } {
  if (arg === "--enforce") {
    state.enforce = true;
    return { ok: true, consumed: 1 };
  }
  if (arg === "--json") {
    state.json = true;
    return { ok: true, consumed: 1 };
  }
  if (arg === "--path") {
    if (next === undefined) {
      return { ok: false, message: "audit_archive_headers: --path requires a directory" };
    }
    state.targetPath = next;
    return { ok: true, consumed: 2 };
  }
  if (arg === "--out") {
    if (next === undefined) {
      return { ok: false, message: "audit_archive_headers: --out requires a directory" };
    }
    state.outDir = next;
    return { ok: true, consumed: 2 };
  }
  return { ok: false, message: `audit_archive_headers: unknown arg: ${arg}` };
}

function parseArgs(argv: readonly string[]): ParseResult {
  const state = {
    targetPath: "docs/aurora",
    enforce: false,
    json: false,
    outDir: null as string | null,
  };
  let i = 0;
  while (i < argv.length) {
    const arg = argv[i] ?? "";
    if (arg === "-h" || arg === "--help") return { kind: "help" };
    const r = reduceFlag(arg, argv[i + 1], state);
    if (!r.ok) return { kind: "error", message: r.message };
    i += r.consumed;
  }
  return {
    kind: "args",
    args: {
      targetPath: stripTrailingSlashes(state.targetPath),
      enforce: state.enforce,
      json: state.json,
      outDir: state.outDir,
    },
  };
}

function readHead(path: string, n: number): string {
  const content = readFileSync(path, "utf8");
  const lines = content.split("\n").slice(0, n);
  return lines.join("\n");
}

function checkFile(path: string): FileFinding {
  const head = readHead(path, HEAD_LINES);
  const missing: string[] = [];
  for (const label of HEADER_LABELS) {
    if (!head.includes(label)) missing.push(label);
  }
  return {
    path,
    status: missing.length === 0 ? "ok" : "missing",
    missingLabels: missing,
  };
}

export function audit(targetPath: string): AuditResult {
  const files = listMarkdownFilesUnder(targetPath);
  const findings = files.map(checkFile);
  return { targetPath, findings };
}

// Encode `<targetPath>/sub/dir/foo.md` to `sub__dir__foo` in a way
// that round-trips: percent-encode literal `_` to `_5F` first so
// the `_` byte never appears in the encoded form, then map `/` to
// `__`. See bash original lines 184-196 for the failure mode this
// guards against.
function encodeRelPath(relPath: string): string {
  const stem = relPath.endsWith(".md") ? relPath.slice(0, -3) : relPath;
  return stem.replaceAll("_", "_5F").replaceAll("/", "__");
}

function writePerFileJson(outDir: string, targetPath: string, finding: FileFinding): void {
  const rel = relative(targetPath, finding.path);
  const base = encodeRelPath(rel);
  const outPath = join(outDir, `${base}.json`);
  const payload = {
    path: finding.path,
    status: finding.status,
    missing_labels: finding.missingLabels,
    tool: "audit_archive_headers",
    v: 0,
  };
  writeFileSync(outPath, formatJson(payload));
}

// Match the bash original's hand-rolled JSON shape: 2-space indent
// with no newline at end of file (matches printf-driven layout).
function formatJson(o: unknown): string {
  return `${JSON.stringify(o, null, 2)}\n`;
}

function isDirectory(p: string): boolean {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function emitJsonRollup(args: Args, total: number, filesOk: number, filesMissing: number): void {
  const payload = {
    tool: "audit_archive_headers",
    v: 0,
    target_path: args.targetPath,
    total_files: total,
    files_ok: filesOk,
    files_missing_headers: filesMissing,
    enforce: args.enforce,
  };
  process.stdout.write(formatJson(payload));
}

function emitHumanSummary(targetPath: string, total: number, filesOk: number, filesMissing: number, findings: readonly FileFinding[]): void {
  process.stderr.write(`archive-header audit on ${targetPath}\n`);
  process.stderr.write(`  files checked:          ${String(total)}\n`);
  process.stderr.write(`  all four headers ok:    ${String(filesOk)}\n`);
  process.stderr.write(`  missing one or more:    ${String(filesMissing)}\n`);
  if (filesMissing > 0) {
    process.stderr.write("\n");
    process.stderr.write("gaps:\n");
    for (const f of findings) {
      if (f.status === "missing") {
        process.stderr.write(
          `  ${f.path}: missing [${f.missingLabels.join(",")}]\n`,
        );
      }
    }
  }
}

export function main(argv: readonly string[]): AuditExitCode {
  const parsed = parseArgs(argv);
  if (parsed.kind === "help") {
    process.stdout.write(
      "Usage: audit_archive_headers.ts [--path DIR] [--enforce] [--json | --out DIR]\n",
    );
    return 0;
  }
  if (parsed.kind === "error") {
    process.stderr.write(`${parsed.message}\n`);
    return 2;
  }
  const { args } = parsed;

  process.chdir(repoRoot());

  if (!isDirectory(args.targetPath)) {
    process.stderr.write(
      `audit_archive_headers: target path not found: ${args.targetPath}\n`,
    );
    return 2;
  }

  const result = audit(args.targetPath);

  if (result.findings.length === 0) {
    process.stderr.write(
      `audit_archive_headers: no .md files under ${args.targetPath}\n`,
    );
    return 0;
  }

  if (args.outDir !== null) {
    mkdirSync(args.outDir, { recursive: true });
    for (const f of result.findings) {
      writePerFileJson(args.outDir, args.targetPath, f);
    }
  }

  const total = result.findings.length;
  const filesOk = result.findings.filter((f) => f.status === "ok").length;
  const filesMissing = total - filesOk;

  if (args.json) emitJsonRollup(args, total, filesOk, filesMissing);
  else emitHumanSummary(args.targetPath, total, filesOk, filesMissing, result.findings);

  if (filesMissing > 0 && args.enforce) return 1;
  return 0;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
