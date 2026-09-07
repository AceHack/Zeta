/**
 * inefficiency.test.ts — one hard item is not a broken process.
 *
 * The whole value of this detector is the line it draws. `ORGANIZATION_RUNTIME_ARCHITECTURE.md`
 * asks agents to request changes to the system *"when they discover repeatable organizational
 * inefficiency"*, and every example it gives is countable — repeated review drift, repeated missed
 * coverage, repeated credential mistakes.
 *
 * So the load-bearing tests are the two directions of that line: four failures on ONE item must
 * not read as a process defect, and one failure on each of four items must.
 */

import { describe, expect, test } from "bun:test";
import { findInefficiencies, InefficiencyKind, RECURRENCE_THRESHOLD } from "./inefficiency";
import { GateKind } from "./quality-gate";

const NONE = { gateBlocked: [], escalations: [], refusals: [] };

describe("THE UNIT IS DISTINCT ITEMS, NOT OCCURRENCES", () => {
  test("ONE ITEM BLOCKING FOUR TIMES IS NOT A PATTERN — it is a hard item", () => {
    // Churn and the escalation chain already handle a single stuck item. Reporting it as a process
    // defect would blame the process for one difficult piece of work, and an organization that
    // files a workflow request every time something is hard learns to ignore them.
    const r = findInefficiencies({
      ...NONE,
      gateBlocked: Array.from({ length: 4 }, () => ({ taskId: "task-1", gate: GateKind.PeerReview })),
    });
    expect(r).toEqual([]);
  });

  test("...but the same gate blocking TWO DIFFERENT items is", () => {
    const r = findInefficiencies({
      ...NONE,
      gateBlocked: [
        { taskId: "task-1", gate: GateKind.PeerReview },
        { taskId: "task-2", gate: GateKind.PeerReview },
      ],
    });
    expect(r.length).toBe(1);
    expect(r[0]?.kind).toBe(InefficiencyKind.GateDrift);
    expect(r[0]?.workIds).toEqual(["task-1", "task-2"]);
  });

  test("THE ITEM LIST IS ORDINAL, not the order they were encountered", () => {
    // Fed in reverse on purpose. The first draft listed them already sorted, so insertion order
    // and ordinal order agreed and a mutant returning the list untouched survived — the fixture
    // could not tell the two apart.
    const r = findInefficiencies({
      ...NONE,
      gateBlocked: [
        { taskId: "task-9", gate: GateKind.PeerReview },
        { taskId: "task-2", gate: GateKind.PeerReview },
        { taskId: "task-5", gate: GateKind.PeerReview },
      ],
    });
    expect(r[0]?.workIds).toEqual(["task-2", "task-5", "task-9"]);
  });

  test("the threshold is the threshold — one item short reports nothing", () => {
    const items = Array.from({ length: RECURRENCE_THRESHOLD - 1 }, (_, i) => ({
      taskId: `task-${String(i)}`,
      gate: GateKind.QaUat,
    }));
    expect(findInefficiencies({ ...NONE, gateBlocked: items })).toEqual([]);
  });

  test("DIFFERENT GATES DO NOT COMBINE — two gates failing once each is not a pattern", () => {
    // Otherwise any run with a couple of unrelated problems reports a systemic one.
    const r = findInefficiencies({
      ...NONE,
      gateBlocked: [
        { taskId: "task-1", gate: GateKind.PeerReview },
        { taskId: "task-2", gate: GateKind.QaUat },
      ],
    });
    expect(r).toEqual([]);
  });
});

describe("escalations and refusals recur the same way", () => {
  test("several items escalating to the same action is a pattern", () => {
    const r = findInefficiencies({
      ...NONE,
      escalations: [
        { taskId: "task-1", action: "add_agents" },
        { taskId: "task-2", action: "add_agents" },
      ],
    });
    expect(r[0]?.kind).toBe(InefficiencyKind.EscalationDrift);
  });

  test("A REFUSAL IS GROUPED BY ITS SHAPE, with the item stripped out", () => {
    // Refusals are prose. Grouping them verbatim puts every item in its own bucket and finds no
    // pattern at all — which is the silent way a detector reports nothing forever.
    const r = findInefficiencies({
      ...NONE,
      refusals: [
        "gates for task-1: producer 'command' could not run",
        "gates for task-2: producer 'command' could not run",
      ],
    });
    expect(r.length).toBe(1);
    expect(r[0]?.kind).toBe(InefficiencyKind.RepeatedRefusal);
    expect(r[0]?.pattern).toContain("<item>");
    expect(r[0]?.pattern).not.toContain("task-1");
  });

  test("EVERY id is stripped, not just the first", () => {
    // A refusal naming two items would otherwise keep the second and split the pattern in two.
    const r = findInefficiencies({
      ...NONE,
      refusals: ["task-1 blocked by task-9", "task-2 blocked by task-9"],
    });
    expect(r.length).toBe(1);
    expect(r[0]?.pattern).not.toMatch(/task-\d/);
  });

  test("a refusal naming NO work item is not counted — it happened once, to nobody", () => {
    // HONEST LIMIT, because a mutant that counts them anyway survives this. At a threshold of two
    // distinct items, a no-id refusal can only ever contribute one bucket ("nobody"), so counting
    // it changes no outcome — the mutant is equivalent rather than undetected. The guard stays
    // because it states the intent and stops being equivalent the moment the threshold moves.
    const r = findInefficiencies({
      ...NONE,
      refusals: ["nothing workable — no goal to cascade", "nothing workable — no goal to cascade"],
    });
    expect(r).toEqual([]);
  });

  test("two DIFFERENT refusals on two items are not one pattern", () => {
    const r = findInefficiencies({
      ...NONE,
      refusals: ["gates for task-1: the executor died", "gates for task-2: the reviewer was absent"],
    });
    expect(r).toEqual([]);
  });
});

describe("what a finding says, and what it deliberately does not", () => {
  test("it names the pattern and the items, and proposes NOTHING", () => {
    // The doc has a Director or a Manager deciding what workflow to add. A detector arriving with
    // a solution would make that call from the bottom of the chain, with the least context about
    // what else the organization already has in flight.
    const r = findInefficiencies({
      ...NONE,
      gateBlocked: [
        { taskId: "task-1", gate: GateKind.AdversarialReview },
        { taskId: "task-2", gate: GateKind.AdversarialReview },
      ],
    });
    const finding = r[0]!;
    expect(finding.pattern).toBe(GateKind.AdversarialReview);
    expect(finding.summary).toContain("2 different work item(s)");
    expect(Object.keys(finding)).not.toContain("proposal");
    expect(Object.keys(finding)).not.toContain("workflow");
  });

  test("findings are ordered by REACH — the pattern touching the most work comes first", () => {
    const r = findInefficiencies({
      ...NONE,
      gateBlocked: [
        { taskId: "task-1", gate: GateKind.PeerReview },
        { taskId: "task-2", gate: GateKind.PeerReview },
        { taskId: "task-3", gate: GateKind.PeerReview },
        { taskId: "task-1", gate: GateKind.QaUat },
        { taskId: "task-2", gate: GateKind.QaUat },
      ],
    });
    expect(r[0]?.workIds.length).toBe(3);
    expect(r[1]?.workIds.length).toBe(2);
  });

  test("ties break ORDINALLY, not by discovery order", () => {
    // Two patterns of equal reach must not be ordered by which the loop happened to find first, or
    // the same run reports them differently on two machines.
    const r = findInefficiencies({
      ...NONE,
      escalations: [
        { taskId: "task-1", action: "zzz" },
        { taskId: "task-2", action: "zzz" },
        { taskId: "task-1", action: "aaa" },
        { taskId: "task-2", action: "aaa" },
      ],
    });
    expect(r.map((x) => x.pattern)).toEqual(["aaa", "zzz"]);
    expect("B" < "a").toBe(true);
  });

  test("A CLEAN RUN FINDS NOTHING — no manufactured opinions", () => {
    expect(findInefficiencies(NONE)).toEqual([]);
  });
});
