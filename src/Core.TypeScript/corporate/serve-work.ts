/**
 * corporate/serve-work.ts — the routes a command centre needs: find work, load it, talk about it.
 *
 * ── WHAT THIS SERVER MAY AND MAY NOT DO ──────────────────────────────────────
 * The same boundary the rest of the server keeps, extended to two more queues:
 *
 *   READS  — Jira, through a read-only adapter. Nothing here POSTs to the tracker.
 *   WRITES — the intake inbox (a ticket somebody asked the organization to pick up) and the room
 *            store (a message somebody said). Both are QUEUES the run consumes.
 *
 * It still cannot change the cascade, a gate, or a binding. Loading a ticket is not the same act as
 * the organization accepting it: intake will still refuse a defect with no reproduction steps, and
 * that refusal is the correct outcome rather than a bug in this file.
 */

import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { isSafePathSegment } from "./safe-path-segment.ts";
import { join } from "node:path";

import { externalRefOf, type ExternalEvent } from "./intake";
import {
  fetchJiraIssue,
  issueToEvent,
  queryFor,
  readJiraCredentials,
  searchJira,
  STANDARD_QUERIES,
  type JiraIssue,
} from "./jira-source";
import {
  abandon,
  converge,
  openRoom,
  revise,
  say,
  SpeakerKind,
  awaitingAgent,
  awaitingPerson,
  latestRevision,
  type IterationRoom,
} from "./iteration-room";
import { appendRoomEvent, loadRoom, loadRooms, nextTurnId } from "./room-store";

export interface WorkRoutesConfig {
  /** Path to the Jira credentials JSON. Absent ⇒ the Jira routes report that they are unconfigured. */
  readonly jiraCredentialsPath?: string;
  /** Where a loaded ticket is written, for `directoryIntake` to pick up. */
  readonly inboxDir?: string;
  /** Where rooms live. */
  readonly roomsDir?: string;
  /** Who the UI signs as. Absent ⇒ it may read and may not write. */
  readonly operator?: string;
  /** Injected so a test decides the clock. */
  readonly now?: () => number;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

/** One megabyte: far above any real ticket, far below anything that hurts. */
const MAX_INBOX_BYTES = 1_048_576;

/**
 * REFUSE a key that cannot safely become a filename, rather than mangling it into one.
 *
 * This began as a `replace()` that rewrote unsafe characters to `-`. That stops the
 * traversal, but it is the weaker design in two ways. It SILENTLY ACCEPTS a key that is not
 * the key the tracker sent — two different tickets can mangle to the same filename and the
 * second quietly overwrites the first — and a rewrite carries no information back to the
 * caller, so a misconfigured source keeps posting keys that land somewhere unexpected and
 * nothing ever says so.
 *
 * Refusing says which key was rejected and why, and it cannot collide.
 *
 * It also closes `js/http-to-file-access` #937, and the reason is worth recording because it
 * is not obvious: CodeQL treats a regex TEST that gates a branch as a taint barrier
 * (`SanitizingRegExpTest`), while a `replace()` is only a barrier when it replaces with the
 * empty string — measured on CLI 2.27.0, `.replace(x, "")` is silent and `.replace(x, "-")`
 * is loud. So the mangling form could never have closed the alert no matter how strict it
 * was. The better design and the one the analyser can see are the same design here, which is
 * the outcome to prefer over any suppression.
 */
// Moved to `safe-path-segment.ts` when CodeQL found the same shape a second
// time, in `uat-three-criteria.ts`. Kept as a named alias so the call sites
// below still read in this file's own vocabulary.
const isSafeInboxKey = isSafePathSegment;

/** Which tickets this organization has already been asked to take. */
export function inboxKeys(inboxDir: string | undefined): readonly string[] {
  if (inboxDir === undefined) return [];
  // Undefined is a CONFIGURATION fact and stays a check; existence is a filesystem fact
  // and is decided by the read itself (CWE-367).
  let names: readonly string[];
  try {
    names = readdirSync(inboxDir);
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const entry of names) {
    // The filename carries the key so this needs no read: `jira-AIAGENT-1590.json`.
    const m = /^jira-(.+)\.json$/.exec(entry);
    if (m?.[1] !== undefined) out.push(m[1]);
  }
  return out.sort();
}

/**
 * A search result, annotated with what the organization already knows about it.
 *
 * `loaded` is why this shape exists rather than the raw issue: a list where you cannot tell what
 * you already asked for invites asking twice, and the second ask is refused as a duplicate — which
 * reads as an error rather than as "you already did this".
 */
export interface WorkRow {
  readonly issue: JiraIssue;
  readonly loaded: boolean;
  readonly requestKey: string;
}

export function annotate(issues: readonly JiraIssue[], loadedKeys: readonly string[]): readonly WorkRow[] {
  const loaded = new Set(loadedKeys);
  return issues.map((issue) => ({
    issue,
    loaded: loaded.has(issue.key),
    requestKey: externalRefOf("jira", issue.key),
  }));
}

/**
 * Handle a work-management or room route.
 *
 * Returns `undefined` when the path is not ours, so the caller falls through to its own routes.
 */
export async function workRoutes(
  path: string,
  request: Request,
  config: WorkRoutesConfig,
): Promise<Response | undefined> {
  const now = config.now ?? Date.now;

  // ── Jira: what work is out there ──────────────────────────────────────────
  if (path === "/api/work/queries") {
    return json({ queries: STANDARD_QUERIES, configured: config.jiraCredentialsPath !== undefined });
  }

  if (path === "/api/work/search") {
    if (config.jiraCredentialsPath === undefined) {
      return json({ ok: false, reason: "this server was started without --jira, so it can see no tracker" }, 400);
    }
    const credentials = readJiraCredentials(config.jiraCredentialsPath);
    if (!credentials.ok) return json({ ok: false, reason: credentials.reason }, 500);
    const url = new URL(request.url);
    const named = url.searchParams.get("query");
    // A NAMED query, or free text turned into JQL by `queryFor`. Raw JQL is deliberately not
    // accepted from the browser: the query would then be attacker-controlled against a real
    // tracker, and `text ~` searching is what a search box actually needs.
    const jql = named !== null ? (STANDARD_QUERIES[named] ?? queryFor("")) : queryFor(url.searchParams.get("q") ?? "");
    const found = await searchJira(credentials.credentials, jql, 30);
    if (!found.ok) return json({ ok: false, reason: found.reason }, 502);
    return json({ ok: true, jql, rows: annotate(found.value, inboxKeys(config.inboxDir)) });
  }

  /**
   * ── THE BOARD ─────────────────────────────────────────────────────────────
   * Everything at once: backlog, selected, in progress — as the TRACKER sees them — with a flag
   * saying which ones this organisation already has.
   *
   * Why a route rather than three searches from the browser: the three columns have to be a
   * snapshot of ONE moment. Fetched separately, a ticket that moves between two of them mid-fetch
   * appears in both columns or in neither, and a board that can show the same ticket twice is one
   * nobody can count from. One call, one instant, and a ticket lands in exactly one column.
   */
  if (path === "/api/work/board") {
    if (config.jiraCredentialsPath === undefined) {
      return json({ ok: false, reason: "this server was started without --jira, so it can see no tracker" }, 400);
    }
    const credentials = readJiraCredentials(config.jiraCredentialsPath);
    if (!credentials.ok) return json({ ok: false, reason: credentials.reason }, 500);

    const columns = [
      { key: "backlog", label: "Backlog", query: "assigned_backlog" },
      { key: "in_progress", label: "In progress", query: "assigned_in_progress" },
      { key: "open", label: "Assigned to me", query: "assigned_open" },
    ] as const;

    // In parallel, so the three reads are as close to one instant as a tracker allows. They are
    // still three requests — that is the honest limit of an API with no multi-query — and the
    // dedup below is what keeps a ticket that moved between them from appearing twice.
    const results = await Promise.all(
      columns.map(async (c) => ({
        column: c,
        found: await searchJira(credentials.credentials, STANDARD_QUERIES[c.query] ?? "", 50),
      })),
    );

    const failed = results.filter((r) => !r.found.ok);
    if (failed.length === results.length) {
      const first = failed[0]?.found;
      return json({ ok: false, reason: first !== undefined && !first.ok ? first.reason : "the tracker refused" }, 502);
    }

    const loaded = inboxKeys(config.inboxDir);
    const byKey = new Map<string, { column: string; issue: unknown; loaded: boolean }>();
    // FIRST COLUMN WINS, and the order above is deliberate: backlog, then in progress, then the
    // catch-all. `assigned_open` overlaps both of the others by construction, so without a
    // precedence every ticket would appear twice and the counts would be nonsense.
    for (const r of results) {
      if (!r.found.ok) continue;
      for (const row of annotate(r.found.value, loaded)) {
        if (byKey.has(row.issue.key)) continue;
        byKey.set(row.issue.key, { column: r.column.key, issue: row.issue, loaded: row.loaded });
      }
    }

    return json({
      ok: true,
      columns: columns.map((c) => ({
        key: c.key,
        label: c.label,
        // A column whose own query failed is reported as UNREAD rather than as empty: "nothing in
        // your backlog" and "we could not ask about your backlog" are different facts, and only
        // one of them means you can stop looking.
        unread: !(results.find((r) => r.column.key === c.key)?.found.ok ?? false),
        rows: [...byKey.values()].filter((v) => v.column === c.key).map((v) => ({ issue: v.issue, loaded: v.loaded })),
      })),
      loadedKeys: loaded,
      canLoad: config.operator !== undefined && config.inboxDir !== undefined,
    });
  }

  // ── Load a ticket into the organization's inbox ───────────────────────────
  if (path === "/api/work/load" && request.method === "POST") {
    if (config.operator === undefined) {
      return json({ ok: false, reason: "this server was started without --operator, so it may not put work in" }, 400);
    }
    if (config.jiraCredentialsPath === undefined || config.inboxDir === undefined) {
      return json({ ok: false, reason: "loading needs both --jira and --inbox" }, 400);
    }
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, reason: "body must be JSON" }, 400);
    }
    const key = typeof (body as { key?: unknown }).key === "string" ? (body as { key: string }).key.trim() : "";
    if (key === "") return json({ ok: false, reason: "which ticket? send { key }" }, 400);

    const credentials = readJiraCredentials(config.jiraCredentialsPath);
    if (!credentials.ok) return json({ ok: false, reason: credentials.reason }, 500);
    const issue = await fetchJiraIssue(credentials.credentials, key);
    if (!issue.ok) return json({ ok: false, reason: issue.reason }, 404);

    // VALIDATE FIRST, THEN BUILD FROM THE VALIDATED VALUE.
    //
    // The key arrives over HTTP and reaches two sinks: the FILENAME and the event's
    // `externalId`. It used to be tested after `issueToEvent` had already read it, so the
    // refusal guarded the filename while the event carried the unchecked value — and CodeQL
    // traced exactly that, `issueToEvent(issue.value) [externalId]` straight through
    // `JSON.stringify` to the write (`js/http-to-file-access` #937). The guard was real and
    // was standing in the wrong place.
    //
    // Same defect as the one diagnosed in `safe-io.ts`: a barrier has to be applied to the
    // value that CONTINUES, on the continuing branch. Testing a sibling expression, or the
    // same expression later, protects nothing downstream of the first read.
    const issueKey = issue.value.key;
    if (!isSafeInboxKey(issueKey)) {
      return json(
        { ok: false, reason: `refusing ticket key ${JSON.stringify(issueKey)}: not a single safe path segment` },
        400,
      );
    }

    // `externalId` is taken from the VALIDATED binding rather than re-read from the response,
    // so the value in the event is the value that passed the test — not merely one that
    // happens to equal it.
    const event: ExternalEvent = { ...issueToEvent(issue.value), externalId: issueKey };
    mkdirSync(config.inboxDir, { recursive: true });
    // Named by key, so loading the same ticket twice OVERWRITES rather than queueing it twice.
    // The organization's own duplicate refusal still applies on the second run; this just
    // stops the inbox filling with copies of one request. A key of `../../etc/whatever` would
    // write outside the inbox entirely, which is why the refusal above runs before anything
    // reads it.
    const file = join(config.inboxDir, `jira-${issueKey}.json`);
    const inboxBody = `${JSON.stringify(event, null, 2)}\n`;
    // BOUNDED. The ticket's title and body are remote text by nature — that is the feature,
    // and `js/http-to-file-access` #937 describes it accurately: writing an HTTP-delivered
    // ticket into the inbox is what this endpoint is FOR, so no guard closes that alert
    // without deleting the endpoint. What was genuinely missing is a ceiling: an unbounded
    // write driven by a remote value fills the disk of whoever runs the organisation, and a
    // tracker that has been misconfigured or compromised is exactly the source that would.
    // A megabyte is far above any real ticket and far below anything that hurts.
    if (inboxBody.length > MAX_INBOX_BYTES) {
      return json({ ok: false, reason: `refusing ticket ${issueKey}: ${String(inboxBody.length)} bytes exceeds the ${String(MAX_INBOX_BYTES)}-byte inbox ceiling` }, 413);
    }
    writeFileSync(file, inboxBody, "utf-8");
    return json({
      ok: true,
      loaded: issue.value.key,
      requestKey: externalRefOf("jira", issue.value.key),
      file,
      // Said plainly, because it is the next thing that happens and it may be a refusal.
      note: "the organization picks this up on its next run; intake may still refuse it",
      willLikelyRefuse:
        event.kind === "defect" && event.reproduction === undefined
          ? "this is a defect with no reproduction steps in its description — intake refuses those"
          : undefined,
    });
  }

  if (path === "/api/work/inbox") {
    return json({ keys: inboxKeys(config.inboxDir), configured: config.inboxDir !== undefined });
  }

  // ── Rooms ─────────────────────────────────────────────────────────────────
  if (path === "/api/rooms" && request.method === "GET") {
    if (config.roomsDir === undefined) return json({ rooms: [], configured: false });
    return json({ configured: true, rooms: loadRooms(config.roomsDir).map(roomJson) });
  }

  if (path === "/api/rooms" && request.method === "POST") {
    const guard = writeGuard(config);
    if (guard !== undefined) return guard;
    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return json({ ok: false, reason: "body must be JSON" }, 400);
    }
    const str = (k: string): string => (typeof body[k] === "string" ? (body[k] as string).trim() : "");
    const roomId = str("roomId") === "" ? `room-${String(now())}` : str("roomId");
    const opened = openRoom({
      roomId,
      workId: str("workId"),
      gate: str("gate"),
      documentPath: str("documentPath"),
      withHatId: str("withHatId"),
      openedBy: config.operator ?? "",
      atMs: now(),
      currentText: typeof body["currentText"] === "string" ? (body["currentText"] as string) : "",
      ...(str("opening") === "" ? {} : { opening: str("opening") }),
    });
    if (!opened.ok) return json({ ok: false, reason: opened.reason }, 400);

    const dir = config.roomsDir as string;
    appendRoomEvent(dir, {
      kind: "opened",
      roomId: opened.room.roomId,
      workId: opened.room.workId,
      gate: opened.room.gate,
      documentPath: opened.room.documentPath,
      withHatId: opened.room.withHatId,
      openedBy: opened.room.openedBy,
      atMs: opened.room.openedAtMs,
      baselineText: opened.room.revisions[0]?.text ?? "",
    });
    for (const turn of opened.room.turns) {
      appendRoomEvent(dir, {
        kind: "turn",
        roomId: opened.room.roomId,
        turnId: turn.turnId,
        speakerKind: turn.speaker.kind,
        speaker: turn.speaker.id,
        text: turn.text,
        atMs: turn.atMs,
      });
    }
    return json({ ok: true, room: roomJson(opened.room) });
  }

  const roomAction = /^\/api\/rooms\/([^/]+)\/(say|revise|converge|abandon)$/.exec(path);
  if (roomAction !== null && request.method === "POST") {
    const guard = writeGuard(config);
    if (guard !== undefined) return guard;
    const dir = config.roomsDir as string;
    const roomId = decodeURIComponent(roomAction[1] ?? "");
    const action = roomAction[2];
    const room = loadRoom(dir, roomId);
    if (room === undefined) return json({ ok: false, reason: `no room '${roomId}'` }, 404);

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return json({ ok: false, reason: "body must be JSON" }, 400);
    }
    const str = (k: string): string => (typeof body[k] === "string" ? (body[k] as string).trim() : "");
    const atMs = now();

    if (action === "say") {
      // A PERSON, always. The agent's turns are written by the run, which is the only party that
      // can honestly claim an agent said something.
      const said = say(room, { kind: SpeakerKind.Person, id: config.operator ?? "" }, str("text"), atMs);
      if (!said.ok) return json({ ok: false, reason: said.reason }, 400);
      const turn = said.room.turns[said.room.turns.length - 1];
      if (turn !== undefined) {
        appendRoomEvent(dir, {
          kind: "turn", roomId, turnId: turn.turnId, speakerKind: turn.speaker.kind,
          speaker: turn.speaker.id, text: turn.text, atMs: turn.atMs,
        });
      }
      return json({ ok: true, room: roomJson(said.room) });
    }

    if (action === "revise") {
      // Present so the RUN can post a revision through the same surface a person uses. It is
      // guarded by the operator check above, which is why this is not a public write path.
      const done = revise(room, {
        text: typeof body["text"] === "string" ? (body["text"] as string) : "",
        byHatId: str("byHatId") === "" ? room.withHatId : str("byHatId"),
        inResponseToTurnId: str("inResponseToTurnId"),
        atMs,
      });
      if (!done.ok) return json({ ok: false, reason: done.reason }, 400);
      const rev = latestRevision(done.room);
      const turn = done.room.turns[done.room.turns.length - 1];
      if (rev !== undefined) {
        appendRoomEvent(dir, {
          kind: "revision", roomId, revision: rev.revision, byHatId: rev.byHatId, text: rev.text,
          atMs: rev.atMs, ...(rev.inResponseToTurnId === undefined ? {} : { inResponseToTurnId: rev.inResponseToTurnId }),
        });
      }
      if (turn !== undefined) {
        appendRoomEvent(dir, {
          kind: "turn", roomId, turnId: turn.turnId, speakerKind: turn.speaker.kind,
          speaker: turn.speaker.id, text: turn.text, atMs: turn.atMs,
          ...(turn.producedRevision === undefined ? {} : { producedRevision: turn.producedRevision }),
        });
      }
      return json({ ok: true, room: roomJson(done.room) });
    }

    if (action === "converge") {
      const revision = typeof body["revision"] === "number" ? (body["revision"] as number) : Number.NaN;
      const done = converge(room, {
        byHuman: config.operator ?? "",
        revision,
        reason: str("reason"),
        atMs,
      });
      if (!done.ok) return json({ ok: false, reason: done.reason }, 400);
      appendRoomEvent(dir, {
        kind: "closed", roomId, state: "converged", byHuman: config.operator ?? "",
        reason: str("reason"), atMs, approvedRevision: revision,
      });
      return json({ ok: true, room: roomJson(done.room), approvedRevision: revision });
    }

    const done = abandon(room, { byHuman: config.operator ?? "", reason: str("reason"), atMs });
    if (!done.ok) return json({ ok: false, reason: done.reason }, 400);
    appendRoomEvent(dir, {
      kind: "closed", roomId, state: "abandoned", byHuman: config.operator ?? "", reason: str("reason"), atMs,
    });
    return json({ ok: true, room: roomJson(done.room) });
  }

  const roomGet = /^\/api\/rooms\/([^/]+)$/.exec(path);
  if (roomGet !== null && request.method === "GET") {
    if (config.roomsDir === undefined) return json({ ok: false, reason: "no --rooms" }, 400);
    const room = loadRoom(config.roomsDir, decodeURIComponent(roomGet[1] ?? ""));
    return room === undefined ? json({ ok: false, reason: "no such room" }, 404) : json({ ok: true, room: roomJson(room) });
  }

  return undefined;
}

function writeGuard(config: WorkRoutesConfig): Response | undefined {
  if (config.roomsDir === undefined) {
    return json({ ok: false, reason: "this server was started without --rooms, so there is nowhere to put a conversation" }, 400);
  }
  if (config.operator === undefined || config.operator.trim() === "") {
    // Same rule as an approval: a message needs somebody who said it. Signing as "the operator"
    // would satisfy the field and defeat what it is for.
    return json({ ok: false, reason: "this server was started without --operator, so it cannot say who is speaking" }, 400);
  }
  return undefined;
}

/** A room, plus the two derived facts a UI needs and should not compute itself. */
export function roomJson(room: IterationRoom): unknown {
  return {
    ...room,
    awaitingAgent: awaitingAgent(room),
    awaitingPerson: awaitingPerson(room),
    latestRevision: latestRevision(room)?.revision ?? 1,
  };
}

export { nextTurnId };
