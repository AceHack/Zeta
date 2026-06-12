#!/usr/bin/env bun
/**
 * substrate-claim-checker / check-cross-surface.ts (v0.8)
 *
 * Cross-surface count drift sub-class checker — catches count claims in
 * YAML frontmatter `description:` fields that are inconsistent with the
 * actual table row counts in the document body.
 *
 * Empirical eval-set (instances from the verify-then-claim memo):
 *   #19: frontmatter description + MEMORY.md index said "9 drift instances"
 *        but body table had 15+ rows.
 *   #20: frontmatter description updated to "18+" but body table still
 *        had only 15 rows — the count-drift fix introduced opposite-
 *        direction drift.
 *
 * How it works:
 *   1. Parses YAML frontmatter (leading `---` block)
 *   2. Extracts count claims from the `description:` field using the
 *      same noun vocabulary as check-counts.ts
 *   3. Finds all markdown tables in the document body
 *   4. For each count claim, checks if ANY body table satisfies it:
 *      - exact match for "N noun" claims
 *      - at-least match for "N+ noun" claims
 *   5. Reports drift if no table satisfies the claim
 *
 * "Any-table" semantics (vs check-counts.ts "nearest-table"):
 *   Frontmatter precedes the entire body, so "nearest table below" is
 *   meaningless. A multi-table file (drift-instances table + sub-classes
 *   table) passes if any one table matches the claimed count.
 *
 * Usage:
 *   bun tools/substrate-claim-checker/check-cross-surface.ts <file>
 *   bun tools/substrate-claim-checker/check-cross-surface.ts <file1> <file2> ...
 *
 * Exit code:
 *   0  no drift detected
 *   1  drift detected, input error, or no inputs given
 */

import { readFileSync } from "node:fs";
import { findTables } from "./check-counts.ts";

export interface Finding {
  file: string;
  field: string;
  claim: string;
  claimedCount: number;
  claimIsMinimum: boolean;
  actualCounts: number[];
}

interface FrontmatterClaim {
  raw: string;
  n: number;
  isMinimum: boolean;
  noun: string;
}

/** YAML frontmatter parse result. */
interface Frontmatter {
  fields: Record<string, string>;
  /** Byte offset in the original string where the body begins. */
  bodyStart: number;
  /** 1-indexed line number where the body begins (for error messages). */
  bodyLineStart: number;
}

const TRACKED_NOUNS = [
  "drift instances",
  "drift instance",
  "rows",
  "row",
  "items",
  "item",
  "procedure skills",
  "named-persona experts",
  "tools",
  "sub-classes",
  "check-types",
] as const;

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Extract count claims from a flat string (no fenced code blocks). */
export function extractClaims(text: string): FrontmatterClaim[] {
  const claims: FrontmatterClaim[] = [];
  const nounAlt = TRACKED_NOUNS.map(escapeRegex).join("|");
  const pattern = new RegExp(`\\b(\\d+)(\\+?)[\\s-]+(${nounAlt})\\b`, "gi");
  for (const m of text.matchAll(pattern)) {
    const numStr = m[1];
    const plus = m[2];
    const noun = m[3];
    if (numStr === undefined || noun === undefined) continue;
    claims.push({
      raw: m[0] ?? "",
      n: parseInt(numStr, 10),
      isMinimum: plus === "+",
      noun: noun.toLowerCase(),
    });
  }
  return claims;
}

/** Parse YAML frontmatter from a markdown file. Returns null if absent. */
export function parseFrontmatter(content: string): Frontmatter | null {
  if (!content.startsWith("---")) return null;
  const endIdx = content.indexOf("\n---", 3);
  if (endIdx === -1) return null;

  const yaml = content.slice(4, endIdx);
  const fields: Record<string, string> = {};
  for (const line of yaml.split("\n")) {
    const match = line.match(/^(\w[\w-]*):\s*(.*)/);
    if (match) {
      fields[match[1]!] = (match[2] ?? "").replace(/^["']|["']$/g, "").trim();
    }
  }

  const bodyStart = endIdx + 4; // skip past "\n---"
  const bodyLineStart = content.slice(0, bodyStart).split("\n").length + 1;
  return { fields, bodyStart, bodyLineStart };
}

export function checkFile(filePath: string): { findings: Finding[]; ok: boolean } {
  let content: string;
  try {
    content = readFileSync(filePath, "utf-8");
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      console.error(`error: file not found: ${filePath}`);
    } else if (code === "EISDIR") {
      console.error(`error: not a regular file (directory): ${filePath}`);
    } else {
      console.error(`error: read failed for ${filePath}: ${(err as Error).message}`);
    }
    return { findings: [], ok: false };
  }

  const fm = parseFrontmatter(content);
  if (!fm) return { findings: [], ok: true };

  const description = fm.fields["description"];
  if (!description) return { findings: [], ok: true };

  const claims = extractClaims(description);
  if (claims.length === 0) return { findings: [], ok: true };

  const bodyLines = content.slice(fm.bodyStart).split("\n");
  const tables = findTables(bodyLines);

  if (tables.length === 0) return { findings: [], ok: true };

  const actualCounts = tables.map((t) => t.rowCount);
  const findings: Finding[] = [];

  for (const claim of claims) {
    const satisfied = claim.isMinimum
      ? actualCounts.some((c) => c >= claim.n)
      : actualCounts.some((c) => c === claim.n);

    if (!satisfied) {
      findings.push({
        file: filePath,
        field: "description",
        claim: claim.raw,
        claimedCount: claim.n,
        claimIsMinimum: claim.isMinimum,
        actualCounts,
      });
    }
  }

  return { findings, ok: true };
}

export function main(): number {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error(
      "usage: bun tools/substrate-claim-checker/check-cross-surface.ts <file> [<file> ...]",
    );
    return 1;
  }

  let totalFindings = 0;
  let inputErrors = 0;

  for (const arg of args) {
    const { findings, ok } = checkFile(arg);
    if (!ok) {
      inputErrors++;
      continue;
    }
    for (const f of findings) {
      const op = f.claimIsMinimum ? ">=" : "==";
      const actual = f.actualCounts.join(", ");
      console.log(
        `${f.file}: cross-surface count drift — frontmatter.${f.field} claims "${f.claim}" (expected ${op} ${f.claimedCount}); body tables have [${actual}] rows`,
      );
      totalFindings++;
    }
  }

  if (inputErrors > 0) {
    console.error(`\n${inputErrors} input error(s).`);
    return 1;
  }
  if (totalFindings > 0) {
    console.log(`\n${totalFindings} cross-surface count-drift finding(s).`);
    return 1;
  }
  console.log("no cross-surface count drift detected.");
  return 0;
}

if (import.meta.main) {
  process.exit(main());
}
