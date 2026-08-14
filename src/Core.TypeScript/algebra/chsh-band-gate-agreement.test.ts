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
 *
 * WHAT CHANGED, 2026-08-13 (work-item 081KZYYKHX1087G0R0036E9RH9). The pattern quoted above
 * — "shells `z3 <file>` and asserts unsat" — turned out to be the defect, portfolio-wide: an
 * `unsat` expectation is satisfied by a TAUTOLOGY, so a lemma whose premises contain its
 * conclusion goes green while proving nothing. The .smt2 now carries a non-vacuity probe (V:
 * the theorem with `eps >= 0` ablated, expected `sat`) and returns a verdict SEQUENCE.
 *
 * The STRICT sequence, the mutation legs, and the falsifier proof live in the canonical
 * runner tools/Z3Verify/chsh-band-gate-agreement-lemma.test.ts. This file keeps the two
 * properties that make it a gate and does not restate the sequence, so the two cannot drift.
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

  test("Z3 discharges the biconditional (band>=Quantum ⇔ |s|>2+eps), and it is not vacuous", () => {
    if (!z3Available()) {
      console.log("  ⚠ z3 not available — skipping execution");
      return;
    }
    const raw = execSync(`z3 ${SMT_FILE}`, { encoding: "utf-8", timeout: 10000 });
    const verdicts = raw
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l === "sat" || l === "unsat" || l === "unknown");

    expect(verdicts[0]).toBe("unsat"); // G1 — the gate and the predicate never disagree
    // V — with `eps >= 0` ablated they CAN disagree. Without a `sat` in the list this
    // assertion would be indistinguishable from one made against a tautology.
    expect(verdicts).toContain("sat");
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
