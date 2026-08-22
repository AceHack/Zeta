#!/usr/bin/env bun
/**
 * 081KR2E4K0008QG0R001E27DDV / 081KRCQQF0008QG0R0037YYP1A: Reindex memory/MEMORY.md from the memory/ heap.
 *
 * Architectural fix for the MEMORY.md serialization-point
 * anti-pattern (081KRCQQF0008QG0R0037YYP1A). Reads frontmatter from every
 * memory/*.md file, regenerates MEMORY.md as an indexed
 * stack-view of the heap.
 *
 * The autonomous-loop can call this on each (or every N)
 * tick to keep MEMORY.md current at a higher cadence than
 * Anthropic's base AutoDream allows.
 *
 * Usage:
 *   bun src/Core.TypeScript/memory/reindex-memory-md.ts            # write MEMORY.md
 *   bun src/Core.TypeScript/memory/reindex-memory-md.ts --check    # dry-run; exit 2 if stale
 *
 * Heap-state-acceptable: memory files commit with frontmatter
 * but do NOT require synchronous MEMORY.md paired-edit. This
 * reindexer catches them up to the stack on cadence.
 *
 * ## Ordering
 *
 * Entries are sorted descending by the `created` YAML frontmatter
 * field (ISO date, e.g. `2026-05-14`). When `created` is absent the
 * date is extracted from the filename via the pattern YYYY-MM-DD or
 * YYYY_MM_DD; files with no parseable date sort to `0000-00-00` and
 * appear at the bottom. Ties between entries sharing the same date
 * are broken by lexicographic filename order (readdir order within a
 * date bucket).
 *
 * ## Formatting
 *
 * Each entry renders as a single Markdown list item:
 *
 *   - [**<name>**](<filename>) — <description>
 *
 * `name` comes from the `name` frontmatter field; falls back to the
 * filename stem when absent. `description` comes from the
 * `description` frontmatter field (truncated to 240 characters with
 * a trailing "…" when longer). The index is capped at
 * MAX_STACK_ENTRIES (100) most-recent entries; an overflow note is
 * appended when additional files exist.
 *
 * ## Stability
 *
 * Repeated runs with no source-file changes produce byte-for-byte
 * identical output ON ANY DAY: the "Last reindex" stamp is carried
 * forward from the existing file rather than read from the clock, so
 * the render is a pure function of the heap plus that stamp. The stamp
 * advances only when a write actually changes the index.
 * The `--check` flag exits 0 when the on-disk MEMORY.md matches the
 * generated output, 2 when stale — suitable for CI or loop health
 * checks.
 */

import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";

const MEMORY_DIR = "memory";
const INDEX_FILE = join(MEMORY_DIR, "MEMORY.md");
const PREAMBLE_MARKER = "<!-- BEGIN AUTO-INDEX (081KRCQQF0008QG0R0037YYP1A reindex-memory-md.ts) -->";
const PREAMBLE_END = "<!-- END AUTO-INDEX -->";

type FrontMatter = {
  name?: string;
  description?: string;
  type?: "user" | "feedback" | "project" | "reference" | string;
  created?: string;
};

type MemoryEntry = {
  filename: string;
  fm: FrontMatter;
  date: string;
  mtime: number;
};

function parseFrontmatter(content: string): FrontMatter | null {
  if (!content.startsWith("---")) return null;
  const end = content.indexOf("\n---", 3);
  if (end === -1) return null;
  const body = content.slice(3, end).trim();
  const fm: FrontMatter = {};

  const lines = body.split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? "";
    const match = line.match(/^([a-z_]+):\s*(.*)$/i);
    if (!match) {
      i++;
      continue;
    }
    const key = match[1]!;
    const rawVal = match[2] ?? "";
    let value = rawVal.trim();
    if (value === ">-" || value === ">" || value === "|") {
      const folded: string[] = [];
      i++;
      while (i < lines.length) {
        const foldedLine = lines[i];
        if (foldedLine === undefined || (!foldedLine.startsWith("  ") && foldedLine.trim() !== "")) {
          break;
        }
        folded.push(foldedLine.trim());
        i++;
      }
      value = folded.join(" ").trim();
      (fm as Record<string, string>)[key] = value;
      continue;
    }
    value = value.replace(/^['"]/, "").replace(/['"]$/, "");
    (fm as Record<string, string>)[key] = value;
    i++;
  }
  return fm;
}

function dateFromFilename(filename: string): string {
  const match = filename.match(/(\d{4})[_-](\d{2})[_-](\d{2})/);
  if (!match) return "0000-00-00";
  return `${match[1]}-${match[2]}-${match[3]}`;
}

async function collectEntriesRecursive(
  baseDir: string,
  currentDir: string,
  entries: MemoryEntry[],
): Promise<void> {
  const items = await readdir(currentDir, { withFileTypes: true });
  for (const item of items) {
    const itemPath = join(currentDir, item.name);
    if (item.isDirectory()) {
      await collectEntriesRecursive(baseDir, itemPath, entries);
      continue;
    }
    if (!item.name.endsWith(".md")) continue;
    if (item.name === "MEMORY.md" || item.name === "README.md") continue;
    if (item.name.startsWith("CURRENT-")) continue;
    const content = await readFile(itemPath, "utf8");
    const fm = parseFrontmatter(content);
    if (!fm) continue;
    // Use path relative to baseDir so subdirectory files appear as
    // "observed-phenomena/file.md" — correct both as link target in
    // MEMORY.md (relative to memory/) and as parity-validator key.
    const filename = relative(baseDir, itemPath).replace(/\\/g, "/");
    const date = fm.created || dateFromFilename(item.name);
    entries.push({ filename, fm, date, mtime: 0 });
  }
}

async function collectEntries(dir?: string): Promise<MemoryEntry[]> {
  const targetDir = dir ?? MEMORY_DIR;
  const entries: MemoryEntry[] = [];
  await collectEntriesRecursive(targetDir, targetDir, entries);
  entries.sort((a, b) => {
    const dateCmp = b.date.localeCompare(a.date);
    return dateCmp !== 0 ? dateCmp : a.filename.localeCompare(b.filename);
  });
  return entries;
}

function truncateDescription(desc: string, maxLen = 240): string {
  if (desc.length <= maxLen) return desc;
  return desc.slice(0, maxLen - 1).trimEnd() + "…";
}

function formatEntry(e: MemoryEntry): string {
  const name = e.fm.name ?? e.filename.replace(/\.md$/, "");
  const desc = truncateDescription(e.fm.description ?? "(no description)");
  return `- [**${name}**](${e.filename}) — ${desc}`;
}

const MAX_STACK_ENTRIES = 100;

/**
 * `reindexDate` carries the "Last reindex" stamp forward from the existing file.
 *
 * WHY IT IS A PARAMETER AND NOT `new Date()`. This function used to read the wall
 * clock directly, and `--check` compares its whole output against the file on disk.
 * So on any calendar day after the last reindex the comparison differed by exactly
 * one character group -- the date -- and the check went red claiming INDEX DRIFT
 * while the index had not drifted at all. The workflow triggers on `memory/**`, so
 * that was a red on any memory-touching PR, daily, forever, with a remediation
 * commit that bumped a date string and verified nothing (081M0DY68KN087G0R002MQ1BDR,
 * observed on PR #12537 against an edit to a file the index does not even contain).
 *
 * A check that cries wolf daily is a check nobody reads, and that is the actual
 * damage: it trains contributors to regenerate reflexively on a red they have
 * learned is meaningless, which is the condition under which a REAL index drift
 * gets waved through.
 *
 * The caller passes the date already in the file, which makes this render a pure
 * function of (heap content, existing stamp) -- so an unchanged heap reproduces the
 * file byte-for-byte on any day, and `--check` measures index drift and nothing
 * else. The stamp advances only when the index genuinely changed, which is what it
 * always claimed to mean. Same trick the AutoDream marker already used one line
 * below, for the same reason.
 *
 * `.claude/rules/local-time-never-enters-the-shared-fold.md`: the ambient clock is
 * local, the generated index is the shared conclusion, and the two must not cross.
 */
function renderIndex(entries: MemoryEntry[], autoDreamMarker?: string, reindexDate?: string): string {
  const now = reindexDate ?? new Date().toISOString().slice(0, 10);
  const lines: string[] = [];
  lines.push(autoDreamMarker ?? "[AutoDream last run: 2026-04-23]");
  lines.push("");
  lines.push(
    "**📌 Fast path: read `CURRENT-aaron.md`, `CURRENT-amara.md`, " +
      "`CURRENT-ani.md`, `CURRENT-vera.md`, `CURRENT-riven.md`, " +
      "and `CURRENT-otto.md` first.**",
  );
  lines.push("");
  lines.push(
    "> **Stack-vs-heap framing (Aaron 2026-05-12):** This file is the " +
      "**STACK** — indexed, ordered, traversable canonical view. Recent " +
      "memory files in `memory/` with timestamps newer than the most-" +
      "current entries here may be **HEAP** — floating cache, not yet " +
      "indexed, accessible by direct path. Both are easily accessible: " +
      "stack via traversal, heap via timestamp/filename. Indexing " +
      "(heap→stack promotion) happens on cadence via " +
      "`src/Core.TypeScript/memory/reindex-memory-md.ts` (081KRCQQF0008QG0R0037YYP1A), callable from the " +
      "autonomous-loop tick. Last reindex: " + now + ".",
  );
  lines.push("");
  lines.push(PREAMBLE_MARKER);
  lines.push("");
  const stackEntries = entries.slice(0, MAX_STACK_ENTRIES);
  for (const e of stackEntries) {
    lines.push(formatEntry(e));
  }
  if (entries.length > MAX_STACK_ENTRIES) {
    lines.push("");
    lines.push(
      `_Stack truncated at ${MAX_STACK_ENTRIES} most-recent entries. ` +
        `${entries.length - MAX_STACK_ENTRIES} additional memory files in heap — ` +
        "browse `memory/**/*.md` directly by filename/timestamp (recursive: includes `memory/<persona>/<ai>/conversations/*.md` and other subdirectory heaps)._",
    );
  }
  lines.push(PREAMBLE_END);
  lines.push("");
  return lines.join("\n");
}

async function main() {
  const check = process.argv.includes("--check");
  const entries = await collectEntries();

  // Read existing MEMORY.md once: used for AutoDream marker preservation
  // and for the --check comparison. Preserving the marker prevents the
  // reindexer from resetting a date that AutoDream wrote more recently.
  const existing = await readFile(INDEX_FILE, "utf8").catch(() => "");
  const markerLine = existing.match(/^\[AutoDream last run: [^\]]+\]/m)?.[0];
  const existingDate = existing.match(/Last reindex: (\d{4}-\d{2}-\d{2})\./)?.[1];

  // Render against the stamp ALREADY in the file. Any difference that survives is
  // therefore real index drift, not the calendar advancing underneath us.
  const rendered = renderIndex(entries, markerLine, existingDate);
  const same = existing.trim() === rendered.trim();

  if (check) {
    console.log(`Entries: ${entries.length}. Index ${same ? "current" : "STALE"}.`);
    if (!same) process.exit(2);
    return;
  }

  // Only a write that actually changes the index advances the stamp, so "Last
  // reindex" means what it says instead of "last time anyone ran this".
  await writeFile(INDEX_FILE, same ? rendered : renderIndex(entries, markerLine));
  console.log(`Reindexed ${entries.length} memory files into ${INDEX_FILE}.`);
}

if (import.meta.main) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

export { collectEntries, renderIndex, parseFrontmatter, PREAMBLE_MARKER, PREAMBLE_END, MAX_STACK_ENTRIES };
