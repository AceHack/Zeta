// from-lint-finding.test.ts — the falsifiers for the first correction-corpus collector.
//
// Claims that pass vacuously if tested lazily:
//   1. "failure-only findings do not grow a repair." A test that only feeds FIX: findings
//      never catches an invented default.
//   2. "the hub is the violation, not the fix." A test that hashes the whole finding
//      would mint a new observation every time someone edited the FIX prose.
//   3. "two repairs coexist." A last-write-wins adapter would look like a collector
//      and destroy the disagreement the labelled-observation type exists to keep.

import { describe, expect, test } from "bun:test";
import { addLabels, isContested, labelsFor } from "./labelled-observation.ts";
import { fromLintFinding, lintFindingId, type LintFindingSeed } from "./from-lint-finding.ts";
import * as MODULE from "./from-lint-finding.ts";

const seed = (over: Partial<LintFindingSeed> = {}): LintFindingSeed => ({
  rule: "exists-then-read",
  file: "src/Core.TypeScript/hygiene/example.ts",
  signature: "existsSync(p)->readFileSync(p)",
  detail: "stat then use of the same path",
  ...over,
});

const teaching = (): LintFindingSeed =>
  seed({
    fix: 'Delete the check and perform the operation, interpreting its failure: try { readFileSync(p, "utf8") } catch (e) { if (e.code === "ENOENT") ...; else throw e }. One syscall, one answer, no window.',
  });

describe("failure-only findings do not grow a repair", () => {
  test("a finding with no fix emits lint/rule and lint/path, never lint/repair", () => {
    const { row, why } = fromLintFinding({ finding: seed(), assertedBy: "lint-check-then-use-file-races", at: 4 });
    expect(why).toBeNull();
    expect(row).not.toBeNull();
    if (row === null) return;
    expect(labelsFor(row, { namespace: "lint", name: "rule" })).toHaveLength(1);
    expect(labelsFor(row, { namespace: "lint", name: "path" })).toHaveLength(1);
    expect(labelsFor(row, { namespace: "lint", name: "repair" })).toHaveLength(0);
  });

  test("whitespace-only fix is ABSENT, not a repair label", () => {
    const { row } = fromLintFinding({ finding: seed({ fix: "   " }), assertedBy: "lint-x", at: 0 });
    expect(row).not.toBeNull();
    if (row === null) return;
    expect(labelsFor(row, { namespace: "lint", name: "repair" })).toHaveLength(0);
  });

  test("this module does not emit an erasure verdict — absence of repair is the fact", () => {
    // Dual-use: detection is the missing satellite, not a `lint/erasure` label
    // that would smuggle a morality the substrate is not allowed to hold.
    const { row } = fromLintFinding({ finding: seed(), assertedBy: "lint-x", at: 1 });
    expect(row).not.toBeNull();
    if (row === null) return;
    expect(row.labels.map((l) => l.key.name).sort()).toEqual(["path", "rule"]);
  });
});

describe("a FIX: is the repair satellite, not the hub", () => {
  test("a teaching finding carries lint/repair with the exact FIX prose", () => {
    const finding = teaching();
    const { row } = fromLintFinding({ finding, assertedBy: "lint-check-then-use-file-races", at: 4 });
    expect(row).not.toBeNull();
    if (row === null) return;
    const repairs = labelsFor(row, { namespace: "lint", name: "repair" });
    expect(repairs).toHaveLength(1);
    expect(repairs[0]?.value).toBe(finding.fix);
  });

  test("editing the FIX prose does not change observation.id", () => {
    const a = seed({ fix: "delete the check" });
    const b = seed({ fix: "delete the check AND interpret ENOENT" });
    expect(lintFindingId(a)).toBe(lintFindingId(b));
    const ra = fromLintFinding({ finding: a, assertedBy: "otto", at: 1 }).row;
    const rb = fromLintFinding({ finding: b, assertedBy: "otto", at: 2 }).row;
    expect(ra?.observation.id).toBe(rb?.observation.id);
  });

  test("editing the DETAIL does change observation.id — the hub is the violation", () => {
    const a = seed({ detail: "stat then use" });
    const b = seed({ detail: "exists then use" });
    expect(lintFindingId(a)).not.toBe(lintFindingId(b));
  });
});

describe("two repairs coexist — this adapter does not pick a winner", () => {
  test("two asserters teaching different repairs both survive on one observation", () => {
    const first = fromLintFinding({
      finding: seed({ fix: "delete the check" }),
      assertedBy: "lint-check-then-use-file-races",
      at: 1,
    }).row;
    expect(first).not.toBeNull();
    if (first === null) return;
    const { row } = addLabels(first, [
      {
        key: { namespace: "lint", name: "repair" },
        value: "leave the check, it is a documented TOCTOU with a comment",
        assertedBy: "human",
        at: 2,
      },
    ]);
    expect(isContested(row, { namespace: "lint", name: "repair" })).toBe(true);
    expect(labelsFor(row, { namespace: "lint", name: "repair" })).toHaveLength(2);
  });

  test("no resolve/collapse helper is exported from this adapter either", () => {
    const exported = Object.keys(MODULE);
    for (const forbidden of ["resolvedLabel", "winningLabel", "consensus", "resolve", "collapse"]) {
      expect(exported).not.toContain(forbidden);
    }
  });
});

describe("refusals are data; ticks are supplied", () => {
  test("empty detail refuses the hub rather than minting a vacuous observation", () => {
    const r = fromLintFinding({ finding: seed({ detail: "  " }), assertedBy: "lint-x", at: 0 });
    expect(r.row).toBeNull();
    expect(r.why).toMatch(/detail is empty/);
  });

  test("unattributed asserter is refused", () => {
    const r = fromLintFinding({ finding: seed(), assertedBy: "", at: 0 });
    expect(r.row).toBeNull();
    expect(r.why).toMatch(/no asserter/);
  });

  test("the same inputs fold byte-identical — no wall-clock in the row", () => {
    const a = fromLintFinding({ finding: teaching(), assertedBy: "lint-x", at: 3 });
    const b = fromLintFinding({ finding: teaching(), assertedBy: "lint-x", at: 3 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(JSON.stringify(a)).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
  });
});
