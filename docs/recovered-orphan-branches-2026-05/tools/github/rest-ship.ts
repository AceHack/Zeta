#!/usr/bin/env bun
// rest-ship.ts — one-shot REST helper: push + open PR + arm auto-merge.
//
// Combines the workflow that B-0615-aware spawned-claude sessions need
// into a single command. Built on rest-push.ts (PR #4147) and extends it
// with PR-creation + auto-merge arming.
//
// Workflow:
//   1. POST /git/blobs (one per file)
//   2. POST /git/trees (with base_tree)
//   3. POST /git/commits (with parent = base HEAD)
//   4. POST /git/refs (creates branch)
//   5. POST /pulls (opens PR)
//   6. PUT /pulls/<N>/merge?merge_method=squash (note: REST direct merge,
//      NOT auto-merge — because auto-merge arming requires GraphQL
//      enablePullRequestAutoMerge mutation which can also be invoked
//      via `gh pr merge <N> --auto --squash`)
//
// Auto-merge arming uses `gh pr merge --auto` (GraphQL); falls back
// to leaving the PR unarmed if GraphQL is exhausted.
//
// Usage:
//   bun tools/github/rest-ship.ts \
//     --file <path> [--file <path> ...] \
//     --branch <ref> \
//     --commit-message <msg> \
//     --pr-title <title> \
//     --pr-body <body-or-@file>
//   [--base main] [--no-auto-merge] [--owner X] [--repo Y]
//
// --pr-body can be either a literal string OR `@/path/to/file` for long bodies.
//
// Output: JSON: { branch, sha, pr_number, pr_url, auto_armed: bool }
//
// Composes with:
// - PR #4147 (tools/github/rest-push.ts — the push-only sibling)
// - PR #4145 (rule documenting timeout + REST bypass discipline)
// - PR #4146 (claude-loop-tick prompts that reference REST bypass)
// - B-0615 (push-hang failure mode)

import { readFileSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";

interface Args {
    files: string[];
    branch: string;
    commitMessage: string;
    prTitle: string;
    prBody: string;
    base: string;
    owner: string;
    repo: string;
    noAutoMerge: boolean;
}

function parseArgs(argv: string[]): Args {
    const args: Args = {
        files: [],
        branch: "",
        commitMessage: "",
        prTitle: "",
        prBody: "",
        base: "main",
        owner: "Lucent-Financial-Group",
        repo: "Zeta",
        noAutoMerge: false,
    };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        const next = argv[i + 1];
        if (a === "--file" && next) { args.files.push(next); i++; }
        else if (a === "--branch" && next) { args.branch = next; i++; }
        else if (a === "--commit-message" && next) { args.commitMessage = next; i++; }
        else if (a === "--pr-title" && next) { args.prTitle = next; i++; }
        else if (a === "--pr-body" && next) {
            // Support @file for long bodies
            args.prBody = next.startsWith("@") ? readFileSync(next.slice(1), "utf8") : next;
            i++;
        }
        else if (a === "--base" && next) { args.base = next; i++; }
        else if (a === "--owner" && next) { args.owner = next; i++; }
        else if (a === "--repo" && next) { args.repo = next; i++; }
        else if (a === "--no-auto-merge") { args.noAutoMerge = true; }
        else if (a === "--help" || a === "-h") {
            process.stdout.write(`Usage:
  bun tools/github/rest-ship.ts \\
    --file <path> [--file <path> ...] \\
    --branch <ref> \\
    --commit-message <msg> \\
    --pr-title <title> \\
    --pr-body <body-or-@file> \\
    [--base main] [--no-auto-merge] [--owner X] [--repo Y]

One-shot: REST push + open PR + arm auto-merge (squash).

--pr-body can be a literal string OR @/path/to/file for long bodies.
--no-auto-merge: skip the gh pr merge --auto step (PR opens unarmed).

This script bypasses git push entirely (REST git-data API for the
commit; REST POST /pulls for the PR). The only GraphQL call is the
final auto-merge arming (gh pr merge --auto) which can be skipped
with --no-auto-merge if GraphQL budget is exhausted.

Use case: spawned-claude background sessions that need to ship a
small PR atomically without depending on git push transport
(B-0615 push-hang workaround).
`);
            process.exit(0);
        }
        else { process.stderr.write(`unknown arg: ${a}\n`); process.exit(2); }
    }
    if (args.files.length === 0) { process.stderr.write("--file required (at least one)\n"); process.exit(2); }
    if (!args.branch) { process.stderr.write("--branch required\n"); process.exit(2); }
    if (!args.commitMessage) { process.stderr.write("--commit-message required\n"); process.exit(2); }
    if (!args.prTitle) { process.stderr.write("--pr-title required\n"); process.exit(2); }
    if (!args.prBody) { process.stderr.write("--pr-body required\n"); process.exit(2); }
    return args;
}

function ghApi(method: string, path: string, body?: object): unknown {
    const cmdArgs = ["api", "-X", method, path];
    let stdin: string | undefined;
    if (body !== undefined) {
        cmdArgs.push("--input", "-");
        stdin = JSON.stringify(body);
    }
    const result = spawnSync("gh", cmdArgs, { encoding: "utf8", input: stdin, maxBuffer: 16 * 1024 * 1024 });
    if (result.status !== 0) {
        throw new Error(`gh ${method} ${path} failed (exit ${result.status}): ${result.stderr.trim() || result.stdout.trim()}`);
    }
    try { return JSON.parse(result.stdout); }
    catch (e) { throw new Error(`gh ${method} ${path} returned non-JSON: ${result.stdout.slice(0, 200)}`); }
}

function fileMode(path: string): string {
    const st = statSync(path);
    return (st.mode & 0o111) !== 0 ? "100755" : "100644";
}

function armAutoMerge(prNum: number): boolean {
    // Uses gh pr merge --auto (GraphQL). Returns true on success,
    // false if GraphQL exhausted or other arming failure.
    const result = spawnSync("gh", ["pr", "merge", String(prNum), "--auto", "--squash"], {
        encoding: "utf8",
        timeout: 30_000,
    });
    return result.status === 0;
}

function main(): void {
    const args = parseArgs(process.argv.slice(2));
    const { owner, repo, base, branch, commitMessage, prTitle, prBody, files, noAutoMerge } = args;

    // 1. Resolve base HEAD + tree
    const baseRef = ghApi("GET", `repos/${owner}/${repo}/branches/${base}`) as { commit: { sha: string } };
    const baseSha = baseRef.commit.sha;
    const baseCommit = ghApi("GET", `repos/${owner}/${repo}/git/commits/${baseSha}`) as { tree: { sha: string } };
    const baseTreeSha = baseCommit.tree.sha;

    // 2. Create blobs
    const treeEntries = files.map((path) => {
        const content = readFileSync(path);
        const blob = ghApi("POST", `repos/${owner}/${repo}/git/blobs`, {
            content: content.toString("base64"),
            encoding: "base64",
        }) as { sha: string };
        return { path, mode: fileMode(path), type: "blob", sha: blob.sha };
    });

    // 3. Create tree
    const tree = ghApi("POST", `repos/${owner}/${repo}/git/trees`, {
        base_tree: baseTreeSha,
        tree: treeEntries,
    }) as { sha: string };

    // 4. Create commit
    const commit = ghApi("POST", `repos/${owner}/${repo}/git/commits`, {
        message: commitMessage,
        tree: tree.sha,
        parents: [baseSha],
    }) as { sha: string };

    // 5. Create branch ref
    ghApi("POST", `repos/${owner}/${repo}/git/refs`, {
        ref: `refs/heads/${branch}`,
        sha: commit.sha,
    });

    // 6. Open PR via REST
    const pr = ghApi("POST", `repos/${owner}/${repo}/pulls`, {
        title: prTitle,
        head: branch,
        base,
        body: prBody,
    }) as { number: number; html_url: string };

    // 7. Arm auto-merge (uses GraphQL; may fail under exhaustion)
    let autoArmed = false;
    if (!noAutoMerge) {
        autoArmed = armAutoMerge(pr.number);
    }

    process.stdout.write(JSON.stringify({
        branch,
        sha: commit.sha,
        pr_number: pr.number,
        pr_url: pr.html_url,
        auto_armed: autoArmed,
    }) + "\n");
}

main();
