#!/usr/bin/env bun
// generate-index.ts — regenerate docs/BACKLOG.md from legacy B-row files
// at docs/backlog/P<tier>/B-<NNNN>-<slug>.md.
// New work belongs in workitems/<zetaid>-<slug>.md via new-workitem.ts.
//
// TypeScript+Bun port of generate-index.sh, slice 12 of the TS+Bun
// migration. See docs/best-practices/repo-scripting.md.
//
// Walks the legacy per-row files, parses YAML frontmatter, emits a
// short pointer index sorted by (priority, id).
//
// Usage:
//   bun src/Core.TypeScript/backlog/generate-index.ts              # writes docs/BACKLOG.md
//   bun src/Core.TypeScript/backlog/generate-index.ts --check      # exit 2 if drift vs committed
//   bun src/Core.TypeScript/backlog/generate-index.ts --stdout     # print to stdout, no write
//
// Exit codes:
//   0  success
//   1  environment / dependency error
//   2  drift detected (--check mode only)

import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { spawnSync } from "node:child_process";

type ExitCode = 0 | 1 | 2;
type Mode = "write" | "check" | "stdout";

const SPAWN_MAX_BUFFER = 64 * 1024 * 1024;

const TIERS: readonly string[] = ["P0", "P1", "P2", "P3"];

const TIER_LABELS: Record<string, string> = {
  P0: "## P0 — critical / blocking",
  P1: "## P1 — within 2-3 rounds",
  P2: "## P2 — research-grade",
  P3: "## P3 — convenience / deferred",
};

function repoRoot(): string {
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  const result = spawnSync("git", ["rev-parse", "--show-toplevel"], {
    encoding: "utf8",
    maxBuffer: SPAWN_MAX_BUFFER,
  });
  if (result.status !== 0) return process.cwd();
  return result.stdout.trim();
}

function parseMode(argv: readonly string[]): Mode | null {
  if (argv.length === 0) return "write";
  const arg = argv[0];
  if (arg === "--check") return "check";
  if (arg === "--stdout") return "stdout";
  return null;
}

function trimSpaceTab(s: string): string {
  let start = 0;
  while (start < s.length) {
    const c = s.charCodeAt(start);
    if (c !== 0x20 && c !== 0x09) break;
    start++;
  }
  let end = s.length;
  while (end > start) {
    const c = s.charCodeAt(end - 1);
    if (c !== 0x20 && c !== 0x09) break;
    end--;
  }
  return s.slice(start, end);
}

function stripQuotes(s: string): string {
  // Mirror bash awk: gsub of /^"|"$|^[[:space:]]*'|'[[:space:]]*$/ removes
  // a single leading " or ' (with optional leading whitespace) and same trailing.
  let out = s;
  const startsWithDouble = out.startsWith('"');
  const trimmedStart = trimSpaceTab(out);
  const startsWithSingle = trimmedStart.startsWith("'");
  if (startsWithDouble) out = out.slice(1);
  else if (startsWithSingle) out = trimmedStart.slice(1);
  if (out.endsWith('"')) out = out.slice(0, -1);
  else {
    const trimmedEnd = trimSpaceTab(out);
    if (trimmedEnd.endsWith("'")) out = trimmedEnd.slice(0, -1);
  }
  return trimSpaceTab(out);
}

function extractField(content: string, field: string): string {
  // Bash awk: read FIRST YAML frontmatter block (between two `---`),
  // find first line where $1 == "field:", strip the field prefix +
  // quotes, return value.
  const lines = content.split("\n");
  let inside = false;
  for (const line of lines) {
    if (line === "---") {
      if (!inside) {
        inside = true;
        continue;
      }
      break;
    }
    if (!inside) continue;
    const prefix = `${field}:`;
    if (!line.startsWith(prefix)) continue;
    return stripQuotes(trimSpaceTab(line.slice(prefix.length)));
  }
  return "";
}

function listBacklogFiles(tierDir: string): readonly string[] {
  let entries: readonly import("node:fs").Dirent[];
  try {
    entries = readdirSync(tierDir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const e of entries) {
    if (!e.isFile()) continue;
    if (!e.name.endsWith(".md")) continue; // accept all .md files (zetaid or legacy B-)
    out.push(join(tierDir, e.name));
  }
  // DECLARED SORT FIELD: identity, NOT time (see zeta-id/sort-key.ts). This site
  // needs a stable total order so the generated index has reproducible bytes; it
  // makes no claim about creation order, and it stays correct for any future id
  // version or layout. `localeCompare` was culture-SENSITIVE (the PR #10381 bug
  // class) and this directory deliberately mixes ZetaId- and legacy `B-`-prefixed
  // names, so the collation is not decorative — ordinal codepoint order it is.
  return out.sort((a, b) => {
    const x = basename(a);
    const y = basename(b);
    return x < y ? -1 : x > y ? 1 : 0;
  });
}

function checkboxFor(status: string): "[x]" | "[ ]" {
  if (status === "closed") return "[x]";
  if (status === "done") return "[x]";
  if (status.startsWith("superseded-by-")) return "[x]";
  // open / deferred / decomposed all render as unchecked (still open)
  return "[ ]";
}

function generateContent(backlogDir: string): string {
  const out: string[] = [];
  out.push("# Legacy Backlog Index");
  out.push("");
  out.push("<!-- AUTO-GENERATED by src/Core.TypeScript/backlog/generate-index.ts.");
  out.push("     Do NOT edit this file directly. Edit the legacy B-row file");
  out.push("     under docs/backlog/P<tier>/B-<NNNN>-<slug>.md and");
  out.push("     regenerate. -->");
  out.push("");
  out.push("_Each entry below is a grandfathered legacy B-row under");
  out.push("`docs/backlog/`. New work-items are ZetaId-keyed files under");
  out.push("`workitems/`. Entries with `- [ ]` are open; `- [x]`");
  out.push("are closed (status: closed/done in frontmatter)._");
  // No explicit blank line here: the per-tier loop below pushes its
  // own leading "" before each section label, which (after
  // `out.join("\n")`) produces exactly one blank line between the
  // frontmatter prose and the first section header. Adding another
  // "" here would produce two blank lines and drift from
  // `tools/backlog/generate-index.sh`'s canonical output (the .sh
  // emits the HEADER heredoc → trailing newline only, then the tier
  // loop's `echo ""` is the single separator).
  // backlog-index-integrity.yml runs the .sh; this matches it.

  for (const tier of TIERS) {
    const tierDir = join(backlogDir, tier);
    if (!isDirectory(tierDir)) continue;
    const files = listBacklogFiles(tierDir);
    if (files.length === 0) continue;
    out.push("");
    out.push(TIER_LABELS[tier] ?? "");
    out.push("");
    for (const file of files) {
      let content: string;
      try {
        content = readFileSync(file, "utf8");
      } catch {
        continue;
      }
      const id = extractField(content, "id");
      const status = extractField(content, "status");
      const title = extractField(content, "title");
      const linkPath = `backlog/${tier}/${basename(file)}`;
      const checkbox = checkboxFor(status);
      out.push(`- ${checkbox} **[${id}](${linkPath})** ${title}`);
    }
  }

  out.push("");
  out.push("<!-- END AUTO-GENERATED -->");
  out.push("");
  return out.join("\n");
}

function fileExists(path: string): boolean {
  try {
    statSync(path);
    return true;
  } catch {
    return false;
  }
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function readLineCount(path: string): number {
  try {
    return readFileSync(path, "utf8").split("\n").length;
  } catch {
    return 0;
  }
}

function emitWriteRefuse(indexPath: string): ExitCode {
  process.stderr.write("generate-index.ts: refusing to overwrite existing\n");
  process.stderr.write(`${indexPath} — file has substantial content\n`);
  process.stderr.write("(Phase-1a guard). Phase 2 content-migration PR should\n");
  process.stderr.write("set BACKLOG_WRITE_FORCE=1 to authorize the overwrite\n");
  process.stderr.write("once legacy B-row files have been populated.\n");
  process.stderr.write("\n");
  process.stderr.write("Use --stdout to preview, --check to compare against\n");
  process.stderr.write("committed, or set BACKLOG_WRITE_FORCE=1 to force.\n");
  return 1;
}

function emitCheckDrift(content: string, indexPath: string): ExitCode {
  if (!fileExists(indexPath)) {
    process.stderr.write(`drift: ${indexPath} does not exist\n`);
    return 2;
  }
  const existing = readFileSync(indexPath, "utf8");
  if (existing === content) {
    process.stdout.write(`ok: ${indexPath} matches generator output\n`);
    return 0;
  }
  process.stderr.write(`drift: ${indexPath} differs from generator output\n`);
  process.stderr.write("diff:\n");
  // Best-effort line-level diff (no shell `diff` invocation).
  const aLines = content.split("\n");
  const bLines = existing.split("\n");
  const maxLen = Math.max(aLines.length, bLines.length);
  for (let i = 0; i < maxLen; i++) {
    if ((aLines[i] ?? "") === (bLines[i] ?? "")) continue;
    if (aLines[i] !== undefined) process.stderr.write(`< ${aLines[i] ?? ""}\n`);
    if (bLines[i] !== undefined) process.stderr.write(`> ${bLines[i] ?? ""}\n`);
  }
  return 2;
}

function emitWrite(content: string, indexPath: string): ExitCode {
  if (fileExists(indexPath) && process.env.BACKLOG_WRITE_FORCE !== "1") {
    const lineCount = readLineCount(indexPath);
    if (lineCount > 50) return emitWriteRefuse(indexPath);
  }
  writeFileSync(indexPath, content);
  process.stdout.write(`wrote ${indexPath}\n`);
  return 0;
}

export function main(argv: readonly string[]): ExitCode {
  const mode = parseMode(argv);
  if (mode === null) {
    const arg = argv[0] ?? "";
    process.stderr.write(`unknown arg: ${arg}\n`);
    return 1;
  }

  const root = repoRoot();
  const backlogDir = join(root, "docs", "backlog");
  const indexPath = join(root, "docs", "BACKLOG.md");

  const content = generateContent(backlogDir);

  if (mode === "stdout") {
    process.stdout.write(content);
    return 0;
  }
  if (mode === "check") return emitCheckDrift(content, indexPath);
  return emitWrite(content, indexPath);
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
