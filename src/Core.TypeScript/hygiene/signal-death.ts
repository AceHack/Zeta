#!/usr/bin/env bun
/**
 * signal-death.ts — a process that died on a SIGNAL is not a process that
 * answered a question.
 *
 * THE DEFECT THIS EXISTS TO CLOSE
 * ------------------------------------------------------------------------
 * Exit 139 is 128 + 11 = SIGSEGV. Exit 134 is 128 + 6 = SIGABRT. Neither is a
 * "program returned nonzero"; both are the kernel killing the process. A
 * segfaulting process usually prints NOTHING before it dies — so any check
 * that decides PASS by the ABSENCE of a string in the output reads a signal
 * death as a clean run.
 *
 * Measured, not supposed (2026-08-15, this machine, arm64 macOS 25.5):
 *
 *     bunx tsc --noEmit   ->  exit 139, stdout+stderr = 0 bytes,
 *                             `grep -c "error TS"` = 0
 *
 * Identical tree, identical command: 1 crash in 10 sequential runs on a busy
 * machine, 0 in 11 on an idle one — the same input, two different answers. And
 * the repo's OWN invocation path is not exempt: `bun node_modules/typescript/
 * bin/tsc` took a SIGTRAP (133) under concurrency on an unmodified worktree.
 * Any grep-decides-pass check
 * over that output would have recorded a green typecheck for a compiler that
 * never finished. That is §7 DST violated (does not replay) and §13
 * noninterference violated (an unmetered influence decided the result).
 *
 * WHAT THIS MODULE GIVES YOU
 * ------------------------------------------------------------------------
 *   classifyExit()      — Completed / ExitedNonZero / DiedOnSignal, from a
 *                         node:child_process result OR from a bare shell code.
 *   describeExitCode()  — 139 -> "SIGSEGV (128+11)", so a log line says what
 *                         happened instead of printing a number.
 *   assertCompleted()   — throws unless the process actually finished. Call it
 *                         BEFORE you look at the output, never after.
 *
 * The rule is one sentence: **check the exit disposition before you interpret
 * the output, because a crash produces the same output as a pass.**
 *
 * Beacon anchors:
 *   - POSIX.1-2017 §2.8.2 / `waitpid(2)` WIFSIGNALED — the shell's 128+N
 *     convention for "terminated by signal N" (Bourne, sh; adopted by every
 *     POSIX shell). Node reports it structurally instead: `status === null`
 *     and `signal === "SIGSEGV"`.
 *   - Goguen & Meseguer 1982, noninterference — a result must depend only on
 *     declared, metered inputs; a nondeterministic crash is an undeclared one.
 */

/** Signal number -> name, for the signals a build tool actually dies on. */
const SIGNAL_NAMES: Readonly<Record<number, string>> = {
  1: "SIGHUP",
  2: "SIGINT",
  3: "SIGQUIT",
  4: "SIGILL",
  // 133 = 128+5. Bun's own panic/assert path on macOS arm64 surfaces here, and
  // it is the signal MEASURED crashing this repo's typecheck under concurrency
  // (`Trace/BPT trap: 5`, 2026-08-15) — so leaving it out would have rendered
  // the one crash we actually caught as an anonymous "signal 5".
  5: "SIGTRAP",
  6: "SIGABRT",
  7: "SIGBUS",
  8: "SIGFPE",
  9: "SIGKILL",
  10: "SIGBUS/SIGUSR1",
  11: "SIGSEGV",
  13: "SIGPIPE",
  15: "SIGTERM",
  24: "SIGXCPU",
  25: "SIGXFSZ",
};

/** The shell's "terminated by signal N" encoding (POSIX 128+N). */
export const SIGNAL_EXIT_BASE = 128;

/**
 * A shell exit code above this is a signal death, not a program's own status.
 * 128+31 covers every standard signal; codes above 159 are not signal deaths
 * under the POSIX convention, so the window is deliberately closed at the top.
 */
export const MAX_SIGNAL_EXIT_CODE = SIGNAL_EXIT_BASE + 31;

export type ExitDisposition =
  /** Ran to completion and said what it had to say. Output is meaningful. */
  | { readonly kind: "completed"; readonly code: 0 }
  /** Ran to completion, answered "no". Output is meaningful. */
  | { readonly kind: "exited"; readonly code: number }
  /** Killed. Output is TRUNCATED AT AN ARBITRARY POINT and means nothing. */
  | {
      readonly kind: "signal";
      readonly signal: string;
      readonly signalNumber: number | null;
      readonly shellCode: number | null;
    }
  /** Never started (ENOENT, EACCES, spawn failure). Output means nothing. */
  | { readonly kind: "never-started"; readonly message: string };

/** True when a bare shell exit code encodes "killed by a signal" (128+N). */
export function isSignalExitCode(code: number): boolean {
  return Number.isInteger(code) && code > SIGNAL_EXIT_BASE && code <= MAX_SIGNAL_EXIT_CODE;
}

/** 139 -> 11. Returns null when the code is not a signal death. */
export function signalNumberOf(code: number): number | null {
  return isSignalExitCode(code) ? code - SIGNAL_EXIT_BASE : null;
}

/** 11 -> "SIGSEGV"; unknown numbers keep their number rather than lying. */
export function signalName(signalNumber: number): string {
  return SIGNAL_NAMES[signalNumber] ?? `signal ${signalNumber}`;
}

/**
 * A human-legible rendering of a raw shell exit code.
 * `139` -> `"139 = SIGSEGV (128+11) — the process was KILLED, it did not answer"`.
 */
export function describeExitCode(code: number): string {
  if (code === 0) return "0 (completed)";
  const n = signalNumberOf(code);
  if (n === null) return `${code} (exited)`;
  return `${code} = ${signalName(n)} (128+${n}) — the process was KILLED, it did not answer`;
}

/** The subset of a node:child_process spawnSync result this module reads. */
export interface SpawnLikeResult {
  readonly status: number | null;
  readonly signal: string | null;
  readonly error?: Error | undefined;
}

/**
 * Classify a `spawnSync`-shaped result.
 *
 * Node's contract: on a signal death `status` is `null` and `signal` is the
 * name. Callers that write `result.status !== 0` therefore compare `null !== 0`
 * and happen to be right; callers that write `result.status === 0` are right
 * too — but callers that write `(result.status ?? 0) === 0`, or that ignore the
 * status entirely and grep `result.stdout`, are WRONG in exactly the way that
 * turns a crash into a pass.
 */
export function classifyExit(result: SpawnLikeResult): ExitDisposition {
  if (result.error) {
    return { kind: "never-started", message: result.error.message };
  }
  if (result.signal !== null && result.signal !== undefined) {
    const entry = Object.entries(SIGNAL_NAMES).find(([, name]) => name === result.signal);
    const signalNumber = entry ? Number(entry[0]) : null;
    return {
      kind: "signal",
      signal: result.signal,
      signalNumber,
      shellCode: signalNumber === null ? null : SIGNAL_EXIT_BASE + signalNumber,
    };
  }
  if (result.status === null) {
    // No status and no signal: node could not tell us how it ended. Refusing is
    // the only honest answer — "unknown" must never widen into "fine".
    return { kind: "never-started", message: "process ended with neither an exit status nor a signal" };
  }
  if (result.status === 0) return { kind: "completed", code: 0 };
  return { kind: "exited", code: result.status };
}

/**
 * Classify a bare shell exit code (what you get from `$?`, or from a runner
 * that only reports an integer). Less information than `classifyExit`: a
 * program that genuinely `exit 139`s is indistinguishable from a segfault at
 * this resolution, which is itself a reason to prefer the structured form.
 */
export function classifyShellCode(code: number): ExitDisposition {
  if (code === 0) return { kind: "completed", code: 0 };
  const n = signalNumberOf(code);
  if (n !== null) {
    return { kind: "signal", signal: signalName(n), signalNumber: n, shellCode: code };
  }
  return { kind: "exited", code };
}

/** True when the output of this process may be interpreted at all. */
export function producedInterpretableOutput(d: ExitDisposition): boolean {
  return d.kind === "completed" || d.kind === "exited";
}

/** One line describing a disposition, suitable for a CI log. */
export function describeDisposition(d: ExitDisposition): string {
  switch (d.kind) {
    case "completed":
      return "completed (exit 0)";
    case "exited":
      return `exited ${d.code}`;
    case "signal":
      return `KILLED BY ${d.signal}${d.shellCode === null ? "" : ` (shell code ${d.shellCode})`} — no verdict was produced`;
    case "never-started":
      return `never started — ${d.message}`;
  }
}

export class SignalDeathError extends Error {
  // Written as fields + assignments, not constructor parameter properties:
  // the repo compiles with `erasableSyntaxOnly`, which rejects the latter.
  readonly label: string;
  readonly disposition: ExitDisposition;

  constructor(label: string, disposition: ExitDisposition) {
    super(`${label}: ${describeDisposition(disposition)}`);
    this.name = "SignalDeathError";
    this.label = label;
    this.disposition = disposition;
  }
}

/**
 * Refuse to continue unless the process ran to completion with exit 0.
 *
 * Call this BEFORE grepping the output. The whole point is ordering: after the
 * grep, a crash has already been laundered into whatever the grep concluded.
 */
export function assertCompleted(label: string, result: SpawnLikeResult): void {
  const d = classifyExit(result);
  if (d.kind !== "completed") throw new SignalDeathError(label, d);
}
