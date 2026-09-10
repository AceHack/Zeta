/**
 * corporate/meeting-demand.ts — the conditions that put an hour in the diary.
 *
 * ── WHY THIS IS A SEPARATE MODULE FROM `proposeMeetings` ─────────────────────
 * `proposeMeetings` decides what a meeting looks like given a condition. This decides whether the
 * condition HOLDS, and it is the half that can lie. Every field it produces is folded out of the
 * event log, the memory store, or the blocker outbox — never passed in by a caller who already
 * believes a meeting is needed. Split so the derivation can be falsified on its own: a test can
 * hand it a log with no rejections in it and require silence.
 *
 * ── THE FAILURE THIS IS BUILT AGAINST ────────────────────────────────────────
 * A standing meeting nobody can cancel. Everything here is CAUSED: when the rejections stop, when
 * the person answers, when the blocker is cleared, when the two memories are reconciled, the
 * condition stops being derivable and the meeting stops being proposed. Nothing recurs on a timer.
 */

import type { Cascade } from "./goal-cascade";
import type { RaisedBlocker } from "./human-blocker";
import type { Memory } from "./memory";
import { MemoryPhase } from "./memory";
import { proposeMeetings, type MeetingInput } from "./org-life";
import type { OrgChart } from "./org-chart";
import type { OrgEvent } from "./org-event";
import { foldGateEvaluations } from "./org-fold";
import { GateOutcome } from "./quality-gate";

/** A gate hold the organisation is still sitting on, as the view already computes it. */
export interface StillHeld {
  readonly workId: string;
  readonly gate: string;
}

export interface MeetingDemandInput {
  readonly events: readonly OrgEvent[];
  readonly cascade: Cascade;
  readonly chart: OrgChart;
  readonly nowMs: number;
  /**
   * Which holds are STILL open, from the same derivation the dashboard shows a person.
   *
   * Supplied rather than re-derived, because "is this gate still waiting" is a question about
   * answers that arrived through the action queue, and re-deriving it here from the log alone
   * would produce a second, quieter answer that could disagree with the one on the screen.
   */
  readonly stillHeld?: readonly StillHeld[];
  /** Blockers as the outbox holds them. */
  readonly blockers?: readonly RaisedBlocker[];
  /** Blocker ids a person has answered. Those are cleared, not met about. */
  readonly answeredBlockerIds?: readonly string[];
  /** The memory store's contents. Conflicts are found here, not asserted. */
  readonly memories?: readonly Memory[];
  readonly stalledAfterMs?: number;
  readonly durationMs?: number;
}

/** The manager a hat escalates to, or `undefined` at the top of the chart. */
function managerOf(chart: OrgChart, hatId: string): string | undefined {
  return chart.hats.find((h) => h.id === hatId)?.reportsTo;
}

/**
 * How many times a gate turned the same work away, and who was on each side.
 *
 * `ChangesRequested` counts alongside `Rejected` because the disagreement is the same one: the
 * author believed it was ready and the reviewer did not. Counting only hard rejections would miss
 * the case this exists for — the polite loop where a document goes round four times.
 */
function repeatedRejections(
  input: MeetingDemandInput,
): NonNullable<MeetingInput["repeatedRejections"]> {
  const byKey = new Map<string, { workId: string; gate: string; reviewerHatId: string; attempts: number }>();
  for (const e of foldGateEvaluations(input.events)) {
    if (e.outcome !== GateOutcome.Rejected && e.outcome !== GateOutcome.ChangesRequested) continue;
    const key = `${e.workId}|${String(e.gate)}`;
    const seen = byKey.get(key);
    byKey.set(key, {
      workId: e.workId,
      gate: String(e.gate),
      // The most recent reviewer, not the first. If a second reviewer took over, they are the one
      // who has to be in the room.
      reviewerHatId: e.byHatId,
      attempts: (seen?.attempts ?? 0) + 1,
    });
  }

  const out: { workId: string; gate: string; authorHatId: string; reviewerHatId: string; attempts: number }[] = [];
  for (const r of byKey.values()) {
    const node = input.cascade.nodes.find((n) => n.workId === r.workId);
    // The author is whoever the work is ASSIGNED to, falling back to its owner. Work nobody holds
    // has no author to put in a room, and inventing one would fill the meeting with a hat that
    // never wrote the document.
    const authorHatId = node?.assigneeHatId ?? node?.ownerHatId;
    if (authorHatId === undefined) continue;
    out.push({ workId: r.workId, gate: r.gate, authorHatId, reviewerHatId: r.reviewerHatId, attempts: r.attempts });
  }
  return out;
}

/**
 * When each still-open hold started.
 *
 * The log records the stop as a decision with `toState: "awaiting_human"`, once per run that hit
 * it. The EARLIEST of those is when the organisation actually stopped — using the latest would
 * restart the clock on every run and the hold could never age into a meeting, which is precisely
 * the check-that-cannot-fire shape.
 */
function heldForPeople(input: MeetingDemandInput): NonNullable<MeetingInput["heldForPeople"]> {
  const held = input.stillHeld ?? [];
  if (held.length === 0) return [];

  const earliest = new Map<string, number>();
  for (const event of input.events) {
    if (event.toState !== "awaiting_human") continue;
    const at = earliest.get(event.subjectId);
    if (at === undefined || event.atMs < at) earliest.set(event.subjectId, event.atMs);
  }

  const out: NonNullable<MeetingInput["heldForPeople"]>[number][] = [];
  for (const h of held) {
    const heldSinceMs = earliest.get(h.workId);
    // No recorded stop ⇒ no age ⇒ no meeting. Defaulting to `nowMs` would make every hold look
    // fresh; defaulting to zero would make every hold look ancient. Both are inventions.
    if (heldSinceMs === undefined) continue;
    const node = input.cascade.nodes.find((n) => n.workId === h.workId);
    const ownerHatId = node?.assigneeHatId ?? node?.ownerHatId;
    if (ownerHatId === undefined) continue;
    const escalateToHatId = managerOf(input.chart, ownerHatId);
    out.push({
      workId: h.workId,
      gate: h.gate,
      ownerHatId,
      heldSinceMs,
      ...(escalateToHatId === undefined ? {} : { escalateToHatId }),
    });
  }
  return out;
}

/** Blockers that left the organisation and have not come back. */
function unresolvedBlockers(input: MeetingDemandInput): NonNullable<MeetingInput["unresolvedBlockers"]> {
  const answered = new Set(input.answeredBlockerIds ?? []);
  const out: NonNullable<MeetingInput["unresolvedBlockers"]>[number][] = [];
  for (const b of input.blockers ?? []) {
    if (answered.has(b.blockerId)) continue;
    // Only the exhaustion that names hats can name attendees. `no_owner_in_org` says the room does
    // not contain the answer, so filling a room is the wrong response to it.
    const askedHatIds = b.exhaustion.kind === "owners_could_not_resolve" ? b.exhaustion.askedHatIds : [];
    if (askedHatIds.length === 0) continue;
    out.push({ blockerId: b.blockerId, about: b.about, raisedByHatId: b.byHatId, askedHatIds });
  }
  return out;
}

/**
 * Memories two writers disagree about, and who the two writers are.
 *
 * ── WHY THIS IS NOT A COMPARISON ACROSS SCOPES ───────────────────────────────
 * The first version of this compared values held at the same key by different scopes. A live run
 * booked eight meetings from it, and the meetings said what was wrong with it: hats disagreeing
 * about `the-part-of-this-repository-this-hat-touches` are not disagreeing at all — the scope is
 * part of the question, so two different answers are two correct answers. `memory.ts` is explicit
 * in the other direction: `crossScope.distinctScopes` is *"the promotion signal"*, so many scopes
 * observing one lesson is REINFORCEMENT. The detector was booking meetings about the system
 * working, which is the vacuity class with its sign flipped — a condition that fires when nothing
 * is wrong is as useless as one that never fires, and considerably more expensive.
 *
 * The genuine article already has a name. `write` sets `MemoryPhase.Conflicted` when a second
 * writer supplies a DIFFERENT value for the SAME (tier, scope, key) — one memory, two parties, an
 * actual disagreement. The value deliberately does not change on conflict, so the meeting is held
 * while the organisation still believes the older of the two things.
 *
 * The attendees come from the LOG rather than the memory, because a memory records who holds it
 * and not who contradicted it. Two distinct writers are required: a memory whose every write came
 * from one hat has nobody to put in the room, however conflicted it is.
 */
function memoryConflicts(input: MeetingDemandInput): NonNullable<MeetingInput["memoryConflicts"]> {
  const conflicted = new Map<string, string>(); // memoryId -> key
  for (const m of input.memories ?? []) {
    if (m.state.phase !== MemoryPhase.Conflicted) continue;
    conflicted.set(m.content.memoryId, m.content.key);
  }
  if (conflicted.size === 0) return [];

  const writers = new Map<string, Set<string>>(); // memoryId -> writers
  for (const event of input.events) {
    const fact = event.fact;
    if (fact?.kind !== "memory_written") continue;
    if (!conflicted.has(fact.memoryId)) continue;
    const seen = writers.get(fact.memoryId) ?? new Set<string>();
    seen.add(fact.writtenBy);
    writers.set(fact.memoryId, seen);
  }

  const out: NonNullable<MeetingInput["memoryConflicts"]>[number][] = [];
  for (const [memoryId, key] of conflicted) {
    const scopes = [...(writers.get(memoryId) ?? new Set<string>())].sort((a, b) => a.localeCompare(b));
    if (scopes.length < 2) continue;
    out.push({ key, scopes });
  }
  return out;
}

/**
 * Everything the organisation currently has a reason to meet about.
 *
 * Returns a `MeetingInput` rather than proposals, so the two halves stay separable and the shape
 * that reaches `proposeMeetings` is the same one a test can construct by hand.
 */
export function meetingDemand(input: MeetingDemandInput): MeetingInput {
  return {
    nowMs: input.nowMs,
    ...(input.durationMs === undefined ? {} : { durationMs: input.durationMs }),
    ...(input.stalledAfterMs === undefined ? {} : { stalledAfterMs: input.stalledAfterMs }),
    repeatedRejections: repeatedRejections(input),
    heldForPeople: heldForPeople(input),
    unresolvedBlockers: unresolvedBlockers(input),
    memoryConflicts: memoryConflicts(input),
  };
}

/** Whether anything at all would be proposed. Cheap enough to call before building a calendar. */
export function hasMeetingDemand(demand: MeetingInput): boolean {
  // ── ASKED OF `proposeMeetings` ITSELF, NEVER REIMPLEMENTED ────────────────
  // This used to return true whenever any condition list was non-empty, while `proposeMeetings`
  // applies real thresholds — a rejection must have happened at least TWICE to be a disagreement
  // rather than a bad day, and a hold must have stalled for a day to be worth an hour of two
  // people's time.
  //
  // So the two disagreed, and the permissive one is what gated the loop: a run with a single
  // rejection started the whole life cycle, spent its study blocks, and could never produce a
  // meeting. Measured as `0 in a meeting` on a run whose demand said true.
  //
  // One question, one answer: would a meeting actually be proposed?
  return proposeMeetings(demand).length > 0;
}
