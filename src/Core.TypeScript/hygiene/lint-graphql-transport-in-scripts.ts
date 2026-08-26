#!/usr/bin/env bun
// src/Core.TypeScript/hygiene/lint-graphql-transport-in-scripts.ts
//
// A COMMITTED SCRIPT, WORKFLOW, OR AGENT LOOP THAT REACHES GITHUB OVER THE
// GRAPHQL TRANSPORT WHEN THE SAME FACT IS AVAILABLE OVER REST.
//
// ═══════════════════════════════════════════════════════════════════════════
// WHAT IS NOT THE TARGET, SAID FIRST
// ═══════════════════════════════════════════════════════════════════════════
//
// A HUMAN TYPING `gh pr view 15673` AT A PROMPT IS NOT THE TARGET, and never
// will be. `gh pr view` is the right command for a person looking at a pull
// request: it is one call, it renders, and a human does not run it four
// hundred times an hour. Reading this lint as "the repo has banned gh" is a
// misreading that would get the lint deleted, so it is refused here in the
// first paragraph rather than in a footnote.
//
// The target is the COMMITTED, REPEATED, UNATTENDED call: a `.ts` an agent
// loop shells, a `run:` block in a workflow that fires on a cadence, a `.sh`
// in `tools/`. Those are the calls that multiply, and multiplication is the
// entire defect.
//
// ═══════════════════════════════════════════════════════════════════════════
// THE DEFECT THIS EXISTS FOR
// ═══════════════════════════════════════════════════════════════════════════
//
// `gh` has two backends and does not say which one it used. `gh pr view`,
// `gh pr list`, `gh pr checks` and `gh run view` are GRAPHQL. `gh api
// repos/{owner}/{repo}/...` is REST. GitHub meters them against TWO SEPARATE
// 5000/hour budgets, and in this repo they are not close to equally loaded:
//
//   * measured 2026-08-14 (recorded only as a code comment in
//     agent-heartbeats/merge-heartbeats-to-main.ts): GraphQL 1147/5000 points
//     against REST 33/5000 requests.
//   * measured 2026-08-25/26: agent polling drove GraphQL to 0/5000 WITHIN A
//     MINUTE of an hourly reset, twice, while REST was never contended.
//
// The trap is that the GraphQL commands are the ERGONOMIC ones. `gh pr view N
// --json state` is shorter than its REST spelling, reads better, and is what
// every example on the internet shows. So the cheap transport is the one you
// have to know about, and on 2026-08-25/26 FOUR AGENTS independently walked
// into the same wall in one evening. The knowledge existed -- in one docstring
// in one module -- and a docstring is read by whoever is editing that module,
// which is why it stopped four agents zero times.
//
// AND THE DRAIN IS OBSERVATION, NOT ACTION. Measured in the same hour: 7 lane
// runs and 11 PRs created, so auto-merge arming cost AT MOST 11 GraphQL
// mutations against 5000 -- about 0.2%. The budget was not spent doing things.
// It was spent looking.
//
// ═══════════════════════════════════════════════════════════════════════════
// THE ONE OPERATION THAT MUST SPEND IT
// ═══════════════════════════════════════════════════════════════════════════
//
// `enablePullRequestAutoMerge` is GraphQL-ONLY. There is no REST equivalent,
// so `gh pr merge --auto` is not a finding here and must not become one: it is
// the single operation whose cost is unavoidable, and it is also rare and
// cheap. Every OTHER command this lint names has a REST form, printed in the
// refusal.
//
// ═══════════════════════════════════════════════════════════════════════════
// WHAT THIS SEES, AND WHAT IT PROVABLY DOES NOT
// ═══════════════════════════════════════════════════════════════════════════
//
// IT SEES two spellings, because in this tree both are load-bearing and a lint
// that caught only one would under-report by more than half:
//
//   1 SHELL FORM -- `gh pr view`, `gh pr list`, `gh pr checks`, `gh run view`
//     as written in a `run:` block, a `.sh`, or a template literal.
//   2 ARGV FORM -- `spawnSync("gh", ["pr", "view", ...])`. This is the
//     DOMINANT form in `src/Core.TypeScript`, and it never contains the
//     substring `gh pr view` at all. A first draft that grepped only for the
//     shell form would have reported a fraction of the real sites and looked
//     thorough doing it.
//
// IT DOES NOT SEE:
//   * A raw `gh api graphql -f query=...` call. That is a deliberate,
//     legible choice to use GraphQL, and this lint's subject is the
//     ACCIDENTAL spend -- the call whose transport the author never picked.
//     Flagging the explicit form and not the implicit one would have the
//     polarity exactly backwards.
//   * Octokit/`@octokit/graphql` or any HTTP client reaching the GraphQL
//     endpoint directly. Not present in this tree at the time of writing;
//     named here so a later reader knows it was considered, not missed.
//   * A verb assembled at runtime: `["pr", verb]`, `gh pr "$SUB"`. The
//     transport is then undecidable statically.
//   * Any language other than the extensions in SCANNED_EXTENSIONS.
//
// A file it cannot read is a FINDING (`unreadable`), never a silent skip, and
// a scan below `--min-files` is a FINDING (`scan-floor`). Both are "the check
// did not run", and neither is allowed to look like a pass.
//
// ═══════════════════════════════════════════════════════════════════════════
// COMMENTS ARE MASKED, AND THAT IS NOT A CONVENIENCE
// ═══════════════════════════════════════════════════════════════════════════
//
// This very file names all four commands, in prose, repeatedly. So does
// `.github/workflows/agent-heartbeat.yml`, which carries five comment lines
// explaining why it uses REST -- and four real call sites. A lint that
// reported its own documentation would be deleted within a day, and the first
// casualty would be the explanations that keep the discipline legible.
//
// So comments are masked before matching; STRINGS ARE NOT. The argv form lives
// entirely inside string literals, so masking string interiors would blind the
// lint to its main quarry. The masking is deliberately one-directional.
//
// Its stated limits: a `//` inside a string is treated as a comment unless it
// is preceded by `:` (the `https://` case), and in shell/YAML a `#` inside a
// quoted string is recognised only through a per-LINE quote scan, so a `#`
// inside a multi-line quoted string is masked. Both directions of that error
// under-report. They are named rather than discovered.
//
// ═══════════════════════════════════════════════════════════════════════════
// WHAT IT MEASURED, AND WHY THERE IS A BASELINE
// ═══════════════════════════════════════════════════════════════════════════
//
// FIRST RUN, 2026-08-26, over `src/Core.TypeScript`, `.github/workflows`,
// `tools` and `.claude`: **2505 files scanned, 39 call sites in 19 files**.
// By spelling: 34 argv-form, 5 shell-form. By route: `pr list` 26, `pr view`
// 10, `pr checks` 3, `gh run view` 0. By surface: 34 TypeScript, 4
// `agent-heartbeat.yml`, 1 shell script.
//
// Three of those numbers decide the design. THE ARGV FORM IS 34 OF 39, so a
// lint built from the obvious `grep "gh pr view"` would have found five sites,
// reported a nearly-clean tree, and looked thorough doing it. `pr list` IS 26
// OF 39, and it is the expensive route -- a list costs GraphQL points in
// proportion to the pages it walks, which is how a poll loop reaches 0/5000
// inside a minute. And `gh run view` IS ZERO: named in the brief that
// commissioned this lint, present nowhere in the tree, kept in the roster
// anyway because the next agent to want a run's status will reach for it.
//
// An honest note on how this number moved, because the first draft's was
// wrong in the direction that flatters a tool. It reported 77, and 19 of those
// were ERROR AND USAGE STRINGS in TypeScript -- `"...: gh pr list failed\n"`.
// See the narrowing note in `analyzeSource`. A lint's first number is a
// hypothesis; this one had a control run against it before it was written down.
//
// Those 39 are FROZEN, not fixed. The point of the baseline is the one
// AUDIT-LIFECYCLE.md step 5 makes: a gate that demands a 19-file migration
// before it can land is a gate that never lands. Migrating them is real work
// with real behaviour change (pagination, field names, `--jq` rewrites) and it
// is not this change's job.
//
// THE BASELINE STORES COUNTS, NOT A SET, and the reason is a hole a set would
// leave. The signature is line-free -- `pr list@argv` -- so an unrelated edit
// above a row does not thaw it. But several files hold more than one call site
// of the SAME route, so a set-shaped baseline would grandfather that file's
// whole route and let a SEVENTH `gh pr list` land in `github-adapter.ts`
// silently. Counting closes it: `{ "<key>": <n> }`, and the (n+1)th is a
// finding.
//
// Its honest limit, stated rather than discovered: delete one baselined call
// and add another of the same route in the same file, and the count is
// unchanged, so the new one is not caught. Catching that needs the call's
// surrounding text in the key, and `["pr", "list"]` is byte-identical at every
// site, so there is no such text to key on. Named here as the known gap.
//
// ═══════════════════════════════════════════════════════════════════════════
// SUPPRESSION
// ═══════════════════════════════════════════════════════════════════════════
//
// `graphql-transport-ok: <reason>` in a comment on the finding's line or the
// line immediately above it. The reason is mandatory and non-empty: an escape
// hatch with no stated reason is an allowlist, and an allowlist drifts. An
// empty one is itself a finding (`empty-suppression`).
//
// Everything above main() is pure over strings, so the audit is testable with
// no filesystem and its own refusals are falsifiable.

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";

// ═══════════════════════════════════════════════════════════════════════════
// VOCABULARY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * The `gh` subcommand+verb pairs that go over GraphQL, and the REST call that
 * answers the same question.
 *
 * The remedy is carried in the data, not written into a generic message,
 * because a refusal that does not name the replacement is a refusal people
 * route around. Every entry was checked against `gh api` on this repo.
 */
export const GRAPHQL_ROUTES: ReadonlyMap<string, string> = new Map([
  ["pr view", "gh api repos/{owner}/{repo}/pulls/{number}  (fields: state, mergeable, auto_merge, head.sha)"],
  ["pr list", 'gh api "repos/{owner}/{repo}/pulls?state=open&per_page=100"  (paginate with --paginate)'],
  ["pr checks", "gh api repos/{owner}/{repo}/commits/{sha}/check-runs  (per-step: .../actions/runs/{id}/jobs)"],
  ["run view", "gh api repos/{owner}/{repo}/actions/runs/{id}  (per-step: .../actions/runs/{id}/jobs)"],
]);

/**
 * The one GraphQL operation with no REST form.
 *
 * Present as a named constant rather than an absence so that a future reader
 * asking "why is `gh pr merge --auto` not flagged?" finds the answer in the
 * code instead of concluding the lint has a hole.
 */
export const GRAPHQL_ONLY_AND_PERMITTED =
  "pr merge --auto (enablePullRequestAutoMerge -- GraphQL-only, no REST equivalent)";

/** Extensions scanned. YAML is scanned only under a workflows directory. */
export const SCANNED_EXTENSIONS: readonly string[] = [
  ".ts",
  ".mts",
  ".cts",
  ".js",
  ".mjs",
  ".cjs",
  ".sh",
  ".bash",
  ".ps1",
  ".yml",
  ".yaml",
];

export type Rule = "gh-shell-graphql" | "gh-argv-graphql" | "unreadable" | "empty-suppression" | "scan-floor";

export interface Finding {
  readonly rule: Rule;
  readonly file: string;
  readonly line: number;
  /** Line-free identity, e.g. `pr view@shell`. Stored in the baseline. */
  readonly signature: string;
  readonly detail: string;
  readonly fix: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// MASKING
// ═══════════════════════════════════════════════════════════════════════════

/** Which comment syntax a path uses. */
export type CommentStyle = "c-like" | "hash";

export function commentStyleFor(path: string): CommentStyle {
  const ext = extname(path);
  if (ext === ".sh" || ext === ".bash" || ext === ".ps1" || ext === ".yml" || ext === ".yaml") return "hash";
  return "c-like";
}

/**
 * Blank comments in place, preserving length and newlines so every offset in
 * the masked text indexes the original.
 *
 * Strings are deliberately left intact -- see the header. `//` preceded by `:`
 * is left alone so a URL in a string does not swallow the rest of its line.
 */
export function maskComments(text: string, style: CommentStyle): string {
  return style === "hash" ? maskHashComments(text) : maskCLikeComments(text);
}

/**
 * Where a `#` comment starts on one line, or -1.
 *
 * Per-LINE quote tracking. Shell and YAML both use `#`, both allow it inside
 * quotes, and neither is worth a full lexer here. A `#` must start the line or
 * follow whitespace to open a comment, so `foo#bar` and `$#` are not comments.
 */
export function hashCommentStart(line: string): number {
  let inSingle = false;
  let inDouble = false;
  for (let k = 0; k < line.length; k++) {
    const c = line[k];
    if (c === "'" && !inDouble) inSingle = !inSingle;
    else if (c === '"' && !inSingle) inDouble = !inDouble;
    else if (c === "#" && !inSingle && !inDouble && (k === 0 || line[k - 1] === " " || line[k - 1] === "\t")) return k;
  }
  return -1;
}

function maskHashComments(text: string): string {
  return text
    .split("\n")
    .map((line) => {
      const cut = hashCommentStart(line);
      return cut < 0 ? line : line.slice(0, cut) + " ".repeat(line.length - cut);
    })
    .join("\n");
}

function maskCLikeComments(text: string): string {
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
    // `:` before `//` means a URL inside a string, not a comment.
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
 * Lines carrying `graphql-transport-ok: <reason>`, mapped to the reason.
 *
 * Read from the ORIGINAL text, because the marker lives in a comment and the
 * matcher runs on text where comments have been blanked.
 */
export function suppressions(text: string): ReadonlyMap<number, string> {
  const out = new Map<number, string>();
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const m = /graphql-transport-ok:(.*)$/.exec(lines[i] ?? "");
    if (m) out.set(i + 1, (m[1] ?? "").trim());
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════
// MATCHING
// ═══════════════════════════════════════════════════════════════════════════

/** Ordinal, never `localeCompare` -- .claude/rules/culture-invariant-by-default.md. */
function compareOrdinal(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/** Every `gh ` invocation start; the route is read from what follows. */
const GH_INVOCATION = /\bgh\s+/g;

/**
 * The `<sub> <verb>` a `gh` invocation names, or "" when it names neither.
 *
 * A TOKENIZER rather than one regex, deliberately. The regex that did this job
 * scored 29 on `sonarjs/regex-complexity` (limit 20), and the reason it was
 * complex is the reason it was also WRONG once already: flags between `gh` and
 * the subcommand must be consumed INCLUDING a space-separated value
 * (`gh --repo o/r pr list`), and the first draft ate `--repo` but not `o/r`,
 * silently missing that spelling. A loop that skips flags is legible enough to
 * be checked by reading, which the regex was not.
 *
 * Bounded to the first line and the first few tokens: a lint defeated by
 * moving a flag is a lint people learn to move flags around, but a scanner
 * that walks an unbounded distance from `gh` starts pairing across statements.
 */
export function routeAfterGh(rest: string): string {
  const firstLine = rest.split(/[\n;|&]/)[0] ?? "";
  const tokens = firstLine.split(/\s+/).filter((t) => t !== "");
  let i = 0;
  while (i < tokens.length && tokens[i]?.startsWith("-") === true) {
    const consumesNext = !(tokens[i]?.includes("=") ?? true);
    i++;
    if (consumesNext && tokens[i] !== undefined && !tokens[i]?.startsWith("-")) i++;
    if (i > 8) return "";
  }
  const sub = tokens[i];
  const verb = tokens[i + 1];
  if (sub === undefined || verb === undefined) return "";
  if (!/^[a-z][a-z-]*$/.test(verb)) return "";
  return sub + " " + verb;
}

/**
 * `"pr", "view"` -- the argv-array spelling, allowing a newline between the
 * elements because `github-adapter.ts` wraps exactly there.
 */
const ARGV_CALL = /(["'])(pr|run)\1\s*,\s*(["'])([a-z][a-z-]*)\3/g;

const lineOf = (text: string, index: number): number => {
  let line = 1;
  for (let i = 0; i < index && i < text.length; i++) if (text[i] === "\n") line++;
  return line;
};

/** Findings in one file's text. Pure. */
export function analyzeSource(text: string, path: string): readonly Finding[] {
  const masked = maskComments(text, commentStyleFor(path));
  const suppressed = suppressions(text);
  const findings: Finding[] = [];

  const record = (
    rule: "gh-shell-graphql" | "gh-argv-graphql",
    route: string,
    index: number,
    spelling: string,
  ): void => {
    const line = lineOf(masked, index);
    const reason = suppressed.get(line) ?? suppressed.get(line - 1);
    if (reason !== undefined) {
      if (reason === "") {
        findings.push({
          rule: "empty-suppression",
          file: path,
          line,
          signature: "empty-suppression " + route,
          detail:
            "`graphql-transport-ok:` with no reason. An escape hatch with no stated reason is an allowlist, and an allowlist drifts.",
          fix: "Write the reason after the colon, or remove the marker and use REST.",
        });
      }
      return;
    }
    findings.push({
      rule,
      file: path,
      line,
      signature: route + "@" + (rule === "gh-shell-graphql" ? "shell" : "argv"),
      detail:
        "`" +
        spelling +
        "` goes over the GRAPHQL transport. GraphQL and REST have separate 5000/hour budgets and only the GraphQL one is contended here (measured: REST 33/5000 while GraphQL hit 0/5000 twice in one hour).",
      fix: "Use REST: " + (GRAPHQL_ROUTES.get(route) ?? "gh api repos/{owner}/{repo}/..."),
    });
  };

  // THE SHELL FORM IS LOOKED FOR ONLY IN SHELL-SHAPED FILES, and that is a
  // MEASUREMENT, not a convenience. A first draft ran it everywhere and
  // reported 19 sites in `.ts` that are all ERROR AND USAGE STRINGS, e.g.
  // `"required-check-started: gh pr list failed\n"` and
  // `"usage: gh pr view N --json body | bun validate-agencysignature-pr-body.ts"`.
  // Those are prose about a command, not a call, and a lint whose findings are
  // mostly its own tree's error messages teaches everyone to ignore it.
  //
  // The control that justifies the narrowing: a search for a GENUINE shell
  // invocation in TypeScript -- `execSync`/`spawnSync`/`$(...)` wrapping a
  // whole `gh pr ...` command string -- over all of src/Core.TypeScript
  // returned ZERO hits outside this lint's own test fixtures. TypeScript here
  // shells `gh` through the argv array, which the other matcher owns.
  //
  // The gap this leaves, named rather than discovered: if a `.ts` ever does
  // `execSync("gh pr list ...")`, this lint will not see it. That is a real
  // hole, it is currently unoccupied, and the shape that would close it is a
  // string-literal-plus-exec-callee pairing rather than a wider regex.
  if (commentStyleFor(path) === "hash") {
    for (const m of masked.matchAll(GH_INVOCATION)) {
      const start = m.index;
      const route = routeAfterGh(masked.slice(start + m[0].length));
      if (!GRAPHQL_ROUTES.has(route)) continue;
      record("gh-shell-graphql", route, start, "gh " + route);
    }
  }
  for (const m of masked.matchAll(ARGV_CALL)) {
    const route = (m[2] ?? "") + " " + (m[4] ?? "");
    if (!GRAPHQL_ROUTES.has(route)) continue;
    record("gh-argv-graphql", route, m.index, '["' + (m[2] ?? "") + '", "' + (m[4] ?? "") + '"]');
  }

  return findings.sort(compareFindings);
}

/** Ordinal, never `localeCompare` -- .claude/rules/culture-invariant-by-default.md. */
function compareFindings(a: Finding, b: Finding): number {
  if (a.line !== b.line) return a.line - b.line;
  return compareOrdinal(a.signature, b.signature);
}

// ═══════════════════════════════════════════════════════════════════════════
// I/O EDGE
// ═══════════════════════════════════════════════════════════════════════════

const SKIP_DIRS = new Set([
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
]);

export interface LoadedFile {
  readonly path: string;
  readonly text: string;
  /** Non-empty when the file exists but could not be read. */
  readonly readError: string;
}

/**
 * The ONE file exempt from the scan: this lint's own test fixtures.
 *
 * Its fixtures are `["pr", "view"]` and friends, written as literal strings
 * because that is the only way to prove the matcher fires. Suppressing them
 * one by one would work and would also mean eight `graphql-transport-ok:`
 * markers whose stated reason is "this is a test fixture" -- noise that makes
 * the hatch look routine, when the hatch should be rare.
 *
 * It is a single path, not a directory or a glob, and `exemptPaths` is asserted
 * to have exactly one element in the test suite. An exemption with room to
 * grow is an allowlist, and an allowlist drifts.
 */
export const SELF_TEST_FIXTURE = "lint-graphql-transport-in-scripts.test.ts";

/** Every exempt path, enumerable so a test can pin the size. */
export function exemptPaths(): readonly string[] {
  return [SELF_TEST_FIXTURE];
}

/**
 * Whether a path is in scope.
 *
 * YAML is scanned only under a `workflows` directory: `.yml` elsewhere in this
 * tree is Helm charts, chart values, and config, none of which shell `gh`, and
 * scanning them would spend the whole run to find nothing.
 */
export function isScannable(path: string): boolean {
  const ext = extname(path);
  if (!SCANNED_EXTENSIONS.includes(ext)) return false;
  if (path.endsWith(".d.ts")) return false;
  if (exemptPaths().some((p) => path.endsWith(p))) return false;
  if (ext === ".yml" || ext === ".yaml") return path.includes("workflows/") || path.includes("workflows\\");
  return true;
}

/**
 * Every scannable file under `root`.
 *
 * Written with `withFileTypes` and read-then-interpret rather than
 * exists-then-read, per `lint-check-then-use-file-races.ts` -- a lint that
 * violates a sibling lint is the loudest argument for ignoring both.
 */
export function loadFiles(root: string): readonly LoadedFile[] {
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
      if (!entry.isFile() || !isScannable(p)) continue;
      try {
        out.push({ path: p, text: readFileSync(p, "utf8"), readError: "" });
      } catch (e) {
        const code = (e as NodeJS.ErrnoException).code;
        // Unreadable is NOT a skip. It is the check that did not run.
        out.push({ path: p, text: "", readError: String(code ?? e) });
      }
    }
  };
  walk(root);
  return out.sort((a, b) => compareOrdinal(a.path, b.path));
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
          "), so it was not scanned. Reported rather than skipped: an audit that silently passes over what it cannot open is indistinguishable from one that found nothing.",
        fix: "Make the path readable, or exclude it deliberately and say so.",
      });
      continue;
    }
    findings.push(...analyzeSource(f.text, f.path));
  }
  return findings;
}

/** Baseline key. Line-free on purpose: an edit above a row must not thaw it. */
export function baselineKey(f: Finding): string {
  return f.rule + " " + f.file + " " + f.signature;
}

/** How many findings each key currently has. */
export function tally(findings: readonly Finding[]): ReadonlyMap<string, number> {
  const out = new Map<string, number>();
  for (const f of findings) out.set(baselineKey(f), (out.get(baselineKey(f)) ?? 0) + 1);
  return out;
}

/**
 * The findings a counting baseline does NOT grandfather.
 *
 * For each key the baseline allows `n`; the first `n` occurrences in line
 * order are grandfathered and every one after that is reported. Reporting the
 * EXCESS rather than the whole key is what makes the refusal say "you added
 * one" instead of re-litigating a file somebody else froze.
 */
export function unbaselined(findings: readonly Finding[], allowed: ReadonlyMap<string, number>): readonly Finding[] {
  const seen = new Map<string, number>();
  const out: Finding[] = [];
  for (const f of findings) {
    const key = baselineKey(f);
    const nth = (seen.get(key) ?? 0) + 1;
    seen.set(key, nth);
    if (nth > (allowed.get(key) ?? 0)) out.push(f);
  }
  return out;
}

/**
 * Parse a baseline file's contents.
 *
 * Accepts the counting object shape only. A malformed baseline yields an EMPTY
 * allowance rather than a permissive one -- a baseline nobody can read must
 * fail loudly, not grandfather the world.
 */
export function parseBaseline(text: string): ReadonlyMap<string, number> {
  const out = new Map<string, number>();
  const parsed: unknown = JSON.parse(text);
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return out;
  for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof v === "number" && Number.isInteger(v) && v > 0) out.set(k, v);
  }
  return out;
}

/** Parsed command line. Separated from main() so the parsing has its own tests. */
export interface Options {
  readonly asJson: boolean;
  readonly quiet: boolean;
  readonly writeBaseline: boolean;
  readonly baselinePath: string | undefined;
  readonly searchRoots: readonly string[];
  readonly minFiles: number;
}

export const DEFAULT_ROOTS: readonly string[] = ["src/Core.TypeScript", ".github/workflows", "tools"];

export function parseArgs(argv: readonly string[]): Options {
  const valueSlots = new Set<number>();
  for (const flag of ["--baseline", "--min-files"]) {
    const at = argv.indexOf(flag);
    if (at >= 0) valueSlots.add(at + 1);
  }
  const roots = argv.filter((a, i) => !a.startsWith("--") && !valueSlots.has(i));
  const baselineFlag = argv.indexOf("--baseline");
  const minFlag = argv.indexOf("--min-files");
  return {
    asJson: argv.includes("--json"),
    quiet: argv.includes("--quiet"),
    writeBaseline: argv.includes("--write-baseline"),
    baselinePath: baselineFlag >= 0 ? argv[baselineFlag + 1] : undefined,
    searchRoots: roots.length > 0 ? roots : DEFAULT_ROOTS,
    minFiles: minFlag >= 0 ? Number(argv[minFlag + 1] ?? "1") : 1,
  };
}

export function main(argv: readonly string[]): number {
  const { asJson, quiet, writeBaseline, baselinePath, searchRoots, minFiles } = parseArgs(argv);

  const files = searchRoots.flatMap((r) => [...loadFiles(r)]);
  const all = [...auditFiles(files)];

  // SCAN FLOOR. A mistyped root, a moved directory, or a walker that returns
  // early all look exactly like a clean tree from the exit code.
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

  let allowed: ReadonlyMap<string, number> = new Map();
  if (baselinePath !== undefined && !writeBaseline) {
    try {
      allowed = parseBaseline(readFileSync(baselinePath, "utf8"));
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code;
      if (code !== "ENOENT") throw e;
    }
  }
  const findings = unbaselined(all, allowed);
  const grandfathered = all.length - findings.length;

  if (writeBaseline && baselinePath !== undefined) {
    const counts = tally(all);
    const obj: Record<string, number> = {};
    for (const k of [...counts.keys()].sort(compareOrdinal)) obj[k] = counts.get(k) ?? 0;
    writeFileSync(baselinePath, JSON.stringify(obj, null, 2) + "\n", "utf8");
  }

  // ONE exit expression, computed before any reporting -- two returns would
  // mean the tested path is not the shipped path, and a mutation that made the
  // loud path always return 0 would survive the suite.
  const exitCode = findings.length > 0 ? 1 : 0;
  if (quiet) return exitCode;

  process.stdout.write(
    asJson
      ? JSON.stringify({ scanned: files.length, total: all.length, grandfathered, findings }, null, 2) + "\n"
      : renderReport(files.length, searchRoots, grandfathered, findings),
  );
  return exitCode;
}

/** The loud report, as a string, so the shipped path is the tested path. */
export function renderReport(
  scanned: number,
  roots: readonly string[],
  grandfathered: number,
  findings: readonly Finding[],
): string {
  const header =
    "lint-graphql-transport-in-scripts: scanned " +
    String(scanned) +
    " file(s) under " +
    roots.join(", ") +
    (grandfathered > 0 ? " (" + String(grandfathered) + " grandfathered)" : "") +
    "\n" +
    "  interactive `gh` use by a human is NOT the target; committed scripts, workflows and agent loops are.\n" +
    "  permitted GraphQL: " +
    GRAPHQL_ONLY_AND_PERMITTED +
    "\n";
  const rows = findings
    .map(
      (f) => "  [" + f.rule + "] " + f.file + ":" + String(f.line) + "\n    " + f.detail + "\n    FIX: " + f.fix + "\n",
    )
    .join("");
  const footer =
    findings.length === 0
      ? "  no un-baselined GraphQL-transport call sites found\n"
      : "  " + String(findings.length) + " finding(s)\n";
  return header + rows + footer;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
