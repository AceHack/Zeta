#!/usr/bin/env bun
// string-archaeology.ts — find which commits introduced (or removed) a string.
//
// Decision-archaeology tool (B-0169). Wraps `git log -w -S "<string>"` to
// answer the "when was THIS introduced?" question in existence-mode
// investigations. The `-w` flag suppresses whitespace-only false positives
// (anti-pattern #3 in the decision-archaeology SKILL.md).
//
// Usage (CLI):
//   bun tools/decision-archaeology/string-archaeology.ts "search term"
//   bun tools/decision-archaeology/string-archaeology.ts "search term" path/to/file
//   bun tools/decision-archaeology/string-archaeology.ts --help
//
// Output: JSON with { commits, summary } on stdout.
// Exit codes:
//   0 — query ran, JSON emitted (may have 0 commits found)
//   1 — bad arguments or git error

import { spawnSync } from 'child_process';

export interface ArchaeologyResult {
  commits: string[];
  summary: string;
}

export function findStringIntroduction(search: string, filePath?: string): ArchaeologyResult {
  if (!search || search.trim() === '') {
    return { commits: [], summary: 'No search string provided.' };
  }
  // -w suppresses whitespace-only commit false positives (SKILL.md anti-pattern #3)
  const args = ['log', '-w', '-S', search, '--oneline'];
  if (filePath) {
    args.push('--', filePath);
  }
  const result = spawnSync('git', args, {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  if (result.error) {
    return { commits: [], summary: `Error running git log: ${result.error.message}` };
  }
  if (result.status !== 0) {
    return { commits: [], summary: `git log exited with code ${result.status}: ${(result.stderr ?? '').trim()}` };
  }
  const output = (result.stdout ?? '').trim();
  const commits = output ? output.split('\n').filter(Boolean) : [];
  return {
    commits,
    summary: commits.length > 0
      ? `Found ${commits.length} commit(s) touching "${search}".`
      : `No commits found for "${search}".`,
  };
}

function printHelp(): void {
  console.log(`
string-archaeology.ts — decision-archaeology existence-mode tool

Find commits that introduced or removed a specific string.

Usage:
  bun tools/decision-archaeology/string-archaeology.ts <search>
  bun tools/decision-archaeology/string-archaeology.ts <search> <file>
  bun tools/decision-archaeology/string-archaeology.ts --help

Arguments:
  <search>   String to search for in git history (required)
  <file>     Optional path to limit search to a single file

Output: JSON  { commits: string[], summary: string }

Example:
  bun tools/decision-archaeology/string-archaeology.ts "double-hop"
  bun tools/decision-archaeology/string-archaeology.ts "HardwareCrc" src/
`.trim());
}

export function main(argv: readonly string[]): number {
  const args = argv.filter(a => a !== '');
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    printHelp();
    return args.length === 0 ? 1 : 0;
  }
  const search = args[0] ?? '';
  const filePath = args[1];
  const result = findStringIntroduction(search, filePath);
  console.log(JSON.stringify(result, null, 2));
  return 0;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
