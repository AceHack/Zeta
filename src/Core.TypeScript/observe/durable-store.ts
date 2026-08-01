/**
 * durable-store.ts — the unified write interface (DB/git convergence).
 *
 * Git commits are database writes. The event-sink-folder was the first
 * implementation. This module abstracts the write path so the observe loop
 * doesn't care whether events land in git, postgres, DagFs, or NATS.
 *
 * The abstraction: `DurableStore<E>` — append one event, get back a durable
 * receipt (the event id). Same shape as EventSink but with:
 * - Backend metadata (which store handled this write)
 * - Read-back (fold the log from any backend)
 * - Multi-backend (write to git AND replicate to postgres, or vice versa)
 *
 * The free tier uses git (folderSink). The paid tier adds postgres/NATS.
 * Both implement the same interface. The observe loop is backend-agnostic.
 *
 * Composes with:
 * - src/Core.TypeScript/observe/event-sink-folder.ts (the git backend)
 * - src/Core.TypeScript/observe/execute.ts (EventSink — the existing interface)
 * - src/Core.TypeScript/ferry-throttler/network-transport.ts (batch replication)
 * - The free-tier ADR: "git is the database"
 * - The mux-transport-bridge: real-time replication over WebSocket
 */

import type { AppendOutcome, EventSink } from "./execute";
import type { NextAction } from "./observe";

// ═══ The Unified Store Interface ═══════════════════════════════════════════════

/** Which backend handled a write. */
export type StoreBackend = "git" | "postgres" | "dagfs" | "nats" | "memory";

/** A durable receipt: proof that an event was persisted. */
export interface DurableReceipt {
  readonly eventId: string;
  readonly backend: StoreBackend;
  readonly at: string; // ISO timestamp of persistence
}

/** The read side: fold events from the store. */
export interface StoreReader<E> {
  /** Read all events (the full log). */
  readAll(): Promise<readonly E[]>;
  /** Read events since a given id (for incremental sync). */
  readSince(afterId: string): Promise<readonly E[]>;
  /** Count of events in the store. */
  count(): Promise<number>;
}

/** The write side: append one event. */
export interface StoreWriter<E> {
  /** Append one event. Returns a durable receipt on success. */
  append(event: E): Promise<AppendOutcome>;
  /** Which backend this writer uses. */
  readonly backend: StoreBackend;
}

/**
 * DurableStore — the unified read+write interface.
 * Backend-agnostic. The observe loop calls this, not the raw sink.
 */
export interface DurableStore<E> extends StoreReader<E>, StoreWriter<E> {}

// ═══ Multi-Backend Store (write to primary + replicate to secondary) ═══════════

/**
 * A store that writes to a PRIMARY backend and replicates to SECONDARY backends.
 * The primary's receipt is returned; secondaries are best-effort (async, non-blocking).
 *
 * This is the paid-tier pattern: git primary + postgres replica for queries.
 * Or: postgres primary + NATS replica for real-time streaming.
 */
export interface MultiStore<E> extends DurableStore<E> {
  /** The primary backend. */
  readonly primary: StoreBackend;
  /** The secondary backends (replication targets). */
  readonly secondaries: readonly StoreBackend[];
}

export function createMultiStore<E>(
  primary: DurableStore<E>,
  secondaries: readonly StoreWriter<E>[] = [],
): MultiStore<E> {
  return {
    backend: primary.backend,
    primary: primary.backend,
    secondaries: secondaries.map((s) => s.backend),

    async append(event: E): Promise<AppendOutcome> {
      // Write to primary (the source of truth)
      const result = await primary.append(event);

      // Replicate to secondaries (best-effort, non-blocking)
      if (result.ok) {
        for (const secondary of secondaries) {
          secondary.append(event).catch((err) => {
            console.error(`[multi-store] replication to ${secondary.backend} failed: ${err}`);
          });
        }
      }

      return result;
    },

    readAll: () => primary.readAll(),
    readSince: (afterId) => primary.readSince(afterId),
    count: () => primary.count(),
  };
}

// ═══ Adapters: wrap existing backends into DurableStore ═══════════════════════

/**
 * Wrap an EventSink (the existing interface) into a DurableStore.
 * This is the bridge: the observe loop migrates from EventSink to DurableStore
 * without changing anything else.
 */
export function eventSinkAsStore(
  sink: EventSink,
  backend: StoreBackend = "git",
  reader?: StoreReader<NextAction>,
): DurableStore<NextAction> {
  const defaultReader: StoreReader<NextAction> = {
    readAll: async () => [],
    readSince: async () => [],
    count: async () => 0,
  };

  return {
    backend,
    append: (event) => sink.append(event),
    ...(reader ?? defaultReader),
  };
}

/**
 * In-memory store (for tests and DST). Fully synchronous, deterministic.
 */
export function memoryStore<E>(): DurableStore<E> & { readonly events: E[] } {
  const events: E[] = [];
  let seq = 0;

  return {
    events,
    backend: "memory" as StoreBackend,

    async append(event: E): Promise<AppendOutcome> {
      seq++;
      events.push(event);
      return { ok: true, eventId: `mem-${seq}` };
    },

    async readAll(): Promise<readonly E[]> {
      return [...events];
    },

    async readSince(afterId: string): Promise<readonly E[]> {
      const idx = events.findIndex((_, i) => `mem-${i + 1}` === afterId);
      return idx >= 0 ? events.slice(idx + 1) : [...events];
    },

    async count(): Promise<number> {
      return events.length;
    },
  };
}
