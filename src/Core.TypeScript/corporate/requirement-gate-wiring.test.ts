/**
 * requirement-gate-wiring.test.ts — the gate has to sit at the MOMENT, not on one path to it.
 *
 * `readinessOf` can refuse an ambiguous item. That is worth nothing if the organization has three
 * ways to put work on a contributor and only one of them asks. Placement in this register happens
 * through plain assignment, a controlled steal, and alternate work for a blocked agent — and all
 * three put the same not-yet-understood item in front of the same agent.
 *
 * So every test here is the same question asked at a different door.
 */

import { describe, expect, test } from "bun:test";
import { alternateWorkFor, assignableBy, effectOf, type OrgView } from "./org-observe-bridge";
import { buildOrgChart } from "./org-chart";
import { SEED_HATS } from "./org-seed";
import { AnchorState, AnchorType, EMPTY_BOARD, ExpectedOutput, openAnchor } from "./discussion-anchor";
import { WorkState, WorkType, type CascadeNode } from "./goal-cascade";
import { PriorityClass } from "./prioritization";
import {
  AmbiguityFactor,
  type RequirementMaturity,
  type RequirementProfile,
  type Waiver,
} from "./requirement-maturity";
import type { NextAction } from "../observe/observe";

const chart = (() => {
  const r = buildOrgChart(SEED_HATS);
  if (!r.ok) throw new Error(r.reason);
  return r.chart;
})();

const NOW = 9_000;

function task(workId: string, over: Partial<CascadeNode> = {}): CascadeNode {
  return {
    workId,
    workType: WorkType.Task,
    title: `do ${workId}`,
    state: WorkState.Open,
    ownerHatId: "tech_lead",
    parentWorkId: "initiative-7",
    ...over,
  };
}

const CASCADE: readonly CascadeNode[] = [
  { workId: "initiative-7", workType: WorkType.Initiative, title: "billing", state: WorkState.Open, ownerHatId: "tech_lead" },
  task("task-1", { assigneeHatId: "backend_implementer" }),
  task("task-2"),
];

/** Ambiguous and customer-facing, sitting at raw intake — nothing about it is understood yet. */
const UNREADY: { profile: RequirementProfile; maturity: RequirementMaturity; waivers?: readonly Waiver[] } = {
  profile: {
    requirementId: "task-2",
    customerFacing: true,
    factors: [AmbiguityFactor.UnclearBehavior, AmbiguityFactor.MultipleInterpretations],
  },
  maturity: "raw_intake",
};

function board() {
  const a = openAnchor(EMPTY_BOARD, {
    anchorId: "task-1",
    anchorType: AnchorType.WorkItem,
    title: "task-1",
    purpose: "thread",
    expectedOutput: ExpectedOutput.Status,
    participantHatIds: ["tech_lead", "backend_implementer", "frontend_implementer"],
    openedByHatId: "tech_lead",
    openedAtMs: 1,
    state: AnchorState.Open,
  });
  if (!a.ok) throw new Error(a.reason);
  return a.board;
}

function viewWith(over: Partial<OrgView> = {}): OrgView {
  return { chart, board: board(), signals: [], cascade: CASCADE, artifacts: new Map(), ...over };
}

const GATED = viewWith({ requirements: new Map([["task-2", UNREADY]]) });

function chosen(workId: string, toHatId: string): NextAction {
  return {
    kind: "assign_work",
    item: { id: workId, title: `do ${workId}`, ready: true, ambiguous: false },
    toHatId,
    reason: "placing it",
  };
}

describe("DOOR 1 — plain assignment", () => {
  test("an unready item is not on the owner's menu", () => {
    expect(assignableBy(GATED, "tech_lead").map((a) => a.item.id)).toEqual([]);
    // ...and is, once nothing is recorded against it.
    expect(assignableBy(viewWith(), "tech_lead").map((a) => a.item.id)).toEqual(["task-2"]);
  });

  test("AND CHOOSING IT ANYWAY IS REFUSED", () => {
    const e = effectOf(GATED, "tech_lead", chosen("task-2", "backend_implementer"), { signalId: "s", anchorId: "a" }, NOW, "rmo_office");
    expect(e.ok).toBe(false);
    if (e.ok) throw new Error("unreachable");
    expect(e.reason).toContain("immature");
  });

  test("a signed waiver from the right hats opens it", () => {
    const waived = viewWith({
      requirements: new Map([
        [
          "task-2",
          {
            ...UNREADY,
            waivers: [
              { kind: "no_discovery" as const, approvedByHatId: "product_manager", reason: "specified in the runbook" },
              { kind: "no_brd" as const, approvedByHatId: "product_director", reason: "no external commitment" },
            ],
          },
        ],
      ]),
    });
    expect(assignableBy(waived, "tech_lead").map((a) => a.item.id)).toEqual(["task-2"]);
    expect(effectOf(waived, "tech_lead", chosen("task-2", "backend_implementer"), { signalId: "s", anchorId: "a" }, NOW, "rmo_office").ok).toBe(true);
  });
});

describe("DOOR 2 — a controlled steal", () => {
  const silent = {
    nowMs: NOW,
    silenceSlaMs: 60_000,
    work: [
      {
        workId: "task-1",
        ownerHatId: "backend_implementer",
        heartbeatAtMs: NOW - 120_000,
        tokenExpiresMs: NOW + 1,
        tokenRefreshFailed: false,
        transferable: true,
      },
    ],
  };

  test("AN UNREADY ITEM IS NOT MOVED TO A NEW OWNER EITHER", () => {
    // A steal is permitted here — the owner is silent past the SLA — so this fails unless the gate
    // sits at the moment rather than on the plain-assignment path.
    const view = viewWith({ assigned: silent, requirements: new Map([["task-1", { ...UNREADY, profile: { ...UNREADY.profile, requirementId: "task-1" } }]]) });
    const e = effectOf(view, "tech_lead", chosen("task-1", "frontend_implementer"), { signalId: "s", anchorId: "a" }, NOW, "rmo_office");
    expect(e.ok).toBe(false);
    if (e.ok) throw new Error("unreachable");
    expect(e.reason).toContain("immature");
  });

  test("...and IS moved when nothing gates it", () => {
    const view = viewWith({ assigned: silent });
    const e = effectOf(view, "tech_lead", chosen("task-1", "frontend_implementer"), { signalId: "s", anchorId: "a" }, NOW, "rmo_office");
    expect(e.ok).toBe(true);
    if (!e.ok) throw new Error("unreachable");
    expect(e.effect.kind).toBe("reassign");
  });
});

describe("DOOR 3 — alternate work for a blocked agent", () => {
  const blocked = new Map([["backend_implementer", [{ about: "which store", blocking: "task-1" }]]]);
  const priorities = new Map([
    ["task-1", PriorityClass.High],
    ["task-2", PriorityClass.Normal],
  ]);

  test("AN UNREADY ITEM IS NOT OFFERED AS SOMETHING TO DO MEANWHILE", () => {
    // It is not a safe way to fill the time — it is a second stall with a head start.
    const view = viewWith({ blockers: blocked, priorities, requirements: new Map([["task-2", UNREADY]]) });
    expect(alternateWorkFor(view, "tech_lead")).toEqual([]);
    // Without the gate it is exactly what would be offered.
    expect(alternateWorkFor(viewWith({ blockers: blocked, priorities }), "tech_lead").map((o) => o.item.id)).toEqual(["task-2"]);
  });

  test("and handing it over directly is refused", () => {
    const view = viewWith({ blockers: blocked, priorities, requirements: new Map([["task-2", UNREADY]]) });
    const e = effectOf(view, "tech_lead", chosen("task-2", "backend_implementer"), { signalId: "s", anchorId: "a" }, NOW, "rmo_office");
    expect(e.ok).toBe(false);
    if (e.ok) throw new Error("unreachable");
    expect(e.reason).toContain("immature");
  });
});

describe("WHAT THE GATE DELIBERATELY DOES NOT DO", () => {
  test("AN ITEM WITH NOTHING RECORDED IS NOT GATED — the gate is only as good as intake", () => {
    // The permissive direction, and stated rather than assumed: the organization cannot refuse on a
    // measurement it never took. Recording the profile is intake's job, not this seam's.
    const view = viewWith({ requirements: new Map() });
    expect(assignableBy(view, "tech_lead").map((a) => a.item.id)).toEqual(["task-2"]);
  });

  test("an ordinary internal item passes at any maturity", () => {
    const internal = viewWith({
      requirements: new Map([
        ["task-2", { profile: { requirementId: "task-2", customerFacing: false, factors: [] }, maturity: "raw_intake" as const }],
      ]),
    });
    expect(assignableBy(internal, "tech_lead").map((a) => a.item.id)).toEqual(["task-2"]);
  });
});
