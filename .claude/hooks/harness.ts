// harness.ts — shared Claude Code hooks harness for Otto-discipline hooks
//
// Exports common types and utilities used by all discipline hook scripts
// under .claude/hooks/. Import this module; do NOT wire it into
// .claude/settings.json directly — only concrete hook scripts are wired.
//
// Hook contract (Anthropic Claude Code hooks API):
//   - Hook script reads stdin JSON (the tool call payload).
//   - To ALLOW: exit 0 with no stdout output (default path).
//   - To DENY:  print the hookDecision JSON to stdout, then exit 0.
//   - Exit codes other than 0 are treated as errors, not denials.
//
// Per 081KR50HA0008QG0R002B3N54S (PR atomic child of 081KQ3HBZ0008QG0R0008RYCSX).

import { tmpdir } from "node:os";
import { join } from "node:path";

export type HookEventName = "PreToolUse" | "PostToolUse";

/** Raw Claude Code hook input payload (stdin JSON).
 *
 *  NOTE: every Claude Code hook invocation carries MORE than tool_name /
 *  tool_input — the API also sends a stable per-session `session_id` and the
 *  session `cwd`. These were previously undeclared, which is the root cause of
 *  the OTTO343_READLOG_TAG bug (read-log keyed on the per-process ppid instead
 *  of the stable session id). Declare them so hooks can key durable state on
 *  the session, never on a process that lives for a single hook call. */
export interface HookInput {
  readonly tool_name?: string;
  readonly tool_input?: Record<string, unknown>;
  readonly session_id?: string;
  readonly cwd?: string;
}

/** JSON output for a deny decision (the only case that requires stdout). */
export interface HookDecision {
  readonly hookSpecificOutput: {
    readonly hookEventName: HookEventName;
    readonly permissionDecision: "allow" | "deny";
    readonly permissionDecisionReason?: string;
  };
}

/**
 * Traceability sentinel for the 2026-06-21 read-tracking re-key fix (Otto-343).
 *
 * THE BUG: post-read-track.ts (writer) and pre-edit-recent-read.ts (reader)
 * keyed their shared read-log on `/tmp/zeta-reads-${process.ppid}.json`. In
 * remote / Claude-Code-on-the-web sessions EVERY hook runs as a fresh process
 * with a distinct ppid, so the writer and the reader never agreed on a
 * filename: the reader always found an absent log and wrongly DENIED every Edit
 * with "Otto-343 Edit-without-Read" — even immediately after a Read.
 *
 * THE FIX: key the log on the stable per-session `session_id` (falling back to
 * `cwd`, then a constant) via sessionReadLogPath() below.
 *
 * THE FLAG: this tag is emitted in every deny reason and stamped into the log
 * file name. If read-tracking ever misbehaves again, grep this tag — it lands
 * you exactly here, at the root cause and the fix. Do not change the string
 * without updating the regression test in harness.test.ts.
 */
export const OTTO343_READLOG_TAG = "OTTO-343-session-key-2026-06-21";

/**
 * Path to the session-scoped read-tracking log shared by post-read-track.ts
 * (writer) and pre-edit-recent-read.ts (reader).
 *
 * Keyed on the stable per-session id so the two hooks — which each run in their
 * own short-lived process — agree on the same file. Falls back to `cwd`, then a
 * constant, when no session id is supplied. The key is sanitised to a single
 * safe filename component so it can never escape the temp dir. See
 * OTTO343_READLOG_TAG.
 *
 * The directory comes from `os.tmpdir()`, NOT a hardcoded `/tmp`. That literal
 * made the whole mechanism inert on Windows: native Bun resolves a leading `/`
 * against the current drive, so the write in post-read-track.ts threw ENOENT,
 * was swallowed by its "non-fatal" catch, and the log was never created. The
 * reader then found no log and denied EVERY Edit — a permanent block rather
 * than the recency gate this is meant to be. Same failure shape as the ppid bug
 * below: writer and reader disagreeing about a filename.
 *
 * `os.tmpdir()` is /tmp on Linux/macOS (so POSIX behaviour is unchanged) and
 * %TEMP% on Windows.
 */
export function sessionReadLogPath(input: HookInput): string {
  const key = (input.session_id && input.session_id.trim()) || (input.cwd && input.cwd.trim()) || "shared";
  // Collapse anything that is not a safe filename char (drops `/` and `.`),
  // so the key is one component and `..` can never appear.
  const safe = key.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 128);
  return join(tmpdir(), `zeta-reads-${OTTO343_READLOG_TAG}-${safe}.json`);
}

/** Read and parse the hook input from stdin. Returns {} on parse failure. */
export function readHookInput(): HookInput {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const raw = require("fs").readFileSync(0, "utf8") as string;
    return JSON.parse(raw) as HookInput;
  } catch {
    return {};
  }
}

/**
 * Emit a deny decision and exit 0.
 * The hook infrastructure reads the JSON from stdout; exit 0 is required
 * even for denials — a non-zero exit is treated as a hook error, not a deny.
 */
export function deny(event: HookEventName, reason: string): never {
  const decision: HookDecision = {
    hookSpecificOutput: {
      hookEventName: event,
      permissionDecision: "deny",
      permissionDecisionReason: reason,
    },
  };
  process.stdout.write(JSON.stringify(decision) + "\n");
  process.exit(0);
}

/** Allow the tool call. Exit 0 with no stdout output (default path). */
export function allow(): never {
  process.exit(0);
}
