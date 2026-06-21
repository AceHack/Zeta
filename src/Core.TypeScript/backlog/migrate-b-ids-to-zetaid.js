#!/usr/bin/env bun
/**
 * src/Core.TypeScript/backlog/migrate-b-ids-to-zetaid.ts — erase the B-xxxx sequential coordinate primitive.
 *
 * Replaces all B-xxxx references across the repo with their ZetaId equivalents.
 * The B-xxxx numbering is a hidden coordination primitive (agents must agree on
 * "next number") — ZetaIds are locally mintable, no coordination, no collision.
 *
 * What this does:
 * 1. Builds the B-xxxx → ZetaId mapping from docs/backlog frontmatter
 * 2. Walks every .md, .ts, .json, .yaml file in the repo
 * 3. Replaces B-xxxx (and B-xxxx.N sub-items) with their ZetaId
 * 4. In frontmatter: removes `id: B-xxxx` line, keeps `zetaid:` as the canonical id
 * 5. Rewrites `depends_on:` arrays from B-xxxx refs to ZetaIds
 *
 * Usage:
 *   bun src/Core.TypeScript/backlog/migrate-b-ids-to-zetaid.ts --dry-run   # show what would change
 *   bun src/Core.TypeScript/backlog/migrate-b-ids-to-zetaid.ts             # apply changes
 */
import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
const REPO_ROOT = process.cwd();
const DRY_RUN = process.argv.includes("--dry-run");
const VERBOSE = process.argv.includes("--verbose");
// Step 1: Build the mapping
function buildMapping() {
    const map = new Map();
    const tiers = ["P0", "P1", "P2", "P3"];
    for (const tier of tiers) {
        const dir = join(REPO_ROOT, "docs", "backlog", tier);
        let entries;
        try {
            entries = readdirSync(dir);
        }
        catch {
            continue;
        }
        for (const f of entries) {
            if (!f.endsWith(".md"))
                continue;
            const content = readFileSync(join(dir, f), "utf-8");
            const idMatch = content.match(/^id:\s*(.+)$/m);
            const zetaMatch = content.match(/^zetaid:\s*(.+)$/m);
            if (idMatch && zetaMatch) {
                const bId = idMatch[1].trim();
                const zetaId = zetaMatch[1].trim();
                map.set(bId, zetaId);
            }
        }
    }
    return map;
}
// Step 2: Find all files to process
function findFiles(dir, extensions, skip) {
    const results = [];
    function walk(d) {
        let entries;
        try {
            entries = readdirSync(d);
        }
        catch {
            return;
        }
        for (const entry of entries) {
            const full = join(d, entry);
            const rel = relative(REPO_ROOT, full);
            if (skip.has(entry) || rel.startsWith("node_modules") || rel.startsWith(".git/"))
                continue;
            let stat;
            try {
                stat = statSync(full);
            }
            catch {
                continue;
            }
            if (stat.isDirectory()) {
                walk(full);
            }
            else if (stat.isFile()) {
                const ext = entry.slice(entry.lastIndexOf("."));
                if (extensions.has(ext))
                    results.push(full);
            }
        }
    }
    walk(dir);
    return results;
}
// Step 3: Replace B-xxxx references in content
function replaceReferences(content, map) {
    // Sort keys longest-first so B-0090.12 matches before B-0090.1 before B-0090
    const keys = [...map.keys()].sort((a, b) => b.length - a.length);
    let result = content;
    for (const bId of keys) {
        const zetaId = map.get(bId);
        // Replace the B-xxxx pattern wherever it appears as a word boundary
        // Use a regex that matches the B-id NOT followed by more digits/dots
        // (to avoid partial matches like B-0090 matching inside B-0090.1)
        const escaped = bId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(`\\b${escaped}\\b`, "g");
        result = result.replace(regex, zetaId);
    }
    return result;
}
// Step 4: Clean up frontmatter — remove the now-redundant `id: <zetaid>` line
// (it was `id: B-xxxx` which got replaced to `id: <zetaid>`, but `zetaid: <zetaid>`
// already exists, so `id:` is redundant). Rename `zetaid:` to `id:`.
function cleanFrontmatter(content) {
    const lines = content.split("\n");
    if (lines[0] !== "---")
        return content;
    const endIdx = lines.indexOf("---", 1);
    if (endIdx === -1)
        return content;
    const frontmatterLines = lines.slice(1, endIdx);
    const cleaned = [];
    let hasZetaId = false;
    let oldIdLineRemoved = false;
    for (const line of frontmatterLines) {
        // If this was the old `id: B-xxxx` line (now `id: <zetaid>`), and there's
        // also a `zetaid:` line, remove this one (it's redundant)
        if (/^id:\s*[0-9A-Z]{10,}/.test(line)) {
            // Check if there's a zetaid line too
            const hasZetaIdLine = frontmatterLines.some(l => /^zetaid:/.test(l));
            if (hasZetaIdLine) {
                oldIdLineRemoved = true;
                continue; // drop redundant id line
            }
        }
        // Rename zetaid: → id: (it's now the canonical identifier)
        if (/^zetaid:\s*/.test(line)) {
            hasZetaId = true;
            cleaned.push(line.replace(/^zetaid:/, "id:"));
            continue;
        }
        cleaned.push(line);
    }
    if (!hasZetaId && !oldIdLineRemoved)
        return content; // nothing to clean
    return ["---", ...cleaned, "---", ...lines.slice(endIdx + 1)].join("\n");
}
// Main
const map = buildMapping();
console.log(`Built mapping: ${map.size} B-xxxx → ZetaId pairs`);
const extensions = new Set([".md", ".ts", ".json", ".yaml", ".yml", ".jsonc"]);
const skip = new Set(["node_modules", ".git", "bun.lock"]);
const files = findFiles(REPO_ROOT, extensions, skip);
console.log(`Found ${files.length} files to scan`);
let changedFiles = 0;
let totalReplacements = 0;
for (const file of files) {
    const original = readFileSync(file, "utf-8");
    let modified = replaceReferences(original, map);
    // Clean frontmatter only for backlog .md files
    if (file.includes("docs/backlog/") && file.endsWith(".md")) {
        modified = cleanFrontmatter(modified);
    }
    if (modified !== original) {
        changedFiles++;
        const rel = relative(REPO_ROOT, file);
        // Count replacements (rough)
        const count = (original.match(/\bB-\d{4}/g) || []).length;
        totalReplacements += count;
        if (VERBOSE || DRY_RUN) {
            console.log(`  ${rel} (${count} refs)`);
        }
        if (!DRY_RUN) {
            writeFileSync(file, modified);
        }
    }
}
console.log(`\n${DRY_RUN ? "[DRY RUN] Would change" : "Changed"}: ${changedFiles} files, ~${totalReplacements} replacements`);
if (DRY_RUN) {
    console.log("Run without --dry-run to apply.");
}
