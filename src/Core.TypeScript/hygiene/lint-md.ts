#!/usr/bin/env bun
// lint-md.ts — 081KQ3HBZ0008QG0R000ACTVA6
// Repo-aware markdownlint wrapper with exclusion defaults.

import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const REPO_ROOT = resolve(import.meta.dir, "../../..");

const DEFAULT_EXCLUDES = [
    "references/",
    "node_modules/",
    ".lake/",
    "tools/lean4/.lake/",
    ".claude/worktrees/",
    "db/",
    "db/drop/",
    "roms/",
    "obj/",
    "bin/",
];

function main(argv: string[] = process.argv): void {
    const args = argv.slice(2);
    const globs = args.filter((a) => !a.startsWith("--"));
    const flags = args.filter((a) => a.startsWith("--"));
    const patterns = globs.length > 0 ? globs : ["**/*.md"];
    const ignoreArgs: string[] = [];
    for (const excl of DEFAULT_EXCLUDES) {
        ignoreArgs.push("--ignore", excl);
    }
    const cmd = ["markdownlint-cli2", ...patterns, ...ignoreArgs, ...flags];
    const result = spawnSync("npx", cmd, {
        cwd: REPO_ROOT,
        encoding: "utf8",
        stdio: "inherit",
        timeout: 120_000,
    });
    process.exit(result.status ?? 1);
}

main();
