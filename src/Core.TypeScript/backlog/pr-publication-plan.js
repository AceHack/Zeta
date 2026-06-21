#!/usr/bin/env bun
// pr-publication-plan.ts -- deterministic PR publication packet builder for
// autonomous backlog pickup.
//
// This is the first 081KR2E4K0008QG0R0022RVRCZ slice: it does not push, create PRs, or arm
// auto-merge by itself. It builds the exact review packet and command argv
// from machine-readable inputs so the executor path can stay small and
// testable.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
const DEFAULT_REPO = "Lucent-Financial-Group/Zeta";
const DEFAULT_BRANCHES = new Set(["main", "master", "trunk"]);
const REMOTE_SHORTHAND_NAMES = new Set(["origin", "upstream"]);
const REMOTE_REF_PREFIX = /^refs\/remotes\/[^/]+\//;
const FORBIDDEN_REF_CHARS = /[\x00-\x20~^:?*[\\\x7f]/;
const CODEX_COMMIT_TRAILER = "Co-Authored-By: Codex <noreply@openai.com>";
function usage() {
    return [
        "Usage:",
        "  bun src/Core.TypeScript/backlog/pr-publication-plan.ts --input publication.json [--json] [--write-body]",
        "",
        "Input JSON shape: PublicationInput exported by this module.",
    ].join("\n");
}
function requireValue(flag, value) {
    if (value === undefined || value.startsWith("--")) {
        throw new Error(`${flag} requires a value`);
    }
    return value;
}
function parseArgs(argv) {
    const args = { inputPath: null, json: false, writeBody: false };
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === "--input") {
            args.inputPath = requireValue(arg, argv[++i]);
        }
        else if (arg === "--json") {
            args.json = true;
        }
        else if (arg === "--write-body") {
            args.writeBody = true;
        }
        else if (arg === "--help" || arg === "-h") {
            process.stdout.write(`${usage()}\n`);
            process.exit(0);
        }
        else {
            throw new Error(`unknown arg: ${arg}`);
        }
    }
    if (args.inputPath === null) {
        throw new Error("--input is required");
    }
    return args;
}
function assertNonEmpty(label, value) {
    if (value.trim().length === 0) {
        throw new Error(`${label} is required`);
    }
}
function validateRepoPath(path) {
    const normalized = path.replace(/\\/g, "/");
    if (normalized.trim().length === 0 ||
        normalized.startsWith("/") ||
        /^[A-Za-z]:/.test(normalized) ||
        normalized.startsWith("../") ||
        normalized.includes("/../") ||
        normalized === ".git" ||
        normalized.startsWith(".git/")) {
        throw new Error(`unsafe repo-relative path: ${path}`);
    }
}
function validateBodyFilePath(path) {
    const value = path.trim();
    if (value.length === 0 ||
        value.startsWith("-") ||
        value.includes("\0") ||
        value.endsWith("/") ||
        value.endsWith("\\")) {
        throw new Error(`unsafe PR body file path: ${path}`);
    }
    validateRepoPath(value);
}
export function normalizeBranchRef(branch) {
    let normalized = branch.trim();
    if (normalized.startsWith("refs/heads/")) {
        normalized = normalized.slice("refs/heads/".length);
    }
    else if (REMOTE_REF_PREFIX.test(normalized)) {
        normalized = normalized.replace(REMOTE_REF_PREFIX, "");
    }
    const parts = normalized.split("/");
    if (parts.length === 2 && REMOTE_SHORTHAND_NAMES.has(parts[0] ?? "") && DEFAULT_BRANCHES.has(parts[1] ?? "")) {
        normalized = parts[1] ?? normalized;
    }
    return normalized;
}
function validateNormalizedBranchRef(label, branch) {
    const normalized = normalizeBranchRef(branch);
    const invalid = normalized.length === 0 ||
        normalized.startsWith("refs/") ||
        normalized.startsWith("-") ||
        normalized.startsWith("/") ||
        normalized.endsWith("/") ||
        normalized.endsWith(".") ||
        normalized.includes("//") ||
        normalized.includes("..") ||
        normalized.includes("@{") ||
        normalized === "@" ||
        FORBIDDEN_REF_CHARS.test(normalized) ||
        normalized.split("/").some((part) => part.startsWith(".") || part.endsWith(".lock"));
    if (invalid) {
        throw new Error(`invalid normalized ${label} ref: ${branch}`);
    }
    return normalized;
}
function isDefaultBranchRef(branch) {
    return DEFAULT_BRANCHES.has(branch);
}
export function validatePublicationInput(input) {
    if (!/^B-[0-9]+$/.test(input.backlogId)) {
        throw new Error(`invalid backlog id: ${input.backlogId}`);
    }
    assertNonEmpty("backlogTitle", input.backlogTitle);
    assertNonEmpty("branch", input.branch);
    assertNonEmpty("baseBranch", input.baseBranch);
    assertNonEmpty("bodyFilePath", input.bodyFilePath);
    validateRepoPath(input.backlogPath);
    validateBodyFilePath(input.bodyFilePath);
    const branch = validateNormalizedBranchRef("branch", input.branch);
    validateNormalizedBranchRef("baseBranch", input.baseBranch);
    if (isDefaultBranchRef(branch)) {
        throw new Error(`refusing to publish from default branch: ${input.branch}`);
    }
    if (input.summary.length === 0 || input.summary.some((line) => line.trim().length === 0)) {
        throw new Error("summary must contain at least one non-empty line");
    }
    if (input.checks.length === 0) {
        throw new Error("at least one focused check is required");
    }
    for (const check of input.checks) {
        assertNonEmpty("check.command", check.command);
    }
}
export function decideAutoMerge(input) {
    if (input.unresolvedReviewThreads > 0) {
        return {
            allowed: false,
            reason: `${input.unresolvedReviewThreads} unresolved review thread(s)`,
        };
    }
    if (input.requiredChecks.failed > 0) {
        return {
            allowed: false,
            reason: `${input.requiredChecks.failed} required check(s) failed`,
        };
    }
    return {
        allowed: true,
        reason: "no unresolved review threads and no failed required checks",
    };
}
function trimTitle(value, maxLength) {
    if (value.length <= maxLength) {
        return value;
    }
    return `${value.slice(0, maxLength - 1).trimEnd()}…`;
}
export function buildPrTitle(input) {
    return trimTitle(`feat(backlog): advance ${input.backlogId} ${input.backlogTitle}`, 120);
}
function formatCheck(check) {
    const suffix = check.notes === undefined ? "" : ` — ${check.notes}`;
    return `- ${check.status}: \`${check.command}\`${suffix}`;
}
function requiredCheckSummary(counts) {
    return `${counts.ok} ok, ${counts.inProgress} in progress, ${counts.pending} pending, ${counts.failed} failed`;
}
export function buildPrBody(input) {
    const autoMerge = decideAutoMerge(input);
    return [
        "## Summary",
        ...input.summary.map((line) => `- ${line}`),
        "",
        "## Backlog row",
        `- ${input.backlogId}: ${input.backlogTitle}`,
        `- Path: \`${input.backlogPath}\``,
        "",
        "## Checks",
        ...input.checks.map(formatCheck),
        "",
        "## Auto-merge gate",
        `- Required checks: ${requiredCheckSummary(input.requiredChecks)}`,
        `- Unresolved review threads: ${input.unresolvedReviewThreads}`,
        `- Decision: ${autoMerge.allowed ? "arm auto-merge" : "do not arm auto-merge"} (${autoMerge.reason})`,
        "",
    ].join("\n");
}
export function buildPublicationPlan(input) {
    validatePublicationInput(input);
    const title = buildPrTitle(input);
    const autoMerge = decideAutoMerge(input);
    const branch = validateNormalizedBranchRef("branch", input.branch);
    const baseBranch = validateNormalizedBranchRef("baseBranch", input.baseBranch);
    const createPr = [
        "gh",
        "pr",
        "create",
        "--repo",
        DEFAULT_REPO,
        "--base",
        baseBranch,
        "--head",
        branch,
        "--title",
        title,
        "--body-file",
        input.bodyFilePath,
    ];
    return {
        prTitle: title,
        prBody: buildPrBody(input),
        bodyFilePath: input.bodyFilePath,
        autoMerge,
        commands: {
            commit: ["git", "commit", "-m", title, "-m", CODEX_COMMIT_TRAILER],
            push: ["git", "push", "-u", "origin", branch],
            createPr,
            armAutoMerge: autoMerge.allowed
                ? ["gh", "pr", "merge", "<pr-url>", "--repo", DEFAULT_REPO, "--auto", "--squash"]
                : null,
        },
    };
}
export function writePrBodyFile(plan) {
    mkdirSync(dirname(plan.bodyFilePath), { recursive: true });
    writeFileSync(plan.bodyFilePath, plan.prBody, { flag: "wx" });
}
function readInput(path) {
    return JSON.parse(readFileSync(path, "utf8"));
}
export function main(argv) {
    try {
        const args = parseArgs(argv);
        const plan = buildPublicationPlan(readInput(args.inputPath ?? ""));
        if (args.writeBody) {
            writePrBodyFile(plan);
        }
        process.stdout.write(args.json ? `${JSON.stringify(plan, null, 2)}\n` : plan.prBody);
        return 0;
    }
    catch (error) {
        process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n\n${usage()}\n`);
        return 1;
    }
}
if (import.meta.main) {
    process.exit(main(process.argv.slice(2)));
}
