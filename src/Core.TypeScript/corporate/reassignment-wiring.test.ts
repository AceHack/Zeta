/**
 * reassignment-wiring.test.ts — does a steal actually reach the organization's state?
 *
 * `work-stealing.ts` decides whether a move is permitted. On its own that is a reader with no
 * writer: a verdict nothing acts on is a rule nobody obeys, and this register has found that defect
 * five times. These tests are the path — a silent owner is observed, the supervisor's MENU offers
 * the move, the chosen action derives a transfer, and `apply` lands it in the cascade with the
 * notice delivered.
 *
 * The two most important tests here are refusals at opposite ends of that path: healthy work is
 * never offered, and an offer that was true when the menu was built is re-checked before it is
 * applied.
 */

import { describe, expect, test } from "bun:test";
import { apply, type DriveDeps, type DriveState } from "./org-drive";
import { effectOf, orgSurfaceFor, stealableBy, type OrgView } from "./org-observe-bridge";
import { buildOrgChart } from "./org-chart";
import { SEED_HATS } from "./org-seed";
import { AnchorState, AnchorType, EMPTY_BOARD, ExpectedOutput, openAnchor } from "./discussion-anchor";
import { EMPTY_CALENDAR } from "./work-schedule";
import { assign, reassign, WorkState, WorkType, type Cascade, type CascadeNode } from "./goal-cascade";
import type { OwnedWork } from "./work-stealing";
import type { NextAction } from "../observe/observe";

const chart = (() => {
  const r = buildOrgChart(SEED_HATS);
  if (!r.ok) throw new Error(r.reason);
  return r.chart;
})();

const NOW = 1_000_000;
const SLA = 60_000;

const TASK: CascadeNode = {
  workId: "task-1",
  workType: WorkType.Task,
  title: "stop the double charge",
  state: WorkState.Open,
  ownerHatId: "tech_lead",
  assigneeHatId: "backend_implementer",
};

function owned(over: Partial<OwnedWork> = {}): OwnedWork {
  return {
    workId: "task-1",
    ownerHatId: "backend_implementer",
    heartbeatAtMs: NOW,
    tokenExpiresMs: NOW + 3_600_000,
    tokenRefreshFailed: false,
    transferable: true,
    ...over,
  };
}

function viewWith(work: readonly OwnedWork[], nowMs = NOW): OrgView {
  return {
    chart,
    // The anchor the notice is posted to. A transfer with nowhere to say so is refused, and that is
    // deliberate — see the last test in this file.
    board: (() => {
      const a = openAnchor(EMPTY_BOARD, {
        anchorId: "task-1",
        anchorType: AnchorType.WorkItem,
        title: "task-1",
        purpose: "the work item's thread",
        expectedOutput: ExpectedOutput.Status,
        participantHatIds: ["tech_lead", "backend_implementer", "frontend_implementer"],
        openedByHatId: "tech_lead",
        openedAtMs: 1,
        state: AnchorState.Open,
      });
      if (!a.ok) throw new Error(a.reason);
      return a.board;
    })(),
    signals: [],
    cascade: [TASK],
    artifacts: new Map(),
    assigned: { nowMs, silenceSlaMs: SLA, work },
  };
}

function stateOf(view: OrgView): DriveState {
  return { view, cascade: { nodes: view.cascade, goalId: "goal-1" } as unknown as Cascade, calendar: EMPTY_CALENDAR };
}

let n = 0;
const deps: DriveDeps = {
  chart,
  nowMs: NOW,
  createId: (p) => `${p}-${String(++n)}`,
  resourceAuthorityHatId: "rmo_office",
};

describe("THE MENU OFFERS ONLY WHAT THE ORGANIZATION WOULD GRANT", () => {
  test("HEALTHY WORK IS NEVER OFFERED for reassignment", () => {
    expect(stealableBy(viewWith([owned()]), "tech_lead")).toEqual([]);
  });

  test("a silent owner's work appears on the SUPERVISOR's surface", () => {
    const offers = stealableBy(viewWith([owned({ heartbeatAtMs: NOW - SLA })]), "tech_lead");
    expect(offers).toHaveLength(1);
    expect(offers[0]?.item.id).toBe("task-1");
    // The current owner is not among the targets — that would be a no-op reporting success.
    expect(offers[0]?.toHatIds).not.toContain("backend_implementer");
    expect(offers[0]?.toHatIds).toContain("frontend_implementer");
  });

  test("...and NOT on a hat with no standing over the trigger", () => {
    const silent = viewWith([owned({ heartbeatAtMs: NOW - SLA })]);
    expect(stealableBy(silent, "qa_director")).toEqual([]);
    expect(stealableBy(silent, "frontend_implementer")).toEqual([]);
  });

  test("NOTHING IS OFFERED WHEN LIVENESS IS NOT TRACKED", () => {
    // The honest default. A register with no heartbeat observations cannot claim an owner is
    // silent, and offering the move anyway would be a verdict derived from an empty measurement.
    const seeing = viewWith([owned({ heartbeatAtMs: NOW - SLA })]);
    expect(stealableBy(seeing, "tech_lead")).toHaveLength(1);
    const blind: OrgView = { chart, board: seeing.board, signals: [], cascade: [TASK], artifacts: new Map() };
    expect(stealableBy(blind, "tech_lead")).toEqual([]);
  });

  test("the offer rides the EXISTING assign_work key, alongside unowned work", () => {
    const surface = orgSurfaceFor(viewWith([owned({ heartbeatAtMs: NOW - SLA })]), "tech_lead");
    expect(surface.assignable?.map((a) => a.item.id)).toContain("task-1");
  });
});

describe("THE CHOICE REACHES THE CASCADE", () => {
  const chosen: NextAction = {
    kind: "assign_work",
    item: { id: "task-1", title: "stop the double charge", ready: true, ambiguous: false },
    toHatId: "frontend_implementer",
    reason: "owner silent",
  };

  test("a permitted steal becomes a REASSIGN effect carrying its obligations", () => {
    const view = viewWith([owned({ heartbeatAtMs: NOW - SLA, dependents: ["task-9"] })]);
    const e = effectOf(view, "tech_lead", chosen, { signalId: "s", anchorId: "a" }, NOW, "rmo_office");
    expect(e.ok).toBe(true);
    if (!e.ok) throw new Error("unreachable");
    expect(e.effect.kind).toBe("reassign");
    if (e.effect.kind !== "reassign") throw new Error("unreachable");
    expect(e.effect.transfer.fromHatId).toBe("backend_implementer");
    expect(e.effect.transfer.dependentsToUpdate).toEqual(["task-9"]);
  });

  test("APPLYING IT MOVES THE ASSIGNEE and posts the notice", () => {
    const view = viewWith([owned({ heartbeatAtMs: NOW - SLA })]);
    const e = effectOf(view, "tech_lead", chosen, { signalId: "s", anchorId: "a" }, NOW, "rmo_office");
    if (!e.ok) throw new Error("expected an effect");
    const r = apply(stateOf(view), e.effect, deps);
    expect(r.refusals).toEqual([]);
    expect(r.changed).toBe(true);
    expect(r.state.cascade.nodes[0]?.assigneeHatId).toBe("frontend_implementer");
    // THE PREVIOUS OWNER IS TOLD. `evaluateSteal` makes the notice a required field so it cannot be
    // dropped; delivering it is the other half, and without this the owner learns its work moved by
    // finding it gone.
    const posts = r.state.view.board.posts.filter((p) => p.anchorId === "task-1");
    expect(posts.some((p) => p.body.includes("frontend_implementer"))).toBe(true);
  });

  test("A STALE OFFER IS RE-CHECKED AT APPLY TIME — the owner may have spoken since", () => {
    // The menu was built when the owner was silent. By the time the action is applied it has
    // heartbeated, and the steal must now be refused. Trusting the earlier verdict is how a
    // permitted-once move becomes permitted-forever.
    const view = viewWith([owned({ heartbeatAtMs: NOW - SLA })]);
    const spokeSince: OrgView = {
      ...view,
      assigned: { nowMs: NOW, silenceSlaMs: SLA, work: [owned({ heartbeatAtMs: NOW })] },
    };
    const e = effectOf(spokeSince, "tech_lead", chosen, { signalId: "s", anchorId: "a" }, NOW, "rmo_office");
    expect(e.ok).toBe(false);
    if (e.ok) throw new Error("unreachable");
    expect(e.reason).toContain("no_trigger");
  });

  test("THE APPLICATION'S CLOCK DECIDES, not the one the menu was built at", () => {
    // The owner was fine when the surface was built and has said nothing since. Judging at the
    // surface's clock would freeze that verdict and the work would sit with a silent owner forever
    // — the anti-stall runtime failing in exactly the way it exists to prevent.
    const readAt = NOW;
    const applyAt = NOW + SLA / 2;
    const view: OrgView = {
      ...viewWith([]),
      assigned: {
        nowMs: readAt,
        silenceSlaMs: SLA,
        work: [owned({ heartbeatAtMs: applyAt - SLA })],
      },
    };
    const e = effectOf(view, "tech_lead", chosen, { signalId: "s", anchorId: "a" }, applyAt, "rmo_office");
    expect(e.ok).toBe(true);
    if (!e.ok) throw new Error("unreachable");
    expect(e.effect.kind).toBe("reassign");
  });

  test("OBSERVATIONS OLDER THAN THE SLA REFUSE — they cannot tell silence from a missed answer", () => {
    // Past that gap, an owner that was quiet throughout and one that answered just after the read
    // leave the same record. Stealing on it is a verdict the measurement does not support.
    const view: OrgView = {
      ...viewWith([]),
      assigned: { nowMs: NOW, silenceSlaMs: SLA, work: [owned({ heartbeatAtMs: NOW - SLA })] },
    };
    const e = effectOf(view, "tech_lead", chosen, { signalId: "s", anchorId: "a" }, NOW + SLA, "rmo_office");
    expect(e.ok).toBe(false);
    if (e.ok) throw new Error("unreachable");
    expect(e.reason).toContain("stale_observations");
  });

  test("WORK THE CASCADE DOES NOT HAVE IS NOT OFFERED — no invented titles", () => {
    const view: OrgView = {
      ...viewWith([]),
      cascade: [],
      assigned: { nowMs: NOW, silenceSlaMs: SLA, work: [owned({ heartbeatAtMs: NOW - SLA })] },
    };
    expect(stealableBy(view, "tech_lead")).toEqual([]);
  });

  test("UNOWNED WORK STILL TAKES THE PLAIN ASSIGN PATH", () => {
    const e = effectOf(viewWith([]), "tech_lead", chosen, { signalId: "s", anchorId: "a" }, NOW, "rmo_office");
    expect(e.ok).toBe(true);
    if (!e.ok) throw new Error("unreachable");
    expect(e.effect.kind).toBe("assign");
  });

  test("a transfer with NOWHERE TO DELIVER THE NOTICE is refused, not silently taken", () => {
    const view: OrgView = { ...viewWith([owned({ heartbeatAtMs: NOW - SLA })]), board: EMPTY_BOARD };
    const e = effectOf(view, "tech_lead", chosen, { signalId: "s", anchorId: "a" }, NOW, "rmo_office");
    if (!e.ok) throw new Error("expected an effect");
    const r = apply(stateOf(view), e.effect, deps);
    expect(r.changed).toBe(false);
    expect(r.refusals).not.toEqual([]);
  });
});

describe("THE CASCADE NO LONGER OVERWRITES AN ASSIGNEE IN SILENCE", () => {
  const cascade = { nodes: [TASK], goalId: "goal-1" } as unknown as Cascade;

  test("ASSIGN REFUSES WORK THAT SOMEONE ALREADY HOLDS", () => {
    // This overwrote the assignee and returned ok — a reassignment performed by whoever called
    // first, with no trigger, no notice, and no preservation of what the previous holder had done.
    const r = assign(cascade, chart, "task-1", "frontend_implementer");
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toContain("already assigned");
  });

  test("assigning the SAME hat again is idempotent, not a refusal", () => {
    expect(assign(cascade, chart, "task-1", "backend_implementer").ok).toBe(true);
  });

  test("reassign takes it, and still enforces every eligibility rule assign does", () => {
    expect(reassign(cascade, chart, "task-1", "frontend_implementer").ok).toBe(true);
    // A manager may not be handed the work by the reassignment door either.
    expect(reassign(cascade, chart, "task-1", "engineering_manager").ok).toBe(false);
  });

  test("REASSIGN REFUSES WORK NOBODY HOLDS — that is an assignment, and it says so", () => {
    const unheld = { nodes: [{ ...TASK, assigneeHatId: undefined }], goalId: "goal-1" } as unknown as Cascade;
    const r = reassign(unheld, chart, "task-1", "frontend_implementer");
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toContain("use assign");
  });
});
