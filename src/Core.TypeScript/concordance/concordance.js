#!/usr/bin/env bun
// concordance.ts — B-0291 + B-0292 slice
// Text → tokens → concordance index. Structure recognizer stub.
import { readFileSync, existsSync } from "node:fs";
function tokenize(text) {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9'\-\s]/g, " ")
        .split(/\s+/)
        .filter((t) => t.length >= 2);
}
function buildConcordance(files) {
    const index = new Map();
    let totalTokens = 0;
    for (const { path, content } of files) {
        const lines = content.split("\n");
        for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
            const line = lines[lineIdx];
            const tokens = tokenize(line);
            let col = 0;
            for (const token of tokens) {
                totalTokens++;
                col = line.toLowerCase().indexOf(token, col);
                if (!index.has(token)) {
                    index.set(token, { token, count: 0, positions: [] });
                }
                const entry = index.get(token);
                entry.count++;
                if (entry.positions.length < 5) {
                    entry.positions.push({ file: path, line: lineIdx + 1, col });
                }
                col += token.length;
            }
        }
    }
    const entries = [...index.values()].sort((a, b) => b.count - a.count);
    return {
        schema: "concordance-v1",
        generated: new Date().toISOString(),
        tokenCount: totalTokens,
        uniqueTokens: entries.length,
        entries,
    };
}
if (import.meta.main) {
    const args = process.argv.slice(2);
    if (args.length === 0) {
        console.log("Usage: bun tools/concordance/concordance.ts <file1> [file2] ...");
        console.log("       bun tools/concordance/concordance.ts --top N <files>");
        process.exit(0);
    }
    let topN = 20;
    const files = [];
    for (let i = 0; i < args.length; i++) {
        if (args[i] === "--top" && args[i + 1]) {
            topN = Number(args[++i]);
        }
        else if (args[i] === "--json") {
            // handled below
        }
        else {
            const path = args[i];
            if (existsSync(path)) {
                files.push({ path, content: readFileSync(path, "utf8") });
            }
        }
    }
    const index = buildConcordance(files);
    if (args.includes("--json")) {
        console.log(JSON.stringify(index, null, 2));
    }
    else if (args.includes("--structure")) {
        const patterns = recognizeStructure(index);
        console.log(`Structure patterns: ${patterns.length}`);
        for (const p of patterns) {
            console.log(`  ${p.type}: ${p.tokens.join(",")} (${p.evidence})`);
        }
    }
    else {
        console.log(`Tokens: ${index.tokenCount} total, ${index.uniqueTokens} unique\n`);
        console.log(`Top ${topN}:`);
        for (const e of index.entries.slice(0, topN)) {
            const locs = e.positions.slice(0, 2).map((p) => `${p.file}:${p.line}`).join(", ");
            console.log(`  ${e.count.toString().padStart(6)} ${e.token.padEnd(20)} ${locs}`);
        }
    }
}
export { buildConcordance, tokenize };
function recognizeStructure(_index) {
    // Safe no-op stub for this bounded slice. Returns empty; future impl uses local GPU.
    // Prepares export surface without committing to detection heuristics yet.
    return [];
}
export { recognizeStructure };
