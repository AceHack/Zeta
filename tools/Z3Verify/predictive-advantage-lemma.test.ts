// predictive-advantage-lemma.test.ts — gates tools/Z3Verify/predictive-advantage-lemma.smt2.
//
// WHY THIS EXISTS
// ---------------
// This lemma had NO runner of any kind. Nothing in CI executed it, so it was text.
// Work-item 081KZYYKHX1087G0R0036E9RH9.
//
// FIRST-RUN FINDING (2026-08-13): it parses and it discharges. z3 4.16.0 and cvc5 1.3.4
// both return `unsat` for the theorem — predictive (offline) scheduling never dissipates
// more than online, given W(τ) = floor + L²/τ. Not vacuous, not false. It was however
// written as a single flat query with global assertions, so the retrofit scoped it and
// added the two ablation probes below.
//
//   P1  the theorem                                          unsat
//   V1  P1 with `τ_pred ≥ τ_online` ABLATED                    sat
//   V2  P1 with `L² > 0` ABLATED (L² allowed negative)         sat
//
// V1 is the probe that matters: τ_pred ≥ τ_online IS the content of "prediction buys time",
// and if it stopped doing work the theorem would be a restatement of the cost formula.
//
// Run: `bun test tools/Z3Verify/predictive-advantage-lemma.test.ts`

import { expect, test } from "bun:test";
import {
  cvc5Available,
  cvc5Verdicts,
  mutate,
  readLemma,
  structureOf,
  z3Available,
  z3Verdicts,
  SOLVER_TEST_TIMEOUT_MS,
} from "./smt2-solvers.ts";

const FILE = "predictive-advantage-lemma.smt2";

const EXPECTED = ["unsat", "sat", "sat"] as const;

test("the lemma file is structurally intact (push/pop balanced, every block checked)", () => {
  const s = structureOf(readLemma(FILE));
  expect(s.pushes).toBe(s.pops);
  expect(s.checks).toBe(EXPECTED.length);
});

test(
  "z3 and cvc5 independently produce the expected verdict sequence (BP-16)",
  () => {
    if (!z3Available && !cvc5Available) {
      console.warn("  [skip] z3 and cvc5 not on PATH — solver legs not run");
      return;
    }
    const text = readLemma(FILE);
    if (z3Available) expect(z3Verdicts(text)).toEqual([...EXPECTED]);
    if (cvc5Available) expect(cvc5Verdicts(text)).toEqual([...EXPECTED]);
  },
  SOLVER_TEST_TIMEOUT_MS,
);

test(
  "NON-VACUITY: both hypotheses are load-bearing (V1 and V2 are sat)",
  () => {
    if (!z3Available) {
      console.warn("  [skip] z3 not on PATH — non-vacuity leg not run");
      return;
    }
    const seq = z3Verdicts(readLemma(FILE));
    expect(seq[0]).toBe("unsat");
    expect(seq[1]).toBe("sat"); // drop τ_pred ≥ τ_online and the advantage is false
    expect(seq[2]).toBe("sat"); // let L² go negative and the advantage reverses
  },
  SOLVER_TEST_TIMEOUT_MS,
);

test(
  "FALSIFIER: restoring the ablated window ordering turns this runner red",
  () => {
    if (!z3Available) {
      console.warn("  [skip] z3 not on PATH — falsifier leg not run");
      return;
    }
    // Put `τ_pred ≥ τ_online` back into V1. The probe becomes P1 — a tautology of the proof —
    // and flips to unsat. This is the exact shape of the landauer defect that started this
    // work-item: a premise that silently already contains the conclusion.
    const planted = mutate(
      readLemma(FILE),
      "(assert wellPosed)\n(assert (> (+ floor (/ L_sq tau_pred)) (+ floor (/ L_sq tau_online))))\n(check-sat)   ; expect: sat",
      "(assert wellPosed)\n(assert (>= tau_pred tau_online))\n(assert (> (+ floor (/ L_sq tau_pred)) (+ floor (/ L_sq tau_online))))\n(check-sat)   ; expect: sat",
    );
    const seq = z3Verdicts(planted);
    expect(seq[1]).toBe("unsat");
    expect(seq).not.toEqual([...EXPECTED]);
  },
  SOLVER_TEST_TIMEOUT_MS,
);

test(
  "FALSIFIER: reversing the theorem's inequality turns P1 sat",
  () => {
    if (!z3Available) {
      console.warn("  [skip] z3 not on PATH — falsifier leg not run");
      return;
    }
    // Claim the OPPOSITE — that the online scheduler is the cheaper one. P1 must find a
    // counterexample, proving the block is testing the claim and not the shape of the file.
    const reversed = mutate(
      readLemma(FILE),
      "(assert (>= tau_pred tau_online))   ; predictive scheduler has MORE time",
      "(assert (<= tau_pred tau_online))   ; MUTANT: predictive scheduler has LESS time",
    );
    const seq = z3Verdicts(reversed);
    expect(seq[0]).toBe("sat");
    expect(seq).not.toEqual([...EXPECTED]);
  },
  SOLVER_TEST_TIMEOUT_MS,
);
