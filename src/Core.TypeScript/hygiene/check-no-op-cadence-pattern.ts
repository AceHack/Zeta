#!/usr/bin/env bun
/**
 * tools/hygiene/check-no-op-cadence-pattern.ts —
 * Pre-tick mechanical check for the no-op-cadence failure mode.
 *
 * TypeScript port of `check-no-op-cadence-pattern.sh` per the
 * DST-justifies-TS-quality-over-bash discipline (CLAUDE.md) +
 * 081KQGDBJ0008QG0R000A4EZS5 TypeScript standardization for non-install scripts.
 * (The bash original has since been retired — no `.sh` sibling remains, so the
 * "both are kept in sync" note that used to sit here no longer applies.)
 *
 * Usage:
 *   bun src/Core.TypeScript/hygiene/check-no-op-cadence-pattern.ts
 *   bun src/Core.TypeScript/hygiene/check-no-op-cadence-pattern.ts --enforce
 *
 * Env vars (parity with bash version):
 *   NO_OP_CHECK_WINDOW=7        — window size (last N shards)
 *   NO_OP_CHECK_THRESHOLD=5     — minimal-observation threshold
 *   NO_OP_CHECK_GAP_MINUTES=15  — shard-density gap threshold
 *
 * Exit codes:
 *   0 — no detection, or detection in the default advisory mode
 *   1 — (detection OR absent input surface) AND `--enforce`
 *   2 — unknown argument / usage error
 *
 * WHY `--enforce` IS OPT-IN (081M0085XQT087G0R003W4KFS4). Until 2026-08-14
 * this process exited 0 on every path, including both detections. The
 * warnings existed; the exit code did not. Making detection fatal by
 * default would promote an uncalibrated heuristic to a blocking gate.
 *
 * ─── MEASURED CALIBRATION (081M00G3QRA087G0R003GB0P4X, 2026-08-14) ───
 *
 * The rate was then measured, and it says DO NOT ENFORCE the threshold
 * heuristic. Two independent methods, both on the real 1209-shard history:
 *
 *   1. Commit ground truth (CLAUDE.md's own externalized idle counter),
 *      on the only 48 windows where tick shards and dated git history
 *      overlap (2026-05-28/29): the detector fired on 48 of 48 windows,
 *      and 29 of those 48 firings (60.4%) happened while substantive
 *      non-telemetry commits were landing. It fired while the fleet was
 *      demonstrably producing.
 *   2. Content: of the 890 shards the old classifier called "minimal",
 *      622 (69.9%) were >=1500 bytes and contained no minimal-observation
 *      language anywhere in the file.
 *
 * ROOT CAUSE was not a badly-chosen threshold; it was a parse mismatch —
 * see `isMinimalObservation` for the 488-shard (40.4%) forced-minimal class
 * and the repair. Post-repair the classifier flags 3.1% of shards rather
 * than 73.6%, and fires on 0 of those same 48 windows.
 *
 * NOT YET EARNED even so. Sensitivity is unmeasured: there is no labelled
 * set of known standing-by windows, so the repair is demonstrated to cut
 * false positives and is NOT demonstrated to retain true ones. Advisory
 * stays the default; `--enforce` stays unwired. Per
 * `toy-is-free-metered-must-be-earned` this detector is `unmetered`.
 *
 * AND THE SURFACE IS DEAD. `docs/hygiene-history/ticks/` has had no shard
 * since 2026-05-29 (77 days). Live ticks land in `data/tick-shards/**.json`
 * as JSON telemetry with no prose body, so the minimal-observation half has
 * no counterpart there and cannot simply be repointed. Until that routing
 * call is made (081M00G3QRA087G0R003GB0P4X), every live run of this tool
 * reports `surfaceEmpty` — which `--enforce` now treats as failure rather
 * than as a pass.
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

/**
 * Content floor, in bytes: a shard with less text than this has nothing in
 * it, whatever its format. Deliberately a *near-empty* test and NOT a
 * "substantiveness" measure — see MEASURED CALIBRATION in the header for why
 * the previous length proxy could not support the latter claim.
 */
export const MINIMAL_CONTENT_FLOOR_BYTES = 400;

/**
 * Is this shard a minimal observation?
 *
 * TWO signals, and neither is a length proxy for "did real work happen":
 *   1. the shard *says so* — explicit minimal-observation language; and
 *   2. the shard is *near-empty* — under the content floor, any format.
 *
 * WHAT THIS REPLACED, AND WHY (081M00G3QRA087G0R003GB0P4X). The previous
 * implementation read `firstLine.split("|")[4]` — the summary *cell* of a
 * markdown table row — and called any shard with a cell under 600 chars
 * "minimal". Two measured consequences on the 1209 real shards in
 * `docs/hygiene-history/ticks/`:
 *
 *   - 488 shards (40.4%) are heading-format (`# Tick shard …`), so the first
 *     line has no 5th pipe field, `body` was `""`, and EVERY one was forced
 *     to "minimal". Their median size is 3843 bytes — *larger* than the
 *     median of the class the old code was willing to call non-minimal. The
 *     detector's own largest shards were its most confident detections.
 *   - 395 more are genuine pipe rows whose one-line summary cell is of
 *     course under 600 chars, because it is a table cell.
 *
 * Net: the old classifier flagged 73.6% of all shards. This one flags 3.1%
 * (floor 200) to 13.9% (floor 600). It claims strictly less, and what it
 * still claims it can actually support.
 *
 * Unreadable is UNKNOWN, not minimal — `false` keeps an I/O error from
 * manufacturing a detection.
 */
export function isMinimalObservation(
  path: string,
  contentFloorBytes: number = MINIMAL_CONTENT_FLOOR_BYTES
): boolean {
  let content = "";
  try {
    content = readFileSync(path, "utf8");
  } catch {
    return false;
  }
  if (OBSERVATION_CLASS_REGEX.test(content)) return true;
  return content.trim().length < contentFloorBytes;
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
  /**
   * No shards at all in today+yesterday — the detector's input surface is
   * absent, so it judged NOTHING. Tracked separately because "could not run"
   * and "ran and found nothing wrong" are different answers and only one of
   * them is reassuring.
   */
  surfaceEmpty: boolean;
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
      surfaceEmpty: true,
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
    surfaceEmpty: false,
  };
}

export type CliParse =
  | { readonly kind: "run"; readonly enforce: boolean }
  | { readonly kind: "help" }
  | { readonly kind: "error"; readonly message: string };

/**
 * Closed flag set. Unknown args are fatal so a mistyped `--enforce` cannot
 * silently fall back to advisory (the original defect in argv form).
 */
export function parseCli(argv: readonly string[]): CliParse {
  let enforce = false;
  for (const arg of argv) {
    if (arg === "--enforce") {
      enforce = true;
      continue;
    }
    if (arg === "-h" || arg === "--help") return { kind: "help" };
    return { kind: "error", message: "unknown arg: " + arg };
  }
  return { kind: "run", enforce };
}

/** Either detection the warnings already name. */
export function detected(result: CheckResult): boolean {
  return result.thresholdHit || result.gapHit;
}

/**
 * The exit code the process should carry.
 *
 * Advisory (default) is always 0 — the heuristic is not calibrated well
 * enough to block, and the measured numbers in the header say so.
 *
 * `--enforce` fails on a detection OR on an ABSENT INPUT SURFACE. The second
 * clause is the one that matters and it is not defensive padding: as of
 * 2026-08-14 `docs/hygiene-history/ticks/` has had no shard since
 * 2026-05-29, so a live run finds zero shards, judges nothing, and used to
 * exit 0 — a check reporting success because its input vanished. Under
 * enforcement, "I could not run" must never be spelled the same way as "I
 * ran and it was fine".
 *
 * MUTATION: forcing `return 0`, dropping `enforce &&` (advisory would also
 * exit 1), or dropping `result.surfaceEmpty` (a dead surface would pass
 * again) each turn paired tests red.
 */
export function exitStatus(result: CheckResult, enforce: boolean): number {
  if (!enforce) return 0;
  return detected(result) || result.surfaceEmpty ? 1 : 0;
}

export const USAGE =
  "Usage: bun src/Core.TypeScript/hygiene/check-no-op-cadence-pattern.ts [--enforce]\n";

export function printReport(result: CheckResult, args: CheckArgs): void {
  if (result.surfaceEmpty) {
    console.error("");
    console.error(
      "WARNING: input-surface-absent — no tick shards for today or yesterday under"
    );
    console.error(
      "  docs/hygiene-history/ticks/. This check judged NOTHING. That is not a pass."
    );
    console.error("");
    console.error(
      "  The last shard on this surface is 2026-05-29. If ticks now land somewhere"
    );
    console.error(
      "  else (data/tick-shards/**/*.json is the live telemetry lane), this detector"
    );
    console.error(
      "  is pointed at an abandoned directory and cannot see the fleet at all."
    );
    console.error("  See 081M00G3QRA087G0R003GB0P4X for the routing decision.");
    return;
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
}

/**
 * Slide `now` across a list of instants and count how often the threshold
 * heuristic fires. Empty windows are skipped so a day with no shards cannot
 * inflate the denominator as "healthy".
 *
 * This is the calibration the work-item required before anyone arms
 * `--enforce` as a required gate. It measures the surface the detector
 * actually reads (`docs/hygiene-history/ticks/`).
 */
export function measureThresholdFires(
  repoRoot: string,
  sampleNows: readonly Date[],
  base: Omit<CheckArgs, "now">,
): { readonly windows: number; readonly fires: number } {
  let windows = 0;
  let fires = 0;
  for (const now of sampleNows) {
    const result = runCheck(repoRoot, { ...base, now });
    if (result.totalShards === 0) continue;
    windows += 1;
    if (result.thresholdHit) fires += 1;
  }
  return { windows, fires };
}

export function runCli(repoRoot: string, parsed: Extract<CliParse, { kind: "run" }>): number {
  const args: CheckArgs = {
    windowSize: parsePositiveInt("NO_OP_CHECK_WINDOW", 7),
    threshold: parsePositiveInt("NO_OP_CHECK_THRESHOLD", 5),
    gapThresholdMinutes: parsePositiveInt("NO_OP_CHECK_GAP_MINUTES", 15),
    now: new Date(),
  };
  const result = runCheck(repoRoot, args);
  printReport(result, args);
  return exitStatus(result, parsed.enforce);
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
  const parsed = parseCli(argv);
  if (parsed.kind === "help") {
    process.stdout.write(USAGE);
    return 0;
  }
  if (parsed.kind === "error") {
    process.stderr.write(parsed.message + "\n" + USAGE);
    return 2;
  }
  const repoRoot = findRepoRoot();
  process.chdir(repoRoot);
  return runCli(repoRoot, parsed);
}

if (import.meta.main) {
  process.exit(main());
}
