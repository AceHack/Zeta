#!/usr/bin/env bun
/**
 * tools/migrate-depends-on-to-zetaid.ts — Phase 2 of the id rotation.
 *
 * Rewrites B-xxxx references in frontmatter fields (depends_on, parent,
 * children, composes_with) to their ZetaId equivalents using the mapping table.
 *
 * Operates per-tier (P0, P1, P2, P3) so each batch is a single verifiable commit.
 * References that don't exist in the mapping table are left untouched (logged as warnings).
 *
 * Usage:
 *   bun tools/migrate-depends-on-to-zetaid.ts P0          # migrate P0 tier
 *   bun tools/migrate-depends-on-to-zetaid.ts P1          # migrate P1 tier
 *   bun tools/migrate-depends-on-to-zetaid.ts all         # migrate all tiers
 *   bun tools/migrate-depends-on-to-zetaid.ts --dry-run P2  # show what would change
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const REPO_ROOT = process.cwd();
const MAP_PATH = join(REPO_ROOT, "src", "Core.TypeScript", "backlog", "b-to-zetaid-map.json");
const DRY_RUN = process.argv.includes("--dry-run");
const TIERS_ARG = process.argv.filter(a => !a.startsWith("-") && a !== process.argv[0] && a !== process.argv[1]);
const TARGET_TIERS = TIERS_ARG.includes("all") ? ["P0", "P1", "P2", "P3"] : TIERS_ARG.filter(t => /^P[0-3]$/.test(t));
if (TARGET_TIERS.length === 0) {
    console.log("Usage: bun tools/migrate-depends-on-to-zetaid.ts [--dry-run] <P0|P1|P2|P3|all>");
    process.exit(1);
}
// Load the mapping table
const map = JSON.parse(readFileSync(MAP_PATH, "utf-8"));
console.log(`Loaded mapping: ${Object.keys(map).length} entries`);
// The frontmatter fields that carry B-xxxx references
const REF_FIELDS = ["depends_on", "parent", "children", "composes_with"];
// B-xxxx pattern (with optional .N sub-items)
const B_PATTERN = /\bB-\d{4}(?:\.\d+)?\b/g;
function replaceRefs(value) {
    let replaced = 0;
    const missed = [];
    const result = value.replace(B_PATTERN, (match) => {
        const zetaId = map[match];
        if (zetaId) {
            replaced++;
            return zetaId;
        }
        // Try without the .N suffix (parent item)
        const base = match.split(".")[0];
        const baseZetaId = map[base];
        if (baseZetaId && match !== base) {
            // Sub-item: can't resolve without its own mapping entry
            missed.push(match);
            return match;
        }
        missed.push(match);
        return match; // leave untouched
    });
    return { result, replaced, missed };
}
function migrateFile(filePath) {
    const content = readFileSync(filePath, "utf-8");
    const lines = content.split("\n");
    if (lines[0] !== "---")
        return { changed: false, replaced: 0, missed: [] };
    const endIdx = lines.indexOf("---", 1);
    if (endIdx === -1)
        return { changed: false, replaced: 0, missed: [] };
    let totalReplaced = 0;
    const allMissed = [];
    let changed = false;
    // Process frontmatter lines
    for (let i = 1; i < endIdx; i++) {
        const line = lines[i];
        // Check if this line is a ref field or a continuation of one
        const isRefField = REF_FIELDS.some(f => line.startsWith(`${f}:`));
        const isContinuation = line.startsWith("  - ") || line.startsWith("    - ");
        if (isRefField || isContinuation) {
            if (B_PATTERN.test(line)) {
                B_PATTERN.lastIndex = 0; // reset regex state
                const { result, replaced, missed } = replaceRefs(line);
                if (replaced > 0) {
                    lines[i] = result;
                    totalReplaced += replaced;
                    changed = true;
                }
                allMissed.push(...missed);
            }
        }
    }
    if (changed && !DRY_RUN) {
        writeFileSync(filePath, lines.join("\n"));
    }
    return { changed, replaced: totalReplaced, missed: allMissed };
}
// Run migration per tier
let totalFiles = 0;
let totalChanged = 0;
let totalReplaced = 0;
const allMissed = [];
for (const tier of TARGET_TIERS) {
    const tierDir = join(REPO_ROOT, "docs", "backlog", tier);
    let entries;
    try {
        entries = readdirSync(tierDir);
    }
    catch {
        console.log(`  ${tier}: directory not found, skipping`);
        continue;
    }
    const mdFiles = entries.filter(f => f.endsWith(".md"));
    let tierChanged = 0;
    let tierReplaced = 0;
    for (const file of mdFiles) {
        totalFiles++;
        const { changed, replaced, missed } = migrateFile(join(tierDir, file));
        if (changed) {
            tierChanged++;
            tierReplaced += replaced;
        }
        allMissed.push(...missed);
    }
    console.log(`  ${tier}: ${mdFiles.length} files scanned, ${tierChanged} changed, ${tierReplaced} refs replaced`);
    totalChanged += tierChanged;
    totalReplaced += tierReplaced;
}
console.log(`\n${DRY_RUN ? "[DRY RUN]" : "Done:"} ${totalFiles} files, ${totalChanged} changed, ${totalReplaced} refs replaced`);
if (allMissed.length > 0) {
    const unique = [...new Set(allMissed)].sort();
    console.log(`\nWarning: ${unique.length} unique B-xxxx refs NOT in mapping table (left untouched):`);
    for (const m of unique.slice(0, 20)) {
        console.log(`  ${m}`);
    }
    if (unique.length > 20)
        console.log(`  ... and ${unique.length - 20} more`);
}
