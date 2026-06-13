#!/usr/bin/env bun
// post-write-memory-reindex.ts — PostToolUse hook: regenerates memory/MEMORY.md
// after any Write or Edit to a memory heap file.
//
// Wired via .claude/settings.json PostToolUse matchers "Write" and "Edit".
// Part of B-0259 (MEMORY.md drift enforcement).
//
// Trigger conditions (mirrors the generator's own exclusion list):
//   - Path matches memory/*.md
//   - Path is NOT memory/MEMORY.md   (the generated index itself)
//   - Path is NOT memory/CURRENT-*.md (persona fast-path files)
//   - Path is NOT memory/README.md   (convention doc)
//   - Path is NOT memory/persona/**  (per-persona notebooks)
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
  // Then recompute relative-to-cwd to match against memory/*.md pattern.
  const abs = resolve(rawPath);
  const rel = relative(process.cwd(), abs);

  // Must be directly under memory/ — not in a subdirectory.
  const parts = rel.split("/");
  if (parts.length !== 2) return false;
  if (parts[0] !== MEMORY_DIR) return false;

  const filename = parts[1]!;
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
