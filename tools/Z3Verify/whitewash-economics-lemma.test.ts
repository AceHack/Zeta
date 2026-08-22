// whitewash-economics-lemma.test.ts — gates tools/Z3Verify/whitewash-economics-lemma.smt2.
//
// WHY THIS EXISTS
// ---------------
// This lemma had NO runner. Work-item 081KZYYKHX1087G0R0036E9RH9.
//
// FIRST-RUN FINDING (2026-08-13): parses, discharges in under a second, and every block
// returns what its header predicts under z3 4.16.0 AND cvc5 1.3.4. Nothing to repair.
//
// Like externality-bound, this file already carried a non-vacuous sequence before the
// work-item: W2 and W4 are deliberate `sat` refutation witnesses. That is not an accident
// of style — it is what a file whose PURPOSE is to bound a claim looks like. It proves the
// true theorem (W1, W3, W5) and exhibits the false part of the claim (W2, W4).
//
//   W1 unsat  trustBand < ½ ⟺ mu < 0 — the closed form the docs were missing
//   W2 sat    a strictly profitable whitewash EXISTS (TRL-31/32 as stated is false)
//   W3 unsat  a hit strictly raises mu, a miss strictly lowers it
//   W4 sat    the deterrent is anti-correlated with need
//   W5 unsat  the shipped tests assert whitewash profitability under a name denying it
//
// ONE WEAKNESS FOUND, RECORDED AND NOT REPAIRED (2026-08-13, MEASURED not inferred).
// W2's `sat` does NOT depend on its `mu < 0` hypothesis: flipping it to `mu > 0` still
// returns `sat`. The reason is in the file's own encoding decision — the SAT goals get only
// the finite monotonicity INSTANCES they need, not the quantified axiom, so the link from
// `mu < 0` to `Phi(mu/d) < Phi(0)` is hand-asserted rather than derived. The instance is
// sound (W1 proves the biconditional WITH full monotonicity, and W1 is the theorem doing the
// work), so W2 is a legitimate witness — but it is a witness whose sign is carried by an
// assertion, and it would return `sat` for the wrong population too.
//
// I have NOT edited the lemma to make this go away. Weakening or strengthening a claim to
// suit its runner is the same defect with a fresh coat; fixing the encoding is Soraya's call
// as the author. What this runner does is refuse to pretend: the falsifier legs below target
// W1 and W3, the two blocks whose hypotheses genuinely bite, and this note is the register.
//
// Run: `bun test tools/Z3Verify/whitewash-economics-lemma.test.ts`

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

const FILE = "whitewash-economics-lemma.smt2";

const EXPECTED = ["unsat", "sat", "unsat", "sat", "unsat"] as const;

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
  "NON-VACUITY: the refutation witnesses W2 and W4 are sat",
  () => {
    if (!z3Available) {
      console.warn("  [skip] z3 not on PATH — non-vacuity leg not run");
      return;
    }
    const seq = z3Verdicts(readLemma(FILE));
    expect(seq[1]).toBe("sat"); // a profitable whitewash exists
    expect(seq[3]).toBe("sat"); // deterrent anti-correlated with need
    expect(seq.filter((v) => v === "sat")).toHaveLength(2);
  },
  SOLVER_TEST_TIMEOUT_MS,
);

test(
  "FALSIFIER: ablating `v > 0` turns W3 sat",
  () => {
    if (!z3Available) {
      console.warn("  [skip] z3 not on PATH — falsifier leg not run");
      return;
    }
    // W3 — "a hit strictly raises mu, a miss strictly lowers it" — rests on the Mills ratio
    // v = phi(t)/Phi(t) being strictly positive. Drop it and v = 0 leaves mu unmoved on a hit,
    // so the sign claim fails and W3 must report the counterexample.
    const ablated = mutate(
      readLemma(FILE),
      "(assert (> v 0.0))                                  ; v(t) = phi(t)/Phi(t) > 0",
      "; MUTANT: `v > 0` ablated",
    );
    const seq = z3Verdicts(ablated);
    expect(seq[2]).toBe("sat");
    expect(seq).not.toEqual([...EXPECTED]);
  },
  SOLVER_TEST_TIMEOUT_MS,
);

test(
  "FALSIFIER: dropping strict monotonicity of Phi turns W1 sat",
  () => {
    if (!z3Available) {
      console.warn("  [skip] z3 not on PATH — falsifier leg not run");
      return;
    }
    // W1 is the file's theorem, and it rests entirely on Phi being strictly monotone —
    // the abstraction that lets the result hold for the exact normal CDF and every monotone
    // approximation of it. Ablate that axiom and W1 must produce a counterexample.
    const ablated = mutate(
      readLemma(FILE),
      "(push)\n(assert PhiMonotone)\n(declare-const mu Real) (declare-const s2 Real) (declare-const d Real)",
      "(push)\n(declare-const mu Real) (declare-const s2 Real) (declare-const d Real)",
    );
    const seq = z3Verdicts(ablated);
    expect(seq[0]).toBe("sat");
    expect(seq).not.toEqual([...EXPECTED]);
  },
  SOLVER_TEST_TIMEOUT_MS,
);
