// consolidate-quadratic-envelope.test.ts — gates tools/Z3Verify/consolidate-quadratic-envelope.smt2.
//
// WHY THIS EXISTS
// ---------------
// The previous gate (src/Core.TypeScript/algebra/cost-envelope.test.ts) asserted the whole
// z3 output equalled `"unsat"`. That expectation is satisfied by a tautology, so it could
// not have caught a vacuous lemma. Work-item 081KZYYKHX1087G0R0036E9RH9.
//
// AN HONEST LIMIT, STATED UP FRONT. This lemma has NO load-bearing hypothesis, so the
// landauer-style ablation probe (drop the premise, watch it flip to sat) does not exist
// here — and that is a measured fact, not an omission: block V2 in the .smt2 records that
// dropping `n >= 0` leaves the claim unsat, because over the integers n(n-1) > 2n² reduces
// to n(n+1) < 0, which no integer satisfies. The bound is an absolute truth of integer
// arithmetic with a factor of 2 to spare.
//
// So the probe available here is weaker and differently shaped: V1 runs the SAME encoding
// against a bound that is genuinely FALSE (n(n-1)/2 ≤ n²/4, refuted at n = 3) and requires
// `sat`. That establishes the encoding discriminates — E1's `unsat` is a fact about the
// claim, not an artefact of a malformed term or a contradictory premise set. Weaker than an
// ablation, stronger than all-unsat, and said out loud rather than dressed up.
//
// Run: `bun test tools/Z3Verify/consolidate-quadratic-envelope.test.ts`

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

const FILE = "consolidate-quadratic-envelope.smt2";

// E1 unsat (the bound) | V1 sat (a tighter bound is false) | V2 unsat (n >= 0 does no work)
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
  "NON-VACUITY: the encoding can return sat, so E1's unsat is about the claim",
  () => {
    if (!z3Available) {
      console.warn("  [skip] z3 not on PATH — non-vacuity leg not run");
      return;
    }
    const seq = z3Verdicts(readLemma(FILE));
    expect(seq[1]).toBe("sat");
    expect(seq[0]).toBe("unsat");
  },
  SOLVER_TEST_TIMEOUT_MS,
);

test(
  "FALSIFIER: a FALSE bound in the theorem block turns this runner red",
  () => {
    if (!z3Available) {
      console.warn("  [skip] z3 not on PATH — falsifier leg not run");
      return;
    }
    // Replace the true bound n(n-1) ≤ 2n² with the false n(n-1) ≤ n. E1 must flip to sat —
    // proving the block tests the claim rather than merely printing unsat.
    const wrong = mutate(
      readLemma(FILE),
      "(assert (>= n 0))\n(assert (> (* n (- n 1)) (* 2 (* n n))))",
      "(assert (>= n 0))\n(assert (> (* n (- n 1)) n))",
    );
    const seq = z3Verdicts(wrong);
    expect(seq[0]).toBe("sat");
    expect(seq).not.toEqual([...EXPECTED]);
  },
  SOLVER_TEST_TIMEOUT_MS,
);

test(
  "FALSIFIER: weakening the probe back to a true bound turns this runner red",
  () => {
    if (!z3Available) {
      console.warn("  [skip] z3 not on PATH — falsifier leg not run");
      return;
    }
    // Make V1's tighter bound true again (back to the E1 constant). The probe stops being a
    // probe, the sequence goes all-unsat, and the runner must reject it — which is precisely
    // the state every pre-existing runner in this repo was permanently in.
    const weakened = mutate(
      readLemma(FILE),
      "(assert (> (* 2 (* n (- n 1))) (* n n)))",
      "(assert (> (* n (- n 1)) (* 2 (* n n))))",
    );
    const seq = z3Verdicts(weakened);
    expect(seq).toEqual(["unsat", "unsat", "unsat"]);
    expect(seq).not.toEqual([...EXPECTED]);
  },
  SOLVER_TEST_TIMEOUT_MS,
);
