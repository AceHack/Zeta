/**
 * agent-calibration.test.ts — falsifiers for what an actor writes about itself.
 *
 * The tier this feeds was READABLE and never WRITTEN, so the first thing to pin is that it is now
 * written for a reason: every positive case is paired with the silence that must hold when the
 * evidence is not there. A calibration written off one observation would be worse than none —
 * it would carry the weight bonus `memory.ts` gives an agent's own scope, on a coin flip.
 */

import { describe, expect, test } from "bun:test";
import { buildOrgChart, type OrgChart } from "./org-chart";
import { SEED_HATS } from "./org-seed";
import { emit, OrgEventKind, type OrgEvent } from "./org-event";
import { GateKind, GateOutcome, type GateEvaluation } from "./quality-gate";
import { MemoryTier, write } from "./memory";
import { agentCalibrations, claimsByAgent, memoryFromCalibration, MIN_WORK_ITEMS } from "./agent-calibration";

const T = Date.parse("2026-09-09T10:00:00.000Z");

function chartOf(): OrgChart {
  const built = buildOrgChart(SEED_HATS);
  if (!built.ok) throw new Error(built.reason);
  return built.chart;
}
const CHART = chartOf();

function claim(id: string, agentId: string, workId: string): OrgEvent {
  return emit(CHART, id, {
    kind: OrgEventKind.WorkClaimed,
    subjectId: workId,
    actorAgentId: agentId,
    decision: `${agentId} claimed ${workId}`,
    atMs: T,
  });
}

function judged(id: string, workId: string, gate: GateKind, outcome: GateOutcome, atMs = T): OrgEvent {
  const evaluation: GateEvaluation = {
    workId,
    gate,
    outcome,
    byHatId: "tech_lead",
    reason: `judged at ${String(atMs)}`,
    atMs,
    evidenceRefs: [],
  };
  return emit(CHART, id, {
    kind: OrgEventKind.QualityGateEvaluation,
    subjectId: workId,
    decision: "gates evaluated",
    atMs,
    fact: { kind: "gates_evaluated", evaluations: [evaluation] },
  });
}

describe("who claimed what", () => {
  test("an agent's claims come from the WorkClaimed events it is the actor on", () => {
    const claims = claimsByAgent([claim("c1", "agent-a", "task-1"), claim("c2", "agent-a", "task-2")]);
    expect([...(claims.get("agent-a") ?? [])].sort()).toEqual(["task-1", "task-2"]);
  });

  test("an event with no actor attributes to nobody", () => {
    const anonymous = emit(CHART, "c1", {
      kind: OrgEventKind.WorkClaimed,
      subjectId: "task-1",
      decision: "claimed by nobody in particular",
      atMs: T,
    });
    expect(claimsByAgent([anonymous]).size).toBe(0);
  });

  test("events of other kinds are not claims, however they are attributed", () => {
    const merged = emit(CHART, "m1", {
      kind: OrgEventKind.ShardMerged,
      subjectId: "task-1",
      actorAgentId: "agent-a",
      decision: "merged",
      atMs: T,
    });
    expect(claimsByAgent([merged]).size).toBe(0);
  });
});

describe("calibration", () => {
  test("two work items through one gate is a calibration, with its denominator", () => {
    const rows = agentCalibrations([
      claim("c1", "agent-a", "task-1"),
      claim("c2", "agent-a", "task-2"),
      judged("g1", "task-1", GateKind.PeerReview, GateOutcome.Rejected),
      judged("g2", "task-2", GateKind.PeerReview, GateOutcome.Approved, T + 1000),
    ]);
    expect(rows.length).toBe(1);
    expect(rows[0]?.agentId).toBe("agent-a");
    expect(rows[0]?.sentBack).toBe(1);
    expect(rows[0]?.passed).toBe(1);
    expect(rows[0]?.workItems).toEqual(["task-1", "task-2"]);
  });

  test("ONE work item is a data point, not a tendency, and produces nothing", () => {
    const rows = agentCalibrations([
      claim("c1", "agent-a", "task-1"),
      judged("g1", "task-1", GateKind.PeerReview, GateOutcome.Rejected),
      judged("g2", "task-1", GateKind.PeerReview, GateOutcome.Rejected, T + 1000),
    ]);
    // TWO rejections, but of ONE item. The threshold counts work items on purpose: the same
    // document sent back twice says something about the document, not about the actor.
    expect(rows).toEqual([]);
  });

  test("work an agent did NOT claim never lands in its calibration", () => {
    const rows = agentCalibrations([
      claim("c1", "agent-a", "task-1"),
      claim("c2", "agent-a", "task-2"),
      judged("g1", "task-1", GateKind.PeerReview, GateOutcome.Approved),
      judged("g2", "task-2", GateKind.PeerReview, GateOutcome.Approved, T + 1),
      judged("g3", "task-9", GateKind.PeerReview, GateOutcome.Rejected, T + 2),
    ]);
    expect(rows[0]?.workItems).toEqual(["task-1", "task-2"]);
    expect(rows[0]?.sentBack).toBe(0);
  });

  test("gates are kept apart — a bad record at one is not a bad record at another", () => {
    const rows = agentCalibrations([
      claim("c1", "agent-a", "task-1"),
      claim("c2", "agent-a", "task-2"),
      judged("g1", "task-1", GateKind.PeerReview, GateOutcome.Rejected),
      judged("g2", "task-2", GateKind.PeerReview, GateOutcome.Rejected, T + 1),
      judged("g3", "task-1", GateKind.AdversarialReview, GateOutcome.Approved, T + 2),
      judged("g4", "task-2", GateKind.AdversarialReview, GateOutcome.Approved, T + 3),
    ]);
    expect(rows.length).toBe(2);
    const peer = rows.find((r) => r.gate === String(GateKind.PeerReview));
    const adversarial = rows.find((r) => r.gate === String(GateKind.AdversarialReview));
    expect(peer?.sentBack).toBe(2);
    expect(adversarial?.sentBack).toBe(0);
  });

  test("an empty log calibrates nobody", () => {
    expect(agentCalibrations([])).toEqual([]);
  });

  test("changes requested counts as sent back — the polite loop is the same signal", () => {
    const rows = agentCalibrations([
      claim("c1", "agent-a", "task-1"),
      claim("c2", "agent-a", "task-2"),
      judged("g1", "task-1", GateKind.PeerReview, GateOutcome.ChangesRequested),
      judged("g2", "task-2", GateKind.PeerReview, GateOutcome.ChangesRequested, T + 1),
    ]);
    expect(rows[0]?.sentBack).toBe(2);
    expect(rows[0]?.passed).toBe(0);
    expect(memoryFromCalibration(rows[0]!, T)?.value).toContain("sent back every time");
  });

  test("a waiver passes — it is not the gate being satisfied, but it is not a rejection", () => {
    const rows = agentCalibrations([
      claim("c1", "agent-a", "task-1"),
      claim("c2", "agent-a", "task-2"),
      judged("g1", "task-1", GateKind.PeerReview, GateOutcome.Waived),
      judged("g2", "task-2", GateKind.PeerReview, GateOutcome.Approved, T + 1),
    ]);
    expect(rows[0]?.sentBack).toBe(0);
    expect(rows[0]?.passed).toBe(2);
  });

  test("the order is a property of the ORGANISATION, not of when the reviews ran", () => {
    // `factEvents` canonicalises the log by time, so accumulation order follows the schedule.
    // Here agent-z's work is judged FIRST, so an unsorted result would lead with agent-z and the
    // same organisation would produce a different list on a day the reviews ran in another order.
    const rows = agentCalibrations([
      claim("c1", "agent-z", "task-1"),
      claim("c2", "agent-z", "task-2"),
      claim("c3", "agent-a", "task-3"),
      claim("c4", "agent-a", "task-4"),
      judged("g1", "task-1", GateKind.PeerReview, GateOutcome.Approved, T + 1),
      judged("g2", "task-2", GateKind.PeerReview, GateOutcome.Approved, T + 2),
      judged("g3", "task-3", GateKind.PeerReview, GateOutcome.Approved, T + 3),
      judged("g4", "task-4", GateKind.PeerReview, GateOutcome.Approved, T + 4),
    ]);
    expect(rows.map((r) => r.agentId)).toEqual(["agent-a", "agent-z"]);
  });

  test("the same log twice gives the same rows in the same order", () => {
    const events = [
      claim("c2", "agent-b", "task-2"),
      claim("c1", "agent-a", "task-1"),
      claim("c3", "agent-a", "task-3"),
      claim("c4", "agent-b", "task-4"),
      judged("g1", "task-1", GateKind.PeerReview, GateOutcome.Approved),
      judged("g2", "task-2", GateKind.PeerReview, GateOutcome.Approved, T + 1),
      judged("g3", "task-3", GateKind.PeerReview, GateOutcome.Approved, T + 2),
      judged("g4", "task-4", GateKind.PeerReview, GateOutcome.Approved, T + 3),
    ];
    // Stable order is what makes the memory ids stable, which is what makes a second run a
    // REINFORCEMENT rather than a duplicate belief with the same content.
    expect(agentCalibrations(events)).toEqual(agentCalibrations([...events].reverse()));
    expect(agentCalibrations(events).map((r) => r.agentId)).toEqual(["agent-a", "agent-b"]);
  });
});

describe("the memory it writes", () => {
  const rows = agentCalibrations([
    claim("c1", "agent-a", "task-1"),
    claim("c2", "agent-a", "task-2"),
    judged("g1", "task-1", GateKind.PeerReview, GateOutcome.Rejected),
    judged("g2", "task-2", GateKind.PeerReview, GateOutcome.Approved, T + 1),
  ]);

  test("it is AGENT tier, scoped to the actor — which is what routes it to its own repository", () => {
    const input = memoryFromCalibration(rows[0]!, T);
    expect(input?.tier).toBe(MemoryTier.Agent);
    expect(input?.scope).toBe("agent-a");
    expect(input?.writtenBy).toBe("agent-a");
  });

  test("the evidence travels with it, in the hint", () => {
    const input = memoryFromCalibration(rows[0]!, T);
    expect(input?.contextHint).toContain("1 sent back of 2 judgement(s)");
    expect(input?.contextHint).toContain("task-1, task-2");
  });

  test("a clean record says so rather than saying nothing", () => {
    const clean = agentCalibrations([
      claim("c1", "agent-a", "task-1"),
      claim("c2", "agent-a", "task-2"),
      judged("g1", "task-1", GateKind.PeerReview, GateOutcome.Approved),
      judged("g2", "task-2", GateKind.PeerReview, GateOutcome.Approved, T + 1),
    ]);
    const input = memoryFromCalibration(clean[0]!, T);
    expect(input?.value).toContain("passed every time");
  });

  test("THE COUNTS ARE NOT IN THE VALUE — a value with a running total can never be reinforced", () => {
    // Caught by a live run, not by a test: the first version put "1 of 2 judgement(s)" in the
    // value, so the next day's "1 of 4" was a DIFFERENT string at the same key and `write` flagged
    // the agent as contradicting itself. `reinforcementCount` stayed at zero and confidence could
    // only fall, which makes a calibration permanently on its way to being forgotten however true
    // it keeps turning out to be. It also fed the conflicting-memory meeting detector, so the
    // organisation would have booked meetings about agents agreeing with themselves.
    const input = memoryFromCalibration(rows[0]!, T);
    expect(input?.value).not.toMatch(/[0-9]+ of [0-9]+/);
    expect(input?.value).not.toContain("task-1");
  });

  test("more evidence for the same finding REINFORCES", () => {
    const day1 = memoryFromCalibration(rows[0]!, T)!;
    const first = write(undefined, day1);
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    // The same finding, twice the evidence — which is what a second day of the same work looks
    // like. It must land as a reinforcement, not as the agent disagreeing with itself.
    const day2 = memoryFromCalibration(
      { ...rows[0]!, sentBack: 2, passed: 2, workItems: ["task-1", "task-2", "task-3", "task-4"] },
      T + 86_400_000,
    )!;
    const second = write(first.memory, day2);
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.reinforced).toBe(true);
    expect(second.conflicted).toBe(false);
    expect(second.memory.state.reinforcementCount).toBe(1);
    expect(second.memory.state.confidence).toBeGreaterThan(first.memory.state.confidence);
  });

  test("a CHANGED finding is still a conflict — that is the case worth looking at", () => {
    const clean = memoryFromCalibration({ ...rows[0]!, sentBack: 0, passed: 2 }, T)!;
    const first = write(undefined, clean);
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const turned = memoryFromCalibration({ ...rows[0]!, sentBack: 4, passed: 0 }, T + 86_400_000)!;
    const second = write(first.memory, turned);
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.conflicted).toBe(true);
  });

  test("the four findings are distinct, and the boundary is at half", () => {
    var valueOf = function (sentBack: number, passed: number): string {
      return memoryFromCalibration({ ...rows[0]!, sentBack, passed }, T)?.value ?? "";
    };
    expect(valueOf(0, 4)).toContain("passed every time");
    expect(valueOf(4, 0)).toContain("sent back every time");
    expect(valueOf(3, 1)).toContain("usually sent back");
    expect(valueOf(1, 3)).toContain("usually let through");
    // Exactly half is NOT "usually sent back" — a coin flip is not a tendency.
    expect(valueOf(2, 2)).toContain("usually let through");
  });

  test("confidence never approaches certainty on a thin sample", () => {
    const input = memoryFromCalibration(rows[0]!, T);
    // Two observations. A calibration written at 0.9 here would outrank a lesson learned from a
    // year of delivery, purely because it is about the reader.
    expect(input?.confidence).toBeLessThanOrEqual(0.7);
    expect(input?.confidence).toBeGreaterThan(0.3);
  });

  test("confidence rises with the evidence, and stops", () => {
    const thin = memoryFromCalibration({ ...rows[0]!, workItems: ["a", "b"] }, T);
    const thicker = memoryFromCalibration({ ...rows[0]!, workItems: ["a", "b", "c", "d"] }, T);
    const enormous = memoryFromCalibration(
      { ...rows[0]!, workItems: Array.from({ length: 60 }, (_v, i) => `w${String(i)}`) },
      T,
    );
    expect(thicker?.confidence).toBeGreaterThan(thin?.confidence ?? 0);
    expect(enormous?.confidence).toBe(0.7);
  });

  test("below the threshold it refuses to write at all", () => {
    expect(memoryFromCalibration({ ...rows[0]!, workItems: ["only-one"] }, T)).toBeUndefined();
    expect(MIN_WORK_ITEMS).toBeGreaterThan(1);
  });

  test("a calibration with no judgements behind it writes nothing", () => {
    expect(memoryFromCalibration({ ...rows[0]!, sentBack: 0, passed: 0 }, T)).toBeUndefined();
  });
});
