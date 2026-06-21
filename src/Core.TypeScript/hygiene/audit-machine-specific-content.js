#!/usr/bin/env bun
// audit-machine-specific-content.ts — detect machine-specific
// patterns that should not appear in portable factory substrate.
//
// TypeScript+Bun port of audit-machine-specific-content.sh, per
// the canonical TS+Bun trajectory (slice 2). See
// `docs/best-practices/repo-scripting.md` for the per-slice
// audit checklist + Zeta scripting conventions.
//
// What this does:
//   Scans tracked files for user-home paths, Claude harness
//   slugs, and other machine-name leaks. Detect-only by default
//   (per the not-yet-prevention-gate framing in row #23 / #47).
//
// Detection patterns:
//   - macOS / Linux home paths: `/Users/<name>/`, `/home/<name>/`
//   - Windows home paths: `C:\Users\<name>` (both backslash and
//     forward-slash forms)
//
// Excluded from the scan:
//   - History surfaces (ROUND-HISTORY.md, hygiene-history/, DECISIONS/)
//   - This audit script itself (its patterns ARE examples).
//   - launchd / service plist files under .gemini/launchd/ and
//     .gemini/service/ — those are the CANONICAL home for machine-
//     specific paths by design (maintainer-only artifacts with a
//     maintainer-note comment explaining the paths are machine-
//     specific and must be regenerated per-machine before
//     `launchctl load`). Flagging them as gaps is a false-positive
//     that creates ongoing audit noise.
//
// Usage:
//   bun tools/hygiene/audit-machine-specific-content.ts            # summary
//   bun tools/hygiene/audit-machine-specific-content.ts --list     # list offending file:pattern
//   bun tools/hygiene/audit-machine-specific-content.ts --enforce  # exit 2 on any gap
//
// Exit codes:
//   0 — no machine-specific content detected (or --enforce not set)
//   2 — gaps found and --enforce was set
//   64 — argument error
import { spawnSync, } from "node:child_process";
import { readFileSync } from "node:fs";
const PATTERNS = [
    /\/Users\/[a-zA-Z0-9._-]+\//,
    /\/home\/[a-zA-Z0-9._-]+\//,
    /C:\\Users\\[a-zA-Z0-9._-]+/,
    /C:\/Users\/[a-zA-Z0-9._-]+/,
];
const PATTERN_NAMES = [
    "/Users/<name>/",
    "/home/<name>/",
    "C:\\Users\\<name>",
    "C:/Users/<name>",
];
const EXCLUDE_RE = /^(docs\/ROUND-HISTORY\.md|docs\/hygiene-history\/|docs\/DECISIONS\/|tools\/hygiene\/audit-machine-specific-content\.(sh|ts)|\.gemini\/(launchd|service)\/[^/]+\.plist$)/;
const SPAWN_MAX_BUFFER = 64 * 1024 * 1024; // 64 MiB
function parseMode(argv) {
    const arg = argv[0];
    if (arg === undefined)
        return { kind: "mode", mode: "summary" };
    if (arg === "--list")
        return { kind: "mode", mode: "list" };
    if (arg === "--enforce")
        return { kind: "mode", mode: "enforce" };
    if (arg === "--summary")
        return { kind: "mode", mode: "summary" };
    return { kind: "error", message: `unknown arg: ${arg}` };
}
function classifyGitFailure(args, result) {
    if (result.error) {
        return `Failed to start 'git ${args.join(" ")}': ${result.error.message}`;
    }
    if (result.status === null) {
        if (result.signal !== null) {
            return `'git ${args.join(" ")}' terminated by signal ${result.signal}`;
        }
        return `'git ${args.join(" ")}' terminated before reporting an exit code`;
    }
    if (result.status !== 0) {
        const stderr = result.stderr.trim();
        return stderr !== ""
            ? stderr
            : `'git ${args.join(" ")}' exited ${String(result.status)}`;
    }
    return null;
}
function runGit(args) {
    // eslint-disable-next-line sonarjs/no-os-command-from-path -- git is repo-pinned via .mise.toml; args are an explicit string array (no shell interpolation).
    const result = spawnSync("git", args, {
        encoding: "utf8",
        maxBuffer: SPAWN_MAX_BUFFER,
    });
    const failure = classifyGitFailure(args, result);
    if (failure !== null)
        throw new Error(failure);
    return result.stdout;
}
function repoRoot() {
    return runGit(["rev-parse", "--show-toplevel"]).trim();
}
function listTrackedFiles() {
    return runGit(["ls-files", "-z"])
        .split("\0")
        .filter((s) => s.length > 0);
}
function fileMatches(file, pattern) {
    let content;
    try {
        content = readFileSync(file, "utf8");
    }
    catch {
        return false;
    }
    return pattern.test(content);
}
export function auditRepo() {
    process.chdir(repoRoot());
    const files = listTrackedFiles().filter((f) => !EXCLUDE_RE.test(f));
    const findings = [];
    for (let i = 0; i < PATTERNS.length; i++) {
        const pattern = PATTERNS[i];
        const name = PATTERN_NAMES[i];
        if (pattern === undefined || name === undefined)
            continue;
        for (const file of files) {
            if (fileMatches(file, pattern)) {
                findings.push({ file, pattern: name });
            }
        }
    }
    return { findings };
}
function formatFinding(finding) {
    return `${finding.file}:${finding.pattern}`;
}
export function main(argv) {
    const parsed = parseMode(argv);
    if (parsed.kind === "error") {
        process.stderr.write(`${parsed.message}\n`);
        return 64;
    }
    const { mode } = parsed;
    const { findings } = auditRepo();
    const count = findings.length;
    if (mode === "list") {
        if (count > 0)
            console.log(findings.map(formatFinding).join("\n"));
        return 0;
    }
    if (mode === "enforce") {
        if (count > 0) {
            console.log(`machine-specific content gaps: ${String(count)}`);
            for (const finding of findings) {
                console.log(`  ${formatFinding(finding)}`);
            }
            return 2;
        }
        console.log("machine-specific content gaps: 0 (clean)");
        return 0;
    }
    if (count > 0) {
        console.log(`machine-specific content gaps: ${String(count)}`);
        console.log("run with --list to see offending files");
    }
    else {
        console.log("machine-specific content gaps: 0 (clean)");
    }
    return 0;
}
if (import.meta.main) {
    process.exit(main(process.argv.slice(2)));
}
