/**
 * meeting-demand.test.ts — falsifiers for the half that decides whether a meeting is warranted.
 *
 * The failure mode being tested for is a CONDITION THAT ALWAYS HOLDS. A demand function that
 * returns a rejection pair for every work item, or a conflict for every shared key, produces a
 * calendar full of meetings and reads exactly like one that is working. So every positive case
 * here is paired with the negative one that must stay silent.
 */

import { describe, expect, test } from "bun:test";
import { buildOrgChart, type OrgChart } from "./org-chart";
import { SEED_HATS } from "./org-seed";
import { WorkState, WorkType, type Cascade } from "./goal-cascade";
import { emit, OrgEventKind, type OrgEvent } from "./org-event";
import { GateKind, GateOutcome, type GateEvaluation } from "./quality-gate";
import { MemoryPhase, MemoryTier, type Memory } from "./memory";
import { hasMeetingDemand, meetingDemand } from "./meeting-demand";
import { blocksForMeeting, proposeMeetings, MeetingReason } from "./org-life";
import { EMPTY_CALENDAR, scheduleMeeting } from "./work-schedule";
import type { RaisedBlocker } from "./human-blocker";

const T = Date.parse("2026-09-09T10:00:00.000Z");
const DAY = 86_400_000;

function chartOf(): OrgChart {
  const built = buildOrgChart(SEED_HATS);
  if (!built.ok) throw new Error(built.reason);
  return built.chart;
}

const CHART = chartOf();

/** A hat with a manager, so the stalled case has somebody to escalate to. */
function hatWithManager(): { hatId: string; managerId: string } {
  const hat = CHART.hats.find((h) => h.reportsTo !== undefined);
  if (hat?.reportsTo === undefined) throw new Error("the seed chart has no hat that reports to anyone");
  return { hatId: hat.id, managerId: hat.reportsTo };
}

function cascadeWith(workId: string, assigneeHatId: string): Cascade {
  return {
    nodes: [
      {
        workId,
        workType: WorkType.Task,
        title: "archival never reaches blob",
        state: WorkState.InProgress,
        ownerHatId: assigneeHatId,
        assigneeHatId,
      },
    ],
  } as unknown as Cascade;
}

function evaluation(workId: string, outcome: GateOutcome, byHatId: string, atMs: number): GateEvaluation {
  return {
    workId,
    gate: GateKind.PeerReview,
    outcome,
    byHatId,
    reason: `judged at ${String(atMs)}`,
    atMs,
    evidenceRefs: [],
  };
}

function gateEvent(id: string, workId: string, evaluations: readonly GateEvaluation[]): OrgEvent {
  return emit(CHART, id, {
    kind: OrgEventKind.QualityGateEvaluation,
    subjectId: workId,
    decision: "gates evaluated",
    atMs: T,
    fact: { kind: "gates_evaluated", evaluations },
  });
}

function memory(scope: string, key: string, value: string, phase: MemoryPhase = MemoryPhase.Active): Memory {
  return {
    content: {
      memoryId: `${scope}::${key}`,
      tier: MemoryTier.Hat,
      scope,
      key,
      value,
      writtenBy: scope,
      writtenAtMs: T,
    },
    state: { memoryId: `${scope}::${key}`, phase, confidence: 0.6 },
  } as unknown as Memory;
}

/** One `memory_written` fact, which is where the writers of a conflicted memory are recorded. */
function writeEvent(
  id: string,
  memoryId: string,
  key: string,
  writtenBy: string,
  outcome: "new" | "reinforced" | "conflicted",
): OrgEvent {
  return emit(CHART, id, {
    kind: OrgEventKind.DecisionRecorded,
    subjectId: memoryId,
    decision: `${writtenBy} wrote ${key}`,
    atMs: T,
    fact: {
      kind: "memory_written",
      memoryId,
      tier: MemoryTier.Hat,
      scope: "architect",
      key,
      writtenBy,
      outcome,
      value: "whatever they wrote",
    },
  });
}

describe("repeated rejections", () => {
  const { hatId, managerId } = hatWithManager();

  test("two rejections of the same work at the same gate is a meeting", () => {
    const demand = meetingDemand({
      events: [
        gateEvent("e1", "task-1", [evaluation("task-1", GateOutcome.Rejected, managerId, T)]),
        gateEvent("e2", "task-1", [evaluation("task-1", GateOutcome.Rejected, managerId, T + 1000)]),
      ],
      cascade: cascadeWith("task-1", hatId),
      chart: CHART,
      nowMs: T + DAY,
    });
    expect(demand.repeatedRejections?.length).toBe(1);
    expect(demand.repeatedRejections?.[0]?.attempts).toBe(2);
    expect(demand.repeatedRejections?.[0]?.authorHatId).toBe(hatId);
    expect(demand.repeatedRejections?.[0]?.reviewerHatId).toBe(managerId);

    const proposals = proposeMeetings(demand);
    expect(proposals.map((p) => p.reason)).toContain(MeetingReason.RepeatedRejection);
  });

  test("ONE rejection is not a disagreement — it is a review doing its job", () => {
    const demand = meetingDemand({
      events: [gateEvent("e1", "task-1", [evaluation("task-1", GateOutcome.Rejected, managerId, T)])],
      cascade: cascadeWith("task-1", hatId),
      chart: CHART,
      nowMs: T + DAY,
    });
    // The condition is derived (attempts === 1) but must not become a meeting.
    expect(demand.repeatedRejections?.[0]?.attempts).toBe(1);
    expect(proposeMeetings(demand).length).toBe(0);
  });

  test("approvals never accumulate into a rejection count", () => {
    const demand = meetingDemand({
      events: [
        gateEvent("e1", "task-1", [evaluation("task-1", GateOutcome.Approved, managerId, T)]),
        gateEvent("e2", "task-1", [evaluation("task-1", GateOutcome.Approved, managerId, T + 1000)]),
        gateEvent("e3", "task-1", [evaluation("task-1", GateOutcome.Waived, managerId, T + 2000)]),
      ],
      cascade: cascadeWith("task-1", hatId),
      chart: CHART,
      nowMs: T + DAY,
    });
    expect(demand.repeatedRejections).toEqual([]);
    expect(hasMeetingDemand(demand)).toBe(false);
  });

  test("changes_requested counts — the polite loop is the same disagreement", () => {
    const demand = meetingDemand({
      events: [
        gateEvent("e1", "task-1", [evaluation("task-1", GateOutcome.ChangesRequested, managerId, T)]),
        gateEvent("e2", "task-1", [evaluation("task-1", GateOutcome.ChangesRequested, managerId, T + 1000)]),
      ],
      cascade: cascadeWith("task-1", hatId),
      chart: CHART,
      nowMs: T + DAY,
    });
    expect(demand.repeatedRejections?.[0]?.attempts).toBe(2);
  });

  test("nobody meets themselves — author and reviewer being one hat proposes nothing", () => {
    const demand = meetingDemand({
      events: [
        gateEvent("e1", "task-1", [evaluation("task-1", GateOutcome.Rejected, hatId, T)]),
        gateEvent("e2", "task-1", [evaluation("task-1", GateOutcome.Rejected, hatId, T + 1000)]),
      ],
      cascade: cascadeWith("task-1", hatId),
      chart: CHART,
      nowMs: T + DAY,
    });
    expect(proposeMeetings(demand).length).toBe(0);
  });

  test("work the cascade does not know has no author to put in a room", () => {
    const demand = meetingDemand({
      events: [
        gateEvent("e1", "ghost", [evaluation("ghost", GateOutcome.Rejected, managerId, T)]),
        gateEvent("e2", "ghost", [evaluation("ghost", GateOutcome.Rejected, managerId, T + 1)]),
      ],
      cascade: { nodes: [] } as unknown as Cascade,
      chart: CHART,
      nowMs: T + DAY,
    });
    expect(demand.repeatedRejections).toEqual([]);
  });
});

describe("held for a person", () => {
  const { hatId } = hatWithManager();

  function holdEvent(id: string, workId: string, atMs: number): OrgEvent {
    return emit(CHART, id, {
      kind: OrgEventKind.DecisionRecorded,
      subjectId: workId,
      decision: "waiting for a person",
      toState: "awaiting_human",
      atMs,
    });
  }

  test("the clock starts at the EARLIEST stop, not the latest", () => {
    const demand = meetingDemand({
      events: [
        holdEvent("h1", "task-1", T),
        holdEvent("h2", "task-1", T + DAY),
        holdEvent("h3", "task-1", T + 2 * DAY),
      ],
      cascade: cascadeWith("task-1", hatId),
      chart: CHART,
      nowMs: T + 2 * DAY,
      stillHeld: [{ workId: "task-1", gate: "brd_approval" }],
    });
    expect(demand.heldForPeople?.[0]?.heldSinceMs).toBe(T);
    // Two days old against a one-day threshold. Had the LATEST stop won, the age would be zero and
    // this meeting could never be proposed however long the hold lasted.
    expect(proposeMeetings(demand).map((p) => p.reason)).toContain(MeetingReason.StalledOnAPerson);
  });

  test("a hold younger than the threshold proposes nothing", () => {
    const demand = meetingDemand({
      events: [holdEvent("h1", "task-1", T)],
      cascade: cascadeWith("task-1", hatId),
      chart: CHART,
      nowMs: T + 3_600_000,
      stillHeld: [{ workId: "task-1", gate: "brd_approval" }],
    });
    expect(proposeMeetings(demand).length).toBe(0);
  });

  test("a hold the person already answered is not in stillHeld and yields nothing", () => {
    const demand = meetingDemand({
      events: [holdEvent("h1", "task-1", T)],
      cascade: cascadeWith("task-1", hatId),
      chart: CHART,
      nowMs: T + 5 * DAY,
      stillHeld: [],
    });
    expect(demand.heldForPeople).toEqual([]);
  });

  test("a hold with no recorded stop is not given an invented age", () => {
    const demand = meetingDemand({
      events: [],
      cascade: cascadeWith("task-1", hatId),
      chart: CHART,
      nowMs: T + 5 * DAY,
      stillHeld: [{ workId: "task-1", gate: "brd_approval" }],
    });
    expect(demand.heldForPeople).toEqual([]);
  });

  test("every proposal is BOOKABLE — the calendar is the judge, not a length check", () => {
    const demand = meetingDemand({
      events: [holdEvent("h1", "task-1", T)],
      cascade: cascadeWith("task-1", hatId),
      chart: CHART,
      nowMs: T + 5 * DAY,
      stillHeld: [{ workId: "task-1", gate: "brd_approval" }],
    });
    const proposals = proposeMeetings(demand);
    expect(proposals.length).toBeGreaterThan(0);
    for (const p of proposals) {
      // Asserted against `scheduleMeeting` itself rather than against `attendeeHatIds.length`,
      // because a list of two where one entry is `undefined` passes a length check and is refused
      // by the calendar. A proposal that can never be booked is a check that cannot fire.
      const booked = scheduleMeeting(EMPTY_CALENDAR, {
        meetingId: p.meetingId,
        attendeeHatIds: p.attendeeHatIds,
        blockIds: blocksForMeeting(p).map((b) => b.blockId),
        startMs: p.startMs,
        endMs: p.endMs,
      });
      expect(booked.ok ? "booked" : booked.reason).toBe("booked");
    }
  });

  test("an owner at the top of the chart has nobody to escalate to, so no meeting is proposed", () => {
    const top = CHART.hats.find((h) => h.reportsTo === undefined);
    if (top === undefined) throw new Error("the seed chart has no root hat");
    const demand = meetingDemand({
      events: [holdEvent("h1", "task-1", T)],
      cascade: cascadeWith("task-1", top.id),
      chart: CHART,
      nowMs: T + 5 * DAY,
      stillHeld: [{ workId: "task-1", gate: "brd_approval" }],
    });
    // The hold is still REPORTED — it is real and a person should see it. What is refused is
    // manufacturing a room with one chair in it and calling that the organisation responding.
    expect(demand.heldForPeople?.length).toBe(1);
    expect(demand.heldForPeople?.[0]?.escalateToHatId).toBeUndefined();
    expect(proposeMeetings(demand).length).toBe(0);
  });
});

describe("unresolved blockers", () => {
  function blocker(id: string, exhaustion: RaisedBlocker["exhaustion"]): RaisedBlocker {
    return {
      blockerId: id,
      about: "which retention window applies to archived sessions",
      blocking: "task-1",
      exhaustion,
      unblocks: "the retention decision in the BRD",
      byHatId: "product_owner",
      atMs: T,
      why: "nobody here can decide it",
    } as RaisedBlocker;
  }

  test("an exhaustion that names hats becomes a meeting with those hats in it", () => {
    const demand = meetingDemand({
      events: [],
      cascade: { nodes: [] } as unknown as Cascade,
      chart: CHART,
      nowMs: T,
      blockers: [blocker("blk-1", { kind: "owners_could_not_resolve", askedHatIds: ["architect", "tech_lead"] })],
    });
    const proposal = proposeMeetings(demand).find((p) => p.reason === MeetingReason.UnresolvedBlocker);
    expect(proposal?.attendeeHatIds).toEqual(["product_owner", "architect", "tech_lead"]);
  });

  test("'nobody here owns it' is NOT met about — the room does not contain the answer", () => {
    const demand = meetingDemand({
      events: [],
      cascade: { nodes: [] } as unknown as Cascade,
      chart: CHART,
      nowMs: T,
      blockers: [blocker("blk-1", { kind: "no_owner_in_org", forBlockerKind: "legal" })],
    });
    expect(demand.unresolvedBlockers).toEqual([]);
  });

  test("an answered blocker stops producing a meeting", () => {
    const raised = [blocker("blk-1", { kind: "owners_could_not_resolve", askedHatIds: ["architect"] })];
    const before = meetingDemand({
      events: [],
      cascade: { nodes: [] } as unknown as Cascade,
      chart: CHART,
      nowMs: T,
      blockers: raised,
    });
    const after = meetingDemand({
      events: [],
      cascade: { nodes: [] } as unknown as Cascade,
      chart: CHART,
      nowMs: T,
      blockers: raised,
      answeredBlockerIds: ["blk-1"],
    });
    expect(before.unresolvedBlockers?.length).toBe(1);
    expect(after.unresolvedBlockers).toEqual([]);
  });
});

describe("conflicting memory", () => {
  const KEY = "blob-write-order";
  const ID = `architect::${KEY}`;

  test("one memory two writers disagreed about is a meeting between those two", () => {
    const demand = meetingDemand({
      events: [
        writeEvent("w1", ID, KEY, "architect", "new"),
        writeEvent("w2", ID, KEY, "tech_lead", "conflicted"),
      ],
      cascade: { nodes: [] } as unknown as Cascade,
      chart: CHART,
      nowMs: T,
      memories: [memory("architect", KEY, "write the blob first", MemoryPhase.Conflicted)],
    });
    expect(demand.memoryConflicts?.length).toBe(1);
    expect(demand.memoryConflicts?.[0]?.scopes).toEqual(["architect", "tech_lead"]);
    expect(proposeMeetings(demand).map((p) => p.reason)).toContain(MeetingReason.ConflictingMemory);
  });

  test("MANY SCOPES HOLDING THE SAME KEY IS NOT A CONFLICT — it is the promotion signal", () => {
    // The defect this replaces. A live run booked eight meetings from a cross-scope value
    // comparison, every one of them about a per-hat question that different hats are SUPPOSED to
    // answer differently. `memory.ts` calls `crossScope.distinctScopes` the promotion signal, so
    // the old detector fired hardest exactly when the memory system was working best.
    const demand = meetingDemand({
      events: [
        writeEvent("w1", "architect::what-i-touch", "what-i-touch", "architect", "new"),
        writeEvent("w2", "tech_lead::what-i-touch", "what-i-touch", "tech_lead", "new"),
      ],
      cascade: { nodes: [] } as unknown as Cascade,
      chart: CHART,
      nowMs: T,
      memories: [
        memory("architect", "what-i-touch", "the design docs"),
        memory("tech_lead", "what-i-touch", "the service layer"),
      ],
    });
    expect(demand.memoryConflicts).toEqual([]);
    expect(hasMeetingDemand(demand)).toBe(false);
  });

  test("a conflicted memory only ever written by ONE hat has nobody to put in the room", () => {
    const demand = meetingDemand({
      events: [writeEvent("w1", ID, KEY, "architect", "conflicted")],
      cascade: { nodes: [] } as unknown as Cascade,
      chart: CHART,
      nowMs: T,
      memories: [memory("architect", KEY, "write the blob first", MemoryPhase.Conflicted)],
    });
    expect(demand.memoryConflicts).toEqual([]);
  });

  test("a memory nobody contradicted proposes nothing, however many writers it had", () => {
    const demand = meetingDemand({
      events: [
        writeEvent("w1", ID, KEY, "architect", "new"),
        writeEvent("w2", ID, KEY, "tech_lead", "reinforced"),
      ],
      cascade: { nodes: [] } as unknown as Cascade,
      chart: CHART,
      nowMs: T,
      memories: [memory("architect", KEY, "write the blob first", MemoryPhase.Reinforced)],
    });
    expect(demand.memoryConflicts).toEqual([]);
  });

  test("a conflict with no write facts in the log is not given invented attendees", () => {
    const demand = meetingDemand({
      events: [],
      cascade: { nodes: [] } as unknown as Cascade,
      chart: CHART,
      nowMs: T,
      memories: [memory("architect", KEY, "write the blob first", MemoryPhase.Conflicted)],
    });
    expect(demand.memoryConflicts).toEqual([]);
  });
});

describe("the quiet organisation", () => {
  test("an empty log proposes no meetings at all", () => {
    const demand = meetingDemand({
      events: [],
      cascade: { nodes: [] } as unknown as Cascade,
      chart: CHART,
      nowMs: T,
    });
    expect(hasMeetingDemand(demand)).toBe(false);
    expect(proposeMeetings(demand)).toEqual([]);
  });
});
