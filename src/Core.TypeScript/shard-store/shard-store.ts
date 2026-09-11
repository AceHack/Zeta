/**
 * shard-store.ts — one file per write, ZetaId-named, under a date shard.
 *
 * ── WHY THIS IS ITS OWN MODULE ───────────────────────────────────────────────
 * The shape had been written three times: `observe/tick-shards.ts`,
 * `workflow-engine/agent-loop/state-store.ts`, and — about to be — a third for the organization's
 * event log. Each copy re-derives the same four decisions (canonical JSON, a content-derived id, a
 * date-sharded path, a set-union read), and three implementations of one convention is two
 * opportunities for them to disagree about where a record lives.
 *
 * ── THE SHAPE, AND WHY IT IS THIS SHAPE ──────────────────────────────────────
 * `tick-shards.ts` states the argument and it is worth keeping next to the code: a single mutable
 * file that every writer appends to *"forces coordination — two writers touching one path is a
 * merge conflict by construction, and it grows without bound."* One file per write makes the merge
 * SET UNION — commutative and idempotent, disciplines #2 (lock-free) and #6 (idempotency) — and
 * conflicts stop being unlikely and become structurally impossible.
 *
 * ── ZERO AMBIENT ENTROPY ─────────────────────────────────────────────────────
 * The id is a pure function of the record: the record's own instant supplies the ZetaId timestamp,
 * and the sha256 of its canonical JSON supplies the randomness field. No clock is read and no
 * randomness drawn (§13 noninterference), so the same record always lands at the same path and the
 * whole store replays byte-identically under DST. Time enters through the CALLER.
 *
 * ── KEYS SORT ORDINALLY ──────────────────────────────────────────────────────
 * The digest decides the filename, so the key sort decides the address. `localeCompare` is
 * culture-sensitive (`.claude/rules/culture-invariant-by-default.md`), which would make the same
 * record land at different addresses on machines with different ICU data — a content address that
 * is not a function of the content. Sorting is by code unit, recursively, because sorting only the
 * top level leaves nested objects in insertion order and two writers building the same record by
 * different code paths would then produce different bytes.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import type { Dirent } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

import { pack, type SimulationEnvironment } from "../zeta-id/zeta-id";
import { toHex } from "../zeta-id/encoding";
import {
  Chromosome,
  IdVersion,
  type Category,
  type Milliseconds,
  type ZetaId,
  type ZetaObservation,
} from "../zeta-id/types";

/** A canonical shard filename stem: a 32-char lowercase-hex ZetaId. */
export const SHARD_ID_RE = /^[0-9a-f]{32}$/;

/** Key-sorted JSON, ordinally and recursively, so the bytes are a pure function of the content. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortDeep(value), null, 2) + "\n";
}

function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value === null || typeof value !== "object") return value;
  const source = value as Record<string, unknown>;
  // Ordinal: `<` on strings compares by UTF-16 code unit. `localeCompare` would not.
  const keys = Object.keys(source).sort((a, b) => (a === b ? 0 : a < b ? -1 : 1));
  const out: Record<string, unknown> = {};
  for (const k of keys) out[k] = sortDeep(source[k]);
  return out;
}

/** The record's content digest, as the 32 bits that fill the ZetaId `randomness` field. */
function digest32(value: unknown): bigint {
  return BigInt("0x" + createHash("sha256").update(canonicalJson(value)).digest("hex").slice(0, 8));
}

/**
 * Mint a record's ZetaId. PURE — a total function of the record and its instant.
 *
 * `atMs` is the record's OWN time, never a mint clock, so a backfilled record gets the id it would
 * have had when it happened and no id ever implies a mint time that did not occur.
 */
export function shardZetaId(value: unknown, atMs: number, category: Category): ZetaId {
  if (!Number.isFinite(atMs)) throw new Error(`shard record has unparseable timestamp: ${String(atMs)}`);
  const contentEnv: SimulationEnvironment = { nextInt64: () => digest32(value) };
  const obs: ZetaObservation = {
    version: IdVersion.V1,
    timestamp: atMs as Milliseconds,
    chromosome: Chromosome.MetaCoherence,
    category,
    authority: { type: "Standard" },
    persona: 0 as ZetaObservation["persona"],
    momentum: { type: "Normal" },
    location: 0 as ZetaObservation["location"],
  };
  return pack(obs, contentEnv);
}

/**
 * UTC `YYYY`, `MM`, `DD` for an instant — the directory segments that bound fan-out.
 *
 * Read off `toISOString`, which is UTC BY DEFINITION, rather than assembled from date getters.
 * The getters come in local and UTC pairs that differ by one character (`getFullYear` /
 * `getUTCFullYear`), and picking the wrong one puts the same record in different directories on
 * writers in different timezones — a content address that depends on where the writer sits.
 *
 * Testing for that mistake is unreliable: `bun test` pins `TZ=UTC`, so a local-time read behaves
 * identically under the suite and only misbehaves on a contributor's machine. Removing the getters
 * removes the mistake — there is no local variant of `toISOString` to reach for.
 */
export function dateSegments(atMs: number): readonly string[] {
  if (!Number.isFinite(atMs)) throw new Error(`shard record has unparseable timestamp: ${String(atMs)}`);
  const [yyyy, mm, dd] = new Date(atMs).toISOString().slice(0, 10).split("-");
  if (yyyy === undefined || mm === undefined || dd === undefined) {
    throw new Error(`shard record has unparseable timestamp: ${String(atMs)}`);
  }
  return [yyyy, mm, dd];
}

export interface ShardSpec {
  /** The record itself. Its canonical JSON is both the content and the digest input. */
  readonly value: unknown;
  /** The record's own instant, in milliseconds. */
  readonly atMs: number;
  readonly category: Category;
  /** Directory segments ABOVE the date — a persona, an agent, a stream. May be empty. */
  readonly prefix?: readonly string[];
}

/** `<root>/<prefix...>/YYYY/MM/DD/<zetaid>.json`. */
export function shardPath(spec: ShardSpec, root: string): string {
  const id = toHex(shardZetaId(spec.value, spec.atMs, spec.category));
  return join(root, ...(spec.prefix ?? []), ...dateSegments(spec.atMs), `${id}.json`);
}

/** Write one record as its own shard. Idempotent: same record ⇒ same path ⇒ same bytes. */
export function writeShard(spec: ShardSpec, root: string): string {
  const path = shardPath(spec, root);
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, canonicalJson(spec.value));
  return path;
}

/**
 * Every SHARD under a directory — not every `.json`.
 *
 * The filename stem must be a canonical ZetaId. Reading any `.json` meant a stray file in the tree
 * — a config, a README's example, an editor's scratch, a hand-written note — was parsed as a record
 * and returned as one, with whatever fields it happened to have. A store that silently adopts
 * anything left in its directory is not a store; the name is what says "this is ours".
 */
/**
 * A half-open instant range, in the same milliseconds a shard is written under.
 *
 * Both ends optional: a window with neither is every shard, which is what an unbounded read is.
 */
export interface ShardWindow {
  /** Inclusive. */
  readonly fromMs?: number;
  /** Inclusive — a day is kept when any part of it is at or before this. */
  readonly toMs?: number;
}

const MS_PER_DAY = 86_400_000;

/**
 * Whether a `YYYY/MM/DD` triple can hold anything the window wants.
 *
 * A date the runtime cannot parse is KEPT. An unreadable directory name is a reason to look, never
 * a licence to skip — dropping shards to tidy up a walk is the one failure a store must not have.
 */
function dayIntersects(parts: readonly string[], window: ShardWindow): boolean {
  const [yyyy, mm, dd] = parts;
  if (yyyy === undefined || mm === undefined || dd === undefined) return true;
  // NO SEPARATE SHAPE CHECK. One was written here — `/^[0-9]{4}$/` on the year and `/^[0-9]{2}$/`
  // on the other two — and it was SUBSUMED by the two lines below: anything not date-shaped either
  // fails to parse or fails the round trip, and both of those already return `true`. It survived a
  // mutation that deleted it outright, which is the definition of a check no input can falsify.
  const startMs = Date.parse(`${yyyy}-${mm}-${dd}T00:00:00.000Z`);
  if (!Number.isFinite(startMs)) return true;
  // ROUND-TRIPPED, because `Date.parse` accepts dates that do not exist and silently rolls them
  // over: `2026-02-30` parses as March 2nd. A directory named that is not a date this store wrote,
  // and treating it as March would prune it against the wrong day.
  if (new Date(startMs).toISOString().slice(0, 10) !== `${yyyy}-${mm}-${dd}`) return true;
  const endMs = startMs + MS_PER_DAY - 1;
  if (window.fromMs !== undefined && endMs < window.fromMs) return false;
  if (window.toMs !== undefined && startMs > window.toMs) return false;
  return true;
}

/**
 * Collect shard paths under `dir`, skipping days the window excludes.
 *
 * ── THE DATE IS DECIDED WHERE THE FILES ARE, NOT ON THE WAY DOWN ─────────────
 * A shard is written at `<root>/<prefix...>/YYYY/MM/DD/<id>.json`, so the date is always the LAST
 * three segments above the filename — but the prefix is variable length, so on the way down there
 * is no way to know whether a triple being assembled is the date or part of the prefix.
 *
 * The first cut guessed while descending and was WRONG, measurably: a store written under the
 * prefix `2020/01/01` had every one of its 2026 shards pruned by a 2026 window, because the walk
 * matched the prefix as the date, found 2020 outside the range, and never descended. Silent loss,
 * in the direction of returning less — the worst direction for a store.
 *
 * Asking at the directory that actually HOLDS the files removes the guess entirely: whatever those
 * three segments are, they are the ones `shardPath` put there. The cost is one `readdir` per day
 * directory that gets skipped, which is nothing beside the file opens it avoids — at 60,000 events
 * the opens and parses are essentially the whole read.
 */
function walkShards(dir: string, out: string[], window?: ShardWindow, below: readonly string[] = []): void {
  // ── ASK ONCE, INTERPRET THE FAILURE ──────────────────────────────────────
  // Not `if (existsSync(dir))` around this. That is check-then-use: the answer is stale the moment
  // it returns, and a directory can be created or removed in the gap — so the guard reads as
  // defensive and prevents nothing, which is worse than no guard because it is read as protection.
  // One syscall, one answer. A store nobody has written to yet is a normal state, not an error.
  let entries: readonly Dirent[];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
  // Only ask about this directory's own trailing triple, and only when it holds shards.
  const skipFiles = window !== undefined && !dayIntersects(below.slice(-3), window);
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walkShards(full, out, window, [...below, entry.name]);
      continue;
    }
    if (skipFiles) continue;
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    if (!SHARD_ID_RE.test(entry.name.slice(0, -".json".length))) continue;
    out.push(full);
  }
}

/**
 * The PATH of every shard under a root, without opening any of them.
 *
 * Listing costs a `readdir` per directory; reading costs an open, a read and a `JSON.parse` per
 * record, and at 60,000 events that second cost is essentially the entire read. So a caller that
 * wants to know WHICH shards exist — an incremental indexer deciding what is new — must be able to
 * ask without paying for the contents it already has.
 */
export function shardFiles(root: string, window?: ShardWindow): readonly string[] {
  const files: string[] = [];
  walkShards(root, files, window);
  return files;
}

/**
 * Every shard under a root, de-duplicated by identity.
 *
 * `identify` re-mints each record's id from its CONTENT rather than reading the filename, so the
 * same record arriving at two paths — a hand-merge, a mis-sharded writer, a branch merged twice —
 * counts once. That is what makes the merge a set union rather than a concatenation.
 *
 * A missing root is an EMPTY read, not an error: a store nobody has written to yet is a normal
 * state, and throwing would make "nothing has happened" indistinguishable from "something broke".
 */
export function readShards<T>(
  root: string,
  identify: (record: T) => string,
  /**
   * Read only shards written inside this instant range.
   *
   * A HINT ABOUT THE PATH, not a filter on the record. Pruning happens on `YYYY/MM/DD` directories,
   * which are named from the instant a record was WRITTEN UNDER — so a caller that needs the
   * predicate to hold exactly must still filter what comes back. What this buys is not opening the
   * files that cannot match: MEASURED at 60,000 events, an unbounded read is ~10s and essentially
   * all of it is reading and parsing, so the saving is proportional to the days excluded.
   */
  window?: ShardWindow,
): readonly T[] {
  if (!existsSync(root)) return [];
  const files: string[] = [];
  walkShards(root, files, window);
  const seen = new Set<string>();
  const out: T[] = [];
  for (const file of files) {
    // ── ONE BAD SHARD IS NOT A BROKEN STORE ────────────────────────────────
    // A process killed mid-write leaves a truncated file, and this used to throw straight out of
    // `JSON.parse` — so the single failure mode durability exists to survive made the whole
    // organization permanently unreadable.
    //
    // It is SKIPPED, never silently: `shardProblems` lists exactly these files. A store quietly
    // missing events would read as a smaller organization and nobody would know, which is the
    // worse of the two errors.
    let record: T;
    try {
      record = JSON.parse(readFileSync(file, "utf-8")) as T;
    } catch {
      continue;
    }
    const id = identify(record);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(record);
  }
  return out;
}

/**
 * Shards under a root that could not be read back, and why.
 *
 * The companion `readShards` needs to stay honest. Reading skips what it cannot parse so one
 * truncated file cannot take down a whole organization; this is how a caller finds out that it
 * happened, so "the store is smaller than it should be" is a reportable fact rather than a silence.
 */
export function shardProblems(
  root: string,
): readonly { readonly file: string; readonly reason: string }[] {
  if (!existsSync(root)) return [];
  const files: string[] = [];
  walkShards(root, files);
  const out: { file: string; reason: string }[] = [];
  for (const file of files) {
    try {
      JSON.parse(readFileSync(file, "utf-8"));
    } catch (err) {
      out.push({ file, reason: err instanceof Error ? err.message : String(err) });
    }
  }
  return out;
}
