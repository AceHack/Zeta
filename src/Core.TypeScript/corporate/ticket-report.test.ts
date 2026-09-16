/**
 * ticket-report.test.ts — a milestone reaches the ticket once, in order, and only when it passed.
 */

import { describe, expect, test } from "bun:test";
import { milestonesOwed, renderTicketComment, updateIsEmpty, validateTicketReports, type MilestoneVerdict } from "./ticket-report";

const GATES = ["architecture_approval", "implementation_review", "qa_uat", "release_readiness"];
const PASSING = ["approved", "waived"];
const NL = String.fromCharCode(10);

const verdict = (over: Partial<MilestoneVerdict>): MilestoneVerdict => ({
  workId: "task-012",
  gate: "architecture_approval",
  outcome: "approved",
  atMs: 1_000,
  ...over,
});

describe("WHAT THE TICKET IS OWED", () => {
  test("a milestone that passed and has not been reported is owed; one already reported is not", () => {
    const verdicts = [verdict({}), verdict({ gate: "implementation_review", atMs: 2_000 })];
    const first = milestonesOwed({ verdicts, reported: new Map(), milestones: GATES, passing: PASSING });
    expect(first.map((m) => m.gate)).toEqual(["architecture_approval", "implementation_review"]);

    const after = milestonesOwed({
      verdicts,
      reported: new Map([["task-012", new Set(["architecture_approval"])]]),
      milestones: GATES,
      passing: PASSING,
    });
    expect(after.map((m) => m.gate)).toEqual(["implementation_review"]);
  });

  test("A TURN-BACK IS NOT NEWS. Only a passing outcome reaches the ticket", () => {
    // MEASURED on the FlowDent store: 290 of 349 verdicts were rejections, one gate rejecting a
    // single item 81 times. The review loop iterates until clean; only the clean result is news.
    const verdicts = [
      verdict({ outcome: "changes_requested", atMs: 1_000 }),
      verdict({ outcome: "rejected", atMs: 2_000 }),
      verdict({ outcome: "changes_requested", atMs: 3_000 }),
    ];
    expect(milestonesOwed({ verdicts, reported: new Map(), milestones: GATES, passing: PASSING }).length).toBe(0);
    // ...and the pass that ends the loop is.
    const ended = milestonesOwed({
      verdicts: [...verdicts, verdict({ outcome: "approved", atMs: 4_000 })],
      reported: new Map(),
      milestones: GATES,
      passing: PASSING,
    });
    expect(ended.length).toBe(1);
    expect(ended[0]?.atMs).toBe(4_000);
  });

  test("a gate nobody named a milestone is silent, however it went", () => {
    const verdicts = [verdict({ gate: "peer_review" }), verdict({ gate: "cost_approval" })];
    expect(milestonesOwed({ verdicts, reported: new Map(), milestones: GATES, passing: PASSING }).length).toBe(0);
  });

  test("a gate that passed twice is owed ONE update, at the EARLIEST pass", () => {
    // The report says "this milestone is behind us", which becomes true once. A reopen that passes
    // again is not a second milestone.
    const owed = milestonesOwed({
      verdicts: [verdict({ atMs: 5_000 }), verdict({ atMs: 2_000 }), verdict({ atMs: 9_000 })],
      reported: new Map(),
      milestones: GATES,
      passing: PASSING,
    });
    expect(owed.length).toBe(1);
    expect(owed[0]?.atMs).toBe(2_000);
  });

  test("OLDEST FIRST: a run reporting three at once must not say QA finished before the architecture", () => {
    const owed = milestonesOwed({
      verdicts: [
        verdict({ gate: "qa_uat", atMs: 3_000 }),
        verdict({ gate: "architecture_approval", atMs: 1_000 }),
        verdict({ gate: "implementation_review", atMs: 2_000 }),
      ],
      reported: new Map(),
      milestones: GATES,
      passing: PASSING,
    });
    expect(owed.map((m) => m.gate)).toEqual(["architecture_approval", "implementation_review", "qa_uat"]);
  });

  test("two work items do not shadow each other's milestones", () => {
    const owed = milestonesOwed({
      verdicts: [verdict({ workId: "task-1", atMs: 1_000 }), verdict({ workId: "task-2", atMs: 1_000 })],
      reported: new Map([["task-1", new Set(["architecture_approval"])]]),
      milestones: GATES,
      passing: PASSING,
    });
    expect(owed.map((m) => m.workId)).toEqual(["task-2"]);
  });

  test("what the gate SAID travels with the milestone, so the update is not invented", () => {
    const owed = milestonesOwed({
      verdicts: [verdict({ reason: "the adapter seam is the right boundary", byHatId: "architect" })],
      reported: new Map(),
      milestones: GATES,
      passing: PASSING,
    });
    expect(owed[0]?.reason).toBe("the adapter seam is the right boundary");
    expect(owed[0]?.byHatId).toBe("architect");
  });
});

describe("A CONFIGURATION THAT CANNOT MEAN WHAT IT SAYS IS REFUSED", () => {
  const ok = { milestones: ["qa_uat"], why: "people watch the ticket" };

  test("a stated configuration that names known gates is accepted", () => {
    expect(validateTicketReports(ok, GATES).ok).toBe(true);
  });

  test("A TYPO IS THE VACUITY CLASS: an unknown gate would report nothing, forever", () => {
    const r = validateTicketReports({ ...ok, milestones: ["architecture-approval"] }, GATES);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("not a gate this organization has");
  });

  test("no milestones, a duplicate, an empty name, an empty tracker and a missing why are each refused", () => {
    expect(validateTicketReports({ ...ok, milestones: [] }, GATES).ok).toBe(false);
    expect(validateTicketReports({ ...ok, milestones: ["qa_uat", "qa_uat"] }, GATES).ok).toBe(false);
    expect(validateTicketReports({ ...ok, milestones: [" "] }, GATES).ok).toBe(false);
    expect(validateTicketReports({ ...ok, tracker: "  " }, GATES).ok).toBe(false);
    expect(validateTicketReports({ ...ok, why: "" }, GATES).ok).toBe(false);
  });

  test("a tracker override is allowed, for an organization that reads in one place and reports to another", () => {
    expect(validateTicketReports({ ...ok, tracker: "linear" }, GATES).ok).toBe(true);
  });
});

describe("THE COMMENT A PERSON READS", () => {
  const update = { willDo: ["write the adapter", "add a regression test"], done: ["chose the seam", "wrote the design note"], status: "moving to implementation" };

  test("what was done, what happens next, the status - and the merge request, which the ORGANIZATION supplies", () => {
    const body = renderTicketComment("architecture_approval", update, { url: "https://git.example/mr/1222", branch: "defect-1658" });
    expect(body).toContain("architecture approval");
    expect(body).toContain("What was done");
    expect(body).toContain("- chose the seam");
    expect(body).toContain("What happens next");
    expect(body).toContain("- write the adapter");
    expect(body).toContain("Status: moving to implementation");
    expect(body).toContain("https://git.example/mr/1222");
    expect(body).toContain("defect-1658");
  });

  test("a branch with no request open says so, rather than implying one exists", () => {
    const body = renderTicketComment("qa_uat", update, { branch: "defect-1658" });
    expect(body).toContain("no merge request open yet");
    expect(body).not.toContain("Merge request:");
  });

  test("no change at all, and the comment simply carries no link", () => {
    const body = renderTicketComment("qa_uat", update);
    expect(body).not.toContain("Merge request");
    expect(body).not.toContain("Branch:");
  });

  test("an empty section is left out rather than printed with nothing under it", () => {
    const body = renderTicketComment("release_readiness", { willDo: [], done: ["shipped"], status: "done" });
    expect(body).not.toContain("What happens next");
    expect(body).toContain("What was done");
  });

  test("a bullet is one line however the composer wrapped it", () => {
    const body = renderTicketComment("qa_uat", { willDo: [], done: ["a finding" + NL + "  that wrapped"], status: "s" });
    expect(body).toContain("- a finding that wrapped");
  });

  test("an update with nothing in it is recognised as empty, so it is never posted", () => {
    expect(updateIsEmpty({ willDo: [], done: [], status: "  " })).toBe(true);
    expect(updateIsEmpty({ willDo: [], done: [], status: "blocked" })).toBe(false);
  });
});
