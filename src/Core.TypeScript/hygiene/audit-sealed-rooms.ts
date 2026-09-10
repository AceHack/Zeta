#!/usr/bin/env bun
// audit-sealed-rooms.ts — 081KTSZN10008QG0R002J0GE0Z Reticulum-only enforcement, the LINT half.
//
// THE CLAUSE (Aaron, 081KTSZN10008QG0R002J0GE0Z): "at no point do our tests need to interact with hdd or git or tool
// or anything other than reticulum… it will force us to have cache loaded in the room at
// startup." The runtime half is THE DOUBLE-RUN CHECK in TestLoop.run (ambient ENTROPY is a
// mechanical failure); this audit is the AMBIENT-CHANNEL half: .NET has no reliable in-process
// syscall hook, so the seal is self-declared and mechanically swept — any file whose head
// carries the marker `SEALED-ROOM` must contain ZERO ambient-channel tokens. Declaring the
// marker is opt-in; breaking it is a gate failure, never a review convention.
//
// Banned inside a sealed room (the ambient doors, per noninterference #13):
//   filesystem (System.IO/File./Directory./Path.GetTemp), process/env (Process/Environment.),
//   network (HttpClient/Socket/Dns), clocks (DateTime.Now|UtcNow/Stopwatch), entropy
//   (Guid.NewGuid/Random(), RandomNumberGenerator), threadpool spawn (Task.Run — the un-knobbed
//   thread, per async-all-the-way).
//
// Exit 0 = every sealed room is sealed. Exit 1 = lists file:line token findings.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const MARKER = "SEALED-ROOM";

// Every dotted member access below tolerates WHITESPACE AROUND THE DOT.
//
// C#, F# and TypeScript all accept `System . IO`, `File . ReadAllText`,
// `DateTime . UtcNow` and `Task . Run` — the dot is a token, not a character in
// an identifier. Until 2026-09-09 this table matched a literal dot, so every
// door it names was reachable from inside a sealed room by typing one space.
// A gate that a space walks through is not a gate.
//
// The author already knew this for one entry: `Random\\s*\\(` was written
// whitespace-tolerant from the start. The generalisation is what was missing,
// and the falsifiers in audit-sealed-rooms.test.ts now pin it per token.
//
// The same edit clears CodeQL js/regex/missing-regexp-anchor (alert 229): a
// bare `System\\.IO` is host-shaped (an `.IO` TLD), so the query read the table
// as an unanchored URL check. It never was one, and it is no longer host-shaped.
export const BANNED: readonly (readonly [RegExp, string])[] = [
  [/\bSystem\s*\.\s*IO\b/, "filesystem namespace"],
  [/\bFile\s*\./, "filesystem"],
  [/\bDirectory\s*\./, "filesystem"],
  [/\bPath\s*\.\s*GetTemp/, "filesystem (temp)"],
  [/\bProcess\b/, "process spawn"],
  [/\bEnvironment\s*\./, "ambient environment"],
  [/\bHttpClient\b/, "network"],
  [/\bSocket\b/, "network"],
  [/\bDns\b/, "network"],
  [/\bDateTime\s*\.\s*(Now|UtcNow)\b/, "wall clock"],
  [/\bStopwatch\b/, "wall clock"],
  [/\bGuid\s*\.\s*NewGuid\b/, "ambient entropy"],
  [/\bRandom\s*\(/, "ambient entropy"],
  [/\bRandomNumberGenerator\b/, "ambient entropy"],
  [/\bTask\s*\.\s*Run\b/, "un-knobbed thread spawn"],
];

/**
 * The reason a single line is refused, or null when the line is clean.
 *
 * Pulled out of the walk so it can be tested without a filesystem: the audit is
 * a gate in `gate.yml` and had no falsifier at all until 2026-09-09 — the file
 * even skipped `audit-sealed-rooms.test.ts` by name, for a test that was never
 * written.
 */
export function bannedReason(line: string): string | null {
  if (line.includes(MARKER)) return null; // the declaration line itself may name the banned doors
  if (line.includes("SEAL-WAIVER:")) return null; // explicit, visible, per-line waiver
  for (const [re, why] of BANNED) {
    if (re.test(line)) return why;
  }
  return null;
}

const root = process.argv[2] ?? ".";
const findings: string[] = [];
let sealedCount = 0;

function walk(dir: string): void {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    if (["node_modules", ".git", "references", "bin", "obj", ".lake"].includes(name)) continue;
    const path = join(dir, name);
    let st;
    try {
      st = statSync(path);
    } catch {
      continue;
    }
    if (st.isDirectory()) walk(path);
    else if (/\.(fs|cs|ts|rs)$/.test(name)) inspect(path);
  }
}

function inspect(path: string): void {
  if (path.endsWith("audit-sealed-rooms.ts") || path.endsWith("audit-sealed-rooms.test.ts")) return; // this auditor documents the marker + tokens

  const text = readFileSync(path, "utf8");
  const head = text.split("\n", 30).join("\n");
  if (!head.includes(MARKER)) return;
  sealedCount += 1;
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const why = bannedReason(line);
    if (why !== null) findings.push(`${path}:${i + 1} — ${why}: ${line.trim().slice(0, 90)}`);
  }
}

if (import.meta.main) {
  walk(root);

  if (findings.length > 0) {
    console.error(`FAIL: ${findings.length} ambient-channel token(s) inside SEALED-ROOM files (081KTSZN10008QG0R002J0GE0Z Reticulum-only clause):`);
    for (const f of findings) console.error("  " + f);
    process.exit(1);
  }
  console.log(`ok: ${sealedCount} sealed room(s) swept — zero ambient-channel tokens (the warm cache holds)`);
}
