/**
 * corporate/event-stream.ts — watching the organization work, as it works.
 *
 * ── WHY THIS TAILS THE LOG AND DOES NOT OPEN A SECOND CHANNEL ────────────────
 * The obvious design is an in-memory bus the runtime publishes to and the socket subscribes to.
 * It is also wrong here. The append-only event log is already the organization's only account of
 * itself, and a second channel would be a second account — one that can lead the log (showing a
 * viewer something that then fails to persist), lag it, or drop events on a reconnect with nothing
 * saying so. Worse, the two would disagree only under load, which is when somebody is watching.
 *
 * So the stream is a TAIL of the log. Everything a viewer sees has already been written down, the
 * page and the dashboard cannot disagree, and a reconnect is a cursor rather than a gap.
 *
 * ── A CURSOR ALONE LOSES EVENTS, AND THAT WAS MEASURED ───────────────────────
 * The first version tracked one high-water mark `(atMs, id)`, on the assumption that a log grows
 * forward in time. It does not. A run's life tick emits at the RUN'S OWN INSTANT while the walk
 * advances a synthetic clock hours past it, so those events are appended late and timestamped
 * early — behind a mark that has already gone by.
 *
 * On a live run: 318 events on disk, 157 delivered, **161 silently dropped**, 202 of them written
 * after the newest-instant event and stamped earlier. The unit tests missed it because they only
 * ever appended in order; the run did not.
 *
 * So a position is the mark PLUS THE SET OF IDS ALREADY DELIVERED, and a tick sends anything not
 * in that set whatever its instant. The mark is kept because SSE's `id:` / `Last-Event-ID`
 * reconnect needs one scalar, and because it is what seeds the set after a reconnect.
 *
 * HONEST LIMIT, because a reconnect cannot carry a set: resuming from `Last-Event-ID` treats
 * everything at or before that instant as delivered. An event that arrived out of order WHILE THE
 * SOCKET WAS DOWN, stamped before the mark, is therefore missed by the stream. It is not lost from
 * the page — every derived number comes from the periodic full refetch of the fold, which reads
 * the whole log — but it will not appear in the live feed. Stated rather than papered over.
 *
 * ── A QUIET ORGANIZATION IS NOT A BROKEN ONE ─────────────────────────────────
 * Nothing happening is the normal state, and the stream has to say so out loud. A socket that
 * emits only on activity is indistinguishable from a socket that has died, so silence is reported
 * as silence on a heartbeat rather than left to the viewer to guess at.
 */

import type { OrgEvent } from "./org-event";

/** A high-water mark in the log's own order. `undefined` means "from the beginning". */
export interface StreamCursor {
  readonly atMs: number;
  readonly id: string;
}

/**
 * Everything one connection needs to know what it has NOT sent.
 *
 * The `delivered` set is what makes out-of-order appends safe; `mark` is what survives a reconnect.
 */
export interface StreamPosition {
  readonly mark: StreamCursor | undefined;
  readonly delivered: ReadonlySet<string>;
}

/**
 * The starting position for a connection resuming at `cursor`.
 *
 * Everything at or before the mark is treated as already sent. That is exactly right for a client
 * that really did receive them, and it is the residual gap named in the header for one that did
 * not — a reconnect cannot carry a set, so the mark is all there is to seed from.
 */
export function seedPosition(events: readonly OrgEvent[], cursor: StreamCursor | undefined): StreamPosition {
  const delivered = new Set<string>();
  if (cursor !== undefined) {
    for (const event of events) if (!isAfter(event, cursor)) delivered.add(event.id);
  }
  return { mark: cursor, delivered };
}

/** Whether `a` is later than `b` in the log's order. Used to keep the mark monotonic. */
function laterThan(a: StreamCursor, b: StreamCursor | undefined): boolean {
  if (b === undefined) return true;
  if (a.atMs !== b.atMs) return a.atMs > b.atMs;
  return a.id > b.id;
}

/** One frame the socket writes. */
export type StreamFrame =
  | { readonly kind: "event"; readonly event: OrgEvent; readonly cursor: StreamCursor }
  | {
      /**
       * Nothing has happened since the last frame.
       *
       * Carried as a real frame rather than as an absence, because a socket that emits only on
       * activity looks exactly like a socket that has died. The viewer needs to be able to tell
       * "the organization is quiet" from "this page stopped receiving".
       */
      readonly kind: "quiet";
      readonly atMs: number;
      readonly cursor: StreamCursor | undefined;
    };

/** Is `event` strictly after `cursor` in the log's order? */
export function isAfter(event: OrgEvent, cursor: StreamCursor | undefined): boolean {
  if (cursor === undefined) return true;
  if (event.atMs !== cursor.atMs) return event.atMs > cursor.atMs;
  return event.id > cursor.id;
}

export function cursorOf(event: OrgEvent): StreamCursor {
  return { atMs: event.atMs, id: event.id };
}

/**
 * Parse a cursor off the wire.
 *
 * REFUSES anything malformed rather than defaulting to "from the beginning". A viewer that
 * reconnects with a corrupt cursor and is silently rewound replays the whole log into the page and
 * looks, to the person watching, exactly like the organization suddenly redoing all its work.
 */
export function parseCursor(raw: string | null | undefined): StreamCursor | undefined | "invalid" {
  if (raw === null || raw === undefined || raw.trim() === "") return undefined;
  const at = raw.indexOf(":");
  if (at <= 0) return "invalid";
  const atMs = Number.parseInt(raw.slice(0, at), 10);
  const id = raw.slice(at + 1);
  if (!Number.isFinite(atMs) || id === "") return "invalid";
  return { atMs, id };
}

export function formatCursor(cursor: StreamCursor): string {
  return `${String(cursor.atMs)}:${cursor.id}`;
}

/**
 * What this connection has not sent yet, in the log's order, capped.
 *
 * Membership is by ID, not by position, which is the whole correction: an event appended late and
 * stamped early is undelivered and gets sent, where a mark comparison would step straight over it.
 *
 * The cap exists so a page joining a log with a hundred thousand events in it does not receive all
 * of them at once. It takes the OLDEST undelivered rather than the newest, so the feed advances
 * continuously — taking the newest would skip the middle and leave a hole nothing would fill.
 */
export function undelivered(
  events: readonly OrgEvent[],
  position: StreamPosition,
  limit = 200,
): readonly OrgEvent[] {
  const out: OrgEvent[] = [];
  // `readEvents` already returns the log's canonical order, and re-sorting here would let this
  // function disagree with the fold about what "next" means. Filtered in place instead.
  for (const event of events) {
    if (position.delivered.has(event.id)) continue;
    out.push(event);
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * The frames a poll produces, and the position afterwards.
 *
 * The position is RETURNED rather than mutated so the whole decision stays a pure function of
 * (log, position, clock) — which is what lets the out-of-order case above be tested at all.
 */
export function advance(
  events: readonly OrgEvent[],
  position: StreamPosition,
  nowMs: number,
  limit = 200,
): { readonly frames: readonly StreamFrame[]; readonly position: StreamPosition } {
  const fresh = undelivered(events, position, limit);
  if (fresh.length === 0) {
    return { frames: [{ kind: "quiet", atMs: nowMs, cursor: position.mark }], position };
  }

  const delivered = new Set(position.delivered);
  let mark = position.mark;
  const frames: StreamFrame[] = [];
  for (const event of fresh) {
    delivered.add(event.id);
    const at = cursorOf(event);
    // The mark only ever moves FORWARD. A late event stamped early is delivered but must not drag
    // the mark backwards, or a reconnect would re-send everything between.
    if (laterThan(at, mark)) mark = at;
    frames.push({ kind: "event", event, cursor: at });
  }
  return { frames, position: { mark, delivered } };
}

/**
 * One Server-Sent Events frame.
 *
 * `id:` is the cursor, so a browser's automatic reconnect sends `Last-Event-ID` and resumes
 * exactly where it stopped — the reconnect story is the cursor story, with no extra mechanism.
 *
 * Newlines inside the payload are the one thing that can corrupt the wire format: SSE terminates a
 * frame on a blank line, so a raw newline in the JSON would end the frame early and the rest would
 * be read as a new one. `JSON.stringify` escapes them, which is why the payload is always JSON and
 * never a bare string.
 */
export function sseFrame(frame: StreamFrame): string {
  const lines: string[] = [];
  if (frame.kind === "event") lines.push(`id: ${formatCursor(frame.cursor)}`);
  lines.push(`event: ${frame.kind}`);
  lines.push(`data: ${JSON.stringify(frame)}`);
  lines.push("");
  lines.push("");
  return lines.join("\n");
}
