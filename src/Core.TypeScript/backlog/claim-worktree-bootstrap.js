#!/usr/bin/env bun
// claim-worktree-bootstrap.ts -- create the git-native claim surface for a
// selected autonomous backlog row before any implementation edits happen.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
const GIT_BIN = "/usr/bin/git";
const CLAIM_PREFIX = "claim/";
const HEARTBEAT_NAME_PATTERN = /^[A-Za-z0-9._/-]+$/;
function usage() {
    return [
        "Usage:",
        "  bun src/Core.TypeScript/backlog/claim-worktree-bootstrap.ts --slug backlog-0279 \\",
        "    --backlog-id B-0279 --scope TEXT --durable-target PATH --path PATH [--path PATH...]",
        "",
        "Optional:",
        "  --repo-root DIR       Defaults to cwd",
        "  --worktree-root DIR   Defaults to ../Zeta-worktrees next to repo root",
        "  --session-id ID       Defaults to codex/<timestamp>-<slug>",
        "  --claimed-at ISO      Defaults to now",
        "  --eta ISO             Defaults to +45 minutes",
        "  --platform-mirror URL Defaults to GitHub PR pending",
        "  --dry-run             Emit the plan after overlap checks; do not write",
        "  --json                Emit JSON instead of text",
    ].join("\n");
}
function timestampId(date) {
    return date
        .toISOString()
        .replace(/[-:]/g, "")
        .replace(/\.\d{3}Z$/, "Z");
}
function plusMinutes(date, minutes) {
    return new Date(date.getTime() + minutes * 60 * 1000);
}
function requireValue(flag, value) {
    if (value === undefined || value.startsWith("--")) {
        throw new Error(`${flag} requires a value`);
    }
    return value;
}
function defaultWorktreeRoot(repoRoot) {
    return resolve(dirname(repoRoot), "Zeta-worktrees");
}
function parseArgs(argv, now = new Date()) {
    const repoRoot = resolve(process.cwd());
    const request = {
        repoRoot,
        slug: "",
        backlogId: "",
        scope: "",
        durableTarget: "",
        paths: [],
        sessionId: "",
        harness: "codex",
        claimedAt: now.toISOString(),
        eta: plusMinutes(now, 45).toISOString(),
        worktreeRoot: defaultWorktreeRoot(repoRoot),
        platformMirror: "GitHub PR pending",
    };
    let json = false;
    let dryRun = false;
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === "--repo-root") {
            request.repoRoot = resolve(requireValue(arg, argv[++i]));
            request.worktreeRoot = defaultWorktreeRoot(request.repoRoot);
        }
        else if (arg === "--worktree-root") {
            request.worktreeRoot = resolve(requireValue(arg, argv[++i]));
        }
        else if (arg === "--slug") {
            request.slug = requireValue(arg, argv[++i]);
        }
        else if (arg === "--backlog-id") {
            request.backlogId = requireValue(arg, argv[++i]);
        }
        else if (arg === "--scope") {
            request.scope = requireValue(arg, argv[++i]);
        }
        else if (arg === "--durable-target") {
            request.durableTarget = requireValue(arg, argv[++i]);
        }
        else if (arg === "--path") {
            request.paths.push(requireValue(arg, argv[++i]));
        }
        else if (arg === "--session-id") {
            request.sessionId = requireValue(arg, argv[++i]);
        }
        else if (arg === "--claimed-at") {
            request.claimedAt = requireValue(arg, argv[++i]);
        }
        else if (arg === "--eta") {
            request.eta = requireValue(arg, argv[++i]);
        }
        else if (arg === "--platform-mirror") {
            request.platformMirror = requireValue(arg, argv[++i]);
        }
        else if (arg === "--json") {
            json = true;
        }
        else if (arg === "--dry-run") {
            dryRun = true;
        }
        else if (arg === "--help" || arg === "-h") {
            process.stdout.write(`${usage()}\n`);
            process.exit(0);
        }
        else {
            throw new Error(`unknown arg: ${arg}`);
        }
    }
    if (request.sessionId.length === 0 && request.slug.length > 0) {
        request.sessionId = `codex/${timestampId(now)}-${request.slug}`;
    }
    validateRequest(request);
    return { request, json, dryRun };
}
function validateSlug(slug) {
    if (!/^(backlog-[0-9]+(?:-[0-9]+)*|bug-[0-9]+|issue-[A-Za-z0-9._-]+|task-[a-z0-9][a-z0-9-]*)$/.test(slug)) {
        throw new Error(`invalid claim slug: ${slug}`);
    }
}
function normalizeRepoPath(path) {
    const noBackslash = path.replace(/\\/g, "/");
    const withoutDot = noBackslash.replace(/^\.\//, "");
    return withoutDot.replace(/\/+$/g, "");
}
function validateRepoPath(path) {
    const normalized = normalizeRepoPath(path);
    if (normalized.length === 0 ||
        normalized === "." ||
        normalized.startsWith("/") ||
        normalized.startsWith("../") ||
        normalized.includes("/../") ||
        normalized === ".git" ||
        normalized.startsWith(".git/")) {
        throw new Error(`unsafe repo-relative path: ${path}`);
    }
}
function validateRequest(request) {
    validateSlug(request.slug);
    if (!/^B-[0-9]+(\.[0-9]+)*$/.test(request.backlogId)) {
        throw new Error(`invalid backlog id: ${request.backlogId}`);
    }
    if (request.scope.trim().length === 0) {
        throw new Error("--scope is required");
    }
    validateRepoPath(request.durableTarget);
    if (request.paths.length === 0) {
        throw new Error("at least one --path is required");
    }
    for (const path of request.paths) {
        validateRepoPath(path);
    }
    if (!HEARTBEAT_NAME_PATTERN.test(request.sessionId)) {
        throw new Error(`session id is not heartbeat-safe: ${request.sessionId}`);
    }
}
export function pathsOverlap(left, right) {
    const a = normalizeRepoPath(left);
    const b = normalizeRepoPath(right);
    return a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`);
}
export function findPathOverlaps(requestedPaths, activeSignals) {
    const overlaps = [];
    for (const requestedPath of requestedPaths) {
        for (const signal of activeSignals) {
            for (const activePath of signal.paths) {
                if (pathsOverlap(requestedPath, activePath)) {
                    overlaps.push({ requestedPath, activePath, signal });
                }
            }
        }
    }
    return overlaps;
}
function claimBody(request, branch) {
    const pathBullets = request.paths.map((path) => `- \`${normalizeRepoPath(path)}\``).join("\n");
    return [
        `# Claim - ${request.slug}`,
        "",
        `- **Session ID:** ${request.sessionId}`,
        `- **Harness:** ${request.harness}`,
        `- **Claimed at:** ${request.claimedAt}`,
        `- **ETA:** ${request.eta}`,
        `- **Scope:** ${request.scope}`,
        `- **Durable target:** ${normalizeRepoPath(request.durableTarget)}`,
        `- **Platform mirror:** ${request.platformMirror}`,
        "",
        "## Notes",
        "",
        `Branch: \`${branch}\``,
        "",
        "Initial intended path set:",
        "",
        pathBullets,
        "",
    ].join("\n");
}
function heartbeatBody(request, branch, worktreePath) {
    return `${JSON.stringify({
        session: request.sessionId,
        harness: request.harness,
        claim: request.slug,
        branch,
        worktree: worktreePath,
        paths: request.paths.map(normalizeRepoPath),
        updated_at: request.claimedAt,
        status: "active",
    }, null, 2)}\n`;
}
export function buildBootstrapPlan(request, gitCommonDir) {
    validateRequest(request);
    const branch = `${CLAIM_PREFIX}${request.slug}`;
    const worktreePath = resolve(request.worktreeRoot, request.slug);
    const claimRelativePath = `docs/claims/${request.slug}.md`;
    const heartbeatFilePath = join(gitCommonDir, "agent-heartbeats", `${request.sessionId.replace(/\//g, "-")}.json`);
    return {
        branch,
        worktreePath,
        claimRelativePath,
        claimFilePath: join(worktreePath, claimRelativePath),
        heartbeatFilePath,
        claimBody: claimBody(request, branch),
        heartbeatBody: heartbeatBody(request, branch, worktreePath),
        commitSubject: `claim: ${request.slug} - ${request.scope}`,
    };
}
function spawnRunner() {
    return {
        run(command, args, options) {
            const result = spawnSync(command, [...args], {
                cwd: options.cwd,
                encoding: "utf8",
                maxBuffer: 32 * 1024 * 1024,
            });
            return {
                status: result.status ?? 1,
                stdout: result.stdout ?? "",
                stderr: result.stderr ?? String(result.error ?? ""),
            };
        },
    };
}
function git(runner, repoRoot, args) {
    return runner.run(GIT_BIN, ["-C", repoRoot, ...args], {});
}
function mustGit(runner, repoRoot, args) {
    const result = git(runner, repoRoot, args);
    if (result.status !== 0) {
        throw new Error(`git ${args.join(" ")} failed: ${result.stderr || result.stdout}`);
    }
    return result.stdout.trim();
}
function optionalGitLines(runner, repoRoot, args) {
    const result = git(runner, repoRoot, args);
    if (result.status !== 0) {
        return [];
    }
    return result.stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
}
function gitCommonDir(runner, repoRoot) {
    const raw = mustGit(runner, repoRoot, ["rev-parse", "--git-common-dir"]);
    return isAbsolute(raw) ? raw : resolve(repoRoot, raw);
}
function isDirectory(path) {
    try {
        return statSync(path).isDirectory();
    }
    catch {
        return false;
    }
}
function readLocalHeartbeatSignals(commonDir) {
    const dir = join(commonDir, "agent-heartbeats");
    if (!isDirectory(dir)) {
        return [];
    }
    const signals = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (!entry.isFile() || !entry.name.endsWith(".json")) {
            continue;
        }
        const file = join(dir, entry.name);
        try {
            const parsed = JSON.parse(readFileSync(file, "utf8"));
            if (Array.isArray(parsed.paths)) {
                signals.push({
                    source: file,
                    claim: parsed.claim ?? entry.name.replace(/\.json$/, ""),
                    paths: parsed.paths.filter((path) => typeof path === "string"),
                    updatedAt: parsed.updated_at ?? null,
                });
            }
        }
        catch {
            continue;
        }
    }
    return signals;
}
function readRemoteClaimSignals(runner, repoRoot, targetBranch) {
    const branches = optionalGitLines(runner, repoRoot, ["branch", "-r", "--list", "origin/claim/*"]);
    return branches
        .filter((branch) => branch !== `origin/${targetBranch}`)
        .map((branch) => {
        const paths = optionalGitLines(runner, repoRoot, ["diff", "--name-only", `origin/main...${branch}`]);
        return {
            source: branch,
            claim: branch.replace(/^origin\/claim\//, ""),
            paths,
            updatedAt: null,
        };
    });
}
function ensureNoExistingClaim(runner, repoRoot, plan) {
    const remoteBranch = git(runner, repoRoot, ["ls-remote", "--heads", "origin", plan.branch]);
    if (remoteBranch.status === 0 && remoteBranch.stdout.trim().length > 0) {
        throw new Error(`claim branch already exists: ${plan.branch}`);
    }
    const claimOnMain = git(runner, repoRoot, ["cat-file", "-e", `origin/main:${plan.claimRelativePath}`]);
    if (claimOnMain.status === 0) {
        throw new Error(`claim file already exists on origin/main: ${plan.claimRelativePath}`);
    }
}
export function collectActiveSignals(runner, repoRoot, gitCommonDirPath, targetBranch) {
    return [...readRemoteClaimSignals(runner, repoRoot, targetBranch), ...readLocalHeartbeatSignals(gitCommonDirPath)];
}
export function assertNoPathOverlaps(paths, signals) {
    const overlaps = findPathOverlaps(paths, signals);
    if (overlaps.length === 0) {
        return;
    }
    const details = overlaps
        .map((overlap) => `${overlap.requestedPath} overlaps ${overlap.signal.source}:${overlap.activePath}`)
        .join("\n");
    throw new Error(`active claim/path overlap detected:\n${details}`);
}
function writePlanFiles(plan) {
    mkdirSync(dirname(plan.heartbeatFilePath), { recursive: true });
    writeFileSync(plan.heartbeatFilePath, plan.heartbeatBody);
    mkdirSync(dirname(plan.claimFilePath), { recursive: true });
    writeFileSync(plan.claimFilePath, plan.claimBody);
}
export function executeBootstrap(request, runner = spawnRunner()) {
    const repoRoot = resolve(request.repoRoot);
    mustGit(runner, repoRoot, ["fetch", "--prune", "origin"]);
    const commonDir = gitCommonDir(runner, repoRoot);
    const plan = buildBootstrapPlan({ ...request, repoRoot }, commonDir);
    ensureNoExistingClaim(runner, repoRoot, plan);
    assertNoPathOverlaps(request.paths, collectActiveSignals(runner, repoRoot, commonDir, plan.branch));
    if (existsSync(plan.worktreePath)) {
        throw new Error(`worktree path already exists: ${plan.worktreePath}`);
    }
    mkdirSync(request.worktreeRoot, { recursive: true });
    mustGit(runner, repoRoot, ["worktree", "add", "-b", plan.branch, plan.worktreePath, "origin/main"]);
    writePlanFiles(plan);
    mustGit(runner, plan.worktreePath, ["add", plan.claimRelativePath]);
    mustGit(runner, plan.worktreePath, [
        "commit",
        "-m",
        plan.commitSubject,
        "-m",
        "Co-Authored-By: Codex <noreply@openai.com>",
    ]);
    mustGit(runner, plan.worktreePath, ["push", "-u", "origin", plan.branch]);
    return plan;
}
function planOnly(request, runner) {
    const repoRoot = resolve(request.repoRoot);
    mustGit(runner, repoRoot, ["fetch", "--prune", "origin"]);
    const commonDir = gitCommonDir(runner, repoRoot);
    const plan = buildBootstrapPlan({ ...request, repoRoot }, commonDir);
    ensureNoExistingClaim(runner, repoRoot, plan);
    assertNoPathOverlaps(request.paths, collectActiveSignals(runner, repoRoot, commonDir, plan.branch));
    return plan;
}
function printPlan(plan, json) {
    if (json) {
        process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
        return;
    }
    process.stdout.write(`claim-branch: ${plan.branch}\n`);
    process.stdout.write(`worktree: ${plan.worktreePath}\n`);
    process.stdout.write(`claim-file: ${plan.claimRelativePath}\n`);
    process.stdout.write(`heartbeat: ${plan.heartbeatFilePath}\n`);
}
export function main(argv) {
    try {
        const { request, json, dryRun } = parseArgs(argv);
        const plan = dryRun ? planOnly(request, spawnRunner()) : executeBootstrap(request);
        printPlan(plan, json);
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
