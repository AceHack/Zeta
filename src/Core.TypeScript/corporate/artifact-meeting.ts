/**
 * artifact-meeting.ts — booking a colleague's free slot, and what the meeting is FOR.
 *
 * ── THE FLOW, END TO END ─────────────────────────────────────────────────────
 *   an agent finds a common free slot on the attendees' calendars
 *     -> the meeting is booked atomically across all of them
 *     -> it opens an ANCHOR that owes an output
 *     -> the artifact is passed back and forth as revisions on that anchor
 *     -> the anchor cannot resolve until it produced what it owed
 *
 * Each step already had its piece. `firstCommonFreeSlot` searches, `scheduleMeeting` books all-or-
 * nothing and names the attendee who was busy, `MeetingRequest` already carried an optional
 * `anchorId`, and `producedItsOutput` already refuses to resolve an anchor that owes a decision and
 * has none. What was missing is the composition — and it is a composition, not new machinery.
 *
 * ── A MEETING THAT OWES NOTHING IS A CALENDAR ENTRY ──────────────────────────
 * Convening REQUIRES an expected output. That is the discipline `discussion-anchor.ts` already
 * states — *"an anchor must produce what it promised"* — applied at the moment a meeting is booked
 * rather than at the moment someone tries to close it. Booking time on other people's calendars is
 * spending a resource this register meters everywhere else; spending it on a conversation with no
 * owed artifact is the one case worth refusing up front.
 *
 * ── AND THE ARTIFACT IS NAMED BEFORE ANYONE SPEAKS ───────────────────────────
 * The meeting carries the artifact id it convenes over, so every turn cites revisions of a document
 * that existed before the meeting did. A deliberation that discovers its subject as it goes cannot
 * produce a merge revision at the end, because there is no history to merge into.
 */

import {
  AnchorState,
  AnchorType,
  ExpectedOutput,
  openAnchor,
  postToAnchor,
  type AnchorBoard,
  type AnchorPost,
  type DiscussionAnchor,
} from "./discussion-anchor";
import {
  firstCommonFreeSlot,
  scheduleMeeting,
  type Calendar,
  type MeetingRequest,
} from "./work-schedule";
import type { ArtifactHistory, Revision } from "./artifact-deliberation";

/** Half an hour, stepped by five minutes. The default a caller may always override. */
export const DEFAULT_MEETING_MS = 30 * 60 * 1000;
export const DEFAULT_STEP_MS = 5 * 60 * 1000;

export interface ConveneInput {
  readonly meetingId: string;
  readonly anchorId: string;
  readonly calendar: Calendar;
  readonly board: AnchorBoard;
  /** Who is being pulled in. At least two — `scheduleMeeting` already refuses fewer. */
  readonly attendeeHatIds: readonly string[];
  readonly calledByHatId: string;
  /** The artifact this meeting is ABOUT. Named up front; see the header. */
  readonly artifactId: string;
  readonly title: string;
  readonly purpose: string;
  /** What the meeting owes. A meeting owing nothing is refused. */
  readonly expectedOutput: ExpectedOutput;
  /** The window to search for a common free slot. */
  readonly fromMs: number;
  readonly untilMs: number;
  readonly durationMs?: number;
  readonly stepMs?: number;
  readonly blockIds: readonly string[];
  readonly workItemId?: string;
}

export type ConveneResult =
  | {
      readonly ok: true;
      readonly calendar: Calendar;
      readonly board: AnchorBoard;
      readonly anchor: DiscussionAnchor;
      readonly startMs: number;
      readonly endMs: number;
    }
  | { readonly ok: false; readonly reason: string };

/**
 * Book a common free slot and open the deliberation it exists for.
 *
 * NOTHING IS WRITTEN UNLESS EVERYTHING IS. The calendar and the board are both returned as new
 * values and both come from a successful path — a meeting on the calendar with no anchor behind it
 * is a half-built deliberation that looks scheduled, which is the same partial-write failure
 * `scheduleMeeting` refuses across attendees, one layer up.
 */
export function conveneOverArtifact(input: ConveneInput): ConveneResult {
  if (input.expectedOutput === undefined) {
    return { ok: false, reason: `meeting '${input.meetingId}' owes no output; that is a calendar entry` };
  }
  if (input.artifactId.trim() === "") {
    return { ok: false, reason: `meeting '${input.meetingId}' names no artifact to deliberate over` };
  }
  if (input.blockIds.length !== input.attendeeHatIds.length) {
    return {
      ok: false,
      reason: `meeting '${input.meetingId}' needs one block id per attendee (${String(input.blockIds.length)} for ${String(input.attendeeHatIds.length)})`,
    };
  }

  const durationMs = input.durationMs ?? DEFAULT_MEETING_MS;
  const startMs = firstCommonFreeSlot(
    input.calendar,
    input.attendeeHatIds,
    input.fromMs,
    input.untilMs,
    durationMs,
    input.stepMs ?? DEFAULT_STEP_MS,
  );
  if (startMs === undefined) {
    // NAMED as a scheduling refusal. "No common slot" is actionable — the caller widens the window
    // or drops an attendee — and it is not the same as the meeting being illegal.
    return {
      ok: false,
      reason:
        `no common free slot for ${input.attendeeHatIds.join(", ")} ` +
        `between ${String(input.fromMs)} and ${String(input.untilMs)}`,
    };
  }
  const endMs = startMs + durationMs;

  const request: MeetingRequest = {
    meetingId: input.meetingId,
    attendeeHatIds: input.attendeeHatIds,
    startMs,
    endMs,
    blockIds: input.blockIds,
    anchorId: input.anchorId,
    ...(input.workItemId === undefined ? {} : { workItemId: input.workItemId }),
  };
  const booked = scheduleMeeting(input.calendar, request);
  if (!booked.ok) return { ok: false, reason: booked.reason };

  const anchor: DiscussionAnchor = {
    anchorId: input.anchorId,
    anchorType: AnchorType.Gate,
    title: input.title,
    purpose: input.purpose,
    expectedOutput: input.expectedOutput,
    // ONLY THE ATTENDEES MAY POST. An anchor anyone can write to is a chat box, which is the thing
    // `discussion-anchor.ts` exists to not be — and the people in the room are exactly the people
    // whose calendars were spent on it.
    participantHatIds: input.attendeeHatIds,
    openedByHatId: input.calledByHatId,
    openedAtMs: startMs,
    state: AnchorState.Open,
    ...(input.workItemId === undefined ? {} : { workItemId: input.workItemId }),
  };
  const opened = openAnchor(input.board, anchor);
  if (!opened.ok) return { ok: false, reason: opened.reason };

  return { ok: true, calendar: booked.calendar, board: opened.board, anchor, startMs, endMs };
}

export type TurnResult =
  | { readonly ok: true; readonly board: AnchorBoard; readonly post: AnchorPost }
  | { readonly ok: false; readonly reason: string };

/**
 * One turn: a hat says something, CITING the revision it is talking about.
 *
 * The revision is required and is checked against the artifact's history. That is the difference
 * between passing an artifact back and forth and talking about one: a turn citing a version nobody
 * can resolve is an opinion about an unspecified document, and the next reader cannot tell which
 * text it referred to.
 *
 * `postToAnchor` still does the participant and state checks — a non-attendee cannot speak here and
 * a resolved anchor cannot be reopened by posting to it — so this adds the artifact discipline
 * without weakening the board's own.
 */
export function takeTurn(
  board: AnchorBoard,
  history: ArtifactHistory,
  input: {
    readonly postId: string;
    readonly anchorId: string;
    readonly byHatId: string;
    readonly atMs: number;
    readonly body: string;
    readonly aboutRevisionId: string;
  },
): TurnResult {
  const cited = history.revisions.find((r) => r.revisionId === input.aboutRevisionId);
  if (cited === undefined) {
    return {
      ok: false,
      reason: `turn cites revision '${input.aboutRevisionId}', which is not in '${history.artifactId}'`,
    };
  }
  const post: AnchorPost = {
    postId: input.postId,
    anchorId: input.anchorId,
    byHatId: input.byHatId,
    atMs: input.atMs,
    body: input.body,
    // THE CITATION IS THE EVIDENCE. A turn's evidence is the exact version it addressed, so a
    // reader reconstructing the deliberation sees what each speaker was looking at rather than
    // what the document says now.
    // `document`, not a new `artifact` kind. `EvidenceRef` is a closed set and a revision of a
    // document IS a document; widening a deliberately closed enum to name the same thing more
    // specifically would trade a real constraint for a label.
    evidence: [{ kind: "document", ref: revisionRef(cited) }],
  };
  const posted = postToAnchor(board, post);
  if (!posted.ok) return { ok: false, reason: posted.reason };
  return { ok: true, board: posted.board, post };
}

/** The citable form of a revision: `artifact:<artifactId>@<revisionId>`. */
export function revisionRef(revision: Revision): string {
  return `artifact:${revision.artifactId}@${revision.revisionId}`;
}
