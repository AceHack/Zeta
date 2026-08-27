#!/usr/bin/env bun
// src/Core.TypeScript/hygiene/lint-check-then-use-file-races.ts
//
// A FILESYSTEM EXISTENCE TEST WHOSE RESULT GATES A LATER OPERATION ON THE
// SAME PATH. Check-then-use. TOCTOU.
//
// THE DEFECT THIS EXISTS FOR. Three instances landed on 2026-08-20, in ONE
// DAY, from THREE INDEPENDENT agents, all in new code that had already been
// written and reviewed:
//
//   1. cluster/restricted-namespace-workloads.test.ts -- readdirSync, then
//      statSync(p).isDirectory(), then readFileSync(p). Fixed with
//      { withFileTypes: true }.
//   2. cluster/storage-profiles.ts -- existsSync(abs) gating readFileSync(abs).
//      Fixed by reading and interpreting ENOENT.
//   3. hygiene/audit-chart-target-revisions.ts -- THREE sites in one file:
//      existsSync->readdirSync, existsSync->readRoster, existsSync->readFileSync.
//
// Each was found by CodeQL (js/file-system-race, HIGH), one at a time, AFTER
// merge. Nothing in this tree caught them, so a fourth was a matter of time.
//
// WHY IT KEEPS HAPPENING. The pattern READS as defensive. `if (!existsSync(p))
// return;` looks like care, and it is the opposite: between the check and the
// read, the path can be created, deleted, or replaced -- by a concurrent agent
// in this very fleet, by a `git checkout`, by a background clone. The check
// buys nothing the read does not already tell you, and it converts a single
// atomic syscall into two that can disagree. The correct forms are mechanical
// and are named in every refusal this lint emits.
//
// Anchor (Beacon): the TOCTTOU race is Abbott et al. 1976 (the original
// "time-of-check to time-of-use" naming in the RISOS study) and Bishop &
// Dilger, "Checking for Race Conditions in File Accesses" (Computing Systems
// 9(2), 1996) -- whose central point is exactly this lint's premise: the flaw
// is a *syntactic pattern in the source*, detectable statically, and their
// detector was likewise pattern-based and likewise incomplete. CWE-367 is the
// same class. The remedy Bishop & Dilger name is the one named here: perform
// the operation and handle its failure, rather than asking a question whose
// answer is stale the instant it is returned.
//
// ═══════════════════════════════════════════════════════════════════════════
// WHAT THIS SEES, AND WHAT IT PROVABLY DOES NOT
// ═══════════════════════════════════════════════════════════════════════════
//
// Static detection of this class is HEURISTIC, inherently and permanently.
// Stating that plainly is not modesty, it is the point: a lint that claims
// more coverage than it has is the same defect class in a new place -- a check
// that did not run, looking exactly like one that passed.
//
// IT SEES:
//   * A check and a use in the SAME LEXICAL BLOCK (or nested inside it),
//     naming the same path by the SAME TEXT: `existsSync(abs)` ...
//     `readFileSync(abs, "utf8")`. All three known instances are this shape.
//   * `statSync(P).isFile()` / `.isDirectory()` / `.isSymbolicLink()` used as
//     the branch, which is an existence test wearing a stat's clothes.
//   * `readdirSync(D)` without { withFileTypes: true } whose block then stats
//     a path built from D -- instance 1's shape, where the path is
//     `join(D, name)` and no two call sites name it identically.
//
// IT DOES NOT SEE, and cannot without a type checker and a call graph:
//   * A check and a use in DIFFERENT FUNCTIONS. `if (!existsSync(p)) return;`
//     in a caller and `readFileSync(p)` in the callee is invisible here.
//     Instance 3's `existsSync -> readRoster(...)` was of this shape and is
//     caught only because `readRoster` is not the boundary -- had the check
//     been one function further out, this lint would miss it.
//   * A check whose result is stored and consumed later:
//     `const ok = existsSync(p); ... if (ok) readFileSync(p);` -- the check is
//     seen, but its pairing to the use is not attempted through the variable.
//   * A path named differently at the two sites: `existsSync(abs)` and
//     `readFileSync(resolve(abs))` normalise to different text, so they do not
//     pair. Renaming a path variable between the two sites HIDES the defect
//     from this lint. It does not hide it from CodeQL, which is why CodeQL
//     stays wired and this lint is a floor beneath it, never a replacement.
//   * Anything in a language other than TypeScript, or in a .d.ts.
//   * The async family (`fs.promises.stat` then `fs.promises.readFile`). The
//     three observed instances are all sync; the async shape is real and is
//     NOT covered. Named here rather than discovered later.
//
// A file this scanner cannot lex is a FINDING (rule `unparsed`), never a
// silent skip -- likewise a file it cannot read, and likewise a scan that
// inspected fewer files than `--min-files`. All three are "the check did not
// run", and none of them is allowed to look like a pass.
//
// ═══════════════════════════════════════════════════════════════════════════
// WHAT IT MEASURED ON MAIN, AND WHY THERE IS A BASELINE
// ═══════════════════════════════════════════════════════════════════════════
//
// The brief that commissioned this lint said the tree was clean, because the
// three CodeQL alerts had been fixed. It is not. First run over
// src/Core.TypeScript: **332 pre-existing findings** -- 291 `check-then-use`
// and 41 `readdir-then-stat` -- across **180 files** of 1878, which dedupe to
// 295 distinct call-pair signatures. Only the three CodeQL happened to surface
// had ever been looked at.
//
// So the interesting result is not that a fourth instance was a matter of
// time. It is that the tree already held three hundred and thirty-two, and the
// reason nobody knew is that the only instrument pointed at this class reports
// after the merge, into a tab, one alert at a time.
//
// AND IT IS STILL ARRIVING, measured while this very PR was in flight. The
// first baseline was taken at 288 signatures; one hour later CI scanned three
// more files than the clone had and found **7 fresh instances** in two newly
// merged files (cluster/argocd-health-test.ts, cluster/cilium-kind-lane.ts).
// That is the fourth and fifth wave, landing between the measurement and the
// gate. Operational consequence for whoever hits it next: a concurrent merge
// that adds an instance reddens this check on an unrelated PR, and the fix is
// to rebase and re-run `--write-baseline`, not to widen the rule.
//
// Those 295 signatures are grandfathered in
// `lint-check-then-use-file-races.baseline.json`
// (hygiene/AUDIT-LIFECYCLE.md step 5 -- a gate that demands a 180-file cleanup
// before it can land is a gate that never lands). What the baseline does NOT
// grandfather: a new instance anywhere, or an edit that renames the path
// expression at an existing site. The key is the call-pair signature, not the
// line, so unrelated edits above a row do not thaw it and a rename does.
//
// One row is worth naming for where it is: hygiene/lint-guards-are-reachable.ts
// -- the closest cousin to this audit, sitting on the same floor -- walks
// directories with readdir-then-stat. The floor's own tooling was carrying the
// defect the floor exists to refuse, which is the best available argument that
// "written and reviewed" is not a defence against this shape.
//
// ═══════════════════════════════════════════════════════════════════════════
// SUPPRESSION
// ═══════════════════════════════════════════════════════════════════════════
//
// `// toctou-ok: <reason>` on the line of the CHECK suppresses that check's
// findings. The reason is mandatory and must be non-empty: an escape hatch
// with no stated reason is an allowlist, and an allowlist drifts. A lint with
// no hatch at all does not get obeyed, it gets deleted.
//
// Everything above main() is pure over strings, so the audit is testable with
// no filesystem and its own refusals are falsifiable.

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// ═══════════════════════════════════════════════════════════════════════════
// VOCABULARY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calls that answer "is it there?" and nothing else.
 *
 * `statSync`/`lstatSync` qualify only in their `.isX()` form -- a bare
 * `statSync(p).size` is a measurement, not a gate, and flagging it would be
 * the over-claim this file's header refuses.
 */
export const EXISTENCE_CHECKS: readonly string[] = ["existsSync", "statSync", "lstatSync"];

/** The `.isX()` suffixes that turn a stat into an existence branch. */
const STAT_BRANCH_SUFFIX =
  /^\s*\.\s*(?:isFile|isDirectory|isSymbolicLink|isBlockDevice|isCharacterDevice|isFIFO|isSocket)\s*\(/;

/**
 * Filesystem operations whose failure the check was pretending to prevent.
 *
 * Reads and path-consuming operations, not writes: `if (!existsSync(d))
 * mkdirSync(d)` is a different (also real) shape whose fix is
 * `{ recursive: true }`, and mixing the two would make one refusal message
 * name the wrong remedy. The named remedy is the reason a lint gets obeyed.
 */
export const GATED_USES: readonly string[] = [
  "readFileSync",
  "readdirSync",
  "readlinkSync",
  "copyFileSync",
  "realpathSync",
  "openSync",
  "createReadStream",
  "renameSync",
  "unlinkSync",
  "rmSync",
  "appendFileSync",
  "truncateSync",
  "chmodSync",
  "utimesSync",
];

/**
 * Uses for which a preceding `statSync` is a race worth reporting even when the stat only read
 * `.size`. These DESTROY or REPLACE the path, so acting on a stale judgement is not a wrong number
 * — it is the wrong file.
 */
const STAT_THEN_DESTRUCTIVE: ReadonlySet<string> = new Set([
  "unlinkSync",
  "rmSync",
  "renameSync",
  "truncateSync",
  "chmodSync",
  "utimesSync",
]);

export type Rule =
  | "check-then-use"
  | "readdir-then-stat"
  | "stat-then-use"
  | "unparsed"
  | "unreadable"
  | "empty-suppression"
  | "scan-floor";

export interface Finding {
  readonly rule: Rule;
  readonly file: string;
  readonly line: number;
  /**
   * Line-free identity of the finding, e.g. `existsSync(abs)->readFileSync(abs)`.
   *
   * Separate from `detail` so the baseline stores something a reviewer can read
   * in a diff. Deriving the key by regexing the English out of `detail` would
   * make every prose edit to a refusal message silently thaw the whole
   * baseline -- a check that stopped running, looking like one that passed.
   */
  readonly signature: string;
  readonly detail: string;
  readonly fix: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// LEXING -- offsets preserved, so the masked text and the original index alike
// ═══════════════════════════════════════════════════════════════════════════

export interface MaskResult {
  /** Same length as the input; comments and string CONTENTS become spaces. */
  readonly masked: string;
  /** Empty when the file lexed cleanly; otherwise why it did not. */
  readonly unlexable: string;
}

/**
 * Blank comments and the interiors of string/template literals, in place.
 *
 * Both directions matter. A call written inside a comment is not a call site,
 * and the worked examples in this very header would otherwise make this file
 * report itself -- after which the first thing anyone would do is delete the
 * examples. And a path spelled in a string literal must not be blanked out of
 * existence for the PAIRING (see `sliceArgument`, which reads the ORIGINAL
 * text at these offsets); masking is for finding call boundaries only.
 *
 * Regex literals are lexed, because `/[^/]*\//` inside one would otherwise
 * swallow the rest of its line -- the exact limit lint-guards-are-reachable.ts
 * declares and lives with. Distinguishing a regex from a division is done by
 * the standard preceding-token heuristic, which is not perfect; when it
 * mis-guesses, the file usually ends unbalanced and is reported `unparsed`
 * rather than silently under-scanned.
 */
export function maskNonCode(text: string): MaskResult {
  // Exactly one character is pushed per element, so `regexCanStartHere` can
  // read the emitted prefix backwards as a token stream.
  const out: string[] = [];
  const n = text.length;
  let i = 0;
  const blank = (c: string): string => (c === "\n" ? "\n" : " ");

  // MODE STACK. A template literal is NOT a string: `${...}` holds code, that
  // code may open another template, and that template may open another
  // substitution. src/Core.TypeScript/hygiene/audit-stale-worktrees.ts does
  // exactly that, and a flat "blank to the next backtick" scan terminates on
  // the wrong delimiter and loses the rest of the file. Each frame is a code
  // region with its own brace depth; a `}` at depth 0 inside a substitution
  // returns to the template text that opened it.
  interface Frame {
    readonly kind: "code" | "template";
    depth: number;
  }
  const stack: Frame[] = [{ kind: "code", depth: 0 }];
  const top = (): Frame => stack[stack.length - 1] ?? { kind: "code", depth: 0 };

  while (i < n) {
    const ch = text[i] ?? "";
    const next = text[i + 1] ?? "";
    const frame = top();

    if (frame.kind === "template") {
      if (ch === "\\") {
        out.push(" ");
        out.push(blank(next));
        i += 2;
        continue;
      }
      if (ch === "`") {
        out.push("`");
        i++;
        stack.pop();
        continue;
      }
      if (ch === "$" && next === "{") {
        out.push("$");
        out.push("{");
        i += 2;
        stack.push({ kind: "code", depth: 0 });
        continue;
      }
      out.push(blank(ch));
      i++;
      continue;
    }

    if (ch === "/" && next === "/") {
      while (i < n && text[i] !== "\n") {
        out.push(" ");
        i++;
      }
      continue;
    }
    if (ch === "/" && next === "*") {
      const close = text.indexOf("*/", i + 2);
      if (close < 0) {
        return {
          masked: out.join("") + text.slice(i).replace(/[^\n]/g, " "),
          unlexable: "unterminated block comment opened at offset " + String(i),
        };
      }
      for (let k = i; k < close + 2; k++) out.push(blank(text[k] ?? ""));
      i = close + 2;
      continue;
    }
    if (ch === "`") {
      out.push("`");
      i++;
      stack.push({ kind: "template", depth: 0 });
      continue;
    }
    if (ch === '"' || ch === "'") {
      const quote = ch;
      out.push(ch);
      i++;
      let closed = false;
      while (i < n) {
        const c = text[i] ?? "";
        if (c === "\\") {
          out.push(" ");
          out.push(blank(text[i + 1] ?? " "));
          i += 2;
          continue;
        }
        if (c === quote) {
          out.push(c);
          i++;
          closed = true;
          break;
        }
        // A quoted string may not span a newline; an unescaped one means the
        // lexer has lost the thread, so say so rather than guess.
        if (c === "\n") {
          return {
            masked: out.join("") + text.slice(i).replace(/[^\n]/g, " "),
            unlexable: "unterminated " + quote + " string at offset " + String(i),
          };
        }
        out.push(blank(c));
        i++;
      }
      if (!closed) {
        return {
          masked: out.join(""),
          unlexable: "unterminated " + quote + " literal reaching end of file",
        };
      }
      continue;
    }
    if (ch === "{") {
      frame.depth++;
      out.push(ch);
      i++;
      continue;
    }
    if (ch === "}") {
      if (frame.depth === 0 && stack.length > 1) {
        // Closes the `${` that opened this frame; the template resumes.
        out.push("}");
        i++;
        stack.pop();
        continue;
      }
      if (frame.depth > 0) frame.depth--;
      out.push(ch);
      i++;
      continue;
    }
    if (ch === "/" && regexCanStartHere(out)) {
      const end = scanRegexLiteral(text, i);
      if (end < 0) {
        return {
          masked: out.join("") + text.slice(i).replace(/[^\n]/g, " "),
          unlexable: "unterminated regex literal at offset " + String(i),
        };
      }
      // Keep BOTH delimiters visible so the emitted prefix still reads as a
      // completed value to the next regex-vs-division decision.
      let close = end - 1;
      while (close > i && /[a-z]/.test(text[close] ?? "")) close--;
      out.push("/");
      for (let k = i + 1; k < end; k++) out.push(k === close ? "/" : blank(text[k] ?? ""));
      i = end;
      continue;
    }
    out.push(ch);
    i++;
  }
  if (stack.length > 1) {
    return {
      masked: out.join(""),
      unlexable: "reached end of file inside an unterminated template literal",
    };
  }
  return { masked: out.join(""), unlexable: "" };
}

/** Keywords after which a `/` opens a regex rather than dividing. */
const REGEX_PRECEDING_KEYWORDS = new Set([
  "return",
  "typeof",
  "instanceof",
  "in",
  "of",
  "case",
  "do",
  "else",
  "yield",
  "await",
  "new",
  "delete",
  "void",
  "throw",
]);

/**
 * Does a `/` at the end of this emitted prefix open a regex literal?
 *
 * The classic un-decidable-without-a-parser question, answered by the standard
 * previous-token heuristic. Two refinements this tree forced, both measured on
 * main rather than imagined:
 *
 *   * `return /^x/.test(s)` -- a bare last-character test says "d", a letter,
 *     and calls it division. The token must be read as a WORD and checked
 *     against the keyword set.
 *   * `h[i]! / h[j]!` -- TypeScript's non-null assertion puts `!` immediately
 *     before a division, and `!` is otherwise a textbook regex-start position
 *     (`!/x/.test(s)`). Disambiguated by what precedes the `!`.
 *
 * Both mis-parses were real: they made four files in src/Core.TypeScript
 * unlexable on the first run of this audit.
 */
function regexCanStartHere(out: readonly string[]): boolean {
  let k = out.length - 1;
  while (k >= 0 && /\s/.test(out[k] ?? "")) k--;
  if (k < 0) return true;
  const c = out[k] ?? "";
  if (c === ")" || c === "]") return false;
  if (c === "}") return true;
  if (c === '"' || c === "'" || c === "`" || c === "/") return false;
  if (c === "!") {
    // `x!` is TypeScript's non-null assertion and a value just ended, so the
    // `/` divides. `!x` is logical not and a value is about to start, so the
    // `/` opens a regex. Which one this is is exactly the same question one
    // token earlier, so ask it there: `return !/^\s*!/.test(s)` resolves
    // correctly only this way (the `!` follows the KEYWORD `return`).
    return regexCanStartHere(out.slice(0, k));
  }
  if (/[\w$]/.test(c)) {
    let j = k;
    while (j >= 0 && /[\w$]/.test(out[j] ?? "")) j--;
    const word = out.slice(j + 1, k + 1).join("");
    return REGEX_PRECEDING_KEYWORDS.has(word);
  }
  return true;
}

/** Index just past the closing `/` (and flags), or -1. */
function scanRegexLiteral(text: string, start: number): number {
  let i = start + 1;
  let inClass = false;
  while (i < text.length) {
    const c = text[i] ?? "";
    if (c === "\\") {
      i += 2;
      continue;
    }
    if (c === "\n") return -1;
    if (c === "[") inClass = true;
    else if (c === "]") inClass = false;
    else if (c === "/" && !inClass) {
      i++;
      while (i < text.length && /[a-z]/.test(text[i] ?? "")) i++;
      return i;
    }
    i++;
  }
  return -1;
}

// ═══════════════════════════════════════════════════════════════════════════
// CALL EXTRACTION
// ═══════════════════════════════════════════════════════════════════════════

export interface CallSite {
  /** Bare callee name -- any `fs.` / `nodeFs.` qualifier is dropped. */
  readonly api: string;
  /** Offset of the callee name in the source. */
  readonly index: number;
  /** Offset just past the call's closing paren. */
  readonly end: number;
  /** First argument, original text, whitespace removed. "" when absent. */
  readonly path: string;
  /** Full argument text, original, for `withFileTypes` inspection. */
  readonly args: string;
  /** 1-based line of `index`. */
  readonly line: number;
}

/**
 * The argument text of the call whose `(` is at `open`, from the ORIGINAL
 * text, by scanning the MASKED text for balance.
 *
 * Split like that on purpose: balance must ignore parens inside strings and
 * comments, and the argument's identity must not -- `existsSync("/etc/a")` and
 * `readFileSync("/etc/a")` are the same path and must pair, which they cannot
 * if the literal has been blanked.
 */
function sliceArgument(original: string, masked: string, open: number): { args: string; end: number } | null {
  let depth = 1;
  let i = open + 1;
  while (i < masked.length && depth > 0) {
    const c = masked[i];
    if (c === "(" || c === "[" || c === "{") depth++;
    else if (c === ")" || c === "]" || c === "}") depth--;
    i++;
  }
  if (depth !== 0) return null;
  return { args: original.slice(open + 1, i - 1), end: i };
}

/** First top-level argument, whitespace stripped. This is the path identity. */
export function firstArgument(args: string): string {
  let depth = 0;
  for (let i = 0; i < args.length; i++) {
    const c = args[i];
    if (c === "(" || c === "[" || c === "{") depth++;
    else if (c === ")" || c === "]" || c === "}") depth--;
    else if (c === "," && depth === 0) return args.slice(0, i).replace(/\s+/g, "");
  }
  return args.replace(/\s+/g, "");
}

/** Every call to a name in `names`, in source order. */
export function findCalls(original: string, masked: string, names: readonly string[]): readonly CallSite[] {
  const wanted = new Set(names);
  const out: CallSite[] = [];
  const re = /[A-Za-z_$][\w$]*/g;
  let m: RegExpExecArray | null = re.exec(masked);
  const lineIndex = buildLineIndex(masked);
  while (m !== null) {
    const name = m[0];
    const at = m.index;
    if (wanted.has(name)) {
      // Reject `foo.existsSync` only when the qualifier is NOT a plain
      // namespace -- in practice `fs.existsSync` is the same function, so a
      // dotted call is kept. What is rejected is a definition, which has no
      // `(` following in call position anyway.
      let j = at + name.length;
      while (j < masked.length && /\s/.test(masked[j] ?? "")) j++;
      if (masked[j] === "(") {
        const sliced = sliceArgument(original, masked, j);
        if (sliced !== null) {
          out.push({
            api: name,
            index: at,
            end: sliced.end,
            path: firstArgument(sliced.args),
            args: sliced.args,
            line: lineOf(lineIndex, at),
          });
        }
      }
    }
    m = re.exec(masked);
  }
  return out;
}

function buildLineIndex(text: string): readonly number[] {
  const starts: number[] = [0];
  for (let i = 0; i < text.length; i++) if (text[i] === "\n") starts.push(i + 1);
  return starts;
}

function lineOf(starts: readonly number[], offset: number): number {
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if ((starts[mid] ?? 0) <= offset) lo = mid;
    else hi = mid - 1;
  }
  return lo + 1;
}

/**
 * Offset at which the block lexically enclosing `from` ends.
 *
 * Scanning forward: a `{` we open is ours to close; the first `}` seen at
 * depth 0 closes the block we are inside. This is the scope within which a
 * check and a use are considered to be "the same place" -- deliberately
 * generous downward (a use nested deeper still pairs) and strict upward (a use
 * after our function ends does not).
 */
export function enclosingBlockEnd(masked: string, from: number): number {
  let depth = 0;
  for (let i = from; i < masked.length; i++) {
    const c = masked[i];
    if (c === "{") depth++;
    else if (c === "}") {
      if (depth === 0) return i;
      depth--;
    }
  }
  return masked.length;
}

/** Offset of the `{` opening the block that lexically encloses `from`, or -1. */
export function enclosingBlockStart(masked: string, from: number): number {
  let depth = 0;
  for (let i = from; i >= 0; i--) {
    const c = masked[i];
    if (c === "}") depth++;
    else if (c === "{") {
      if (depth === 0) return i;
      depth--;
    }
  }
  return -1;
}

/**
 * The scope a DIRECTORY LISTING is consumed in.
 *
 * `enclosingBlockEnd` alone is too tight here, and the miss was measured, not
 * imagined: lint-guards-are-reachable.ts's own walker reads
 * `try { entries = readdirSync(dir); } catch { return; }` and then iterates
 * `entries` AFTER the try. The innermost block ends at the `catch`, so the
 * stat that follows falls outside it and the exact shape of instance 1 goes
 * unseen. A `try` wrapper is a failure handler, not a scope boundary for this
 * question, so it is stepped over -- at most three levels, because an
 * unbounded widening would eventually scope the whole file and pair calls that
 * have nothing to do with each other.
 */
export function listingScopeEnd(masked: string, from: number): number {
  let end = enclosingBlockEnd(masked, from);
  for (let level = 0; level < 3; level++) {
    const open = enclosingBlockStart(masked, from);
    if (open < 0) break;
    // Bounded slice, deliberately: both this and the binding scan below run a
    // backtracking regex over UNTRUSTED source text, so the window is capped
    // rather than the whole file. Bounded input is the ReDoS mitigation.
    const before = masked.slice(Math.max(0, open - 60), open);
    if (!/(?:\btry|\bfinally|\bcatch\s*(?:\([^()]*\))?)\s*$/.test(before)) break;
    end = enclosingBlockEnd(masked, end + 1);
    from = end;
  }
  return end;
}

// ═══════════════════════════════════════════════════════════════════════════
// THE RULES
// ═══════════════════════════════════════════════════════════════════════════

const FIX_READ =
  "Delete the check and perform the operation, interpreting its failure: " +
  '`try { readFileSync(p, "utf8") } catch (e) { if ((e as NodeJS.ErrnoException).code === "ENOENT") ...; else throw e }`. ' +
  "One syscall, one answer, no window.";

const FIX_READDIR =
  "Pass `{ withFileTypes: true }` to readdirSync and branch on `entry.isDirectory()` / " +
  "`entry.isFile()` from the Dirent you already hold. The kind arrives with the listing, " +
  "so there is no second syscall to race against.";

/**
 * Is this call a genuine existence GATE (see EXISTENCE_CHECKS' doc comment)?
 *
 * `existsSync` always is. A stat qualifies in two forms, and the second one
 * matters more than it looks: `statSync(p).isDirectory()` is the inline shape,
 * but `const st = statSync(p); if (st.isDirectory())` is the SAME defect and
 * is what lint-guards-are-reachable.ts's own directory walker was written as.
 * Requiring the inline form would have made this audit blind to the shape that
 * produced instance 1.
 *
 * A stat that is NOT used for its kind -- `statSync(p).size`, `.mtimeMs` --
 * is a measurement, not a gate, and `withFileTypes` cannot supply it. Flagging
 * those would be the over-claim this file's header refuses.
 */
export function isExistenceGate(call: CallSite, masked: string, scopeEnd: number): boolean {
  if (call.api === "existsSync") return true;
  if (STAT_BRANCH_SUFFIX.test(masked.slice(call.end, call.end + 40))) return true;
  // The optional `: T` annotation may not span a newline, a brace, or a paren:
  // without those exclusions the leftmost match swallows a whole signature and
  // binds the wrong name (`function f(p: string): string { const st = ` binds
  // `p`, not `st`), which silently un-gates the stat.
  const bound = /(?:(?:const|let|var)\s+)?([A-Za-z_$][\w$]*)\s*(?::[^=;(){}\n]*)?=\s*$/.exec(
    masked.slice(Math.max(0, call.index - 120), call.index),
  );
  if (bound === null) return false;
  const name = bound[1] ?? "";
  const used = new RegExp(
    String.raw`\b` +
      escapeRegExp(name) +
      String.raw`\s*[!?]?\s*\.\s*(?:isFile|isDirectory|isSymbolicLink|isBlockDevice|isCharacterDevice|isFIFO|isSocket)\s*\(`,
  );
  return used.test(masked.slice(call.end, scopeEnd));
}

/** Lines carrying `toctou-ok:`, mapped to the stated reason (possibly ""). */
export function suppressions(original: string): ReadonlyMap<number, string> {
  const out = new Map<number, string>();
  const lines = original.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const m = /\/\/\s*toctou-ok:(.*)$/.exec(lines[i] ?? "");
    if (m) out.set(i + 1, (m[1] ?? "").trim());
  }
  return out;
}

/**
 * The whole audit for one file. Pure; no filesystem.
 */
export function analyzeSource(original: string, path: string): readonly Finding[] {
  const { masked, unlexable } = maskNonCode(original);
  if (unlexable !== "") {
    return [
      {
        rule: "unparsed",
        file: path,
        line: 1,
        signature: "unlexable",
        detail:
          "this file could not be lexed (" +
          unlexable +
          "), so it was NOT scanned for check-then-use races. A check that did not " +
          "run must never look like a check that passed, so an unscannable file is a " +
          "finding rather than a skip.",
        fix: "Fix the lexing hazard, or teach maskNonCode the construct it choked on.",
      },
    ];
  }

  const suppressed = suppressions(original);
  const findings: Finding[] = [];

  for (const [line, reason] of suppressed) {
    if (reason === "") {
      findings.push({
        rule: "empty-suppression",
        file: path,
        line,
        signature: "toctou-ok with no reason",
        detail:
          "`toctou-ok:` with no reason. A suppression whose justification is blank is " +
          "an allowlist entry, and an allowlist drifts from the thing it describes.",
        fix: "State why the race is acceptable here, on the same line, after the colon.",
      });
    }
  }

  const checks = findCalls(original, masked, EXISTENCE_CHECKS);
  const uses = findCalls(original, masked, GATED_USES);

  // RULE 1 -- an existence gate and a later use of the SAME path text, in the
  // block that encloses the gate.
  for (const check of checks) {
    if (check.path === "") continue;
    if (suppressed.has(check.line)) continue;
    const scopeEnd = enclosingBlockEnd(masked, check.end);
    if (!isExistenceGate(check, masked, scopeEnd)) continue;
    for (const use of uses) {
      if (use.index <= check.end || use.index >= scopeEnd) continue;
      if (use.path !== check.path) continue;
      findings.push({
        rule: "check-then-use",
        file: path,
        line: check.line,
        signature: check.api + "(" + check.path + ")->" + use.api + "(" + use.path + ")",
        detail:
          check.api +
          "(" +
          check.path +
          ") at line " +
          String(check.line) +
          " gates " +
          use.api +
          "(" +
          use.path +
          ") at line " +
          String(use.line) +
          ". Between the two the path can be created, deleted, or replaced, so the " +
          "answer the check returned is already stale when the use runs. The check " +
          "reads as defensive and prevents nothing.",
        fix: FIX_READ,
      });
    }
  }

  // RULE 3 -- `statSync(p)` paired with a read of the SAME path `p`, either order.
  //
  // THE COVERAGE GAP THIS CLOSES, measured 2026-08-27 against CodeQL's
  // `js/file-system-race` over the same tree: 22 files flagged there, 180 listed
  // in this baseline, and only **10 in common**. Twelve files CodeQL saw that this
  // linter structurally could not, and they were all one shape -- a `statSync`
  // beside a read of the same path. Rule 1 misses it because `statSync` is not an
  // existence GATE (there is no `if`), and rule 2 misses it because there is no
  // `readdirSync`. Neither detector was a superset of the other; this is the half
  // that was ours to fix.
  //
  // WHY IT IS A RACE AND NOT A STYLE NOTE. The two calls resolve the path
  // separately, so the metadata and the bytes can describe two different files.
  // Live instance: `observe/workspace-port.ts` reported one file's executable bit
  // alongside another file's content. Worse instance: `bus/claim.ts` read a lock's
  // holder PID and its mtime as separate resolutions, so stale-lock recovery could
  // unlink a lock that was very much alive.
  //
  // DELIBERATELY NARROW. Both calls must name the path with the SAME expression
  // text. A stat of `a` beside a read of `b` may still be a race, and proving it
  // needs alias analysis this linter does not have -- claiming that reach would
  // make the refusals unreliable, and an unreliable lint gets suppressed rather
  // than obeyed.
  for (const st of checks) {
    if (st.api !== "statSync" && st.api !== "lstatSync") continue;
    if (st.path === "" || suppressed.has(st.line)) continue;
    // An existence GATE is rule 1's business; this rule is about the ungated pairing.
    if (isExistenceGate(st, masked, masked.length)) continue;
    // A stat read purely for `.size` beside a read is NOT flagged, and that is a decision this
    // file already made — `a stat read for SIZE is a measurement, not a gate` is a pre-existing
    // test, and a first pass of this rule broke it. The prior judgement is right for adoption:
    // `statSync(p).size` next to `readFileSync(p)` is common and almost always benign, because
    // `readFileSync` returns the whole file regardless of the size read earlier. Flagging it would
    // make this lint noisy, and a noisy lint gets suppressed rather than obeyed — which costs more
    // than the rare case it would catch.
    //
    // What IS flagged is the pairing that bites: a stat whose result steers behaviour (a mode bit,
    // a kind) beside a read, and a stat beside a DESTRUCTIVE use. Both were live instances —
    // `observe/workspace-port.ts` reported one file's executable bit with another file's content,
    // and `bus/claim.ts` judged a lock stale and then unlinked whatever the path named next.
    const sizeOnly = /^\s*\)?\s*\.\s*size\b/.test(masked.slice(st.end, st.end + 24));
    // SAME SCOPE, not merely the same spelling. `full` is declared independently in several
    // functions of `observe/workspace-port.ts`, and a first pass of this rule happily paired a
    // `statSync(full)` in one with a `chmodSync(full)` in another — two different variables that
    // share a name. Those are not races and reporting them would be the unreliable-lint failure
    // this rule's own comment warns about, so the pairing is bounded to the enclosing block.
    const scopeEnd = listingScopeEnd(masked, st.end);
    const scopeStart = enclosingBlockStart(masked, st.index);
    for (const use of uses) {
      if (use.path !== st.path) continue;
      if (use.line === st.line) continue;
      if (suppressed.has(use.line)) continue;
      if (use.index < scopeStart || use.index > scopeEnd) continue;
      if (sizeOnly && !STAT_THEN_DESTRUCTIVE.has(use.api)) continue;
      const first = st.index < use.index ? st : use;
      const second = st.index < use.index ? use : st;
      findings.push({
        rule: "stat-then-use",
        file: path,
        line: first.line,
        signature: first.api + "(" + first.path + ")->" + second.api + "(" + second.path + ")",
        detail:
          first.api +
          "(" +
          first.path +
          ") at line " +
          String(first.line) +
          " and " +
          second.api +
          "(" +
          second.path +
          ") at line " +
          String(second.line) +
          " resolve the same path TWICE, so the metadata and the bytes can describe two " +
          "different files. Replace the file between them and one answer belongs to a file " +
          "the other answer never saw, with nothing reporting it.",
        fix:
          "Open once and ask the DESCRIPTOR: `const fd = openSync(p, \"r\"); try { " +
          "fstatSync(fd); readFileSync(fd); } finally { closeSync(fd); }`. One handle, one " +
          "inode, both answers, no window.",
      });
    }
  }

  // RULE 2 -- readdirSync without withFileTypes, then a stat of an entry.
  // Instance 1's shape, where the two calls never name the path identically
  // (`d` vs `join(d, name)`) so rule 1 structurally cannot see it.
  for (const rd of findCalls(original, masked, ["readdirSync"])) {
    if (rd.path === "" || rd.args.includes("withFileTypes")) continue;
    if (suppressed.has(rd.line)) continue;
    const scopeEnd = listingScopeEnd(masked, rd.end);
    const dir = rd.path;
    for (const st of checks) {
      if (st.api === "existsSync") continue;
      if (st.index <= rd.end || st.index >= scopeEnd) continue;
      if (!isExistenceGate(st, masked, scopeEnd)) continue;
      findings.push({
        rule: "readdir-then-stat",
        file: path,
        line: rd.line,
        signature: "readdirSync(" + dir + ")->" + st.api + "(" + st.path + ")",
        detail:
          "readdirSync(" +
          dir +
          ") at line " +
          String(rd.line) +
          " lists names, then " +
          st.api +
          "(" +
          st.path +
          ") at line " +
          String(st.line) +
          " asks the filesystem again what each one is. An entry can vanish or change " +
          "kind between the listing and the stat -- and the listing already knew.",
        fix: FIX_READDIR,
      });
      break;
    }
  }

  return findings;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}

// ═══════════════════════════════════════════════════════════════════════════
// I/O EDGE
// ═══════════════════════════════════════════════════════════════════════════

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "bin", "obj", "prior-art", "references", "coverage"]);

export interface LoadedFile {
  readonly path: string;
  readonly text: string;
  /** Non-empty when the file exists but could not be read. */
  readonly readError: string;
}

/**
 * Every scannable .ts under `root`.
 *
 * Written in the two forms this lint enforces, because a lint that violates
 * its own rule is the loudest possible argument for ignoring it:
 * `withFileTypes: true` instead of readdir-then-stat, and read-then-interpret
 * instead of exists-then-read. It is its own first fixture.
 */
export function loadTypeScriptFiles(root: string): readonly LoadedFile[] {
  const out: LoadedFile[] = [];
  const walk = (dir: string): void => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code;
      if (code === "ENOENT" || code === "ENOTDIR") return;
      out.push({ path: dir, text: "", readError: String(code ?? e) });
      return;
    }
    for (const entry of entries) {
      if (SKIP_DIRS.has(entry.name)) continue;
      const p = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(p);
        continue;
      }
      if (!entry.isFile()) continue;
      if (!entry.name.endsWith(".ts") || entry.name.endsWith(".d.ts")) continue;
      try {
        out.push({ path: p, text: readFileSync(p, "utf8"), readError: "" });
      } catch (e) {
        const code = (e as NodeJS.ErrnoException).code;
        // An unreadable file is NOT a skip. It is the check that did not run.
        out.push({ path: p, text: "", readError: String(code ?? e) });
      }
    }
  };
  walk(root);
  return out.sort((a, b) => comparePaths(a.path, b.path));
}

/** Ordinal, not `localeCompare` -- see .claude/rules/culture-invariant-by-default.md. */
function comparePaths(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

export function auditFiles(files: readonly LoadedFile[]): readonly Finding[] {
  const findings: Finding[] = [];
  for (const f of files) {
    if (f.readError !== "") {
      findings.push({
        rule: "unreadable",
        file: f.path,
        line: 1,
        signature: "unreadable",
        detail:
          "could not be read (" +
          f.readError +
          "), so it was not scanned. Reported rather than skipped: an audit that " +
          "silently passes over what it cannot open is indistinguishable from one " +
          "that found nothing.",
        fix: "Make the path readable, or exclude it deliberately and say so.",
      });
      continue;
    }
    findings.push(...analyzeSource(f.text, f.path));
  }
  return findings;
}

/** Baseline key. Line-free on purpose: an unrelated edit above must not thaw a row. */
export function baselineKey(f: Finding): string {
  return f.rule + " " + f.file + " " + f.signature;
}

export function main(argv: readonly string[]): number {
  const asJson = argv.includes("--json");
  const quiet = argv.includes("--quiet");
  const writeBaseline = argv.includes("--write-baseline");
  const baselineFlag = argv.indexOf("--baseline");
  const baselinePath = baselineFlag >= 0 ? argv[baselineFlag + 1] : undefined;
  const valueSlots = new Set<number>();
  for (const flag of ["--baseline", "--min-files"]) {
    const at = argv.indexOf(flag);
    if (at >= 0) valueSlots.add(at + 1);
  }
  const roots = argv.filter((a, i) => !a.startsWith("--") && !valueSlots.has(i));
  const searchRoots = roots.length > 0 ? [...roots] : ["src/Core.TypeScript"];

  const minFlag = argv.indexOf("--min-files");
  const minFiles = minFlag >= 0 ? Number(argv[minFlag + 1] ?? "1") : 1;

  const files = searchRoots.flatMap((r) => [...loadTypeScriptFiles(r)]);
  const all = [...auditFiles(files)];

  // SCAN FLOOR. An audit that inspected nothing must not report success -- a
  // mistyped root, a moved directory, or a walker that silently returns early
  // all look exactly like a clean tree from the exit code. This is the same
  // discipline audit-scan-floor-routes.ts enumerates, applied to this audit.
  if (files.length < minFiles) {
    all.push({
      rule: "scan-floor",
      file: searchRoots.join(", "),
      line: 1,
      signature: "scanned " + String(files.length) + " < " + String(minFiles),
      detail:
        "scanned " +
        String(files.length) +
        " file(s), below the floor of " +
        String(minFiles) +
        ". A check that inspected nothing is not a check that passed.",
      fix: "Point --min-files at a real floor, or fix the root that stopped producing files.",
    });
  }

  let grandfathered = new Set<string>();
  if (baselinePath !== undefined && !writeBaseline) {
    try {
      const parsed: unknown = JSON.parse(readFileSync(baselinePath, "utf8"));
      if (Array.isArray(parsed)) grandfathered = new Set(parsed.filter((x): x is string => typeof x === "string"));
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code;
      if (code !== "ENOENT") throw e;
    }
  }
  const findings = all.filter((f) => !grandfathered.has(baselineKey(f)));

  if (writeBaseline && baselinePath !== undefined) {
    // writeFileSync, not Bun.write: main() is synchronous and returns an exit
    // code, so an un-awaited async write would let a caller read the baseline
    // back before it exists -- a check-then-use race in the tool that exists
    // to refuse check-then-use races.
    writeFileSync(baselinePath, JSON.stringify([...new Set(all.map(baselineKey))].sort(), null, 2) + "\n", "utf8");
  }

  // ONE exit expression, computed before any reporting. An earlier draft had
  // `if (quiet) return ...` above the printing and a second `return ...` below
  // it; the tests take the quiet path and CI takes the loud one, so a mutation
  // that made the loud path always return 0 SURVIVED the whole suite. Two
  // returns meant the tested path was not the shipped path.
  const exitCode = findings.length > 0 ? 1 : 0;
  if (quiet) return exitCode;

  if (asJson) {
    process.stdout.write(
      JSON.stringify({ scanned: files.length, grandfathered: grandfathered.size, findings }, null, 2) + "\n",
    );
  } else {
    process.stdout.write(
      "lint-check-then-use-file-races: scanned " +
        String(files.length) +
        " TypeScript file(s) under " +
        searchRoots.join(", ") +
        (grandfathered.size > 0 ? " (" + String(grandfathered.size) + " grandfathered)" : "") +
        "\n",
    );
    for (const f of findings) {
      process.stdout.write(
        "  [" +
          f.rule +
          "] " +
          f.file +
          ":" +
          String(f.line) +
          "\n" +
          "    " +
          f.detail +
          "\n" +
          "    FIX: " +
          f.fix +
          "\n",
      );
    }
    process.stdout.write(
      findings.length === 0
        ? "  no check-then-use filesystem races found\n"
        : "  " + String(findings.length) + " finding(s)\n",
    );
  }
  return exitCode;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
