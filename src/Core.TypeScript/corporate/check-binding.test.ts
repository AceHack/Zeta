/**
 * check-binding.test.ts — which checks answer a gate, and how a verdict survives the process.
 *
 * Two seams that are easy to build and easy to leave unwired:
 *
 *   - a BINDING that resolves to nothing, so a gate reports itself configured and verifies nothing;
 *   - a FOLD that does not pick up the fact the runtime writes, so every run re-runs every check
 *     and the tree-keyed reuse — the entire reason the tree is recorded — never happens.
 *
 * Both are the reader-with-no-writer shape, which is why each is asserted against the other side
 * rather than on its own.
 */

import { describe, expect, test } from "bun:test";
import { checkIdsFor, checkKey, CheckOutcome, type CheckBinding } from "./check-roster";
import { foldCheckResults } from "./org-fold";
import type { OrgEvent } from "./org-event";

const TREE_A = "a".repeat(40);
const TREE_B = "b".repeat(40);

describe("A BINDING RESOLVES TO THE CHECKS SOMEBODY CHOSE", () => {
  const global: CheckBinding = { gate: "implementation_review", checkIds: ["arity", "ambient-time"] };
  const scoped: CheckBinding = { gate: "implementation_review", checkIds: ["house-rules"], scopeWorkId: "proj-1" };

  test("with no binding, a gate resolves to no checks", () => {
    // Which `runRoster` then refuses to call clean — so "unbound" cannot become "verified".
    expect(checkIdsFor([], "implementation_review")).toEqual([]);
  });

  test("an organization-wide binding applies everywhere", () => {
    expect(checkIdsFor([global], "implementation_review")).toEqual(["arity", "ambient-time"]);
    expect(checkIdsFor([global], "implementation_review", ["proj-9"])).toEqual(["arity", "ambient-time"]);
  });

  test("a binding for another gate does not leak into this one", () => {
    expect(checkIdsFor([global], "qa_uat")).toEqual([]);
  });

  test("a SCOPED binding REPLACES the global one for work under it", () => {
    // Unioning them would run both, which is the opposite of what "this project follows a
    // different pipeline" means — and it would make a narrower binding strictly additive, so an
    // operator could never remove a check for one project.
    expect(checkIdsFor([global, scoped], "implementation_review", ["proj-1"])).toEqual(["house-rules"]);
  });

  test("...and leaves work outside its scope on the global one", () => {
    expect(checkIdsFor([global, scoped], "implementation_review", ["proj-2"])).toEqual(["arity", "ambient-time"]);
  });

  test("two bindings at the same scope are merged without duplicates", () => {
    const also: CheckBinding = { gate: "implementation_review", checkIds: ["arity", "reason-truth"] };
    expect(checkIdsFor([global, also], "implementation_review")).toEqual(["arity", "ambient-time", "reason-truth"]);
  });
});

describe("A VERDICT SURVIVES THE PROCESS THAT PRODUCED IT", () => {
  const recorded = (over: Partial<Extract<OrgEvent["fact"], { kind: "check_result" }>> = {}): OrgEvent =>
    ({
      id: `e-${Math.random().toString(36).slice(2)}`,
      atMs: 1,
      kind: "change_projected",
      subjectId: "task-1",
      supervisorChain: [],
      decision: "check ran",
      fact: {
        kind: "check_result",
        workId: "task-1",
        checkId: "arity",
        tree: TREE_A,
        outcome: CheckOutcome.Passed,
        exitCode: 0,
        detail: "clean",
        durationMs: 12,
        falsifierPassed: true,
        ...over,
      },
    }) as unknown as OrgEvent;

  test("a recorded result comes back under its tree-and-check key", () => {
    const folded = foldCheckResults([recorded()]);
    const found = folded.get(checkKey(TREE_A, "arity"));
    expect(found?.outcome).toBe(CheckOutcome.Passed);
    expect(found?.tree).toBe(TREE_A);
    expect(found?.falsifierPassed).toBe(true);
  });

  test("the SAME check on a different tree is a different key", () => {
    // The property the whole design rests on: changed content cannot claim an old verdict.
    const folded = foldCheckResults([recorded()]);
    expect(folded.get(checkKey(TREE_B, "arity"))).toBeUndefined();
  });

  test("a later verdict for the same tree and check REPLACES the earlier one", () => {
    // A check re-run against the same tree after somebody fixed the check itself must report what
    // it says now, not what it said when it was broken.
    const folded = foldCheckResults([
      recorded(),
      recorded({ outcome: CheckOutcome.Failed, detail: "found something", falsifierPassed: true }),
    ]);
    expect(folded.get(checkKey(TREE_A, "arity"))?.outcome).toBe(CheckOutcome.Failed);
  });

  test("an UNPROVEN verdict round-trips as unproven, not as a pass", () => {
    // If the fold flattened this to `passed`, every check with no falsifier would come back from
    // the log as evidence — the distinction would hold for exactly one process lifetime.
    const folded = foldCheckResults([recorded({ outcome: CheckOutcome.Unproven, falsifierPassed: false })]);
    expect(folded.get(checkKey(TREE_A, "arity"))?.outcome).toBe(CheckOutcome.Unproven);
  });

  test("a run with no check facts folds to nothing, not to an empty pass", () => {
    expect(foldCheckResults([]).size).toBe(0);
  });

  test("other facts in the log are ignored", () => {
    const other = { id: "x", atMs: 1, kind: "work_item_transition", subjectId: "t", supervisorChain: [], decision: "d" } as unknown as OrgEvent;
    expect(foldCheckResults([other, recorded()]).size).toBe(1);
  });
});
