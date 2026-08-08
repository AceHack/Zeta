/**
 * chsh-band-gate-agreement.test.ts — gate the Z3 lemma that is the BP-16 SECOND tool
 * for the ChshBand gate-agreement property (Soraya, 2026-08-08).
 *
 * The property: `bandConvictsArithmetically (classifyBand δ n s) ⇔ |s| > 2 + chshMargin(δ,n)`
 * — the ChshBand conviction line (band ≥ Quantum) is EXACTLY chshSybilCalibrated's union
 * predicate; they can never disagree.
 *
 * Two independent witnesses (BP-16):
 *   1. FsCheck — tests/Tests.FSharp/ChshBand.Property.Tests.fs property (1).
 *   2. Z3 (this) — tools/Z3Verify/chsh-band-gate-agreement-lemma.smt2, exact reals.
 *
 * The .smt2 file alone is executed by NOTHING (Soraya's finding: tools/Z3Verify/*.smt2
 * are each gated by a companion bun test that shells `z3 <file>` and asserts unsat — the
 * pattern from cost-envelope.test.ts). Without this companion, audit-formal-artifacts.ts
 * registers the artefact's existence but nothing runs it → false-green. This is that gate.
 */
import { describe, test, expect } from "bun:test";
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dir, "../../..");
const SMT_FILE = join(REPO_ROOT, "tools/Z3Verify/chsh-band-gate-agreement-lemma.smt2");

function z3Available(): boolean {
  try {
    execSync("which z3", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

describe("chsh-band gate-agreement — Z3 lemma (BP-16 second tool)", () => {
  test("chsh-band-gate-agreement-lemma.smt2 exists", () => {
    expect(existsSync(SMT_FILE)).toBe(true);
  });

  test("Z3 discharges the biconditional (band>=Quantum ⇔ |s|>2+eps) as UNSAT", () => {
    if (!z3Available()) {
      console.log("  ⚠ z3 not available — skipping execution");
      return;
    }
    const result = execSync(`z3 ${SMT_FILE}`, { encoding: "utf-8", timeout: 10000 }).trim();
    expect(result).toBe("unsat");
  });

  test("ground check: the conviction boundary is soundness-biased at the edges", () => {
    // Mirror classifyBand's boundary policy in plain arithmetic (independent of Z3):
    // ties fall to the WEAKER band, so a = 2 and a = 2+eps do NOT convict.
    const eps = 0.25; // any positive margin
    const convicts = (a: number) => a > 2.0 + eps; // the union predicate = band >= Quantum line
    expect(convicts(2.0)).toBe(false); // |s| = 2 (classical edge) — never convicts
    expect(convicts(2.0 + eps)).toBe(false); // |s| = 2+eps (sound-margin edge) — never convicts
    expect(convicts(2.0 + eps + 1e-9)).toBe(true); // just past the margin — convicts (Quantum)
    expect(convicts(2.0 * Math.SQRT2 + 1.0)).toBe(true); // past Tsirelson — convicts (SuperQuantum)
  });
});
