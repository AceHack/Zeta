/**
 * corporate/org-store.ts — the organization's history, on disk.
 *
 * ── WHAT WAS IN MEMORY ───────────────────────────────────────────────────────
 * `runOrgRuntime` produced a cascade, a calendar, an anchor board, a queue and a typed event trace,
 * and every one of them was a value that died with the process. So the organization could be run
 * and could not be RESUMED, audited across runs, or asked what it did last week — and `org-event.ts`
 * exists precisely so those questions are answerable.
 *
 * ── THE TRACE IS ALREADY THE LOG ─────────────────────────────────────────────
 * Nothing new needed inventing. `OrgEvent` is already an append-only record of what happened, each
 * one carrying its own `atMs`, its subject, its actor and the supervisor chain that authorised it.
 * Persisting it is one shard per event — the convention in `shard-store.ts`, so the merge is set
 * union and two writers never contend for a path.
 *
 * ── WHY THE TRACE AND NOT THE CASCADE ────────────────────────────────────────
 * Storing the cascade, calendar and board as snapshots would put a SECOND record of the same facts
 * beside the events that produced them, and the two can disagree — the failure this register keeps
 * refusing everywhere else (a metric that disagrees with what it counts, a parent state that
 * disagrees with its leaves). The events are the facts; anything else is a fold over them, and a
 * fold cannot drift from its own input.
 *
 * The division of labour, and it is a boundary rather than a limit: this module STORES and READS;
 * `org-fold.ts` rebuilds. A full `Cascade` fold from events is not implemented HERE, and is not
 * missing — `foldOrganization` does it, and `run-agent.ts --resume` runs on the result.
 *
 * This paragraph read "not yet a resumable runtime… is the next step and is not claimed by this
 * module" until 2026-09-05, while `org-fold.ts` opened by QUOTING that exact sentence as the thing
 * it had closed. Two files, one claim, opposite tenses; the reader who believed the older one
 * would have built a second fold beside the working one.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { Category } from "../zeta-id/types";
import { readShards, shardZetaId, writeShard, type ShardWindow } from "../shard-store/shard-store";
import { toHex } from "../zeta-id/encoding";
import type { OrgEvent } from "./org-event";

/** A run's own summary, stored beside its events so a history has runs and not only moments. */
export interface RunRecord {
  /**
   * Whether this run touched anything real, and which ports did.
   *
   * OPTIONAL, and absence means **unknown** — never "simulated". Records written before this was
   * recorded carry no fidelity, and reading that silence as "nothing was real" would invent a fact
   * about history nobody observed. `deliveryRate` counts them in their own bucket for exactly that
   * reason.
   */
  readonly replayable?: boolean;
  readonly realPorts?: readonly string[];
  /**
   * MINTED FROM THE RUN'S OWN CONTENT, never supplied.
   *
   * The first cut let the caller pass one and the CLI passed `run-${nowMs}` — which is not a
   * unique id when `nowMs` is fixed, as it is in every deterministic run. Two genuinely different
   * runs then shared an identity and the second silently vanished from the history: the store
   * reported "0/1 delivered" after two runs, one of which had delivered.
   *
   * Content-derived instead, so distinct runs are distinct and identical runs collapse — which is
   * the idempotency the shard shape is for, rather than an accident of the clock.
   */
  readonly runId: string;
  readonly atMs: number;
  readonly delivered: boolean;
  readonly eventCount: number;
  /** The levels that actually decided something, as the run reported them. */
  readonly levelsEngaged: readonly string[];
  readonly refusals: readonly string[];
}

const EVENTS = "events";
const RUNS = "runs";

/**
 * Identity of a stored event: its CONTENT ADDRESS — the same one that chose its filename.
 *
 * ── WHAT THIS REPLACED, AND THE DATA LOSS IT CAUSED ──────────────────────────
 * This used to return `event.id`, reasoning that the runtime had already assigned an identity and
 * that re-deriving one would create a second notion of it. The intent was right: two copies of one
 * event — a re-run, a merged branch — must collapse to one.
 *
 * But the store ALREADY had a content notion: `shardPath` derives every filename from the record's
 * content. So there were two notions and they disagreed, and the disagreement lost data. Two
 * genuinely DIFFERENT events that share an id land at different paths — both written — and then
 * `readShards` drops one, because it de-duplicates on this function.
 *
 * Measured on `run-org.ts --store S` run twice with different flags, which mints the same ids every
 * invocation (`nowMs` is fixed and the counter restarts): **78 event files on disk, 58 returned.**
 * Twenty events written and unreadable, with nothing anywhere saying so.
 *
 * ── THE CONTENT ADDRESS SATISFIES THE ORIGINAL INTENT STRICTLY BETTER ────────
 *   - two byte-identical copies of one event  -> same address -> collapse, as before
 *   - two DIFFERENT events sharing an id      -> different addresses -> both survive
 *
 * And it removes the second notion rather than adding one: identity is now the filename, so "two
 * files" and "two events" are the same statement.
 *
 * It does NOT excuse a writer minting colliding ids — `run-agent.ts` scopes its ids to the run's
 * instant for exactly that reason — but a writer's mistake must not silently delete history.
 */
function identifyEvent(event: OrgEvent): string {
  return toHex(shardZetaId(event, event.atMs, Category.Workflow));
}

function identifyRun(run: RunRecord): string {
  return run.runId;
}

/** The run's identity: a pure function of what the run did. */
export function mintRunId(input: {
  readonly atMs: number;
  readonly delivered: boolean;
  readonly eventCount: number;
  readonly levelsEngaged: readonly string[];
  readonly refusals: readonly string[];
}): string {
  return toHex(shardZetaId(input, input.atMs, Category.Workflow));
}

/**
 * Write ONE event, as it happens.
 *
 * `appendRun` writes the whole trace at the end, which is correct for history and useless for
 * watching: nothing is observable until the run is over, and a run that crashes is observable
 * never. Each event is already its own shard, so appending one is the same operation as appending
 * a hundred — this only changes WHEN.
 *
 * `readEvents` orders by the event's own `atMs` with its id as the tie-break, never by filename, so
 * a partial log reads correctly while it is still being written. That is what makes a live view a
 * FOLD OVER THE LOG rather than a second copy of the state that can drift.
 */
export function appendEvent(event: OrgEvent, root: string): string {
  // The log just changed — and this process knows EXACTLY how, so it keeps the read it already has
  // instead of throwing it away. See `rememberAppended`.
  rememberAppended(event, root);
  return writeShard(
    { value: event, atMs: event.atMs, category: Category.Workflow, prefix: [EVENTS] },
    root,
  );
}

/**
 * Append a run: every event as its own shard, plus the run's summary.
 *
 * Idempotent at the record level — re-appending the same run writes the same bytes to the same
 * paths, so replaying a run is an upsert rather than a duplicated history.
 */
export function appendRun(
  input: {
    readonly atMs: number;
    readonly delivered: boolean;
    readonly levelsEngaged: readonly string[];
    readonly refusals: readonly string[];
    readonly trace: readonly OrgEvent[];
    /** The run's own `fidelity`. Omitted only by callers that genuinely have none. */
    readonly replayable?: boolean;
    readonly realPorts?: readonly string[];
  },
  root: string,
): { readonly runPath: string; readonly eventPaths: readonly string[] } {
  const eventPaths = input.trace.map((event) => {
    rememberAppended(event, root);
    return writeShard({ value: event, atMs: event.atMs, category: Category.Workflow, prefix: [EVENTS] }, root);
  });
  const summary = {
    atMs: input.atMs,
    delivered: input.delivered,
    eventCount: input.trace.length,
    levelsEngaged: [...input.levelsEngaged],
    refusals: [...input.refusals],
    // Spread rather than defaulted: a caller with no fidelity writes a record with no fidelity, and
    // `runId` is minted from this summary, so an absent field must stay absent rather than becoming
    // a `false` that both changes the id and asserts something nobody measured.
    ...(input.replayable === undefined ? {} : { replayable: input.replayable }),
    ...(input.realPorts === undefined ? {} : { realPorts: [...input.realPorts] }),
  };
  const run: RunRecord = { runId: mintRunId(summary), ...summary };
  const runPath = writeShard(
    { value: run, atMs: input.atMs, category: Category.Workflow, prefix: [RUNS] },
    root,
  );
  // THE RUN IS OVER, SO COLLAPSE WHAT IT LEAVES BEHIND. Built from this process's own cached read,
  // so it costs a serialize rather than the 112-176s cold read it saves every process that comes
  // after. See `writeEventsSnapshot`.
  writeEventsSnapshot(root);
  return { runPath, eventPaths };
}

/**
 * THE LAST FULL READ, SO ONE PROCESS DOES NOT DO IT TWENTY-TWO TIMES.
 *
 * MEASURED on the agentic-team store, 2026-09-12: 17,169 event files, 64MB - and `run-org.ts`
 * alone calls `readEvents` twenty-two times, four of them behind `get` accessors that re-read on
 * EVERY property access. Each call reads every shard, parses it and sorts the lot. The fold is
 * cheap; doing it from disk over and over is what makes a cold start minutes rather than seconds.
 *
 * ── WHY THIS IS SAFE, AND WHERE IT IS NOT ────────────────────────────────────
 * Every write in this process goes through `appendEvent` or `appendRun`, and both drop the cache -
 * so a run that appends and then re-reads sees its own writes, which is what the accessors are for.
 * What the cache CANNOT see is another process appending: `watch-org` reads a store that `run-org`
 * writes. Those readers call `forgetEvents` when they start a tick, and that is the whole contract.
 * A windowed read is never cached - it is a different question with a different answer.
 */
let lastRead: { readonly root: string; events: OrgEvent[]; readonly ids: Set<string> } | undefined;

/**
 * Forget the cached read. A long-lived reader calls this whenever ANOTHER process may have written
 * since it last looked - which for a watcher is every tick.
 */
export function forgetEvents(): void {
  lastRead = undefined;
}

/**
 * Keep the cached read CURRENT across this process's own append, instead of dropping it.
 *
 * ── THE DEFECT THIS CLOSES, MEASURED ─────────────────────────────────────────
 * `appendEvent` used to call `forgetEvents()`: the log changed, so the read was stale. True, and
 * ruinous — because the very next read re-opened, re-parsed and re-sorted EVERY shard in the store
 * to learn one thing this process already knew. MEASURED on the FlowDent store, 31,963 events:
 * a cold full read takes 112 SECONDS, and a warm one (OS cache hot, cache dropped) still takes 4.
 *
 * And a run interleaves them constantly: `run-org` holds ~22 `readEvents` call sites, four behind
 * getters that re-read on every property access, and the runtime appends an event for every gate
 * verdict, schedule block, supervisor signal and anchor it records — 85% of that store's 32k events
 * are exactly that bookkeeping. Write, drop, read 4s, write, drop, read 4s. The cost grows with the
 * store, so the same organization gets slower every hour it runs: hours of a ten-hour FlowDent run
 * went to re-reading what was already in memory.
 *
 * ── WHY THIS IS SAFE ─────────────────────────────────────────────────────────
 * An append is the one change whose exact content the writer holds. Adding it to the cached array
 * yields precisely what re-reading would have produced, with two cases handled explicitly:
 *
 *   IDEMPOTENCE. `appendRun` is documented as an upsert — the same event re-appended writes the
 *   same bytes to the same path, so the STORE dedupes by path and a naive `push` would leave the
 *   cache holding a duplicate the store does not have. Ids are tracked in a Set and a re-append is
 *   ignored, which is what re-reading the store would show.
 *
 *   ORDER. `readEvents` sorts by `compareEvents` (instant, then minted id). Events almost always
 *   arrive in that order, so the common path is a push after one comparison; anything out of order
 *   is binary-searched into place. Either way the array holds what a re-read would.
 *
 * What this does NOT cover is unchanged: ANOTHER process appending. That was never visible to a
 * cached read and still is not — `forgetEvents` remains the contract for readers who need to see
 * writes they did not make (see its own comment).
 */
function rememberAppended(event: OrgEvent, root: string): void {
  // A cache for a DIFFERENT store tells us nothing about this one — and this write cannot have
  // invalidated it, so dropping is the conservative, correct move rather than merging into it.
  if (lastRead === undefined) return;
  if (lastRead.root !== root) {
    lastRead = undefined;
    return;
  }
  // IDENTITY IS THE CONTENT ADDRESS, not `event.id` — the same rule `identifyEvent` states and
  // `readShards` de-duplicates by. Two DIFFERENT events may share an id (a re-run mints the same
  // counter), they land at different paths, and both are genuinely in the log; keying this cache on
  // `event.id` dropped the second one and made the cache disagree with the disk. Caught by
  // "what the reader returns matches what is ON DISK".
  const address = identifyEvent(event);
  if (lastRead.ids.has(address)) return;
  lastRead.ids.add(address);
  const events = lastRead.events;
  const last = events[events.length - 1];
  if (last === undefined || compareEvents(last, event) <= 0) {
    events.push(event);
    return;
  }
  // Out of order (a backdated verdict, say): find where a re-read would have put it.
  let lo = 0;
  let hi = events.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (compareEvents(events[mid] as OrgEvent, event) <= 0) lo = mid + 1;
    else hi = mid;
  }
  events.splice(lo, 0, event);
}

/** Where a store keeps the one file that saves it from opening thirty thousand. */
const SNAPSHOT = "events-snapshot.json";

/**
 * How far back a snapshot re-reads shards it already contains.
 *
 * The window prunes whole `YYYY/MM/DD` directories, and the log's instants are the organization's
 * LOGICAL clock — which is monotonic in practice but nothing enforces it, and an event backdated
 * before the boundary would sit in a pruned directory and vanish from every read. A week of
 * overlap costs a few extra directories and makes that class of loss require the clock to jump
 * backwards by more than a week. Anything the overlap re-reads is deduplicated by id, so the
 * margin can only cost time, never correctness.
 */
const SNAPSHOT_OVERLAP_MS = 7 * 86_400_000;

interface EventsSnapshot {
  readonly version: 1;
  readonly throughAtMs: number;
  readonly throughId: string;
  readonly events: readonly OrgEvent[];
}

/**
 * Collapse every shard read so far into ONE file, so the next cold read opens one instead of tens
 * of thousands.
 *
 * ── THE DEFECT THIS CLOSES, MEASURED ─────────────────────────────────────────
 * The store keeps one file per event. On the FlowDent store that is 30 MB spread across 31,977
 * files, and a cold read takes 112-176 SECONDS — essentially all of it per-file open and parse
 * overhead, not data. 30 MB read as a single file is milliseconds. Every fresh process paid it:
 * each `ocli` invocation, each `run-org` start, each watcher tick that forgot its cache.
 *
 * Written at the end of a run, from the read this process already has cached, so producing it
 * costs a serialize rather than a re-read. NOTHING about writing events changes — the shards are
 * still the log, still append-only, still one file per event, and still the thing a snapshot is
 * rebuilt FROM. This is a cache with a boundary, not a new storage format: delete the file and the
 * store reads exactly as it did before, just slowly.
 */
export function writeEventsSnapshot(root: string): void {
  try {
    const events = readEvents(root);
    const last = events[events.length - 1];
    if (last === undefined) return;
    const snapshot: EventsSnapshot = {
      version: 1,
      throughAtMs: last.atMs,
      throughId: last.id,
      events,
    };
    // Written beside the shards, never inside `events/` — `readShards` walks that tree and would
    // try to parse this as one more event.
    writeFileSync(`${root}/${SNAPSHOT}`, JSON.stringify(snapshot), "utf-8");
  } catch {
    // A snapshot that cannot be written is a slow next read, never a wrong one. The shards are
    // still the truth and still complete.
  }
}

/**
 * Every event in the log: the snapshot plus whatever has been appended since, or all the shards
 * when there is no snapshot.
 *
 * The tail is read with a WINDOW, which is the whole point — `readShards` prunes by `YYYY/MM/DD`
 * directory, so a snapshot taken at the tip means the next cold read opens the snapshot and the
 * last week of directories instead of every directory there has ever been.
 *
 * Deduplicated by id, because the overlap window deliberately re-reads shards the snapshot already
 * holds. A shard and its snapshot copy are the same record written twice, so either may win.
 */
function readWholeLog(root: string): OrgEvent[] {
  const snapshot = loadSnapshot(root);
  if (snapshot === undefined) {
    return [...readShards<OrgEvent>(`${root}/${EVENTS}`, identifyEvent)].sort(compareEvents);
  }
  const boundary = { atMs: snapshot.throughAtMs, id: snapshot.throughId } as OrgEvent;
  const tail = readShards<OrgEvent>(`${root}/${EVENTS}`, identifyEvent, {
    fromMs: snapshot.throughAtMs - SNAPSHOT_OVERLAP_MS,
  });
  // Keyed by CONTENT ADDRESS, the store's own identity — see `identifyEvent`. Two different
  // events may share an `id`, and de-duplicating on that would drop one that is really on disk.
  const ids = new Set(snapshot.events.map(identifyEvent));
  const out = [...snapshot.events];
  for (const e of tail) {
    // Strictly after the boundary, in the log's own order — an event at the exact boundary IS the
    // boundary, and the address check below catches it anyway.
    if (compareEvents(e, boundary) <= 0) continue;
    const address = identifyEvent(e);
    if (ids.has(address)) continue;
    ids.add(address);
    out.push(e);
  }
  return out.sort(compareEvents);
}

/** The snapshot, if there is a usable one. Anything doubtful reads as "no snapshot". */
function loadSnapshot(root: string): EventsSnapshot | undefined {
  try {
    const raw = readFileSync(`${root}/${SNAPSHOT}`, "utf-8");
    const parsed = JSON.parse(raw) as EventsSnapshot;
    if (parsed.version !== 1 || !Array.isArray(parsed.events)) return undefined;
    if (typeof parsed.throughAtMs !== "number" || typeof parsed.throughId !== "string") return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}

/**
 * Every event ever stored, in the order they happened.
 *
 * Ordered by the event's own `atMs`, with its id as the tie-break — never by filename, which is an
 * artefact of the store rather than of the organization.
 */
export function readEvents(root: string, window?: ShardWindow): readonly OrgEvent[] {
  // A window asks a narrower question; caching it under the same key would answer the wide one.
  if (window !== undefined) {
    return [...readShards<OrgEvent>(`${root}/${EVENTS}`, identifyEvent, window)].sort(compareEvents);
  }
  // A COPY, never the cached array itself: `rememberAppended` now mutates that array in place, and
  // a caller holding the live one could see it grow underneath — worst case, appending while
  // iterating what it just read. The copy is ~0.1ms against the 4,000ms re-read it replaces.
  if (lastRead !== undefined && lastRead.root === root) return [...lastRead.events];
  const events = readWholeLog(root);
  // The id index is what lets `rememberAppended` keep this array current without a re-read, and it
  // is built ONCE here rather than per append — see that function for why an append must dedupe.
  // The cache keeps its OWN array for the same reason the hit path copies: what an append mutates
  // must never be an array a caller is already holding.
  lastRead = { root, events: [...events], ids: new Set(events.map(identifyEvent)) };
  return events;
}

/**
 * The log's order: by instant, then by id AS MINTED.
 *
 * ── THE TIE-BREAK WAS A STRING COMPARE, AND IDS ARE COUNTERS ─────────────────
 * `createId` pads to three digits, so `evt-999` < `evt-1000` as numbers and `evt-1000` < `evt-999`
 * as strings. Every instant with more than 999 minted ids behind it folded its events out of order
 * — a transition before the item it moves. Digit runs compare as numbers here, everything else
 * ordinally, so the tie-break is the order the counter produced.
 */
export function compareEvents(a: OrgEvent, b: OrgEvent): number {
  if (a.atMs !== b.atMs) return a.atMs - b.atMs;
  return compareMintedIds(a.id, b.id);
}

/** Two ids in minting order: digit runs numerically, the rest ordinally. Culture-invariant. */
export function compareMintedIds(a: string, b: string): number {
  if (a === b) return 0;
  const chunks = (s: string): readonly string[] => s.match(/\d+|\D+/g) ?? [];
  const ca = chunks(a);
  const cb = chunks(b);
  for (let i = 0; i < Math.min(ca.length, cb.length); i += 1) {
    const x = ca[i] ?? "";
    const y = cb[i] ?? "";
    if (x === y) continue;
    const digits = /^\d/;
    if (digits.test(x) && digits.test(y)) {
      // By magnitude without parsing, so an id longer than a double's precision still orders.
      const nx = x.replace(/^0+(?=\d)/, "");
      const ny = y.replace(/^0+(?=\d)/, "");
      if (nx.length !== ny.length) return nx.length - ny.length;
      if (nx !== ny) return nx < ny ? -1 : 1;
      // Same number, different padding: fall through to the ordinal compare so the order is total.
    }
    return x < y ? -1 : 1;
  }
  return ca.length - cb.length;
}

/**
 * Where the log ends: its latest instant, and the highest counter any id in it was minted with.
 *
 * ── WHY A RESUMED RUN NEEDS THIS ─────────────────────────────────────────────
 * `run-org` starts its clock at epoch 0 and its id counter at 1 in every process. Against a store
 * that already holds a run, the second run's events then land at the SAME instants as the first's
 * and are ordered against them by an id that means nothing across processes. MEASURED on the Agentic
 * Team's first real run: a resumed run assigned three tickets' leaves, the fold sorted each
 * `work_assigned` (the new run's `evt-021`) before the `work_created` it applies to (the old run's
 * `evt-033`), dropped it for naming an item that did not exist yet — and the next resume saw those
 * leaves unstaffed again.
 *
 * A writer that starts after this point appends to the history instead of interleaving with it.
 * The counter is read off every string in the log shaped like a minted id, so it needs no list of
 * prefixes; reading one that was not minted can only make the next id larger, never collide.
 */
export function logHighWater(events: readonly OrgEvent[]): { readonly atMs: number | undefined; readonly counter: number } {
  let atMs: number | undefined;
  let counter = 0;
  const minted = /^[a-z][a-z0-9_]*(?:-[a-z][a-z0-9_]*)*-(\d+)$/;
  const visit = (v: unknown): void => {
    if (typeof v === "string") {
      const m = minted.exec(v);
      if (m?.[1] !== undefined) counter = Math.max(counter, Number.parseInt(m[1], 10));
    } else if (Array.isArray(v)) {
      for (const x of v) visit(x);
    } else if (v !== null && typeof v === "object") {
      for (const x of Object.values(v)) visit(x);
    }
  };
  for (const e of events) {
    atMs = atMs === undefined ? e.atMs : Math.max(atMs, e.atMs);
    visit(e);
  }
  return { atMs, counter };
}

/**
 * The history over an instant range, oldest first.
 *
 * ── WHY THIS EXISTS ──────────────────────────────────────────────────────────
 * Every read here was a full walk of the store: open every shard, parse every shard, then filter.
 * MEASURED against the real `shard-store`, one record per event:
 *
 *      1,000 events    99 ms
 *      5,000 events   777 ms
 *     20,000 events  2,873 ms
 *     60,000 events  9,994 ms
 *
 * — roughly 0.17 ms per event, and the FILTER IS FREE: narrowing 60,000 records to 150 costs about
 * a millisecond. All of the cost is opening files that were never going to match. One work item,
 * one run, writes ~219 shards, so 60,000 events is a small organization's first month or two, at
 * which point every dashboard refresh and every resume pays ten seconds.
 *
 * Shards are already stored under `YYYY/MM/DD` and nothing was using it. This is that, used.
 *
 * ── IT NARROWS BY WHERE THE SHARD IS, THEN BY WHAT IT SAYS ───────────────────
 * The directory names come from the instant a record was written under, and `OrgEvent.atMs` is that
 * instant — so the two agree today. The predicate is applied anyway rather than trusted from the
 * path, because a store written by a future writer that shards on something else would otherwise
 * return records outside the range the caller asked for, and silently.
 */
export function eventsBetween(root: string, window: ShardWindow): readonly OrgEvent[] {
  return readEvents(root, window).filter(
    (e) =>
      (window.fromMs === undefined || e.atMs >= window.fromMs) &&
      (window.toMs === undefined || e.atMs <= window.toMs),
  );
}

/** Every run, oldest first. */
export function readRuns(root: string): readonly RunRecord[] {
  const runs = readShards<RunRecord>(`${root}/${RUNS}`, identifyRun);
  return [...runs].sort((a, b) => {
    if (a.atMs !== b.atMs) return a.atMs - b.atMs;
    return a.runId === b.runId ? 0 : a.runId < b.runId ? -1 : 1;
  });
}

/**
 * What happened to one work item, ACROSS RUNS.
 *
 * The question `org-event.ts` was built to answer, now answerable over more than one process
 * lifetime — which is the whole point of the history being durable.
 */
export function eventsFor(root: string, subjectId: string): readonly OrgEvent[] {
  return readEvents(root).filter((e) => e.subjectId === subjectId);
}

/** Everything a line of authority decided, across runs. */
export function decidedUnder(root: string, hatId: string): readonly OrgEvent[] {
  return readEvents(root).filter((e) => e.supervisorChain.includes(hatId));
}

/** How many runs delivered, and how many did not — the simplest thing a history is for. */
export interface DeliveryRate {
  readonly runs: number;
  readonly delivered: number;
  /** Delivered runs that touched something real. */
  readonly deliveredForReal: number;
  /** Delivered runs that recorded themselves as touching nothing. */
  readonly deliveredSimulated: number;
  /** Delivered runs whose fidelity was never recorded. Neither real nor simulated — UNKNOWN. */
  readonly deliveredUnknownFidelity: number;
}

/**
 * How the history went, and how much of it was real.
 *
 * This used to return `{ runs, delivered }` alone, which is a number that cannot tell a history
 * where everything shipped from one where nothing did. A store built from real commands, real
 * worktrees and real merges and a store built from a pure simulation both reported "N/N delivered",
 * because the only thing separating them lived in memory and died at the disk boundary.
 *
 * THREE BUCKETS, NOT TWO. A run predating the `run_fidelity` fact is `unknown`, and folding it into
 * either of the other two would invent a fact about history nobody observed — the same refusal
 * `directoryReview` makes when no verdict was filed. Unknown is a real answer and it is reported.
 */
export function deliveryRate(root: string): DeliveryRate {
  const runs = readRuns(root);
  const delivered = runs.filter((r) => r.delivered);
  return {
    runs: runs.length,
    delivered: delivered.length,
    deliveredForReal: delivered.filter((r) => r.replayable === false).length,
    deliveredSimulated: delivered.filter((r) => r.replayable === true).length,
    deliveredUnknownFidelity: delivered.filter((r) => r.replayable === undefined).length,
  };
}
