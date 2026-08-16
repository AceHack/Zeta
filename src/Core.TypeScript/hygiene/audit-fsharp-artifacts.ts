#!/usr/bin/env bun
// audit-fsharp-artifacts.ts — catalog F# artifacts in src/Core
// and their substrate-status. Surfaces follow-up rows for unreferenced files
// (see 081KSKBP80008QG0R003NM9XEC, 081KSKBP80008QG0R003RFX32N for example output).
//
// Adapted from audit-formal-artifacts.ts.
//
// Usage:
//   bun src/Core.TypeScript/hygiene/audit-fsharp-artifacts.ts
//   bun src/Core.TypeScript/hygiene/audit-fsharp-artifacts.ts --json

import { readFileSync } from "node:fs";
import { dirname, resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, "..", "..", "..");

type Category = "fsharp-core";

interface FSharpArtifact {
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
  if (ext === ".fs" && relPath.startsWith("src/Core/")) {
    return "fsharp-core";
  }
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

// Match only on the normalized full relative path. Bare-filename matches
// (e.g. `CayleyDickson.fs` in unrelated prose) produce false positives that
// hide truly unreferenced artifacts.
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

function emitMarkdown(artifacts: FSharpArtifact[]): void {
  const referenced = artifacts.filter((a) => a.substrateStatus === "referenced");
  const unreferenced = artifacts.filter((a) => a.substrateStatus === "unreferenced");
  const totalLines = artifacts.reduce((sum, a) => sum + a.lines, 0);

  console.log(`# F# Core Artifact Catalog (${nowIso()})`);
  console.log("");
  console.log(
    "081KRHWGX0008QG0R001Z1JM61 slice output. Scans F# files in src/Core.",
  );
  console.log(
    "Cross-references against docs/ for substrate-status.",
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

  if (unreferenced.length > 0) {
    console.log("## Unreferenced Artifacts");
    console.log("");
    console.log(
      "Unreferenced artifacts need substrate integration (memory-file pointer,",
    );
    console.log(
      "backlog-row pointer, or explicit 'preserved-in-codebase-only' classification).",
    );
    console.log("");
    for (const a of unreferenced) {
        console.log(`### \`${a.path}\``);
        console.log(`- Lines: ${a.lines}`);
        console.log(`- Status: **UNREFERENCED**`);
        console.log("");
    }
  }

  console.log("## Referenced Artifacts");
  console.log("");
  for (const a of referenced) {
      console.log(`### \`${a.path}\``);
      console.log(`- Lines: ${a.lines}`);
      console.log(`- Status: REFERENCED`);
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

async function main(): Promise<number> {
  const jsonMode = process.argv.includes("--json");

  const fsharpFiles = (await gitLsFiles("src/Core")).filter(f => f.endsWith(".fs"));

  const allPaths = [...new Set(fsharpFiles)];

  const index = await buildReferenceIndex();

  const artifacts: FSharpArtifact[] = [];
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

  artifacts.sort((a, b) => a.path.localeCompare(b.path));

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
        `fatal: ${err instanceof Error ? err.message : String(err)}
`,
      );
      process.exit(1);
    },
  );
}
