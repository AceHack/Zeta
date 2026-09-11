/**
 * done-needs-evidence.test.ts — nothing is DONE without a passing verdict on the record.
 *
 * The requirement: to mark a work item done there must be recorded evidence that every gate it owes
 * passed. Not that a walk completed — that is this process's own belief and does not survive it —
 * but that the LOG carries a passing verdict for each gate in the item's chain.
 *
 * The distinction is the whole point. A run whose walk finished while a verdict failed to reach the
 * record would previously have marked the item done, and the cascade and the log would then
 * disagree about whether anything had ever been approved. Nobody reading the log afterwards could
 * tell which was right.
 */

import { describe, expect, test } from "bun:test";
import { chainFor, gatesComplete, missingGates } from "./gate-demand";
import { WorkType } from "./goal-cascade";
import { GateKind, GateOutcome, type GateEvaluation } from "./quality-gate";

function verdict(
  workId: string,
  gate: GateKind,
  outcome: GateOutcome = GateOutcome.Approved,
  atMs = 1_000,
): GateEvaluation {
  return { workId, gate, outcome, byHatId: "judge", reason: "because", atMs, evidenceRefs: [] };
}

const DEFECT = chainFor(WorkType.Defect);

describe("missing evidence is NAMED, not merely counted", () => {
  test("an item with no verdicts at all owes its whole chain", () => {
    expect(missingGates(WorkType.Defect, "T-1", [])).toEqual(DEFECT);
  });

  test("A PARTIAL RECORD NAMES EXACTLY WHAT IS ABSENT", () => {
    // A refusal that cannot say what it wants is one nobody can act on.
    const partial = DEFECT.slice(0, 2).map((g) => verdict("T-1", g));
    expect(missingGates(WorkType.Defect, "T-1", partial)).toEqual(DEFECT.slice(2));
  });

  test("a complete record leaves nothing missing", () => {
    const all = DEFECT.map((g) => verdict("T-1", g));
    expect(missingGates(WorkType.Defect, "T-1", all)).toEqual([]);
    expect(gatesComplete(WorkType.Defect, "T-1", all)).toBe(true);
  });
});

describe("only PASSING evidence counts", () => {
  test("a rejection is not evidence of passing", () => {
    const rejected = DEFECT.map((g) =>
      g === GateKind.QaUat ? verdict("T-1", g, GateOutcome.Rejected) : verdict("T-1", g),
    );
    expect(missingGates(WorkType.Defect, "T-1", rejected)).toEqual([GateKind.QaUat]);
  });

  test("changes requested is not evidence of passing either", () => {
    const changes = DEFECT.map((g) =>
      g === GateKind.QaUat ? verdict("T-1", g, GateOutcome.ChangesRequested) : verdict("T-1", g),
    );
    expect(missingGates(WorkType.Defect, "T-1", changes)).toEqual([GateKind.QaUat]);
  });

  test("a WAIVER counts — an authority deciding the gate does not apply is a real answer", () => {
    const waived = DEFECT.map((g) =>
      g === GateKind.QaUat ? verdict("T-1", g, GateOutcome.Waived) : verdict("T-1", g),
    );
    expect(missingGates(WorkType.Defect, "T-1", waived)).toEqual([]);
  });

  test("THE LATEST VERDICT DECIDES — an approval that was later rejected is not evidence", () => {
    const flipped = [
      ...DEFECT.map((g) => verdict("T-1", g, GateOutcome.Approved, 1_000)),
      verdict("T-1", GateKind.QaUat, GateOutcome.Rejected, 2_000),
    ];
    expect(missingGates(WorkType.Defect, "T-1", flipped)).toEqual([GateKind.QaUat]);
  });

  test("...and a rejection later re-approved IS evidence", () => {
    const repaired = [
      ...DEFECT.map((g) => verdict("T-1", g, GateOutcome.Approved, 1_000)),
      verdict("T-1", GateKind.QaUat, GateOutcome.Rejected, 2_000),
      verdict("T-1", GateKind.QaUat, GateOutcome.Approved, 3_000),
    ];
    expect(missingGates(WorkType.Defect, "T-1", repaired)).toEqual([]);
  });
});

describe("evidence belongs to the ITEM and to the TYPE", () => {
  test("ANOTHER ITEM'S VERDICTS ARE NOT THIS ONE'S EVIDENCE", () => {
    // Otherwise one thoroughly-reviewed task would mark every sibling done.
    const elsewhere = DEFECT.map((g) => verdict("OTHER", g));
    expect(missingGates(WorkType.Defect, "T-1", elsewhere)).toEqual(DEFECT);
  });

  test("passing gates the type does not owe proves nothing", () => {
    const wrongChain = [
      verdict("T-1", GateKind.BusinessContextGrooming),
      verdict("T-1", GateKind.CustomerRfpReview),
      verdict("T-1", GateKind.BrdApproval),
    ];
    expect(missingGates(WorkType.Defect, "T-1", wrongChain)).toEqual(DEFECT);
  });

  test("each type is judged against its OWN chain, for every type", () => {
    for (const workType of Object.values(WorkType)) {
      const owed = chainFor(workType);
      expect(missingGates(workType, "X", [])).toEqual(owed);
      expect(missingGates(workType, "X", owed.map((g) => verdict("X", g)))).toEqual([]);
    }
  });

  test("NO TYPE CAN BE DONE ON AN EMPTY CHAIN", () => {
    // `[].every()` is vacuously true, so a type owing nothing would be done having crossed
    // nothing. Every chain is non-empty by construction, and this is what keeps it that way.
    for (const workType of Object.values(WorkType)) {
      expect(chainFor(workType).length).toBeGreaterThan(0);
    }
  });
});
