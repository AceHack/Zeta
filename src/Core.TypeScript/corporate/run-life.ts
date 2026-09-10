/**
 * corporate/run-life.ts — one tick of the organization's life, outside the pipeline.
 *
 * ── WHAT A TICK IS ───────────────────────────────────────────────────────────
 * The pipeline is what the organization does when it is asked. This is what it does the rest of the
 * time, and it is the difference between an org chart and an organization:
 *
 *   1. WHO IS IDLE — computed, not declared.
 *   2. HATS ON AND OFF — authority exists while there is work for it, and not otherwise.
 *   3. SELF-DIRECTED TIME — an idle hat studies something and WRITES DOWN what it learned.
 *   4. MEMORY MAINTENANCE — what was learned decays, and what is worthless is forgotten.
 *   5. MEETINGS — two hats put an hour in the diary because a CONDITION says they should.
 *
 * Every step emits a fact, so a person can ask "what was this organization doing at 4pm on a
 * Tuesday when nothing was in flight" and get an answer other than silence.
 *
 * ── THE STUDY IS PERFORMED BY A COMMAND, OR NOT AT ALL ───────────────────────
 * `study` is injected. Absent, hats are still marked idle and their blocks still appear — but no
 * memory is written, and the tick reports that it studied nothing. An organization that reported
 * learning without a learner would be the exact unfalsifiable claim `org-life.ts` is built against.
 */

import type { Cascade } from "./goal-cascade";
import type { OrgChart } from "./org-chart";
import {
  firstCommonFreeSlot,
  scheduleMeeting,
  ScheduleBlockState,
  ScheduleBlockType,
  type Calendar,
  type ScheduleBlock,
} from "./work-schedule";
import {
  decideHats,
  hatDemand,
  HatMove,
  idleHats,
  isStudyKind,
  memoryFromSelfDirected,
  presenceOf,
  presenceSummary,
  proposeMeetings,
  proposeSelfDirected,
  waking,
  type HatPresence,
  type IdleHat,
  type MeetingInput,
  type MeetingProposal,
  type SelfDirectedProposal,
} from "./org-life";
import { STUDY_BLOCK_TYPE } from "./study-session";
import {
  applyAction,
  maintenancePass,
  MemoryPhase,
  weightOf,
  write,
  type Memory,
  type WriteInput,
} from "./memory";
import type { MemoryStore } from "./memory-store";
import { initMemoryRepo, repoDirFor } from "./memory-store";
import type { OrgEvent, OrgFact } from "./org-event";

/** What a hat found when it went and looked. Empty means it found nothing worth recording. */
export type StudyOutcome =
  | { readonly ok: true; readonly found: string }
  | { readonly ok: false; readonly reason: string };

export type Study = (proposal: SelfDirectedProposal) => Promise<StudyOutcome> | StudyOutcome;

/** What came out of a meeting. `produced` empty means nothing did, which is a real answer. */
export type MeetingOutcome =
  | { readonly ok: true; readonly produced: string }
  | { readonly ok: false; readonly reason: string };

/**
 * Hold one meeting.
 *
 * INJECTED, like the studier and the author. Absent, meetings are still booked and the tick says
 * plainly that nothing was recorded — an organisation with no facilitator wired must not report
 * outcomes it did not have, which is the same rule the study block already follows.
 */
export type HoldMeeting = (proposal: MeetingProposal) => Promise<MeetingOutcome> | MeetingOutcome;

export interface LifeTickInput {
  readonly chart: OrgChart;
  readonly cascade: Cascade;
  readonly calendar: Calendar;
  readonly nowMs: number;
  /** Which hats are currently worn, from the fold. */
  readonly worn: readonly string[];
  /** Absent ⇒ no memory is read or written, and the tick says so. */
  readonly store?: MemoryStore;
  /** Absent ⇒ hats are marked idle and study nothing. */
  readonly study?: Study;
  /** Absent ⇒ meetings are booked and held by nobody, and the tick reports that. */
  readonly hold?: HoldMeeting;
  /** Rotates what a hat looks at between ticks. */
  readonly cycle?: number;
  /** How many hats may study at once. The rest stay visibly idle. */
  readonly concurrency?: number;
  readonly departmentOf?: (hatId: string) => string | undefined;
  /**
   * A real subject for a hat's study hour, drawn from the org's own sources.
   *
   * Absent ⇒ the built-in rotation is used and the block names a description rather than a
   * document. `study-topics.bestTopic` is what this is for; it is injected here so the tick does no
   * I/O of its own.
   */
  readonly topicFor?: (hatId: string) => { readonly subject: string; readonly sourceRef?: string } | undefined;
  /**
   * Whether a hat still has study allowance — `study-session.remainingStudy` against the calendar.
   *
   * Absent ⇒ every idle hat is proposed study every tick, which is the unbounded behaviour this
   * exists to stop. Left optional so a caller that has not adopted budgets behaves as before.
   */
  readonly mayStudy?: (hatId: string) => boolean;
  /**
   * What the organisation currently has a reason to meet about — see `meeting-demand.ts`.
   *
   * Absent ⇒ no meetings are proposed and the tick says it booked none. Deliberately NOT defaulted
   * to an empty demand computed here: a tick that quietly derived its own demand would make
   * "should we meet" a question this module answers about itself, and the whole point of the split
   * is that the condition is folded out of the log by something that can be falsified alone.
   */
  readonly meetings?: MeetingInput;
  /** Mints block and meeting ids. Absent ⇒ meetings are not booked, because a leg needs an id. */
  readonly createId?: (prefix: string) => string;
  /** How far ahead to look for a slot every attendee is free in. Default four hours. */
  readonly meetingHorizonMs?: number;
  /**
   * The last census, so this tick can say who it is WAKING.
   *
   * Absent ⇒ nobody is reported as waking, which is correct for a first run: with no previous
   * state there is no transition, and reporting every working hat as "just woke" would make the
   * organisation look like it springs to life on every tick.
   */
  readonly previousPresence?: readonly HatPresence[];
}

export interface LifeTickReport {
  readonly idle: readonly IdleHat[];
  readonly donned: readonly string[];
  readonly doffed: readonly string[];
  readonly studied: readonly { readonly hatId: string; readonly subject: string; readonly wrote: boolean; readonly reason?: string }[];
  readonly memoriesWritten: number;
  readonly memoriesArchived: number;
  readonly memoriesStale: number;
  /** Where every hat is: working, in a room, studying, or asleep. */
  readonly presence: readonly HatPresence[];
  /** Hats that were asleep at the last census and are needed now. */
  readonly woke: readonly string[];
  /** Meetings that found a slot and are now on every attendee's calendar. */
  readonly met: readonly MeetingProposal[];
  /**
   * What each meeting produced.
   *
   * `produced: ""` is kept rather than filtered out. A meeting that made nothing is the finding a
   * meeting register exists to surface, and dropping those rows would leave only the successes.
   */
  readonly meetingOutcomes: readonly {
    readonly meetingId: string;
    readonly mustProduce: string;
    readonly produced: string;
    readonly reason?: string;
  }[];
  /**
   * Meetings the organisation WANTED and could not book, with why.
   *
   * Reported rather than dropped. A proposal that silently disappears when no common hour exists
   * is how a calendar comes to look healthy precisely when it is fullest — the condition still
   * holds, nobody is meeting about it, and nothing says so.
   */
  readonly unmet: readonly { readonly meetingId: string; readonly reason: string }[];
  /** The calendar after the bookings. Same object when nothing was booked. */
  readonly calendar: Calendar;
  /** Facts for the caller to note. Emitting is the caller's job; this stays pure about the log. */
  readonly facts: readonly OrgFact[];
}

/**
 * Run one tick.
 *
 * Returns FACTS rather than writing events, so the caller owns the log and this stays testable
 * without one. The memory store IS written, because a memory that exists only in a returned value
 * is not a memory.
 */
export async function lifeTick(input: LifeTickInput): Promise<LifeTickReport> {
  const facts: OrgFact[] = [];

  // ── 1. Who is idle ────────────────────────────────────────────────────────
  const idle = idleHats(input.chart, input.cascade, input.calendar, input.nowMs);

  // ── 2. Hats on and off ────────────────────────────────────────────────────
  const demand = hatDemand(input.cascade);
  const decisions = decideHats({
    demand,
    worn: input.worn,
    calendar: input.calendar,
    nowMs: input.nowMs,
  });
  const donned: string[] = [];
  const doffed: string[] = [];
  for (const d of decisions) {
    if (d.move === HatMove.Don) donned.push(d.hatId);
    else if (d.move === HatMove.Doff) doffed.push(d.hatId);
    else continue;
    facts.push({ kind: "hat_move", hatId: d.hatId, move: d.move, why: d.reason });
  }

  // ── 3. Self-directed time ─────────────────────────────────────────────────
  const proposals = proposeSelfDirected({
    idle,
    nowMs: input.nowMs,
    ...(input.cycle === undefined ? {} : { cycle: input.cycle }),
    ...(input.concurrency === undefined ? {} : { concurrency: input.concurrency }),
    ...(input.departmentOf === undefined ? {} : { departmentOf: input.departmentOf }),
    ...(input.topicFor === undefined ? {} : { topicFor: input.topicFor }),
    ...(input.mayStudy === undefined ? {} : { mayStudy: input.mayStudy }),
  });

  const studied: { hatId: string; subject: string; wrote: boolean; reason?: string }[] = [];
  let memoriesWritten = 0;

  // ── THE HOURS THIS TICK JUST SPOKE FOR ────────────────────────────────────
  // Held here so the meeting booking below sees them. `input.calendar` is the fold of PRIOR runs,
  // and a self-directed block only reaches a folded calendar on the NEXT run — so without this a
  // meeting could be booked straight over an hour this same tick had just given to a hat.
  //
  // The block id is the SAME formula `foldCalendar` derives for a `self_directed` fact. Two
  // different ids for one hour would make the calendar this tick reasons from disagree with the
  // one the next run folds, which is the quietest kind of wrong.
  const bookedThisTick: ScheduleBlock[] = [];

  for (const proposal of proposals) {
    facts.push({
      kind: "self_directed",
      hatId: proposal.hatId,
      selfDirectedKind: proposal.kind,
      subject: proposal.subject,
      startMs: proposal.startMs,
      endMs: proposal.endMs,
      producesKey: proposal.produces.key,
    });
    bookedThisTick.push({
      blockId: `free-${proposal.hatId}-${String(proposal.startMs)}`,
      hatId: proposal.hatId,
      // A STUDY HOUR IS STILL A BOOKED HOUR, but it must be RECOGNISABLE as study — the budget
      // reader tests `blockType === Reflection`, so flattening every self-directed hour to
      // `FreeTime` made study unmeasurable. Same id either way: the hour is one hour.
      blockType: isStudyKind(proposal.kind) ? STUDY_BLOCK_TYPE : ScheduleBlockType.FreeTime,
      startMs: proposal.startMs,
      endMs: proposal.endMs,
      state: ScheduleBlockState.Scheduled,
      workItemId: proposal.produces.key,
    });

    if (input.study === undefined || input.store === undefined) {
      // Said plainly. A block with no learner behind it produced nothing, and reporting otherwise
      // would make "the organization is learning" true by construction.
      studied.push({ hatId: proposal.hatId, subject: proposal.subject, wrote: false, reason: "nothing was configured to study" });
      continue;
    }

    let outcome: StudyOutcome;
    try {
      outcome = await input.study(proposal);
    } catch (error) {
      outcome = { ok: false, reason: error instanceof Error ? error.message : String(error) };
    }
    if (!outcome.ok) {
      studied.push({ hatId: proposal.hatId, subject: proposal.subject, wrote: false, reason: outcome.reason });
      continue;
    }

    const writeInput: WriteInput | undefined = memoryFromSelfDirected(proposal, outcome.found, input.nowMs);
    if (writeInput === undefined) {
      studied.push({ hatId: proposal.hatId, subject: proposal.subject, wrote: false, reason: "the block produced nothing to record" });
      continue;
    }

    const written = writeMemory(input.store, writeInput);
    if (written === undefined) {
      studied.push({ hatId: proposal.hatId, subject: proposal.subject, wrote: false, reason: "the write was refused" });
      continue;
    }
    facts.push(written.fact);
    memoriesWritten += 1;
    studied.push({ hatId: proposal.hatId, subject: proposal.subject, wrote: true });
  }

  // ── 4. Memory maintenance ─────────────────────────────────────────────────
  let memoriesArchived = 0;
  let memoriesStale = 0;
  if (input.store !== undefined) {
    const ctx = { nowMs: input.nowMs };
    for (const action of maintenancePass(input.store.load(), ctx)) {
      // AUTO ONLY. A promotion or a demotion is a hat's decision, and applying one here because a
      // number moved is exactly the authority-by-arithmetic this register refuses everywhere else.
      if (action.authority !== "auto") continue;
      const memory = input.store.load().find((m) => m.content.memoryId === action.memoryId);
      if (memory === undefined) continue;
      const applied = applyAction(memory, action, input.nowMs);
      if (!applied.ok) continue;
      input.store.save(applied.memory);
      facts.push({
        kind: "memory_phase",
        memoryId: action.memoryId,
        from: action.from,
        to: action.to,
        authority: action.authority,
        weight: action.weight,
        why: action.reason,
      });
      if (action.to === MemoryPhase.Archived) memoriesArchived += 1;
      if (action.to === MemoryPhase.Stale) memoriesStale += 1;
    }
  }

  // ── 5. Meetings ───────────────────────────────────────────────────────────
  // Last, on purpose, and fed the hours this tick just booked as well as the folded ones — so a
  // hat that took a study block a moment ago is not double-booked into a room at the same hour.
  let calendar: Calendar = { blocks: [...input.calendar.blocks, ...bookedThisTick] };
  const met: MeetingProposal[] = [];
  const unmet: { meetingId: string; reason: string }[] = [];
  const meetingOutcomes: LifeTickReport["meetingOutcomes"][number][] = [];
  if (input.meetings !== undefined && input.createId !== undefined) {
    const createId = input.createId;
    const horizon = input.meetingHorizonMs ?? 4 * 3_600_000;
    for (const proposal of proposeMeetings(input.meetings)) {
      const durationMs = proposal.endMs - proposal.startMs;
      const slot = firstCommonFreeSlot(
        calendar,
        proposal.attendeeHatIds,
        proposal.startMs,
        proposal.startMs + horizon,
        durationMs,
        durationMs,
      );
      if (slot === undefined) {
        unmet.push({ meetingId: proposal.meetingId, reason: "no hour every attendee is free in" });
        continue;
      }
      const blockIds = proposal.attendeeHatIds.map(() => createId("blk"));
      const booked = scheduleMeeting(calendar, {
        meetingId: proposal.meetingId,
        attendeeHatIds: proposal.attendeeHatIds,
        blockIds,
        startMs: slot,
        endMs: slot + durationMs,
        ...(proposal.subjectId === "" ? {} : { workItemId: proposal.subjectId }),
      });
      if (!booked.ok) {
        unmet.push({ meetingId: proposal.meetingId, reason: booked.reason });
        continue;
      }
      calendar = booked.calendar;
      const heldProposal: MeetingProposal = { ...proposal, startMs: slot, endMs: slot + durationMs };
      met.push(heldProposal);

      // ── AND THEN IT IS ACTUALLY HELD ──────────────────────────────────────
      // `mustProduce` was stated on every meeting and checked on none. Booking an hour is not the
      // achievement; this is the half that can come back empty, and an empty result is recorded
      // as one rather than dropped.
      let outcome: MeetingOutcome;
      if (input.hold === undefined) {
        outcome = { ok: false, reason: "nobody was configured to hold meetings" };
      } else {
        try {
          outcome = await input.hold(heldProposal);
        } catch (error) {
          outcome = { ok: false, reason: error instanceof Error ? error.message : String(error) };
        }
      }
      const produced = outcome.ok ? outcome.produced.trim() : "";
      meetingOutcomes.push({
        meetingId: proposal.meetingId,
        mustProduce: proposal.mustProduce,
        produced,
        // "We discussed it" is what an organisation says when nothing happened, so a meeting whose
        // output is blank is given the reason rather than a shrug.
        ...(produced === ""
          ? { reason: outcome.ok ? "the meeting produced nothing" : outcome.reason }
          : {}),
      });
      facts.push({
        kind: "meeting_held",
        meetingId: proposal.meetingId,
        attendeeHatIds: proposal.attendeeHatIds,
        atMs: slot,
        mustProduce: proposal.mustProduce,
        produced,
        ...(produced === ""
          ? { reason: outcome.ok ? "the meeting produced nothing" : outcome.reason }
          : {}),
      });
      facts.push({
        kind: "meeting_planned",
        meetingId: proposal.meetingId,
        blockIds,
        attendeeHatIds: proposal.attendeeHatIds,
        startMs: slot,
        endMs: slot + durationMs,
        workItemId: proposal.subjectId,
        reason: proposal.reason,
        about: proposal.about,
        mustProduce: proposal.mustProduce,
      });
    }
  }

  // ── 6. WHERE EVERYBODY IS ─────────────────────────────────────────────────
  // Taken AFTER the meetings, so a hat booked into a room this tick reads as in a meeting rather
  // than asleep. Computed over the WHOLE chart, because the number that matters is how many were
  // asleep while three worked, and a census of only the busy ones cannot say that.
  const inMeeting = calendar.blocks
    .filter(
      (b) =>
        b.blockType === ScheduleBlockType.Meeting &&
        b.startMs <= input.nowMs &&
        input.nowMs < b.endMs,
    )
    .map((b) => b.hatId);

  const presence = presenceOf({
    allHatIds: input.chart.hats.map((h) => h.id),
    demandedHatIds: demand.map((d) => d.hatId),
    studying: proposals.map((p) => ({ hatId: p.hatId, subject: p.subject })),
    inMeeting,
  });
  const woke = waking(input.previousPresence ?? [], demand.map((d) => d.hatId));

  facts.push({
    kind: "presence_census",
    atMs: input.nowMs,
    counts: presence.reduce<Record<string, number>>((acc, p) => {
      acc[p.presence] = (acc[p.presence] ?? 0) + 1;
      return acc;
    }, {}),
    waking: woke,
    hats: presence.map((p) => ({
      hatId: p.hatId,
      presence: p.presence,
      because: p.because,
      ...(p.subject === undefined ? {} : { subject: p.subject }),
    })),
  });

  return {
    idle,
    donned,
    doffed,
    studied,
    presence,
    woke,
    memoriesWritten,
    memoriesArchived,
    memoriesStale,
    met,
    unmet,
    meetingOutcomes,
    calendar,
    facts,
  };
}

/**
 * Write one memory to the store, reinforcing or conflicting with what is there.
 *
 * Returns `undefined` when the write was refused — a protected memory somebody tried to overwrite.
 * The refusal is the point, so it is not converted into a success with a different value.
 */
export function writeMemory(
  store: MemoryStore,
  input: WriteInput,
): { readonly memory: Memory; readonly fact: OrgFact } | undefined {
  const existing = store
    .load()
    .find((m) => m.content.tier === input.tier && m.content.scope === input.scope && m.content.key === input.key);
  const result = write(existing, input);
  if (!result.ok) return undefined;

  store.save(result.memory);
  // A repository per owner, created on first write. Without this the memory lands on disk with no
  // history, and "the agent owns its memory" would be a directory rather than a repository.
  initMemoryRepo(store.root, repoDirFor(result.memory), result.memory.content.writtenBy);
  store.commit(
    `${result.reinforced ? "reinforce" : result.conflicted ? "conflict" : "learn"}: ${input.key}`,
    repoDirFor(result.memory),
  );

  return {
    memory: result.memory,
    fact: {
      kind: "memory_written",
      memoryId: result.memory.content.memoryId,
      tier: result.memory.content.tier,
      scope: result.memory.content.scope,
      key: result.memory.content.key,
      writtenBy: input.writtenBy,
      outcome: result.reinforced ? "reinforced" : result.conflicted ? "conflicted" : "new",
      value: result.memory.content.value,
    },
  };
}

/** A one-line summary of a tick, for the run's own output. */
export function lifeSummary(report: LifeTickReport): string {
  const parts = [
    `${String(report.idle.length)} idle`,
    `${String(report.donned.length)} hat(s) on`,
    `${String(report.doffed.length)} off`,
    `${String(report.studied.filter((s) => s.wrote).length)}/${String(report.studied.length)} study block(s) produced a memory`,
  ];
  if (report.memoriesStale > 0) parts.push(`${String(report.memoriesStale)} went stale`);
  if (report.memoriesArchived > 0) parts.push(`${String(report.memoriesArchived)} forgotten`);
  parts.push(presenceSummary(report.presence));
  if (report.woke.length > 0) parts.push(`woke ${String(report.woke.length)}`);
  if (report.met.length > 0) {
    const produced = report.meetingOutcomes.filter((o) => o.produced !== "").length;
    // Both numbers, always. "3 meetings" alone is attendance; "3 meetings, 0 produced anything" is
    // the sentence somebody acts on.
    parts.push(`${String(report.met.length)} meeting(s), ${String(produced)} produced something`);
  }
  // Said even when nothing was booked, because an unbookable meeting is the interesting half.
  if (report.unmet.length > 0) parts.push(`${String(report.unmet.length)} could not be booked`);
  return parts.join(" · ");
}

/** Every event this tick's facts become. The caller supplies how an event is built. */
export function factsToEvents(
  facts: readonly OrgFact[],
  build: (fact: OrgFact, index: number) => OrgEvent,
): readonly OrgEvent[] {
  return facts.map(build);
}

/** What a hat is shown of its own memory, so a study block does not re-learn what it knows. */
export function knownBy(store: MemoryStore, hatId: string, nowMs: number): readonly string[] {
  return store
    .load()
    .filter((m) => m.content.scope === hatId && m.state.phase !== MemoryPhase.Archived)
    .sort((a, b) => weightOf(b, { nowMs }) - weightOf(a, { nowMs }))
    .slice(0, 12)
    .map((m) => m.content.value);
}
