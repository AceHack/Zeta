/**
 * cross-verify-ir.test.ts — CI-enforced 7-language byte-lock oracle.
 *
 * This runs as part of `bun test`. It generates code in 7 languages,
 * compiles and executes each, and asserts byte-level agreement.
 * FAILS if expected toolchains are missing (not just warns).
 */

import { describe, test, expect } from "bun:test";
import { crossVerify } from "./cross-verify-ir";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

const goldenFile = JSON.parse(readFileSync(
  join(import.meta.dir, "../zeta-ir-v1/zeta-ir-v1.golden.json"), "utf-8"
));

function loadIr(name: string) {
  const raw = goldenFile[name] as string;
  const safe = raw.replace(/"k"\s*:\s*(-?\d+)/g, '"k_bigint": "$1"');
  return JSON.parse(safe);
}

const sm64 = loadIr("rng.splitmix64");
const fmix32 = loadIr("hash.fmix32");

const INPUTS: [string, string][] = [
  ["x-0", "0"], ["x-1", "1"], ["x-2", "2"], ["x-10", "10"], ["x-255", "255"],
];

function isAvailable(cmd: string): boolean {
  try { execSync(`which ${cmd}`, { stdio: "pipe" }); return true; } catch { return false; }
}

describe("cross-verify-ir — 7-language byte-lock oracle (CI-enforced)", () => {
  test("expected toolchains present (bun, python3, go, rustc, dotnet)", () => {
    for (const tool of ["bun", "python3", "go", "rustc", "dotnet"]) {
      expect(isAvailable(tool), `${tool} must be installed`).toBe(true);
    }
  });

  test("splitmix64 (64-bit): all languages byte-agree", () => {
    const result = crossVerify(sm64, INPUTS);
    expect(result.disagreements).toHaveLength(0);
    expect(result.allAgree).toBe(true);
    expect(result.languages.length).toBeGreaterThanOrEqual(6);
  }, 30000);

  test("fmix32 (32-bit): all languages byte-agree", () => {
    const result = crossVerify(fmix32, INPUTS);
    expect(result.disagreements).toHaveLength(0);
    expect(result.allAgree).toBe(true);
    expect(result.languages.length).toBeGreaterThanOrEqual(6);
  }, 30000);

  test("at least 6 languages participate (diverse-double-compiling)", () => {
    const result = crossVerify(sm64, INPUTS);
    expect(result.languages.length).toBeGreaterThanOrEqual(6);
  }, 30000);

  test("Q# participates when qdk is available", () => {
    const venvPython = join(process.cwd(), "src/Core.Python/.venv/bin/python3");
    const hasQdk = (() => {
      try { execSync(`${venvPython} -c "import qdk"`, { stdio: "pipe" }); return true; }
      catch { return false; }
    })();
    if (hasQdk) {
      const result = crossVerify(fmix32, INPUTS);
      expect(result.languages).toContain("qsharp");
    }
  }, 30000);
});
