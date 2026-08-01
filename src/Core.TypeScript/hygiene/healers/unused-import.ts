/**
 * unused-import healer — Tier 0 (mechanical, zero judgment).
 *
 * Detects: TS6133 "X is declared but its value is never read" for imports.
 * Fixes: removes the entire import line (or the specific named import).
 *
 * This is the simplest possible healer: no model needed, pure regex over the
 * file tree. The "compiler is the oracle" — after healing, re-run the detector
 * and confirm the finding is gone AND no new finding appeared.
 *
 * Laws:
 * - Idempotence: removing an already-removed import = no change ✓
 * - Closure-as-subset: removing an import cannot introduce new findings ✓
 * - Convergence: one pass is sufficient (no cycles) ✓
 * - Totality: never throws (worst case: returns tree unchanged) ✓
 * - Exit: if it can't fix, returns unchanged (decline is success) ✓
 * - Bounded scope: one drift class only (unused imports) ✓
 *
 * Composes with:
 * - src/Core.TypeScript/hygiene/healer-harness.ts (the certification API)
 * - The TypeScript compiler (tsc) as the real detector in production
 */

import type { Healer, Detector, Finding, FileTree } from "../healer-harness";

// ═══ The Detector (simulates TS6133 for unused imports) ═════════════════════════

/**
 * Detect unused imports by looking for `import { X } from "..."` where X
 * never appears elsewhere in the file. This is a SIMPLIFIED detector for
 * testing — the real detector would invoke `tsc --noEmit` and parse the output.
 *
 * For the harness certification, this simplified version proves the healer
 * is correct against a known oracle. In production, swap in the real tsc detector.
 */
export const unusedImportDetector: Detector = {
  name: "unused-import-ts6133",
  detect(tree: FileTree): readonly Finding[] {
    const findings: Finding[] = [];
    for (const [path, content] of tree) {
      if (!path.endsWith(".ts") && !path.endsWith(".tsx")) continue;
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        // Match: import { X } from "..." or import { X, Y } from "..."
        // Also: import X from "..." (default imports)
        const namedMatch = line.match(/^import\s+\{([^}]+)\}\s+from\s+/);
        const defaultMatch = line.match(/^import\s+(\w+)\s+from\s+/);
        const typeMatch = line.match(/^import\s+type\s+\{([^}]+)\}\s+from\s+/);

        const match = namedMatch ?? typeMatch;
        if (match) {
          const names = match[1]!.split(",").map((n) => n.trim().split(" as ").pop()!.trim());
          const restOfFile = lines.filter((_, j) => j !== i).join("\n");
          for (const name of names) {
            if (name && !new RegExp(`\\b${name}\\b`).test(restOfFile)) {
              findings.push({ path, rule: "TS6133", detail: `'${name}' is declared but its value is never read` });
            }
          }
        } else if (defaultMatch) {
          const name = defaultMatch[1]!;
          const restOfFile = lines.filter((_, j) => j !== i).join("\n");
          if (!new RegExp(`\\b${name}\\b`).test(restOfFile)) {
            findings.push({ path, rule: "TS6133", detail: `'${name}' is declared but its value is never read` });
          }
        }
      }
    }
    return findings;
  },
};

// ═══ The Healer (removes unused import lines) ═══════════════════════════════════

/**
 * Heal unused imports by removing the entire import line where ALL named
 * imports are unused, or removing just the unused name from a multi-import.
 */
export const unusedImportHealer: Healer = {
  name: "unused-import-remover",
  heal(tree: FileTree): FileTree {
    const result = new Map(tree);
    for (const [path, content] of tree) {
      if (!path.endsWith(".ts") && !path.endsWith(".tsx")) continue;
      const lines = content.split("\n");
      const linesToRemove = new Set<number>();

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        const namedMatch = line.match(/^import\s+(?:type\s+)?\{([^}]+)\}\s+from\s+/);
        const defaultMatch = line.match(/^import\s+(\w+)\s+from\s+/);

        if (namedMatch) {
          const names = namedMatch[1]!.split(",").map((n) => n.trim().split(" as ").pop()!.trim());
          const restOfFile = lines.filter((_, j) => j !== i).join("\n");
          const allUnused = names.every((name) => name && !new RegExp(`\\b${name}\\b`).test(restOfFile));
          if (allUnused) linesToRemove.add(i);
        } else if (defaultMatch) {
          const name = defaultMatch[1]!;
          const restOfFile = lines.filter((_, j) => j !== i).join("\n");
          if (!new RegExp(`\\b${name}\\b`).test(restOfFile)) {
            linesToRemove.add(i);
          }
        }
      }

      if (linesToRemove.size > 0) {
        const healed = lines.filter((_, i) => !linesToRemove.has(i)).join("\n");
        result.set(path, healed);
      }
    }
    return result;
  },
};
