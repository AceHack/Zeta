#!/usr/bin/env bun
// audit-memory-index-entry-lengths.ts — flag MEMORY.md index entries exceeding one-line limit
// per memory/README.md ("one line per memory file") and CLAUDE.md (~200 chars).
//
// Smallest safe slice of B-0072 (P2). Pure-TS implementation (Rule 0).
// Future slices can add auto-fix or integrate into B-0066 auto-gen.
//
// Usage:
//   bun tools/hygiene/audit-memory-index-entry-lengths.ts
//   bun ... --enforce   # exit 2 on any long entry
//
// Exit: 0 clean, 2 violations under --enforce, 64 arg error.

import { readFileSync } from "node:fs";

interface Args {
  readonly target: string;
  readonly enforce: boolean;
  readonly maxLen: number;
}

interface LongEntry {
  readonly line: number;
  readonly length: number;
  readonly text: string;
}

const HELP = "Usage: audit-memory-index-entry-lengths.ts [--file PATH] [--enforce] [--max N]\n";

function parseArgs(argv: readonly string[]): { kind: "args"; args: Args } | { kind: "help" } | { kind: "error"; message: string } {
  let target = "memory/MEMORY.md";
  let enforce = false;
  let maxLen = 200;
  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    if (arg === "--file") {
      const v = argv[i + 1];
      if (!v) return { kind: "error", message: "--file needs path" };
      target = v;
      i += 2;
    } else if (arg === "--enforce") {
      enforce = true;
      i++;
    } else if (arg === "--max") {
      const v = argv[i + 1];
      maxLen = v ? parseInt(v, 10) : 200;
      i += 2;
    } else if (arg === "-h" || arg === "--help") {
      return { kind: "help" };
    } else {
      return { kind: "error", message: `unknown: ${arg}` };
    }
  }
  return { kind: "args", args: { target, enforce, maxLen } };
}

function audit(file: string, max: number): LongEntry[] {
  const content = readFileSync(file, "utf8");
  const lines = content.split("\n");
  const findings: LongEntry[] = [];
  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("- [") || trimmed.startsWith("- `")) {
      const len = line.length; // raw for terminal width realism
      if (len > max) {
        findings.push({ line: idx + 1, length: len, text: trimmed.slice(0, 80) + "..." });
      }
    }
  });
  return findings;
}

function main() {
  const res = parseArgs(process.argv.slice(2));
  if (res.kind === "help") {
    console.log(HELP);
    process.exit(0);
  }
  if (res.kind === "error") {
    console.error(res.message);
    process.exit(64);
  }
  const { target, enforce, maxLen } = res.args;
  try {
    const bad = audit(target, maxLen);
    if (bad.length === 0) {
      console.log(`OK: all index entries ≤ ${maxLen} chars in ${target}`);
      process.exit(0);
    }
    console.error(`Found ${bad.length} long entries (> ${maxLen} chars):`);
    bad.forEach(f => console.error(`  L${f.line} (${f.length}c): ${f.text}`));
    process.exit(enforce ? 2 : 0);
  } catch (e) {
    console.error("IO error:", e);
    process.exit(64);
  }
}

main();
