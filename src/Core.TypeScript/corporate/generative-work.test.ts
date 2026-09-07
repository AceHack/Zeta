/**
 * generative-work.test.ts — an empty company, and whether it can start itself.
 *
 * The load-bearing test is the last one, and it is a measurement rather than a scenario: hand the
 * drive a chart, an empty cascade and nothing else, and see whether an organization comes out.
 * Before these verbs existed the answer was a single round of `explore` — every hat had a menu, and
 * every item on it advanced work that did not exist.
 *
 * The rest are the three livelocks. All three had the same shape — an act offered, chosen, applied
 * and leaving its own precondition standing — and the third one was introduced by this file's own
 * subject, which is why the ratio is asserted directly rather than inferred from a round count.
 */

import { describe, expect, test } from "bun:test";
import {
  breakdownOpenings,
  directionOpenings,
  draftingOpenings,
  GenerativeKind,
  generativeOpeningsFor,
  priorityOpenings,
  supplyOpenings,
} from "./generative-work";
import { Domain } from "./domain-ontology";
import { WorkState, WorkType, type CascadeNode } from "./goal-cascade";
import { buildOrgChart } from "./org-chart";
import { SEED_HATS } from "./org-seed";
import { driveUntilSettled, type DriveDeps, type DriveState } from "./org-drive";
import { EMPTY_BOARD } from "./discussion-anchor";
import { EMPTY_CALENDAR } from "./work-schedule";
import { PriorityClass } from "./prioritization";

const chart = (() => {
  const r = buildOrgChart(SEED_HATS);
  if (!r.ok) throw new Error(r.reason);
  return r.chart;
})();

/**
 * A skeleton company, for the tests the full seed cannot falsify.
 *
 * The seed covers all fifteen blocker policies, so supply gaps are unreachable against it. This
 * keeps eight hats and nothing else, which leaves eleven policies with no owner — a real chart with
 * real gaps rather than a hand-built list of them.
 */
const thinChart = (() => {
  const keep = new Set([
    "executive_board_member",
    "ceo",
    "coo",
    "cto",
    "engineering_director",
    "engineering_manager",
    "tech_lead",
    "backend_implementer",
    "rmo_office",
  ]);
  const r = buildOrgChart(SEED_HATS.filter((h) => keep.has(h.id)));
  if (!r.ok) throw new Error(r.reason);
  return r.chart;
})();

const NONE: ReadonlySet<string> = new Set();

function node(over: Partial<CascadeNode> = {}): CascadeNode {
  return {
    workId: "w-1",
    workType: WorkType.Project,
    title: "a project",
    state: WorkState.Open,
    ownerHatId: "engineering_manager",
    domain: Domain.Implementation,
    ...over,
  };
}

describe("DIRECTION — a domain nobody pointed anywhere", () => {
  test("every domain with no live work is open, to the executive its department answers to", () => {
    const open = directionOpenings(chart, []);
    expect(open).toHaveLength(16);
    // SIX EXECUTIVES, NOT ONE. The first version of `executiveOver` sorted candidates ordinally
    // and every domain came out the CEO's, engineering included — "ceo" sorts before "cto". That
    // is the alphabetical routing this register was rewritten to end, reintroduced one module
    // later, and this assertion is what caught it.
    expect(new Map(open.map((o) => [o.domain, o.byHatId]))).toEqual(
      new Map([
        [Domain.Governance, "ceo"],
        [Domain.ProgramCoordination, "coo"],
        [Domain.ProductDiscovery, "ceo"],
        [Domain.BusinessRequirements, "ceo"],
        [Domain.Architecture, "cto"],
        [Domain.Implementation, "cto"],
        [Domain.EngineeringManagement, "cto"],
        [Domain.QualityVerification, "coo"],
        [Domain.TestAutomation, "cto"],
        [Domain.Security, "cto"],
        [Domain.Delivery, "coo"],
        [Domain.Memory, "coo"],
        [Domain.Documentation, "chief_architect"],
        [Domain.Operations, "cfo"],
        [Domain.Observability, "coo"],
        [Domain.CapabilityExpansion, "ceo"],
      ]),
    );
  });

  test("A DOMAIN WITH LIVE WORK IS NOT OPEN — the act closes its own opening", () => {
    // The property all three livelocks in this drive violated. If setting a direction left the
    // domain still looking empty, the C-suite would set it again every round forever.
    const open = directionOpenings(chart, [node({ domain: Domain.Implementation })]);
    expect(open.map((o) => o.domain)).not.toContain(Domain.Implementation);
    expect(open).toHaveLength(15);
  });

  test("DELIVERED WORK LEAVES THE DOMAIN EMPTY AGAIN — which is the point of a company", () => {
    // A domain whose work is all done is not a domain that is finished forever. This is the
    // mechanism by which the C-suite keeps having something to decide.
    const done = node({ domain: Domain.Implementation, state: WorkState.Done });
    expect(directionOpenings(chart, [done]).map((o) => o.domain)).toContain(Domain.Implementation);
  });

  test("the subject id is DERIVED from the domain, so a re-offer is the same opening", () => {
    expect(directionOpenings(chart, [])[0]?.subjectId).toBe("direction-governance");
  });
});

describe("BREAKDOWN — and the refusal it must not become", () => {
  test("a live non-leaf with nothing under it is open, to its OWNER", () => {
    const open = breakdownOpenings(chart, [node()], "rmo_office", NONE);
    expect(open).toHaveLength(1);
    expect(open[0]?.kind).toBe(GenerativeKind.BreakDownWork);
    expect(open[0]?.byHatId).toBe("engineering_manager");
  });

  test("ONCE IT HAS A CHILD IT IS CLOSED", () => {
    const parent = node();
    const child = node({ workId: "w-2", workType: WorkType.Task, parentWorkId: "w-1", ownerHatId: "tech_lead" });
    expect(breakdownOpenings(chart, [parent, child], "rmo_office", NONE).map((o) => o.subjectId)).not.toContain("w-1");
  });

  test("A LEAF IS NEVER OFFERED — that opening could never close", () => {
    // Every leaf type, not just `task`. The bottom of the ladder is decided by `nextRung`, which
    // answers undefined for all five, and asserting only `task` would leave the other four
    // untested against a guard that could easily have been written as `workType === Task`.
    for (const workType of [WorkType.Task, WorkType.Defect, WorkType.CapabilityRequest, WorkType.Review, WorkType.Incident]) {
      expect(breakdownOpenings(chart, [node({ workType, ownerHatId: "tech_lead" })], "rmo_office", NONE)).toEqual([]);
    }
  });

  test("WORK THE CHART CANNOT STAFF BECOMES A SUPPLY GAP, not a retry", () => {
    // MEASURED, not imagined: before this, `break_down_work` was chosen 257 times for 31 successful
    // breakdowns across one drive, the remaining 226 refused every round for a rung the chart has
    // no hat for. `architecture_director` supervises no managers, so its project cannot be split —
    // and that is the RMO's problem, not a thing to keep asking its owner about.
    const stuck = node({ ownerHatId: "architecture_director", domain: Domain.Architecture });
    const open = breakdownOpenings(chart, [stuck], "rmo_office", NONE);
    expect(open).toHaveLength(1);
    expect(open[0]?.kind).toBe(GenerativeKind.SizeHatSupply);
    expect(open[0]?.byHatId).toBe("rmo_office");
    // THE RUNG IS `lead`, not `manager`. A project's children are tasks and a task is owned at
    // lead level — the ladder says so, and guessing "one level down from a director" got it wrong
    // when this test was written. The subject is read off `CASCADE_RUNGS`, never off intuition.
    expect(open[0]?.subjectId).toBe("rung:architecture_director:lead");
  });

  test("...and FORTY-SEVEN items behind ONE absent manager are ONE request", () => {
    // Keyed on the missing rung rather than on the work, because the alternative buries the gap
    // under a request per item — which is the same defect as reporting it 226 times, spread out.
    const many = Array.from({ length: 47 }, (_, i) =>
      node({ workId: `w-${i}`, ownerHatId: "architecture_director", domain: Domain.Architecture }),
    );
    expect(breakdownOpenings(chart, many, "rmo_office", NONE)).toHaveLength(1);
  });

  test("A GAP ALREADY RAISED IS NOT RAISED AGAIN", () => {
    const stuck = node({ ownerHatId: "architecture_director", domain: Domain.Architecture });
    const raised = new Set(["rung:architecture_director:lead"]);
    expect(breakdownOpenings(chart, [stuck], "rmo_office", raised)).toEqual([]);
  });
});

describe("SUPPLY — raised once, and only by a hat that exists", () => {
  test("THE FULL CHART HAS NO ROUTING GAPS — measured, and stated so the next test is not vacuous", () => {
    // `routingCoverage` checks 15 blocker policies against this chart and finds ZERO absent owners.
    // So a falsifier for "supply gaps are raised once" written against the seed would be asserting
    // a rule over an empty list — a check that cannot fail, which is the defect this whole register
    // was built to hunt. Recorded here, and the real test below uses a chart that HAS gaps.
    expect(supplyOpenings(chart, "rmo_office", NONE)).toEqual([]);
  });

  test("a THINNED chart has eleven, all the RMO's", () => {
    const open = supplyOpenings(thinChart, "rmo_office", NONE);
    expect(open).toHaveLength(11);
    expect(open.every((o) => o.byHatId === "rmo_office")).toBe(true);
  });

  test("EVERY ONE OF THEM, RAISED, LEAVES NOTHING", () => {
    // The whole livelock fix in one assertion: 2199 choices across 18 rounds before it existed.
    const all = new Set(supplyOpenings(thinChart, "rmo_office", NONE).map((o) => o.subjectId));
    expect(supplyOpenings(thinChart, "rmo_office", all)).toEqual([]);
  });

  test("an unknown resource authority is offered nothing, rather than the chart being guessed", () => {
    expect(supplyOpenings(thinChart, "no_such_hat", NONE)).toEqual([]);
  });
});

describe("DRAFTING and PRICING", () => {
  test("live work with no artifact is open, to an IC in the work's own department", () => {
    const open = draftingOpenings(chart, [node()], NONE);
    expect(open).toHaveLength(1);
    expect(chart.byId.get(open[0]?.byHatId ?? "")?.departmentId).toBe("engineering");
  });

  test("AN EXISTING DOCUMENT CLOSES IT", () => {
    expect(draftingOpenings(chart, [node()], new Set(["doc-w-1"]))).toEqual([]);
  });

  test("a GOAL is never offered a document — it is a direction, not a deliverable", () => {
    const goal = node({ workType: WorkType.Goal, ownerHatId: "ceo" });
    expect(draftingOpenings(chart, [goal], NONE)).toEqual([]);
  });

  test("work with no domain is not offered one either — nobody knows who would write it", () => {
    const { domain: _none, ...noDomain } = node();
    expect(draftingOpenings(chart, [noDomain], NONE)).toEqual([]);
  });

  test("PRICING IS THE SUPERVISOR'S, not the owner's", () => {
    // An owner setting the priority of its own work is a preference, and `alternate-work.ts`
    // guards against work that bypasses the priority policy — which would be a check against a
    // number the same hat chose.
    const open = priorityOpenings(chart, [node()], NONE);
    expect(open).toHaveLength(1);
    expect(open[0]?.byHatId).toBe("engineering_director");
    expect(open[0]?.options).toEqual([...Object.values(PriorityClass)]);
  });

  test("a hat with NO supervisor prices its own work", () => {
    // The top of a chart has nobody to ask, and refusing there would leave the company's own goals
    // permanently unpriced — a gate that cannot open. The CEO is NOT that hat in this chart; the
    // board member above it is, which is worth knowing before assuming where a chart ends.
    expect(priorityOpenings(chart, [node({ ownerHatId: "ceo" })], NONE)[0]?.byHatId).toBe("executive_board_member");
    const top = node({ ownerHatId: "executive_board_member" });
    expect(priorityOpenings(chart, [top], NONE)[0]?.byHatId).toBe("executive_board_member");
  });

  test("AN ALREADY-PRICED ITEM IS CLOSED", () => {
    expect(priorityOpenings(chart, [node()], new Set(["w-1"]))).toEqual([]);
  });
});

describe("the menu is ordinal, and it is one hat's", () => {
  test("only this hat's openings, sorted by (kind, subject)", () => {
    const input = {
      chart,
      cascade: [node(), node({ workId: "w-0" })],
      artifactIds: NONE,
      pricedWorkIds: NONE,
      resourceAuthorityHatId: "rmo_office",
    };
    const mine = generativeOpeningsFor(input, "engineering_manager");
    expect(mine.every((o) => o.byHatId === "engineering_manager")).toBe(true);
    expect(mine.map((o) => o.subjectId)).toEqual(["w-0", "w-1"]);
  });

  test("A HAT WITH NOTHING TO DECIDE GETS AN EMPTY MENU, not a default one", () => {
    const input = {
      chart,
      cascade: [node()],
      artifactIds: new Set(["doc-w-1"]),
      pricedWorkIds: new Set(["w-1"]),
      resourceAuthorityHatId: "rmo_office",
    };
    expect(generativeOpeningsFor(input, "backend_implementer")).toEqual([]);
  });
});

describe("AN EMPTY COMPANY STARTS ITSELF", () => {
  // The measurement this module exists for. Nothing below is a fixture the drive was handed: it is
  // a chart, an empty cascade, and 200 rounds.
  const out = (() => {
    let n = 0;
    const state: DriveState = {
      view: {
        chart,
        board: EMPTY_BOARD,
        signals: [],
        cascade: [],
        artifacts: new Map(),
        blockers: new Map(),
      },
      cascade: { nodes: [] },
      calendar: EMPTY_CALENDAR,
    };
    const deps: DriveDeps = {
      chart,
      nowMs: 1_000_000,
      createId: (p) => `${p}-${String(++n)}`,
      resourceAuthorityHatId: "rmo_office",
    };
    return driveUntilSettled(state, chart.hats.map((h) => h.id), deps, 200);
  })();

  test("sixteen directions, set by the C-suite, one per domain", () => {
    const goals = out.state.cascade.nodes.filter((n) => n.workType === WorkType.Goal);
    expect(goals).toHaveLength(16);
    expect(new Set(goals.map((g) => g.ownerHatId))).toEqual(
      new Set(["ceo", "coo", "cto", "cfo", "chief_architect"]),
    );
    expect(new Set(goals.map((g) => g.domain))).toEqual(new Set(Object.values(Domain)));
  });

  test("...which BECAME work, DOCUMENTS and PRICES — not sixteen goals and a silence", () => {
    // The first four verbs alone produced exactly that: sixteen root goals, nothing underneath,
    // no documents. `break_down_work` is the fifth, and it was added because of this measurement.
    const nodes = out.state.cascade.nodes;
    expect(nodes.length).toBeGreaterThan(16);
    expect(out.state.view.artifacts.size).toBeGreaterThan(0);
    expect(out.state.view.priorities?.size).toBe(nodes.length);
  });

  test("EVERY DESCENDANT INHERITED ITS DIRECTION'S DOMAIN", () => {
    expect(out.state.cascade.nodes.filter((n) => n.domain === undefined)).toEqual([]);
  });

  test("NOT ONE REFUSAL, over the whole run", () => {
    // The livelock signature. Three have been found in this drive and every one of them showed up
    // here first, as an act chosen far more often than the organization accepted it.
    const refused = out.rounds.flatMap((r) => r.ticks).filter((t) => t.refusals.length > 0);
    expect(refused.map((t) => `${t.hatId}:${t.chosen?.kind}:${t.refusals[0]}`)).toEqual([]);
  });

  test("and it SETTLES — generative is not the same as never finished", () => {
    expect(out.settled).toBe(true);
    expect(out.rounds.slice(0, -1).filter((r) => r.changes === 0)).toEqual([]);
  });
});
