/**
 * human-action.test.ts — the inbound door, and what it refuses.
 *
 * "Human actions must be audited like agent actions" is the design doc's requirement, and an
 * action with no stated reason is precisely the one nobody can review afterwards. So most of this
 * file is refusals: a door that admits everything is not a door.
 */

import { describe, expect, test } from "bun:test";
import {
  acceptAction,
  actionEvent,
  HumanActionKind,
  isPaused,
  pendingActions,
  type HumanAction,
} from "./human-action";
import { OrgEventKind } from "./org-event";

const good = {
  kind: HumanActionKind.SubmitGoal,
  byHuman: "max",
  subjectId: "AIAGENT-1637",
  reason: "customer escalated this morning",
  atMs: 1000,
};

const take = (raw: unknown): HumanAction => {
  const r = acceptAction(raw);
  if (!r.ok) throw new Error(`expected accepted: ${r.reason}`);
  return r.action;
};

describe("AN ACTION NOBODY CAN REVIEW IS REFUSED AT THE DOOR", () => {
  test("a well-formed action is accepted — the refusals are not blanket", () => {
    const r = acceptAction(good);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.action.byHuman).toBe("max");
      expect(r.action.reason).toBe("customer escalated this morning");
      expect(r.action.actionId).not.toBe("");
    }
  });

  test("NO REASON is refused, and the refusal says why that matters", () => {
    const r = acceptAction({ ...good, reason: "   " });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("audited like agent actions");
  });

  test("NO PERSON is refused — 'the operator' is not somebody you can ask afterwards", () => {
    const r = acceptAction({ ...good, byHuman: "" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("byHuman");
  });

  test("no subject is refused: an action has to be ABOUT something", () => {
    expect(acceptAction({ ...good, subjectId: "" }).ok).toBe(false);
  });

  test("an unknown kind is refused and LISTS what is accepted", () => {
    const r = acceptAction({ ...good, kind: "delete_everything" });
    expect(r.ok).toBe(false);
    // A refusal that does not say what would have worked makes the caller guess.
    if (!r.ok) expect(r.reason).toContain("submit_goal");
  });

  test("a gate answer that does not name the gate is refused", () => {
    // It could not be applied to anything, so accepting it would only defer the failure to a place
    // where nobody can ask a follow-up question.
    expect(acceptAction({ ...good, kind: HumanActionKind.ApproveGate }).ok).toBe(false);
    expect(acceptAction({ ...good, kind: HumanActionKind.ApproveGate, detail: { gate: "qa_uat" } }).ok).toBe(true);
  });

  test("deprovisioning a hat must say WHOSE hat", () => {
    expect(acceptAction({ ...good, kind: HumanActionKind.DeprovisionHat }).ok).toBe(false);
    expect(acceptAction({ ...good, kind: HumanActionKind.DeprovisionHat, detail: { agentId: "ada" } }).ok).toBe(true);
  });

  test("a priority change must say the priority", () => {
    expect(acceptAction({ ...good, kind: HumanActionKind.AdjustPriority }).ok).toBe(false);
    expect(acceptAction({ ...good, kind: HumanActionKind.AdjustPriority, detail: { priority: "high" } }).ok).toBe(true);
  });

  test("garbage in is refused rather than coerced", () => {
    expect(acceptAction(null).ok).toBe(false);
    expect(acceptAction("submit_goal").ok).toBe(false);
    expect(acceptAction(42).ok).toBe(false);
  });

  test("non-string detail values are DROPPED, not stringified into a fake fact", () => {
    const a = take({ ...good, kind: HumanActionKind.ApproveGate, detail: { gate: "qa_uat", votes: 3 } });
    expect(a.detail?.["gate"]).toBe("qa_uat");
    expect(a.detail?.["votes"]).toBeUndefined();
  });
});

describe("AN ACTION LANDS IN THE SAME LOG AS EVERYTHING ELSE", () => {
  test("it becomes an OrgEvent carrying who, why, and a citable reference", () => {
    const event = actionEvent(take(good), "evt-1");
    expect(event.kind).toBe(OrgEventKind.DecisionRecorded);
    expect(event.actorAgentId).toBe("max");
    expect(event.decision).toContain("customer escalated");
    expect(event.evidenceRefs[0]).toContain("human-action/");
  });

  test("a person is NOT given a hat to make the shape fit", () => {
    // Borrowing one would put a human's decision on an agent's authority, and the trace would then
    // show a hat doing something no hat did.
    expect(actionEvent(take(good), "evt-2").actorHatId).toBeUndefined();
  });
});

describe("THE QUEUE IS ORDERED, AND PAUSE IS DERIVED", () => {
  const at = (kind: HumanActionKind, atMs: number, id: string): HumanAction =>
    take({ kind, byHuman: "max", subjectId: "run", reason: "r", atMs, actionId: id });

  test("pending actions come back oldest first, and consumed ones are gone", () => {
    const actions = [at(HumanActionKind.PauseRun, 30, "c"), at(HumanActionKind.PauseRun, 10, "a"), at(HumanActionKind.PauseRun, 20, "b")];
    expect(pendingActions(actions, new Set()).map((a) => a.actionId)).toEqual(["a", "b", "c"]);
    expect(pendingActions(actions, new Set(["a"])).map((a) => a.actionId)).toEqual(["b", "c"]);
  });

  test("pause then resume LEAVES THE RUN RUNNING — the order decides, not the count", () => {
    expect(isPaused([])).toBe(false);
    expect(isPaused([at(HumanActionKind.PauseRun, 1, "p")])).toBe(true);
    expect(isPaused([at(HumanActionKind.PauseRun, 1, "p"), at(HumanActionKind.ResumeRun, 2, "r")])).toBe(false);
    // Out-of-order arrival must not flip the answer: it is replayed by the action's own clock.
    expect(isPaused([at(HumanActionKind.ResumeRun, 2, "r"), at(HumanActionKind.PauseRun, 1, "p")])).toBe(false);
    expect(isPaused([at(HumanActionKind.ResumeRun, 1, "r"), at(HumanActionKind.PauseRun, 2, "p")])).toBe(true);
  });
});
