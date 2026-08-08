/**
 * unchecked-index.test.ts — tests for the TS2532 healer (noUncheckedIndexedAccess).
 */

import { describe, test, expect } from "bun:test";
import { uncheckedIndexDetector, uncheckedIndexHealer } from "./unchecked-index";
import type { FileTree } from "../healer-harness";

describe("uncheckedIndexDetector", () => {
  test("detects xs[i] used in arithmetic without guard", () => {
    const tree: FileTree = new Map([
      ["src/math.ts", "const mean = values[i] - avg;\n"],
    ]);
    const findings = uncheckedIndexDetector.detect(tree);
    expect(findings.length).toBe(1);
    expect(findings[0]!.rule).toBe("TS2532");
    expect(findings[0]!.detail).toContain("values[i]");
  });

  test("does NOT flag xs[i]! (already asserted)", () => {
    const tree: FileTree = new Map([
      ["src/math.ts", "const mean = values[i]! - avg;\n"],
    ]);
    const findings = uncheckedIndexDetector.detect(tree);
    expect(findings.length).toBe(0);
  });

  test("does NOT flag when preceded by a guard", () => {
    const tree: FileTree = new Map([
      ["src/math.ts", "if (values[i] !== undefined) {\n  const x = values[i] - avg;\n}\n"],
    ]);
    const findings = uncheckedIndexDetector.detect(tree);
    expect(findings.length).toBe(0);
  });

  test("does NOT flag non-TS files", () => {
    const tree: FileTree = new Map([
      ["src/math.js", "const mean = values[i] - avg;\n"],
    ]);
    const findings = uncheckedIndexDetector.detect(tree);
    expect(findings.length).toBe(0);
  });

  test("detects method call on indexed access", () => {
    const tree: FileTree = new Map([
      ["src/util.ts", "const name = items[idx].toString();\n"],
    ]);
    const findings = uncheckedIndexDetector.detect(tree);
    expect(findings.length).toBe(1);
  });
});

describe("uncheckedIndexHealer", () => {
  test("adds ! assertion to unguarded indexed access", () => {
    const tree: FileTree = new Map([
      ["src/math.ts", "const mean = values[i] - avg;\n"],
    ]);
    const healed = uncheckedIndexHealer.heal(tree);
    const content = healed.get("src/math.ts")!;
    expect(content).toContain("values[i]!");
    expect(content).toContain("SAFETY:");
  });

  test("idempotent: re-healing already-healed code is a no-op", () => {
    const tree: FileTree = new Map([
      ["src/math.ts", "const mean = values[i]! /* SAFETY: index bounds ensured by loop/caller */ - avg;\n"],
    ]);
    const healed = uncheckedIndexHealer.heal(tree);
    expect(healed.get("src/math.ts")).toBe(tree.get("src/math.ts"));
  });

  test("closure: healing does not introduce new findings", () => {
    const tree: FileTree = new Map([
      ["src/math.ts", "const mean = values[i] - avg;\nconst sum = total + 1;\n"],
    ]);
    const beforeFindings = uncheckedIndexDetector.detect(tree);
    const healed = uncheckedIndexHealer.heal(tree);
    const afterFindings = uncheckedIndexDetector.detect(healed);
    // After healing, the original finding should be gone
    expect(afterFindings.length).toBeLessThan(beforeFindings.length);
    // No new findings introduced
    for (const af of afterFindings) {
      expect(beforeFindings.some((bf) => bf.detail === af.detail)).toBe(true);
    }
  });

  test("totality: never throws on empty tree", () => {
    const tree: FileTree = new Map();
    expect(() => uncheckedIndexHealer.heal(tree)).not.toThrow();
  });

  test("totality: never throws on file without indexed access", () => {
    const tree: FileTree = new Map([
      ["src/hello.ts", "console.log('hello');\n"],
    ]);
    const healed = uncheckedIndexHealer.heal(tree);
    expect(healed.get("src/hello.ts")).toBe("console.log('hello');\n");
  });

  test("leaves guarded access untouched", () => {
    const tree: FileTree = new Map([
      ["src/safe.ts", "if (arr[j] !== undefined) {\n  const x = arr[j] - 1;\n}\n"],
    ]);
    const healed = uncheckedIndexHealer.heal(tree);
    expect(healed.get("src/safe.ts")).toBe(tree.get("src/safe.ts"));
  });
});
