/**
 * exact-optional-property.test.ts — tests for the TS2375 healer.
 */

import { describe, test, expect } from "bun:test";
import { exactOptionalPropertyDetector, exactOptionalPropertyHealer } from "./exact-optional-property";
import type { FileTree } from "../healer-harness";

describe("exactOptionalPropertyDetector", () => {
  test("detects ?: T when undefined is assigned to that property", () => {
    const tree: FileTree = new Map([
      ["src/types.ts", `interface Config {\n  timeout?: number;\n}\nconst c: Config = { timeout: undefined };\n`],
    ]);
    const findings = exactOptionalPropertyDetector.detect(tree);
    expect(findings.length).toBe(1);
    expect(findings[0]!.rule).toBe("TS2375");
    expect(findings[0]!.detail).toContain("timeout");
  });

  test("does NOT flag ?: T | undefined (already widened)", () => {
    const tree: FileTree = new Map([
      ["src/types.ts", `interface Config {\n  timeout?: number | undefined;\n}\nconst c: Config = { timeout: undefined };\n`],
    ]);
    const findings = exactOptionalPropertyDetector.detect(tree);
    expect(findings.length).toBe(0);
  });

  test("does NOT flag when undefined is never assigned", () => {
    const tree: FileTree = new Map([
      ["src/types.ts", `interface Config {\n  timeout?: number;\n}\nconst c: Config = { timeout: 5000 };\n`],
    ]);
    const findings = exactOptionalPropertyDetector.detect(tree);
    expect(findings.length).toBe(0);
  });

  test("does NOT flag non-TS files", () => {
    const tree: FileTree = new Map([
      ["src/types.js", `// timeout?: number\nconst c = { timeout: undefined };\n`],
    ]);
    const findings = exactOptionalPropertyDetector.detect(tree);
    expect(findings.length).toBe(0);
  });
});

describe("exactOptionalPropertyHealer", () => {
  test("widens ?: T to ?: T | undefined", () => {
    const tree: FileTree = new Map([
      ["src/types.ts", `interface Config {\n  timeout?: number;\n}\nconst c: Config = { timeout: undefined };\n`],
    ]);
    const healed = exactOptionalPropertyHealer.heal(tree);
    const content = healed.get("src/types.ts")!;
    expect(content).toContain("timeout?: number | undefined");
  });

  test("idempotent: re-healing already-widened is a no-op", () => {
    const tree: FileTree = new Map([
      ["src/types.ts", `interface Config {\n  timeout?: number | undefined;\n}\nconst c: Config = { timeout: undefined };\n`],
    ]);
    const healed = exactOptionalPropertyHealer.heal(tree);
    expect(healed.get("src/types.ts")).toBe(tree.get("src/types.ts"));
  });

  test("closure: healing does not introduce new findings", () => {
    const tree: FileTree = new Map([
      ["src/types.ts", `interface Config {\n  timeout?: number;\n  name?: string;\n}\nconst c: Config = { timeout: undefined };\n`],
    ]);
    const healed = exactOptionalPropertyHealer.heal(tree);
    const afterFindings = exactOptionalPropertyDetector.detect(healed);
    // The timeout finding should be gone
    expect(afterFindings.length).toBe(0);
  });

  test("totality: never throws on empty tree", () => {
    const tree: FileTree = new Map();
    expect(() => exactOptionalPropertyHealer.heal(tree)).not.toThrow();
  });

  test("leaves non-matching properties untouched", () => {
    const tree: FileTree = new Map([
      ["src/types.ts", `interface Config {\n  name?: string;\n}\nconst c: Config = { name: "hello" };\n`],
    ]);
    const healed = exactOptionalPropertyHealer.heal(tree);
    expect(healed.get("src/types.ts")).toBe(tree.get("src/types.ts"));
  });
});
