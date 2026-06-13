#!/usr/bin/env bun
/**
 * B-0260: MEMORY.md cutover parity validator.
 *
 * Verifies that every file referenced in the old hand-curated index
 * fragments (INDEX-PRE-2026-04-23.md, INDEX-POST-LINE-200.md) is still
 * discoverable after the cutover to the generated index produced by
 * reindex-memory-md.ts (B-0258/B-0423).
 *
 * A file is "covered" when it exists in memory/ AND has valid YAML
 * frontmatter (so the reindexer picks it up, placing it in the
 * generated stack or heap).
 *
 * A file is a COVERAGE GAP when it exists but has NO frontmatter
 * (excluded by the reindexer).
 *
 * A file is MISSING when the path referenced in the old INDEX does
 * not exist at all.
 *
 * Usage:
 *   bun tools/memory/validate-memory-parity.ts
 *   bun tools/memory/validate-memory-parity.ts --json
 *   bun tools/memory/validate-memory-parity.ts --exit-on-loss
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { collectEntries } from "./reindex-memory-md.ts";

const MEMORY_DIR = "memory";
const OLD_INDEX_FILES = [
  "INDEX-PRE-2026-04-23.md",
  "INDEX-POST-LINE-200.md",
];

// Non-memory repo paths whose links should not be validated as memory files
const SKIP_PREFIXES = ["docs/", "tools/", ".github/", "src/"];

/** Extract all .md link targets from markdown link syntax: (...path/to/file.md) */
function extractLinkedFilenames(content: string): string[] {
  // Allow path separators so sub-directory links like ](subdir/file.md) are captured
  const pattern = /\(([a-zA-Z0-9_\-\.\/]+\.md)\)/g;
  const results: string[] = [];
  for (const m of content.matchAll(pattern)) {
    const captured = m[1];
    if (captured === undefined) continue;
    let raw = captured;
    // Strip leading "memory/" prefix — validator joins with MEMORY_DIR anyway
    if (raw.startsWith("memory/")) {
      raw = raw.slice("memory/".length);
    }
    // Skip non-memory repo paths (e.g. docs/research/...)
    if (SKIP_PREFIXES.some((p) => raw.startsWith(p))) continue;
    // Skip prose false-positives where an intermediate component ends with .md
    // e.g. "AGENTS.md/GEMINI.md" is not a real memory path
    const parts = raw.split("/");
    if (parts.slice(0, -1).some((p) => p.endsWith(".md"))) continue;
    results.push(raw);
  }
  return [...new Set(results)];
}

type FileStatus = "covered" | "gap-no-frontmatter" | "missing";

type ParityEntry = {
  filename: string;
  sourceIndex: string;
  status: FileStatus;
  note: string;
};

type ParityReport = {
  runAt: string;
  totalOldIndexEntries: number;
  totalUniqueFiles: number;
  covered: number;
  gaps: number;
  missing: number;
  entries: ParityEntry[];
};

async function tryReadFile(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8");
  } catch {
    return null;
  }
}

async function main() {
  const jsonMode = process.argv.includes("--json");
  const exitOnLoss = process.argv.includes("--exit-on-loss");

  // Collect all filenames from old index files
  const filenameToSource = new Map<string, string>();
  let totalOldIndexEntries = 0;

  for (const indexFile of OLD_INDEX_FILES) {
    const content = await tryReadFile(join(MEMORY_DIR, indexFile));
    if (content === null) {
      if (!jsonMode) console.warn(`⚠  ${indexFile} not found — skipping`);
      continue;
    }
    const linked = extractLinkedFilenames(content);
    totalOldIndexEntries += linked.length;
    for (const fname of linked) {
      if (!filenameToSource.has(fname)) {
        filenameToSource.set(fname, indexFile);
      }
    }
  }

  // Get all files that the reindexer would index (have frontmatter)
  const reindexedEntries = await collectEntries();
  const reindexedSet = new Set(reindexedEntries.map((e) => e.filename));

  // Evaluate each referenced file
  const entries: ParityEntry[] = [];

  for (const [filename, sourceIndex] of filenameToSource) {
    const content = await tryReadFile(join(MEMORY_DIR, filename));

    if (content === null) {
      entries.push({
        filename,
        sourceIndex,
        status: "missing",
        note: "File not found in memory/",
      });
      continue;
    }

    if (!reindexedSet.has(filename)) {
      entries.push({
        filename,
        sourceIndex,
        status: "gap-no-frontmatter",
        note: "File exists but lacks valid frontmatter — excluded from generated index",
      });
      continue;
    }

    entries.push({
      filename,
      sourceIndex,
      status: "covered",
      note: "Present in generated index (stack or heap)",
    });
  }

  const covered = entries.filter((e) => e.status === "covered").length;
  const gaps = entries.filter((e) => e.status === "gap-no-frontmatter").length;
  const missing = entries.filter((e) => e.status === "missing").length;

  const report: ParityReport = {
    runAt: new Date().toISOString(),
    totalOldIndexEntries,
    totalUniqueFiles: filenameToSource.size,
    covered,
    gaps,
    missing,
    entries,
  };

  if (jsonMode) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log("=== B-0260 MEMORY.md Parity Validation ===");
    console.log(`Run at:              ${report.runAt}`);
    console.log(`Old-index entries:   ${report.totalOldIndexEntries}`);
    console.log(`Unique files:        ${report.totalUniqueFiles}`);
    console.log(`Covered (ok):        ${covered}`);
    console.log(`No-frontmatter gap:  ${gaps}`);
    console.log(`Missing (loss):      ${missing}`);

    if (missing > 0) {
      console.log("\n--- MISSING FILES (parity loss) ---");
      for (const e of entries.filter((x) => x.status === "missing")) {
        console.log(`  LOSS  ${e.filename}  [from ${e.sourceIndex}]`);
      }
    }

    if (gaps > 0) {
      console.log("\n--- COVERAGE GAPS (no frontmatter) ---");
      for (const e of entries.filter((x) => x.status === "gap-no-frontmatter")) {
        console.log(`  GAP  ${e.filename}  [from ${e.sourceIndex}]`);
      }
    }

    if (missing === 0 && gaps === 0) {
      console.log("\nFull parity: all old-index files are covered by the generated index.");
    }
  }

  if (exitOnLoss && missing > 0) {
    process.exit(1);
  }
}

if (import.meta.main) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
