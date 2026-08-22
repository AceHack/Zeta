// privacy-budget-net-positive-regime-lemma.test.ts
//   gates tools/Z3Verify/privacy-budget-net-positive-regime-lemma.smt2.
//
// WHY THIS EXISTS
// ---------------
// This lemma had NO runner. Work-item 081KZYYKHX1087G0R0036E9RH9.
//
// FIRST-RUN FINDING (2026-08-13). It parses and LEMMA 2 discharges `unsat` under both z3
// 4.16.0 and cvc5 1.3.4 — the claimed result (the net-positive privacy-earning regime
// always closes) is reproduced. But the file as committed was a SINGLE `unsat`, and that is
// the exact shape that cannot be told apart from vacuity: every hypothesis sat at global
// scope, so one sign error in `(assert (>= (eps K) B))` would have made the refutation
// unsatisfiable FOR FREE while the runner reported a proof.
//
// THE CONSISTENCY CHECK DOES NOT TERMINATE — MEASURED, AND IT IS WHY THE PROBE IS SHAPED
// THE WAY IT IS. Asking either solver to model the axioms directly (`(check-sat)` with no
// goal) gives: z3 `timeout` at -T:20 — and the timeout then ABORTS the rest of the script,
// so LEMMA 2's verdict never prints — and cvc5 `unknown`. Model construction over quantified
// uninterpreted functions is the direction the file's own header already records as
// intractable, twice (LEMMA 1 and LEMMA 3).
//
// So the retrofit did two things, neither of which touches LEMMA 2's statement:
//   * scoped the uninterpreted axioms in (push)/(pop), so the witness blocks are decidable;
//   * committed LEMMA 1's witness as a runnable query (V1) plus V2, which checks the witness
//     family really does satisfy the axioms it stands in for.
//
//   LEMMA 2  unsat   the regime always closes
//   V1       sat     a net-positive point exists in the witness family (= LEMMA 1, committed)
//   V2       unsat   the witness family satisfies b's monotonicity and boundedness
//
// STILL NOT ESTABLISHED, and this runner does not pretend otherwise: LEMMA 3 (no re-entry)
// remains unresolved, and nothing here shows any REAL (eps, b) pair satisfies the
// hypotheses. The file says so; so does this.
//
// Run: `bun test tools/Z3Verify/privacy-budget-net-positive-regime-lemma.test.ts`

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

const FILE = "privacy-budget-net-positive-regime-lemma.smt2";

const EXPECTED = ["unsat", "sat", "unsat"] as const;

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
  "NON-VACUITY: a witness pair exists, so LEMMA 2 is not a statement about an empty regime",
  () => {
    if (!z3Available) {
      console.warn("  [skip] z3 not on PATH — non-vacuity leg not run");
      return;
    }
    const seq = z3Verdicts(readLemma(FILE));
    expect(seq[0]).toBe("unsat"); // the result
    expect(seq[1]).toBe("sat"); // the witness — the leg the committed file did not have
    expect(seq[2]).toBe("unsat"); // and the witness genuinely satisfies the axioms
  },
  SOLVER_TEST_TIMEOUT_MS,
);

test(
  "FALSIFIER: a witness family that never pays turns V1 unsat",
  () => {
    if (!z3Available) {
      console.warn("  [skip] z3 not on PATH — falsifier leg not run");
      return;
    }
    // Shrink the saturation ceiling from B = 10 to B = 1. Then b(t) = 1·t/(1+t) < 1 < t for
    // every t > 1 and b(t) < t everywhere on (0,∞), so no net-positive point exists and V1
    // flips to unsat. That is the honest failure mode of this whole model — a regime that never
    // opens — and the runner must go red when the witness stops witnessing.
    const starved = mutate(
      readLemma(FILE),
      "(assert (> (/ (* 10.0 tw) (+ 1.0 tw)) tw))   ; b(tw) > eps(tw): disclosure pays here",
      "(assert (> (/ (* 1.0 tw) (+ 1.0 tw)) tw))   ; MUTANT: B = 1, the regime never opens",
    );
    const seq = z3Verdicts(starved);
    expect(seq[1]).toBe("unsat");
    expect(seq).not.toEqual([...EXPECTED]);
  },
  SOLVER_TEST_TIMEOUT_MS,
);

test(
  "FALSIFIER: a non-saturating credit function turns V2 sat",
  () => {
    if (!z3Available) {
      console.warn("  [skip] z3 not on PATH — falsifier leg not run");
      return;
    }
    // Shannon saturation — b bounded above by B — is the load-bearing hypothesis on the credit
    // side, and the file names it as such. Replace the saturating b(t) = 10t/(1+t) with the
    // unbounded b(t) = 10t and V2 must find the violation.
    const unbounded = mutate(
      readLemma(FILE),
      "(assert (or (>= (/ (* 10.0 xw) (+ 1.0 xw)) (/ (* 10.0 yw) (+ 1.0 yw)))   ; not increasing\n            (>= (/ (* 10.0 xw) (+ 1.0 xw)) 10.0)))                        ; or not bounded",
      "(assert (or (>= (* 10.0 xw) (* 10.0 yw))   ; MUTANT: b(t) = 10t, no saturation\n            (>= (* 10.0 xw) 10.0)))",
    );
    const seq = z3Verdicts(unbounded);
    expect(seq[2]).toBe("sat");
    expect(seq).not.toEqual([...EXPECTED]);
  },
  SOLVER_TEST_TIMEOUT_MS,
);
