/**
 * human-action.ts — the inbound channel, and the only one.
 *
 * The register had no way for a person to say anything to it. Everything flowed outward: events to
 * a log, a report at the end. That is fine for watching and useless for working, and "human in the
 * loop" with no inbound path is a slogan.
 *
 * ── WHAT THIS IS NOT ────────────────────────────────────────────────────────
 * It is NOT a mutation API. A human action is a REQUEST the organization will consider, recorded in
 * a queue, and the run decides what to do with it on its own terms. That distinction is what keeps
 * the observer honest: `serve-org` can accept an action and still be unable to change the
 * organization, because writing to the queue and changing the org are different acts. A dashboard
 * that could reach into a running cycle would be a second writer racing the first.
 *
 * ── AUDITED LIKE AN AGENT ACTION ────────────────────────────────────────────
 * The design doc's words. So every action carries WHO and WHY, and `reason` is required rather than
 * optional — an override with no stated reason is the one that is impossible to review later, and
 * it is exactly the one somebody will want to review. An action that cannot say why it happened is
 * refused at the door instead of being accepted and becoming unexplainable history.
 */

import { OrgEventKind, type OrgEvent } from "./org-event";

export const HumanActionKind = {
  /** Put new work in front of the organization. */
  SubmitGoal: "submit_goal",
  /** Answer a gate that was waiting on a person. */
  ApproveGate: "approve_gate",
  RejectGate: "reject_gate",
  /** Stop or resume the drive loop. */
  PauseRun: "pause_run",
  ResumeRun: "resume_run",
  /** Take a hat off an agent — the doc's "deprovision hats". */
  DeprovisionHat: "deprovision_hat",
  AdjustPriority: "adjust_priority",
  TriggerEscalation: "trigger_escalation",
  RequestMeeting: "request_meeting",
  /**
   * Answer a blocker an agent raised OUT of the organization.
   *
   * The other half of `human-blocker.ts`. Without it a raise is a reader with no writer: the
   * organization stops, says so, and has no way to hear that somebody replied — which is worse than
   * not asking, because it also spends the person's attention.
   */
  AnswerBlocker: "answer_blocker",
  /**
   * Say something IN a room, on the record.
   *
   * Deliberately NOT an anchor post. `postToAnchor` admits only the room's declared participants,
   * and that rule is about HATS — a person is not wearing one, and borrowing one to make the shape
   * fit would put a human's words under an agent's authority, which is the same smuggling
   * `actionEvent` avoids by leaving `actorHatId` off.
   *
   * HONEST LIMIT, stated because the alternative is a feature that pretends: a note lands in the
   * room and is visible to anyone who opens it, and NOTHING IN THE RUNTIME READS IT BACK TO THE
   * AGENT yet. It is a record, not an interruption. The channel that actually turns work around
   * today is `reject_gate`, whose reason travels with the work down its recovery path.
   */
  PostToRoom: "post_to_room",
  /** Do it anyway, on the record. Never silent, never reasonless. */
  Override: "override",
} as const;
export type HumanActionKind = (typeof HumanActionKind)[keyof typeof HumanActionKind];

const KINDS: ReadonlySet<string> = new Set(Object.values(HumanActionKind));

export interface HumanAction {
  readonly actionId: string;
  readonly kind: HumanActionKind;
  /** WHO. An identity, not a role — "the operator" is not a person anyone can ask afterwards. */
  readonly byHuman: string;
  readonly atMs: number;
  /** WHAT it is about: a work id, a hat id, a gate name, a run id. */
  readonly subjectId: string;
  /** WHY. Required. See the header — an unexplainable action is the one review needs most. */
  readonly reason: string;
  /** Anything the kind needs: `{ gate: "qa_uat" }`, `{ priority: "high" }`. Strings only. */
  readonly detail?: Readonly<Record<string, string>>;
}

export type ActionResult =
  | { readonly ok: true; readonly action: HumanAction }
  | { readonly ok: false; readonly reason: string };

const TRIMMED = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/**
 * Accept one action, or refuse it with the reason.
 *
 * Refusing at the door rather than storing a malformed action is deliberate: the queue is read by
 * a run that cannot ask follow-up questions, so an action that arrives incomplete would either be
 * silently dropped there or acted on as a guess. Both are worse than a refusal the caller can see.
 */
export function acceptAction(raw: unknown): ActionResult {
  if (raw === null || typeof raw !== "object") return { ok: false, reason: "action must be an object" };
  const it = raw as Record<string, unknown>;

  const kind = TRIMMED(it["kind"]);
  if (!KINDS.has(kind)) {
    return { ok: false, reason: `unknown action kind '${kind}' — expected one of ${[...KINDS].sort().join(", ")}` };
  }
  const byHuman = TRIMMED(it["byHuman"]);
  if (byHuman === "") return { ok: false, reason: "byHuman is required: an action needs somebody who took it" };

  const subjectId = TRIMMED(it["subjectId"]);
  if (subjectId === "") return { ok: false, reason: "subjectId is required: an action needs something it is about" };

  const reason = TRIMMED(it["reason"]);
  if (reason === "") {
    return { ok: false, reason: "reason is required: human actions are audited like agent actions" };
  }

  const atRaw = it["atMs"];
  const atMs = typeof atRaw === "number" && Number.isFinite(atRaw) ? atRaw : Date.now();

  const detailRaw = it["detail"];
  const detail: Record<string, string> = {};
  if (detailRaw !== null && typeof detailRaw === "object") {
    for (const [k, v] of Object.entries(detailRaw as Record<string, unknown>)) {
      if (typeof v === "string") detail[k] = v;
    }
  }

  // A gate answer that does not say WHICH gate cannot be applied to anything.
  if ((kind === HumanActionKind.ApproveGate || kind === HumanActionKind.RejectGate) && TRIMMED(detail["gate"]) === "") {
    return { ok: false, reason: `${kind} needs detail.gate — which gate is being answered` };
  }
  if (kind === HumanActionKind.AdjustPriority && TRIMMED(detail["priority"]) === "") {
    return { ok: false, reason: "adjust_priority needs detail.priority" };
  }
  if (kind === HumanActionKind.DeprovisionHat && TRIMMED(detail["agentId"]) === "") {
    return { ok: false, reason: "deprovision_hat needs detail.agentId — whose hat is being taken" };
  }
  // An answer with no answer in it un-blocks nothing, and the agent would resume on an empty
  // string. `reason` is why you answered; `detail.answer` is the answer.
  if (kind === HumanActionKind.AnswerBlocker && TRIMMED(detail["answer"]) === "") {
    return { ok: false, reason: "answer_blocker needs detail.answer — what the agent should do" };
  }
  // A note with no words in it puts an empty line in a room and a name against it.
  if (kind === HumanActionKind.PostToRoom && TRIMMED(detail["message"]) === "") {
    return { ok: false, reason: "post_to_room needs detail.message — what you want to say" };
  }

  const idRaw = TRIMMED(it["actionId"]);
  return {
    ok: true,
    action: {
      actionId: idRaw === "" ? `ha-${String(atMs)}-${kind}-${subjectId}` : idRaw,
      kind: kind as HumanActionKind,
      byHuman,
      atMs,
      subjectId,
      reason,
      ...(Object.keys(detail).length === 0 ? {} : { detail }),
    },
  };
}

/**
 * The action as an ORG EVENT, so it lands in the same log and the same fold as everything else.
 *
 * This is the whole reason human actions are events rather than a side table: the trace already
 * answers "what happened and who did it", and an action recorded anywhere else would be a second
 * history that the first one does not know about. `actorHatId` is deliberately absent — a person is
 * not wearing a hat, and borrowing one to make the shape fit would put a human's decision on an
 * agent's authority.
 */
export function actionEvent(action: HumanAction, eventId: string): OrgEvent {
  return {
    id: eventId,
    kind: OrgEventKind.DecisionRecorded,
    atMs: action.atMs,
    subjectId: action.subjectId,
    decision: `human ${action.kind}: ${action.reason}`,
    actorAgentId: action.byHuman,
    supervisorChain: [],
    evidenceRefs: [`human-action/${action.actionId}`],
  };
}

/** Actions the run has not consumed yet, oldest first — the queue as the organization sees it. */
export function pendingActions(
  actions: readonly HumanAction[],
  consumedIds: ReadonlySet<string>,
): readonly HumanAction[] {
  return [...actions]
    .filter((a) => !consumedIds.has(a.actionId))
    .sort((a, b) => (a.atMs === b.atMs ? (a.actionId < b.actionId ? -1 : 1) : a.atMs - b.atMs));
}

/**
 * Is the run paused, per the actions so far?
 *
 * Derived by replaying pause and resume in order rather than stored, so it cannot disagree with the
 * queue it came from — the same discipline the whole register uses for state.
 */
export function isPaused(actions: readonly HumanAction[]): boolean {
  let paused = false;
  for (const a of pendingActions(actions, new Set())) {
    if (a.kind === HumanActionKind.PauseRun) paused = true;
    if (a.kind === HumanActionKind.ResumeRun) paused = false;
  }
  return paused;
}
