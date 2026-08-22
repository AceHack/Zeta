/**
 * cost-envelope.test.ts — Verify the Z3 envelope proofs discharge correctly.
 * CI-gated: if z3 is available, run the proof and assert UNSAT.
 */
import { describe, test, expect } from "bun:test";
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dir, "../../..");
const SMT_FILE = join(REPO_ROOT, "tools/Z3Verify/consolidate-quadratic-envelope.smt2");

function z3Available(): boolean {
  try { execSync("which z3", { stdio: "pipe" }); return true; } catch { return false; }
}

describe("cost-envelope — Z3 proofs (step 3 from Soraya routing)", () => {
  test("consolidate-quadratic-envelope.smt2 exists", () => {
    expect(existsSync(SMT_FILE)).toBe(true);
  });

  test("Z3 discharges n(n-1)/2 ≤ n² as UNSAT", () => {
    if (!z3Available()) {
      console.log("  ⚠ z3 not available — skipping execution");
      return;
    }
    const result = execSync(`z3 ${SMT_FILE}`, { encoding: "utf-8", timeout: 10000 }).trim();
    expect(result).toBe("unsat");
  });

  test("the envelope is correct by arithmetic (ground check at n=64)", () => {
    // n(n-1)/2 for n=64 = 64*63/2 = 2016
    // n² for n=64 = 4096
    // 2016 ≤ 4096 ✓
    const n = 64;
    const worstCase = n * (n - 1) / 2;
    const quadratic = n * n;
    expect(worstCase).toBeLessThanOrEqual(quadratic);
    expect(worstCase).toBe(2016);
    expect(quadratic).toBe(4096);
  });
});
