#!/usr/bin/env bun
/**
 * derive-pr-manifest.ts — regenerate `docs/github/prs/manifest.jsonl` from the shard store.
 *
 * The second half of 081KZYMY46P087G0R003S64V2B: the shards are the ledger, the manifest is a
 * DERIVED index. Same `derive` + drift-gate shape as `src/Core.TypeScript/ace/build-graph.ts`
 * (#10395) — regenerating must reproduce the checked-in content, so the generator IS the
 * error-correcting code (`.claude/rules/only-the-irreducible-is-primitive-generate-the-rest.md`).
 *
 *   check (default)   exit 1 on drift, printing the first differing line. Read-only.
 *   --write           rewrite the manifest from the shards. Only writes on a content change.
 *   --min-age-minutes N   in check mode, only DRIFT THAT HAS OUTLIVED N MINUTES is a failure.
 *
 * WHERE THE DRIFT GATE BELONGS — and where it does NOT.
 * A blocking PR-level gate here would be wrong: an archive PR that adds one shard makes the
 * checked-in manifest one line stale BY DESIGN, and failing that PR would recreate exactly the
 * serialization this work removes. So this is a REPAIR command for a cadence (a tick runs
 * `--write` and commits when it drifts), and a check for a human/agent verifying the store.
 * The property that keeps it honest is that repair is always mechanical: the derived file
 * carries no information the shards do not, so "regenerate" is always the correct resolution —
 * a manifest merge conflict is never hand-merged again.
 *
 * INTEGRITY IS LOUD. Unreadable, misfiled, or duplicate-keyed shards fail the run (exit 2)
 * instead of quietly producing a short manifest. A cleanup that drops a record is the
 * quiet-failure shape this repo refuses.
 *
 * MEASURING THE AGE OF DRIFT, and why plain drift is not a finding.
 * The shard store is written by every archive PR and the derived index is repaired by a
 * SINGLE serialised writer on a cadence, so at any given instant the manifest is normally a
 * few shards behind. That is the design, not a fault. `pr-manifest-integrity.yml` nonetheless
 * failed on any drift at all on its 6-hourly schedule, on the reasoning that "six hours is
 * well past the one-hour repair bound, so drift seen by a scheduled run means the repair
 * cadence has STOPPED". That inference does not hold: the check samples an INSTANT and the
 * conclusion is about a DURATION. Measured on 2026-08-22, the repair writer landed at 12:22
 * and 12:42 and the 12:34 scheduled run failed between them, reporting drift that was at most
 * twelve minutes old as having "been behind for longer than the roughly one-hour repair
 * bound". The 06:34 run failed six minutes after a successful repair.
 *
 * So the age is now MEASURED rather than assumed. Every shard carries `fetched_at`, and the
 * repair regenerates the WHOLE manifest from ALL shards — therefore if the writer ran at time
 * T, every shard that existed before T is reconciled. The age of the drift is the age of the
 * OLDEST unreconciled shard, and that number is exactly "how long ago the writer must last
 * have run". Older than the bound ⇒ the writer has stopped ⇒ red. Younger ⇒ the expected
 * transient window ⇒ green, and still reported.
 *
 * THIS IS NOT A WIDENED TOLERANCE. `--min-age-minutes` does not make drift acceptable; it
 * makes the tool measure the thing the caller was already claiming to have measured. Three
 * classes stay unconditionally red at any age, because none of them is ever by design:
 *   - shard-store integrity failures (exit 2);
 *   - ORPHANED manifest entries — a pr_number in the index with no shard behind it, which is
 *     substrate loss rather than index lag, and can never be explained by a late repair;
 *   - unreconciled shards whose `fetched_at` cannot be read as a time, because a check that
 *     cannot measure must not report a pass.
 * The sibling check in the same workflow (`reconcile-review-archive.ts --min-age-minutes 30`)
 * already had this discipline; the derived-index half is what lacked it.
 *
 * Exit codes: 0 ok · 1 drift (check mode) · 2 shard-store integrity failure · 3 usage.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";

import type { ManifestEntry } from "./pr-manifest-shards.ts";
import {
  MANIFEST_RELATIVE,
  SHARD_ROOT_RELATIVE,
  deriveManifest,
  loadAllShards,
  parseManifest,
} from "./pr-manifest-shards.ts";

export interface DeriveOptions {
  readonly root: string;
  readonly write: boolean;
  /**
   * Check mode only. When set, drift fails ONLY if the oldest unreconciled shard is older
   * than this many minutes. Absent (the default) keeps the historical behaviour — any drift
   * is a failure — so every existing caller is unaffected.
   */
  readonly minAgeMinutes?: number;
  /** Injectable clock, so the age logic is testable without waiting. Defaults to now. */
  readonly nowMs?: number;
}

export interface DeriveOutcome {
  readonly code: number;
  readonly lines: readonly string[];
}

/** First index at which two blobs' lines differ, or -1. */
export function firstDifferingLine(a: string, b: string): number {
  const la = a.split("\n");
  const lb = b.split("\n");
  const n = Math.max(la.length, lb.length);
  for (let i = 0; i < n; i++) if (la[i] !== lb[i]) return i;
  return -1;
}

/**
 * How the checked-in index differs from what the shards derive to.
 *
 * `unreconciled` are shards the index has not caught up with (missing or stale line) — the
 * class that a late repair legitimately explains. `orphanedPrNumbers` are index lines with no
 * shard behind them, which a repair can never explain because the repair regenerates from the
 * shards: if a shard vanished, the ledger lost a record.
 */
export interface DriftClassification {
  readonly unreconciled: readonly ManifestEntry[];
  readonly orphanedPrNumbers: readonly number[];
  /** Lines of the checked-in manifest that could not be parsed at all. */
  readonly unparseableLines: readonly number[];
}

export function classifyDrift(
  currentBlob: string,
  derived: readonly ManifestEntry[],
): DriftClassification {
  const parsed = parseManifest(currentBlob);
  const currentByPr = new Map<number, ManifestEntry>();
  for (const e of parsed.entries) currentByPr.set(e.pr_number, e);

  const derivedPrs = new Set<number>();
  const unreconciled: ManifestEntry[] = [];
  for (const d of derived) {
    derivedPrs.add(d.pr_number);
    const cur = currentByPr.get(d.pr_number);
    // Compare the SERIALISED line, which is what the manifest actually stores, so a changed
    // field (state flipping to MERGED, a new commit_sha) counts as unreconciled too.
    if (cur === undefined || serializeOne(cur) !== serializeOne(d)) unreconciled.push(d);
  }

  const orphanedPrNumbers: number[] = [];
  for (const pr of currentByPr.keys()) if (!derivedPrs.has(pr)) orphanedPrNumbers.push(pr);

  return {
    unreconciled,
    orphanedPrNumbers: orphanedPrNumbers.sort((a, b) => a - b),
    unparseableLines: parsed.unparseable.map((u) => u.lineNumber),
  };
}

/** One entry's canonical manifest line. Kept local so the comparison cannot drift. */
function serializeOne(e: ManifestEntry): string {
  return deriveManifest([e]).trimEnd();
}

export interface DriftAge {
  /** Age in minutes of the OLDEST unreconciled shard, or null when there are none. */
  readonly oldestMinutes: number | null;
  /** pr_numbers whose `fetched_at` could not be read as a time. Never reported as a pass. */
  readonly untimedPrNumbers: readonly number[];
}

export function driftAge(c: DriftClassification, nowMs: number): DriftAge {
  let oldestMs: number | null = null;
  const untimed: number[] = [];
  for (const e of c.unreconciled) {
    const t = Date.parse(e.fetched_at);
    if (Number.isNaN(t)) {
      untimed.push(e.pr_number);
      continue;
    }
    if (oldestMs === null || t < oldestMs) oldestMs = t;
  }
  return {
    oldestMinutes: oldestMs === null ? null : (nowMs - oldestMs) / 60000,
    untimedPrNumbers: untimed.sort((a, b) => a - b),
  };
}

export function runDerive(opts: DeriveOptions): DeriveOutcome {
  const out: string[] = [];
  const shardRoot = join(opts.root, SHARD_ROOT_RELATIVE);
  const manifestPath = join(opts.root, MANIFEST_RELATIVE);

  const loaded = loadAllShards(shardRoot);
  if (loaded.rejected.length > 0 || loaded.misfiled.length > 0 || loaded.duplicates.length > 0) {
    for (const r of loaded.rejected) out.push(`::error::unreadable shard ${r.path}: ${r.reason}`);
    for (const m of loaded.misfiled) out.push(`::error::misfiled shard ${m.path}: ${m.reason}`);
    for (const d of loaded.duplicates) out.push(`::error::duplicate pr_number across shards: ${String(d)}`);
    return { code: 2, lines: out };
  }

  const next = deriveManifest(loaded.entries);
  const current = existsSync(manifestPath) ? readFileSync(manifestPath, "utf8") : "";
  const inSync = current === next;

  if (opts.write) {
    if (inSync) out.push(`${MANIFEST_RELATIVE} already current (${String(loaded.entries.length)} entries).`);
    else {
      writeFileSync(manifestPath, next, "utf8");
      out.push(`${MANIFEST_RELATIVE} rewritten from ${String(loaded.entries.length)} shards.`);
    }
    return { code: 0, lines: out };
  }

  if (inSync) {
    out.push(
      `${MANIFEST_RELATIVE} is in sync with ${SHARD_ROOT_RELATIVE} (${String(loaded.entries.length)} entries). ✓`,
    );
    return { code: 0, lines: out };
  }
  const i = firstDifferingLine(current, next);
  const detail: string[] = [
    `  first difference at line ${String(i + 1)}`,
    `  checked-in: ${(current.split("\n")[i] ?? "(missing)").slice(0, 160)}`,
    `  derived:    ${(next.split("\n")[i] ?? "(missing)").slice(0, 160)}`,
    `  repair: bun src/Core.TypeScript/forge-host/github/derive-pr-manifest.ts --write`,
  ];

  // Historical behaviour, unchanged, when no bound is supplied: any drift is a failure.
  if (opts.minAgeMinutes === undefined) {
    out.push(`::error::${MANIFEST_RELATIVE} has drifted from ${SHARD_ROOT_RELATIVE}.`);
    out.push(...detail);
    return { code: 1, lines: out };
  }

  const cls = classifyDrift(current, loaded.entries);
  const age = driftAge(cls, opts.nowMs ?? Date.now());

  // Substrate loss and unmeasurable timestamps are never explained by a late repair.
  if (cls.orphanedPrNumbers.length > 0) {
    out.push(
      `::error::${MANIFEST_RELATIVE} carries ${String(cls.orphanedPrNumbers.length)} entr(y/ies) with no shard behind them — the ledger lost a record. This is not index lag and no repair bound excuses it.`,
    );
    out.push(`  orphaned pr_numbers: ${cls.orphanedPrNumbers.slice(0, 20).join(", ")}`);
    out.push(...detail);
    return { code: 1, lines: out };
  }
  if (cls.unparseableLines.length > 0) {
    out.push(
      `::error::${MANIFEST_RELATIVE} has ${String(cls.unparseableLines.length)} unparseable line(s); the drift age cannot be measured, so this is not reported as a pass.`,
    );
    out.push(`  first unparseable line: ${String(cls.unparseableLines[0] ?? -1)}`);
    return { code: 1, lines: out };
  }
  if (age.untimedPrNumbers.length > 0) {
    out.push(
      `::error::${String(age.untimedPrNumbers.length)} unreconciled shard(s) have an unreadable fetched_at, so the drift age cannot be measured. A check that cannot measure must not report a pass.`,
    );
    out.push(`  pr_numbers: ${age.untimedPrNumbers.slice(0, 20).join(", ")}`);
    return { code: 1, lines: out };
  }

  const oldest = age.oldestMinutes;
  // Drift with nothing unreconciled and nothing orphaned means the two blobs differ only in
  // ORDERING or formatting — a derived-file bug, not lag. Fail; a bound cannot excuse it.
  if (oldest === null) {
    out.push(
      `::error::${MANIFEST_RELATIVE} differs from the derived index although every shard is reconciled and none is orphaned — the difference is ordering or formatting, which no repair cadence produces.`,
    );
    out.push(...detail);
    return { code: 1, lines: out };
  }

  const oldestStr = oldest.toFixed(1);
  if (oldest > opts.minAgeMinutes) {
    out.push(
      `::error::${MANIFEST_RELATIVE} has been behind ${SHARD_ROOT_RELATIVE} for ${oldestStr} minutes, past the ${String(opts.minAgeMinutes)}-minute repair bound — the serialised repair writer has stopped landing.`,
    );
    out.push(`  ${String(cls.unreconciled.length)} unreconciled shard(s); oldest fetched_at is ${oldestStr} min old`);
    out.push(...detail);
    return { code: 1, lines: out };
  }

  out.push(
    `${MANIFEST_RELATIVE} is ${String(cls.unreconciled.length)} shard(s) behind ${SHARD_ROOT_RELATIVE}, oldest ${oldestStr} min — within the ${String(opts.minAgeMinutes)}-minute repair bound. Expected transient lag; the repair writer is keeping up. ✓`,
  );
  return { code: 0, lines: out };
}

function usage(): string {
  return [
    "derive-pr-manifest — regenerate docs/github/prs/manifest.jsonl from docs/github/prs/shards/",
    "",
    "  (no flags)   check mode: exit 1 on drift, 2 on shard-store integrity failure",
    "  --write      rewrite the manifest from the shards",
    "  --root DIR   repo root (default: cwd)",
    "  --min-age-minutes N   check mode: fail only when drift is older than N minutes.",
    "                        Integrity, orphaned entries and unmeasurable timestamps still",
    "                        fail at any age.",
  ].join("\n");
}

export function main(argv: readonly string[]): number {
  if (argv.includes("--help") || argv.includes("-h")) {
    process.stdout.write(usage() + "\n");
    return 0;
  }
  const rootIdx = argv.indexOf("--root");
  const rootArg = rootIdx >= 0 ? argv[rootIdx + 1] : undefined;
  if (rootIdx >= 0 && (rootArg === undefined || rootArg.startsWith("--"))) {
    process.stderr.write("--root requires a value\n");
    return 3;
  }
  const ageIdx = argv.indexOf("--min-age-minutes");
  let minAgeMinutes: number | undefined;
  if (ageIdx >= 0) {
    const raw = argv[ageIdx + 1];
    // Refuse a malformed bound rather than defaulting it: a silently-ignored bound would
    // restore the exact any-drift-fails behaviour this flag exists to correct, and the
    // caller would have no way to tell.
    if (raw === undefined || raw.startsWith("--")) {
      process.stderr.write("--min-age-minutes requires a value\n");
      return 3;
    }
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) {
      process.stderr.write(`--min-age-minutes must be a non-negative number, got: ${raw}\n`);
      return 3;
    }
    minAgeMinutes = n;
  }
  const outcome = runDerive({
    root: resolve(rootArg ?? process.cwd()),
    write: argv.includes("--write"),
    ...(minAgeMinutes === undefined ? {} : { minAgeMinutes }),
  });
  for (const l of outcome.lines) {
    if (l.startsWith("::error::")) process.stderr.write(l + "\n");
    else process.stdout.write(l + "\n");
  }
  return outcome.code;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
