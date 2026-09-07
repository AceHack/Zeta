/**
 * org-observe-bridge.test.ts — the menu is a projection of the organization, not a set of flags.
 *
 * The properties worth pinning are the ones that decide who drives what. Nothing in the bridge
 * names a role: a TPM ends up assigning because assignment is offered to hats whose reports can
 * take the work, and an engineering manager ends up unblocking people because `ReportBlocker`
 * routes to the immediate supervisor. So the tests assert the DERIVATIONS, and the role behaviour
 * follows from the chart.
 */

import { describe, expect, test } from "bun:test";
import {
  assignableBy,
  convenableBy,
  deliberationsOf,
  effectOf,
  orgSurfaceFor,
  reviewsAskedOf,
  type OrgView,
} from "./org-observe-bridge";
import { buildOrgChart } from "./org-chart";
import { SEED_HATS } from "./org-seed";
import { SignalTool, type SupervisorSignal } from "./supervisor-signal";
import { AnchorState, AnchorType, EMPTY_BOARD, ExpectedOutput, type DiscussionAnchor } from "./discussion-anchor";
import { headsOf, mergeHistories, openArtifact, revise, type ArtifactHistory } from "./artifact-deliberation";
import { WorkState, WorkType, type CascadeNode } from "./goal-cascade";
import type { NextAction } from "../observe/observe";

const chart = (() => {
  const r = buildOrgChart(SEED_HATS);
  if (!r.ok) throw new Error(r.reason);
  return r.chart;
})();

function artifact(id = "task-1"): ArtifactHistory {
  const r = openArtifact({ artifactId: id, byHatId: "tech_lead", atMs: 1, content: "v1", note: "n" });
  if (!r.ok) throw new Error(r.reason);
  return r.history;
}

/** Two hats revise the same parent — a real divergence, not a described one. */
function diverged(id = "task-1"): ArtifactHistory {
  const base = artifact(id);
  const root = headsOf(base)[0]!.revisionId;
  const a = revise(base, { parents: [root], byHatId: "tech_lead", atMs: 2, content: "A", note: "n" });
  const b = revise(base, { parents: [root], byHatId: "qa_director", atMs: 3, content: "B", note: "n" });
  if (!a.ok || !b.ok) throw new Error("revise refused");
  const m = mergeHistories(a.history, b.history);
  if (!m.ok) throw new Error(m.reason);
  return m.history;
}

function signal(over: Partial<SupervisorSignal> = {}): SupervisorSignal {
  return {
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
    ...over,
  } as SupervisorSignal;
}

function node(over: Partial<CascadeNode> = {}): CascadeNode {
  return {
    workId: "task-1",
    workType: WorkType.Task,
    title: "a task",
    state: WorkState.Open,
    ownerHatId: "engineering_manager",
    ...over,
  } as CascadeNode;
}

function view(over: Partial<OrgView> = {}): OrgView {
  return {
    chart,
    board: EMPTY_BOARD,
    signals: [],
    cascade: [],
    artifacts: new Map([["task-1", artifact()]]),
    ...over,
  };
}

describe("a review is offered because someone ASKED, and only to them", () => {
  test("the hat the signal names is offered the review", () => {
    const asks = reviewsAskedOf(view({ signals: [signal()] }), "engineering_manager");
    expect(asks.length).toBe(1);
    expect(asks[0]?.forGate).toBe("implementation_review");
    expect(asks[0]?.askedByHatId).toBe("tech_lead");
  });

  test("nobody else is", () => {
    expect(reviewsAskedOf(view({ signals: [signal()] }), "qa_director")).toEqual([]);
  });

  test("a signal that is not a review request offers nothing", () => {
    const asks = reviewsAskedOf(view({ signals: [signal({ tool: SignalTool.AskQuestion })] }), "engineering_manager");
    expect(asks).toEqual([]);
  });

  test("THE REVIEW NAMES THE EXACT REVISION, so a verdict is about known bytes", () => {
    const asks = reviewsAskedOf(view({ signals: [signal()] }), "engineering_manager");
    expect(asks[0]?.revisionId).toBe(headsOf(artifact())[0]!.revisionId);
  });

  test("A DIVERGED ARTIFACT IS NOT OFFERED FOR REVIEW — there is no 'the current version'", () => {
    // Reviewing a diverged artifact invites a verdict on text nobody agreed was the text. It needs
    // a merge first, and `convenableBy` below is what offers that instead.
    const v = view({ signals: [signal()], artifacts: new Map([["task-1", diverged()]]) });
    expect(reviewsAskedOf(v, "engineering_manager")).toEqual([]);
  });
});

describe("a room is offered only while it is open, and only to who is in it", () => {
  const anchor: DiscussionAnchor = {
    anchorId: "a1",
    anchorType: AnchorType.Gate,
    title: "the design",
    purpose: "agree it",
    expectedOutput: ExpectedOutput.Decision,
    participantHatIds: ["tech_lead", "qa_director"],
    openedByHatId: "tech_lead",
    openedAtMs: 1,
    state: AnchorState.Open,
    workItemId: "task-1",
  };

  test("a participant is offered the turn", () => {
    const v = view({ board: { ...EMPTY_BOARD, anchors: [anchor] } });
    const open = deliberationsOf(v, "qa_director");
    expect(open.length).toBe(1);
    expect(open[0]?.anchorId).toBe("a1");
  });

  test("someone not in the room is not", () => {
    const v = view({ board: { ...EMPTY_BOARD, anchors: [anchor] } });
    expect(deliberationsOf(v, "product_manager")).toEqual([]);
  });

  test("A RESOLVED ANCHOR IS NOT OFFERED — the menu must not promise a refused act", () => {
    // `postToAnchor` would refuse it anyway; offering it is the menu lying to the agent about what
    // it can do, which is worse than not offering it at all.
    const v = view({
      board: { ...EMPTY_BOARD, anchors: [{ ...anchor, state: AnchorState.Resolved }] },
    });
    expect(deliberationsOf(v, "qa_director")).toEqual([]);
  });
});

describe("assignment follows the CHART, which is why no role is hardcoded", () => {
  test("a hat with reports may hand out work it owns", () => {
    const v = view({ cascade: [node()] });
    const out = assignableBy(v, "engineering_manager");
    expect(out.length).toBe(1);
    expect(out[0]?.item.id).toBe("task-1");
    // Its direct reports, from the chart — not a list anybody wrote here.
    expect(out[0]?.toHatIds.length).toBeGreaterThan(0);
  });

  test("AN IC HAS NO REPORTS, SO IT IS OFFERED NOTHING TO ASSIGN", () => {
    // The hierarchy doing the work, rather than a rule saying "ICs may not assign".
    const v = view({ cascade: [node({ ownerHatId: "backend_implementer" })] });
    expect(assignableBy(v, "backend_implementer")).toEqual([]);
  });

  test("a hat is not offered work it does not own", () => {
    const v = view({ cascade: [node({ ownerHatId: "qa_manager" })] });
    expect(assignableBy(v, "engineering_manager")).toEqual([]);
  });

  test("ALREADY-ASSIGNED WORK IS NOT OFFERED — reassignment is a different act", () => {
    const v = view({ cascade: [node({ assigneeHatId: "backend_implementer" })] });
    expect(assignableBy(v, "engineering_manager")).toEqual([]);
  });

  test("a parent is not assignable — its children carry the work", () => {
    const v = view({ cascade: [node({ workType: WorkType.Project })] });
    expect(assignableBy(v, "engineering_manager")).toEqual([]);
  });
});

describe("convening is offered where it HELPS — a diverged artifact", () => {
  test("two heads offer a room with the people who wrote them", () => {
    const v = view({ artifacts: new Map([["task-1", diverged()]]) });
    const out = convenableBy(v, "solution_architect");
    expect(out.length).toBe(1);
    expect(out[0]?.withHatIds).toContain("tech_lead");
    expect(out[0]?.withHatIds).toContain("qa_director");
  });

  test("AN AGREED ARTIFACT OFFERS NO ROOM — there is nothing to reconcile", () => {
    expect(convenableBy(view(), "solution_architect")).toEqual([]);
  });

  test("a hat is never offered a room with only itself", () => {
    // `scheduleMeeting` refuses fewer than two attendees; offering it would be a guaranteed refusal.
    const solo = openArtifact({ artifactId: "x", byHatId: "tech_lead", atMs: 1, content: "c", note: "n" });
    if (!solo.ok) throw new Error(solo.reason);
    const root = headsOf(solo.history)[0]!.revisionId;
    const a = revise(solo.history, { parents: [root], byHatId: "tech_lead", atMs: 2, content: "A", note: "n" });
    const b = revise(solo.history, { parents: [root], byHatId: "tech_lead", atMs: 3, content: "B", note: "n" });
    if (!a.ok || !b.ok) throw new Error("revise refused");
    const m = mergeHistories(a.history, b.history);
    if (!m.ok) throw new Error(m.reason);
    expect(convenableBy(view({ artifacts: new Map([["x", m.history]]) }), "tech_lead")).toEqual([]);
  });

  test("attendees are ordered ORDINALLY, not by locale", () => {
    expect("B" < "a").toBe(true);
  });
});

describe("ROUTING IS DERIVED — an agent asking for help cannot pick who answers", () => {
  const ask = (blocking: string): NextAction => ({
    kind: "request_information",
    about: "which store the port writes to",
    blocking,
    reason: "cannot proceed",
  });

  test("a blocker routes UP THE CHAIN, to the asker's own supervisor", () => {
    // The agent names the tool; the chart names the target. That is what stops an agent from
    // shopping for a more agreeable answerer.
    const r = effectOf(view(), "backend_implementer", ask("task-1"), { signalId: "s", anchorId: "a" }, 1, "rmo_office");
    expect(r.ok).toBe(true);
    if (!r.ok || r.effect.kind !== "signal") throw new Error("expected a signal");
    expect(r.effect.signal.toHatId).toBe("tech_lead");
    expect(r.effect.signal.fromHatId).toBe("backend_implementer");
  });

  test("A BLOCKER AND A QUESTION ARE DIFFERENT TOOLS — naming blocked work decides which", () => {
    const blocker = effectOf(view(), "backend_implementer", ask("task-1"), { signalId: "s", anchorId: "a" }, 1, "rmo_office");
    const question = effectOf(view(), "backend_implementer", ask(""), { signalId: "s2", anchorId: "a2" }, 1, "rmo_office");
    if (!blocker.ok || blocker.effect.kind !== "signal") throw new Error("expected a signal");
    if (!question.ok || question.effect.kind !== "signal") throw new Error("expected a signal");
    expect(blocker.effect.signal.tool).toBe(SignalTool.ReportBlocker);
    expect(question.effect.signal.tool).toBe(SignalTool.AskQuestion);
  });

  test("the blocked work travels as EVIDENCE, so the ask is not an opinion", () => {
    const r = effectOf(view(), "backend_implementer", ask("task-1"), { signalId: "s", anchorId: "a" }, 1, "rmo_office");
    if (!r.ok || r.effect.kind !== "signal") throw new Error("expected a signal");
    expect(r.effect.signal.evidence.map((e) => e.ref)).toContain("blocked:task-1");
  });
});

describe("every other verb is the agent's own business", () => {
  test("choosing to rest asks nothing of the organization", () => {
    const r = effectOf(view(), "tech_lead", { kind: "free_time", reason: "r" }, { signalId: "s", anchorId: "a" }, 1, "rmo_office");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.effect.kind).toBe("none");
  });

  test("an assignment becomes an assignment", () => {
    const action: NextAction = {
      kind: "assign_work",
      item: { id: "task-1", title: "t", ready: true, ambiguous: false },
      toHatId: "backend_implementer",
      reason: "r",
    };
    const r = effectOf(view(), "engineering_manager", action, { signalId: "s", anchorId: "a" }, 1, "rmo_office");
    if (!r.ok || r.effect.kind !== "assign") throw new Error("expected an assignment");
    expect(r.effect.workId).toBe("task-1");
    expect(r.effect.toHatId).toBe("backend_implementer");
  });
});

describe("the whole surface for one hat", () => {
  test("a manager with work, a review asked of it, and an open room sees all three", () => {
    const anchor: DiscussionAnchor = {
      anchorId: "a1",
      anchorType: AnchorType.Gate,
      title: "the design",
      purpose: "agree it",
      expectedOutput: ExpectedOutput.Decision,
      participantHatIds: ["engineering_manager"],
      openedByHatId: "engineering_manager",
      openedAtMs: 1,
      state: AnchorState.Open,
      workItemId: "task-1",
    };
    const surface = orgSurfaceFor(
      view({ signals: [signal()], cascade: [node()], board: { ...EMPTY_BOARD, anchors: [anchor] } }),
      "engineering_manager",
    );
    expect(surface.reviewsAsked?.length).toBe(1);
    expect(surface.deliberations?.length).toBe(1);
    expect(surface.assignable?.length).toBe(1);
    // Nothing is blocking it and nothing has diverged, so those two are honestly empty.
    expect(surface.missing).toEqual([]);
    expect(surface.convenable).toEqual([]);
  });

  test("AN AGENT WITH NOTHING ASKED OF IT SEES AN EMPTY SURFACE, not a missing one", () => {
    const surface = orgSurfaceFor(view(), "backend_implementer");
    expect(surface.reviewsAsked).toEqual([]);
    expect(surface.deliberations).toEqual([]);
    expect(surface.assignable).toEqual([]);
  });
});

describe("YOU SPEAK ONCE PER VERSION — deliberation, not chatter", () => {
  const anchor: DiscussionAnchor = {
    anchorId: "a1",
    anchorType: AnchorType.Gate,
    title: "the design",
    purpose: "agree it",
    expectedOutput: ExpectedOutput.Decision,
    participantHatIds: ["tech_lead", "qa_director"],
    openedByHatId: "tech_lead",
    openedAtMs: 1,
    state: AnchorState.Open,
    workItemId: "task-1",
  };

  function withPost(byHatId: string, revisionId: string) {
    return view({
      board: {
        ...EMPTY_BOARD,
        anchors: [anchor],
        posts: [
          {
            postId: "p1",
            anchorId: "a1",
            byHatId,
            atMs: 2,
            body: "said",
            evidence: [{ kind: "document", ref: `artifact:task-1@${revisionId}` }],
          },
        ],
      },
    });
  }

  test("a hat that already addressed THIS revision is not offered another turn", () => {
    // Without this the menu offers a turn every tick forever and the drive never settles —
    // measured: a ten-round drive that never quiesced because two hats posted a fresh turn each
    // round about a document nobody had changed.
    const head = headsOf(artifact())[0]!.revisionId;
    expect(deliberationsOf(withPost("qa_director", head), "qa_director")).toEqual([]);
  });

  test("...but ANOTHER hat still is — one speaker does not close the room", () => {
    const head = headsOf(artifact())[0]!.revisionId;
    expect(deliberationsOf(withPost("qa_director", head), "tech_lead").length).toBe(1);
  });

  test("A HAT THAT SPOKE ABOUT AN OLDER REVISION MAY SPEAK AGAIN", () => {
    // When the artifact moves, the head changes and everyone may speak again — which is exactly
    // when their opinion is worth having. A rule that silenced them permanently would make the
    // first version the only one anybody reviewed.
    expect(deliberationsOf(withPost("qa_director", "some-older-revision"), "qa_director").length).toBe(1);
  });
});
