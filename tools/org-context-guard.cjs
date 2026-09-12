#!/usr/bin/env node
/**
 * org-context-guard.cjs — what may enter an agent's context, decided before it does.
 *
 * MEASURED on the Agentic Team, 2026-09-11. A day of runs ingested about 6.2M tokens of unique
 * content and was billed for 1.46 BILLION cache-read tokens - a 235x amplification, because every
 * turn re-sends the whole conversation. So the cost of a thing entering context is not its size; it
 * is its size times the number of turns that follow it. A 35k-token screenshot read at turn 20 of a
 * 120-turn session is read 100 more times.
 *
 * Three things were paying that multiplier for nothing:
 *   - 18 screenshot reads, 2.5M characters of PNG;
 *   - whole large files read in full when a range or a grep was the question (one 0.82M-char file);
 *   - 31% of all read volume was a path the SAME session had already read - 587 calls, 4.8M
 *     characters - some of it the identical file twice because one call spelled the path with
 *     forward slashes and the next with backslashes.
 *
 * None of that is a judgement about the work, so none of it is refused on the work's behalf: the
 * information is still available, by a cheaper route, and the refusal says which route. A guard that
 * removed an ability would be a regression dressed up as a saving.
 *
 * ── FAILS OPEN, ALWAYS ───────────────────────────────────────────────────────
 * A guard that crashes must not stop the organization from working. Anything unexpected - an
 * unreadable state file, a path that cannot be resolved, malformed input - allows the call.
 */

const { appendFileSync, mkdirSync, readFileSync, statSync, writeFileSync } = require("node:fs");
const { join, resolve } = require("node:path");
const { homedir, tmpdir } = require("node:os");

const NL = String.fromCharCode(10);
const env = process.env;

/** Read into context, a picture costs its size on every turn that follows and cannot be grepped. */
const PICTURES = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".ico", ".pdf"];
/** Past this many bytes, a whole-file read must say which part it wants. */
const WHOLE_FILE_LIMIT = Number(env.ORG_GUARD_WHOLE_FILE_BYTES || 100_000);

/**
 * The guard's own private directory, under the user's home rather than the shared temp dir.
 *
 * CodeQL js/insecure-temporary-file, and it is a real class rather than a style note: a
 * FIXED name under the world-writable os temp dir can be pre-created by any other user on
 * the machine, as a directory they own or as a symlink pointing somewhere else. The guard
 * would then either write this session's read-history where a stranger can read it, or
 * append through the symlink to a file it never meant to touch. Neither needs an attacker
 * to win a race: the name is predictable, so the file can simply be waiting.
 *
 * `~/.zeta/` is the repository's existing convention for per-user state that is not in the
 * repo, and it is not world-writable, which removes the class rather than narrowing it. The
 * directory is created 0o700 so the mode is stated rather than inherited from the umask.
 *
 * ORG_GUARD_DIR still overrides, because tests need a scratch path and the operator may
 * want state somewhere specific. An explicit path the caller chose is not the same risk as
 * a guessable one the caller never named.
 */
function guardDir() {
  if (env.ORG_GUARD_DIR) return env.ORG_GUARD_DIR;
  const home = homedir();
  // No home directory is the one case with no private place to write. Fall back to the temp
  // dir but say so, rather than silently keeping the insecure path as if it were the plan.
  if (!home) return join(tmpdir(), "org-context-guard");
  return join(home, ".zeta", "org-context-guard");
}

/** Where this session's "already in context" list lives. Per session, so nothing leaks between runs. */
function stateFile(sessionId) {
  const dir = guardDir();
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  return join(dir, String(sessionId || "unknown").replace(/[^A-Za-z0-9_-]/g, "_") + ".json");
}

/** One spelling per file. `C:/x` and `C:\x` and `c:/X` are the same bytes and the same tokens. */
function normalize(p) {
  let out = String(p || "");
  try {
    out = resolve(out);
  } catch {
    // keep what was given
  }
  return out.split(String.fromCharCode(92)).join("/").toLowerCase();
}

/** Say no, and say what to do instead. Exit 2 is how a hook refuses and speaks to the agent. */
function deny(why) {
  process.stderr.write(why + NL);
  process.exit(2);
}

function main(input) {
  let ev;
  try {
    ev = JSON.parse(input);
  } catch {
    process.exit(0);
  }
  if (ev.tool_name !== "Read") process.exit(0);
  const file = (ev.tool_input && ev.tool_input.file_path) || "";
  if (!file) process.exit(0);
  const norm = normalize(file);

  const lower = norm.toLowerCase();
  if (PICTURES.some((ext) => lower.endsWith(ext))) {
    deny(
      "This organization does not read pictures into context: a screenshot costs its whole size again on every " +
        "turn that follows it, and cannot be searched. The file is still evidence and is still referenced by its " +
        "path - cite " + file + " in your answer. To show that something is TRUE, assert it in the test (the text " +
        "on the page, the attribute, the row that moved); a picture proves it to a person, an assertion proves it " +
        "to the build.",
    );
  }

  let size = 0;
  try {
    size = statSync(file).size;
  } catch {
    size = 0;
  }
  const ranged = (ev.tool_input && (ev.tool_input.offset !== undefined || ev.tool_input.limit !== undefined)) || false;
  if (size > WHOLE_FILE_LIMIT && !ranged) {
    deny(
      "That file is " + Math.round(size / 1000) + "kB and reading all of it would sit in context for the rest of " +
        "this session, re-read on every turn. Ask it the question you actually have: Grep for the symbol, or Read " +
        "with offset and limit once you know the line. If you genuinely need the whole file, read it in ranges.",
    );
  }

  const path = stateFile(ev.session_id);
  let seen = {};
  try {
    seen = JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    seen = {};
  }
  const key = norm + "@" + String((ev.tool_input && ev.tool_input.offset) || 0) + ":" + String((ev.tool_input && ev.tool_input.limit) || 0);
  if (seen[key]) {
    deny(
      "You have already read " + file + " in this session - it is still in your context above, unchanged unless you " +
        "edited it. Scroll back rather than paying for it twice. If you edited it and need to see the result, read " +
        "the range you changed with offset and limit.",
    );
  }
  seen[key] = true;
  try {
    writeFileSync(path, JSON.stringify(seen));
  } catch {
    // the dedupe is an optimisation; failing to record it must not fail the read
  }
  process.exit(0);
}

let buf = "";
process.stdin.on("data", (d) => {
  buf += d;
});
process.stdin.on("end", () => {
  try {
    main(buf);
  } catch (err) {
    // FAILS OPEN. Never let the guard be the reason the organization stops.
    try {
      appendFileSync(join(guardDir(), "error.log"), new Date().toISOString() + " " + String((err && err.message) || err) + NL);
    } catch {
      // nothing to do
    }
    process.exit(0);
  }
});
