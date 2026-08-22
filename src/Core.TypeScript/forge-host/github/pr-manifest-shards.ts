#!/usr/bin/env bun
/**
 * pr-manifest-shards.ts — the per-PR shard store behind the PR-archive manifest.
 *
 * WHY SHARDS (081KZYMY46P087G0R003S64V2B)
 * -------------------------------------
 * `docs/github/prs/manifest.jsonl` used to BE the ledger: one file that every archive run
 * read, appended to, and rewrote whole. That shape forces coordination — every archive PR
 * touches the same trailing region of the same path, so **N in-flight archive PRs conflict
 * pairwise**, merging any one invalidates the rest, and the queue drains only serially with
 * a rebase per merge. Observed live 2026-08-13: eight archive PRs simultaneously open and
 * mutually conflicting (#10391, #10392, #10399, #10400, #10403, #10404, #10405, #10407),
 * three autonomous ticks of hand-draining, and the queue re-grew on every merge because each
 * merge generates the next archive PR.
 *
 * That is the data structure behaving as designed, not a busy day. The fix is the shape
 * already proven in-tree by `data/tick-shards/YYYY/MM/DD/<zetaid>.json` and
 * `workitems/events/YYYY/MM/DD/<zetaid>.json`: **one file per archived PR**, named so that
 * no two writers can ever pick the same path. Then the merge is set union — commutative and
 * idempotent (disciplines #2 lock-free, #6 idempotency) — and the conflict class disappears
 * rather than being mitigated.
 *
 * `docs/github/prs/manifest.jsonl` REMAINS, at its current path with its current schema, but
 * demoted from ledger to DERIVED INDEX: a pure function of the shard set (`deriveManifest`).
 * Every existing reader — `consume-pr-archives.ts`, `.github/workflows/pr-archive-on-merge.yml`,
 * `.github/workflows/agent-heartbeat.yml` — keeps working unchanged, because the derived file
 * is byte-identical to what the mutating writer produced (modulo the ordering rule below).
 * A merge conflict on the derived index is no longer a coordination problem either: it carries
 * no information the shards do not, so the resolution is always "take the union of shards and
 * regenerate", never a hand-merge.
 *
 * THE KEY IS THE PR NUMBER, AND THE ZetaId CARRIES IT
 * ---------------------------------------------------
 * `pr_number` is the natural key — one archived PR, one shard, forever. So the shard's ZetaId
 * is a PURE, TOTAL, INVERTIBLE function of `pr_number`: the number is written into the ZetaId
 * `randomness` field (32 bits; PR numbers are ~10^4), and every other field is a constant.
 * Consequences, all load-bearing:
 *
 *   - **Upsert by construction (§12).** Re-archiving PR N recomputes the SAME id and therefore
 *     the SAME path, so a re-run overwrites one file. A duplicate entry is not merely avoided,
 *     it is unrepresentable — there is no path a second entry for PR N could occupy.
 *   - **Collision-free by construction, not w.h.p.** Distinct PR numbers give distinct ids
 *     because the map is injective. No digest, no birthday bound.
 *   - **Zero ambient entropy (§13 noninterference), zero clock (§7 DST).** The mint takes no
 *     `Date.now()` and no randomness, so the whole store replays byte-identically.
 *   - **Reversible.** `prNumberOfShardId` reads the PR number back out of the id — the ZetaId
 *     is a real pointer into the repo's universal id space, not an opaque filename.
 *
 * WHY THE TIMESTAMP FIELD IS 0 (UNSPECIFIED)
 * ------------------------------------------
 * The tempting choice is `merged_at` in the ZetaId's timestamp high-bits (that is what
 * `tick-shards.ts` does with a frame's own `t`). It is wrong HERE: `merged_at` is `null` for a
 * PR archived while OPEN (PR #1702 in the current manifest) and becomes non-null when that PR
 * later merges — so the id, and therefore the path, would MOVE, and the same PR would end up
 * with two shards. An identity that changes when the substrate updates is not an identity.
 * So the timestamp field is 0 = *unspecified*, the same stance `tick-shards.ts` takes for
 * persona/location: assert nothing rather than assert something that is not stable. The times
 * live in the record (`merged_at`, `fetched_at`), where they can change without moving the key.
 *
 * CATEGORY = Observation (0), NOT a new registry slot
 * ---------------------------------------------------
 * An archive shard is a record of what was observed about one PR's review substrate at fetch
 * time. `registry/categories.yaml` id 0 is exactly that. Minting a new category is a schema
 * change across all oracles (TS + C# + F# + the yaml byte-lock), and reuse of a fitting
 * category beats minting a new one — the same call `tick-shards.ts` made on 2026-08-13.
 *
 * DIRECTORY LAYOUT: THOUSAND-BUCKETS, NOT DATES
 * ---------------------------------------------
 * `docs/github/prs/shards/<NNN>/<zetaid>.json`, where `<NNN>` is `floor(pr_number / 1000)`
 * zero-padded to 3 digits. Date directories are the in-tree convention for event ledgers
 * because events ARE their timestamp; a PR archive is keyed by its number, and a date-derived
 * directory would reintroduce exactly the path-instability the timestamp note above rejects.
 * The bucket bounds fan-out to ≤1000 files per directory (`docs/history/pr-reviews/` already
 * holds ~6000 in ONE flat directory, so this is the conservative side of in-tree practice).
 *
 * ORDERING RULE FOR THE DERIVED INDEX (state it, because it is a contract)
 * -----------------------------------------------------------------------
 * Lines are sorted by `pr_number` ASCENDING, compared as INTEGERS (`a - b`). Integer order is
 * culture-free by construction — there is no collation involved at all, which is the strongest
 * form of `culture-invariant-by-default`. It is NOT string order: string order puts "10394"
 * before "671", and `localeCompare` on top of that is culture-sensitive (a live bug in this
 * repo earlier the same day, PR #10381). Ties are impossible: `pr_number` is the unique key,
 * and `loadAllShards` fails loudly if two shards claim the same one. Where paths are sorted
 * (shard walking), `ordinalCompare` is used — never `localeCompare`.
 *
 * Pure core, edge-only I/O. Beacon anchors: Linstedt & Olschimke, *Building a Scalable Data
 * Warehouse with Data Vault 2.0* (hub/link/satellite by change rate — §8); Shapiro, Preguiça,
 * Baquero & Zawirski, *Conflict-free Replicated Data Types* (INRIA RR-7687, 2011) — the shard
 * set is a G-Set keyed by `pr_number`, whose merge is union, hence commutative, associative and
 * idempotent; Goguen & Meseguer 1982 (noninterference — no ambient clock or entropy here).
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { pack, type SimulationEnvironment } from "../../zeta-id/zeta-id.ts";
import { toHex } from "../../zeta-id/encoding.ts";
import {
  Category,
  Chromosome,
  IdVersion,
  type Milliseconds,
  type ZetaId,
  type ZetaObservation,
} from "../../zeta-id/types.ts";

// ── Paths ─────────────────────────────────────────────────────────────────

/** The derived index every existing reader already knows. Path and schema UNCHANGED. */
export const MANIFEST_RELATIVE = "docs/github/prs/manifest.jsonl";

/** The shard store — one JSON file per archived PR. */
export const SHARD_ROOT_RELATIVE = "docs/github/prs/shards";

/**
 * Quarantine for manifest lines that could not be parsed or validated during migration.
 * A cleanup that silently drops an unreadable record is the quiet-failure shape this repo
 * refuses; an unparseable line lands HERE, with its reason and its original line number,
 * where a human will find it.
 */
export const UNPARSEABLE_RELATIVE = "docs/github/prs/unparseable.jsonl";

// ── Schema (moved here from archive-pr-reviews.ts; that file re-exports it) ─

export interface ManifestEntry {
  pr_number: number;
  archive_path: string; // relative to repo root
  source_ids: string[]; // comment / thread IDs captured (string for stability)
  fetched_at: string; // ISO 8601 UTC
  schema_version: "v1";
  commit_sha: string; // commit at time of archival
  title: string;
  state: "OPEN" | "MERGED" | "CLOSED";
  merged_at: string | null;
  head_ref: string;
}

/** The manifest's field order, fixed. Both the shard bytes and the index line use it. */
const FIELD_ORDER = [
  "pr_number",
  "archive_path",
  "source_ids",
  "fetched_at",
  "schema_version",
  "commit_sha",
  "title",
  "state",
  "merged_at",
  "head_ref",
] as const;

/**
 * Stable-key serialization of a manifest entry — one JSONL line, no trailing newline.
 * Field order is fixed (JSON.stringify preserves insertion order on plain objects) so
 * repeated runs produce byte-identical lines when the underlying data is identical.
 */
export function serializeManifestEntry(e: ManifestEntry): string {
  const ordered = {
    pr_number: e.pr_number,
    archive_path: e.archive_path,
    source_ids: e.source_ids,
    fetched_at: e.fetched_at,
    schema_version: e.schema_version,
    commit_sha: e.commit_sha,
    title: e.title,
    state: e.state,
    merged_at: e.merged_at,
    head_ref: e.head_ref,
  };
  return JSON.stringify(ordered);
}

/** Shard file bytes: the same object, pretty-printed with a trailing newline (diffable). */
export function serializeShard(e: ManifestEntry): string {
  const ordered: Record<string, unknown> = {};
  for (const k of FIELD_ORDER) ordered[k] = (e as unknown as Record<string, unknown>)[k];
  return JSON.stringify(ordered, null, 2) + "\n";
}

// ── Validation (total: never throws, always names the reason) ──────────────

export type ValidationResult =
  | { readonly ok: true; readonly entry: ManifestEntry }
  | { readonly ok: false; readonly reason: string };

/**
 * Validate an untrusted parsed value as a `ManifestEntry`. TOTAL — returns a reason instead
 * of throwing, because every rejection has to be reportable (quarantine, not silence).
 */
export function validateEntry(u: unknown): ValidationResult {
  if (typeof u !== "object" || u === null || Array.isArray(u)) {
    return { ok: false, reason: "not a JSON object" };
  }
  const o = u as Record<string, unknown>;
  if (typeof o["pr_number"] !== "number" || !Number.isInteger(o["pr_number"]) || (o["pr_number"] as number) <= 0) {
    return { ok: false, reason: "pr_number missing or not a positive integer" };
  }
  for (const k of ["archive_path", "fetched_at", "commit_sha", "title", "head_ref", "state", "schema_version"]) {
    if (typeof o[k] !== "string") return { ok: false, reason: `${k} missing or not a string` };
  }
  if (!Array.isArray(o["source_ids"]) || (o["source_ids"] as unknown[]).some((s) => typeof s !== "string")) {
    return { ok: false, reason: "source_ids missing or not a string array" };
  }
  const mergedAt = o["merged_at"];
  if (mergedAt !== null && typeof mergedAt !== "string") {
    return { ok: false, reason: "merged_at must be a string or null" };
  }
  const state = o["state"] as string;
  if (state !== "OPEN" && state !== "MERGED" && state !== "CLOSED") {
    return { ok: false, reason: `state must be OPEN|MERGED|CLOSED, got ${JSON.stringify(state)}` };
  }
  return {
    ok: true,
    entry: {
      pr_number: o["pr_number"] as number,
      archive_path: o["archive_path"] as string,
      source_ids: o["source_ids"] as string[],
      fetched_at: o["fetched_at"] as string,
      schema_version: o["schema_version"] as "v1",
      commit_sha: o["commit_sha"] as string,
      title: o["title"] as string,
      state: state,
      merged_at: mergedAt as string | null,
      head_ref: o["head_ref"] as string,
    },
  };
}

// ── Identity ──────────────────────────────────────────────────────────────

/** A canonical shard filename stem: a 32-char lowercase-hex ZetaId (no extension). */
export const SHARD_ID_RE = /^[0-9a-f]{32}$/;

/** PR numbers ride in the 32-bit ZetaId randomness field. */
const MAX_PR_NUMBER = 0xffffffff;

/**
 * Mint the shard's ZetaId. PURE and INJECTIVE in `prNumber` — no clock, no randomness (see
 * the header). The `SimulationEnvironment` `pack` requires is satisfied by the key itself,
 * which is why this mint needs no DST boundary: there is no non-determinism to inject.
 */
export function shardZetaId(prNumber: number): ZetaId {
  if (!Number.isInteger(prNumber) || prNumber <= 0 || prNumber > MAX_PR_NUMBER) {
    throw new Error(`pr_number must be a positive integer <= ${MAX_PR_NUMBER}, got ${String(prNumber)}`);
  }
  const keyEnv: SimulationEnvironment = { nextInt64: () => BigInt(prNumber) };
  const obs: ZetaObservation = {
    version: IdVersion.V1,
    // 0 = UNSPECIFIED. Not a mint clock and not `merged_at` — see the header note: a
    // timestamp that can change would move the shard's identity.
    timestamp: 0 as Milliseconds,
    chromosome: Chromosome.MetaCoherence,
    category: Category.Observation,
    // A mechanical archival of someone else's PR: no persona acted and no location is
    // claimed, so both stay 0 (unspecified) rather than asserting a source.
    authority: { type: "Standard" },
    persona: 0 as ZetaObservation["persona"],
    momentum: { type: "Normal" },
    location: 0 as ZetaObservation["location"],
  };
  return pack(obs, keyEnv);
}

/**
 * Read the PR number back out of a shard ZetaId — the map is invertible by construction.
 * The `randomness` field is bits [0, 32) (`zeta-id.gen.ts`), which is where the key was
 * written; `prNumberOfShardId(shardZetaId(n)) === n` is a test, not a hope.
 */
export function prNumberOfShardId(id: ZetaId): number {
  return Number(BigInt.asUintN(32, id));
}

/** `<root>/<NNN>/<zetaid>.json` — bucket = floor(pr/1000), zero-padded to 3. */
export function shardPathFor(prNumber: number, root: string): string {
  const bucket = String(Math.floor(prNumber / 1000)).padStart(3, "0");
  return join(root, bucket, `${toHex(shardZetaId(prNumber))}.json`);
}

// ── Write (edge) ──────────────────────────────────────────────────────────

export interface ShardWriteResult {
  readonly path: string;
  readonly changed: boolean;
  /** "added" when the file did not exist, "replaced" on a content change, "noop" otherwise. */
  readonly classification: "added" | "replaced" | "noop";
}

/**
 * The two fields that drift between runs WITHOUT indicating any substrate change:
 * `fetched_at` (set from the wall clock on every invocation) and `commit_sha` (moves whenever
 * `main` moves). `updateManifest` has excluded them from its equality check since it was
 * written; the shard writer MUST use the same rule or the two disagree — caught live on
 * 2026-08-13 by re-archiving PR #10413, which reported `manifest=noop, shard=replaced` and
 * would have made every re-run churn a shard and drift the derived index off the manifest.
 */
function equalModuloWallClockNoise(a: ManifestEntry, b: ManifestEntry): boolean {
  const blank = (e: ManifestEntry): string => serializeShard({ ...e, fetched_at: "", commit_sha: "" });
  return blank(a) === blank(b);
}

/**
 * Write one entry as its own shard. UPSERT on the natural key: same `pr_number` ⇒ same path,
 * so N writes for one PR leave exactly one file (§12). Two DIFFERENT PRs can never select the
 * same path, so concurrent writers never touch a shared byte (§2).
 *
 * Only rewrites on a LOAD-BEARING content change (see `equalModuloWallClockNoise`), so a
 * deterministic re-run is a true no-op — no mtime churn, no git diff, no spurious archive
 * commit. Exactly the contract `updateManifest` already had.
 */
export function writeShard(entry: ManifestEntry, root: string): ShardWriteResult {
  const path = shardPathFor(entry.pr_number, root);
  const next = serializeShard(entry);
  const existed = existsSync(path);
  if (existed) {
    const current = readFileSync(path, "utf8");
    if (current === next) return { path, changed: false, classification: "noop" };
    let parsed: unknown;
    try {
      parsed = JSON.parse(current);
    } catch {
      parsed = null; // unreadable shard: fall through and replace it with a valid one
    }
    const v = validateEntry(parsed);
    if (v.ok && equalModuloWallClockNoise(v.entry, entry)) {
      // Same substrate, newer clock — preserve the existing bytes.
      return { path, changed: false, classification: "noop" };
    }
  }
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, next, "utf8");
  return { path, changed: true, classification: existed ? "replaced" : "added" };
}

// ── Read + derive ─────────────────────────────────────────────────────────

/**
 * Ordinal (code-unit) string order — the repo's canonical collation. Deliberately NOT
 * `localeCompare`, which is culture-sensitive and linguistic, so two machines can disagree.
 */
export function ordinalCompare(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function walkJson(dir: string, out: string[]): void {
  const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) => ordinalCompare(a.name, b.name));
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walkJson(full, out);
    else if (entry.isFile() && entry.name.endsWith(".json")) out.push(full);
  }
}

export interface ShardLoadResult {
  readonly entries: readonly ManifestEntry[];
  /** Files that failed to parse or validate — surfaced, never dropped. */
  readonly rejected: readonly { readonly path: string; readonly reason: string }[];
  /** Shard files whose filename ZetaId disagrees with the `pr_number` inside them. */
  readonly misfiled: readonly { readonly path: string; readonly reason: string }[];
  /** `pr_number`s claimed by more than one shard file. Must be empty. */
  readonly duplicates: readonly number[];
}

/**
 * Read every shard. Returns entries ordered by the DERIVED-INDEX ORDERING RULE (pr_number
 * ascending, integer compare) — never readdir order, never a local clock.
 *
 * Integrity is REPORTED, not swallowed: an unparseable shard, a misfiled one (the filename's
 * ZetaId does not encode the `pr_number` inside), and a duplicated key all come back as data
 * for the caller to fail on. Silence is never read as "nothing wrong".
 */
export function loadAllShards(root: string): ShardLoadResult {
  const rejected: { path: string; reason: string }[] = [];
  const misfiled: { path: string; reason: string }[] = [];
  const byPr = new Map<number, ManifestEntry>();
  const duplicates: number[] = [];
  if (!existsSync(root)) return { entries: [], rejected, misfiled, duplicates };

  const files: string[] = [];
  walkJson(root, files);
  for (const f of files) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(f, "utf8"));
    } catch (err) {
      rejected.push({ path: f, reason: `JSON.parse failed: ${(err as Error).message}` });
      continue;
    }
    const v = validateEntry(parsed);
    if (!v.ok) {
      rejected.push({ path: f, reason: v.reason });
      continue;
    }
    const expected = shardPathFor(v.entry.pr_number, root);
    if (expected !== f) {
      misfiled.push({ path: f, reason: `pr_number ${String(v.entry.pr_number)} belongs at ${expected}` });
      continue;
    }
    if (byPr.has(v.entry.pr_number)) duplicates.push(v.entry.pr_number);
    byPr.set(v.entry.pr_number, v.entry);
  }

  const entries = [...byPr.values()].sort((a, b) => a.pr_number - b.pr_number);
  return { entries, rejected, misfiled, duplicates };
}

/**
 * The derived index: JSONL, one line per entry, `pr_number` ASCENDING by INTEGER compare,
 * trailing newline. Pure — this is the whole of the "derive, don't store" half.
 */
export function deriveManifest(entries: readonly ManifestEntry[]): string {
  const sorted = [...entries].sort((a, b) => a.pr_number - b.pr_number);
  if (sorted.length === 0) return "";
  return sorted.map(serializeManifestEntry).join("\n") + "\n";
}

/** Parse a manifest blob into entries + the lines that could not be read. */
export interface ManifestParseResult {
  readonly entries: readonly ManifestEntry[];
  readonly unparseable: readonly { readonly lineNumber: number; readonly reason: string; readonly raw: string }[];
}

export function parseManifest(blob: string): ManifestParseResult {
  const entries: ManifestEntry[] = [];
  const unparseable: { lineNumber: number; reason: string; raw: string }[] = [];
  const lines = blob.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]!;
    if (raw.trim().length === 0) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      unparseable.push({ lineNumber: i + 1, reason: `JSON.parse failed: ${(err as Error).message}`, raw });
      continue;
    }
    const v = validateEntry(parsed);
    if (!v.ok) {
      unparseable.push({ lineNumber: i + 1, reason: v.reason, raw });
      continue;
    }
    entries.push(v.entry);
  }
  return { entries, unparseable };
}

/** Serialize the quarantine sidecar. One JSON object per rejected line, reason attached. */
export function serializeUnparseable(
  rows: readonly { readonly lineNumber: number; readonly reason: string; readonly raw: string }[],
): string {
  if (rows.length === 0) return "";
  return (
    rows
      .map((r) =>
        JSON.stringify({ source: MANIFEST_RELATIVE, line_number: r.lineNumber, reason: r.reason, raw: r.raw }),
      )
      .join("\n") + "\n"
  );
}
