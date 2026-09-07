import { describe, expect, test } from "bun:test";
import {
  abandonAnchor,
  AnchorState,
  AnchorType,
  EMPTY_BOARD,
  ExpectedOutput,
  decisionsOn,
  openAnchor,
  openAnchorsFor,
  postToAnchor,
  postsOn,
  producedItsOutput,
  recordDecision,
  resolveAnchor,
  type AnchorBoard,
  type DiscussionAnchor,
} from "./discussion-anchor";
import {
  buildHatCommunicationBrief,
  evidenceSatisfies,
  routeSignal,
  sendSupervisorSignal,
  SIGNAL_POLICY,
  SignalTool,
} from "./supervisor-signal";
import { GateKind } from "./quality-gate";
import { buildOrgChart } from "./org-chart";
import { SEED_HATS } from "./org-seed";

const chart = (() => {
  const r = buildOrgChart(SEED_HATS);
  if (!r.ok) throw new Error(r.reason);
  return r.chart;
})();

const RMO = "rmo_office";

const anchor = (over: Partial<DiscussionAnchor> = {}): DiscussionAnchor => ({
  anchorId: "a1",
  anchorType: AnchorType.WorkItem,
  title: "the coupon path",
  purpose: "decide whether to patch or redesign",
  expectedOutput: ExpectedOutput.Decision,
  participantHatIds: ["engineering_manager", "backend_implementer"],
  openedByHatId: "engineering_manager",
  openedAtMs: 0,
  state: AnchorState.Open,
  ...over,
});

const open = (board: AnchorBoard, a: DiscussionAnchor): AnchorBoard => {
  const r = openAnchor(board, a);
  if (!r.ok) throw new Error(r.reason);
  return r.board;
};

// ─── The artifact ───────────────────────────────────────────────────────────

describe("an anchor is a deliberation that owes an output", () => {
  test("it opens with a type, a purpose and an expected output", () => {
    const b = open(EMPTY_BOARD, anchor());
    expect(b.anchors[0]?.expectedOutput).toBe(ExpectedOutput.Decision);
  });

  test("an anchor with no purpose is refused", () => {
    // Nothing would say what it was for, so it would be resolvable on any grounds at all.
    const r = openAnchor(EMPTY_BOARD, anchor({ purpose: "   " }));
    expect(r.ok).toBe(false);
  });

  test("an anchor with no participants is refused", () => {
    expect(openAnchor(EMPTY_BOARD, anchor({ participantHatIds: [] })).ok).toBe(false);
  });

  test("an anchor that excludes its own opener is refused", () => {
    const r = openAnchor(EMPTY_BOARD, anchor({ openedByHatId: "ceo" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("opener");
  });

  test("a duplicate anchor id is refused", () => {
    const b = open(EMPTY_BOARD, anchor());
    expect(openAnchor(b, anchor()).ok).toBe(false);
  });
});

describe("only participants may write — an anchor is not a chat box", () => {
  const b = open(EMPTY_BOARD, anchor());

  test("a participant may post", () => {
    const r = postToAnchor(b, {
      postId: "p1",
      anchorId: "a1",
      byHatId: "backend_implementer",
      atMs: 1,
      body: "the coupon path double-applies",
      evidence: [{ kind: "test", ref: "t/coupon" }],
    });
    expect(r.ok).toBe(true);
  });

  test("a non-participant is refused", () => {
    const r = postToAnchor(b, {
      postId: "p1",
      anchorId: "a1",
      byHatId: "qa_engineer",
      atMs: 1,
      body: "drive-by",
      evidence: [],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("not a participant");
  });

  test("a decision from a non-participant is refused", () => {
    // A decision handed down by a hat that never joined is the outcome anchors exist to prevent:
    // the reasoning it was supposed to be anchored to is not there.
    const r = recordDecision(b, {
      decisionId: "d1",
      anchorId: "a1",
      byHatId: "cto",
      atMs: 2,
      decision: "redesign",
      rationale: "because",
      evidence: [],
    });
    expect(r.ok).toBe(false);
  });

  test("a decision with no rationale is refused", () => {
    const r = recordDecision(b, {
      decisionId: "d1",
      anchorId: "a1",
      byHatId: "engineering_manager",
      atMs: 2,
      decision: "patch it",
      rationale: "  ",
      evidence: [],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("rationale");
  });
});

describe("THE RULE: an anchor cannot resolve without producing what it promised", () => {
  test("a decision anchor with only discussion is REFUSED", () => {
    let b = open(EMPTY_BOARD, anchor());
    const posted = postToAnchor(b, {
      postId: "p1",
      anchorId: "a1",
      byHatId: "backend_implementer",
      atMs: 1,
      body: "lots of discussion",
      evidence: [{ kind: "test", ref: "t/coupon" }],
    });
    expect(posted.ok).toBe(true);
    if (!posted.ok) return;
    b = posted.board;

    // Even a well-evidenced discussion does not close a DECISION anchor. This is the difference
    // between artifact-communication and a thread that stopped.
    const r = resolveAnchor(b, "a1");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("owes a 'decision'");
  });

  test("with a decision recorded, it resolves", () => {
    let b = open(EMPTY_BOARD, anchor());
    const d = recordDecision(b, {
      decisionId: "d1",
      anchorId: "a1",
      byHatId: "engineering_manager",
      atMs: 2,
      decision: "patch, then schedule the redesign",
      rationale: "the double-apply is live; the redesign is not urgent",
      evidence: [{ kind: "diff", ref: "pr/1" }],
    });
    expect(d.ok).toBe(true);
    if (!d.ok) return;
    b = d.board;

    expect(producedItsOutput(b, "a1")).toBe(true);
    const r = resolveAnchor(b, "a1");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.board.anchors[0]?.state).toBe(AnchorState.Resolved);
    expect(decisionsOn(r.board, "a1")).toHaveLength(1);
  });

  test("a non-decision anchor needs an EVIDENCED post — a bare post does not close it", () => {
    let b = open(EMPTY_BOARD, anchor({ expectedOutput: ExpectedOutput.Document }));
    const bare = postToAnchor(b, {
      postId: "p1",
      anchorId: "a1",
      byHatId: "engineering_manager",
      atMs: 1,
      body: "wrote it up somewhere",
      evidence: [],
    });
    expect(bare.ok).toBe(true);
    if (!bare.ok) return;
    b = bare.board;
    // "Discussed, therefore done" must not close an anchor.
    expect(resolveAnchor(b, "a1").ok).toBe(false);

    const evidenced = postToAnchor(b, {
      postId: "p2",
      anchorId: "a1",
      byHatId: "engineering_manager",
      atMs: 2,
      body: "here it is",
      evidence: [{ kind: "document", ref: "docs/coupon.md" }],
    });
    expect(evidenced.ok).toBe(true);
    if (!evidenced.ok) return;
    expect(resolveAnchor(evidenced.board, "a1").ok).toBe(true);
  });

  test("ABANDONING is permitted without the output, and is a different state", () => {
    // Forcing a cancelled discussion through `resolve` would mean manufacturing a decision nobody
    // made. A reader must be able to tell "we decided" from "we stopped".
    const b = open(EMPTY_BOARD, anchor());
    const r = abandonAnchor(b, "a1");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.board.anchors[0]?.state).toBe(AnchorState.Abandoned);
  });

  test("a resolved anchor takes no more posts", () => {
    let b = open(EMPTY_BOARD, anchor({ expectedOutput: ExpectedOutput.Status }));
    const p = postToAnchor(b, {
      postId: "p1",
      anchorId: "a1",
      byHatId: "engineering_manager",
      atMs: 1,
      body: "green",
      evidence: [{ kind: "log", ref: "l/1" }],
    });
    if (!p.ok) throw new Error(p.reason);
    const r = resolveAnchor(p.board, "a1");
    if (!r.ok) throw new Error(r.reason);
    b = r.board;

    // Otherwise the recorded conclusion is no longer the last word, and a reader who stops at it
    // has read something incomplete without knowing.
    const late = postToAnchor(b, {
      postId: "p2",
      anchorId: "a1",
      byHatId: "backend_implementer",
      atMs: 3,
      body: "actually…",
      evidence: [],
    });
    expect(late.ok).toBe(false);
  });

  test("resolving twice is refused", () => {
    let b = open(EMPTY_BOARD, anchor({ expectedOutput: ExpectedOutput.Status }));
    const p = postToAnchor(b, {
      postId: "p1", anchorId: "a1", byHatId: "engineering_manager", atMs: 1, body: "x",
      evidence: [{ kind: "log", ref: "l" }],
    });
    if (!p.ok) throw new Error(p.reason);
    const r = resolveAnchor(p.board, "a1");
    if (!r.ok) throw new Error(r.reason);
    expect(resolveAnchor(r.board, "a1").ok).toBe(false);
  });

  test("an unknown anchor produced nothing and cannot resolve", () => {
    expect(producedItsOutput(EMPTY_BOARD, "ghost")).toBe(false);
    expect(resolveAnchor(EMPTY_BOARD, "ghost").ok).toBe(false);
  });
});

describe("a hat's deliberation inbox", () => {
  test("open anchors it participates in, and no others", () => {
    let b = open(EMPTY_BOARD, anchor());
    b = open(b, anchor({ anchorId: "a2", participantHatIds: ["qa_manager", "qa_engineer"], openedByHatId: "qa_manager" }));
    expect(openAnchorsFor(b, "backend_implementer").map((a) => a.anchorId)).toEqual(["a1"]);
    expect(openAnchorsFor(b, "qa_engineer").map((a) => a.anchorId)).toEqual(["a2"]);
    expect(openAnchorsFor(b, "ceo")).toHaveLength(0);
  });
});

// ─── The upward channel ─────────────────────────────────────────────────────

describe("routing is DERIVED from the graph, never chosen by the sender", () => {
  test("most families go to the immediate supervisor", () => {
    expect(routeSignal(chart, "backend_implementer", SignalTool.ReportBlocker, RMO)?.id).toBe("tech_lead");
    expect(routeSignal(chart, "backend_implementer", SignalTool.AskQuestion, RMO)?.id).toBe("tech_lead");
  });

  test("ESCALATION goes PAST the supervisor that could not resolve it", () => {
    // Routing it back to the same supervisor would be a no-op that reports success.
    expect(routeSignal(chart, "backend_implementer", SignalTool.RequestEscalation, RMO)?.id).toBe(
      "engineering_manager",
    );
  });

  test("a resource request goes to the RMO, not up the line", () => {
    // A manager asking its own supervisor for headcount is asking someone who must forward it.
    expect(routeSignal(chart, "engineering_manager", SignalTool.RequestResource, RMO)?.id).toBe(RMO);
  });

  test("the root has nowhere to send", () => {
    expect(routeSignal(chart, "executive_board_member", SignalTool.AskQuestion, RMO)).toBeUndefined();
    expect(routeSignal(chart, "ceo", SignalTool.RequestEscalation, RMO)).toBeUndefined();
  });
});

describe("evidence is required per family", () => {
  test("a blocker with no trace is refused", () => {
    expect(evidenceSatisfies(SignalTool.ReportBlocker, [])).toBe(false);
    expect(evidenceSatisfies(SignalTool.ReportBlocker, [{ kind: "trace", ref: "t" }])).toBe(true);
  });

  test("the WRONG kind of evidence does not satisfy", () => {
    // A review needs the change; a log is not a diff.
    expect(evidenceSatisfies(SignalTool.RequestReview, [{ kind: "log", ref: "l" }])).toBe(false);
    expect(evidenceSatisfies(SignalTool.RequestReview, [{ kind: "diff", ref: "d" }])).toBe(true);
  });

  test("asking a question and suggesting an improvement need NONE", () => {
    // Requiring proof to ask a question is how an organization stops receiving questions.
    expect(evidenceSatisfies(SignalTool.AskQuestion, [])).toBe(true);
    expect(evidenceSatisfies(SignalTool.SuggestImprovement, [])).toBe(true);
  });

  test("every one of the eight families has a policy", () => {
    for (const tool of Object.values(SignalTool)) {
      expect(SIGNAL_POLICY[tool]?.tool).toBe(tool);
    }
  });
});

describe("sending a signal produces a routed, evidenced, ANCHORED artifact", () => {
  const base = {
    signalId: "s1",
    anchorId: "sa1",
    fromHatId: "backend_implementer",
    tool: SignalTool.ReportBlocker,
    title: "cannot reach the coupon service",
    message: "every call 503s since the deploy",
    evidence: [{ kind: "log" as const, ref: "logs/503" }],
    atMs: 10,
  };

  test("it routes, and both hats are on the anchor", () => {
    const r = sendSupervisorSignal(chart, EMPTY_BOARD, base, RMO);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.signal.toHatId).toBe("tech_lead");
    expect(r.signal.fromLevel).toBe("individual_contributor");
    expect(r.signal.toLevel).toBe("lead");
    const a = r.board.anchors[0];
    expect(a?.anchorType).toBe(AnchorType.SupervisorSignal);
    // The sender must be able to answer follow-ups on its own signal.
    expect(a?.participantHatIds).toEqual(["backend_implementer", "tech_lead"]);
  });

  test("the anchor owes what the family promises", () => {
    // The title IS the scope for a review request — `RequestReview` routes to the hat holding the
    // gate, so a title that names no gate has nobody to route to. That is the point of the family.
    const r = sendSupervisorSignal(chart, EMPTY_BOARD, { ...base, title: GateKind.ImplementationReview, tool: SignalTool.RequestReview, evidence: [{ kind: "diff", ref: "pr/9" }] }, RMO);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.board.anchors[0]?.expectedOutput).toBe(ExpectedOutput.GateResult);
  });

  test("missing evidence refuses the WHOLE send — no signal, no anchor", () => {
    const r = sendSupervisorSignal(chart, EMPTY_BOARD, { ...base, evidence: [] }, RMO);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("requires evidence");
    // And nothing was written: an anchor for a refused signal is a discussion nobody asked for.
    expect(EMPTY_BOARD.anchors).toHaveLength(0);
  });

  test("an empty message is refused", () => {
    expect(sendSupervisorSignal(chart, EMPTY_BOARD, { ...base, message: "  " }, RMO).ok).toBe(false);
  });

  test("an unknown sender is refused BY IDENTITY, not by a routing accident", () => {
    // Asserting only `ok === false` here passed for the wrong reason and hid a live hole: a ghost
    // sending `report_blocker` is refused because `supervisorOf('ghost')` finds nobody, so the
    // identity check was never what stopped it. `request_resource` routes to a FIXED hat and never
    // consults the sender at all — so under that family a ghost has a real target, and only the
    // identity check stands between an unknown hat and the RMO's queue. Pin both the verdict and
    // the reason.
    const viaSupervisor = sendSupervisorSignal(chart, EMPTY_BOARD, { ...base, fromHatId: "ghost" }, RMO);
    expect(viaSupervisor.ok).toBe(false);
    if (!viaSupervisor.ok) expect(viaSupervisor.reason).toContain("unknown sending hat");

    const viaFixedTarget = sendSupervisorSignal(
      chart,
      EMPTY_BOARD,
      {
        ...base,
        fromHatId: "ghost",
        tool: SignalTool.RequestResource,
        evidence: [{ kind: "measurement" as const, ref: "m/1" }],
      },
      RMO,
    );
    expect(viaFixedTarget.ok).toBe(false);
    if (!viaFixedTarget.ok) expect(viaFixedTarget.reason).toContain("unknown sending hat");
  });

  test("the board root gets a REFUSAL, not a silent success", () => {
    // It needs to know nothing was sent, rather than believe it was.
    const r = sendSupervisorSignal(
      chart,
      EMPTY_BOARD,
      { ...base, fromHatId: "executive_board_member" },
      RMO,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("nothing above it");
  });

  test("the signal's anchor then behaves like any other anchor", () => {
    const r = sendSupervisorSignal(chart, EMPTY_BOARD, base, RMO);
    if (!r.ok) throw new Error(r.reason);
    // The supervisor triages ON the artifact.
    const triaged = postToAnchor(r.board, {
      postId: "p1",
      anchorId: "sa1",
      byHatId: "tech_lead",
      atMs: 11,
      body: "known — the deploy rolled back",
      evidence: [{ kind: "trace", ref: "rollback/1" }],
    });
    expect(triaged.ok).toBe(true);
    if (!triaged.ok) return;
    expect(postsOn(triaged.board, "sa1")).toHaveLength(1);
    expect(resolveAnchor(triaged.board, "sa1").ok).toBe(true);
  });
});

describe("the hat communication brief is generated from the graph", () => {
  test("a dev's brief names its supervisor, its escalation target, and all eight tools", () => {
    const brief = buildHatCommunicationBrief(chart, "backend_implementer", RMO);
    expect(brief).toBeDefined();
    expect(brief?.supervisorHatId).toBe("tech_lead");
    expect(brief?.escalationHatId).toBe("engineering_director");
    expect(brief?.tools).toHaveLength(8);
    // The brief must answer "which hat" before the hat sends, not after.
    expect(brief?.tools.find((t) => t.tool === SignalTool.RequestResource)?.targetHatId).toBe(RMO);
  });

  test("the root's brief has no supervisor and no supervisor-routed targets", () => {
    const brief = buildHatCommunicationBrief(chart, "executive_board_member", RMO);
    expect(brief?.supervisorHatId).toBeUndefined();
    expect(brief?.tools.find((t) => t.tool === SignalTool.AskQuestion)?.targetHatId).toBeUndefined();
  });

  test("an unknown hat gets no brief", () => {
    expect(buildHatCommunicationBrief(chart, "ghost", RMO)).toBeUndefined();
  });
});
