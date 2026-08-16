#!/usr/bin/env bun
/**
 * substrate-claim-checker / check-self-recursive.ts (v0.9.1)
 *
 * Self-recursive drift sub-class checker — catches the meta-failure
 * where a memo declaring itself to be ABOUT a drift sub-class then
 * violates that same discipline within its own body.
 *
 * Per the verify-then-claim memo's 7-class taxonomy (081KQNJ500008QG0R003SCWBDV):
 *   "the memo about drift contains its own drift"
 *
 * Mechanism is operationally honest — no heuristic topic detection.
 * Files opt in by declaring a topic via frontmatter:
 *
 *   ---
 *   self-check: count
 *   ---
 *
 * OR list form:
 *
 *   ---
 *   self-check: [count, existence]
 *   ---
 *
 * Supported topics (v0.9.1):
 *   - "count" — composes check-counts.ts; a memo about count-drift
 *     should not contain its own count-drift
 *   - "existence" — composes check-existence.ts; a memo about
 *     existence-drift should not reference paths that don't exist.
 *     Only drift-severity findings are surfaced (gitignored-but-extant
 *     warnings are a separate sub-class concern, not self-recursive).
 *
 * Adding additional topics (path-forms, cross-surface, convention)
 * is a 1-line dispatch each; deferred to follow-up slices per
 * 081KQNJ500008QG0R003SCWBDV done-criteria to keep slices bounded.
 *
 * Usage:
 *   bun src/Core.TypeScript/substrate-claim-checker/check-self-recursive.ts <file>
 *   bun src/Core.TypeScript/substrate-claim-checker/check-self-recursive.ts <file> ...
 *
 * Exit code:
 *   0  no self-recursive drift detected (or no self-check directive)
 *   1  self-recursive drift detected, input error, or no inputs given
 */

import { readFileSync } from "node:fs";
import { checkFile as checkCounts } from "./check-counts.ts";
import { checkFile as checkExistence } from "./check-existence.ts";
import { parseFrontmatter } from "./check-cross-surface.ts";

export type SelfCheckTopic = "count" | "existence";

export interface Finding {
  file: string;
  topic: SelfCheckTopic;
  /** Line number reported by the underlying checker. */
  line: number;
  /** Composed reason string from the underlying checker. */
  reason: string;
}

const SUPPORTED_TOPICS: ReadonlySet<string> = new Set<SelfCheckTopic>([
  "count",
  "existence",
]);

/**
 * Strip a YAML inline comment from the directive, respecting flow-sequence
 * brackets. A `#` preceded by whitespace (or at the start of the directive)
 * begins an inline comment that runs to end of line, but only when not
 * inside `[...]` flow-sequence brackets.
 */
function stripInlineComment(s: string): string {
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "[") depth++;
    else if (c === "]") depth--;
    else if (
      c === "#" &&
      depth === 0 &&
      (i === 0 || /\s/.test(s[i - 1]!))
    ) {
      return s.slice(0, i).trimEnd();
    }
  }
  return s;
}

/**
 * Parse the `self-check:` frontmatter directive into a topic list.
 *
 * Accepts: bare token `count`, or array form `[count]` / `[count, x]`.
 * YAML inline comments (`# ...` preceded by whitespace, outside flow
 * brackets) are stripped before tokenisation, so
 * `self-check: count # enable for this memo` is treated as `count`.
 * Unknown topics are dropped with a stderr warning so misspellings do
 * not silently disable the check.
 */
export function parseDirective(raw: string): SelfCheckTopic[] {
  const stripped = stripInlineComment(raw.trim());
  if (stripped === "") return [];

  let parts: string[];
  if (stripped.startsWith("[") && stripped.endsWith("]")) {
    parts = stripped.slice(1, -1).split(",");
  } else {
    parts = [stripped];
  }

  const out: SelfCheckTopic[] = [];
  for (const p of parts) {
    const tok = p.trim().replace(/^["']|["']$/g, "");
    if (tok === "") continue;
    if (SUPPORTED_TOPICS.has(tok)) {
      out.push(tok as SelfCheckTopic);
    } else {
      console.error(
        `warning: self-check topic "${tok}" not supported (v0.9.1 supports: count, existence)`,
      );
    }
  }
  return out;
}

export function checkFile(
  filePath: string,
): { findings: Finding[]; ok: boolean } {
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
      console.error(
        `error: read failed for ${filePath}: ${(err as Error).message}`,
      );
    }
    return { findings: [], ok: false };
  }

  const fm = parseFrontmatter(content);
  if (!fm) return { findings: [], ok: true };

  const directive = fm.fields["self-check"];
  if (!directive) return { findings: [], ok: true };

  const topics = parseDirective(directive);
  if (topics.length === 0) return { findings: [], ok: true };

  const findings: Finding[] = [];
  const dispatched = new Set<SelfCheckTopic>();
  let allInnerOk = true;
  for (const topic of topics) {
    if (dispatched.has(topic)) continue;
    dispatched.add(topic);
    if (topic === "count") {
      const result = checkCounts(filePath);
      if (!result.ok) {
        allInnerOk = false;
        continue;
      }
      for (const f of result.findings) {
        const op = f.claimIsMinimum ? ">=" : "==";
        findings.push({
          file: filePath,
          topic: "count",
          line: f.line,
          reason: `claim "${f.claim}" (expected ${op} ${f.claimedCount}) vs actual ${f.actualCount} (${f.context})`,
        });
      }
    } else if (topic === "existence") {
      const result = checkExistence(filePath);
      if (!result.ok) {
        allInnerOk = false;
        continue;
      }
      for (const f of result.findings) {
        // Only surface drift-severity (path doesn't exist).
        // "warning" severity (exists-but-gitignored) is a distinct
        // sub-class concern, not self-recursive failure.
        if (f.severity === "warning") continue;
        findings.push({
          file: filePath,
          topic: "existence",
          line: f.line,
          reason: `path claim "${f.pathClaim}" — ${f.reason}`,
        });
      }
    }
  }

  return { findings, ok: allInnerOk };
}

export function main(): number {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error(
      "usage: bun src/Core.TypeScript/substrate-claim-checker/check-self-recursive.ts <file> [<file> ...]",
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
      console.log(
        `${f.file}:${f.line}: self-recursive drift (${f.topic}) — ${f.reason}`,
      );
      totalFindings++;
    }
  }

  if (inputErrors > 0) {
    console.error(`\n${inputErrors} input error(s).`);
    return 1;
  }
  if (totalFindings > 0) {
    console.log(`\n${totalFindings} self-recursive drift finding(s).`);
    return 1;
  }
  console.log("no self-recursive drift detected.");
  return 0;
}

if (import.meta.main) {
  process.exit(main());
}
