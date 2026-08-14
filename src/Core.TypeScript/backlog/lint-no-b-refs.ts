#!/usr/bin/env bun
/**
 * lint-no-b-refs.ts — fail if any B-NNNN token remains outside the frozen alias map.
 *
 * The sequential B-NNNN series is closed. Legacy ids live ONLY in
 * b-to-zetaid-map.json + b-id-renumber-aliases.json for historical resolution.
 * Prose, deps, and indexes must use ZetaIds.
 *
 * Usage:
 *   bun src/Core.TypeScript/backlog/lint-no-b-refs.ts
 *   bun src/Core.TypeScript/backlog/lint-no-b-refs.ts --strict
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { SKIP_DIR_NAMES, SCAN_EXTENSIONS, shouldSkipDir } from "./b-ref-scope";

const B_ID_RE = /\bB-[0-9]{4}(?:\.[0-9]+)*\b/g;

/**
 * Files that legitimately carry legacy ids as DATA rather than as references:
 * the alias maps themselves, the tools that read/write them, and the tests that
 * plant a legacy id as a fixture.
 */
const ALLOWED_FILES = new Set([
  "b-to-zetaid-map.json",
  "b-id-renumber-aliases.json",
  "rebuild-legacy-b-id-aliases.ts",
  "legacy-b-id-zetaid.ts",
  "b-ref-scope.ts",
  "lint-no-b-refs.ts",
  "lint-no-b-refs.test.ts",
  "lint-no-new-bnnnn.ts",
]);

function repoRoot(): string {
  const r = spawnSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" });
  return r.status === 0 ? r.stdout.trim() : process.cwd();
}

function main(): number {
  const root = repoRoot();
  const offenders: { file: string; ids: string[] }[] = [];

  function walk(dir: string) {
    const rel = dir.slice(root.length + 1);
    if (shouldSkipDir(rel)) return;

    for (const entry of readdirSync(dir)) {
      if (SKIP_DIR_NAMES.has(entry)) continue;
      const full = join(dir, entry);
      let st;
      try { st = statSync(full); } catch { continue; }
      if (st.isDirectory()) {
        walk(full);
        continue;
      }
      if (!SCAN_EXTENSIONS.has(entry.slice(entry.lastIndexOf(".")))) continue;
      if (ALLOWED_FILES.has(entry)) continue;
      const text = readFileSync(full, "utf8");
      const ids = [...new Set(text.match(B_ID_RE) ?? [])];
      if (ids.length > 0) offenders.push({ file: full.slice(root.length + 1), ids });
    }
  }

  walk(root);

  if (offenders.length === 0) {
    console.log("ok: zero B-NNNN refs outside frozen alias maps");
    return 0;
  }

  console.error(`FAIL: ${offenders.length} files still contain B-NNNN refs\n`);
  for (const o of offenders.slice(0, 40)) {
    console.error(`  ${o.file}: ${o.ids.slice(0, 5).join(", ")}${o.ids.length > 5 ? "…" : ""}`);
  }
  if (offenders.length > 40) console.error(`  … and ${offenders.length - 40} more files`);
  console.error("\nRun: bun src/Core.TypeScript/backlog/rebuild-legacy-b-id-aliases.ts");
  return 1;
}

if (import.meta.main) process.exit(main());
