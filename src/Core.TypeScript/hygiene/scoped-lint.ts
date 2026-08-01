#!/usr/bin/env bun
// scoped-lint.ts — scope a linter's findings to the PR's own diff.
// Workitem 081KX3KA3ES08QG0R003TW3XDE (drift-and-heal ADR item 4): a PR
// reports drift only in files it touches; whole-repo state never blocks an
// unrelated lane. Measured motivation: on 2026-07-08 clean PRs were blocked
// ~2.5 h by other lanes' lint drift, and on 2026-07-31/08-01 an SDK-pin PR
// needed SIX rebuilds racing another lane's red files — every one of those
// failures was in files the PR never touched.
//
// Contract (composable, no linter integration required):
//
//   <linter> 2>&1 | bun scoped-lint.ts --changed changed-files.txt
//
// where changed-files.txt is `git diff --name-only <base>...<head>` output
// (one path per line — in the gate, the merge ref's diff against main).
// Findings whose path is IN the changed set are kept and fail the step
// (exit 1); findings outside the scope are reported as out-of-scope drift
// (informational — the continuous detector on main owns them, per the ADR)
// and do NOT fail. Non-finding lines pass through untouched.
//
// Recognized finding shapes (the formats the gate's linters actually emit):
//   path:line:col message | path:line:col: message     (markdownlint, tsc-style colon, shellcheck fmt=gcc)
//   path:line message     | path:line: message         (markdownlint MD032 rows)
//   path(line,col): message                            (tsc / dotnet build)
//   path: message                                      (generic)
// A line is a finding only if its extracted path looks like a repo path that
// EXISTS in either the changed set or the optional --tracked list — plain
// prose containing colons is passed through, not misclassified.
//
// Pure core (parse/classify/filter), edge-only I/O — noninterference §13;
// deterministic over the same inputs (DST).

import { readFileSync } from "node:fs";

export interface ScopedLine {
  readonly raw: string;
  readonly kind: "finding-in-scope" | "finding-out-of-scope" | "passthrough";
  readonly path?: string;
}

/** Extract the leading file path from a finding-shaped line, or null. */
export function findingPath(line: string): string | null {
  // path(line,col): …   (tsc / dotnet)
  const paren = line.match(/^([^\s():]+)\((\d+)(?:,\d+)?\)\s*:/);
  if (paren?.[1] !== undefined) return paren[1];
  // path:line[:col][:] …  or  path: …
  const colon = line.match(/^([^\s:]+):(?:\d+(?::\d+)?:?\s|\s)/);
  if (colon?.[1] !== undefined) return colon[1];
  return null;
}

/** Normalize a diff/finding path for comparison (strip leading ./). */
export function normalizePath(p: string): string {
  let out = p.replace(/\\/g, "/");
  while (out.startsWith("./")) out = out.slice(2);
  return out;
}

/** Parse `git diff --name-only` output into a scope set. */
export function parseChangedFiles(text: string): ReadonlySet<string> {
  const out = new Set<string>();
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (t !== "") out.add(normalizePath(t));
  }
  return out;
}

/**
 * Classify each line of linter output against the changed-file scope.
 * `knownPaths` (optional, e.g. full `git ls-files`) guards against prose
 * lines that merely LOOK path-shaped: when provided, a candidate path that is
 * in neither set is passthrough, not an out-of-scope finding.
 */
export function classifyLines(
  lines: readonly string[],
  changed: ReadonlySet<string>,
  knownPaths?: ReadonlySet<string>,
): readonly ScopedLine[] {
  return lines.map((raw) => {
    const candidate = findingPath(raw);
    if (candidate === null) return { raw, kind: "passthrough" as const };
    const path = normalizePath(candidate);
    if (changed.has(path)) return { raw, kind: "finding-in-scope" as const, path };
    if (knownPaths !== undefined && !knownPaths.has(path)) return { raw, kind: "passthrough" as const };
    return { raw, kind: "finding-out-of-scope" as const, path };
  });
}

export interface ScopedReport {
  readonly inScope: readonly ScopedLine[];
  readonly outOfScope: readonly ScopedLine[];
  readonly exitCode: 0 | 1;
  readonly summary: string;
}

export function scopedReport(
  linterOutput: string,
  changed: ReadonlySet<string>,
  knownPaths?: ReadonlySet<string>,
): ScopedReport {
  const classified = classifyLines(linterOutput.split("\n"), changed, knownPaths);
  const inScope = classified.filter((l) => l.kind === "finding-in-scope");
  const outOfScope = classified.filter((l) => l.kind === "finding-out-of-scope");
  const summary =
    `scoped-lint: ${String(inScope.length)} finding(s) in the PR's diff, ` +
    `${String(outOfScope.length)} out-of-scope (main's drift — the continuous detector owns those, ADR item 2)`;
  return { inScope, outOfScope, exitCode: inScope.length > 0 ? 1 : 0, summary };
}

// ---------------------------------------------------------------------------
// CLI edge
// ---------------------------------------------------------------------------

function parseArgs(argv: readonly string[]): { changedFile?: string; trackedFile?: string; error?: string } {
  const out: { changedFile?: string; trackedFile?: string; error?: string } = {};
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === "--changed" || flag === "--tracked") {
      const value = argv[++i];
      if (value === undefined) return { error: `${flag} requires a file argument` };
      if (flag === "--changed") out.changedFile = value;
      else out.trackedFile = value;
    } else {
      return { error: `unknown argument: ${flag ?? ""}` };
    }
  }
  if (out.changedFile === undefined) return { error: "missing required --changed <file>" };
  return out;
}

const invokedDirectly = typeof process.argv[1] === "string" && /scoped-lint\.(?:ts|js)$/.test(process.argv[1]);
if (invokedDirectly) {
  const args = parseArgs(process.argv.slice(2));
  if (args.error !== undefined || args.changedFile === undefined) {
    console.error(`scoped-lint: ${args.error ?? "missing --changed"}`);
    console.error("usage: <linter> 2>&1 | scoped-lint.ts --changed changed-files.txt [--tracked tracked-files.txt]");
    process.exit(2);
  }
  const changed = parseChangedFiles(readFileSync(args.changedFile, "utf8"));
  const tracked = args.trackedFile !== undefined ? parseChangedFiles(readFileSync(args.trackedFile, "utf8")) : undefined;
  const chunks: Buffer[] = [];
  process.stdin.on("data", (c: Buffer) => chunks.push(c));
  process.stdin.on("end", () => {
    const report = scopedReport(Buffer.concat(chunks).toString("utf8"), changed, tracked);
    for (const l of report.inScope) console.log(l.raw);
    if (report.outOfScope.length > 0) {
      console.log("--- out-of-scope (informational) ---");
      for (const l of report.outOfScope) console.log(l.raw);
    }
    console.log(report.summary);
    process.exit(report.exitCode);
  });
}
