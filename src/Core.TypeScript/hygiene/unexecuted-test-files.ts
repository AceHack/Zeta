#!/usr/bin/env bun
/**
 * unexecuted-test-files - no `*.test.ts` may sit outside CI SILENTLY.
 *
 * THE CLASS THIS EXISTS TO CLOSE. This is `lean-orphan-modules.ts` for the TypeScript suite,
 * and the defect is identical in shape: a test file that no workflow invocation reaches is
 * never executed. It can assert anything - including a deliberately-pinned known-broken
 * behaviour - and nothing reports it, while the name of the file promises a check ran.
 *
 * Measured on `origin/main` 2026-08-13 (work-item 081KZYPHESJ087G0R002EZ7A2H): 608 `*.test.ts`
 * under `src/` and `tests/`, of which roughly 95 were reachable from a `bun test` invocation
 * in `gate.yml`. Whole directories - `discovery/`, `planning/`, `browser-node/`,
 * `ferry-throttler/`, `model-backend/`, `oracle/`, `forge-host/` - were never executed. Three
 * live instances on that one day:
 *
 *   1. `discovery/udp-lossy-transport.chaos.test.ts` - 32 tests, four of which deliberately
 *      pin currently-broken behaviour so it cannot silently regress. Inert: nothing ran them.
 *   2. `planning/orbital-independent-check.test.ts` - the check that FALSIFIED a proposed
 *      remedy. It never re-ran, so the falsification was not regression-protected.
 *   3. `forge-host/github/pr-manifest-shards.test.ts` - 21 tests from a migration that merged
 *      an hour before the gap was found, alongside a drift gate referenced by no workflow.
 *
 * `.github/workflows/zflash-harness-lint.yml` states the rule this enforces: "a green check
 * that implies more than it tested is worse than no check."
 *
 * WHAT "EXECUTED" MEANS HERE, AND WHY IT IS THE PR LANE. Coverage is credited only to
 * workflows carrying a `pull_request` trigger. A cadence (`schedule`) or a paths-scoped
 * `push` run reports drift AFTER a merge; it does not stop the PR that broke it, which is
 * the harm being closed. A file executed only in such a lane is not a bug - it is a fact
 * that must be WRITTEN DOWN, so it belongs in the allow-list naming the lane that runs it.
 *
 * DERIVED, NOT DECLARED. The executed set is computed by parsing every `bun test` invocation
 * in every workflow and applying the filter semantics bun itself uses (positional arguments
 * are SUBSTRING filters against the test-file path, resolved from the `working-directory` of
 * the step; no positional arguments means every discoverable test file). A hand-maintained
 * list of "what CI runs" rots into folklore the first time a workflow is edited - deriving
 * it is the whole point.
 *
 * DISCOVERED FROM THE TRACKED SET, SO THE VERDICT IS THE SAME EVERYWHERE. Both halves of
 * this check are derived, and both must be derived from something a fresh checkout has.
 * The file half was a working-tree walk until 081KZYXRYR8087G0R003E6JZA4, which made it a
 * function of what the machine had built - `bun run pages:build` copies `docs/` into a
 * gitignored `dist/`, so 18 archived test files reappeared under a second path and the
 * checker exited 1 on any developer machine that had built while staying green in CI. A
 * checker that cries wolf where people work and reports clean where nobody looks is worse
 * than absent: it teaches its own audience to ignore it. See `../git/tracked-files.ts`.
 *
 * WHAT THIS DOES NOT DO. It does not forbid exclusion. Some suites genuinely do not belong
 * in the PR lane (they need a cluster, a GPU, a physical USB device, or minutes nobody wants
 * to pay per PR). It forbids exclusion being *invisible*: an unexecuted file must be listed
 * in `registry/unexecuted-test-files.json` with a non-empty reason. One JSON entry is the
 * whole cost of a deliberate omission; the cost of an accidental one is a red build.
 *
 * Four failure modes, all fatal:
 *   - an unexecuted file absent from the allow-list   (the silent-omission case)
 *   - a listed entry with an empty/missing reason     (the "" escape hatch)
 *   - a listed entry matching nothing unexecuted      (so the list cannot rot into noise)
 *   - a tracked test file under a dot-prefixed path   (undiscoverable by bun -- see isHiddenPath)
 *
 * And one that fires before any of them: NON-VACUITY. If the discovered file count or the
 * parsed invocation count is implausibly low, this fails loudly rather than reporting a
 * clean sheet. A checker that silently finds nothing is precisely the defect it closes.
 * A `git ls-files` that fails throws at the source; one that returns an implausibly small
 * set is caught by the same floor. Neither can read as "all clear".
 *
 * Usage:
 *   bun src/Core.TypeScript/hygiene/unexecuted-test-files.ts [repo-root]
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { trackedFiles } from "../git/tracked-files";

export const WORKFLOW_DIR = join(".github", "workflows");

/**
 * Ordinal (UTF-16 code-unit) comparator.
 *
 * NOT localeCompare, which the lint rule suggests and which
 * .claude/rules/culture-invariant-by-default.md forbids: it is locale-sensitive, so the
 * order of a findings list would differ between a developer machine and the runner, and a
 * diffable report that reorders itself by locale is not diffable.
 */
export function byOrdinal(a: string, b: string): number {
  if (a < b) return -1;
  return a > b ? 1 : 0;
}

export const ALLOW_LIST = join("registry", "unexecuted-test-files.json");

/**
 * Non-vacuity floors. Deliberately far below the true counts (905 test files, 20-plus parsed
 * invocations as of 2026-08-13) so ordinary churn never trips them, and far above zero so a
 * broken file walk, a moved workflow directory, or a regex that stops matching cannot pass
 * as "nothing to report".
 */
export const MIN_TEST_FILES = 200;
export const MIN_INVOCATIONS = 8;

export interface AllowEntry {
  /** Exact repo-relative path, or a directory prefix ending in a slash. */
  readonly path: string;
  readonly reason: string;
  readonly workitem?: string;
}

export interface BunTestInvocation {
  readonly workflow: string;
  readonly step: string;
  readonly workingDirectory: string;
  readonly filters: readonly string[];
  readonly triggers: readonly string[];
}

// ---------------------------------------------------------------------------
// Disk side
// ---------------------------------------------------------------------------

/**
 * Is any segment of this path dot-prefixed?
 *
 * MEASURED against bun 1.3.14, because this is a claim about a tool and not a preference:
 * a `.hidden/x.test.ts` is NOT run by a bare `bun test` (1 of 2 files ran), and a
 * positional filter cannot resurrect it - bun answers "the following filters did not match
 * any test files". Only an explicit `./.hidden/x.test.ts` path argument reaches it.
 *
 * So a dot-prefixed path is UNDISCOVERABLE BY LOCATION, and crediting it to the bare
 * `bun test` in gate.yml - which is what the no-filters rule in `executes` would do -
 * would invent coverage that does not exist. Such a file is therefore kept out of the
 * `executes` derivation entirely and counted straight into `unexecuted` by `report`.
 *
 * IT IS A FINDING NOW, NOT A NUMBER. Until 081KZZ1RK6A087G0R003C773WC this class was merely
 * COUNTED, in the `hidden-from-bun` field of the summary line - visible, but passing. That
 * visibility is what surfaced the two live instances (`.claude/hooks/harness.test.ts` and
 * `.claude/hooks/stop-detect-response-rut.test.ts`, 13 assertions on the session-start and
 * Stop hooks, executed by nothing since 2026-06-21). Both have moved to
 * `src/Core.TypeScript/claude-hooks/`, where the bare `bun test` reaches them.
 *
 * A count that nobody has to act on is the soft version of the defect this checker exists
 * to close, so the count is no longer the whole remedy: a hidden file is now unexecuted,
 * and unexecuted means allow-listed with a written reason or red. The `hidden-from-bun`
 * field stays in the summary because it names the CAUSE, which "unexecuted" alone does not.
 */
export function isHiddenPath(file: string): boolean {
  return file.split("/").some((seg) => seg.startsWith("."));
}

/**
 * Every TRACKED test file, repo-relative and ordinal-sorted.
 *
 * DERIVED FROM THE TRACKED SET, NOT A WALK OF THE WORKING TREE. This was a walk until
 * 081KZYXRYR8087G0R003E6JZA4, and the walk made the discovered set a function of what the
 * machine happened to have built: `bun run pages:build` copies `docs/` into a gitignored
 * `dist/`, so 18 archived test files reappeared under a second path and the checker exited
 * 1 on every developer machine that had built, while CI - which checks out clean - stayed
 * green. `git ls-files` is what a fresh checkout contains, so the discovered set is now
 * identical on every machine. The reasoning and the shared helper live in
 * `../git/tracked-files.ts`; the same lesson was learned once already in `ace/build-graph.ts`.
 *
 * The prune list this replaced (`node_modules`, `references`, `artifacts`, `bin`, `obj`,
 * ...) existed only to bound WALK COST, by its own docstring. There is no walk to bound
 * now, and none of those directories holds a tracked test file, so it is gone rather than
 * carried forward as decoration.
 */
export function testFilesTracked(root: string): readonly string[] {
  return trackedFiles(root).filter((f) => f.endsWith(".test.ts") && !isHiddenPath(f));
}

/** Tracked test files bun cannot discover because of where they live. See `isHiddenPath`. */
export function hiddenTestFiles(root: string): readonly string[] {
  return trackedFiles(root).filter((f) => f.endsWith(".test.ts") && isHiddenPath(f));
}

// ---------------------------------------------------------------------------
// Workflow side
// ---------------------------------------------------------------------------

/**
 * The workflow-level trigger keys.
 *
 * THROWS when a workflow has none that parse. A workflow that never triggers is not a
 * thing, so silence here means the parser broke - and a broken parser must never read as
 * "this lane runs nothing". Loud beats plausible.
 */
export function triggersOf(yamlText: string, name: string): readonly string[] {
  const inline = /^on: *\[(.*)\]/m.exec(yamlText);
  const one = inline?.[1];
  if (one !== undefined) {
    return one.split(",").map((s) => s.trim()).filter((s) => s !== "");
  }
  const idx = yamlText.search(/^on: *$/m);
  const keys: string[] = [];
  const after = idx < 0 ? [] : yamlText.slice(idx).split("\n").slice(1);
  for (const line of after) {
    if (/^\S/.test(line)) break;
    const m = /^ {2}([a-z_]+):/.exec(line);
    if (m?.[1] !== undefined) keys.push(m[1]);
  }
  if (keys.length === 0) fail("no parseable triggers in workflow " + name);
  return keys;
}

/** Abort with a prefixed message. Every failure mode here is fatal by design. */
export function fail(message: string): never {
  throw new Error("unexecuted-test-files: " + message);
}

/** One YAML list item (a step), as raw lines plus the indent of its dash. */
export interface Block {
  readonly indent: number;
  readonly lines: readonly string[];
}

/**
 * Split a workflow into its YAML list items. Steps are the only list items that carry a
 * run script, and a step is where a working-directory applies, so this is the unit that
 * keeps the two associated.
 */
export function listItems(yamlText: string): readonly Block[] {
  const lines = yamlText.split("\n");
  const starts: number[] = [];
  const DASH = /^ *- /;
  lines.forEach((line, i) => {
    if (DASH.test(line)) starts.push(i);
  });
  return starts.map((start) => blockAt(lines, start));
}

/** Leading-whitespace width of a line. */
export function indentOf(line: string): number {
  return line.length - line.trimStart().length;
}

/** The list item starting at the given index. */
export function blockAt(lines: readonly string[], start: number): Block {
  const indent = indentOf(lines[start] ?? "");
  const rest = lines.slice(start + 1);
  const off = rest.findIndex((l) => l.trim() !== "" && indentOf(l) <= indent);
  const end = off < 0 ? lines.length : start + 1 + off;
  return { indent, lines: lines.slice(start, end) };
}

const RUN_KEY = /^ *(?:- +)?run:(.*)$/;
const DASH_RUN = /^ *- +run:/;
const BLOCK_SCALAR = /^[|>][+-]?\d*$/;

/** Every run script in a step, with block-scalar bodies unwrapped to plain text. */
export function runScripts(block: Block): readonly string[] {
  const out: string[] = [];
  block.lines.forEach((line, i) => {
    const m = RUN_KEY.exec(line);
    if (m === null) return;
    const rest = (m[1] ?? "").trim();
    if (rest !== "" && !BLOCK_SCALAR.test(rest)) {
      out.push(rest);
      return;
    }
    const key = indentOf(line) + (DASH_RUN.test(line) ? 2 : 0);
    const after = block.lines.slice(i + 1);
    const off = after.findIndex((l) => l.trim() !== "" && indentOf(l) <= key);
    out.push((off < 0 ? after : after.slice(0, off)).join("\n"));
  });
  return out;
}

/** The step name, for error messages. */
export function stepName(block: Block): string {
  const m = /(?:^|\n) *(?:- +)?name: *(.+)/.exec(block.lines.join("\n"));
  return m?.[1]?.trim() ?? "(unnamed)";
}

/** The working-directory of a step, repo-relative, empty for the repo root. */
export function workDirOf(block: Block): string {
  const m = /(?:^|\n) *working-directory: *(\S+)/.exec(block.lines.join("\n"));
  return (m?.[1] ?? "").replace(/\/$/, "");
}

/**
 * Root package scripts, so one level of script indirection can be spliced in. A workflow
 * that runs tests THROUGH a script must not be mistaken for one that runs none.
 */
export function packageScripts(root: string): ReadonlyMap<string, string> {
  const p = join(root, "package.json");
  if (!existsSync(p)) return new Map();
  const parsed = JSON.parse(readFileSync(p, "utf8")) as { scripts?: Record<string, unknown> };
  const entries = Object.entries(parsed.scripts ?? {});
  return new Map(entries.filter((e): e is [string, string] => typeof e[1] === "string"));
}

/** Flags that swallow the next token, so it is never mistaken for a path filter. */
export const VALUE_FLAGS: ReadonlySet<string> = new Set([
  "-t",
  "--test-name-pattern",
  "--timeout",
  "--preload",
  "-p",
  "--reporter",
  "--reporter-outfile",
  "--coverage-reporter",
  "--coverage-dir",
  "--max-concurrency",
  "--repeat-each",
  "--config",
  "-c",
  "--env-file",
  "--concurrency",
]);

const STOP_TOKENS: ReadonlySet<string> = new Set(["&&", "||", "|", ";"]);

/** The positional (path-filter) arguments of one bun test command. */
export function bunTestFilters(command: string): readonly string[] {
  const tokens = command.split(/\s+/).filter((t) => t !== "");
  const filters: string[] = [];
  let skipNext = false;
  tokens.slice(tokens.indexOf("test") + 1).every((tok) => {
    if (skipNext) {
      skipNext = false;
      return true;
    }
    if (STOP_TOKENS.has(tok) || tok.startsWith("#")) return false;
    if (VALUE_FLAGS.has(tok)) {
      skipNext = true;
      return true;
    }
    const isFlag = tok.startsWith("-");
    const isContinuation = tok === "\\";
    if (!isFlag && !isContinuation) filters.push(tok);
    return true;
  });
  return filters;
}

/** Fold continued shell lines starting at an index into one command string. */
export function joinContinuation(lines: readonly string[], start: number): string {
  const parts: string[] = [];
  lines.slice(start).every((raw) => {
    const line = raw.trim();
    const more = line.endsWith(CONTINUE);
    parts.push(more ? line.slice(0, -1) : line);
    return more;
  });
  return parts.join(" ");
}

/** The shell line-continuation marker, built by code point to keep this file greppable. */
const CONTINUE = String.fromCharCode(92);

const SCRIPT_REF = /\b(?:bun|npm|pnpm|yarn)\s+run\s+([A-Za-z0-9:_-]+)/g;
/**
 * A `bun test` invocation, INCLUDING one carrying bun-level flags before the subcommand.
 *
 * WHY THE FLAG ALLOWANCE. This was `/\bbun\s+test\b/` until 2026-08-16, and that regex
 * cannot see `bun --config=bunfig.hermetic.toml test` — the form the hermetic tier needs,
 * because `-c/--config` is a bun-level flag and bun rejects it after the subcommand
 * (MEASURED against bun 1.3.14: `bun test -c bunfig.hermetic.toml` reads the path as a
 * positional FILTER and matches no test files). The old regex is exactly the class of defect
 * this checker exists to close, one level up: an invocation form it cannot parse is a lane it
 * reports as running nothing, so adding the hermetic job made 817 files read as unexecuted
 * while they were in fact being run.
 *
 * `(?:-\S+\s+)*` admits only FLAG-SHAPED tokens between the two words, so `bun run test:foo`
 * and `bun x test` still do not match — the point is to see a subcommand invocation wearing
 * flags, not to loosen what counts as one.
 */
const BUN_TEST = /\bbun\s+(?:-\S+\s+)*test\b/;

const YAML_EXT = /\.(?:yml|yaml)$/;

/** Every bun test invocation across every workflow, with its lane and its filters. */
export function parseInvocations(root: string): readonly BunTestInvocation[] {
  const dir = join(root, WORKFLOW_DIR);
  const names = readdirSync(dir).filter((n) => YAML_EXT.test(n)).sort(byOrdinal);
  if (names.length === 0) fail("no workflows found under " + WORKFLOW_DIR);
  const scripts = packageScripts(root);
  const out: BunTestInvocation[] = [];
  names.forEach((name) => {
    const text = readFileSync(join(dir, name), "utf8");
    const triggers = triggersOf(text, name);
    const hasJobDefaults = /^\s{4}defaults:/m.test(text);
    if (hasJobDefaults) fail(name + " uses job defaults, which would shift every filter base");
    listItems(text).forEach((block) => {
      out.push(...invocationsInStep(block, scripts, name, triggers));
    });
  });
  return out;
}

// ---------------------------------------------------------------------------
// The derivation
// ---------------------------------------------------------------------------

/**
 * Does an invocation execute a file?
 *
 * The positional arguments of bun test are SUBSTRING filters against the test-file path
 * as seen from the cwd - not globs, not exact paths. A trailing-slash directory works
 * because it is a prefix substring; a bare basename works because it is a substring too.
 * Modelling this as exact-path matching would under-count coverage and invent orphans;
 * modelling it as prefix matching would miss the basename form. Substring is what bun
 * does. Verified against bun 1.3.14: the filter `cost-counter` ran exactly
 * `src/Core.TypeScript/algebra/cost-counter.test.ts`.
 */
export function executes(inv: BunTestInvocation, file: string): boolean {
  const wd = inv.workingDirectory;
  const inScope = wd === "" || file.startsWith(wd + "/");
  if (!inScope) return false;
  const rel = wd === "" ? file : file.slice(wd.length + 1);
  if (inv.filters.length === 0) return true;
  return inv.filters.some((f) => rel.includes(f));
}

/** Files executed by at least one workflow carrying a pull_request trigger. */
export function executedInPrLane(
  invocations: readonly BunTestInvocation[],
  files: readonly string[],
): ReadonlySet<string> {
  const pr = invocations.filter((i) => i.triggers.includes("pull_request"));
  return new Set(files.filter((f) => pr.some((i) => executes(i, f))));
}

/** Workflows that execute a file in ANY lane - the hint text attached to a finding. */
export function anyLane(
  invocations: readonly BunTestInvocation[],
  file: string,
): readonly string[] {
  const hits = invocations.filter((i) => executes(i, file)).map((i) => i.workflow);
  return [...new Set(hits)].sort(byOrdinal);
}

/** The allow-list, or an empty list when the file is absent. */
export function loadAllowList(root: string): readonly AllowEntry[] {
  const p = join(root, ALLOW_LIST);
  if (!existsSync(p)) return [];
  const parsed: unknown = JSON.parse(readFileSync(p, "utf8"));
  if (!Array.isArray(parsed)) fail(ALLOW_LIST + " must be a JSON array");
  return parsed as readonly AllowEntry[];
}

/** An entry covers a file when it names it exactly, or is a directory prefix of it. */
export function covers(entry: AllowEntry, file: string): boolean {
  const isPrefix = entry.path.endsWith("/");
  return isPrefix ? file.startsWith(entry.path) : file === entry.path;
}

export interface Verdict {
  readonly undeclared: readonly string[];
  readonly reasonless: readonly string[];
  readonly stale: readonly string[];
}

/**
 * The three fatal conditions. `stale` is the one that keeps the list honest: an entry that
 * covers nothing unexecuted has been fixed or deleted, and leaving it behind turns the list
 * into folklore that would silently mute a file nobody meant to mute.
 */
export function check(unexecuted: readonly string[], allow: readonly AllowEntry[]): Verdict {
  const undeclared = unexecuted.filter((f) => !allow.some((e) => covers(e, f)));
  const reasonless = allow.filter((e) => typeof e.reason !== "string" || e.reason.trim() === "");
  const stale = allow.filter((e) => !unexecuted.some((f) => covers(e, f)));
  return {
    undeclared: [...undeclared].sort(byOrdinal),
    reasonless: reasonless.map((e) => e.path).sort(byOrdinal),
    stale: stale.map((e) => e.path).sort(byOrdinal),
  };
}

export interface Report {
  readonly files: readonly string[];
  /** Tracked test files bun cannot discover by location. A subset of `unexecuted`. */
  readonly hidden: readonly string[];
  readonly invocations: readonly BunTestInvocation[];
  readonly ignored: ReadonlySet<string>;
  readonly executed: ReadonlySet<string>;
  readonly unexecuted: readonly string[];
  readonly verdict: Verdict;
}

/**
 * The whole check, with the NON-VACUITY assertions first.
 *
 * Order is load-bearing. If the file walk or the workflow parse came back empty, every
 * verdict below is trivially clean and the checker would report a green sheet having
 * inspected nothing. That is the exact defect this file exists to close, so it must never
 * be the way this file passes.
 */
export function report(root: string): Report {
  const files = testFilesTracked(root);
  const tooFew = files.length < MIN_TEST_FILES;
  if (tooFew) fail("found only " + String(files.length) + " test files; the derivation is broken");
  const invocations = parseInvocations(root);
  const tooThin = invocations.length < MIN_INVOCATIONS;
  if (tooThin) fail("parsed only " + String(invocations.length) + " invocations; the parse is broken");
  const hidden = hiddenTestFiles(root);
  const ignored = bunIgnored(root, files);
  const reached = executedInPrLane(invocations, files);
  const executed = new Set([...reached].filter((f) => !ignored.has(f)));
  // Hidden files join `unexecuted` DIRECTLY, never via `executes`. Routing them through it
  // would hand them to the bare, filter-less `bun test` in gate.yml, whose no-filters rule
  // says "runs everything discoverable" - and the whole point of `isHiddenPath` is that bun
  // does not discover them. That would invent the coverage this checker exists to deny.
  const unexecuted = [...files.filter((f) => !executed.has(f)), ...hidden].sort(byOrdinal);
  const verdict = check(unexecuted, loadAllowList(root));
  return { files, hidden, invocations, ignored, executed, unexecuted, verdict };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

/** Human-readable findings. Empty means the check passed. */
export function findings(r: Report): readonly string[] {
  const out: string[] = [];
  r.verdict.undeclared.forEach((f) => {
    out.push("NOT EXECUTED IN THE PR LANE: " + f + " -- " + whyNotRun(r, f));
  });
  const mute = " -- an entry must say WHY, or it is just a mute.";
  r.verdict.reasonless.forEach((p) => out.push("EMPTY REASON: " + p + mute));
  const rot = " -- listed as unexecuted but nothing it covers is. Remove it.";
  r.verdict.stale.forEach((p) => out.push("STALE ENTRY: " + p + rot));
  return out;
}

/**
 * The one-line summary printed on every run, pass or fail.
 *
 * `hidden` stays in the line even though it is now fatal rather than merely excluded: the
 * findings say a file is unexecuted, and only this field says the cause is WHERE IT LIVES.
 * It should read 0. It read 2 for the whole life of `.claude/hooks/*.test.ts`, which is how
 * they were found (081KZZ1RK6A087G0R003C773WC).
 */
export function summary(r: Report): string {
  const pr = r.invocations.filter((x) => x.triggers.includes("pull_request")).length;
  const counts = [
    r.files.length,
    r.hidden.length,
    r.invocations.length,
    pr,
    r.executed.size,
    r.unexecuted.length,
  ];
  const label = "tracked-files/hidden-from-bun/invocations/pr-lane-invocations/executed/unexecuted";
  return "[unexecuted-test-files] " + label + " = " + counts.join(" ");
}

const CLI_NAME = /unexecuted-test-files\.(?:ts|js)$/;
const invokedDirectly = typeof process.argv[1] === "string" && CLI_NAME.test(process.argv[1]);
if (invokedDirectly) {
  const root = process.argv[2] ?? process.cwd();
  const r = report(root);
  console.log(summary(r));
  const problems = findings(r);
  problems.forEach((line) => {
    console.error("  " + line);
  });
  if (problems.length > 0) process.exit(1);
  console.log("[unexecuted-test-files] every test file runs in the PR lane or is declared.");
}

/**
 * Files that `bunfig.toml` tells bun to ignore, so no invocation can ever reach them.
 *
 * These are counted as UNEXECUTED rather than dropped from the denominator. Dropping them
 * would make ignoring a test the one way to leave CI without saying so - a hidden exclusion,
 * which is the whole defect. Ignoring a test is legitimate; doing it silently is not, so an
 * ignored file still needs its allow-list entry and its reason.
 */
export function bunIgnored(root: string, files: readonly string[]): ReadonlySet<string> {
  const p = join(root, "bunfig.toml");
  if (!existsSync(p)) return new Set();
  const block = /pathIgnorePatterns\s*=\s*\[([\s\S]*?)\]/.exec(readFileSync(p, "utf8"));
  const raw = block?.[1] ?? "";
  const patterns = [...raw.matchAll(/"([^"]+)"/g)].map((m) => m[1] ?? "");
  return new Set(files.filter((f) => patterns.some((pat) => ignoreMatches(pat, f))));
}

/**
 * Does a bunfig ignore pattern match a repo-relative path?
 *
 * Only the shapes bunfig actually uses are supported, and anything else THROWS instead of
 * quietly reading as a non-match. A pattern that silently stops matching would credit
 * coverage to files bun can never discover, which is the same lie in the other direction.
 */
export function ignoreMatches(pattern: string, file: string): boolean {
  const parts = pattern.split("/");
  const anySegment = parts[0] === "**";
  const anySuffix = parts[parts.length - 1] === "**";
  const want = parts.slice(anySegment ? 1 : 0, anySuffix ? parts.length - 1 : parts.length);
  if (want.some((s) => s.includes("*"))) fail("unsupported ignore pattern " + pattern);
  const have = file.split("/");
  const starts = anySegment ? have.map((_, i) => i) : [0];
  return starts.some((i) => {
    const fits = want.every((s, j) => have[i + j] === s);
    const exact = i + want.length === have.length;
    return fits && (anySuffix ? !exact && i + want.length < have.length : exact);
  });
}

/**
 * Every bun test invocation inside one step. Lifted out of parseInvocations so neither
 * function nests four callbacks deep, and so a step can be exercised on its own.
 */
export function invocationsInStep(
  block: Block,
  scripts: ReadonlyMap<string, string>,
  workflow: string,
  triggers: readonly string[],
): readonly BunTestInvocation[] {
  const workingDirectory = workDirOf(block);
  const step = stepName(block);
  const expand = (whole: string, key: string): string => scripts.get(key) ?? whole;
  const hit = (l: string): boolean => !l.trim().startsWith("#") && BUN_TEST.test(l);
  return runScripts(block).flatMap((script) => {
    const lines = script.replace(SCRIPT_REF, expand).split("\n");
    const at = lines.map((line, i) => ({ line, i })).filter((x) => hit(x.line));
    return at.map((x) => {
      const filters = bunTestFilters(joinContinuation(lines, x.i));
      return { workflow, step, workingDirectory, filters, triggers };
    });
  });
}

/**
 * Why a given file is not executed. Four distinct causes, and telling them apart is what
 * makes a finding actionable: a hidden file needs to MOVE, an ignored file needs a bunfig
 * decision, a cadence-only file needs a lane decision, and a file nothing runs needs a
 * filter. The hidden case is checked first because it is a property of the path itself and
 * no lane can fix it.
 */
export function whyNotRun(r: Report, file: string): string {
  const move = "bun cannot discover a dot-prefixed path; move it out of the dot-directory";
  if (isHiddenPath(file)) return move;
  if (r.ignored.has(file)) return "bunfig pathIgnorePatterns hides it from every bun test run";
  const lanes = anyLane(r.invocations, file);
  if (lanes.length > 0) return "runs only in " + lanes.join(", ");
  return "no workflow runs it";
}
