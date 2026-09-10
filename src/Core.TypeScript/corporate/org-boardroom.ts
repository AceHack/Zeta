/**
 * org-boardroom.ts — the company as somebody running it would look at it.
 *
 * The existing view answers questions about MECHANISM: how many events, which ports were real, what
 * the gate progress ratio is. Those are the right questions when you are debugging the register and
 * the wrong ones when you are running the organization, and until now they were the only ones on
 * offer — so a director opening the dashboard got a fold report and had to reconstruct their own
 * company from it.
 *
 * What somebody running it asks, in the order they ask it:
 *
 *   1. Does anything need ME?              → `awaitingPeople` / `awaitingDecisions` (observe-org)
 *   2. Who is doing what, department by department?  → `departmentViews`
 *   3. What has been decided, by whom?     → `approvalViews`
 *   4. What conversations are open?        → `roomViews`
 *
 * ── ALL DERIVED, NONE DECLARED ───────────────────────────────────────────────
 * Every function here folds the log. Nothing is stored, so nothing can disagree with the events it
 * came from — the same discipline as the rest of the register, applied to the reporting layer where
 * it matters most: a dashboard that keeps its own copy of the truth is a dashboard that will one day
 * show a state the organization was never in.
 *
 * ── AND ALL NAMED ────────────────────────────────────────────────────────────
 * Every view here carries the display name beside the id (see `org-presentation`). The id is what
 * an action is addressed to; the name is what a person reads. Carrying both means the page never
 * has to choose between being readable and being actionable.
 */

import type { Calendar } from "./work-schedule";
import type { CascadeNode } from "./goal-cascade";
import type { GateEvaluation } from "./quality-gate";
import type { OrgChart } from "./org-chart";
import type { OrgEvent } from "./org-event";
import type { HumanAction } from "./human-action";
import { scheduleHealth } from "./org-status";
import {
  departmentRank,
  expectedOutputLabel,
  gateLabel,
  hatName,
  humanise,
  levelLabel,
  roomPurposeLabel,
} from "./org-presentation";

// ─── Departments ────────────────────────────────────────────────────────────

/** One hat, as a name and a state rather than an id. */
export interface PersonView {
  readonly hatId: string;
  readonly name: string;
  readonly level: string;
  /** What they are booked to be doing right now, if anything. */
  readonly doingNow: string | undefined;
  readonly booked: number;
  /** Gate verdicts this hat has recorded. The measure of whether a hat is real or decorative. */
  readonly decisions: number;
}

export interface DepartmentView {
  readonly departmentId: string;
  readonly name: string;
  /** The most senior hat in the department. Who a question about it goes to. */
  readonly headHatId: string | undefined;
  readonly headName: string | undefined;
  /** How many hats the chart puts here, whether or not any of them worked. */
  readonly hatCount: number;
  /**
   * Hats that DID something — booked time, or recorded a decision.
   *
   * Not every hat: a department view listing all nine of its hats with zeroes buries the two that
   * are working, which is the same as not reporting them. The count above is how many exist.
   */
  readonly active: readonly PersonView[];
  /** Gate verdicts recorded by this department, all runs. */
  readonly decisions: number;
  /** Work items currently assigned to one of its hats. */
  readonly working: readonly { readonly workId: string; readonly title: string }[];
}

const LEVEL_SENIORITY: Readonly<Record<string, number>> = {
  c_suite: 0,
  director: 1,
  manager: 2,
  lead: 3,
  individual_contributor: 4,
};

/**
 * Every department, in wall-chart order, with what it is actually doing.
 *
 * DEPARTMENTS WITH NOTHING HAPPENING ARE STILL LISTED. An organization chart that hid its idle
 * halves would answer "what is everyone doing" with "everyone is busy" — and the empty departments
 * are frequently the interesting ones, because an idle Security is a different fact from an absent
 * one.
 */
export function departmentViews(
  chart: OrgChart,
  calendar: Calendar,
  evaluations: readonly GateEvaluation[],
  leaves: readonly CascadeNode[],
  nowMs: number,
): readonly DepartmentView[] {
  const byDept = new Map<string, string[]>();
  for (const hat of chart.hats) {
    const list = byDept.get(hat.departmentId) ?? [];
    list.push(hat.id);
    byDept.set(hat.departmentId, list);
  }

  const decisionsByHat = new Map<string, number>();
  for (const e of evaluations) decisionsByHat.set(e.byHatId, (decisionsByHat.get(e.byHatId) ?? 0) + 1);

  const bookedHats = new Set(calendar.blocks.map((b) => b.hatId));

  const out: DepartmentView[] = [];
  for (const [departmentId, hatIds] of byDept) {
    const sorted = [...hatIds].sort(
      (a, b) =>
        (LEVEL_SENIORITY[chart.byId.get(a)?.level ?? ""] ?? 9) -
        (LEVEL_SENIORITY[chart.byId.get(b)?.level ?? ""] ?? 9),
    );
    const head = sorted[0];

    const active: PersonView[] = [];
    for (const hatId of sorted) {
      const decisions = decisionsByHat.get(hatId) ?? 0;
      if (!bookedHats.has(hatId) && decisions === 0) continue;
      const health = scheduleHealth(calendar, hatId, nowMs);
      active.push({
        hatId,
        name: hatName(chart, hatId),
        level: levelLabel(chart.byId.get(hatId)?.level ?? ""),
        doingNow: health.doingNow,
        booked: health.booked,
        decisions,
      });
    }

    const working = leaves
      .filter((n) => n.assigneeHatId !== undefined && hatIds.includes(n.assigneeHatId))
      .map((n) => ({ workId: n.workId, title: n.title }));

    out.push({
      departmentId,
      name: humanise(departmentId),
      headHatId: head,
      headName: head === undefined ? undefined : hatName(chart, head),
      hatCount: hatIds.length,
      active,
      decisions: active.reduce((n, p) => n + p.decisions, 0),
      working,
    });
  }
  return out.sort((a, b) => departmentRank(a.departmentId) - departmentRank(b.departmentId));
}

// ─── Decisions ──────────────────────────────────────────────────────────────

/** One gate verdict, with the person and the department behind it. */
export interface ApprovalView {
  readonly workId: string;
  readonly gate: string;
  readonly gateLabel: string;
  readonly outcome: string;
  readonly byHatId: string;
  readonly byName: string;
  readonly department: string | undefined;
  readonly reason: string;
  readonly atMs: number;
  /**
   * What the approver consulted.
   *
   * Shown rather than counted, because "approved with three references" and "approved" are the two
   * facts an audit is actually trying to tell apart, and a count does not distinguish a considered
   * approval from a reflex any better than the absence of one does.
   */
  readonly evidenceRefs: readonly string[];
  /** True when the verdict came from a person rather than the organization. */
  readonly byHuman: boolean;
}

/** Every gate verdict, newest first, named. */
export function approvalViews(chart: OrgChart, evaluations: readonly GateEvaluation[]): readonly ApprovalView[] {
  return [...evaluations]
    .sort((a, b) => b.atMs - a.atMs)
    .map((e) => ({
      workId: e.workId,
      gate: String(e.gate),
      gateLabel: gateLabel(String(e.gate)),
      outcome: String(e.outcome),
      byHatId: e.byHatId,
      byName: hatName(chart, e.byHatId),
      department: chart.byId.get(e.byHatId)?.departmentId,
      reason: e.reason,
      atMs: e.atMs,
      evidenceRefs: e.evidenceRefs,
      // A human decision is the one that carried an action reference into the evidence. Derived from
      // the evidence rather than from a flag, so it cannot be claimed without the trace behind it.
      byHuman: e.evidenceRefs.some((r) => r.startsWith("human-action/")),
    }));
}

// ─── Rooms ──────────────────────────────────────────────────────────────────

/** A conversation the organization is holding, and what it owes when it ends. */
export interface RoomView {
  readonly roomId: string;
  readonly title: string;
  /** What kind of room — a gate, an incident, a work item. */
  readonly purpose: string;
  /** What it owes: a decision, a document, a gate verdict. */
  readonly owes: string;
  /** The room's OWN sentence about why it exists — not the type, the reason. */
  readonly why: string;
  /** Who was asked, when a signal opened this room. */
  readonly askedOfName: string | undefined;
  /** What the asker actually said. The message, not a paraphrase of the type. */
  readonly openingMessage: string | undefined;
  /** What the asker attached. Empty means they asked with nothing behind it. */
  readonly evidence: readonly string[];
  /**
   * WHY THE ROOM IS SILENT, when it is.
   *
   * The most important line in this view, and the one whose absence made the dashboard feel blind.
   * A room with no turns can be silent for three very different reasons — nobody has got to it yet,
   * a verdict was recorded without anybody speaking, or the reviewer was simulated and never
   * existed — and a page that renders all three as an empty box is telling the reader nothing while
   * looking like it is telling them something.
   */
  readonly silentBecause: string | undefined;
  /** The verdict this room produced, if it produced one. */
  readonly verdict: { readonly outcome: string; readonly byName: string; readonly reason: string } | undefined;
  readonly open: boolean;
  readonly state: string;
  readonly openedByName: string;
  readonly participants: readonly string[];
  readonly workId: string | undefined;
  readonly openedAtMs: number;
  /** What has been said, oldest first. Empty means a room that was opened and never used. */
  readonly turns: readonly {
    readonly byName: string;
    readonly atMs: number;
    readonly body: string;
    /** True when a person said it. Shown differently: a person is not one of the hats. */
    readonly byHuman: boolean;
  }[];
}

/**
 * Every room the log knows about, open ones first.
 *
 * FOLDED FROM THE EVENTS rather than from a board, because the board is a runtime object that does
 * not survive the process and the log does. A room that existed during a run and cannot be seen
 * afterwards is a conversation the organization had and cannot account for.
 */
export function roomViews(
  chart: OrgChart,
  events: readonly OrgEvent[],
  evaluations: readonly GateEvaluation[] = [],
  /** Notes a person left in a room. Folded in beside the agents' turns, attributed to them. */
  actions: readonly HumanAction[] = [],
): readonly RoomView[] {
  const anchors = new Map<
    string,
    {
      title: string;
      anchorType: string;
      purpose: string;
      expectedOutput: string;
      state: string;
      openedByHatId: string;
      participantHatIds: readonly string[];
      openedAtMs: number;
      workItemId?: string;
    }
  >();
  const posts = new Map<string, { byName: string; atMs: number; body: string; byHuman: boolean }[]>();
  /** The signal that opened each room, so the room can show what was actually asked. */
  const asks = new Map<string, { toHatId: string; message: string; evidence: readonly string[] }>();

  for (const event of events) {
    const fact = event.fact;
    if (fact === undefined) continue;
    if (fact.kind === "discussion_anchor") {
      const a = fact.anchor;
      anchors.set(a.anchorId, {
        title: a.title,
        anchorType: String(a.anchorType),
        purpose: a.purpose,
        expectedOutput: String(a.expectedOutput),
        state: String(a.state),
        openedByHatId: a.openedByHatId,
        participantHatIds: a.participantHatIds,
        openedAtMs: a.openedAtMs,
        ...(a.workItemId === undefined ? {} : { workItemId: a.workItemId }),
      });
    } else if (fact.kind === "anchor_state") {
      // A LATER STATE WINS, and only for an anchor already seen. A state event for an anchor the log
      // never opened would otherwise conjure a room out of a status change.
      const existing = anchors.get(fact.anchorId);
      if (existing !== undefined) anchors.set(fact.anchorId, { ...existing, state: String(fact.state) });
    } else if (fact.kind === "supervisor_signal") {
      asks.set(fact.signal.anchorId, {
        toHatId: fact.signal.toHatId,
        message: fact.signal.message,
        evidence: fact.signal.evidence.map((e) => `${e.kind}:${e.ref}`),
      });
    } else if (fact.kind === "anchor_post") {
      const list = posts.get(fact.post.anchorId) ?? [];
      list.push({
        byName: hatName(chart, fact.post.byHatId),
        atMs: fact.post.atMs,
        body: fact.post.body,
        byHuman: false,
      });
      posts.set(fact.post.anchorId, list);
    }
  }

  // A PERSON'S NOTES, from the queue rather than the board — see `HumanActionKind.PostToRoom`.
  for (const action of actions) {
    if (action.kind !== "post_to_room") continue;
    const list = posts.get(action.subjectId) ?? [];
    list.push({
      byName: action.byHuman,
      atMs: action.atMs,
      body: action.detail?.["message"] ?? action.reason,
      byHuman: true,
    });
    posts.set(action.subjectId, list);
  }

  const out: RoomView[] = [];
  for (const [roomId, a] of anchors) {
    const ask = asks.get(roomId);
    const turns = (posts.get(roomId) ?? []).sort((x, y) => x.atMs - y.atMs);
    // The verdict this room owed, if the log holds one for its gate and its work item.
    const decided =
      a.workItemId === undefined
        ? undefined
        : evaluations.find((e) => e.workId === a.workItemId && String(e.gate) === a.title);
    out.push({
      roomId,
      // A REVIEW-REQUEST ROOM IS TITLED WITH ITS GATE KEY, because that is what routes it. Shown as
      // the gate's own name, so a list of open rooms reads as a list of pending reviews rather than
      // a list of database identifiers. `gateLabel` falls through unchanged for other titles.
      title: gateLabel(a.title),
      purpose: roomPurposeLabel(a.anchorType),
      owes: expectedOutputLabel(a.expectedOutput),
      open: a.state === "open",
      state: humanise(a.state),
      openedByName: hatName(chart, a.openedByHatId),
      participants: a.participantHatIds.map((h) => hatName(chart, h)),
      workId: a.workItemId,
      openedAtMs: a.openedAtMs,
      why: a.purpose,
      askedOfName: ask === undefined ? undefined : hatName(chart, ask.toHatId),
      openingMessage: ask?.message,
      evidence: ask?.evidence ?? [],
      silentBecause: turns.length > 0 ? undefined : silenceReason(decided),
      verdict:
        decided === undefined
          ? undefined
          : {
              outcome: String(decided.outcome),
              byName: hatName(chart, decided.byHatId),
              reason: decided.reason,
            },
      turns,
    });
  }
  // OPEN FIRST, then most recent. An open room is something somebody owes; a resolved one is
  // history, and history belongs underneath.
  return out.sort((x, y) => (x.open === y.open ? y.openedAtMs - x.openedAtMs : x.open ? -1 : 1));
}

/**
 * Why a room with no turns is empty, said in the reader's terms.
 *
 * The three cases are genuinely different and only one of them is normal. An `auto-approved:` ref is
 * the register's own record that the review port was simulated — that nobody was consulted, and the
 * verdict is a default rather than a judgement. Reporting that as "no discussion yet" would be the
 * kindest possible lie about what the organization did.
 */
function silenceReason(decided: GateEvaluation | undefined): string {
  if (decided === undefined) return "Nobody has been in here yet — this room is still waiting on its reviewer.";
  if (decided.evidenceRefs.some((r) => r.startsWith("auto-approved:"))) {
    return (
      "NOBODY WAS CONSULTED. The verdict below was recorded by a simulated reviewer that reads no " +
      "evidence and consults nobody — it is a default, not a judgement."
    );
  }
  return "A verdict was recorded without a discussion. Nothing was said in this room.";
}

// ─── Meetings ───────────────────────────────────────────────────────────────

/** A meeting that was actually booked, with the people in it named. */
export interface MeetingView {
  readonly meetingId: string;
  readonly attendees: readonly string[];
  readonly startMs: number;
  readonly endMs: number;
  readonly workId: string | undefined;
}

export function meetingViews(chart: OrgChart, events: readonly OrgEvent[]): readonly MeetingView[] {
  const out: MeetingView[] = [];
  for (const event of events) {
    if (event.fact?.kind !== "meeting_planned") continue;
    const m = event.fact;
    out.push({
      meetingId: m.meetingId,
      attendees: m.attendeeHatIds.map((h) => hatName(chart, h)),
      startMs: m.startMs,
      endMs: m.endMs,
      workId: m.workItemId,
    });
  }
  return out.sort((a, b) => b.startMs - a.startMs);
}
