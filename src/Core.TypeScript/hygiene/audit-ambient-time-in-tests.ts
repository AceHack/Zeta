#!/usr/bin/env bun
// audit-ambient-time-in-tests.ts -- no test verdict may depend on wall-clock delay.
//
// WHY THIS FILE EXISTS
// --------------------
// A test that writes `await sleep(10)` and then asserts is not asserting on the code. It is
// asserting that ten milliseconds of wall-clock was enough on THIS machine at THIS moment.
// Under CI contention it is not, and the test goes red with nothing wrong.
//
// MEASURED, which is why this is a class and not an opinion. The 14 tests in
// `src/Core.TypeScript/forge-host/github/poll-pr-gate-batch.test.ts` are pure in-memory --
// injected fakes, `Promise.resolve`, no I/O -- and ran in 1366ms on an idle machine and 5.46s
// on the same machine class under load. A 4x spread on identical code IS the finding. Six
// open PRs were red at exactly the 5000ms per-test budget, and every one of them was a false
// red: the tests that drove assertions with real 5ms/10ms/staggered `setTimeout` delays got
// their callbacks delivered late and unevenly.
//
// IN THIS REPO'S OWN VOCABULARY: a real timer in a test is an UNDECLARED AMBIENT TIME
// CHANNEL. It violates `.claude/rules/dv2-data-split-discipline-activated.md` #4 (DST --
// replays deterministically) and #7 (noninterference -- influence enters ONLY through
// declared, metered channels), and it is the test-suite form of
// `.claude/rules/local-time-never-enters-the-shared-fold.md`. That rule permits local
// wall-clock to steer local behaviour and forbids it from deciding a shared verdict. A test
// verdict is a shared verdict: it is what every other lane reads to decide whether main is
// green.
//
// WHAT IS BANNED, AND WHAT IS NOT
// -------------------------------
//   BANNED   `setTimeout(fn, 50)` / `setInterval(fn, 10)` / `Bun.sleep(300)` in a test file --
//            a NON-ZERO delay. A non-zero delay encodes a guess about machine speed.
//
//   ALLOWED  `setTimeout(fn, 0)` -- a macrotask YIELD. It grants exactly one event-loop turn
//            on a fast machine and exactly one on a loaded one. Deterministic in turns, which
//            is the unit that decides whether queued work has run. A yield is a different
//            construct from a delay and the distinction is the whole rule.
//
//   ALLOWED  an INJECTED fake scheduler -- `{ setInterval: (ms, fn) => { ... } }`. That is the
//            model answer, not the defect: `src/Core.TypeScript/discovery/*` already does it.
//            Property syntax (`setInterval:`) is not a call and is never matched here.
//
//   ALLOWED  `waitUntil` from `src/Core.TypeScript/testing/deterministic-async.ts`, whose
//            internal deadline is an UPPER BOUND ON PATIENCE rather than a synchronization
//            step. That inversion is what makes it safe: a loaded machine makes `waitUntil`
//            wait longer and still pass, where a sleep makes a loaded machine fail. The one
//            sanctioned timer lives in that one reviewed file so it is reviewed once.
//
// THE ALLOWLIST IS A RATCHET, NOT AN ESCAPE HATCH
// -----------------------------------------------
// Some tests genuinely OBSERVE elapsed time -- a smoke bound that a fixed O(seq) regression
// has not returned, a filesystem-retry backoff against a real OS lock. Those are legitimate
// and are named in `registry/wall-clock-test-allowlist.json` with a reason.
//
// The mechanism copies `tests/Tests.FSharp/DeterminismLint.Tests.fs`, which pins EXACT
// occurrence counts, and it copies it for that file's stated reason: an allowlist that says
// only "this file may use timers" lets a seventh sleep slide in behind six justified ones and
// reports green. So every row carries a `count`, the audit fails when the actual count is
// HIGHER (a new violation hiding behind a justified one) and equally when it is LOWER (a stale
// row that has stopped constraining anything). A roster that cannot go red in both directions
// is decoration.
//
// This is deliberately NOT a Semgrep rule and NOT an ESLint rule, though both could match the
// pattern. Their suppression mechanism is an inline `// nosemgrep` / `// eslint-disable-next-
// line` comment: invisible in any roster, addable by the same edit that introduces the
// violation, and reviewable only by whoever happens to read that line. That is precisely the
// silent-swallow this check exists to prevent, so the tool that offers it defeats the check's
// purpose. A count-pinned registry file is the cheapest mechanism that actually decides.
//
// Usage:  bun src/Core.TypeScript/hygiene/audit-ambient-time-in-tests.ts [--root <dir>] [--json]
// Exit 0 = no test verdict depends on wall-clock. Exit 1 = one does, named with its line.

import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export const RULE_ANCHORS = [
  ".claude/rules/dv2-data-split-discipline-activated.md (#4 DST, #7 noninterference)",
  ".claude/rules/local-time-never-enters-the-shared-fold.md",
] as const;

export const ALLOWLIST_PATH = "registry/wall-clock-test-allowlist.json";
export const REMEDY_MODULE = "src/Core.TypeScript/testing/deterministic-async.ts";

/** Directories whose contents are not ours to police. */
const EXCLUDED_PREFIXES = [
  "node_modules/",
  "references/",
  // Recovered orphan branches are an archaeological record, kept verbatim on purpose.
  "docs/recovered-orphan-branches-2026-05/",
];

/** The delaying constructs. `argIndex` is which argument carries the milliseconds. */
const DELAY_FORMS: ReadonlyArray<{ readonly callee: string; readonly argIndex: number }> = [
  { callee: "setTimeout", argIndex: 1 },
  { callee: "setInterval", argIndex: 1 },
  { callee: "Bun.sleep", argIndex: 0 },
  { callee: "Bun.sleepSync", argIndex: 0 },
];

export interface Violation {
  readonly path: string;
  readonly line: number;
  readonly callee: string;
  readonly delay: string;
  readonly text: string;
}

export interface AllowRow {
  readonly path: string;
  readonly callee: string;
  readonly count: number;
  readonly reason: string;
}

// -- the scanner ------------------------------------------------------------------------
//
// Not a regex over the whole call: a regex cannot balance parentheses, so it cannot reliably
// tell `setTimeout(r, 0)` from `setTimeout(() => f(x, 1), 50)`. This walks the argument list
// with a depth counter instead, which is a dozen lines and cannot be wrong about nesting.

/** Split the argument list starting AFTER the open paren at `open`. Returns null if unbalanced. */
export function splitArgs(src: string, open: number): string[] | null {
  const args: string[] = [];
  let depth = 0;
  let start = open + 1;
  let i = open + 1;
  // String / template state -- a comma inside `"a,b"` is not an argument separator.
  let quote: string | null = null;
  let escaped = false;
  for (; i < src.length; i += 1) {
    const c = src[i]!;
    if (quote !== null) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      quote = c;
      continue;
    }
    if (c === "(" || c === "[" || c === "{") depth += 1;
    else if (c === ")" || c === "]" || c === "}") {
      if (c === ")" && depth === 0) {
        args.push(src.slice(start, i));
        return args;
      }
      depth -= 1;
    } else if (c === "," && depth === 0) {
      args.push(src.slice(start, i));
      start = i + 1;
    }
  }
  return null;
}

/** True when the millisecond argument is the literal zero -- a yield, not a delay. */
export function isZeroDelay(arg: string | undefined): boolean {
  if (arg === undefined) return false;
  const t = arg.trim();
  return t === "0" || t === "0.0" || t === "-0";
}

/**
 * `setTimeout` / `setInterval` with NO delay argument at all (`setTimeout(fn)`) is also a
 * yield -- the spec defaults the delay to 0. Treated as zero.
 */
function isOmittedDelay(args: string[], argIndex: number): boolean {
  return args.length <= argIndex;
}

/** Find every non-zero-delay call in one file's source. */
export function scanSource(src: string): Omit<Violation, "path">[] {
  const found: Omit<Violation, "path">[] = [];
  const lineStarts: number[] = [0];
  for (let i = 0; i < src.length; i += 1) if (src[i] === "\n") lineStarts.push(i + 1);
  const lineOf = (offset: number): number => {
    let lo = 0;
    let hi = lineStarts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (lineStarts[mid]! <= offset) lo = mid;
      else hi = mid - 1;
    }
    return lo + 1;
  };

  for (const { callee, argIndex } of DELAY_FORMS) {
    let from = 0;
    for (;;) {
      const at = src.indexOf(callee, from);
      if (at < 0) break;
      from = at + callee.length;

      // Must be a CALL: optional whitespace then `(`. A property (`setInterval:`) or a
      // regex alternation (`setInterval|`) is not a call and is not the defect.
      let j = from;
      while (j < src.length && (src[j] === " " || src[j] === "\t" || src[j] === "\n")) j += 1;
      if (src[j] !== "(") continue;

      // Must not be a longer identifier ending in our callee (`mySetTimeout(`), and must not
      // be a member access we did not name (`sched.setTimeout(` is an INJECTED scheduler).
      const before = at > 0 ? src[at - 1]! : " ";
      if (/[A-Za-z0-9_$.]/.test(before) && !callee.includes(".")) continue;

      const args = splitArgs(src, j);
      if (args === null) continue; // unbalanced -- cannot judge, do not guess
      if (isOmittedDelay(args, argIndex)) continue;
      const delayArg = args[argIndex];
      if (isZeroDelay(delayArg)) continue;

      const line = lineOf(at);
      const lineText = src.slice(lineStarts[line - 1]!, lineStarts[line] ?? src.length).replace(/\n$/, "");
      found.push({
        line,
        callee,
        delay: (delayArg ?? "").trim().slice(0, 60),
        text: lineText.trim().slice(0, 160),
      });
    }
  }
  found.sort((a, b) => a.line - b.line || (a.callee < b.callee ? -1 : a.callee > b.callee ? 1 : 0));
  return found;
}

// -- file enumeration -------------------------------------------------------------------

export function testFiles(root: string): string[] {
  const out = execFileSync("git", ["ls-files", "--", "*.test.ts", "*.test.tsx"], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  return out
    .split("\n")
    .filter((p) => p.length > 0)
    .filter((p) => !EXCLUDED_PREFIXES.some((pre) => p.startsWith(pre)));
}

// -- the audit --------------------------------------------------------------------------

export interface AuditResult {
  readonly scannedFiles: number;
  readonly violations: Violation[];
  /** Rows whose pinned count disagrees with reality -- stale OR overtaken. */
  readonly countDrift: string[];
  /** Rows naming a file that no longer exists. */
  readonly deadRows: string[];
  readonly unallowed: Violation[];
}

export function audit(root: string, allowlist: readonly AllowRow[]): AuditResult {
  const files = testFiles(root);
  const violations: Violation[] = [];
  for (const rel of files) {
    const abs = join(root, rel);
    if (!existsSync(abs)) continue;
    const src = readFileSync(abs, "utf8");
    for (const v of scanSource(src)) violations.push({ path: rel, ...v });
  }

  const key = (p: string, c: string): string => `${p} ${c}`;
  const actual = new Map<string, number>();
  for (const v of violations) actual.set(key(v.path, v.callee), (actual.get(key(v.path, v.callee)) ?? 0) + 1);

  const allowed = new Set<string>();
  const countDrift: string[] = [];
  const deadRows: string[] = [];
  for (const row of allowlist) {
    allowed.add(key(row.path, row.callee));
    if (!existsSync(join(root, row.path))) {
      deadRows.push(`${ALLOWLIST_PATH}: row for '${row.path}' names a file that does not exist -- remove the row`);
      continue;
    }
    const found = actual.get(key(row.path, row.callee)) ?? 0;
    if (found !== row.count) {
      countDrift.push(
        `${row.path}: '${row.callee}' with a non-zero delay occurs ${found} time(s), the allowlist pins ${row.count}` +
          (found > row.count
            ? ` -- a NEW wall-clock dependency is hiding behind a justified one. Fix it, or bump the count with a reason a reviewer can refuse.`
            : ` -- stale row, no longer constraining anything. Lower the count or delete the row.`),
      );
    }
  }

  const unallowed = violations.filter((v) => !allowed.has(key(v.path, v.callee)));
  return { scannedFiles: files.length, violations, countDrift, deadRows, unallowed };
}

export function loadAllowlist(root: string): AllowRow[] {
  const p = join(root, ALLOWLIST_PATH);
  if (!existsSync(p))
    throw new Error(`${ALLOWLIST_PATH} is missing -- the audit refuses to pass with no roster to check against`);
  const parsed: unknown = JSON.parse(readFileSync(p, "utf8"));
  if (!Array.isArray(parsed)) throw new Error(`${ALLOWLIST_PATH} must be a JSON array`);
  return parsed.map((raw, i) => {
    const r = raw as Partial<AllowRow>;
    if (typeof r.path !== "string" || r.path.length === 0) throw new Error(`${ALLOWLIST_PATH}[${i}]: missing 'path'`);
    if (typeof r.callee !== "string" || r.callee.length === 0)
      throw new Error(`${ALLOWLIST_PATH}[${i}]: missing 'callee'`);
    if (typeof r.count !== "number" || !Number.isInteger(r.count) || r.count < 1)
      throw new Error(`${ALLOWLIST_PATH}[${i}]: 'count' must be a positive integer`);
    // A row with no reason is a row nobody can refuse. 40 chars is not a bar, it is a floor.
    if (typeof r.reason !== "string" || r.reason.trim().length < 40)
      throw new Error(
        `${ALLOWLIST_PATH}[${i}] (${r.path}): 'reason' must say WHY this test genuinely observes elapsed ` +
          `time, in at least 40 characters. An unreasoned row is an escape hatch.`,
      );
    return { path: r.path, callee: r.callee, count: r.count, reason: r.reason };
  });
}

function main(argv: string[]): number {
  const rootFlag = argv.indexOf("--root");
  const root =
    rootFlag >= 0 && argv[rootFlag + 1] !== undefined
      ? argv[rootFlag + 1]!
      : execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
  const asJson = argv.includes("--json");

  let allowlist: AllowRow[];
  try {
    allowlist = loadAllowlist(root);
  } catch (e) {
    console.error(`FAIL: ${(e as Error).message}`);
    return 1;
  }

  const r = audit(root, allowlist);

  if (asJson) console.log(JSON.stringify(r, null, 2));

  // LIVENESS. "Scanned 0 files" must never read as success -- the same floor every other audit
  // in this directory applies to itself. A check that inspected nothing did not pass.
  if (r.scannedFiles < 100) {
    console.error(
      `FAIL: scanned only ${r.scannedFiles} test files. This repo has hundreds; a near-empty scan means the ` +
        `enumeration broke, and a check that inspected nothing is not a check that passed.`,
    );
    return 1;
  }

  const problems: string[] = [...r.deadRows, ...r.countDrift];
  for (const v of r.unallowed) {
    problems.push(
      `${v.path}:${v.line}: ${v.callee}(..., ${v.delay}) -- a non-zero wall-clock delay in a test.\n` +
        `    ${v.text}\n` +
        `    This makes the verdict depend on machine load. Replace it with a barrier or a condition-poll\n` +
        `    from ${REMEDY_MODULE}:\n` +
        `      deferred()   -- the code under test SIGNALS; the test AWAITS. Zero timers. Prefer this.\n` +
        `      waitUntil()  -- poll until the property holds, deadline as an upper bound on patience.\n` +
        `      yieldTurns() -- n macrotask turns; a zero-delay yield is load-independent and stays allowed.\n` +
        `    If this test genuinely OBSERVES elapsed time, add a counted row to ${ALLOWLIST_PATH}.`,
    );
  }

  if (problems.length > 0) {
    console.error(`FAIL: ${problems.length} problem(s) across ${r.scannedFiles} test files.\n`);
    for (const p of problems) console.error(p + "\n");
    console.error(`Rule anchors: ${RULE_ANCHORS.join(" | ")}`);
    return 1;
  }

  console.log(
    `OK: ${r.scannedFiles} test files scanned; no test verdict depends on wall-clock delay. ` +
      `${r.violations.length} elapsed-time observation(s) named and counted in ${ALLOWLIST_PATH}.`,
  );
  return 0;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
