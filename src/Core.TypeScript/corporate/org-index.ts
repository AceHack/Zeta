/**
 * corporate/org-index.ts — a derived index over the event log, so a question costs a lookup.
 *
 * ── THE PROBLEM, MEASURED ────────────────────────────────────────────────────
 * Every read of the history was a full walk: open every shard, parse every shard, then filter.
 * Against the real store, one shard per event:
 *
 *      1,000 events    99 ms
 *      5,000 events   777 ms
 *     20,000 events  2,873 ms
 *     60,000 events  9,994 ms
 *
 * ~0.17 ms per event, and the FILTER IS FREE — narrowing 60,000 records down to 150 costs about a
 * millisecond. All of the cost is opening files that were never going to match. One work item, one
 * run, writes ~219 shards, so 60,000 events is a small organization's first month or two, at which
 * point every dashboard refresh, every resume and every "what happened to this item" pays ten
 * seconds. `eventsBetween` fixed the time-ranged case by pruning `YYYY/MM/DD` directories. This
 * fixes the rest: "what happened to this work item", "what did this line of authority decide" —
 * questions with no time bound at all, which is most of them.
 *
 * ── NEVER THE SOURCE OF TRUTH, AND STRUCTURALLY SO ───────────────────────────
 * The shards are the facts. This is a cache of them and nothing else:
 *
 *   - it is DELETABLE at any moment, and the next call rebuilds it;
 *   - it is never written to except by reading shards;
 *   - nothing in the organization requires it to exist.
 *
 * That matters more here than it would elsewhere, because `org-store.ts` refuses to store a second
 * copy of the facts for exactly this reason — *"storing the cascade as a snapshot would put a
 * SECOND record of the same facts beside the events that produced them, and the two can
 * disagree"*. The distinction that makes this admissible is the VERSION IN THE FILENAME: a cache
 * keyed by the code that produced it cannot be read by code that would have produced something
 * else, so it cannot drift into disagreement — it can only be absent, and absent is rebuilt.
 *
 * ── AND THE FALSIFIER IS EQUALITY WITH THE THING IT REPLACES ─────────────────
 * A second way to answer a question fails by answering slightly differently. `org-index.test.ts`
 * asserts, over generated stores, that every indexed answer equals the full-scan answer — which is
 * the same round-trip discipline the cascade fold is held to, for the same reason.
 */

import { Database } from "bun:sqlite";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { shardFiles } from "../shard-store/shard-store";
import type { OrgEvent } from "./org-event";

/**
 * Bump when the SHAPE of what is stored changes.
 *
 * It lives in the FILENAME rather than in a row, so an older or newer build simply does not find
 * this file and builds its own. No migration, no version check that somebody forgets to write, and
 * no possibility of reading a cache that a different fold produced.
 */
export const INDEX_VERSION = 1;

export function indexPath(root: string): string {
  return join(root, "index", `events-v${String(INDEX_VERSION)}.sqlite`);
}

/** Where the events live under a store root — the same layout `org-store` writes. */
function eventsRoot(root: string): string {
  return join(root, "events");
}

export interface SyncResult {
  /** Shards read and inserted by this call. Zero on a warm index. */
  readonly added: number;
  /** Shards the index holds afterwards. */
  readonly total: number;
  /** Files that could not be parsed, and were left out. Same disposition as `readShards`. */
  readonly unreadable: readonly string[];
}

/**
 * One connection per store, kept open.
 *
 * ── WHY CACHED AND NOT OPENED PER CALL ───────────────────────────────────────
 * Opening a database to answer one question and closing it again pays the file open, the schema
 * statements and the page cache warm-up every single time, which is most of what a small lookup
 * costs. It also turned out to be the reason `dropIndex` failed on Windows: a rapid
 * open/close/open/close/remove sequence left the OS handle alive past `close()`, and the removal
 * hit EBUSY on a file this module had already finished with. One handle, closed deliberately, has
 * neither problem.
 *
 * The handles are closed by `dropIndex` and by `closeIndex`. A process that exits without calling
 * either loses nothing: the index is a cache, and an unclean shutdown costs a rebuild at worst.
 */
const OPEN = new Map<string, Database>();

function openDb(root: string): Database {
  const cached = OPEN.get(root);
  if (cached !== undefined) return cached;
  const at = indexPath(root);
  mkdirSync(join(at, ".."), { recursive: true });
  const db = new Database(at);
  // WAL so a reader does not block on a writer. The index is rebuildable, so durability here is
  // worth less than not stalling a dashboard behind a sync.
  db.run("pragma journal_mode = wal");
  db.run("pragma synchronous = normal");
  db.run(
    `create table if not exists events (
       shardPath   text primary key,
       eventId     text not null,
       atMs        integer not null,
       subjectId   text,
       actorHatId  text,
       kind        text,
       payload     text not null
     )`,
  );
  // The chain is a LIST, and a work item is asked about by any hat in it — so it is its own table
  // rather than a string somebody would end up matching with `like '%cto%'`, which would also
  // match `cto_office` and would be wrong in a way nobody notices until an audit disagrees.
  db.run(
    `create table if not exists supervised (
       shardPath text not null,
       hatId     text not null,
       primary key (shardPath, hatId)
     )`,
  );
  db.run("create index if not exists events_subject on events (subjectId)");
  db.run("create index if not exists events_at on events (atMs)");
  db.run("create index if not exists supervised_hat on supervised (hatId)");
  OPEN.set(root, db);
  return db;
}

/** Release this store's handle. Safe to call when none is open. */
export function closeIndex(root: string): void {
  const db = OPEN.get(root);
  if (db === undefined) return;
  OPEN.delete(root);
  try {
    db.close();
  } catch {
    // A handle that will not close is not worth failing a caller over — the cache is disposable,
    // and the next `openDb` makes a fresh one under a name this one no longer holds.
  }
}

/**
 * Bring the index level with the store, reading only shards it has not seen.
 *
 * ── WHY LISTING IS THE CHEAP HALF ────────────────────────────────────────────
 * Deciding what is new costs a `readdir` per directory; catching up costs one open and one parse
 * per NEW shard. So a warm index over a large store is a directory walk and nothing else, and the
 * steady-state cost of keeping it is proportional to what the organization just did rather than to
 * everything it has ever done.
 *
 * DELETION IS NOT DETECTED, and that is honest rather than lazy: shards are append-only and content
 * addressed, so a path that disappears is a store somebody edited by hand. Rebuilding is the answer
 * there — `dropIndex` then `syncIndex` — and pretending to handle it would mean paying to check
 * every known path on every call, forever, for a case that does not arise.
 */
export function syncIndex(root: string): SyncResult {
  const db = openDb(root);
  try {
    const known = new Set<string>(
      (db.query("select shardPath from events").all() as { shardPath: string }[]).map((r) => r.shardPath),
    );
    const files = shardFiles(eventsRoot(root));
    const unreadable: string[] = [];

    const insertEvent = db.prepare(
      "insert or replace into events (shardPath, eventId, atMs, subjectId, actorHatId, kind, payload) values (?, ?, ?, ?, ?, ?, ?)",
    );
    const insertChain = db.prepare("insert or replace into supervised (shardPath, hatId) values (?, ?)");

    let added = 0;
    // ONE TRANSACTION. Inserting 60,000 rows one autocommit at a time is a disk sync per row and
    // turns a two-second rebuild into minutes.
    const run = db.transaction((paths: readonly string[]) => {
      for (const path of paths) {
        let event: OrgEvent;
        try {
          event = JSON.parse(readFileSync(path, "utf-8")) as OrgEvent;
        } catch {
          unreadable.push(path);
          continue;
        }
        if (typeof event.atMs !== "number" || !Number.isFinite(event.atMs)) {
          unreadable.push(path);
          continue;
        }
        insertEvent.run(
          path,
          event.id ?? "",
          event.atMs,
          event.subjectId ?? null,
          event.actorHatId ?? null,
          event.kind ?? null,
          JSON.stringify(event),
        );
        for (const hat of event.supervisorChain ?? []) insertChain.run(path, hat);
        added += 1;
      }
    });
    run(files.filter((f) => !known.has(f)));

    // ── FINALIZED, ALWAYS ──────────────────────────────────────────────────
    // A prepared statement holds a reference to the connection, and on Windows an unfinalized one
    // keeps the FILE HANDLE alive past `db.close()` — so `dropIndex` fails with EBUSY on a database
    // this module had finished with. MEASURED: identical open/write/close sequences differ only in
    // whether `finalize()` was called, and only the one without it cannot be removed afterwards.
    insertEvent.finalize();
    insertChain.finalize();

    const total = (db.query("select count(*) as n from events").get() as { n: number }).n;
    return { added, total, unreadable };
  } catch (error) {
    // A cache that cannot be built must not take the caller down with it — every question this
    // module answers has a full-scan answer that does not need it.
    closeIndex(root);
    throw error;
  }
}

/** Throw the cache away. The next call rebuilds it; nothing is lost because nothing lives here. */
export function dropIndex(root: string): void {
  // CLOSED FIRST. Removing a file this process still holds open fails on Windows and succeeds
  // confusingly on Unix, where the handle survives the unlink and the next write goes to a file
  // with no name.
  closeIndex(root);
  const at = indexPath(root);
  for (const suffix of ["", "-wal", "-shm"]) {
    const f = `${at}${suffix}`;
    if (existsSync(f)) rmSync(f, { force: true });
  }
}

/** The same order `readEvents` returns: by instant, then by id, so a tie is not left to the disk. */
const ORDER = "order by atMs asc, eventId asc";

function query(root: string, sql: string, params: readonly unknown[]): readonly OrgEvent[] {
  syncIndex(root);
  const db = openDb(root);
  const rows = db.query(sql).all(...(params as never[])) as { payload: string }[];
  return rows.map((r) => JSON.parse(r.payload) as OrgEvent);
}

/** What happened to one work item, across runs. The indexed form of `eventsFor`. */
export function eventsForIndexed(root: string, subjectId: string): readonly OrgEvent[] {
  return query(root, `select payload from events where subjectId = ? ${ORDER}`, [subjectId]);
}

/** Everything a line of authority decided, across runs. The indexed form of `decidedUnder`. */
export function decidedUnderIndexed(root: string, hatId: string): readonly OrgEvent[] {
  return query(
    root,
    `select e.payload from events e join supervised s on s.shardPath = e.shardPath
     where s.hatId = ? ${ORDER.replace(/atMs/g, "e.atMs").replace(/eventId/g, "e.eventId")}`,
    [hatId],
  );
}

/** The history over an instant range. The indexed form of `eventsBetween`. */
export function eventsBetweenIndexed(root: string, window: { readonly fromMs?: number; readonly toMs?: number }): readonly OrgEvent[] {
  return query(
    root,
    `select payload from events where atMs >= ? and atMs <= ? ${ORDER}`,
    [window.fromMs ?? Number.MIN_SAFE_INTEGER, window.toMs ?? Number.MAX_SAFE_INTEGER],
  );
}

/** Every event the index holds, oldest first — the indexed form of `readEvents`. */
export function readEventsIndexed(root: string): readonly OrgEvent[] {
  return query(root, `select payload from events ${ORDER}`, []);
}
