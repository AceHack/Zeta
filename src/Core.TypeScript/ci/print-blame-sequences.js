#!/usr/bin/env bun
// print-blame-sequences.ts — surface `dotnet test --blame` Sequence_*.xml files
// into the CI log so a test-host crash/hang is diagnosable.
//
// WHY: a crashed/hung VSTest host fails with the silent
// "MSB4181: VSTestTask returned false but did not log an error" — no named test.
// `dotnet test --blame-crash --blame-hang-timeout` writes a `Sequence_*.xml`
// naming the in-flight test (and a crash dump). This script (run on test
// failure) prints those Sequence files so the culprit lands in the CI log
// without artifact plumbing. Cross-platform (bun) — runs identically on the
// Linux/macOS/Windows runners, unlike `find`/`cat`.
//
// Usage:
//   bun src/Core.TypeScript/ci/print-blame-sequences.ts [rootDir]
// Exit 0 always — this is a diagnostic, never a gate.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
const root = process.argv[2] ?? ".";
// Skip heavy/irrelevant trees while walking for Sequence files.
const SKIP = new Set([".git", "node_modules", "bin", "obj", ".lake", "target"]);
function findSequenceFiles(dir, acc) {
    let entries;
    try {
        entries = readdirSync(dir);
    }
    catch {
        return; // unreadable dir — skip, never throw (diagnostic must not fail).
    }
    for (const entry of entries) {
        if (SKIP.has(entry))
            continue;
        const full = join(dir, entry);
        let isDir = false;
        try {
            isDir = statSync(full).isDirectory();
        }
        catch {
            continue;
        }
        if (isDir) {
            findSequenceFiles(full, acc);
        }
        else if (entry.startsWith("Sequence_") && entry.endsWith(".xml")) {
            acc.push(full);
        }
    }
}
function main() {
    const found = [];
    findSequenceFiles(root, found);
    if (found.length === 0) {
        console.log("[blame] no Sequence_*.xml found — the test host did not crash/hang under --blame " +
            "(the failure was a normal assertion failure, build error, or non-test step).");
        return;
    }
    console.log(`[blame] ${found.length} blame sequence file(s) — the named test was running when the host died/hung:\n`);
    for (const file of found) {
        console.log(`══════ ${file} ══════`);
        try {
            console.log(readFileSync(file, "utf8").trimEnd());
        }
        catch (err) {
            console.log(`(could not read: ${err instanceof Error ? err.message : String(err)})`);
        }
        console.log("");
    }
}
main();
