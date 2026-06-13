#!/usr/bin/env bun
// audit-descriptions.ts — smallest safe slice for B-0347
// Scans .claude/skills/*/SKILL.md frontmatter descriptions and reports
// those exceeding the 120-char routing budget target.
// This is the bounded first step: diagnostic tool only, no mutation.
// Follows Rule 0 (TS), carved-sentence discipline, and substrate-or-it-didn't-happen.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const SKILLS_ROOT = join(import.meta.dir, "../../.claude/skills");
const MAX_CHARS = 120;

interface SkillReport {
  name: string;
  descLen: number;
  exceeds: boolean;
  sample: string;
}

function parseDescription(content: string): string | null {
  const match = content.match(/^description:\s*(.+?)(?:\n|$)/m);
  if (!match) return null;
  return match[1]?.trim().replace(/^["']|["']$/g, "") ?? null;
}

function main() {
  const reports: SkillReport[] = [];
  const skillDirs = readdirSync(SKILLS_ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  for (const dir of skillDirs) {
    const skillPath = join(SKILLS_ROOT, dir, "SKILL.md");
    try {
      const content = readFileSync(skillPath, "utf8");
      const desc = parseDescription(content);
      if (desc) {
        const len = desc.length;
        reports.push({
          name: dir,
          descLen: len,
          exceeds: len > MAX_CHARS,
          sample: desc.slice(0, 80) + (desc.length > 80 ? "..." : ""),
        });
      }
    } catch {
      // skip unreadable
    }
  }

  const exceeding = reports.filter((r) => r.exceeds);
  const total = reports.length;
  const droppedEstimate = Math.max(0, total - 200); // rough, matches original symptom

  console.log(JSON.stringify({
    totalSkills: total,
    exceedingBudget: exceeding.length,
    droppedEstimate,
    maxLen: Math.max(...reports.map(r => r.descLen)),
    sampleExceeding: exceeding.slice(0, 5).map(r => ({ name: r.name, len: r.descLen, sample: r.sample })),
    note: "B-0347 smallest slice: audit tool. Next slice: carve + re-run.",
  }, null, 2));
}

main();