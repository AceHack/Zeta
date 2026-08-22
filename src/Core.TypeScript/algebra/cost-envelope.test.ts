/**
 * cost-envelope.test.ts — Verify the Z3 envelope proofs discharge correctly.
 *
 * CI-gated in the BLOCKING full-verify job (gate.yml runs this file by name), which is why
 * the solver leg stays here rather than moving wholesale to tools/Z3Verify.
 *
 * WHAT CHANGED, 2026-08-13 (work-item 081KZYYKHX1087G0R0036E9RH9). This file used to assert
 * that the whole z3 output equalled `"unsat"`. That expectation is satisfied by a TAUTOLOGY:
 * a lemma whose premises contain its conclusion also prints `unsat`, so the check could not
 * fail on the one thing it exists to catch. The .smt2 now carries a non-vacuity probe and
 * returns a verdict SEQUENCE.
 *
 * The STRICT sequence is asserted in tools/Z3Verify/consolidate-quadratic-envelope.test.ts,
 * which is the canonical runner. This file asserts the two properties that must hold for the
 * full-verify gate to mean anything — the bound discharges, and the file is not all-unsat —
 * and deliberately does not restate the sequence, so the two gates cannot drift apart.
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

  test("Z3 discharges n(n-1)/2 ≤ n² as UNSAT, and the file is NOT all-unsat", () => {
    if (!z3Available()) {
      console.log("  ⚠ z3 not available — skipping execution");
      return;
    }
    const raw = execSync(`z3 ${SMT_FILE}`, { encoding: "utf-8", timeout: 10000 });
    const verdicts = raw
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l === "sat" || l === "unsat" || l === "unknown");

    expect(verdicts[0]).toBe("unsat"); // E1 — the bound holds for all n ≥ 0
    // The non-vacuity leg. An all-unsat verdict list is what a tautology produces, so a
    // sequence with no `sat` in it is a gate that cannot fail — reject it here too.
    expect(verdicts).toContain("sat");
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
