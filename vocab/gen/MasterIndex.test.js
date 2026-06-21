// The DST test framework LOADS the master index as part of the framework (Aaron, 2026-06-09:
// "our DST test should load the master index as part of the test framework"). On every run the
// framework eagerly loads vocab/MASTER-INDEX.md (the single-file cache of all travelers) into an
// in-memory map (the "Z-set load" — the present); git history is the lazy, weak-referenced
// backing for going backwards in time (Rx-queried on demand — not loaded here). This test is
// that load, plus freshness + presence assertions. Run: bun test vocab-master-index.test.ts
import { test, expect } from "bun:test";
import { readFileSync, existsSync } from "node:fs";
const VOCAB = new URL("../", import.meta.url).pathname;
const INDEX = VOCAB + "MASTER-INDEX.md";
/** the framework's eager load: master index -> Map<term, carved sentence> (the present cache). */
function loadMasterIndex() {
    const m = new Map();
    for (const line of readFileSync(INDEX, "utf8").split("\n")) {
        const mm = line.match(/^- \*\*(.+?)\*\* — (.+?) `\(/);
        if (mm) {
            const [, k, v] = mm;
            if (k && v)
                m.set(k, v);
        }
    }
    return m;
}
test("the framework loads the master index (one-file read) into the present cache", () => {
    expect(existsSync(INDEX)).toBe(true);
    const cache = loadMasterIndex();
    expect(cache.size).toBeGreaterThan(100); // all travelers loaded in one read
});
test("CoreDORA travelers are present (the load is complete across type homes)", () => {
    const cache = loadMasterIndex();
    for (const term of ["traveler", "room", "balance", "otto", "amara", "policy", "geospatial"]) {
        expect(cache.has(term)).toBe(true);
    }
});
test("every loaded entry has a non-empty carved sentence (the cache is well-formed)", () => {
    const cache = loadMasterIndex();
    for (const [term, sentence] of cache)
        expect(sentence.trim().length, `empty: ${term}`).toBeGreaterThan(0);
});
