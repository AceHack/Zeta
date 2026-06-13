#!/usr/bin/env bun
// rest-push.ts — REST git-data API bypass for `git push` under saturation.
//
// When `git push` silently fails (exit 0, no remote update — see B-0615) under
// multi-agent saturation, this script lands a single-file change via the
// GitHub REST git-data API instead. The REST endpoints (POST /git/blobs,
// /git/trees, /git/commits, /git/refs) are served by different infrastructure
// than the git-push transport, so they remain responsive while push is hung.
//
// Worked example: PR #4145 + #4146 (2026-05-18) — both landed via this
// pattern after the corresponding `git push` exited 0 with no remote update.
//
// Usage:
//   bun tools/github/rest-push.ts --file <path> --branch <ref> --message <msg> [--base main] [--owner X] [--repo Y]
//
// Multi-file changes:
//   --file PATH ... (repeatable; combines into one commit)
//   --delete PATH ... (repeatable; deletes a path from the tree)
//   --rename OLD:NEW ... (repeatable; deletes OLD path and adds NEW path with content from local disk at NEW)
//
// Examples:
//   bun tools/github/rest-push.ts --file CLAUDE.md --branch otto/fix-typo-2026-05-18 \
//       --message "docs(CLAUDE): fix typo in §3"
//
//   bun tools/github/rest-push.ts \
//       --file .claude/rules/foo.md --file docs/backlog/P3/B-XXXX.md \
//       --branch otto/b0XXXX-impl-2026-05-18 \
//       --message "feat(B-XXXX): two-file change\n\n..."
//
//   # Rename a backlog row (B-0633 duplicate-ID resolution use case):
//   bun tools/github/rest-push.ts \
//       --rename docs/backlog/P3/B-0633-old-name.md:docs/backlog/P3/B-0649-new-name.md \
//       --file docs/backlog/P1/B-0635-cross-ref-updated.md \
//       --branch otto/b0633-renumber-2026-05-18 \
//       --message "rename(b0633→b0649): duplicate-ID resolution + cross-ref updates"
//
//   # Pure delete (e.g., remove a deprecated row):
//   bun tools/github/rest-push.ts --delete docs/backlog/P3/B-0XXX-deprecated.md \
//       --branch otto/b0XXX-retire-2026-05-18 \
//       --message "retire(B-0XXX): superseded by B-0YYY"
//
// Output: JSON to stdout:
//   { "branch": "...", "sha": "<commit-sha>", "url": "https://github.com/.../tree/<branch>" }
//
// Exit codes:
//   0  success
//   1  REST error (network / 4xx / 5xx)
//   2  bad usage
//
// Composes with: PR #4145 (the rule documenting the discipline)
//                PR #4146 (background-loop awareness)
//                B-0615 (the open bug class this works around)

import { readFileSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";

interface Args {
    files: string[];
    deletes: string[];
    renames: Array<{ old: string; new: string }>;
    branch: string;
    message: string;
    base: string;
    owner: string;
    repo: string;
    update: boolean;
}

function parseArgs(argv: string[]): Args {
    const args: Args = {
        files: [],
        deletes: [],
        renames: [],
        branch: "",
        message: "",
        base: "main",
        owner: "Lucent-Financial-Group",
        repo: "Zeta",
        update: false,
    };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        const next = argv[i + 1];
        if (a === "--file" && next) { args.files.push(next); i++; }
        else if (a === "--delete" && next) { args.deletes.push(next); i++; }
        else if (a === "--rename" && next) {
            const colonIdx = next.indexOf(":");
            if (colonIdx < 0) {
                process.stderr.write(`--rename requires OLD:NEW format, got: ${next}\n`);
                process.exit(2);
            }
            args.renames.push({ old: next.slice(0, colonIdx), new: next.slice(colonIdx + 1) });
            i++;
        }
        else if (a === "--branch" && next) { args.branch = next; i++; }
        else if (a === "--message" && next) { args.message = next; i++; }
        else if (a === "--base" && next) { args.base = next; i++; }
        else if (a === "--owner" && next) { args.owner = next; i++; }
        else if (a === "--repo" && next) { args.repo = next; i++; }
        else if (a === "--update") { args.update = true; }
        else if (a === "--help" || a === "-h") {
            process.stdout.write(`Usage:
  Create new branch:
    bun tools/github/rest-push.ts --file <path> --branch <ref> --message <msg> [--base main]
  Update existing branch (add a commit on top of its current HEAD):
    bun tools/github/rest-push.ts --update --file <path> --branch <existing-ref> --message <msg>

  --file can be repeated to land multiple files in one commit.
  --delete PATH can be repeated to delete files from the tree.
  --rename OLD:NEW can be repeated to delete OLD and add NEW (content read from local disk at NEW).
  --update: parent commit becomes the current HEAD of <branch> (not main).
            Uses PATCH refs/heads/<branch> after the commit is created.
            Fast-forward only; will fail if HEAD has diverged.
`);
            process.exit(0);
        }
        else { process.stderr.write(`unknown arg: ${a}\n`); process.exit(2); }
    }
    if (args.files.length === 0 && args.deletes.length === 0 && args.renames.length === 0) {
        process.stderr.write("--file, --delete, or --rename required (at least one)\n");
        process.exit(2);
    }
    if (!args.branch) { process.stderr.write("--branch required\n"); process.exit(2); }
    if (!args.message) { process.stderr.write("--message required\n"); process.exit(2); }
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
    // 100755 for executables (preserve x-bit); 100644 otherwise.
    const st = statSync(path);
    const isExec = (st.mode & 0o111) !== 0;
    return isExec ? "100755" : "100644";
}

function main(): void {
    const args = parseArgs(process.argv.slice(2));
    const { owner, repo, base, branch, message, files, deletes, renames, update } = args;

    // 1. Resolve parent commit:
    //    - create mode: parent is HEAD of <base> (default "main")
    //    - update mode: parent is HEAD of <branch> itself
    //   Tree base for diff is always parent commit's tree.
    const parentRefPath = update
        ? `repos/${owner}/${repo}/git/matching-refs/heads/${branch}`
        : `repos/${owner}/${repo}/branches/${base}`;
    let parentSha: string;
    if (update) {
        const matches = ghApi("GET", parentRefPath) as Array<{ ref: string; object: { sha: string } }>;
        const exactMatch = matches.find((m) => m.ref === `refs/heads/${branch}`);
        if (!exactMatch) {
            throw new Error(`--update mode: branch ${branch} does not exist (use create mode without --update)`);
        }
        parentSha = exactMatch.object.sha;
    } else {
        const baseRef = ghApi("GET", parentRefPath) as { commit: { sha: string } };
        parentSha = baseRef.commit.sha;
    }
    const parentCommit = ghApi("GET", `repos/${owner}/${repo}/git/commits/${parentSha}`) as { tree: { sha: string } };
    const parentTreeSha = parentCommit.tree.sha;

    // 2. Build tree entries: blobs for adds + renames (new side); sha:null for deletes + renames (old side).
    //    GitHub treats { sha: null } as "delete this path from the base tree."
    const treeEntries: Array<{ path: string; mode: string; type: "blob"; sha: string | null }> = [];

    // Adds (--file)
    for (const path of files) {
        const content = readFileSync(path);
        const blob = ghApi("POST", `repos/${owner}/${repo}/git/blobs`, {
            content: content.toString("base64"),
            encoding: "base64",
        }) as { sha: string };
        treeEntries.push({ path, mode: fileMode(path), type: "blob", sha: blob.sha });
    }

    // Renames (--rename OLD:NEW): delete OLD, add NEW (content from local disk at NEW path)
    for (const { old: oldPath, new: newPath } of renames) {
        const content = readFileSync(newPath);
        const blob = ghApi("POST", `repos/${owner}/${repo}/git/blobs`, {
            content: content.toString("base64"),
            encoding: "base64",
        }) as { sha: string };
        // Delete the old path
        treeEntries.push({ path: oldPath, mode: "100644", type: "blob", sha: null });
        // Add the new path
        treeEntries.push({ path: newPath, mode: fileMode(newPath), type: "blob", sha: blob.sha });
    }

    // Pure deletes (--delete)
    for (const path of deletes) {
        treeEntries.push({ path, mode: "100644", type: "blob", sha: null });
    }

    // 3. Create tree
    const tree = ghApi("POST", `repos/${owner}/${repo}/git/trees`, {
        base_tree: parentTreeSha,
        tree: treeEntries,
    }) as { sha: string };

    // 4. Create commit (parent is base HEAD or branch HEAD depending on mode)
    const commit = ghApi("POST", `repos/${owner}/${repo}/git/commits`, {
        message,
        tree: tree.sha,
        parents: [parentSha],
    }) as { sha: string };

    // 5. Either create or update the branch ref.
    //    matching-refs (vs straight git/refs/heads/<branch>) handles
    //    ref paths with slashes more reliably across gh-api versions.
    if (update) {
        ghApi("PATCH", `repos/${owner}/${repo}/git/refs/heads/${branch}`, {
            sha: commit.sha,
            // No `force: true` — fast-forward only; protects against
            // accidentally rewriting peer commits if HEAD moved between
            // our parent-read and our PATCH.
        });
    } else {
        ghApi("POST", `repos/${owner}/${repo}/git/refs`, {
            ref: `refs/heads/${branch}`,
            sha: commit.sha,
        });
    }

    process.stdout.write(JSON.stringify({
        branch,
        sha: commit.sha,
        url: `https://github.com/${owner}/${repo}/tree/${branch}`,
        mode: update ? "update" : "create",
    }) + "\n");
}

main();
