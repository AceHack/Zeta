/**
 * exact-optional-property healer — Tier 1 (pattern-matched, verifiable by compiler oracle).
 *
 * Detects: TS2375 "Type 'X | undefined' is not assignable to type 'X'" on optional
 *   property assignments (caused by `exactOptionalPropertyTypes` in tsconfig — assigning
 *   `undefined` to an optional property `?: T` is an error because `?: T` means "absent"
 *   while `?: T | undefined` means "explicitly set to undefined").
 *
 * Proposes: widens the property type from `?: T` to `?: T | undefined` in the interface/type.
 *   This is the safe direction — it makes the type accept more values, never fewer.
 *   The compiler oracle confirms the TS2375 is gone and no new errors appear.
 *
 * Laws:
 * - Idempotence: widening already-widened `?: T | undefined` = no change ✓
 * - Closure-as-subset: widening a type cannot introduce new TS errors ✓
 * - Convergence: one pass per property ✓
 * - Totality: never throws ✓
 * - Exit: if pattern doesn't match, returns unchanged (decline) ✓
 * - Bounded scope: one drift class (TS2375) ✓
 *
 * NOTE: this healer picks the WIDEN direction (?: T → ?: T | undefined). The OMIT
 * direction (remove the property entirely from the assignment) is a semantic choice
 * that requires Tier-2 judgment. This healer is safe because it only EXPANDS what
 * the type accepts — it never narrows, never removes, never changes semantics.
 */

import type { Healer, Detector, Finding, FileTree } from "../healer-harness";

// ═══ The Detector ═══════════════════════════════════════════════════════════

/**
 * Detect optional properties declared as `?: T` (without `| undefined`) that
 * are being assigned `undefined` somewhere in the same file. This is a simplified
 * detector — the real one would invoke `tsc --noEmit` and parse TS2375.
 */
export const exactOptionalPropertyDetector: Detector = {
  name: "exact-optional-property-ts2375",
  detect(tree: FileTree): readonly Finding[] {
    const findings: Finding[] = [];
    for (const [path, content] of tree) {
      if (!path.endsWith(".ts") && !path.endsWith(".tsx")) continue;
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        // Match: propertyName?: SomeType (without | undefined at the end)
        // In an interface or type declaration context
        const optionalProp = line.match(/^\s+(\w+)\?\s*:\s*([^;|]+)\s*;?\s*$/);
        if (optionalProp) {
          const propName = optionalProp[1]!;
          const propType = optionalProp[2]!.trim();
          // Check if `undefined` is NOT already in the type
          if (!propType.includes("undefined")) {
            // Check if this property is assigned `undefined` somewhere in the file
            const assignPattern = new RegExp(`\\b${propName}\\s*[:=]\\s*undefined\\b|\\b${propName}\\s*\\?\\s*=`);
            if (assignPattern.test(content)) {
              findings.push({
                path,
                rule: "TS2375",
                detail: `'${propName}?: ${propType}' should be '${propName}?: ${propType} | undefined' (exactOptionalPropertyTypes)`,
              });
            }
          }
        }
      }
    }
    return findings;
  },
};

// ═══ The Healer ═══════════════════════════════════════════════════════════════

/**
 * Heal TS2375 by widening `?: T` to `?: T | undefined` for properties that are
 * assigned `undefined` in the same file. Safe direction: expands acceptance, never narrows.
 */
export const exactOptionalPropertyHealer: Healer = {
  name: "exact-optional-property-widener",
  heal(tree: FileTree): FileTree {
    const result = new Map(tree);
    for (const [path, content] of tree) {
      if (!path.endsWith(".ts") && !path.endsWith(".tsx")) continue;
      const lines = content.split("\n");
      let changed = false;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        const optionalProp = line.match(/^(\s+)(\w+)\?\s*:\s*([^;|]+)(;?\s*)$/);
        if (optionalProp) {
          const indent = optionalProp[1]!;
          const propName = optionalProp[2]!;
          const propType = optionalProp[3]!.trim();
          const trailing = optionalProp[4]!;

          if (!propType.includes("undefined")) {
            const assignPattern = new RegExp(`\\b${propName}\\s*[:=]\\s*undefined\\b|\\b${propName}\\s*\\?\\s*=`);
            if (assignPattern.test(content)) {
              lines[i] = `${indent}${propName}?: ${propType} | undefined${trailing}`;
              changed = true;
            }
          }
        }
      }

      if (changed) {
        result.set(path, lines.join("\n"));
      }
    }
    return result;
  },
};
