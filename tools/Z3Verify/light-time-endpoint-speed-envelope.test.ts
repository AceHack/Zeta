// light-time-endpoint-speed-envelope.test.ts
//   gates tools/Z3Verify/light-time-endpoint-speed-envelope.smt2.
//
// WHY THIS EXISTS
// ---------------
// This is the z3 certificate for the PROVED orbital light-time asymmetry envelope (#10418),
// and NOTHING executed it. Work-item 081KZYYKHX1087G0R0036E9RH9.
//
// FIRST-RUN VERDICT (2026-08-13, z3 4.16.0): the file is CLEAN. It parses, it discharges in
// under 0.1s, and it returns EXACTLY the sequence its own header predicts —
//   `unsat unsat unsat unsat unsat unsat unsat unsat sat sat sat`
// eight proved lemmas, then a sharpness witness and two hypothesis-necessity witnesses.
// Nothing is vacuous, nothing is false, nothing needed repair. It needed a runner.
//
// Worth stating plainly because the question is the obvious one to ask: the property was
// never at risk either way. `src/Core.Lean4/Lean4/LightTimeAsymmetry.lean` proves it
// independently and IS gated, so even had this half turned out vacuous the theorem would
// still have stood on Lean. What was missing was the second leg of the cross-check, not the
// result.
//
// Notably this file was ALREADY non-vacuous by construction, before this work-item existed:
// blocks R1 and R2 are hypothesis-necessity probes — each drops one hypothesis and asks z3
// to break the envelope, expecting `sat`. That is the discipline the rest of the portfolio
// was missing, written by the same author who wrote the ones that were missing it. Which is
// the useful lesson: the practice existed; what did not exist was anything that RAN it.
//
// CVC5 IS NOT A CROSS-CHECK HERE — MEASURED, NOT ASSUMED. cvc5 1.3.4 does not return on this
// file: killed at 120s with no verdict printed. QF_NRA sharpness witnesses over a degree-4
// polynomial system are z3's nlsat fragment; cvc5 grinds. So the BP-16 second tool for this
// property is the Lean proof, exactly as the .smt2 header says — not a second SMT solver.
// Running cvc5 here anyway would convert a 0.1s gate into a 20s timeout for no information.
//
// Run: `bun test tools/Z3Verify/light-time-endpoint-speed-envelope.test.ts`

import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  mutate,
  readLemma,
  structureOf,
  z3Available,
  z3Verdicts,
  SOLVER_TEST_TIMEOUT_MS,
} from "./smt2-solvers.ts";

const FILE = "light-time-endpoint-speed-envelope.smt2";

// L0a L0b | L1 L2 L3 L4 | M1 M2 | S1 (sharpness) | R1 R2 (hypothesis necessity)
const EXPECTED = ["unsat", "unsat", "unsat", "unsat", "unsat", "unsat", "unsat", "unsat", "sat", "sat", "sat"] as const;

function skipNote(leg: string): void {
  console.warn(`  [skip] ${leg}: z3 not on PATH — nothing was checked by this leg`);
}

test("the lemma file is structurally intact (push/pop balanced, every block checked)", () => {
  const s = structureOf(readLemma(FILE));
  expect(s.pushes).toBe(s.pops);
  expect(s.checks).toBe(EXPECTED.length);
});

test(
  "z3 produces the expected verdict sequence",
  () => {
    if (!z3Available) {
      skipNote("verdict sequence");
      return;
    }
    expect(z3Verdicts(readLemma(FILE))).toEqual([...EXPECTED]);
  },
  SOLVER_TEST_TIMEOUT_MS,
);

test("the Lean cross-check the header names is present (BP-16 second tool)", () => {
  // The .smt2 header states its own soundness caveat: z3's nlsat emits no independently
  // checkable certificate, so `unsat` here is a decision-procedure verdict and the
  // machine-checked leg lives in Lean. If that file ever moved or was deleted, this proof
  // would quietly become the only leg — so the pairing is asserted, not assumed.
  const lean = join(import.meta.dir, "..", "..", "src", "Core.Lean4", "Lean4", "LightTimeAsymmetry.lean");
  expect(existsSync(lean)).toBe(true);
  expect(readLemma(FILE)).toContain("LightTimeAsymmetry.lean");
});

test(
  "NON-VACUITY: the envelope is SHARP and its hypotheses are load-bearing",
  () => {
    if (!z3Available) {
      skipNote("non-vacuity");
      return;
    }
    const seq = z3Verdicts(readLemma(FILE));
    expect(seq[8]).toBe("sat"); // S1 — equality is attained, so the bound has zero slack
    expect(seq[9]).toBe("sat"); // R1 — Cauchy-Schwarz |u.v| <= ||v|| is load-bearing
    expect(seq[10]).toBe("sat"); // R2 — V must bound the speed over the WHOLE light-time interval
  },
  SOLVER_TEST_TIMEOUT_MS,
);

test(
  "FALSIFIER: restoring R2's ablated hypothesis turns this runner red",
  () => {
    if (!z3Available) {
      skipNote("falsifier");
      return;
    }
    // R2 exists to show that a declared speed bound must hold across the whole light-time
    // interval, not merely at the transmit epoch. Put `wB <= VB` back and R2 becomes M1 — a
    // tautology of the proof — and flips to unsat.
    const planted = mutate(
      readLemma(FILE),
      "(assert (> wB VB)) (assert (< wB c))       ; <-- VB no longer bounds wB",
      "(assert (<= wB VB)) (assert (< wB c))",
    );
    const seq = z3Verdicts(planted);
    expect(seq[10]).toBe("unsat");
    expect(seq).not.toEqual([...EXPECTED]);
  },
  SOLVER_TEST_TIMEOUT_MS,
);

test(
  "FALSIFIER: tightening the envelope past sharpness turns M1 sat",
  () => {
    if (!z3Available) {
      skipNote("falsifier");
      return;
    }
    // S1 proves the envelope is ATTAINED, so any strictly tighter bound must be refutable.
    // Halve the right-hand side of M1 and z3 must produce the counterexample — which is what
    // makes the S1/M1 pair a real sharpness result rather than two independent assertions.
    // This is also the direct check on the claim #10418 rests on: no multiplicative margin
    // above 1 is justified by this model.
    const tightened = mutate(
      readLemma(FILE),
      "(assert (not (<= (* (- tAB tBA) (- c VB) (+ c VA)) (* R (+ VA VB)))))\n(check-sat)   ; expect unsat\n(pop 1)",
      "(assert (not (<= (* (- tAB tBA) (- c VB) (+ c VA)) (* 0.5 (* R (+ VA VB))))))\n(check-sat)   ; MUTANT: bound halved\n(pop 1)",
    );
    const seq = z3Verdicts(tightened);
    expect(seq[6]).toBe("sat");
    expect(seq).not.toEqual([...EXPECTED]);
  },
  SOLVER_TEST_TIMEOUT_MS,
);
