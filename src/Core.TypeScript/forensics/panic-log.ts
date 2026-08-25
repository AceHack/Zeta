#!/usr/bin/env bun
/**
 * panic-log.ts — find, parse and compare macOS kernel panic reports.
 *
 * THE BUG THIS MODULE EXISTS BECAUSE OF
 * ---------------------------------------------------------------------------
 * The investigation that preceded this file concluded "No `.panic` files in
 * `/Library/Logs/DiagnosticReports/`". There were three, and they contained
 * the root cause. They were in `/Library/Logs/DiagnosticReports/Retired/` —
 * the subdirectory macOS moves reports into as it ages them out. A search that
 * did not recurse found nothing, and nothing was reported as "no panics
 * happened" rather than as "I did not look there".
 *
 * That is the exact shape `signal-death.ts` was written against, moved from a
 * process to a directory: **an empty result and a result you failed to obtain
 * are different values.** So `findPanicReports` searches BOTH directories and
 * returns which ones it could actually read, and the caller reports
 * unreadable-or-absent distinctly from empty.
 *
 * WHAT THE THREE REPORTS SAID (2026-08-24, AceHacks-Mac-Studio)
 * ---------------------------------------------------------------------------
 *     05:46:58  pmap_remove_range_options: ... wired count underflow @pmap.c:5072
 *     07:41:09  pmap_recycle_page: page 0x109bba68000 is referenced @pmap_data.c:2334
 *     08:17:54  pmap_recycle_page: page 0x10758888000 is referenced @pmap_data.c:2334
 *
 * All three are the kernel's PHYSICAL PAGE MAP disagreeing with its own
 * reference accounting: a wired-page counter that went below zero, and twice a
 * page handed to the recycler while a mapping still referenced it. All three
 * panicked inside a `Cursor` process.
 *
 * The two `pmap_recycle_page` panics share 25 of their 26 de-slid kernel
 * frames, INCLUDING the whole leading sequence through the faulting call. They
 * differ at frame 24 (`0x1d2194` vs `0x1d2330`, 0x19c apart) — deep in the
 * stack, far below the fault. Stated precisely because the first version of
 * this comment claimed the odd frame out was the userspace return address,
 * which was wrong: the userspace frame is filtered before comparison, and the
 * real difference is a genuine kernel frame. The corrected reading is the more
 * useful one anyway — the PANIC SITE is identical and the deep stack is not,
 * which is what `panicSiteSignature` below exists to express.
 *
 * Not one of `bun`, `node`, `dotnet`, `git`, `claude` or `forge` appears in
 * any of the three. That is the load hypothesis being REFUTED rather than
 * confirmed, which is the more useful outcome.
 *
 * COMPARING PANICS REQUIRES DE-SLIDING
 * ---------------------------------------------------------------------------
 * Kernel addresses differ every boot (KASLR), so two panics in the same
 * function have completely different `lr:` values. Subtracting
 * `Kernel text exec base` turns them into stable offsets, and only then can
 * "is this the same crash again?" be asked mechanically. Comparing raw
 * addresses would report every repeat as a new, unrelated panic.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/** Every directory macOS puts panic reports in. `Retired/` is the one that hid them. */
export function panicSearchDirs(): readonly string[] {
  return [
    "/Library/Logs/DiagnosticReports",
    "/Library/Logs/DiagnosticReports/Retired",
    join(homedir(), "Library/Logs/DiagnosticReports"),
    join(homedir(), "Library/Logs/DiagnosticReports/Retired"),
  ];
}

export interface PanicSearchResult {
  readonly paths: readonly string[];
  /** Directories that exist and were listed. */
  readonly searched: readonly string[];
  /** Directories that do not exist or could not be listed. NOT the same as empty. */
  readonly unsearchable: readonly string[];
}

export function findPanicReports(dirs: readonly string[] = panicSearchDirs()): PanicSearchResult {
  const paths: string[] = [];
  const searched: string[] = [];
  const unsearchable: string[] = [];
  for (const d of dirs) {
    // One syscall, and its failure IS the answer. An `existsSync` gate here
    // would be both a TOCTOU race and a worse report: it cannot distinguish
    // "absent" from "present but unreadable", and this function's whole
    // contract is that `unsearchable` and `found none` are different values.
    let names: string[];
    try {
      names = readdirSync(d);
    } catch {
      unsearchable.push(d);
      continue;
    }
    for (const n of names) {
      // `.contents.panic` is a macOS bookkeeping stub, not a report.
      if (n.endsWith(".panic") && !n.startsWith(".")) paths.push(join(d, n));
    }
    searched.push(d);
  }
  return { paths, searched, unsearchable };
}

export interface ParsedPanic {
  readonly path: string;
  readonly timestamp: string;
  readonly osVersion: string;
  readonly product: string;
  /** The first line of `panicString` — the assertion that fired. */
  readonly panicLine: string;
  /** The source file and line the kernel named, when it named one. */
  readonly sourceSite: string | null;
  readonly cpu: number | null;
  /** The process that was on-CPU. NOT necessarily the culprit — see below. */
  readonly panickedTask: string | null;
  /** KASLR-independent backtrace: `lr` minus `Kernel text exec base`. */
  readonly backtraceOffsets: readonly string[];
  readonly lastStartedKext: string | null;
  readonly bytes: number;
}

function firstLine(s: string): string {
  const i = s.indexOf("\n");
  return (i < 0 ? s : s.slice(0, i)).trim();
}

/**
 * Parse one `.panic` file.
 *
 * The format is a one-line JSON header, a newline, then a JSON body. Reading
 * it as a single JSON document fails; this trips people up and is why the
 * partition below is explicit.
 */
export function parsePanicReport(path: string, text: string): ParsedPanic | null {
  const nl = text.indexOf("\n");
  if (nl < 0) return null;
  let header: Record<string, unknown> = {};
  let body: Record<string, unknown> = {};
  try {
    header = JSON.parse(text.slice(0, nl)) as Record<string, unknown>;
    body = JSON.parse(text.slice(nl + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
  const ps = typeof body["panicString"] === "string" ? (body["panicString"] as string) : "";
  const baseMatch = /Kernel text exec base:\s*(0x[0-9a-fA-F]+)/.exec(ps);
  // BIGINT, NOT NUMBER. A kernel address like 0xfffffe00392b1808 is ~1.8e19,
  // far past Number.MAX_SAFE_INTEGER (~9.0e15). `Number.parseInt` on it
  // silently drops the low bits, so every offset came out page-aligned
  // (`0x55000` instead of `0x55808`) and two DIFFERENT frames in the same page
  // compared equal. Caught by the fixture test that pins the real offsets;
  // without that test this would have quietly widened "same backtrace" to
  // "same 4 KB page" and grouped unrelated panics together.
  const base = baseMatch?.[1] === undefined ? null : BigInt(baseMatch[1]);
  const offsets: string[] = [];
  if (base !== null) {
    for (const m of ps.matchAll(/lr:\s*(0x[0-9a-fA-F]+)/g)) {
      const raw = m[1];
      if (raw === undefined) continue;
      const v = BigInt(raw);
      // Userspace frames are not slid by the kernel base; excluding them is
      // what makes two runs of the same kernel bug compare equal.
      if (v < base) continue;
      offsets.push(`0x${(v - base).toString(16)}`);
    }
  }
  const cpuM = /panic\(cpu (\d+)/.exec(ps);
  const taskM = /Panicked task[^\n]*?pid \d+: ([^\n]+)/.exec(ps);
  const siteM = /@([A-Za-z0-9_./]+\.c:\d+)/.exec(ps);
  const kextM = /last started kext at \d+:\s*([^\s]+\s+[^\s]+)/.exec(ps);
  return {
    path,
    timestamp: typeof header["timestamp"] === "string" ? (header["timestamp"] as string) : "",
    osVersion: typeof header["os_version"] === "string" ? (header["os_version"] as string) : "",
    product: typeof body["product"] === "string" ? (body["product"] as string) : "",
    panicLine: firstLine(ps),
    sourceSite: siteM?.[1] ?? null,
    cpu: cpuM?.[1] === undefined ? null : Number.parseInt(cpuM[1], 10),
    panickedTask: taskM?.[1]?.trim() ?? null,
    backtraceOffsets: offsets,
    lastStartedKext: kextM?.[1]?.trim() ?? null,
    bytes: text.length,
  };
}

export function readPanicReport(path: string): ParsedPanic | null {
  try {
    // Panic files reach 4.6 MB; reading them is fine, but only on demand.
    return parsePanicReport(path, readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

/**
 * How many leading frames define "the same panic".
 *
 * Frames 0..5 are the panic/debugger machinery itself and are identical in
 * every panic on the machine, so a prefix shorter than that would group
 * everything. Frames 6..7 are the faulting function and its caller — the part
 * that actually identifies the bug. Eight is the smallest prefix that
 * discriminates the two DIFFERENT pmap panics observed here (`pmap.c:5072`
 * vs `pmap_data.c:2334`) while still grouping the two instances of the same
 * one, whose deep stacks diverge at frame 24.
 */
export const PANIC_SITE_FRAMES = 8;

/**
 * The grouping key: the panic site, not the whole stack.
 *
 * Comparing entire backtraces is too strict — the same kernel bug reached
 * through slightly different deep call paths reports as two unrelated
 * incidents, which is precisely the mistake that makes a reproducible bug look
 * like random hardware decay. Comparing only the panic handler is too loose —
 * everything matches. The site is the middle, and it is derived from a
 * measurement rather than picked.
 */
export function panicSiteSignature(p: ParsedPanic): string | null {
  if (p.backtraceOffsets.length < PANIC_SITE_FRAMES) return null;
  return p.backtraceOffsets.slice(0, PANIC_SITE_FRAMES).join(",");
}

/** True when two panics faulted at the same site. Null-safe: no signature, no match. */
export function samePanicSite(a: ParsedPanic, b: ParsedPanic): boolean {
  const x = panicSiteSignature(a);
  const y = panicSiteSignature(b);
  return x !== null && y !== null && x === y;
}

/**
 * Two panics are "the same" when their de-slid KERNEL backtraces match.
 *
 * Deliberately compares only the kernel frames (`parsePanicReport` already
 * dropped userspace ones), because the userspace return address is slid by a
 * different ASLR base and differs between two instances of the identical bug.
 * Comparing it would report every repeat as unique — which is how a
 * reproducible kernel bug gets filed as three unrelated incidents.
 */
export function sameKernelBacktrace(a: ParsedPanic, b: ParsedPanic): boolean {
  if (a.backtraceOffsets.length === 0 || b.backtraceOffsets.length === 0) return false;
  if (a.backtraceOffsets.length !== b.backtraceOffsets.length) return false;
  return a.backtraceOffsets.every((x, i) => x === b.backtraceOffsets[i]);
}

/** Number of leading frames two panics share. Frames 0..5 are the panic handler itself. */
export function sharedFramePrefix(a: ParsedPanic, b: ParsedPanic): number {
  let n = 0;
  while (
    n < a.backtraceOffsets.length &&
    n < b.backtraceOffsets.length &&
    a.backtraceOffsets[n] === b.backtraceOffsets[n]
  ) {
    n += 1;
  }
  return n;
}

export interface PanicGroup {
  readonly signature: string;
  readonly count: number;
  readonly tasks: readonly string[];
  readonly timestamps: readonly string[];
}

/**
 * Group panics by their de-slid backtrace. A group of size > 1 is a
 * REPRODUCIBLE kernel bug, which is a very different thing from N random
 * memory faults and should be reported as such.
 */
export function groupPanics(panics: readonly ParsedPanic[]): readonly PanicGroup[] {
  const map = new Map<string, { tasks: string[]; timestamps: string[] }>();
  for (const p of panics) {
    // Grouped by SITE, not by the whole stack — see `panicSiteSignature`. A
    // panic too short to have a site keeps its full backtrace as its key so it
    // can never silently merge into a group it was not shown to belong to.
    const sig = panicSiteSignature(p) ?? `full:${p.backtraceOffsets.join(",")}`;
    const e = map.get(sig) ?? { tasks: [], timestamps: [] };
    if (p.panickedTask !== null) e.tasks.push(p.panickedTask);
    e.timestamps.push(p.timestamp);
    map.set(sig, e);
  }
  const out: PanicGroup[] = [];
  for (const [signature, e] of map) {
    out.push({
      signature,
      count: e.timestamps.length,
      tasks: Array.from(new Set(e.tasks)),
      timestamps: e.timestamps,
    });
  }
  return out.sort((a, b) => b.count - a.count);
}

/** File size + mtime, for the artifact manifest. */
export function panicFileStat(path: string): { bytes: number; mtimeMs: number } | null {
  try {
    const s = statSync(path);
    return { bytes: s.size, mtimeMs: s.mtimeMs };
  } catch {
    return null;
  }
}
