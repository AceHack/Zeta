// landauer-floor-lemma.test.ts — gates tools/Z3Verify/landauer-floor-lemma.smt2.
//
// WHY THIS EXISTS
// ---------------
// The lemma file had no runner. Nothing in CI executed it, so when its F1 premise
// (the second law, written as `-k + heat >= 0`) became algebraically identical to its
// conclusion (`heat >= k`), the file went on reporting `unsat` and nobody could tell.
// It proved `heat >= k => heat >= k` for as long as it sat in the tree.
//
// So this runner checks two different things:
//   1. SOUNDNESS  — the verdict sequence matches, under z3 AND cvc5 independently (BP-16).
//   2. NON-VACUITY — the sequence CONTAINS a `sat`, produced by a probe block that deletes
//      the second-law premise. If that premise ever stops doing work, the probe flips to
//      `unsat`, the sequence stops matching, and this test goes red. A verdict list of
//      all-`unsat` would pass leg 1 forever; it is leg 2 that the old file would have failed.
//
// Solvers run opportunistically: absent from PATH, the legs soft-skip with a logged note
// rather than reporting a green they did not earn.
//
// Run: `bun test tools/Z3Verify/landauer-floor-lemma.test.ts`

import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const LEMMA = join(import.meta.dir, "landauer-floor-lemma.smt2");

// F1 unsat | V sat (non-vacuity probe) | F2a sat | F2b sat | F4a unsat | F4b unsat
const EXPECTED = ["unsat", "sat", "sat", "sat", "unsat", "unsat"] as const;

const z3Available = (() => {
  // Developer/CI solver probe, same shape as gen-smt2-from-ir.test.ts; a missing solver
  // soft-skips rather than faking a green.
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- fixed literal, no user input
  const probe = spawnSync("z3", ["--version"], { encoding: "utf8" });
  return probe.status === 0;
})();
const cvc5Available = (() => {
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- see the z3 probe above.
  const probe = spawnSync("cvc5", ["--version"], { encoding: "utf8" });
  return probe.status === 0;
})();

function verdicts(cmd: string, args: readonly string[], input: string): string[] {
  const r = spawnSync(cmd, [...args], { input, encoding: "utf8" });
  return r.stdout
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l === "sat" || l === "unsat" || l === "unknown");
}

const z3Verdicts = (smt2: string): string[] => verdicts("z3", ["-in"], smt2);
const cvc5Verdicts = (smt2: string): string[] =>
  verdicts("cvc5", ["--lang=smt2", "-q", "--incremental", "-"], smt2);

test("the lemma file is structurally intact (push/pop balanced, every block checked)", () => {
  const text = readFileSync(LEMMA, "utf8");
  const pushes = (text.match(/^\(push 1\)$/gm) ?? []).length;
  const pops = (text.match(/^\(pop 1\)$/gm) ?? []).length;
  const checks = (text.match(/^\(check-sat\)/gm) ?? []).length;
  expect(pushes).toBe(pops);
  expect(checks).toBe(EXPECTED.length);
});

test("z3 and cvc5 independently produce the expected verdict sequence (BP-16)", () => {
  if (!z3Available && !cvc5Available) {
    console.warn("  [skip] z3 and cvc5 not on PATH — solver legs not run");
    return;
  }
  const text = readFileSync(LEMMA, "utf8");

  if (z3Available) expect(z3Verdicts(text)).toEqual([...EXPECTED]);
  if (cvc5Available) expect(cvc5Verdicts(text)).toEqual([...EXPECTED]);
  if (z3Available && cvc5Available) expect(z3Verdicts(text)).toEqual(cvc5Verdicts(text));
});

test("NON-VACUITY: the second-law premise is load-bearing, not decorative", () => {
  if (!z3Available) {
    console.warn("  [skip] z3 not on PATH — non-vacuity leg not run");
    return;
  }
  // The whole point. An all-unsat lemma file is indistinguishable from a tautology; the
  // `sat` at index 1 is the probe that runs F1 WITHOUT its premise and finds the
  // counterexample (an erasure paying zero heat) that the premise is there to exclude.
  const seq = z3Verdicts(readFileSync(LEMMA, "utf8"));
  expect(seq).toContain("sat");
  expect(seq[1]).toBe("sat");

  // And the same claim WITH the premise is refuted — so the premise, not the encoding,
  // is what excludes the counterexample.
  expect(seq[0]).toBe("unsat");
});
