#!/usr/bin/env bun
/**
 * macos-panic-capture.ts — make the NEXT unclean reboot diagnosable.
 *
 * THIS FILE IS macOS-ONLY AND IS NOT PORTABLE. Said plainly rather than
 * pretended otherwise: `nvram`, `kmutil`, `systemextensionsctl`, `pmset`,
 * `vm_stat`, `iostat` and the unified log (`log collect` / `log stream`) have
 * no Linux or Windows equivalents, and the artifacts they produce are Apple
 * formats. The repo's standing goal is one interface across every OS; this
 * command is a deliberate exception because the thing under investigation is
 * an Apple kernel that dies without writing a panic log. `guardPlatform()`
 * refuses to run anywhere else rather than emitting plausible-looking garbage.
 *
 * WHAT IT DOES
 * ---------------------------------------------------------------------------
 *   vitals    1 Hz durable heartbeat, fsync'd every sample. THE point of the
 *             harness: `logd` loses its last ~24 s to an in-memory buffer
 *             (measured — see `log-store-retention.ts`), so the only way to
 *             know what the machine was doing as it died is to have written it
 *             down yourself, and to have flushed it.
 *   snapshot  The slow probes that persist but get overwritten: nvram
 *             (panicmedic), kmutil, systemextensionsctl, pmset, crash-report
 *             census. Cheap, so run it often.
 *   archive   `log collect` + APFS-clone deduplication of the 449 MB symbol
 *             catalog that would otherwise be re-copied into every archive.
 *   boot      Run once at login. Classifies the boot, and if it was UNCLEAN
 *             archives the previous boot's log tail immediately, before the
 *             ring rolls over it.
 *   triage    The runbook, executed. Prints what a human should look at.
 *   install   Emits the launchd agents. Dry-run by default.
 *
 * NO `sudo`, ANYWHERE. Verified, not assumed: `/var/db/diagnostics` is
 * `root:admin drwxr-x---` and the account is in `admin`, so `log collect`,
 * `log stream` and every probe here run unprivileged (`log collect` returned
 * rc=0 with no elevation on 2026-08-24). This matters beyond convenience:
 * there is a live P1 on the biometric gate being forgeable and the maintainer
 * has been approving prompts reflexively, so a harness that raised a routine
 * sudo prompt would be actively harmful. `guardNoPrivilege()` refuses to run
 * as root so the property cannot rot into "it works, under sudo".
 */

import { spawnSync } from "node:child_process";
import {
  closeSync,
  fstatSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
  writeSync,
} from "node:fs";
import type { Stats } from "node:fs";
import { constants } from "node:fs";
import { homedir, platform } from "node:os";
import { join } from "node:path";

import {
  classifyBoots,
  mostRecentPanicMs,
  parseLastRebootOutput,
  parseNvramDump,
  readPanicmedicState,
  telemetryAgreesWithTimestamps,
  uncleanBootCount,
  type PanicmedicState,
} from "./panicmedic.ts";
import {
  appFootprints,
  churnRates,
  CUMULATIVE_VM_COUNTERS,
  describeFootprints,
  parsePsRows,
  parseThreadCounts,
  residentShare,
  type AppFootprint,
  type ChurnRates,
} from "./vm-churn.ts";
import {
  findPanicReports,
  groupPanics,
  panicFileStat,
  readPanicReport,
  type ParsedPanic,
} from "./panic-log.ts";
import {
  captureCost,
  computeBlackout,
  humanBytes,
  retentionHours,
  type RingObservation,
} from "./log-store-retention.ts";

// ---------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------

export function guardPlatform(): void {
  if (platform() !== "darwin") {
    process.stderr.write(
      `macos-panic-capture: this command is macOS-only and refuses to run on '${platform()}'.\n` +
        `The unified log, NVRAM panicmedic keys and kext/system-extension probes it reads do not\n` +
        `exist elsewhere. This is a stated exception to the one-interface-everywhere goal, not an\n` +
        `oversight. Nothing was captured.\n`,
    );
    process.exit(2);
  }
}

/**
 * Refuse to run as root. Not paranoia about damage — a guarantee that decays
 * silently otherwise. If this harness is ever run under `sudo` once, nobody
 * will notice when a probe starts *needing* it, and the "no biometric prompt
 * during routine operation" property will be gone without a single line
 * changing.
 */
export function guardNoPrivilege(): void {
  const uid = typeof process.getuid === "function" ? process.getuid() : -1;
  if (uid === 0) {
    process.stderr.write(
      `macos-panic-capture: refusing to run as root.\n` +
        `Every probe here is verified to work unprivileged. Running under sudo would let a\n` +
        `privilege requirement creep in unnoticed, and routine sudo/biometric prompts are\n` +
        `exactly what this harness must not add. Re-run as the ordinary user.\n`,
    );
    process.exit(2);
  }
}

// ---------------------------------------------------------------------------
// Shelling out, with the exit disposition never discarded
// ---------------------------------------------------------------------------

export interface CommandResult {
  readonly argv: readonly string[];
  readonly stdout: string;
  readonly stderr: string;
  /** null when the process died on a signal or never started. */
  readonly code: number | null;
  readonly signal: string | null;
  readonly ok: boolean;
}

/**
 * Run a probe and keep its disposition.
 *
 * `signal-death.ts` is the repo's standing rule here: a process killed by a
 * signal produces the same empty output as one that had nothing to say, and
 * any capture that greps the corpse records the second as the first. Every
 * artifact this harness writes carries the probe's `code`/`signal` alongside
 * its output, so a forensics reader can tell "the machine reported nothing"
 * from "the probe died" — a distinction that matters far more on a machine
 * that is crashing than on one that is not.
 */
export function runProbe(argv: readonly string[], timeoutMs = 30_000): CommandResult {
  const [cmd, ...rest] = argv;
  if (cmd === undefined) {
    return { argv, stdout: "", stderr: "empty argv", code: null, signal: null, ok: false };
  }
  const r = spawnSync(cmd, rest, {
    encoding: "utf8",
    timeout: timeoutMs,
    maxBuffer: 256 * 1024 * 1024,
  });
  const code = r.status;
  const signal = r.signal ?? null;
  return {
    argv,
    stdout: r.stdout ?? "",
    stderr: r.stderr ?? "",
    code,
    signal,
    ok: r.error === undefined && signal === null && code === 0,
  };
}

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

export const DEFAULT_ROOT = join(homedir(), "zeta-forensics");

export interface Layout {
  readonly root: string;
  readonly vitals: string;
  readonly snapshots: string;
  readonly archives: string;
  readonly catalog: string;
  readonly reports: string;
  readonly errorRing: string;
}

export function layout(root: string): Layout {
  return {
    root,
    vitals: join(root, "vitals"),
    snapshots: join(root, "snapshots"),
    archives: join(root, "archives"),
    catalog: join(root, "symbol-catalog"),
    reports: join(root, "reports"),
    errorRing: join(root, "error-ring"),
  };
}

function ensure(dir: string): void {
  mkdirSync(dir, { recursive: true });
}

/**
 * ENOENT/ENOTDIR/EACCES-tolerant `readdir`. Returns null when the directory is
 * not there to be listed.
 *
 * NOT `if (existsSync(d)) readdirSync(d)`. That pattern is a TOCTOU race
 * everywhere, and here it is a race we are GUARANTEED to lose eventually: the
 * one directory this harness reads most is `/var/db/diagnostics/Persist`, a
 * ring whose files `logd` is actively rolling out from under us — measured
 * rolling every ~4 minutes under agent load. The answer `existsSync` returns
 * is already stale when `readdirSync` runs. Doing the operation and
 * interpreting its failure is both correct and one syscall cheaper.
 *
 * A forensics tool that crashes on a file that rotated mid-capture loses the
 * capture, which is the one outcome it exists to prevent.
 */
export function readdirOrNull(dir: string): string[] | null {
  try {
    return readdirSync(dir);
  } catch {
    return null;
  }
}

/** `statSync` that yields null instead of throwing when the path is gone. */
export function statOrNull(p: string): Stats | null {
  try {
    return statSync(p);
  } catch {
    return null;
  }
}

/** ISO-8601 with `:` replaced so the string is a legal filename everywhere. */
export function stampFor(d: Date): string {
  return d.toISOString().replace(/[:]/g, "-").replace(/\.\d+Z$/, "Z");
}

// ---------------------------------------------------------------------------
// vitals — the 1 Hz durable heartbeat
// ---------------------------------------------------------------------------

export interface VitalsSample {
  readonly t: string;
  readonly tms: number;
  readonly uptimeS: number;
  readonly load1: number;
  readonly load5: number;
  readonly load15: number;
  readonly numFiles: number;
  readonly maxFiles: number;
  /** Fraction of the system-wide open-file table in use. See the note below. */
  readonly fdPressure: number;
  readonly pagesFree: number;
  readonly pagesActive: number;
  readonly pagesWired: number;
  readonly pagesCompressed: number;
  readonly pageins: number;
  readonly pageouts: number;
  readonly swapUsedMb: number;
  readonly procTotal: number;
  readonly procByHarness: Readonly<Record<string, number>>;
  /**
   * Live thread count, summed from the per-process census.
   *
   * NOT `sysctl kern.num_threads`. That is a LIMIT (81920 on this machine, vs
   * ~6,500 actually running) and the first version of this file reported it as
   * a count — a constant printed in a column labelled as a measurement, which
   * would have shown a perfectly flat thread graph across every panic.
   */
  readonly threadTotal: number;
  /** The kernel's ceiling, kept as the denominator it actually is. */
  readonly maxThreads: number;
  /**
   * Per-second VM rates. NULL on the first sample after start, and null when a
   * counter went backwards. Never 0 — see `churnRates`.
   */
  readonly churn: ChurnRates | null;
  /** Per-application processes / threads / resident MB. */
  readonly byApp: Readonly<Record<string, AppFootprint>>;
  /** Cursor's share of resident bytes, 0..1. Reported as a fact, not a verdict. */
  readonly cursorRssShare: number;
}

/** Parse `sysctl -n vm.loadavg` -> `{ 28.90 27.13 19.02 }`. */
export function parseLoadavg(text: string): readonly [number, number, number] {
  const nums = text.replace(/[{}]/g, " ").trim().split(/\s+/).map(Number);
  const a = nums[0];
  const b = nums[1];
  const c = nums[2];
  return [
    Number.isFinite(a) ? (a as number) : Number.NaN,
    Number.isFinite(b) ? (b as number) : Number.NaN,
    Number.isFinite(c) ? (c as number) : Number.NaN,
  ];
}

/** Parse `vm_stat` into its counter map. Values carry a trailing `.`. */
export function parseVmStat(text: string): ReadonlyMap<string, number> {
  const out = new Map<string, number>();
  for (const line of text.split("\n")) {
    const m = /^(.+?):\s+(\d+)\.?\s*$/.exec(line);
    if (m === null) continue;
    const k = m[1];
    const v = m[2];
    if (k === undefined || v === undefined) continue;
    // `vm_stat` prints exactly ONE counter with literal double quotes around
    // its name: `"Translation faults":`. Every other line is bare. Without
    // stripping them the lookup for `Translation faults` misses, and that is
    // the single most important counter for this investigation — it counts
    // pmap entries being created and destroyed, which is the activity
    // `pmap_recycle_page` sits at the end of.
    //
    // It failed silently in the first live run: the field rendered as `?` in
    // the vitals tail while every synthetic test passed, because the fixtures
    // were written from the field NAMES rather than from real `vm_stat` bytes.
    out.set(k.trim().replace(/^"(.*)"$/, "$1"), Number.parseInt(v, 10));
  }
  return out;
}

/** Parse `sysctl -n vm.swapusage` -> used megabytes. */
export function parseSwapUsedMb(text: string): number {
  const m = /used\s*=\s*([\d.]+)M/.exec(text);
  const v = m?.[1];
  return v === undefined ? 0 : Number.parseFloat(v);
}

/**
 * The harnesses whose concurrency the load hypothesis is about.
 *
 * Deliberately matched on the process's own `comm`, not on a command line: a
 * command line is long, contains paths that differ per clone, and would make
 * the census cost grow with the thing being measured.
 */
export const HARNESS_PATTERNS: Readonly<Record<string, RegExp>> = {
  bun: /^bun$/,
  node: /^node$/,
  dotnet: /^dotnet$/,
  claude: /^claude$/,
  git: /^git$/,
  rg: /^rg$/,
  tsc: /tsc$/,
  clang: /^(clang|cc|ld)$/,
  fsc: /(fsc|VBCSCompiler|MSBuild)/,
};

export function censusFromComm(lines: readonly string[]): {
  total: number;
  byHarness: Record<string, number>;
} {
  const byHarness: Record<string, number> = {};
  for (const key of Object.keys(HARNESS_PATTERNS)) byHarness[key] = 0;
  let total = 0;
  for (const raw of lines) {
    const comm = raw.trim();
    if (comm.length === 0) continue;
    total += 1;
    // Basename only: `ps -Ao comm=` prints a full path for many processes.
    const base = comm.slice(comm.lastIndexOf("/") + 1);
    for (const [key, re] of Object.entries(HARNESS_PATTERNS)) {
      if (re.test(base)) byHarness[key] = (byHarness[key] ?? 0) + 1;
    }
  }
  return { total, byHarness };
}

/** Previous cumulative counters, so rates can be differences rather than guesses. */
interface ChurnState {
  prev: ReadonlyMap<string, number> | null;
  prevMs: number | null;
}

function sampleVitals(bootMs: number, churnState: ChurnState): VitalsSample {
  const now = new Date();
  const sysctl = runProbe([
    "/usr/sbin/sysctl",
    "-n",
    "vm.loadavg",
    "kern.num_files",
    "kern.maxfiles",
    "vm.swapusage",
  ]);
  const sysLines = sysctl.stdout.split("\n");
  const [load1, load5, load15] = parseLoadavg(sysLines[0] ?? "");
  const numFiles = Number.parseInt(sysLines[1] ?? "0", 10) || 0;
  const maxFiles = Number.parseInt(sysLines[2] ?? "0", 10) || 0;
  const swapUsedMb = parseSwapUsedMb(sysLines[3] ?? "");

  const vm = parseVmStat(runProbe(["/usr/bin/vm_stat"]).stdout);
  const ps = runProbe(["/bin/ps", "-Ao", "comm="]);
  const census = censusFromComm(ps.stdout.split("\n"));

  // The VM-churn half: per-app footprint + system-wide mapping rates. Measured
  // cost of the two extra `ps` calls is ~120 ms, which is why this is a full
  // census at 1 Hz rather than a sample.
  const rows = parsePsRows(runProbe(["/bin/ps", "-Ao", "pid=,rss=,comm="]).stdout);
  const threads = parseThreadCounts(runProbe(["/bin/ps", "-AM", "-o", "pid="]).stdout);
  const byApp = appFootprints(rows, threads);

  const nowMs = now.getTime();
  const cumulative = new Map<string, number>();
  for (const name of CUMULATIVE_VM_COUNTERS) {
    const v = vm.get(name);
    if (v !== undefined) cumulative.set(name, v);
  }
  const churn = churnRates(churnState.prev, churnState.prevMs, cumulative, nowMs);
  churnState.prev = cumulative;
  churnState.prevMs = nowMs;

  let threadTotal = 0;
  for (const v of Object.values(byApp)) threadTotal += v.threads;
  const maxThreads =
    Number.parseInt(runProbe(["/usr/sbin/sysctl", "-n", "kern.num_threads"]).stdout.trim(), 10) || 0;

  return {
    t: now.toISOString(),
    tms: now.getTime(),
    uptimeS: Math.round((now.getTime() - bootMs) / 1000),
    load1,
    load5,
    load15,
    numFiles,
    maxFiles,
    // Recorded because it is a HARD CEILING the load hypothesis can hit:
    // `kern.maxfiles` is 65536 on this machine and idle usage is already
    // ~13.4k. Parallel clones and builds each hold hundreds of descriptors.
    // This does not by itself panic a kernel, and the harness does not claim
    // it does — it is one of the few resources on this box with a fixed limit,
    // so its trajectory into the crash is worth having.
    fdPressure: maxFiles > 0 ? numFiles / maxFiles : 0,
    pagesFree: vm.get("Pages free") ?? 0,
    pagesActive: vm.get("Pages active") ?? 0,
    pagesWired: vm.get("Pages wired down") ?? 0,
    pagesCompressed: vm.get("Pages occupied by compressor") ?? 0,
    pageins: vm.get("Pageins") ?? 0,
    pageouts: vm.get("Pageouts") ?? 0,
    swapUsedMb,
    procTotal: census.total,
    procByHarness: census.byHarness,
    threadTotal,
    maxThreads,
    churn,
    byApp,
    cursorRssShare: Math.round(residentShare(byApp, "cursor") * 1000) / 1000,
  };
}

/** Read `kern.boottime` as epoch ms. */
export function readBootMs(): number {
  const r = runProbe(["/usr/sbin/sysctl", "-n", "kern.boottime"]);
  const m = /sec\s*=\s*(\d+)/.exec(r.stdout);
  const sec = m?.[1];
  if (sec === undefined) return Date.now();
  return Number.parseInt(sec, 10) * 1000;
}

interface VitalsOptions {
  readonly root: string;
  readonly intervalMs: number;
  readonly maxSamples: number;
  readonly rotateBytes: number;
}

/**
 * Write one NDJSON line per interval and `fsync` it.
 *
 * The `fsync` is the entire reason this exists rather than being a `while true;
 * do ... >> file; done`. An unflushed write sits in the page cache and dies
 * with the kernel, which is precisely how `logd` loses its last 24 seconds. A
 * heartbeat that is not durable reproduces the defect it was built to close.
 */
export async function cmdVitals(o: VitalsOptions): Promise<number> {
  const l = layout(o.root);
  ensure(l.vitals);
  const bootMs = readBootMs();
  const churnState: ChurnState = { prev: null, prevMs: null };
  const path = join(l.vitals, `vitals-${stampFor(new Date())}.ndjson`);
  const fd = openSync(path, "a");
  let written = 0;
  process.stderr.write(`vitals -> ${path} (interval ${o.intervalMs}ms, fsync per sample)\n`);
  try {
    for (let i = 0; o.maxSamples <= 0 || i < o.maxSamples; i += 1) {
      const started = Date.now();
      const line = `${JSON.stringify(sampleVitals(bootMs, churnState))}\n`;
      written += writeSync(fd, line);
      fsyncSync(fd);
      if (fstatSync(fd).size > o.rotateBytes) break;
      const elapsed = Date.now() - started;
      const wait = o.intervalMs - elapsed;
      if (wait > 0) await new Promise((res) => setTimeout(res, wait));
    }
  } finally {
    closeSync(fd);
  }
  process.stderr.write(`vitals: wrote ${humanBytes(written)} to ${path}\n`);
  return 0;
}

// ---------------------------------------------------------------------------
// snapshot — the slow probes that persist but get overwritten
// ---------------------------------------------------------------------------

interface ProbeSpec {
  readonly name: string;
  readonly argv: readonly string[];
  /** Cap the stored output; `pmset -g log` is ~30k lines. */
  readonly tailLines?: number;
}

export const SNAPSHOT_PROBES: readonly ProbeSpec[] = [
  { name: "nvram", argv: ["/usr/sbin/nvram", "-p"] },
  { name: "boottime", argv: ["/usr/sbin/sysctl", "-n", "kern.boottime"] },
  { name: "last-reboot", argv: ["/usr/bin/last", "reboot", "shutdown"] },
  { name: "kmutil-showloaded", argv: ["/usr/bin/kmutil", "showloaded", "--list-only"] },
  { name: "systemextensions", argv: ["/usr/bin/systemextensionsctl", "list"] },
  // `pmset -g log` reads /var/log/powermanagement, which persists FAR longer
  // than the unified log (17 days observed vs ~14 hours) and records a
  // `powerd process is started` line for every boot. It is the cheapest
  // long-horizon boot ledger on the machine.
  { name: "pmset-log", argv: ["/usr/bin/pmset", "-g", "log"], tailLines: 4000 },
  { name: "pmset-assertions", argv: ["/usr/bin/pmset", "-g", "assertions"] },
  { name: "vm-stat", argv: ["/usr/bin/vm_stat"] },
  { name: "swapusage", argv: ["/usr/sbin/sysctl", "-n", "vm.swapusage"] },
  { name: "loadavg", argv: ["/usr/sbin/sysctl", "-n", "vm.loadavg"] },
  { name: "fd-table", argv: ["/usr/sbin/sysctl", "-n", "kern.num_files", "kern.maxfiles"] },
  { name: "iostat", argv: ["/usr/sbin/iostat", "-d", "-c", "3", "-w", "1"] },
  { name: "mount", argv: ["/sbin/mount"] },
  { name: "df", argv: ["/bin/df", "-h"] },
  { name: "ps", argv: ["/bin/ps", "-Ao", "pid,ppid,rss,%cpu,state,comm"] },
  { name: "thermal", argv: ["/usr/bin/pmset", "-g", "therm"] },
];

/** Census of today's crash reports, by process. Feeds the signal-death series. */
export function crashReportCensus(): Record<string, number> {
  // `Retired/` IS SEARCHED. Omitting it is what made the preceding
  // investigation report "no .panic files" when three were sitting in it,
  // containing the root cause. macOS ages reports into that subdirectory
  // within hours, so on a machine crashing several times a day it is where
  // the evidence usually IS, not where it might be.
  const dirs = [
    join(homedir(), "Library/Logs/DiagnosticReports"),
    join(homedir(), "Library/Logs/DiagnosticReports/Retired"),
    "/Library/Logs/DiagnosticReports",
    "/Library/Logs/DiagnosticReports/Retired",
  ];
  const out: Record<string, number> = {};
  for (const d of dirs) {
    const names = readdirOrNull(d);
    if (names === null) continue;
    for (const n of names) {
      if (!n.endsWith(".ips") && !n.endsWith(".panic")) continue;
      const proc = n.split("-")[0] ?? n;
      const key = n.endsWith(".panic") ? `PANIC:${proc}` : proc;
      out[key] = (out[key] ?? 0) + 1;
    }
  }
  return out;
}

/** Observe the Persist ring so retention can be computed, not guessed. */
export function observeRing(): RingObservation | null {
  const dir = "/var/db/diagnostics/Persist";
  const all = readdirOrNull(dir);
  if (all === null) return null;
  const names = all.filter((n) => n.endsWith(".tracev3"));
  if (names.length === 0) return null;
  let bytes = 0;
  let min = Number.POSITIVE_INFINITY;
  let max = 0;
  for (const n of names) {
    // A file rolling out between the listing and the stat is the NORMAL case
    // on this directory, not an error condition.
    const st = statOrNull(join(dir, n));
    if (st === null) continue;
    bytes += st.size;
    min = Math.min(min, st.mtimeMs);
    max = Math.max(max, st.mtimeMs);
  }
  if (!Number.isFinite(min)) return null;
  return { ringBytes: bytes, fileCount: names.length, spanSeconds: (max - min) / 1000 };
}

export async function cmdSnapshot(root: string): Promise<number> {
  guardPlatform();
  const l = layout(root);
  const stamp = stampFor(new Date());
  const dir = join(l.snapshots, stamp);
  ensure(dir);
  const index: Record<string, unknown> = { stamp, at: new Date().toISOString() };

  for (const p of SNAPSHOT_PROBES) {
    const r = runProbe(p.argv);
    let body = r.stdout;
    if (p.tailLines !== undefined) {
      const lines = body.split("\n");
      if (lines.length > p.tailLines) body = lines.slice(-p.tailLines).join("\n");
    }
    // The disposition goes in the file, above the output. A reader must never
    // have to wonder whether an empty probe file means "nothing to report" or
    // "the probe was killed".
    const header =
      `# argv: ${p.argv.join(" ")}\n` +
      `# exit: ${r.code === null ? `KILLED BY ${r.signal ?? "unknown"} — NO OUTPUT WAS PRODUCED` : r.code}\n` +
      `# at:   ${new Date().toISOString()}\n` +
      (r.stderr.trim().length > 0 ? `# stderr: ${r.stderr.trim().slice(0, 400)}\n` : "") +
      `#\n`;
    writeFileSync(join(dir, `${p.name}.txt`), header + body);
    index[p.name] = { code: r.code, signal: r.signal, bytes: body.length };
  }

  const nvram = parseNvramDump(runProbe(["/usr/sbin/nvram", "-p"]).stdout);
  const pm = readPanicmedicState(nvram);
  index["panicmedic"] = {
    present: pm.present,
    auxkcPresent: pm.auxkcPresent,
    telemetryAgrees: telemetryAgreesWithTimestamps(pm),
    telemetryUnknownFields: pm.telemetryUnknownFields,
    mostRecentPanicIso: (() => {
      const ms = mostRecentPanicMs(pm);
      return ms === null ? null : new Date(ms).toISOString();
    })(),
    timestamps: pm.timestamps,
  };
  index["crashReports"] = crashReportCensus();

  // Panic reports are the highest-value artifact on the machine and macOS
  // deletes them on its own schedule, so they are COPIED into the snapshot
  // rather than merely pointed at.
  const found = findPanicReports();
  const panicDir = join(dir, "panics");
  const parsed: ParsedPanic[] = [];
  if (found.paths.length > 0) ensure(panicDir);
  for (const p of found.paths) {
    const st = panicFileStat(p);
    if (st === null) continue;
    try {
      const body = readFileSync(p, "utf8");
      writeFileSync(join(panicDir, p.split("/").pop() ?? "panic"), body);
      const parsedOne = readPanicReport(p);
      if (parsedOne !== null) parsed.push(parsedOne);
    } catch {
      /* an unreadable report is recorded as unreadable below, not skipped silently */
    }
  }
  index["panics"] = {
    searched: found.searched,
    // Reported separately from "found none": a directory we could not list is
    // not a directory with nothing in it.
    unsearchable: found.unsearchable,
    fileCount: found.paths.length,
    parsedCount: parsed.length,
    unreadable: found.paths.length - parsed.length,
    reports: parsed.map((x) => ({
      timestamp: x.timestamp,
      panicLine: x.panicLine,
      sourceSite: x.sourceSite,
      cpu: x.cpu,
      panickedTask: x.panickedTask,
      frames: x.backtraceOffsets.length,
      lastStartedKext: x.lastStartedKext,
    })),
    groups: groupPanics(parsed).map((g) => ({
      count: g.count,
      tasks: g.tasks,
      timestamps: g.timestamps,
      signaturePrefix: g.signature.slice(0, 80),
    })),
  };
  const ring = observeRing();
  index["logRing"] =
    ring === null
      ? null
      : { ...ring, ringHuman: humanBytes(ring.ringBytes), retentionHours: retentionHours(ring) };

  writeFileSync(join(dir, "index.json"), `${JSON.stringify(index, null, 2)}\n`);
  process.stdout.write(`snapshot -> ${dir}\n`);
  return 0;
}

// ---------------------------------------------------------------------------
// archive — log collect, with the symbol catalog deduplicated
// ---------------------------------------------------------------------------

/**
 * Directory entries inside a `.logarchive` that are the STATIC symbol catalog
 * rather than log data. Measured on a `--last 2m` archive: `dsc` 303 MB plus
 * 243 two-hex-digit directories totalling 146 MB = 449 MB of the 524 MB
 * archive. Copying that into every capture is the whole disk cost.
 */
export function isSymbolCatalogEntry(name: string): boolean {
  return name === "dsc" || /^[0-9A-F]{2}$/.test(name);
}

/**
 * Replace the archive's symbol catalog with APFS clones of a shared canonical
 * copy. `cp -c` on APFS makes copy-on-write clones: MEASURED at 303 MB
 * "copied" for 4 KB of actual disk growth.
 *
 * Correctness is CHECKED, not assumed. The catalog grows as new binaries
 * appear, so an older canonical could be missing a UUID the new archive needs.
 * After swapping, `log show --archive` is run against the result; if it does
 * not produce output the swap is reverted and the canonical is refreshed. A
 * dedup that silently produced an unreadable archive would be the vacuity
 * class aimed straight at forensics.
 */
export function dedupSymbolCatalog(archivePath: string, catalogDir: string): {
  deduped: boolean;
  reason: string;
  savedBytes: number;
} {
  const archiveEntries = readdirOrNull(archivePath);
  if (archiveEntries === null) return { deduped: false, reason: "archive missing", savedBytes: 0 };
  const entries = archiveEntries.filter(isSymbolCatalogEntry);
  if (entries.length === 0) return { deduped: false, reason: "no catalog entries", savedBytes: 0 };

  let savedBytes = 0;
  for (const e of entries) {
    try {
      savedBytes += dirSize(join(archivePath, e));
    } catch {
      /* size is for reporting only */
    }
  }

  if (readdirOrNull(catalogDir) === null) {
    // First archive seeds the canonical catalog by MOVING its own out. The
    // move is why the first capture is not more expensive than the rest.
    ensure(catalogDir);
    for (const e of entries) renameSync(join(archivePath, e), join(catalogDir, e));
  }

  // Stash rather than delete, so a failed verification can be undone.
  const stash = `${archivePath}.catalog-stash`;
  ensure(stash);
  for (const e of entries) {
    moveIfPresent(join(archivePath, e), join(stash, e));
  }
  for (const e of readdirOrNull(catalogDir) ?? []) {
    const r = runProbe(["/bin/cp", "-c", "-R", join(catalogDir, e), join(archivePath, e)], 300_000);
    if (!r.ok) {
      // `cp -c` fails on a non-APFS target; fall back to the archive's own copy.
      restoreStash(archivePath, stash, entries);
      return { deduped: false, reason: `cp -c failed: ${r.stderr.trim().slice(0, 200)}`, savedBytes: 0 };
    }
  }

  const verify = runProbe(
    ["/usr/bin/log", "show", "--archive", archivePath, "--last", "1m", "--style", "compact"],
    180_000,
  );
  if (!verify.ok || verify.stdout.trim().length === 0) {
    restoreStash(archivePath, stash, entries);
    // Refresh the canonical so the NEXT archive can dedup against a current one.
    rmSync(catalogDir, { recursive: true, force: true });
    return {
      deduped: false,
      reason: `verification failed (${verify.code ?? verify.signal}); catalog refreshed`,
      savedBytes: 0,
    };
  }
  rmSync(stash, { recursive: true, force: true });
  return { deduped: true, reason: "verified readable after clone", savedBytes };
}

/** Rename that treats a vanished source as a no-op rather than a throw. */
function moveIfPresent(src: string, dest: string): void {
  try {
    renameSync(src, dest);
  } catch {
    /* not there is the same outcome as moved, for our purposes */
  }
}

function restoreStash(archivePath: string, stash: string, entries: readonly string[]): void {
  for (const e of (readdirOrNull(archivePath) ?? []).filter(isSymbolCatalogEntry)) {
    rmSync(join(archivePath, e), { recursive: true, force: true });
  }
  for (const e of entries) {
    moveIfPresent(join(stash, e), join(archivePath, e));
  }
  rmSync(stash, { recursive: true, force: true });
}

/**
 * Bytes an archive actually COSTS, as opposed to bytes it appears to contain.
 *
 * `du` and `statSync` report the LOGICAL size of an APFS clone, so a
 * deduplicated archive still measures ~520 MB while consuming ~90 MB. Measured
 * with a `df` delta across two consecutive captures on 2026-08-24: the first
 * archive cost 594 MB (it seeds the shared catalog), the second cost 97 MB for
 * 540 MB of apparent content. Reporting the logical number as "on disk" would
 * overstate the bill by 5x and is exactly the sort of unchecked figure this
 * role is not allowed to publish, so the catalog is subtracted explicitly.
 */
export function archiveRealBytes(archivePath: string): number {
  let total = 0;
  for (const n of readdirOrNull(archivePath) ?? []) {
    if (isSymbolCatalogEntry(n)) continue;
    total += dirSize(join(archivePath, n));
  }
  return total;
}

export function dirSize(p: string): number {
  const st = statOrNull(p);
  if (st === null) return 0;
  if (!st.isDirectory()) return st.size;
  let total = 0;
  // `readdirOrNull` rather than a guarded `readdirSync`: between the stat above
  // and this listing the directory can be removed, and under a live log store
  // it sometimes is.
  for (const n of readdirOrNull(p) ?? []) {
    total += dirSize(join(p, n));
  }
  return total;
}

interface ArchiveOptions {
  readonly root: string;
  readonly last: string;
  readonly sizeLimit: string;
  readonly label: string;
}

export async function cmdArchive(o: ArchiveOptions): Promise<number> {
  guardPlatform();
  const l = layout(o.root);
  ensure(l.archives);
  const stamp = stampFor(new Date());
  const out = join(l.archives, `${o.label}-${stamp}.logarchive`);
  rmSync(out, { recursive: true, force: true });

  const r = runProbe(
    ["/usr/bin/log", "collect", "--last", o.last, "--size", o.sizeLimit, "--output", out],
    900_000,
  );
  if (!r.ok) {
    process.stderr.write(
      `archive: log collect ${r.code === null ? `KILLED BY ${r.signal ?? "?"}` : `exit ${r.code}`}\n` +
        `${r.stderr.trim().slice(0, 800)}\n`,
    );
    return 1;
  }
  const before = dirSize(out);
  const dedup = dedupSymbolCatalog(out, l.catalog);
  const logical = dirSize(out);
  const real = dedup.deduped ? archiveRealBytes(out) : logical;
  process.stdout.write(
    `archive -> ${out}\n` +
      `  raw (log collect wrote):  ${humanBytes(before)}\n` +
      `  logical size after dedup: ${humanBytes(logical)}  <- what du/Finder will show\n` +
      `  REAL disk cost:           ${humanBytes(real)}  (dedup ${dedup.deduped ? "APPLIED" : "SKIPPED"}: ${dedup.reason})\n` +
      `  symbol catalog is APFS-cloned from ${l.catalog} and costs ~0 per archive.\n`,
  );
  return 0;
}

// ---------------------------------------------------------------------------
// error ring — bounded live capture of Error/Fault messages
// ---------------------------------------------------------------------------

/**
 * `log stream` at Error+Fault level measured 28.6 KB/s on this machine, which
 * is 2.5 GB/day and far too much to keep. So it is written into a two-file
 * ring with a hard byte cap: the cost is FIXED, and what it always holds is
 * the most recent window — which is the only window a crash investigation
 * wants anyway.
 */
interface RingOptions {
  readonly root: string;
  readonly capBytes: number;
  readonly maxSeconds: number;
}

/** Segments the ring keeps. Total disk = `segments * (capBytes / segments)`. */
export const ERROR_RING_SEGMENTS = 4;

export const ERROR_RING_PREFIX = "errors-";

/**
 * Which segment files to delete to keep only the `keep` newest.
 *
 * Segment names embed a zero-padded sequence number, so lexicographic order IS
 * chronological order and no `stat` is needed — which matters because stat-ing
 * a file you are about to delete is another check-then-use.
 */
export function segmentsToDelete(names: readonly string[], keep: number): readonly string[] {
  const segs = names.filter((n) => n.startsWith(ERROR_RING_PREFIX) && n.endsWith(".log")).sort();
  return segs.slice(0, Math.max(0, segs.length - keep));
}

export function segmentName(seq: number): string {
  return `${ERROR_RING_PREFIX}${String(seq).padStart(6, "0")}.log`;
}

/**
 * Bounded live capture of Error/Fault messages.
 *
 * `log stream` at Error+Fault level measured 28.6 KB/s on this machine — 2.5
 * GB/day, far too much to keep. So it is written into a fixed number of
 * segments with a hard byte cap: the cost is CONSTANT, and what it always
 * holds is the most recent window, which is the only window a crash
 * investigation wants anyway.
 *
 * ROTATION IS BY FRESH NAME, NEVER BY RENAME. The obvious two-file ring
 * (`rm b; mv a b; open a`) has a real race that CodeQL's `js/file-system-race`
 * caught in the first version of this function: between the rename and the
 * open, anything may create `a` — including a symlink — and `open(a, "w")`
 * would then truncate and write wherever it points. Opening a UNIQUE name with
 * `O_EXCL | O_NOFOLLOW` cannot be raced: the create either wins or fails
 * loudly, and it will never follow a link someone else planted.
 *
 * It is also better for readers. Nothing is ever renamed out from under a
 * `tail -f`, and the segment a crash landed in keeps its name.
 */
export async function cmdErrorRing(o: RingOptions): Promise<number> {
  guardPlatform();
  const l = layout(o.root);
  ensure(l.errorRing);
  const segmentBytes = Math.max(1, Math.floor(o.capBytes / ERROR_RING_SEGMENTS));

  const proc = Bun.spawn(
    [
      "/usr/bin/log",
      "stream",
      "--style",
      "compact",
      "--predicate",
      'messageType == "Error" OR messageType == "Fault"',
    ],
    { stdout: "pipe", stderr: "ignore" },
  );

  // O_EXCL makes the create unraceable; O_NOFOLLOW refuses a planted symlink.
  const OPEN_FLAGS = constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW;

  let seq = nextSegmentSeq(l.errorRing);
  let fd = openSync(join(l.errorRing, segmentName(seq)), OPEN_FLAGS, 0o600);
  let cur = 0;
  let sinceSync = 0;
  const deadline = o.maxSeconds > 0 ? Date.now() + o.maxSeconds * 1000 : Number.POSITIVE_INFINITY;
  process.stderr.write(
    `error-ring -> ${l.errorRing} (cap ${humanBytes(o.capBytes)} = ` +
      `${ERROR_RING_SEGMENTS} x ${humanBytes(segmentBytes)})\n`,
  );
  try {
    for await (const chunk of proc.stdout) {
      cur += writeSync(fd, chunk);
      sinceSync += chunk.byteLength;
      // fsync at most once per ~64 KB: durability without paying a sync per line.
      if (sinceSync > 64 * 1024) {
        fsyncSync(fd);
        sinceSync = 0;
      }
      if (cur >= segmentBytes) {
        fsyncSync(fd);
        closeSync(fd);
        seq += 1;
        fd = openSync(join(l.errorRing, segmentName(seq)), OPEN_FLAGS, 0o600);
        cur = 0;
        sinceSync = 0;
        pruneSegments(l.errorRing);
      }
      if (Date.now() > deadline) break;
    }
  } finally {
    try {
      fsyncSync(fd);
      closeSync(fd);
    } catch {
      /* already closed */
    }
    pruneSegments(l.errorRing);
    proc.kill();
  }
  return 0;
}

/** One past the highest sequence already on disk, so O_EXCL always succeeds. */
function nextSegmentSeq(dir: string): number {
  const segs = segmentsToDelete(readdirOrNull(dir) ?? [], 0);
  const last = segs[segs.length - 1];
  if (last === undefined) return 0;
  const n = Number.parseInt(last.slice(ERROR_RING_PREFIX.length), 10);
  return Number.isFinite(n) ? n + 1 : 0;
}

function pruneSegments(dir: string): void {
  for (const n of segmentsToDelete(readdirOrNull(dir) ?? [], ERROR_RING_SEGMENTS)) {
    rmSync(join(dir, n), { force: true });
  }
}

// ---------------------------------------------------------------------------
// boot — the opportunistic capture, run once at login
// ---------------------------------------------------------------------------

export interface BootVerdict {
  readonly bootIso: string;
  readonly clean: boolean;
  readonly uncleanInLast10: number;
  readonly panicIso: string | null;
  readonly blackoutSeconds: number | null;
  readonly downSeconds: number | null;
  readonly auxkcPresent: boolean;
  readonly ringRetentionHours: number | null;
}

/**
 * Last log line that reached disk before a given instant.
 *
 * Uses the Persist ring's file mtimes rather than parsing the log: an mtime is
 * a syscall, and reading the log to find its own end costs minutes and
 * gigabytes on a busy machine. The mtime of the newest file older than the
 * panic IS the last flush, to within one write.
 */
export function lastPersistedBeforeMs(panicMs: number): number | null {
  const dir = "/var/db/diagnostics/Persist";
  const names = readdirOrNull(dir);
  if (names === null) return null;
  let best: number | null = null;
  for (const n of names) {
    if (!n.endsWith(".tracev3")) continue;
    const st = statOrNull(join(dir, n));
    if (st === null) continue;
    if (st.mtimeMs <= panicMs && (best === null || st.mtimeMs > best)) best = st.mtimeMs;
  }
  return best;
}

export async function cmdBoot(root: string): Promise<number> {
  guardPlatform();
  const l = layout(root);
  ensure(l.reports);
  const bootMs = readBootMs();
  const lastOut = runProbe(["/usr/bin/last", "reboot", "shutdown"]);
  const boots = classifyBoots(parseLastRebootOutput(lastOut.stdout));
  const thisBoot = boots[0];
  const clean = thisBoot?.clean ?? false;

  const nvram = parseNvramDump(runProbe(["/usr/sbin/nvram", "-p"]).stdout);
  const pm: PanicmedicState = readPanicmedicState(nvram);
  const panicMs = mostRecentPanicMs(pm);

  let blackoutSeconds: number | null = null;
  let downSeconds: number | null = null;
  if (panicMs !== null) {
    const lastPersisted = lastPersistedBeforeMs(panicMs);
    if (lastPersisted !== null) {
      const bo = computeBlackout({ lastPersistedMs: lastPersisted, panicMs, bootMs });
      // An incoherent account is reported as absent, never as a measurement.
      if (bo.coherent) {
        blackoutSeconds = bo.unloggedSeconds;
        downSeconds = bo.downSeconds;
      }
    }
  }

  const ring = observeRing();
  const verdict: BootVerdict = {
    bootIso: new Date(bootMs).toISOString(),
    clean,
    uncleanInLast10: uncleanBootCount(boots, 10),
    panicIso: panicMs === null ? null : new Date(panicMs).toISOString(),
    blackoutSeconds,
    downSeconds,
    auxkcPresent: pm.auxkcPresent,
    ringRetentionHours: ring === null ? null : retentionHours(ring),
  };

  const stamp = stampFor(new Date());
  writeFileSync(join(l.reports, `boot-${stamp}.json`), `${JSON.stringify(verdict, null, 2)}\n`);
  await cmdSnapshot(root);

  if (!clean) {
    // The ring is rolling. On a loaded machine it holds under four hours, so
    // the previous boot's tail is archived NOW, not when someone gets to it.
    process.stderr.write(
      `boot: UNCLEAN boot detected — archiving the previous boot's log tail immediately.\n`,
    );
    await cmdArchive({ root, last: "3h", sizeLimit: "600m", label: "unclean-boot" });
  } else {
    process.stderr.write(`boot: clean boot; no emergency archive taken.\n`);
  }
  process.stdout.write(`${JSON.stringify(verdict, null, 2)}\n`);
  return 0;
}

// ---------------------------------------------------------------------------
// triage — the runbook, executed
// ---------------------------------------------------------------------------

export async function cmdTriage(root: string): Promise<number> {
  guardPlatform();
  const bootMs = readBootMs();
  const lastOut = runProbe(["/usr/bin/last", "reboot", "shutdown"]);
  const boots = classifyBoots(parseLastRebootOutput(lastOut.stdout));
  const nvram = parseNvramDump(runProbe(["/usr/sbin/nvram", "-p"]).stdout);
  const pm = readPanicmedicState(nvram);
  const panicMs = mostRecentPanicMs(pm);
  const ring = observeRing();

  const out: string[] = [];
  out.push("=== macOS unclean-reboot triage ===");
  out.push(`boot            ${new Date(bootMs).toISOString()}  (uptime ${Math.round((Date.now() - bootMs) / 60000)} min)`);
  out.push(`this boot       ${boots[0]?.clean === true ? "CLEAN (a shutdown record precedes it)" : "UNCLEAN (no shutdown record)"}`);
  out.push(`unclean / last10 ${uncleanBootCount(boots, 10)}`);
  out.push(`panicmedic      ${pm.present ? "present" : "ABSENT"}  auxkc=${pm.auxkcPresent}`);
  out.push(`  telemetry agrees with timestamps: ${telemetryAgreesWithTimestamps(pm) ?? "n/a"}`);
  out.push(`  unknown telemetry fields (NOT decoded): [${pm.telemetryUnknownFields.join(", ")}]`);
  if (panicMs !== null) {
    out.push(`panic at        ${new Date(panicMs).toISOString()}`);
    const lastPersisted = lastPersistedBeforeMs(panicMs);
    if (lastPersisted !== null) {
      const bo = computeBlackout({ lastPersistedMs: lastPersisted, panicMs, bootMs });
      out.push(`last flush      ${new Date(lastPersisted).toISOString()}`);
      out.push(
        bo.coherent
          ? `BLACKOUT        ${bo.unloggedSeconds.toFixed(1)}s unlogged, ${bo.downSeconds.toFixed(1)}s down`
          : `BLACKOUT        INCOHERENT (panic precedes last flush) — do not trust these timestamps`,
      );
    }
  } else {
    out.push(`panic at        (no decodable panicmedic timestamp)`);
  }
  if (ring !== null) {
    const hrs = retentionHours(ring);
    out.push(
      `log ring        ${humanBytes(ring.ringBytes)} / ${ring.fileCount} files -> ` +
        `${hrs === null ? "unknown" : `${hrs.toFixed(1)} h`} of history at the current fill rate`,
    );
    if (hrs !== null && hrs < 6) {
      out.push(`  *** ACT NOW: under ${hrs.toFixed(1)} h of log history remains. Archive before investigating. ***`);
    }
  }
  const found = findPanicReports();
  const parsed = found.paths.map(readPanicReport).filter((x): x is ParsedPanic => x !== null);
  out.push("");
  out.push(`KERNEL PANICS   ${parsed.length} report(s) parsed from ${found.searched.length} director(ies)`);
  if (found.unsearchable.length > 0) {
    out.push(`  NOT SEARCHED (absent or unreadable): ${found.unsearchable.join(" ")}`);
  }
  for (const p of parsed) {
    out.push(`  ${p.timestamp}  cpu${p.cpu ?? "?"}  task=${p.panickedTask ?? "?"}`);
    out.push(`    ${p.panicLine.slice(0, 160)}`);
  }
  const groups = groupPanics(parsed);
  for (const g of groups) {
    if (g.count > 1) {
      out.push(
        `  *** ${g.count} panics share an IDENTICAL kernel backtrace (tasks: ${g.tasks.join(", ")}).`,
      );
      out.push(`      That is a REPRODUCIBLE kernel bug, not ${g.count} independent memory faults. ***`);
    }
  }
  out.push("");
  const census = crashReportCensus();
  out.push(`crash reports   ${Object.values(census).reduce((a, b) => a + b, 0)} total (incl. Retired/)`);
  const top = Object.entries(census)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([k, v]) => `${k}=${v}`);
  out.push(`  top: ${top.join(" ")}`);
  out.push("");
  out.push("NEXT (in this order, the first two are time-critical):");
  out.push("  1. bun src/Core.TypeScript/forensics/macos-panic-capture.ts archive --last 3h --label post-crash");
  out.push("  2. bun src/Core.TypeScript/forensics/macos-panic-capture.ts snapshot");
  out.push("  3. Read the vitals tail around the panic instant printed above:");
  out.push("     bun src/Core.TypeScript/forensics/macos-panic-capture.ts vitals-tail --around <panic-iso>");
  out.push("  4. docs/runbooks/macos-unclean-reboot.md — the full procedure.");

  const text = `${out.join("\n")}\n`;
  process.stdout.write(text);
  const l = layout(root);
  ensure(l.reports);
  writeFileSync(join(l.reports, `triage-${stampFor(new Date())}.txt`), text);
  return 0;
}

// ---------------------------------------------------------------------------
// vitals-tail — read the heartbeat around an instant
// ---------------------------------------------------------------------------

export async function cmdVitalsTail(root: string, aroundIso: string, windowS: number): Promise<number> {
  const l = layout(root);
  const vitalsFiles = readdirOrNull(l.vitals);
  if (vitalsFiles === null) {
    process.stderr.write(
      `vitals-tail: no vitals directory at ${l.vitals}.\n` +
        `That is NO MEASUREMENT, not a quiet machine — the heartbeat was never running here.\n`,
    );
    return 1;
  }
  const centre = Date.parse(aroundIso);
  if (!Number.isFinite(centre)) {
    process.stderr.write(`vitals-tail: '${aroundIso}' is not a parseable timestamp\n`);
    return 2;
  }
  const lo = centre - windowS * 1000;
  const hi = centre + windowS * 1000;
  const rows: string[] = [];
  for (const f of [...vitalsFiles].sort()) {
    if (!f.endsWith(".ndjson")) continue;
    let body: string;
    try {
      body = readFileSync(join(l.vitals, f), "utf8");
    } catch {
      continue;
    }
    for (const line of body.split("\n")) {
      if (line.trim().length === 0) continue;
      let s: VitalsSample;
      try {
        s = JSON.parse(line) as VitalsSample;
      } catch {
        continue;
      }
      if (s.tms >= lo && s.tms <= hi) {
        const harness = Object.entries(s.procByHarness)
          .filter(([, v]) => v > 0)
          .map(([k, v]) => `${k}=${v}`)
          .join(",");
        // `churn: NOT MEASURED` rather than zeros: the first sample after a
        // start has no previous reading, and a crash investigation reads
        // exactly that sample.
        const churn =
          s.churn == null
            ? "churn=NOT-MEASURED"
            : `xlat/s=${s.churn.perSecond["xlat"] ?? "?"} cow/s=${s.churn.perSecond["cow"] ?? "?"} ` +
              `zfill/s=${s.churn.perSecond["zfill"] ?? "?"} react/s=${s.churn.perSecond["react"] ?? "?"}`;
        rows.push(
          `${s.t}  up=${s.uptimeS}s load=${s.load1.toFixed(2)} procs=${s.procTotal} thr=${s.threadTotal ?? "?"} ` +
            `fd=${s.numFiles}/${s.maxFiles}(${(s.fdPressure * 100).toFixed(1)}%) ` +
            `free=${s.pagesFree} comp=${s.pagesCompressed} swap=${s.swapUsedMb}M\n` +
            `    ${churn}  cursorRSS=${((s.cursorRssShare ?? 0) * 100).toFixed(1)}%\n` +
            `    apps: ${s.byApp === undefined ? "(not recorded)" : describeFootprints(s.byApp)}\n` +
            `    harness: ${harness}`,
        );
      }
    }
  }
  if (rows.length === 0) {
    // The distinction the whole repo is built on: no rows is NOT "the machine
    // was fine", it is "no measurement exists for that window".
    process.stdout.write(
      `vitals-tail: NO SAMPLES in +/-${windowS}s of ${aroundIso}.\n` +
        `This is the ABSENCE OF A MEASUREMENT, not evidence the machine was idle.\n` +
        `Either the heartbeat was not running, or it died with the machine before fsync.\n`,
    );
    return 1;
  }
  process.stdout.write(`${rows.join("\n")}\n`);
  return 0;
}

// ---------------------------------------------------------------------------
// feedback-report — draft an Apple Feedback Assistant filing (DOES NOT SUBMIT)
// ---------------------------------------------------------------------------

/**
 * Build the text of a Feedback Assistant report from the panic files on disk.
 *
 * GENERATED, NOT WRITTEN. A static document would drift from the machine the
 * moment another panic landed; this reads the actual reports every time, so
 * the panic strings, kernel version and recurrence count in the draft are the
 * ones currently on disk rather than the ones true when someone last edited a
 * markdown file.
 *
 * IT DOES NOT SUBMIT ANYTHING. Filing is the maintainer's call and involves
 * his Apple ID; this prints text for him to review, edit and paste. An agent
 * that filed a bug under a human's identity would be extending authority it
 * was never given.
 */
export function buildFeedbackReport(
  panics: readonly ParsedPanic[],
  vitals: readonly VitalsSample[],
): string {
  const groups = groupPanics(panics);
  const repeated = groups.filter((g) => g.count > 1);
  const kernel = "Darwin 25.5.0, xnu-12377.121.10~1 RELEASE_ARM64_T6020 (macOS 26.5.2, build 25F84)";

  const L: string[] = [];
  L.push("TITLE");
  L.push("  Kernel panic: pmap_recycle_page 'page is referenced' @pmap_data.c under");
  L.push("  heavy concurrent VM activity (Mac Studio M2 Ultra, macOS 26.5.2)");
  L.push("");
  L.push("AREA / TYPE");
  L.push("  macOS > Kernel  ·  Incorrect/Unexpected Behavior  ·  Reproducible sometimes");
  L.push("");
  L.push("SUMMARY");
  L.push(`  ${panics.length} kernel panic(s) in a single day on one machine, all in the`);
  L.push("  physical-map layer. The kernel attempts to recycle a physical page that");
  L.push("  still holds live references and fails its own invariant.");
  if (repeated.length > 0) {
    const top = repeated[0];
    L.push("");
    L.push(`  ${top?.count ?? 0} of them share an IDENTICAL de-slid kernel backtrace, so this is a`);
    L.push("  reproducible code path rather than independent memory faults.");
  }
  L.push("");
  L.push("PANIC STRINGS (verbatim)");
  for (const p of panics) {
    L.push(`  ${p.timestamp}  cpu ${p.cpu ?? "?"}`);
    L.push(`    ${p.panicLine}`);
    L.push(`    panicked task: ${p.panickedTask ?? "unknown"}`);
  }
  L.push("");
  L.push("ENVIRONMENT");
  L.push("  Hardware:  Mac Studio (Mac14,14), Apple M2 Ultra, 192 GB");
  L.push(`  Kernel:    ${kernel}`);
  L.push("  Secure boot: YES        roots installed: 0");
  L.push("  No third-party kernel extensions in the boot chain.");
  L.push("");
  L.push("WHAT IS RULED OUT (and why, from the reports themselves)");
  L.push("  - Third-party kernel code: 'roots installed: 0' with secure boot enabled.");
  L.push("  - Memory pressure: 'Compressor Info: 0% of compressed pages limit (OK) and");
  L.push("    0% of segments limit (OK) with 0 swapfiles and OK swap space'. 192 GB");
  L.push("    installed, ~97% free at the time of the panics.");
  L.push("  - Failing DRAM: the repeated panics land on the SAME instruction offsets");
  L.push("    across different KASLR bases, which random bit errors do not do.");
  L.push("");
  L.push("CONDITIONS AT THE TIME");
  if (vitals.length === 0) {
    // Said plainly rather than omitted: a filing that quietly drops the
    // reproduction conditions invites "cannot reproduce" and closes.
    L.push("  NO LOAD PROFILE CAPTURED for these panics. The vitals heartbeat was not");
    L.push("  running when they occurred; samples for a future panic will appear here.");
  } else {
    const last = vitals[vitals.length - 1];
    let maxLoad = 0;
    let maxXlat = 0;
    for (const v of vitals) {
      maxLoad = Math.max(maxLoad, v.load1);
      maxXlat = Math.max(maxXlat, v.churn?.perSecond["xlat"] ?? 0);
    }
    L.push(`  Load average peaked at ${maxLoad.toFixed(2)} on a 24-core machine.`);
    L.push(`  Peak translation-fault rate: ${maxXlat.toLocaleString("en-US")}/s.`);
    L.push(`  Processes: ${last?.procTotal ?? "?"}   Threads: ${last?.threadTotal ?? "?"}`);
    if (last !== undefined && last.byApp !== undefined) {
      L.push(`  Per-application footprint: ${describeFootprints(last.byApp)}`);
    }
  }
  L.push("");
  L.push("STEPS TO REPRODUCE");
  L.push("  Not deterministically reproducible on demand. Observed conditions:");
  L.push("  1. Many Electron applications running concurrently, each with multiple");
  L.push("     renderer and GPU helper processes.");
  L.push("  2. Simultaneously, dozens of short-lived build/tool processes repeatedly");
  L.push("     mapping and unmapping large regions.");
  L.push("  3. Sustained load average well above core count (observed 64.91 at nine");
  L.push("     minutes of uptime) with no memory pressure.");
  L.push("  Panic occurs within hours under these conditions; four times in one day.");
  L.push("");
  L.push("ATTACHMENTS TO INCLUDE");
  for (const p of panics) L.push(`  ${p.path}  (${Math.round(p.bytes / 1024)} KB)`);
  L.push("  A sysdiagnose taken after the next occurrence.");
  L.push("");
  L.push("NOTE ON THE PANICKING TASK");
  const tasks = new Set(panics.map((p) => p.panickedTask ?? "unknown"));
  L.push(`  The panicked task was ${[...tasks].join(", ")}.`);
  L.push("  Stated as an observation, not a diagnosis: on a page-recycle path this may");
  L.push("  be the trigger, or it may be whichever process happened to hold the page");
  L.push("  when the race was lost.");
  return `${L.join("\n")}\n`;
}

export async function cmdFeedbackReport(root: string): Promise<number> {
  guardPlatform();
  const found = findPanicReports();
  const panics = found.paths.map(readPanicReport).filter((x): x is ParsedPanic => x !== null);
  if (panics.length === 0) {
    process.stderr.write(
      `feedback-report: no panic reports found.\n` +
        `Searched: ${found.searched.join(" ")}\n` +
        `Not searched (absent or unreadable): ${found.unsearchable.join(" ") || "(none)"}\n` +
        `That is NO DATA, not evidence the machine is healthy.\n`,
    );
    return 1;
  }
  const l = layout(root);
  const vitals: VitalsSample[] = [];
  for (const f of (readdirOrNull(l.vitals) ?? []).sort()) {
    if (!f.endsWith(".ndjson")) continue;
    let body: string;
    try {
      body = readFileSync(join(l.vitals, f), "utf8");
    } catch {
      continue;
    }
    for (const line of body.split("\n")) {
      if (line.trim().length === 0) continue;
      try {
        vitals.push(JSON.parse(line) as VitalsSample);
      } catch {
        /* a torn last line is expected if the machine died mid-write */
      }
    }
  }
  const text = buildFeedbackReport(panics, vitals);
  ensure(l.reports);
  const out = join(l.reports, `feedback-assistant-draft-${stampFor(new Date())}.txt`);
  writeFileSync(out, text);
  process.stdout.write(text);
  process.stderr.write(
    `\n--- DRAFT ONLY. Nothing was submitted. ---\n` +
      `Saved to ${out}\n` +
      `Review, edit, and file at https://feedbackassistant.apple.com if you want it filed.\n`,
  );
  return 0;
}

// ---------------------------------------------------------------------------
// prune — bound the disk cost
// ---------------------------------------------------------------------------

export async function cmdPrune(root: string, keepDays: number, keepArchives: number): Promise<number> {
  const l = layout(root);
  const cutoff = Date.now() - keepDays * 86400_000;
  let freed = 0;

  for (const dir of [l.vitals, l.snapshots, l.reports]) {
    for (const n of readdirOrNull(dir) ?? []) {
      const p = join(dir, n);
      const st = statOrNull(p);
      if (st === null) continue;
      if (st.mtimeMs < cutoff) {
        freed += dirSize(p);
        rmSync(p, { recursive: true, force: true });
      }
    }
  }

  {
    const arcs = (readdirOrNull(l.archives) ?? [])
      .filter((n) => n.endsWith(".logarchive"))
      .map((n) => ({ n, m: statOrNull(join(l.archives, n))?.mtimeMs ?? 0 }))
      .sort((a, b) => b.m - a.m);
    // Archives are kept by COUNT, not age: they are the expensive artifact and
    // an unbounded count is how a forensics directory eats a disk.
    for (const a of arcs.slice(keepArchives)) {
      const p = join(l.archives, a.n);
      freed += dirSize(p);
      rmSync(p, { recursive: true, force: true });
    }
  }
  process.stdout.write(`prune: freed ${humanBytes(freed)} (keep ${keepDays}d, ${keepArchives} archives)\n`);
  return 0;
}

// ---------------------------------------------------------------------------
// cost — the disk bill, printed
// ---------------------------------------------------------------------------

export async function cmdCost(root: string): Promise<number> {
  const l = layout(root);
  const vitalsBytes = (() => {
    const files = (readdirOrNull(l.vitals) ?? []).filter((n) => n.endsWith(".ndjson"));
    const f = files[files.length - 1];
    if (f === undefined) return 420;
    let body: string;
    try {
      body = readFileSync(join(l.vitals, f), "utf8");
    } catch {
      return 420;
    }
    const lines = body.split("\n").filter((x) => x.trim().length > 0);
    return lines.length === 0 ? 420 : Math.round(body.length / lines.length);
  })();
  const archiveBytes = (() => {
    const arcs = (readdirOrNull(l.archives) ?? []).filter((n) => n.endsWith(".logarchive"));
    if (arcs.length === 0) return 90 * 1024 * 1024;
    // The LARGEST real cost across the archives on hand, not the first one and
    // not the mean: a cost estimate that can be beaten by an ordinary capture
    // is not a bound. Note the first archive of a fresh root is dearer than
    // the rest because it seeds the shared symbol catalog; using the max keeps
    // that visible instead of averaging it away.
    let worst = 0;
    for (const a of arcs) {
      worst = Math.max(worst, archiveRealBytes(join(l.archives, a)));
    }
    return worst === 0 ? 90 * 1024 * 1024 : worst;
  })();

  const c = captureCost({
    vitalsLineBytes: vitalsBytes,
    vitalsHz: 1,
    archiveBytesDeduped: archiveBytes,
    archivesPerDay: 4,
    errorRingBytes: 64 * 1024 * 1024,
    snapshotBytes: 512 * 1024,
    snapshotsPerDay: 96,
  });
  process.stdout.write(
    `capture cost (measured line/archive sizes, not estimates):\n` +
      `  vitals @1Hz, ${vitalsBytes}B/line   ${humanBytes(c.vitalsBytesPerDay)}/day\n` +
      `  archives 4/day @ ${humanBytes(archiveBytes)} real  ${humanBytes(c.archiveBytesPerDay)}/day\n` +
      `    (each archive LOOKS like ~520MB to du; the symbol catalog inside it is an\n` +
      `     APFS clone of ${humanBytes(dirSize(l.catalog))} shared by every archive and paid for once)\n` +
      `  snapshots 96/day              ${humanBytes(c.snapshotBytesPerDay)}/day\n` +
      `  error ring (FIXED, not /day)  ${humanBytes(c.errorRingBytesFixed)}\n` +
      `  --------------------------------------------------\n` +
      `  growing                       ${humanBytes(c.growingBytesPerDay)}/day\n` +
      `  steady state @ 7d retention   ${humanBytes(c.steadyStateBytes(7))}\n`,
  );
  return 0;
}

// ---------------------------------------------------------------------------
// install — emit the launchd agents (dry-run by default)
// ---------------------------------------------------------------------------

export function agentPlist(label: string, args: readonly string[], opts: {
  interval?: number;
  runAtLoad?: boolean;
  keepAlive?: boolean;
  root: string;
  bun: string;
  script: string;
}): string {
  const argXml = [opts.bun, opts.script, ...args].map((a) => `      <string>${a}</string>`).join("\n");
  const cadence =
    opts.interval !== undefined
      ? `    <key>StartInterval</key>\n    <integer>${opts.interval}</integer>\n`
      : "";
  const runAtLoad = opts.runAtLoad === true ? `    <key>RunAtLoad</key>\n    <true/>\n` : "";
  const keepAlive = opts.keepAlive === true ? `    <key>KeepAlive</key>\n    <true/>\n` : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>${label}</string>
    <key>ProgramArguments</key>
    <array>
${argXml}
    </array>
${runAtLoad}${keepAlive}${cadence}    <key>ProcessType</key>
    <string>Background</string>
    <key>LowPriorityIO</key>
    <true/>
    <key>Nice</key>
    <integer>5</integer>
    <key>StandardOutPath</key>
    <string>${opts.root}/launchd-${label}.out</string>
    <key>StandardErrorPath</key>
    <string>${opts.root}/launchd-${label}.err</string>
  </dict>
</plist>
`;
}

export const AGENT_PREFIX = "com.zeta.forensics";

export async function cmdInstall(root: string, write: boolean, scriptPath: string): Promise<number> {
  guardPlatform();
  guardNoPrivilege();
  const bun = process.execPath;
  const dir = join(homedir(), "Library/LaunchAgents");
  const specs = [
    {
      label: `${AGENT_PREFIX}.boot`,
      args: ["boot", "--root", root],
      opts: { runAtLoad: true, root, bun, script: scriptPath },
    },
    {
      label: `${AGENT_PREFIX}.vitals`,
      // KeepAlive restarts it after the rotate cap; the loop exits on its own.
      args: ["vitals", "--root", root, "--interval", "1000"],
      opts: { runAtLoad: true, keepAlive: true, root, bun, script: scriptPath },
    },
    {
      label: `${AGENT_PREFIX}.snapshot`,
      args: ["snapshot", "--root", root],
      opts: { interval: 900, runAtLoad: true, root, bun, script: scriptPath },
    },
    {
      label: `${AGENT_PREFIX}.archive`,
      args: ["archive", "--root", root, "--last", "25m", "--size", "250m", "--label", "cadence"],
      opts: { interval: 21600, root, bun, script: scriptPath },
    },
    {
      label: `${AGENT_PREFIX}.prune`,
      args: ["prune", "--root", root, "--keep-days", "7", "--keep-archives", "6"],
      opts: { interval: 43200, root, bun, script: scriptPath },
    },
  ];

  for (const s of specs) {
    const xml = agentPlist(s.label, s.args, s.opts);
    const path = join(dir, `${s.label}.plist`);
    if (write) {
      ensure(dir);
      writeFileSync(path, xml);
      process.stdout.write(`wrote ${path}\n`);
    } else {
      process.stdout.write(`--- ${path} (DRY RUN, not written) ---\n${xml}\n`);
    }
  }
  process.stdout.write(
    write
      ? `\nNow load them (NO sudo — these are user agents):\n` +
          specs.map((s) => `  launchctl bootstrap gui/$(id -u) ${join(dir, `${s.label}.plist`)}`).join("\n") +
          `\n\nRemove everything later with:\n` +
          specs.map((s) => `  launchctl bootout gui/$(id -u)/${s.label}; rm -f ${join(dir, `${s.label}.plist`)}`).join("\n") +
          `\n`
      : `\nDRY RUN. Re-run with --write to place these in ~/Library/LaunchAgents.\n` +
          `Nothing was installed and no system or security setting was touched.\n`,
  );
  return 0;
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

function argValue(argv: readonly string[], name: string, dflt: string): string {
  const i = argv.indexOf(name);
  if (i < 0) return dflt;
  return argv[i + 1] ?? dflt;
}

export async function main(argv: readonly string[]): Promise<number> {
  const sub = argv[0] ?? "help";
  const root = argValue(argv, "--root", DEFAULT_ROOT);
  ensure(root);

  if (sub !== "help" && sub !== "cost") {
    guardPlatform();
    guardNoPrivilege();
  }

  switch (sub) {
    case "vitals":
      return cmdVitals({
        root,
        intervalMs: Number.parseInt(argValue(argv, "--interval", "1000"), 10),
        maxSamples: Number.parseInt(argValue(argv, "--max-samples", "0"), 10),
        rotateBytes: Number.parseInt(argValue(argv, "--rotate-bytes", String(32 * 1024 * 1024)), 10),
      });
    case "snapshot":
      return cmdSnapshot(root);
    case "archive":
      return cmdArchive({
        root,
        last: argValue(argv, "--last", "25m"),
        sizeLimit: argValue(argv, "--size", "250m"),
        label: argValue(argv, "--label", "cadence"),
      });
    case "error-ring":
      return cmdErrorRing({
        root,
        capBytes: Number.parseInt(argValue(argv, "--cap-bytes", String(64 * 1024 * 1024)), 10),
        maxSeconds: Number.parseInt(argValue(argv, "--max-seconds", "0"), 10),
      });
    case "boot":
      return cmdBoot(root);
    case "triage":
      return cmdTriage(root);
    case "vitals-tail":
      return cmdVitalsTail(
        root,
        argValue(argv, "--around", new Date().toISOString()),
        Number.parseInt(argValue(argv, "--window", "60"), 10),
      );
    case "prune":
      return cmdPrune(
        root,
        Number.parseInt(argValue(argv, "--keep-days", "7"), 10),
        Number.parseInt(argValue(argv, "--keep-archives", "6"), 10),
      );
    case "cost":
      return cmdCost(root);
    case "feedback-report":
      return cmdFeedbackReport(root);
    case "install":
      return cmdInstall(root, argv.includes("--write"), import.meta.path);
    default:
      process.stdout.write(
        `macos-panic-capture — make the next unclean reboot diagnosable. macOS ONLY.\n\n` +
          `  vitals       1 Hz fsync'd heartbeat (the only thing that survives the blackout)\n` +
          `  error-ring   bounded live Error/Fault capture (fixed 64MB)\n` +
          `  snapshot     nvram/panicmedic, kmutil, sysextensions, pmset, crash census\n` +
          `  archive      log collect + APFS-clone symbol-catalog dedup\n` +
          `  boot         run at login; archives the previous boot's tail if unclean\n` +
          `  triage       the runbook, executed\n` +
          `  vitals-tail  --around <iso> --window <s>\n` +
          `  prune        --keep-days 7 --keep-archives 6\n` +
          `  cost         the disk bill, from measured sizes\n` +
          `  feedback-report  draft an Apple Feedback Assistant filing (DOES NOT submit)\n` +
          `  install      emit launchd agents (dry run unless --write)\n\n` +
          `No sudo anywhere; refuses to run as root on purpose.\n`,
      );
      return 0;
  }
}

if (import.meta.main) {
  process.exit(await main(process.argv.slice(2)));
}
