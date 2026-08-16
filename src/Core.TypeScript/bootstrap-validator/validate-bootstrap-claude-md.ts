#!/usr/bin/env bun
// validate-bootstrap-claude-md.ts — structural validator for the
// bootstrap-only CLAUDE.md (081KR50HA0008QG0R001CNS20T.1, smallest safe slice of 081KR50HA0008QG0R001CNS20T).
//
// WHAT THIS IS (and is NOT):
//   This is the static structural-validation HARNESS SKELETON. It checks
//   that the bootstrap CLAUDE.md has the shape a fresh Claude Code instance
//   depends on:
//     1. CLAUDE.md exists at the repo root.
//     2. The 6-step bootstrap process is present (## 1. Orient ... ## 6.).
//     3. The .claude/rules/ auto-load surface exists and is non-empty
//        (the behavioral-rule discovery channel a fresh instance relies on).
//     4. Every CONCRETE pointer CLAUDE.md hands a fresh instance resolves to
//        an existing file (named .claude/rules/<name>.md rules + orient/ship
//        doc links). A dangling pointer IS "a critical rule lost in the
//        extraction" (081KR50HA0008QG0R001CNS20T acceptance criterion #2) — #3 proves the rule
//        DIRECTORY is non-empty, but #4 proves the SPECIFIC files survive.
//     5. CLAUDE.md stays concise (a SOFT length bound; warn, not fail).
//
//   It does NOT spawn a real Claude session or run the representative-task
//   protocol from 081KR50HA0008QG0R001CNS20T — the live model-in-the-loop run is left to
//   081KR50HA0008QG0R001CNS20T.3 (document findings + file gap children). 081KR50HA0008QG0R001CNS20T.1 shipped the
//   harness skeleton + checks #1-#3 + #5; 081KR50HA0008QG0R001CNS20T.2 (this slice) adds check
//   #4 (referenced-pointer resolution — the "no critical rule lost" gate)
//   and executes the validation against the live repo. The whole harness
//   stays static and CI-runnable without a model in the loop.
//
// RECALIBRATION NOTE (per "assume decomposition has mistakes"):
//   The 081KR50HA0008QG0R001CNS20T re-decomposition row sketched check #4 as "CLAUDE.md length
//   <50". That bound is empirically wrong: the current bootstrap CLAUDE.md is
//   ~76 lines and that IS the correct bootstrap form (Sections 1-6 + a short
//   Conventions block). A hard <50 would fail a correct file. The load-bearing
//   invariant is STRUCTURAL (the 6-step process + the rules auto-load surface),
//   not a magic line count. So conciseness is a SOFT warn against a generous
//   ceiling (default 150), and section-presence + rules-presence are the hard
//   fails. The threshold is a tunable --max-lines, not a buried constant.
//
// Usage:
//   bun src/Core.TypeScript/bootstrap-validator/validate-bootstrap-claude-md.ts
//   bun src/Core.TypeScript/bootstrap-validator/validate-bootstrap-claude-md.ts --json
//   bun src/Core.TypeScript/bootstrap-validator/validate-bootstrap-claude-md.ts --root <path>
//   bun src/Core.TypeScript/bootstrap-validator/validate-bootstrap-claude-md.ts --max-lines 150
//   bun src/Core.TypeScript/bootstrap-validator/validate-bootstrap-claude-md.ts --help
//
// Exit codes:
//   0 — all hard checks passed (warns are allowed)
//   1 — usage error (bad args, or --help shown)
//   3 — one or more hard checks FAILED (validation failure)
//
// Origin: 081KR50HA0008QG0R001CNS20T.1. Convention-matched to tools/cold-start-check.ts
// (shebang, leading-comment-as-help, --json, ESM-safe self-path, explicit
// exit codes). Composes with the .claude/rules/ auto-load empirical anchor
// (.claude/rules/test-canary.md) and the claude-code-loading-taxonomy rule.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// ESM-safe self-path (bun runs this file as ESM; no CommonJS __filename).
const SELF_PATH = fileURLToPath(import.meta.url);

export type CheckStatus = "pass" | "fail" | "warn";

export interface CheckResult {
  /** Stable machine-readable id for the check. */
  id: string;
  /** Whether this check is load-bearing (fail blocks) or advisory (warn only). */
  status: CheckStatus;
  /** Human-readable one-liner. */
  detail: string;
}

/** The six numbered bootstrap-process sections a fresh instance follows. */
export const REQUIRED_STEP_NUMBERS = [1, 2, 3, 4, 5, 6] as const;

/** Default soft ceiling for CLAUDE.md line count (recalibrated; see header). */
export const DEFAULT_MAX_LINES = 150;

// ── Pure check functions (filesystem-free; directly unit-testable) ──────────

/** #1 — CLAUDE.md must exist at the repo root. */
export function checkClaudeMdExists(claudeMdPresent: boolean): CheckResult {
  return claudeMdPresent
    ? { id: "claude-md-exists", status: "pass", detail: "CLAUDE.md present at repo root" }
    : { id: "claude-md-exists", status: "fail", detail: "CLAUDE.md MISSING at repo root" };
}

/**
 * #2 — The 6-step bootstrap process must be present.
 * Detects `## N. ...` H2 headings for N in 1..6. A fresh instance reads these
 * to learn the Orient/Refresh/Pick/Build/Ship/Stuck loop.
 */
export function checkSixStepProcess(claudeMd: string): CheckResult {
  const found = new Set<number>();
  for (const line of claudeMd.split("\n")) {
    const m = /^##\s+(\d+)\.\s+\S/.exec(line);
    if (m) {
      const n = Number(m[1]);
      if (n >= 1 && n <= 6) found.add(n);
    }
  }
  const missing = REQUIRED_STEP_NUMBERS.filter((n) => !found.has(n));
  return missing.length === 0
    ? {
        id: "six-step-process",
        status: "pass",
        detail: "All 6 bootstrap-process sections present (## 1..## 6)",
      }
    : {
        id: "six-step-process",
        status: "fail",
        detail: `Missing bootstrap-process section(s): ${missing.map((n) => `## ${n}.`).join(", ")}`,
      };
}

/**
 * #3 — The .claude/rules/ auto-load surface must exist and be non-empty.
 * This is the behavioral-rule discovery channel a fresh instance depends on;
 * if it is empty, doctrine extracted out of CLAUDE.md is lost.
 */
export function checkRulesAutoLoad(ruleFileNames: string[]): CheckResult {
  const mdRules = ruleFileNames.filter((f) => f.endsWith(".md"));
  return mdRules.length > 0
    ? {
        id: "rules-auto-load",
        status: "pass",
        detail: `.claude/rules/ auto-load surface present (${mdRules.length} rule file(s))`,
      }
    : {
        id: "rules-auto-load",
        status: "fail",
        detail: ".claude/rules/ has no .md auto-load rules (behavioral doctrine unreachable)",
      };
}

/**
 * #4 — Every CONCRETE pointer CLAUDE.md hands a fresh instance must resolve.
 *
 * 081KR50HA0008QG0R001CNS20T acceptance criterion #2 is "no critical rules lost in the extraction
 * (all behavioral rules accessible via .claude/rules/ auto-load)". Check #3
 * (rules-auto-load) only proves the rule DIRECTORY is non-empty — it can pass
 * while the SPECIFIC rule file CLAUDE.md points at is gone. That dangling
 * pointer IS a critical rule lost in extraction: a fresh instance follows the
 * pointer (a `.claude/rules/<name>.md` it is told to read, or an orient/ship
 * markdown link) and hits a 404. This check is the deeper structural gate
 * #3 cannot give (081KR50HA0008QG0R001CNS20T.2 — execute minimal validation, no Claude spawn).
 *
 * Only CONCRETE references are checked. CLAUDE.md legitimately contains globs
 * and templates (`memory/CURRENT-*.md`, `docs/trajectories/*\/RESUME.md`,
 * `~/.claude/projects/<slug>/...`) — those are NOT resolvable exact paths, so
 * extraction deliberately skips anything with `*`, `<`, `>`, a space, a URL
 * scheme, or a home/absolute prefix. Flagging a glob would be a false
 * dangling-pointer; the check stays conservative on purpose.
 *
 * Filesystem-free: takes the extracted refs plus a `fileExists` predicate so
 * the resolution logic is unit-testable without a real repo (the runner
 * supplies `(rel) => existsSync(join(root, rel))`).
 */
export function checkReferencedPointers(
  refs: string[],
  fileExists: (relPath: string) => boolean,
): CheckResult {
  const dangling = refs.filter((r) => !fileExists(r));
  return dangling.length === 0
    ? {
        id: "referenced-pointers-resolve",
        status: "pass",
        detail: `All ${refs.length} concrete CLAUDE.md pointer(s) resolve to existing files`,
      }
    : {
        id: "referenced-pointers-resolve",
        status: "fail",
        detail: `Dangling CLAUDE.md pointer(s) (critical rule/doc lost in extraction): ${dangling.join(", ")}`,
      };
}

/**
 * Extract the concrete repo-relative pointers a fresh instance would follow
 * from CLAUDE.md. Two reference classes:
 *   (a) `.claude/rules/<kebab>.md` — named behavioral rules (inline-code or
 *       path form). Kebab-case (`[a-z0-9][a-z0-9-]*`) cannot match a glob or
 *       template, so `.claude/rules/*` style references never leak in.
 *   (b) markdown-link targets `](target)` that are repo-relative file paths —
 *       the orient/ship doc links (AGENTS.md, GOVERNANCE.md, docs/*.md). A
 *       trailing `#anchor` is stripped; URLs, pure anchors, globs/templates,
 *       and home/absolute paths are skipped.
 *   (c) bare inline-code repo paths — a backticked token that contains a `/`
 *       and a file extension (`docs/research/foo.md`, `tools/setup/x.sh`).
 *       Spans are single-line only (no embedded newline) so a multi-line
 *       command span never mis-pairs backticks and leaks document-global
 *       parity drift into the result. Same URL / glob / template /
 *       home / absolute skips as (b).
 * De-duplicated, so a pointer appearing in more than one form is checked once.
 */
export function extractReferencedPointers(claudeMd: string): string[] {
  const refs = new Set<string>();

  // (a) Concrete .claude/rules/<kebab>.md references.
  for (const m of claudeMd.matchAll(/\.claude\/rules\/[a-z0-9][a-z0-9-]*\.md/g)) {
    refs.add(m[0]);
  }

  // (b) Markdown-link targets that look like repo-relative file paths.
  for (const m of claudeMd.matchAll(/\]\(([^)]+)\)/g)) {
    let target = (m[1] ?? "").trim();
    const hash = target.indexOf("#");
    if (hash >= 0) target = target.slice(0, hash); // strip #anchor; keep path
    if (target === "") continue; // pure-anchor link (#section)
    if (/^[a-z][a-z0-9+.-]*:/i.test(target)) continue; // URL scheme (http:, mailto:)
    if (/[*<>\s]/.test(target)) continue; // glob / template / not a clean token
    if (target.startsWith("~") || target.startsWith("/")) continue; // home/absolute
    refs.add(target);
  }

  // (c) Bare inline-code repo paths: single-line backtick spans only.
  for (const m of claudeMd.matchAll(/`([^`\n]+)`/g)) {
    let target = (m[1] ?? "").trim();
    const hash = target.indexOf("#");
    if (hash >= 0) target = target.slice(0, hash); // strip #anchor; keep path
    if (target === "") continue;
    if (/^[a-z][a-z0-9+.-]*:/i.test(target)) continue; // URL scheme
    if (/[*<>\s]/.test(target)) continue; // glob / template / command (has spaces)
    if (target.startsWith("~") || target.startsWith("/")) continue; // home/absolute
    if (!target.includes("/")) continue; // must be a path, not a bare identifier
    if (!/\.[a-z0-9]+$/i.test(target)) continue; // must end in a file extension
    refs.add(target);
  }

  return [...refs];
}

/**
 * #5 — Conciseness is a SOFT bound (warn, not fail). See RECALIBRATION NOTE.
 * Empty / whitespace-only CLAUDE.md is a separate hard concern handled by
 * #1/#2; here we only flag bloat past the soft ceiling.
 */
export function checkConciseness(claudeMd: string, maxLines: number): CheckResult {
  // Normalize CRLF and strip a single trailing newline so the line count
  // is deterministic — a POSIX trailing newline must not over-count by 1
  // and trip a false `warn` when CLAUDE.md is exactly `maxLines` lines.
  const lineCount = claudeMd.replace(/\r\n/g, "\n").replace(/\n$/, "").split("\n").length;
  return lineCount <= maxLines
    ? {
        id: "conciseness",
        status: "pass",
        detail: `CLAUDE.md is ${lineCount} line(s) (<= soft ceiling ${maxLines})`,
      }
    : {
        id: "conciseness",
        status: "warn",
        detail: `CLAUDE.md is ${lineCount} line(s) (> soft ceiling ${maxLines}); bootstrap may be drifting toward doctrine`,
      };
}

// ── Filesystem runner ───────────────────────────────────────────────────────

export interface ValidationReport {
  root: string;
  maxLines: number;
  checks: CheckResult[];
  /** true iff no check has status "fail". */
  ok: boolean;
}

/**
 * Run all structural checks against a repo root. Pure-ish: reads the
 * filesystem but delegates every decision to the exported check functions
 * above so the logic is unit-testable without a real repo.
 */
export function runValidation(root: string, maxLines: number): ValidationReport {
  const claudeMdPath = join(root, "CLAUDE.md");
  const rulesDir = join(root, ".claude", "rules");

  const claudeMdPresent = existsSync(claudeMdPath);
  const claudeMd = claudeMdPresent ? readFileSync(claudeMdPath, "utf8") : "";
  const ruleFileNames = existsSync(rulesDir) ? readdirSync(rulesDir) : [];

  const checks: CheckResult[] = [checkClaudeMdExists(claudeMdPresent)];
  // Content-derived checks only meaningful when the file exists.
  if (claudeMdPresent) {
    checks.push(checkSixStepProcess(claudeMd));
    // #4 — referenced pointers must resolve against the repo root.
    const refs = extractReferencedPointers(claudeMd);
    checks.push(checkReferencedPointers(refs, (rel) => existsSync(join(root, rel))));
    checks.push(checkConciseness(claudeMd, maxLines));
  }
  checks.push(checkRulesAutoLoad(ruleFileNames));

  const ok = !checks.some((c) => c.status === "fail");
  return { root, maxLines, checks, ok };
}

// ── CLI ──────────────────────────────────────────────────────────────────────

interface Args {
  json: boolean;
  help: boolean;
  root: string;
  maxLines: number;
}

function printHelp(): void {
  const src = readFileSync(SELF_PATH, "utf8");
  for (const line of src.split("\n")) {
    if (line.startsWith("//")) console.log(line.replace(/^\/\/ ?/, ""));
    else if (line.startsWith("#!")) continue;
    else break;
  }
}

function parseArgs(argv: string[]): Args | { error: string } {
  const args: Args = { json: false, help: false, root: process.cwd(), maxLines: DEFAULT_MAX_LINES };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") args.json = true;
    else if (a === "--help" || a === "-h") args.help = true;
    else if (a === "--root") {
      const v = argv[++i];
      // Reject a missing value AND a dash-prefixed next token (e.g.
      // `--root --json`) so a usage error stays exit 1 rather than
      // validating against a bogus `--json` root.
      if (!v || v.startsWith("-")) return { error: "--root requires a path" };
      args.root = v;
    } else if (a === "--max-lines") {
      const v = argv[++i];
      // Same dash-prefix guard; require a positive INTEGER (reject floats
      // like `1.5` which `Number()` would otherwise accept).
      if (!v || v.startsWith("-")) return { error: "--max-lines requires a positive integer" };
      const n = Number(v);
      if (!Number.isInteger(n) || n <= 0) return { error: "--max-lines requires a positive integer" };
      args.maxLines = n;
    } else {
      return { error: `unknown argument: ${a}` };
    }
  }
  return args;
}

function main(): number {
  const parsed = parseArgs(process.argv.slice(2));
  if ("error" in parsed) {
    console.error(`Error: ${parsed.error}`);
    return 1;
  }
  if (parsed.help) {
    printHelp();
    return 1;
  }

  const report = runValidation(parsed.root, parsed.maxLines);

  if (parsed.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    const glyph: Record<CheckStatus, string> = { pass: "✓", fail: "✗", warn: "!" };
    console.log(`bootstrap CLAUDE.md validation — root: ${report.root}`);
    for (const c of report.checks) {
      console.log(`  ${glyph[c.status]} [${c.id}] ${c.detail}`);
    }
    console.log(report.ok ? "RESULT: PASS (no hard-check failures)" : "RESULT: FAIL");
  }

  return report.ok ? 0 : 3;
}

// Only run when invoked directly, not when imported by the test file.
if (import.meta.main) {
  process.exit(main());
}
