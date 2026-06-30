// bus-transport.ts — Merge1 §04: the room's message TransportPort seam.
//
// Port of the donor `src/Core.TypeScript/bus/bus.ts` (publish/list/read/clean/
// watch) re-shaped as a seam-injectable port (MP-2). Two adapters ship here:
//
//   createMockBusTransport()      — in-memory, DST-safe (deterministic replay)
//   createEphemeralBusTransport() — folder-backed JSON files (injected dir)
//
// A NATS adapter (production) binds the same interface and lives behind the
// runtime's transport seam; it is out of scope for this pure-core PR.
//
// MP-7 (Result over exception): every operation returns a Result/PublishResult
// and NEVER throws — the transport authors its own outcome channel.

import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import type { BusMessageEnvelope, RoomAgentId, RoomTopic } from "./bus-types.ts";

/** MP-7 Result — success carries a value, failure carries a typed error. */
export type Result<T, E> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

export type TransportError =
  | { readonly kind: "publish_failed"; readonly reason: string }
  | { readonly kind: "list_failed"; readonly reason: string }
  | { readonly kind: "read_failed"; readonly reason: string }
  | { readonly kind: "clean_failed"; readonly reason: string };

/** Publishing is asymmetric-authored: it either lands, or the transport gives feedback. */
export type PublishResult =
  | { readonly outcome: "published"; readonly messageId: string }
  | { readonly outcome: "feedback"; readonly reason: string };

export type MessageFilter = {
  readonly from?: RoomAgentId;
  readonly to?: RoomAgentId;
  readonly topic?: RoomTopic;
  /** ISO-8601 lower bound (inclusive): only messages published at or after this instant. */
  readonly since?: string;
};

export type WatchHandle = {
  cancel(): void;
};

/**
 * The room's message transport seam. Real = folder bus or NATS; mock = in-memory.
 * Same interface, DST-safe. All reads exclude expired messages (publishedAt + ttlMs).
 */
export interface TransportPort {
  publish(message: BusMessageEnvelope): Promise<PublishResult>;
  list(filter: MessageFilter): Promise<Result<readonly BusMessageEnvelope[], TransportError>>;
  read(messageId: string): Promise<Result<BusMessageEnvelope | undefined, TransportError>>;
  clean(): Promise<Result<number, TransportError>>;
  watch(filter: MessageFilter, callback: (message: BusMessageEnvelope) => void): WatchHandle;
}

// ── shared filter / lifecycle predicates ──────────────────────────────────────

function expiryMs(env: BusMessageEnvelope): number {
  return new Date(env.publishedAt).getTime() + env.ttlMs;
}

function isExpired(env: BusMessageEnvelope, nowMs: number): boolean {
  return expiryMs(env) < nowMs;
}

/** Broadcast-aware recipient match: a `to` filter also matches "*" envelopes. */
function matchesFilter(env: BusMessageEnvelope, filter: MessageFilter): boolean {
  if (filter.from !== undefined && env.from !== filter.from) return false;
  if (filter.to !== undefined && env.to !== filter.to && env.to !== "*") return false;
  if (filter.topic !== undefined && env.topic !== filter.topic) return false;
  if (filter.since !== undefined && env.publishedAt < filter.since) return false;
  return true;
}

/** Deterministic order: publishedAt, then id as a stable tiebreaker. */
function byPublishedThenId(a: BusMessageEnvelope, b: BusMessageEnvelope): number {
  return a.publishedAt === b.publishedAt ? a.id.localeCompare(b.id) : a.publishedAt.localeCompare(b.publishedAt);
}

// ── in-memory (DST) adapter ───────────────────────────────────────────────────

export type MockBusTransportOptions = {
  /** Clock for expiry checks (default `Date.now`). Inject for determinism. */
  readonly now?: () => number;
};

/**
 * In-memory ring of envelopes keyed by id (a G-Set: re-publishing the same id
 * with identical content is idempotent; different content is a surfaced
 * collision). Watchers fire synchronously on a matching publish. Two mock buses
 * fed the same publish sequence produce byte-identical `list` output (DST).
 */
export function createMockBusTransport(options: MockBusTransportOptions = {}): TransportPort {
  const now = options.now ?? (() => Date.now());
  const store = new Map<string, BusMessageEnvelope>();
  const watchers = new Set<{ filter: MessageFilter; cb: (m: BusMessageEnvelope) => void }>();

  return {
    publish: (message) => {
      const existing = store.get(message.id);
      if (existing !== undefined) {
        if (JSON.stringify(existing) === JSON.stringify(message)) {
          return Promise.resolve({ outcome: "published", messageId: message.id });
        }
        return Promise.resolve({ outcome: "feedback", reason: `id collision: ${message.id} already published with different content` });
      }
      store.set(message.id, message);
      for (const w of watchers) {
        if (matchesFilter(message, w.filter)) w.cb(message);
      }
      return Promise.resolve({ outcome: "published", messageId: message.id });
    },
    list: (filter) => {
      const nowMs = now();
      const results = [...store.values()]
        .filter((env) => !isExpired(env, nowMs) && matchesFilter(env, filter))
        .sort(byPublishedThenId);
      return Promise.resolve(ok(results));
    },
    read: (messageId) => {
      const env = store.get(messageId);
      if (env === undefined || isExpired(env, now())) return Promise.resolve(ok(undefined));
      return Promise.resolve(ok(env));
    },
    clean: () => {
      const nowMs = now();
      let removed = 0;
      for (const [id, env] of store) {
        if (isExpired(env, nowMs)) {
          store.delete(id);
          removed++;
        }
      }
      return Promise.resolve(ok(removed));
    },
    watch: (filter, callback) => {
      const entry = { filter, cb: callback };
      watchers.add(entry);
      return { cancel: () => watchers.delete(entry) };
    },
  };
}

// ── folder-backed (ephemeral) adapter ─────────────────────────────────────────

export type EphemeralBusTransportOptions = {
  /**
   * The directory envelopes land in, one `<id>.json` file each. REQUIRED — no
   * implicit `/tmp` default (the caller owns temp-dir creation; tests pass a
   * `mkdtempSync` dir). The donor's `ZETA_BUS_DIR`/`/tmp/zeta-bus` default is a
   * CLI concern, kept out of the library to avoid an insecure-temp-file seam.
   */
  readonly dir: string;
  readonly now?: () => number;
};

/**
 * Folder-backed transport — port of the donor `/tmp/zeta-bus` JSON-file bus,
 * with the directory injected. Each envelope is one `<id>.json` file; reads
 * filter out expired files; `clean` prunes them. Path traversal is impossible:
 * the id is resolved against the base dir and rejected if it escapes.
 */
export function createEphemeralBusTransport(options: EphemeralBusTransportOptions): TransportPort {
  const now = options.now ?? (() => Date.now());
  const baseDir = resolve(options.dir);

  /** Resolve `<id>.json` under baseDir; null if the id would escape the directory. */
  function envelopePath(id: string): string | null {
    const p = resolve(baseDir, `${id}.json`);
    return p.startsWith(`${baseDir}/`) ? p : null;
  }

  function readAll(): BusMessageEnvelope[] {
    mkdirSync(baseDir, { recursive: true });
    const out: BusMessageEnvelope[] = [];
    for (const f of readdirSync(baseDir)) {
      if (!f.endsWith(".json")) continue;
      try {
        const env = JSON.parse(readFileSync(join(baseDir, f), "utf-8")) as BusMessageEnvelope;
        if (typeof env.id === "string" && typeof env.topic === "string" && typeof env.publishedAt === "string") {
          out.push(env);
        }
      } catch {
        // corrupted entry — skip
      }
    }
    return out;
  }

  return {
    publish: (message) => {
      try {
        const p = envelopePath(message.id);
        if (p === null) return Promise.resolve({ outcome: "feedback", reason: `invalid message id: ${message.id}` });
        mkdirSync(baseDir, { recursive: true });
        writeFileSync(p, `${JSON.stringify(message, null, 2)}\n`);
        return Promise.resolve({ outcome: "published", messageId: message.id });
      } catch (e) {
        return Promise.resolve({ outcome: "feedback", reason: `publish failed: ${(e as Error).message}` });
      }
    },
    list: (filter) => {
      try {
        const nowMs = now();
        const results = readAll()
          .filter((env) => !isExpired(env, nowMs) && matchesFilter(env, filter))
          .sort(byPublishedThenId);
        return Promise.resolve(ok(results));
      } catch (e) {
        return Promise.resolve(err<TransportError>({ kind: "list_failed", reason: (e as Error).message }));
      }
    },
    read: (messageId) => {
      try {
        const p = envelopePath(messageId);
        if (p === null) return Promise.resolve(err<TransportError>({ kind: "read_failed", reason: `invalid message id: ${messageId}` }));
        let env: BusMessageEnvelope;
        try {
          env = JSON.parse(readFileSync(p, "utf-8")) as BusMessageEnvelope;
        } catch {
          return Promise.resolve(ok(undefined)); // absent or unreadable → undefined
        }
        if (isExpired(env, now())) return Promise.resolve(ok(undefined));
        return Promise.resolve(ok(env));
      } catch (e) {
        return Promise.resolve(err<TransportError>({ kind: "read_failed", reason: (e as Error).message }));
      }
    },
    clean: () => {
      try {
        const nowMs = now();
        let removed = 0;
        for (const env of readAll()) {
          if (!isExpired(env, nowMs)) continue;
          const p = envelopePath(env.id);
          if (p === null) continue;
          rmSync(p, { recursive: true, force: true });
          removed++;
        }
        return Promise.resolve(ok(removed));
      } catch (e) {
        return Promise.resolve(err<TransportError>({ kind: "clean_failed", reason: (e as Error).message }));
      }
    },
    // The folder bus has no push channel; watch is a no-op handle. The mock bus
    // (DST) and the NATS adapter (prod) provide real watch semantics.
    watch: () => ({ cancel: () => {} }),
  };
}
