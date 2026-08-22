// externality-bound-lemma.test.ts — gates tools/Z3Verify/externality-bound-lemma.smt2.
//
// WHY THIS EXISTS
// ---------------
// This lemma had NO runner. Work-item 081KZYYKHX1087G0R0036E9RH9.
//
// FIRST-RUN FINDING (2026-08-13): it parses, it runs in under a second, and every block
// returns exactly what its header comment predicts, under z3 4.16.0 AND cvc5 1.3.4. No
// vacuity, no drift, nothing to file. It needed a runner, not a repair.
//
// NOTE ON WHAT THIS FILE IS. Unusually for this directory, the lemma is not a proof that
// shipped code is correct — it is a machine-checked EXHIBIT of the degeneracies of
// `externalitySafe()` reading (a). Two of its eight blocks are deliberately `sat`
// (L3 and L4 are witnesses to the degeneracy), which is why it already had a non-vacuous
// verdict sequence before this work-item touched anything: the sat blocks are the finding.
// Retrofitting a probe here would be adding a probe to a file that already carries two.
//
//   L1 unsat  floor ∈ [0,1] always
//   L2 unsat  safeA is vacuously true for every delta ≥ 0
//   L3 sat    harm tolerance equals the bystander's score (witness)
//   L4 sat    the shipped predicate calls a 0.7-below-floor outcome safe (witness)
//   L5 unsat  protection inversion is structural, not a bug
//   L6 unsat  antitone in harm — the one good property (a) has
//   L7 unsat  reading (b) collapses to `delta ≥ 0`
//   L8 unsat  reading (c) subsumes (a) at tau=0 and (b) at tau=floor
//
// Run: `bun test tools/Z3Verify/externality-bound-lemma.test.ts`

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

const FILE = "externality-bound-lemma.smt2";

const EXPECTED = ["unsat", "unsat", "sat", "sat", "unsat", "unsat", "unsat", "unsat"] as const;

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
  "NON-VACUITY: the degeneracy witnesses L3 and L4 are sat",
  () => {
    if (!z3Available) {
      console.warn("  [skip] z3 not on PATH — non-vacuity leg not run");
      return;
    }
    const seq = z3Verdicts(readLemma(FILE));
    // The sequence is not all-unsat by construction: L3 and L4 are the two findings this file
    // exists to record. A file that went all-unsat here would have LOST its content, and that
    // is the failure this assertion catches.
    expect(seq[2]).toBe("sat");
    expect(seq[3]).toBe("sat");
    expect(seq.filter((v) => v === "sat")).toHaveLength(2);
  },
  SOLVER_TEST_TIMEOUT_MS,
);

test(
  "FALSIFIER: repairing the degeneracy L4 exhibits turns this runner red",
  () => {
    if (!z3Available) {
      console.warn("  [skip] z3 not on PATH — falsifier leg not run");
      return;
    }
    // Swap the shipped predicate (a) for reading (c) at tau = floor — the reading that would
    // NOT call a 0.7-below-floor outcome safe. L4's witness vanishes and it flips to unsat.
    // Two things this proves: the runner asserts a SEQUENCE and not a uniform verdict, and
    // L4 genuinely depends on which predicate is encoded.
    const repaired = mutate(
      readLemma(FILE),
      "(assert (safeA floor delta))                       ; shipped predicate says SAFE",
      "(assert (>= (+ floor (negpart delta)) floor))      ; MUTANT: reading (b)/(c) at tau=floor",
    );
    const seq = z3Verdicts(repaired);
    expect(seq[3]).toBe("unsat");
    expect(seq).not.toEqual([...EXPECTED]);
  },
  SOLVER_TEST_TIMEOUT_MS,
);

test(
  "FALSIFIER: breaking harm-antitonicity turns L6 sat",
  () => {
    if (!z3Available) {
      console.warn("  [skip] z3 not on PATH — falsifier leg not run");
      return;
    }
    // L6 is the ONE good property reading (a) has, and the header asks that any replacement
    // keep it. Reverse the ordering hypothesis and L6 must report a counterexample —
    // otherwise it would be an assertion that could not fail.
    const broken = mutate(readLemma(FILE), "(assert (<= d1 d2))", "(assert (>= d1 d2))");
    const seq = z3Verdicts(broken);
    expect(seq[5]).toBe("sat");
    expect(seq).not.toEqual([...EXPECTED]);
  },
  SOLVER_TEST_TIMEOUT_MS,
);
