/**
 * cross-verify-ir.test.ts — CI-enforced 7-language byte-lock oracle.
 *
 * This runs as part of `bun test`. It generates code in 7 languages,
 * compiles and executes each, and asserts byte-level agreement.
 * FAILS if expected toolchains are missing (not just warns).
 */

import { describe, test, expect } from "bun:test";
import { crossVerify, ORACLE_LANES } from "./cross-verify-ir";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

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
  try { execFileSync("which", [cmd], { stdio: "pipe" }); return true; } catch { return false; }
}

const VENV_PYTHON = join(process.cwd(), "src/Core.Python/.venv/bin/python3");
const VENV_HINT = "run `uv sync --project src/Core.Python` (this is what CI's 'QDK venv setup' step does)";

/**
 * Per-route floor. Each named lane must contribute at least one EXECUTED case.
 *
 * Deliberately NOT an aggregate floor (`languages.length >= 6`): with 7 lanes,
 * "≥6 ran" is satisfied by any 6 of them, so a single lane going dark is
 * absorbed by the survivors — the run reports success while N has silently
 * dropped to 6. Redundancy in the numerator hides a zero. Assert per lane, and
 * name the lane in the failure so the dark route is legible from the log alone.
 */
function expectEveryLaneExecuted(result: ReturnType<typeof crossVerify>): void {
  for (const lane of ORACLE_LANES) {
    const cases = result.laneCases[lane] ?? 0;
    const why = result.errors.find(e => e.language === lane)?.error ?? "no error reported (silently empty)";
    expect(
      cases,
      `oracle lane "${lane}" executed ${cases} cases for ${result.generator} — the byte-lock claims ` +
      `${ORACLE_LANES.length} independent implementations agree, and this one did not run. Cause: ${why}`,
    ).toBeGreaterThanOrEqual(1);
  }
  expect(result.darkLanes, `dark lanes for ${result.generator}`).toEqual([]);
}

describe("cross-verify-ir — 7-language byte-lock oracle (CI-enforced)", () => {
  test("expected toolchains present (bun, python3, go, rustc, dotnet)", () => {
    for (const tool of ["bun", "python3", "go", "rustc", "dotnet"]) {
      expect(isAvailable(tool), `${tool} must be installed`).toBe(true);
    }
  });

  // The Q# lane's interpreter is a gitignored venv, not a PATH tool — so it is
  // exactly the prerequisite the `which`-based check above cannot see. Absent
  // this test, a missing venv surfaced only as `/bin/sh: ...: No such file or
  // directory` on stderr, which no assertion reads.
  test("Q# lane prerequisites present (venv python3 + qdk importable)", () => {
    expect(existsSync(VENV_PYTHON), `${VENV_PYTHON} must exist — ${VENV_HINT}`).toBe(true);
    let qdkErr = "";
    const hasQdk = (() => {
      // execFileSync, not execSync: VENV_PYTHON is an absolute path built from
      // process.cwd(), so string-interpolating it into a shell command line makes
      // the checkout path part of the command (CodeQL js/shell-command-injection-
      // from-environment). Passing argv directly spawns no shell at all.
      try { execFileSync(VENV_PYTHON, ["-c", "import qdk"], { stdio: "pipe" }); return true; }
      catch (e: any) { qdkErr = (e?.message ?? "").slice(0, 200); return false; }
    })();
    expect(hasQdk, `qdk must be importable from the venv — ${VENV_HINT}. ${qdkErr}`).toBe(true);
  });

  test("splitmix64 (64-bit): all languages byte-agree", () => {
    const result = crossVerify(sm64, INPUTS);
    expect(result.disagreements).toHaveLength(0);
    expect(result.allAgree).toBe(true);
    expectEveryLaneExecuted(result);
  }, 60000);

  test("fmix32 (32-bit): all languages byte-agree", () => {
    const result = crossVerify(fmix32, INPUTS);
    expect(result.disagreements).toHaveLength(0);
    expect(result.allAgree).toBe(true);
    expectEveryLaneExecuted(result);
  }, 60000);

  test("every named oracle lane participates (diverse-double-compiling, per-route)", () => {
    const result = crossVerify(sm64, INPUTS);
    expectEveryLaneExecuted(result);
    // N is asserted here and nowhere else: the byte-lock's arity is a claim, so
    // it gets a check. Adding a lane without updating ORACLE_LANES fails here.
    expect(ORACLE_LANES.length).toBe(7);
    expect(result.languages.slice().sort()).toEqual([...ORACLE_LANES].sort());
  }, 60000);
});
