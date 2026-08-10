import { describe, expect, test } from "bun:test";
import { extractPaths, sorryLines } from "./audit-lean-ci-coverage";

const TYPECHECK_RE = /lake\s+env\s+lean\s+([A-Za-z0-9_./-]+\.lean)/g;
const AXIOM_AUDIT_RE = /cat\s+([A-Za-z0-9_./-]+\.lean)\s+-/g;

describe("extractPaths — reading the hand-maintained lists out of the workflow", () => {
  test("picks up every `lake env lean <file>` step", () => {
    const wf = [
      "        run: lake env lean Lean4/DbspChainRule.lean",
      "        run: lake env lean ImaginaryStack/ToyModel.lean",
    ].join("\n");
    const got = extractPaths(wf, TYPECHECK_RE);
    expect(got.has("Lean4/DbspChainRule.lean")).toBe(true);
    expect(got.has("ImaginaryStack/ToyModel.lean")).toBe(true);
    expect(got.size).toBe(2);
  });

  test("the /tmp/ audit target is NOT mistaken for an audited source file", () => {
    // `lake env lean /tmp/toymodel_axiom_audit.lean` is the generated probe, not a proof.
    const wf = "run: lake env lean /tmp/toymodel_axiom_audit.lean";
    expect(extractPaths(wf, TYPECHECK_RE).size).toBe(0);
  });

  test("`cat <file> -` marks a file as axiom-audited", () => {
    const wf = "| cat ImaginaryStack/ErasureDistance.lean - > /tmp/erasure_axiom_audit.lean";
    const got = extractPaths(wf, AXIOM_AUDIT_RE);
    expect(got.has("ImaginaryStack/ErasureDistance.lean")).toBe(true);
    expect(got.has("/tmp/erasure_axiom_audit.lean")).toBe(false);
  });

  test("a file that is type-checked but NOT axiom-audited is distinguishable", () => {
    // The distinction is the whole point: `lake env lean` only WARNS on sorry.
    const wf = "run: lake env lean Lean4/Foo.lean";
    expect(extractPaths(wf, TYPECHECK_RE).has("Lean4/Foo.lean")).toBe(true);
    expect(extractPaths(wf, AXIOM_AUDIT_RE).has("Lean4/Foo.lean")).toBe(false);
  });
});

describe("sorryLines — code only", () => {
  test("finds a real sorry and reports its 1-indexed line", () => {
    expect(sorryLines("theorem t : True := by\n  sorry\n")).toEqual([2]);
  });

  test("ignores `sorry` written in a comment", () => {
    expect(sorryLines("/-! no sorry here -/\ntheorem t : True := trivial")).toEqual([]);
  });

  test("ignores an inductive constructor named `admit`", () => {
    expect(sorryLines("inductive Verdict where\n  | admit\n  | deny")).toEqual([]);
  });

  test("ignores identifiers that merely contain the token", () => {
    expect(sorryLines("def sorryAx' := 1\ndef my_admit := 2")).toEqual([]);
  });

  test("finds `admit` used as a tactic", () => {
    expect(sorryLines("theorem t : True := by\n  admit")).toEqual([2]);
  });

  test("reports every occurrence, not just the first", () => {
    expect(sorryLines("by\n  sorry\nby\n  sorry")).toEqual([2, 4]);
  });
});
