#!/usr/bin/env bun
/**
 * backfill-tick-shards.ts — one-time (but idempotent) migration of the pre-shard
 * data/tick-history.json into per-write shards under data/tick-shards/.
 *
 * Before sharding, data/tick-history.json WAS the ledger: every frame ever computed
 * lived only in that file. Demoting it to a bounded derived rollup without first
 * exploding its frames into shards would silently discard history the moment the bound
 * kicked in. This script is that explosion, run once at migration time.
 *
 * Safe to re-run: `shardPathFor` derives BOTH halves of the path from the frame itself —
 * the date directory from the frame's `t`, and the filename from the frame's ZetaId, which
 * is in turn a pure function of that same `t` plus a digest of the content. So
 * re-backfilling an already-backfilled frame rewrites the same bytes at the same path
 * (discipline #6 — apply-N-times == apply-once), and the id a historical frame receives is
 * the id it would have received when it was first written — no mint time is invented.
 *
 * This is also the migration path for a naming change: delete the shard tree, re-run, and
 * every frame is re-keyed with its content preserved byte-for-byte (used 2026-08-13 to move
 * from the ad-hoc `<HHMMSSmmm>-<sha256[0:8]>` names to ZetaId names).
 *
 * Usage:
 *   bun src/Core.TypeScript/observe/backfill-tick-shards.ts [--dry-run]
 *
 * Exit codes:
 *   0 — migrated (or nothing to migrate); or --dry-run completed
 *   1 — data/tick-history.json exists but cannot be parsed
 *   2 — UNRECOGNISED ARGUMENT: refused before any shard was written
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { loadAllShards, shardPathFor, writeShard, type MetricsFrame } from "./tick-shards";

const REPO_ROOT = process.cwd();
const HISTORY_FILE = join(REPO_ROOT, "data", "tick-history.json");
const SHARD_ROOT = join(REPO_ROOT, "data", "tick-shards");

/** Every argument this tool understands. There are no positionals and no value-taking flags. */
export const ACCEPTED_FLAGS: readonly string[] = ["--dry-run"];

/**
 * FAIL CLOSED ON AN UNRECOGNISED ARGUMENT — 081M03HRHBS087G0R001HRAFQ0.
 *
 * `argv.includes("--dry-run")` asks one question and reads EVERY other string as consent to
 * write: `--dry-runn`, `--dryrun` and `--help` all meant "backfill for real". PR #10832 probed a
 * sibling tool with `--help` and started a ~1,700-file rewrite.
 *
 * The write here is idempotent (`shardPathFor` derives the path from the frame), so a stray run
 * is recoverable — which is exactly why it would have gone unnoticed. Idempotence makes a wrong
 * invocation quiet, not harmless: it still writes into `data/tick-shards/` under the caller's
 * cwd, which need not be a repo that has ever had shards.
 *
 * Returned, not `process.exit`ed, because `main` is a pure-ish function the tests call directly —
 * the exit code is applied once, at the `import.meta.main` boundary.
 */
export function firstUnknownArg(argv: readonly string[]): string | null {
  for (const arg of argv) {
    if (!ACCEPTED_FLAGS.includes(arg)) return arg;
  }
  return null;
}

export function main(argv: readonly string[]): number {
  const unknown = firstUnknownArg(argv);
  if (unknown !== null) {
    process.stderr.write(
      `unknown arg: ${unknown}\n` +
        `[backfill] REFUSED — nothing was written. Accepted: ${ACCEPTED_FLAGS.join(" ")}\n`,
    );
    return 2;
  }
  const dryRun = argv.includes("--dry-run");
  if (!existsSync(HISTORY_FILE)) {
    process.stdout.write("[backfill] no data/tick-history.json — nothing to migrate\n");
    return 0;
  }
  let frames: readonly MetricsFrame[];
  try {
    const parsed = JSON.parse(readFileSync(HISTORY_FILE, "utf-8")) as { frames?: readonly MetricsFrame[] };
    frames = parsed.frames ?? [];
  } catch (err) {
    process.stderr.write(`[backfill] cannot parse ${HISTORY_FILE}: ${String(err)}\n`);
    return 1;
  }

  const before = loadAllShards(SHARD_ROOT).length;
  let written = 0;
  let skipped = 0;
  for (const frame of frames) {
    if (typeof frame?.t !== "string") {
      skipped++;
      continue;
    }
    if (dryRun) {
      process.stdout.write(`would write ${shardPathFor(frame, SHARD_ROOT).replace(REPO_ROOT + "/", "")}\n`);
      written++;
      continue;
    }
    writeShard(frame, SHARD_ROOT);
    written++;
  }
  const after = dryRun ? before : loadAllShards(SHARD_ROOT).length;
  process.stdout.write(
    `[backfill] ${frames.length} rollup frames → ${written} shard writes ` +
      `(${skipped} skipped as malformed); shard set ${before} → ${after}\n`,
  );
  return 0;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
