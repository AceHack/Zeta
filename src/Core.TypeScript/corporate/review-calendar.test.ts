/**
 * review-calendar.test.ts — a review with no block is one the reviewer's tick cannot see.
 *
 * The calendar is runtime authority: `loop-policy` narrows a hat's menu by what it is booked to be
 * doing. So these are not bookkeeping tests. A gate whose reviewer has no block is a gate that
 * cannot drive itself, because the only thing that could have told the reviewing hat it was
 * supposed to be reviewing is the block that was never booked.
 */

import { describe, expect, test } from "bun:test";
import { bookQaBlocks, bookReviewBlocks, requestReviewsFor } from "./review-calendar";
import { buildOrgChart } from "./org-chart";
import { SEED_HATS } from "./org-seed";
import { GateKind, gateOwners, ORDERED_GATES } from "./quality-gate";
import { EMPTY_BOARD } from "./discussion-anchor";
import {
  EMPTY_CALENDAR,
  ScheduleBlockState,
  ScheduleBlockType,
  blocksFor,
  scheduleBlock,
  type Calendar,
} from "./work-schedule";

const chart = (() => {
  const r = buildOrgChart(SEED_HATS);
  if (!r.ok) throw new Error(r.reason);
  return r.chart;
})();

const HOUR = 60 * 60 * 1000;
let counter = 0;
const createId = (p: string) => `${p}-${String(++counter)}`;

function book(over: Partial<Parameters<typeof bookReviewBlocks>[0]> = {}) {
  return bookReviewBlocks({
    chart,
    calendar: EMPTY_CALENDAR,
    gates: [...ORDERED_GATES],
    workId: "task-1",
    proposerHatId: "backend_implementer",
    fromMs: 0,
    blockMs: HOUR,
    createId,
    ...over,
  });
}

describe("every gate gets a reviewer with time on the calendar", () => {
  test("a block per gate, all of type review", () => {
    const r = book();
    expect(r.booked.length).toBe(ORDERED_GATES.length);
    expect(r.refusals).toEqual([]);
    for (const b of r.booked) expect(b.block.blockType).toBe(ScheduleBlockType.Review);
  });

  test("THE REVIEWER IS NEVER THE PROPOSER — separation of duties, on the calendar", () => {
    // The same rule `runPipeline` applies when it picks an evaluator. Deriving the two
    // independently would let a gate be judged by a hat whose calendar said otherwise.
    const r = book({ proposerHatId: "tech_lead" });
    for (const b of r.booked) expect(b.block.hatId).not.toBe("tech_lead");
  });

  test("the booked hat is one that actually HOLDS the gate", () => {
    const r = book();
    for (const b of r.booked) {
      expect(gateOwners(chart, b.gate).map((h) => h.id)).toContain(b.block.hatId);
    }
  });

  test("blocks are laid END TO END, because gates are crossed in order", () => {
    // A reviewer booked for phase nine while phase two is unwritten is judging something that does
    // not exist yet, so the calendar has to be a plan of the sequence rather than a pile.
    const r = book();
    const starts = r.booked.map((b) => b.block.startMs);
    expect([...starts].sort((a, b) => a - b)).toEqual(starts);
    for (let i = 1; i < r.booked.length; i += 1) {
      expect(r.booked[i]!.block.startMs).toBeGreaterThanOrEqual(r.booked[i - 1]!.block.endMs);
    }
  });

  test("it books only the gates it was GIVEN — a pipeline's own chain, never a constant", () => {
    const r = book({ gates: [GateKind.PeerReview, GateKind.ReleaseReadiness] });
    expect(r.booked.length).toBe(2);
    expect(r.booked.map((b) => b.gate)).toEqual([GateKind.PeerReview, GateKind.ReleaseReadiness]);
  });

  test("ONE HAT PER GATE, not every owner", () => {
    // Booking every owner fills the calendars of hats who will not judge it, and a calendar full of
    // blocks nobody honours makes `firstCommonFreeSlot` refuse meetings that could have happened.
    const r = book({ gates: [GateKind.AdversarialReview] });
    expect(gateOwners(chart, GateKind.AdversarialReview).length).toBeGreaterThan(1);
    expect(r.booked.length).toBe(1);
  });
});

describe("what it REFUSES rather than skipping", () => {
  test("A GATE WHOSE ONLY HOLDER DID THE WORK IS A REFUSAL, surfaced before anything runs", () => {
    // `runPipeline` would block on exactly this. Saying so up front is the difference between a
    // plan known to be unrunnable and one that fails halfway.
    const solo = buildOrgChart(SEED_HATS.filter((h) => h.id !== "product_manager"));
    if (!solo.ok) throw new Error(solo.reason);
    const r = bookReviewBlocks({
      chart: solo.chart,
      calendar: EMPTY_CALENDAR,
      gates: [GateKind.BusinessContextGrooming],
      workId: "task-1",
      proposerHatId: "product_director",
      fromMs: 0,
      blockMs: HOUR,
      createId,
    });
    expect(r.booked).toEqual([]);
    expect(r.refusals.length).toBe(1);
    expect(r.refusals[0]).toContain("which did the work");
  });

  test("A CONFLICT IS REPORTED, never worked around by sliding the block", () => {
    // Sliding it would reorder the review sequence, and a reviewer booked out of order judges a
    // phase whose input does not exist yet.
    const owner = gateOwners(chart, GateKind.PeerReview).filter((h) => h.id !== "backend_implementer")[0]!;
    const busy = scheduleBlock(EMPTY_CALENDAR, {
      blockId: "busy",
      hatId: owner.id,
      blockType: ScheduleBlockType.PrioritizedWork,
      startMs: 0,
      endMs: HOUR,
      state: ScheduleBlockState.Scheduled,
    });
    if (!busy.ok) throw new Error(busy.reason);
    const r = bookReviewBlocks({
      chart,
      calendar: busy.calendar,
      gates: [GateKind.PeerReview],
      workId: "task-1",
      proposerHatId: "backend_implementer",
      fromMs: 0,
      blockMs: HOUR,
      createId,
    });
    expect(r.booked).toEqual([]);
    expect(r.refusals.length).toBe(1);
    expect(r.refusals[0]).toContain("could not book");
  });

  test("no gates means no blocks and no refusals — an empty plan, not a broken one", () => {
    const r = book({ gates: [] });
    expect(r.booked).toEqual([]);
    expect(r.refusals).toEqual([]);
  });
});

describe("QA is booked as RUNNING, not as judging", () => {
  test("every QA hat gets time, because tests are run rather than adjudicated", () => {
    const hats = ["qa_engineer", "qa_manager"];
    const r = bookQaBlocks({
      calendar: EMPTY_CALENDAR,
      qaHatIds: hats,
      workId: "task-1",
      fromMs: 0,
      blockMs: HOUR,
      createId,
    });
    expect(r.booked.length).toBe(2);
    for (const b of r.booked) expect(b.block.blockType).toBe(ScheduleBlockType.PromptFlowExecution);
  });

  test("NOT A REVIEW BLOCK — QA produces evidence, a review produces an opinion", () => {
    // Putting them on the same footing on the calendar is the equivalence the gate chooser refuses:
    // `runtime_validation` is decided by what the tests said, not by what a reviewer thought.
    const r = bookQaBlocks({
      calendar: EMPTY_CALENDAR,
      qaHatIds: ["qa_engineer"],
      workId: "task-1",
      fromMs: 0,
      blockMs: HOUR,
      createId,
    });
    expect(r.booked[0]?.block.blockType).not.toBe(ScheduleBlockType.Review);
  });

  test("QA hats run in PARALLEL — more hands is throughput, not a redundant panel", () => {
    const r = bookQaBlocks({
      calendar: EMPTY_CALENDAR,
      qaHatIds: ["qa_engineer", "qa_manager", "qa_director"],
      workId: "task-1",
      fromMs: 0,
      blockMs: HOUR,
      createId,
    });
    expect(new Set(r.booked.map((b) => b.block.startMs)).size).toBe(1);
  });
});

describe("the calendar afterwards is one a hat can actually read", () => {
  test("a reviewing hat's own blocks name the work they are for", () => {
    const r = book();
    const someone = r.booked[0]!.block.hatId;
    const theirs = blocksFor(r.calendar as Calendar, someone);
    expect(theirs.length).toBeGreaterThan(0);
    for (const b of theirs) expect(b.workItemId).toBe("task-1");
  });

  test("BEFORE THIS, THE ONLY BOOKED HAT WAS THE ONE DOING THE WORK", () => {
    // The state this replaces, asserted as a count: thirteen gates were evaluated by hats with
    // nothing on their calendars at all.
    const r = book();
    expect(new Set(r.booked.map((b) => b.block.hatId)).size).toBeGreaterThan(1);
  });
});

describe("THE ASK GOES TO THE HAT WHOSE TIME WAS BOOKED", () => {
  test("a review request is sent per booked gate, to the holder of that gate", () => {
    // `RequestReview` had a READER (`reviewsAskedOf`, which builds a hat's menu) and no writer, so
    // that surface was always empty and `review_artifact` was a verb no agent could be offered.
    const booked = book();
    const asked = requestReviewsFor({
      chart,
      board: EMPTY_BOARD,
      booked: booked.booked,
      workId: "task-1",
      fromHatId: "backend_implementer",
      atMs: 0,
      createId,
      resourceAuthorityHatId: "rmo_office",
      evidenceRefs: ["work:task-1"],
    });
    expect(asked.refusals).toEqual([]);
    expect(asked.signals.length).toBe(booked.booked.length);
    // The reviewer with the TIME is the reviewer with the ASK. Deriving it twice would let the two
    // drift, and the failure is quiet in the worst way: a hat with a booked block and no request,
    // and another with a request and no time.
    for (const sig of asked.signals) {
      expect(gateOwners(chart, sig.title as GateKind).map((h) => h.id)).toContain(sig.toHatId);
    }
  });

  test("THE GATE IS THE TITLE, so the reviewer knows which of thirteen judgements is wanted", () => {
    const booked = book({ gates: [GateKind.AdversarialReview] });
    const asked = requestReviewsFor({
      chart,
      board: EMPTY_BOARD,
      booked: booked.booked,
      workId: "task-1",
      fromHatId: "backend_implementer",
      atMs: 0,
      createId,
      resourceAuthorityHatId: "rmo_office",
      evidenceRefs: ["work:task-1"],
    });
    expect(asked.signals[0]?.title).toBe(GateKind.AdversarialReview);
  });

  test("A REVIEW REQUEST WITH NO EVIDENCE IS REFUSED — not a request to go looking", () => {
    // The asker knows what it made; a reviewer should not have to reconstruct it.
    const booked = book({ gates: [GateKind.PeerReview] });
    const asked = requestReviewsFor({
      chart,
      board: EMPTY_BOARD,
      booked: booked.booked,
      workId: "task-1",
      fromHatId: "backend_implementer",
      atMs: 0,
      createId,
      resourceAuthorityHatId: "rmo_office",
      evidenceRefs: [],
    });
    expect(asked.signals).toEqual([]);
    expect(asked.refusals.length).toBe(1);
  });

  test("THE REQUEST NEVER GOES BACK TO THE AUTHOR", () => {
    // Same separation of duties as the booking, and as the pipeline's evaluator choice. A request
    // routed to its own sender is a no-op reporting success.
    const booked = book({ proposerHatId: "tech_lead" });
    const asked = requestReviewsFor({
      chart,
      board: EMPTY_BOARD,
      booked: booked.booked,
      workId: "task-1",
      fromHatId: "tech_lead",
      atMs: 0,
      createId,
      resourceAuthorityHatId: "rmo_office",
      evidenceRefs: ["work:task-1"],
    });
    for (const sig of asked.signals) expect(sig.toHatId).not.toBe("tech_lead");
  });

  test("REVIEWS REACH MANY HATS, not one — the defect that motivated scope routing", () => {
    // `RequestReview` routed to `supervisor`, so twenty-six requests covering thirteen gates all
    // landed on one lead while the calendar had booked thirteen different hats to do them.
    const booked = book();
    const asked = requestReviewsFor({
      chart,
      board: EMPTY_BOARD,
      booked: booked.booked,
      workId: "task-1",
      fromHatId: "backend_implementer",
      atMs: 0,
      createId,
      resourceAuthorityHatId: "rmo_office",
      evidenceRefs: ["work:task-1"],
    });
    expect(new Set(asked.signals.map((s) => s.toHatId)).size).toBeGreaterThan(1);
  });
});
