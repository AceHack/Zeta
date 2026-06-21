#!/usr/bin/env bun
// check-semantic-equivalence.ts -- finds claims of semantic equivalence in markdown files.
// Part of 081KSNY2Z0008QG0R002CK42QK.

import fs from 'fs';
import path from 'path';

const CLAIM_REGEX = /`([^`]+)`\s+(is equivalent to|is an alias for|is the same as)\s+`([^`]+)`/gi;
// `prior-art` excludes references/prior-art/ — 85+ full clones of external
// projects; walking it takes minutes and returns mostly noise (per
// .claude/rules/references-prior-art-not-our-code-search-excludes.md).
const IGNORE_DIRS = ['node_modules', '.git', '.vscode', '.idea', 'dist', 'build', 'prior-art'];
const INCLUDE_EXTS = ['.md', '.mdx'];

export interface Finding {
  file: string;
  line: number;
  claim: string;
  left: string;
  relation: string;
  right: string;
}

export function checkFile(filePath: string): { findings: Finding[]; ok: boolean } {
  const findings: Finding[] = [];
  if (!INCLUDE_EXTS.some(ext => filePath.endsWith(ext))) {
    return { findings, ok: true };
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    let inFence = false;
    let fenceChar = "";
    let fenceLen = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? '';
      const fenceMatch = line.match(/^(\s*)(`{3,}|~{3,})(.*)$/);
      if (fenceMatch) {
        const delim = fenceMatch[2] ?? "";
        const tail = fenceMatch[3] ?? "";
        if (!inFence) {
          inFence = true;
          fenceChar = delim[0] ?? "";
          fenceLen = delim.length;
        } else if (delim[0] === fenceChar && delim.length >= fenceLen && tail.trim() === "") {
          inFence = false;
          fenceChar = "";
          fenceLen = 0;
        }
        continue;
      }
      if (inFence) continue;

      CLAIM_REGEX.lastIndex = 0;
      let match;
      while ((match = CLAIM_REGEX.exec(line)) !== null) {
        findings.push({
          file: filePath,
          line: i + 1,
          claim: match[0],
          left: match[1] ?? '',
          relation: match[2] ?? '',
          right: match[3] ?? '',
        });
      }
    }
  } catch (error) {
    console.error(`error: read failed for ${filePath}: ${(error as Error).message}`);
    return { findings: [], ok: false };
  }

  return { findings, ok: true };
}

function searchInDirectory(dirPath: string): { findings: Finding[]; ok: boolean } {
  let allFindings: Finding[] = [];
  let allOk = true;
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (IGNORE_DIRS.includes(entry.name)) {
        continue;
      }

      if (entry.isDirectory()) {
        const result = searchInDirectory(fullPath);
        allFindings = allFindings.concat(result.findings);
        if (!result.ok) {
          allOk = false;
        }
      } else if (entry.isFile()) {
        const result = checkFile(fullPath);
        allFindings = allFindings.concat(result.findings);
        if (!result.ok) {
          allOk = false;
        }
      }
    }
  } catch (error) {
    console.error(`error: directory read failed for ${dirPath}: ${(error as Error).message}`);
    allOk = false;
  }

  return { findings: allFindings, ok: allOk };
}

export function main(): number {
  const args = process.argv.slice(2);
  const targets = args.length > 0 ? args : [process.cwd()];
  console.log(`Searching for semantic equivalence claims in ${targets.join(', ')}...\n`);

  let inputErrors = 0;
  let allFindings: Finding[] = [];

  for (const target of targets) {
    try {
      const stat = fs.statSync(target);
      if (stat.isDirectory()) {
        const result = searchInDirectory(target);
        allFindings = allFindings.concat(result.findings);
        if (!result.ok) {
          inputErrors++;
        }
      } else if (stat.isFile()) {
        const result = checkFile(target);
        allFindings = allFindings.concat(result.findings);
        if (!result.ok) {
          inputErrors++;
        }
      } else {
        console.error(`error: target is neither file nor directory: ${target}`);
        inputErrors++;
      }
    } catch (error) {
      console.error(`error: cannot stat target ${target}: ${(error as Error).message}`);
      inputErrors++;
    }
  }

  if (allFindings.length === 0) {
    console.log('No semantic equivalence claims found.');
  } else {
    console.log(`Found ${allFindings.length} potential claims:\n`);
    for (const f of allFindings) {
      console.log(`- ${f.file}:${f.line}`);
      console.log(`  > ${f.claim}`);
    }
  }

  if (inputErrors > 0) {
    console.error(`\n${inputErrors} input error(s).`);
    return 1;
  }

  return 0;
}

if (import.meta.main) {
  process.exit(main());
}
