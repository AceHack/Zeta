#!/usr/bin/env bun
// audit-skill-descriptions.ts — B-0347 helper: audit skill description lengths
// against routing budget. Reports long descriptions so carving batches can
// be targeted. TS-native, no bash.
//
// Usage: bun tools/skill-catalog/audit-skill-descriptions.ts
// Focused check output is included in the PR body for this slice.

import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SKILLS_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../.claude/skills");

interface AuditResult {
  readonly total: number;
  readonly long: number;
  readonly examples: readonly string[];
}

function extractDescription(content: string): string | null {
  // Capture full scalar up to end of line, then strip surrounding quotes.
  // Using [^"'\n]+ would exclude apostrophes mid-sentence (e.g. "Zeta's").
  const m = content.match(/^\s*description:\s*(.+?)\s*$/m);
  if (!m) return null;
  const raw = m[1];
  if (raw == null) return null;
  let val = raw.trim();
  if (
    (val.startsWith('"') && val.endsWith('"')) ||
    (val.startsWith("'") && val.endsWith("'"))
  ) {
    val = val.slice(1, -1).trim();
  }
  return val || null;
}

function auditDescriptions(): AuditResult {
  let total = 0;
  let long = 0;
  const examples: string[] = [];
  const entries = readdirSync(SKILLS_ROOT, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const skillMd = join(SKILLS_ROOT, e.name, "SKILL.md");
    let content: string;
    try {
      content = readFileSync(skillMd, "utf8");
    } catch {
      continue;
    }
    total++;
    const desc = extractDescription(content);
    if (desc && desc.length > 120) {
      long++;
      const short = desc.length > 80 ? desc.slice(0, 77) + "..." : desc;
      examples.push(`${e.name}/SKILL.md (${desc.length} chars): "${short}"`);
    }
  }
  return { total, long, examples };
}

export function main() {
  const result = auditDescriptions();
  console.log(`B-0347 audit: scanned ${result.total} skills, ${result.long} descriptions exceed 120-char routing budget.`);
  if (result.examples.length > 0) {
    console.log("\nLong descriptions (carve next batch from these):");
    for (const ex of result.examples.slice(0, 20)) {
      console.log("  " + ex);
    }
    if (result.examples.length > 20) {
      console.log(`  ... and ${result.examples.length - 20} more`);
    }
  } else {
    console.log("All skill descriptions are carved to single-sentence routing form.");
  }
  console.log("\nNext step: run carving batches on flagged skills (one PR per 5).");
}

if (import.meta.main) {
  main();
}
