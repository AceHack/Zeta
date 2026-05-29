#!/usr/bin/env bun
// check-semantic-equivalence.ts -- finds claims of semantic equivalence in markdown files.
// Part of B-0170.1.

import fs from 'fs';
import path from 'path';

const CLAIM_REGEX = /`([^`]+)`\s+(is equivalent to|is an alias for|is the same as)\s+`([^`]+)`/gi;
// `upstreams` excludes references/upstreams/ — 85+ full clones of external
// projects; walking it takes minutes and returns mostly noise (per
// .claude/rules/references-upstreams-not-our-code-search-excludes.md).
const IGNORE_DIRS = ['node_modules', '.git', '.vscode', '.idea', 'dist', 'build', 'upstreams'];
const INCLUDE_EXTS = ['.md', '.mdx'];

interface Match {
  file: string;
  line: number;
  claim: string;
}

function searchInFile(filePath: string): Match[] {
  const matches: Match[] = [];
  if (!INCLUDE_EXTS.some(ext => filePath.endsWith(ext))) {
    return matches;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      let match;
      while ((match = CLAIM_REGEX.exec(line)) !== null) {
        matches.push({
          file: filePath,
          line: i + 1,
          claim: match[0],
        });
      }
    }
  } catch (error) {
    // Surface read failures to stderr so silently-skipped files are visible
    // (a swallowed read produces a false negative — "no claims" when the file
    // was actually unreadable).
    console.error(`warn: could not read ${filePath}: ${(error as Error).message}`);
  }

  return matches;
}

function searchInDirectory(dirPath: string): Match[] {
  let allMatches: Match[] = [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (IGNORE_DIRS.includes(entry.name)) {
      continue;
    }

    if (entry.isDirectory()) {
      allMatches = allMatches.concat(searchInDirectory(fullPath));
    } else if (entry.isFile()) {
      allMatches = allMatches.concat(searchInFile(fullPath));
    }
  }

  return allMatches;
}

function main() {
  const searchDir = process.argv[2] || process.cwd();
  console.log(`Searching for semantic equivalence claims in ${searchDir}...\n`);

  const allMatches = searchInDirectory(searchDir);

  if (allMatches.length === 0) {
    console.log('No semantic equivalence claims found.');
    return;
  }

  console.log(`Found ${allMatches.length} potential claims:\n`);
  for (const match of allMatches) {
    console.log(`- ${match.file}:${match.line}`);
    console.log(`  > ${match.claim}`);
  }
}

if (import.meta.main) {
  main();
}
