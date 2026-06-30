/**
 * packages/application/src/observe-event-sink.ts — Merge1 §02 (Observe Loop).
 *
 * Port of the durability seam from `src/Core.TypeScript/observe/execute.ts`
 * (the `EventSink`/`AppendOutcome` port) and `event-sink-folder.ts` (the
 * folder-direct-to-main adapter with ZetaId-keyed JSON + G-Set CRDT merge).
 *
 * The durable record is an `EventEnvelope` — `{ id, at, by, action }` — a FACT
 * ("at t, actor X recorded this action"), carrying a STABLE identity (the
 * filename IS the id). Re-appending the same id is a no-op: the G-Set CRDT
 * property (set union is idempotent). MP-7: every failure is a `Result`-shaped
 * `AppendOutcome`, never a throw — the sink AUTHORS its own outcome channel
 * (asymmetric authorship).
 *
 * All I/O is injected (`mint` / `now` / `commit`) so the adapters are testable
 * with no real git and a temp dir. The canonical ZetaId minter arrives with the
 * identity stack (Merge1 §08); until then the default `mint` is a unique 32-hex
 * id (crypto random) — any stable unique id satisfies the G-Set dedup contract.
 */

import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { NextAction } from "./observe-simulate.ts";

/**
 * The outcome an `EventSink` authors when asked to append. Success carries the
 * minted event id; failure carries a reason the caller surfaces. Never throws.
 */
export type AppendOutcome =
  | { readonly ok: true; readonly eventId: string }
  | { readonly ok: false; readonly reason: string };

/**
 * The injected durability port. Appends one event to the append-only,
 * id-keyed event log via whichever transport is wired (folder-direct-to-main /
 * in-memory mock). Generic over the event type `E` (default `NextAction`,
 * backward-compatible: `EventSink` ≡ `EventSink<NextAction>`). Effectful actions
 * log OBSERVATION events instead of the command (see `observe-do-item.ts`) —
 * e.g. `EventSink<ActionObservation>`. One port shape, parameterized by payload.
 */
export interface EventSink<E = NextAction> {
  append: (event: E) => Promise<AppendOutcome>;
}

/** The durable FACT: a recorded action with stable identity + actor + time. */
export interface EventEnvelope {
  /** stable identity; the filename; the G-Set dedup key. */
  readonly id: string;
  /** canonical ISO-8601 timestamp. */
  readonly at: string;
  /** acting agent id (the actor trail). */
  readonly by: string;
  /** the chosen action this event records. */
  readonly action: NextAction;
}

/** A canonical observe-event id is 32 lowercase hex chars. */
export function isCanonicalEventId(id: string): boolean {
  return /^[0-9a-f]{32}$/.test(id);
}

/**
 * Default id minter: a unique 32-hex id (a dash-stripped UUIDv4 = 128 random
 * bits, lowercase hex). Replaced by the canonical WorkItem-category ZetaId
 * minter when the identity stack (§08) lands. Inject a deterministic minter in
 * tests for reproducible ids.
 */
export function mintObserveEventIdHex(): string {
  return randomUUID().replaceAll("-", "");
}

// ─── in-memory mock sink (G-Set idempotent) ──────────────────────────────────

/**
 * In-memory `EventSink<EventEnvelope>` for DST. Re-appending the same id is an
 * idempotent SUCCESS only if the content matches (the true G-Set property); a
 * reused id with different content is a real collision, surfaced as a failure
 * (never silently accept stale).
 */
export function createMockEventSink(): EventSink<EventEnvelope> & { readonly events: readonly EventEnvelope[] } {
  const events: EventEnvelope[] = [];
  return {
    events,
    append: (event) => {
      const existing = events.find((e) => e.id === event.id);
      if (existing) {
        if (canonicalEnvelope(existing) === canonicalEnvelope(event)) {
          return Promise.resolve({ ok: true, eventId: event.id }); // G-Set idempotent
        }
        return Promise.resolve({
          ok: false,
          reason: `id collision: ${event.id} already exists with different content`,
        });
      }
      events.push(event);
      return Promise.resolve({ ok: true, eventId: event.id });
    },
  };
}

function canonicalEnvelope(e: EventEnvelope): string {
  return JSON.stringify(e);
}

// ─── folder-direct-to-main sink ──────────────────────────────────────────────

/** Outcome of committing the event file (mirrors the donor's git pattern). */
export type CommitOutcome = { readonly ok: true } | { readonly ok: false; readonly reason: string };

export interface FolderSinkOptions {
  /** The folder events land in (folders-not-branches, on a main checkout). */
  readonly eventDir: string;
  /** Acting agent id, stamped into every envelope. */
  readonly by: string;
  /** Id minter (default: `mintObserveEventIdHex`). Inject a deterministic one in tests. */
  readonly mint?: () => string;
  /** Clock (default: `Date.now`). Inject in tests. */
  readonly now?: () => number;
  /** Commit the written file (default: a no-op success). Inject a real committer / fake in tests. */
  readonly commit?: (filePath: string, envelope: EventEnvelope) => CommitOutcome;
}

/**
 * Write the envelope as an atomic, id-named file. `flag: "wx"` fails if the file
 * exists — but for a G-Set the same id means the same event already landed, so
 * EEXIST is idempotent SUCCESS when the content matches, a collision otherwise.
 * `created` distinguishes a file WE wrote this append (safe to clean up on
 * failure) from a pre-existing durable event found via EEXIST (must NEVER delete).
 */
function writeEventFile(
  envelope: EventEnvelope,
  eventDir: string,
): { ok: true; path: string; created: boolean } | { ok: false; reason: string } {
  // The id becomes a path segment. Sanitize HERE — right before `join` — so the
  // value reaching the filesystem is provably a bare 32-hex name with no path
  // separators / traversal / reserved chars (closes the path-injection flow).
  if (!isCanonicalEventId(envelope.id)) {
    return { ok: false, reason: `non-canonical event id (expected 32 lowercase hex): '${envelope.id}'` };
  }
  const path = join(eventDir, `${envelope.id}.json`);
  const serialized = `${JSON.stringify(envelope, null, 2)}\n`;
  try {
    mkdirSync(eventDir, { recursive: true });
    writeFileSync(path, serialized, { flag: "wx" });
    return { ok: true, path, created: true };
  } catch (err) {
    const e = err as { code?: string; message: string };
    if (e.code === "EEXIST") {
      try {
        const existing = readFileSync(path, "utf-8");
        if (existing === serialized) return { ok: true, path, created: false }; // pre-existing → do NOT delete
        return { ok: false, reason: `id collision: ${envelope.id} already exists with different content` };
      } catch (readErr) {
        return { ok: false, reason: `EEXIST but re-read failed: ${(readErr as Error).message}` };
      }
    }
    return { ok: false, reason: `write failed: ${e.message}` };
  }
}

/** Best-effort remove a file WE created this append (null = nothing to remove). */
function removeOurFile(path: string | null): void {
  if (path === null) return;
  try {
    rmSync(path, { recursive: true, force: true });
  } catch {
    /* already gone — fine */
  }
}

/**
 * The folder-direct-to-main `EventSink`. `append` mints an id, builds the fact
 * envelope, atomically writes `<eventDir>/<id>.json`, and commits it. Pure-shaped
 * (Result; never throws); I/O injected for tests. The default `commit` is a
 * no-op success (write-only) so the sink is usable without a git checkout; inject
 * a real committer to get folder-direct-to-main durability.
 */
export function createFolderEventSink(opts: FolderSinkOptions): EventSink {
  const mint = opts.mint ?? mintObserveEventIdHex;
  const now = opts.now ?? (() => Date.now());
  const commit = opts.commit ?? (() => ({ ok: true }) as CommitOutcome);
  return {
    append: (action: NextAction): Promise<AppendOutcome> => {
      let ourFile: string | null = null;
      try {
        const id = mint();
        // The id is used as a path segment — reject anything but a canonical
        // 32-hex id before joining a path (guard against traversal/reserved names).
        if (!isCanonicalEventId(id)) {
          return Promise.resolve({ ok: false, reason: `non-canonical event id (expected 32 lowercase hex): '${id}'` });
        }
        const at = new Date(now()).toISOString();
        const envelope: EventEnvelope = { id, at, by: opts.by, action };
        const written = writeEventFile(envelope, opts.eventDir);
        if (!written.ok) return Promise.resolve({ ok: false, reason: written.reason });
        if (written.created) ourFile = written.path; // only OUR new file is ours to clean up
        const committed = commit(written.path, envelope);
        if (!committed.ok) {
          removeOurFile(ourFile); // pre-existing durable events are NOT touched (created === false)
          return Promise.resolve({ ok: false, reason: committed.reason });
        }
        return Promise.resolve({ ok: true, eventId: id });
      } catch (err) {
        removeOurFile(ourFile);
        return Promise.resolve({ ok: false, reason: `append failed: ${(err as Error).message}` });
      }
    },
  };
}
