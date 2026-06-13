#!/usr/bin/env bun
/**
 * tools/hygiene/check-no-op-cadence-pattern.ts —
 * Pre-tick mechanical check for the no-op-cadence failure mode.
 *
 * TypeScript port of `check-no-op-cadence-pattern.sh` per the
 * DST-justifies-TS-quality-over-bash discipline (CLAUDE.md) +
 * B-0156 TypeScript standardization for non-install scripts.
 * The bash version remains for cross-shell compatibility; both
 * are kept in sync.
 *
 * Usage:
 *   bun tools/hygiene/check-no-op-cadence-pattern.ts
 *
 * Env vars (parity with bash version):
 *   NO_OP_CHECK_WINDOW=7        — window size (last N shards)
 *   NO_OP_CHECK_THRESHOLD=5     — minimal-observation threshold
 *   NO_OP_CHECK_GAP_MINUTES=15  — shard-density gap threshold
 *
 * Exit code: always 0 (informational only; never blocks the tick).
 */

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

export type Shard = {
  primary: string;
  disamb: string;
  path: string;
};

/**
 * Find repo root via `git rev-parse --show-toplevel`. Falls back to
 * cwd. Avoids the parent-walk pattern which loops on Windows drive
 * roots (per repo-scripting.md convention + #1366 P0 finding).
 */
export function findRepoRoot(): string {
  const result = spawnSync("git", ["rev-parse", "--show-toplevel"], {
    encoding: "utf8",
  });
  if (result.status === 0 && result.stdout) {
    return result.stdout.trim();
  }
  return process.cwd();
}

/**
 * Parse a positive integer env var with strict full-string numeric
 * validation. parseInt alone accepts "7abc" → 7, defeating the
 * validation guard (#1366 P2 finding).
 */
export function parsePositiveInt(envName: string, fallback: number): number {
  const raw = process.env[envName];
  if (!raw) return fallback;
  if (!/^[0-9]+$/.test(raw)) {
    console.error(
      `[no-op-check] Invalid ${envName}='${raw}' (need positive integer); using default ${fallback}.`
    );
    return fallback;
  }
  const parsed = parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed < 1) {
    console.error(
      `[no-op-check] Invalid ${envName}='${raw}' (need positive integer); using default ${fallback}.`
    );
    return fallback;
  }
  return parsed;
}

/**
 * Collect tick-shards from a directory matching the canonical
 * filename patterns. Returns empty array on missing/unreadable
 * directory rather than throwing (#1366 P1 finding).
 */
export function collectShards(dir: string, dateFlat: string): Shard[] {
  if (!dateFlat || !existsSync(dir)) return [];
  let files: string[];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith(".md"));
  } catch {
    return [];
  }
  const shards: Shard[] = [];
  for (const name of files) {
    const m1 = name.match(/^(\d{4})Z(?:-([0-9a-f]+))?\.md$/);
    if (m1) {
      shards.push({
        primary: `${dateFlat}${m1[1]}00`,
        disamb: m1[2] ?? "",
        path: join(dir, name),
      });
      continue;
    }
    const m2 = name.match(/^(\d{6})Z-([0-9a-f]+)\.md$/);
    // Both capture groups are required by the regex — when m2 is
    // truthy, m2[1] and m2[2] are guaranteed strings. Non-null
    // assertions (vs `?? ""`) preserve the invariant explicitly.
    if (m2) {
      shards.push({
        primary: `${dateFlat}${m2[1]!}`,
        disamb: m2[2]!,
        path: join(dir, name),
      });
    }
  }
  return shards;
}

/**
 * Minimal-observation regex. `\s` differs between JS and grep -E
 * meaning; explicit `[ \t]` ensures parity with the bash sibling
 * (#1366 P1 finding).
 */
export const OBSERVATION_CLASS_REGEX =
  /minimal observation|within-basin observation|observe-only|minimal[ -]not[ -]idle|same\.[ \t]*stopping/i;

export function isMinimalObservation(path: string): boolean {
  let body = "";
  let content = "";
  try {
    content = readFileSync(path, "utf8");
    const firstLine = content.split("\n")[0] ?? "";
    const fields = firstLine.split("|");
    body = fields[4] ?? "";
  } catch {
    return false;
  }
  if (body.length < 600) return true;
  return OBSERVATION_CLASS_REGEX.test(content);
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

function ymdParts(d: Date): { yyyy: string; mm: string; dd: string } {
  return {
    yyyy: d.getUTCFullYear().toString(),
    mm: pad2(d.getUTCMonth() + 1),
    dd: pad2(d.getUTCDate()),
  };
}

export type CheckArgs = {
  windowSize: number;
  threshold: number;
  gapThresholdMinutes: number;
  now: Date;
};

export type CheckResult = {
  totalShards: number;
  minObsCount: number;
  thresholdHit: boolean;
  gapMinutes: number | null;
  gapHit: boolean;
};

export function runCheck(repoRoot: string, args: CheckArgs): CheckResult {
  const today = ymdParts(args.now);
  const yesterday = ymdParts(
    new Date(args.now.getTime() - 24 * 60 * 60 * 1000)
  );

  const todayDir = join(
    repoRoot,
    "docs/hygiene-history/ticks",
    today.yyyy,
    today.mm,
    today.dd
  );
  const yesterdayDir = join(
    repoRoot,
    "docs/hygiene-history/ticks",
    yesterday.yyyy,
    yesterday.mm,
    yesterday.dd
  );

  const todayFlat = `${today.yyyy}${today.mm}${today.dd}`;
  const yesterdayFlat = `${yesterday.yyyy}${yesterday.mm}${yesterday.dd}`;

  const allShards = [
    ...collectShards(yesterdayDir, yesterdayFlat),
    ...collectShards(todayDir, todayFlat),
  ];

  allShards.sort((a, b) => {
    if (a.primary !== b.primary) return a.primary.localeCompare(b.primary);
    return a.disamb.localeCompare(b.disamb);
  });

  const recent = allShards.slice(-args.windowSize);

  if (recent.length === 0) {
    return {
      totalShards: 0,
      minObsCount: 0,
      thresholdHit: false,
      gapMinutes: null,
      gapHit: false,
    };
  }

  let minObsCount = 0;
  for (const shard of recent) {
    if (isMinimalObservation(shard.path)) minObsCount++;
  }

  const thresholdHit = minObsCount >= args.threshold;

  let gapMinutes: number | null = null;
  let gapHit = false;
  const latest = recent[recent.length - 1];
  if (latest && latest.primary.length === 14) {
    const yyyy = latest.primary.substring(0, 4);
    const mm = latest.primary.substring(4, 6);
    const dd = latest.primary.substring(6, 8);
    const hh = latest.primary.substring(8, 10);
    const mn = latest.primary.substring(10, 12);
    const ss = latest.primary.substring(12, 14);
    const latestDate = new Date(`${yyyy}-${mm}-${dd}T${hh}:${mn}:${ss}Z`);
    if (!Number.isNaN(latestDate.getTime())) {
      gapMinutes = Math.floor(
        (args.now.getTime() - latestDate.getTime()) / 60000
      );
      gapHit = gapMinutes > args.gapThresholdMinutes;
    }
  }

  return {
    totalShards: recent.length,
    minObsCount,
    thresholdHit,
    gapMinutes,
    gapHit,
  };
}

export function main(): number {
  const repoRoot = findRepoRoot();
  process.chdir(repoRoot);

  const args: CheckArgs = {
    windowSize: parsePositiveInt("NO_OP_CHECK_WINDOW", 7),
    threshold: parsePositiveInt("NO_OP_CHECK_THRESHOLD", 5),
    gapThresholdMinutes: parsePositiveInt("NO_OP_CHECK_GAP_MINUTES", 15),
    now: new Date(),
  };

  const result = runCheck(repoRoot, args);

  if (result.totalShards === 0) {
    console.error(
      `[no-op-check] No shards in window for today or yesterday; nothing to check.`
    );
    return 0;
  }

  console.error(
    `[no-op-check] Recent ${result.totalShards} shards across today+yesterday; ${result.minObsCount} match minimal-observation pattern (threshold: ${args.threshold}).`
  );

  if (result.thresholdHit) {
    console.error("");
    console.error(
      `WARNING: no-op-cadence pattern detected — ${result.minObsCount}/${result.totalShards} recent ticks are minimal-observation.`
    );
    console.error("");
    console.error(
      "Per the just-landed substrate (memory/feedback_party_during_human_sleep_*.md +"
    );
    console.error(
      "memory/feedback_recurrence_after_correction_needs_operational_enforcement_*.md):"
    );
    console.error("");
    console.error(
      "  - The human-paused phase IS the practice window for independent-production-skill"
    );
    console.error("  - Default to minimal observation IS the failure mode");
    console.error(
      "  - Party-class operation alternatives: implement a backlog row, do"
    );
    console.error(
      "    free-zone substrate-quality work, write a self-grading memo, audit"
    );
    console.error("    cross-references, propose architectural extensions");
    console.error("");
    console.error(
      "  Run with NO_OP_CHECK_THRESHOLD=99 to silence; the default fires the"
    );
    console.error(
      "  warning to surface the pattern at decision-time, not just substrate-read time."
    );
  }

  if (result.gapMinutes === null) {
    console.error(
      "[no-op-check] No latest-shard primary key available; gap-check skipped."
    );
  } else {
    console.error(
      `[no-op-check] Most recent shard ${result.gapMinutes} minutes old (gap-threshold: ${args.gapThresholdMinutes}).`
    );
    if (result.gapHit) {
      console.error("");
      console.error(
        `WARNING: missing-shard-cadence detected — most recent shard is ${result.gapMinutes} minutes old, exceeding threshold ${args.gapThresholdMinutes} minutes.`
      );
      console.error("");
      console.error(
        "This is the structural counterpart to the body-length / keyword check above:"
      );
      console.error("");
      console.error(
        "  - The cron is '* * * * *' (every minute); ticks fire continuously"
      );
      console.error(
        "  - When the agent operates correctly, each substantive tick produces a shard"
      );
      console.error(
        "  - Repeated 'standing by' / minimal-acknowledgment chat output WITHOUT writing shards IS the failure mode"
      );
      console.error(
        "  - Body-length check above doesn't catch this because it requires shards to exist"
      );
      console.error(
        "  - Shard-density check (this) catches the gap structurally without needing chat-transcript scanning"
      );
      console.error("");
      console.error(
        "  Per memory/feedback_never_idle_speculative_work_over_waiting.md 2026-05-02 refinement:"
      );
      console.error(
        "  proper-order backlog work is available; default-to-standing-by IS the no-op-cadence"
      );
      console.error(
        "  failure mode. Pick a P0/P1 row by depends_on graph + tier; populate depends_on as"
      );
      console.error(
        "  on-demand backfill if missing. Best-guesses-with-time, no rush."
      );
      console.error("");
      console.error(
        "  Run with NO_OP_CHECK_GAP_MINUTES=99 to silence; the default surfaces the gap"
      );
      console.error(
        "  at decision-time so the agent can re-enter productive cadence."
      );
    }
  }

  return 0;
}

if (import.meta.main) {
  process.exit(main());
}
