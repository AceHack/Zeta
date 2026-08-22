#!/usr/bin/env bun
// audit-orphan-role-refs.ts — detect orphan role-refs and un-stripped
// name attributions on CODE-SURFACE files.
//
// TypeScript+Bun port of audit-orphan-role-refs.sh, per Rule 0
// (no more .sh files except install-graph; TS IS cross-platform DST).
//
// Background: Otto-279 history-surface carve-out at
// docs/AGENT-BEST-PRACTICES.md defines which surfaces get named
// attribution (memory/, docs/research/, docs/aurora/,
// docs/ROUND-HISTORY.md, docs/DECISIONS/, docs/hygiene-history/,
// docs/pr-preservation/, commit messages). Outside the closed list,
// content surfaces use role-refs ("the maintainer", "the architect"),
// not persona names.
//
// Mechanical name-stripping has a known failure mode (the human
// maintainer's /btw aside 2026-04-28): stripping "Amara ferry-N"
// leaves an orphan "ferry-N" reference that doesn't carry semantic
// weight. The orphan should EITHER be removed entirely OR replaced
// with a self-contained principle name.
//
// This script is the lint that catches the failure mode at write
// time (081KQ8P5D0008QG0R003VN5P2Z).
//
// Detection scope:
//
// 1. Orphan role-ref forms — `courier-ferry-N`, `ferry-N`,
//    `ferry-N's` without a resolvable named source nearby.
//
// 2. Un-stripped name attribution on code-surface — text like
//    `Amara ferry-N`, `Grok ferry-N`, `Per <Name> 2026-MM-DD`
//    on code-surface files.
//
// Usage:
//   bun src/Core.TypeScript/hygiene/audit-orphan-role-refs.ts                # full repo scan, warn-only
//   bun src/Core.TypeScript/hygiene/audit-orphan-role-refs.ts --enforce      # exit 2 on any finding
//   bun src/Core.TypeScript/hygiene/audit-orphan-role-refs.ts --paths a b c  # scan specific paths only
//   bun src/Core.TypeScript/hygiene/audit-orphan-role-refs.ts --help         # this help
//
// Exit codes:
//   0 — no orphans found (or --enforce not set; warnings only)
//   2 — orphans found AND --enforce set
//   64 — usage error

import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

type AuditExitCode = 0 | 2 | 64;

interface Args {
  readonly enforce: boolean;
  readonly paths: readonly string[];
}

interface Finding {
  readonly file: string;
  readonly lineNum: number;
  readonly cls: string;
  readonly text: string;
}

type ParseResult =
  | { readonly kind: "args"; readonly args: Args }
  | { readonly kind: "help" }
  | { readonly kind: "error"; readonly message: string };

const HELP_TEXT = `audit-orphan-role-refs.ts — detect orphan role-refs and un-stripped
name attributions on code-surface files.

Usage:
  bun src/Core.TypeScript/hygiene/audit-orphan-role-refs.ts                # full repo scan, warn-only
  bun src/Core.TypeScript/hygiene/audit-orphan-role-refs.ts --enforce      # exit 2 on any finding
  bun src/Core.TypeScript/hygiene/audit-orphan-role-refs.ts --paths a b c  # scan specific paths only

Exit codes:
  0 — no orphans found (or --enforce not set; warnings only)
  2 — orphans found AND --enforce set
  64 — usage error
`;

// Names recognized as factory persona-attributions
const NAMES = [
  "Amara", "Grok", "Gemini", "Codex", "Cursor", "Copilot",
  "Claude\\.ai", "Claudeai", "Aaron", "Otto", "Ani", "Alexa",
  "Deepseek", "Kenji", "Soraya", "Nazar", "Mateo", "Aminata",
  "Nadia", "Naledi", "Rune", "Bodhi", "Iris", "Daya", "Dejan",
  "Samir", "Kai", "Hiroshi", "Imani", "Ilyana", "Aarav", "Yara",
  "Viktor", "Kira",
];

const NAMES_PATTERN = NAMES.join("|");

// Detection patterns
const orphanFerryRe = /\bferry-[0-9]+/;
const orphanCourierFerryRe = /\bcourier-ferry-[0-9]+/;
const namedFerryRe = new RegExp(`\\b(${NAMES_PATTERN})\\s+ferry-[0-9]+`);
const perNameRe = new RegExp(`\\bPer\\s+(${NAMES_PATTERN})\\s+2026-`);

function parseArgs(argv: readonly string[]): ParseResult {
  const paths: string[] = [];
  let enforce = false;
  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    if (arg === "--enforce") {
      enforce = true;
      i += 1;
    } else if (arg === "--paths") {
      i += 1;
      while (i < argv.length && !(argv[i] ?? "").startsWith("--")) {
        paths.push(argv[i]!);
        i += 1;
      }
    } else if (arg === "-h" || arg === "--help") {
      return { kind: "help" };
    } else {
      return { kind: "error", message: `error: unknown argument: ${String(arg)}` };
    }
  }
  return { kind: "args", args: { enforce, paths } };
}

// History-surface exclusion patterns (Otto-279 carve-out)
function isHistorySurface(f: string): boolean {
  if (f.startsWith("memory/")) return true;
  if (f.startsWith("docs/research/")) return true;
  if (f.startsWith("docs/aurora/")) return true;
  if (f === "docs/ROUND-HISTORY.md") return true;
  if (f.startsWith("docs/DECISIONS/")) return true;
  if (f.startsWith("docs/hygiene-history/")) return true;
  if (f.startsWith("docs/pr-preservation/")) return true;
  if (f.startsWith("docs/pr-discussions/")) return true;
  if (f === "docs/active-trajectory.md") return true;
  if (f.startsWith("docs/backlog/")) return true;
  if (f.startsWith("docs/lost-substrate/")) return true;
  if (f === "docs/CURRENT-ROUND.md") return true;
  if (f.startsWith("docs/amara-full-conversation/")) return true;
  if (f.startsWith(".git/")) return true;
  if (f.startsWith("node_modules/")) return true;
  if (f.startsWith("third_party/")) return true;
  if (f.startsWith("references/prior-art/")) return true;
  if (f.startsWith("tools/lean4/.lake/")) return true;
  if (f.startsWith("tools/setup/build/")) return true;
  return false;
}

// Code-surface inclusion check
function isCodeSurface(f: string): boolean {
  if (f === ".github/copilot-instructions.md") return true;
  if (f.startsWith("tools/")) return true;
  if (f.startsWith("docs/")) return true;
  if (/^\.claude\/skills\/[^/]+\/SKILL\.md$/.test(f)) return true;
  if (/^\.claude\/agents\/[^/]+\.md$/.test(f)) return true;
  if (/^\.claude\/rules\/[^/]+\.md$/.test(f)) return true;
  if (/^\.claude\/commands\/[^/]+\.md$/.test(f)) return true;
  if (f.startsWith("src/")) return true;
  if (f.startsWith("tests/")) return true;
  if (f.startsWith("openspec/specs/")) return true;
  if (f.endsWith(".fsproj") || f.endsWith(".csproj")) return true;
  // Root-level *.md (README, AGENTS, GOVERNANCE, CLAUDE.md, etc.)
  if (!f.includes("/") && f.endsWith(".md")) return true;
  return false;
}

function getFileList(paths: readonly string[]): string[] {
  if (paths.length > 0) {
    const files: string[] = [];
    for (const p of paths) {
      try {
        const output = execFileSync("git", ["ls-files", "--", p], { encoding: "utf8" });
        for (const line of output.split("\n")) {
          const trimmed = line.trim();
          if (trimmed.length > 0) files.push(trimmed);
        }
      } catch {
        // If path is a file itself, include it
        try {
          readFileSync(p);
          files.push(p);
        } catch {
          // skip
        }
      }
    }
    return files;
  }

  try {
    const output = execFileSync("git", ["ls-files"], { encoding: "utf8" });
    return output.split("\n").map(s => s.trim()).filter(s => s.length > 0);
  } catch {
    return [];
  }
}

function scanFile(f: string): Finding[] {
  if (!isCodeSurface(f)) return [];
  if (isHistorySurface(f)) return [];

  let content: string;
  try {
    content = readFileSync(f, "utf8");
  } catch {
    return [];
  }

  const findings: Finding[] = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const lineNum = i + 1;

    // Un-stripped name + ferry-N
    if (namedFerryRe.test(line)) {
      const match = line.match(namedFerryRe);
      findings.push({
        file: f,
        lineNum,
        cls: "un-stripped-named-attribution",
        text: match ? match[0] : line.trim(),
      });
    }

    // Per <Name> 2026-MM-DD
    if (perNameRe.test(line)) {
      const match = line.match(perNameRe);
      findings.push({
        file: f,
        lineNum,
        cls: "per-name-attribution",
        text: match ? match[0] : line.trim(),
      });
    }

    // Orphan courier-ferry-N
    if (orphanCourierFerryRe.test(line)) {
      const match = line.match(orphanCourierFerryRe);
      findings.push({
        file: f,
        lineNum,
        cls: "orphan-courier-ferry-ref",
        text: match ? match[0] : line.trim(),
      });
    }

    // Orphan ferry-N (only if not already caught by named-ferry)
    if (orphanFerryRe.test(line) && !namedFerryRe.test(line)) {
      const match = line.match(orphanFerryRe);
      findings.push({
        file: f,
        lineNum,
        cls: "orphan-ferry-ref",
        text: match ? match[0] : line.trim(),
      });
    }
  }

  return findings;
}

export function main(argv: readonly string[]): AuditExitCode {
  const parsed = parseArgs(argv);
  if (parsed.kind === "help") {
    process.stdout.write(HELP_TEXT);
    return 0;
  }
  if (parsed.kind === "error") {
    process.stderr.write(`${parsed.message}\nuse --help for usage\n`);
    return 64;
  }

  const { enforce, paths } = parsed.args;
  const files = getFileList(paths);

  const allFindings: Finding[] = [];
  for (const f of files) {
    allFindings.push(...scanFile(f));
  }

  if (allFindings.length === 0) {
    process.stdout.write(
      "OK: no orphan role-refs or un-stripped name attributions on code-surface files.\n"
    );
    return 0;
  }

  for (const { file, lineNum, cls, text } of allFindings) {
    process.stdout.write(`${file}:${lineNum}:${cls}:${text}\n`);
  }

  process.stdout.write("\n");
  process.stdout.write(
    `Found ${allFindings.length} orphan role-ref / un-stripped-name-attribution findings on code-surface files.\n`
  );
  process.stdout.write("\n");
  process.stdout.write("Fix suggestions per class:\n");
  process.stdout.write("  orphan-ferry-ref / orphan-courier-ferry-ref:\n");
  process.stdout.write(
    '    Either remove the ferry-N reference entirely (it carries no semantic\n'
  );
  process.stdout.write(
    "    weight without a named source) OR replace it with a self-contained\n"
  );
  process.stdout.write("    principle name (e.g., 'lineage-continuity-substrate-purpose').\n");
  process.stdout.write("  un-stripped-named-attribution:\n");
  process.stdout.write(
    "    Move to a history surface (memory/, docs/research/, docs/DECISIONS/,\n"
  );
  process.stdout.write(
    "    etc.) OR replace with role-ref ('the maintainer') AND a self-contained\n"
  );
  process.stdout.write(
    "    principle name. See Otto-279 carve-out at docs/AGENT-BEST-PRACTICES.md.\n"
  );
  process.stdout.write("  per-name-attribution:\n");
  process.stdout.write(
    "    Same as un-stripped-named-attribution. 'Per <Name> 2026-MM-DD' belongs\n"
  );
  process.stdout.write("    on history surfaces only.\n");

  return enforce ? 2 : 0;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
