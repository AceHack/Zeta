import { describe, expect, test } from "bun:test";
import {
  accountableHatsFor,
  acceptGoal,
  assign,
  CASCADE_RUNGS,
  cascadeChainOf,
  childrenOf,
  decompose,
  EMPTY_CASCADE,
  isDelivered,
  isLeafType,
  LEAF_TYPES,
  nextRung,
  nodeById,
  ownerForRung,
  restateDirection,
  rungFor,
  setState,
  unstaffedTasks,
  WorkState,
  WorkType,
  type Cascade,
} from "./goal-cascade";
import { buildOrgChart, reportsUpTo } from "./org-chart";
import { Domain } from "./domain-ontology";
import { SEED_HATS } from "./org-seed";

const chart = (() => {
  const r = buildOrgChart(SEED_HATS);
  if (!r.ok) throw new Error(r.reason);
  return r.chart;
})();

const must = (r: { ok: true; cascade: Cascade } | { ok: false; reason: string }): Cascade => {
  if (!r.ok) throw new Error(r.reason);
  return r.cascade;
};

/** Goal → initiative → project → task, fully staffed. The whole ladder, built once. */
function fullLadder(): Cascade {
  let c = must(acceptGoal(EMPTY_CASCADE, chart, { workId: "g1", title: "cut checkout abandonment", acceptingHatId: "cto" }));
  c = must(decompose(c, chart, "g1", [{ workId: "i1", title: "fix the coupon path" }]));
  c = must(decompose(c, chart, "i1", [{ workId: "p1", title: "coupon service hardening" }]));
  c = must(decompose(c, chart, "p1", [
    { workId: "t1", title: "stop the double-apply" },
    { workId: "t2", title: "add the regression test" },
  ]));
  c = must(assign(c, chart, "t1", "backend_implementer"));
  c = must(assign(c, chart, "t2", "backend_implementer"));
  return c;
}

describe("the ladder", () => {
  test("four rungs, top-down, one level each", () => {
    expect(CASCADE_RUNGS.map((r) => [r.workType, r.ownerLevel])).toEqual([
      ["goal", "c_suite"],
      ["initiative", "director"],
      ["project", "manager"],
      ["task", "lead"],
    ]);
  });

  test("the bottom rung has nothing below it", () => {
    expect(nextRung(WorkType.Task)).toBeUndefined();
    expect(nextRung(WorkType.Goal)?.workType).toBe(WorkType.Initiative);
  });
});

describe("a goal is accepted at the top, or not at all", () => {
  test("the C-suite may", () => {
    expect(acceptGoal(EMPTY_CASCADE, chart, { workId: "g", title: "x", acceptingHatId: "cto" }).ok).toBe(true);
  });

  test("the board may", () => {
    expect(
      acceptGoal(EMPTY_CASCADE, chart, { workId: "g", title: "x", acceptingHatId: "executive_board_member" }).ok,
    ).toBe(true);
  });

  test("a manager may NOT — authority is what the rung means", () => {
    const r = acceptGoal(EMPTY_CASCADE, chart, { workId: "g", title: "x", acceptingHatId: "engineering_manager" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("accepted at the top");
  });

  test("a director may not either", () => {
    expect(acceptGoal(EMPTY_CASCADE, chart, { workId: "g", title: "x", acceptingHatId: "qa_director" }).ok).toBe(false);
  });

  test("an unknown hat and an empty title are refused", () => {
    expect(acceptGoal(EMPTY_CASCADE, chart, { workId: "g", title: "x", acceptingHatId: "ghost" }).ok).toBe(false);
    expect(acceptGoal(EMPTY_CASCADE, chart, { workId: "g", title: " ", acceptingHatId: "cto" }).ok).toBe(false);
  });
});

describe("ownership is derived from the graph", () => {
  test("the owner of a rung reports up to the rung above", () => {
    const c = fullLadder();
    for (const node of c.nodes) {
      if (node.parentWorkId === undefined) continue;
      const parent = nodeById(c, node.parentWorkId);
      expect(parent).toBeDefined();
      // The property that makes this an ORG cascade rather than a tree that happens to have levels.
      expect(reportsUpTo(chart, node.ownerHatId, parent!.ownerHatId)).toBe(true);
    }
  });

  test("each rung lands on the right level", () => {
    const c = fullLadder();
    expect(chart.byId.get(nodeById(c, "g1")!.ownerHatId)?.level).toBe("c_suite");
    expect(chart.byId.get(nodeById(c, "i1")!.ownerHatId)?.level).toBe("director");
    expect(chart.byId.get(nodeById(c, "p1")!.ownerHatId)?.level).toBe("manager");
    expect(chart.byId.get(nodeById(c, "t1")!.ownerHatId)?.level).toBe("lead");
  });

  test("the CTO's initiative goes to a director under the CTO, not under the COO", () => {
    const c = fullLadder();
    const owner = nodeById(c, "i1")!.ownerHatId;
    expect(reportsUpTo(chart, owner, "cto")).toBe(true);
    expect(reportsUpTo(chart, owner, "coo")).toBe(false);
  });

  test("ownerForRung never returns the parent itself", () => {
    // The C-suite reports to the C-suite in this chart, so without the self-exclusion a c_suite
    // rung could be handed straight back to the hat that already holds it.
    expect(ownerForRung(chart, "c_suite", "cto")?.id).not.toBe("cto");
  });

  test("ownerForRung returns undefined when nobody at that level is in the line", () => {
    // A dev supervises nobody, so no manager can hang beneath it.
    expect(ownerForRung(chart, "manager", "backend_implementer")).toBeUndefined();
  });

  test("a tie is broken toward an owner who can DELEGATE the rung below", () => {
    // Five directors report to the CTO at equal distance — architecture, engineering, QA
    // engineering, security, documentation — and only two have a manager beneath them.
    // `architecture_director` sorts first alphabetically, so without this preference every
    // domainless goal the CTO accepted landed there and the whole cascade was owned by one hat
    // three levels above the people doing it.
    //
    // ASSERTED WITHOUT `mustSupportLevel`, which is what makes it a preference rather than the
    // filter it used to be confused with: nothing here REQUIRES a manager, and the ordering still
    // prefers one. `architecture_director` is named as the loser so the test fails if the
    // preference silently stops applying rather than merely changing its mind.
    const chosen = ownerForRung(chart, "director", "cto");
    expect(chosen?.id).toBe("engineering_director");
    expect(chosen?.id).not.toBe("architecture_director");
  });

  test("...and the preference is NOT a requirement — a department with no manager still gets an owner", () => {
    // Ten of this chart's sixteen departments have no manager rung at all. A filter here would
    // refuse decomposition in every one of them to protect a structure the organization does not
    // have, which is a gate that cannot open.
    const owner = ownerForRung(chart, "director", "cto", undefined, Domain.Architecture);
    expect(owner?.id).toBe("architecture_director");
  });

  test("`mustSupportLevel` is a REQUIREMENT — distance does not override it", () => {
    // The distinction this pins was the defect. `mustSupportLevel` used to nudge the sort, so a
    // candidate that could not support the next rung still won when it was nearest — and the
    // failure surfaced a rung later, as an assignment refusal naming a hat nobody had chosen.
    //
    // A caller saying "this owner must be able to reach a manager" is stating a requirement, not a
    // preference, and honouring it is what lets the search DESCEND to a level that can instead of
    // handing back an owner it already knows cannot.
    //
    // Purpose-built rather than contorted from the seed: it needs a nearer candidate that CANNOT
    // support alongside a further one that can, and in the seed every such pair ties on distance.
    const built = buildOrgChart([
      { id: "root", name: "Board", level: "executive_board", departmentId: "d" },
      // Distance 1 from root, and no manager beneath it.
      { id: "near_dir", name: "Near", level: "director", departmentId: "d", reportsTo: "root" },
      { id: "mid", name: "Mid", level: "c_suite", departmentId: "d", reportsTo: "root" },
      // Distance 2 from root, and it does have a manager.
      { id: "far_dir", name: "Far", level: "director", departmentId: "d", reportsTo: "mid" },
      { id: "far_mgr", name: "Far Mgr", level: "manager", departmentId: "d", reportsTo: "far_dir" },
    ]);
    expect(built.ok).toBe(true);
    if (!built.ok) return;

    // The one that satisfies the requirement wins, even though it is further away.
    expect(ownerForRung(built.chart, "director", "root", "manager")?.id).toBe("far_dir");

    // AND DISTANCE STILL DECIDES AMONG CANDIDATES THAT ALL QUALIFY — otherwise this would have
    // replaced one arbitrary rule with another. Drop the requirement and the nearer one wins.
    expect(ownerForRung(built.chart, "director", "root")?.id).toBe("near_dir");
  });

  test("THE LADDER BENDS: a rung with nobody at its level falls to the parent itself", () => {
    // Six of this chart's directors have no manager beneath them and no lead either, so a project
    // in those departments has nobody at its nominal rung. Refusing there would stall ten of
    // sixteen departments over a structure the reference organization does not have — so the
    // director owns its own projects, which is what happens in a small department.
    expect(ownerForRung(chart, "manager", "architecture_director")?.id).toBe("architecture_director");
  });

  test("...but NEVER to a hat too junior to wear it", () => {
    // Caught by this test on the first version of the bending ladder: the manager rung was handed
    // to the individual contributor itself. A hat wearing a rung above its own level is not a small
    // department improvising, it is the hierarchy inverting.
    expect(ownerForRung(chart, "manager", "backend_implementer")).toBeUndefined();
  });
});

describe("decomposition refuses rather than inventing", () => {
  test("A LINE WITH NO CONTRIBUTORS FAILS AT THE LEAF, not at the top", () => {
    // The CFO has no directors, and its one report — `cost_controller` — supervises nobody.
    //
    // This used to refuse at the INITIATIVE, for want of a director. That was the rigid ladder
    // talking: the honest answer is that the CFO's initiative and project are the cost
    // controller's, and the thing this line genuinely cannot do is find anyone to DO the work.
    // Refusing three rungs early hid which fact was missing.
    let c = must(acceptGoal(EMPTY_CASCADE, chart, { workId: "g", title: "cost", acceptingHatId: "cfo" }));
    c = must(decompose(c, chart, "g", [{ workId: "i", title: "x" }]));
    expect(nodeById(c, "i")?.ownerHatId).toBe("cost_controller");
    c = must(decompose(c, chart, "i", [{ workId: "p", title: "y" }]));
    expect(nodeById(c, "p")?.ownerHatId).toBe("cost_controller");

    const r = decompose(c, chart, "p", [{ workId: "t", title: "z" }]);
    expect(r.ok).toBe(false);
    // AND THE MESSAGE NAMES THE REAL CAUSE. It used to say "no lead hat reports up to X", which
    // sent a reader looking for a lead that would not have helped — the search descends past lead
    // and past the parent. What is missing is somebody to do the work.
    if (!r.ok) expect(r.reason).toContain("no individual_contributor reports up to 'cost_controller'");
  });

  test("decomposing into zero children is refused", () => {
    const c = must(acceptGoal(EMPTY_CASCADE, chart, { workId: "g", title: "x", acceptingHatId: "cto" }));
    expect(decompose(c, chart, "g", []).ok).toBe(false);
  });

  test("a task cannot be decomposed further", () => {
    const c = fullLadder();
    const r = decompose(c, chart, "t1", [{ workId: "x", title: "y" }]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("bottom rung");
  });

  test("a duplicate work id is refused", () => {
    const c = fullLadder();
    expect(decompose(c, chart, "p1", [{ workId: "t1", title: "dup" }]).ok).toBe(false);
  });

  test("an unknown parent is refused", () => {
    expect(decompose(EMPTY_CASCADE, chart, "ghost", [{ workId: "x", title: "y" }]).ok).toBe(false);
  });
});

describe("assignment", () => {
  test("a task goes to an IC in the owner's line", () => {
    const c = fullLadder();
    expect(nodeById(c, "t1")?.assigneeHatId).toBe("backend_implementer");
  });

  test("an IC OUTSIDE the line is refused", () => {
    let c = fullLadder();
    // The QA engineer is a real IC and does not report to the engineering tech lead. Handing work
    // across means the owner cannot follow it up and the assignee answers to a non-supervisor.
    const r = assign(c, chart, "t1", "qa_engineer");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("does not report up to");
  });

  test("a non-IC is refused BECAUSE it is not a contributor", () => {
    // Asserting only `ok === false` passed for the wrong reason: the engineering manager is refused
    // by the reporting-line check too, since it sits ABOVE the task's owner rather than under it.
    // In this chart every hat beneath a lead is already an IC, so the level check has no
    // independent witness — pin the reason instead of contriving a hat to make one.
    const c = fullLadder();
    const r = assign(c, chart, "t1", "engineering_manager");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("individual contributor");
  });

  test("only a task takes an assignee", () => {
    const c = fullLadder();
    const r = assign(c, chart, "p1", "backend_implementer");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("only a task");
  });
});

describe("THE RULE: a goal cannot be closed by closing the goal", () => {
  test("marking a parent done is refused while it has children", () => {
    const c = fullLadder();
    const r = setState(c, "g1", WorkState.Done);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("delivered when they are");
  });

  test("a task with no assignee cannot be done — nobody did it", () => {
    let c = must(acceptGoal(EMPTY_CASCADE, chart, { workId: "g", title: "x", acceptingHatId: "cto" }));
    c = must(decompose(c, chart, "g", [{ workId: "i", title: "y" }]));
    c = must(decompose(c, chart, "i", [{ workId: "p", title: "z" }]));
    c = must(decompose(c, chart, "p", [{ workId: "t", title: "w" }]));
    const r = setState(c, "t", WorkState.Done);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("no assignee");
  });

  test("delivery rolls up from the leaves, all the way", () => {
    let c = fullLadder();
    expect(isDelivered(c, "g1")).toBe(false);

    c = must(setState(c, "t1", WorkState.Done));
    // One of two done. The goal is not delivered, and neither is anything above the task.
    expect(isDelivered(c, "t1")).toBe(true);
    expect(isDelivered(c, "p1")).toBe(false);
    expect(isDelivered(c, "g1")).toBe(false);

    c = must(setState(c, "t2", WorkState.Done));
    // Now every leaf is done, so every ancestor is delivered — without anyone marking them.
    expect(isDelivered(c, "p1")).toBe(true);
    expect(isDelivered(c, "i1")).toBe(true);
    expect(isDelivered(c, "g1")).toBe(true);
  });

  test("a goal nobody decomposed is NOT delivered", () => {
    // Vacuous `every` over no children is the most dangerous kind of green.
    const c = must(acceptGoal(EMPTY_CASCADE, chart, { workId: "g", title: "x", acceptingHatId: "cto" }));
    expect(isDelivered(c, "g")).toBe(false);
  });

  test("canceled children are skipped, but all-canceled is not delivered", () => {
    let c = fullLadder();
    c = must(setState(c, "t2", WorkState.Canceled));
    c = must(setState(c, "t1", WorkState.Done));
    // One live child, and it is done.
    expect(isDelivered(c, "p1")).toBe(true);

    let d = fullLadder();
    d = must(setState(d, "t1", WorkState.Canceled));
    d = must(setState(d, "t2", WorkState.Canceled));
    // Nothing was done, so nothing was delivered.
    expect(isDelivered(d, "p1")).toBe(false);
  });

  test("an unknown node is not delivered", () => {
    expect(isDelivered(fullLadder(), "ghost")).toBe(false);
  });
});

describe("who is accountable for this work", () => {
  test("the chain runs task → project → initiative → goal", () => {
    const c = fullLadder();
    expect(cascadeChainOf(c, "t1")).toEqual(["t1", "p1", "i1", "g1"]);
  });

  test("the accountable hats are lead, manager, director, C-suite — each named", () => {
    const c = fullLadder();
    const hats = accountableHatsFor(c, "t1");
    expect(hats).toHaveLength(4);
    const levels = hats.map((h) => chart.byId.get(h)?.level);
    expect(levels).toEqual(["lead", "manager", "director", "c_suite"]);
    // And they form a real reporting line, bottom to top.
    for (let i = 0; i + 1 < hats.length; i += 1) {
      expect(reportsUpTo(chart, hats[i]!, hats[i + 1]!)).toBe(true);
    }
  });
});

describe("what the RMO is asked to staff", () => {
  test("unstaffed tasks are exactly the unassigned, uncancelled ones", () => {
    let c = must(acceptGoal(EMPTY_CASCADE, chart, { workId: "g", title: "x", acceptingHatId: "cto" }));
    c = must(decompose(c, chart, "g", [{ workId: "i", title: "y" }]));
    c = must(decompose(c, chart, "i", [{ workId: "p", title: "z" }]));
    c = must(decompose(c, chart, "p", [{ workId: "t1", title: "a" }, { workId: "t2", title: "b" }]));
    expect(unstaffedTasks(c).map((n) => n.workId)).toEqual(["t1", "t2"]);

    c = must(assign(c, chart, "t1", "backend_implementer"));
    expect(unstaffedTasks(c).map((n) => n.workId)).toEqual(["t2"]);

    c = must(setState(c, "t2", WorkState.Canceled));
    expect(unstaffedTasks(c)).toHaveLength(0);
  });

  test("higher rungs are never counted as unstaffed — they are owned, not executed", () => {
    const c = fullLadder();
    expect(unstaffedTasks(c)).toHaveLength(0);
    expect(childrenOf(c, "g1")).toHaveLength(1);
  });
});

/** A cascade built down to the project rung, ready to decompose into leaves. */
function threeRungs(): { readonly cascade: Cascade; readonly projectId: string } {
  let c = must(acceptGoal(EMPTY_CASCADE, chart, { workId: "g1", title: "cut checkout abandonment", acceptingHatId: "cto" }));
  c = must(decompose(c, chart, "g1", [{ workId: "i1", title: "fix the coupon path" }]));
  c = must(decompose(c, chart, "i1", [{ workId: "p1", title: "coupon service hardening" }]));
  return { cascade: c, projectId: "p1" };
}

describe("the rung order is DELIBERATE, and pinned", () => {
  test("goal -> initiative -> project -> leaf, each owned a level down", () => {
    // Pinned because the reference orders Project above Initiative and the difference is a reading
    // of what its top arrow MEANS — an association to a long-lived product, not a decomposition.
    // A silent reorder to "match the reference" would invert a ladder that is correct as it stands.
    expect(CASCADE_RUNGS.map((r) => r.workType)).toEqual([
      WorkType.Goal,
      WorkType.Initiative,
      WorkType.Project,
      WorkType.Task,
    ]);
    expect(CASCADE_RUNGS.map((r) => r.ownerLevel)).toEqual(["c_suite", "director", "manager", "lead"]);
  });

  test("every rung except the last has one below it, and the last is a leaf", () => {
    for (const rung of CASCADE_RUNGS.slice(0, -1)) expect(nextRung(rung.workType)).toBeDefined();
    expect(isLeafType(CASCADE_RUNGS[CASCADE_RUNGS.length - 1]!.workType)).toBe(true);
  });
});

describe("THE BOTTOM RUNG IS NOT ONE SHAPE", () => {
  test("every leaf type shares the lead rung, and none has a rung below it", () => {
    for (const leaf of LEAF_TYPES) {
      expect(isLeafType(leaf)).toBe(true);
      expect(rungFor(leaf)?.ownerLevel).toBe("lead");
      // A leaf decomposes into nothing, whichever leaf it is.
      expect(nextRung(leaf)).toBeUndefined();
    }
    expect(LEAF_TYPES).toHaveLength(5);
  });

  test("the rungs above are NOT leaves, and each still has one below it", () => {
    for (const t of [WorkType.Goal, WorkType.Initiative, WorkType.Project]) {
      expect(isLeafType(t)).toBe(false);
      expect(nextRung(t)).toBeDefined();
    }
  });

  test("a child may name its own LEAF type", () => {
    const built = threeRungs();
    const r = decompose(built.cascade, chart, built.projectId, [
      { workId: "d1", title: "fix the outage", workType: WorkType.Incident },
      { workId: "r1", title: "verify the fix", workType: WorkType.Review },
    ]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(nodeById(r.cascade, "d1")?.workType).toBe(WorkType.Incident);
    expect(nodeById(r.cascade, "r1")?.workType).toBe(WorkType.Review);
  });

  test("A CHILD CANNOT SMUGGLE IN A TYPE FROM ANOTHER RUNG", () => {
    // Without the rung check a caller could create a `goal` as the child of a project and invert
    // the whole ladder — the cascade's ordering is the thing it exists to enforce.
    const built = threeRungs();
    const r = decompose(built.cascade, chart, built.projectId, [
      { workId: "g9", title: "sneaky", workType: WorkType.Goal },
    ]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("does not belong at the");
  });

  test("a leaf of ANY type can be assigned and completed", () => {
    const built = threeRungs();
    const made = decompose(built.cascade, chart, built.projectId, [
      { workId: "inc1", title: "restore service", workType: WorkType.Incident },
    ]);
    expect(made.ok).toBe(true);
    if (!made.ok) return;
    const assigned = assign(made.cascade, chart, "inc1", "backend_implementer");
    expect(assigned.ok).toBe(true);
    if (!assigned.ok) return;
    const done = setState(assigned.cascade, "inc1", WorkState.Done);
    expect(done.ok).toBe(true);
    if (done.ok) expect(isDelivered(done.cascade, "inc1")).toBe(true);
  });

  test("an unassigned leaf of any type cannot be marked done, and the refusal names its type", () => {
    const built = threeRungs();
    const made = decompose(built.cascade, chart, built.projectId, [
      { workId: "inc1", title: "restore", workType: WorkType.Incident },
    ]);
    expect(made.ok).toBe(true);
    if (!made.ok) return;
    const done = setState(made.cascade, "inc1", WorkState.Done);
    expect(done.ok).toBe(false);
    if (!done.ok) expect(done.reason).toContain("incident");
  });
});

describe("RESTATING A DIRECTION — a separate verb, because a silent overwrite is not a decision", () => {
  // Reachable from the drive only along the happy path, so every refusal here is tested directly.
  // A mutation run proved that necessary: deleting four of these five guards killed nothing,
  // because no cadence ever produced an input that tripped them.
  const chart = (() => {
    const r = buildOrgChart(SEED_HATS);
    if (!r.ok) throw new Error(r.reason);
    return r.chart;
  })();

  function withGoal(): Cascade {
    const r = acceptGoal({ nodes: [] }, chart, {
      workId: "g-1",
      title: "grow the business",
      acceptingHatId: "ceo",
      atMs: 100,
    });
    if (!r.ok) throw new Error(r.reason);
    return r.cascade;
  }

  test("acceptGoal RECORDS WHEN — without it nothing can ever go stale", () => {
    expect(withGoal().nodes[0]?.directedAtMs).toBe(100);
  });

  test("a clockless acceptGoal records NO time, rather than a convenient one", () => {
    const r = acceptGoal({ nodes: [] }, chart, { workId: "g-2", title: "t", acceptingHatId: "ceo" });
    if (!r.ok) throw new Error(r.reason);
    expect(r.cascade.nodes[0]?.directedAtMs).toBeUndefined();
  });

  test("the holder restates it: NEW OBJECTIVE, NEW CLOCK", () => {
    const r = restateDirection(withGoal(), chart, { workId: "g-1", title: "grow it faster", byHatId: "ceo", atMs: 500 });
    if (!r.ok) throw new Error(r.reason);
    expect(r.cascade.nodes[0]?.title).toBe("grow it faster");
    expect(r.cascade.nodes[0]?.directedAtMs).toBe(500);
  });

  test("ONLY THE ONE NAMED — a restatement is not a broadcast", () => {
    const two = acceptGoal(withGoal(), chart, { workId: "g-2", title: "hold the line", acceptingHatId: "ceo", atMs: 100 });
    if (!two.ok) throw new Error(two.reason);
    const r = restateDirection(two.cascade, chart, { workId: "g-1", title: "changed", byHatId: "ceo", atMs: 500 });
    if (!r.ok) throw new Error(r.reason);
    expect(r.cascade.nodes.find((n) => n.workId === "g-2")?.title).toBe("hold the line");
    expect(r.cascade.nodes.find((n) => n.workId === "g-2")?.directedAtMs).toBe(100);
  });

  test("REFUSED: a work item that is not a direction", () => {
    const cascade: Cascade = {
      nodes: [{ workId: "t-1", workType: WorkType.Task, title: "t", state: WorkState.Open, ownerHatId: "ceo" }],
    };
    const r = restateDirection(cascade, chart, { workId: "t-1", title: "x", byHatId: "ceo", atMs: 1 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("not a direction");
  });

  test("REFUSED: a lead restating the company's direction", () => {
    const r = restateDirection(withGoal(), chart, { workId: "g-1", title: "x", byHatId: "tech_lead", atMs: 1 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("restated at the top");
  });

  test("REFUSED: ANOTHER EXECUTIVE redirecting a peer's domain", () => {
    // Both are c_suite, so the level check passes and only this one stands between them. Without
    // it any executive could redirect any other's domain, which is not a hierarchy.
    const r = restateDirection(withGoal(), chart, { workId: "g-1", title: "x", byHatId: "cto", atMs: 1 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("held by 'ceo'");
  });

  test("REFUSED: a restatement that states nothing", () => {
    const r = restateDirection(withGoal(), chart, { workId: "g-1", title: "   ", byHatId: "ceo", atMs: 1 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("states nothing");
  });

  test("REFUSED: a direction that does not exist, and an unknown hat", () => {
    expect(restateDirection(withGoal(), chart, { workId: "nope", title: "x", byHatId: "ceo", atMs: 1 }).ok).toBe(false);
    expect(restateDirection(withGoal(), chart, { workId: "g-1", title: "x", byHatId: "ghost", atMs: 1 }).ok).toBe(false);
  });
});
