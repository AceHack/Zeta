import { describe, test, expect } from "bun:test";
import { tsconfigExcludeDetector, tsconfigExcludeHealer } from "./tsconfig-exclude";
import type { FileTree } from "../healer-harness";

describe("tsconfigExcludeDetector", () => {
  test("detects AssemblyScript file not excluded", () => {
    const tree: FileTree = new Map([
      ["tsconfig.json", '{"compilerOptions": {}}'],
      ["assembly/index.as.ts", "export function add(a: i32, b: i32): i32 { return a + b; }"],
    ]);
    const findings = tsconfigExcludeDetector.detect(tree);
    expect(findings.length).toBe(1);
    expect(findings[0]!.detail).toContain("assembly");
    expect(findings[0]!.detail).toContain("asc");
  });

  test("does NOT flag when directory is already excluded", () => {
    const tree: FileTree = new Map([
      ["tsconfig.json", '{"exclude": ["assembly/**"]}'],
      ["assembly/index.as.ts", "export function add(a: i32, b: i32): i32 { return a + b; }"],
    ]);
    const findings = tsconfigExcludeDetector.detect(tree);
    expect(findings.length).toBe(0);
  });

  test("does NOT flag when no tsconfig exists", () => {
    const tree: FileTree = new Map([
      ["assembly/index.as.ts", "export function add(a: i32, b: i32): i32 { return a + b; }"],
    ]);
    const findings = tsconfigExcludeDetector.detect(tree);
    expect(findings.length).toBe(0);
  });
});

describe("tsconfigExcludeHealer", () => {
  test("adds directory to exclude array", () => {
    const tree: FileTree = new Map([
      ["tsconfig.json", '{"compilerOptions": {}}'],
      ["assembly/index.as.ts", "export function add(a: i32, b: i32): i32 { return a + b; }"],
    ]);
    const healed = tsconfigExcludeHealer.heal(tree);
    const config = JSON.parse(healed.get("tsconfig.json")!);
    expect(config.exclude).toContain("assembly/**");
  });

  test("idempotent: re-healing already-excluded is a no-op", () => {
    const tree: FileTree = new Map([
      ["tsconfig.json", '{"exclude": ["assembly/**"]}'],
      ["assembly/index.as.ts", "code"],
    ]);
    const healed = tsconfigExcludeHealer.heal(tree);
    const config = JSON.parse(healed.get("tsconfig.json")!);
    expect(config.exclude).toEqual(["assembly/**"]);
  });

  test("totality: never throws on missing tsconfig", () => {
    const tree: FileTree = new Map([["assembly/index.as.ts", "code"]]);
    expect(() => tsconfigExcludeHealer.heal(tree)).not.toThrow();
  });

  test("totality: never throws on malformed tsconfig", () => {
    const tree: FileTree = new Map([
      ["tsconfig.json", "not json at all"],
      ["assembly/index.as.ts", "code"],
    ]);
    expect(() => tsconfigExcludeHealer.heal(tree)).not.toThrow();
  });
});
