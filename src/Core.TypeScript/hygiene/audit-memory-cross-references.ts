#!/usr/bin/env bun
// audit-memory-cross-references.ts — B-0334
// Checks bidirectional integrity of cross-references inside memory
// files: dead links, asymmetric references, glob-pattern resolution.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { Glob } from "bun";

const home = process.env.HOME ?? homedir();
const DEFAULT_MEMORY_DIR = join(
    home,
    ".claude/projects/-Users-acehack-Documents-src-repos-Zeta/memory",
);

interface CrossRef {
    from: string;
    to: string;
    raw: string;
    resolved: boolean;
}

interface AuditResult {
    totalFiles: number;
    filesWithCrossRefs: number;
    totalCrossRefs: number;
    deadLinks: CrossRef[];
    asymmetric: { a: string; b: string }[];
    bidirectional: number;
}

const MEMORY_FILE_PATTERN = /(?:feedback|user|project|reference|CURRENT)[-_][^\s,)`\]|>]+/g;

function extractCrossRefs(content: string, filename: string): string[] {
    const refs: string[] = [];

    const sections = content.match(/[Cc]omposes\s+with[:\s].*?(?=\n\n|\n##|\n---|\n\*\*|$)/gs);
    if (!sections) return refs;

    for (const section of sections) {
        let match: RegExpExecArray | null;
        const pattern = new RegExp(MEMORY_FILE_PATTERN.source, "g");
        while ((match = pattern.exec(section)) !== null) {
            let ref = match[0]!;
            if (ref.endsWith(",") || ref.endsWith(")") || ref.endsWith(".")) {
                ref = ref.slice(0, -1);
            }
            if (ref !== filename.replace(/\.md$/, "")) {
                refs.push(ref);
            }
        }
    }

    const fullReasoningSections = content.match(/[Ff]ull\s+reasoning[:\s].*?(?=\n\n|\n##|\n---|\n\*\*|$)/gs);
    if (fullReasoningSections) {
        for (const section of fullReasoningSections) {
            const memoryPaths = section.match(/memory\/[^\s\)`,\]\|>]+\.md/g);
            if (memoryPaths) {
                for (const p of memoryPaths) {
                    const stem = p.replace(/^memory\//, "").replace(/\.md$/, "");
                    if (stem !== filename.replace(/\.md$/, "")) {
                        refs.push(stem);
                    }
                }
            }
        }
    }

    return [...new Set(refs)];
}

function resolveRef(ref: string, allFiles: string[]): string[] {
    if (ref.includes("*")) {
        const globPattern = ref.endsWith(".md") ? ref : `${ref}.md`;
        const glob = new Glob(globPattern);
        return allFiles.filter((f) => glob.match(f));
    }

    const withMd = ref.endsWith(".md") ? ref : `${ref}.md`;
    if (allFiles.includes(withMd)) return [withMd];

    const matches = allFiles.filter((f) => f.startsWith(ref));
    if (matches.length === 1) return matches;

    return [];
}

function audit(memoryDir: string): AuditResult {
    const allFiles = readdirSync(memoryDir).filter(
        (f) => f.endsWith(".md") && f !== "MEMORY.md" && f !== "README.md",
    );

    const crossRefs: CrossRef[] = [];
    const refGraph = new Map<string, Set<string>>();
    let filesWithCrossRefs = 0;

    for (const file of allFiles) {
        const content = readFileSync(join(memoryDir, file), "utf8");
        const refs = extractCrossRefs(content, file);
        if (refs.length === 0) continue;

        filesWithCrossRefs++;
        const targets = new Set<string>();

        for (const raw of refs) {
            const resolved = resolveRef(raw, allFiles);
            if (resolved.length === 0) {
                crossRefs.push({ from: file, to: raw, raw, resolved: false });
            } else {
                for (const target of resolved) {
                    crossRefs.push({ from: file, to: target, raw, resolved: true });
                    targets.add(target);
                }
            }
        }

        refGraph.set(file, targets);
    }

    const deadLinks = crossRefs.filter((r) => !r.resolved);

    const asymmetric: { a: string; b: string }[] = [];
    let bidirectional = 0;
    const checkedPairs = new Set<string>();

    for (const [from, targets] of refGraph) {
        for (const to of targets) {
            const pairKey = [from, to].sort().join("↔");
            if (checkedPairs.has(pairKey)) continue;
            checkedPairs.add(pairKey);

            const reverseRefs = refGraph.get(to);
            if (reverseRefs?.has(from)) {
                bidirectional++;
            } else {
                asymmetric.push({ a: from, b: to });
            }
        }
    }

    return {
        totalFiles: allFiles.length,
        filesWithCrossRefs,
        totalCrossRefs: crossRefs.length,
        deadLinks,
        asymmetric,
        bidirectional,
    };
}

function main(argv: string[] = process.argv): void {
    let memoryDir = DEFAULT_MEMORY_DIR;
    const jsonOutput = argv.includes("--json");

    for (let i = 2; i < argv.length; i++) {
        if (argv[i] === "--memory-dir" && argv[i + 1]) {
            memoryDir = argv[++i]!;
        }
    }

    if (!existsSync(memoryDir)) {
        console.error(`Memory directory not found: ${memoryDir}`);
        process.exit(1);
    }

    const result = audit(memoryDir);

    if (jsonOutput) {
        console.log(JSON.stringify(result, null, 2));
        return;
    }

    console.log("\n=== Memory Cross-Reference Integrity Audit ===\n");
    console.log(`Total memory files: ${result.totalFiles}`);
    console.log(`Files with cross-refs: ${result.filesWithCrossRefs}`);
    console.log(`Total cross-references: ${result.totalCrossRefs}`);
    console.log(`Bidirectional pairs: ${result.bidirectional}`);
    console.log(`Asymmetric (A->B but not B->A): ${result.asymmetric.length}`);
    console.log(`Dead links: ${result.deadLinks.length}`);

    if (result.deadLinks.length > 0) {
        console.log(`\n--- Dead links (first 20) ---\n`);
        for (const d of result.deadLinks.slice(0, 20)) {
            console.log(`  ${d.from} -> ${d.raw} (NOT FOUND)`);
        }
        if (result.deadLinks.length > 20) {
            console.log(`  ... and ${result.deadLinks.length - 20} more`);
        }
    }

    if (result.asymmetric.length > 0) {
        console.log(`\n--- Asymmetric references (first 20) ---\n`);
        for (const a of result.asymmetric.slice(0, 20)) {
            console.log(`  ${a.a} -> ${a.b} (no reverse link)`);
        }
        if (result.asymmetric.length > 20) {
            console.log(`  ... and ${result.asymmetric.length - 20} more`);
        }
    }
}

if (import.meta.main) {
    main();
}

export { audit, extractCrossRefs, resolveRef };
