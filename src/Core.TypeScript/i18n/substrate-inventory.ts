#!/usr/bin/env bun
/**
 * B-0004.1 Substrate inventory scanner (TS)
 * Scans repo for translation targets: docs, skills, memory, code comments.
 * Outputs JSON inventory for downstream translation pipeline.
 * Part of re-decomposition of B-0004 (assumed mistakes in prior 12-child split;
 * this is the smallest atomic first step: pure read-only scan, no mutation).
 */

import { readdirSync, readFileSync, statSync } from "fs";
import { join, extname } from "path";

interface Inventory {
  docs: string[];
  skills: string[];
  memory: string[];
  codeComments: string[]; // F# / C# / TS files with // or (* comments
  totalTargets: number;
  generatedAt: string;
}

function walk(dir: string, exts: string[], results: string[] = []): string[] {
  const ignores = ["node_modules", "bin", ".lake", ".git", ".cursor", "private", "tmp", "worktrees", "target", "dist", ".next"];
  try {
    const entries = readdirSync(dir);
    for (const e of entries) {
      const p = join(dir, e);
      if (ignores.some((i) => p.includes(i))) continue;
      const st = statSync(p);
      if (st.isDirectory()) {
        walk(p, exts, results);
      } else if (st.isFile() && exts.includes(extname(p))) {
        results.push(p);
      }
    }
  } catch (e) {
    // per-dir error: continue (e.g. permission)
  }
  return results;
}

async function scan(): Promise<Inventory> {
  const docsAll = walk("docs", [".md"]).filter((p) => !p.includes("trajectories/RESUME"));
  const skills = walk(".claude/skills", [".md"]).filter((p) => p.endsWith("SKILL.md"));
  const memory = walk("memory", [".md"]);
  const codeFiles = walk(".", [".fs", ".fsx", ".cs", ".ts"]);

  const codeComments: string[] = [];
  for (const f of codeFiles.slice(0, 50)) { // bounded to keep step atomic
    try {
      const content = readFileSync(f, "utf8");
      if (content.includes("//") || content.includes("(*")) {
        codeComments.push(f);
      }
    } catch {}
  }

  return {
    docs: docsAll,
    skills,
    memory,
    codeComments,
    totalTargets: docsAll.length + skills.length + memory.length + codeComments.length,
    generatedAt: new Date().toISOString(),
  };
}

export async function main() {
  const inv = await scan();
  console.log(JSON.stringify(inv, null, 2));
  process.exit(0);
}

if (import.meta.main) {
  await main();
}
