#!/usr/bin/env bun
// check-md032-blanks-around-lists.ts — pre-CI catch for MD032 violations.
//
// MD032 (markdownlint rule): "Lists should be surrounded by blank lines."
// Common failure mode in tick shards: a label sentence ending with `:`
// is immediately followed by a list item with no blank line between.
//
// Example (BAD — fires MD032):
//
//   Each row:
//   - id: updated
//   - title: updated
//
// Example (GOOD):
//
//   Each row:
//
//   - id: updated
//   - title: updated
//
// This helper catches the same pattern that markdownlint catches but
// runs locally (faster feedback) and pre-push (before the CI cycle).
//
// Scope: detects the most common pattern — a non-blank, non-list line
// immediately followed by a list item (`- `, `+ `, `* `, or `1. ` style).
// Markdownlint catches more variants; this is the minimal helper that
// catches the 5 recurring failures from the 2026-05-13/14 session.
//
// Exit codes:
//   0 — no findings (or no files processed)
//   1 — findings present; emits `file:line` for each
//
// CLI usage:
//   bun src/Core.TypeScript/hygiene/check-md032-blanks-around-lists.ts <file1> <file2> ...
//   bun src/Core.TypeScript/hygiene/check-md032-blanks-around-lists.ts --staged
//
// 081KRHWGX0008QG0R000JEBCWZ — see docs/backlog/P2/081KRHWGX0008QG0R000JEBCWZ-mechanize-md032-blanks-around-lists-pre-commit-2026-05-14.md

import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve, relative } from "node:path";

export type Md032Finding = {
  file: string;
  line: number; // 1-indexed line where the list starts (after the bad break)
  context: string; // the first 60 chars of the offending list line
};

/**
 * Detect whether a line is a list-item start.
 *
 * Matches the three unordered-list markers (`-`, `+`, `*`) and both
 * ordered-list punctuation forms (`1.` and `1)`, plus multi-digit
 * variants like `12.` / `12)`), each followed by at least one space.
 * CommonMark + markdownlint treat both `1.` and `1)` as ordered-list
 * markers; omitting `1)` lets a `Label:` followed by `1) item` pass
 * locally while still firing MD032 in CI (pre-CI review P1 on PR
 * #3075 round 6).
 *
 * CommonMark allows list markers indented 0-3 spaces; 4+ spaces is
 * treated as indented code, not a list — `[ ]{0,3}` enforces that
 * boundary so a code block line like `    - option` isn't falsely
 * flagged as a list start (pre-CI review P1 on PR #3075 round 1).
 */
function isListItemStart(line: string): boolean {
  // CommonMark caps ordered-list markers at 9 digits (`{1,9}`); a
  // longer numeric prefix like `1234567890. value` is not an
  // ordered-list item per the spec — markdownlint will not flag MD032
  // on a label preceding it, so neither should this helper (pre-CI
  // review P1 on PR #3075 round 8).
  //
  // Optional leading blockquote prefixes (`>` and `> >`...) are
  // accepted so a list inside a blockquote (e.g. `> - item` or
  // `> > 1) nested`) is still recognised as a list-item start.
  // markdownlint MD032 enforces blanks around lists even inside
  // blockquotes (pre-CI review P1 on PR #3075 round 9).
  // Blockquote-prefix matching: each `>` marker has at most ONE
  // optional space immediately after it (per CommonMark spec on
  // blockquote markers). Additional spaces before the list marker
  // are counted toward the list-item indent which is CAPPED at 0-3
  // (4+ is indented code, not a list — same rule as the top-level
  // case). Earlier rounds allowed unbounded post-`>` whitespace and
  // would treat `>     - item` (5+ spaces, indented code inside the
  // quote) as a list (pre-CI review P1 on PR #3075 round 16).
  // Two-branch indent: when there's no blockquote prefix, allow up
  // to 3 leading spaces (the standard list-item indent cap). When
  // there IS a blockquote prefix (`(>[ \t]?)+`), allow 0-3 leading
  // spaces BEFORE the prefix AND 0-3 spaces AFTER (the list-item
  // indent cap inside the blockquote sub-context). Making the
  // blockquote-chain optional keeps the 0-3 total cap for the
  // non-blockquote case — a 4-space-indented `    - option` is
  // indented code, not a list (pre-CI review P1 on PR #3075 round 16
  // refining round 14's accidental combined-indent permissiveness).
  // The marker may be followed by `\s+` (marker + spaces + content)
  // OR by end-of-line (`\s*$` — bare marker, empty list item, also
  // valid per CommonMark). Without the EOL alternative, a label
  // directly followed by an empty list item (`Label:\n-`) would not
  // fire MD032 locally while markdownlint still reports it (pre-CI
  // review P1 on PR #3075 round 18).
  return /^ {0,3}(?:(?:>[ \t]?)+ {0,3})?([-+*]|\d{1,9}[.)])(\s+|\s*$)/.test(line);
}

/**
 * A line is "blank" if it contains only whitespace, OR if it is a
 * blockquoted blank line — a line whose only non-whitespace content
 * is `>` markers (e.g., `>`, `> `, `>>`). Markdownlint treats such
 * lines as the blockquote-equivalent of a blank line, so a list
 * inside a blockquote can be properly preceded by a `>`-only line
 * without firing MD032 (pre-CI review P1 on PR #3075 round 9).
 */
function isBlank(line: string): boolean {
  // A blockquoted blank may have arbitrary whitespace after each `>`
  // (e.g., `>   ` is still a blockquoted blank). The earlier `>\s?`
  // only allowed 0-1 space; lines like `>   ` were treated as
  // non-blank and could cause false MD032 on a blockquoted list
  // that's properly separated (pre-CI review P1 on PR #3075 round 14).
  return /^\s*$/.test(line) || /^ {0,3}(>[ \t]*)+$/.test(line);
}

/**
 * ATX heading detection (`#` through `######` followed by a space).
 * Optional leading blockquote markers are accepted so a heading
 * inside a blockquote (`> ## title`) is still recognised.
 *
 * Headings are list-block terminators per CommonMark: a heading
 * between two bullet lists splits them into separate lists, and
 * MD032 fires on the second list (pre-CI review P1 on PR #3075
 * round 12).
 */
function isHeading(line: string): boolean {
  // The heading line may have content (`# Foo`, `\s+` after) OR be
  // empty (`#` alone at end-of-line). An empty ATX heading is valid
  // per CommonMark; a list directly followed by an empty heading
  // should still terminate the list and trigger after-list MD032
  // (pre-CI review P1 on PR #3075 round 18).
  return /^ {0,3}(?:(?:>[ \t]?)+ {0,3})?#{1,6}(\s+|\s*$)/.test(line);
}

/**
 * CommonMark thematic break: a line containing only 3+ matching
 * `-`/`*`/`_` characters with optional spaces (indented up to 3
 * spaces). Thematic breaks are list-block terminators per
 * CommonMark — `- a / --- / - b` is a list, a thematic break, then
 * a NEW list (pre-CI review P1 on PR #3075 round 15).
 *
 * Note: `---` is parsed as a thematic break, not as a list item,
 * because `isListItemStart` requires trailing whitespace + content
 * (the marker must be followed by a list-item body).
 */
function isThematicBreak(line: string): boolean {
  // Strip optional leading blockquote prefix so `> ---` is also
  // recognised as a thematic break inside a blockquote — markdownlint
  // MD032 fires on the blockquoted list it terminates (pre-CI review
  // P1 on PR #3075 round 18).
  const stripped = line.replace(/^ {0,3}(?:(?:>[ \t]?)+ {0,3})?/, "");
  return /^(\*[ \t]*){3,}$/.test(stripped)
    || /^(-[ \t]*){3,}$/.test(stripped)
    || /^(_[ \t]*){3,}$/.test(stripped);
}

/**
 * Detect a line that starts a blockquote (any line whose first
 * non-whitespace char is `>`). Used to terminate a TOP-LEVEL list
 * when a blockquote appears after it. A blockquote-prefixed line
 * that itself opens a blockquoted list-item / heading / fence /
 * blank is handled by the respective specific check before this
 * one fires (pre-CI review P1 on PR #3075 round 15).
 */
function isBlockquoteLine(line: string): boolean {
  // Match top-level blockquote only — indent 0-1 spaces. CommonMark
  // allows 0-3 leading spaces for top-level block starts in general,
  // but list-item continuation indent is typically 2 spaces (for
  // `- item` or `* item`), so a `>` at 2-3 leading spaces is usually
  // a child block inside the enclosing list-item body. The 0-1 cap
  // is the practical heuristic that distinguishes the two:
  //
  //   - top bullet
  //     > 2-space-indented quote (CHILD: list continues)
  //   - sibling bullet
  //
  //   - top bullet
  //    > 1-space-indented quote (TOP-LEVEL: terminates list)
  //   - new list
  //
  // The earlier `^ {0,3}>` matched both cases as top-level and
  // produced false positives on real content (PR #3075 0645Z.md
  // follow-up); the earlier post-fix `^>` matched neither indent
  // case and regressed Copilot's `- a / ` `> quote` (one-space-
  // indented top-level) case. `^ {0,1}>` is the calibration that
  // matches Copilot + Codex round-20 input shapes.
  return /^ {0,1}>/.test(line);
}

/**
 * A line is "list-friendly leading" if it can come right before a list
 * without an intervening blank. Two valid cases:
 *
 * 1. Already a list-item line (the prior bullet — sibling/nested list).
 * 2. An indented continuation of a list item — BUT ONLY when we are
 *    already confirmed to be inside a list block (`inList === true`).
 *    Without the `inList` guard, ordinary prose indented 1–3 spaces
 *    (which CommonMark permits) would be treated as list continuation
 *    and suppress a real MD032 violation (pre-CI review P1 on PR #3075
 *    round 2).
 *
 * Note: ATX headings are intentionally NOT list-friendly. markdownlint's
 * blanks-around-lists check requires a blank line before a list even
 * when the preceding line is a heading — treating headings as exempt
 * produces false negatives in CI (pre-CI review P1 on PR #3075 round 2).
 */
function isListFriendlyLeading(line: string, inList: boolean): boolean {
  // Already a list item — nested or sibling list, both fine.
  if (isListItemStart(line)) return true;
  // Indented continuation of a list-item body — only suppress if we are
  // already inside an established list block so that arbitrary indented
  // prose lines do not get a free pass.
  if (inList && /^\s+\S/.test(line)) return true;
  return false;
}

/**
 * Parse a fenced-code-block delimiter (`\`\`\`` or `~~~`), returning
 * the fence character, run length, and whether the line could close
 * an open fence. The token must be on its own line (indented up to 3
 * spaces per CommonMark) and the run must be 3+ chars.
 *
 * `closer === true` when the line has only whitespace after the run.
 * Per CommonMark, an opening fence may carry an info string (e.g.,
 * ` ```ts `), but a closing fence cannot. Treating every fence line
 * as a potential closer would let an inner same-delimiter info-string
 * line (a code-sample example) terminate the outer block prematurely
 * and falsely flag the list-like lines that follow inside the outer
 * block as MD032 violations (pre-CI review P1 on PR #3075 round 4).
 *
 * Tracking the (char, len) pair — not just a boolean — is what lets a
 * fenced block containing an inner fence example with a *different*
 * delimiter or *shorter* run keep the outer block open (pre-CI review
 * P2 on PR #3075 round 2).
 */
function fenceInfo(line: string): { char: "`" | "~"; len: number; closer: boolean } | null {
  // Optional leading blockquote markers (`> `, `> > `) so a fenced
  // block INSIDE a blockquote is recognised. Without this, a sample
  // like `> \`\`\`` containing `> - item` would be reported as MD032
  // even though markdownlint treats it as fenced code (pre-CI review
  // P1 on PR #3075 round 12).
  // Same blockquote-prefix structure as `isListItemStart`: optional
  // blockquote chain (each `>` with 0-1 space) followed by 0-3 spaces
  // of content indentation, then the fence run. Without the inner
  // indent slot, `>  \`\`\`` (a fence-opener in a blockquote whose
  // content is indented 1-2 spaces) was not recognised, and the
  // helper treated inner `> - item` lines as real lists (pre-CI
  // review P2 on PR #3075 round 17 refining the round-12 blockquote-
  // fence support).
  const m = line.match(/^ {0,3}(?:(?:>[ \t]?)+ {0,3})?(`{3,}|~{3,})(.*)$/);
  if (!m) return null;
  const run = m[1] ?? "";
  const tail = m[2] ?? "";
  const char: "`" | "~" = run[0] === "`" ? "`" : "~";
  // CommonMark: a BACKTICK-fence opener's info string must not contain
  // a backtick (otherwise the inline-code grammar takes over and the
  // line is not a fence). A TILDE-fence opener's info string CAN
  // contain tildes — only the backtick variant has the restriction.
  // Treating ` ```ts`extra ` as a fence would suppress real MD032
  // findings in ordinary prose; rejecting `~~~text~bad` as a fence
  // would falsely flag list-like content inside a valid tilde-fenced
  // block (pre-CI review P1 on PR #3075 round 8 + round 10
  // refinement).
  if (char === "`" && tail.includes("`")) return null;
  return {
    char,
    len: run.length,
    closer: /^\s*$/.test(tail),
  };
}

export function findMd032Violations(content: string): { line: number; context: string }[] {
  const lines = content.split(/\r?\n/);
  const findings: { line: number; context: string }[] = [];
  // Track fenced-code-block state so list-like lines INSIDE code samples
  // (e.g., a documentation example showing a bad MD032 pattern) aren't
  // flagged. The state remembers the opening delimiter (char + length)
  // so a nested inner fence with a different char or shorter run can't
  // close the outer block (pre-CI review P2 on PR #3075 round 2).
  // Track HTML comment state. Markdownlint ignores list-like content
  // inside `<!-- ... -->` blocks (including `markdownlint-disable` /
  // `markdownlint-enable` comments). The earlier algorithm scanned
  // every non-fence line and could flag commented-out examples as
  // real MD032 violations (pre-CI review P2 on PR #3075 round 19).
  //
  // Conservative model: a line is treated as inside-comment when an
  // unclosed `<!--` has been seen and not yet closed by `-->`. Lines
  // that contain `<!--` on the same line as `-->` (inline comments)
  // are skipped entirely for MD032 purposes — partial-line markdown
  // around an inline comment is rare and not worth the extra
  // complexity.
  let inHtmlComment = false;
  let openFence: { char: "`" | "~"; len: number } | null = null;
  // Track whether we are inside a list block AND whether that list is
  // top-level (no blockquote prefix) or blockquoted. The distinction
  // matters at block-transition boundaries: a top-level list is
  // terminated by a blockquote line, while a blockquoted list is
  // CONTINUED by a `>` line (pre-CI review P1 on PR #3075 round 15;
  // refines the round-2 boolean inList).
  //
  //   false  — not in a list
  //   "top"  — in a top-level list (no `>` prefix on the list-item)
  //   "block" — in a blockquoted list (list-item had `>` prefix)
  let inList: false | "top" | "block" = false;

  // Determine the start-of-content cursor, skipping YAML front matter if
  // present. Markdownlint treats the YAML block between leading `---`
  // fences as metadata, NOT as Markdown content — list-like keys (e.g.,
  // `tags:` followed by `- item`) inside front matter must not fire
  // MD032 locally (pre-CI review P2 on PR #3075 round 7).
  let startLine = 0;
  if (lines[0] === "---") {
    let j = 1;
    while (j < lines.length && lines[j] !== "---") j++;
    if (j < lines.length) {
      // Closing `---` found; skip everything through it.
      startLine = j + 1;
    }
    // No closing fence → not a real front matter block; fall back to
    // scanning the whole file from line 0.
  }

  // Start at startLine so a fenced-code open on the first content line
  // is still recorded; the original i=1 start (back when no front-matter
  // skip existed) caused the fence-state to be wrong for files whose
  // first line was a fence marker (pre-CI review P1 on PR #3075 round 2).
  for (let i = startLine; i < lines.length; i++) {
    const cur = lines[i] ?? "";

    // Update HTML-comment state BEFORE every other check. A line that
    // begins inside a comment (or contains `<!--` without a matching
    // `-->` on the same line) is treated as comment content for MD032
    // purposes (pre-CI review P2 on PR #3075 round 19).
    if (inHtmlComment) {
      if (cur.includes("-->")) inHtmlComment = false;
      continue;
    }
    const openIdx = cur.indexOf("<!--");
    if (openIdx !== -1) {
      const closeAfter = cur.indexOf("-->", openIdx + 4);
      if (closeAfter === -1) inHtmlComment = true;
      continue;
    }

    // Update fence state BEFORE the list-start check so a fence line
    // itself never registers as a list-start candidate.
    const fence = fenceInfo(cur);
    if (fence !== null) {
      if (openFence === null) {
        // Opening a new fence. Info string permitted on opener.
        //
        // An INDENTED fence (1+ leading space) is a child block
        // inside the current list-item body — keep `inList` so a
        // sibling bullet that follows isn't false-flagged as a new
        // list.
        //
        // A FLUSH-LEFT fence (zero leading space) is a top-level
        // block that terminates the prior list per CommonMark —
        // reset `inList` so a list-start that follows fires MD032
        // correctly (pre-CI review P1 on PR #3075 round 12).
        //
        // A BLOCKQUOTED fence (`> \`\`\``) is ALSO treated as a
        // top-level block boundary — the blockquote opens a new
        // block context, which terminates an enclosing top-level
        // list (pre-CI review P1 on PR #3075 round 14).
        if (!/^[ \t]/.test(cur)) {
          // Also fire MD032 here if the list above wasn't blank-
          // separated (the after-list side, pre-CI review P1 on
          // PR #3075 round 16).
          if (inList !== false && i > 0) {
            const prev = lines[i - 1] ?? "";
            if (!isBlank(prev)) {
              findings.push({ line: i + 1, context: cur.slice(0, 60) });
            }
          }
          inList = false;
        }
        openFence = { char: fence.char, len: fence.len };
        continue;
      }
      // We're inside an open fence. Closing requires:
      // - matching delimiter char
      // - run length >= opener's
      // - no info string / trailing text (closer === true)
      // Otherwise the fence-like line is still inside the code block
      // (an inner same-delim opener with info string, or different
      // delimiter / shorter run) and the outer block stays open.
      if (
        fence.char === openFence.char &&
        fence.len >= openFence.len &&
        fence.closer
      ) {
        openFence = null;
        // Keep `inList` across the close — the open already set the
        // correct list-context state.
      }
      // else: still inside the code block — list state irrelevant.
      continue;
    }
    if (openFence !== null) continue;

    if (isBlank(cur)) {
      inList = false;
      continue;
    }

    if (isHeading(cur)) {
      // ATX heading terminates the prior list per CommonMark. A list
      // immediately after the heading is conceptually a new list; MD032
      // requires a blank line between heading and list (round-2 fix +
      // round-12 round-out: when a heading appears BETWEEN two bullet
      // lists, the second bullet was being treated as a continuation
      // of the first list — false negative; resetting inList here
      // makes the second bullet a new-list candidate so its predecessor
      // triggers MD032 — pre-CI review P1 on PR #3075 round 12).
      //
      // The other MD032 side: when a heading appears DIRECTLY after a
      // list-item (no blank in between), the LIST itself is also not
      // surrounded by blank lines. Fire MD032 at the heading's line
      // (pre-CI review P1 on PR #3075 round 16 — the after-list side
      // of MD032 that was previously missing).
      if (inList !== false && i > 0) {
        const prev = lines[i - 1] ?? "";
        if (!isBlank(prev)) {
          findings.push({ line: i + 1, context: cur.slice(0, 60) });
        }
      }
      inList = false;
      continue;
    }

    if (isListItemStart(cur)) {
      // Only check the predecessor when ENTERING a new list. When
      // `inList` is already non-false, this list-item is a sibling/
      // nested member of the same list and the previous line (a
      // sibling item or a lazy-continuation of the previous item's
      // paragraph) is not subject to MD032 (pre-CI review P1 on
      // PR #3075 round 8).
      if (inList === false && i > startLine) {
        // The `i > startLine` guard (rather than `i > 0`) means a list
        // immediately after a YAML front-matter block is treated as
        // start-of-content, not as missing-blank-line.
        const prev = lines[i - 1] ?? "";
        if (!isBlank(prev) && !isListFriendlyLeading(prev, false)) {
          findings.push({
            line: i + 1, // 1-indexed
            context: cur.slice(0, 60),
          });
        }
      }
      // Classify the new (or continuing) list by its blockquote prefix.
      // The first list-item in a list determines whether it's "top"
      // or "block"; subsequent items inherit that classification (a
      // mixed `- top / > - block` sequence is rare and handled by the
      // block-transition reset below, not by re-classifying mid-list).
      inList = /^ {0,3}>/.test(cur) ? "block" : "top";
    } else if (isThematicBreak(cur)) {
      // Thematic break (`---`, `***`, `___`) terminates any list per
      // CommonMark (round 15). Also fire MD032 at this line if the
      // list above wasn't blank-separated (after-list side, round 16).
      if (inList !== false && i > 0) {
        const prev = lines[i - 1] ?? "";
        if (!isBlank(prev)) {
          findings.push({ line: i + 1, context: cur.slice(0, 60) });
        }
      }
      inList = false;
    } else if (isBlockquoteLine(cur) && inList === "top") {
      // A blockquote line after a TOP-LEVEL list terminates it
      // (round 15). Fire MD032 if the list above wasn't blank-
      // separated (after-list side, round 16).
      if (i > 0) {
        const prev = lines[i - 1] ?? "";
        if (!isBlank(prev)) {
          findings.push({ line: i + 1, context: cur.slice(0, 60) });
        }
      }
      inList = false;
    } else {
      // Other non-list, non-blank, non-heading, non-fence,
      // non-thematic-break lines (including lazy unindented
      // paragraph continuations of a list item). CommonMark allows
      // these to span multiple lines without ending the list block,
      // so we leave `inList` unchanged (pre-CI review P1 on PR
      // #3075 round 8).
    }
  }
  return findings;
}

/**
 * Walk a list of WORKING-TREE files; collect MD032 findings.
 *
 * `--staged` mode does NOT go through this function — round-13
 * moved staged-blob reads to `checkStagedFiles` (which uses
 * `git show :path` and fails loud on read errors via round-14).
 * This function is the explicit-CLI / direct-filesystem path.
 *
 * @param files - Paths to scan on the filesystem.
 * @param surfaceReadErrors - When true (the only mode `main()` uses
 *   for explicit CLI args), unreadable files throw so a typo doesn't
 *   exit 0 with "no findings." The `surfaceReadErrors = false` branch
 *   is kept for backwards-compat with callers that want the
 *   pre-round-13 silent-skip semantics, but no longer used by
 *   `main()` (pre-CI review P1 on PR #3075 round 18 docstring
 *   refresh).
 */
export function checkFiles(files: string[], surfaceReadErrors = false): Md032Finding[] {
  const all: Md032Finding[] = [];
  for (const f of files) {
    let content: string;
    try {
      content = readFileSync(f, "utf-8");
    } catch (e) {
      if (surfaceReadErrors) {
        throw Object.assign(
          new Error(`Cannot read '${f}': ${(e as NodeJS.ErrnoException).message ?? String(e)}`),
          { cause: e },
        );
      }
      continue; // silent-skip path (no longer used by main() since round 13)
    }
    const findings = findMd032Violations(content);
    for (const finding of findings) {
      all.push({
        file: f,
        line: finding.line,
        context: finding.context,
      });
    }
  }
  return all;
}

/**
 * Convert a markdownlint-cli2 `ignores` glob into an anchored regex.
 *
 * Supported syntax (matches the subset used in `.markdownlint-cli2.jsonc`):
 *
 * - `**` — any number of path segments, including the following `/`
 *   (so `memory/**` matches `memory/anything/deep`)
 * - `*` — any sequence of non-`/` characters (one segment)
 * - `?` — any single non-`/` character
 * - Everything else is matched literally (with regex specials escaped).
 */
export function globToRegex(glob: string): RegExp {
  let re = "^";
  let i = 0;
  while (i < glob.length) {
    const c = glob[i] ?? "";
    if (c === "*" && glob[i + 1] === "*") {
      re += ".*";
      i += 2;
      if (glob[i] === "/") i++;
    } else if (c === "*") {
      re += "[^/]*";
      i++;
    } else if (c === "?") {
      re += "[^/]";
      i++;
    } else if (".+^$|()[]{}\\".includes(c)) {
      re += "\\" + c;
      i++;
    } else {
      re += c;
      i++;
    }
  }
  re += "$";
  return new RegExp(re);
}

/**
 * Read `ignores` from `.markdownlint-cli2.jsonc` (JSONC with line
 * comments). Returns `[]` when the file is absent or unparseable —
 * a missing config is not a gate failure; CI will surface a real
 * misconfiguration on its own.
 */
export function loadMarkdownlintIgnores(repoRoot: string): string[] {
  const cfg = `${repoRoot}/.markdownlint-cli2.jsonc`;
  let raw: string;
  try {
    raw = readFileSync(cfg, "utf-8");
  } catch {
    return [];
  }
  // Strip `// ...` line comments. The config does not use `/* ... */`
  // block comments today; if that ever changes, extend here.
  const stripped = raw.replace(/\/\/[^\n]*/g, "");
  try {
    const json = JSON.parse(stripped) as { ignores?: unknown };
    if (Array.isArray(json.ignores)) {
      return json.ignores.filter((g): g is string => typeof g === "string");
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Collect staged `.md` files via `git diff --name-only --cached`.
 *
 * Throws if the git command fails so the caller can exit non-zero
 * instead of silently scanning zero files (pre-CI review P1 on
 * PR #3075 round 2). Includes renames (`R`) so `git mv old.md new.md`
 * with edits is still scanned — markdownlint will lint `new.md` in
 * CI regardless (pre-CI review P2 on PR #3075 round 3).
 *
 * Applies the markdownlint-cli2 `ignores` list so paths under
 * `memory/**`, `docs/pr-preservation/**`, `docs/history/pr-reviews/**`,
 * the date-prefixed `docs/research/2026-*-*.md`, etc., are NOT scanned
 * locally — those are verbatim / archive surfaces that CI itself
 * ignores, so a pre-push gate that flagged them would diverge from
 * CI behavior (pre-CI review P1 on PR #3075 round 6).
 */
export function stagedMarkdownFiles(repoRoot: string): string[] {
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- git invoked as explicit args array; no shell, no user input on the command line.
  const r = spawnSync(
    "git",
    ["-C", repoRoot, "diff", "--name-only", "--cached", "--diff-filter=AMR"],
    { encoding: "utf-8" },
  );
  if (r.status !== 0 || r.error) {
    // `spawnSync` returns `r.error` when the process couldn't be
    // launched at all (e.g., `git` not on PATH, EACCES) — in that case
    // `r.status` is null and `r.stderr` is typically empty. Surfacing
    // `r.error.message` makes the failure diagnosable instead of just
    // "unknown error" (pre-CI review P2 on PR #3075 round 8).
    const reason =
      r.error?.message ??
      (r.stderr ? r.stderr.trim() : "") ??
      "unknown error";
    throw new Error(`git diff --cached failed: ${reason || "unknown error"}`);
  }
  const ignoreRes = loadMarkdownlintIgnores(repoRoot).map(globToRegex);
  return (r.stdout ?? "")
    .split("\n")
    .filter((line) => line.endsWith(".md"))
    .filter((line) => !ignoreRes.some((re) => re.test(line)))
    .map((line) => `${repoRoot}/${line}`);
}

/**
 * Read the STAGED blob content for a given repo-relative path via
 * `git show :path`. The `:path` refspec returns the version in the
 * index (what `git commit` will record + what CI will lint), not the
 * working-tree copy.
 *
 * Without this, `--staged` mode would scan the working-tree copy of
 * each staged path. If a user stages a file, then edits it again
 * before pushing, the gate could pass/fail on content different from
 * what CI sees (pre-CI review P1 on PR #3075 round 13).
 *
 * Throws on git failure so the caller can fail loudly.
 */
export function readStagedBlob(repoRoot: string, repoRelPath: string): string {
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- git invoked as explicit args array; no shell, no user input on the command line.
  const r = spawnSync(
    "git",
    ["-C", repoRoot, "show", `:${repoRelPath}`],
    { encoding: "utf-8" },
  );
  if (r.status !== 0 || r.error) {
    const reason =
      r.error?.message ??
      (r.stderr ? r.stderr.trim() : "") ??
      "unknown error";
    throw new Error(
      `git show :${repoRelPath} failed: ${reason || "unknown error"}`,
    );
  }
  return r.stdout ?? "";
}

/**
 * Scan staged Markdown files using their STAGED blob content (the
 * version `git commit` will record), not the working-tree copy.
 * Composes `stagedMarkdownFiles` (path discovery + ignore-glob
 * filtering) with `readStagedBlob` (content read from the index).
 *
 * Returns the same `Md032Finding[]` shape as `checkFiles` for a
 * single output channel in `main()`. The reported `file` field is
 * the absolute path for diagnostic display; the content scanned IS
 * the staged blob (pre-CI review P1 on PR #3075 round 13).
 */
export function checkStagedFiles(
  repoRoot: string,
  paths?: string[],
): Md032Finding[] {
  // Allow the caller to pass in the discovered staged-path list to
  // avoid running `git diff --name-only --cached` twice in one
  // invocation. When omitted, `stagedMarkdownFiles` is called here
  // (kept for callers that just want a one-shot run). Passing the
  // pre-discovered list also avoids `fileCount` divergence if the
  // index changes between the two calls (pre-CI review P2 on PR
  // #3075 round 16).
  const targets = paths ?? stagedMarkdownFiles(repoRoot);
  const all: Md032Finding[] = [];
  for (const absPath of targets) {
    const repoRel = absPath.startsWith(`${repoRoot}/`)
      ? absPath.slice(repoRoot.length + 1)
      : absPath;
    // `git show :path` failing AFTER `git diff --cached` listed the
    // path is a genuine git/index anomaly — the path is staged for
    // commit but unreadable from the index. Silent-skip would let
    // the local gate diverge from CI; instead, `readStagedBlob`
    // throws and we propagate (caller exits non-zero). This refines
    // the round-2 "silent skip" discipline, which was about
    // working-tree filesystem reads — staged-blob reads are a
    // different I/O class (pre-CI review P1 on PR #3075 round 14).
    const content = readStagedBlob(repoRoot, repoRel);
    for (const v of findMd032Violations(content)) {
      all.push({ file: absPath, line: v.line, context: v.context });
    }
  }
  return all;
}

export function main(): number {
  const repoRoot = resolve(import.meta.dir, "..", "..", "..");
  const argv = process.argv.slice(2);
  const isStaged = argv.includes("--staged");

  let findings: Md032Finding[];
  let fileCount: number;

  if (isStaged) {
    // `--staged` reads the index (staged blobs) — what CI will lint —
    // not the working-tree copy, so an edit-after-stage doesn't make
    // this gate diverge from CI (pre-CI review P1 on PR #3075 round 13).
    try {
      const paths = stagedMarkdownFiles(repoRoot);
      if (paths.length === 0) {
        console.log("check-md032: no staged .md files");
        return 0;
      }
      fileCount = paths.length;
      // Pass the discovered paths through to avoid a second
      // `git diff --name-only --cached` invocation + any divergence
      // if the index changes between the two calls (pre-CI review
      // P2 on PR #3075 round 16).
      findings = checkStagedFiles(repoRoot, paths);
    } catch (e) {
      console.error(`check-md032: ${(e as Error).message}`);
      return 1;
    }
  } else if (argv.length === 0) {
    console.error(
      "Usage: check-md032-blanks-around-lists.ts <file1> <file2> ... | --staged",
    );
    return 1;
  } else {
    const files = argv.map((f) => (f.startsWith("/") ? f : resolve(f)));
    fileCount = files.length;
    try {
      // Surface read errors for explicit file paths.
      findings = checkFiles(files, true);
    } catch (e) {
      console.error(`check-md032: ${(e as Error).message}`);
      return 1;
    }
  }

  if (findings.length === 0) {
    console.log(`check-md032: ${fileCount} file(s) scanned, no MD032 findings`);
    return 0;
  }

  console.error(`check-md032: ${findings.length} MD032 finding(s):`);
  for (const f of findings) {
    const rel = f.file.startsWith(repoRoot) ? relative(repoRoot, f.file) : f.file;
    console.error(`  ${rel}:${f.line}: ${f.context}`);
  }
  return 1;
}

if (import.meta.main) {
  process.exit(main());
}
