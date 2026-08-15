// chsh-band-gate-agreement-lemma.test.ts — gates tools/Z3Verify/chsh-band-gate-agreement-lemma.smt2.
//
// WHY THIS EXISTS
// ---------------
// The previous gate (src/Core.TypeScript/algebra/chsh-band-gate-agreement.test.ts) shelled
// `z3 <file>` and asserted the whole output equalled `"unsat"`. That check cannot fail on a
// vacuous lemma: an `unsat` expectation is satisfied by a TAUTOLOGY, so a lemma whose
// premises contain its conclusion goes green while proving nothing.
// Work-item 081KZYYKHX1087G0R0036E9RH9; reference implementation landauer-floor-lemma.test.ts.
//
// The lemma file now carries two blocks:
//   G1  the theorem      — expect unsat
//   V   non-vacuity probe — G1 with `eps >= 0` ABLATED — expect sat
// and both share the `disagree` / `unionPredicate` definitions, so a mutation that turned
// the theorem into a restatement propagates into the probe and flips it.
//
// Run: `bun test tools/Z3Verify/chsh-band-gate-agreement-lemma.test.ts`

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

const FILE = "chsh-band-gate-agreement-lemma.smt2";

// G1 unsat | V sat (non-vacuity probe: the valid-domain hypothesis is ablated)
const EXPECTED = ["unsat", "sat"] as const;

test("the lemma file is structurally intact (push/pop balanced, every block checked)", () => {
  const s = structureOf(readLemma(FILE));
  expect(s.pushes).toBe(s.pops);
  expect(s.checks).toBe(EXPECTED.length);
});

test(
  "z3 and cvc5 independently produce the expected verdict sequence (BP-16)",
  () => {
    if (!z3Available && !cvc5Available) {
      console.warn("  [skip] no solver on this host can decide the file — legs not run");
      return;
    }
    const text = readLemma(FILE);
    if (z3Available) expect(z3Verdicts(text)).toEqual([...EXPECTED]);
    if (cvc5Available) expect(cvc5Verdicts(text)).toEqual([...EXPECTED]);
  },
  SOLVER_TEST_TIMEOUT_MS,
);

test(
  "NON-VACUITY: `eps >= 0` is load-bearing, so G1 is a theorem and not a restatement",
  () => {
    if (!z3Available) {
      console.warn("  [skip] z3 not on PATH — non-vacuity leg not run");
      return;
    }
    const seq = z3Verdicts(readLemma(FILE));
    // The sat at index 1 is the ablation: drop `eps >= 0` and the gate CAN disagree with the
    // union predicate. An all-unsat sequence would pass a naive runner forever; this is the
    // leg the old runner could not have.
    expect(seq[1]).toBe("sat");
    expect(seq[0]).toBe("unsat");
  },
  SOLVER_TEST_TIMEOUT_MS,
);

test(
  "FALSIFIER: restoring the ablated hypothesis turns this runner red",
  () => {
    if (!z3Available) {
      console.warn("  [skip] z3 not on PATH — falsifier leg not run");
      return;
    }
    // Put `eps >= 0` back into the probe. The probe becomes G1 again — a tautology of the
    // proof, trivially unsat — and the sequence stops matching. A probe never seen to fail is
    // a probe one is guessing about.
    const planted = mutate(
      readLemma(FILE),
      "(assert (not validDomain))   ; <-- the ABLATED hypothesis, negated",
      "(assert validDomain)",
    );
    const seq = z3Verdicts(planted);
    expect(seq).toEqual(["unsat", "unsat"]);
    expect(seq).not.toEqual([...EXPECTED]);
  },
  SOLVER_TEST_TIMEOUT_MS,
);

test(
  "FALSIFIER: collapsing the theorem into a restatement turns this runner red",
  () => {
    if (!z3Available) {
      console.warn("  [skip] z3 not on PATH — falsifier leg not run");
      return;
    }
    // The exact defect this lane exists to catch: make the conclusion literally the premise.
    // `unionPredicate := convicts` makes G1 prove `X <=> X`. G1 still says unsat — no verdict
    // check on an unsat block can catch that — but because the probe SHARES the definition,
    // V collapses to unsat too, and the sequence assertion fires.
    const collapsed = mutate(
      readLemma(FILE),
      "(define-fun unionPredicate () Bool (> a (+ 2.0 eps)))",
      "(define-fun unionPredicate () Bool convicts)",
    );
    const seq = z3Verdicts(collapsed);
    expect(seq).toEqual(["unsat", "unsat"]);
    expect(seq).not.toEqual([...EXPECTED]);
  },
  SOLVER_TEST_TIMEOUT_MS,
);
