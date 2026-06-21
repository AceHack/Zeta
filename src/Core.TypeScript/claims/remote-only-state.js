#!/usr/bin/env bun
// remote-only-state.ts -- inspect git-native claim state without local bus assumptions.
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
const GIT_BIN = "/usr/bin/git";
const CLAIM_REF_PREFIX = "refs/heads/claim/";
const DEFAULT_GIT_NETWORK_TIMEOUT_MS = 30_000;
function usage() {
    return [
        "Usage:",
        "  bun src/Core.TypeScript/claims/remote-only-state.ts [--repo-root DIR] [--remote origin] [--git-timeout-ms MS] [--no-fetch] [--json]",
        "",
        "Reads remote git claim branches as the coordination source of truth.",
        "Does not inspect local broadcasts, heartbeats, terminal logs, or worktree names.",
    ].join("\n");
}
function requireValue(flag, value) {
    if (value === undefined || value.startsWith("--")) {
        throw new Error(`${flag} requires a value`);
    }
    return value;
}
function requirePositiveInteger(flag, value) {
    const raw = requireValue(flag, value);
    if (!/^\d+$/.test(raw)) {
        throw new Error(`${flag} must be a positive integer`);
    }
    const parsed = Number(raw);
    if (!Number.isSafeInteger(parsed) || parsed <= 0) {
        throw new Error(`${flag} must be a positive integer`);
    }
    return parsed;
}
function parseArgs(argv) {
    const args = {
        repoRoot: process.cwd(),
        remote: "origin",
        fetch: true,
        json: false,
        gitTimeoutMs: DEFAULT_GIT_NETWORK_TIMEOUT_MS,
    };
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === "--repo-root") {
            args.repoRoot = requireValue(arg, argv[++i]);
        }
        else if (arg === "--remote") {
            args.remote = requireValue(arg, argv[++i]);
        }
        else if (arg === "--git-timeout-ms") {
            args.gitTimeoutMs = requirePositiveInteger(arg, argv[++i]);
        }
        else if (arg === "--no-fetch") {
            args.fetch = false;
        }
        else if (arg === "--json") {
            args.json = true;
        }
        else if (arg === "--help" || arg === "-h") {
            process.stdout.write(`${usage()}\n`);
            process.exit(0);
        }
        else {
            throw new Error(`unknown arg: ${arg}`);
        }
    }
    return { ...args, repoRoot: resolve(args.repoRoot) };
}
function spawnRunner() {
    return {
        run(command, args, options) {
            const result = spawnSync(command, [...args], {
                cwd: options.cwd,
                encoding: "utf8",
                maxBuffer: 32 * 1024 * 1024,
                timeout: options.timeoutMs,
            });
            const errorText = result.error ? String(result.error) : result.signal ? `terminated by ${result.signal}` : "";
            return {
                status: result.status ?? 1,
                stdout: result.stdout ?? "",
                stderr: result.stderr || errorText,
            };
        },
    };
}
function git(runner, repoRoot, args, options = {}) {
    return runner.run(GIT_BIN, ["-C", repoRoot, ...args], options);
}
function mustGit(runner, repoRoot, args, options = {}) {
    const result = git(runner, repoRoot, args, options);
    if (result.status !== 0) {
        throw new Error(`git ${args.join(" ")} failed: ${result.stderr || result.stdout}`);
    }
    return result.stdout;
}
function normalizeRemote(remote) {
    if (!/^[A-Za-z0-9._/-]+$/.test(remote) || remote.startsWith("-") || remote.includes("..")) {
        throw new Error(`unsafe remote name: ${remote}`);
    }
    return remote;
}
function normalizeSlug(slug) {
    if (!/^[A-Za-z0-9._-]+$/.test(slug) || slug.startsWith("-") || slug.includes("..")) {
        throw new Error(`unsafe claim slug: ${slug}`);
    }
    return slug;
}
export function parseRemoteClaimRefs(output) {
    return output
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
        const [sha, ref] = line.split(/\s+/, 2);
        if (!sha || !ref) {
            throw new Error(`invalid ls-remote row: ${line}`);
        }
        if (!ref.startsWith(CLAIM_REF_PREFIX)) {
            throw new Error(`unexpected non-claim ref: ${ref}`);
        }
        const slug = normalizeSlug(ref.slice(CLAIM_REF_PREFIX.length));
        return {
            sha,
            ref,
            branch: `claim/${slug}`,
            slug,
        };
    });
}
function stripInlineCode(value) {
    const trimmed = value.trim();
    if (trimmed.startsWith("`") && trimmed.endsWith("`") && trimmed.length >= 2) {
        return trimmed.slice(1, -1);
    }
    return trimmed;
}
export function parseDurableTarget(body) {
    const match = body.match(/^- \*\*Durable target:\*\* (.+)$/m);
    return match?.[1]?.trim() ?? null;
}
export function parseClaimPaths(body) {
    const lines = body.split(/\r?\n/);
    const paths = [];
    let inPathSet = false;
    for (const line of lines) {
        if (line.trim() === "Initial intended path set:") {
            inPathSet = true;
            continue;
        }
        if (!inPathSet) {
            continue;
        }
        if (line.startsWith("## ")) {
            break;
        }
        const match = line.match(/^\s*-\s+(.+)$/);
        if (match?.[1]) {
            paths.push(stripInlineCode(match[1]));
        }
    }
    return paths;
}
function claimPath(slug) {
    return `docs/claims/${normalizeSlug(slug)}.md`;
}
export function classifyRemoteClaimCleanup(claimFileAvailable, mergedToMain) {
    if (!claimFileAvailable) {
        return {
            disposition: "missing-claim-file",
            mergedToMain,
            reason: "remote claim branch exists but its expected docs/claims file is absent",
            nextAction: "inspect branch history; retire the remote claim ref only after recording release evidence",
        };
    }
    if (mergedToMain === true) {
        return {
            disposition: "merged-claim-residue",
            mergedToMain,
            reason: "remote claim branch head is already reachable from main while the claim file remains readable",
            nextAction: "add a release commit or cleanup receipt before treating the path set as unowned",
        };
    }
    if (mergedToMain === null) {
        return {
            disposition: "merge-state-unknown",
            mergedToMain,
            reason: "local git could not prove whether the remote claim head is reachable from main",
            nextAction: "refresh remote refs and retry before force-releasing or overlapping this claim",
        };
    }
    return {
        disposition: "active",
        mergedToMain,
        reason: "remote claim branch head is not reachable from main",
        nextAction: "treat the claim path set as owned until release, handoff, or documented stale force-release",
    };
}
function readMergeState(runner, repoRoot, remote, ref) {
    const result = git(runner, repoRoot, ["merge-base", "--is-ancestor", ref.sha, `${remote}/main`]);
    if (result.status === 0) {
        return { mergedToMain: true, error: null };
    }
    if (result.status === 1) {
        return { mergedToMain: false, error: null };
    }
    return {
        mergedToMain: null,
        error: result.stderr || result.stdout || `could not classify merge state for ${ref.branch}`,
    };
}
function readRemoteClaim(runner, repoRoot, remote, ref, mergedToMain) {
    const path = claimPath(ref.slug);
    const result = git(runner, repoRoot, ["show", `${remote}/${ref.branch}:${path}`]);
    if (result.status !== 0) {
        return {
            ref,
            claimPath: path,
            body: null,
            paths: [],
            durableTarget: null,
            cleanup: classifyRemoteClaimCleanup(false, mergedToMain),
            error: result.stderr || result.stdout || "claim file unavailable",
        };
    }
    return {
        ref,
        claimPath: path,
        body: result.stdout,
        paths: parseClaimPaths(result.stdout),
        durableTarget: parseDurableTarget(result.stdout),
        cleanup: classifyRemoteClaimCleanup(true, mergedToMain),
        error: null,
    };
}
export function collectRemoteClaimState(runner, repoRoot, remoteName = "origin", fetch = true, gitNetworkTimeoutMs = DEFAULT_GIT_NETWORK_TIMEOUT_MS) {
    const remote = normalizeRemote(remoteName);
    const errors = [];
    if (fetch) {
        const fetched = git(runner, repoRoot, ["fetch", "--prune", remote], { timeoutMs: gitNetworkTimeoutMs });
        if (fetched.status !== 0) {
            errors.push(fetched.stderr || fetched.stdout || `git fetch --prune ${remote} failed`);
        }
    }
    const refs = parseRemoteClaimRefs(mustGit(runner, repoRoot, ["ls-remote", "--heads", remote, "claim/*"], { timeoutMs: gitNetworkTimeoutMs }));
    const claims = refs.map((ref) => {
        const mergeState = readMergeState(runner, repoRoot, remote, ref);
        if (mergeState.error) {
            errors.push(`${ref.branch}: ${mergeState.error}`);
        }
        return readRemoteClaim(runner, repoRoot, remote, ref, mergeState.mergedToMain);
    });
    for (const claim of claims) {
        if (claim.error) {
            errors.push(`${claim.ref.branch}: ${claim.error}`);
        }
    }
    return { remote, claims, errors };
}
function printState(state, json) {
    if (json) {
        process.stdout.write(`${JSON.stringify(state, null, 2)}\n`);
        return;
    }
    process.stdout.write(`remote: ${state.remote}\n`);
    process.stdout.write(`claims: ${state.claims.length}\n`);
    for (const claim of state.claims) {
        process.stdout.write(`- ${claim.ref.branch} ${claim.ref.sha.slice(0, 12)}\n`);
        if (claim.durableTarget) {
            process.stdout.write(`  target: ${claim.durableTarget}\n`);
        }
        process.stdout.write(`  cleanup: ${claim.cleanup.disposition}\n`);
        process.stdout.write(`  next: ${claim.cleanup.nextAction}\n`);
        for (const path of claim.paths) {
            process.stdout.write(`  path: ${path}\n`);
        }
        if (claim.error) {
            process.stdout.write(`  error: ${claim.error}\n`);
        }
    }
    for (const error of state.errors) {
        process.stderr.write(`${error}\n`);
    }
}
export function main(argv) {
    try {
        const args = parseArgs(argv);
        const state = collectRemoteClaimState(spawnRunner(), args.repoRoot, args.remote, args.fetch, args.gitTimeoutMs);
        printState(state, args.json);
        return state.errors.length === 0 ? 0 : 2;
    }
    catch (error) {
        process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n\n${usage()}\n`);
        return 1;
    }
}
if (import.meta.main) {
    process.exit(main(process.argv.slice(2)));
}
