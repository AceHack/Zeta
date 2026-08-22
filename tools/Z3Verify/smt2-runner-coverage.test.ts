// smt2-runner-coverage.test.ts — every `.smt2` in this directory is EXECUTED by a runner,
// or listed with a written reason. No silent omissions.
//
// WHY THIS EXISTS
// ---------------
// Work-item 081KZYYKHX1087G0R0036E9RH9 fixed nine lemma files one at a time. Fixing
// instances does not close a class: the next `.smt2` added here will arrive with no runner
// unless something refuses it. That is exactly how five of the nine got into the tree — and
// how `light-time-endpoint-speed-envelope.smt2`, the z3 certificate for a theorem shipped as
// PROVED, sat unexecuted.
//
// So this is the standing check, the same shape as `hygiene/unexecuted-test-files.ts` and
// `lean-orphan-modules.ts`:
//
//   for every tools/Z3Verify/*.smt2
//     either a companion <stem>.test.ts exists,
//     or registry/unexecuted-smt2-lemmas.json carries an entry with a NON-EMPTY reason.
//
// The reason field is load-bearing. An allow-list without reasons is a place to hide things.
//
// AND the companion must assert a verdict SEQUENCE, not a uniform verdict. A runner that
// expects all-`unsat` is satisfied by a tautology, which is the defect this whole work-item
// is about; a new runner written in that shape would otherwise pass this coverage check
// while being exactly as blind as the ones it replaced.
//
// Run: `bun test tools/Z3Verify/smt2-runner-coverage.test.ts`

import { expect, test } from "bun:test";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const DIR = import.meta.dir;
const ALLOWLIST = join(DIR, "..", "..", "registry", "unexecuted-smt2-lemmas.json");
const SOLVER_FLOOR = join(DIR, "..", "..", "registry", "smt2-solver-floor.json");

interface AllowRow {
  readonly path: string;
  readonly reason: string;
}

const lemmas = readdirSync(DIR)
  .filter((f) => f.endsWith(".smt2"))
  .sort();

const allowed: readonly AllowRow[] = JSON.parse(readFileSync(ALLOWLIST, "utf8"));

test("there are lemma files to cover (the check itself is not vacuous)", () => {
  // A coverage check over an empty set passes trivially. Guard it.
  expect(lemmas.length).toBeGreaterThan(0);
});

test("every allow-list entry names a real file and carries a non-empty reason", () => {
  for (const row of allowed) {
    expect(existsSync(join(DIR, "..", "..", row.path))).toBe(true);
    expect(row.reason.trim().length).toBeGreaterThan(0);
  }
});

test("the solver-floor file is gone — CI pins modern solvers instead of skipping", () => {
  // 081KZZ27KJ8. A floor that skips a certificate is a hole. After #10783 put
  // z3 4.16.0 / cvc5 1.3.4 on the TS-suite runner (MEASURED: light-time 11-verdict
  // sequence passed in 44ms on run 31888161507), the skip is furniture. This
  // assertion is the latch: a reintroduced floor file is a regression.
  expect(existsSync(SOLVER_FLOOR)).toBe(false);
});

test("every .smt2 has a companion runner, or a reasoned allow-list entry", () => {
  const excused = new Set(allowed.map((r) => r.path));
  const uncovered: string[] = [];

  for (const lemma of lemmas) {
    const companion = `${lemma.slice(0, -".smt2".length)}.test.ts`;
    if (existsSync(join(DIR, companion))) continue;
    if (excused.has(`tools/Z3Verify/${lemma}`)) continue;
    uncovered.push(lemma);
  }

  expect(uncovered).toEqual([]);
});

test("no companion runner asserts a UNIFORM verdict — a tautology satisfies all-unsat", () => {
  // The defect, stated mechanically. A runner whose expectation is a list of identical
  // verdicts cannot distinguish a proof from a restatement. Every runner here must expect a
  // sequence containing at least one `sat` — the non-vacuity probe.
  const offenders: string[] = [];

  for (const lemma of lemmas) {
    const companion = `${lemma.slice(0, -".smt2".length)}.test.ts`;
    const path = join(DIR, companion);
    if (!existsSync(path)) continue;
    const text = readFileSync(path, "utf8");

    // The EXPECTED array literal is the contract each runner declares.
    const decl = /const EXPECTED = \[([\s\S]*?)\] as const;/.exec(text);
    const body = decl?.[1];
    if (body === undefined) {
      offenders.push(`${companion}: no EXPECTED verdict sequence declared`);
      continue;
    }
    const verdicts = [...body.matchAll(/"(sat|unsat|unknown)"/g)].map((m) => m[1]);
    if (verdicts.length === 0) {
      offenders.push(`${companion}: EXPECTED declares no verdicts`);
    } else if (!verdicts.includes("sat")) {
      offenders.push(`${companion}: EXPECTED is all-${verdicts[0]} — no non-vacuity probe`);
    }
  }

  expect(offenders).toEqual([]);
});
