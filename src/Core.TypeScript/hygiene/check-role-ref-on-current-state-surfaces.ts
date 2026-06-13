#!/usr/bin/env bun
// check-role-ref-on-current-state-surfaces.ts — TS port of the .sh script.
// Validates current-state surfaces use role-refs, not direct name attribution.
// Origin: B-0162 (5 catches on PR #1202 past mechanization breakeven).
// Rule 0: TS over .sh for non-install-graph scripts.

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, basename } from "node:path";

const strict = process.argv.includes("--strict");
const softLaunch = !strict && (process.env.ROLE_REF_CHECK_SOFT_LAUNCH ?? "1") === "1";

const repoRoot = (() => {
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
  } catch {
    return process.cwd();
  }
})();

const CURRENT_STATE_SURFACES = [
  "CLAUDE.md",
  "AGENTS.md",
  "GOVERNANCE.md",
  "docs/ALIGNMENT.md",
  "docs/CONFLICT-RESOLUTION.md",
  "docs/AGENT-BEST-PRACTICES.md",
  "docs/GLOSSARY.md",
  "docs/WONT-DO.md",
  "docs/VISION.md",
  "docs/ROADMAP.md",
  ".claude/skills/**/SKILL.md",
  ".claude/agents/*.md",
];

function findFilesRecursive(dir: string, fileName: string): string[] {
  const results: string[] = [];
  if (!existsSync(dir)) return results;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findFilesRecursive(full, fileName));
    } else if (entry.name === fileName) {
      results.push(full);
    }
  }
  return results;
}

function expandSurfaces(patterns: string[]): string[] {
  const result: string[] = [];
  for (const pattern of patterns) {
    if (pattern.includes("**")) {
      const [prefix] = pattern.split("/**/");
      if (prefix === undefined) continue;
      const leaf = basename(pattern);
      const dir = join(repoRoot, prefix);
      for (const f of findFilesRecursive(dir, leaf)) {
        result.push(f.replace(repoRoot + "/", ""));
      }
    } else if (pattern.includes("*")) {
      const dir = join(repoRoot, pattern.split("/").slice(0, -1).join("/"));
      const suffix = pattern.split("/").pop()!.replace("*", "");
      if (existsSync(dir)) {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
          if (entry.isFile() && entry.name.endsWith(suffix)) {
            result.push(join(pattern.split("/").slice(0, -1).join("/"), entry.name));
          }
        }
      }
    } else {
      result.push(pattern);
    }
  }
  return result;
}

function parseRosterNames(): string[] {
  const registryPath = join(repoRoot, "docs/EXPERT-REGISTRY.md");
  if (!existsSync(registryPath)) return [];
  const content = readFileSync(registryPath, "utf8");
  const names: string[] = [];
  const re = /^\| \*\*[^|]+\*\* \| \*\*([A-Z][a-z]+)\*\* \|/gm;
  let match: RegExpExecArray | null;
  while ((match = re.exec(content)) !== null) {
    if (match[1]) names.push(match[1]);
  }
  return names;
}

const rosterNames = parseRosterNames();
const extraPersonas = ["Otto", "Amara", "Ani", "Sova", "Rodney", "Nazar", "Ilyana", "Riven"];
const humanNames = ["Aaron", "Max"];
const externalAiNames = ["Claude.ai", "Codex", "Gemini"];
const allNames = [...new Set([...rosterNames, ...extraPersonas, ...humanNames, ...externalAiNames])];

const surfaces = expandSurfaces(CURRENT_STATE_SURFACES);
let violations = 0;

for (const surface of surfaces) {
  const fullPath = join(repoRoot, surface);
  if (!existsSync(fullPath)) continue;

  const lines = readFileSync(fullPath, "utf8").split("\n");

  for (const name of allNames) {
    if (!name) continue;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line === undefined) continue;

      if (line.trimStart().startsWith("```")) continue;
      if (line.includes(`\`${name}\``)) continue;

      let pattern: RegExp;
      if (name === "Claude.ai") {
        pattern = /\bClaude\.ai( 2026| 2027|: |[ '][a-z])/;
      } else {
        pattern = new RegExp(
          `\\b${name}( 2026| 2027|'s [a-z]| said| grants| proposed| asked| corrected| confirmed| disclosed)`
        );
      }

      if (pattern.test(line)) {
        const lineNum = i + 1;
        process.stderr.write(
          `VIOLATION: ${surface}:${lineNum}: direct name attribution '${name}' on current-state surface\n` +
          `  ${line.trim()}\n` +
          `  Fix: replace with role-ref (e.g., 'the human maintainer', 'the architect')\n` +
          `       OR move to history surface (memory/, docs/research/**, etc.)\n`
        );
        violations++;
      }
    }
  }
}

process.stderr.write(
  `\nchecked ${surfaces.length} current-state surfaces; ${violations} violations\n`
);

if (violations > 0) {
  process.stderr.write(
    "\nPer docs/AGENT-BEST-PRACTICES.md Otto-279 carve-out:\n" +
    "  current-state surfaces use role-refs ('the maintainer', 'the architect')\n" +
    "  persona / human / external-AI names are reserved for history surfaces\n"
  );
  if (softLaunch) {
    process.stderr.write(
      "\n[SOFT-LAUNCH MODE: exit 0 despite violations. Use --strict or\n" +
      " ROLE_REF_CHECK_SOFT_LAUNCH=0 to enforce.]\n"
    );
    process.exit(0);
  }
  process.exit(1);
}

process.exit(0);
