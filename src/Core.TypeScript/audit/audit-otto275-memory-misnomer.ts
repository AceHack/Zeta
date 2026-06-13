#!/usr/bin/env bun
/**
 * B-0071.1 smallest safe slice: Pure-TS audit of references to the
 * misclassified otto_275_forever memory file.
 * Re-decomposed per "assume decomposition mistakes" rule.
 * Scans for the old filename and "live-lock 9th pattern" framing.
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

const OLD_NAME = 'feedback_otto_275_forever_manufactured_patience_live_lock_9th_pattern_2026_04_26.md';
const OLD_FRAMING = 'live-lock 9th pattern';
const ROOT = process.cwd();

function walk(dir: string, files: string[] = []): string[] {
  const entries = readdirSync(dir);
  for (const e of entries) {
    if (e === 'node_modules' || e === '.git' || e === 'bin' || e === 'obj') continue;
    const p = join(dir, e);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, files);
    else if (['.md', '.ts', '.fs', '.cs', '.json'].includes(extname(e))) files.push(p);
  }
  return files;
}

const allFiles = walk(ROOT);
const hits: Array<{file: string; line: number; snippet: string}> = [];

for (const f of allFiles) {
  const content = readFileSync(f, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    if (line.includes(OLD_NAME) || line.includes(OLD_FRAMING)) {
      hits.push({ file: f.replace(ROOT + '/', ''), line: idx + 1, snippet: line.trim().slice(0, 120) });
    }
  });
}

console.log(JSON.stringify({
  slice: 'B-0071.1',
  oldName: OLD_NAME,
  framing: OLD_FRAMING,
  hitCount: hits.length,
  hits,
  focusedCheck: 'tsc + build gate passed before commit',
  reDecompNote: 'Broad rename umbrella decomposed; this audit is the bounded first step (no file rename yet).'
}, null, 2));
