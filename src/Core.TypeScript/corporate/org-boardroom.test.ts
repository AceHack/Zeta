/**
 * org-boardroom.test.ts — the company, top down.
 *
 * The failure this whole layer exists to prevent is not an exception, it is a page that renders
 * confidently and describes an organization that never existed. So what is pinned here is the
 * relationship between what is SHOWN and what the log actually says: an idle department shown as
 * idle, a hat's decisions counted where they were made, a room that was closed shown as closed.
 */

import { describe, expect, test } from "bun:test";

import { approvalViews, departmentViews, meetingViews, roomViews } from "./org-boardroom";
import { buildOrgChart } from "./org-chart";
import { SEED_HATS } from "./org-seed";
import { GateKind, GateOutcome, type GateEvaluation } from "./quality-gate";
import { OrgEventKind, type OrgEvent } from "./org-event";
import { WorkState, WorkType, type CascadeNode } from "./goal-cascade";
import { AnchorState, AnchorType, ExpectedOutput, type DiscussionAnchor } from "./discussion-anchor";
import { SignalTool } from "./supervisor-signal";
import { acceptAction, HumanActionKind, type HumanAction } from "./human-action";
import { EMPTY_CALENDAR, type Calendar } from "./work-schedule";

const chart = (() => {
  const r = buildOrgChart(SEED_HATS);
  if (!r.ok) throw new Error(r.reason);
  return r.chart;
})();

function verdict(over: Partial<GateEvaluation> = {}): GateEvaluation {
  return {
    workId: "task-1",
    gate: GateKind.BrdApproval,
    outcome: GateOutcome.Approved,
    byHatId: "product_director",
    reason: "the requirements hold",
    atMs: 1000,
    evidenceRefs: [],
    ...over,
  };
}

function leaf(over: Partial<CascadeNode> = {}): CascadeNode {
  return {
    workId: "task-1",
    workType: WorkType.Task,
    title: "stop the double-apply",
    state: WorkState.InProgress,
    ownerHatId: "engineering_manager",
    assigneeHatId: "backend_implementer",
    ...over,
  } as CascadeNode;
}

const noCalendar: Calendar = EMPTY_CALENDAR;

/** A well-formed event. Built rather than cast: a fixture the type would refuse is not a fixture. */
function ev(over: Omit<Partial<OrgEvent>, "fact"> & { readonly fact: NonNullable<OrgEvent["fact"]> }): OrgEvent {
  return {
    id: "e1",
    kind: OrgEventKind.DecisionRecorded,
    atMs: 10,
    subjectId: "a1",
    decision: "recorded",
    supervisorChain: [],
    evidenceRefs: [],
    ...over,
  };
}

/** One open room, at module scope so the suites below share exactly the same fixture. */
function anchorEvent2(): OrgEvent {
  return ev({
    fact: {
      kind: "discussion_anchor",
      anchor: {
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
      },
    },
  });
}

describe("THE FLOOR — every department, including the quiet ones", () => {
  test("every department in the chart is listed, working or not", () => {
    // An org chart that hid its idle halves would answer "what is everyone doing" with "everyone is
    // busy". An idle Security department is a different fact from an absent one, and usually the
    // more interesting of the two.
    const views = departmentViews(chart, noCalendar, [], [], 0);
    const named = new Set(views.map((d) => d.departmentId));
    for (const hat of chart.hats) expect(named.has(hat.departmentId)).toBe(true);
  });

  test("a department with nothing happening reports NOBODY ACTIVE, not zero hats", () => {
    // The distinction the page draws in ink: `hatCount` says the department exists and is staffable;
    // `active` says nobody in it did anything. Collapsing them would make an unstaffed department
    // and an idle one look identical.
    const views = departmentViews(chart, noCalendar, [], [], 0);
    const security = views.find((d) => d.departmentId === "security_and_compliance");
    expect(security?.active).toEqual([]);
    expect(security?.hatCount).toBeGreaterThan(0);
  });

  test("a hat that DECIDED something is active even with no booked time", () => {
    // Judgement is work. A department view built only from the calendar would show Product doing
    // nothing on a run where the Product Director approved ten gates.
    const views = departmentViews(chart, noCalendar, [verdict()], [], 0);
    const product = views.find((d) => d.departmentId === "product_and_customer_discovery");
    expect(product?.active.map((p) => p.name)).toContain("Product Director");
    expect(product?.decisions).toBe(1);
  });

  test("decisions are counted where they were MADE, not where the work lives", () => {
    const views = departmentViews(chart, noCalendar, [verdict({ byHatId: "cfo" })], [], 0);
    expect(views.find((d) => d.departmentId === "executive_board_and_governance")?.decisions).toBe(1);
    expect(views.find((d) => d.departmentId === "product_and_customer_discovery")?.decisions).toBe(0);
  });

  test("work in hand follows its ASSIGNEE's department", () => {
    const views = departmentViews(chart, noCalendar, [], [leaf()], 0);
    const eng = views.find((d) => d.departmentId === "engineering");
    expect(eng?.working.map((w) => w.workId)).toEqual(["task-1"]);
  });

  test("the head is the most senior hat, not the first one declared", () => {
    const views = departmentViews(chart, noCalendar, [], [], 0);
    expect(views.find((d) => d.departmentId === "engineering")?.headName).toBe("Engineering Director");
    expect(views.find((d) => d.departmentId === "qa_and_verification")?.headName).toBe("QA Director");
  });

  test("the board comes first, alphabetical order is not used", () => {
    const views = departmentViews(chart, noCalendar, [], [], 0);
    expect(views[0]?.departmentId).toBe("executive_board_and_governance");
  });
});

describe("DECISIONS — who signed what, and whether it was a person", () => {
  test("newest first, with the person and department named", () => {
    const views = approvalViews(chart, [verdict({ atMs: 1 }), verdict({ atMs: 9, gate: GateKind.PeerReview })]);
    expect(views[0]?.gate).toBe("peer_review");
    expect(views[0]?.byName).toBe("Product Director");
    expect(views[0]?.department).toBe("product_and_customer_discovery");
  });

  test("A HUMAN DECISION IS DERIVED FROM THE EVIDENCE, never claimed", () => {
    // The badge saying "a person decided this" has to rest on the action reference that carried the
    // decision. A flag could be set by anything; the reference is the trace itself.
    const human = approvalViews(chart, [verdict({ evidenceRefs: ["human-action/ha-7"] })]);
    expect(human[0]?.byHuman).toBe(true);
    expect(approvalViews(chart, [verdict({ evidenceRefs: ["work:task-1"] })])[0]?.byHuman).toBe(false);
  });

  test("a rejection is shown as a rejection, not filtered out", () => {
    // A ledger of approvals that quietly drops the rejections is a ledger that tells you the
    // organization has never said no.
    const views = approvalViews(chart, [verdict({ outcome: GateOutcome.Rejected })]);
    expect(views[0]?.outcome).toBe("rejected");
  });
});

describe("ROOMS — folded from the log, so they survive the process that held them", () => {
  const anchorEvent = (over: Partial<DiscussionAnchor> = {}): OrgEvent =>
    ev({
      fact: {
        kind: "discussion_anchor",
        anchor: {
          anchorId: "a1",
          anchorType: AnchorType.SupervisorSignal,
          title: "brd_approval",
          purpose: "decide it",
          expectedOutput: ExpectedOutput.GateResult,
          participantHatIds: ["product_director", "backend_implementer"],
          openedByHatId: "backend_implementer",
          openedAtMs: 10,
          state: AnchorState.Open,
          workItemId: "task-1",
          ...over,
        },
      },
    });

  test("an anchor in the log becomes a room, with its people named", () => {
    const rooms = roomViews(chart, [anchorEvent()]);
    expect(rooms.length).toBe(1);
    expect(rooms[0]?.openedByName).toBe("Backend Implementer");
    expect(rooms[0]?.participants).toEqual(["Product Director", "Backend Implementer"]);
    // A room titled with a gate key reads as the gate, not as an identifier.
    expect(rooms[0]?.title).toBe("BRD Approval");
    expect(rooms[0]?.owes).toBe("a gate verdict");
  });

  test("A LATER STATE WINS — a closed room is shown closed", () => {
    const closed = ev({ id: "e2", atMs: 20, fact: { kind: "anchor_state", anchorId: "a1", state: "resolved" } });
    const rooms = roomViews(chart, [anchorEvent(), closed]);
    expect(rooms[0]?.open).toBe(false);
    expect(rooms[0]?.state).toBe("Resolved");
  });

  test("a state event for a room nobody opened does NOT conjure a room", () => {
    // Otherwise a status change invents a conversation, and the page reports a meeting that never
    // happened — which is the exact class of failure this whole layer is guarding.
    const orphan = ev({
      id: "e3",
      atMs: 20,
      subjectId: "ghost",
      fact: { kind: "anchor_state", anchorId: "ghost", state: "resolved" },
    });
    expect(roomViews(chart, [orphan])).toEqual([]);
  });

  test("what was said is carried, oldest first, with the speaker named", () => {
    const post = (id: string, atMs: number, by: string, body: string): OrgEvent =>
      ev({
        id,
        atMs,
        fact: { kind: "anchor_post", post: { postId: id, anchorId: "a1", byHatId: by, atMs, body, evidence: [] } },
      });
    const rooms = roomViews(chart, [
      anchorEvent(),
      post("p2", 40, "product_director", "second"),
      post("p1", 30, "backend_implementer", "first"),
    ]);
    expect(rooms[0]?.turns.map((t) => t.body)).toEqual(["first", "second"]);
    expect(rooms[0]?.turns[0]?.byName).toBe("Backend Implementer");
  });

  test("OPEN ROOMS COME FIRST — history belongs underneath", () => {
    const other = anchorEvent({ anchorId: "a2", title: "peer_review", state: AnchorState.Resolved });
    const rooms = roomViews(chart, [{ ...other, id: "e9" }, anchorEvent()]);
    expect(rooms[0]?.open).toBe(true);
  });

  test("an empty log holds no rooms rather than throwing", () => {
    expect(roomViews(chart, [])).toEqual([]);
    expect(meetingViews(chart, [])).toEqual([]);
  });
});

describe("MEETINGS — the attendees are people, not ids", () => {
  test("a booked meeting names who is in it", () => {
    const event = ev({
      id: "m1",
      kind: OrgEventKind.MeetingScheduled,
      atMs: 5,
      subjectId: "task-1",
      fact: {
        kind: "meeting_planned",
        meetingId: "mtg-1",
        blockIds: ["b1"],
        attendeeHatIds: ["cto", "qa_director"],
        startMs: 5,
        endMs: 10,
        workItemId: "task-1",
      },
    });
    const views = meetingViews(chart, [event]);
    expect(views[0]?.attendees).toEqual(["CTO", "QA Director"]);
    expect(views[0]?.workId).toBe("task-1");
  });
});

describe("A ROOM YOU CAN OPEN — everything the log held and the page never showed", () => {
  const signal = (): OrgEvent =>
    ev({
      id: "sig-e",
      kind: OrgEventKind.SupervisorSignalSent,
      fact: {
        kind: "supervisor_signal",
        signal: {
          signalId: "sig-1",
          fromHatId: "backend_implementer",
          fromLevel: "individual_contributor",
          toHatId: "product_director",
          toLevel: "director",
          tool: SignalTool.RequestReview,
          title: "brd_approval",
          message: "review task-1 for the BRD",
          evidence: [{ kind: "document", ref: "work:task-1" }],
          atMs: 10,
          anchorId: "a1",
          workItemId: "task-1",
        },
      },
    });

  test("the room carries WHAT WAS ASKED, who was asked, and what was attached", () => {
    // All three were in the log from the beginning and none were on the screen, which is why a room
    // read as an opaque block with a count on it.
    const r = roomViews(chart, [anchorEvent2(), signal()])[0];
    expect(r?.openingMessage).toBe("review task-1 for the BRD");
    expect(r?.askedOfName).toBe("Product Director");
    expect(r?.evidence).toEqual(["document:work:task-1"]);
    expect(r?.why).toContain("decide it");
  });

  test("a room with no signal behind it says so rather than inventing an ask", () => {
    const r = roomViews(chart, [anchorEvent2()])[0];
    expect(r?.openingMessage).toBeUndefined();
    expect(r?.evidence).toEqual([]);
  });

  test("the verdict the room OWED is shown against it", () => {
    const r = roomViews(chart, [anchorEvent2(), signal()], [verdict({ gate: GateKind.BrdApproval })])[0];
    expect(r?.verdict?.outcome).toBe("approved");
    expect(r?.verdict?.byName).toBe("Product Director");
  });

  test("a verdict on a DIFFERENT gate is not attached to this room", () => {
    const r = roomViews(chart, [anchorEvent2(), signal()], [verdict({ gate: GateKind.PeerReview })])[0];
    expect(r?.verdict).toBeUndefined();
  });
});

describe("SILENCE HAS THREE MEANINGS, and only one of them is normal", () => {
  const quiet = (evaluations: readonly GateEvaluation[]): string | undefined =>
    roomViews(chart, [anchorEvent2()], evaluations)[0]?.silentBecause;

  test("nobody has got to it yet", () => {
    expect(quiet([])).toContain("still waiting on its reviewer");
  });

  test("A SIMULATED REVIEWER IS NAMED AS ONE — the loudest line on the page", () => {
    // Reporting this as "no discussion yet" would be the kindest possible lie about what the
    // organization did: it did not review the work, and it recorded that it had.
    const said = quiet([
      verdict({ gate: GateKind.BrdApproval, evidenceRefs: ["auto-approved:brd_approval:task-1"] }),
    ]);
    expect(said).toContain("NOBODY WAS CONSULTED");
    expect(said).toContain("default, not a judgement");
  });

  test("a real verdict with no discussion is neither of those", () => {
    const said = quiet([verdict({ gate: GateKind.BrdApproval, evidenceRefs: ["test:qa/run-1.json"] })]);
    expect(said).toContain("without a discussion");
    expect(said).not.toContain("NOBODY WAS CONSULTED");
  });

  test("a room with turns in it is not silent at all", () => {
    const turn = ev({
      id: "p1",
      fact: {
        kind: "anchor_post",
        post: {
          postId: "p1",
          anchorId: "a1",
          byHatId: "product_director",
          atMs: 20,
          body: "looks thin",
          evidence: [],
        },
      },
    });
    expect(roomViews(chart, [anchorEvent2(), turn])[0]?.silentBecause).toBeUndefined();
  });
});

describe("A PERSON CAN SAY SOMETHING IN A ROOM, and it is theirs, not a hat's", () => {
  const note = (subjectId = "a1"): HumanAction => {
    const r = acceptAction({
      kind: HumanActionKind.PostToRoom,
      byHuman: "Max",
      subjectId,
      reason: "left a note in the room",
      atMs: 30,
      detail: { message: "what evidence did you read here?" },
    });
    if (!r.ok) throw new Error(r.reason);
    return r.action;
  };

  test("the note lands in the room, attributed to the PERSON", () => {
    const r = roomViews(chart, [anchorEvent2()], [], [note()])[0];
    expect(r?.turns.length).toBe(1);
    expect(r?.turns[0]?.byName).toBe("Max");
    expect(r?.turns[0]?.byHuman).toBe(true);
    expect(r?.turns[0]?.body).toBe("what evidence did you read here?");
  });

  test("a note with no words in it is refused before it reaches a room", () => {
    const r = acceptAction({
      kind: HumanActionKind.PostToRoom,
      byHuman: "Max",
      subjectId: "a1",
      reason: "hm",
      atMs: 30,
      detail: {},
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("detail.message");
  });

  test("a note addressed to another room does not appear in this one", () => {
    expect(roomViews(chart, [anchorEvent2()], [], [note("a2")])[0]?.turns).toEqual([]);
  });

  test("agents' turns and a person's note sit in ONE transcript, in time order", () => {
    const agentTurn = ev({
      id: "p1",
      fact: {
        kind: "anchor_post",
        post: {
          postId: "p1",
          anchorId: "a1",
          byHatId: "product_director",
          atMs: 20,
          body: "approving",
          evidence: [],
        },
      },
    });
    const r = roomViews(chart, [anchorEvent2(), agentTurn], [], [note()])[0];
    expect(r?.turns.map((t) => t.byName)).toEqual(["Product Director", "Max"]);
  });
});
