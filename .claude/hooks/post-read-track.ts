#!/usr/bin/env bun
// post-read-track.ts — PostToolUse hook: records Read tool invocations to a
// session-scoped temp file so the pre-edit-recent-read.ts PreToolUse hook can
// verify files were read before being edited (Otto-343 discipline).
//
// Wired via .claude/settings.json PostToolUse matcher:"Read".
// Sibling to .claude/hooks/pre-edit-recent-read.ts.
// Per 081KR50HA0008QG0R0005ABWPH (PR #2395+).

import { readHookInput } from "./harness.ts";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

type ReadLog = Record<string, number>;

function sessionReadsPath(): string {
  return `/tmp/zeta-reads-${process.ppid ?? 0}.json`;
}

function readLog(path: string): ReadLog {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as ReadLog;
  } catch {
    return {};
  }
}

function main(): number {
  const input = readHookInput();
  if (input.tool_name !== "Read") {
    return 0;
  }
  const filePath = (input.tool_input?.["file_path"] as string | undefined) ?? "";
  if (!filePath) {
    return 0;
  }
  const path = sessionReadsPath();
  const log = readLog(path);
  log[resolve(filePath)] = Date.now();
  try {
    writeFileSync(path, JSON.stringify(log));
  } catch {
    // Non-fatal: if we can't write the log, the check degrades to permissive.
  }
  return 0;
}

if (import.meta.main) {
  process.exit(main());
}
