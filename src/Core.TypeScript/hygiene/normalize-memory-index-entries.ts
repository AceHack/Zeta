#!/usr/bin/env bun
// normalize-memory-index-entries.ts — B-0072
//
// One-shot normalization of memory/MEMORY.md index bullet lines
// to ≤200 chars per the acceptance criteria in:
//   docs/backlog/P2/B-0072-memory-md-index-entry-length-normalization-copilot-pr-72-2026-04-28.md
//
// Format assumed: - [**DISPLAY_TEXT**](PATH) — DESCRIPTION
//
// Strategy:
//   1. Line ≤ 200 chars → leave as-is.
//   2. Display text fits in budget → truncate description to max 80 chars.
//   3. Display text alone exceeds budget → truncate display text, drop description.
//
// The description max of 80 chars comes from B-0072 § "each long entry
// collapses to title + ≤80-char hook."
//
// Usage (dry-run):  bun tools/hygiene/normalize-memory-index-entries.ts
// Usage (apply):    bun tools/hygiene/normalize-memory-index-entries.ts --write
// Usage (custom):   bun tools/hygiene/normalize-memory-index-entries.ts PATH [--write]
//
// Exit codes: 0 — ok (or dry-run), 1 — error.

import { readFileSync, writeFileSync } from "fs";

const MAX_LINE = 200;
const MAX_DESC = 80;

/**
 * Truncates `text` to at most `maxLen` chars, breaking at a sentence end
 * ("." followed by space/end) or word boundary (space), appending "…" when cut.
 */
function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  // Reserve one char for the ellipsis.
  const budget = maxLen - 1;
  // Try sentence boundary in the upper 40% of the budget.
  for (let i = budget; i > budget * 0.6; i--) {
    if (text[i - 1] === "." && (i >= text.length || text[i] === " ")) {
      return text.slice(0, i);
    }
  }
  // Try word boundary.
  for (let i = budget; i > 0; i--) {
    if (text[i] === " ") return text.slice(0, i) + "…";
  }
  return text.slice(0, budget) + "…";
}

/**
 * Truncates a Markdown display title like "**Bold Title Here**".
 * Preserves the opening/closing "**" so the link renders bold.
 * Falls back to plain truncation if no bold markers are found.
 */
function truncateTitle(displayText: string, maxLen: number): string {
  if (displayText.length <= maxLen) return displayText;
  const isBold =
    displayText.startsWith("**") && displayText.endsWith("**") && displayText.length > 4;
  if (!isBold) return truncate(displayText, maxLen);
  // "**" (2) + inner + "**" (2) = 4 overhead.
  const innerBudget = maxLen - 4;
  if (innerBudget < 2) return truncate(displayText, maxLen);
  const inner = displayText.slice(2, -2);
  const truncatedInner = truncate(inner, innerBudget);
  return "**" + truncatedInner + "**";
}

function normalizeLine(line: string): string {
  if (line.length <= MAX_LINE) return line;
  if (!line.startsWith("- [")) return line;

  // Parse:  - [DISPLAY_TEXT](PATH) — DESCRIPTION
  //         ^^^ m[1]         ^^^m[3]   ^^^ m[4] (optional)
  //             ^^^^^ m[2]
  //
  // The non-greedy (.*?) expands until (\]\([^)]+\)) can anchor on ](path.md),
  // correctly handling titles that themselves contain " — ".
  const m = line.match(/^(- \[)(.*?)(\]\([^)]+\))(?: — (.*))?$/);
  if (!m) return line; // Unrecognised format — leave unchanged.

  const prefix = m[1]!;
  const displayText = m[2]!;
  const linkClose = m[3]!;
  const rawDesc = m[4];
  const desc = rawDesc ?? "";
  const hasDesc = rawDesc !== undefined;

  // Fixed character overhead: prefix ("- [") + linkClose ("](path.md)").
  const fixedLen = prefix.length + linkClose.length;
  // Total budget for displayText + optional " — " + desc.
  const sepLen = hasDesc ? 3 : 0;
  const budget = MAX_LINE - fixedLen - sepLen;

  if (displayText.length <= budget) {
    // Display text fits; only the description is overflowing.
    if (!hasDesc || desc.length === 0) return line;
    const descBudget = Math.min(MAX_DESC, budget - displayText.length);
    if (descBudget <= 0) {
      // No room for any description character — drop it.
      return prefix + displayText + linkClose;
    }
    const shortDesc = truncate(desc, descBudget);
    return prefix + displayText + linkClose + " — " + shortDesc;
  }

  // Display text itself does not fit — truncate it and drop the description.
  const shortTitle = truncateTitle(displayText, budget);
  return prefix + shortTitle + linkClose;
}

// ─── Main ──────────────────────────────────────────────────────────────────

const [, , ...argv] = process.argv;
const filePath = argv.find((a) => !a.startsWith("--")) ?? "memory/MEMORY.md";
const doWrite = argv.includes("--write");

let source: string;
try {
  source = readFileSync(filePath, "utf-8");
} catch (e) {
  console.error(`Error reading ${filePath}: ${(e as Error).message}`);
  process.exit(1);
}

const lines = source.split("\n");
const normalized = lines.map(normalizeLine);

// Report
const changes: Array<{ lineNum: number; oldLen: number; newLen: number; old: string; next: string }> = [];
for (let i = 0; i < lines.length; i++) {
  if (lines[i] !== normalized[i]) {
    changes.push({ lineNum: i + 1, oldLen: lines[i]!.length, newLen: normalized[i]!.length, old: lines[i]!, next: normalized[i]! });
  }
}
const stillOver = normalized.filter((l) => l.length > MAX_LINE);

console.log(`File:          ${filePath}`);
console.log(`Total lines:   ${lines.length}`);
console.log(`Lines changed: ${changes.length}`);
console.log(`Still >200:    ${stillOver.length}`);
console.log();

if (stillOver.length > 0) {
  console.log("WARNING: lines still over 200 chars (path itself may be too long):");
  for (const l of stillOver.slice(0, 5)) {
    console.log(`  (${l.length}) ${l.slice(0, 100)}…`);
  }
  console.log();
}

// Show up to 10 sample changes.
const sample = changes.slice(0, 10);
for (const c of sample) {
  const oldSnip = c.old.length > 120 ? c.old.slice(0, 117) + "…" : c.old;
  const newSnip = c.next.length > 120 ? c.next.slice(0, 117) + "…" : c.next;
  console.log(`L${c.lineNum} (${c.oldLen} → ${c.newLen} chars):`);
  console.log(`  OLD: ${oldSnip}`);
  console.log(`  NEW: ${newSnip}`);
  console.log();
}

if (doWrite) {
  writeFileSync(filePath, normalized.join("\n"));
  console.log(`Written: ${filePath}`);
} else {
  console.log("Dry run — pass --write to apply.");
}
