/**
 * stale-js healer — Tier 0 (zero intelligence).
 *
 * Detects: a `.js` file that has a sibling `.ts` file (same basename).
 * Fixes: removes the stale `.js` file.
 *
 * WHY THIS MATTERS: Bun resolves `.js` before `.ts` when importing without
 * extension. A stale compiled `.js` from an older version of the `.ts` source
 * silently serves outdated code. This caused the backlog reader to return
 * 0 items (2026-07-08 session — 30+ minutes debugging a `??` vs `||` bug
 * that was already fixed in the `.ts` but the stale `.js` was being loaded).
 *
 * Laws:
 * - Idempotence: removing an already-absent file = no change ✓
 * - Closure: removing a stale JS cannot introduce new findings ✓
 * - Convergence: one pass (no cycles possible) ✓
 * - Totality: never throws ✓
 * - Exit: if no stale JS found, returns unchanged ✓
 * - Bounded scope: one drift class (stale compiled JS) ✓
 */

import type { Healer, Detector, Finding, FileTree } from "../healer-harness";

export const staleJsDetector: Detector = {
  name: "stale-js-sibling",
  detect(tree: FileTree): readonly Finding[] {
    const findings: Finding[] = [];
    for (const path of tree.keys()) {
      if (!path.endsWith(".js")) continue;
      const tsPath = path.replace(/\.js$/, ".ts");
      if (tree.has(tsPath)) {
        findings.push({
          path,
          rule: "STALE-JS",
          detail: `${path} has a sibling ${tsPath} — the .js is stale compiled output`,
        });
      }
    }
    return findings;
  },
};

export const staleJsHealer: Healer = {
  name: "stale-js-remover",
  heal(tree: FileTree): FileTree {
    const result = new Map(tree);
    for (const path of tree.keys()) {
      if (!path.endsWith(".js")) continue;
      const tsPath = path.replace(/\.js$/, ".ts");
      if (tree.has(tsPath)) {
        result.delete(path);
      }
    }
    return result;
  },
};
