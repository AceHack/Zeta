#!/usr/bin/env bun
/**
 * run-tier0.ts — run all Tier-0 healers over the working tree.
 *
 * Called by the heartbeat workflow (otto's duty). Reads files from disk,
 * applies the composed Tier-0 healers, writes back any changes.
 *
 * Exit codes:
 *   0 — healers ran (may or may not have healed anything)
 *   1 — fatal error (never in practice — totality law)
 *
 * Usage:
 *   bun src/Core.TypeScript/hygiene/healers/run-tier0.ts [--repo-root <path>]
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { composeHealers, type FileTree } from "../healer-harness";
import { staleJsHealer } from "./stale-js";
import { unpinnedActionsHealer } from "./unpinned-actions";
import { exactOptionalHealer } from "./exact-optional-spread";
import { unusedImportHealer } from "./unused-import";

const REPO_ROOT = process.argv.includes("--repo-root")
  ? process.argv[process.argv.indexOf("--repo-root") + 1]!
  : process.cwd();

/** Recursively collect files (skipping node_modules, .git, binary). */
function collectFiles(dir: string, base: string = dir): Map<string, string> {
  const files = new Map<string, string>();
  const SKIP = new Set(["node_modules", ".git", "dist", "bin", ".cache"]);

  function walk(d: string): void {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      if (SKIP.has(entry.name)) continue;
      const full = join(d, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile()) {
        const rel = relative(base, full);
        // Only include healable files (TS, YAML workflows)
        if (rel.endsWith(".ts") || rel.endsWith(".tsx") ||
            rel.endsWith(".js") ||
            (rel.endsWith(".yml") && rel.includes(".github/workflows/"))) {
          try {
            files.set(rel, readFileSync(full, "utf-8"));
          } catch { /* skip unreadable */ }
        }
      }
    }
  }
  walk(dir);
  return files;
}

/** The composed Tier-0 healer pipeline. */
const tier0 = composeHealers("tier-0-composed", [
  staleJsHealer,
  unpinnedActionsHealer,
  unusedImportHealer,
  exactOptionalHealer,
]);

function main(): void {
  console.log(`[tier-0] Scanning ${REPO_ROOT}...`);

  const tree: FileTree = collectFiles(REPO_ROOT);
  console.log(`[tier-0] Collected ${tree.size} healable files`);

  const healed = tier0.heal(tree);

  // Find what changed
  let healedCount = 0;
  for (const [path, content] of healed) {
    const original = tree.get(path);
    if (original !== content) {
      // File was healed — write it back
      writeFileSync(join(REPO_ROOT, path), content);
      console.log(`[tier-0] HEALED: ${path}`);
      healedCount++;
    }
  }

  // Find files that were REMOVED (stale-js)
  for (const path of tree.keys()) {
    if (!healed.has(path)) {
      // File was removed by the healer — we can't delete from the workflow
      // (git rm needs to happen at the commit stage). Log it instead.
      console.log(`[tier-0] WOULD REMOVE: ${path} (stale — handle in git stage)`);
      healedCount++;
    }
  }

  if (healedCount === 0) {
    console.log(`[tier-0] No drift found. All clean.`);
  } else {
    console.log(`[tier-0] Fixed ${healedCount} file(s).`);
  }
}

main();
