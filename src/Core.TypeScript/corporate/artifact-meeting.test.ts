/**
 * artifact-meeting.test.ts — the whole flow, from a free calendar slot to a merged version.
 *
 * The end-to-end test at the bottom is the one that matters: three hats, a real common free slot,
 * a booked meeting, turns citing revisions, a concurrent edit that DIVERGES, and a merge that
 * converges it — with every turn resolvable to the exact bytes its speaker was looking at.
 */

import { describe, expect, test } from "bun:test";
import { conveneOverArtifact, revisionRef, takeTurn, DEFAULT_MEETING_MS } from "./artifact-meeting";
import {
  headsOf,
  isDiverged,
  mergeHeads,
  mergeHistories,
  openArtifact,
  revise,
  soleHead,
  type ArtifactHistory,
} from "./artifact-deliberation";
import { EMPTY_BOARD, ExpectedOutput, postsOn, type AnchorBoard } from "./discussion-anchor";
import { EMPTY_CALENDAR, ScheduleBlockState, ScheduleBlockType, scheduleBlock, type Calendar } from "./work-schedule";

const HOUR = 60 * 60 * 1000;
const TEAM = ["solution_architect", "tech_lead", "qa_director"];

function artifact(): ArtifactHistory {
  const r = openArtifact({
    artifactId: "design-1",
    byHatId: "solution_architect",
    atMs: 0,
    content: "the design, v1",
    note: "first draft",
  });
  if (!r.ok) throw new Error(r.reason);
  return r.history;
}

function convene(over: Partial<Parameters<typeof conveneOverArtifact>[0]> = {}) {
  return conveneOverArtifact({
    meetingId: "m1",
    anchorId: "a1",
    calendar: EMPTY_CALENDAR,
    board: EMPTY_BOARD,
    attendeeHatIds: TEAM,
    calledByHatId: "solution_architect",
    artifactId: "design-1",
    title: "review the design",
    purpose: "agree the interface before anyone implements it",
    expectedOutput: ExpectedOutput.Decision,
    fromMs: 0,
    untilMs: 8 * HOUR,
    blockIds: ["b1", "b2", "b3"],
    ...over,
  });
}

/** Fill a hat's morning, so the search has to step past it. */
function busy(calendar: Calendar, hatId: string, startMs: number, endMs: number, id: string): Calendar {
  const r = scheduleBlock(calendar, {
    blockId: id,
    hatId,
    blockType: ScheduleBlockType.PrioritizedWork,
    startMs,
    endMs,
    state: ScheduleBlockState.Scheduled,
  });
  if (!r.ok) throw new Error(r.reason);
  return r.calendar;
}

describe("booking a colleague's free slot", () => {
  test("an empty calendar convenes at the start of the window", () => {
    const r = convene();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.startMs).toBe(0);
    expect(r.endMs).toBe(DEFAULT_MEETING_MS);
    // Booked on EVERY attendee, which is what makes it a meeting rather than three coincidences.
    expect(r.calendar.blocks.length).toBe(TEAM.length);
  });

  test("THE SEARCH STEPS PAST A BUSY HAT — the slot is common, not the caller's", () => {
    let cal = busy(EMPTY_CALENDAR, "qa_director", 0, 2 * HOUR, "qa-focus");
    const r = convene({ calendar: cal });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.startMs).toBeGreaterThanOrEqual(2 * HOUR);
  });

  test("no common slot REFUSES, and says who could not make it", () => {
    // Actionable: the caller widens the window or drops an attendee. Distinct from the meeting
    // being illegal.
    let cal = busy(EMPTY_CALENDAR, "tech_lead", 0, 8 * HOUR, "tl-all-day");
    const r = convene({ calendar: cal, untilMs: 4 * HOUR });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("no common free slot");
  });

  test("A MEETING THAT NAMES NO ARTIFACT IS REFUSED", () => {
    const r = convene({ artifactId: "  " });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("names no artifact");
  });

  test("one attendee is not a meeting — it would manufacture an unavailability", () => {
    const r = convene({ attendeeHatIds: ["tech_lead"], blockIds: ["b1"] });
    expect(r.ok).toBe(false);
  });

  test("a block id per attendee, or the booking is refused before it half-happens", () => {
    const r = convene({ blockIds: ["b1"] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("one block id per attendee");
  });

  test("THE ANCHOR IS OPENED WITH THE ATTENDEES AS ITS ONLY PARTICIPANTS", () => {
    // An anchor anyone may write to is a chat box; the people who may speak are the people whose
    // calendars were spent on it.
    const r = convene();
    if (!r.ok) throw new Error(r.reason);
    expect(r.anchor.participantHatIds).toEqual(TEAM);
    expect(r.anchor.expectedOutput).toBe(ExpectedOutput.Decision);
  });
});

describe("a turn cites the exact version it addressed", () => {
  function room(): { board: AnchorBoard; history: ArtifactHistory } {
    const r = convene();
    if (!r.ok) throw new Error(r.reason);
    return { board: r.board, history: artifact() };
  }

  test("the turn's evidence resolves to the revision, not to 'the document'", () => {
    const { board, history } = room();
    const head = headsOf(history)[0]!;
    const t = takeTurn(board, history, {
      postId: "p1",
      anchorId: "a1",
      byHatId: "tech_lead",
      atMs: 10,
      body: "the interface leaks the store",
      aboutRevisionId: head.revisionId,
    });
    expect(t.ok).toBe(true);
    if (!t.ok) return;
    expect(t.post.evidence[0]?.ref).toBe(revisionRef(head));
    expect(t.post.evidence[0]?.ref).toContain(head.revisionId);
  });

  test("A TURN CITING A VERSION NOBODY CAN RESOLVE IS REFUSED", () => {
    // Otherwise it is an opinion about an unspecified document, and the next reader cannot tell
    // which text it referred to.
    const { board, history } = room();
    const t = takeTurn(board, history, {
      postId: "p1",
      anchorId: "a1",
      byHatId: "tech_lead",
      atMs: 10,
      body: "x",
      aboutRevisionId: "not-a-revision",
    });
    expect(t.ok).toBe(false);
    if (!t.ok) expect(t.reason).toContain("not in 'design-1'");
  });

  test("a hat that was not in the room cannot speak — the board's own rule still applies", () => {
    const { board, history } = room();
    const t = takeTurn(board, history, {
      postId: "p1",
      anchorId: "a1",
      byHatId: "someone_else",
      atMs: 10,
      body: "x",
      aboutRevisionId: headsOf(history)[0]!.revisionId,
    });
    expect(t.ok).toBe(false);
  });
});

describe("THE WHOLE FLOW — free slot to merged version", () => {
  test("three hats convene, diverge over the artifact, and converge by an accountable merge", () => {
    // 1. A slot everyone is free for, booked atomically.
    const convened = convene({ calendar: busy(EMPTY_CALENDAR, "tech_lead", 0, HOUR, "tl-standup") });
    expect(convened.ok).toBe(true);
    if (!convened.ok) return;
    expect(convened.startMs).toBeGreaterThanOrEqual(HOUR);
    let board = convened.board;

    // 2. The artifact they convened over.
    const base = artifact();
    const root = headsOf(base)[0]!;

    // 3. Turns, each citing the version the speaker was looking at.
    for (const [i, hat] of ["tech_lead", "qa_director"].entries()) {
      const t = takeTurn(board, base, {
        postId: `p${String(i + 1)}`,
        anchorId: "a1",
        byHatId: hat,
        atMs: convened.startMs + i,
        body: `${hat} has a concern`,
        aboutRevisionId: root.revisionId,
      });
      expect(t.ok).toBe(true);
      if (t.ok) board = t.board;
    }
    expect(postsOn(board, "a1").length).toBe(2);

    // 4. Both act on it at once — a real concurrent edit, not a hypothetical one.
    const lead = revise(base, {
      parents: [root.revisionId],
      byHatId: "tech_lead",
      atMs: 100,
      content: "design with the lead's interface",
      note: "narrowed the port",
    });
    const qa = revise(base, {
      parents: [root.revisionId],
      byHatId: "qa_director",
      atMs: 101,
      content: "design with QA's assertions",
      note: "added the failure cases",
    });
    if (!lead.ok || !qa.ok) throw new Error("revise refused");

    const shared = mergeHistories(lead.history, qa.history);
    if (!shared.ok) throw new Error(shared.reason);

    // 5. DIVERGED, and the system says so rather than choosing.
    expect(isDiverged(shared.history)).toBe(true);
    expect(soleHead(shared.history)).toBeUndefined();
    expect(headsOf(shared.history).length).toBe(2);

    // 6. A hat reconciles it, and the merge records both parents.
    const resolved = mergeHeads(shared.history, {
      byHatId: "solution_architect",
      atMs: 200,
      content: "design with the narrowed port AND the failure cases",
      note: "took both; they were not in conflict once the port narrowed",
    });
    if (!resolved.ok) throw new Error(resolved.reason);

    expect(isDiverged(resolved.history)).toBe(false);
    expect(soleHead(resolved.history)?.content).toContain("failure cases");
    expect(resolved.revision.parents.length).toBe(2);

    // 7. And every turn still resolves to the version its speaker actually saw — the deliberation
    //    is reconstructible after the document moved on, which is the point of citing revisions.
    for (const post of postsOn(board, "a1")) {
      expect(post.evidence[0]?.ref).toBe(revisionRef(root));
    }
  });
});
