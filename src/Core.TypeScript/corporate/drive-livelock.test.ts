/**
 * drive-livelock.test.ts — a loop that never settles is not the same thing as an organization that
 * is alive.
 *
 * Both defects here were found the same way: running the drive for 200 rounds against the full
 * chart and reading what actually happened, rather than reasoning about whether it would work.
 * Every individual step was correct in both cases. The AGGREGATE was a livelock, and no unit test
 * could see it because no unit test ran the same tick twice.
 *
 *   1. A tech lead was offered `assign_work` to a BLOCKED implementer every round. `placementEffect`
 *      correctly routed that through the alternate-work guardrails, which correctly refused for
 *      want of decided priorities. The same act, offered and refused, 200 times.
 *   2. A blocked implementer chose `request_information` every round, and the organization
 *      accumulated 200 identical signals about one blocker.
 *
 * So these tests assert a property no single tick has: RUN IT AGAIN AND SOMETHING MUST BE
 * DIFFERENT.
 */

import { describe, expect, test } from "bun:test";
import { driveUntilSettled, type DriveDeps, type DriveState } from "./org-drive";
import { orgSurfaceFor, type OrgView } from "./org-observe-bridge";
import { buildOrgChart } from "./org-chart";
import { SEED_HATS } from "./org-seed";
import { EMPTY_BOARD } from "./discussion-anchor";
import { EMPTY_CALENDAR } from "./work-schedule";
import { WorkState, WorkType, type CascadeNode } from "./goal-cascade";
import { SignalTool, type SupervisorSignal } from "./supervisor-signal";

const chart = (() => {
  const r = buildOrgChart(SEED_HATS);
  if (!r.ok) throw new Error(r.reason);
  return r.chart;
})();

const NODES: readonly CascadeNode[] = [
  { workId: "proj-1", workType: WorkType.Project, title: "cart", state: WorkState.Open, ownerHatId: "engineering_manager" },
  { workId: "task-1", workType: WorkType.Task, title: "stop the double charge", state: WorkState.Open, ownerHatId: "tech_lead", parentWorkId: "proj-1" },
  { workId: "task-2", workType: WorkType.Task, title: "retry ledger", state: WorkState.Open, ownerHatId: "tech_lead", parentWorkId: "proj-1" },
];

const BLOCKED = new Map([
  ["backend_implementer", [{ about: "which store the port writes to", blocking: "task-1" }]],
]);

function stateWith(over: Partial<OrgView> = {}): DriveState {
  const view: OrgView = {
    chart,
    board: EMPTY_BOARD,
    signals: [],
    cascade: NODES,
    artifacts: new Map(),
    blockers: BLOCKED,
    ...over,
  };
  return { view, cascade: { nodes: NODES }, calendar: EMPTY_CALENDAR };
}

function drive(rounds: number) {
  let n = 0;
  const deps: DriveDeps = {
    chart,
    nowMs: 1_000_000,
    createId: (p) => `${p}-${String(++n)}`,
    resourceAuthorityHatId: "rmo_office",
  };
  return driveUntilSettled(stateWith(), chart.hats.map((h) => h.id), deps, rounds);
}

describe("A BLOCKED HAT IS NOT AN ASSIGNMENT TARGET", () => {
  test("it is not offered as one, because the effect path would refuse", () => {
    // The menu's own rule. Giving work to a blocked hat is ALTERNATE work and goes through
    // `alternateWorkFor`, which offers it only when the guardrails can actually be satisfied.
    const targets = orgSurfaceFor(stateWith().view, "tech_lead").assignable?.flatMap((a) => a.toHatIds) ?? [];
    expect(targets.length).toBeGreaterThan(0);
    expect(targets).not.toContain("backend_implementer");
    expect(targets).toContain("frontend_implementer");
  });

  test("an UNBLOCKED hat is still offered — this is not a blanket exclusion", () => {
    const targets = orgSurfaceFor(stateWith({ blockers: new Map() }).view, "tech_lead").assignable?.flatMap((a) => a.toHatIds) ?? [];
    expect(targets).toContain("backend_implementer");
  });

  test("THE ASSIGNMENTS ACTUALLY LAND — offered, chosen, and applied", () => {
    // Before the fix this was `assign_work` chosen 200 times with zero assignments, every one
    // refused. A menu whose choices never apply is a menu of nothing.
    const out = drive(50);
    const assigned = out.state.cascade.nodes.filter((n) => n.assigneeHatId !== undefined);
    expect(assigned).toHaveLength(2);
    expect(out.rounds.flatMap((r) => r.ticks).flatMap((t) => t.refusals)).toEqual([]);
  });
});

describe("YOU RAISE A BLOCKER ONCE", () => {
  test("a blocker already reported leaves the hat's surface", () => {
    const first = orgSurfaceFor(stateWith().view, "backend_implementer");
    expect(first.missing).toHaveLength(1);

    // Drive one round so the signal exists, then look again.
    const out = drive(1);
    const after = orgSurfaceFor(out.state.view, "backend_implementer");
    expect(after.missing).toEqual([]);
  });

  test("A SECOND, DIFFERENT BLOCKER ON THE SAME TASK STILL SURFACES", () => {
    // Matching on the work item alone would silence it, and the hat would be stuck on something
    // nobody ever heard about.
    const out = drive(1);
    const twoBlockers = new Map([
      [
        "backend_implementer",
        [
          { about: "which store the port writes to", blocking: "task-1" },
          { about: "whether retries are idempotent", blocking: "task-1" },
        ],
      ],
    ]);
    const surface = orgSurfaceFor({ ...out.state.view, blockers: twoBlockers }, "backend_implementer");
    expect(surface.missing?.map((m) => m.about)).toEqual(["whether retries are idempotent"]);
  });

  test("A DIFFERENT SIGNAL FAMILY DOES NOT COUNT AS RAISING IT", () => {
    // "Have I reported this as a BLOCKER" is a different question from "have I ever mentioned this
    // string". Contrived on purpose: the review request carries the same work item AND the same
    // title, which is the only shape where dropping the family check would actually silence a real
    // blocker — and the check exists so that shape stays impossible rather than unlikely.
    const view = stateWith().view;
    const impostor: SupervisorSignal = {
      signalId: "s-1",
      fromHatId: "backend_implementer",
      fromLevel: "individual_contributor",
      toHatId: "tech_lead",
      toLevel: "lead",
      tool: SignalTool.RequestReview,
      title: "which store the port writes to",
      message: "please look",
      evidence: [{ kind: "diff", ref: "d" }],
      atMs: 1,
      anchorId: "a",
      workItemId: "task-1",
    };
    const surface = orgSurfaceFor({ ...view, signals: [impostor] }, "backend_implementer");
    expect(surface.missing).toHaveLength(1);
  });

  test("ANOTHER HAT'S REPORT DOES NOT SILENCE MINE", () => {
    const out = drive(1);
    const alsoBlocked = new Map([
      ["backend_implementer", [{ about: "which store the port writes to", blocking: "task-1" }]],
      ["frontend_implementer", [{ about: "which store the port writes to", blocking: "task-1" }]],
    ]);
    const surface = orgSurfaceFor({ ...out.state.view, blockers: alsoBlocked }, "frontend_implementer");
    expect(surface.missing).toHaveLength(1);
  });
});

describe("THE PROPERTY NO SINGLE TICK HAS", () => {
  test("RUN IT AGAIN AND SOMETHING IS DIFFERENT — the drive settles instead of repeating", () => {
    // The whole file in one assertion. 200 identical rounds is not an organization working; it is
    // one unresolved state being re-reported until somebody stops the loop.
    const out = drive(200);
    expect(out.settled).toBe(true);
    expect(out.rounds.length).toBeLessThan(10);
  });

  test("ONE SIGNAL PER BLOCKER, not one per round", () => {
    const out = drive(200);
    expect(out.state.view.signals).toHaveLength(1);
  });

  test("...and the loop does real work before it settles", () => {
    // Settling is only good news if something happened first. A drive that settles immediately
    // because nothing was ever on any surface is the other failure, and this distinguishes them.
    const out = drive(200);
    expect(out.rounds.reduce((n, r) => n + r.changes, 0)).toBeGreaterThan(0);
  });
});
