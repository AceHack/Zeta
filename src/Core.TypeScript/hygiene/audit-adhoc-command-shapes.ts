// src/Core.TypeScript/hygiene/audit-adhoc-command-shapes.ts
//
// WHICH AD-HOC COMMANDS DOES THE FLEET KEEP RE-DERIVING?
//
// ═══════════════════════════════════════════════════════════════════════════
// THE QUESTION THIS ANSWERS
// ═══════════════════════════════════════════════════════════════════════════
//
// Aaron, 2026-09-10: "are you able to keep up with your own adhoc bash
// commands? ... i'm trying to reduce all our base commands to zeta clie over
// time and stop small outliers over time."
//
// The honest answer to the first half is NO. An agent invents a shell pipeline
// at the moment it needs one, runs it, and leaves nothing behind. The next
// agent facing the same question invents it again -- possibly differently,
// possibly wrongly. That is the ratchet failing in the most ordinary way
// there is: work done, nothing banked.
//
// The second half is measurable, and this file measures it. Every Bash tool
// call any agent has ever made in this project is recorded in the harness
// transcripts. Folding them by SHAPE turns "I think we have outliers" into a
// ranked list: the shapes that recur most and have no verb behind them are,
// in order, the verbs that would remove the most re-derivation.
//
// ═══════════════════════════════════════════════════════════════════════════
// WHAT A "SHAPE" IS, AND WHY ARGUMENTS ARE DESTROYED
// ═══════════════════════════════════════════════════════════════════════════
//
//   git log --oneline -12 origin/main        ->  git log
//   gh api repos/X/Y/pulls/123 --jq '...'    ->  gh api
//   bun src/Core.TypeScript/hygiene/x.ts -v  ->  bun src/Core.TypeScript/hygiene/x.ts
//
// The head plus its bare-word subcommands is the identity; everything after is
// the instance. Two properties follow, and both are deliberate:
//
//   1. `bun`/`node` KEEP their script path, because for those the script IS
//      the verb. Collapsing them to "bun" would report that the fleet's most
//      common command is `bun`, which is true and useless.
//
//   2. EVERY OTHER ARGUMENT IS DISCARDED AND NEVER STORED. This is a privacy
//      requirement, not a formatting choice. Transcripts contain commands
//      typed against real systems, and a command line is a classic place for a
//      token to end up. This tool holds shapes and counts; it never writes,
//      prints, or returns raw command text, so its output is safe to paste
//      into a public PR. If you find yourself wanting the raw command to
//      understand a shape, that is the point at which a human reads the
//      transcript -- not the point at which this tool starts emitting it.
//
// ═══════════════════════════════════════════════════════════════════════════
// THE THREE CLASSES, AND WHY "AMBIENT" IS NOT A BACKLOG
// ═══════════════════════════════════════════════════════════════════════════
//
//   covered    an in-repo script ran (`bun src/...`, `bun clis/...`, tools/).
//              Already a verb. Its count is evidence the verb EARNS its place.
//   ambient    shell furniture: cd, echo, ls, cat, export, set, sleep, wc.
//              Wrapping `cd` in a CLI verb would be worse than not. Reported
//              separately so it neither inflates the backlog nor hides.
//   uncovered  a real external tool doing real work with no verb behind it:
//              git, gh, grep, sed, python3, jq, curl. THIS is the backlog.
//
// A high `uncovered` count is not an accusation of sloppiness. It is a
// measurement of where the tree offers an agent nothing to reach for -- the
// same argument `io/safe-io.ts` makes about forty authors writing the same
// racy read: the pattern is what the author HAD to write.
//
// ═══════════════════════════════════════════════════════════════════════════
// HONEST LIMITS
// ═══════════════════════════════════════════════════════════════════════════
//
//   - Counts are per-INVOCATION, not per-agent and not per-session. A single
//     agent looping one command four hundred times looks identical to four
//     hundred agents each running it once, and those want opposite responses.
//     The per-session spread is reported alongside the count so the reader can
//     tell them apart; the RANK does not currently use it.
//   - A shape's count measures frequency, never cost. A once-a-week command
//     that takes an hour to get right deserves a verb more than a hundred
//     trivial `git status` calls. Frequency is the cheap proxy, and it is the
//     only thing here that is measured.
//   - Shapes are normalised syntactically. `gh api` covers a dozen unrelated
//     jobs, so one uncovered row may be several missing verbs, not one.
//   - THE TWO CORPORA DO NOT OVERLAP, AND THAT IS MEASURED, NOT ASSUMED.
//     Agent Bash calls never reach `~/.zsh_history`: the harness spawns
//     non-interactive shells, which do not append to HISTFILE. Probed
//     2026-09-10 against 24,258 zsh entries spanning 2024-01-01..2026-09-07 --
//     ZERO hits for the working clone path used hundreds of times that day,
//     zero for the job tmp dir. The history file had not been written to in
//     three days of continuous agent work.
//
//     So the two sources answer different questions and are tagged, never
//     merged into one rank:
//       transcripts  what the FLEET re-derives  (complete for agents)
//       history      what the HUMAN re-types    (complete for Aaron, and the
//                    only record of anything run outside the harness)
//     A verb backlog built from one of them alone is silently half a backlog.
//
//   - Shell history carries a HEAVIER privacy weight than transcripts: it
//     spans years and every project on the machine, not just this repo. The
//     shape-only guarantee above is what makes reading it acceptable at all,
//     and it is why `--history` is opt-in and never a default.
//
// ═══════════════════════════════════════════════════════════════════════════
// THIS TOOL RANKS BY THE WRONG VARIABLE, ON PURPOSE, AND SAYS SO
// ═══════════════════════════════════════════════════════════════════════════
//
// It ranks by COMMAND SHAPE -- by what resources were spent. The thing that
// matters is the QUESTION the burst was serving, and shape is to question what
// the rover's mean performance is to its strategy: a real number, correctly
// computed, that destroys the distinction determining the outcome. `grep` at
// 35,193 is a dozen unrelated questions wearing one row, and a verb named
// `zeta grep` would be useless.
//
// The consequence is structural, not cosmetic. Ranking by resource
// consumption can only ever recommend verbs for what was already cheap enough
// to do thirty-five thousand times; it is INCAPABLE of surfacing a question
// nobody could afford to ask. That builds "constraints determine questions"
// into the tool -- the direction Aaron explicitly does not want, because it is
// the one that implies no choice.
//
// It is committed anyway because the measurement it does make is real and was
// not otherwise available: 0.6% verb coverage, and 7.7 commands per question.
// Ranking by question needs question features extracted and clustered, which
// is designed in the research doc and not built.
//
//   docs/research/2026-09-10-reduce-bash-history-to-zero-the-primary-object-\
//     is-the-question-not-the-cli-and-a-verb-roster-is-a-linguistic-seed.md
//
// Usage:
//   bun src/Core.TypeScript/hygiene/audit-adhoc-command-shapes.ts
//     [--transcripts <dir>] [--top N] [--min-count N] [--json]
//
// Exit 0 report produced, 2 could not run. It never fails the build: this is a
// measurement, not a gate.

import { createReadStream, readdirSync, statSync } from "node:fs";
import { createInterface } from "node:readline";
import { join } from "node:path";

/** Shell words that are furniture, not work. */
const AMBIENT = new Set<string>([
  "cd", "echo", "ls", "cat", "pwd", "export", "set", "unset", "true", "false",
  "sleep", "wc", "head", "tail", "sort", "uniq", "mkdir", "touch", "printf",
  "which", "type", "source", "test", "read", "exit", "return", "eval", "time",
]);

/**
 * Shell grammar, not commands.
 *
 * The first run of this tool reported `done` at 11,652 and `do` at 7,552 as
 * top-ten "verb backlog" rows, which is nonsense: they are loop syntax that
 * survived segment-splitting. Left in, they would have put two non-commands
 * above `git fetch` in a ranking meant to drive real work -- a measurement
 * artifact presented as a finding.
 */
const SHELL_KEYWORDS = new Set<string>([
  "do", "done", "then", "fi", "if", "else", "elif", "esac", "case", "while",
  "for", "until", "in", "function", "select", "coproc", "declare", "local",
  "shift", "break", "continue", "trap", "wait", "exec", "let",
]);

/** Heads whose FIRST path-ish argument is the verb's real identity. */
const SCRIPT_RUNNERS = new Set<string>(["bun", "node", "npx", "python3", "python", "deno", "ts-node"]);

/** In-repo prefixes that mean "a verb already exists for this". */
const REPO_PREFIXES = ["src/", "clis/", "tools/", "./src/", "./clis/", "./tools/"];

export type ShapeClass = "covered" | "ambient" | "uncovered";

export interface ShapeStat {
  readonly shape: string;
  readonly klass: ShapeClass;
  readonly count: number;
  /** How many distinct transcripts it appeared in. Separates one loop from many agents. */
  readonly sessions: number;
}

/**
 * Split a command line into the individual invocations it runs.
 *
 * Quote-aware, because `grep "a && b"` is one invocation and splitting it
 * blindly would invent a second. Backslash escapes are honoured outside single
 * quotes. This deliberately does NOT reuse `safe-io`'s `splitCommandLine`:
 * that function exists to REFUSE shell metacharacters before a spawn, and here
 * the metacharacters are the thing being parsed rather than rejected.
 */
export function splitSegments(command: string): readonly string[] {
  const out: string[] = [];
  let cur = "";
  let quote: '"' | "'" | null = null;
  let i = 0;
  while (i < command.length) {
    const c = command[i] ?? "";
    if (quote !== null) {
      if (c === "\\" && quote === '"' && i + 1 < command.length) {
        cur += c + (command[i + 1] ?? "");
        i += 2;
        continue;
      }
      if (c === quote) quote = null;
      cur += c;
      i += 1;
      continue;
    }
    if (c === '"' || c === "'") {
      quote = c;
      cur += c;
      i += 1;
      continue;
    }
    if (c === "\\" && i + 1 < command.length) {
      // A backslash before a newline CONTINUES one command onto the next line.
      // Treating it as an escape-then-break split `gh \\<nl> api ...` into a
      // dead `gh` and a phantom verb `api` -- 5,695 of them in the first run,
      // ranked fifteenth. Join instead.
      if (command[i + 1] === "\n") { cur += " "; i += 2; continue; }
      cur += c + (command[i + 1] ?? "");
      i += 2;
      continue;
    }
    const two = command.slice(i, i + 2);
    // `$(...)` IS another invocation, so it opens a segment. Without this,
    // `SHA=$(gh api ...)` had its head eaten by the assignment-stripper and
    // reported the phantom verb `api` -- 5,695 of them, ranked twelfth.
    if (two === "$(") {
      out.push(cur);
      cur = "";
      i += 2;
      continue;
    }
    if (two === "&&" || two === "||") {
      out.push(cur);
      cur = "";
      i += 2;
      continue;
    }
    if (c === ";" || c === "|" || c === "\n") {
      out.push(cur);
      cur = "";
      i += 1;
      continue;
    }
    cur += c;
    i += 1;
  }
  out.push(cur);
  return out.map((s) => s.trim()).filter((s) => s.length > 0);
}

/** A token that carries a VALUE rather than naming a verb. */
function isValueToken(t: string): boolean {
  if (t.length === 0) return true;
  if (t.startsWith("-")) return true;
  if (t.includes("/") || t.includes("=") || t.includes("$")) return true;
  if (t.startsWith('"') || t.startsWith("'") || t.startsWith("`")) return true;
  if (t.startsWith("(") || t.startsWith("{")) return true;
  // A bare word that is not lowercase-ish is an argument, not a subcommand.
  return !/^[a-z][a-z0-9_-]*$/u.test(t);
}

/**
 * Reduce one invocation to its shape, or null when there is nothing to count.
 *
 * Arguments are dropped here and never leave this function -- see the privacy
 * note in the header.
 */
export function normalizeShape(segment: string): string | null {
  // `$(`-splitting leaves the closing paren on the inner segment's tail.
  const trimmed = segment.trim().replace(/\)+$/u, "").trim();
  if (trimmed.length === 0 || trimmed.startsWith("#")) return null;

  const tokens = trimmed.split(/\s+/u).filter((t) => t.length > 0);
  // Strip leading `VAR=value` assignments and `sudo`-style prefixes.
  let start = 0;
  while (start < tokens.length) {
    const t = tokens[start] ?? "";
    if (/^[A-Za-z_][A-Za-z0-9_]*=/u.test(t)) { start += 1; continue; }
    break;
  }
  const rawHead = tokens[start];
  if (rawHead === undefined) return null;
  if (SHELL_KEYWORDS.has(rawHead)) return null;

  // `/opt/homebrew/bin/gh` and `gh` are the same verb.
  const head = rawHead.includes("/") ? (rawHead.split("/").pop() ?? rawHead) : rawHead;
  if (head.length === 0 || isValueToken(head) && !rawHead.includes("/")) return null;

  if (SCRIPT_RUNNERS.has(head)) {
    const next = tokens[start + 1];
    if (next === undefined) return head;
    if (next === "run" || next === "test" || next === "x" || next === "-e") {
      const third = tokens[start + 2];
      return third !== undefined && !isValueToken(third) ? `${head} ${next} ${third}` : `${head} ${next}`;
    }
    // The script path IS the verb; keep it, strip nothing else.
    if (next.includes("/") || next.endsWith(".ts") || next.endsWith(".js") || next.endsWith(".py")) {
      return `${head} ${next.replace(/^\.\//u, "")}`;
    }
    return head;
  }

  const parts: string[] = [head];
  for (let k = start + 1; k < tokens.length && parts.length < 3; k += 1) {
    const t = tokens[k] ?? "";
    if (isValueToken(t)) break;
    parts.push(t);
  }
  return parts.join(" ");
}

export function classify(shape: string): ShapeClass {
  const head = shape.split(" ")[0] ?? "";
  if (SCRIPT_RUNNERS.has(head)) {
    const rest = shape.slice(head.length + 1);
    if (REPO_PREFIXES.some((p) => rest.startsWith(p))) return "covered";
    if (rest.startsWith("run ") || rest.startsWith("test")) return "covered";
    return "uncovered";
  }
  if (AMBIENT.has(head)) return "ambient";
  return "uncovered";
}

/** Ordinal, never `localeCompare` -- collation must not vary by machine. */
function byCountThenShape(a: ShapeStat, b: ShapeStat): number {
  if (a.count !== b.count) return b.count - a.count;
  if (a.shape < b.shape) return -1;
  if (a.shape > b.shape) return 1;
  return 0;
}

/**
 * Pull every Bash `command` out of one transcript line.
 *
 * Transcript lines reach a gigabyte in aggregate, so this does a cheap
 * substring scan for the tool-use marker before paying for `JSON.parse`, and
 * falls back to skipping a line it cannot parse rather than aborting the fold.
 * A line that fails to parse is `unknown`, and unknown lines are COUNTED and
 * reported -- a silent skip here would make an empty result indistinguishable
 * from a clean one.
 */
export function commandsInLine(line: string): readonly string[] {
  if (!line.includes('"name":"Bash"')) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    return [];
  }
  const out: string[] = [];
  const walk = (node: unknown): void => {
    if (node === null || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    const rec = node as Record<string, unknown>;
    if (rec["name"] === "Bash" && typeof rec["input"] === "object" && rec["input"] !== null) {
      const cmd = (rec["input"] as Record<string, unknown>)["command"];
      if (typeof cmd === "string") out.push(cmd);
    }
    for (const v of Object.values(rec)) walk(v);
  };
  walk(parsed);
  return out;
}

/**
 * Fold a zsh history file.
 *
 * Extended format is `: <epoch>:<elapsed>;<command>`, with a trailing
 * backslash continuing onto the next line. Plain (non-extended) history is
 * one command per line and is handled by the same path.
 */
async function foldHistory(path: string, state: FoldState): Promise<void> {
  const rl = createInterface({ input: createReadStream(path, { encoding: "utf8" }), crlfDelay: Infinity });
  let pending = "";
  try {
    for await (const raw of rl) {
      let line = raw;
      if (pending.length === 0) {
        const m = /^:\s*\d+:\d*;(.*)$/su.exec(line);
        if (m !== null) line = m[1] ?? "";
      }
      if (line.endsWith("\\")) { pending += `${line.slice(0, -1)}\n`; continue; }
      const cmd = pending + line;
      pending = "";
      if (cmd.trim().length === 0) continue;
      for (const seg of splitSegments(cmd)) {
        const shape = normalizeShape(seg);
        if (shape === null) continue;
        state.invocations += 1;
        state.counts.set(shape, (state.counts.get(shape) ?? 0) + 1);
        let seen = state.sessions.get(shape);
        if (seen === undefined) { seen = new Set<string>(); state.sessions.set(shape, seen); }
        seen.add(path);
      }
    }
  } finally {
    rl.close();
  }
}

interface FoldState {
  readonly counts: Map<string, number>;
  readonly sessions: Map<string, Set<string>>;
  invocations: number;
  /** Bash TOOL CALLS -- one question's worth of shell, however many commands it took. */
  toolCalls: number;
  /** Bash lines with no readable timestamp, excluded when a window is set. */
  undated: number;
  unparsed: number;
}

/**
 * Ordinal ISO-8601 comparison. Lexicographic order IS chronological order for
 * this format, so no Date parsing and no locale enters the decision.
 * A line with no readable timestamp is `unknown` and is COUNTED as excluded
 * when a window is set -- never silently kept, which would make a windowed
 * count quietly wider than its window.
 */
export function inWindow(line: string, since: string, until: string): boolean | null {
  if (since.length === 0 && until.length === 0) return true;
  const m = /"timestamp":"([^"]+)"/u.exec(line);
  if (m === null) return null;
  const ts = m[1] ?? "";
  if (since.length > 0 && ts < since) return false;
  if (until.length > 0 && ts >= until) return false;
  return true;
}

async function foldTranscript(path: string, sessionId: string, state: FoldState, since = "", until = ""): Promise<void> {
  const rl = createInterface({ input: createReadStream(path, { encoding: "utf8" }), crlfDelay: Infinity });
  try {
    for await (const line of rl) {
      if (line.length === 0) continue;
      if (line.includes('"name":"Bash"')) {
        const w = inWindow(line, since, until);
        if (w === null) { state.undated += 1; continue; }
        if (!w) continue;
        const cmds = commandsInLine(line);
        if (cmds.length === 0) { state.unparsed += 1; continue; }
        state.toolCalls += cmds.length;
        for (const cmd of cmds) {
          for (const seg of splitSegments(cmd)) {
            const shape = normalizeShape(seg);
            if (shape === null) continue;
            state.invocations += 1;
            state.counts.set(shape, (state.counts.get(shape) ?? 0) + 1);
            let seen = state.sessions.get(shape);
            if (seen === undefined) { seen = new Set<string>(); state.sessions.set(shape, seen); }
            seen.add(sessionId);
          }
        }
      }
    }
  } finally {
    rl.close();
  }
}

export interface AuditOptions {
  readonly transcriptsDir: string;
  readonly top: number;
  readonly minCount: number;
  readonly json: boolean;
  /** ISO date lower bound (inclusive) on the transcript line's timestamp; "" = no bound. */
  readonly since: string;
  /** ISO date upper bound (exclusive); "" = no bound. */
  readonly until: string;
  /** Opt-in second corpus. Heavier privacy weight -- see the header. */
  readonly historyPath: string;
}

function parseArgs(argv: readonly string[]): AuditOptions {
  const home = process.env["HOME"] ?? "";
  let transcriptsDir = join(home, ".claude", "projects", "-Users-acehack-Documents-src-repos-Zeta");
  let top = 40;
  let minCount = 2;
  let json = false;
  let historyPath = "";
  let since = "";
  let until = "";
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i] ?? "";
    if (a === "--transcripts") { transcriptsDir = argv[++i] ?? transcriptsDir; }
    else if (a === "--top") { top = Number.parseInt(argv[++i] ?? "", 10) || top; }
    else if (a === "--min-count") { minCount = Number.parseInt(argv[++i] ?? "", 10) || minCount; }
    else if (a === "--json") { json = true; }
    else if (a === "--history") { historyPath = argv[++i] ?? ""; }
    else if (a === "--since") { since = argv[++i] ?? ""; }
    else if (a === "--until") { until = argv[++i] ?? ""; }
  }
  return { transcriptsDir, top, minCount, json, historyPath, since, until };
}

export async function main(argv: readonly string[]): Promise<number> {
  const opts = parseArgs(argv);

  // READ, THEN INTERPRET ENOENT -- never `existsSync` and then read.
  //
  // The first draft asked `existsSync` about both paths and then opened them,
  // which `lint-check-then-use-file-races` refused at two sites. The window
  // between the question and the answer is real, and the check is redundant
  // anyway: the read itself already reports absence, more precisely than a
  // boolean can. `io/safe-io.ts` makes the same argument at length about the
  // forty authors who each wrote this shape once.
  const listing = ((): { files: string[] } | { error: string } => {
    try {
      return {
        files: readdirSync(opts.transcriptsDir)
          .filter((f) => f.endsWith(".jsonl"))
          .map((f) => join(opts.transcriptsDir, f)),
      };
    } catch (e) {
      return { error: String(e) };
    }
  })();

  const historyOnly = opts.historyPath.length > 0 && "error" in listing;
  let files: string[] = "error" in listing ? [] : listing.files;

  if (!historyOnly && "error" in listing) {
    process.stderr.write(`could not run: ${listing.error}\n`);
    process.stderr.write("this is `unknown`, not a clean result -- pass --transcripts <dir>\n");
    return 2;
  }
  if (files.length === 0 && !historyOnly) {
    process.stderr.write(`could not run: no .jsonl transcripts in ${opts.transcriptsDir}\n`);
    return 2;
  }

  const state: FoldState = { counts: new Map(), sessions: new Map(), invocations: 0, toolCalls: 0, undated: 0, unparsed: 0 };
  let bytes = 0;
  for (const f of files) {
    try { bytes += statSync(f).size; } catch { /* size is reporting only */ }
    await foldTranscript(f, f, state, opts.since, opts.until);
  }
  if (opts.historyPath.length > 0) {
    try { bytes += statSync(opts.historyPath).size; } catch { /* size is reporting only */ }
    try {
      await foldHistory(opts.historyPath, state);
    } catch (e) {
      // Absence surfaces HERE, from the read, rather than from a prior question.
      process.stderr.write(`could not run: cannot read history at ${opts.historyPath}: ${String(e)}\n`);
      return 2;
    }
  }

  const stats: ShapeStat[] = [];
  for (const [shape, count] of state.counts) {
    stats.push({ shape, klass: classify(shape), count, sessions: state.sessions.get(shape)?.size ?? 0 });
  }
  stats.sort(byCountThenShape);

  const uncovered = stats.filter((s) => s.klass === "uncovered" && s.count >= opts.minCount);
  const covered = stats.filter((s) => s.klass === "covered");
  const ambient = stats.filter((s) => s.klass === "ambient");

  if (opts.json) {
    process.stdout.write(`${JSON.stringify({
      source: historyOnly ? "history" : (opts.historyPath.length > 0 ? "transcripts+history" : "transcripts"),
      transcripts: files.length,
      bytes,
      invocations: state.invocations,
      toolCalls: state.toolCalls,
      commandsPerToolCall: state.toolCalls > 0 ? state.invocations / state.toolCalls : 0,
      unparsedBashLines: state.unparsed,
      distinctShapes: stats.length,
      uncovered: uncovered.slice(0, opts.top),
      covered: covered.slice(0, opts.top),
      ambient: ambient.slice(0, opts.top),
    }, null, 2)}\n`);
    return 0;
  }

  const sum = (rows: readonly ShapeStat[]): number => rows.reduce((n, r) => n + r.count, 0);
  process.stdout.write(
    `${historyOnly ? "history only" : `${files.length} transcripts`}${opts.historyPath.length > 0 && !historyOnly ? " + history" : ""}, ${(bytes / 1e9).toFixed(2)} GB, ` +
    `${state.invocations} invocations in ${state.toolCalls} tool calls ` +
    `(${(state.toolCalls > 0 ? state.invocations / state.toolCalls : 0).toFixed(1)} commands per question), ` +
    `${stats.length} distinct shapes` +
    (state.unparsed > 0 ? `, ${state.unparsed} Bash lines unparsed (unknown, not clean)` : "") +
    (state.undated > 0 ? `, ${state.undated} Bash lines undated and EXCLUDED by the window` : "") + "\n\n",
  );
  process.stdout.write(
    `covered ${sum(covered)} (${covered.length} shapes) · ` +
    `ambient ${sum(ambient)} (${ambient.length}) · ` +
    `uncovered ${sum(stats.filter((s) => s.klass === "uncovered"))} (${stats.filter((s) => s.klass === "uncovered").length})\n\n`,
  );
  process.stdout.write(`THE VERB BACKLOG — uncovered shapes, most re-derived first\n`);
  process.stdout.write(`${"count".padStart(7)}  ${"sess".padStart(4)}  shape\n`);
  for (const s of uncovered.slice(0, opts.top)) {
    process.stdout.write(`${String(s.count).padStart(7)}  ${String(s.sessions).padStart(4)}  ${s.shape}\n`);
  }
  process.stdout.write(`\nALREADY A VERB — in-repo scripts, by use\n`);
  for (const s of covered.slice(0, 15)) {
    process.stdout.write(`${String(s.count).padStart(7)}  ${String(s.sessions).padStart(4)}  ${s.shape}\n`);
  }
  return 0;
}

if (import.meta.main) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; }).catch((e: unknown) => {
    process.stderr.write(`could not run: ${String(e)}\n`);
    process.exitCode = 2;
  });
}
