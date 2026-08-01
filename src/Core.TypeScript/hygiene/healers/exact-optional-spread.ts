/**
 * exact-optional-spread healer — Tier 0 (zero intelligence).
 *
 * Detects: the pattern `{ key: value | undefined }` that violates
 *          `exactOptionalPropertyTypes` (TS2375) — assigning `undefined`
 *          to an optional property that doesn't include `undefined` in its type.
 * Fixes: wraps in the conditional spread pattern:
 *          `...(value ? { key: value } : {})`
 *
 * WHY THIS MATTERS: we hit this 4+ times this session. Every time the fix was
 * the same: conditional spread. The pattern is mechanical and verifiable by tsc.
 *
 * NOTE: This healer operates on a SIMPLIFIED model — it matches the specific
 * pattern where `undefined` is assigned via a ternary or nullish expression.
 * Complex cases (multi-property objects, nested ternaries) should decline.
 * The compiler-oracle wrapper handles verification.
 *
 * Laws:
 * - Idempotence: already-spread patterns are not re-spread ✓
 * - Closure: the spread pattern is type-correct (no new findings) ✓
 * - Convergence: one pass (each pattern is independent) ✓
 * - Totality: never throws ✓
 * - Exit: unrecognized patterns are left unchanged ✓
 * - Bounded scope: one drift class (exactOptionalPropertyTypes) ✓
 */

import type { Healer, Detector, Finding, FileTree } from "../healer-harness";

/**
 * Detect the pattern: `key: someExpr ? { ... } : undefined` or
 * `key: someVar` where someVar might be undefined.
 *
 * Simplified: looks for object literal properties where the value ends with
 * a ternary producing `undefined` — the most common form we hit.
 */
export const exactOptionalDetector: Detector = {
  name: "exact-optional-TS2375",
  detect(tree: FileTree): readonly Finding[] {
    const findings: Finding[] = [];
    for (const [path, content] of tree) {
      if (!path.endsWith(".ts") && !path.endsWith(".tsx")) continue;
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        // Pattern: `key: expr ? value : undefined` inside an object literal
        if (/\w+\s*:\s*.+\?\s*.+\s*:\s*undefined/.test(line)) {
          findings.push({
            path,
            rule: "TS2375",
            detail: `Potential exactOptionalPropertyTypes violation at line ${i + 1}: ternary with undefined branch`,
          });
        }
      }
    }
    return findings;
  },
};

/**
 * Heal by wrapping `key: expr ? value : undefined` into
 * `...(expr ? { key: value } : {})`.
 *
 * This is the standard pattern used throughout the codebase for
 * exactOptionalPropertyTypes compliance.
 */
export const exactOptionalHealer: Healer = {
  name: "exact-optional-spread-fixer",
  heal(tree: FileTree): FileTree {
    const result = new Map(tree);
    for (const [path, content] of tree) {
      if (!path.endsWith(".ts") && !path.endsWith(".tsx")) continue;
      const lines = content.split("\n");
      let changed = false;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        // Match: `  key: expr ? value : undefined,` or without trailing comma
        const match = line.match(/^(\s*)(\w+)\s*:\s*(.+)\s*\?\s*(.+)\s*:\s*undefined\s*,?\s*$/);
        if (match) {
          const [, indent, key, condition, value] = match;
          // Only fix simple cases (single key, no nested objects in the value)
          if (key && condition && value && !value.includes("{") && !value.includes("}")) {
            const cleanValue = value.replace(/,\s*$/, "").trim();
            lines[i] = `${indent}...(${condition.trim()} ? { ${key}: ${cleanValue} } : {}),`;
            changed = true;
          }
          // Complex case: decline (leave unchanged)
        }
      }
      if (changed) result.set(path, lines.join("\n"));
    }
    return result;
  },
};
