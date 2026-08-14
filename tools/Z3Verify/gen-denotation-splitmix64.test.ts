// gen-denotation-splitmix64.test.ts — gates tools/Z3Verify/gen-denotation-splitmix64.smt2.
//
// WHY THIS EXISTS
// ---------------
// This file is the hand-written reference denotation proof — "the generated code's
// arithmetic == the hand-written oracle's arithmetic", over all 2^64 splitmix64 inputs and
// all 2^32 fmix32 inputs. Nothing executed it. `gen-smt2-from-ir.test.ts` checked only that
// it EXISTS (`expect(existsSync(...)).toBe(true)`), which is an assertion about the
// filesystem, not about the proof. Work-item 081KZYYKHX1087G0R0036E9RH9.
//
// Its six blocks were all expected `unsat`, and an all-unsat expectation is satisfied by a
// tautology: had `sm64_interp` been an accidental copy of `sm64_oracle`, THEOREM 1 would
// still print `unsat`. PART 3 of the .smt2 now adds two probes that corrupt one constant
// (VP1) and one shift width (VP2) on the generated side and require a counterexample — so
// the `unsat`s are equivalence results and not artefacts of the encoding.
//
// The emitter's own falsifiability leg (gen-smt2-from-ir.test.ts, "a corrupted IR makes the
// proof FALSIFIABLE") already did this for GENERATED proofs. This brings the committed
// hand-written reference up to the same standard.
//
// Run: `bun test tools/Z3Verify/gen-denotation-splitmix64.test.ts`

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

const FILE = "gen-denotation-splitmix64.smt2";

// LEMMA 1 | THEOREM 1 | CONTROL 1 | LEMMA 2 | THEOREM 2 | CONTROL 2 | VP1 | VP2
const EXPECTED = ["unsat", "unsat", "unsat", "unsat", "unsat", "unsat", "sat", "sat"] as const;

test("the lemma file is structurally intact (push/pop balanced, every block checked)", () => {
  const s = structureOf(readLemma(FILE));
  expect(s.pushes).toBe(s.pops);
  expect(s.checks).toBe(EXPECTED.length);
});

test("the whole-script status annotation is absent (it contradicts a mixed sequence)", () => {
  // `(set-info :status unsat)` is a benchmark-level claim about the script. With the PART 3
  // probes returning sat, z3 raises `(error "... check annotation that says unsat")` on
  // those blocks — MEASURED, which is why the annotation was removed rather than argued about.
  // Match only an ACTIVE command at line start — the removal note in the file quotes the
  // annotation inside a `;` comment, and a naive substring check flagged its own explanation.
  expect(readLemma(FILE)).not.toMatch(/^\(set-info\s+:status/m);
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
  "NON-VACUITY: both denotation theorems discriminate (VP1, VP2 are sat)",
  () => {
    if (!z3Available) {
      console.warn("  [skip] z3 not on PATH — non-vacuity leg not run");
      return;
    }
    const seq = z3Verdicts(readLemma(FILE));
    expect(seq[6]).toBe("sat"); // corrupted splitmix64 multiplier IS caught
    expect(seq[7]).toBe("sat"); // corrupted fmix32 shift width IS caught
  },
  SOLVER_TEST_TIMEOUT_MS,
);

test(
  "FALSIFIER: un-corrupting VP1 turns this runner red",
  () => {
    if (!z3Available) {
      console.warn("  [skip] z3 not on PATH — falsifier leg not run");
      return;
    }
    // Restore the correct multiplier in the mutant. VP1 becomes THEOREM 1 again — a tautology
    // of the proof — and flips to unsat, taking the sequence to all-unsat.
    const undone = mutate(
      readLemma(FILE),
      "(define-fun K0_MUT () (_ BitVec 64) #x9e3779b97f4a7c14)",
      "(define-fun K0_MUT () (_ BitVec 64) #x9e3779b97f4a7c15)",
    );
    const seq = z3Verdicts(undone);
    expect(seq[6]).toBe("unsat");
    expect(seq).not.toEqual([...EXPECTED]);
  },
  SOLVER_TEST_TIMEOUT_MS,
);

// A SECOND falsifier — mutating a real constant so the THEOREM blocks themselves flip —
// was written, RUN, and then removed on cost, which is worth recording rather than
// silently dropping. Measured with z3 4.16.0 on this machine:
//   * corrupt the fmix32 oracle constant (#x85ebca6b -> #x85ebca6a): the sequence does flip
//     to `unsat unsat unsat sat sat sat sat sat` — correct, and it takes 14.7s;
//   * corrupt a committed CONTROL vector: flips correctly in 2.5s.
// Both exceed, or sit uncomfortably near, bun's per-test budget. Counterexample search over
// a 2^32/2^64 bitvector space is simply expensive, and a falsifier that makes the gate flaky
// costs more than it proves. The VP1 leg above is the same demonstration at 0.04s, and VP1
// and VP2 are themselves permanent in-file THEOREM-with-a-corrupted-constant queries.
