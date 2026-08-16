#!/usr/bin/env bun
// build-index.ts — 081KR50HA0008QG0R000239VTZ
// Entry point: bun src/Core.TypeScript/search/build-index.ts
// Scans memory/, docs/, .claude/skills/, .claude/rules/, .claude/agents/
// and writes .concept-index.json (gitignored).

import { buildIndex } from "./concept-index.js";
import { writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const REPO_ROOT = resolve(import.meta.dir, "../../..");

export async function main(): Promise<void> {
    const outPath = join(REPO_ROOT, ".concept-index.json");
    const start = performance.now();
    const index = await buildIndex();
    const elapsed = ((performance.now() - start) / 1000).toFixed(2);

    const payload = JSON.stringify(index, null, 2);
    await writeFile(outPath, payload);

    const sizeKB = (Buffer.byteLength(payload) / 1024).toFixed(0);
    const totalHits = index.entries.reduce((s, e) => s + e.hits.length, 0);
    console.log(
        `Built: ${index.entryCount} entries, ${sizeKB}KB, ${totalHits} total hits — ${elapsed}s`,
    );
}

if (import.meta.main) {
    await main();
}
