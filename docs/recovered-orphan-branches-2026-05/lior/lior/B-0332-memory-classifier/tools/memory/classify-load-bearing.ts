#!/usr/bin/env bun
// classify-load-bearing.ts - Classifies memory files as load-bearing or decorative.
// Part of B-0332.

import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

const CORE_DOCS = ['CLAUDE.md', 'GEMINI.md', 'GOVERNANCE.md', 'ALIGNMENT.md'];
const MEMORY_DIR = 'memory';
const MEMORY_FILE_REGEX = /memory\/[a-zA-Z0-9_-]+\.md/g;

interface MemoryFile {
  path: string;
  composesWith: string[];
}

function findMemoryFiles(): string[] {
  try {
    return fs.readdirSync(MEMORY_DIR).filter(f => f.endsWith('.md')).map(f => path.join(MEMORY_DIR, f));
  } catch {
    return [];
  }
}

function parseMemoryFile(filePath: string): MemoryFile | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const frontmatterMatch = content.match(/---([\s\S]*?)---/);
    if (!frontmatterMatch) return null;

    const frontmatter = yaml.load(frontmatterMatch[1] as string) as any;
    const composesWith = (frontmatter.composes_with || []).map((p: string) => path.normalize(p));

    return { path: filePath, composesWith };
  } catch {
    return null;
  }
}

function findInitialLoadBearing(memoryFiles: Set<string>): Set<string> {
  const loadBearing = new Set<string>();

  for (const doc of CORE_DOCS) {
    if (!fs.existsSync(doc)) continue;
    const content = fs.readFileSync(doc, 'utf-8');
    const matches = content.match(MEMORY_FILE_REGEX) || [];
    for (const match of matches) {
      if (memoryFiles.has(match)) {
        loadBearing.add(match);
      }
    }
  }
  return loadBearing;
}

function main() {
  const allMemoryFiles = findMemoryFiles();
  const allMemoryFilesSet = new Set(allMemoryFiles);
  const memoryFileMap = new Map<string, MemoryFile>();

  for (const filePath of allMemoryFiles) {
    const parsed = parseMemoryFile(filePath);
    if (parsed) {
      memoryFileMap.set(filePath, parsed);
    }
  }

  const loadBearing = findInitialLoadBearing(allMemoryFilesSet);
  const queue = [...loadBearing];

  while (queue.length > 0) {
    const currentPath = queue.shift()!;
    const memoryFile = memoryFileMap.get(currentPath);
    if (!memoryFile) continue;

    for (const composedPath of memoryFile.composesWith) {
      if (allMemoryFilesSet.has(composedPath) && !loadBearing.has(composedPath)) {
        loadBearing.add(composedPath);
        queue.push(composedPath);
      }
    }
  }

  console.log("--- Load-Bearing Memory Classification ---");
  console.log("\\n## Load-Bearing Memories:");
  for (const file of [...loadBearing].sort()) {
    console.log(`- ${file}`);
  }

  console.log("\\n## Decorative Memories:");
  for (const file of allMemoryFiles) {
    if (!loadBearing.has(file)) {
      console.log(`- ${file}`);
    }
  }
}

main();
