#!/usr/bin/env bun
/**
 * 081KR7JY10008QG0R0008NGW95 Slice 1: Shadow observer — polling loop + Glass Halo attribution.
 *
 * Watches the Claude Code CLI for grey text (autocomplete suggestions)
 * and auto-accepts after a configurable delay if no human keystroke
 * interrupts.
 *
 * Slice 1 (PR #2973): polling loop infrastructure + testable dry-run mode.
 * Slice 2 (this PR): --detect-cmd flag wires any shell command as the detector.
 * Slice 3 (deferred): `zeta shadow` top-level CLI entry point + installation.
 *
 * The Lost analogy: Desmond pushed the button every 108 minutes.
 * This script pushes the button so Desmond can leave the hatch.
 *
 * Safety:
 * - Human keystroke at any time = immediate override (slice 2)
 * - All shadow submissions logged to shadow-observer.log (Glass Halo)
 * - Kill the script = shadow goes silent (circuit breaker)
 * - --dry-run: logs intended actions without sending keystrokes
 *
 * Usage:
 *   bun src/Core.TypeScript/shadow/shadow-observer.ts [--delay <ms>] [--detect-cmd <cmd>]
 *     [--dry-run] [--once] [--loop <ms>] [--loop-interval <ms>] [--log-file <path>]
 *     [--restore-arrow]
 *
 * Flags:
 *   --delay <ms>          Delay before auto-accepting (default: 3000)
 *   --detect-cmd <cmd>    Shell command run each cycle to detect grey text.
 *                         Exit 0 = suggestion present (stdout is content).
 *                         Exit non-0 = no suggestion. Default: built-in stub.
 *   --dry-run             Log intended actions without sending keystrokes
 *   --loop <ms>           After natural exit, wait <ms> then restart. SIGINT/SIGTERM
 *                         terminate immediately and are never restarted.
 *   --once                Run exactly one detection cycle then exit
 *   --loop-interval <ms>  Continuous mode: sleep between cycles (default: 1000)
 *   --log-file <path>     Log file path (default: tools/shadow/shadow-observer.log)
 *   --restore-arrow       At the start of each cycle, press → (right arrow) in the
 *                         frontmost terminal to restore grey-text autocomplete that
 *                         got erased by an autonomous-loop cron tick. Frontmost-
 *                         terminal-gated; no-op when no autocomplete + cursor at
 *                         end of input. Suppressed under --dry-run.
 */

import { appendFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "util";
import { FerryThrottler } from "../ferry-throttler/ferry-throttler.ts";

export interface ShadowConfig {
  delayMs: number;
  detectCmd?: string;
  dryRun: boolean;
  logFile: string;
  loopIntervalMs: number;
  loopMs?: number;
  once: boolean;
  restoreArrow: boolean;
  /** Skip AX-heavy detection + restore-arrow keypresses while the frontmost
   *  window has been frontmost for less than this many milliseconds.
   *  Prevents interference with shell init (e.g. zsh .zshrc loading in a
   *  freshly-opened terminal). CLI default 0 (disabled) so test fixtures
   *  see deterministic detection on first cycle; production sets 5000ms via
   *  the launchd plist (`--freshness-threshold-ms 5000`) — explicit-flag
   *  discipline keeps the production safety choice visible in the config. */
  freshnessThresholdMs: number;
}

export interface ShadowEvent {
  timestamp: string;
  type: "started" | "detected" | "accepted" | "overridden" | "no-suggestion" | "error" | "restore-arrow" | "skipped-fresh-window";
  content?: string;
  /** v2 delta-detect: the suffix-extension of the input field's text after the → press
   *  (the restored autocomplete content). Empty when no text changed (the
   *  common no-op case). Present only on `restore-arrow` events. */
  delta?: string;
  /** v2 delta-detect: character length of delta. Cheap at-a-glance scan of the log
   *  to find non-trivial restores without scrolling the content. */
  deltaLen?: number;
  delayMs: number;
  dryRun: boolean;
}

/** v2 delta-detect: structured result from pressRestoreArrow. The
 *  AppleScript returns one stdout line "<verdict><delta>" (ASCII Unit
 *  Separator); this type is the parsed form. */
export interface RestoreArrowResult {
  /** "pressed:<app>" | "skipped:<reason>" | "error:<reason>" */
  verdict: string;
  /** The restored content (suffix-extension) if any; empty string when nothing changed. */
  delta: string;
}

export type DetectFn = () => Promise<string | null>;
export type AcceptFn = (config: ShadowConfig) => Promise<boolean>;
export type RestoreArrowFn = () => Promise<RestoreArrowResult>;

/** ASCII Unit Separator — delimiter between verdict and delta in the
 *  restore-arrow AppleScript output. Unlikely to appear in user input. */
export const RESTORE_ARROW_SEP = "";

/** Parse the restore-arrow AppleScript stdout line into verdict + delta. */
export function parseRestoreArrowOutput(raw: string): RestoreArrowResult {
  const idx = raw.indexOf(RESTORE_ARROW_SEP);
  if (idx === -1) {
    // v1 AppleScript without sep — verdict only, no delta material
    return { verdict: raw.trim(), delta: "" };
  }
  // Don't trim the delta — leading/trailing whitespace may be meaningful
  // for autocomplete-restored content. The verdict portion is trimmed.
  return { verdict: raw.slice(0, idx).trim(), delta: raw.slice(idx + 1).replace(/\n+$/, "") };
}

export function log(event: ShadowEvent, logFile: string): void {
  const line = JSON.stringify(event);
  console.log(line);
  try {
    appendFileSync(logFile, line + "\n");
  } catch {
    // log write failure is non-fatal — shadow continues
  }
}

/**
 * Injectable osascript runner — for testing without real osascript.
 * Production code uses the default `runOsascript` implementation.
 */
export type OsascriptRunner = (
  scriptPath: string,
  terminalApp?: string,
) => Promise<{ exitCode: number; stdout: string; stderr: string }>;

// osascript can hang waiting for an accessibility-permission dialog; 3 s cap.
const OSASCRIPT_TIMEOUT_MS = 3000;

async function runOsascript(
  scriptPath: string,
  terminalApp?: string,
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const args = terminalApp
    ? ["osascript", scriptPath, terminalApp]
    : ["osascript", scriptPath];
  const proc = Bun.spawn(args, { stdout: "pipe", stderr: "pipe" });

  const runResult = async () => {
    const exitCode = await proc.exited;
    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    return { exitCode, stdout, stderr };
  };

  const timeout = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error(`osascript timed out after ${OSASCRIPT_TIMEOUT_MS}ms`)),
      OSASCRIPT_TIMEOUT_MS,
    ),
  );

  try {
    return await Promise.race([runResult(), timeout]);
  } catch (err) {
    try { proc.kill(); } catch { /* ignore kill errors */ }
    throw err;
  }
}

/**
 * Detect grey text (autocomplete suggestion) in the frontmost terminal
 * emulator on macOS via the accessibility tree (osascript).
 *
 * @param terminalApp  Optional: target a specific terminal app by name.
 * @param _runner      For testing: injectable osascript executor.
 * @param _platform    For testing: override process.platform.
 */
export async function detectGreyTextMacOS(
  terminalApp?: string,
  _runner?: OsascriptRunner,
  _platform?: string,
): Promise<string | null> {
  const platform = _platform ?? process.platform;
  if (platform !== "darwin") {
    console.warn("[shadow] detectGreyTextMacOS: skipping on non-macOS platform");
    return null;
  }

  const runner = _runner ?? runOsascript;
  const scriptPath = join(import.meta.dir, "detect-grey-text.applescript");

  let result: { exitCode: number; stdout: string; stderr: string };
  try {
    result = await runner(scriptPath, terminalApp);
  } catch (err) {
    console.warn(`[shadow] detectGreyTextMacOS: spawn error: ${String(err)}`);
    return null;
  }

  if (result.exitCode !== 0) {
    const isPermDenied =
      result.stderr.includes("-1002") ||
      result.stderr.includes("-1743") ||
      result.stderr.toLowerCase().includes("not permitted") ||
      result.stderr.toLowerCase().includes("permission denied");
    if (isPermDenied) {
      console.warn("[shadow] detectGreyTextMacOS: accessibility permission denied");
    } else {
      console.warn(
        `[shadow] detectGreyTextMacOS: osascript exited ${result.exitCode}, returning null`,
      );
    }
    return null;
  }

  const trimmed = result.stdout.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function detectGreyText(): Promise<string | null> {
  return detectGreyTextMacOS();
}

/**
 * Detect grey text via an external shell command (slice 2).
 *
 * The command is run as a subprocess. Contract:
 *   - Exit 0: suggestion present. Stdout (trimmed) is the content.
 *     Empty stdout → returns the sentinel "(detected)" so callers
 *     see a non-null truthy string (e.g. `true` or a no-output AppleScript).
 *   - Exit non-0: no suggestion → returns null.
 *
 * On spawn error (e.g. command not found) the promise rejects; the
 * caller's try/catch (runOneCycle) handles it as "error".
 */
export async function detectViaCommand(cmd: string): Promise<string | null> {
  const proc = Bun.spawn(["sh", "-c", cmd], {
    stdout: "pipe",
    stderr: "ignore",
  });
  const exitCode = await proc.exited;
  if (exitCode !== 0) return null;
  const raw = await new Response(proc.stdout).text();
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : "(detected)";
}

/**
 * Press the right-arrow key once in the frontmost terminal (if a known
 * terminal emulator). Used to restore grey-text autocomplete suggestions
 * that get erased when an autonomous-loop cron tick fires a user prompt
 * in the CLI input field. Composes with `restore-arrow.applescript`.
 *
 * Returns the AppleScript verdict line: "pressed:<app>" or
 * "skipped:<reason>". The verdict is what the caller logs.
 *
 * **The press is NOT suppressed by --dry-run.** Rationale: --dry-run
 * exists to prevent the destructive Enter-to-accept keystroke. The →
 * press is non-destructive — no-op when no autocomplete + cursor at end
 * of input. Suppressing it under dry-run would defeat the entire purpose
 * (the observer is the dry-run mode; restore-arrow is the active
 * defensive recovery for cron-erased grey-text). The two flags are
 * orthogonal and can be combined.
 *
 * Safety:
 *   - Frontmost-terminal gate is the AppleScript's job; this function
 *     trusts that gate. The list of known terminals lives in the
 *     AppleScript so adding a new emulator requires a single edit.
 *   - osascript is timeout-capped via OSASCRIPT_TIMEOUT_MS (3 s) — same
 *     as detection. Slow accessibility-permission prompts never block the
 *     loop indefinitely.
 *   - On spawn / timeout error, returns "error:<message>" so the caller
 *     can log it without throwing.
 */
export async function pressRestoreArrow(
  _config: ShadowConfig,
  _runner?: OsascriptRunner,
  _platform?: string,
): Promise<RestoreArrowResult> {
  const platform = _platform ?? process.platform;
  if (platform !== "darwin") {
    return { verdict: "skipped:not-macos", delta: "" };
  }

  const runner = _runner ?? runOsascript;
  const scriptPath = join(import.meta.dir, "restore-arrow.applescript");

  let result: { exitCode: number; stdout: string; stderr: string };
  try {
    result = await runner(scriptPath);
  } catch (err) {
    return { verdict: `error:${String(err)}`, delta: "" };
  }

  if (result.exitCode !== 0) {
    return { verdict: `error:osascript-exit-${result.exitCode}`, delta: "" };
  }

  if (result.stdout.length === 0) {
    return { verdict: "error:empty-output", delta: "" };
  }
  return parseRestoreArrowOutput(result.stdout);
}

export async function acceptGreyText(config: ShadowConfig): Promise<boolean> {
  if (config.dryRun) {
    return true;
  }
  // Phase 1: AppleScript — Right Arrow (accept autocomplete) + Enter (submit)
  const script = `
    tell application "System Events"
      key code 124
      delay 0.1
      key code 36
    end tell
  `;
  const proc = Bun.spawn(["osascript", "-e", script], {
    stdout: "pipe",
    stderr: "pipe",
  });
  return (await proc.exited) === 0;
}

/** Minimal state describing the frontmost application.
 *  Returned by `getFrontmostState` (cheap query — no AXValue traversal).
 *  Used by the freshness-threshold guard to skip AX-heavy cycles while a
 *  newly-focused window is still settling. */
export interface FrontmostState {
  pid: number;
  name: string;
}

/** Per-process history of frontmost-window first-seen timestamps. Key is
 *  `${pid}|${name}`. Value is the ms-since-epoch when this combination
 *  was first observed as frontmost. Module-level state is consistent with
 *  the procedural shape of this file; `_resetFrontmostHistory` is exported
 *  for test isolation.
 *
 *  Bounded to FRONTMOST_HISTORY_MAX entries — when full, the oldest
 *  insertion is evicted (Map preserves insertion order). Bound prevents
 *  unbounded growth on long-running launch agents that observe many
 *  distinct pids across app restarts. */
export const FRONTMOST_HISTORY_MAX = 256;
const frontmostHistory: Map<string, number> = new Map();

/** Test helper — clears the per-process frontmost history. */
export function _resetFrontmostHistory(): void {
  frontmostHistory.clear();
}

/** Query the frontmost application's pid + name via osascript. Cheap (no
 *  AXValue traversal, no key injection). Returns null on any error or
 *  non-darwin platform — caller treats null as "unknown, skip cycle." */
export async function getFrontmostState(
  _runner?: OsascriptRunner,
  _platform?: string,
): Promise<FrontmostState | null> {
  const platform = _platform ?? process.platform;
  if (platform !== "darwin") return null;

  const runner = _runner ?? runOsascript;
  const scriptPath = join(import.meta.dir, "get-frontmost-state.applescript");

  let result: { exitCode: number; stdout: string; stderr: string };
  try {
    result = await runner(scriptPath);
  } catch {
    return null;
  }
  if (result.exitCode !== 0) return null;

  const trimmed = result.stdout.trim();
  if (trimmed.length === 0) return null;

  const sepIdx = trimmed.indexOf("|");
  if (sepIdx === -1) return null;

  const pidStr = trimmed.slice(0, sepIdx);
  const name = trimmed.slice(sepIdx + 1);
  const pid = parseInt(pidStr, 10);
  if (!Number.isFinite(pid) || pid <= 0 || name.length === 0) return null;

  return { pid, name };
}

/** Freshness check with side-effect: records first-seen ms in `history`
 *  on first sighting so subsequent cycles can measure age. Returns true
 *  if the window has been frontmost for at least `thresholdMs`, false
 *  if too fresh (caller should skip the cycle).
 *
 *  When `history` grows past FRONTMOST_HISTORY_MAX, evicts the oldest
 *  insertion (Map preserves insertion order) to keep memory bounded.
 *
 *  Threshold of 0 disables the guard (always returns true; no mutation). */
export function checkWindowFresh(
  state: FrontmostState,
  thresholdMs: number,
  nowMs: number,
  history: Map<string, number> = frontmostHistory,
): boolean {
  if (thresholdMs <= 0) return true;
  const key = `${state.pid}|${state.name}`;
  const firstSeen = history.get(key);
  if (firstSeen === undefined) {
    if (history.size >= FRONTMOST_HISTORY_MAX) {
      const oldestKey = history.keys().next().value;
      if (oldestKey !== undefined) history.delete(oldestKey);
    }
    history.set(key, nowMs);
    return false; // first sighting → too fresh
  }
  return nowMs - firstSeen >= thresholdMs;
}

export async function runOneCycle(
  config: ShadowConfig,
  detectFn: DetectFn = detectGreyText,
  acceptFn: AcceptFn = acceptGreyText,
  restoreArrowFn: RestoreArrowFn = () => pressRestoreArrow(config),
  getFrontmostStateFn: () => Promise<FrontmostState | null> = getFrontmostState,
  nowMs: () => number = Date.now,
): Promise<"accepted" | "no-suggestion" | "overridden" | "error" | "skipped-fresh-window"> {
  // Freshness guard: skip AX-heavy detection + restore-arrow keypresses
  // while the frontmost window is still settling. Prevents interference
  // with shell init (e.g. zsh .zshrc loading in a freshly-opened terminal).
  //
  // Per `getFrontmostState`'s contract, null = "unknown, skip cycle" — so a
  // probe failure (no accessibility permission, osascript error) also skips
  // the AX-heavy work below, not just a too-fresh window.
  if (config.freshnessThresholdMs > 0) {
    const state = await getFrontmostStateFn();
    if (state === null) {
      log(
        {
          timestamp: new Date().toISOString(),
          type: "skipped-fresh-window",
          content: "frontmost-unknown (probe returned null)",
          delayMs: config.delayMs,
          dryRun: config.dryRun,
        },
        config.logFile,
      );
      return "skipped-fresh-window";
    }
    if (!checkWindowFresh(state, config.freshnessThresholdMs, nowMs())) {
      log(
        {
          timestamp: new Date().toISOString(),
          type: "skipped-fresh-window",
          content: `${state.name} (pid ${state.pid}) frontmost <${config.freshnessThresholdMs}ms`,
          delayMs: config.delayMs,
          dryRun: config.dryRun,
        },
        config.logFile,
      );
      return "skipped-fresh-window";
    }
  }

  if (config.restoreArrow) {
    let result: RestoreArrowResult;
    try {
      result = await restoreArrowFn();
    } catch (err) {
      result = { verdict: `error:${String(err)}`, delta: "" };
    }
    log(
      {
        timestamp: new Date().toISOString(),
        type: "restore-arrow",
        content: result.verdict,
        delta: result.delta,
        deltaLen: result.delta.length,
        delayMs: config.delayMs,
        dryRun: config.dryRun,
      },
      config.logFile,
    );
  }

  let greyText: string | null;
  try {
    greyText = await detectFn();
  } catch (err) {
    log(
      {
        timestamp: new Date().toISOString(),
        type: "error",
        content: `detectGreyText threw: ${String(err)}`,
        delayMs: config.delayMs,
        dryRun: config.dryRun,
      },
      config.logFile,
    );
    return "error";
  }

  if (!greyText) {
    log(
      {
        timestamp: new Date().toISOString(),
        type: "no-suggestion",
        delayMs: config.delayMs,
        dryRun: config.dryRun,
      },
      config.logFile,
    );
    return "no-suggestion";
  }

  log(
    {
      timestamp: new Date().toISOString(),
      type: "detected",
      content: greyText,
      delayMs: config.delayMs,
      dryRun: config.dryRun,
    },
    config.logFile,
  );

  await Bun.sleep(config.delayMs);

  // Re-check: if grey text is gone, a human keystroke overrode it.
  let stillPresent: string | null;
  try {
    stillPresent = await detectFn();
  } catch {
    stillPresent = null;
  }

  if (!stillPresent) {
    log(
      {
        timestamp: new Date().toISOString(),
        type: "overridden",
        content: "(shadow cancelled — suggestion cleared during delay)",
        delayMs: config.delayMs,
        dryRun: config.dryRun,
      },
      config.logFile,
    );
    return "overridden";
  }

  let ok: boolean;
  try {
    ok = await acceptFn(config);
  } catch (err) {
    log(
      {
        timestamp: new Date().toISOString(),
        type: "error",
        content: `acceptGreyText threw: ${String(err)}`,
        delayMs: config.delayMs,
        dryRun: config.dryRun,
      },
      config.logFile,
    );
    return "error";
  }

  if (ok) {
    log(
      {
        timestamp: new Date().toISOString(),
        type: "accepted",
        content: config.dryRun ? "(shadow dry-run accept)" : "(shadow auto-accept)",
        delayMs: config.delayMs,
        dryRun: config.dryRun,
      },
      config.logFile,
    );
    return "accepted";
  }

  log(
    {
      timestamp: new Date().toISOString(),
      type: "error",
      content: "acceptGreyText returned false",
      delayMs: config.delayMs,
      dryRun: config.dryRun,
    },
    config.logFile,
  );
  return "error";
}

async function runInner(
  config: ShadowConfig,
  detectFn: DetectFn,
  acceptFn: AcceptFn,
  eventSink?: FerryThrottler<ShadowEvent>,
): Promise<void> {
  const startEvent: ShadowEvent = {
    timestamp: new Date().toISOString(),
    type: "started",
    content: `Shadow observer started (delay=${config.delayMs}ms, dry-run=${config.dryRun}, once=${config.once})`,
    delayMs: config.delayMs,
    dryRun: config.dryRun,
  };
  log(startEvent, config.logFile);
  if (eventSink) eventSink.tryEnqueue(startEvent);

  if (config.once) {
    await runOneCycle(config, detectFn, acceptFn);
    return;
  }

  // Continuous loop — exits only on SIGINT/SIGTERM or process kill.
  while (true) {
    await runOneCycle(config, detectFn, acceptFn);
    await Bun.sleep(config.loopIntervalMs);
  }
}

export async function run(
  config: ShadowConfig,
  detectFn: DetectFn = config.detectCmd
    ? () => detectViaCommand(config.detectCmd!)
    : detectGreyText,
  acceptFn: AcceptFn = acceptGreyText,
): Promise<void> {
  // The event sink throttler — downstream consumers (bus, observe loop) can
  // subscribe to shadow observer events with backpressure. When this becomes a
  // room in the multi-room architecture, the throttler is the outbound channel.
  // DoP=1 keeps the sequential cycle semantics; the throttler adds backpressure
  // + priority-readiness for when multiple rooms share rate-limited resources.
  const eventSink = new FerryThrottler<ShadowEvent>(
    { maxDegreeOfParallelism: 1, maxBatchSize: 64, maxQueueSize: 256 },
    async (_boat) => {
      // Default sink: no-op (events are logged by `log()` already).
      // The room adapter will replace this with bus.publish or similar.
    },
  );

  if (config.loopMs === undefined) {
    await runInner(config, detectFn, acceptFn, eventSink);
    await eventSink.complete();
    return;
  }

  // Outer restart loop: after natural exit, wait loopMs then restart.
  // SIGINT/SIGTERM use 128+signal exit codes (130/143) so shell automation and
  // supervisors can distinguish interruption from clean completion.  Registering
  // direct-exit listeners is required because Node/Bun removes its default
  // exit behaviour once any listener is attached.
  process.on("SIGINT",  () => { eventSink.dispose(); process.exit(130); });
  process.on("SIGTERM", () => { eventSink.dispose(); process.exit(143); });
  // eslint-disable-next-line no-constant-condition
  while (true) {
    await runInner(config, detectFn, acceptFn, eventSink);
    await Bun.sleep(config.loopMs);
  }
}

export function parseConfig(argv: string[]): ShadowConfig {
  const { values } = parseArgs({
    args: argv,
    options: {
      delay: { type: "string", default: "3000" },
      "detect-cmd": { type: "string" },
      "dry-run": { type: "boolean", default: false },
      loop: { type: "string" },
      once: { type: "boolean", default: false },
      "loop-interval": { type: "string", default: "1000" },
      "log-file": { type: "string", default: "src/Core.TypeScript/shadow/shadow-observer.log" },
      "restore-arrow": { type: "boolean", default: false },
      "freshness-threshold-ms": { type: "string", default: "0" },
    },
    strict: true,
  });

  const delayMs = parseInt(values.delay ?? "3000", 10);
  if (!Number.isFinite(delayMs) || delayMs < 0) {
    console.error("Error: --delay must be a non-negative integer (milliseconds)");
    process.exit(1);
  }

  const loopIntervalMs = parseInt(values["loop-interval"] ?? "1000", 10);
  if (!Number.isFinite(loopIntervalMs) || loopIntervalMs < 0) {
    console.error("Error: --loop-interval must be a non-negative integer (milliseconds)");
    process.exit(1);
  }

  let loopMs: number | undefined;
  if (values.loop !== undefined) {
    if (!/^\d+$/.test(values.loop)) {
      console.error("Error: --loop must be a positive integer (milliseconds)");
      process.exit(1);
    }
    const parsed = parseInt(values.loop, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      console.error("Error: --loop must be a positive integer (milliseconds)");
      process.exit(1);
    }
    loopMs = parsed;
  }

  const freshnessThresholdMs = parseInt(values["freshness-threshold-ms"] ?? "0", 10);
  if (!Number.isFinite(freshnessThresholdMs) || freshnessThresholdMs < 0) {
    console.error("Error: --freshness-threshold-ms must be a non-negative integer (milliseconds)");
    process.exit(1);
  }

  const base = {
    delayMs,
    dryRun: values["dry-run"] ?? false,
    once: values.once ?? false,
    loopIntervalMs,
    logFile: values["log-file"] ?? "src/Core.TypeScript/shadow/shadow-observer.log",
    restoreArrow: values["restore-arrow"] ?? false,
    freshnessThresholdMs,
  };
  const detectCmd = values["detect-cmd"];
  const withDetect = detectCmd !== undefined ? { ...base, detectCmd } : base;
  return loopMs !== undefined ? { ...withDetect, loopMs } : withDetect;
}

if (import.meta.main) {
  const config = parseConfig(Bun.argv.slice(2));
  run(config).catch((err: unknown) => {
    console.error("Shadow observer fatal error:", err);
    process.exit(1);
  });
}
