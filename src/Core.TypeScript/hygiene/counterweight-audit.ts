#!/usr/bin/env bun
// counterweight-audit.ts — cadenced counterweight-memory audit (Otto-278).
//
// TypeScript+Bun port of counterweight-audit.sh, slice 10 of the
// TS+Bun migration. See docs/best-practices/repo-scripting.md.
//
// Memory-only counterweights are leaky without a cadenced audit that
// FORCES re-reading the memories + checks for rule-drift.
//
// Quote extraction from the file body is deliberately NOT automated —
// the audit's point is forcing the agent to open each file and read
// it. Auto-extracting the quote into the audit output would let the
// agent skim the questions without opening the file.
//
// Usage:
//   bun tools/hygiene/counterweight-audit.ts [--cadence quick|medium|long] [--count N]
//
// Exit codes:
//   0  normal completion
//   2  usage error (unknown flag, missing value, invalid cadence, etc.)

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

type ExitCode = 0 | 2;
type Cadence = "quick" | "medium" | "long";

const SPAWN_MAX_BUFFER = 64 * 1024 * 1024;

const NON_NEG_INT_RE = /^\d+$/;
const OTTO_ID_RE = /otto_(\d+)/;
const NAME_FIELD_PREFIX = "name:";

interface ParsedArgs {
  readonly cadence: Cadence;
  readonly count: number;
}

interface ArgParseResult {
  readonly args: ParsedArgs | null;
  readonly errorMessage: string;
  readonly help: boolean;
}

function emitUsageError(message: string): ExitCode {
  process.stderr.write(`error: ${message}\n`);
  process.stderr.write("run with --help for usage\n");
  return 2;
}

function emitHelp(): void {
  process.stdout.write("Usage:\n");
  process.stdout.write(
    "  bun tools/hygiene/counterweight-audit.ts [--cadence quick|medium|long] [--count N]\n",
  );
  process.stdout.write("\n");
  process.stdout.write("  --cadence quick   Top N most recently-modified counterweights only (default).\n");
  process.stdout.write("  --cadence medium  Last 10 counterweights.\n");
  process.stdout.write("  --cadence long    All counterweights, full re-read.\n");
  process.stdout.write("  --count N         Override the per-cadence count (default 3 for quick,\n");
  process.stdout.write("                    10 for medium, unbounded for long).\n");
}

function defaultCount(cadence: Cadence): number {
  if (cadence === "quick") return 3;
  if (cadence === "medium") return 10;
  return 0;
}

type ArgStep =
  | { readonly kind: "set-cadence"; readonly cadence: Cadence; readonly skip: 1 }
  | { readonly kind: "set-count"; readonly raw: string; readonly skip: 1 }
  | { readonly kind: "help" }
  | { readonly kind: "error"; readonly message: string };

function classifyArg(arg: string, next: string | undefined): ArgStep {
  if (arg === "--cadence") {
    if (next === undefined) return { kind: "error", message: "--cadence requires a value" };
    if (next !== "quick" && next !== "medium" && next !== "long") {
      return {
        kind: "error",
        message: `--cadence must be quick|medium|long (got '${next}')`,
      };
    }
    return { kind: "set-cadence", cadence: next, skip: 1 };
  }
  if (arg === "--count") {
    if (next === undefined) return { kind: "error", message: "--count requires a value" };
    return { kind: "set-count", raw: next, skip: 1 };
  }
  if (arg === "-h" || arg === "--help") return { kind: "help" };
  return { kind: "error", message: `unknown argument '${arg}'` };
}

function parseArgs(argv: readonly string[]): ArgParseResult {
  let cadence: Cadence = "quick";
  let countRaw = "";

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] ?? "";
    const step = classifyArg(arg, argv[i + 1]);
    if (step.kind === "help") return { args: null, errorMessage: "", help: true };
    if (step.kind === "error") {
      return { args: null, errorMessage: step.message, help: false };
    }
    if (step.kind === "set-cadence") cadence = step.cadence;
    else countRaw = step.raw;
    i += step.skip;
  }

  if (countRaw !== "" && !NON_NEG_INT_RE.test(countRaw)) {
    return {
      args: null,
      errorMessage: `--count must be a non-negative integer (got '${countRaw}')`,
      help: false,
    };
  }
  const count = countRaw === "" ? defaultCount(cadence) : Number.parseInt(countRaw, 10);
  return { args: { cadence, count }, errorMessage: "", help: false };
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function repoRoot(): string {
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  const result = spawnSync("git", ["rev-parse", "--show-toplevel"], {
    encoding: "utf8",
    maxBuffer: SPAWN_MAX_BUFFER,
  });
  if (result.status !== 0) return process.cwd();
  return result.stdout.trim();
}

interface Counterweight {
  readonly file: string;
  readonly mtimeMs: number;
}

function listCounterweights(memoryDir: string): readonly Counterweight[] {
  let entries: readonly import("node:fs").Dirent[];
  try {
    entries = readdirSync(memoryDir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out: Counterweight[] = [];
  for (const e of entries) {
    if (!e.isFile()) continue;
    if (!e.name.includes("otto_")) continue;
    if (!e.name.endsWith(".md")) continue;
    const file = join(memoryDir, e.name);
    try {
      const stats = statSync(file);
      out.push({ file, mtimeMs: stats.mtimeMs });
    } catch {
      continue;
    }
  }
  return out.sort((a, b) => b.mtimeMs - a.mtimeMs);
}

function extractOttoId(filename: string): string {
  const m = OTTO_ID_RE.exec(filename);
  if (m === null) return "(no Otto-ID in filename)";
  return `Otto-${m[1] ?? ""}`;
}

function isFenceLine(line: string): boolean {
  // Match `^---\s*$` without regex — manual char walk to avoid
  // sonarjs slow-regex flag.
  if (!line.startsWith("---")) return false;
  for (let i = 3; i < line.length; i++) {
    const c = line.charCodeAt(i);
    if (c !== 0x20 && c !== 0x09) return false;
  }
  return true;
}

function nameValueOrNull(line: string): string | null {
  if (!line.startsWith(NAME_FIELD_PREFIX)) return null;
  let i = NAME_FIELD_PREFIX.length;
  while (i < line.length) {
    const c = line.charCodeAt(i);
    if (c !== 0x20 && c !== 0x09) break;
    i++;
  }
  return line.slice(i);
}

function extractNameField(content: string): string {
  // Find the `name:` field within the FIRST YAML frontmatter fence
  // (between the first two `---` lines). Mirror bash awk behaviour.
  const lines = content.split("\n");
  let inFence = false;
  for (const line of lines) {
    if (isFenceLine(line)) {
      inFence = !inFence;
      continue;
    }
    if (!inFence) continue;
    const value = nameValueOrNull(line);
    if (value !== null) return value;
  }
  return "";
}

function readNameField(file: string): string {
  let content: string;
  try {
    content = readFileSync(file, "utf8");
  } catch {
    return "(no name field)";
  }
  const value = extractNameField(content);
  return value === "" ? "(no name field)" : value;
}

function relativize(file: string, root: string): string {
  const prefix = `${root}/`;
  return file.startsWith(prefix) ? file.slice(prefix.length) : file;
}

function emitHeader(cadence: Cadence, shown: number, total: number): void {
  process.stdout.write(`# Counterweight audit — ${cadence} cadence\n`);
  process.stdout.write("\n");
  process.stdout.write(
    `Reading ${String(shown)} of ${String(total)} counterweight memories under\n`,
  );
  process.stdout.write("`memory/*otto_*.md` (newest first). For each one, open\n");
  process.stdout.write("the file and read the rule body + maintainer quote, then\n");
  process.stdout.write("answer the per-counterweight audit questions below.\n");
  process.stdout.write("\n");
  process.stdout.write("_Tool: `tools/hygiene/counterweight-audit.sh` (Otto-278\n");
  process.stdout.write("cadenced-inspect Phase 1). Agent self-scores; no automatic\n");
  process.stdout.write("drift detection — the point is forcing the re-read._\n");
  process.stdout.write("\n");
}

function emitCounterweight(
  ottoId: string,
  rel: string,
  nameLine: string,
): void {
  process.stdout.write("---\n");
  process.stdout.write("\n");
  process.stdout.write(`## ${ottoId} — [\`${rel}\`](${rel})\n`);
  process.stdout.write("\n");
  process.stdout.write(`**Rule (from \`name:\`):** ${nameLine}\n`);
  process.stdout.write("\n");
  process.stdout.write("**Audit questions:**\n");
  process.stdout.write("\n");
  process.stdout.write("1. In the last N ticks, did I exhibit the drift\n");
  process.stdout.write("   this counter was filed for?\n");
  process.stdout.write("2. If yes: is the right move to tighten THIS\n");
  process.stdout.write("   counterweight (edit the memory), file a NEW\n");
  process.stdout.write("   tighter counterweight (like Otto-276 → Otto-277),\n");
  process.stdout.write("   or escalate to a skill / BP rule?\n");
  process.stdout.write("3. Is the counter still needed at this cadence,\n");
  process.stdout.write("   or can maintenance cadence stretch?\n");
  process.stdout.write("\n");
}

function emitFooter(): void {
  process.stdout.write("---\n");
  process.stdout.write("\n");
  process.stdout.write("## After the re-read\n");
  process.stdout.write("\n");
  process.stdout.write("Summary to log (if any drift was found):\n");
  process.stdout.write("\n");
  process.stdout.write("- Which counterweights drifted? (list Otto IDs)\n");
  process.stdout.write("- What's the next cadence for each?\n");
  process.stdout.write("- Did any counterweight get a follow-up memory or\n");
  process.stdout.write("  BACKLOG row out of this audit?\n");
  process.stdout.write("\n");
  process.stdout.write('If nothing drifted, log a "clean tick" short note:\n');
  process.stdout.write("the audit's signal value is as much in confirming\n");
  process.stdout.write("stability as in catching drift.\n");
}

export function main(argv: readonly string[]): ExitCode {
  const parsed = parseArgs(argv);
  if (parsed.help) {
    emitHelp();
    return 0;
  }
  if (parsed.args === null) return emitUsageError(parsed.errorMessage);
  const { cadence, count } = parsed.args;

  const root = repoRoot();
  const memoryDir = join(root, "memory");

  if (!isDirectory(memoryDir)) {
    return emitUsageError(
      `memory/ not found at ${memoryDir} (run from a Zeta checkout)`,
    );
  }

  const all = listCounterweights(memoryDir);
  const total = all.length;
  const shown = count > 0 && count < total ? count : total;

  emitHeader(cadence, shown, total);

  for (let i = 0; i < shown; i++) {
    const cw = all[i];
    if (cw === undefined) continue;
    const ottoId = extractOttoId(cw.file);
    const rel = relativize(cw.file, root);
    const nameLine = readNameField(cw.file);
    emitCounterweight(ottoId, rel, nameLine);
  }

  emitFooter();
  return 0;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
