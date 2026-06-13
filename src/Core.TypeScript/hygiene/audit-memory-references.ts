#!/usr/bin/env bun
// audit-memory-references.ts — detect broken memory-file references
// in `memory/MEMORY.md`.
//
// TypeScript+Bun port of audit-memory-references.sh, per the
// 2026-04-29 directive to canonicalize on TS+Bun for tooling.
// See docs/trajectories/typescript-bun-migration/RESUME.md for the
// trajectory; see B-0086 for the migration discipline.
//
// Type discipline (typed boundaries, not noise):
//   Findings flow as `readonly BrokenRefFinding[]` of structured
//   `{ ref, tried }` objects. CLI args parse into a typed `Args`
//   interface. `AuditResult` carries totals + structured findings.
//   Exit code is a literal-type union `AuditExitCode`. Idioms follow
//   upstream Bun + TS 6 + typescript-eslint v8 strictTypeChecked
//   guidance and `../SQLSharp` conventions.
//
// Every `](foo.md)` link target in MEMORY.md MUST resolve to an
// actual file. Resolution is two-pass: first relative to `baseDir`
// (default: `memory`), then — for legacy targets that already
// include a path prefix like `memory/...` — as a workspace-root-
// relative path. A target resolves if either pass finds an actual
// file. Together with the duplicate-detector and the memory-index-
// integrity workflow, this forms three-part memory-index hygiene:
//   1. Every memory file change updates MEMORY.md (workflow).
//   2. MEMORY.md has no duplicate link targets (sibling lint).
//   3. Every MEMORY.md link target resolves to an actual file
//      under one of the accepted resolution modes (this tool).
//
// Usage:
//   bun tools/hygiene/audit-memory-references.ts                  # default: memory/MEMORY.md
//   bun tools/hygiene/audit-memory-references.ts --file PATH      # custom file
//   bun tools/hygiene/audit-memory-references.ts --base DIR       # default: memory
//   bun tools/hygiene/audit-memory-references.ts --enforce        # exit 2 on any broken ref
//
// Exit codes:
//   0 — all references resolve (or --enforce not set)
//   2 — broken references found and --enforce set
//   64 — argument error

import { statSync, readFileSync } from "node:fs";

type AuditExitCode = 0 | 2 | 64;

interface Args {
  readonly target: string;
  readonly baseDir: string;
  readonly enforce: boolean;
}

interface BrokenRefFinding {
  readonly ref: string;
  readonly tried: string;
}

interface AuditResult {
  readonly total: number;
  readonly okCount: number;
  readonly broken: readonly BrokenRefFinding[];
}

type ParseResult =
  | { readonly kind: "args"; readonly args: Args }
  | { readonly kind: "help" }
  | { readonly kind: "error"; readonly message: string };

const LINK_RE = /\]\(([a-zA-Z_0-9./-]+\.md)\)/g;

const HELP_TEXT =
  "Usage: audit-memory-references.ts [--file PATH] [--base DIR] [--enforce]\n";

function parseArgs(argv: readonly string[]): ParseResult {
  let target = "memory/MEMORY.md";
  let baseDir = "memory";
  let enforce = false;
  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    if (arg === "--file") {
      const value = argv[i + 1];
      if (value === undefined) {
        return { kind: "error", message: "error: --file requires a path" };
      }
      target = value;
      i += 2;
    } else if (arg === "--base") {
      const value = argv[i + 1];
      if (value === undefined) {
        return { kind: "error", message: "error: --base requires a directory" };
      }
      baseDir = value;
      i += 2;
    } else if (arg === "--enforce") {
      enforce = true;
      i += 1;
    } else if (arg === "-h" || arg === "--help") {
      return { kind: "help" };
    } else {
      return { kind: "error", message: `unknown arg: ${String(arg)}` };
    }
  }
  return { kind: "args", args: { target, baseDir, enforce } };
}

function isFile(p: string): boolean {
  try {
    return statSync(p).isFile();
  } catch {
    return false;
  }
}

function describeIoError(err: unknown): string {
  if (err instanceof Error) {
    const code =
      "code" in err && typeof (err as { code?: unknown }).code === "string"
        ? (err as { code: string }).code
        : undefined;
    return code !== undefined ? `${code}: ${err.message}` : err.message;
  }
  return String(err);
}

export function audit(content: string, baseDir: string): AuditResult {
  const refs = new Set<string>();
  for (const match of content.matchAll(LINK_RE)) {
    const captured = match[1];
    if (captured !== undefined) refs.add(captured);
  }

  const sortedRefs = [...refs].sort((a, b) => a.localeCompare(b));
  const broken: BrokenRefFinding[] = [];
  let okCount = 0;
  for (const ref of sortedRefs) {
    const fileRel = `${baseDir}/${ref}`;
    if (isFile(fileRel)) {
      okCount += 1;
      continue;
    }
    if (ref.includes("/") && isFile(ref)) {
      okCount += 1;
      continue;
    }
    broken.push({ ref, tried: fileRel });
  }
  return { total: sortedRefs.length, okCount, broken };
}

export function main(argv: readonly string[]): AuditExitCode {
  const parsed = parseArgs(argv);
  if (parsed.kind === "help") {
    process.stdout.write(HELP_TEXT);
    return 0;
  }
  if (parsed.kind === "error") {
    process.stderr.write(`${parsed.message}\n`);
    return 64;
  }
  const { target, baseDir, enforce } = parsed.args;

  // Read target atomically — readFileSync throws on ENOENT, EISDIR,
  // EACCES, etc. Avoids the TOCTOU race between an existsSync check
  // and the read (CodeQL js/file-system-race). Surface the error
  // code so debugging permission/path-shape errors is not just
  // "not found".
  let content: string;
  try {
    content = readFileSync(target, "utf8");
  } catch (err: unknown) {
    process.stderr.write(
      `error: unable to read target file: ${target} (${describeIoError(err)})\n`,
    );
    return 64;
  }

  // Same atomic pattern for base directory.
  try {
    if (!statSync(baseDir).isDirectory()) {
      process.stderr.write(
        `error: base directory is not a directory: ${baseDir}\n`,
      );
      return 64;
    }
  } catch (err: unknown) {
    process.stderr.write(
      `error: unable to stat base directory: ${baseDir} (${describeIoError(err)})\n`,
    );
    return 64;
  }

  const { total, okCount, broken } = audit(content, baseDir);

  if (total === 0) {
    process.stderr.write(
      `no memory-index link targets in ${target}; nothing to check\n`,
    );
    return 0;
  }

  process.stderr.write(`memory-reference audit on ${target}\n`);
  process.stderr.write(`  base dir: ${baseDir}\n`);
  process.stderr.write(`  refs checked: ${String(total)}\n`);
  process.stderr.write(`  resolved:     ${String(okCount)}\n`);

  if (broken.length === 0) {
    process.stderr.write(`  broken:       0\n`);
    process.stderr.write("\n");
    process.stderr.write(
      "all memory-index link targets resolve to existing files\n",
    );
    return 0;
  }

  process.stderr.write(`  broken:       ${String(broken.length)}\n`);
  process.stderr.write("\n");
  process.stderr.write("broken references:\n");
  process.stderr.write("\n");
  for (const { ref, tried } of broken) {
    process.stderr.write(`  ${ref} -> ${tried} (not found)\n`);
  }
  process.stderr.write("\n");
  process.stderr.write(
    `These link targets in ${target} do not resolve to files\n`,
  );
  process.stderr.write(
    `under ${baseDir}/. Either the file was renamed / moved /\n`,
  );
  process.stderr.write(
    "deleted, or the path was typed incorrectly at index-add time.\n",
  );
  process.stderr.write("\n");
  process.stderr.write(
    "To fix: either restore the file, correct the path, or\n",
  );
  process.stderr.write("remove the broken row from the index.\n");

  return enforce ? 2 : 0;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
