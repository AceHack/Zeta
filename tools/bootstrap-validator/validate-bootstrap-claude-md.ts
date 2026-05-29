#!/usr/bin/env bun
// validate-bootstrap-claude-md.ts — structural validator for the
// bootstrap-only CLAUDE.md (B-0354.1, smallest safe slice of B-0354).
//
// WHAT THIS IS (and is NOT):
//   This is the static structural-validation HARNESS SKELETON. It checks
//   that the bootstrap CLAUDE.md has the shape a fresh Claude Code instance
//   depends on:
//     1. CLAUDE.md exists at the repo root.
//     2. The 6-step bootstrap process is present (## 1. Orient ... ## 6.).
//     3. The .claude/rules/ auto-load surface exists and is non-empty
//        (the behavioral-rule discovery channel a fresh instance relies on).
//     4. CLAUDE.md stays concise (a SOFT length bound; warn, not fail).
//
//   It does NOT spawn a real Claude session or run the representative-task
//   protocol from B-0354 — that live execution is B-0354.2 (execute minimal
//   validation) and B-0354.3 (document findings + file gap children). This
//   slice ships only the static structural gate, runnable in CI without a
//   model in the loop.
//
// RECALIBRATION NOTE (per "assume decomposition has mistakes"):
//   The B-0354 re-decomposition row sketched check #4 as "CLAUDE.md length
//   <50". That bound is empirically wrong: the current bootstrap CLAUDE.md is
//   ~76 lines and that IS the correct bootstrap form (Sections 1-6 + a short
//   Conventions block). A hard <50 would fail a correct file. The load-bearing
//   invariant is STRUCTURAL (the 6-step process + the rules auto-load surface),
//   not a magic line count. So conciseness is a SOFT warn against a generous
//   ceiling (default 150), and section-presence + rules-presence are the hard
//   fails. The threshold is a tunable --max-lines, not a buried constant.
//
// Usage:
//   bun tools/bootstrap-validator/validate-bootstrap-claude-md.ts
//   bun tools/bootstrap-validator/validate-bootstrap-claude-md.ts --json
//   bun tools/bootstrap-validator/validate-bootstrap-claude-md.ts --root <path>
//   bun tools/bootstrap-validator/validate-bootstrap-claude-md.ts --max-lines 150
//   bun tools/bootstrap-validator/validate-bootstrap-claude-md.ts --help
//
// Exit codes:
//   0 — all hard checks passed (warns are allowed)
//   1 — usage error (bad args, or --help shown)
//   3 — one or more hard checks FAILED (validation failure)
//
// Origin: B-0354.1. Convention-matched to tools/cold-start-check.ts
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
 * #4 — Conciseness is a SOFT bound (warn, not fail). See RECALIBRATION NOTE.
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
  // Section + conciseness checks only meaningful when the file exists.
  if (claudeMdPresent) {
    checks.push(checkSixStepProcess(claudeMd));
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
