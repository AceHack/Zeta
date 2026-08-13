#!/usr/bin/env bun
/**
 * tick-shards.ts — the per-write shard store behind the observe metrics ledger.
 *
 * WHY SHARDS
 * ----------
 * `data/tick-history.json` used to BE the ledger: one mutable file that every
 * tick-metrics run appended to and pushed to main. That shape forces coordination —
 * two writers touching one path is a merge conflict by construction, and it grows
 * without bound (560 frames / 165KB after five weeks, ~96 frames/day and rising).
 *
 * The fix is the shape already proven in-tree by `workitems/events/YYYY/MM/DD/<hash>.json`
 * and `docs/agent-heartbeats/<persona>/YYYY/MM/DD/<zetaid>.md`: one file per write, under
 * a date shard, named so that no two writers can ever pick the same path. Then the merge
 * is set union — commutative and idempotent (disciplines #2 lock-free, #6 idempotency) —
 * and conflicts become structurally impossible rather than merely unlikely.
 *
 * `data/tick-history.json` REMAINS, but demoted from ledger to DERIVED ROLLUP: a pure
 * function of the shard set, regenerated on every run, bounded to the most recent
 * ROLLUP_MAX_FRAMES. Two properties follow:
 *
 *   - `data/monitor.html` (and any other Pages reader fetching the same URL) keeps
 *     working with no change: same path, same `{ provenance, frames }` shape. A static
 *     page cannot list a directory, so it needs a single file to fetch; the rollup is
 *     that file.
 *   - A merge conflict on the rollup is no longer a coordination problem. The rollup
 *     carries no information the shards do not, so the resolution is always "take the
 *     union of shards and regenerate" — never a hand-merge.
 *
 * The rollup being bounded is what retires the unbounded-growth problem for this file:
 * the archive lives in the shards, the served file stays a fixed size.
 */

import { readdirSync, readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

/** Frames kept in the derived rollup. `monitor.html` reads at most the last 121. */
export const ROLLUP_MAX_FRAMES = 1000;

export interface MetricsFrame {
  readonly t: string; // ISO-8601 timestamp
  readonly total_events: number;
  readonly last_action: string;
  readonly last_mode: string;
  readonly last_agent: string;
  readonly entropy_state: number;
  readonly entropy_heat: number;
  readonly ticks_24h: number;
  readonly agents_active: number;
  readonly claims_pending: number;
}

export interface HistoryLedger {
  readonly provenance: {
    readonly generator: string;
    readonly mock: boolean;
    readonly derived_from?: string;
    readonly shard_count?: number;
    readonly rollup_max_frames?: number;
  };
  readonly frames: readonly MetricsFrame[];
}

/**
 * Shard path for a frame: `<root>/YYYY/MM/DD/<HHMMSSmmm>-<8hex>.json`.
 *
 * The hex suffix is a content digest, which buys two things at once: two writers in the
 * same millisecond still land on different paths (no collision), and the SAME frame
 * written twice lands on the SAME path (re-running a tick is an upsert, not a duplicate —
 * discipline #6). Ordering is carried by the frame's own `t`, never by the filename.
 */
export function shardPathFor(frame: MetricsFrame, root: string): string {
  const d = new Date(frame.t);
  if (Number.isNaN(d.getTime())) throw new Error(`frame has unparseable timestamp: ${frame.t}`);
  const yyyy = String(d.getUTCFullYear()).padStart(4, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mi = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  const ms = String(d.getUTCMilliseconds()).padStart(3, "0");
  const digest = createHash("sha256").update(canonicalJson(frame)).digest("hex").slice(0, 8);
  return join(root, yyyy, mm, dd, `${hh}${mi}${ss}${ms}-${digest}.json`);
}

/**
 * Key-sorted JSON so the digest — and therefore the shard path — is a pure function of
 * the frame's content and not of JS key-insertion order. Same discipline as the golden
 * vectors: the bytes must be reproducible across writers.
 */
export function canonicalJson(frame: MetricsFrame): string {
  const keys = Object.keys(frame).sort((a, b) => a.localeCompare(b, "en"));
  const obj: Record<string, unknown> = {};
  for (const k of keys) obj[k] = (frame as unknown as Record<string, unknown>)[k];
  return JSON.stringify(obj, null, 2) + "\n";
}

/** Write one frame as its own shard. Idempotent: same frame ⇒ same path ⇒ same bytes. */
export function writeShard(frame: MetricsFrame, root: string): string {
  const path = shardPathFor(frame, root);
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, canonicalJson(frame));
  return path;
}

function walkJson(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walkJson(full, out);
    else if (entry.isFile() && entry.name.endsWith(".json")) out.push(full);
  }
}

/**
 * Read every shard, deduplicate, and order by frame timestamp.
 *
 * Ordering is derived from the frame content (`t`, tie-broken by canonical bytes), never
 * from readdir order or from a local clock — so every reader folds the same shard set into
 * the same sequence regardless of filesystem or arrival order.
 */
export function loadAllShards(root: string): readonly MetricsFrame[] {
  if (!existsSync(root)) return [];
  const files: string[] = [];
  walkJson(root, files);
  const seen = new Map<string, MetricsFrame>();
  for (const f of files) {
    try {
      const frame = JSON.parse(readFileSync(f, "utf-8")) as MetricsFrame;
      if (typeof frame?.t !== "string") continue;
      seen.set(canonicalJson(frame), frame);
    } catch {
      // A malformed shard must not take down the whole rollup — the rest of the
      // ledger is still readable, and the bad file stays visible in git.
      process.stderr.write(`[tick-shards] skipping unreadable shard: ${f}\n`);
    }
  }
  return [...seen.values()].sort((a, b) => {
    const byTime = a.t.localeCompare(b.t, "en");
    return byTime !== 0 ? byTime : canonicalJson(a).localeCompare(canonicalJson(b), "en");
  });
}

/** Build the derived, bounded rollup from the shard set. Pure. */
export function buildRollup(frames: readonly MetricsFrame[], shardCount: number): HistoryLedger {
  return {
    provenance: {
      generator: "tick-metrics-writer.ts",
      mock: false,
      derived_from: "data/tick-shards/**/*.json",
      shard_count: shardCount,
      rollup_max_frames: ROLLUP_MAX_FRAMES,
    },
    frames: frames.slice(-ROLLUP_MAX_FRAMES),
  };
}
