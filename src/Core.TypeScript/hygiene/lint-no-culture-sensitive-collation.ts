#!/usr/bin/env bun
/**
 * lint-no-culture-sensitive-collation.ts — refuse culture-SENSITIVE comparison and
 * formatting in TypeScript.
 *
 * WHY THIS LINT EXISTS AT ALL — THE STRUCTURAL ASYMMETRY
 * ------------------------------------------------------------------------
 * `.claude/rules/culture-invariant-by-default.md` is enforced for C# at
 * **compiler-error level**: `.editorconfig` sets CA1304, CA1305, CA1307, CA1310
 * and CA2007 to `error`, so a culture-sensitive comparison in C# cannot reach
 * `main` — the build refuses it. TypeScript has **no equivalent analyzer**, so
 * `localeCompare` and its siblings have been entirely unguarded on that side.
 *
 * That asymmetry, not carelessness, is why these keep reappearing: the same rule
 * is a wall in one language and a suggestion in another. A sweep that only
 * removes today's instances does not close it. This lint is the wall.
 *
 * WHY A SCAN FOR IDENTIFIERS IS SUFFICIENT (AND NOT LAZY)
 * ------------------------------------------------------------------------
 * The dangerous set is **a closed list of named APIs**, not a semantic property:
 * `localeCompare`, `Intl.Collator`, `Intl.DateTimeFormat`, `Intl.NumberFormat`,
 * `toLocaleLowerCase`, `toLocaleUpperCase`, `toLocaleString`,
 * `toLocaleDateString`, `toLocaleTimeString`. Every one of them consults a
 * runtime locale (and, for the `Intl` family, an ICU version) that differs
 * between machines. So this linter is not approximating a judgement — it bans
 * specific identifiers, which is exactly what a scanner is good at, and is why
 * it can be honest rather than heuristic.
 *
 * WHAT IS DELIBERATELY **NOT** A TARGET — default `Array.prototype.sort()`
 * ------------------------------------------------------------------------
 * A bare `.sort()` on strings is **not** culture-sensitive and is **not**
 * flagged. ECMA-262 (Array.prototype.sort → SortCompare) says: when `comparefn`
 * is undefined, both elements are coerced with ToString and ordered by the
 * abstract relational comparison — i.e. **UTF-16 code-unit order**, with no
 * locale consulted. Verified empirically in the paired test: the default sort of
 * a mixed probe is byte-identical under `LC_ALL=C` and `LC_ALL=sv_SE.UTF-8`,
 * while `localeCompare` reorders it.
 *
 * The honest caveat, stated rather than hidden: default sort is *deterministic*
 * but it is **not** the repo's canonical collation. The treaty
 * (`src/Core/Collation.fs`, `src/Core.TypeScript/collation/collation.ts`) is
 * **code POINT ≡ UTF-8 byte order**; `<` on JS strings is code UNIT, and the two
 * disagree above the BMP (U+FF3A vs U+10000). That is a real but much narrower
 * defect than locale-sensitivity, it is already tracked by the collation treaty
 * tests, and flagging every `.sort()` in the repo would bury this lint in noise
 * until someone disabled it. Scope kept to what it can defend.
 *
 * THE PERMITTED EDGE
 * ------------------------------------------------------------------------
 * The rule itself says culture-awareness is a UI/display concern to be opted
 * into at the edge. So an allowlist exists — and **every entry carries its
 * reason**, because an unreasoned allowlist is how a rule dies quietly.
 *
 * THE BASELINE IS DEBT, NOT PERMISSION
 * ------------------------------------------------------------------------
 * `lint-no-culture-sensitive-collation.baseline.json` records the instances that
 * already existed when this lint landed. It is a **ratchet**: a file's count may
 * fall, never rise, and a file absent from the baseline may have none at all. It
 * is not an allowlist and must not be read as one — each row carries a category
 * saying what kind of debt it is and why it was not cleared in the landing PR.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

/** Code-unit order, used only to sort this linter's own OUTPUT deterministically. */
function byOrdinal(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

export interface Finding {
  readonly file: string;
  readonly line: number;
  readonly api: string;
  readonly why: string;
  readonly text: string;
}

export interface BaselineEntry {
  readonly count: number;
  readonly category: string;
  readonly reason: string;
}

export type Baseline = Record<string, BaselineEntry>;

/**
 * The closed set of culture-sensitive APIs. Each is matched as a **call site**
 * (`.name(` / `new Intl.X(`), never as a bare mention, so the many doc comments
 * in this repo that explain *why not to use* `localeCompare` are not findings.
 */
export const RULES: readonly { readonly api: string; readonly re: RegExp; readonly why: string }[] = [
  {
    api: "localeCompare",
    re: /\.\s*localeCompare\s*\(/,
    why: "linguistic, locale- and ICU-dependent ordering — two machines can disagree, so keys sort differently and DST replay / N-oracle byte-lock diverge",
  },
  {
    api: "Intl.Collator",
    re: /\bIntl\s*\.\s*Collator\b/,
    why: "explicitly locale- and ICU-version-dependent collation; not stable across runtimes",
  },
  {
    api: "Intl.DateTimeFormat",
    re: /\bIntl\s*\.\s*DateTimeFormat\b/,
    why: "locale- and timezone-dependent date rendering; never for a key, a log line that is diffed, or anything folded",
  },
  {
    api: "Intl.NumberFormat",
    re: /\bIntl\s*\.\s*NumberFormat\b/,
    why: "locale-dependent decimal separator and grouping; `1,5` vs `1.5` has broken parsers before",
  },
  {
    api: "toLocaleLowerCase",
    re: /\.\s*toLocaleLowerCase\s*\(/,
    why: "locale-dependent case folding (the Turkish dotless-i: 'I'.toLocaleLowerCase('tr') === 'ı') — use toLowerCase()",
  },
  {
    api: "toLocaleUpperCase",
    re: /\.\s*toLocaleUpperCase\s*\(/,
    why: "locale-dependent case folding — use toUpperCase()",
  },
  {
    api: "toLocaleString",
    re: /\.\s*toLocaleString\s*\(/,
    why: "locale-dependent number/date rendering — use toString(), toISOString(), or an explicit formatter",
  },
  {
    api: "toLocaleDateString",
    re: /\.\s*toLocaleDateString\s*\(/,
    why: "locale- and timezone-dependent date rendering — use toISOString().slice(0, 10)",
  },
  {
    api: "toLocaleTimeString",
    re: /\.\s*toLocaleTimeString\s*\(/,
    why: "locale- and timezone-dependent time rendering — use toISOString()",
  },
];

/** Extensions this lint understands. Anything else is another lint's problem. */
const SCANNABLE = [".ts", ".tsx", ".mts", ".cts", ".js", ".mjs", ".cjs", ".jsx"] as const;

/**
 * Trees excluded from scanning, each for a stated reason.
 *
 * `references/prior-art/` is gigabytes of mirrored third-party source and is
 * gitignored — it is never scanned here, and per
 * `.claude/rules.bak/references-prior-art-not-our-code-search-excludes.md` it
 * must never be walked recursively at all. It is not our code, so a locale API
 * in it is not our defect.
 */
const EXCLUDED_PREFIXES: readonly { readonly prefix: string; readonly reason: string }[] = [
  { prefix: "references/", reason: "mirrored third-party source; not our code" },
  {
    prefix: "docs/recovered-orphan-branches-",
    reason: "frozen forensic snapshots of abandoned branches; rewriting history-as-evidence is worse than the defect",
  },
];

/**
 * The PERMITTED EDGE. Culture-aware formatting is explicitly allowed by
 * `.claude/rules/culture-invariant-by-default.md` for display, and these are the
 * places where it is a feature. **Every entry states its reason** — an entry
 * without one is not an exemption, it is an unexamined bug.
 */
export const ALLOWLIST: readonly { readonly file: string; readonly reason: string }[] = [
  {
    file: "src/Core.TypeScript/hygiene/lint-no-culture-sensitive-collation.ts",
    reason: "this linter — it names the banned APIs in order to ban them",
  },
  {
    file: "src/Core.TypeScript/hygiene/lint-no-culture-sensitive-collation.test.ts",
    reason: "the linter's falsifier — it must construct the very patterns it catches",
  },
  {
    file: "src/Core.TypeScript/collation/collation.test.ts",
    reason: "the collation treaty's differential test — it compares candidate orders against each other on purpose",
  },
  {
    file: "src/Core.TypeScript/hygiene/glossary-adoption-cell.test.ts",
    reason:
      "pins that the glossary cell's tie-break is ordinal by exhibiting the locale order it must not be; the disagreement IS the assertion, so removing the localeCompare call would leave the test pinning nothing",
  },
  {
    file: "src/Core.TypeScript/society/society.test.ts",
    reason: "asserts that the canonical address order DIVERGES from localeCompare; the divergence is the assertion",
  },
  {
    file: "src/Core.TypeScript/git/tracked-files.test.ts",
    reason: "pins that tracked-file order is ordinal by exhibiting the locale order it must not be",
  },
  {
    file: "src/Core.TypeScript/ace/ace-cli-collation.test.ts",
    reason:
      "asserts that `graphMerkleRoot`'s entry order DIVERGES from localeCompare; the single call computes the cultural order the root must NOT match, and is the premise the test asserts rather than assumes. Same shape as society.test.ts above.",
  },
  {
    file: "src/Core.TypeScript/hygiene/treaty-rule-alternatives.ts",
    reason:
      "the treaty-rule register — locale collation IS the alternative under evaluation. All three uses sit inside `evaluate:` callbacks that measure how many pinned vectors change if an implementer had chosen Intl.Collator instead of ordinal; the file exists to prove the vectors discriminate the two. Same shape as collation.test.ts above.",
  },
  {
    file: "src/Core.TypeScript/search/inverted/inverted-index.test.ts",
    reason:
      "asserts that the inverted index's term order DIVERGES from localeCompare — byte order puts every uppercase letter before every lowercase one, `en` order interleaves them. The single call computes the cultural order the shards must NOT be in, so without it the ordering assertion would pin nothing. Same shape as society.test.ts above.",
  },
  {
    file: "src/Core.TypeScript/observe/decorrelation-meter.test.ts",
    reason:
      "the three calls are CONTROLS that compute the locale order the tick-window fold must NOT be in, and each is asserted, never assumed: `MINUS.localeCompare(PLUS)` and `UPPER.localeCompare(LOWER)` pin that ordinal and linguistic order genuinely DISAGREE on two timestamp pairs that parse to the same instant (measured, both directions), and `\"B\".localeCompare(\"a\")` does the same for the agent-pair enumeration. Without them the ordering assertions would pin nothing — a mutation run proved it: swapping `stringCompare` for `localeCompare` in the fold survived until these controls existed. Same shape as society.test.ts above.",
  },
  {
    file: "src/Core.TypeScript/hygiene/lint-treaty-rule-discrimination.test.ts",
    reason:
      "that register's falsifier — asserts Intl.Collator('en') orders 'Z' before 'a' while byte order does not, so the discriminating vectors are proven non-vacuous. The divergence is the assertion, as in society.test.ts above.",
  },

  // ── THE PERMITTED DISPLAY EDGE ──────────────────────────────────────────────
  // Each verified by reading its call sites: `toLocale*` only, rendering a number
  // or a date into a JSX text node or console output for a human to look at. No
  // ordering, no key, nothing folded, nothing written to a tracked file. This is
  // the case the rule explicitly carves out — "culture-aware comparison is a
  // UI/display concern, opt in at the edge."
  //
  // KNOWN LIMITATION, stated rather than hidden: the allowlist is FILE-granular,
  // so a `localeCompare` added later to one of these files would not be caught.
  // They are UI leaf components and one measurement script, chosen because that
  // risk is small there. Do not extend this list to any file that also computes.
  {
    file: "demo/identity-dla-site/src/components/OracleRGBA.tsx",
    reason: "display edge — toLocaleString for thousands separators in rendered JSX text; no ordering",
  },
  {
    file: "demo/identity-dla-site/src/components/OracleWASM.tsx",
    reason: "display edge — toLocaleString for thousands separators in rendered JSX text; no ordering",
  },
  {
    file: "demo/identity-dla-site/src/components/OracleWebGPU.tsx",
    reason: "display edge — toLocaleString for thousands separators in rendered JSX text; no ordering",
  },
  {
    file: "demo/identity-dla-site/src/components/OracleWorm.tsx",
    reason: "display edge — toLocaleString for thousands separators in rendered JSX text; no ordering",
  },
  {
    file: "demo/identity-dla-site/src/components/ui/calendar.tsx",
    reason:
      "display edge — a calendar widget MUST render month and weekday names in the viewer's locale; that is the feature",
  },
  {
    file: "demo/identity-dla-site/src/components/ui/chart.tsx",
    reason: "display edge — formats a chart tooltip value for a human reader; never a key",
  },
  {
    file: "src/Renderers/website/client/src/components/ui/calendar.tsx",
    reason:
      "display edge — a calendar widget MUST render month and weekday names in the viewer's locale; that is the feature",
  },
  {
    file: "src/Renderers/website/client/src/components/ui/chart.tsx",
    reason: "display edge — formats a chart tooltip value for a human reader; never a key",
  },
  {
    file: "src/Core.TypeScript/ops/model-rating-report.ts",
    reason:
      "display edge — thousands separators in a console-only cost table; verified to write no file, so no committed diff can churn",
  },
  {
    file: "src/Core.TypeScript/discovery/udp-lossy-transport.retention-measure.ts",
    reason:
      "display edge — toLocaleString with the locale pinned explicitly to en-US, formatting console output of a measurement run",
  },
];

const ALLOWED = new Set(ALLOWLIST.map((a) => a.file));

/**
 * Anti-vacuity floor. A guard that scans nothing and exits 0 is not a guard —
 * this repo shipped `lint:markdown` linting zero files for months (#10712). If
 * the scope regresses, fix the scope, never the floor.
 */
export const MIN_FILES_EXPECTED = 1200;

/**
 * Remove line comments, block comments and string/template literal bodies, so a
 * doc comment explaining "deliberately NOT localeCompare" is not a finding while
 * a live call one line below still is. Line structure is preserved (comment
 * bodies become spaces) so reported line numbers stay true.
 */
const keepNewlines = (s: string): string => s.replace(/[^\n]/g, " ");

/** Index just past a string/template literal opened at `i`. Total: never throws. */
function endOfLiteral(text: string, i: number, quote: string): number {
  let j = i + 1;
  while (j < text.length) {
    const c = text.charAt(j);
    if (c === "\\") {
      j += 2;
      continue;
    }
    if (c === quote) return j + 1;
    // A single- or double-quoted literal cannot span a line; a template can.
    if (c === "\n" && quote !== "`") return j;
    j += 1;
  }
  return j;
}

/** Index just past a `//` or block comment opened at `i`. */
function endOfComment(text: string, i: number, two: string): number {
  if (two === "//") {
    const end = text.indexOf("\n", i);
    return end === -1 ? text.length : end;
  }
  const end = text.indexOf("*/", i + 2);
  return end === -1 ? text.length : end + 2;
}

/**
 * Remove line comments, block comments and string/template literal bodies, so a
 * doc comment explaining "deliberately NOT localeCompare" is not a finding while
 * a live call one line below still is. Line structure is preserved (comment
 * bodies become spaces) so reported line numbers stay true.
 */
export function stripCommentsAndStrings(text: string): string {
  const out: string[] = [];
  let i = 0;
  while (i < text.length) {
    const two = text.slice(i, i + 2);
    if (two === "//" || two === "/*") {
      const stop = endOfComment(text, i, two);
      out.push(keepNewlines(text.slice(i, stop)));
      i = stop;
      continue;
    }
    const ch = text.charAt(i);
    if (ch === '"' || ch === "'" || ch === "`") {
      const stop = endOfLiteral(text, i, ch);
      out.push(ch + keepNewlines(text.slice(i + 1, stop)));
      i = stop;
      continue;
    }
    out.push(ch);
    i += 1;
  }
  return out.join("");
}

export function scanText(file: string, text: string): Finding[] {
  if (ALLOWED.has(file)) return [];
  const stripped = stripCommentsAndStrings(text);
  const strippedLines = stripped.split("\n");
  const rawLines = text.split("\n");
  const out: Finding[] = [];
  for (let i = 0; i < strippedLines.length; i++) {
    const line = strippedLines[i] ?? "";
    for (const rule of RULES) {
      if (!rule.re.test(line)) continue;
      out.push({
        file,
        line: i + 1,
        api: rule.api,
        why: rule.why,
        text: (rawLines[i] ?? "").trim().slice(0, 160),
      });
    }
  }
  return out;
}

export function isScannableKind(path: string): boolean {
  return SCANNABLE.some((e) => path.endsWith(e));
}

export function isExcluded(path: string): boolean {
  if (path.includes("node_modules/")) return true;
  return EXCLUDED_PREFIXES.some((e) => path.startsWith(e.prefix));
}

export function trackedFiles(repoRoot: string): string[] {
  const out = execFileSync("git", ["ls-files", "-z"], {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
  });
  return out.split("\0").filter((p) => p.length > 0);
}

export function loadBaseline(repoRoot: string): Baseline {
  const p = join(repoRoot, "src/Core.TypeScript/hygiene/lint-no-culture-sensitive-collation.baseline.json");
  if (!existsSync(p)) return {};
  const parsed: unknown = JSON.parse(readFileSync(p, "utf8"));
  const entries = (parsed as { entries?: Baseline }).entries;
  return entries ?? {};
}

export interface Violation {
  readonly file: string;
  readonly kind: "new-file" | "count-increase";
  readonly found: number;
  readonly allowed: number;
  readonly findings: readonly Finding[];
}

export interface ScanResult {
  readonly filesScanned: number;
  readonly findings: readonly Finding[];
  readonly byFile: ReadonlyMap<string, Finding[]>;
}

export function scanRepoDetailed(repoRoot: string): ScanResult {
  const findings: Finding[] = [];
  const byFile = new Map<string, Finding[]>();
  let filesScanned = 0;
  for (const rel of trackedFiles(repoRoot)) {
    if (!isScannableKind(rel)) continue;
    if (isExcluded(rel)) continue;
    let text: string;
    try {
      text = readFileSync(join(repoRoot, rel), "utf8");
    } catch {
      continue; // symlink or unreadable — other lints own those
    }
    filesScanned++;
    const f = scanText(rel, text);
    if (f.length > 0) {
      findings.push(...f);
      byFile.set(rel, f);
    }
  }
  return { filesScanned, findings, byFile };
}

/**
 * The ratchet. A file in the baseline may hold at most its recorded count; a
 * file outside it may hold none. Counts falling is the point — regenerate the
 * baseline whenever debt is paid down.
 */
export function ratchet(byFile: ReadonlyMap<string, Finding[]>, baseline: Baseline): Violation[] {
  const violations: Violation[] = [];
  for (const [file, findings] of byFile) {
    const allowed = baseline[file]?.count ?? 0;
    if (findings.length > allowed) {
      violations.push({
        file,
        kind: allowed === 0 ? "new-file" : "count-increase",
        found: findings.length,
        allowed,
        findings,
      });
    }
  }
  // Ordinal order, by the repo's own discipline: never localeCompare.
  return violations.sort((a, b) => byOrdinal(a.file, b.file));
}

export function scanRepo(repoRoot: string): Violation[] {
  const { byFile } = scanRepoDetailed(repoRoot);
  return ratchet(byFile, loadBaseline(repoRoot));
}

if (import.meta.main) {
  const repoRoot = resolve(import.meta.dir, "..", "..", "..");
  const emitBaseline = process.argv.includes("--write-baseline");
  const { filesScanned, findings, byFile } = scanRepoDetailed(repoRoot);

  if (emitBaseline) {
    const files = [...byFile.keys()].sort(byOrdinal);
    const existing = loadBaseline(repoRoot);
    const entries: Baseline = {};
    for (const f of files) {
      const prior = existing[f];
      entries[f] = {
        count: (byFile.get(f) ?? []).length,
        category: prior?.category ?? "UNCATEGORIZED",
        reason: prior?.reason ?? "TODO: state why this was not cleared",
      };
    }
    console.log(JSON.stringify({ entries }, null, 2));
    process.exit(0);
  }

  if (filesScanned < MIN_FILES_EXPECTED) {
    console.error(`✗ scanned only ${String(filesScanned)} files (floor ${String(MIN_FILES_EXPECTED)}).`);
    console.error("  A guard that matches nothing and exits 0 is not a guard. Fix the scope, not the floor.");
    process.exit(2);
  }

  const violations = ratchet(byFile, loadBaseline(repoRoot));
  if (violations.length > 0) {
    console.error("✗ culture-SENSITIVE comparison/formatting introduced in TypeScript.");
    console.error("  Ordinal is the repo's collation: use src/Core.TypeScript/collation/collation.ts");
    console.error("  `stringCompare` (code point ≡ UTF-8 byte order — the treaty), or `<`/`>` for a");
    console.error("  code-unit order that is at least deterministic. See");
    console.error("  .claude/rules/culture-invariant-by-default.md\n");
    for (const v of violations) {
      console.error(`  ${v.file}  (${String(v.found)} found, baseline allows ${String(v.allowed)})`);
      for (const f of v.findings) {
        console.error(`      :${String(f.line)}  ${f.api} — ${f.why}`);
        console.error(`         ${f.text}`);
      }
    }
    console.error(`\n${String(violations.length)} file(s) over baseline.`);
    process.exit(1);
  }
  console.log(
    `✓ no new culture-sensitive collation in ${String(filesScanned)} tracked files ` +
      `(${String(findings.length)} baselined instance(s) remaining as debt)`,
  );
}
