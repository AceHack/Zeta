// correction-zset.test.ts — falsifiers for retractable correction membership.
//
// Claims that pass vacuously if tested lazily:
//   1. "it is a Z-set." A Map-backed set that treats observe as upsert would
//      stay size 1 on a second observe. Weight 2 is the group, not a set.
//   2. "retract undoes." Deleting the payload while leaving membership +1
//      would look retracted to a payload reader and still be present.
//   3. "repair is not the key." Two FIX strings on one violation must share id.

import { describe, expect, test } from "bun:test";
import { addLabels, labelsFor, type CorpusRow } from "./labelled-observation.ts";
import { fromLintFinding, lintFindingId } from "./from-lint-finding.ts";
import {
  emptyLog,
  membershipWeight,
  observe,
  present,
  retract,
  teaching,
} from "./correction-zset.ts";

const rowOf = (over: { detail?: string; fix?: string; file?: string }): CorpusRow => {
  const finding = {
    rule: "exists-then-read",
    file: over.file ?? "src/x.ts",
    signature: "existsSync(p)->readFileSync(p)",
    detail: over.detail ?? "stat then use",
    ...(over.fix !== undefined ? { fix: over.fix } : {}),
  };
  const { row } = fromLintFinding({
    finding,
    assertedBy: "test",
    at: 1,
  });
  if (row === null) throw new Error("fixture seed refused");
  return row;
};

describe("observe is +1, not upsert", () => {
  test("a second observe of the same hub doubles membership", () => {
    const row = rowOf({ fix: "delete the check" });
    const once = observe(emptyLog(), row);
    const twice = observe(once, row);
    expect(membershipWeight(once, row.observation.id)).toBe(1);
    expect(membershipWeight(twice, row.observation.id)).toBe(2);
    expect(present(twice)).toHaveLength(1);
  });
});

describe("retract is −1 and drops the satellite at 0", () => {
  test("observe then retract returns to empty present()", () => {
    const row = rowOf({ fix: "delete the check" });
    const log = retract(observe(emptyLog(), row), row.observation.id);
    expect(membershipWeight(log, row.observation.id)).toBe(0);
    expect(present(log)).toEqual([]);
    expect(log.rows.size).toBe(0);
  });

  test("retract of an absent id is a negative weight, not an invented hub", () => {
    const id = lintFindingId({
      rule: "r",
      file: "a.ts",
      signature: "s",
      detail: "d",
    });
    const log = retract(emptyLog(), id);
    expect(membershipWeight(log, id)).toBe(-1);
    expect(present(log)).toEqual([]);
    expect(log.rows.size).toBe(0);
  });
});

describe("repair is a satellite, not the Z-set key", () => {
  test("two FIX strings on one violation share observation.id and coexist", () => {
    const a = rowOf({ fix: "delete the check" });
    const b = rowOf({ fix: "delete the check AND interpret ENOENT" });
    expect(a.observation.id).toBe(b.observation.id);
    const log = observe(observe(emptyLog(), a), b);
    expect(present(log)).toHaveLength(1);
    const repairs = labelsFor(present(log)[0]!, { namespace: "lint", name: "repair" });
    const byOrdinal = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
    expect(repairs.map((l) => l.value).sort(byOrdinal)).toEqual(
      ["delete the check", "delete the check AND interpret ENOENT"].sort(byOrdinal),
    );
  });
});

describe("teaching vs present", () => {
  test("failure-only is present and not teaching — absence of repair is the fact", () => {
    const row = rowOf({});
    const log = observe(emptyLog(), row);
    expect(present(log)).toHaveLength(1);
    expect(teaching(log)).toHaveLength(0);
    expect(labelsFor(present(log)[0]!, { namespace: "lint", name: "repair" })).toHaveLength(0);
  });

  test("a teaching row is present AND teaching", () => {
    const log = observe(emptyLog(), rowOf({ fix: "use the REST spelling" }));
    expect(teaching(log)).toHaveLength(1);
  });
});

describe("identical re-observe does not duplicate labels", () => {
  test("the same assertion twice is one label, two weights", () => {
    const row = rowOf({ fix: "delete the check" });
    const log = observe(observe(emptyLog(), row), row);
    expect(membershipWeight(log, row.observation.id)).toBe(2);
    expect(labelsFor(present(log)[0]!, { namespace: "lint", name: "repair" })).toHaveLength(1);
  });
});

describe("addLabels still refuses collapse", () => {
  test("there is no winner-picker on the log", () => {
    const a = rowOf({ fix: "A" });
    const b = rowOf({ fix: "B" });
    const log = observe(observe(emptyLog(), a), b);
    const row = present(log)[0]!;
    const again = addLabels(row, []);
    expect(again.row.labels.filter((l) => l.key.name === "repair")).toHaveLength(2);
  });
});
