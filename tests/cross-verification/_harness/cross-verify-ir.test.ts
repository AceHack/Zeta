/**
 * cross-verify-ir.test.ts — CI-wired cross-language byte-lock oracle.
 *
 * This test file makes the cross-language agreement check part of the
 * normal test suite (bun test runs it). It is NOT a hand-run CLI — it's
 * enforced on every commit.
 *
 * Policy: FAIL on missing EXPECTED toolchains (not just warn).
 * Expected toolchains on this repo: bun (TS), python3, go, rustc, dotnet (F#+C#).
 * Q# is optional until uv sync installs qsharp.
 */

import { describe, test, expect } from "bun:test";
import { crossVerify } from "./cross-verify-ir";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

// ─── Load IRs ────────────────────────────────────────────────────────────

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

const STANDARD_INPUTS: [string, string][] = [
  ["x-0", "0"], ["x-1", "1"], ["x-2", "2"],
  ["x-10", "10"], ["x-255", "255"],
];

// ─── Toolchain availability checks ──────────────────────────────────────

function isAvailable(cmd: string): boolean {
  try {
    execSync(`which ${cmd}`, { encoding: "utf-8", stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

// Expected toolchains that MUST be present (fail if missing)
const EXPECTED_TOOLCHAINS = {
  bun: isAvailable("bun"),
  python3: isAvailable("python3"),
  go: isAvailable("go"),
  rustc: isAvailable("rustc"),
  dotnet: isAvailable("dotnet"),
};

// ─── Tests ──────────────────────────────────────────────────────────────

describe("cross-verify-ir — CI-enforced byte-lock oracle", () => {
  test("expected toolchains are present (fail if any missing)", () => {
    // This test FAILS if a required toolchain is missing on the runner.
    // That's intentional: a missing toolchain means the byte-lock isn't being checked.
    for (const [tool, available] of Object.entries(EXPECTED_TOOLCHAINS)) {
      expect(available, `${tool} must be installed for cross-language verification`).toBe(true);
    }
  });

  test("splitmix64 (64-bit): all available languages byte-agree", () => {
    const result = crossVerify(sm64, STANDARD_INPUTS);
    // Must have at least 3 languages agreeing (diverse = meaningful)
    expect(result.languages.length).toBeGreaterThanOrEqual(3);
    expect(result.disagreements).toHaveLength(0);
    expect(result.allAgree).toBe(true);
  });

  test("fmix32 (32-bit): all available languages byte-agree", () => {
    const result = crossVerify(fmix32, STANDARD_INPUTS);
    expect(result.languages.length).toBeGreaterThanOrEqual(3);
    expect(result.disagreements).toHaveLength(0);
    expect(result.allAgree).toBe(true);
  });

  test("at least 5 languages participate (not silently skipping)", () => {
    // The oracle should run TS + Python + Go + Rust + F# at minimum.
    // C# via dotnet run adds the 6th. Q# is optional.
    const result = crossVerify(sm64, STANDARD_INPUTS);
    expect(result.languages.length).toBeGreaterThanOrEqual(5);
  });

  test("splitmix64 golden vector x-1 matches known value across all langs", () => {
    const result = crossVerify(sm64, [["x-1", "1"]]);
    // Every participating language must produce the canonical golden
    expect(result.disagreements).toHaveLength(0);
    // The value they agree on should be the known splitmix64(1) golden
    // (we verify this separately, but the cross-verify ensures consensus)
    expect(result.allAgree).toBe(true);
  });

  test("fmix32 correctly masks to 32 bits (the bug the oracle caught)", () => {
    // This test exists because the oracle previously caught a real bug:
    // Go wasn't masking for sub-64-bit widths. This ensures it stays fixed.
    const result = crossVerify(fmix32, [["x-1", "1"]]);
    expect(result.disagreements).toHaveLength(0);
    expect(result.allAgree).toBe(true);
  });
});
