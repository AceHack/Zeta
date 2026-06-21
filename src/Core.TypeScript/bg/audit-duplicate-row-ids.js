#!/usr/bin/env bun
// audit-duplicate-row-ids.ts — flag backlog rows that share an `id:` value.
//
// The backlog uses `id: B-NNNN` (and sub-row IDs like `B-NNNN.M`) as the
// global primary key. Two rows with the same ID corrupt the substrate
// silently: consumers of the ID (depends_on / composes_with / children /
// merged-PR references) pick whichever file the loader sees first; the
// second-loaded row overwrites state in any in-memory index keyed by ID.
//
// This audit walks `docs/backlog/**/B-*.md`, extracts each frontmatter
// `id:` field, and reports any ID that appears in more than one file.
//
// Exit codes:
//   0 — no duplicate IDs found
//   1 — duplicates present (or I/O / parse error)
//
// Background:
//   This tool exists because PR #3038 created a row with `id: B-0444`
//   that collided with the row PR #3033 had filed 25 min earlier. The
//   collision survived 9 PR landings before being noticed in an ad-hoc
//   audit (PR #3053 resolved it). A broader sweep found 12 additional
//   collision groups. See B-0451 for the row that tracks this tool +
//   the substrate-wide cleanup.
import { readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
/**
 * Extract the frontmatter `id:` value from a backlog-row markdown file.
 *
 * Backlog rows open with a YAML frontmatter block delimited by `---`
 * fences. The `id:` field appears as a top-level key inside the first
 * such block. Returns `undefined` if no frontmatter or no `id:` field
 * is present (rows without `id:` cannot collide and are skipped by
 * the caller).
 */
export function extractId(content) {
    const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!fmMatch || fmMatch[1] === undefined)
        return undefined;
    const idMatch = fmMatch[1].match(/^id:\s*(\S+)/m);
    return idMatch?.[1];
}
/**
 * Group a `Map<id, files>` into the `DuplicateGroup[]` shape, keeping
 * only IDs that appear in more than one file. Files are sorted within
 * each group so output is deterministic.
 */
export function findDuplicates(idToFiles) {
    const dups = [];
    for (const [id, files] of idToFiles.entries()) {
        if (files.length > 1) {
            dups.push({ id, files: [...files].sort() });
        }
    }
    dups.sort((a, b) => a.id.localeCompare(b.id));
    return dups;
}
/**
 * Audit a list of backlog-row file paths and report any duplicate IDs.
 * The caller is responsible for path collection (so tests can inject
 * a fixture set and the CLI can read from `docs/backlog/`).
 */
export function auditRowFiles(files) {
    const idToFiles = new Map();
    const readErrors = [];
    for (const f of files) {
        let content;
        try {
            content = readFileSync(f, "utf-8");
        }
        catch (err) {
            // Codex P2 on PR #3056: silently swallowing read errors lets
            // collisions hide in any row the audit couldn't open. Accumulate
            // errors so the CLI can fail loudly — the caller's exit code
            // logic checks `readErrors.length > 0` alongside `duplicates`.
            readErrors.push({ file: f, reason: err.message });
            continue;
        }
        const id = extractId(content);
        if (!id)
            continue;
        const list = idToFiles.get(id) ?? [];
        list.push(f);
        idToFiles.set(id, list);
    }
    return {
        rowsWithId: [...idToFiles.values()].reduce((n, fs) => n + fs.length, 0),
        duplicates: findDuplicates(idToFiles),
        readErrors,
    };
}
/**
 * Default CLI entrypoint: walk `docs/backlog/**` via `git ls-files`
 * (no submodule / .gitignored traversal needed) and report findings.
 */
function main() {
    const repoRoot = resolve(import.meta.dir, "..", "..", "..");
    // eslint-disable-next-line sonarjs/no-os-command-from-path -- git invoked as explicit args array; no shell, no user input on the command line.
    const lsFiles = spawnSync("git", ["-C", repoRoot, "ls-files", "docs/backlog/"], { encoding: "utf-8" });
    if (lsFiles.status !== 0) {
        console.error(`git ls-files failed: ${lsFiles.stderr ?? ""}`);
        return 1;
    }
    const files = (lsFiles.stdout ?? "")
        .split("\n")
        .filter((line) => line.endsWith(".md") && !line.endsWith("/README.md"))
        .map((line) => join(repoRoot, line));
    const result = auditRowFiles(files);
    // Read errors surface alongside duplicates: both fail the audit so a
    // hidden duplicate inside an unreadable file can't slip through.
    if (result.readErrors.length > 0) {
        console.error(`audit-duplicate-row-ids: ${result.readErrors.length} file(s) could not be read:`);
        for (const e of result.readErrors) {
            console.error(`  - ${relative(repoRoot, e.file)}: ${e.reason}`);
        }
    }
    if (result.duplicates.length === 0 && result.readErrors.length === 0) {
        console.log(`audit-duplicate-row-ids: ${result.rowsWithId} rows with id field, no duplicate IDs`);
        return 0;
    }
    if (result.duplicates.length > 0) {
        console.error(`audit-duplicate-row-ids: ${result.duplicates.length} duplicate-ID group(s) found across ${result.rowsWithId} rows with id field:`);
        for (const dup of result.duplicates) {
            console.error(`  ${dup.id}:`);
            for (const f of dup.files) {
                console.error(`    - ${relative(repoRoot, f)}`);
            }
        }
    }
    return 1;
}
if (import.meta.main) {
    process.exit(main());
}
