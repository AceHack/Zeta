#!/usr/bin/env bun
// audit-memory-index-duplicates.ts — detect duplicate link targets
// in MEMORY.md-shaped indexes.
//
// TypeScript+Bun port of audit-memory-index-duplicates.sh, per the
// 2026-04-29 directive to canonicalize on TS+Bun for tooling.
// See docs/trajectories/typescript-bun-migration/RESUME.md for the
// trajectory; see B-0086 for the migration discipline.
//
// Type discipline (typed boundaries, not noise):
//   Findings flow as `readonly DuplicateFinding[]` of structured
//   `{ count, target }` objects. CLI args parse into a typed `Args`
//   interface. Exit code is a literal-type union `AuditExitCode`.
//   Idioms follow upstream Bun + TS 6 + typescript-eslint v8
//   strictTypeChecked guidance and `../SQLSharp` conventions.
//
// Detection strategy:
//   Scan the target file for `](filename.md)` link targets, normalize
//   equivalent paths (strip leading `./`), tally by normalized
//   filename. Any count > 1 is a duplicate.
//
// What this does NOT catch:
//   - Substantially similar descriptions of different files.
//   - External http(s) URLs (the regex requires `.md` suffix).
//
// Note: `.md` link targets inside fenced code blocks ARE matched
// by the regex (the scan is not block-aware). For target files
// like memory/MEMORY.md that don't use fenced code blocks, this
// is fine; for callers passing other shapes, pre-strip fences
// before invocation.
//
// Usage:
//   bun tools/hygiene/audit-memory-index-duplicates.ts              # in-repo memory/MEMORY.md
//   bun tools/hygiene/audit-memory-index-duplicates.ts --file PATH  # custom path
//   bun tools/hygiene/audit-memory-index-duplicates.ts --enforce    # exit 2 on any dup
//
// Exit codes:
//   0 — no duplicates (or --enforce not set)
//   2 — duplicates found and --enforce set
//   64 — argument error

import { readFileSync } from "node:fs";

type AuditExitCode = 0 | 2 | 64;

interface Args {
  readonly target: string;
  readonly enforce: boolean;
}

interface DuplicateFinding {
  readonly count: number;
  readonly target: string;
}

type ParseResult =
  | { readonly kind: "args"; readonly args: Args }
  | { readonly kind: "help" }
  | { readonly kind: "error"; readonly message: string };

const LINK_RE = /\]\(([a-zA-Z_0-9./-]+\.md)\)/g;

const HELP_TEXT =
  "Usage: audit-memory-index-duplicates.ts [--file PATH] [--enforce]\n";

function parseArgs(argv: readonly string[]): ParseResult {
  let target = "memory/MEMORY.md";
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
    } else if (arg === "--enforce") {
      enforce = true;
      i += 1;
    } else if (arg === "-h" || arg === "--help") {
      return { kind: "help" };
    } else {
      return { kind: "error", message: `unknown arg: ${String(arg)}` };
    }
  }
  return { kind: "args", args: { target, enforce } };
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

export function findDuplicates(content: string): readonly DuplicateFinding[] {
  const counts = new Map<string, number>();
  for (const match of content.matchAll(LINK_RE)) {
    const captured = match[1] ?? "";
    const path = captured.startsWith("./") ? captured.slice(2) : captured;
    counts.set(path, (counts.get(path) ?? 0) + 1);
  }
  const dups: DuplicateFinding[] = [];
  for (const [target, count] of counts) {
    if (count > 1) dups.push({ count, target });
  }
  // Sort by count descending (matches `sort -rn` in bash); tie-break
  // alphabetically so output is deterministic.
  dups.sort((a, b) => b.count - a.count || a.target.localeCompare(b.target));
  return dups;
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
  const { target, enforce } = parsed.args;

  // Read target atomically — readFileSync throws on ENOENT, EISDIR,
  // EACCES, etc. Avoids the TOCTOU race between a separate existsSync
  // check and the read (CodeQL js/file-system-race). Surface the
  // error code so permission / path-shape failures are not silently
  // misreported as "not found".
  let content: string;
  try {
    content = readFileSync(target, "utf8");
  } catch (err: unknown) {
    process.stderr.write(
      `error: unable to read target file: ${target} (${describeIoError(err)})\n`,
    );
    return 64;
  }

  const dups = findDuplicates(content);
  if (dups.length === 0) {
    process.stderr.write(`no duplicate memory-index links in ${target}\n`);
    return 0;
  }

  process.stderr.write(`duplicate memory-index links in ${target}:\n`);
  process.stderr.write("\n");
  process.stderr.write("  count  target\n");
  process.stderr.write("  -----  ------\n");
  for (const { count, target: t } of dups) {
    process.stderr.write(`  ${String(count).padStart(5)}  ${t}\n`);
  }
  process.stderr.write("\n");
  process.stderr.write("Each row shows how many times the target appears.\n");
  process.stderr.write(
    "Expected: every in-repo memory file listed exactly once\n",
  );
  process.stderr.write(
    "in newest-first order. Duplicates typically mean an\n",
  );
  process.stderr.write(
    "edit pass added a new pointer without removing the old.\n",
  );
  process.stderr.write("\n");
  process.stderr.write(
    `To fix: open ${target} and remove the older entry for each\n`,
  );
  process.stderr.write(
    "duplicated target, keeping the newest-first-ordered one.\n",
  );

  return enforce ? 2 : 0;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
