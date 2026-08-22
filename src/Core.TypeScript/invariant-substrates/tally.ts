#!/usr/bin/env bun
// tally.ts
//
// Aggregate invariant-substrate burn-down counts across every
// `.claude/skills/*/blueprints/*.skill.yaml`. Emits a markdown table of
// per-skill counts plus a portfolio total row. Backs the
// "burn-down count is the honest backlog" promise in
// `docs/INVARIANT-SUBSTRATES.md`.
//
// Language choice: bun + TypeScript. Rationale + alternatives
// considered are recorded in
// `docs/DECISIONS/2026-04-20-tools-scripting-language.md`.
// Summary: bun+TS is the post-setup scripting default because
// (1) TypeScript is coming for UI anyway — runtime amortizes;
// (2) native Windows binary (no Git Bash slowness);
// (3) faction-hate sidestep (some contributors hate bash,
//     some hate PowerShell; this goes outside both);
// (4) static types on automation code;
// (5) cross-project consistency with SQLSharp.
// Decision held at medium confidence; watchlist in the ADR.
//
// Reads each `skill.yaml`'s top-level scalars and its
// `counts:` block:
//
//   skill: <name>
//   spec-version: <version>
//   spec-filed-round: <round>
//   portable: true|false
//
//   counts:
//     hypothesis: N      # formerly `guess`; both keys accepted
//     observed:   N      # during the round-43 rename
//     verified:   N
//     total:      N
//
// Both `hypothesis:` and `guess:` are accepted to keep the
// transition mechanical. A `skill.yaml` still using `guess:`
// is parsed but flagged for rename.
//
// Usage:
//   bun run tally:substrates                                 # markdown report
//   bun ./tools/invariant-substrates/tally.ts --fail-on-mismatch     # non-zero if declared total != sum of tiers
//   bun ./tools/invariant-substrates/tally.ts --fail-on-no-progress  # non-zero if any hypothesis entries remain

import { Glob } from "bun";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
// 3 levels up from src/Core.TypeScript/invariant-substrates/ (was "..",".."
// at src/Core.TypeScript/invariant-substrates/; the relocation added a directory level).
const repoRoot = resolve(here, "..", "..", "..");

type Flags = {
  failOnMismatch: boolean;
  failOnNoProgress: boolean;
  help: boolean;
};

function parseArgs(argv: readonly string[]): Flags {
  const flags: Flags = {
    failOnMismatch: false,
    failOnNoProgress: false,
    help: false,
  };
  for (const arg of argv) {
    switch (arg) {
      case "--fail-on-mismatch":
        flags.failOnMismatch = true;
        break;
      case "--fail-on-no-progress":
        flags.failOnNoProgress = true;
        break;
      case "-h":
      case "--help":
        flags.help = true;
        break;
      default:
        // unknown flag ignored, matching tally.sh behaviour
        break;
    }
  }
  return flags;
}

function printHelp(): void {
  const lines = [
    "tally.ts — aggregate invariant-substrate burn-down counts.",
    "",
    "Usage:",
    "  bun run tally:substrates                        # markdown report",
    "  bun ./tools/invariant-substrates/tally.ts --fail-on-mismatch",
    "  bun ./tools/invariant-substrates/tally.ts --fail-on-no-progress",
    "",
    "Reads every `.claude/skills/*/blueprints/*.skill.yaml` and aggregates its",
    "top-level scalars and `counts:` block (hypothesis / observed /",
    "verified / total). `guess:` is accepted as a legacy alias for",
    "`hypothesis:` during the round-43 rename transition.",
  ];
  console.log(lines.join("\n"));
}

function stripComment(value: string): string {
  const hashAt = value.indexOf("#");
  return (hashAt === -1 ? value : value.slice(0, hashAt)).trim();
}

// Extract a top-level scalar. Matches at column 0 only, preserving
// the same discipline as the awk version so `counts.hypothesis` is
// never confused with a top-level `hypothesis` key.
function extractTopScalar(source: string, key: string): string | undefined {
  const pattern = new RegExp(`^${key}:\\s*(.*)$`, "m");
  const match = source.match(pattern);
  if (!match || match[1] === undefined) return undefined;
  const value = stripComment(match[1]);
  return value.length > 0 ? value : undefined;
}

// Extract a nested count under the `counts:` block. First match wins.
// The two-space indent is the only form this aggregator recognizes;
// it matches the shape the pilot skill.yaml files actually use.
function extractCount(source: string, key: string): number | undefined {
  const lines = source.split("\n");
  let inCounts = false;
  const nestedPattern = new RegExp(`^  ${key}:\\s*(.*)$`);
  for (const rawLine of lines) {
    if (/^counts:\s*$/.test(rawLine)) {
      inCounts = true;
      continue;
    }
    if (inCounts && /^[^\s#]/.test(rawLine)) {
      inCounts = false;
    }
    if (inCounts) {
      const match = rawLine.match(nestedPattern);
      if (match && match[1] !== undefined) {
        const value = stripComment(match[1]);
        const n = Number.parseInt(value, 10);
        return Number.isFinite(n) ? n : undefined;
      }
    }
  }
  return undefined;
}

type Row = {
  skill: string;
  specVer: string;
  specRound: string;
  portableCell: string;
  portableState: "yes" | "no" | "unspecified";
  hypothesis: number;
  observed: number;
  verified: number;
  total: number;
  sumCheck: "ok" | "MISMATCH";
  legacyKey: boolean;
};

async function collectRow(path: string): Promise<Row> {
  const source = await readFile(path, "utf8");

  const skill = extractTopScalar(source, "skill") ?? "?";
  const specVer = extractTopScalar(source, "spec-version") ?? "-";
  const specRound = extractTopScalar(source, "spec-filed-round") ?? "-";
  const portableRaw = extractTopScalar(source, "portable");

  let legacyKey = false;
  let hypothesis = extractCount(source, "hypothesis");
  if (hypothesis === undefined) {
    const guessFallback = extractCount(source, "guess");
    if (guessFallback !== undefined) {
      hypothesis = guessFallback;
      legacyKey = true;
    }
  }

  const h = hypothesis ?? 0;
  const o = extractCount(source, "observed") ?? 0;
  const v = extractCount(source, "verified") ?? 0;
  const t = extractCount(source, "total") ?? 0;

  let portableCell = "-";
  let portableState: Row["portableState"] = "unspecified";
  if (portableRaw === "true") {
    portableCell = "yes";
    portableState = "yes";
  } else if (portableRaw === "false") {
    portableCell = "no";
    portableState = "no";
  }

  const sum = h + o + v;
  const sumCheck: Row["sumCheck"] = t === sum ? "ok" : "MISMATCH";

  return {
    skill,
    specVer,
    specRound,
    portableCell,
    portableState,
    hypothesis: h,
    observed: o,
    verified: v,
    total: t,
    sumCheck,
    legacyKey,
  };
}

async function main(): Promise<void> {
  const flags = parseArgs(process.argv.slice(2));
  if (flags.help) {
    printHelp();
    return;
  }

  const glob = new Glob(".claude/skills/*/blueprints/*.skill.yaml");
  const paths: string[] = [];
  // `dot: true` is required — `.claude` is a dotfile directory and Bun's
  // Glob otherwise skips it, returning zero matches. Discovered
  // 2026-04-20 against round-43 tally.sh parity.
  for await (const rel of glob.scan({ cwd: repoRoot, dot: true })) {
    paths.push(join(repoRoot, rel));
  }
  paths.sort();

  const rows = await Promise.all(paths.map(collectRow));

  const out: string[] = [];
  out.push("# Invariant-substrate tally\n");
  out.push(
    "Aggregated from every `.claude/skills/<pack>/blueprints/<name>.skill.yaml`. " +
      "Per-substrate tier counts plus portfolio totals. The " +
      "`hypothesis` column is the honest backlog — every entry " +
      "there is a candidate for promotion to `observed` (at " +
      "least one data point) or `verified` (mechanical check). " +
      "The tier names follow the " +
      "`docs/INVARIANT-SUBSTRATES.md` posture.\n",
  );
  out.push(
    "| Skill | Spec ver | Round | Portable | Hypothesis | Observed | Verified | Total | Sum-check | Legacy key? |",
  );
  out.push("|---|---|---|---|---:|---:|---:|---:|---|---|");

  let totH = 0;
  let totO = 0;
  let totV = 0;
  let totT = 0;
  let portableYes = 0;
  let portableNo = 0;
  let mismatches = 0;
  let legacyKeyHits = 0;

  for (const row of rows) {
    out.push(
      `| \`${row.skill}\` | ${row.specVer} | ${row.specRound} | ${row.portableCell} | ` +
        `${row.hypothesis} | ${row.observed} | ${row.verified} | ${row.total} | ` +
        `${row.sumCheck} | ${row.legacyKey ? "yes" : "no"} |`,
    );
    totH += row.hypothesis;
    totO += row.observed;
    totV += row.verified;
    totT += row.total;
    if (row.portableState === "yes") portableYes += 1;
    else if (row.portableState === "no") portableNo += 1;
    if (row.sumCheck === "MISMATCH") mismatches += 1;
    if (row.legacyKey) legacyKeyHits += 1;
  }

  const totalSum = totH + totO + totV;
  const grandCheck = totT === totalSum ? "ok" : "MISMATCH";

  out.push(
    `| **total (${rows.length} substrates)** | - | - | - | **${totH}** | **${totO}** | **${totV}** | **${totT}** | ${grandCheck} | - |`,
  );
  out.push("");
  out.push(
    `Portable / Zeta-specific split: **${portableYes} portable**, **${portableNo} zeta-specific**, ` +
      `${rows.length - portableYes - portableNo} unspecified.`,
  );

  if (legacyKeyHits > 0) {
    out.push("");
    out.push(
      `**${legacyKeyHits} substrate(s) still use the legacy \`guess:\` key.** ` +
        "Rename to `hypothesis:` per " +
        "`docs/DECISIONS/2026-04-20-tools-scripting-language.md` §Terminology.",
    );
  }

  if (mismatches > 0) {
    out.push("");
    out.push(
      `**${mismatches} substrate(s) have a declared \`total\` that does not match the sum of tiers.** ` +
        "Fix before relying on this report.",
    );
  }

  console.log(out.join("\n"));

  if (flags.failOnMismatch && mismatches > 0) {
    process.exit(2);
  }
  if (flags.failOnNoProgress && totH > 0) {
    process.exit(1);
  }
}

await main();
