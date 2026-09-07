/**
 * org-drive.test.ts — does the organization actually move on its own?
 *
 * The tests that matter are the CHAINS. An IC that is blocked reports it, the report lands on its
 * supervisor's menu on the next tick, and the supervisor's tick is what unblocks it — with nobody
 * having written "engineering managers unblock people" anywhere. If that works, the hierarchy is
 * doing the routing, which is the whole claim.
 */

import { describe, expect, test } from "bun:test";
import { apply, driveRound, tick, type DriveDeps, type DriveState } from "./org-drive";
import { orgSurfaceFor, type OrgView } from "./org-observe-bridge";
import { buildOrgChart, reportsUpTo } from "./org-chart";
import { SEED_HATS } from "./org-seed";
import { EMPTY_BOARD } from "./discussion-anchor";
import { EMPTY_CALENDAR } from "./work-schedule";
import { headsOf, mergeHistories, openArtifact, revise, type ArtifactHistory } from "./artifact-deliberation";
import { WorkState, WorkType, type Cascade, type CascadeNode } from "./goal-cascade";
import { SignalTool } from "./supervisor-signal";
import type { NextAction } from "../observe/observe";

const chart = (() => {
  const r = buildOrgChart(SEED_HATS);
  if (!r.ok) throw new Error(r.reason);
  return r.chart;
})();

let n = 0;
function deps(over: Partial<DriveDeps> = {}): DriveDeps {
  return {
    chart,
    nowMs: 1_000,
    createId: (p) => `${p}-${String(++n)}`,
    resourceAuthorityHatId: "rmo_office",
    ...over,
  };
}

function node(over: Partial<CascadeNode> = {}): CascadeNode {
  return {
    workId: "task-1",
    workType: WorkType.Task,
    title: "stop the double charge",
    state: WorkState.Open,
    ownerHatId: "engineering_manager",
    ...over,
  } as CascadeNode;
}

function cascadeOf(nodes: readonly CascadeNode[]): Cascade {
  return { nodes, goalId: "goal-1" } as unknown as Cascade;
}

function state(over: Partial<OrgView> = {}, nodes: readonly CascadeNode[] = []): DriveState {
  const view: OrgView = {
    chart,
    board: EMPTY_BOARD,
    signals: [],
    cascade: nodes,
    artifacts: new Map(),
    ...over,
  };
  return { view, cascade: cascadeOf(nodes), calendar: EMPTY_CALENDAR };
}

function diverged(id: string): ArtifactHistory {
  const base = openArtifact({ artifactId: id, byHatId: "tech_lead", atMs: 1, content: "v1", note: "n" });
  if (!base.ok) throw new Error(base.reason);
  const root = headsOf(base.history)[0]!.revisionId;
  const a = revise(base.history, { parents: [root], byHatId: "tech_lead", atMs: 2, content: "A", note: "n" });
  const b = revise(base.history, { parents: [root], byHatId: "qa_director", atMs: 3, content: "B", note: "n" });
  if (!a.ok || !b.ok) throw new Error("revise refused");
  const m = mergeHistories(a.history, b.history);
  if (!m.ok) throw new Error(m.reason);
  return m.history;
}

describe("THE ESCALATION CHAIN RUNS ITSELF", () => {
  test("a blocked IC's report lands on its SUPERVISOR's surface on the next tick", () => {
    // The claim in one test. Nobody wrote "engineering managers unblock people" — the report
    // routes up because `supervisor-signal` derives the target from the chart, and the supervisor
    // sees it because the surface is a projection of the organization's actual state.
    const blockers = new Map([
      ["backend_implementer", [{ about: "which store the port writes to", blocking: "task-1" }]],
    ]);
    const before = state({ blockers });

    // Nothing is waiting for the supervisor yet.
    expect(orgSurfaceFor(before.view, "tech_lead").reviewsAsked).toEqual([]);

    const t = tick(before, "backend_implementer", deps());
    expect(t.chosen?.kind).toBe("request_information");
    if (t.effect.kind !== "signal") throw new Error("expected a signal");
    // Routed, not chosen: the IC named a tool and the chart named the target.
    expect(t.effect.signal.toHatId).toBe("tech_lead");

    const after = apply(before, t.effect, deps());
    expect(after.changed).toBe(true);
    // And now the supervisor's own view holds it.
    expect(after.state.view.signals.map((s) => s.toHatId)).toContain("tech_lead");
    expect(after.state.view.signals[0]?.tool).toBe(SignalTool.ReportBlocker);
  });

  test("AN AGENT CANNOT SHOP FOR A FRIENDLIER ANSWERER", () => {
    // Two different ICs asking the same question reach two different supervisors, because the
    // chart decides. An agent choosing its own recipient could route around a "no".
    const one = tick(
      state({ blockers: new Map([["backend_implementer", [{ about: "x", blocking: "task-1" }]]]) }),
      "backend_implementer",
      deps(),
    );
    const two = tick(
      state({ blockers: new Map([["qa_engineer", [{ about: "x", blocking: "task-1" }]]]) }),
      "qa_engineer",
      deps(),
    );
    if (one.effect.kind !== "signal" || two.effect.kind !== "signal") throw new Error("expected signals");
    expect(one.effect.signal.toHatId).not.toBe(two.effect.signal.toHatId);
  });

  test("a hat with nothing asked of it ASKS THE ORGANIZATION FOR NOTHING", () => {
    // My first draft asserted `chosen` was undefined and was wrong about the core: the four free
    // modes are ALWAYS in the menu (non-coercion), so a hat with no organizational work still
    // chooses — it explores. "Idle" here means the organization is asked for nothing, which is a
    // claim about the EFFECT rather than about the choice.
    const t = tick(state(), "backend_implementer", deps());
    expect(t.chosen?.kind).toBe("explore");
    expect(t.effect.kind).toBe("none");
    expect(t.changed).toBe(false);
  });
});

describe("ASSIGNMENT FLOWS DOWN THE CHART, with no role hardcoded", () => {
  test("a hat that owns unassigned work assigns it to one of its own reports", () => {
    const before = state({}, [node()]);
    const t = tick(before, "engineering_manager", deps());
    expect(t.chosen?.kind).toBe("assign_work");
    if (t.effect.kind !== "assign") throw new Error("expected an assignment");
    expect(t.effect.workId).toBe("task-1");
    // Someone in that hat's own org who can actually execute work — an IC, transitively reporting
    // to it. A DIRECT report would be too narrow: this manager's only direct report is a lead.
    expect(reportsUpTo(chart, t.effect.toHatId, "engineering_manager")).toBe(true);
    expect(t.effect.toHatId).not.toBe("engineering_manager");
  });

  test("...and the cascade actually records it", () => {
    const before = state({}, [node()]);
    const t = tick(before, "engineering_manager", deps());
    const after = apply(before, t.effect, deps());
    expect(after.refusals).toEqual([]);
    expect(after.changed).toBe(true);
    expect(after.state.cascade.nodes[0]?.assigneeHatId).toBeDefined();
  });

  test("ASSIGNED WORK IS NOT ASSIGNED TWICE — the second tick has nothing to do", () => {
    // What makes the loop settle rather than churn: once the work has an owner, the menu stops
    // offering it, so a stalled organization is distinguishable from a busy one.
    const before = state({}, [node()]);
    const first = tick(before, "engineering_manager", deps());
    const after = apply(before, first.effect, deps());
    const second = tick(after.state, "engineering_manager", deps());
    // Not `chosen === undefined` — the free modes are always offered. The claim is that the
    // organization is no longer asked for anything, which is a statement about the EFFECT.
    expect(second.effect.kind).toBe("none");
  });
});

describe("A DIVERGED ARTIFACT PULLS PEOPLE INTO A ROOM", () => {
  test("the hat is offered a meeting, and applying it books real calendar time", () => {
    const before = state({ artifacts: new Map([["design-1", diverged("design-1")]]) });
    const t = tick(before, "solution_architect", deps());
    expect(t.chosen?.kind).toBe("convene_meeting");

    const after = apply(before, t.effect, deps());
    expect(after.changed).toBe(true);
    // Everyone in the room has a block; a meeting is booked atomically or not at all.
    expect(after.state.calendar.blocks.length).toBeGreaterThanOrEqual(2);
    // And the room owes a decision, because a room over a divergence that only "discusses" it
    // lets everyone leave with the divergence intact.
    expect(after.state.view.board.anchors[0]?.expectedOutput).toBe("decision");
  });

  test("an AGREED artifact convenes nobody", () => {
    const agreed = openArtifact({ artifactId: "d", byHatId: "tech_lead", atMs: 1, content: "c", note: "n" });
    if (!agreed.ok) throw new Error(agreed.reason);
    const t = tick(state({ artifacts: new Map([["d", agreed.history]]) }), "solution_architect", deps());
    expect(t.effect.kind).toBe("none");
    expect(t.chosen?.kind).not.toBe("convene_meeting");
  });
});

describe("A REVIEW IS CHOSEN BUT NEVER APPLIED HERE", () => {
  test("the tick reports the choice and the organization does not record a verdict", () => {
    // The load-bearing refusal. A review's verdict belongs to the pipeline's gate, where separation
    // of duties, evidence and the legal-outcome clamp live. Recording an approval from this side
    // would be a second path to a passed gate that bypasses every one of them.
    const artifact = openArtifact({ artifactId: "task-1", byHatId: "tech_lead", atMs: 1, content: "c", note: "n" });
    if (!artifact.ok) throw new Error(artifact.reason);
    const before = state({
      artifacts: new Map([["task-1", artifact.history]]),
      signals: [
        {
          signalId: "s1",
          fromHatId: "tech_lead",
          fromLevel: "lead",
          toHatId: "engineering_manager",
          toLevel: "manager",
          tool: SignalTool.RequestReview,
          title: "implementation_review",
          message: "please review",
          evidence: [],
          atMs: 1,
          anchorId: "a1",
          workItemId: "task-1",
        } as never,
      ],
    });
    const t = tick(before, "engineering_manager", deps());
    expect(t.chosen?.kind).toBe("review_artifact");
    const after = apply(before, t.effect, deps());
    expect(after.changed).toBe(false);
    expect(after.state.view.board.decisions).toEqual([]);
  });
});

describe("a ROUND gives every hat a turn, and reports what moved", () => {
  const hats = SEED_HATS.map((h) => h.id);

  test("the whole organization ticks and the changes are counted", () => {
    const before = state({ blockers: new Map([["backend_implementer", [{ about: "x", blocking: "task-1" }]]]) }, [node()]);
    const r = driveRound(before, hats, deps());
    expect(r.changes).toBeGreaterThan(0);
    expect(r.summary).toContain("change(s)");
  });

  test("EACH EFFECT IS APPLIED BEFORE THE NEXT HAT TICKS — that is what makes a chain work", () => {
    // The supervisor's tick can see the blocker its report raised a moment earlier, rather than a
    // snapshot from before the round began.
    const before = state({ blockers: new Map([["backend_implementer", [{ about: "x", blocking: "task-1" }]]]) });
    const r = driveRound(before, ["backend_implementer", "tech_lead"], deps());
    expect(r.state.view.signals.length).toBe(1);
    const ic = r.ticks.find((t) => t.hatId === "backend_implementer");
    expect(ic?.changed).toBe(true);
  });

  test("A SETTLED ORGANIZATION REPORTS ZERO CHANGES rather than looking busy", () => {
    // The stall detector's input. A driver that keeps ticking while nothing changes burns a budget
    // producing nothing and reports success by never admitting it finished.
    const r = driveRound(state(), hats, deps());
    expect(r.changes).toBe(0);
  });

  test("DRY RUN derives every effect and applies NONE", () => {
    // The only honest way to ask "what would the organization do next?" without it having done it.
    const before = state({}, [node()]);
    const r = driveRound(before, hats, deps({ dryRun: true }));
    expect(r.changes).toBe(0);
    expect(r.summary).toContain("DRY RUN");
    expect(r.state.cascade.nodes[0]?.assigneeHatId).toBeUndefined();
    // ...but the choice was still derived, so a reader can see what it WOULD have done.
    expect(r.ticks.some((t) => t.chosen?.kind === "assign_work")).toBe(true);
  });

  test("a chooser can override the default, and the drive stays replayable", () => {
    const never = (): NextAction | undefined => undefined;
    const r = driveRound(state({}, [node()]), hats, deps({ choose: never }));
    expect(r.changes).toBe(0);
    expect(r.ticks.every((t) => t.chosen === undefined)).toBe(true);
  });

  test("the same drive twice gives the same result — deterministic", () => {
    const before = state({}, [node()]);
    const a = driveRound(before, hats, deps({ createId: (p) => `${p}-fixed` }));
    const b = driveRound(before, hats, deps({ createId: (p) => `${p}-fixed` }));
    expect(a.changes).toBe(b.changes);
    expect(a.ticks.map((t) => t.chosen?.kind)).toEqual(b.ticks.map((t) => t.chosen?.kind));
  });
});

describe("what the driver REFUSES, and reports", () => {
  test("A REFUSED ASSIGNMENT IS NOT A CHANGE, and carries the reason", () => {
    // Work is executed by an individual contributor. Applying an assignment to a lead must report
    // `changed: false` WITH the refusal, or the driver counts a move the organization rejected and
    // its stall detector goes blind.
    const before = state({}, [node()]);
    const r = apply(before, { kind: "assign", workId: "task-1", toHatId: "tech_lead" }, deps());
    expect(r.changed).toBe(false);
    expect(r.refusals.length).toBe(1);
    expect(r.refusals[0]).toContain("individual contributor");
    expect(r.state.cascade.nodes[0]?.assigneeHatId).toBeUndefined();
  });

  test("A DERIVATION THE ORGANIZATION REFUSES IS REPORTED, not smoothed into an idle tick", () => {
    // The top of the chain has nobody above it, so a blocker report has no legal target. The hat
    // chose something real and the organization would not accept it — which is a different fact
    // from the hat having chosen nothing, and a driver that conflates them hides a stuck agent.
    const before = state({
      blockers: new Map([["executive_board_member", [{ about: "x", blocking: "task-1" }]]]),
    });
    const t = tick(before, "executive_board_member", deps());
    expect(t.chosen?.kind).toBe("request_information");
    expect(t.effect.kind).toBe("none");
    expect(t.refusals.length).toBe(1);
    expect(t.summary).toContain("refused it");
  });

  test("AN EFFECT IS APPLIED BEFORE THE SAME HAT TICKS AGAIN — no stale snapshot", () => {
    // The property the chain depends on, isolated. One hat, twice in a round: with each effect
    // applied first it assigns once and then has nothing; against a snapshot from before the round
    // it would assign the same item twice.
    const before = state({}, [node()]);
    const r = driveRound(before, ["engineering_manager", "engineering_manager"], deps());
    expect(r.changes).toBe(1);
    expect(r.ticks[0]?.changed).toBe(true);
    expect(r.ticks[1]?.changed).toBe(false);
  });
});
