#!/usr/bin/env bun
// classify-memory-load-bearing.ts — B-0332
// Classifies memory files as load-bearing (reachable from bootstrap
// surfaces via citation graph) or decorative (not reachable).
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { homedir } from "node:os";
import { Glob } from "bun";
const REPO_ROOT = resolve(import.meta.dir, "../../..");
const home = process.env.HOME ?? homedir();
const DEFAULT_MEMORY_DIR = join(home, ".claude/projects/-Users-acehack-Documents-src-repos-Zeta/memory");
const BOOTSTRAP_SURFACES = [
    join(REPO_ROOT, "CLAUDE.md"),
    join(REPO_ROOT, "AGENTS.md"),
    join(REPO_ROOT, "GOVERNANCE.md"),
    join(REPO_ROOT, "docs/ALIGNMENT.md"),
];
const MEMORY_PREFIXES = ["feedback_", "user_", "project_", "reference_", "CURRENT-"];
function extractMemoryRefs(content) {
    const refs = [];
    const memoryPathPattern = /memory\/[^\s\)`,\]\|>]+\.md/g;
    let match;
    while ((match = memoryPathPattern.exec(content)) !== null) {
        refs.push(match[0]);
    }
    const linkPattern = /\]\(([^)]+\.md)\)/g;
    while ((match = linkPattern.exec(content)) !== null) {
        const ref = match[1];
        if (ref.includes("memory/")) {
            refs.push(ref);
        }
        else if (!ref.includes("/") && MEMORY_PREFIXES.some((p) => ref.startsWith(p))) {
            refs.push(ref);
        }
    }
    return [...new Set(refs)];
}
function resolveRef(ref, memoryDir) {
    if (ref.includes("*")) {
        const cleaned = ref.replace(/^\.\.\//, "");
        const globBase = cleaned.startsWith("memory/") ? cleaned.slice(7) : cleaned;
        const glob = new Glob(globBase);
        const results = [];
        for (const entry of readdirSync(memoryDir)) {
            if (glob.match(entry)) {
                results.push(entry);
            }
        }
        return results;
    }
    const cleaned = ref.replace(/^\.\.\//, "");
    const filename = cleaned.startsWith("memory/") ? cleaned.slice(7) : cleaned;
    if (existsSync(join(memoryDir, filename))) {
        return [filename];
    }
    return [];
}
function classify(memoryDir) {
    const allFiles = readdirSync(memoryDir).filter((f) => f.endsWith(".md") && f !== "MEMORY.md" && f !== "README.md");
    const loadBearing = new Set();
    const depth = new Map();
    const brokenRefs = [];
    const surfaceCounts = {};
    const queue = [];
    for (const surface of BOOTSTRAP_SURFACES) {
        if (!existsSync(surface))
            continue;
        const content = readFileSync(surface, "utf8");
        const refs = extractMemoryRefs(content);
        const surfaceName = basename(surface);
        let count = 0;
        for (const ref of refs) {
            const resolved = resolveRef(ref, memoryDir);
            if (resolved.length === 0) {
                brokenRefs.push(`${surfaceName}: ${ref}`);
            }
            for (const file of resolved) {
                if (!loadBearing.has(file)) {
                    loadBearing.add(file);
                    depth.set(file, 0);
                    queue.push({ file, level: 0 });
                    count++;
                }
            }
        }
        surfaceCounts[surfaceName] = count;
    }
    while (queue.length > 0) {
        const { file, level } = queue.shift();
        if (file === "MEMORY.md" || file === "README.md")
            continue;
        const filePath = join(memoryDir, file);
        if (!existsSync(filePath))
            continue;
        const content = readFileSync(filePath, "utf8");
        const refs = extractMemoryRefs(content);
        for (const ref of refs) {
            const resolved = resolveRef(ref, memoryDir);
            for (const r of resolved) {
                if (!loadBearing.has(r)) {
                    loadBearing.add(r);
                    depth.set(r, level + 1);
                    queue.push({ file: r, level: level + 1 });
                }
            }
        }
    }
    const decorative = allFiles.filter((f) => !loadBearing.has(f));
    const loadBearingList = allFiles.filter((f) => loadBearing.has(f));
    const depthTiers = {};
    for (const [file, d] of depth) {
        if (!allFiles.includes(file))
            continue;
        if (!depthTiers[d])
            depthTiers[d] = [];
        depthTiers[d].push(file);
    }
    return {
        loadBearing: loadBearingList.sort(),
        decorative: decorative.sort(),
        totalFiles: allFiles.length,
        brokenRefs,
        surfaceCounts,
        depthTiers,
    };
}
function main(argv = process.argv) {
    let memoryDir = DEFAULT_MEMORY_DIR;
    const jsonOutput = argv.includes("--json");
    for (let i = 2; i < argv.length; i++) {
        if (argv[i] === "--memory-dir" && argv[i + 1]) {
            memoryDir = argv[++i];
        }
    }
    if (!existsSync(memoryDir)) {
        console.error(`Memory directory not found: ${memoryDir}`);
        process.exit(1);
    }
    const result = classify(memoryDir);
    if (jsonOutput) {
        console.log(JSON.stringify(result, null, 2));
        return;
    }
    console.log("\n=== Memory Load-Bearing Classification ===\n");
    console.log(`Total memory files: ${result.totalFiles}`);
    console.log(`Load-bearing: ${result.loadBearing.length} (${((result.loadBearing.length / result.totalFiles) * 100).toFixed(1)}%)`);
    console.log(`Decorative: ${result.decorative.length} (${((result.decorative.length / result.totalFiles) * 100).toFixed(1)}%)`);
    console.log("\n--- Citations per bootstrap surface ---\n");
    for (const [surface, count] of Object.entries(result.surfaceCounts)) {
        console.log(`  ${surface.padEnd(20)} ${count} unique files`);
    }
    if (result.brokenRefs.length > 0) {
        console.log(`\n--- Broken references (${result.brokenRefs.length}) ---\n`);
        for (const ref of result.brokenRefs) {
            console.log(`  BROKEN: ${ref}`);
        }
    }
    console.log("\n--- Depth tiers ---\n");
    const tiers = Object.entries(result.depthTiers)
        .sort(([a], [b]) => Number(a) - Number(b));
    for (const [tierStr, files] of tiers) {
        const tier = Number(tierStr);
        const label = tier === 0 ? "Tier 0 (directly cited from bootstrap)" :
            tier === 1 ? "Tier 1 (one hop from bootstrap)" :
                `Tier ${tier} (${tier} hops from bootstrap)`;
        console.log(`  ${label}: ${files.length} files`);
    }
    console.log("\n--- Tier 0 files (directly cited) ---\n");
    for (const f of (result.depthTiers[0] ?? []).sort()) {
        console.log(`  + ${f}`);
    }
    if (result.decorative.length > 0) {
        console.log(`\n--- Decorative / unreachable (${result.decorative.length}) ---\n`);
        for (const f of result.decorative.slice(0, 20)) {
            console.log(`  - ${f}`);
        }
        if (result.decorative.length > 20) {
            console.log(`  ... and ${result.decorative.length - 20} more`);
        }
    }
}
if (import.meta.main) {
    main();
}
export { classify, extractMemoryRefs, resolveRef };
