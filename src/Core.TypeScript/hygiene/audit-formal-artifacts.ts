#!/usr/bin/env bun
// audit-formal-artifacts.ts — 081KQGDBJ0008QG0R002S9SWH6 first slice: catalog formal verification
// artifacts and their substrate-status.
//
// Uses `git ls-files` (avoids worktree duplication) and a single-pass
// reference index (avoids per-artifact grep spawning).
//
// Usage:
//   bun src/Core.TypeScript/hygiene/audit-formal-artifacts.ts
//   bun src/Core.TypeScript/hygiene/audit-formal-artifacts.ts --json

import { readFileSync } from "node:fs";
import { dirname, resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, "..", "..", "..");

type Category = "lean4" | "tla+" | "z3" | "alloy" | "formal-test";

interface FormalArtifact {
  readonly path: string;
  readonly category: Category;
  readonly lines: number;
  readonly referencedIn: readonly string[];
  readonly substrateStatus: "referenced" | "unreferenced";
}

async function gitLsFiles(...patterns: string[]): Promise<string[]> {
  const proc = Bun.spawn({
    cmd: ["git", "ls-files", "--", ...patterns],
    cwd: REPO_ROOT,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (exitCode !== 0) {
    throw new Error(`git ls-files failed (exit ${exitCode}): ${stderr.trim()}`);
  }
  return stdout
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

function countLines(relPath: string): number {
  try {
    const text = readFileSync(resolve(REPO_ROOT, relPath), "utf-8");
    if (text.length === 0) return 0;
    let count = 0;
    for (let i = 0; i < text.length; i++) {
      if (text.charCodeAt(i) === 10) count++;
    }
    return count;
  } catch {
    return 0;
  }
}

function classify(relPath: string): Category | null {
  const ext = extname(relPath).toLowerCase();
  if (ext === ".lean") return "lean4";
  if (ext === ".tla") return "tla+";
  if (ext === ".smt2") return "z3";
  if (ext === ".als") return "alloy";
  if (relPath.startsWith("tools/Z3Verify/") && (ext === ".fs" || ext === ".fsproj"))
    return "z3";
  if (relPath.startsWith("tools/alloy/") && ext === ".java") return "alloy";
  if (relPath.includes("Formal/") && ext === ".fs" && relPath.startsWith("tests/"))
    return "formal-test";
  return null;
}

async function buildReferenceIndex(): Promise<Map<string, string>> {
  const substrateMdFiles = await gitLsFiles("docs/**/*.md");

  const index = new Map<string, string>();

  for (const mdFile of substrateMdFiles) {
    try {
      const content = readFileSync(resolve(REPO_ROOT, mdFile), "utf-8");
      index.set(mdFile, content);
    } catch {
      // skip unreadable
    }
  }

  return index;
}

function findRefsInIndex(
  relPath: string,
  index: Map<string, string>,
): string[] {
  const refs: string[] = [];

  for (const [mdFile, content] of index) {
    if (content.includes(relPath)) {
      refs.push(mdFile);
    }
  }

  return refs.sort();
}

function nowIso(): string {
  return `${new Date().toISOString().slice(0, 16)}Z`;
}

function emitMarkdown(artifacts: FormalArtifact[]): void {
  const referenced = artifacts.filter((a) => a.substrateStatus === "referenced");
  const unreferenced = artifacts.filter((a) => a.substrateStatus === "unreferenced");
  const totalLines = artifacts.reduce((sum, a) => sum + a.lines, 0);

  console.log(`# Formal Artifact Catalog (${nowIso()})`);
  console.log("");
  console.log(
    "081KQGDBJ0008QG0R002S9SWH6 first-slice output. Scans Lean4, TLA+, Z3, Alloy files and",
  );
  console.log(
    "formal test harnesses. Cross-references against docs/ for substrate-status.",
  );
  console.log("");
  console.log("## Summary");
  console.log("");
  console.log("| Metric | Value |");
  console.log("|--------|-------|");
  console.log(`| Total artifacts | ${artifacts.length} |`);
  console.log(`| Total lines | ${totalLines} |`);
  console.log(`| Referenced in substrate | ${referenced.length} |`);
  console.log(`| Unreferenced | ${unreferenced.length} |`);
  console.log("");

  const categories: Category[] = ["lean4", "tla+", "z3", "alloy", "formal-test"];
  console.log("### By category");
  console.log("");
  console.log("| Category | Files | Lines | Referenced | Unreferenced |");
  console.log("|----------|-------|-------|------------|--------------|");
  for (const cat of categories) {
    const items = artifacts.filter((a) => a.category === cat);
    if (items.length === 0) continue;
    const lines = items.reduce((s, a) => s + a.lines, 0);
    const ref = items.filter((a) => a.substrateStatus === "referenced").length;
    const unref = items.filter((a) => a.substrateStatus === "unreferenced").length;
    console.log(`| ${cat} | ${items.length} | ${lines} | ${ref} | ${unref} |`);
  }
  console.log("");

  const labels: Record<Category, string> = {
    lean4: "Lean 4",
    "tla+": "TLA+",
    z3: "Z3 / SMT",
    alloy: "Alloy",
    "formal-test": "Formal Tests",
  };

  for (const cat of categories) {
    const items = artifacts.filter((a) => a.category === cat);
    if (items.length === 0) continue;
    console.log(`## ${labels[cat]}`);
    console.log("");
    for (const a of items) {
      const status =
        a.substrateStatus === "referenced" ? "REFERENCED" : "**UNREFERENCED**";
      console.log(`### \`${a.path}\``);
      console.log(`- Lines: ${a.lines}`);
      console.log(`- Status: ${status}`);
      if (a.referencedIn.length > 0) {
        console.log("- Referenced in:");
        for (const ref of a.referencedIn.slice(0, 5)) {
          console.log(`  - ${ref}`);
        }
        if (a.referencedIn.length > 5) {
          console.log(`  - ... and ${a.referencedIn.length - 5} more`);
        }
      }
      console.log("");
    }
  }

  if (unreferenced.length > 0) {
    console.log("## Action items");
    console.log("");
    console.log(
      "Unreferenced artifacts need substrate integration (memory-file pointer,",
    );
    console.log(
      "backlog-row pointer, or explicit 'preserved-in-codebase-only' classification).",
    );
    console.log("");
    for (const a of unreferenced) {
      console.log(`- [ ] \`${a.path}\` (${a.category}, ${a.lines} lines)`);
    }
    console.log("");
  }
}

async function main(): Promise<number> {
  const jsonMode = process.argv.includes("--json");

  const formalFiles = await gitLsFiles(
    "*.lean",
    "*.tla",
    "*.smt2",
    "*.als",
    "tools/Z3Verify/*",
    "tools/alloy/*.java",
  );

  const formalTestFiles = (
    await gitLsFiles("tests/Tests.FSharp/Formal/*.fs")
  ).filter((f) => f.includes("Formal/"));

  const allPaths = [...new Set([...formalFiles, ...formalTestFiles])];

  const index = await buildReferenceIndex();

  const artifacts: FormalArtifact[] = [];
  for (const relPath of allPaths) {
    const category = classify(relPath);
    if (category === null) continue;
    const lines = countLines(relPath);
    const referencedIn = findRefsInIndex(relPath, index);
    artifacts.push({
      path: relPath,
      category,
      lines,
      referencedIn,
      substrateStatus: referencedIn.length > 0 ? "referenced" : "unreferenced",
    });
  }

  const catOrder: Record<Category, number> = {
    lean4: 0,
    "tla+": 1,
    z3: 2,
    alloy: 3,
    "formal-test": 4,
  };
  artifacts.sort((a, b) => {
    const cmp = catOrder[a.category] - catOrder[b.category];
    return cmp !== 0 ? cmp : a.path.localeCompare(b.path);
  });

  if (jsonMode) {
    const summary = {
      generatedAt: nowIso(),
      totalArtifacts: artifacts.length,
      referenced: artifacts.filter((a) => a.substrateStatus === "referenced")
        .length,
      unreferenced: artifacts.filter(
        (a) => a.substrateStatus === "unreferenced",
      ).length,
      totalLines: artifacts.reduce((sum, a) => sum + a.lines, 0),
      byCategory: Object.fromEntries(
        (["lean4", "tla+", "z3", "alloy", "formal-test"] as Category[]).map(
          (cat) => {
            const items = artifacts.filter((a) => a.category === cat);
            return [
              cat,
              {
                count: items.length,
                lines: items.reduce((s, a) => s + a.lines, 0),
              },
            ];
          },
        ),
      ),
      artifacts,
    };
    console.log(JSON.stringify(summary, null, 2));
    return 0;
  }

  emitMarkdown(artifacts);
  return 0;
}

if (import.meta.main) {
  main().then(
    (code) => process.exit(code),
    (err) => {
      process.stderr.write(
        `fatal: ${err instanceof Error ? err.message : String(err)}\n`,
      );
      process.exit(1);
    },
  );
}
