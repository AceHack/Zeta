#!/usr/bin/env bun
/**
 * vm-churn.ts — attach a load profile to the next `pmap_recycle_page` panic.
 *
 * WHY THIS EXISTS, AND WHY IT IS NOT ABOUT FINDING THE CAUSE
 * ---------------------------------------------------------------------------
 * The cause is known. Apple's own panic report says it:
 *
 *     panic(cpu 9, caller 0xfffffe003b811358): pmap_recycle_page:
 *         page 0x11226018000 is referenced @pmap_data.c:2334
 *     Kernel version: Darwin 25.5.0 xnu-12377.121.10~1 RELEASE_ARM64_T6020
 *     secure boot?: YES     roots installed: 0
 *     Compressor Info: 0% of compressed pages limit (OK), 0 swapfiles, OK swap
 *
 * That is an XNU bug in the physical-map layer: the kernel tried to recycle a
 * physical page that still held live references and failed its own invariant.
 * `roots installed: 0` with secure boot on rules out third-party kernel code;
 * `0% compressor, 0 swapfiles` rules out memory pressure.
 *
 * So the open question is not *what* fails. It is **under what conditions**.
 * Four panics on 2026-08-24 (05:46, 07:41, 08:17, 09:29), the last three with
 * an identical kernel backtrace, load average **64.91 at nine minutes uptime**.
 * The working hypothesis is extreme concurrent VM churn — many Electron
 * renderers plus agent processes mapping and unmapping pages — widening a race
 * window that is otherwise almost never hit.
 *
 * This module records the numbers that make that hypothesis testable, so the
 * next panic arrives with a load profile attached instead of a guess.
 *
 * THE MEASUREMENT THAT ACTUALLY DISCRIMINATES
 * ---------------------------------------------------------------------------
 * `Cursor Helper (Renderer)` was the panicking task in three of four. That is
 * the process that was **on-CPU when the assertion fired** — which on a
 * page-recycle path may mean it is the trigger, or may only mean it is the one
 * that happened to be holding the page when the race lost. A single panic
 * cannot tell those apart, and neither can four.
 *
 * What can, over several panics: **which application dominates VM churn**, not
 * which one died. If Cursor is the trigger, its share of mapping activity
 * should be high in the seconds before every panic. If it is merely the most
 * numerous mapper of pages and therefore the most likely bystander, its share
 * will look like its share always looks. So this records per-application
 * process counts, thread counts and resident bytes ALONGSIDE the system-wide
 * VM rates, and leaves the inference to whoever reads several of them.
 *
 * That is the same discipline as
 * `.claude/rules/dual-use-detection-is-neutral-oracle-decides.md`: report the
 * fact (`Cursor held 61% of resident bytes and 43% of threads`), never the
 * verdict (`Cursor did it`).
 *
 * PURE. Everything here takes strings and numbers and returns numbers.
 */

/**
 * The `vm_stat` counters that are CUMULATIVE since boot, and therefore only
 * meaningful as a rate.
 *
 * `Translation faults` and `Pages copy-on-write` are the two that matter most
 * for this bug: both count pmap entries being created and destroyed, which is
 * the activity `pmap_recycle_page` sits at the end of. A high steady rate of
 * them is what "VM churn" means concretely, rather than as a feeling.
 */
export const CUMULATIVE_VM_COUNTERS: readonly string[] = [
  "Translation faults",
  "Pages copy-on-write",
  "Pages zero filled",
  "Pages reactivated",
  "Pages purged",
  "Decompressions",
  "Compressions",
  "Pageins",
  "Pageouts",
  "Swapins",
  "Swapouts",
];

/** Short keys for the NDJSON line, so a day of samples is not mostly field names. */
export const VM_COUNTER_KEYS: Readonly<Record<string, string>> = {
  "Translation faults": "xlat",
  "Pages copy-on-write": "cow",
  "Pages zero filled": "zfill",
  "Pages reactivated": "react",
  "Pages purged": "purge",
  Decompressions: "decomp",
  Compressions: "comp",
  Pageins: "pgin",
  Pageouts: "pgout",
  Swapins: "swin",
  Swapouts: "swout",
};

export interface ChurnRates {
  /** Per-second rates, keyed by the short names above. */
  readonly perSecond: Readonly<Record<string, number>>;
  /** Seconds the rates were measured over. */
  readonly intervalS: number;
}

/**
 * Rates between two cumulative readings.
 *
 * Returns **null** when there is no previous reading, when the interval is
 * non-positive, or when a counter went backwards (which happens across a
 * reboot, since these reset).
 *
 * Null, not zero. A first sample that reported `0 faults/s` would be
 * indistinguishable from a genuinely idle machine, and the first sample after
 * a boot is exactly the one a crash investigation reads. Same rule as
 * `signal-death.ts`: the absence of a measurement is not a measurement of
 * absence.
 */
export function churnRates(
  prev: ReadonlyMap<string, number> | null,
  prevMs: number | null,
  now: ReadonlyMap<string, number>,
  nowMs: number,
): ChurnRates | null {
  if (prev === null || prevMs === null) return null;
  const intervalS = (nowMs - prevMs) / 1000;
  if (intervalS <= 0) return null;
  const perSecond: Record<string, number> = {};
  for (const name of CUMULATIVE_VM_COUNTERS) {
    const a = prev.get(name);
    const b = now.get(name);
    const key = VM_COUNTER_KEYS[name];
    if (a === undefined || b === undefined || key === undefined) continue;
    // A counter that went backwards means the kernel it was counting is gone.
    // Reporting a negative rate, or clamping it to zero, would both be lies.
    if (b < a) return null;
    perSecond[key] = Math.round((b - a) / intervalS);
  }
  return { perSecond, intervalS };
}

/**
 * Application buckets.
 *
 * Ordered, and the order is load-bearing: `Cursor Helper (Renderer)` must be
 * attributed to `cursor` before the generic `electron` rule can claim it, and
 * a `node` inside an app bundle is that app's, not the agent fleet's.
 */
export const APP_RULES: readonly { readonly app: string; readonly test: RegExp }[] = [
  { app: "cursor", test: /Cursor\.app\/|^Cursor( Helper.*)?$/ },
  { app: "claude", test: /Claude\.app\/|^claude$|^Claude( Helper.*)?$/ },
  { app: "chatgpt", test: /ChatGPT\.app\// },
  { app: "chrome", test: /Google Chrome/ },
  { app: "adobe", test: /Adobe|Creative Cloud/ },
  { app: "plex", test: /Plex/ },
  // Apple's own memory-heavy indexers, which are NOT ours and are worth
  // separating so they do not inflate the "everything else" bucket.
  { app: "apple-index", test: /mds_stores|mdworker|Spotlight|WebKit\.WebContent|corespotlightd/ },
  { app: "agent", test: /^(bun|node|dotnet|git|rg|tsc|clang|cc|ld|fsc|forge|MSBuild|VBCSCompiler)$/ },
  { app: "electron", test: /Electron|Helper \(Renderer\)|Helper \(GPU\)/ },
];

export function classifyApp(commOrPath: string): string {
  const base = commOrPath.slice(commOrPath.lastIndexOf("/") + 1);
  for (const r of APP_RULES) {
    if (r.test.test(commOrPath) || r.test.test(base)) return r.app;
  }
  return "other";
}

export interface AppFootprint {
  readonly procs: number;
  readonly threads: number;
  readonly rssMb: number;
}

export interface ProcRow {
  readonly pid: number;
  readonly rssKb: number;
  readonly comm: string;
}

/** Parse `ps -Ao pid=,rss=,comm=`. The command may contain spaces. */
export function parsePsRows(text: string): readonly ProcRow[] {
  const out: ProcRow[] = [];
  for (const line of text.split("\n")) {
    const m = /^\s*(\d+)\s+(\d+)\s+(.*\S)\s*$/.exec(line);
    if (m === null) continue;
    const pid = m[1];
    const rss = m[2];
    const comm = m[3];
    if (pid === undefined || rss === undefined || comm === undefined) continue;
    out.push({ pid: Number.parseInt(pid, 10), rssKb: Number.parseInt(rss, 10), comm });
  }
  return out;
}

/**
 * Parse `ps -AM` into a pid -> thread-count map.
 *
 * THE FORMAT, because it is not what it looks like. `ps -AM` prints a header,
 * then for each process one SUMMARY line (`user pid tt %cpu ... command`)
 * followed by one line per thread (`      pid  %cpu ...`, no user, no
 * command). So the pid is the first numeric token on both kinds of line, and
 * the thread count is (lines bearing that pid) MINUS ONE for the summary.
 *
 * Cross-checked against an independent source rather than assumed: pid 2799
 * (`Cursor Helper`) yields 17 lines, and `top -l 1 -pid 2799 -stats th`
 * reports **16**. Off-by-one confirmed and subtracted.
 *
 * `ps -AM -o pid=` does NOT work and is worth recording as a trap: macOS `ps`
 * writes `ps: thcount: keyword not found`-style complaints to stderr for
 * unsupported `-o` keywords, and for `-M` it ignores the format entirely and
 * prints the default columns anyway. The first version of this parser asked
 * for `-o pid=`, got the full default output, matched almost nothing, and
 * every process silently fell back to a thread count of 1 — a plausible number
 * that was never measured.
 *
 * Measured cost ~70 ms for ~6,500 threads, affordable at 1 Hz.
 */
export function parseThreadCounts(text: string): ReadonlyMap<number, number> {
  const lines = new Map<number, number>();
  for (const line of text.split("\n")) {
    if (line.trim().length === 0) continue;
    // Skip the header: it has no numeric token before the word PID.
    const m = /(?:^|\s)(\d+)(?:\s|$)/.exec(line);
    if (m === null) continue;
    const raw = m[1];
    if (raw === undefined) continue;
    // A user name never contains digits at the start of the line in practice,
    // but the header does contain `%CPU`; requiring a standalone integer token
    // and taking the FIRST one lands on the pid for both line kinds.
    const pid = Number.parseInt(raw, 10);
    lines.set(pid, (lines.get(pid) ?? 0) + 1);
  }
  const out = new Map<number, number>();
  for (const [pid, n] of lines) {
    // One line is the process summary, not a thread. Never report 0.
    out.set(pid, Math.max(1, n - 1));
  }
  return out;
}

/** Fold processes and threads into per-application footprints. */
export function appFootprints(
  rows: readonly ProcRow[],
  threads: ReadonlyMap<number, number>,
): Readonly<Record<string, AppFootprint>> {
  const acc: Record<string, { procs: number; threads: number; rssKb: number }> = {};
  for (const r of rows) {
    const app = classifyApp(r.comm);
    const e = acc[app] ?? { procs: 0, threads: 0, rssKb: 0 };
    e.procs += 1;
    e.rssKb += r.rssKb;
    // A pid with no thread rows contributes 1, not 0: every process has at
    // least one thread, and a census that can report zero threads for a live
    // process is reporting a parse failure as a fact.
    e.threads += threads.get(r.pid) ?? 1;
    acc[app] = e;
  }
  const out: Record<string, AppFootprint> = {};
  for (const [app, e] of Object.entries(acc)) {
    out[app] = { procs: e.procs, threads: e.threads, rssMb: Math.round(e.rssKb / 1024) };
  }
  return out;
}

/**
 * The share of resident memory an application holds.
 *
 * This is the number that, across several panics, separates "Cursor is the
 * trigger" from "Cursor is the most likely bystander". It is reported as a
 * fact and carries no verdict.
 */
export function residentShare(f: Readonly<Record<string, AppFootprint>>, app: string): number {
  let total = 0;
  for (const v of Object.values(f)) total += v.rssMb;
  if (total === 0) return 0;
  return (f[app]?.rssMb ?? 0) / total;
}

/** One compact line for a human reading a vitals tail. */
export function describeFootprints(f: Readonly<Record<string, AppFootprint>>): string {
  return Object.entries(f)
    .filter(([, v]) => v.procs > 0)
    .sort((a, b) => b[1].rssMb - a[1].rssMb)
    .map(([k, v]) => `${k}:${v.procs}p/${v.threads}t/${v.rssMb}M`)
    .join(" ");
}
