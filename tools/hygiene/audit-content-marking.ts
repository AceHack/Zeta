#!/usr/bin/env bun
/**
 * audit-content-marking.ts — kid-safety floor enforcement (B-0926, ABSOLUTE).
 *
 * Charged-personal persona memory must be CONTAINED, not just marked: it
 * lives under gitignored `memory/persona/<name>/private/` paths so it never
 * reaches the published / AI-training surface (see `ai.txt` and
 * `memory/persona/README.md`). The structural floor is the gitignore; this
 * audit is the mechanized backstop that catches the LEAK case — a file that
 * carries `nsfw: true` / `private: true` frontmatter but is TRACKED (landed
 * outside a gitignored `private/` path). Any such file is a kid-safety floor
 * violation: marked content sitting on the public surface.
 *
 * Exit 0 = clean. Exit 1 = one or more tracked content-marked files.
 *
 * Part of the bystander-principle / content-marking convention. HARD LIMITS
 * (CSAM/abuse) are forbidden outright regardless of marking — see
 * `.claude/rules/methodology-hard-limits.md`.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO_ROOT = resolve(import.meta.dir, "..", "..");

export interface ContentMark {
  nsfw: boolean;
  private: boolean;
}

/**
 * Inspect a file's leading YAML frontmatter for content-marking flags.
 * Only the first `---`…`---` block (the file must START with `---`) is read,
 * so the same words appearing in the body do not count. Returns whether
 * `nsfw: true` and/or `private: true` are present (case-insensitive;
 * `yes`/`on` accepted as YAML-truthy synonyms).
 */
export function parseContentMark(content: string): ContentMark {
  const result: ContentMark = { nsfw: false, private: false };
  if (!content.startsWith("---")) return result; // frontmatter must be at top
  const lines = content.split(/\r?\n/);
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!.trim(); // loop bound (i < lines.length) → defined
    if (line === "---") break; // end of the leading frontmatter block
    const m = line.match(/^(nsfw|private)\s*:\s*(true|yes|on)\s*$/i);
    if (m) {
      // Capture group 1 is required by the regex — when m is truthy, m[1]
      // is a guaranteed string. Non-null assertion preserves the invariant
      // explicitly (per check-no-op-cadence-pattern.ts).
      const key = m[1]!.toLowerCase();
      if (key === "nsfw") result.nsfw = true;
      if (key === "private") result.private = true;
    }
  }
  return result;
}

export function isContentMarked(content: string): boolean {
  const mark = parseContentMark(content);
  return mark.nsfw || mark.private;
}

/**
 * Given a list of file paths and a reader, return the subset that carry
 * content-marking frontmatter. These are the leak set: marked content that
 * is tracked / on the published surface and should instead live under a
 * gitignored `private/` path (or have the marking removed if genuinely
 * public). Unreadable files are skipped rather than throwing.
 */
export function findLeakedFiles(
  files: string[],
  read: (file: string) => string,
): string[] {
  const leaks: string[] = [];
  for (const file of files) {
    let content: string;
    try {
      content = read(file);
    } catch {
      continue;
    }
    if (isContentMarked(content)) leaks.push(file);
  }
  return leaks;
}

function trackedMarkdownFiles(): string[] {
  const out = execFileSync("git", ["ls-files"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  return out
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.endsWith(".md"));
}

function main(): void {
  const files = trackedMarkdownFiles();
  const leaks = findLeakedFiles(files, (f) =>
    readFileSync(resolve(REPO_ROOT, f), "utf8"),
  );
  if (leaks.length === 0) {
    console.log(
      `audit-content-marking: OK — 0 tracked content-marked files ` +
        `(${files.length} markdown files scanned).`,
    );
    return;
  }
  console.error(
    `audit-content-marking: FAIL — ${leaks.length} tracked file(s) carry ` +
      `nsfw:/private: frontmatter.\n` +
      `These must live under a gitignored memory/persona/<name>/private/ ` +
      `path, NOT on the published / AI-training surface (kid-safety floor, ` +
      `B-0926). Move them, or remove the marking if the content is ` +
      `genuinely public:\n`,
  );
  for (const f of leaks) console.error(`  - ${f}`);
  process.exit(1);
}

if (import.meta.main) main();
