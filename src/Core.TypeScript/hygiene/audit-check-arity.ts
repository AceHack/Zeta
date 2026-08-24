#!/usr/bin/env bun
// audit-check-arity.ts -- a check may not claim a property of higher arity than it tests.
//
// WHY THIS FILE EXISTS
// --------------------
// Noninterference is not a PROPERTY, it is a HYPERPROPERTY: a predicate over PAIRS of
// executions, and specifically 2-safety (Clarkson & Schneider, "Hyperproperties",
// CSF 2008 / J. Computer Security 18(6):1157, 2010). The consequence is a theorem rather
// than an opinion:
//
//     No monitor observing a SINGLE execution can decide noninterference.
//
// Manifesto s13 IS noninterference. So every single-run test of it is provably incomplete --
// by construction, not by oversight. The same holds for determinism, non-malleability, and
// every "X does not influence Y" claim.
//
// THE CLASS, stated so it can be searched for:
//
//     A CHECK WHOSE ARITY IS LOWER THAN THE ARITY OF THE PROPERTY IT CLAIMS.
//
// Self-comparison (`X = X`) is its most VISIBLE form and not its definition. A grep for
// `X = X` finds syntactic self-comparisons and MISSES two calls with identical arguments
// bound to different names, and a helper invoked twice with the same input. The live
// instance that proved the point: `tests/Tests.FSharp/Properties/Policy.Relocation.Tests.fs`
// bound `localResult` and `centralResult` to the SAME value and compared them across 1000
// FsCheck cases -- a property test that could not fail, invisible to any `X = X` grep.
//
// WHAT THIS FILE CHECKS, AND WHY IT IS TWO RULES
// ----------------------------------------------
// Arity is a property of a check's SIGNATURE, not of its body. The semantic question -- "does
// the function this check computes actually depend on more than one execution?" -- is
// UNDECIDABLE (Rice 1953: "independent of coordinate j" is a non-trivial extensional property
// of partial computable functions). So arity must be DECLARED and over-approximated
// statically, never inferred. Runtime read-set tracing is specifically NOT sound here: an
// observed read-set on one input is neither an upper nor a lower bound on dependence across
// all inputs.
//
// The declaration this file reads is the one every test already carries: ITS NAME.
//
//   R1 (GATE, no drift permitted without a counted row)
//     A test whose NAME declares independence of a named variable -- "noninterference",
//     "regardless of", "independent of", "no <X> input", "holds no <X>", "invariant under",
//     "pure function of" -- must not resolve to a self-comparison. If its two sides normalize
//     to the same expression, the quantified variable was held FIXED, and the check has
//     arity 1 against an arity-2 claim.
//
//   R3 (ORPHAN TEST FILES -- arity ZERO)
//     An `.fs` file under `tests/` that no `.fsproj` compiles is not a weak check, it is NO check.
//     `tests/Tests.FSharp/Properties/Policy.Relocation.Tests.fs` was added by #2329, claimed
//     "1000+ inputs via FsCheck default" in its own header, was never listed in
//     `Tests.FSharp.fsproj`, and therefore ran zero times -- while its single property was a
//     name-bound self-comparison that could not have failed even if it had run. Arity zero is the
//     floor of this class and it is the cheapest member to detect: a file reference either exists
//     or it does not.
//
//   R2 (CENSUS RATCHET)
//     Every self-comparison in the test tree is counted per file against
//     `registry/check-arity-census.json`. The audit fails when a file's count goes UP (a new
//     one hiding behind adjudicated ones) and equally when it goes DOWN (a stale row that has
//     stopped constraining anything). Mechanism and rationale copied from
//     `audit-ambient-time-in-tests.ts` and `tests/Tests.FSharp/DeterminismLint.Tests.fs`.
//
// WHY R2 IS A CENSUS AND NOT A BAN
// --------------------------------
// Most self-comparisons in this tree are CORRECT and must be left alone. Three separate
// legitimate shapes, all measured in the 2026-08-23 sweep:
//
//   * determinism / DST replay -- `f x = f x` evaluated twice IS two executions, so the
//     arity matches the claim. It is a WEAK member of the arity-2 class (the pair is
//     separated by microseconds in one process, so it cannot see cross-process
//     nondeterminism) but it is honestly named and it can fail.
//   * mutation-mediated -- `let before = step f` / `lookAhead f` / `let after = step f`.
//     The two sides are textually identical and the executions differ in what happened
//     between them. That IS the varied dimension.
//   * separately-constructed equal values -- `DvKey.ofValue row` twice, then asserting the
//     keys are equal. Textual identity is the POINT of the property.
//
// Rounding those up to "vacuous" would be the same error in the opposite direction. So the
// census counts them and does not judge them; R1 judges only the name/body mismatch.
//
// ANCHORS
//   Clarkson & Schneider, Hyperproperties, CSF 2008 / JCS 18(6):1157 (2010) -- k-safety.
//   Goguen & Meseguer, Security Policies and Security Models, IEEE S&P 1982 -- noninterference.
//   Rice, Classes of recursively enumerable sets and their decision problems, TAMS 74 (1953).
//   docs/research/2026-08-23-local-to-global-obstruction-byte-lock-is-h0-not-h1-and-the-arity-gap-is-the-shippable-linter-lumen.md s5
//   workitems/081M0RAX8AC087G0R003NQM7P9-*.md -- the sweep that produced the census.

import { type Dirent, readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

export const RULE_ANCHORS = [
  ".claude/rules/dv2-data-split-discipline-activated.md #7 (noninterference)",
  ".claude/rules/manifesto-13-specifications.md s13",
  ".claude/rules/toy-is-free-metered-must-be-earned.md",
];

export const CENSUS_PATH = "registry/check-arity-census.json";

// ---------------------------------------------------------------------------
// lexing helpers -- comment- and string-aware, because a `//` inside a string
// literal is not a comment and a `(` inside one does not open a group.
// ---------------------------------------------------------------------------

export function stripComments(line: string, lang: "fs" | "ts"): string {
  let out = "";
  let inStr: string | null = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (inStr) {
      out += c;
      if (c === "\\") {
        if (i + 1 < line.length) {
          out += line[i + 1];
          i++;
        }
        continue;
      }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      inStr = c;
      out += c;
      continue;
    }
    if (c === "/" && line[i + 1] === "/") break;
    if (lang === "fs" && c === "(" && line[i + 1] === "*") break;
    out += c;
  }
  return out;
}

function scanDelims(s: string, onChar: (c: string) => void): void {
  let inStr: string | null = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (inStr) {
      if (c === "\\") i++;
      else if (c === inStr) inStr = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      inStr = c;
      continue;
    }
    onChar(c);
  }
}

export function balanced(s: string): boolean {
  let depth = 0;
  scanDelims(s, (c) => {
    if ("([{".includes(c)) depth++;
    if (")]}".includes(c)) depth--;
  });
  return depth === 0;
}

export function braceDelta(s: string): number {
  let d = 0;
  scanDelims(s, (c) => {
    if (c === "{") d++;
    if (c === "}") d--;
  });
  return d;
}

/** Collapse an expression to a comparison key: whitespace-free, one layer of wrapping parens off. */
export function norm(e: string): string {
  return e
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\((.*)\)$/, "$1")
    .replace(/\s+/g, "");
}

const MAX_EXPANSION = 3000;

/** Transitively inline let/const bindings so NAME-BOUND self-comparison becomes visible. */
export function substitute(expr: string, bindings: Map<string, string>, depth = 0): string {
  if (depth > 6 || expr.length > MAX_EXPANSION) return expr;
  let changed = false;
  const out = expr.replace(/[A-Za-z_][A-Za-z0-9_']*/g, (m) => {
    const r = bindings.get(m);
    if (r !== undefined && norm(r) !== norm(m)) {
      changed = true;
      return "(" + r + ")";
    }
    return m;
  });
  if (out.length > MAX_EXPANSION) return expr;
  return changed ? substitute(out, bindings, depth + 1) : out;
}

/** Split at the first TOP-LEVEL occurrence of any operator in `ops`. */
export function splitTop(s: string, ops: readonly string[]): [string, string, string] | null {
  let depth = 0;
  let inStr: string | null = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (inStr) {
      if (c === "\\") i++;
      else if (c === inStr) inStr = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      inStr = c;
      continue;
    }
    if ("([{".includes(c)) {
      depth++;
      continue;
    }
    if (")]}".includes(c)) {
      depth--;
      continue;
    }
    if (depth !== 0) continue;
    for (const op of ops) {
      if (!s.startsWith(op, i)) continue;
      const before = s[i - 1] ?? " ";
      const after = s[i + op.length] ?? " ";
      if (/[=<>!&|+\-*/%^~]/.test(before)) continue;
      if (/[=<>!&|+\-*/%^~]/.test(after)) continue;
      return [s.slice(0, i), s.slice(i + op.length), op];
    }
  }
  return null;
}

/** Top-level comma-separated arguments of the FIRST balanced paren group in `call`. */
export function argsOf(call: string): string[] | null {
  const i = call.indexOf("(");
  if (i < 0) return null;
  let depth = 0;
  let inStr: string | null = null;
  let start = i + 1;
  const args: string[] = [];
  for (let k = i; k < call.length; k++) {
    const c = call[k]!;
    if (inStr) {
      if (c === "\\") k++;
      else if (c === inStr) inStr = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      inStr = c;
      continue;
    }
    if ("([{".includes(c)) {
      depth++;
      continue;
    }
    if (")]}".includes(c)) {
      depth--;
      if (depth === 0) {
        args.push(call.slice(start, k));
        return args;
      }
      continue;
    }
    if (c === "," && depth === 1) {
      args.push(call.slice(start, k));
      start = k + 1;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// R1 -- the 2-safety NAME vocabulary. A test name is a DECLARATION of the
// property's arity; this is the only declaration channel that already exists.
// ---------------------------------------------------------------------------

export const TWO_SAFETY_NAME_PATTERNS: readonly { readonly re: RegExp; readonly claim: string }[] = [
  { re: /noninterference/i, claim: "noninterference (2-safety by definition)" },
  { re: /regardless of/i, claim: "independence of a named variable" },
  { re: /independent(?:ly)? of\b/i, claim: "independence of a named variable" },
  { re: /\b[a-z]+-independent\b/i, claim: "independence of a named variable" },
  { re: /\bholds no\b/i, claim: "absence of an ambient channel" },
  { re: /\bno [a-z]+ input\b/i, claim: "absence of an ambient channel" },
  { re: /\bzero clocks?\b/i, claim: "absence of an ambient channel" },
  { re: /\binvariant under\b/i, claim: "invariance under a named variation" },
  { re: /\bdoes not depend on\b/i, claim: "independence of a named variable" },
  { re: /\bpure function of\b/i, claim: "dependence on the declared input only" },
  { re: /\bquarantine\b/i, claim: "entropy quarantine (noninterference)" },
];

/** Does this test name DECLARE a property that quantifies over pairs of executions? */
export function declaresTwoSafety(unitName: string): string | null {
  for (const p of TWO_SAFETY_NAME_PATTERNS) if (p.re.test(unitName)) return p.claim;
  return null;
}

// ---------------------------------------------------------------------------
// the scanners
// ---------------------------------------------------------------------------

export interface Comparison {
  readonly path: string;
  readonly line: number;
  readonly unit: string;
  readonly kind: string;
  readonly lhs: string;
  readonly rhs: string;
  readonly normalized: string;
  readonly form: "syntactic" | "name-bound";
}

const FS_ATTR = /^\s*\[<\s*(?:Fact|Property|Theory|InlineData|MemberData|ClassData|Trait)/;
const FS_ASSERT_EQ = /\b(Assert\.(?:Equal|StrictEqual|Same)(?:<[^()]*>)?)\s*\(/;

export function scanFsharp(path: string, text: string): Comparison[] {
  const lines = text.split("\n");
  const hits: Comparison[] = [];
  const globalB = new Map<string, string>();
  let localB = new Map<string, string>();
  let unit = "<module>";
  let braceDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i]!;
    if (FS_ATTR.test(rawLine)) {
      localB = new Map();
      unit = "<pending>";
      continue;
    }
    const stripped = stripComments(rawLine, "fs");
    const openBraces = braceDepth > 0;
    braceDepth += braceDelta(stripped);
    if (braceDepth < 0) braceDepth = 0;
    if (!stripped.trim()) continue;

    let joined = stripped;
    let j = i;
    while (!balanced(joined) && j + 1 < lines.length && j - i < 25) {
      j++;
      joined += " " + stripComments(lines[j]!, "fs");
    }

    const trimmed = joined.trim();
    const indent = joined.length - joined.trimStart().length;

    const nameMatch = trimmed.match(/^(?:let|and)\s+(?:rec\s+)?(?:private\s+)?(``[^`]+``|[A-Za-z_][A-Za-z0-9_']*)/);
    if (nameMatch && unit === "<pending>") unit = nameMatch[1]!.replace(/`/g, "");

    const bind = trimmed.match(
      /^(?:let|and)\s+(?:mutable\s+)?(?:private\s+)?([A-Za-z_][A-Za-z0-9_']*)\s*(?::\s*[^=]+)?=\s*(.+)$/,
    );
    if (bind) {
      const name = bind[1]!;
      const rhs = bind[2]!.trim();
      const selfRef = new RegExp("\\b" + name.replace(/[$.*+?^{}()|[\]\\]/g, "\\$&") + "\\b").test(rhs);
      if (!selfRef && rhs.length > 0 && rhs.length < 400) (indent === 0 ? globalB : localB).set(name, rhs);
    }

    const bindings = new Map([...globalB, ...localB]);
    const record = (kind: string, lhs: string, rhs: string): void => {
      const nl = norm(substitute(lhs, bindings));
      const nr = norm(substitute(rhs, bindings));
      if (!nl || !nr || nl !== nr) return;
      if (/^\d+$/.test(nl)) return;
      hits.push({
        path,
        line: i + 1,
        unit,
        kind,
        lhs: lhs.trim(),
        rhs: rhs.trim(),
        normalized: nl.slice(0, 200),
        form: norm(lhs) === norm(rhs) ? "syntactic" : "name-bound",
      });
    };

    const am = trimmed.match(FS_ASSERT_EQ);
    if (am) {
      const call = trimmed.slice(trimmed.indexOf(am[1]!) + am[1]!.length);
      const args = argsOf(call);
      if (args && args.length >= 2) record(am[1]!, args[0]!, args[1]!);
    }

    // A record / anonymous-record literal is field syntax, not a comparison: `Payload = Payload`
    // names a field with a value in scope. Skip while a brace group is open.
    if (openBraces || /^\s*\{/.test(trimmed) || braceDepth > 0) continue;

    let candidate = bind ? bind[2]!.trim() : trimmed;
    if (/^(?:type|member|module|open|namespace|\[<|\||override|abstract|interface|inherit|do|new)\b/.test(candidate)) {
      continue;
    }
    const parts: string[] = [];
    let rest = candidate;
    for (let guard = 0; guard < 12; guard++) {
      const bs = splitTop(rest, [" && ", " || "]);
      if (!bs) break;
      parts.push(bs[0]!);
      rest = bs[1]!;
    }
    parts.push(rest);
    for (const part of parts) {
      const sp = splitTop(part, [" = "]);
      if (!sp) continue;
      record("bare=", sp[0]!, sp[1]!);
    }
  }
  return hits;
}

const TS_UNIT = /^\s*(?:it|test)(?:\.\w+)?\s*\(\s*["'`](.+?)["'`]/;

export function scanTypeScript(path: string, text: string): Comparison[] {
  const lines = text.split("\n");
  const hits: Comparison[] = [];
  let bindings = new Map<string, string>();
  let unit = "<module>";

  for (let i = 0; i < lines.length; i++) {
    const stripped = stripComments(lines[i]!, "ts");
    if (!stripped.trim()) continue;

    const um = stripped.match(TS_UNIT);
    if (um) {
      unit = um[1]!;
      bindings = new Map();
      continue; // never join a test-declaration line: its body binds names of its own
    }
    if (/^\s*describe(?:\.\w+)?\s*\(/.test(stripped)) continue;

    let joined = stripped;
    let j = i;
    while (!balanced(joined) && j + 1 < lines.length && j - i < 25) {
      j++;
      const next = lines[j]!;
      if (TS_UNIT.test(next)) break;
      joined += " " + stripComments(next, "ts");
    }
    const trimmed = joined.trim();

    const bind = trimmed.match(/^(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::\s*[^=]+)?=\s*(.+?);?$/);
    if (bind) {
      const name = bind[1]!;
      const rhs = bind[2]!.trim();
      const selfRef = new RegExp("\\b" + name.replace(/[$.*+?^{}()|[\]\\]/g, "\\$&") + "\\b").test(rhs);
      if (!selfRef && rhs.length > 0 && rhs.length < 400) bindings.set(name, rhs);
    }

    const record = (kind: string, lhs: string, rhs: string): void => {
      const nl = norm(substitute(lhs, bindings));
      const nr = norm(substitute(rhs, bindings));
      if (!nl || !nr || nl !== nr) return;
      if (/^\d+$/.test(nl)) return;
      hits.push({
        path,
        line: i + 1,
        unit,
        kind,
        lhs: lhs.trim(),
        rhs: rhs.trim(),
        normalized: nl.slice(0, 200),
        form: norm(lhs) === norm(rhs) ? "syntactic" : "name-bound",
      });
    };

    if (/\bexpect\s*\(/.test(trimmed)) {
      const call = trimmed.slice(trimmed.indexOf("expect") + "expect".length);
      const args = argsOf(call);
      if (args && args.length === 1) {
        const after = call.slice(call.indexOf(args[0]!) + args[0]!.length);
        // `.not.` inverts the assertion: a self-comparison there ALWAYS fails, a different defect.
        const mm = after.match(/^\)\s*(?:\.\s*(?:resolves|rejects)\s*)*\.\s*(toBe|toEqual|toStrictEqual)\s*\(/);
        if (mm) {
          const tail = after.slice(after.indexOf(mm[1]!) + mm[1]!.length);
          const a2 = argsOf(tail);
          if (a2 && a2.length >= 1) record("expect." + mm[1]!, args[0]!, a2[0]!);
        }
      }
    }
    const am = trimmed.match(/\b(assert\.(?:equal|strictEqual|deepEqual|deepStrictEqual))\s*\(/);
    if (am) {
      const call = trimmed.slice(trimmed.indexOf(am[1]!) + am[1]!.length);
      const args = argsOf(call);
      if (args && args.length >= 2) record(am[1]!, args[0]!, args[1]!);
    }
  }
  return hits;
}

export function scanSource(path: string, text: string): Comparison[] {
  if (path.endsWith(".fs") || path.endsWith(".fsx")) return scanFsharp(path, text);
  if (/\.(?:test|spec)\.(?:ts|tsx|mts)$/.test(path)) return scanTypeScript(path, text);
  return [];
}

// ---------------------------------------------------------------------------
// audit
// ---------------------------------------------------------------------------

export interface Census {
  readonly note?: string;
  readonly counts: Record<string, number>;
}

export interface AuditResult {
  readonly scannedFiles: number;
  readonly comparisons: readonly Comparison[];
  readonly twoSafetyViolations: readonly (Comparison & { readonly claim: string })[];
  readonly censusRose: readonly { readonly path: string; readonly was: number; readonly now: number }[];
  readonly censusFell: readonly { readonly path: string; readonly was: number; readonly now: number }[];
}

/**
 * R3 -- F# sources under `tests/` that no project file compiles.
 *
 * `<Compile Include="..." />` paths are relative to the .fsproj's own directory, so each project's
 * includes are resolved against it before comparison. A file nothing compiles has arity zero: it
 * cannot fail, cannot pass, and reads as coverage in every file listing.
 */
export function findOrphanTestSources(
  fsharpFiles: readonly string[],
  projects: readonly { readonly path: string; readonly text: string }[],
): string[] {
  const compiled = new Set<string>();
  for (const proj of projects) {
    const dir = proj.path.includes("/") ? proj.path.slice(0, proj.path.lastIndexOf("/")) : "";
    for (const m of proj.text.matchAll(/<Compile\s+Include\s*=\s*"([^"]+)"/g)) {
      const rel = m[1]!.replace(/\\/g, "/");
      compiled.add(dir ? `${dir}/${rel}` : rel);
    }
  }
  return fsharpFiles.filter((f) => !compiled.has(f)).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

export function auditSources(
  sources: readonly { readonly path: string; readonly text: string }[],
  census: Census,
): AuditResult {
  const comparisons: Comparison[] = [];
  for (const s of sources) comparisons.push(...scanSource(s.path, s.text));

  const twoSafetyViolations = comparisons.flatMap((c) => {
    const claim = declaresTwoSafety(c.unit);
    return claim === null ? [] : [{ ...c, claim }];
  });

  const now = new Map<string, number>();
  for (const c of comparisons) now.set(c.path, (now.get(c.path) ?? 0) + 1);

  const censusRose: { path: string; was: number; now: number }[] = [];
  const censusFell: { path: string; was: number; now: number }[] = [];
  const paths = new Set([...Object.keys(census.counts), ...now.keys()]);
  for (const p of paths) {
    const was = census.counts[p] ?? 0;
    const isNow = now.get(p) ?? 0;
    if (isNow > was) censusRose.push({ path: p, was, now: isNow });
    else if (isNow < was) censusFell.push({ path: p, was, now: isNow });
  }
  // ORDINAL, deliberately not `localeCompare`: the census is a diffable, byte-locked artefact and a
  // locale-dependent order would make the same tree emit different files on different machines.
  // `.claude/rules/culture-invariant-by-default.md`, whose live failure
  // 081KT07NV0008QG0R001YDB73K is the same bug this file's own PolicyRelocation property now guards.
  const byPath = (a: { path: string }, b: { path: string }): number => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  censusRose.sort(byPath);
  censusFell.sort(byPath);

  return { scannedFiles: sources.length, comparisons, twoSafetyViolations, censusRose, censusFell };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const SCAN_ROOTS = ["tests"] as const;

/**
 * One syscall per directory, no check-then-use window.
 *
 * `withFileTypes` returns each entry's KIND with the listing, so there is no second `statSync`
 * that could observe a different filesystem than the `readdirSync` did (the readdir-then-stat
 * race `lint-check-then-use-file-races.ts` forbids). ENOENT is interpreted from the listing call
 * itself rather than pre-tested with `existsSync`; any other error is RETHROWN, because a scanner
 * that swallows EACCES and reports a smaller file set is a check quietly narrowing its own scope.
 *
 * Deliberately NOT `d.isFile()`, which the linter suggests: that silently DROPS every non-regular
 * entry the previous `statSync` branch accepted, which is a scope change wearing a correctness fix.
 * The predicate stays "directory => recurse, anything else => candidate", exactly as before.
 *
 * ONE semantic difference, MEASURED rather than assumed, because a "fix" that quietly scans less
 * would look green and this scanner is the thing that would have to notice. `Dirent.isDirectory()`
 * does not follow symlinks where `statSync` did, so a symlinked DIRECTORY is emitted as a path
 * instead of traversed. Running both walks side by side over `tests/` on 2026-08-23:
 *
 *   raw paths        old=1222  new=1128  only-old=95  only-new=1
 *   SCANNED set      old=754   new=754   only-old=0   only-new=0   (identical both directions)
 *
 * All 95 are `.txt` inside `tests/cross-verification/experience/fixtures/tree1/subdir1/`, whose
 * `link_to_parent -> ..` is a deliberate symlink CYCLE. The old walk descended it and terminated
 * only when the OS returned ELOOP; the new one lists the link once and stops. So the difference is
 * real, is an improvement, and does not touch a single file this audit actually reads. The floor
 * below is what keeps that claim checkable rather than a one-time observation.
 */
function walk(dir: string, out: string[] = []): string[] {
  let entries: Dirent[];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return out;
    throw e;
  }
  for (const d of entries) {
    if (d.name === "node_modules" || d.name === ".git" || d.name === "bin" || d.name === "obj") continue;
    const p = join(dir, d.name);
    if (d.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

/**
 * MIN_SCANNED_FILES -- a floor, because a scanner with no floor cannot report its own narrowing.
 * `tests/` held 754 scannable files on 2026-08-23. If a future walk change silently stops
 * descending somewhere, the census would go quiet and every rule would pass by seeing nothing.
 * This is the one number that makes that failure loud. Raise it when the tree genuinely grows.
 */
export const MIN_SCANNED_FILES = 700;

function collect(repoRoot: string): { path: string; text: string }[] {
  const out: { path: string; text: string }[] = [];
  for (const root of SCAN_ROOTS) {
    for (const f of walk(join(repoRoot, root))) {
      const rel = relative(repoRoot, f).split(sep).join("/");
      if (!/\.fsx?$/.test(rel) && !/\.(?:test|spec)\.(?:ts|tsx|mts)$/.test(rel)) continue;
      out.push({ path: rel, text: readFileSync(f, "utf8") });
    }
  }
  return out;
}

export function main(argv: readonly string[]): number {
  const repoRoot = process.cwd();
  const sources = collect(repoRoot);

  if (argv.includes("--emit-census")) {
    const counts: Record<string, number> = {};
    for (const s of sources) for (const c of scanSource(s.path, s.text)) counts[c.path] = (counts[c.path] ?? 0) + 1;
    const ordered: Record<string, number> = {};
    // Default Array.sort compares by UTF-16 code unit, i.e. ordinal -- the property the census needs.
    const keys = Object.keys(counts).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    for (const k of keys) ordered[k] = counts[k]!;
    console.log(JSON.stringify({ note: "generated by audit-check-arity.ts --emit-census", counts: ordered }, null, 2));
    return 0;
  }

  let census: Census;
  try {
    census = JSON.parse(readFileSync(join(repoRoot, CENSUS_PATH), "utf8")) as Census;
  } catch (e) {
    console.error(`FAIL: cannot read ${CENSUS_PATH}: ${String(e)}`);
    return 1;
  }

  if (sources.length < MIN_SCANNED_FILES) {
    console.error(
      `FAIL: scanned only ${sources.length} test file(s), below the ${MIN_SCANNED_FILES} floor.\n` +
        `    A scanner that quietly stops descending reports a clean census by seeing nothing, which is\n` +
        `    this file's own subject: a check that cannot fail. Fix the walk or move the floor deliberately.`,
    );
    return 1;
  }

  const r = auditSources(sources, census);
  const problems: string[] = [];

  const projects = walk(join(repoRoot, "tests"))
    .filter((f) => /\.(?:fs|cs)proj$/.test(f))
    .map((f) => ({ path: relative(repoRoot, f).split(sep).join("/"), text: readFileSync(f, "utf8") }));
  const fsharpUnderTests = sources.map((s) => s.path).filter((p) => /\.fs$/.test(p));
  for (const orphan of findOrphanTestSources(fsharpUnderTests, projects)) {
    problems.push(
      `${orphan}: R3 -- an F# test source that no .fsproj compiles. It runs ZERO times.\n` +
        `    A check nothing builds is arity 0: it cannot fail, cannot pass, and still reads as coverage\n` +
        `    in every listing. Add a <Compile Include> row for it, or delete it.`,
    );
  }

  for (const v of r.twoSafetyViolations) {
    problems.push(
      `${v.path}:${v.line}: R1 -- the test name declares ${v.claim}, and the check is a self-comparison.\n` +
        `    test : ${v.unit}\n` +
        `    lhs  : ${v.lhs}\n` +
        `    rhs  : ${v.rhs}\n` +
        `    both sides normalize to: ${v.normalized}\n` +
        `    A 2-safety claim needs TWO executions that differ in the variable whose influence is denied.\n` +
        `    Either raise the arity (vary that variable at a surface that can see it) or lower the claim\n` +
        `    (rename the test to what it actually checks). Deleting a check that cannot fail is also fine.`,
    );
  }
  for (const d of r.censusRose) {
    problems.push(
      `${d.path}: R2 -- self-comparison count rose ${d.was} -> ${d.now}.\n` +
        `    A new check whose two sides normalize to one expression. Adjudicate it (vacuous / near-vacuous /\n` +
        `    correct) and, if it is correct, raise the count in ${CENSUS_PATH} in the SAME commit.`,
    );
  }
  for (const d of r.censusFell) {
    problems.push(
      `${d.path}: R2 -- self-comparison count fell ${d.was} -> ${d.now}.\n` +
        `    Good news that must be recorded: lower the count in ${CENSUS_PATH} so the row keeps constraining.`,
    );
  }

  if (problems.length > 0) {
    console.error(`FAIL: ${problems.length} problem(s) across ${r.scannedFiles} scanned test files.\n`);
    for (const p of problems) console.error(p + "\n");
    console.error(`Rule anchors: ${RULE_ANCHORS.join(" | ")}`);
    return 1;
  }

  console.log(
    `OK: ${r.scannedFiles} test files scanned; ${r.comparisons.length} self-comparison(s) counted in ${CENSUS_PATH}; ` +
      `0 of them sit under a name that declares a 2-safety property; every F# test source is compiled by a project.`,
  );
  return 0;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
