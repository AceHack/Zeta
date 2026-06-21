#!/usr/bin/env bun
// no-empty-dirs.ts — fail the build if an empty directory exists in
// the repo that is (a) not git-ignored and (b) not on the allowlist.
//
// TypeScript+Bun port of no-empty-dirs.sh, slice 7 of the TS+Bun
// migration. See docs/best-practices/repo-scripting.md.
//
// Usage:
//   bun src/Core.TypeScript/lint/no-empty-dirs.ts          # check mode
//   bun src/Core.TypeScript/lint/no-empty-dirs.ts --list   # list mode
//
// Exit codes:
//   0   no flagged empty dirs (or --list mode)
//   1   one or more flagged empty dirs
//   2   allowlist missing
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { spawnSync } from "node:child_process";
const SPAWN_MAX_BUFFER = 64 * 1024 * 1024;
const ALLOWLIST_REL = "src/Core.TypeScript/lint/no-empty-dirs.allowlist";
const SPACE = 0x20;
const TAB = 0x09;
const CR = 0x0d;
const HASH = 0x23;
const HARD_EXCLUDE_PREFIXES = [
    ".git",
    "references/prior-art",
    "tools/lean4/.lake",
    ".claude/plugins",
    "artifacts",
];
const HARD_EXCLUDE_SEGMENTS = [
    "bin",
    "obj",
    ".vs",
    ".venv",
    "node_modules",
    "__pycache__",
    "TestResults",
];
function repoRoot() {
    // eslint-disable-next-line sonarjs/no-os-command-from-path
    const result = spawnSync("git", ["rev-parse", "--show-toplevel"], {
        encoding: "utf8",
        maxBuffer: SPAWN_MAX_BUFFER,
    });
    if (result.status !== 0)
        return process.cwd();
    return result.stdout.trim();
}
function gitCheckIgnore(paths) {
    if (paths.length === 0)
        return [];
    // eslint-disable-next-line sonarjs/no-os-command-from-path
    const result = spawnSync("git", ["check-ignore", "--stdin"], {
        encoding: "utf8",
        maxBuffer: SPAWN_MAX_BUFFER,
        input: `${paths.join("\n")}\n`,
    });
    return result.stdout.split("\n").filter((s) => s.length > 0);
}
function isHardExcluded(rel) {
    for (const prefix of HARD_EXCLUDE_PREFIXES) {
        if (rel === prefix || rel.startsWith(`${prefix}/`))
            return true;
    }
    for (const segment of HARD_EXCLUDE_SEGMENTS) {
        if (rel === segment ||
            rel.endsWith(`/${segment}`) ||
            rel.includes(`/${segment}/`)) {
            return true;
        }
    }
    return false;
}
function pushChildDirs(dir, root, entries, stack) {
    for (const e of entries) {
        if (!e.isDirectory())
            continue;
        const full = join(dir, e.name);
        const rel = toPosixRel(relative(root, full));
        if (!isHardExcluded(rel))
            stack.push(full);
    }
}
function readDirSafe(dir) {
    try {
        return readdirSync(dir, { withFileTypes: true });
    }
    catch {
        return null;
    }
}
// Normalize a Node-style relative() path to forward slashes — on
// Windows, `relative()` returns `\\`-separated paths, but the bash
// original emits `/` paths and the allowlist + git-check-ignore
// comparisons assume forward slashes. Posix-relative-path everywhere.
function toPosixRel(p) {
    return p.replace(/\\/g, "/");
}
function byteCompare(a, b) {
    if (a < b)
        return -1;
    if (a > b)
        return 1;
    return 0;
}
function findEmptyDirs(root) {
    const out = [];
    const stack = [root];
    while (stack.length > 0) {
        const dir = stack.pop();
        if (dir === undefined)
            continue;
        const entries = readDirSafe(dir);
        if (entries === null)
            continue;
        if (entries.length === 0) {
            const rel = toPosixRel(relative(root, dir));
            if (rel !== "" && !isHardExcluded(rel))
                out.push(rel);
            continue;
        }
        pushChildDirs(dir, root, entries, stack);
    }
    return out.sort(byteCompare);
}
function trimTrailingSpaceTab(s) {
    // Trim space, tab, and CR — CR matters when the allowlist is
    // checked out with CRLF endings (Otto-235 4-shell portability +
    // git autocrlf=true on Windows). Bash's `[[:space:]]*$` regex
    // also matches CR.
    let end = s.length;
    while (end > 0) {
        const c = s.charCodeAt(end - 1);
        if (c !== SPACE && c !== TAB && c !== CR)
            break;
        end--;
    }
    return s.slice(0, end);
}
function isCommentOrBlankLine(line) {
    let i = 0;
    while (i < line.length) {
        const c = line.charCodeAt(i);
        if (c !== SPACE && c !== TAB)
            break;
        i++;
    }
    return i === line.length || line.charCodeAt(i) === HASH;
}
function loadAllowlist(path) {
    const content = readFileSync(path, "utf8");
    const out = [];
    for (const line of content.split("\n")) {
        if (isCommentOrBlankLine(line))
            continue;
        out.push(trimTrailingSpaceTab(line));
    }
    return out;
}
function partitionEmpty(empty, allowed) {
    const allowedSet = new Set(allowed);
    const flagged = [];
    const allowlisted = [];
    for (const dir of empty) {
        if (allowedSet.has(dir))
            allowlisted.push(dir);
        else
            flagged.push(dir);
    }
    return { flagged, allowlisted };
}
function emitList(allowlisted, flagged) {
    process.stdout.write("=== Empty directories (allowlisted) ===\n");
    if (allowlisted.length === 0) {
        process.stdout.write("  (none)\n");
    }
    else {
        for (const d of allowlisted)
            process.stdout.write(`  ${d}\n`);
    }
    process.stdout.write("\n");
    process.stdout.write("=== Empty directories (flagged) ===\n");
    if (flagged.length === 0) {
        process.stdout.write("  (none)\n");
    }
    else {
        for (const d of flagged)
            process.stdout.write(`  ${d}\n`);
    }
}
function emitFailure(flagged, allowlistFile) {
    process.stderr.write(`no-empty-dirs: FAIL — ${String(flagged.length)} unexpected empty director(y/ies):\n`);
    for (const d of flagged)
        process.stderr.write(`  ${d}\n`);
    process.stderr.write("\n");
    process.stderr.write("Fix options:\n");
    process.stderr.write("  1. Populate the directory with its intended file(s).\n");
    process.stderr.write("  2. Delete the directory if it was created in error.\n");
    process.stderr.write("  3. If it is a legitimate scratch/output dir, add it to\n");
    process.stderr.write(`     ${allowlistFile} with a reason comment.\n`);
}
export function main(argv) {
    const root = repoRoot();
    process.chdir(root);
    const mode = argv[0] === "--list" ? "list" : "check";
    const allowlistPath = ALLOWLIST_REL;
    let allowed;
    try {
        allowed = loadAllowlist(allowlistPath);
    }
    catch {
        process.stderr.write(`no-empty-dirs: allowlist missing at ${allowlistPath}\n`);
        return 2;
    }
    const candidates = findEmptyDirs(root);
    const ignored = new Set(gitCheckIgnore(candidates));
    const filtered = candidates.filter((d) => !ignored.has(d));
    const { flagged, allowlisted } = partitionEmpty(filtered, allowed);
    if (mode === "list") {
        emitList(allowlisted, flagged);
        return 0;
    }
    if (flagged.length === 0) {
        process.stdout.write(`no-empty-dirs: OK (${String(allowlisted.length)} allowlisted, 0 flagged)\n`);
        return 0;
    }
    emitFailure(flagged, allowlistPath);
    return 1;
}
if (import.meta.main) {
    process.exit(main(process.argv.slice(2)));
}
