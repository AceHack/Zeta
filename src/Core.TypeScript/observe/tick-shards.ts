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
 *
 * WHY THE FILENAME IS A ZetaId
 * ----------------------------
 * The first cut of this file named shards `<HHMMSSmmm>-<sha256[0:8]>.json`. That is a
 * private, ad-hoc key: nothing else in the repo can resolve it, no bit-field can be read
 * out of it, and it carries no category — so a tick frame was addressable only by the two
 * scripts in this folder. ZetaId is the repo's universal 128-bit pointer (the F# type
 * providers, the database layer, and the Roslyn surfaces all parse it), so a durable
 * record's key belongs in that space. Aaron 2026-08-13: *"i think we should be using zeta
 * id under the folder structure somewhere … zetaid is our universal pointer system … we
 * have bit parsing."*
 *
 * The shape now matches the two proven in-tree event ledgers, which are the closest
 * neighbours to this one: `docs/observe-events/<zetaid>.json` and
 * `workitems/events/YYYY/MM/DD/<zetaid>.json` — date-sharded directories (bounding the
 * fan-out) with a bare 32-hex ZetaId as the filename (the id IS the identity).
 *
 * CATEGORY = Observation (0), NOT a new registry slot
 * ---------------------------------------------------
 * A tick frame is a measurement of the observe loop's own state at time `t` — computed by
 * the `observe/` subsystem, from the observe event log, and described by `data/monitor.html`
 * as the observe ledger. `registry/categories.yaml` id 0 is exactly that, so no registry
 * entry is minted (adding one would be a schema change across all oracles, and reuse of a
 * fitting category beats minting a new one). Deliberately NOT:
 *   - `Heartbeat` (3) — liveness of an agent, not an aggregate of the society's state;
 *   - `FrictionTelemetry` (5) — reserved for the friction signals of ADR 2026-05-29.
 *
 * Note the neighbouring ledgers do NOT set a good example here: `mintObserveEventIdHex`
 * tags observe-events `Category.WorkItem` (8), which is category drift we copy the *shape*
 * of and not the *value* of.
 *
 * DETERMINISM: THE ID IS CONTENT-DERIVED, NOT ENTROPY-MINTED
 * ----------------------------------------------------------
 * `new-workitem.ts` keeps its mint DST-clean by injecting clock + randomness through an
 * environment boundary at the CLI. This mint goes one step further and takes NO entropy at
 * all — both ZetaId inputs are pure functions of the frame:
 *
 *   - the ZetaId `timestamp` field  ← the frame's own `t`, its observation time. Never a
 *     local mint clock, so a backfilled historical frame gets the id it would have got
 *     when it was first written; no id ever implies a mint time that did not happen. (This
 *     is also `local-time-never-enters-the-shared-fold`: the frame's phase, not our clock.)
 *   - the ZetaId `randomness` field ← the top 32 bits of the sha256 of the frame's
 *     canonical JSON — the *same* 32 bits that used to be the `-<sha256[0:8]>` filename
 *     suffix, so the old key is still recoverable from the new id.
 *
 * Two consequences, both of which the previous scheme also had and neither of which is
 * weakened: the SAME frame always lands at the SAME path (discipline #6 idempotency —
 * re-running a tick is an upsert), and two writers in the same millisecond with different
 * frames land on different paths (different digests). Collision resistance is unchanged at
 * 32 digest bits *within one millisecond*. What is gained: zero ambient entropy (#13
 * noninterference), so the whole shard store replays byte-identically under DST.
 */

import { readdirSync, readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

import { pack, type SimulationEnvironment } from "../zeta-id/zeta-id";
import { toHex } from "../zeta-id/encoding";
import {
  Category,
  Chromosome,
  IdVersion,
  type Milliseconds,
  type ZetaId,
  type ZetaObservation,
} from "../zeta-id/types";

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

/** A canonical shard filename stem: a 32-char lowercase-hex ZetaId (no extension). */
export const SHARD_ID_RE = /^[0-9a-f]{32}$/;

/**
 * The frame's content digest, as the 32-bit value that fills the ZetaId `randomness`
 * field. Exactly the bits that used to be the `-<sha256[0:8]>` filename suffix.
 */
function frameDigest32(frame: MetricsFrame): bigint {
  return BigInt("0x" + createHash("sha256").update(canonicalJson(frame)).digest("hex").slice(0, 8));
}

/**
 * Mint the frame's ZetaId. PURE — a total function of the frame's content, taking no
 * clock and no randomness (see the header note on determinism). The
 * `SimulationEnvironment` that `pack` requires is satisfied by the content digest, which
 * is why this mint needs no DST boundary: there is no non-determinism to inject.
 */
export function shardZetaId(frame: MetricsFrame): ZetaId {
  const atMs = Date.parse(frame.t);
  if (Number.isNaN(atMs)) throw new Error(`frame has unparseable timestamp: ${frame.t}`);
  const contentEnv: SimulationEnvironment = { nextInt64: () => frameDigest32(frame) };
  const obs: ZetaObservation = {
    version: IdVersion.V1,
    // The frame's OWN observation time — not a mint clock. Lands in the ZetaId high bits,
    // so hex-filename sort == chronological order within a shard directory.
    timestamp: atMs as Milliseconds,
    chromosome: Chromosome.MetaCoherence,
    category: Category.Observation,
    // A derived aggregate computed mechanically from the event log: no persona acted, and
    // no location is claimed, so both stay 0 (unspecified) rather than asserting a source.
    authority: { type: "Standard" },
    persona: 0 as ZetaObservation["persona"],
    momentum: { type: "Normal" },
    location: 0 as ZetaObservation["location"],
  };
  return pack(obs, contentEnv);
}

/**
 * Shard path for a frame: `<root>/YYYY/MM/DD/<zetaid>.json`, where `<zetaid>` is the
 * canonical 32-char lowercase-hex ZetaId — the same filename convention as
 * `docs/observe-events/` and `workitems/events/YYYY/MM/DD/`.
 *
 * The date directories bound the fan-out per directory; the ZetaId is the identity. Both
 * halves derive from the frame alone, so the SAME frame written twice lands on the SAME
 * path (re-running a tick is an upsert, not a duplicate — discipline #6) while two writers
 * in the same millisecond with different frames land on different paths. Ordering when
 * folding is carried by the frame's own `t`, never by the filename.
 */
export function shardPathFor(frame: MetricsFrame, root: string): string {
  const d = new Date(frame.t);
  if (Number.isNaN(d.getTime())) throw new Error(`frame has unparseable timestamp: ${frame.t}`);
  const yyyy = String(d.getUTCFullYear()).padStart(4, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return join(root, yyyy, mm, dd, `${toHex(shardZetaId(frame))}.json`);
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
