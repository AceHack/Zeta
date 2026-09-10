/**
 * corporate/study-session.ts — study is a booked session with an end, not a background state.
 *
 * ── THE DEFECT ───────────────────────────────────────────────────────────────
 * `proposeSelfDirected` hands every idle hat a block each cycle and rotates the kind. Nothing
 * anywhere caps the TOTAL: a hat with an empty calendar is proposed study every cycle, forever, so
 * an organization with more hats than work spends its day reading. The complaint — *"studying
 * should not be all the time, there needs to be limits, they set a study sesh, they do it, that's
 * it"* — is that missing cap, exactly.
 *
 * ── THE BUDGET IS READ OFF THE CALENDAR, NEVER COUNTED ───────────────────────
 * Spend is derived by summing the study blocks already on the calendar inside the period. It is NOT
 * a running counter, and that is deliberate: a counter has to be reset, a reset that fires twice
 * hands back budget that was already spent, and a counter that resets on restart makes an agent's
 * study allowance a function of process uptime. The calendar is the record; asking it is the only
 * answer that survives a crash.
 *
 * ── A SESSION HAS AN END BEFORE IT BEGINS ────────────────────────────────────
 * `openStudySession` returns a block with a fixed `endMs` and there is no extend. A session that
 * could be lengthened while running is a background state wearing a session's name — the thing
 * being removed. When the budget is gone the answer is a REFUSAL that says so, never a shorter
 * session silently substituted, because "you have studied enough today" and "here is fifteen
 * minutes" are different facts and a caller acting on the second cannot tell it got the first.
 *
 * ── STUDY YIELDS TO ASSIGNED WORK, VIA `replanForWork` ───────────────────────
 * Booked study is the first thing given up when work arrives, and that is `org-life.replanForWork`'s
 * job rather than this module's — `Reflection`, the block type a session uses, is already in its
 * `YIELDS_TO_WORK` set. It MOVES the hour and reports the delay instead of cancelling it, so the
 * agent still gets its study and the cost of the interruption stays visible. See the note beside
 * `hatsWithStudyLeft` for why a second mechanism here was removed.
 */

import {
  ScheduleBlockState,
  ScheduleBlockType,
  blocksFor,
  intervalsOverlap,
  occupies,
  scheduleBlock,
  type Calendar,
  type ScheduleBlock,
} from "./work-schedule";

/**
 * Study is booked as `Reflection`.
 *
 * Not a new block type. `Reflection` already means self-directed time the organization did not
 * assign, which is what a study session is; adding a parallel type would leave every existing
 * reader of `Reflection` blind to half of it.
 */
export const STUDY_BLOCK_TYPE = ScheduleBlockType.Reflection;

export interface StudyBudget {
  /** The window the allowance applies to — a rolling day by default. */
  readonly periodMs: number;
  /** How much study time a hat may hold inside one period. */
  readonly perPeriodMs: number;
  /** The longest a single session may be. */
  readonly maxSessionMs: number;
  /**
   * The shortest session worth opening.
   *
   * A floor rather than a nicety: opening a room, recalling memory and reading a subject has a
   * fixed cost, and a five-minute session spends it to produce nothing. Below this the honest
   * answer is no session at all.
   */
  readonly minSessionMs: number;
}

const HOUR = 3_600_000;

/**
 * Two hours a day, in sessions of at most one.
 *
 * A DEFAULT, not a rule — an org that wants a research team sets its own. The shape is what
 * matters: an allowance strictly smaller than the period, so a hat with nothing to do runs out of
 * study before it runs out of day and its idleness becomes visible instead of looking like work.
 */
export const DEFAULT_STUDY_BUDGET: StudyBudget = {
  periodMs: 24 * HOUR,
  perPeriodMs: 2 * HOUR,
  maxSessionMs: HOUR,
  minSessionMs: 15 * 60_000,
};

/** Is this block a study session that still holds its slot? */
export function isStudyBlock(block: ScheduleBlock): boolean {
  return block.blockType === STUDY_BLOCK_TYPE && occupies(block.state);
}

/**
 * How much study this hat already holds in `[fromMs, untilMs)`.
 *
 * Overlapping blocks are CLIPPED to the window rather than counted whole, so a session straddling
 * the period boundary is charged only for the part inside it. Counting it whole would let a hat
 * lose budget to a period it barely touched.
 */
export function studySpentIn(
  calendar: Calendar,
  hatId: string,
  fromMs: number,
  untilMs: number,
): number {
  let spent = 0;
  for (const block of blocksFor(calendar, hatId)) {
    if (!isStudyBlock(block)) continue;
    if (!intervalsOverlap(block.startMs, block.endMs, fromMs, untilMs)) continue;
    spent += Math.min(block.endMs, untilMs) - Math.max(block.startMs, fromMs);
  }
  return spent;
}

/** What is left of this hat's allowance for the period ending at `nowMs`. */
export function remainingStudy(
  calendar: Calendar,
  hatId: string,
  nowMs: number,
  budget: StudyBudget = DEFAULT_STUDY_BUDGET,
): number {
  const spent = studySpentIn(calendar, hatId, nowMs - budget.periodMs, nowMs + budget.periodMs);
  return Math.max(0, budget.perPeriodMs - spent);
}

export interface StudySession {
  readonly block: ScheduleBlock;
  readonly hatId: string;
  /** What is being studied. A subject, never a command. */
  readonly topic: string;
  readonly startMs: number;
  readonly endMs: number;
  /** How much allowance is left after this session is booked. */
  readonly remainingAfterMs: number;
}

export type StudySessionResult =
  | { readonly ok: true; readonly calendar: Calendar; readonly session: StudySession }
  | { readonly ok: false; readonly because: string };

export interface OpenStudyInput {
  readonly calendar: Calendar;
  readonly hatId: string;
  readonly nowMs: number;
  /** What this session is for. Comes from the org's own sources — a repo, a space, a subsystem. */
  readonly topic: string;
  readonly createId: (prefix: string) => string;
  readonly budget?: StudyBudget;
  /** How long the hat wants. Clamped to what the budget and the session cap allow. */
  readonly requestedMs?: number;
}

/**
 * Book one study session, or refuse and say why.
 *
 * The length is the smallest of what was asked for, the per-session cap, and what is left of the
 * allowance — and if that lands under `minSessionMs` this REFUSES rather than booking a token
 * session. Both refusals name the budget, because "no time left today" is something an agent should
 * be able to report upward, not merely a `false`.
 */
export function openStudySession(input: OpenStudyInput): StudySessionResult {
  const budget = input.budget ?? DEFAULT_STUDY_BUDGET;

  if (input.topic.trim() === "") {
    return { ok: false, because: "a study session needs a subject; studying nothing produces nothing" };
  }

  const remaining = remainingStudy(input.calendar, input.hatId, input.nowMs, budget);
  if (remaining < budget.minSessionMs) {
    return {
      ok: false,
      because:
        `'${input.hatId}' has ${String(Math.round(remaining / 60_000))} min of study allowance left ` +
        `in this period, below the ${String(Math.round(budget.minSessionMs / 60_000))} min minimum`,
    };
  }

  const lengthMs = Math.min(input.requestedMs ?? budget.maxSessionMs, budget.maxSessionMs, remaining);
  if (lengthMs < budget.minSessionMs) {
    return {
      ok: false,
      because: `a ${String(Math.round(lengthMs / 60_000))} min session is below the minimum worth opening`,
    };
  }

  const block: ScheduleBlock = {
    blockId: input.createId("study"),
    hatId: input.hatId,
    blockType: STUDY_BLOCK_TYPE,
    startMs: input.nowMs,
    endMs: input.nowMs + lengthMs,
    state: ScheduleBlockState.Scheduled,
  };
  const booked = scheduleBlock(input.calendar, block);
  if (!booked.ok) return { ok: false, because: `could not book study: ${booked.reason}` };

  return {
    ok: true,
    calendar: booked.calendar,
    session: {
      block,
      hatId: input.hatId,
      topic: input.topic,
      startMs: block.startMs,
      endMs: block.endMs,
      remainingAfterMs: remaining - lengthMs,
    },
  };
}

/**
 * ── YIELDING TO WORK BELONGS TO `replanForWork`, NOT HERE ────────────────────
 * This module once carried a `releaseStudyFor` that CANCELLED study blocks overlapping incoming
 * work. `org-life.replanForWork` already does that job and does it better, and the two disagreed on
 * the point that matters: it MOVES the block and reports the delay, arguing — correctly — that
 * cancelling "would make the organisation look instantly available and quietly lose the reading".
 *
 * It is also already wired for this: `Reflection`, the block type a study session uses, is in its
 * `YIELDS_TO_WORK` set. So study already yields to work through it, and a second mechanism with the
 * opposite semantics would have meant a study hour was cancelled or postponed depending on which
 * caller happened to run — with the budget returning in one case and not the other.
 *
 * Removed rather than kept as an alias, because two names for one decision is how the disagreement
 * comes back.
 */

/**
 * Hats that have study allowance left right now.
 *
 * What a cadence pass asks before proposing anything, so a hat out of budget is never offered a
 * session it would be refused. Ordered by hat id, so the same state proposes the same way twice.
 */
export function hatsWithStudyLeft(
  calendar: Calendar,
  hatIds: readonly string[],
  nowMs: number,
  budget: StudyBudget = DEFAULT_STUDY_BUDGET,
): readonly { readonly hatId: string; readonly remainingMs: number }[] {
  return [...hatIds]
    .sort((a, b) => a.localeCompare(b))
    .map((hatId) => ({ hatId, remainingMs: remainingStudy(calendar, hatId, nowMs, budget) }))
    .filter((h) => h.remainingMs >= budget.minSessionMs);
}
