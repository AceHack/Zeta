// gen-smt2-from-ir.test.ts — generator-fidelity self-test for the parameterised
// Z3 QF_BV denotation-proof emitter (gen-smt2-from-ir.ts).
//
// WHY THIS EXISTS
// ---------------
// gen-smt2-from-ir.ts reads a zeta-ir-v{1,2,3} finaliser row and EMITS the .smt2
// denotation-preservation proof for it. This test proves the emitter is real, not
// a green that cannot turn red:
//   1. it emits a structurally-well-formed proof (balanced parens, the LEMMA /
//      THEOREM / CONTROL skeleton) for EVERY IR row on the registry;
//   2. when z3 is on PATH, every emitted proof discharges all-`unsat`
//      (LEMMA + THEOREM + CONTROL) — the proof is SOUND;
//   3. CORRUPTING the IR (one constant) makes the emitted proof go `sat` — the
//      proof is FALSIFIABLE (a green that cannot turn red is a Sybil green).
//
// z3 is run opportunistically: if it is absent (some CI runners), legs (2)/(3)
// soft-skip with a logged note, but the emit + structural legs always run.
//
// Run: `bun test tools/Z3Verify/gen-smt2-from-ir.test.ts`

import { expect, test } from "bun:test";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { parseIrJson, loadVectors, emitSmt2 } from "./gen-smt2-from-ir.ts";

const XV = join(import.meta.dir, "..", "..", "tests", "cross-verification");

// every committed registry row (IR + sibling vectors.yaml byte-lock)
const ROWS = ["splitmix64", "fmix32", "fmix64", "nasam", "xoshiro256ss"] as const;

const irPathOf = (g: string): string => join(XV, g, "_gen", `${g}.ir.json`);

function parenBalance(s: string): number {
  let depth = 0;
  for (const line of s.split("\n")) {
    const code = line.replace(/;.*$/, ""); // strip line comments
    for (const ch of code) {
      if (ch === "(") depth++;
      else if (ch === ")") depth--;
    }
  }
  return depth;
}

const z3Available = (() => {
  const probe = spawnSync("z3", ["--version"], { encoding: "utf8" });
  return probe.status === 0;
})();

/** Run z3 on proof text; return the sequence of check-sat verdicts. */
function z3Verdicts(smt2: string): string[] {
  const r = spawnSync("z3", ["-in"], { input: smt2, encoding: "utf8" });
  // (set-info :status ...) makes z3 print an `(error ...)` on a mismatched verdict;
  // collect the bare sat/unsat/unknown tokens in order.
  return r.stdout.match(/\b(unsat|sat|unknown)\b/g) ?? [];
}

for (const g of ROWS) {
  test(`emits a well-formed proof for ${g}`, () => {
    const ir = parseIrJson(readFileSync(irPathOf(g), "utf8"));
    const proof = emitSmt2(ir, loadVectors(irPathOf(g)));

    expect(proof).toContain("(set-logic QF_BV)");
    expect(proof).toContain("THEOREM");
    expect(proof).toContain("CONTROL"); // every registry row carries a vectors.yaml
    expect(parenBalance(proof)).toBe(0); // balanced s-expressions
  });

  test(`z3 discharges all-unsat for ${g}`, () => {
    if (!z3Available) {
      console.warn(`  [skip] z3 not on PATH — soundness leg for ${g} not run`);
      return;
    }
    const ir = parseIrJson(readFileSync(irPathOf(g), "utf8"));
    const proof = emitSmt2(ir, loadVectors(irPathOf(g)));
    const verdicts = z3Verdicts(proof);
    expect(verdicts.length).toBeGreaterThanOrEqual(2); // THEOREM + CONTROL at minimum
    for (const v of verdicts) expect(v).toBe("unsat");
  });
}

test("a corrupted IR makes the proof FALSIFIABLE (CONTROL goes sat)", () => {
  if (!z3Available) {
    console.warn("  [skip] z3 not on PATH — falsifiability leg not run");
    return;
  }
  // flip one digit of a splitmix64 multiplier; the byte-lock CONTROL must reject it.
  const text = readFileSync(irPathOf("splitmix64"), "utf8");
  const corrupted = text.replace("-7046029254386353131", "-7046029254386353130");
  expect(corrupted).not.toBe(text);
  const ir = parseIrJson(corrupted);
  const proof = emitSmt2(ir, loadVectors(irPathOf("splitmix64")));
  const verdicts = z3Verdicts(proof);
  expect(verdicts).toContain("sat"); // at least one check now fails — the green can turn red
});

// guard: the committed hand-written reference proof still exists alongside the emitter.
test("hand-written reference proof is present", () => {
  expect(existsSync(join(import.meta.dir, "gen-denotation-splitmix64.smt2"))).toBe(true);
});
