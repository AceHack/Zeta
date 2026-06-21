#!/usr/bin/env bun
// post-write-memory-reindex.ts — PostToolUse hook: regenerates memory/MEMORY.md
// after any Write or Edit to a memory heap file.
//
// Wired via .claude/settings.json PostToolUse matcher "Write|Edit".
// Part of 081KR2E4K0008QG0R000XCS9FT (MEMORY.md drift enforcement).
//
// Trigger conditions (mirrors the generator's own exclusion list in
// src/Core.TypeScript/memory/reindex-memory-md.ts collectEntriesRecursive):
//   - Path matches memory/**/*.md  (RECURSIVE — the reindexer walks
//     subdirectories incl. memory/<persona>/conversations/*.md)
//   - Path is NOT a MEMORY.md   (generated index — root OR per-persona hub)
//   - Path is NOT a CURRENT-*.md (persona fast-path files)
//   - Path is NOT a README.md   (convention doc)
//
// When a trigger-qualifying path is written, runs:
//   bun src/Core.TypeScript/memory/reindex-memory-md.ts
//
// This keeps MEMORY.md current in real time during agent sessions so
// PRs arrive with the index already regenerated (CI backstop: memory-index-drift.yml).
//
// Non-blocking: runs synchronously but swallows errors. A reindex failure
// does NOT block the write — the CI check is the hard gate.

import { readHookInput } from "./harness.ts";
import { spawnSync } from "node:child_process";
import { resolve, relative } from "node:path";

const MEMORY_DIR = "memory";
const EXCLUDED_FILENAMES = new Set(["MEMORY.md", "README.md"]);

function isMemoryHeapFile(rawPath: string): boolean {
  // Resolve to absolute so relative paths from different CWDs work.
  // Then recompute relative-to-cwd to match against memory/**/*.md.
  const abs = resolve(rawPath);
  const rel = relative(process.cwd(), abs);

  // Must be anywhere under memory/ — INCLUDING subdirectories. The reindexer
  // walks recursively (memory/<persona>/conversations/*.md etc.), so the hook
  // must fire for those too or MEMORY.md drifts when a subtree file changes.
  const parts = rel.split("/");
  if (parts.length < 2) return false;
  if (parts[0] !== MEMORY_DIR) return false;

  // Match on the basename, at any depth (mirrors the reindexer's per-file
  // exclusions, which key off item.name regardless of directory).
  const filename = parts[parts.length - 1]!;
  if (!filename.endsWith(".md")) return false;
  if (EXCLUDED_FILENAMES.has(filename)) return false;
  if (filename.startsWith("CURRENT-")) return false;

  return true;
}

function runReindex(): void {
  const result = spawnSync("bun", ["src/Core.TypeScript/memory/reindex-memory-md.ts"], {
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
  });
  if (result.status !== 0) {
    // Non-fatal: log to stderr so it's visible but don't block the write.
    process.stderr.write(
      `[post-write-memory-reindex] reindex failed (exit ${result.status ?? "?"}): ` +
        (result.stderr ?? "") +
        "\n",
    );
  }
}

function main(): number {
  const input = readHookInput();
  const toolName = input.tool_name ?? "";
  if (toolName !== "Write" && toolName !== "Edit") return 0;

  const rawPath = (input.tool_input?.["file_path"] as string | undefined) ?? "";
  if (!rawPath) return 0;
  if (!isMemoryHeapFile(rawPath)) return 0;

  runReindex();
  return 0;
}

if (import.meta.main) {
  process.exit(main());
}
