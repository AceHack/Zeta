/**
 * handoff-report.test.ts — a run that merged nothing never says it merged.
 */

import { describe, expect, test } from "bun:test";

import { awaitingHumanReview, describeChangeLine } from "./handoff-report";

const changes = [{ workId: "task-024" }, { workId: "task-040" }, { workId: "task-7" }];

describe("A CHANGE IN FRONT OF PEOPLE IS REPORTED AS SUCH", () => {
  test("MEASURED: a follow-up on an earlier handoff counts, though this run handed nothing off anew", () => {
    // The agentic-tpm run of 2026-09-11: zero handoffs of its own, three follow-ups, banner DELIVERED.
    const awaiting = awaitingHumanReview({
      changes,
      handedOffThisRun: [],
      handedOffOnRecord: new Set(["task-024", "task-040"]),
      landed: [],
    });
    expect(awaiting).toEqual(["task-024", "task-040"]);
  });

  test("a handoff from another run of the same store is not claimed, and a landed change is not awaiting anyone", () => {
    const awaiting = awaitingHumanReview({
      changes,
      handedOffThisRun: ["task-7"],
      handedOffOnRecord: new Set(["task-024", "task-999"]),
      landed: ["task-7"],
    });
    expect(awaiting).toEqual(["task-024"]);
  });

  test("the line says awaiting review and ends in the handoff, never in Merge", () => {
    const line = describeChangeLine({ workId: "task-040", state: "Merged", applied: ["Claim", "OpenPr", "Approve", "Merge"] }, ["task-040"]);
    expect(line).toBe("task-040: awaiting human review - nothing was merged   (Claim → OpenPr → Approve → HandOff)");
    expect(line).not.toContain("Merged");
  });

  test("a change the organization did merge keeps its own state", () => {
    const line = describeChangeLine({ workId: "task-7", state: "Merged", applied: ["Approve", "Merge"] }, []);
    expect(line).toBe("task-7: Merged   (Approve → Merge)");
  });
});
