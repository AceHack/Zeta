#!/usr/bin/env bun
// src/Core.TypeScript/hygiene/lint-hand-rolled-io.ts
//
// AN IO OPERATION HAND-ROLLED IN PLACE WHERE `io/safe-io.ts` ALREADY OWNS IT.
//
// ═══════════════════════════════════════════════════════════════════════════
// WHY A LINT AND NOT JUST A MODULE
// ═══════════════════════════════════════════════════════════════════════════
//
// The module half of this change is `src/Core.TypeScript/io/safe-io.ts`. On
// its own it changes nothing, and the proof is already in the tree: the
// correct spawn shape has existed in `peer-call/claude.ts` since 2026-05,
// reviewed and merged and clean in code scanning, and EIGHT sibling files
// went on writing `spawnSync("/bin/sh", ["-c", ...])` anyway. Nobody knew it
// was there. A primitive that is merely AVAILABLE loses to the pattern the
// author already has in their fingers, every time.
//
// So this file is the half that makes the module stick: the wrong shape stops
// being landable. New sites refuse; the ones already on `main` are counted in
// a baseline and grandfathered, because a gate that demands a forty-file
// migration before it can land is a gate that never lands
// (docs/AUDIT-LIFECYCLE.md step 5).
//
// ═══════════════════════════════════════════════════════════════════════════
// WHAT IT REFUSES, AND WHAT IT DELIBERATELY DOES NOT
// ═══════════════════════════════════════════════════════════════════════════
//
// TWO RULES. Both name a replacement in the refusal, because a refusal that
// does not say what to write instead is a refusal people route around.
//
//   1 `shell-string-spawn` -- a command line handed to an interpreter.
//     Three spellings, all of which reach the same defect:
//       * `execSync(...)` / `execFile`-with-`shell` -- shell by definition;
//       * a spawn whose FIRST argument is a shell path literal and whose
//         second is an array beginning `-c` / `/c` / `-Command`;
//       * `shell: true` in any options object.
//     Replacement: `spawnArgv` / `spawnFromRoster` / `runCommandLineFromRoster`,
//     or `spawnShellDeclared` with a written reason when the command line
//     genuinely IS the contract.
//
//   2 `unbounded-fetch-to-disk` -- a response body reaching a file sink with
//     no cap between them. Tracked through two hops: `const res = await
//     fetch(...)`, then `const body = await res.text()`, then a write whose
//     arguments name `body`. The one-expression spelling
//     (`writeFileSync(p, await (await fetch(u)).text())`) is matched directly.
//     Replacement: `fetchToFile` (streams under a cap, single owned
//     descriptor, removes the partial on failure) or `fetchBounded` +
//     `writeFileOwned`.
//
// NOT COVERED, ON PURPOSE:
//
//   * CHECK-THEN-USE FILE RACES. `lint-check-then-use-file-races.ts` already
//     owns that class, has owned it since 2026-08-20, and carries a
//     510-signature baseline. A second lint reporting the same finding would
//     double every count and teach everyone to ignore both. What this change
//     adds there is a DESTINATION -- `readFileBounded` / `writeFileOwned` --
//     for the fix that lint has always demanded.
//
//   * A shell reached through a wrapper the scanner cannot see. If a file
//     defines `function run(cmd) { return spawnSync("/bin/sh", ["-c", cmd]) }`
//     the definition is caught; a wrapper in ANOTHER module is not. Static
//     detection of this class is heuristic and permanently so, and saying that
//     plainly matters more than the coverage: a lint claiming more than it has
//     is a check that did not run wearing the face of one that passed.
//
//   * Any language but TypeScript/JavaScript, and any `.d.ts`.
//
//   * A fetch whose body reaches disk through THREE or more hops, or through a
//     function boundary. CodeQL sees those; this is a floor beneath CodeQL that
//     reports before merge, never a replacement for it.
//
// ═══════════════════════════════════════════════════════════════════════════
// COMMENTS ARE MASKED, AND THE MATCH IS THE CALL FORM
// ═══════════════════════════════════════════════════════════════════════════
//
// Both of these have bitten this repository, repeatedly, and a guard that
// forgets either is satisfied by its own documentation:
//
//   * THIS FILE NAMES `execSync` and `spawnSync("/bin/sh", ["-c"` in prose,
//     several times, in the paragraphs above. So do the module header of
//     `safe-io.ts` and the header of the sibling races lint. Comments are
//     blanked in place -- preserving offsets, so every reported line number
//     still indexes the original -- before anything is matched.
//
//   * THE MATCH IS `name(`, NEVER the bare identifier. `import { execSync }
//     from "node:child_process"` contains the identifier and is not a call;
//     a lint that flagged the import would flag every file that legitimately
//     uses `execFileSync` from the same import statement.
//
// Strings are deliberately NOT masked: the shell path (`"/bin/sh"`) and the
// interpret flag (`"-c"`) live inside string literals, and masking them would
// blind the lint to its main quarry. Same one-directional choice
// `lint-graphql-transport-in-scripts.ts` documents.
//
// ═══════════════════════════════════════════════════════════════════════════
// SUPPRESSION
// ═══════════════════════════════════════════════════════════════════════════
//
// `safe-io-ok: <reason>` in a comment on the finding's line or the line
// immediately above it. The reason is mandatory and non-empty -- an escape
// hatch with no stated reason is an allowlist, and an allowlist drifts. An
// empty one is itself a finding (`empty-suppression`).
//
// A file it cannot read is a FINDING (`unreadable`), never a silent skip, and
// a scan below `--min-files` is a FINDING (`scan-floor`). Both are "the check
// did not run", and neither is allowed to look like a pass.
//
// DST: pure function of the file tree. No clock, no network, no randomness;
// output ordinal-sorted throughout. Everything above `main()` is pure over
// strings, so the audit's own refusals are testable with no filesystem.
//
// Usage:
//   bun src/Core.TypeScript/hygiene/lint-hand-rolled-io.ts <root...> \
//     --min-files N --baseline <path> [--json] [--write-baseline]

import { readFileSync, readdirSync, writeFileSync, type Dirent } from "node:fs";
import { extname, join } from "node:path";

// ═══════════════════════════════════════════════════════════════════════════
// VOCABULARY
// ═══════════════════════════════════════════════════════════════════════════

export type Rule = "shell-string-spawn" | "unbounded-fetch-to-disk" | "unreadable" | "empty-suppression" | "scan-floor";

export interface Finding {
  readonly rule: Rule;
  readonly file: string;
  readonly line: number;
  /** Line-free identity. Stored in the baseline, so an edit above a row does not thaw it. */
  readonly signature: string;
  readonly detail: string;
  /** The replacement, named. A refusal that does not say what to write instead gets routed around. */
  readonly fix: string;
}

/** The replacements, carried in data so every refusal prints one. */
export const REPLACEMENTS: ReadonlyMap<Rule, string> = new Map([
  [
    "shell-string-spawn",
    "Use an argument vector: `spawnArgv(program, args)` from src/Core.TypeScript/io/safe-io.ts — " +
      "no shell, so nothing in `args` can become syntax. When the program NAME comes from outside " +
      "the process use `spawnFromRoster(roster, requested, args)`, which spawns the ROSTER's string " +
      "so external input selects but never supplies argv[0]. For a whole command line from a flag, " +
      "`runCommandLineFromRoster(roster, commandLine)` splits it and refuses shell metacharacters. " +
      "If the command line genuinely IS the contract (peer-call's documented `--context-cmd` escape " +
      "hatch), use `spawnShellDeclared(shell, commandLine, { reason })` — it still runs a shell, but " +
      "there is ONE of them in the tree, the reason is a value rather than a comment, and the output " +
      "bound is in-process instead of a `| head -c` you had to remember to write.",
  ],
  [
    "unbounded-fetch-to-disk",
    "Use `fetchToFile(url, destPath, { maxBytes, timeoutMs })` from src/Core.TypeScript/io/safe-io.ts: " +
      "it checks the scheme before anything opens, counts bytes as they arrive and abandons the " +
      "transfer the moment the cap is crossed, writes through ONE owned descriptor, and REMOVES THE " +
      "PARTIAL FILE on failure — a half-written artifact left at the destination is worse than none, " +
      "because the next reader finds a file and believes the download happened. If the body must pass " +
      "through your code first, `fetchBounded(url, { maxBytes })` then `writeFileOwned(path, body)`.",
  ],
]);

/** Extensions scanned. */
export const SCANNED_EXTENSIONS: readonly string[] = [".ts", ".mts", ".cts", ".js", ".mjs", ".cjs"];

/**
 * The paths exempt from the scan, enumerable so a test can pin the size.
 *
 * TWO, and both are the lint's own subject matter rather than a carve-out for
 * convenience. An exemption with room to grow is an allowlist.
 *
 *   * `io/safe-io.ts` is THE sanctioned site. `spawnShellDeclared` exists so
 *     that the tree's one shell lives in one reviewable function; flagging it
 *     would be flagging the remedy.
 *   * this lint's own test fixtures are literal `execSync(` and
 *     `spawnSync("/bin/sh", ["-c"` strings, because that is the only way to
 *     prove the matcher fires.
 */
export const EXEMPT_SUFFIXES: readonly string[] = ["src/Core.TypeScript/io/safe-io.ts", "lint-hand-rolled-io.test.ts"];

// ═══════════════════════════════════════════════════════════════════════════
// MASKING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Blank comments in place, preserving length and newlines so every offset in
 * the masked text still indexes the original.
 *
 * `//` preceded by `:` is left alone so a URL inside a string does not swallow
 * the rest of its line. Strings are otherwise untouched -- see the header.
 */
export function maskComments(text: string): string {
  const out: string[] = [];
  const n = text.length;
  let i = 0;
  const blankTo = (end: number): void => {
    for (let k = i; k < end && k < n; k++) out.push(text[k] === "\n" ? "\n" : " ");
    i = Math.min(end, n);
  };

  while (i < n) {
    const ch = text[i] ?? "";
    const next = text[i + 1] ?? "";
    const isLineComment = ch === "/" && next === "/" && text[i - 1] !== ":";
    if (isLineComment) {
      const eol = text.indexOf("\n", i);
      blankTo(eol < 0 ? n : eol);
      continue;
    }
    if (ch === "/" && next === "*") {
      const close = text.indexOf("*/", i + 2);
      blankTo(close < 0 ? n : close + 2);
      continue;
    }
    out.push(ch);
    i++;
  }
  return out.join("");
}

/**
 * Lines carrying `safe-io-ok: <reason>`, mapped to the reason.
 *
 * Read from the ORIGINAL text, because the marker lives in a comment and the
 * matcher runs on text where comments have been blanked.
 */
export function suppressions(text: string): ReadonlyMap<number, string> {
  const out = new Map<number, string>();
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const m = /safe-io-ok:(.*)$/u.exec(lines[i] ?? "");
    if (m) out.set(i + 1, (m[1] ?? "").trim());
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════
// MATCHING
// ═══════════════════════════════════════════════════════════════════════════

/** Ordinal, never `localeCompare` — .claude/rules/culture-invariant-by-default.md. */
function compareOrdinal(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

export function lineOf(text: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < text.length; i++) if (text[i] === "\n") line++;
  return line;
}

/**
 * `execSync(` — the CALL form. The bare identifier is an import, not a defect.
 *
 * `exec(` on its own is deliberately absent: `RegExp.prototype.exec` is by far
 * its commonest spelling in this tree, and a rule whose findings are mostly
 * regular expressions is a rule everyone learns to ignore. `execSync` is
 * unambiguous, and `shell: true` below catches the promisified `exec` route
 * that matters.
 */
const EXEC_SYNC_CALL = /\bexecSync\s*\(/gu;

/** `shell: true` in an options object — the flag that turns argv back into syntax. */
const SHELL_TRUE = /\bshell\s*:\s*true\b/gu;

/**
 * A call whose first argument is a shell PATH LITERAL and whose second begins
 * with an interpret-this-string flag.
 *
 * Written against the CALL SHAPE rather than against a callee name, and that
 * is the deliberate choice: naming `spawnSync` would miss
 * `runSpawn("/bin/sh", ["-c", …])`, which is exactly how a local wrapper hides
 * the pattern from a name-based grep. What identifies the defect is the pair
 * (shell literal, interpret flag), so that is what is matched.
 */
const SHELL_ARGV_CALL =
  /\(\s*(["'`])(?:\/(?:usr\/)?(?:local\/)?bin\/)?(sh|bash|zsh|dash|ksh|ash|csh|tcsh|fish|cmd|cmd\.exe|powershell|powershell\.exe|pwsh|pwsh\.exe)\1\s*,\s*\[\s*(["'])(-c|\/c|\/C|-Command|-command|-EncodedCommand)\3/gu;

/** `const res = await fetch(` — binds a response name. */
const RESPONSE_BIND = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*await\s+fetch\s*\(/gu;

/** `const body = await res.text()` — binds a body name to a response name. */
const BODY_BIND =
  /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*\(?\s*await\s+([A-Za-z_$][\w$]*)\s*\.\s*(?:text|json|arrayBuffer|bytes|blob)\s*\(\s*\)/gu;

/**
 * The file sinks whose ARGUMENTS carry the bytes.
 *
 * `createWriteStream` is deliberately NOT here. It never receives the body as
 * an argument -- the body arrives through a later `.write()` or a pipe -- so
 * matching it in this list produced a rule that could not fire on the very
 * fixture written to prove it fires. The streaming shape has its own matcher
 * below; a sink in the wrong list is a rule that looks like coverage.
 */
const FILE_SINK = /\b(?:writeFileSync|appendFileSync|Bun\s*\.\s*write)\s*\(/gu;

/**
 * The STREAMING download shape: a response body piped straight at a file stream.
 *
 * `res.body.pipeTo(createWriteStream(dest))` and
 * `pipeline(res.body, createWriteStream(dest))` are the canonical unbounded
 * download, and neither passes the bytes as an argument to the file call, so
 * the argument-inspecting rule above is blind to both.
 */
const STREAM_SINK = /\b(?:pipeTo|pipeline)\s*\(/gu;

/**
 * A response body produced inline inside the write's own arguments.
 *
 * `fetch(` is REQUIRED in the match, and that is a correction rather than a
 * design choice. The first draft accepted a bare `.text()` and immediately
 * reported `Bun.write(out, await Bun.file(out).text() + …)` in
 * `ci/perf-regression-ledger.ts` — a LOCAL FILE read-modify-write with no
 * network anywhere in it. A rule whose findings are other people's correct
 * code is a rule that gets switched off.
 */
const INLINE_BODY = /\bfetch\s*\(/u;

/**
 * The argument text of a call whose `(` sits at `open`.
 *
 * Bounded by `limit` characters so a malformed or minified file cannot make
 * the scanner walk the whole buffer from every sink. Depth-counted over
 * brackets; string interiors are not tracked, which can end the slice early
 * on a literal `)` inside a string -- an error in the under-reporting
 * direction, named rather than discovered.
 */
export function callArguments(text: string, open: number, limit = 400): string {
  let depth = 0;
  const end = Math.min(text.length, open + limit);
  for (let i = open; i < end; i++) {
    const ch = text[i];
    if (ch === "(" || ch === "[" || ch === "{") depth++;
    else if (ch === ")" || ch === "]" || ch === "}") {
      depth--;
      if (depth === 0) return text.slice(open + 1, i);
    }
  }
  return text.slice(open + 1, end);
}

/**
 * How far a sink may sit below the bind and still count as the same flow.
 *
 * A window, not a scope, because this scanner has no parser. It replaces a
 * first draft that paired a bind ANYWHERE ABOVE with a sink anywhere below,
 * which paired across whole files and across functions. Twenty-five lines is
 * the distance the observed real instances span; wider pairs noise, narrower
 * misses the shape that motivated the rule.
 */
const SAME_BLOCK_LINES = 25;

/** How far back of a `.pipeTo(` the receiver expression is read. See its use. */
const RECEIVER_LOOKBACK = 80;

/**
 * Blank the interiors of string literals, preserving length.
 *
 * TWO false positives on the FIRST RUN, both of this shape, which is why the
 * stripper runs before every match rather than only the one that needed it:
 *
 *   * `appendFileSync(join(cwd(), "data", "history.jsonl"), …)` matched a body
 *     variable called `data` — the identifier was inside a path segment.
 *   * `writeFileSync(p, \`fetch("docs/room-evidence/index.json");\`)` in a
 *     discovery test matched the inline-fetch rule. The file being WRITTEN is
 *     a JavaScript fixture that calls `fetch`; the writer does not.
 *
 * Identifiers and calls live in code. A match inside a string literal is a
 * coincidence of spelling, and a lint that reports one is reporting on a
 * program it is not analysing.
 */
export function stripStringLiterals(text: string): string {
  let out = "";
  let quote = "";
  let escaped = false;
  for (const ch of text) {
    if (escaped) {
      out += " ";
      escaped = false;
      continue;
    }
    if (quote !== "") {
      if (ch === "\\") {
        escaped = true;
        out += " ";
        continue;
      }
      out += ch === quote ? ch : " ";
      if (ch === quote) quote = "";
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      out += ch;
      continue;
    }
    out += ch;
  }
  return out;
}

/** Findings in one file's text. Pure — no filesystem, no clock. */
export function analyzeSource(text: string, path: string): readonly Finding[] {
  const masked = maskComments(text);
  const suppressed = suppressions(text);
  const findings: Finding[] = [];

  const record = (rule: Rule, index: number, signature: string, detail: string): void => {
    const line = lineOf(masked, index);
    const reason = suppressed.get(line) ?? suppressed.get(line - 1);
    if (reason !== undefined) {
      if (reason === "") {
        findings.push({
          rule: "empty-suppression",
          file: path,
          line,
          signature: `empty-suppression ${rule}`,
          detail:
            "`safe-io-ok:` with no reason. An escape hatch with no stated reason is an allowlist, and an allowlist drifts.",
          fix: "Write the reason after the colon, or remove the marker and use the primitive.",
        });
      }
      return;
    }
    findings.push({
      rule,
      file: path,
      line,
      signature,
      detail,
      fix: REPLACEMENTS.get(rule) ?? "See src/Core.TypeScript/io/safe-io.ts.",
    });
  };

  for (const m of masked.matchAll(EXEC_SYNC_CALL)) {
    record(
      "shell-string-spawn",
      m.index,
      "execSync",
      "`execSync` runs its argument through a shell, so every character in it is syntax. Any value " +
        "interpolated into that string — a CLI flag, a branch name, a file path — is code.",
    );
  }

  for (const m of masked.matchAll(SHELL_TRUE)) {
    record(
      "shell-string-spawn",
      m.index,
      "shell-true",
      "`shell: true` turns an argument vector back into a shell string, discarding the one property " +
        "that made the vector safe.",
    );
  }

  for (const m of masked.matchAll(SHELL_ARGV_CALL)) {
    record(
      "shell-string-spawn",
      m.index,
      `shell-argv-${m[2] ?? "sh"}`,
      `A shell (\`${m[2] ?? "sh"}\`) invoked with \`${m[4] ?? "-c"}\`: the argument is a program, not data.`,
    );
  }

  // ── fetch body reaching a file sink ─────────────────────────────────────
  const responseVars = new Set<string>();
  for (const m of masked.matchAll(RESPONSE_BIND)) {
    if (m[1] !== undefined) responseVars.add(m[1]);
  }
  const bodyVars = new Map<string, number>();
  for (const m of masked.matchAll(BODY_BIND)) {
    const bound = m[1];
    const from = m[2];
    if (bound !== undefined && from !== undefined && responseVars.has(from)) bodyVars.set(bound, m.index);
  }

  for (const m of masked.matchAll(FILE_SINK)) {
    const open = masked.indexOf("(", m.index + m[0].length - 1);
    if (open < 0) continue;
    const args = stripStringLiterals(callArguments(masked, open));
    if (INLINE_BODY.test(args)) {
      record(
        "unbounded-fetch-to-disk",
        m.index,
        "fetch-to-disk-inline",
        "A response body is produced inside the write's own arguments, so nothing bounds it: the file " +
          "is exactly as large as whatever the remote endpoint chose to send.",
      );
      continue;
    }
    const sinkLine = lineOf(masked, m.index);
    for (const [name, boundAt] of bodyVars) {
      if (boundAt > m.index) continue;
      if (sinkLine - lineOf(masked, boundAt) > SAME_BLOCK_LINES) continue;
      if (new RegExp(`\\b${name}\\b`, "u").test(args)) {
        record(
          "unbounded-fetch-to-disk",
          m.index,
          "fetch-to-disk-var",
          `\`${name}\` holds a response body read with no cap, and it reaches a file sink here.`,
        );
        break;
      }
    }
  }

  for (const m of masked.matchAll(STREAM_SINK)) {
    const open = masked.indexOf("(", m.index + m[0].length - 1);
    if (open < 0) continue;
    const args = stripStringLiterals(callArguments(masked, open));
    if (!/\bcreateWriteStream\s*\(/u.test(args)) continue;
    // The response is the RECEIVER of `.pipeTo`, not one of its arguments
    // (`res.body.pipeTo(createWriteStream(p))`), so the receiver expression
    // has to be read too. Eighty characters back covers `res.body.` and the
    // `pipeline(res.body,` spelling without pairing across statements.
    const receiver = masked.slice(Math.max(0, m.index - RECEIVER_LOOKBACK), m.index);
    const context = stripStringLiterals(receiver) + " " + args;
    const namesAResponse = [...responseVars].some((v) => new RegExp(`\\b${v}\\b`, "u").test(context));
    if (!namesAResponse && !/\bfetch\s*\(/u.test(context)) continue;
    record(
      "unbounded-fetch-to-disk",
      m.index,
      "fetch-to-disk-stream",
      "A response body is piped straight into a file stream, so the file is exactly as large as whatever " +
        "the remote endpoint chose to send and a failed transfer leaves a partial file at the destination.",
    );
  }

  return [...findings].sort(compareFindings);
}

function compareFindings(a: Finding, b: Finding): number {
  if (a.line !== b.line) return a.line - b.line;
  return compareOrdinal(a.signature, b.signature);
}

// ═══════════════════════════════════════════════════════════════════════════
// BASELINE
// ═══════════════════════════════════════════════════════════════════════════

export type Baseline = Readonly<Record<string, number>>;

/**
 * The baseline key: rule, file, and line-free signature.
 *
 * COUNTS, NOT A SET, and the reason is a hole a set would leave. Several files
 * hold more than one site of the same shape, so a set-shaped baseline would
 * grandfather that file's whole shape and let a fourth `execSync` land in an
 * already-listed file silently. Counting closes that: the (n+1)th is a finding.
 *
 * Its honest limit, stated rather than discovered: delete one baselined site
 * and add another of the same shape in the same file, and the count is
 * unchanged, so the new one is not caught.
 */
export function baselineKey(f: Finding): string {
  return `${f.rule}|${f.file}|${f.signature}`;
}

export function tally(findings: readonly Finding[]): Baseline {
  const out: Record<string, number> = {};
  for (const f of findings) {
    if (f.rule === "unreadable" || f.rule === "scan-floor") continue;
    const k = baselineKey(f);
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

/** Findings in excess of what the baseline grandfathers. */
export function newFindings(findings: readonly Finding[], baseline: Baseline): readonly Finding[] {
  const seen = new Map<string, number>();
  const out: Finding[] = [];
  for (const f of findings) {
    if (f.rule === "unreadable" || f.rule === "scan-floor") {
      out.push(f);
      continue;
    }
    const k = baselineKey(f);
    const n = (seen.get(k) ?? 0) + 1;
    seen.set(k, n);
    if (n > (baseline[k] ?? 0)) out.push(f);
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════
// I/O EDGE
// ═══════════════════════════════════════════════════════════════════════════

const SKIP_DIRS: ReadonlySet<string> = new Set([
  "node_modules",
  ".git",
  "dist",
  "bin",
  "obj",
  "prior-art",
  "references",
  "coverage",
  ".venv",
  "artifacts",
  "docs/recovered-orphan-branches-2026-05",
]);

export interface LoadedFile {
  readonly path: string;
  readonly text: string;
  /** Non-empty when the file exists but could not be read. */
  readonly readError: string;
}

export function isScannable(path: string): boolean {
  const ext = extname(path);
  if (!SCANNED_EXTENSIONS.includes(ext)) return false;
  if (path.endsWith(".d.ts")) return false;
  if (EXEMPT_SUFFIXES.some((p) => path.endsWith(p))) return false;
  return true;
}

/**
 * Every scannable file under `root`.
 *
 * `withFileTypes` and read-then-interpret, never exists-then-read — a lint
 * that violates its sibling lint is the loudest argument for ignoring both.
 */
export function loadFiles(root: string): readonly LoadedFile[] {
  const out: LoadedFile[] = [];
  const walk = (dir: string): void => {
    let entries: Dirent[];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        walk(full);
        continue;
      }
      if (!entry.isFile()) continue;
      if (!isScannable(full)) continue;
      try {
        out.push({ path: full, text: readFileSync(full, "utf8"), readError: "" });
      } catch (e) {
        out.push({ path: full, text: "", readError: e instanceof Error ? e.message : String(e) });
      }
    }
  };
  walk(root);
  return out.sort((a, b) => compareOrdinal(a.path, b.path));
}

interface Options {
  readonly roots: readonly string[];
  readonly minFiles: number;
  readonly baselinePath: string;
  readonly json: boolean;
  readonly writeBaseline: boolean;
}

export function parseArgs(argv: readonly string[]): Options {
  const roots: string[] = [];
  let minFiles = 0;
  let baselinePath = "";
  let json = false;
  let writeBaseline = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--min-files") {
      minFiles = Number.parseInt(argv[++i] ?? "0", 10);
    } else if (a === "--baseline") {
      baselinePath = argv[++i] ?? "";
    } else if (a === "--json") {
      json = true;
    } else if (a === "--write-baseline") {
      writeBaseline = true;
    } else if (a !== undefined && !a.startsWith("--")) {
      roots.push(a);
    }
  }
  return { roots: roots.length > 0 ? roots : ["."], minFiles, baselinePath, json, writeBaseline };
}

function readBaseline(path: string): Baseline {
  if (path === "") return {};
  try {
    return JSON.parse(readFileSync(path, "utf8")) as Baseline;
  } catch {
    // A missing baseline is an EMPTY one, not a pass: every finding is then new.
    return {};
  }
}

export function scan(roots: readonly string[]): { findings: readonly Finding[]; scanned: number } {
  const findings: Finding[] = [];
  let scanned = 0;
  for (const root of roots) {
    for (const file of loadFiles(root)) {
      scanned++;
      if (file.readError !== "") {
        findings.push({
          rule: "unreadable",
          file: file.path,
          line: 1,
          signature: "unreadable",
          detail: `could not be read: ${file.readError}`,
          fix: "Make the path readable, or exclude it deliberately and say so.",
        });
        continue;
      }
      findings.push(...analyzeSource(file.text, file.path));
    }
  }
  return { findings, scanned };
}

function main(): number {
  const options = parseArgs(process.argv.slice(2));
  const { findings, scanned } = scan(options.roots);

  if (options.writeBaseline) {
    const sorted = Object.fromEntries(Object.entries(tally(findings)).sort((a, b) => compareOrdinal(a[0], b[0])));
    writeFileSync(options.baselinePath, `${JSON.stringify(sorted, null, 2)}\n`);
    process.stdout.write(
      `wrote ${String(Object.keys(sorted).length)} baseline keys (${String(findings.length)} findings, ${String(scanned)} files) to ${options.baselinePath}\n`,
    );
    return 0;
  }

  const baseline = readBaseline(options.baselinePath);
  const fresh = [...newFindings(findings, baseline)];

  if (scanned < options.minFiles) {
    fresh.push({
      rule: "scan-floor",
      file: options.roots.join(" "),
      line: 1,
      signature: "scan-floor",
      detail: `scanned ${String(scanned)} files, floor is ${String(options.minFiles)}. A check that inspected nothing must not report success.`,
      fix: "Point --min-files at a real floor, or fix the root that stopped producing files.",
    });
  }

  if (options.json) {
    process.stdout.write(
      `${JSON.stringify({ scanned, total: findings.length, baselined: findings.length - fresh.length, findings: fresh }, null, 2)}\n`,
    );
    return fresh.length === 0 ? 0 : 1;
  }

  process.stdout.write(
    `lint-hand-rolled-io: ${String(scanned)} files, ${String(findings.length)} findings, ${String(fresh.length)} not grandfathered\n`,
  );
  for (const f of fresh) {
    process.stdout.write(`\n${f.file}:${String(f.line)}  [${f.rule}]\n  ${f.detail}\n  FIX: ${f.fix}\n`);
  }
  if (fresh.length === 0) {
    process.stdout.write("OK — no new hand-rolled IO.\n");
    return 0;
  }
  process.stdout.write(
    `\n${String(fresh.length)} finding(s). The primitive is src/Core.TypeScript/io/safe-io.ts. ` +
      "To grandfather a genuinely-unavoidable site, write `safe-io-ok: <reason>` in a comment on its line " +
      "or the line above — the reason is mandatory.\n",
  );
  return 1;
}

if (import.meta.main) {
  process.exit(main());
}
