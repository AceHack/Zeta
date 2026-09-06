/**
 * alternate-work-wiring.test.ts — the guardrails only count where the work is actually handed over.
 *
 * `alternate-work.ts` can refuse anything. What matters is that the refusals sit on the path the
 * organization uses, which means two claims: a manager's menu offers a blocked report something to
 * do, and giving a blocked hat work goes through the guardrails WHATEVER THE CALLER MEANT BY IT.
 *
 * The second is the load-bearing one. If the guardrails were opt-in, the caller that most needs
 * them — one placing work on a stuck agent under time pressure — is exactly the one that skips them.
 */

import { describe, expect, test } from "bun:test";
import { alternateWorkFor, effectOf, orgSurfaceFor, type OrgView } from "./org-observe-bridge";
import { apply, type DriveDeps, type DriveState } from "./org-drive";
import { buildOrgChart } from "./org-chart";
import { SEED_HATS } from "./org-seed";
import { AnchorState, AnchorType, EMPTY_BOARD, ExpectedOutput, openAnchor } from "./discussion-anchor";
import { EMPTY_CALENDAR } from "./work-schedule";
import { WorkState, WorkType, type Cascade, type CascadeNode } from "./goal-cascade";
import { PriorityClass } from "./prioritization";
import type { NextAction } from "../observe/observe";

const chart = (() => {
  const r = buildOrgChart(SEED_HATS);
  if (!r.ok) throw new Error(r.reason);
  return r.chart;
})();

const NOW = 5_000;

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

/** `task-1` is blocked on the implementer; `task-2` and `task-3` are open under the same parent. */
const CASCADE: readonly CascadeNode[] = [
  { workId: "initiative-7", workType: WorkType.Initiative, title: "billing", state: WorkState.Open, ownerHatId: "tech_lead" },
  task("task-1", { assigneeHatId: "backend_implementer" }),
  task("task-2"),
  task("task-3"),
  task("task-elsewhere", { parentWorkId: "initiative-9" }),
];

const PRIORITIES = new Map([
  ["task-1", PriorityClass.High],
  ["task-2", PriorityClass.Normal],
  ["task-3", PriorityClass.Defer],
  ["task-elsewhere", PriorityClass.Expedite],
]);

function viewWith(over: Partial<OrgView> = {}): OrgView {
  const board = (() => {
    const a = openAnchor(EMPTY_BOARD, {
      anchorId: "task-1",
      anchorType: AnchorType.WorkItem,
      title: "task-1",
      purpose: "the blocked item's thread",
      expectedOutput: ExpectedOutput.Status,
      participantHatIds: ["tech_lead", "backend_implementer"],
      openedByHatId: "tech_lead",
      openedAtMs: 1,
      state: AnchorState.Open,
    });
    if (!a.ok) throw new Error(a.reason);
    return a.board;
  })();
  return {
    chart,
    board,
    signals: [],
    cascade: CASCADE,
    artifacts: new Map(),
    blockers: new Map([["backend_implementer", [{ about: "which store the port writes to", blocking: "task-1" }]]]),
    priorities: PRIORITIES,
    ...over,
  };
}

function stateOf(view: OrgView): DriveState {
  return { view, cascade: { nodes: view.cascade, goalId: "goal-1" } as unknown as Cascade, calendar: EMPTY_CALENDAR };
}

let n = 0;
const deps: DriveDeps = { chart, nowMs: NOW, createId: (p) => `${p}-${String(++n)}`, resourceAuthorityHatId: "rmo_office" };

function chosen(workId: string, toHatId = "backend_implementer"): NextAction {
  return {
    kind: "assign_work",
    item: { id: workId, title: `do ${workId}`, ready: true, ambiguous: false },
    toHatId,
    reason: "it is blocked",
  };
}

describe("THE MANAGER'S MENU OFFERS A BLOCKED REPORT SOMETHING TO DO", () => {
  test("the highest-priority item under the SAME parent is offered", () => {
    const offers = alternateWorkFor(viewWith(), "tech_lead");
    expect(offers).toHaveLength(1);
    // `task-2` is Normal and `task-3` is Defer. Offering both would hand the agent a choice the
    // priority policy already made.
    expect(offers[0]?.item.id).toBe("task-2");
    expect(offers[0]?.toHatIds).toEqual(["backend_implementer"]);
  });

  test("WORK UNDER ANOTHER PARENT IS NOT OFFERED, however urgent", () => {
    // `task-elsewhere` is Expedite and sits under `initiative-9`. Being blocked is the moment scope
    // creep is easiest to wave through, and the highest-priority thing nearby is the bait.
    expect(alternateWorkFor(viewWith(), "tech_lead").map((o) => o.item.id)).not.toContain("task-elsewhere");
  });

  test("NOTHING IS OFFERED WHEN PRIORITIES ARE NOT DECIDED", () => {
    // The honest default. The guardrail against bypassing the priority policy is a comparison, and
    // a comparison with no priorities is a check that cannot fail.
    const seeing = viewWith();
    expect(alternateWorkFor(seeing, "tech_lead")).toHaveLength(1);
    const blind: OrgView = {
      chart,
      board: seeing.board,
      signals: [],
      cascade: CASCADE,
      artifacts: new Map(),
      blockers: seeing.blockers ?? new Map(),
    };
    expect(alternateWorkFor(blind, "tech_lead")).toEqual([]);
  });

  test("nothing is offered to a hat that reports elsewhere", () => {
    // HONEST LIMIT: a mutant deleting the reporting-line filter survives this. `offerAlternateWork`
    // refuses on exactly the same relation, so removing the outer filter changes only how much work
    // is done before the same empty answer — an equivalent mutant, not an untested check. The filter
    // stays because scanning every blocker in the organization to refuse all but one is wasteful,
    // and it stops being equivalent the moment the two conditions differ.
    expect(alternateWorkFor(viewWith(), "qa_director")).toEqual([]);
  });

  test("nothing is offered when nobody is blocked", () => {
    expect(alternateWorkFor(viewWith({ blockers: new Map() }), "tech_lead")).toEqual([]);
  });

  test("it rides the same assignable key, as an offer NARROWED TO THE BLOCKED HAT", () => {
    // `assignableBy` also offers task-2, to every IC in the org. The alternate entry is the
    // narrower one — this specific item, for this specific stuck agent — and asserting only that
    // the id appears would pass with the alternate offer deleted entirely.
    const assignable = orgSurfaceFor(viewWith(), "tech_lead").assignable ?? [];
    expect(assignable.some((a) => a.item.id === "task-2" && a.toHatIds.length === 1 && a.toHatIds[0] === "backend_implementer")).toBe(true);
  });

  test("AN ITEM SOMEONE ALREADY HOLDS IS NOT AN AVAILABLE ALTERNATE", () => {
    const taken = CASCADE.map((n) => (n.workId === "task-2" ? { ...n, assigneeHatId: "frontend_implementer" } : n));
    expect(alternateWorkFor(viewWith({ cascade: taken }), "tech_lead").map((o) => o.item.id)).toEqual(["task-3"]);
  });

  test("TIES BREAK ORDINALLY, not by the order the cascade happens to list them", () => {
    // Two equally-ranked candidates must not be chosen by cascade order, or the same organization
    // offers a different item on two machines.
    // ORDER MATTERS IN THIS FIXTURE. Listed b-then-a, the ordinal rule and "last one seen wins"
    // both land on `task-a` and the test proves nothing — the first draft did exactly that and a
    // mutant swapping the rules survived it.
    const tied = [...CASCADE.slice(0, 2), task("task-a"), task("task-b")];
    const priorities = new Map([
      ["task-1", PriorityClass.High],
      ["task-a", PriorityClass.Normal],
      ["task-b", PriorityClass.Normal],
    ]);
    expect(alternateWorkFor(viewWith({ cascade: tied, priorities }), "tech_lead").map((o) => o.item.id)).toEqual(["task-a"]);
  });
});

describe("THE GUARDRAILS ARE NOT OPT-IN", () => {
  test("giving a blocked hat work goes through them whatever the caller meant", () => {
    const e = effectOf(viewWith(), "tech_lead", chosen("task-2"), { signalId: "s", anchorId: "a" }, NOW, "rmo_office");
    expect(e.ok).toBe(true);
    if (!e.ok) throw new Error("unreachable");
    expect(e.effect.kind).toBe("alternate");
    if (e.effect.kind !== "alternate") throw new Error("unreachable");
    // The blocked item travels with it — what makes the resumption question answerable later.
    expect(e.effect.assignment.blockedWorkId).toBe("task-1");
  });

  test("A LOWER-PRIORITY CHOICE IS REFUSED HERE, not only in the module", () => {
    const e = effectOf(viewWith(), "tech_lead", chosen("task-3"), { signalId: "s", anchorId: "a" }, NOW, "rmo_office");
    expect(e.ok).toBe(false);
    if (e.ok) throw new Error("unreachable");
    expect(e.reason).toContain("bypasses_priority");
  });

  test("OUT-OF-SCOPE WORK IS REFUSED at the point it would be handed over", () => {
    const e = effectOf(viewWith(), "tech_lead", chosen("task-elsewhere"), { signalId: "s", anchorId: "a" }, NOW, "rmo_office");
    expect(e.ok).toBe(false);
    if (e.ok) throw new Error("unreachable");
    // The module's OWN guardrail, reached rather than pre-empted. The first wiring built the
    // candidate list from the approved scope and then checked it against that same scope, so the
    // check could not fail — found by a mutation matrix, and fixed by letting every open task be a
    // candidate and letting the scope comparison do the refusing.
    expect(e.reason).toContain("outside_approved_scope");
  });

  test("a hat with no standing over the blocked agent cannot approve the detour", () => {
    const e = effectOf(viewWith(), "qa_director", chosen("task-2"), { signalId: "s", anchorId: "a" }, NOW, "rmo_office");
    expect(e.ok).toBe(false);
    if (e.ok) throw new Error("unreachable");
    expect(e.reason).toContain("approver_lacks_authority");
  });

  test("A BLOCKED HAT IS GIVEN FREE WORK, NEVER SOMEONE ELSE'S IN-FLIGHT WORK", () => {
    const view = viewWith({
      assigned: {
        nowMs: NOW,
        silenceSlaMs: 60_000,
        work: [
          {
            workId: "task-2",
            ownerHatId: "frontend_implementer",
            heartbeatAtMs: NOW - 120_000,
            tokenExpiresMs: NOW + 1,
            tokenRefreshFailed: false,
            transferable: true,
          },
        ],
      },
    });
    // The steal would otherwise be permitted — the owner is silent past the SLA. Filling a stuck
    // agent's time by taking work off a second agent trades one stall for two.
    const e = effectOf(view, "tech_lead", chosen("task-2"), { signalId: "s", anchorId: "a" }, NOW, "rmo_office");
    expect(e.ok).toBe(false);
    if (e.ok) throw new Error("unreachable");
    expect(e.reason).toContain("alternate_work");
  });

  test("UNBLOCKED TARGETS TAKE THE PLAIN ASSIGN PATH — nothing here applies to ordinary placement", () => {
    const e = effectOf(viewWith(), "tech_lead", chosen("task-3", "frontend_implementer"), { signalId: "s", anchorId: "a" }, NOW, "rmo_office");
    expect(e.ok).toBe(true);
    if (!e.ok) throw new Error("unreachable");
    expect(e.effect.kind).toBe("assign");
  });
});

describe("APPLYING IT LANDS THE WORK AND RECORDS WHY", () => {
  test("the alternate is assigned and the reason filed AGAINST THE BLOCKED ITEM", () => {
    const view = viewWith();
    const e = effectOf(view, "tech_lead", chosen("task-2"), { signalId: "s", anchorId: "a" }, NOW, "rmo_office");
    if (!e.ok) throw new Error("expected an effect");
    const r = apply(stateOf(view), e.effect, deps);
    expect(r.refusals).toEqual([]);
    expect(r.state.cascade.nodes.find((x) => x.workId === "task-2")?.assigneeHatId).toBe("backend_implementer");
    // What must survive is WHY this agent is doing something else — the fact the resumption
    // question needs when the blocker lifts. On the alternate's own thread nobody would look.
    const posts = r.state.view.board.posts.filter((p) => p.anchorId === "task-1");
    expect(posts.some((p) => p.body.includes("task-2"))).toBe(true);
  });

  test("THE BLOCKED ITEM IS NOT UNASSIGNED — alternate work pauses it, it does not replace it", () => {
    const view = viewWith();
    const e = effectOf(view, "tech_lead", chosen("task-2"), { signalId: "s", anchorId: "a" }, NOW, "rmo_office");
    if (!e.ok) throw new Error("expected an effect");
    const r = apply(stateOf(view), e.effect, deps);
    expect(r.state.cascade.nodes.find((x) => x.workId === "task-1")?.assigneeHatId).toBe("backend_implementer");
  });
});
