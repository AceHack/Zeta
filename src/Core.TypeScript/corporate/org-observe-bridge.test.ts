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
import { acceptAction, HumanActionKind, type HumanAction } from "./human-action";
import { observe } from "../observe/observe";
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

describe("SUBMITTING WORK — the assignee, and nobody else", () => {
  const submit = (subjectId: string): NextAction => ({ kind: "submit_work", subjectId, reason: "done" });
  const assigned = (over: Partial<CascadeNode> = {}) =>
    view({ cascade: [node({ assigneeHatId: "backend_implementer", ...over })] });

  test("the assignee's submission becomes a submission effect carrying the PROPOSER", () => {
    // Carried rather than re-derived at the point of application, because `runGateChain` uses it to
    // keep every gate off the hat that did the work — and the cascade is about to change.
    const r = effectOf(assigned(), "backend_implementer", submit("task-1"), { signalId: "s", anchorId: "a" }, 1, "rmo_office");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.effect).toEqual({ kind: "submission", workId: "task-1", proposerHatId: "backend_implementer" });
  });

  test("REFUSED: a hat submitting work assigned to somebody else", () => {
    // Re-derived here rather than trusted from the menu: the surface was built at an earlier
    // moment and the work may have been reassigned since, which would put the real assignee's name
    // on somebody else's claim.
    const r = effectOf(assigned(), "frontend_implementer", submit("task-1"), { signalId: "s", anchorId: "a" }, 1, "rmo_office");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("assigned to 'backend_implementer'");
  });

  test("REFUSED: work nobody has done", () => {
    const r = effectOf(view({ cascade: [node()] }), "backend_implementer", submit("task-1"), { signalId: "s", anchorId: "a" }, 1, "rmo_office");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("no assignee");
  });

  test("REFUSED: work that is already finished, or cancelled", () => {
    for (const state of [WorkState.Done, WorkState.Canceled]) {
      const r = effectOf(assigned({ state }), "backend_implementer", submit("task-1"), { signalId: "s", anchorId: "a" }, 1, "rmo_office");
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toContain(`already ${state}`);
    }
  });

  test("REFUSED: a work item that does not exist", () => {
    const r = effectOf(assigned(), "backend_implementer", submit("nope"), { signalId: "s", anchorId: "a" }, 1, "rmo_office");
    expect(r.ok).toBe(false);
  });
});

describe("EXHAUSTED AT THE GATES is a blocker, not a silence", () => {
  // `submissionOpenings` bounds resubmission so a turned-back item is not offered forever. Correct,
  // and by itself it produced a counter nobody read at the limit: the count reached the bound, the
  // opening closed, and the work sat open with nobody told. This is the writer for that reader.
  const withAttempts = (count: number, over: Partial<CascadeNode> = {}) =>
    view({
      cascade: [node({ assigneeHatId: "backend_implementer", ...over })],
      gateAttempts: { counts: new Map([["task-1", count]]), maxAttempts: 3 },
    });

  test("at the bound, the assignee has a classified blocker to raise", () => {
    const missing = orgSurfaceFor(withAttempts(3), "backend_implementer").missing ?? [];
    expect(missing).toHaveLength(1);
    expect(missing[0]?.kind).toBe("release_blocked");
    expect(missing[0]?.blocking).toBe("task-1");
  });

  test("BELOW THE BOUND IT IS NOT A BLOCKER — the hat can still try", () => {
    // Reporting a first turn-back as a blocker would fire on the ordinary case, and a signal that
    // fires on the ordinary case stops being read.
    expect(orgSurfaceFor(withAttempts(2), "backend_implementer").missing ?? []).toEqual([]);
    expect(orgSurfaceFor(withAttempts(0), "backend_implementer").missing ?? []).toEqual([]);
  });

  test("FINISHED WORK IS NOT BLOCKED, whatever it cost to get there", () => {
    // An item that took every attempt and then passed is not stuck; reporting it would leave a
    // blocker standing against work that is done.
    expect(orgSurfaceFor(withAttempts(3, { state: WorkState.Done }), "backend_implementer").missing ?? []).toEqual([]);
  });

  test("it is the ASSIGNEE'S blocker, not the owner's", () => {
    expect(orgSurfaceFor(withAttempts(3), "engineering_manager").missing ?? []).toEqual([]);
  });

  test("NO GATE TRACKING MEANS NO REPORT — a register that cannot count cannot claim", () => {
    const untracked = view({ cascade: [node({ assigneeHatId: "backend_implementer" })] });
    expect(orgSurfaceFor(untracked, "backend_implementer").missing ?? []).toEqual([]);
  });
});

describe("A DIRECTION IS NOT AN OUT-OF-DOMAIN FALLBACK", () => {
  // Measured from a five-day run: seventeen supply reports reached the RMO and SIXTEEN of them were
  // the design working. A direction is held by an executive by rule — `acceptGoal` refuses one
  // accepted below c_suite — and an executive is in the governance department, not in the
  // department that owns the domain. So every goal read as a fallback.
  //
  // A signal that fires on the ordinary case stops being read, and the one real fallback in that
  // list is what it would have cost.
  const goal = node({
    workId: "direction-implementation",
    workType: WorkType.Goal,
    title: "ship it",
    ownerHatId: "cto",
    domain: "implementation",
  });

  test("a goal held by an executive raises NOTHING", () => {
    const supply = orgSurfaceFor(view({ cascade: [goal] }), "rmo_office", "rmo_office").generative ?? [];
    expect(supply.filter((g) => g.subjectId.startsWith("domain-fallback:"))).toEqual([]);
  });

  test("...and a PROJECT genuinely outside its domain still does", () => {
    // The falsifier's other half: excluding goals must not silence the real thing. The seed's
    // engineering line changes department at the manager rung, so an implementation project owned
    // there is out of domain — measured, and the reason `domain-ontology.ts` reports fallbacks.
    const project = node({
      workId: "proj-1",
      workType: WorkType.Project,
      title: "cart",
      ownerHatId: "engineering_manager",
      domain: "implementation",
    });
    const supply = orgSurfaceFor(view({ cascade: [project] }), "rmo_office", "rmo_office").generative ?? [];
    // KEYED ON THE STRUCTURAL FACT — this domain landing in that department — rather than on the
    // work item. One report per item buried the handful of real facts under a hundred copies of
    // themselves as the weeks ran; measured at 42 reports for five distinct truths.
    expect(supply.map((g) => g.subjectId)).toContain("domain-fallback:implementation:engineering_management");
  });
});

describe("ESCALATING CHURN — a ruling, or an honest refusal", () => {
  const escalate = (subjectId: string): NextAction => ({ kind: "escalate_churn", subjectId, reason: "stuck" });

  test("a manager's ruling becomes an escalation effect carrying the ACTION and what it does", () => {
    // `haltsTheLoop` is carried rather than re-derived at the point of application, because it is
    // the only part of an escalation this register can act on today and losing it would leave the
    // ruling as a note.
    const v = view({ cascade: [node({ assigneeHatId: "backend_implementer" })] });
    const r = effectOf(v, "engineering_manager", escalate("task-1"), { signalId: "s", anchorId: "a" }, 1, "rmo_office");
    expect(r.ok).toBe(true);
    if (r.ok && r.effect.kind === "escalation") {
      expect(r.effect.workId).toBe("task-1");
      expect(r.effect.byHatId).toBe("engineering_manager");
      expect(typeof r.effect.haltsTheLoop).toBe("boolean");
      expect(r.effect.signal.tool).toBe(SignalTool.RequestEscalation);
      // The ACTION is the signal's title, so the next reader learns what was decided rather than
      // only that something was.
      expect(r.effect.signal.title).toBe(r.effect.action);
    } else {
      throw new Error("expected an escalation effect");
    }
  });

  test("REFUSED: a hat below manager may not rule on churn", () => {
    // `decideEscalation`'s own check, surfaced here rather than discovered three layers down.
    const v = view({ cascade: [node({ assigneeHatId: "backend_implementer" })] });
    const r = effectOf(v, "backend_implementer", escalate("task-1"), { signalId: "s", anchorId: "a" }, 1, "rmo_office");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("escalation is decided at manager and above");
  });

  test("REFUSED: work that does not exist", () => {
    const r = effectOf(view(), "engineering_manager", escalate("nope"), { signalId: "s", anchorId: "a" }, 1, "rmo_office");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("no work item");
  });
});

describe("TALKING TO AN AGENT — a message reaches it, and the reply comes back", () => {
  // The loop this closes: a note written into a room used to sit in the queue, visible to whoever
  // opened the page and invisible to the organization. The hat it was addressed to went on picking
  // work. That is a chat window with nobody on the other end.
  //
  // It travels on the OPERATOR CHANNEL rather than a new verb, because `observe.ts` already puts
  // `respond_to_operator` above everything except a durability save — a person talking to you is
  // the highest-signal thing in the world, and a second surface for it would be a second priority
  // to keep in step with the first.

  const roomAnchor: DiscussionAnchor = {
    anchorId: "a1",
    anchorType: AnchorType.SupervisorSignal,
    title: "brd_approval",
    purpose: "decide it",
    expectedOutput: ExpectedOutput.GateResult,
    participantHatIds: ["backend_implementer", "product_director"],
    openedByHatId: "backend_implementer",
    openedAtMs: 10,
    state: AnchorState.Open,
    workItemId: "task-1",
  };

  const said = (over: Record<string, unknown> = {}): HumanAction => {
    const r = acceptAction({
      kind: HumanActionKind.PostToRoom,
      byHuman: "Max",
      subjectId: "a1",
      reason: "asked the reviewer a question",
      atMs: 100,
      detail: { message: "what evidence did you read here?" },
      ...over,
    });
    if (!r.ok) throw new Error(r.reason);
    return r.action;
  };

  const withRoom = (over: Partial<OrgView> = {}): OrgView =>
    view({ board: { ...EMPTY_BOARD, anchors: [roomAnchor] }, ...over });

  test("a message lights the operator channel for a hat IN that room", () => {
    const surface = orgSurfaceFor(withRoom({ humanActions: [said()] }), "product_director");
    expect(surface.operator?.pendingMessage).toBe(true);
  });

  test("...and OUTRANKS the work — observe recommends answering the person", () => {
    // The whole point of using this channel. If it merely appeared somewhere on the menu, an agent
    // with a backlog would answer eventually, which for a person waiting is the same as never.
    const surface = orgSurfaceFor(withRoom({ humanActions: [said()] }), "product_director");
    const next = observe({ backlog: [{ id: "b1", title: "something else", ready: true, ambiguous: false }], ...surface });
    expect(next.kind).toBe("respond_to_operator");
  });

  test("a hat that is NOT in the room is not told to answer", () => {
    // A message is addressed to a conversation, and a hat outside it has nothing to answer. Waking
    // every hat for every message is how an operator channel becomes noise nobody reads.
    expect(orgSurfaceFor(withRoom({ humanActions: [said()] }), "cfo").operator).toBeUndefined();
  });

  test("a message into a room the board does not hold reaches nobody", () => {
    expect(orgSurfaceFor(withRoom({ humanActions: [said({ subjectId: "ghost" })] }), "product_director").operator)
      .toBeUndefined();
  });

  test("with nobody talking, the channel is ABSENT — not present and empty", () => {
    // Absent means "not wired", which is what every existing caller is and must stay.
    expect(orgSurfaceFor(withRoom(), "product_director").operator).toBeUndefined();
  });

  test("THE REPLY CLEARS IT, and only a reply in that room by that hat does", () => {
    const replied = withRoom({
      humanActions: [said()],
      board: {
        ...EMPTY_BOARD,
        anchors: [roomAnchor],
        posts: [
          { postId: "p1", anchorId: "a1", byHatId: "product_director", atMs: 200, body: "I read the diff", evidence: [] },
        ],
      },
    });
    expect(orgSurfaceFor(replied, "product_director").operator).toBeUndefined();
  });

  test("a reply written BEFORE the message does not answer it", () => {
    // Derived from the transcript and its clock, never from a read flag — a flag and the transcript
    // can disagree, and the disagreement looks like an agent that answered something it did not.
    const stale = withRoom({
      humanActions: [said()],
      board: {
        ...EMPTY_BOARD,
        anchors: [roomAnchor],
        posts: [
          { postId: "p0", anchorId: "a1", byHatId: "product_director", atMs: 50, body: "earlier", evidence: [] },
        ],
      },
    });
    expect(orgSurfaceFor(stale, "product_director").operator?.pendingMessage).toBe(true);
  });

  test("somebody ELSE replying does not answer for you", () => {
    const other = withRoom({
      humanActions: [said()],
      board: {
        ...EMPTY_BOARD,
        anchors: [roomAnchor],
        posts: [
          { postId: "p1", anchorId: "a1", byHatId: "backend_implementer", atMs: 200, body: "not mine", evidence: [] },
        ],
      },
    });
    expect(orgSurfaceFor(other, "product_director").operator?.pendingMessage).toBe(true);
  });

  test("the reply goes to the room the message was IN, chosen by the register", () => {
    // The agent says it is answering the operator; which conversation that is, is not its to pick.
    const r = effectOf(
      withRoom({ humanActions: [said()] }),
      "product_director",
      { kind: "respond_to_operator", reason: "I read the change and the tests" },
      { signalId: "s", anchorId: "unused" },
      300,
      "rmo_office",
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.effect.kind).toBe("reply_to_person");
    if (r.effect.kind === "reply_to_person") {
      expect(r.effect.anchorId).toBe("a1");
      expect(r.effect.byHatId).toBe("product_director");
      expect(r.effect.body).toBe("I read the change and the tests");
    }
  });

  test("THE OLDEST MESSAGE IS ANSWERED FIRST", () => {
    // Answering the newest first is how the first question never gets answered.
    const second: DiscussionAnchor = { ...roomAnchor, anchorId: "a2", title: "peer_review" };
    const v = view({
      board: { ...EMPTY_BOARD, anchors: [roomAnchor, second] },
      humanActions: [said({ subjectId: "a2", atMs: 400, actionId: "ha-late" }), said({ atMs: 100, actionId: "ha-early" })],
    });
    const r = effectOf(v, "product_director", { kind: "respond_to_operator", reason: "answering" },
      { signalId: "s", anchorId: "x" }, 500, "rmo_office");
    expect(r.ok && r.effect.kind === "reply_to_person" ? r.effect.anchorId : "").toBe("a1");
  });

  test("answering when nobody is waiting is REFUSED, not a quiet no-op", () => {
    // A silent success would hide an agent that had misread its own surface.
    const r = effectOf(withRoom(), "product_director", { kind: "respond_to_operator", reason: "hello?" },
      { signalId: "s", anchorId: "x" }, 300, "rmo_office");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("nobody is waiting");
  });
});
