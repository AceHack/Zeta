#!/usr/bin/env bun
// concept-index.ts — B-0362 (smallest safe slice, re-decomposed)
// Materialized concept index: regex standing queries over the
// corpus produce a term->file mapping. Lookup is sub-second; rebuild ~11s.
//
// Guardrails (Vera 2026-05-09):
// 1. Curated, not corpus-wide — add query classes deliberately
// 2. Each query class needs a name and provenance (when/why added)
// 3. New connections become queries only after earning a term +
//    memory/backlog anchor
// 4. Size gate: if .concept-index.json exceeds 5MB, queries
//    have drifted toward full-text — tighten the regexes
import { readdirSync, existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, resolve, relative } from "node:path";
const REPO_ROOT = resolve(import.meta.dir, "../../..");
const SCAN_DIRS = [
    "memory",
    "docs",
    ".claude/skills",
    ".claude/rules",
    ".claude/agents",
];
const CONCEPT_QUERIES = [
    ["alignment-clause", /\b(HC-[1-7]|SD-[1-9]|DIR-[1-5])\b/g],
    ["best-practice", /\b(BP-\d+)\b/g],
    ["otto-principle", /\b(Otto-\d+)\b/g],
    ["backlog-item", /\b(B-\d{4})\b/g],
    ["named-pattern", /\b(Confucius[- ]unfold|consensus[- ]smoothness|razor[- ]discipline|glass[- ]halo|retraction[- ]native|shield[- ]synthesis|superfluid|bidirectional[- ]alignment)\b/gi],
    ["lineage-anchor", /\b(Pearl|Hoare|Milner|Hejlsberg|Syme|Budiu|Lamport|Bernstein|Hadfield[- ]Menell|Honda|Yoshida|Carbone)\b/g],
    ["shadow-class", /\b(confident[- ]fabrication|narration[- ]over[- ]action|consensus[- ]smoothness|effort[- ]avoidance|narrative[- ]laundering|escalation[- ]cascade|pattern[- ]blindness|asking[- ]over[- ]checking)\b/gi],
    ["formal-tool", /\b(Z3|TLA\+|Lean\s*4|Alloy|FsCheck|Stryker|Semgrep|CodeQL)\b/g],
];
function scanFiles(dir) {
    const abs = join(REPO_ROOT, dir);
    if (!existsSync(abs))
        return [];
    const results = [];
    function walk(d) {
        for (const entry of readdirSync(d, { withFileTypes: true })) {
            const p = join(d, entry.name);
            if (entry.isDirectory()) {
                if (entry.name === "node_modules" || entry.name === "obj")
                    continue;
                walk(p);
            }
            else if (entry.name.endsWith(".md")) {
                results.push(relative(REPO_ROOT, p));
            }
        }
    }
    walk(abs);
    return results;
}
export async function buildIndex() {
    const allFiles = [];
    for (const dir of SCAN_DIRS) {
        allFiles.push(...scanFiles(dir));
    }
    const fileContents = await Promise.all(allFiles.map(async (file) => ({
        file,
        content: await readFile(join(REPO_ROOT, file), "utf8"),
    })));
    const hitMap = new Map();
    for (const { file, content } of fileContents) {
        const lines = content.split("\n");
        for (const [conceptClass, pattern] of CONCEPT_QUERIES) {
            const re = new RegExp(pattern.source, pattern.flags);
            for (let i = 0; i < lines.length; i++) {
                let match;
                while ((match = re.exec(lines[i])) !== null) {
                    const term = match[1]?.toLowerCase() ?? match[0].toLowerCase();
                    const key = `${conceptClass}::${term}`;
                    if (!hitMap.has(key))
                        hitMap.set(key, new Map());
                    const fileMap = hitMap.get(key);
                    if (!fileMap.has(file))
                        fileMap.set(file, i + 1);
                }
            }
        }
    }
    const entries = [];
    for (const [key, fileMap] of hitMap) {
        const [conceptClass, term] = key.split("::");
        const hits = [...fileMap.entries()].map(([file, line]) => ({ file, line }));
        entries.push({ conceptClass: conceptClass, term: term, hits });
    }
    entries.sort((a, b) => a.conceptClass.localeCompare(b.conceptClass) || a.term.localeCompare(b.term));
    return {
        schema: "concept-index-v1",
        generated: new Date().toISOString(),
        scanDirs: SCAN_DIRS,
        queryCount: CONCEPT_QUERIES.length,
        entryCount: entries.length,
        entries,
    };
}
// Multi-word AND semantics: all space-separated tokens must appear
// in the entry's conceptClass or term.
export function lookup(index, query) {
    const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    if (words.length === 0)
        return [];
    return index.entries.filter((e) => {
        const haystack = `${e.conceptClass} ${e.term}`;
        return words.every((w) => haystack.includes(w));
    });
}
