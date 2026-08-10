import { describe, expect, test } from "bun:test";
import { auditFile, stripLeanComments } from "./audit-proof-closure-claims";

describe("stripLeanComments", () => {
  test("preserves line numbering so reported marker lines are the real ones", () => {
    const src = "theorem a : True := by\n-- a comment\n  trivial\n";
    expect(stripLeanComments(src).split("\n").length).toBe(src.split("\n").length);
  });

  test("removes line comments but keeps code on the same line", () => {
    expect(stripLeanComments("  trivial -- sorry").trim()).toBe("trivial");
  });

  test("removes NESTED block comments (Lean nests; a naive scanner reopens code early)", () => {
    const src = "before\n/- outer /- inner sorry -/ still comment -/\nafter";
    const out = stripLeanComments(src);
    expect(out).not.toContain("sorry");
    expect(out).toContain("before");
    expect(out).toContain("after");
  });

  test("strips /-! doc blocks", () => {
    expect(stripLeanComments("/-! doc sorry -/\ncode")).not.toContain("sorry");
  });
});

describe("auditFile — the contradiction, and only the contradiction", () => {
  test("THE LIVE CASE: prose says closed, code carries sorry", () => {
    const src = [
      "/-! - The ECC proof chain is CLOSED: no axiom, no sorry, non-vacuous. -/",
      "theorem t : True := by",
      "  sorry",
    ].join("\n");
    const f = auditFile("X.lean", src);
    expect(f).not.toBeNull();
    expect(f!.markers.map((m) => m.kind)).toContain("sorry");
    expect(f!.markers[0]!.line).toBe(3);
    expect(f!.claims.map((c) => c.kind)).toContain("chain-closed");
  });

  test("the claim sentence's OWN word 'sorry' is not counted as a marker", () => {
    // Without comment-stripping this file would flag itself — the reason this
    // cannot be a grep.
    const src = "/-! closed: no sorry here -/\ntheorem t : True := trivial";
    expect(auditFile("X.lean", src)).toBeNull();
  });

  test("an honest sorry with no closure claim is NOT drift", () => {
    const src = ["/-! OPEN: pending mechanization. -/", "theorem t : True := by", "  sorry"].join(
      "\n",
    );
    expect(auditFile("X.lean", src)).toBeNull();
  });

  test("a closure claim with a genuinely discharged proof is NOT drift", () => {
    const src = "/-! no sorry, fully proven -/\ntheorem t : True := trivial";
    expect(auditFile("X.lean", src)).toBeNull();
  });

  test("catches `axiom` declarations against a no-axiom claim", () => {
    const src = "/-! axiom-free -/\naxiom cheat : False";
    const f = auditFile("X.lean", src);
    expect(f).not.toBeNull();
    expect(f!.markers.map((m) => m.kind)).toContain("axiom");
  });

  test("catches `admit`", () => {
    const src = "/-! no sorry -/\ntheorem t : True := by\n  admit";
    expect(auditFile("X.lean", src)?.markers.map((m) => m.kind)).toContain("admit");
  });

  test("does not fire on identifiers that merely contain a marker word", () => {
    const src = "/-! no sorry -/\ndef sorryAx' := 1\ndef my_admit_helper := 2";
    expect(auditFile("X.lean", src)).toBeNull();
  });

  test("does not treat the word 'axiom' in prose-like code positions as a declaration", () => {
    // `axiom` must be followed by a declaration name to count.
    const src = "/-! axiom-free -/\ndef f := 1 -- axiom";
    expect(auditFile("X.lean", src)).toBeNull();
  });

  test("an OPEN note does not launder a closure claim elsewhere in the file", () => {
    // The live file had BOTH: an honest OPEN header and a later CLOSED block.
    // The contradiction must still be reported.
    const src = [
      "/- OPEN: needs the minimal polynomial computation. -/",
      "/-! The proof chain is CLOSED. -/",
      "theorem t : True := by",
      "  sorry",
    ].join("\n");
    expect(auditFile("X.lean", src)).not.toBeNull();
  });
});

describe("precision — the false positives found on the first real run", () => {
  test("an inductive CONSTRUCTOR named `admit` is not a marker (ChildFloor.lean)", () => {
    const src = [
      "/-! All proven, no `sorry`. -/",
      "inductive Verdict where",
      "  | admit",
      "  | deny",
    ].join("\n");
    expect(auditFile("ChildFloor.lean", src)).toBeNull();
  });

  test("a claim SCOPED to an enumerated set is not contradicted (FinDataProcessing.lean)", () => {
    const src = [
      "/-! SORRY-FREE (axioms = propext only) — 13 declarations: -/",
      "theorem open_one : True := by",
      "  sorry",
    ].join("\n");
    expect(auditFile("F.lean", src)).toBeNull();
  });

  test("a HISTORICAL narration is not a present-tense claim", () => {
    const src = "/-! The file contained no `sorry` either. -/\ntheorem t : True := by\n  sorry";
    expect(auditFile("F.lean", src)).toBeNull();
  });

  test("but an unscoped claim still fires even when the marker is declared in place", () => {
    // The live PhaseClockErasure shape: honest NOTE at the marker, false claim above.
    const src = [
      "/-! The ECC proof chain is CLOSED: no axiom, no sorry. -/",
      "/-- NOTE: recorded as sorry pending mechanization; OPEN. -/",
      "theorem t : True := by",
      "  sorry",
    ].join("\n");
    const f = auditFile("P.lean", src);
    expect(f).not.toBeNull();
    expect(f!.markers[0]!.declared).toBe(true);
    expect(f!.claims.some((c) => !c.scoped)).toBe(true);
  });
});
