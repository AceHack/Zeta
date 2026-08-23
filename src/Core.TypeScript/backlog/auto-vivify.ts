#!/usr/bin/env bun
// auto-vivify.ts — scan markdown files for dangling links, resolve them,
// and auto-instantiate them in the MUMPS global tree and gitfs (idempotent, bounded).
//
// The anchor is MUMPS's native behaviour: assigning/referencing a global subscript that doesn't exist
// creates the whole path (SET ^X("a","b","c")=1 auto-creates ^X, "a", "b", "c").
// 081KTQD8A0008QG0R0005EFYPV applies that auto-vivification to markdown pointers so MD link ⇄ MUMPS global ⇄ gitfs path
// are one auto-vivifying namespace. Already the spirit of the [[name]] memory convention; this makes it automatic.
//
// Usage:
//   bun src/Core.TypeScript/backlog/auto-vivify.ts              # scan and auto-vivify stubs
//   bun src/Core.TypeScript/backlog/auto-vivify.ts --check      # check for broken pointers without writing
//   bun src/Core.TypeScript/backlog/auto-vivify.ts --watch      # watch and auto-vivify on file changes
//

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync, watch } from "node:fs";
import { dirname, join, normalize, relative, basename } from "node:path";
import { pack, DEFAULT_ENV } from "../zeta-id/zeta-id";
import { format } from "../zeta-id/encoding";
import { Category, Chromosome, type ZetaObservation } from "../zeta-id/types";

const REPO_ROOT = normalize(join(__dirname, "..", "..", ".."));
const SCAN_SURFACES = ["workitems", "db"];

interface DanglingPointer {
  raw: string; // link target as written
  clean: string; // cleaned target (stripped of label, anchor, query)
  kind: "wikilink" | "mdlink" | "backtick";
  line: number;
}

// Helper to check if a directory exists
function isDir(p: string): boolean {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}

// Find all markdown files recursively in scan surfaces
function findMarkdownFiles(dir: string): string[] {
  const out: string[] = [];
  function walk(d: string): void {
    let entries: string[];
    try {
      entries = readdirSync(d);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry === "node_modules" || entry === ".git" || entry === ".claude" || entry === "done") {
        continue;
      }
      const full = join(d, entry);
      try {
        const st = statSync(full);
        if (st.isDirectory()) {
          walk(full);
        } else if (entry.endsWith(".md")) {
          out.push(full);
        }
      } catch {
        // skip unreadable
      }
    }
  }
  walk(dir);
  return out;
}

// Extract potential dangling pointers from text
export function extractPointers(text: string): DanglingPointer[] {
  const out: DanglingPointer[] = [];
  const lines = text.split("\n");

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx]!;
    const lineNum = idx + 1;

    // 1. Wikilinks [[target]]
    const wikilinks = line.matchAll(/\[\[([^\]]+)\]\]/g);
    for (const m of wikilinks) {
      const raw = m[1]!.trim();
      const target = raw.split("|")[0]!.split("#")[0]!.trim();
      // Quantum error-correcting codes use [[n,k,d]] as mathematical notation.
      if (/^\d+\s*,\s*\d+\s*,\s*\d+$/.test(target)) continue;
      out.push({ raw: m[0]!, clean: target, kind: "wikilink", line: lineNum });
    }

    // 2. Markdown links [label](target)
    const mdLinks = line.matchAll(/\[([^\]]*)\]\(([^)]+)\)/g);
    for (const m of mdLinks) {
      const target = m[2]!.trim();
      if (/^(https?:|mailto:|#|file:)/.test(target)) {
        continue;
      }
      const clean = target.split("?")[0]!.split("#")[0]!.trim();
      out.push({ raw: m[0]!, clean, kind: "mdlink", line: lineNum });
    }

    // 3. Backtick paths `path`
    // An ABSOLUTE path (leading "/") names a location on a running node's
    // filesystem (e.g. `/run/current-system/sw/lib/pkcs11/...` on a NixOS
    // cluster node), never a pointer into this repo — so it is not a
    // vivifiable reference and reporting it as dangling is a false positive.
    const backticks = line.matchAll(/`([a-zA-Z0-9_./-]+\.[a-z]{2,4})`/g);
    for (const m of backticks) {
      const target = m[1]!.trim();
      if (target.startsWith("/")) {
        continue;
      }
      if (target.includes("/") || target.endsWith(".md")) {
        out.push({ raw: m[0]!, clean: target, kind: "backtick", line: lineNum });
      }
    }
  }

  // Deduplicate by clean target
  const seen = new Set<string>();
  return out.filter((p) => {
    if (seen.has(p.clean)) {
      return false;
    }
    seen.add(p.clean);
    return true;
  });
}

// Parse 26-char Crockford ZetaId from string if present
export function extractZetaId(s: string): string | null {
  const m = s.match(/\b([0-9A-HJKMNP-TV-Z]{26})\b/i);
  return m ? m[1]!.toUpperCase() : null;
}

// Generate a new WorkItem ZetaId
function mintWorkItemZetaId(): string {
  const obs: ZetaObservation = {
    version: 1,
    timestamp: Date.now() as any,
    chromosome: Chromosome.MetaCoherence,
    category: Category.WorkItem,
    authority: { type: "Standard" },
    persona: 0 as any,
    momentum: { type: "Normal" },
    location: 0 as any,
  };
  const id = pack(obs, DEFAULT_ENV);
  return format(id);
}

// Search for a ZetaId-keyed markdown file under the surfaces that can still
// own backlog/work references. New work lives in workitems/; docs/backlog/
// remains a legacy substrate with many ZetaId-keyed rows.
function findZetaIdFile(zetaid: string): string | null {
  const roots = [join(REPO_ROOT, "workitems"), join(REPO_ROOT, "docs", "backlog")];

  function walk(d: string): string | null {
    let entries: string[];
    try {
      entries = readdirSync(d);
    } catch {
      return null;
    }
    for (const entry of entries) {
      const full = join(d, entry);
      const st = statSync(full);
      if (st.isDirectory()) {
        const found = walk(full);
        if (found) return found;
      } else if (entry.startsWith(zetaid) && entry.endsWith(".md")) {
        return full;
      }
    }
    return null;
  }

  for (const root of roots) {
    if (!existsSync(root)) continue;
    const found = walk(root);
    if (found) return found;
  }
  return null;
}

// Resolve clean pointer target into an actual path and action
export interface ResolvedTarget {
  pointer: DanglingPointer;
  resolvedPath: string; // Path on disk we checked/will write
  exists: boolean;
  type: "workitem" | "sameness" | "db-dir" | "db-file" | "other";
  rewriteUrl?: string; // New relative URL if we minted an ID and want to replace the link in citing file
}

export function resolvePointer(cleanTarget: string, fromFile: string): ResolvedTarget | null {
  const currentDir = dirname(fromFile);
  const zetaid = extractZetaId(cleanTarget);

  // 1. Work Items: Target has a ZetaId
  if (zetaid) {
    const existingFile = findZetaIdFile(zetaid);
    if (existingFile) {
      return {
        pointer: { raw: "", clean: cleanTarget, kind: "mdlink", line: 0 },
        resolvedPath: existingFile,
        exists: true,
        type: "workitem",
      };
    }
    // Stub path in workitems/
    const filename = cleanTarget.endsWith(".md") ? cleanTarget : `${cleanTarget}.md`;
    // Ensure filename starts with the ZetaId
    const baseName = basename(filename);
    const finalFilename = baseName.startsWith(zetaid) ? baseName : `${zetaid}-${baseName}`;
    const resolvedPath = join(REPO_ROOT, "workitems", finalFilename);
    return {
      pointer: { raw: "", clean: cleanTarget, kind: "mdlink", line: 0 },
      resolvedPath,
      exists: existsSync(resolvedPath),
      type: "workitem",
    };
  }

  // 2. Work Items: Path contains workitems/ but has no ZetaId
  if (cleanTarget.startsWith("workitems/") || cleanTarget.includes("/workitems/")) {
    // We need to mint a governed ZetaId!
    const newId = mintWorkItemZetaId();
    const namePart = basename(cleanTarget).replace(/\.md$/, "");
    const resolvedPath = join(REPO_ROOT, "workitems", `${newId}-${namePart}.md`);
    const relFromRoot = `workitems/${newId}-${namePart}.md`;
    return {
      pointer: { raw: "", clean: cleanTarget, kind: "mdlink", line: 0 },
      resolvedPath,
      exists: existsSync(resolvedPath),
      type: "workitem",
      rewriteUrl: relFromRoot,
    };
  }

  // 3. Sameness: same/x-y or same/_-x-y-_.md
  if (cleanTarget.includes("same/")) {
    const partsOfPath = cleanTarget.split("/");
    const sameIdx = partsOfPath.indexOf("same");
    if (sameIdx !== -1 && sameIdx < partsOfPath.length - 1) {
      let base = partsOfPath[sameIdx + 1]!;
      base = base.replace(/\.md$/, "");
      base = base.replace(/^_-|-_$/g, "");

      const pair = base.split("-");
      if (pair.length >= 2) {
        const x = pair[0]!.trim();
        const y = pair.slice(1).join("-").trim();
        const sorted = [x, y].sort();
        const canonicalX = sorted[0]!;
        const canonicalY = sorted[1]!;
        const filename = `_-${canonicalX}-${canonicalY}-_.md`;
        const resolvedPath = join(REPO_ROOT, "db", "same", filename);
        return {
          pointer: { raw: "", clean: cleanTarget, kind: "mdlink", line: 0 },
          resolvedPath,
          exists: existsSync(resolvedPath),
          type: "sameness",
        };
      }
    }
  }

  // 4. Standard DB paths and simple names
  // Candidates:
  // a) Relative to citing file
  // b) Relative to repo root
  // c) Rooted under db/ if simple name
  const candidates = [
    { path: join(currentDir, cleanTarget), type: cleanTarget.endsWith(".md") ? "db-file" : "db-dir" },
    { path: join(REPO_ROOT, cleanTarget), type: cleanTarget.endsWith(".md") ? "db-file" : "db-dir" },
    { path: join(REPO_ROOT, "db", cleanTarget), type: cleanTarget.endsWith(".md") ? "db-file" : "db-dir" },
  ];

  for (const cand of candidates) {
    if (existsSync(cand.path)) {
      return {
        pointer: { raw: "", clean: cleanTarget, kind: "mdlink", line: 0 },
        resolvedPath: cand.path,
        exists: true,
        type: cand.type as any,
      };
    }
  }

  // If absent, we choose candidate (c) under db/ for simple names, or candidate (b) for paths starting with db/
  let finalPath = candidates[2]!.path;
  let finalType: ResolvedTarget["type"] = "db-dir";
  if (cleanTarget.startsWith("db/")) {
    finalPath = candidates[1]!.path;
  }

  if (cleanTarget.endsWith(".md")) {
    finalType = "db-file";
  }

  return {
    pointer: { raw: "", clean: cleanTarget, kind: "mdlink", line: 0 },
    resolvedPath: finalPath,
    exists: false,
    type: finalType,
  };
}

// Generate stub content based on type
function getStubContent(resolved: ResolvedTarget): string {
  const name = basename(resolved.resolvedPath, ".md").replace(/^_-|-_$/g, "");
  const createdIso = new Date().toISOString();

  if (resolved.type === "workitem") {
    const zetaid = extractZetaId(resolved.resolvedPath) || "STUBID";
    const slug = name.replace(new RegExp(`^${zetaid}-`), "");
    return `---
id: ${zetaid}
type: task
state: backlog
priority: P2
slug: ${slug}
title: "Auto-vivified Stub: ${slug}"
created: ${createdIso}
depends_on: []
composes_with: []
---

# ${slug}

<!-- Work-item body. Auto-vivified stub from a dangling Markdown pointer. -->
`;
  }

  if (resolved.type === "sameness") {
    const parts = name.split("-");
    const x = parts[0] || "x";
    const y = parts[1] || "y";
    return `# same/${x} — ${y}

**Asserts:** **${x}** and **${y}** are the **same** — auto-vivified sameness relation.

- **x:** \`${x}\`
- **y:** \`${y}\`
- **kind of same:** same-referent
- **why same:** Auto-vivified due to dangling reference.
- **established:** ${createdIso.slice(0, 10)}

**Carved sentence:** ${x} and ${y} are the same.
`;
  }

  if (resolved.type === "db-file") {
    return `# ${name}

**Carved sentence:** [A provisional carved sentence explaining what ${name} is about]
`;
  }

  // db-dir (README.md)
  return `# ${name}/

**Carved sentence:** [A provisional carved sentence explaining what ${name} is about]
`;
}

// Perform rewrite of citing file to update links with newly minted IDs
function rewriteCitingFile(filePath: string, oldTarget: string, newTarget: string): void {
  try {
    const text = readFileSync(filePath, "utf8");
    // Replace old link target with new one. We match standard markdown format [label](target)
    // and wikilink format [[target]]
    let updated = text;

    // Markdown link regex replacement
    const mdRegex = new RegExp(`(\\[[^\\]]*\\]\\()${escapeRegExp(oldTarget)}(\\))`, "g");
    updated = updated.replace(mdRegex, `$1${newTarget}$2`);

    // Wikilink replacement
    const wikiRegex = new RegExp(`(\\[\\[)${escapeRegExp(oldTarget)}(\\]\\])`, "g");
    updated = updated.replace(wikiRegex, `$1${newTarget}$2`);

    if (updated !== text) {
      writeFileSync(filePath, updated, "utf8");
      console.log(`Updated link in ${relative(REPO_ROOT, filePath)}: ${oldTarget} -> ${newTarget}`);
    }
  } catch (e) {
    console.error(`Failed to rewrite link in ${filePath}: ${(e as Error).message}`);
  }
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Main logic: Scan all files and auto-vivify dangling pointers
export function processAll(
  checkOnly = false,
  customFiles?: string[],
): { scanned: number; processed: number; broken: number } {
  let scannedCount = 0;
  let processedCount = 0;
  let brokenCount = 0;

  let filesToScan: string[] = [];
  if (customFiles && customFiles.length > 0) {
    filesToScan = customFiles.map((f) => join(REPO_ROOT, f));
  } else {
    for (const s of SCAN_SURFACES) {
      const absPath = join(REPO_ROOT, s);
      if (isDir(absPath)) {
        filesToScan.push(...findMarkdownFiles(absPath));
      }
    }
  }

  // To guarantee bounded loop termination and prevent write storms,
  // we do a single sweep of all files, collect all unresolved targets,
  // resolve them canonicalizing paths, and write their stubs.
  const pendingWrites = new Map<string, { resolved: ResolvedTarget; cleanTarget: string; citingFiles: Set<string> }>();

  for (const file of filesToScan) {
    scannedCount++;
    try {
      const text = readFileSync(file, "utf8");
      const pointers = extractPointers(text);
      for (const p of pointers) {
        const resolved = resolvePointer(p.clean, file);
        if (!resolved) continue;

        if (!resolved.exists) {
          brokenCount++;
          const key = resolved.resolvedPath;
          if (!pendingWrites.has(key)) {
            pendingWrites.set(key, { resolved, cleanTarget: p.clean, citingFiles: new Set() });
          }
          pendingWrites.get(key)!.citingFiles.add(file);
        }
      }
    } catch (e) {
      console.error(`Failed to process file ${file}: ${(e as Error).message}`);
    }
  }

  if (checkOnly) {
    if (brokenCount > 0) {
      console.log(`\nFound ${brokenCount} dangling/broken references:`);
      for (const [path, info] of pendingWrites) {
        const relPath = relative(REPO_ROOT, path);
        console.log(
          `  broken -> ${relPath} (referenced by: ${Array.from(info.citingFiles)
            .map((f) => relative(REPO_ROOT, f))
            .join(", ")})`,
        );
      }
    }
    return { scanned: scannedCount, processed: 0, broken: brokenCount };
  }

  // Execute writes
  for (const [path, info] of pendingWrites) {
    const resolved = info.resolved;
    const dir = dirname(path);
    try {
      // 1. Create directories as needed
      mkdirSync(dir, { recursive: true });

      // 2. Create the file (idempotent write)
      if (!existsSync(path)) {
        const content = getStubContent(resolved);
        writeFileSync(path, content, "utf8");
        processedCount++;
        console.log(`Auto-vivified: ${relative(REPO_ROOT, path)} (${resolved.type})`);
      }

      // 3. Rewrite citing files if there is a minted ID/rewrite URL
      if (resolved.rewriteUrl) {
        for (const citingFile of info.citingFiles) {
          rewriteCitingFile(citingFile, info.cleanTarget, resolved.rewriteUrl);
        }
      }
    } catch (e) {
      console.error(`Failed to auto-vivify ${path}: ${(e as Error).message}`);
    }
  }

  return { scanned: scannedCount, processed: processedCount, broken: brokenCount };
}

// CLI Execution
function main(): number {
  const args = Bun.argv.slice(2);
  const checkOnly = args.includes("--check");
  const watchMode = args.includes("--watch");
  const positionalArgs = args.filter((a) => !a.startsWith("--"));

  if (watchMode) {
    console.log(`Watcher active. Monitoring ${SCAN_SURFACES.join(", ")} for dangling references...`);

    // Initial run
    processAll(false, positionalArgs);

    // Set up file watch loops
    for (const surface of SCAN_SURFACES) {
      const dirPath = join(REPO_ROOT, surface);
      if (!isDir(dirPath)) continue;

      watch(dirPath, { recursive: true }, (_, filename) => {
        if (filename && filename.endsWith(".md")) {
          console.log(`Change detected in ${surface}/${filename}. Running auto-vivifier...`);
          try {
            processAll(false, positionalArgs);
          } catch (e) {
            console.error(`Watcher execution error: ${(e as Error).message}`);
          }
        }
      });
    }

    // Keep running
    new Promise(() => {});
    return 0;
  }

  const { scanned, processed, broken } = processAll(checkOnly, positionalArgs);
  console.log(`\nAuto-vivifier execution completed:`);
  console.log(`  Scanned:   ${scanned} files`);
  console.log(`  Vivified:  ${processed} new stubs`);
  console.log(`  Dangling:  ${broken} references detected`);

  if (checkOnly && broken > 0) {
    return 1;
  }
  return 0;
}

if (import.meta.main) {
  process.exit(main());
}
