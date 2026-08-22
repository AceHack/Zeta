#!/usr/bin/env bun
// check-archive-header-section33.ts — validates §33 archive header
// on courier-ferry / external-conversation imports under docs/research/**.
//
// TypeScript+Bun port of check-archive-header-section33.sh, slice 6
// of the TS+Bun migration. See docs/best-practices/repo-scripting.md.
//
// What this checks:
//   For every docs/research/**.md file matching a courier-ferry
//   import pattern (filename or first-20-lines content):
//   - First 20 lines contain all 4 required §33 labels at line-start.
//   - "Operational status:" value is enum-strict (research-grade |
//     operational; trailing whitespace tolerated).
//
// Usage:
//   bun tools/hygiene/check-archive-header-section33.ts
//
// Exit codes:
//   0   clean (or no docs/research/)
//   1   one or more violations

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

type ExitCode = 0 | 1;

interface Violation {
  readonly file: string;
  readonly missing: readonly string[];
  readonly badValue: string;
}

const SPAWN_MAX_BUFFER = 64 * 1024 * 1024;

const REQUIRED_LABELS: readonly string[] = [
  "Scope:",
  "Attribution:",
  "Operational status:",
  "Non-fusion disclaimer:",
];

const FILENAME_HINT_RE = /(courier-ferry|cross-substrate|external-import|cross-ferry)/;
const CONTENT_HINT_RE = /(courier.ferry|external conversation|external collaborator|external research agent|courier-ferry capture)/i;
const OP_STATUS_LINE_RE = /^Operational status:.*$/m;
const OP_STATUS_VALID_RE = /^Operational status: (research-grade|operational)[\t ]*$/;

function repoRoot(): string {
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  const result = spawnSync("git", ["rev-parse", "--show-toplevel"], {
    encoding: "utf8",
    maxBuffer: SPAWN_MAX_BUFFER,
  });
  if (result.status !== 0) return process.cwd();
  return result.stdout.trim();
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function listMarkdownRecursive(dir: string): readonly string[] {
  const out: string[] = [];
  const stack: string[] = [dir];
  while (stack.length > 0) {
    const cur = stack.pop();
    if (cur === undefined) continue;
    let entries: readonly import("node:fs").Dirent[];
    try {
      entries = readdirSync(cur, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const full = join(cur, e.name);
      if (e.isDirectory()) stack.push(full);
      else if (e.isFile() && e.name.endsWith(".md")) out.push(full);
    }
  }
  return out;
}

function readHead(path: string, n: number): string {
  let content: string;
  try {
    content = readFileSync(path, "utf8");
  } catch {
    return "";
  }
  return content.split("\n").slice(0, n).join("\n");
}

function isCourierFerryImport(file: string, headerRegion: string): boolean {
  if (FILENAME_HINT_RE.test(file)) return true;
  return CONTENT_HINT_RE.test(headerRegion);
}

function findMissingLabels(headerRegion: string): readonly string[] {
  const missing: string[] = [];
  const lines = headerRegion.split("\n");
  for (const label of REQUIRED_LABELS) {
    const found = lines.some((line) => line.startsWith(label));
    if (!found) missing.push(label);
  }
  return missing;
}

function findBadOpStatusValue(headerRegion: string): string {
  if (!/^Operational status:/m.test(headerRegion)) return "";
  const match = OP_STATUS_LINE_RE.exec(headerRegion);
  if (match === null) return "";
  const opLine = match[0];
  if (OP_STATUS_VALID_RE.test(opLine)) return "";
  return opLine;
}

export function audit(researchDir: string): readonly Violation[] {
  if (!isDirectory(researchDir)) return [];
  const files = listMarkdownRecursive(researchDir);
  const out: Violation[] = [];
  for (const file of files) {
    const header = readHead(file, 20);
    if (!isCourierFerryImport(file, header)) continue;
    const missing = findMissingLabels(header);
    const badValue = findBadOpStatusValue(header);
    if (missing.length > 0 || badValue !== "") {
      out.push({ file, missing, badValue });
    }
  }
  return out;
}

function relativize(file: string, root: string): string {
  const prefix = `${root}/`;
  return file.startsWith(prefix) ? file.slice(prefix.length) : file;
}

export function main(): ExitCode {
  const root = repoRoot();
  const researchDir = `${root}/docs/research`;

  if (!isDirectory(researchDir)) {
    process.stdout.write("OK: docs/research/ does not exist; nothing to check\n");
    return 0;
  }

  const violations = audit(researchDir);

  for (const v of violations) {
    const rel = relativize(v.file, root);
    if (v.missing.length > 0) {
      process.stderr.write(
        `VIOLATION: ${rel} missing §33 labels: ${v.missing.join(" ")}\n`,
      );
    }
    if (v.badValue !== "") {
      process.stderr.write(
        `VIOLATION: ${rel} 'Operational status:' value not enum-strict (must be 'research-grade' or 'operational' alone): ${v.badValue}\n`,
      );
    }
  }

  if (violations.length > 0) {
    process.stderr.write("\n");
    process.stderr.write(
      `FAIL: ${String(violations.length)} courier-ferry research-doc(s) missing GOVERNANCE.md §33 archive header(s)\n`,
    );
    process.stderr.write("\n");
    process.stderr.write("Required header (literal label form, NOT bold-styled) in first 20 lines:\n");
    process.stderr.write("  Scope: <one-line scope>\n");
    process.stderr.write("  Attribution: <named entities + first-name attribution per Otto-279>\n");
    process.stderr.write("  Operational status: <research-grade vs operational-policy>\n");
    process.stderr.write("  Non-fusion disclaimer: <attribution boundary preservation>\n");
    process.stderr.write("\n");
    process.stderr.write("Pattern reference: see PR #570 / #566 / #563 §33-header fixes for examples.\n");
    return 1;
  }

  process.stdout.write("OK: all courier-ferry research docs have §33 archive headers\n");
  return 0;
}

if (import.meta.main) {
  process.exit(main());
}
