/**
 * gate-demand.test.ts — falsifiers for the SDLC-as-demand inversion.
 *
 * The property is NOT "a list of steps comes back". A function returning every gate on every item
 * would pass that and would have removed the enforcement entirely. What is pinned here:
 *
 *   - an item is offered exactly ONE step, so nothing can be worked out of order
 *   - a failed gate comes BACK, ahead of everything after it, carrying why
 *   - an acceptance gate cannot be crossed above undelivered children
 *   - the fourteen canonical gates are REDISTRIBUTED across the rungs, not reduced
 */

import { describe, expect, test } from "bun:test";
import {
  acceptanceGateFor,
  chainFor,
  CHAIN_BY_TYPE,
  demandFor,
  gateDemand,
  gatesComplete,
  isLiveWork,
  reworkOnly,
} from "./gate-demand";
import { LEAF_TYPES, WorkState, WorkType, type Cascade, type CascadeNode } from "./goal-cascade";
import { GateKind, GateOutcome, ORDERED_GATES, type GateEvaluation } from "./quality-gate";

function node(over: Partial<CascadeNode> & Pick<CascadeNode, "workId" | "workType">): CascadeNode {
  return {
    title: `title of ${over.workId}`,
    state: WorkState.Open,
    ownerHatId: "owner_hat",
    ...over,
  } as CascadeNode;
}

function evalOf(
  workId: string,
  gate: GateKind,
  outcome: GateOutcome,
  atMs = 1_000,
  reason = "because",
): GateEvaluation {
  return { workId, gate, outcome, byHatId: "judge_hat", reason, atMs, evidenceRefs: [] };
}

/** One task, alone, so a chain can be examined without children interfering. */
const LONE_TASK: Cascade = { nodes: [node({ workId: "T-1", workType: WorkType.Task })] };

const TASK_CHAIN = chainFor(WorkType.Task);
const FIRST = TASK_CHAIN[0] as GateKind;
const SECOND = TASK_CHAIN[1] as GateKind;

describe("an item owes exactly one step, so nothing can be skipped", () => {
  test("fresh work owes the FIRST gate of its own chain", () => {
    const { ready } = gateDemand({ cascade: LONE_TASK, evaluations: [] });
    expect(ready).toHaveLength(1);
    expect(ready[0]?.gate).toBe(FIRST);
    expect(ready[0]?.rework).toBe(false);
    expect(ready[0]?.attempt).toBe(1);
  });

  test("passing the first gate advances to the second, and ONLY the second", () => {
    const { ready } = gateDemand({
      cascade: LONE_TASK,
      evaluations: [evalOf("T-1", FIRST, GateOutcome.Approved)],
    });
    expect(ready).toHaveLength(1);
    expect(ready[0]?.gate).toBe(SECOND);
  });

  test("A LATER GATE IS NEVER OFFERED WHILE AN EARLIER ONE IS OUTSTANDING", () => {
    // The enforcement property. Approving gate 3 out of band must not let the item move past
    // gate 1 — otherwise "free flowing agents" would mean gates can be crossed in a convenient
    // order, which is exactly the control this replaces.
    const third = TASK_CHAIN[2] as GateKind;
    const { ready } = gateDemand({
      cascade: LONE_TASK,
      evaluations: [evalOf("T-1", third, GateOutcome.Approved)],
    });
    expect(ready).toHaveLength(1);
    expect(ready[0]?.gate).toBe(FIRST);
  });

  test("an item with every gate passed owes nothing", () => {
    const evaluations = TASK_CHAIN.map((g) => evalOf("T-1", g, GateOutcome.Approved));
    expect(gateDemand({ cascade: LONE_TASK, evaluations }).ready).toEqual([]);
  });

  test("a WAIVED gate passes — a waiver is an authority saying it does not apply", () => {
    const { ready } = gateDemand({
      cascade: LONE_TASK,
      evaluations: [evalOf("T-1", FIRST, GateOutcome.Waived)],
    });
    expect(ready[0]?.gate).toBe(SECOND);
  });

  test("a canceled item owes nothing at all", () => {
    const canceled: Cascade = {
      nodes: [node({ workId: "T-1", workType: WorkType.Task, state: WorkState.Canceled })],
    };
    const demand = gateDemand({ cascade: canceled, evaluations: [] });
    expect(demand.ready).toEqual([]);
    expect(demand.blocked).toEqual([]);
  });

  test("never more than one ready step per item, across every state a chain can be in", () => {
    for (let passed = 0; passed <= TASK_CHAIN.length; passed++) {
      const evaluations = TASK_CHAIN.slice(0, passed).map((g) => evalOf("T-1", g, GateOutcome.Approved));
      expect(demandFor(gateDemand({ cascade: LONE_TASK, evaluations }), "T-1").length).toBeLessThanOrEqual(1);
    }
  });
});

describe("a failed gate comes BACK, and says why", () => {
  for (const outcome of [GateOutcome.Rejected, GateOutcome.ChangesRequested]) {
    test(`'${outcome}' makes the same gate ready again rather than advancing`, () => {
      const { ready } = gateDemand({
        cascade: LONE_TASK,
        evaluations: [evalOf("T-1", FIRST, outcome, 1_000, "missing the repro")],
      });
      expect(ready).toHaveLength(1);
      expect(ready[0]?.gate).toBe(FIRST);
      expect(ready[0]?.rework).toBe(true);
      expect(ready[0]?.priorOutcome).toBe(outcome);
      expect(ready[0]?.attempt).toBe(2);
      expect(ready[0]?.why).toContain("missing the repro");
    });
  }

  test("A REJECTION HOLDS THE ITEM AT THAT GATE even though later gates passed", () => {
    // The rework property stated adversarially: work that got ahead of itself and was then sent
    // back must return to the failed gate, not carry on from the furthest point it reached.
    const { ready } = gateDemand({
      cascade: LONE_TASK,
      evaluations: [
        evalOf("T-1", SECOND, GateOutcome.Approved, 2_000),
        evalOf("T-1", FIRST, GateOutcome.Rejected, 3_000),
      ],
    });
    expect(ready[0]?.gate).toBe(FIRST);
    expect(ready[0]?.rework).toBe(true);
  });

  test("a re-judgement supersedes the rejection and the item moves on", () => {
    const { ready } = gateDemand({
      cascade: LONE_TASK,
      evaluations: [
        evalOf("T-1", FIRST, GateOutcome.Rejected, 1_000),
        evalOf("T-1", FIRST, GateOutcome.Approved, 2_000),
      ],
    });
    expect(ready[0]?.gate).toBe(SECOND);
  });

  test("the LATEST outcome wins even when the record is out of order", () => {
    const { ready } = gateDemand({
      cascade: LONE_TASK,
      evaluations: [
        evalOf("T-1", FIRST, GateOutcome.Approved, 5_000),
        evalOf("T-1", FIRST, GateOutcome.Rejected, 2_000),
      ],
    });
    expect(ready[0]?.gate).toBe(SECOND);
  });

  test("attempt counts every judgement, so a third pass says three", () => {
    const { ready } = gateDemand({
      cascade: LONE_TASK,
      evaluations: [
        evalOf("T-1", FIRST, GateOutcome.Rejected, 1_000),
        evalOf("T-1", FIRST, GateOutcome.Rejected, 2_000),
      ],
    });
    expect(ready[0]?.attempt).toBe(3);
  });

  test("rework is separable from fresh demand", () => {
    const two: Cascade = {
      nodes: [
        node({ workId: "T-1", workType: WorkType.Task }),
        node({ workId: "T-2", workType: WorkType.Task }),
      ],
    };
    const demand = gateDemand({
      cascade: two,
      evaluations: [evalOf("T-2", FIRST, GateOutcome.Rejected)],
    });
    expect(demand.ready).toHaveLength(2);
    expect(reworkOnly(demand).map((s) => s.workId)).toEqual(["T-2"]);
  });

  test("fresh work reports no prior outcome at all", () => {
    const { ready } = gateDemand({ cascade: LONE_TASK, evaluations: [] });
    expect(ready[0]?.priorOutcome).toBeUndefined();
  });
});

describe("an epic cannot be accepted above unfinished children", () => {
  const EPIC: Cascade = {
    nodes: [
      node({ workId: "P-1", workType: WorkType.Project }),
      node({ workId: "T-1", workType: WorkType.Task, parentWorkId: "P-1" }),
      node({ workId: "T-2", workType: WorkType.Task, parentWorkId: "P-1" }),
    ],
  };
  const PROJECT_CHAIN = chainFor(WorkType.Project);
  const upToAcceptance = PROJECT_CHAIN.slice(0, -1).map((g) => evalOf("P-1", g, GateOutcome.Approved));

  test("the acceptance gate is the LAST gate of a non-leaf chain", () => {
    expect(acceptanceGateFor(WorkType.Project)).toBe(PROJECT_CHAIN[PROJECT_CHAIN.length - 1]);
  });

  test("leaves have no acceptance gate — they have no children to wait for", () => {
    for (const leaf of LEAF_TYPES) expect(acceptanceGateFor(leaf)).toBeUndefined();
  });

  test("A PROJECT WITH EVERY OTHER GATE PASSED IS BLOCKED, NOT READY, while a task is open", () => {
    const demand = gateDemand({ cascade: EPIC, evaluations: upToAcceptance });
    expect(demandFor(demand, "P-1")).toEqual([]);
    const blocked = demand.blocked.filter((b) => b.workId === "P-1");
    expect(blocked).toHaveLength(1);
    expect(blocked[0]?.gate).toBe(acceptanceGateFor(WorkType.Project));
  });

  test("the block names how many children are outstanding, and which", () => {
    const demand = gateDemand({ cascade: EPIC, evaluations: upToAcceptance });
    const because = demand.blocked.find((b) => b.workId === "P-1")?.because ?? "";
    expect(because).toContain("2 of 2");
    expect(because).toContain("T-1");
  });

  test("delivering every child unblocks the acceptance gate", () => {
    const done: Cascade = {
      nodes: EPIC.nodes.map((n) => (n.workId === "P-1" ? n : { ...n, state: WorkState.Done })),
    };
    const demand = gateDemand({ cascade: done, evaluations: upToAcceptance });
    expect(demandFor(demand, "P-1")).toHaveLength(1);
    expect(demand.blocked.filter((b) => b.workId === "P-1")).toEqual([]);
  });

  test("a canceled child does not hold the epic open", () => {
    const mixed: Cascade = {
      nodes: [
        node({ workId: "P-1", workType: WorkType.Project }),
        node({ workId: "T-1", workType: WorkType.Task, parentWorkId: "P-1", state: WorkState.Done }),
        node({ workId: "T-2", workType: WorkType.Task, parentWorkId: "P-1", state: WorkState.Canceled }),
      ],
    };
    expect(demandFor(gateDemand({ cascade: mixed, evaluations: upToAcceptance }), "P-1")).toHaveLength(1);
  });

  test("an epic with NO children is blocked, and says nothing was decomposed", () => {
    const bare: Cascade = { nodes: [node({ workId: "P-9", workType: WorkType.Project })] };
    const demand = gateDemand({
      cascade: bare,
      evaluations: PROJECT_CHAIN.slice(0, -1).map((g) => evalOf("P-9", g, GateOutcome.Approved)),
    });
    expect(demandFor(demand, "P-9")).toEqual([]);
    expect(demand.blocked.find((b) => b.workId === "P-9")?.because).toContain("decomposed");
  });

  test("EARLIER project gates are NOT blocked by children — only acceptance is", () => {
    // Otherwise an epic could never be designed until its tasks were built, which inverts the
    // dependency: the design is what the tasks are built from.
    const demand = gateDemand({ cascade: EPIC, evaluations: [] });
    expect(demandFor(demand, "P-1")).toHaveLength(1);
    expect(demandFor(demand, "P-1")[0]?.gate).toBe(PROJECT_CHAIN[0]);
  });
});

describe("A PASSED ACCEPTANCE GATE FALLS BACK WHEN A CHILD REGRESSES", () => {
  const PROJECT_CHAIN = chainFor(WorkType.Project);
  const ACCEPTANCE = PROJECT_CHAIN[PROJECT_CHAIN.length - 1] as GateKind;

  /** An epic whose gates ALL passed, with both children delivered. */
  const allPassed = PROJECT_CHAIN.map((g) => evalOf("P-1", g, GateOutcome.Approved, 1_000));
  const shipped: Cascade = {
    nodes: [
      node({ workId: "P-1", workType: WorkType.Project }),
      node({ workId: "T-1", workType: WorkType.Task, parentWorkId: "P-1", state: WorkState.Done }),
      node({ workId: "T-2", workType: WorkType.Task, parentWorkId: "P-1", state: WorkState.Done }),
    ],
  };
  /** The same epic after T-2 was rejected at QA and reopened. */
  const regressed: Cascade = {
    nodes: shipped.nodes.map((n) =>
      n.workId === "T-2" ? { ...n, state: WorkState.InProgress } : n,
    ),
  };

  test("a fully delivered epic owes nothing", () => {
    expect(demandFor(gateDemand({ cascade: shipped, evaluations: allPassed }), "P-1")).toEqual([]);
    expect(gateDemand({ cascade: shipped, evaluations: allPassed }).blocked).toEqual([]);
  });

  test("A REOPENED CHILD REOPENS THE PARENT'S ACCEPTANCE GATE", () => {
    // The defect this closes. Without fall-back the epic keeps a passing acceptance over work that
    // has since broken, and nothing anywhere reports it.
    const demand = gateDemand({ cascade: regressed, evaluations: allPassed });
    const onEpic = [...demandFor(demand, "P-1"), ...demand.blocked.filter((b) => b.workId === "P-1")];
    expect(onEpic).toHaveLength(1);
    expect(onEpic[0]?.gate).toBe(ACCEPTANCE);
  });

  test("the reopened gate is BLOCKED while the child is outstanding, not ready to re-sign", () => {
    const demand = gateDemand({ cascade: regressed, evaluations: allPassed });
    expect(demandFor(demand, "P-1")).toEqual([]);
    expect(demand.blocked.find((b) => b.workId === "P-1")?.because).toContain("not delivered");
  });

  test("only the ACCEPTANCE gate falls back — earlier ones stay passed", () => {
    // Otherwise a regression would send the epic back to be re-designed, which is not what a failed
    // task means.
    const demand = gateDemand({ cascade: regressed, evaluations: allPassed });
    const blocked = demand.blocked.find((b) => b.workId === "P-1");
    expect(blocked?.gate).not.toBe(PROJECT_CHAIN[0]);
    expect(blocked?.gate).toBe(ACCEPTANCE);
  });

  test("re-delivering the child settles the epic again", () => {
    const demand = gateDemand({ cascade: shipped, evaluations: allPassed });
    expect(demand.blocked.filter((b) => b.workId === "P-1")).toEqual([]);
  });

  test("acceptanceFallsBack:false keeps the epic done — the other honest policy", () => {
    const demand = gateDemand({
      cascade: regressed,
      evaluations: allPassed,
      acceptanceFallsBack: false,
    });
    expect(demandFor(demand, "P-1")).toEqual([]);
    expect(demand.blocked.filter((b) => b.workId === "P-1")).toEqual([]);
  });

  test("a CANCELLED child does not reopen the parent — nothing left to regress against", () => {
    const cancelled: Cascade = {
      nodes: shipped.nodes.map((n) =>
        n.workId === "T-2" ? { ...n, state: WorkState.Canceled } : n,
      ),
    };
    const demand = gateDemand({ cascade: cancelled, evaluations: allPassed });
    expect(demandFor(demand, "P-1")).toEqual([]);
    expect(demand.blocked.filter((b) => b.workId === "P-1")).toEqual([]);
  });

  test("a LEAF never falls back — it has no children to regress", () => {
    const evaluations = TASK_CHAIN.map((g) => evalOf("T-1", g, GateOutcome.Approved));
    expect(gateDemand({ cascade: LONE_TASK, evaluations }).ready).toEqual([]);
  });
});

describe("the fourteen gates are REDISTRIBUTED across the ladder, not reduced", () => {
  test("every canonical gate is owed by at least one work type", () => {
    const covered = new Set(Object.values(CHAIN_BY_TYPE).flat());
    for (const gate of ORDERED_GATES) expect(covered).toContain(gate);
  });

  test("no chain is the whole canonical chain — that was the defect", () => {
    for (const chain of Object.values(CHAIN_BY_TYPE)) {
      expect(chain.length).toBeLessThan(ORDERED_GATES.length);
    }
  });

  test("every chain is non-empty, so no work type delivers by having nothing to cross", () => {
    for (const workType of Object.values(WorkType)) {
      expect(chainFor(workType).length).toBeGreaterThan(0);
    }
  });

  test("every chain runs in canonical order and repeats no gate", () => {
    for (const chain of Object.values(CHAIN_BY_TYPE)) {
      const idx = chain.map((g) => ORDERED_GATES.indexOf(g));
      expect(idx).toEqual([...idx].sort((a, b) => a - b));
      expect(new Set(chain).size).toBe(chain.length);
    }
  });

  test("an incident owes a restoration, never an implementation review", () => {
    // The distinction `LEAF_TYPES` exists to preserve: giving every leaf the task chain would make
    // an incident's actual obligation unexpressible.
    expect(chainFor(WorkType.Incident)).toContain(GateKind.RuntimeValidation);
    expect(chainFor(WorkType.Incident)).not.toContain(GateKind.ImplementationReview);
  });
});

describe("gates complete and children delivered are separate questions", () => {
  test("gatesComplete is false while any gate is unjudged", () => {
    expect(gatesComplete(WorkType.Task, "T-1", [])).toBe(false);
  });

  test("gatesComplete is true once every gate in the type's chain passes", () => {
    const evaluations = TASK_CHAIN.map((g) => evalOf("T-1", g, GateOutcome.Approved));
    expect(gatesComplete(WorkType.Task, "T-1", evaluations)).toBe(true);
  });

  test("a rejection at the end makes it false again", () => {
    const evaluations = [
      ...TASK_CHAIN.map((g) => evalOf("T-1", g, GateOutcome.Approved, 1_000)),
      evalOf("T-1", FIRST, GateOutcome.Rejected, 2_000),
    ];
    expect(gatesComplete(WorkType.Task, "T-1", evaluations)).toBe(false);
  });

  test("another item's evaluations never count toward this one", () => {
    const evaluations = TASK_CHAIN.map((g) => evalOf("OTHER", g, GateOutcome.Approved));
    expect(gatesComplete(WorkType.Task, "T-1", evaluations)).toBe(false);
  });
});

describe("guards for a CLI taking a workId from argv", () => {
  test("an unknown id is not live", () => {
    expect(isLiveWork(LONE_TASK, "nope")).toBe(false);
  });
  test("a real open item is live", () => {
    expect(isLiveWork(LONE_TASK, "T-1")).toBe(true);
  });
  test("a canceled item is not live", () => {
    const canceled: Cascade = {
      nodes: [node({ workId: "T-1", workType: WorkType.Task, state: WorkState.Canceled })],
    };
    expect(isLiveWork(canceled, "T-1")).toBe(false);
  });
});

describe("A NODE'S STATED CHAIN IS WHAT EVERY READER SEES", () => {
  const { chainOf, acceptanceGateFor, missingGates, gatesComplete, gateDemand } = require("./gate-demand") as typeof import("./gate-demand");
  const { foldCascade } = require("./org-fold") as typeof import("./org-fold");
  const initiative = { workId: "i1", workType: WorkType.Initiative, title: "i", state: WorkState.Open, ownerHatId: "d", owes: [] as GateKind[] };

  test("chainOf prefers the stated chain; a bare type still gets the register's", () => {
    expect(chainOf(initiative)).toEqual([]);
    expect(chainOf(WorkType.Initiative)).toEqual(chainFor(WorkType.Initiative));
    expect(chainOf({ workType: WorkType.Initiative })).toEqual(chainFor(WorkType.Initiative));
  });

  test("owing nothing: no acceptance gate, nothing missing, complete — and no demand", () => {
    expect(acceptanceGateFor(initiative)).toBeUndefined();
    expect(missingGates(initiative, "i1", [])).toEqual([]);
    expect(gatesComplete(initiative, "i1", [])).toBe(true);
    const demand = gateDemand({ cascade: { nodes: [initiative as never] }, evaluations: [] });
    expect(demand.ready.filter((s) => s.workId === "i1")).toEqual([]);
  });

  test("the stated chain SURVIVES THE LOG", () => {
    const folded = foldCascade([
      {
        eventId: "e1", kind: "work_item_transition", subjectId: "i1", actorHatId: "d", decision: "x", atMs: 0,
        fact: { kind: "work_created", workId: "i1", workType: WorkType.Initiative, title: "i", ownerHatId: "d", owes: [] },
      } as never,
    ]);
    expect(folded.nodes[0]?.owes).toEqual([]);
  });
});

describe("THE ACCEPTANCE GATE IS THE TYPE'S, and only while it is still owed", () => {
  const { acceptanceGateFor } = require("./gate-demand") as typeof import("./gate-demand");
  test("a goal trimmed to its understanding gates has NO acceptance gate — grooming is not held for the children", () => {
    const trimmed = { workType: WorkType.Goal, owes: [GateKind.BusinessContextGrooming, GateKind.SystemContext] };
    expect(acceptanceGateFor(trimmed)).toBeUndefined();
    expect(acceptanceGateFor(WorkType.Goal)).toBe(GateKind.FinalBusinessValidation);
    expect(acceptanceGateFor({ workType: WorkType.Goal })).toBe(GateKind.FinalBusinessValidation);
  });
});
