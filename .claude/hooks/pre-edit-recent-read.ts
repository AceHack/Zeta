#!/usr/bin/env bun
// pre-edit-recent-read.ts — PreToolUse hook: blocks Edit when the target file
// has not been Read in the current session within the recency window.
//
// Mechanises Otto-343 "Edit-without-Read" discipline: the agent must Read a
// file before editing it so its edit is grounded in current file state.
//
// Reads the session log written by post-read-track.ts PostToolUse hook. Both
// hooks resolve the log path via harness.ts:sessionReadLogPath, which keys on
// the stable per-session id rather than process.ppid — see OTTO343_READLOG_TAG
// for the bug that ppid-keying caused on remote / web sessions (every Edit
// wrongly denied because each hook process had a fresh ppid). When the log is
// absent the hook denies for that specific file, asking for a Read first; it
// never hard-errors.
//
// Wired via .claude/settings.json PreToolUse matcher:"Edit".
// Per 081KR50HA0008QG0R0005ABWPH (atomic child of 081KQ3HBZ0008QG0R0008RYCSX).

import { readHookInput, deny, allow, sessionReadLogPath, OTTO343_READLOG_TAG } from "./harness.ts";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type ReadLog = Record<string, number>;

// 2-hour recency window: generous enough for task-length sessions.
const RECENCY_MS = 2 * 60 * 60 * 1000;

function readLog(path: string): ReadLog {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as ReadLog;
  } catch {
    // Log absent or unparseable: degrade to permissive.
    return {};
  }
}

function main(): number {
  const input = readHookInput();
  if (input.tool_name !== "Edit") {
    allow();
  }
  const rawPath = (input.tool_input?.["file_path"] as string | undefined) ?? "";
  if (!rawPath) {
    allow();
  }
  const filePath = resolve(rawPath);
  const log = readLog(sessionReadLogPath(input));
  const lastRead = log[filePath];

  if (lastRead === undefined) {
    deny(
      "PreToolUse",
      `Otto-343 Edit-without-Read [${OTTO343_READLOG_TAG}]: '${rawPath}' has not been Read in this session.\n` +
        `Use the Read tool to read the current file state before editing.`,
    );
  }

  const age = Date.now() - lastRead;
  if (age > RECENCY_MS) {
    const minutes = Math.round(age / 60_000);
    deny(
      "PreToolUse",
      `Otto-343 Edit-without-Read [${OTTO343_READLOG_TAG}]: '${rawPath}' was last Read ${minutes} min ago (>${RECENCY_MS / 60_000} min threshold).\n` +
        `Re-read the file to ground the edit in current state.`,
    );
  }

  allow();
}

if (import.meta.main) {
  process.exit(main());
}
