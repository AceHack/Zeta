#!/usr/bin/env bun
/**
 * migrate-pr-archive-buckets.ts — move the flat PR-review archive into dated
 * `YYYY/MM/DD/` buckets and correct every shard that points at it, in ONE change.
 *
 * 081M28KFAGV087G0R000BKEAZK. Modelled on `migrate-pr-manifest-to-shards.ts`, which is
 * re-runnable for exactly this reason.
 *
 * RE-RUNNABLE, INTERRUPTIBLE, RESUMABLE. Every step is an upsert keyed on `pr_number`:
 *   - a record already at its target path is a NO-OP (not a move, not a rewrite);
 *   - a shard whose `archive_path` is already correct is not rewritten (`writeShard`
 *     compares first);
 *   - so running it twice writes the same bytes to the same paths, and killing it halfway
 *     leaves a tree the next run finishes. There is no "partially migrated" state that
 *     needs unwinding — only a prefix of the work already done.
 *
 * NOTHING IS DROPPED. A record whose filename does not parse, or whose shard is missing or
 * unreadable, is NOT moved and NOT deleted. It stays exactly where it is and is written to
 * `docs/history/pr-reviews/unmigrated.jsonl` WITH its reason. A migration that silently
 * loses the records it could not understand is the quiet-failure shape this repo refuses;
 * the sidecar is where a human finds them.
 *
 * WHY THE SHARDS MOVE IN THE SAME COMMIT. All 14,378 shards carry an `archive_path` naming
 * the flat location. Moving bodies without correcting shards breaks the index; correcting
 * shards without moving bodies breaks it the other way. Neither half is separately
 * releasable, so the tool does both or neither.
 *
 * WHY `git mv` AND NOT `mv`. The rename is recorded in the index, so `git log --follow`
 * and `git blame` cross it. Sources are grouped by destination directory and passed in
 * batches, so this is ~120 spawns rather than 14,378.
 *
 * VERIFICATION IS PART OF THE RUN. After moving, the tool re-reads every shard and checks
 * that the file its `archive_path` names is present on disk. A migration that reports
 * success without checking its own output is a check that cannot fail.
 *
 *   bun src/Core.TypeScript/forge-host/github/migrate-pr-archive-buckets.ts [--root DIR]
 *       [--dry-run] [--verify-only] [--limit N]
 *
 *   --dry-run      report what would move; touch nothing
 *   --verify-only  skip moving; only check every shard's archive_path resolves on disk
 *   --limit N      migrate at most N records (for a staged landing)
 *
 * Exit codes: 0 ok · 1 verification failed · 2 records could not be migrated · 3 usage.
 */

import { mkdirSync, renameSync, statSync } from "node:fs";
import { resolve } from "node:path";

import { readFileBounded, spawnArgv, writeFileOwned } from "../../io/safe-io.ts";
import {
  SHARD_ROOT_RELATIVE,
  loadAllShards,
  ordinalCompare,
  shardPathFor,
  writeShard,
  type ManifestEntry,
} from "./pr-manifest-shards.ts";
import {
  ARCHIVE_ROOT_RELATIVE,
  bucketFor,
  prNumberOfArchiveFileName,
  walkArchiveDocs,
} from "./pr-archive-paths.ts";

/** 0o644 — the mode repo files carry; the safe-io writers default to 0o600. */
const REPO_FILE_MODE = 0o644;

/** Where records that could not be migrated are recorded, with their reason. */
export const UNMIGRATED_RELATIVE = `${ARCHIVE_ROOT_RELATIVE}/unmigrated.jsonl`;

/**
 * Sources per `git mv` invocation. 200 × ~90 bytes is ~18 KB of argv, comfortably under
 * every platform's ARG_MAX, and turns 14,378 spawns into ~80.
 */
const MV_BATCH = 200;

export interface PlannedMove {
  readonly prNumber: number;
  readonly from: string;
  readonly to: string;
  readonly dated: boolean;
  readonly reason: string;
}

export interface UnmigratedRecord {
  readonly path: string;
  readonly reason: string;
}

export interface Plan {
  readonly moves: readonly PlannedMove[];
  readonly alreadyPlaced: number;
  readonly unmigrated: readonly UnmigratedRecord[];
}

/**
 * Decide, for every archive body on disk, where it belongs — without touching anything.
 *
 * PURE given (the file listing, the shard set). No clock and no network, so a plan replays
 * identically: the bucket comes from each PR's own `merged_at`, never from today.
 */
export function planMigration(
  docs: readonly string[],
  shards: ReadonlyMap<number, ManifestEntry>,
  limit: number,
): Plan {
  const moves: PlannedMove[] = [];
  const unmigrated: UnmigratedRecord[] = [];
  let alreadyPlaced = 0;

  for (const rel of [...docs].sort(ordinalCompare)) {
    const fileName = rel.slice(rel.lastIndexOf("/") + 1);
    const prNumber = prNumberOfArchiveFileName(fileName);
    if (prNumber === null) {
      unmigrated.push({
        path: `${ARCHIVE_ROOT_RELATIVE}/${rel}`,
        reason: "filename is not PR-<number>-<slug>.md — cannot be keyed to a PR, left in place",
      });
      continue;
    }
    const shard = shards.get(prNumber);
    if (shard === undefined) {
      unmigrated.push({
        path: `${ARCHIVE_ROOT_RELATIVE}/${rel}`,
        reason: `no shard for PR #${String(prNumber)} — its merge date is unknown, left in place`,
      });
      continue;
    }
    const decision = bucketFor(shard.merged_at);
    const toRel = `${decision.bucket}/${fileName}`;
    if (toRel === rel) {
      alreadyPlaced++;
      continue;
    }
    if (moves.length >= limit) break;
    moves.push({
      prNumber,
      from: `${ARCHIVE_ROOT_RELATIVE}/${rel}`,
      to: `${ARCHIVE_ROOT_RELATIVE}/${toRel}`,
      dated: decision.dated,
      reason: decision.reason,
    });
  }
  return { moves, alreadyPlaced, unmigrated };
}

/** Group moves by destination directory so `git mv` can take many sources at once. */
function groupByDestDir(moves: readonly PlannedMove[]): Map<string, PlannedMove[]> {
  const out = new Map<string, PlannedMove[]>();
  for (const m of moves) {
    const dir = m.to.slice(0, m.to.lastIndexOf("/"));
    const bucket = out.get(dir);
    if (bucket === undefined) out.set(dir, [m]);
    else bucket.push(m);
  }
  return out;
}

function gitMvBatch(repoRoot: string, sources: readonly string[], destDir: string): string | null {
  // `-k` skips a source git cannot move (already moved by a prior interrupted run) rather
  // than aborting the whole batch. The verification pass is what catches a real miss — a
  // skip that mattered shows up there as a shard pointing at nothing.
  const r = spawnArgv("git", ["-C", repoRoot, "mv", "-k", ...sources, `${destDir}/`], {
    timeoutMs: 120_000,
  });
  if (!r.ok) return r.error.message;
  if (r.value.status !== 0) return r.value.stderr.trim() || `git mv exited ${String(r.value.status)}`;
  return null;
}

export interface ApplyResult {
  readonly moved: number;
  readonly shardsUpdated: number;
  readonly failures: readonly string[];
}

/** Perform the planned moves and correct the shards that point at them. */
export function applyMigration(repoRoot: string, plan: Plan, shardRootAbs: string, useGit: boolean): ApplyResult {
  const failures: string[] = [];
  let moved = 0;

  for (const [destDir, group] of [...groupByDestDir(plan.moves)].sort((a, b) => ordinalCompare(a[0], b[0]))) {
    mkdirSync(resolve(repoRoot, destDir), { recursive: true });
    if (useGit) {
      for (let i = 0; i < group.length; i += MV_BATCH) {
        const slice = group.slice(i, i + MV_BATCH);
        const err = gitMvBatch(repoRoot, slice.map((m) => m.from), destDir);
        if (err !== null) failures.push(`git mv into ${destDir}: ${err}`);
        else moved += slice.length;
      }
    } else {
      for (const m of group) {
        try {
          renameSync(resolve(repoRoot, m.from), resolve(repoRoot, m.to));
          moved++;
        } catch (err) {
          failures.push(`${m.from}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }
  }

  // SHARDS IN THE SAME PASS. `writeShard` is an upsert keyed on `pr_number` and skips a
  // byte-identical write, so a re-run touches nothing.
  let shardsUpdated = 0;
  for (const m of plan.moves) {
    const read = readShardFor(shardRootAbs, m.prNumber);
    if (read === null) {
      failures.push(`PR #${String(m.prNumber)}: shard vanished between plan and apply`);
      continue;
    }
    const next: ManifestEntry = { ...read, archive_path: m.to };
    const w = writeShard(next, shardRootAbs);
    if (w.changed) shardsUpdated++;
  }
  return { moved, shardsUpdated, failures };
}

function readShardFor(shardRootAbs: string, prNumber: number): ManifestEntry | null {
  // `shardPathFor` is the one place the number -> path map lives; never re-derived here.
  const read = readFileBounded(shardPathFor(prNumber, shardRootAbs), { maxBytes: 8 * 1024 * 1024 });
  if (!read.ok) return null;
  try {
    return JSON.parse(read.value.text) as ManifestEntry;
  } catch {
    return null;
  }
}

export interface VerifyResult {
  readonly checked: number;
  readonly missing: readonly string[];
  readonly flatRemaining: number;
}

/**
 * Every shard's `archive_path` must name a file that exists.
 *
 * This is the falsifier for the whole migration: if a body moved and its shard did not
 * (or the reverse), exactly one side points at nothing and this reports it by PR number.
 */
export function verifyMigration(repoRoot: string, shardRootAbs: string): VerifyResult {
  const loaded = loadAllShards(shardRootAbs);
  const missing: string[] = [];
  let checked = 0;
  let flatRemaining = 0;
  for (const e of loaded.entries) {
    checked++;
    const p = resolve(repoRoot, e.archive_path);
    try {
      statSync(p);
    } catch {
      missing.push(`PR #${String(e.pr_number)}: archive_path ${e.archive_path} is not on disk`);
      continue;
    }
    const rest = e.archive_path.slice(`${ARCHIVE_ROOT_RELATIVE}/`.length);
    if (!rest.includes("/")) flatRemaining++;
  }
  return { checked, missing, flatRemaining };
}

// ── CLI ───────────────────────────────────────────────────────────────────

interface Args {
  root: string;
  dryRun: boolean;
  verifyOnly: boolean;
  limit: number;
  useGit: boolean;
}

export function parseArgs(argv: readonly string[]): Args | string {
  const a: Args = { root: process.cwd(), dryRun: false, verifyOnly: false, limit: Infinity, useGit: true };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--root") {
      const v = argv[++i];
      if (v === undefined) return "--root requires a value";
      a.root = v;
    } else if (arg === "--dry-run") a.dryRun = true;
    else if (arg === "--verify-only") a.verifyOnly = true;
    else if (arg === "--no-git") a.useGit = false;
    else if (arg === "--limit") {
      const v = argv[++i];
      const n = Number(v);
      if (v === undefined || !Number.isSafeInteger(n) || n <= 0) return `--limit must be a positive integer, got: ${String(v)}`;
      a.limit = n;
    } else return `unknown argument: ${String(arg)}`;
  }
  return a;
}

function main(): void {
  const parsed = parseArgs(process.argv.slice(2));
  if (typeof parsed === "string") {
    process.stderr.write(`${parsed}\n`);
    process.exit(3);
  }
  const repoRoot = resolve(parsed.root);
  const shardRootAbs = resolve(repoRoot, SHARD_ROOT_RELATIVE);
  const archiveRootAbs = resolve(repoRoot, ARCHIVE_ROOT_RELATIVE);

  if (parsed.verifyOnly) {
    const v = verifyMigration(repoRoot, shardRootAbs);
    process.stdout.write(`verified ${String(v.checked)} shards; ${String(v.missing.length)} broken; ${String(v.flatRemaining)} still flat\n`);
    for (const m of v.missing.slice(0, 50)) process.stdout.write(`  ${m}\n`);
    process.exit(v.missing.length === 0 ? 0 : 1);
  }

  const loaded = loadAllShards(shardRootAbs);
  const shards = new Map<number, ManifestEntry>();
  for (const e of loaded.entries) shards.set(e.pr_number, e);

  const docs = walkArchiveDocs(archiveRootAbs);
  const plan = planMigration(docs, shards, parsed.limit);

  process.stdout.write(
    `archive bodies: ${String(docs.length)} · shards: ${String(shards.size)}\n` +
      `to move: ${String(plan.moves.length)} · already placed: ${String(plan.alreadyPlaced)} · unmigrated: ${String(plan.unmigrated.length)}\n`,
  );
  const buckets = new Set(plan.moves.map((m) => m.to.slice(0, m.to.lastIndexOf("/"))));
  process.stdout.write(`destination directories: ${String(buckets.size)}\n`);
  for (const u of plan.unmigrated) process.stdout.write(`  UNMIGRATED ${u.path}: ${u.reason}\n`);

  if (parsed.dryRun) {
    for (const m of plan.moves.slice(0, 10)) process.stdout.write(`  ${m.from} -> ${m.to}\n`);
    if (plan.moves.length > 10) process.stdout.write(`  ... and ${String(plan.moves.length - 10)} more\n`);
    process.exit(0);
  }

  // The sidecar is written on EVERY run, including a run with nothing to report, so its
  // absence is never mistaken for "there was nothing to say".
  const sidecar = plan.unmigrated.map((u) => JSON.stringify(u)).join("\n");
  const sidecarWrite = writeFileOwned(resolve(repoRoot, UNMIGRATED_RELATIVE), sidecar === "" ? "" : `${sidecar}\n`, {
    mode: REPO_FILE_MODE,
  });
  if (!sidecarWrite.ok) {
    process.stderr.write(`cannot write ${UNMIGRATED_RELATIVE}: ${sidecarWrite.error.message}\n`);
    process.exit(2);
  }

  const applied = applyMigration(repoRoot, plan, shardRootAbs, parsed.useGit);
  process.stdout.write(`moved ${String(applied.moved)} · shards updated ${String(applied.shardsUpdated)}\n`);
  for (const f of applied.failures.slice(0, 50)) process.stdout.write(`  FAILURE ${f}\n`);

  const v = verifyMigration(repoRoot, shardRootAbs);
  process.stdout.write(
    `verification: ${String(v.checked)} shards checked · ${String(v.missing.length)} broken · ${String(v.flatRemaining)} still flat\n`,
  );
  for (const m of v.missing.slice(0, 50)) process.stdout.write(`  BROKEN ${m}\n`);

  if (v.missing.length > 0) process.exit(1);
  if (applied.failures.length > 0) process.exit(2);
  process.exit(0);
}

if (import.meta.main) main();
