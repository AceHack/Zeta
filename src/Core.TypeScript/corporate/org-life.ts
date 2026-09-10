/**
 * corporate/org-life.ts — what the organization does when nobody is asking it for anything.
 *
 * ── THE COMPLAINT THIS ANSWERS ───────────────────────────────────────────────
 * *"it only works when there's work"* — and that is exactly what the register did. `driveUntilSettled`
 * runs rounds until one changes nothing and stops; with an empty queue the whole organization is a
 * set of hats standing still. That is a pipeline with an org chart drawn on it, not an organization.
 *
 * Three things are missing, and they are different from each other:
 *
 *   1. **Idle is a state something happens IN.** A hat with nothing assigned should be studying the
 *      code it will be asked about, and what it learns should outlive the hour — so a free-time
 *      block PRODUCES A MEMORY. A free block with no output is a hole in the calendar that proves
 *      nothing happened, which is how "the agents are always busy" becomes unfalsifiable.
 *
 *   2. **A hat is worn, not owned.** Authority should exist while there is work that needs it and
 *      not otherwise. `hat-binding.ts` already makes wearing temporal; nothing decided WHEN.
 *
 *   3. **A person outranks the schedule.** When somebody wants to talk to an agent, that is the most
 *      valuable thing the agent can be doing. The conversation takes the slot and the work it
 *      displaces moves later — visibly, with the displacement recorded, because an organization that
 *      silently drops work to take a meeting is not more responsive, it is less trustworthy.
 */

import { stringCompare } from "../collation/collation.ts";
import type { Cascade } from "./goal-cascade";
import { deliveredSet, WorkState } from "./goal-cascade";
import type { OrgChart } from "./org-chart";
import { MemoryTier, type WriteInput } from "./memory";
import {
  intervalsOverlap,
  occupies,
  ScheduleBlockState,
  ScheduleBlockType,
  type Calendar,
  type ScheduleBlock,
} from "./work-schedule";

// ─── Idleness ────────────────────────────────────────────────────────────────

export interface IdleHat {
  readonly hatId: string;
  /** Why it is idle, so a reader can tell "nothing to do" from "blocked on something". */
  readonly because: "no_work_assigned" | "all_work_done";
}

/**
 * Hats with nothing to do right now.
 *
 * A hat is idle when it owns no work in a live state AND holds no occupying block at `nowMs`.
 * Both halves are needed: a hat between two tasks is not idle if it is in a meeting, and a hat with
 * a stale calendar entry and no work is.
 */
export function idleHats(chart: OrgChart, cascade: Cascade, calendar: Calendar, nowMs: number): readonly IdleHat[] {
  // DELIVERED, not `state === Done` — see `hatDemand` below for the measurement. An internal node
  // is never marked done, so a hat owning a fully delivered goal was never counted idle and could
  // never be offered an hour to go and read something.
  const delivered = deliveredSet(cascade);
  const out: IdleHat[] = [];
  for (const hat of chart.hats) {
    const owned = cascade.nodes.filter((n) => n.ownerHatId === hat.id);
    const live = owned.filter((n) => !delivered.has(n.workId) && n.state !== WorkState.Canceled);
    if (live.length > 0) continue;
    const busy = calendar.blocks.some(
      (b) => b.hatId === hat.id && occupies(b.state) && b.startMs <= nowMs && nowMs < b.endMs,
    );
    if (busy) continue;
    out.push({ hatId: hat.id, because: owned.length === 0 ? "no_work_assigned" : "all_work_done" });
  }
  return out;
}

// ─── Self-directed time ──────────────────────────────────────────────────────

/**
 * What a hat may do with time nobody assigned it.
 *
 * Deliberately NARROW, and every one of them ends in something written down. An agent with an idle
 * hour and no constraint is an agent that can do anything, which is the shape of a change nobody
 * asked for landing in a repository at 3am.
 */
export const SelfDirectedKind = {
  /** Read part of the codebase it will be asked about and record what it now knows. */
  StudyRepository: "study_repository",
  /** Write down how a subsystem actually works, for whoever wears this hat next. */
  WriteContextDoc: "write_context_doc",
  /** Re-read its own memory: confirm what is still true, flag what is not. */
  TendMemory: "tend_memory",
  /** Read a peer's finished work to learn the standard, without judging it. */
  StudyPeerWork: "study_peer_work",
} as const;

export type SelfDirectedKind = (typeof SelfDirectedKind)[keyof typeof SelfDirectedKind];

/**
 * Which self-directed hours are STUDY, and therefore spend the study budget.
 *
 * ── THE DEFECT THIS CLOSES ───────────────────────────────────────────────────
 * `study-session.ts` sets `STUDY_BLOCK_TYPE = ScheduleBlockType.Reflection` and `isStudyBlock`
 * tests for exactly that. Every self-directed hour was booked as `FreeTime` instead — by
 * `run-life`'s `bookedThisTick` AND by `foldCalendar`'s `self_directed` case, agreeing with each
 * other and disagreeing with the reader. So `studySpentIn` filtered on a block type the log never
 * contained: MEASURED, a store holding 1609 events folded to 405 blocks of which ZERO were study,
 * and six consecutive runs across six hours each reported `62 studying` with the two-hour daily
 * allowance never falling by a minute. The budget was unspendable by construction.
 *
 * Placed HERE, beside the kinds, because the writer and the fold must classify an hour the same
 * way. Two copies of this test is how the mismatch happened the first time.
 */
export function isStudyKind(kind: string): boolean {
  return kind === SelfDirectedKind.StudyRepository || kind === SelfDirectedKind.StudyPeerWork;
}

export interface SelfDirectedProposal {
  readonly hatId: string;
  readonly kind: SelfDirectedKind;
  readonly startMs: number;
  readonly endMs: number;
  /** What the hat will look at. A subject, never a command. */
  readonly subject: string;
  /**
   * The citable reference of the document this subject came from, when it came from one.
   *
   * ABSENT means the subject is the built-in rotation — a description rather than a document. The
   * distinction has to survive into the proposal, because a memory written from a named source can
   * cite it and a memory written from "the part of this repository this hat touches" cannot, and a
   * reader must be able to tell those apart.
   */
  readonly sourceRef?: string;
  /**
   * The memory this block must produce.
   *
   * NOT OPTIONAL. A free-time block whose output is optional is a block that can always report
   * success, which makes "the organization is learning" a claim nothing can contradict.
   */
  readonly produces: { readonly tier: MemoryTier; readonly scope: string; readonly key: string };
}

/**
 * What a hat is expected to look at, given what it is for.
 *
 * MATCHED ON A SUBSTRING of the department's name, not on an exact id. `departmentOf` returns a
 * display name — "QA & Verification", "Engineering Management" — and keying on lowercase ids meant
 * every hat in the organization fell through to the generic subject. Measured: 47 memories written
 * and all 47 about "the part of this repository this hat touches".
 */
const STUDY_SUBJECTS: readonly (readonly [string, readonly string[]])[] = [
  ["architect", ["the boundaries this system actually has", "where the last design changed"]],
  ["qa", ["the last three defects that escaped", "the slowest test in the suite"]],
  ["security", ["the inputs that cross a trust boundary", "what the last review missed"]],
  ["engineering", ["the module this hat reviews most often", "the tests that fail most often"]],
  ["product", ["what customers asked for twice", "the acceptance criteria that were argued about"]],
  ["memory", ["what the organization has forgotten recently", "which memories are never cited"]],
  ["delivery", ["what the last release broke", "the step that takes longest"]],
  ["program", ["the dependency that blocked the most work", "where estimates were furthest out"]],
  ["business", ["the requirement that changed most", "what was out of scope and came back"]],
];

function subjectFor(departmentId: string | undefined, cycle: number): string {
  const key = (departmentId ?? "").toLowerCase();
  const found = STUDY_SUBJECTS.find(([needle]) => key.includes(needle));
  const list = found?.[1] ?? ["the part of this repository this hat touches"];
  return list[cycle % list.length] ?? list[0] ?? "this repository";
}

export interface SelfDirectedInput {
  readonly idle: readonly IdleHat[];
  readonly nowMs: number;
  readonly blockMs?: number;
  /** Which department each hat belongs to, so the subject is relevant rather than generic. */
  readonly departmentOf?: (hatId: string) => string | undefined;
  /** Rotates the subject so a hat does not study the same thing every idle hour. */
  readonly cycle?: number;
  /** How many hats may be self-directing at once. The rest stay idle and are SAID to be idle. */
  readonly concurrency?: number;
  /**
   * A REAL subject, drawn from the organization's own sources.
   *
   * Injected rather than imported, so this module keeps knowing nothing about data sources. When it
   * returns a topic the proposal names a document a second party could also read; when it returns
   * `undefined` the built-in rotation is used, which is a description of a subject rather than one
   * — honest as a fallback, and not something to build a memory on. `study-topics.ts` is the
   * intended supplier.
   */
  readonly topicFor?: (hatId: string) => { readonly subject: string; readonly sourceRef?: string } | undefined;
  /**
   * Whether this hat has study budget left.
   *
   * Absent, every idle hat is proposed study every cycle — which is how an organization with more
   * hats than work spends its whole day reading. `study-session.ts` holds the allowance; this is
   * the hook that lets it be enforced without this module owning a calendar.
   */
  readonly mayStudy?: (hatId: string) => boolean;
}

/**
 * What the idle hats should do with the next hour.
 *
 * `concurrency` exists because the honest answer to "what is everyone doing" is sometimes "nothing".
 * Filling every idle hat's calendar with study would make the organization look busy at exactly the
 * moment its real capacity is free — and capacity that reads as busy never gets used.
 */
export function proposeSelfDirected(input: SelfDirectedInput): readonly SelfDirectedProposal[] {
  const blockMs = input.blockMs ?? 3_600_000;
  const cycle = input.cycle ?? 0;
  const limit = input.concurrency ?? Math.max(1, Math.ceil(input.idle.length / 2));
  const out: SelfDirectedProposal[] = [];
  // Ordered by hat id so two identical states propose identically — the calendar has to replay.
  // Hats with no study budget left are dropped BEFORE `limit` is applied, so the concurrency slots
  // go to hats that can actually use them rather than being spent on refusals.
  const ordered = [...input.idle]
    .filter((h) => input.mayStudy === undefined || input.mayStudy(h.hatId))
    .sort((a, b) => stringCompare(a.hatId, b.hatId));
  for (const hat of ordered.slice(0, limit)) {
    const department = input.departmentOf?.(hat.hatId);
    // Rotate the kind with the cycle so a hat studies, then writes it down, then tends what it wrote.
    const kinds = [
      SelfDirectedKind.StudyRepository,
      SelfDirectedKind.WriteContextDoc,
      SelfDirectedKind.TendMemory,
      SelfDirectedKind.StudyPeerWork,
    ] as const;
    const kind = kinds[(cycle + ordered.indexOf(hat)) % kinds.length] ?? SelfDirectedKind.StudyRepository;
    // TendMemory is about the hat's OWN memory and has no external subject, so a supplied topic
    // would be wrong for it — offering one would send a hat to read a repository when the point of
    // the block is to re-examine what it already believes.
    const topic = kind === SelfDirectedKind.TendMemory ? undefined : input.topicFor?.(hat.hatId);
    const subject =
      kind === SelfDirectedKind.TendMemory
        ? "its own memory"
        : (topic?.subject ?? subjectFor(department, cycle));
    out.push({
      hatId: hat.hatId,
      kind,
      startMs: input.nowMs,
      endMs: input.nowMs + blockMs,
      subject,
      ...(topic?.sourceRef === undefined ? {} : { sourceRef: topic.sourceRef }),
      // HAT TIER, not agent tier. What a hat learns about the code belongs to the ROLE — whoever
      // wears it next inherits it. Personal calibration is the agent tier and is written elsewhere.
      produces: { tier: MemoryTier.Hat, scope: hat.hatId, key: `${kind}:${slugKey(subject)}` },
    });
  }
  return out;
}

function slugKey(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

/** The calendar block a proposal becomes. */
export function blockForProposal(proposal: SelfDirectedProposal, seq: number): ScheduleBlock {
  return {
    blockId: `self-${proposal.hatId}-${String(proposal.startMs)}-${String(seq)}`,
    hatId: proposal.hatId,
    blockType: ScheduleBlockType.FreeTime,
    startMs: proposal.startMs,
    endMs: proposal.endMs,
    state: ScheduleBlockState.Scheduled,
  };
}

/**
 * What a completed self-directed block writes down.
 *
 * The block's whole justification. A `TendMemory` block writes nothing new — it confirms or flags
 * what is already there — so it returns `undefined` rather than manufacturing a memory to prove it
 * happened, which is the failure mode this function exists inside.
 */
export function memoryFromSelfDirected(
  proposal: SelfDirectedProposal,
  found: string,
  atMs: number,
): WriteInput | undefined {
  if (proposal.kind === SelfDirectedKind.TendMemory) return undefined;
  if (found.trim() === "") return undefined;
  return {
    tier: proposal.produces.tier,
    scope: proposal.produces.scope,
    key: proposal.produces.key,
    value: found.trim(),
    contextHint: `learned during ${proposal.kind} on '${proposal.subject}'`,
    writtenBy: proposal.hatId,
    atMs,
    // Lower than a lesson learned from real work. Studying is how you form a belief; delivering is
    // how you find out you were right, and the confidence should say which one this came from.
    confidence: 0.45,
  };
}

// ─── What outranks what ──────────────────────────────────────────────────────

/**
 * How readily a block gives way, low to high.
 *
 * ── WHY A TABLE AND NOT A RULE PER CALLER ───────────────────────────────────
 * Precedence asked one pair at a time drifts: one caller decides work beats study, another decides
 * a meeting beats work, and the two are never compared. Stated once, the whole order is a thing a
 * person can read and disagree with.
 *
 * FREE TIME IS THE ONLY THING THAT MOVES FOR WORK. Everything else is a commitment to somebody: a
 * meeting has other attendees sitting in it, and work in progress is a promise already made.
 */
const YIELDS_TO_WORK: ReadonlySet<ScheduleBlockType> = new Set([
  ScheduleBlockType.FreeTime,
  ScheduleBlockType.Reflection,
  ScheduleBlockType.MemoryMaintenance,
]);

export interface Replan {
  readonly calendar: Calendar;
  /** What the agent moved to make room, and by how much. The COST, kept rather than absorbed. */
  readonly displaced: readonly { readonly blockId: string; readonly byMs: number }[];
  /** What it refused to move, and why. An empty list means nothing was in the way. */
  readonly kept: readonly { readonly blockId: string; readonly because: string }[];
}

/**
 * A hat clears its own hours for work that outranks what it had booked.
 *
 * ── THE AGENT DOES THIS, NOT A SCHEDULER ────────────────────────────────────
 * Called from the hat's own tick, on its own calendar. A central rescheduler would be an appointed
 * hub, and it would be deciding what to interrupt without knowing what the hat is in the middle
 * of. Here the hat moves its own study hour and reports what that cost.
 *
 * ── IT MOVES, IT DOES NOT CANCEL ────────────────────────────────────────────
 * Cancelling would make the organisation look instantly available and quietly lose the reading.
 * Moving keeps the commitment and makes the delay visible — the same reason
 * `preemptForConversation` shifts rather than deletes.
 *
 * ── AND IT REPORTS WHAT IT WOULD NOT MOVE ───────────────────────────────────
 * A meeting is other people's time and a work block is a promise already made, so neither yields.
 * Returned in `kept` rather than silently skipped: "the work could not start at 10:00 because this
 * hat was in a room" is the answer to a question somebody will ask.
 */
export function replanForWork(
  calendar: Calendar,
  input: {
    readonly hatId: string;
    readonly nowMs: number;
    readonly durationMs: number;
    readonly workItemId: string;
    readonly blockId?: string;
  },
): { readonly ok: true; readonly replan: Replan } | { readonly ok: false; readonly reason: string } {
  if (input.durationMs <= 0) return { ok: false, reason: "work needs a duration" };
  if (input.workItemId.trim() === "") return { ok: false, reason: "work needs an item to be against" };

  const endMs = input.nowMs + input.durationMs;
  const displaced: { blockId: string; byMs: number }[] = [];
  const kept: { blockId: string; because: string }[] = [];

  const moved = calendar.blocks.map((b) => {
    if (b.hatId !== input.hatId || !occupies(b.state)) return b;
    if (!intervalsOverlap(b.startMs, b.endMs, input.nowMs, endMs)) return b;
    if (!YIELDS_TO_WORK.has(b.blockType)) {
      kept.push({
        blockId: b.blockId,
        because:
          b.blockType === ScheduleBlockType.Meeting
            ? "a meeting is other people's time, and work does not take it"
            : `a ${String(b.blockType)} block is a promise already made`,
      });
      return b;
    }
    const byMs = endMs - b.startMs;
    displaced.push({ blockId: b.blockId, byMs });
    return { ...b, startMs: b.startMs + byMs, endMs: b.endMs + byMs };
  });

  // The work block itself is only booked once the hours are actually clear. Booking it over a
  // meeting would produce a calendar that says two things are happening at once, which is how a
  // schedule stops being usable as an answer to "what is this hat doing".
  if (kept.length > 0) {
    return { ok: true, replan: { calendar, displaced: [], kept } };
  }

  const work: ScheduleBlock = {
    blockId: input.blockId ?? `work-${input.hatId}-${String(input.nowMs)}`,
    hatId: input.hatId,
    blockType: ScheduleBlockType.PrioritizedWork,
    startMs: input.nowMs,
    endMs,
    state: ScheduleBlockState.Scheduled,
    workItemId: input.workItemId,
  };

  return { ok: true, replan: { calendar: { ...calendar, blocks: [...moved, work] }, displaced, kept } };
}

// ─── A person outranks the schedule ──────────────────────────────────────────

export interface Preemption {
  readonly calendar: Calendar;
  readonly conversationBlockId: string;
  /** Blocks that were pushed later, and by how much. Recorded because it is a real cost. */
  readonly displaced: readonly { readonly blockId: string; readonly byMs: number }[];
}

export type PreemptResult =
  | { readonly ok: true; readonly preemption: Preemption }
  | { readonly ok: false; readonly reason: string };

/**
 * Book a conversation NOW, and push what it displaces.
 *
 * ── WHY IT MOVES WORK RATHER THAN CANCELLING IT ─────────────────────────────
 * Cancelling would make the organization look instantly available and quietly lose the work. Moving
 * it keeps the commitment and makes the cost of the interruption visible: the displaced blocks and
 * their delay come back in the result, and the caller records them.
 *
 * ── WHAT IT REFUSES ─────────────────────────────────────────────────────────
 * A conversation may not displace ANOTHER conversation. Two people cannot both have the agent's
 * attention, and letting the second arrival take the slot would silently cancel the first person's
 * meeting while they were waiting in it.
 */
export function preemptForConversation(
  calendar: Calendar,
  input: {
    readonly hatId: string;
    readonly nowMs: number;
    readonly durationMs: number;
    readonly withHuman: string;
    readonly about?: string;
    readonly blockId?: string;
  },
): PreemptResult {
  if (input.durationMs <= 0) return { ok: false, reason: "a conversation needs a duration" };
  if (input.withHuman.trim() === "") return { ok: false, reason: "a conversation needs somebody to be with" };

  const endMs = input.nowMs + input.durationMs;
  const mine = calendar.blocks.filter((b) => b.hatId === input.hatId && occupies(b.state));

  const conflictingConversation = mine.find(
    (b) => b.blockType === ScheduleBlockType.Meeting && intervalsOverlap(b.startMs, b.endMs, input.nowMs, endMs),
  );
  if (conflictingConversation !== undefined) {
    return {
      ok: false,
      reason: `${input.hatId} is already in ${conflictingConversation.blockId} — a second person may not take the first one's slot`,
    };
  }

  const conversationBlockId = input.blockId ?? `talk-${input.hatId}-${String(input.nowMs)}`;
  const displaced: { blockId: string; byMs: number }[] = [];
  const moved = calendar.blocks.map((b) => {
    if (b.hatId !== input.hatId || !occupies(b.state)) return b;
    if (!intervalsOverlap(b.startMs, b.endMs, input.nowMs, endMs)) return b;
    // Shift by exactly enough to clear the conversation, preserving the block's own length.
    const byMs = endMs - b.startMs;
    displaced.push({ blockId: b.blockId, byMs });
    return { ...b, startMs: b.startMs + byMs, endMs: b.endMs + byMs };
  });

  const conversation: ScheduleBlock = {
    blockId: conversationBlockId,
    hatId: input.hatId,
    blockType: ScheduleBlockType.Meeting,
    startMs: input.nowMs,
    endMs,
    state: ScheduleBlockState.Active,
    ...(input.about === undefined ? {} : { anchorId: input.about }),
  };

  return {
    ok: true,
    preemption: {
      calendar: { ...calendar, blocks: [...moved, conversation] },
      conversationBlockId,
      displaced,
    },
  };
}

// ─── Awake, studying, or asleep ───────────────────────────────────────────────

/**
 * What an agent is actually doing right now.
 *
 * ── WHY SLEEP HAS TO BE A NAMED STATE ────────────────────────────────────────
 * Without it, "idle" covers two completely different things: a hat spending an hour reading a
 * repository, and a hat doing nothing at all. Both are "not on a ticket", so an organisation that
 * reported only idleness would look identical whether its agents were learning or switched off —
 * and "the organisation is alive outside working hours" would be unfalsifiable.
 *
 * SLEEP IS NOT A FAILURE. An agent with no work and nothing worth studying SHOULD stop; the
 * alternative is make-work, which costs money and fills the memory store with things nobody asked
 * for. What matters is that the state is visible and that it ENDS when work arrives.
 */
export const Presence = {
  /** Wearing a hat because live work needs that authority. */
  Working: "working",
  /** Idle, and spending a booked hour on the repository or its own memory. */
  Studying: "studying",
  /** In a room with other hats, or with a person. */
  InAMeeting: "in_a_meeting",
  /** Nothing to do and no hour booked. Costs nothing, and ends the moment work needs this hat. */
  Asleep: "asleep",
} as const;

export type Presence = (typeof Presence)[keyof typeof Presence];

/**
 * Whether a string off the wire names a state this build knows.
 *
 * Needed because the `presence_census` fact stores the state as a plain string — a fact is data on
 * disk, and a log written by an older or newer build must still be readable. Narrowing HERE, next
 * to the union it narrows to, keeps the check from drifting away from the thing it checks.
 */
export function isPresence(value: string): value is Presence {
  return (Object.values(Presence) as readonly string[]).includes(value);
}

export interface HatPresence {
  readonly hatId: string;
  readonly presence: Presence;
  /** Said in a sentence, because "asleep" without a reason is indistinguishable from "stuck". */
  readonly because: string;
  /** What it is doing, when it is doing something. */
  readonly subject?: string;
}

export interface PresenceInput {
  /** Every hat in the chart — the denominator. Without it "3 working" has no scale. */
  readonly allHatIds: readonly string[];
  /** Hats whose authority live work needs, from `hatDemand`. */
  readonly demandedHatIds: readonly string[];
  /** Study blocks handed out this tick, from `proposeSelfDirected`. */
  readonly studying: readonly { readonly hatId: string; readonly subject: string }[];
  /** Hats sitting in a meeting at `nowMs`. */
  readonly inMeeting: readonly string[];
}

/**
 * Where every hat is, right now.
 *
 * Ordered by hat id, and TOTAL over `allHatIds`: every hat gets exactly one state. A function that
 * returned only the interesting ones would let the sleeping majority go unreported, which is the
 * half that says whether the organisation is actually doing anything.
 *
 * Precedence is deliberate — a hat can be more than one of these at once and the answer has to be
 * the one a person would give. Working outranks a meeting (you are in the room ABOUT the work);
 * a meeting outranks studying (the room takes the hour); studying outranks sleep.
 */
export function presenceOf(input: PresenceInput): readonly HatPresence[] {
  const demanded = new Set(input.demandedHatIds);
  const meeting = new Set(input.inMeeting);
  const studying = new Map(input.studying.map((s) => [s.hatId, s.subject]));

  return [...input.allHatIds]
    .sort((a, b) => stringCompare(a, b))
    .map((hatId): HatPresence => {
      if (demanded.has(hatId)) {
        return { hatId, presence: Presence.Working, because: "live work needs this authority" };
      }
      if (meeting.has(hatId)) {
        return { hatId, presence: Presence.InAMeeting, because: "in a room at this hour" };
      }
      const subject = studying.get(hatId);
      if (subject !== undefined) {
        return {
          hatId,
          presence: Presence.Studying,
          because: "no work, so it booked an hour to go and read something",
          subject,
        };
      }
      return {
        hatId,
        presence: Presence.Asleep,
        // The reason matters: this is a hat that COULD have studied and was not given the hour,
        // which is a capacity decision rather than a judgement about the hat.
        because: "no work needs this authority and no hour was booked",
      };
    });
}

/** A one-line census. Useful in a run's output, where the shape of the day is the point. */
export function presenceSummary(presence: readonly HatPresence[]): string {
  const count = (p: Presence): number => presence.filter((x) => x.presence === p).length;
  return [
    `${String(count(Presence.Working))} working`,
    `${String(count(Presence.InAMeeting))} in a meeting`,
    `${String(count(Presence.Studying))} studying`,
    `${String(count(Presence.Asleep))} asleep`,
  ].join(" · ");
}

/**
 * Hats that were asleep and are needed now.
 *
 * The half that makes sleep safe rather than a hole: an organisation that could not report who it
 * is about to wake has no way to show that sleep ever ends.
 */
export function waking(
  before: readonly HatPresence[],
  demandedNow: readonly string[],
): readonly string[] {
  const wasAsleep = new Set(before.filter((p) => p.presence === Presence.Asleep).map((p) => p.hatId));
  return [...new Set(demandedNow)].filter((h) => wasAsleep.has(h)).sort((a, b) => stringCompare(a, b));
}

// ─── Meetings ────────────────────────────────────────────────────────────────

/**
 * Why two hats would put an hour in the diary.
 *
 * ── WHY THERE IS A FIXED LIST AND NOT A GENERAL "MEETING" ────────────────────
 * A standing meeting nobody can cancel is how an organization stops noticing it is not working. So
 * every meeting here is CAUSED — it names the condition that produced it, the condition is
 * computable from the log, and when the condition clears the meeting stops being proposed. A
 * calendar full of recurring blocks with no cause is a calendar that measures attendance.
 */
export const MeetingReason = {
  /** A gate rejected the same work twice. The author and the reviewer disagree about something. */
  RepeatedRejection: "repeated_rejection",
  /** Work has been held for a person longer than a threshold. Somebody should be asked why. */
  StalledOnAPerson: "stalled_on_a_person",
  /** A blocker was raised that no single hat can clear. */
  UnresolvedBlocker: "unresolved_blocker",
  /** Two hats hold conflicting memories at the same key. One of them is wrong. */
  ConflictingMemory: "conflicting_memory",
} as const;

export type MeetingReason = (typeof MeetingReason)[keyof typeof MeetingReason];

export interface MeetingProposal {
  readonly meetingId: string;
  readonly reason: MeetingReason;
  /** Who should be there. Never more than the reason justifies. */
  readonly attendeeHatIds: readonly string[];
  /** What it is about, in a sentence somebody can decide from. */
  readonly about: string;
  /** The work item or memory it concerns. */
  readonly subjectId: string;
  readonly startMs: number;
  readonly endMs: number;
  /**
   * What has to come out of it.
   *
   * REQUIRED, for the same reason a free-time block must produce a memory: a meeting whose output
   * is optional is a meeting that can always report success, and "we discussed it" is what an
   * organization says when nothing happened.
   */
  readonly mustProduce: string;
}

export interface MeetingInput {
  readonly nowMs: number;
  readonly durationMs?: number;
  /** Gates that rejected the same work more than once, with who authored and who judged. */
  readonly repeatedRejections?: readonly {
    readonly workId: string;
    readonly gate: string;
    readonly authorHatId: string;
    readonly reviewerHatId: string;
    readonly attempts: number;
  }[];
  /** Work held for a person, and for how long. */
  readonly heldForPeople?: readonly {
    readonly workId: string;
    readonly gate: string;
    readonly ownerHatId: string;
    readonly heldSinceMs: number;
    /**
     * Who the owner takes it to. REQUIRED for the meeting to exist, and the reason is mechanical:
     * `scheduleMeeting` refuses fewer than two attendees, because a one-person block is a work
     * block and calling it a meeting would let a hat manufacture an unavailability nobody else is
     * party to. A single-attendee proposal is therefore one that can never be booked -- a proposal
     * that always fails at the calendar is the vacuity class with the sign flipped. Absent, no
     * meeting is proposed and the hold stays visible as a hold.
     */
    readonly escalateToHatId?: string;
  }[];
  /** Blockers nobody in the organization could clear. */
  readonly unresolvedBlockers?: readonly {
    readonly blockerId: string;
    readonly about: string;
    readonly raisedByHatId: string;
    readonly askedHatIds: readonly string[];
  }[];
  /** Memories at the same key whose values disagree. */
  readonly memoryConflicts?: readonly {
    readonly key: string;
    readonly scopes: readonly string[];
  }[];
  /** How long a hold has to last before it is worth a meeting. Default one working day. */
  readonly stalledAfterMs?: number;
}

/**
 * How long something has been waiting, said at a granularity that does not flatter.
 *
 * HOURS BELOW TWO DAYS, on purpose. `Math.floor(ms / one day)` was the first version and it read
 * "1 day(s)" for a hold that was 47 hours and 58 minutes old — the walk advances the clock by a
 * minute, so a hold started at 09:01 is never a whole number of days at 09:00. Truncating a
 * duration always under-reports it, and this string is the sentence somebody decides from.
 */
function elapsedLabel(ms: number): string {
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 48) return `${String(hours)} hour(s)`;
  return `${String(Math.round(hours / 24))} day(s)`;
}

/**
 * Which meetings the organization should hold, and why.
 *
 * Ordered so the same state proposes the same meetings — a calendar that reshuffles between two
 * identical runs cannot be replayed, and a meeting that moves every run is one nobody attends.
 */
export function proposeMeetings(input: MeetingInput): readonly MeetingProposal[] {
  const durationMs = input.durationMs ?? 1_800_000;
  const stalledAfter = input.stalledAfterMs ?? 86_400_000;
  const out: MeetingProposal[] = [];

  for (const r of [...(input.repeatedRejections ?? [])].sort((a, b) => stringCompare(a.workId, b.workId))) {
    if (r.attempts < 2) continue;
    if (r.authorHatId === r.reviewerHatId) continue; // nobody meets themselves
    out.push({
      meetingId: `meet-reject-${r.workId}-${r.gate}`,
      reason: MeetingReason.RepeatedRejection,
      attendeeHatIds: [r.authorHatId, r.reviewerHatId],
      about: `'${r.gate}' has rejected ${r.workId} ${String(r.attempts)} times — the author and the reviewer disagree about what good looks like`,
      subjectId: r.workId,
      startMs: input.nowMs,
      endMs: input.nowMs + durationMs,
      mustProduce: "an agreed acceptance criterion, or an escalation naming who decides",
    });
  }

  for (const h of [...(input.heldForPeople ?? [])].sort((a, b) => stringCompare(a.workId, b.workId))) {
    if (input.nowMs - h.heldSinceMs < stalledAfter) continue;
    if (h.escalateToHatId === undefined || h.escalateToHatId === h.ownerHatId) continue;
    out.push({
      meetingId: `meet-stalled-${h.workId}-${h.gate}`,
      reason: MeetingReason.StalledOnAPerson,
      attendeeHatIds: [h.ownerHatId, h.escalateToHatId],
      about: `${h.workId} has waited on a person at '${h.gate}' for ${elapsedLabel(input.nowMs - h.heldSinceMs)}`,
      subjectId: h.workId,
      startMs: input.nowMs,
      endMs: input.nowMs + durationMs,
      mustProduce: "either the decision, or a named person and a date by which they will make it",
    });
  }

  for (const b of [...(input.unresolvedBlockers ?? [])].sort((x, y) => stringCompare(x.blockerId, y.blockerId))) {
    out.push({
      meetingId: `meet-blocker-${b.blockerId}`,
      reason: MeetingReason.UnresolvedBlocker,
      // The raiser plus whoever was already asked. Widening it further would be a meeting held to
      // spread responsibility rather than to resolve anything.
      attendeeHatIds: [b.raisedByHatId, ...b.askedHatIds].filter((v, i, a) => a.indexOf(v) === i),
      about: `nobody could clear '${b.about}'`,
      subjectId: b.blockerId,
      startMs: input.nowMs,
      endMs: input.nowMs + durationMs,
      mustProduce: "a way forward, or a decision to raise it out of the organization",
    });
  }

  for (const c of [...(input.memoryConflicts ?? [])].sort((a, b) => stringCompare(a.key, b.key))) {
    if (c.scopes.length < 2) continue;
    out.push({
      meetingId: `meet-memory-${c.key}`,
      reason: MeetingReason.ConflictingMemory,
      attendeeHatIds: [...c.scopes],
      about: `${String(c.scopes.length)} hats believe different things about '${c.key}' — one of them is wrong`,
      subjectId: c.key,
      startMs: input.nowMs,
      endMs: input.nowMs + durationMs,
      mustProduce: "one memory reinforced and the others demoted, or a note that both are true in different scopes",
    });
  }

  return out;
}

/** The calendar blocks a meeting becomes — one leg per attendee, sharing a meeting id. */
export function blocksForMeeting(proposal: MeetingProposal): readonly ScheduleBlock[] {
  return proposal.attendeeHatIds.map((hatId) => ({
    blockId: `${proposal.meetingId}-${hatId}`,
    hatId,
    blockType: ScheduleBlockType.Meeting,
    startMs: proposal.startMs,
    endMs: proposal.endMs,
    state: ScheduleBlockState.Scheduled,
    meetingId: proposal.meetingId,
    subjectId: proposal.subjectId,
  })) as readonly ScheduleBlock[];
}

/**
 * Why a meeting fell short of what it owed, or `undefined` if it did not.
 *
 * ── WHAT THIS CAN AND CANNOT CHECK ──────────────────────────────────────────
 * It cannot judge whether an outcome is GOOD — nothing here can read a sentence and know whether it
 * settles an acceptance criterion. What it can do is refuse the two failures that need no judgement:
 * a meeting that produced nothing at all, and one that produced only a record of having happened.
 *
 * The shortfall NAMES what was required, because "insufficient" without the requirement beside it
 * is a verdict nobody can act on. That is also why this returns a sentence rather than a boolean.
 */
export function meetingShortfall(proposal: MeetingProposal, produced: string): string | undefined {
  const text = produced.trim();
  if (text === "") {
    return `${proposal.meetingId} produced nothing. It owed: ${proposal.mustProduce}`;
  }
  // "We discussed it" is precisely what an organization says when nothing happened, so an output
  // that only reports attendance is treated as no output.
  //
  // The word boundary is a CHARACTER CLASS rather than `\b` on purpose: this line was corrupted
  // once by a shell heredoc that turned the escape into a literal backspace byte (0x08). The regex
  // still compiled, still read correctly to a human, and matched nothing — the check was inert and
  // looked fine. A class cannot be mangled into something that looks the same.
  if (/^(we )?(discussed|talked about|reviewed|met)(\s|$|[.,;!])/i.test(text) && text.length < 80) {
    return `${proposal.meetingId} recorded that it happened, not what it decided. It owed: ${proposal.mustProduce}`;
  }
  return undefined;
}

// ─── A hat is worn, not owned ────────────────────────────────────────────────

export interface HatDemand {
  readonly hatId: string;
  /** The work items that need this authority right now. */
  readonly forWorkIds: readonly string[];
}

/**
 * Which hats there is currently work for.
 *
 * The input to donning. A hat with no demand should not be worn — not because wearing it is
 * expensive, but because a register where every authority is always active cannot answer "who was
 * allowed to do this, at the time they did it", which is the only question an audit asks.
 */
export function hatDemand(cascade: Cascade): readonly HatDemand[] {
  // ── DELIVERED, NOT `state === Done` ────────────────────────────────────────
  // `setState` refuses to mark an internal node done on purpose — a goal is delivered when the
  // work beneath it is, never by being declared complete. So `state === Done` is FALSE BY
  // CONSTRUCTION for every node with children, and a demand check written against it keeps every
  // goal, initiative and project owner's hat on forever.
  //
  // Measured end to end before this line changed: the organisation finished its work and three
  // hats stayed on through four consecutive idle runs. It could never go quiet, so it could never
  // sleep. For a LEAF the two questions agree, so nothing about task-level behaviour changes.
  const delivered = deliveredSet(cascade);
  const byHat = new Map<string, string[]>();
  for (const node of cascade.nodes) {
    if (delivered.has(node.workId) || node.state === WorkState.Canceled) continue;
    if (node.ownerHatId === undefined) continue;
    const list = byHat.get(node.ownerHatId) ?? [];
    list.push(node.workId);
    byHat.set(node.ownerHatId, list);
  }
  return [...byHat.entries()]
    .map(([hatId, forWorkIds]) => ({ hatId, forWorkIds }))
    .sort((a, b) => stringCompare(a.hatId, b.hatId));
}

export const HatMove = { Don: "don", Doff: "doff", Keep: "keep" } as const;
export type HatMove = (typeof HatMove)[keyof typeof HatMove];

export interface HatDecision {
  readonly hatId: string;
  readonly move: HatMove;
  readonly reason: string;
}

/**
 * Who should put a hat on, and who should take one off.
 *
 * A hat is DOFFED when its work is finished — but never while its wearer is mid-conversation or in a
 * meeting under that authority. Taking the hat off somebody who is in a room speaking under it
 * would leave the room's record signed by an authority that had already been revoked.
 */
export function decideHats(input: {
  readonly demand: readonly HatDemand[];
  readonly worn: readonly string[];
  readonly calendar: Calendar;
  readonly nowMs: number;
}): readonly HatDecision[] {
  const needed = new Set(input.demand.map((d) => d.hatId));
  const worn = new Set(input.worn);
  const out: HatDecision[] = [];

  for (const d of input.demand) {
    if (worn.has(d.hatId)) {
      out.push({ hatId: d.hatId, move: HatMove.Keep, reason: `${String(d.forWorkIds.length)} live work item(s)` });
    } else {
      out.push({ hatId: d.hatId, move: HatMove.Don, reason: `work needs this authority: ${d.forWorkIds.join(", ")}` });
    }
  }

  for (const hatId of [...worn].sort()) {
    if (needed.has(hatId)) continue;
    const inRoom = input.calendar.blocks.some(
      (b) =>
        b.hatId === hatId &&
        b.blockType === ScheduleBlockType.Meeting &&
        occupies(b.state) &&
        b.startMs <= input.nowMs &&
        input.nowMs < b.endMs,
    );
    out.push(
      inRoom
        ? { hatId, move: HatMove.Keep, reason: "in a meeting under this authority — not taken off mid-room" }
        : { hatId, move: HatMove.Doff, reason: "no live work needs this authority" },
    );
  }
  return out;
}
