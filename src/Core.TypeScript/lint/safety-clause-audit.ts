#!/usr/bin/env bun
// safety-clause-audit.ts — counts how many .claude/skills/*/SKILL.md
// files carry an explicit scope-limiting ("what this skill does NOT
// do" or equivalent) section.
//
// TypeScript+Bun port of safety-clause-audit.sh, slice 7 of the
// TS+Bun migration. See docs/best-practices/repo-scripting.md.
//
// Promotes the `every-skill-has-safety-clause` invariant in
// .claude/skills/prompt-protector/skill.yaml from `guess` to
// `observed` — we now have a mechanical count, not a subjective
// impression.
//
// Matches three heading patterns in order of decreasing confidence:
//   H1 — explicit "NOT do" heading
//   H2 — scope heading (## Scope, ## Out of scope)
//   H3 — authority-boundary heading (## does-not-audit)
//
// Usage:
//   bun tools/lint/safety-clause-audit.ts                  # summary
//   bun tools/lint/safety-clause-audit.ts --list-missing   # names only
//   bun tools/lint/safety-clause-audit.ts --verbose        # per-skill
//   bun tools/lint/safety-clause-audit.ts --fail-over N    # exit 1 if
//                                                          # MISSING > N
//
// Exit codes:
//   0   audit ran (irrespective of MISSING count, unless --fail-over)
//   1   MISSING > N when --fail-over N specified, OR usage error
//       (invalid / missing --fail-over value). Behaviour-improvement-
//       over-bash: bash printed "integer expression expected" and
//       exited 0 from the failed `[` test; TS port surfaces the
//       usage error explicitly.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

type ExitCode = 0 | 1;
type Mode = "summary" | "list-missing" | "verbose";
type Tier = "H1" | "H2" | "H3" | "MISSING";

const SPAWN_MAX_BUFFER = 64 * 1024 * 1024;

// H1 patterns split into a small pattern list to keep each individual
// regex under sonarjs/regex-complexity threshold (20). The bash
// original packed all alternatives into one pattern; here we test
// each variant separately and OR via .some().
// Each H1 regex stays under sonarjs/regex-complexity threshold (20)
// by using a non-capturing optional `do` suffix and the /i flag for
// NOT/not equivalence (matches the bash original's case-insensitive
// `grep -iqE`).
const H1_PATTERNS: readonly RegExp[] = [
  /^#+[\t ]+What[\t ]+this[\t ]+skill[\t ]+does[\t ]+not(?:[\t ]+do)?\b/im,
  /^#+[\t ]+What[\t ]+this[\t ]+skill[\t ]+(?:don't|doesn't)[\t ]+do\b/im,
  /^#+[\t ]+What[\t ]+this[\t ]+agent[\t ]+does[\t ]+not(?:[\t ]+do)?\b/im,
  /^#+[\t ]+What[\t ]+this[\t ]+agent[\t ]+(?:don't|doesn't)[\t ]+do\b/im,
  /^#+[\t ]+What[\t ]+(?:he|she|they|I)[\t ]+does[\t ]+not(?:[\t ]+do)?\b/im,
  /^#+[\t ]+What[\t ]+(?:he|she|they|I)[\t ]+(?:don't|doesn't)[\t ]+do\b/im,
  /^#+[\t ]+What[\t ]+it[\t ]+does[\t ]+not(?:[\t ]+do)?\b/im,
  /^#+[\t ]+What[\t ]+it[\t ]+(?:don't|doesn't)[\t ]+do\b/im,
];

const H2_PATTERNS: readonly RegExp[] = [
  /^#+[\t ]+Scope\b/im,
  /^#+[\t ]+What[\t ]+this[\t ]+skill[\t ]+does[\t ]+not[\t ]+cover\b/im,
  /^#+[\t ]+Out[\t ]+of[\t ]+scope\b/im,
];

const H3_PATTERNS: readonly RegExp[] = [
  /^#+[\t ]+does-not-audit\b/im,
  /^#+[\t ]+What[\t ]+this[\t ]+skill[\t ]+does[\t ]+not[\t ]+audit\b/im,
];

type ParsedArgs =
  | { readonly kind: "ok"; readonly mode: Mode; readonly failOver: number | null }
  | { readonly kind: "help" }
  | { readonly kind: "usage-error"; readonly message: string };

interface SkillResult {
  readonly name: string;
  readonly tier: Tier;
}

interface AuditCounts {
  readonly total: number;
  readonly h1: number;
  readonly h2: number;
  readonly h3: number;
  readonly missing: number;
  readonly h1List: readonly string[];
  readonly h2List: readonly string[];
  readonly h3List: readonly string[];
  readonly missingList: readonly string[];
}

function repoRoot(): string {
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  const result = spawnSync("git", ["rev-parse", "--show-toplevel"], {
    encoding: "utf8",
    maxBuffer: SPAWN_MAX_BUFFER,
  });
  if (result.status !== 0) return process.cwd();
  return result.stdout.trim();
}

type FailOverParse =
  | { readonly kind: "found"; readonly value: number; readonly consumeNext: boolean }
  | { readonly kind: "invalid"; readonly raw: string }
  | { readonly kind: "missing-value" }
  | { readonly kind: "no-match" };

function parseFailOverArg(
  arg: string,
  next: string | undefined,
): FailOverParse {
  if (arg === "--fail-over") {
    if (next === undefined) return { kind: "missing-value" };
    const parsed = Number.parseInt(next, 10);
    if (Number.isNaN(parsed) || !/^-?\d+$/.test(next)) {
      return { kind: "invalid", raw: next };
    }
    return { kind: "found", value: parsed, consumeNext: true };
  }
  if (arg.startsWith("--fail-over=")) {
    const raw = arg.slice("--fail-over=".length);
    const parsed = Number.parseInt(raw, 10);
    if (Number.isNaN(parsed) || !/^-?\d+$/.test(raw)) {
      return { kind: "invalid", raw };
    }
    return { kind: "found", value: parsed, consumeNext: false };
  }
  return { kind: "no-match" };
}

type ArgStep =
  | { readonly kind: "set-mode"; readonly mode: Mode; readonly skip: 0 }
  | { readonly kind: "set-fail-over"; readonly value: number; readonly skip: 0 | 1 }
  | { readonly kind: "help"; readonly skip: 0 }
  | { readonly kind: "error"; readonly message: string }
  | { readonly kind: "skip"; readonly skip: 0 };

function classifyArg(arg: string, next: string | undefined): ArgStep {
  if (arg === "--list-missing") return { kind: "set-mode", mode: "list-missing", skip: 0 };
  if (arg === "--verbose") return { kind: "set-mode", mode: "verbose", skip: 0 };
  if (arg === "-h" || arg === "--help") return { kind: "help", skip: 0 };
  const fo = parseFailOverArg(arg, next);
  if (fo.kind === "found") {
    return { kind: "set-fail-over", value: fo.value, skip: fo.consumeNext ? 1 : 0 };
  }
  if (fo.kind === "invalid") {
    return {
      kind: "error",
      message: `--fail-over requires an integer value, got: ${fo.raw}`,
    };
  }
  if (fo.kind === "missing-value") {
    return {
      kind: "error",
      message: "--fail-over requires an integer value (e.g. --fail-over 5)",
    };
  }
  return { kind: "skip", skip: 0 };
}

function parseArgs(argv: readonly string[]): ParsedArgs {
  let mode: Mode = "summary";
  let failOver: number | null = null;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === undefined) continue;
    const step = classifyArg(arg, argv[i + 1]);
    if (step.kind === "help") return { kind: "help" };
    if (step.kind === "error") return { kind: "usage-error", message: step.message };
    if (step.kind === "set-mode") mode = step.mode;
    else if (step.kind === "set-fail-over") {
      failOver = step.value;
      i += step.skip;
    }
  }
  return { kind: "ok", mode, failOver };
}

function emitHelp(): void {
  process.stdout.write(
    "Usage: bun tools/lint/safety-clause-audit.ts [options]\n",
  );
  process.stdout.write("\n");
  process.stdout.write("Options:\n");
  process.stdout.write("  (no flag)         summary table (default)\n");
  process.stdout.write("  --list-missing    print one skill name per missing entry\n");
  process.stdout.write("  --verbose         per-skill table with tier classification\n");
  process.stdout.write("  --fail-over N     exit 1 if MISSING count > N\n");
  process.stdout.write("  -h, --help        print this help and exit 0\n");
}

function listSkillFiles(skillsDir: string): readonly string[] {
  let entries: readonly import("node:fs").Dirent[];
  try {
    entries = readdirSync(skillsDir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const skillMd = join(skillsDir, e.name, "SKILL.md");
    try {
      if (statSync(skillMd).isFile()) out.push(skillMd);
    } catch {
      continue;
    }
  }
  return out.sort((a, b) => a.localeCompare(b));
}

function matchesAny(content: string, patterns: readonly RegExp[]): boolean {
  return patterns.some((re) => re.test(content));
}

function classifySkill(content: string): Tier {
  if (matchesAny(content, H1_PATTERNS)) return "H1";
  if (matchesAny(content, H2_PATTERNS)) return "H2";
  if (matchesAny(content, H3_PATTERNS)) return "H3";
  return "MISSING";
}

function auditSkills(files: readonly string[]): AuditCounts {
  const results: SkillResult[] = [];
  for (const file of files) {
    let content: string;
    try {
      content = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    const name = basename(dirname(file));
    results.push({ name, tier: classifySkill(content) });
  }
  const h1List = results.filter((r) => r.tier === "H1").map((r) => r.name);
  const h2List = results.filter((r) => r.tier === "H2").map((r) => r.name);
  const h3List = results.filter((r) => r.tier === "H3").map((r) => r.name);
  const missingList = results
    .filter((r) => r.tier === "MISSING")
    .map((r) => r.name);
  return {
    total: results.length,
    h1: h1List.length,
    h2: h2List.length,
    h3: h3List.length,
    missing: missingList.length,
    h1List,
    h2List,
    h3List,
    missingList,
  };
}

function formatPercent(numerator: number, total: number): string {
  if (total === 0) return "0.0";
  return ((100 * numerator) / total).toFixed(1);
}

function emitListMissing(c: AuditCounts): void {
  // Intentional behaviour-improvement-over-bash: emit zero bytes
  // when the missing list is empty. Bash's
  // `printf '%s\n' "${missing_list[@]:-}"` actually emits one
  // newline on empty (verified empirically 2026-04-30 in macOS
  // bash 3.2 + Linux bash 5.x — the :- expansion produces "",
  // then printf emits "%s\n" = "\n"). Reviewer flagged this as
  // a piping ergonomics wart on PR #878; the TS port emits the
  // expected zero bytes when there's nothing to list. Same
  // category as the no-empty-dirs empty-FILTERED behaviour-fix
  // documented in slice-7 audit (the bash original was
  // unintentional, byte-equivalence wasn't a contract).
  for (const name of c.missingList) process.stdout.write(`${name}\n`);
}

function emitVerboseRow(name: string, tier: string): void {
  if (name.length > 0) process.stdout.write(`| \`${name}\` | ${tier} |\n`);
}

function emitVerbose(c: AuditCounts): void {
  process.stdout.write("# Safety-clause audit — per skill\n");
  process.stdout.write("\n");
  process.stdout.write("| Skill | Tier |\n");
  process.stdout.write("|---|---|\n");
  for (const n of c.h1List) emitVerboseRow(n, "H1 explicit");
  for (const n of c.h2List) emitVerboseRow(n, "H2 scope");
  for (const n of c.h3List) emitVerboseRow(n, "H3 authority");
  for (const n of c.missingList) emitVerboseRow(n, "MISSING");
  process.stdout.write("\n");
}

function emitSummary(c: AuditCounts): void {
  const covered = c.h1 + c.h2 + c.h3;
  const pctCov = formatPercent(covered, c.total);
  const pctH1 = formatPercent(c.h1, c.total);
  process.stdout.write("# Safety-clause audit — summary\n");
  process.stdout.write("\n");
  process.stdout.write(
    "Counts of `.claude/skills/*/SKILL.md` files carrying a\n",
  );
  process.stdout.write("scope-limiting clause. Promotes the\n");
  process.stdout.write("`every-skill-has-safety-clause` invariant in\n");
  process.stdout.write("`.claude/skills/prompt-protector/skill.yaml` from `guess`\n");
  process.stdout.write("to `observed`.\n");
  process.stdout.write("\n");
  process.stdout.write("| Tier | Pattern | Count |\n");
  process.stdout.write("|---|---|---:|\n");
  process.stdout.write(
    `| H1 | explicit "does NOT do" heading | ${String(c.h1)} |\n`,
  );
  process.stdout.write(
    `| H2 | "Scope" / "Out of scope" heading | ${String(c.h2)} |\n`,
  );
  process.stdout.write(
    `| H3 | "does-not-audit" / equivalent | ${String(c.h3)} |\n`,
  );
  process.stdout.write(
    `| MISSING | no scope-limiting heading | ${String(c.missing)} |\n`,
  );
  process.stdout.write(`| **total** | | **${String(c.total)}** |\n`);
  process.stdout.write("\n");
  process.stdout.write(
    `Covered (H1+H2+H3): **${String(covered)} / ${String(c.total)}** — **${pctCov}%**.\n`,
  );
  process.stdout.write(
    `H1-only (strongest): **${String(c.h1)} / ${String(c.total)}** — **${pctH1}%**.\n`,
  );
  process.stdout.write("\n");
  process.stdout.write(`Missing count: **${String(c.missing)}**.\n`);
}

export function main(argv: readonly string[]): ExitCode {
  const parsed = parseArgs(argv);
  if (parsed.kind === "help") {
    emitHelp();
    return 0;
  }
  if (parsed.kind === "usage-error") {
    process.stderr.write(`safety-clause-audit: ${parsed.message}\n`);
    return 1;
  }
  const { mode, failOver } = parsed;

  const root = repoRoot();
  const skillsDir = join(root, ".claude", "skills");
  const files = listSkillFiles(skillsDir);
  const counts = auditSkills(files);

  if (mode === "list-missing") emitListMissing(counts);
  else if (mode === "verbose") emitVerbose(counts);
  else emitSummary(counts);

  if (failOver !== null && counts.missing > failOver) {
    process.stderr.write(
      `FAIL: missing=${String(counts.missing)} exceeds threshold ${String(failOver)}\n`,
    );
    return 1;
  }
  return 0;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
