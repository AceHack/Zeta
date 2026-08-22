#!/usr/bin/env bun
// audit-missing-prevention-layers.ts — meta-hygiene audit.
//
// TypeScript+Bun port of audit-missing-prevention-layers.sh, slice 5
// of the TS+Bun migration. See docs/best-practices/repo-scripting.md.
//
// What this does:
//   For every row in docs/FACTORY-HYGIENE.md's main table, looks up
//   the row's classification in docs/hygiene-history/prevention-
//   layer-classification.md (or override via --classify FILE), and
//   surfaces unclassified + gap rows.
//
// Usage:
//   bun tools/hygiene/audit-missing-prevention-layers.ts
//   bun tools/hygiene/audit-missing-prevention-layers.ts --classify FILE
//
// Exit codes:
//   0   all rows classified, no gap rows
//   1   usage error
//   2   one or more rows lack classification OR are detection-only-gap

import { readFileSync } from "node:fs";
import {
  spawnSync,
  type SpawnSyncReturns,
} from "node:child_process";

type AuditExitCode = 0 | 1 | 2;

interface Args {
  readonly classificationFile: string;
}

type ParseResult =
  | { readonly kind: "args"; readonly args: Args }
  | { readonly kind: "help" }
  | { readonly kind: "error"; readonly message: string };

interface HygieneRow {
  readonly num: string;
  readonly title: string;
}

interface ClassificationEntry {
  readonly num: string;
  readonly label: string;
}

interface AuditResult {
  readonly rows: readonly HygieneRow[];
  readonly classifications: ReadonlyMap<string, string>;
  readonly unclassified: readonly HygieneRow[];
  readonly gaps: readonly HygieneRow[];
  readonly okCount: number;
}

const SPAWN_MAX_BUFFER = 64 * 1024 * 1024;
const HYGIENE_FILE = "docs/FACTORY-HYGIENE.md";
const DEFAULT_CLASSIFICATION_FILE = "docs/hygiene-history/prevention-layer-classification.md";
const ROW_RE = /^\| {1,3}\d+ {1,3}\|/;

function trimSpaces(s: string): string {
  // Match bash awk's `sub(/^ +/, ""); sub(/ +$/, "")`. Bounded by
  // line length; not slow-regex.
  let i = 0;
  while (i < s.length && s[i] === " ") i += 1;
  let j = s.length;
  while (j > i && s[j - 1] === " ") j -= 1;
  return s.slice(i, j);
}

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
  const failure = classifyFailure("git", ["rev-parse"], result);
  if (failure !== null) throw new Error(failure);
  return result.stdout.trim();
}

function parseArgs(argv: readonly string[]): ParseResult {
  let classificationFile = DEFAULT_CLASSIFICATION_FILE;
  let i = 0;
  while (i < argv.length) {
    const arg = argv[i] ?? "";
    if (arg === "-h" || arg === "--help") return { kind: "help" };
    if (arg === "--classify") {
      const v = argv[i + 1];
      if (v === undefined || v === "") {
        return { kind: "error", message: "error: --classify requires a file path" };
      }
      classificationFile = v;
      i += 2;
      continue;
    }
    return { kind: "error", message: `error: unknown arg: ${arg}` };
  }
  return { kind: "args", args: { classificationFile } };
}

// Bash extracts rows from FACTORY-HYGIENE.md with an awk script:
// only rows after `^## The list` and before `^## Ships to project-under-construction`,
// matching `^| NN |` lines, taking col 2 (num) and col 3 (title).
function extractHygieneRows(content: string): readonly HygieneRow[] {
  const rows: HygieneRow[] = [];
  let inMain = false;
  for (const line of content.split("\n")) {
    if (line.startsWith("## Ships to project-under-construction")) {
      inMain = false;
      continue;
    }
    if (line.startsWith("## The list")) {
      inMain = true;
      continue;
    }
    if (!inMain) continue;
    if (!ROW_RE.test(line)) continue;
    const cols = line.split("|");
    const num = (cols[1] ?? "").replace(/ /g, "");
    const title = trimSpaces(cols[2] ?? "");
    rows.push({ num, title });
  }
  return rows;
}

// Classification file uses the same `| NN | ... | label | ...` shape;
// bash takes col 2 as num and col 4 as label.
function extractClassifications(content: string): readonly ClassificationEntry[] {
  const out: ClassificationEntry[] = [];
  for (const line of content.split("\n")) {
    if (!ROW_RE.test(line)) continue;
    const cols = line.split("|");
    const num = (cols[1] ?? "").replace(/ /g, "");
    const label = trimSpaces(cols[3] ?? "");
    out.push({ num, label });
  }
  return out;
}

function audit(args: Args, root: string): AuditResult | { error: string } {
  const hygienePath = `${root}/${HYGIENE_FILE}`;
  let hygieneContent: string;
  try {
    hygieneContent = readFileSync(hygienePath, "utf8");
  } catch {
    return { error: `error: ${HYGIENE_FILE} not found` };
  }
  const rows = extractHygieneRows(hygieneContent);

  const classMap = new Map<string, string>();
  let classContent: string;
  try {
    classContent = readFileSync(`${root}/${args.classificationFile}`, "utf8");
  } catch {
    classContent = "";
  }
  if (classContent !== "") {
    for (const e of extractClassifications(classContent)) {
      classMap.set(e.num, e.label);
    }
  }

  const unclassified: HygieneRow[] = [];
  const gaps: HygieneRow[] = [];
  let okCount = 0;
  for (const r of rows) {
    const label = classMap.get(r.num);
    if (label === undefined || label === "") unclassified.push(r);
    else if (label.includes("detection-only (gap)")) gaps.push(r);
    else okCount += 1;
  }

  return { rows, classifications: classMap, unclassified, gaps, okCount };
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n);
}

function emitReport(args: Args, r: AuditResult): string {
  const now = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const lines: string[] = [];
  lines.push("# Missing prevention-layer audit");
  lines.push("");
  lines.push(`Run: ${now}`);
  lines.push(`Classification source: ${args.classificationFile}`);
  lines.push("");
  lines.push("## Matrix");
  lines.push("");
  lines.push("| Row # | Hygiene item | Classification |");
  lines.push("|---|---|---|");
  for (const row of r.rows) {
    const stored = r.classifications.get(row.num);
    const label = stored === undefined || stored === "" ? "**unclassified**" : stored;
    lines.push(`| ${row.num} | ${truncate(row.title, 80)} | ${label} |`);
  }
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- prevention-bearing or detection-only-justified: ${String(r.okCount)}`);
  lines.push(`- detection-only-gap (prevention could exist but does not): ${String(r.gaps.length)}`);
  lines.push(`- unclassified (no entry in classification file): ${String(r.unclassified.length)}`);
  if (r.unclassified.length > 0) {
    lines.push("");
    lines.push("## Unclassified rows (fill in classification file)");
    for (const row of r.unclassified) lines.push(`- ${row.num} — ${row.title}`);
  }
  if (r.gaps.length > 0) {
    lines.push("");
    lines.push("## Gap rows (prevention layer candidate)");
    for (const row of r.gaps) lines.push(`- ${row.num} — ${row.title}`);
    lines.push("");
    lines.push("Each gap row is a candidate for an author-time / commit-time /");
    lines.push("trigger-time prevention layer. Design ROI — prevention is");
    lines.push("cheaper than detection + fix per violation × violation-rate.");
  }
  return lines.join("\n");
}

export function main(argv: readonly string[]): AuditExitCode {
  const parsed = parseArgs(argv);
  if (parsed.kind === "help") {
    process.stdout.write(
      "Usage: audit-missing-prevention-layers.ts [--classify FILE]\n",
    );
    return 0;
  }
  if (parsed.kind === "error") {
    process.stderr.write(`${parsed.message}\n`);
    return 1;
  }
  const root = repoRoot();
  const r = audit(parsed.args, root);
  if ("error" in r) {
    process.stderr.write(`${r.error}\n`);
    return 1;
  }
  process.stdout.write(`${emitReport(parsed.args, r)}\n`);
  if (r.unclassified.length > 0 || r.gaps.length > 0) return 2;
  return 0;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
